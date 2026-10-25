/** Attended history/control of an already admitted occurrence. Core still owns live identity and membership;
 * immutable schedule custody owns this conversation, and the existing journal selects its current admitted run.
 * This returns the local session context, never a Core current receipt or an unattended execution grant. */
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {assertAuthorityIdentityReceipt} from '../../../packages/contracts/action-authority-0.2/validate.mjs';
import {assertNativeConversationScope} from '../../../packages/contracts/runtime-0.2/session.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {createCoreMembershipGate} from '../../control/product-access/core-membership.mjs';
import {createScheduledConversationCurrentness,snapshotScheduledConversationOrigin} from '../../control/schedules/scheduled-conversation-currentness.mjs';
import {AsyncLocalStorage} from 'node:async_hooks';
const same=(a,b)=>hash(a)===hash(b),uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(v);
const refuse=()=>{throw Object.assign(Error('SCHEDULED_CONVERSATION_IDENTITY_REFUSED'),{code:'SCHEDULED_CONVERSATION_IDENTITY_REFUSED'});};
export function createScheduledConversationIdentity({native,scheduleOwner,identity,selectExisting,now,limits,factWindowMs}){
 if(typeof scheduleOwner?.readOccurrenceForConversation!=='function'||typeof selectExisting!=='function')refuse();
 const gate=createCoreMembershipGate({origin:identity.origin,fetchImpl:identity.fetchImpl,identityContext:native,now,limits:{...limits,maxFactBytes:262144}});
 const currentness=createScheduledConversationCurrentness({scheduleOwner,gate,core:{assertCurrent:refuse},now,maxRequestMs:limits.maxRequestMs});
 const observations=new AsyncLocalStorage();
 async function observe({credential,hints,verified,signal,deadlineMs},body){
  nativeSignal(signal);const selected=data(own(hints,['conversationId','clientId'],['runId']));
  if(!uuid(selected.conversationId)||selected.clientId!==null&&!uuid(selected.clientId)||selected.runId!==undefined&&!uuid(selected.runId)||!Number.isSafeInteger(deadlineMs))refuse();
  const life=createOperationLifetime({now,signal,deadlineMs:Math.min(deadlineMs,now()+limits.maxRequestMs),errorFactory:()=>Object.assign(Error('SCHEDULED_CONVERSATION_IDENTITY_REFUSED'),{code:'SCHEDULED_CONVERSATION_IDENTITY_REFUSED'})});
  try{
   const receipt=assertAuthorityIdentityReceipt(verified??await life.run(signal=>native.verifyIdentity({credential,signal,deadlineMs:life.deadline()})));
   life.limitDeadline(receipt.expiresAtMs);
   const lookup=()=>life.run(()=>scheduleOwner.readOccurrenceForConversation({tenantId:receipt.principal.tenantId,conversationId:selected.conversationId},life.check));
   const first=await lookup();
   if(first===null){const result=await body(null,life);if(await lookup()!==null)refuse();life.check();return result;}
   const admitted=await life.run(signal=>gate.admit({credential,signal,deadlineMs:life.deadline()}));
   if(admitted.principal.tenantId!==receipt.principal.tenantId||admitted.principal.actorId!==receipt.principal.actorId)refuse();
   life.limitDeadline(admitted.expiresAtMs);
   const scopes=data(first.occurrence.projection.scopes),call={credential,principal:admitted.principal,conversationId:selected.conversationId,scopes,deadlineMs:life.deadline()};
   const origin=snapshotScheduledConversationOrigin(first,call);
   assertNativeConversationScope({binding:origin.effect.binding,scopes,selectedClientId:selected.clientId});
   await life.run(signal=>currentness.assertCurrent({...call,signal}));
   const result=await body({origin,scopes,identity:receipt,principal:receipt.principal,membership:admitted.principal,expiresAtMs:Math.min(receipt.expiresAtMs,admitted.expiresAtMs),selected},life);
   await life.run(signal=>currentness.assertCurrent({...call,signal}));
   if(!same(first,await lookup()))refuse();life.check();return result;
  }finally{life.close();}
 }
 async function resolveSelected(call,selected,life){
    if(selected===null)return native.resolveContext({...call,signal:life.signal,deadlineMs:life.deadline()});
    const {origin,scopes,identity:receipt,principal,selected:hints}=selected;
    const current=await life.run(signal=>selectExisting({principal,conversationId:hints.conversationId,selectedClientId:hints.clientId,runId:hints.runId,origin,signal}));
    if(!same(current.scopes,scopes)||current.binding.tenantId!==principal.tenantId||current.binding.actorId!==principal.actorId||current.binding.conversationId!==hints.conversationId||hints.runId!==undefined&&current.binding.runId!==hints.runId)refuse();
    assertNativeConversationScope({binding:current.binding,scopes,selectedClientId:hints.clientId});
    return data({identitySha256:call.identitySha256,binding:current.binding,scopes,selectedClientId:hints.clientId,
     contextRevision:hash({identityRevision:receipt.identityRevision,occurrenceKey:origin.occurrenceKey,effectSha256:origin.effectSha256,binding:current.binding,scopes}),
     checkedAtMs:now(),expiresAtMs:Math.min(selected.expiresAtMs,now()+factWindowMs)});
 }
 return Object.freeze({...native,
  // Share only this request's fresh observation, as the ordinary identity owner does. No cross-request receipt cache;
  // observe() still rechecks canonical membership and origin after the operation before releasing its result.
  async withAuthority(call,operation){return observe({credential:call.credential,hints:call.hints,signal:call.signal,deadlineMs:call.deadlineMs},async(selected,life)=>selected===null?
   native.withAuthority({...call,signal:life.signal,deadlineMs:life.deadline()},operation):observations.run({selected,life,credential:call.credential},()=>life.run(()=>operation())));},
  async verifyIdentity(call){const scope=observations.getStore();if(!scope)return native.verifyIdentity(call);scope.life.check();if(scope.credential!==call.credential)refuse();return data({...scope.selected.identity,checkedAtMs:now()});},
  async readMembership(){const scope=observations.getStore();if(!scope)return native.readMembership();scope.life.check();return data({...scope.selected.membership,status:'active',checkedAtMs:now(),expiresAtMs:scope.selected.expiresAtMs});},
  async resolveContext(raw){
   const call=own(raw,['identityCredential','identity','identitySha256','hints','deadlineMs'],['signal']);
   if(call.identitySha256!==hash(call.identity))refuse();
   const scope=observations.getStore();
   if(scope){scope.life.check();if(scope.credential!==call.identityCredential||!same(scope.selected.selected,call.hints)||!same(scope.selected.identity.principal,call.identity.principal)||scope.selected.identity.identityRevision!==call.identity.identityRevision)refuse();return resolveSelected(call,scope.selected,scope.life);}
   return observe({credential:call.identityCredential,hints:call.hints,verified:call.identity,signal:call.signal,deadlineMs:call.deadlineMs},(selected,life)=>resolveSelected(call,selected,life));
  },
 });
}
