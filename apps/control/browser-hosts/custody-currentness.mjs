/** Join retained browser custody to fresh Core authority using the caller's
 * allocation transaction. No SDK authority, second journal or cached access. */
import {own,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertNativeConversationScope} from '../../../packages/contracts/runtime-0.2/session.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {currentReceipt} from '../action-host/application-adapters/current-receipt.mjs';
import {rowRun} from '../conversations/boundary.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {assertHostAllocation,assertHostRunBinding} from '../../worker/conversation/host/binding.mjs';
import {same,fail} from './allocation.mjs';

export function createBrowserCustodyCurrentness({journal,core,nativeCredentials,now=Date.now,maxRequestMs=3000}){
 const currentHost=storageMethod(journal,'currentHost'),readCurrent=storageMethod(core,'readCurrent');
 const nativeCredentialFor=storageMethod(nativeCredentials,'nativeCredentialFor');
 if(typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>3000)fail();
 async function current(client,{allocation,binding,signal},selected){
  nativeSignal(signal);const a=assertHostAllocation(allocation),physical=assertHostRunBinding(a,binding);
  const life=createOperationLifetime({now,signal,deadlineMs:Math.min(now()+maxRequestMs,a.leaseDeadlineMs),errorFactory:()=>Object.assign(Error('BROWSER_HOST_CURRENTNESS_REFUSED'),{code:'BROWSER_HOST_CURRENTNESS_REFUSED'})});
  try{
   // Same lock order as lifecycle: allocation (caller), conversation, original run.
   await life.run(()=>client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`${physical.tenantId}:${physical.conversationId}`]));
   const rows=await life.run(()=>client.query('SELECT * FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 FOR UPDATE',[physical.tenantId,physical.conversationId,physical.runId]));
   if(rows.rows.length!==1)fail();const run=rowRun(rows.rows[0]).projection;
   if(!same(run.binding,physical)||run.scopes.length!==1)fail();
   const scope=run.scopes[0],selectedClientId=scope.kind==='client'?scope.resourceId:null;
   assertNativeConversationScope({binding:physical,scopes:run.scopes,selectedClientId});
   const args={binding:physical,scopes:run.scopes,selectedClientId,allocation:a};
   const state=await life.run(()=>currentHost(client,args,life.check));
   const logical=state.browserSuccessor?.binding??state.binding;
   if(selected){
    if(!same(selected.binding,logical))fail();
    if(selected.custody){
     // The latest held control must carry this exact custody, including epoch.
     const held=await life.run(()=>currentHost(client,{...args,binding:logical},life.check));
     if(!same(held.browserCustody,selected.custody))fail();
    }
   }
   // Borrow only the current logical run's existing credential. A retired
   // source's credential cannot authorize a successor. Core performs policy.
   const before=await life.run(signal=>nativeCredentialFor({binding:logical,selectedClientId,signal}));
   if(typeof before?.credential!=='string'||!before.credential||!Number.isSafeInteger(before.expiresAtMs)||before.expiresAtMs<=now())fail();
   life.limitDeadline(before.expiresAtMs);const started=now();
   const authority=currentReceipt(await life.run(signal=>readCurrent({credential:before.credential,conversationId:logical.conversationId,clientId:selectedClientId,signal,deadlineMs:life.deadline()})));
   if(authority.principal.tenantId!==logical.tenantId||authority.principal.actorId!==logical.actorId||
    authority.conversationId!==logical.conversationId||authority.selectedClientId!==selectedClientId||
    authority.checkedAtMs<started||authority.checkedAtMs>now())fail();
   life.limitDeadline(authority.expiresAtMs);
   const after=await life.run(signal=>nativeCredentialFor({binding:logical,selectedClientId,signal}));
   if(after?.credential!==before.credential||!Number.isSafeInteger(after.expiresAtMs)||after.expiresAtMs<=now())fail();
   life.check();const currentUntilMs=Math.min(state.currentUntilMs,authority.expiresAtMs,before.expiresAtMs,after.expiresAtMs);
   if(!Number.isSafeInteger(currentUntilMs)||currentUntilMs<=now())fail();
   return Object.freeze({...state,...(selected?{binding:logical}:{}),currentUntilMs});
  }finally{life.close();}
 }
 return Object.freeze({
  /** Private host currentness preserves the immutable physical source binding. */
  readHost(client,input){const v=own(input,['allocation','binding'],['signal']);return current(client,v);},
  /** Viewer routes admit only the latest full logical binding. */
  readRoute(client,input){const v=own(input,['allocation','originalBinding','binding'],['custody','signal']);
   const binding=assertHostRunBinding(v.allocation,v.binding);
   return current(client,{allocation:v.allocation,binding:v.originalBinding,signal:v.signal},{binding,custody:v.custody});
  },
 });
}
