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
const refuse=(code='UNAVAILABLE',effect='none')=>{throw intentFault(code,effect);};
const sha=value=>createHash('sha256').update(value).digest('hex');
const scalar=value=>value===null||['string','number','boolean'].includes(typeof value);
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
   if(![200,201].includes(acquired?.status))refuse([401,403].includes(acquired?.status)?'ACCESS_DENIED':[400,404,409,422].includes(acquired?.status)?'REFUSED':'UNAVAILABLE',effect?'unknown':'none');
   // Nest's existing action-proposal POSTs return 201; the bounded reader otherwise expects 200.
   const response=acquired.status===201?new Response(responseBody(acquired),{status:200,headers:acquired.headers}):acquired;
   const value=data(await readJsonResponse(response,{lifetime:life,maxResponseBytes:4194304}));
   if((await borrow()).credential!==first.credential)refuse('ACCESS_DENIED',effect?'unknown':'none');life.check();return value;
  }catch(error){throw intentFault(['ACCESS_DENIED','INVALID_ARGUMENTS','DEADLINE','CANCELLED','REFUSED'].includes(error?.code)?error.code:'UNAVAILABLE',sent&&effect?'unknown':'none');}
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
