/** Finite attended Core sharing routes. Core owns proposal creation, decisions and effects. No token custody or retry. */
import {createHash} from 'node:crypto';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {retainedOrigin} from '../../../packages/contracts/runtime-0.2/retained-reads.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {readJsonResponse,responseBody,cancelBody} from '../../gateway/sources/json-response.mjs';
import {researchShareValidators as validators,validateShape} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {intentFault} from '../../control/intents/faults.mjs';
const prefix='/api/clio/action-proposals',token=/^[\x21-\x7e]{1,8192}$/u;
const refuse=(code='UNAVAILABLE',effect='none')=>{throw intentFault(code,effect);};
const sha=value=>createHash('sha256').update(value).digest('hex');
export function createResearchSharingCoreClient({origin,getCredentials,getServiceSecret,reservedCredentials,now,fetchImpl=globalThis.fetch,maxRequestMs=10000}){
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
 function status(raw,proposal){
  const p=data(raw);if(p?.proposalId!==proposal.proposalId||p.tool!==proposal.operation)refuse();
  validateShape('ResearchShareProposalStatus',p.status);return p.status;
 }
 return Object.freeze({
  async prepare({binding,selectedClientId,operation,request,operationKey,signal,deadlineMs}){
   const input=validators.normalizeInput(operation,request,{binding}),selection={binding,selectedClientId,signal,deadlineMs};let bound=input,portfolioId;
   if(operation==='publish_research_portfolio_share_link'){
    if(selectedClientId!==null&&input.clientId!==selectedClientId)refuse('ACCESS_DENIED');
    const state=await call(selection,'POST','/api/clio/tools/get_research_portfolio_share_links',{version:1,input:{conversationId:binding.conversationId},
     currentTurn:{tenantId:binding.tenantId,userId:binding.actorId,conversationId:binding.conversationId,selectedClientId}});
    validators.assertOutput('get_research_portfolio_share_links',state,{conversationId:binding.conversationId},{binding});
    portfolioId=state.sharing.portfolioId;
    const {conversationId,...choices}=input;
    const preview=await call(selection,'POST',`/api/research-portfolios/${state.sharing.portfolioId}/share-preview`,choices);
    if(!preview||typeof preview.previewHash!=='string'||!/^[a-f0-9]{64}$/u.test(preview.previewHash)||!Number.isSafeInteger(preview.designVersion)||preview.designVersion<1)refuse();
    bound={...input,operationKey,previewHash:preview.previewHash,expectedDesignVersion:preview.designVersion};validateShape('ResearchSharePublishBound',bound);
   }
   const answer=await call(selection,'POST',prefix,{version:1,proposal:{tool:operation,input:bound,conversationId:binding.conversationId,surface:'chat'},
    currentTurn:{tenantId:binding.tenantId,userId:binding.actorId,conversationId:binding.conversationId,selectedClientId}},true);
   if(answer?.disposition!=='pending_approval'||answer.proposal?.status!=='proposed'||answer.proposal.tool!==operation||Object.hasOwn(answer.proposal,'oneTimeResult'))refuse('REFUSED','unknown');
   const p=answer.proposal,label=operation==='publish_research_portfolio_share_link'?'Publish client share link':'Revoke client share link';
   if(p.preview?.label!==label)refuse('REFUSED','unknown');
   if(operation==='publish_research_portfolio_share_link'&&(p.preview.client?.id!==bound.clientId||['snapshotId','designId','branding','previewHash','expectedDesignVersion'].some(key=>p.preview.fields?.[key]!==bound[key])))refuse('REFUSED','unknown');
   if(operation==='revoke_research_portfolio_share_link'&&p.preview.fields?.linkId!==bound.linkId)refuse('REFUSED','unknown');
   return {proposalId:p.proposalId,request:bound,preview:{label,...(portfolioId?{portfolioId}:{}),...(typeof p.preview.client?.name==='string'?{clientName:p.preview.client.name}:{})},createdAt:p.createdAt,expiresAt:p.expiresAt};
  },
  async read({proposal,signal,deadlineMs}){
   validators.assertProposal(proposal);
   const rows=await call({proposal,signal,deadlineMs},'GET',prefix+'?'+new URLSearchParams({conversationId:proposal.binding.conversationId,proposalId:proposal.proposalId}));
   if(!Array.isArray(rows)||rows.length!==1||Object.hasOwn(rows[0],'oneTimeResult'))refuse();return {proposalStatus:status(rows[0],proposal)};
  },
  async decide({proposal,decision,signal,deadlineMs}){
   validators.assertProposal(proposal);if(!['approved','rejected'].includes(decision))refuse('INVALID_ARGUMENTS');
   const result=await call({proposal,signal,deadlineMs},'POST',prefix+'/'+proposal.proposalId+'/'+(decision==='approved'?'approve':'dismiss'),{},true);
   const proposalStatus=status(result,proposal),oneTimeResult=result.oneTimeResult;
   if(oneTimeResult!==undefined){
    validateShape('ResearchShareOneTimeResult',oneTimeResult);
    if(decision!=='approved'||proposalStatus!=='succeeded'||proposal.operation!=='publish_research_portfolio_share_link')refuse('REFUSED','unknown');
   }
   return {proposalStatus,...(oneTimeResult===undefined?{}:{oneTimeResult})};
  },
 });
}
