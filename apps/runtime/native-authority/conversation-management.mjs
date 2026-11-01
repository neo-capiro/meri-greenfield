/** Fixed Core metadata transport. The real user bearer and existing backend
 * service secret stay in this request closure; neither is supplied by a model. */
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertConversationDeletionReadback,assertConversationMetadata,assertConversationHistoryRequest,assertConversationHistoryResponse} from '../../../packages/contracts/conversation-history/validate.mjs';
import {MANAGEMENT_VERSION} from '../../../packages/contracts/conversation-history/protocol.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {jsonBody} from '../../control/action-application/http.mjs';
import {ProductError} from '../../control/product-access/errors.mjs';
import {createCapiroApplicationAuthorityClient} from '../../control/action-host/application-adapters/authority-http.mjs';
import {researchContextFields,researchContextFromCurrent,sameResearchContext} from '../../control/action-host/application-adapters/research-context.mjs';
const refuse=(code='CONVERSATION_UNAVAILABLE',outcome)=>{throw new ProductError(code,outcome);};
const receiptSkewMs=5000;
export function createCoreConversationManagement({origin,getServiceSecret,policyRevision,nativeCredentials,fetchImpl=fetch,now=Date.now,maxRequestMs}){
 const url=new URL(origin);if(url.protocol!=='https:'||url.pathname!=='/'||url.search||url.hash||url.username||url.password||typeof getServiceSecret!=='function'||typeof policyRevision!=='string'||!policyRevision)refuse();
 const current=createCapiroApplicationAuthorityClient({origin,fetchImpl,now,enabled:true,limits:{maxRequestMs,maxResponseBytes:131072}});
 function forRequest({credential,principal,signal,deadlineMs}){
  if(typeof credential!=='string'||!/^\S{1,8192}$/u.test(credential))refuse('UNAUTHENTICATED');
  async function call(operation,request){const life=createOperationLifetime({now,signal,deadlineMs:Math.min(deadlineMs,now()+maxRequestMs),errorFactory:()=>new ProductError('CONVERSATION_UNAVAILABLE')});let response;
   try{const secret=await life.run(()=>getServiceSecret());if(typeof secret!=='string'||!/^\S{1,8192}$/u.test(secret))refuse();
    response=await life.run(signal=>fetchImpl(new URL('/api/clio/conversations/management/'+operation,origin),{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',signal,headers:{authorization:`Bearer ${credential}`,'x-internal-service-secret':secret,'content-type':'application/json',accept:'application/json'},body:JSON.stringify(request)}));
    if(response.status!==200){const codes={401:'UNAUTHENTICATED',403:'ACCESS_DENIED',404:'CONVERSATION_NOT_FOUND',409:'CONVERSATION_MANAGEMENT_CONFLICT',410:'CONVERSATION_RESTORE_EXPIRED'};refuse(codes[response.status]??'CONVERSATION_UNAVAILABLE',operation==='apply'&&[400,401,403,404,409,410].includes(response.status)?'NOT_DISPATCHED':undefined);}
    if(response.redirected||!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(response.headers.get('content-type')??''))refuse();
    const length=response.headers.get('content-length');if(length!==null&&!/^(0|[1-9][0-9]*)$/u.test(length))refuse();
    const result=await jsonBody({body:response.body,length:length===null?null:Number(length)},131072,life,life.check);life.check();return result;
   }finally{try{await response?.body?.cancel();}catch{}life.close();}
  }
  const scope=metadata=>{const m=assertConversationMetadata(metadata);if(m.clientId!==null&&!principal.clientIds.includes(m.clientId))refuse('CONVERSATION_NOT_FOUND');return m;};
  const metadata=async conversationId=>{const m=scope(await call('metadata',{version:MANAGEMENT_VERSION,conversationId}));if(m.conversationId!==conversationId)refuse();return m;};
  async function readback(operation,request){const q=assertConversationHistoryRequest('manage',request),result={...data(own(await call(operation,q),['version','requestId','current','receipt','releaseRetention','suppressionRequestId']))};
   if(result.version!==MANAGEMENT_VERSION||result.requestId!==q.requestId||typeof result.releaseRetention!=='boolean')refuse();result.current=scope(result.current);if(result.current.conversationId!==q.conversationId)refuse();
   if(result.receipt!==null)result.receipt=assertConversationHistoryResponse('manage',result.receipt,q);
   if(result.releaseRetention?(q.operation!=='restore'||result.receipt===null||result.current.status!=='active'||result.current.revision!==result.receipt.conversation.revision||typeof result.suppressionRequestId!=='string'||!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/u.test(result.suppressionRequestId)):result.suppressionRequestId!==null)refuse();return result;
  }
  async function active(metadata){if(metadata.status!=='active')refuse('CONVERSATION_MANAGEMENT_CONFLICT');const research=metadata.scopeKind==='research_portfolio',at=now(),receipt=await current[research?'readResearchCurrent':'readCurrent']({credential,conversationId:metadata.conversationId,clientId:metadata.clientId,signal,deadlineMs});
   if(research&&!sameResearchContext(researchContextFields(metadata),researchContextFromCurrent(receipt)))refuse();
   if(receipt.principal.tenantId!==principal.tenantId||receipt.principal.actorId!==principal.actorId||receipt.conversationId!==metadata.conversationId||receipt.selectedClientId!==metadata.clientId||receipt.checkedAtMs<at-receiptSkewMs||receipt.checkedAtMs>now()+receiptSkewMs||receipt.expiresAtMs<=now())refuse();
  }
  return Object.freeze({metadata,
   async deletions(request){const q=assertConversationHistoryRequest('deletions',request);return assertConversationHistoryResponse('deletions',await call('deletions/list',q),q);},
   async deletion(request){const q=assertConversationHistoryRequest('deletionStatus',request),started=now(),result=assertConversationDeletionReadback(await call('deletions/read',q),q);
    if(result.checkedAtMs<started-receiptSkewMs||result.checkedAtMs>now()+receiptSkewMs)refuse();return result;},
   read:q=>readback('read',q),apply:q=>readback('apply',q),async summaries(request){const q=assertConversationHistoryRequest('summaries',request),r=data(own(await call('summaries',q),['version','conversations','nextBefore']));
    if(!Array.isArray(r.conversations))refuse();const publicValue={...r,conversations:r.conversations.map(m=>({...scope(m),hasTranscript:false,canManage:false}))};assertConversationHistoryResponse('summaries',publicValue,q);return r;
   },async registration(m){m=scope(m);await active(m);return {conversation:{conversationId:m.conversationId,owner:{tenantId:principal.tenantId,actorId:principal.actorId},scopes:[{kind:m.clientId===null?'private-user':'client',tenantId:principal.tenantId,resourceId:m.clientId===null?principal.actorId:m.clientId,policyRevision}],policyRevision,createdAt:new Date(now()).toISOString()},recheckActive:()=>active(m)};}});
 }
 async function assertActiveBinding({binding,scopes,selectedClientId},check=()=>{}){
  check();const clients=scopes.filter(s=>s.kind==='client'),selected=selectedClientId===undefined?(clients.length===1?clients[0].resourceId:null):selectedClientId;
  const borrowed=nativeCredentials.nativeCredentialFor({binding,selectedClientId:selected,includeSubject:true}),started=now();
  const subject=researchContextFields(borrowed),research=subject.scopeKind==='research_portfolio';if(research&&selected!==null)refuse();
  const receipt=await current[research?'readResearchCurrent':'readCurrent']({credential:borrowed.credential,conversationId:binding.conversationId,clientId:selected,deadlineMs:started+maxRequestMs});check();
  if(research&&!sameResearchContext(subject,researchContextFromCurrent(receipt)))refuse();
  const after=nativeCredentials.nativeCredentialFor({binding,selectedClientId:selected,includeSubject:true});
  if(after.credential!==borrowed.credential||!sameResearchContext(borrowed,after)||after.expiresAtMs<=now()||receipt.principal.tenantId!==binding.tenantId||receipt.principal.actorId!==binding.actorId||receipt.conversationId!==binding.conversationId||receipt.selectedClientId!==selected||receipt.checkedAtMs<started-receiptSkewMs||receipt.checkedAtMs>now()+receiptSkewMs||receipt.expiresAtMs<=now())refuse();
 }
 return Object.freeze({forRequest,assertActiveBinding});
}
