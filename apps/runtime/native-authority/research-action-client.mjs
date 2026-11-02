/** Finite attended Core action-proposal routes for the ten MO-05 Research Portfolio writes. Core owns proposal creation,
 * decisions, idempotent effects and receipts. No token custody or retry; an uncertain response is observed through read(). */
import {createHash} from 'node:crypto';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {retainedOrigin} from '../../../packages/contracts/runtime-0.2/retained-reads.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {readJsonResponse,responseBody,cancelBody} from '../../gateway/sources/json-response.mjs';
import {researchActionValidators as validators,validateShape} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {RESEARCH_ACTION_INTENTS} from '../../../packages/contracts/retrieval-0.2/research-portfolio-action-validation.mjs';
import {intentFault} from '../../control/intents/faults.mjs';
const prefix='/api/clio/action-proposals',token=/^[\x21-\x7e]{1,8192}$/u;
const refuse=(code='UNAVAILABLE',effect='none',detail)=>{throw intentFault(code,effect,detail);};
const sha=value=>createHash('sha256').update(value).digest('hex');
const scalar=value=>value===null||['string','number','boolean'].includes(typeof value);
const EFFECTS=new Set(['none','unknown']),ownValue=(error,name)=>error!==null&&typeof error==='object'?Object.getOwnPropertyDescriptor(error,name)?.value:undefined;
/** A proposal POST answered with one of these statuses created nothing: Core's create refuses before its transaction
 * (400 invalid input, 401/403 identity or service authority, 404 conversation or route, 422 validation) and only ever
 * answers 201 after it. The preview edge answers 404 for a route it does not forward, so Core never saw the request. */
const DEFINITE_REFUSALS=new Set([400,401,403,404,422]);
/** The owner's own bounded refusal token (`{"error":"PREVIEW_ROUTE_NOT_FOUND"}` or a Nest `{"message":...}`), read within
 * the same lifetime from at most 1 KiB of the answer, so the explained refusal names who answered; anything else is dropped. */
