/** Current attended session for an immutable native proposal; Core still decides access. */
import {assertNativeApprovalProposal} from '../../../packages/contracts/commands-0.2/validate.mjs';
import {assertNativeConversationScope} from '../../../packages/contracts/runtime-0.2/session.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {borrowedRunSession,assertActionSessionReceipt} from '../../control/action-host/session/owner.mjs';
const same=(a,b)=>hash(a)===hash(b),fail=code=>{throw Object.assign(Error(code),{code});};
export function nativeApprovalScope(proposal){
 const {binding,scopes}=proposal.command,clients=scopes.filter(scope=>scope.kind==='client');
 if(clients.length>1)fail('ACCESS_DENIED');const selectedClientId=clients[0]?.resourceId??null;
 try{assertNativeConversationScope({binding,scopes,selectedClientId});}catch{fail('ACCESS_DENIED');}
 return {selectedClientId,policyRevision:scopes[0].policyRevision};
}
export async function currentNativeApprovalSession({store,sessions,retention,now,proposal,signal,check=()=>{}}){
 assertNativeApprovalProposal(proposal);
 const source=proposal.command.binding,scopes=proposal.command.scopes,{selectedClientId}=nativeApprovalScope(proposal);
 if(!store?.history||!sessions)fail('UNAVAILABLE');
 const serve=async()=>{if(retention)await retention.assertServable({tenantId:source.tenantId,kind:'conversation',subjectId:source.conversationId});check();};
 await serve();
 const history=await store.history.transcript({principal:{tenantId:source.tenantId,actorId:source.actorId,clientIds:selectedClientId===null?[]:[selectedClientId]},conversationId:source.conversationId,after:0,limit:1},check);check();
 const run=history.latestRun,binding=run.binding;
 if(['tenantId','actorId','conversationId'].some(key=>binding[key]!==source[key])||binding.writerFence<source.writerFence||!same(run.scopes,scopes)||run.state==='cancelled'||history.pendingTurn!==null)fail('ACCESS_DENIED');
 const borrow=borrowedRunSession(sessions);if(!borrow)fail('UNAVAILABLE');
 const session=assertActionSessionReceipt(await borrow({binding,selectedClientId,signal}),now());check();
 if(['tenantId','actorId','conversationId','runId'].some(key=>session.context[key]!==binding[key])||session.context.selectedClientId!==selectedClientId)fail('ACCESS_DENIED');
 await serve();return {run,binding,selectedClientId,session};
}
