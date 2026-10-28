/** Current attended session for an immutable native proposal; Core still decides access. */
import {assertNativeApprovalProposal} from '../../../packages/contracts/commands-0.2/validate.mjs';
import {assertNativeConversationScope} from '../../../packages/contracts/runtime-0.2/session.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {borrowedRunSession,assertActionSessionReceipt} from '../../control/action-host/session/owner.mjs';
import {productFailure} from '../../control/product-access/errors.mjs';
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
 return currentAttendedSession({store,sessions,retention,now,binding:source,scopes,selectedClientId,signal,check,allowInitialTask:['task.create','task.update','mail.send','memory.propose'].includes(proposal.command.action)});
}
/** Same live conversation/session owner for Core-governed sharing; no synthetic native command. */
export async function currentAttendedSession({store,sessions,retention,now,binding:source,scopes,selectedClientId,signal,check=()=>{},allowInitialTask=false}){
 assertNativeConversationScope({binding:source,scopes,selectedClientId});
 if(!store?.history||!sessions)fail('UNAVAILABLE');
 const serve=async()=>{if(retention)await retention.assertServable({tenantId:source.tenantId,kind:'conversation',subjectId:source.conversationId});check();};
 await serve();
 const principal={tenantId:source.tenantId,actorId:source.actorId};let history,run=null,binding;
 try{history=await store.history.transcript({principal:{...principal,clientIds:selectedClientId===null?[]:[selectedClientId]},conversationId:source.conversationId,after:0,limit:1},check);check();}
 catch(error){
  if(!allowInitialTask||!['NOT_FOUND','CONVERSATION_NOT_FOUND'].includes(productFailure(error)?.code))throw error;
  if(!store.initialBindings)fail('UNAVAILABLE');
  const record=await store.initialBindings.readConversation({principal,conversationId:source.conversationId,selectedClientId},check);check();
  if(!record)fail('ACCESS_DENIED');
  const prepared=await store.initialBindings.readPreparation({binding:record.binding},check);check();
  const initialScopes=[{tenantId:source.tenantId,kind:selectedClientId===null?'private-user':'client',resourceId:selectedClientId===null?source.actorId:selectedClientId,policyRevision:record.policyRevision}];
  if(!prepared||!same(prepared.record,record)||prepared.recordSha256!==hash(record)||!same(initialScopes,scopes)||record.expiresAtMs<=now())fail('ACCESS_DENIED');
  binding=record.binding;assertNativeConversationScope({binding,scopes,selectedClientId});
 }
 if(history){run=history.latestRun;binding=run.binding;if(!same(run.scopes,scopes)||run.state==='cancelled'||history.pendingTurn!==null)fail('ACCESS_DENIED');}
 if(!binding||['tenantId','actorId','conversationId'].some(key=>binding[key]!==source[key])||binding.writerFence<source.writerFence)fail('ACCESS_DENIED');
 const borrow=borrowedRunSession(sessions);if(!borrow)fail('UNAVAILABLE');
 const session=assertActionSessionReceipt(await borrow({binding,selectedClientId,signal}),now());check();
 if(['tenantId','actorId','conversationId','runId'].some(key=>session.context[key]!==binding[key])||session.context.selectedClientId!==selectedClientId)fail('ACCESS_DENIED');
 await serve();
 const last=assertActionSessionReceipt(await borrow({binding,selectedClientId,signal}),now());check();
 if(last.credential!==session.credential)fail('ACCESS_DENIED');
 return {run,binding,selectedClientId,session:last};
}
