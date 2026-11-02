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
/** A refusal decided by this client outside the request exchange (a malformed answer or argument): no owner effect. */
const refuse=(code='UNAVAILABLE',effect='none')=>{throw intentFault(code,effect);};
const sha=value=>createHash('sha256').update(value).digest('hex');
const scalar=value=>value===null||['string','number','boolean'].includes(typeof value);
const ownValue=(error,name)=>error!==null&&typeof error==='object'?Object.getOwnPropertyDescriptor(error,name)?.value:undefined;
/** A proposal POST answered with one of these statuses created nothing: Core's create refuses before its transaction
 * (400 invalid input, 401/403 identity or service authority, 404 conversation or route, 422 validation) and only ever
 * answers 201 after it. The preview edge answers 404 for a route it does not forward, so Core never saw the request. */
const DEFINITE_REFUSALS=new Set([400,401,403,404,422]);
/** One owner constant for control's log line (`SESSION_UNAVAILABLE`, `ECONNREFUSED`, `UNABLE_TO_VERIFY_LEAF_SIGNATURE`,
 * `PREVIEW_ROUTE_NOT_FOUND`): never a message, host, identifier or free text. */
const TOKEN=/^[A-Z][A-Z0-9_]{1,62}$/u;
const tokenOf=error=>[ownValue(error,'code'),ownValue(ownValue(error,'cause'),'code'),ownValue(error,'name')].find(value=>typeof value==='string'&&TOKEN.test(value));
/** The answering owner's own constant (`{"error":"PREVIEW_ROUTE_NOT_FOUND"}`), read within the same lifetime from at most 1 KiB
 * of a definite refusal; a message, a host or anything not constant-shaped is dropped. */
async function refusalBody(response,life){
 let reader;try{
  const stream=responseBody(response);if(!stream||!/^application\/json/iu.test(response.headers.get('content-type')??''))return undefined;
  reader=stream.getReader();const chunks=[];let bytes=0;
  while(bytes<1024){const part=await life.run(()=>reader.read());if(part.done)break;if(!(part.value instanceof Uint8Array))return undefined;bytes+=part.value.byteLength;chunks.push(part.value);}
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));
 }catch{return undefined;}finally{try{reader?.releaseLock();}catch{}}
}
const refusalToken=parsed=>[parsed?.error,parsed?.message].find(value=>typeof value==='string'&&TOKEN.test(value));
/** Core's own one-line account of a definite refusal (Nest's `message`: "input.parameters.clientId is not supported", "This
 * conversation is not scoped to a Research Portfolio"), so the model corrects the request or explains it instead of retrying blind
 * (2 Nov M37: two identical refusals, the model guessing which field was wrong). Field paths and fixed words only: a line with an
 * identifier, a long number or anything outside plain punctuation is dropped. */