async function refusalToken(response,life){
 let reader;try{
  const stream=responseBody(response);if(!stream||!/^application\/json/iu.test(response.headers.get('content-type')??''))return undefined;
  reader=stream.getReader();const chunks=[];let bytes=0;
  while(bytes<1024){const part=await life.run(()=>reader.read());if(part.done)break;if(!(part.value instanceof Uint8Array))return undefined;bytes+=part.value.byteLength;chunks.push(part.value);}
  const parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks))),token=[parsed?.error,parsed?.message].find(value=>typeof value==='string');
  return typeof token==='string'&&/^[A-Za-z0-9 _.:-]{1,80}$/u.test(token)?token:undefined;
 }catch{return undefined;}finally{try{reader?.releaseLock();}catch{}}
}
export function createResearchActionCoreClient({origin,getCredentials,getServiceSecret,reservedCredentials,now,fetchImpl=globalThis.fetch,maxRequestMs=10000}){
 origin=retainedOrigin(origin);
 if([getCredentials,getServiceSecret,reservedCredentials,now,fetchImpl].some(fn=>typeof fn!=='function'))refuse();
 async function call(selection,method,path,body,effect=false){
  const life=createOperationLifetime({now,signal:selection.signal,deadlineMs:Math.min(selection.deadlineMs??Infinity,now()+maxRequestMs),errorFactory:code=>intentFault(code)});
  let acquired,sent=false;
  try{
   const forbidden=await life.run(()=>reservedCredentials());
   const borrow=async()=>{
    const c=data(own(await getCredentials({...selection,signal:life.signal}),['credential','expiresAtMs']));
    if(typeof c.credential!=='string'||!token.test(c.credential)||!Number.isSafeInteger(c.expiresAtMs)||c.expiresAtMs<=now()||forbidden.has(sha(c.credential)))refuse('ACCESS_DENIED');
    life.limitDeadline(c.expiresAtMs);return c;
   };
   const first=await borrow(),secret=await life.run(()=>getServiceSecret());
   if(typeof secret!=='string'||!token.test(secret)||secret===first.credential||forbidden.has(sha(secret)))refuse();
   if((await borrow()).credential!==first.credential)refuse('ACCESS_DENIED');
   sent=true;
   acquired=await life.run(signal=>fetchImpl(origin+path,{method,redirect:'error',credentials:'omit',cache:'no-store',signal,
    headers:{authorization:'Bearer '+first.credential,'x-internal-service-secret':secret,accept:'application/json','accept-encoding':'identity',...(body===undefined?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})}));
   if(acquired?.redirected)refuse('UNAVAILABLE',effect?'unknown':'none');
   if(![200,201].includes(acquired?.status)){
    const status=acquired?.status,code=[401,403].includes(status)?'ACCESS_DENIED':[400,404,409,422].includes(status)?'REFUSED':'UNAVAILABLE';
    // A definite refusal of the proposal POST left nothing behind: the delivery settles FAILED with the answering owner's
    // token, never UNKNOWN. A 409, a 5xx or a lost answer after dispatch still may have created the proposal.
    const definite=effect&&path===prefix&&method==='POST'&&DEFINITE_REFUSALS.has(status),token=definite?await refusalToken(acquired,life):undefined;
    refuse(code,definite||!effect?'none':'unknown',definite?`HTTP ${status}${token===undefined?'':' '+token} answered the proposal request before any proposal was created`:undefined);
   }
   // Nest's existing action-proposal POSTs return 201; the bounded reader otherwise expects 200.
   const response=acquired.status===201?new Response(responseBody(acquired),{status:200,headers:acquired.headers}):acquired;
   const value=data(await readJsonResponse(response,{lifetime:life,maxResponseBytes:4194304}));
   if((await borrow()).credential!==first.credential)refuse('ACCESS_DENIED',effect?'unknown':'none');life.check();return value;
  }catch(error){
   // A refusal that already names its effect (a definite 4xx answer above) keeps it; anything else after dispatch stays unknown.
   const effectOf=ownValue(error,'effect'),detail=ownValue(error,'detail');
   throw intentFault(['ACCESS_DENIED','INVALID_ARGUMENTS','DEADLINE','CANCELLED','REFUSED'].includes(error?.code)?error.code:'UNAVAILABLE',EFFECTS.has(effectOf)?effectOf:sent&&effect?'unknown':'none',typeof detail==='string'?detail:undefined);
  }
  finally{try{if(acquired)cancelBody(responseBody(acquired));}catch{}life.close();}
 }
 /** Display-only preview facts Core attached; never fed back into execution. */
 function preview(raw,portfolioId){
  const p=data(raw);if(typeof p?.label!=='string'||!p.label.trim()||p.label.length>200)refuse();
  const fields=p.fields&&typeof p.fields==='object'&&!Array.isArray(p.fields)?Object.fromEntries(Object.entries(p.fields).filter(([,value])=>scalar(value)).slice(0,64)):undefined;
  return {label:p.label,...(portfolioId?{portfolioId}:{}),...(typeof p.client?.name==='string'&&p.client.name.length>0&&p.client.name.length<=1000?{clientName:p.client.name}:{}),...(fields&&Object.keys(fields).length?{fields}:{})};
 }
 /** The owner's current status, and its bounded result summary once the effect succeeded. A publish secret never appears here. */
 function decided(raw,proposal){
  const p=data(raw);if(p?.proposalId!==proposal.proposalId||p.tool!==proposal.operation||Object.hasOwn(p,'oneTimeResult'))refuse();
  const summary=p.status==='succeeded'&&p.resultSummary&&typeof p.resultSummary==='object'&&!Array.isArray(p.resultSummary)?p.resultSummary:undefined;
  return validators.decided({proposalStatus:p.status,...(summary===undefined?{}:{resultSummary:summary})});
 }
 return Object.freeze({
  async readManagement({binding,selectedClientId,request,signal,deadlineMs}){
   if(!validators.isManagementRead('manage_research_portfolio',request,{binding}))refuse('INVALID_ARGUMENTS');
   const result=await call({binding,selectedClientId,signal,deadlineMs},'POST','/api/clio/tools/manage_research_portfolio',{version:1,input:request,currentTurn:{tenantId:binding.tenantId,userId:binding.actorId,conversationId:binding.conversationId,selectedClientId}});
   return validators.managementResult(request.action,result);
  },
  async prepare({binding,selectedClientId,operation,request,operationKey,signal,deadlineMs}){
   if(!RESEARCH_ACTION_INTENTS.includes(operation))refuse('INVALID_ARGUMENTS');
   const bound=validators.bind(operation,validators.normalizeInput(operation,request,{binding}),operationKey),selection={binding,selectedClientId,signal,deadlineMs};
   const answer=await call(selection,'POST',prefix,{version:1,proposal:{tool:operation,input:bound,conversationId:binding.conversationId,surface:'chat'},
    currentTurn:{tenantId:binding.tenantId,userId:binding.actorId,conversationId:binding.conversationId,selectedClientId}},true);
   if(answer?.disposition!=='pending_approval'||answer.proposal?.status!=='proposed'||answer.proposal.tool!==operation||Object.hasOwn(answer.proposal,'oneTimeResult'))refuse('REFUSED','unknown');
   const p=answer.proposal;
   if(operation==='save_research_portfolio_output_to_client'&&p.preview?.client?.id!==bound.clientId)refuse('REFUSED','unknown');
   return {proposalId:p.proposalId,request:bound,preview:preview(p.preview,typeof p.preview?.portfolioId==='string'?p.preview.portfolioId:undefined),createdAt:p.createdAt,expiresAt:p.expiresAt};
  },
  async read({proposal,signal,deadlineMs}){
   validators.assertProposal(proposal);
   const rows=await call({proposal,signal,deadlineMs},'GET',prefix+'?'+new URLSearchParams({conversationId:proposal.binding.conversationId,proposalId:proposal.proposalId}));
   if(!Array.isArray(rows)||rows.length!==1)refuse();return decided(rows[0],proposal);
  },
  async decide({proposal,decision,signal,deadlineMs}){
   validators.assertProposal(proposal);if(!['approved','rejected'].includes(decision))refuse('INVALID_ARGUMENTS');
   return decided(await call({proposal,signal,deadlineMs},'POST',prefix+'/'+proposal.proposalId+'/'+(decision==='approved'?'approve':'dismiss'),{},true),proposal);
  },
 });
}