const SAID=/^[A-Za-z][A-Za-z0-9 .,:;'()_-]{0,199}$/u,IDENTIFIER=/[0-9a-f]{8}-[0-9a-f]{4}|\d{5}/iu;
const refusalSaid=parsed=>typeof parsed?.message==='string'&&SAID.test(parsed.message)&&!IDENTIFIER.test(parsed.message)?parsed.message:undefined;
/** Core's own gate on the proposal POST (`MERIV2_ACTION_PROPOSALS_ENABLED`, `assertEnabled` in its action-proposal service)
 * answers 503 "MeriV2 action proposals are disabled." before any proposal is created: a definite refusal, not a lost answer
 * (2 Nov preview: every proposal card ended "Result uncertain" on that 1 ms answer). Any other 503 stays unknown. */
const DISABLED=/\bproposals are disabled\b/iu;
const proposalsDisabled=parsed=>typeof parsed?.message==='string'&&DISABLED.test(parsed.message);
export function createResearchActionCoreClient({origin,getCredentials,getServiceSecret,reservedCredentials,now,fetchImpl=globalThis.fetch,maxRequestMs=10000}){
 origin=retainedOrigin(origin);
 if([getCredentials,getServiceSecret,reservedCredentials,now,fetchImpl].some(fn=>typeof fn!=='function'))refuse();
 /** `kind` names the request in the user's terms for the explained failure. */
 async function call(selection,method,path,body,effect=false,kind='the request'){
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
   if(acquired?.redirected)refuse('UNAVAILABLE');
   if(![200,201].includes(acquired?.status)){
    const status=acquired?.status,code=[401,403].includes(status)?'ACCESS_DENIED':[400,404,409,422].includes(status)?'REFUSED':'UNAVAILABLE';
    // A definite refusal of the proposal POST left nothing behind: the delivery settles FAILED, with the answering owner's
    // constant as the reason for the log line. Only this path decides its effect; a 409, a 5xx or a lost answer after dispatch
    // still may have created the proposal and keeps the unknown effect below.
    if(effect&&path===prefix&&method==='POST'){
     if(DEFINITE_REFUSALS.has(status)){
      const body=await refusalBody(acquired,life),said=refusalSaid(body);
      throw Object.assign(intentFault(code,'none',`${kind} was answered before any proposal was created (HTTP ${status}${said?': '+said:''})`,refusalToken(body)??`HTTP_${status}`),{definite:true});
     }
     if(status===503&&proposalsDisabled(await refusalBody(acquired,life)))throw Object.assign(intentFault('UNAVAILABLE','none',`${kind} was refused because proposals are switched off at the backend, so nothing was created (HTTP 503)`,'CORE_PROPOSALS_DISABLED'),{definite:true});
    }
    refuse(code);
   }
   // Nest's existing action-proposal POSTs return 201; the bounded reader otherwise expects 200.
   const response=acquired.status===201?new Response(responseBody(acquired),{status:200,headers:acquired.headers}):acquired;
   const value=data(await readJsonResponse(response,{lifetime:life,maxResponseBytes:4194304}));
   if((await borrow()).credential!==first.credential)refuse('ACCESS_DENIED');life.check();return value;
  }catch(error){
   // Only the definite refusal above decides its own effect; anything else after dispatch stays unknown (Core may have acted),
   // as on every other Core client. The detail says in plain words what happened; the owner's constant is the reason.
   const definite=ownValue(error,'definite')===true,status=acquired?.status;
   const detail=definite?error.detail:acquired===undefined?`${kind} ${sent?'got no answer':'was not sent'}`:Number.isSafeInteger(status)&&status<300?`${kind} was answered but could not be released`:`${kind} was answered HTTP ${Math.floor(status/100)}xx`;
   const reason=definite?error.reason:Number.isSafeInteger(status)&&status>=300?`HTTP_${status}`:tokenOf(error);
   throw intentFault(['ACCESS_DENIED','INVALID_ARGUMENTS','DEADLINE','CANCELLED','REFUSED'].includes(error?.code)?error.code:'UNAVAILABLE',definite?'none':sent&&effect?'unknown':'none',detail,reason);
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
   const result=await call({binding,selectedClientId,signal,deadlineMs},'POST','/api/clio/tools/manage_research_portfolio',{version:1,input:request,currentTurn:{tenantId:binding.tenantId,userId:binding.actorId,conversationId:binding.conversationId,selectedClientId}},false,'the management read');
   return validators.managementResult(request.action,result);
  },
  async prepare({binding,selectedClientId,operation,request,operationKey,signal,deadlineMs}){
   if(!RESEARCH_ACTION_INTENTS.includes(operation))refuse('INVALID_ARGUMENTS');
   const bound=validators.bind(operation,validators.normalizeInput(operation,request,{binding}),operationKey),selection={binding,selectedClientId,signal,deadlineMs};
   const answer=await call(selection,'POST',prefix,{version:1,proposal:{tool:operation,input:bound,conversationId:binding.conversationId,surface:'chat'},
    currentTurn:{tenantId:binding.tenantId,userId:binding.actorId,conversationId:binding.conversationId,selectedClientId}},true,'the proposal request');
   if(answer?.disposition!=='pending_approval'||answer.proposal?.status!=='proposed'||answer.proposal.tool!==operation||Object.hasOwn(answer.proposal,'oneTimeResult'))throw intentFault('REFUSED','unknown','the proposal request was answered with something other than a pending proposal');
   const p=answer.proposal;
   if(operation==='save_research_portfolio_output_to_client'&&p.preview?.client?.id!==bound.clientId)throw intentFault('REFUSED','unknown','the proposal request was answered for another client');
   return {proposalId:p.proposalId,request:bound,preview:preview(p.preview,typeof p.preview?.portfolioId==='string'?p.preview.portfolioId:undefined),createdAt:p.createdAt,expiresAt:p.expiresAt};
  },
  async read({proposal,signal,deadlineMs}){
   validators.assertProposal(proposal);
   const rows=await call({proposal,signal,deadlineMs},'GET',prefix+'?'+new URLSearchParams({conversationId:proposal.binding.conversationId,proposalId:proposal.proposalId}),undefined,false,'the proposal status read');
   if(!Array.isArray(rows)||rows.length!==1)refuse();return decided(rows[0],proposal);
  },
  async decide({proposal,decision,signal,deadlineMs}){
   validators.assertProposal(proposal);if(!['approved','rejected'].includes(decision))refuse('INVALID_ARGUMENTS');
   return decided(await call({proposal,signal,deadlineMs},'POST',prefix+'/'+proposal.proposalId+'/'+(decision==='approved'?'approve':'dismiss'),{},true,'the decision request'),proposal);
  },
 });
}
