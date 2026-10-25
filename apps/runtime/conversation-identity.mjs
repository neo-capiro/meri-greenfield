/** Core identity and durable conversation selection, independent of compute hosting. */
import {canonicalSha256 as hash} from '../../packages/contracts/validate.mjs';
import {createNativeIdentityContext} from './native-authority/identity-context.mjs';
import {createScheduledConversationIdentity} from './native-authority/scheduled-conversation-identity.mjs';
const same=(a,b)=>hash(a)===hash(b);
const scopesFor=(binding,selectedClientId,policyRevision)=>[{kind:selectedClientId===null?'private-user':'client',tenantId:binding.tenantId,resourceId:selectedClientId===null?binding.actorId:selectedClientId,policyRevision}];
const refuse=()=>{throw Error('CONVERSATION_IDENTITY_REFUSED');};
/** Every original comes from the durable conversation journal after fresh Core admission. */
export function createConversationIdentity({store,identity,qualification,now=Date.now,limits,nextRunOwner,initialBindings,configurationSha256,versions,proposeInitialExpiry,factWindowMs,scheduleOwner}){
 if(!Number.isSafeInteger(factWindowMs)||factWindowMs<1||!nextRunOwner||typeof initialBindings?.claim!=='function'||typeof initialBindings.rebind!=='function'||typeof initialBindings.readConversation!=='function'||typeof proposeInitialExpiry!=='function'||typeof configurationSha256!=='string'||!/^[a-f0-9]{64}$/u.test(configurationSha256)||!versions)refuse();
 const check=signal=>()=>{if(signal?.aborted)refuse();};
 const refuseWith=code=>{throw Object.assign(Error(code),{code});};
 const valid=(record,principal,conversationId,selectedClientId)=>{
  if(!record||record.schemaVersion!==1||record.state!=='ADMITTED'||record.binding.tenantId!==principal.tenantId||record.binding.actorId!==principal.actorId||record.binding.conversationId!==conversationId||record.binding.writerFence!==1||!Number.isSafeInteger(record.expiresAtMs))refuseWith('INITIAL_BINDING_INVALID');
  if(record.selectedClientId!==selectedClientId)refuseWith('INITIAL_BINDING_CLIENT_MISMATCH');
  if(record.policyRevision!==qualification.policyRevision)refuseWith('INITIAL_BINDING_POLICY_CHANGED');return record;
 };
 const pinned=record=>{if(record.configurationSha256!==configurationSha256)refuseWith('INITIAL_BINDING_CONFIGURATION_CHANGED');if(!same(record.versions,versions))refuseWith('INITIAL_BINDING_VERSIONS_CHANGED');return record;};
 const fact=selected=>JSON.stringify({binding:selected.binding,policyRevision:selected.policyRevision,checkedAtMs:now(),deadlineMs:Math.min(selected.expiresAtMs??Infinity,now()+factWindowMs)});
 const dead=record=>record.expiresAtMs<=now()||record.configurationSha256!==configurationSha256||!same(record.versions,versions);
 const savedOriginal=(saved,record)=>{if(!same(saved.run.binding,record.binding)||saved.run.policyRevision!==record.policyRevision||!same(saved.run.versions,record.versions)||!same(saved.run.scopes,scopesFor(record.binding,record.selectedClientId,record.policyRevision)))refuse();};
 async function original(principal,conversationId,selectedClientId,signal,runId){
  const query={principal,conversationId,selectedClientId};let record=await initialBindings.readConversation(query,check(signal));check(signal)();
  if(record)valid(record,principal,conversationId,selectedClientId);else if(runId!==undefined)refuseWith('INITIAL_BINDING_SUPERSEDED');
  const rebind=record&&dead(record)&&runId===undefined&&!await store.readOptional(record.binding,{},check(signal));check(signal)();
  if(!record||rebind){const claimed=await initialBindings[rebind?'rebind':'claim']({...query,policyRevision:qualification.policyRevision,versions,configurationSha256,proposedExpiresAtMs:proposeInitialExpiry({signal})},check(signal));record=claimed.record;check(signal)();}
  return valid(record,principal,conversationId,selectedClientId);
 }
 async function select(record,principal,conversationId,signal,exact={},assertActive){
  const saved=await store.readOptional(record.binding,{},check(signal));check(signal)();
  if(!saved){if(exact.runId!==undefined&&exact.runId!==record.binding.runId)refuseWith('INITIAL_BINDING_SUPERSEDED');pinned(record);if(record.expiresAtMs<=now())refuseWith('INITIAL_BINDING_EXPIRED');return {binding:record.binding,policyRevision:record.policyRevision,expiresAtMs:record.expiresAtMs};}
  savedOriginal(saved,record);
  const chosen=await nextRunOwner.selectRun({principal,conversationId,signal,...exact,assertActive}),current=await nextRunOwner.currentRun(chosen.binding,{signal});check(signal)();
  if(!same(current.binding,chosen.binding)||current.binding.tenantId!==principal.tenantId||current.binding.actorId!==principal.actorId||current.binding.conversationId!==conversationId||current.policyRevision!==record.policyRevision||!same(current.scopes,saved.run.scopes))refuse();return current;
 }
 const currentOwner={async currentRun(request,{signal,selectedClientId}){
  const principal={tenantId:request.tenantId,actorId:request.actorId};
  const record=valid(await initialBindings.readConversation({principal,conversationId:request.conversationId,selectedClientId},check(signal)),principal,request.conversationId,selectedClientId);check(signal)();
  const saved=await store.readOptional(record.binding,{},check(signal));check(signal)();
  if(!saved){if(!same(request,record.binding))refuseWith('INITIAL_BINDING_SUPERSEDED');pinned(record);if(record.expiresAtMs<=now())refuseWith('INITIAL_BINDING_EXPIRED');return fact(record);}
  savedOriginal(saved,record);const selected=await nextRunOwner.currentRun(request,{signal});check(signal)();
  if(!same(selected.binding,request)||selected.policyRevision!==record.policyRevision||!same(selected.scopes,saved.run.scopes))refuse();return fact(selected);
 }};
 const native=createNativeIdentityContext({...identity,currentOwner,admitInitialConversation:async({principal,conversationId,selectedClientId,signal,runId,recheckActive})=>fact(await select(await original(principal,conversationId,selectedClientId,signal,runId),principal,conversationId,signal,runId===undefined?{}:{runId},recheckActive)),now,limits,enabled:true});
 if(scheduleOwner===undefined)return native;
 return createScheduledConversationIdentity({native,scheduleOwner,identity,now,limits,factWindowMs,
  async selectExisting({principal,conversationId,selectedClientId,signal,runId,origin}){
   const record=valid(await initialBindings.readConversation({principal,conversationId,selectedClientId},check(signal)),principal,conversationId,selectedClientId);check(signal)();
   if(!same(record.binding,origin.effect.binding))refuse();
   const saved=await store.readOptional(record.binding,{},check(signal));check(signal)();if(!saved)refuse();savedOriginal(saved,record);
   const chosen=await nextRunOwner.selectExistingRun({principal,conversationId,signal,...(runId===undefined?{}:{runId})});
   if(chosen.reserved)refuse();
   const current=await nextRunOwner.currentRun(chosen.binding,{signal});check(signal)();
   if(current.reserved||!same(current.binding,chosen.binding)||!same(current.scopes,saved.run.scopes)||current.policyRevision!==record.policyRevision)refuse();
   // Reuse the canonical current owner, including the exact original journal/scopes join. No claim or successor reservation.
   await currentOwner.currentRun(current.binding,{signal,selectedClientId});return current;
  }});
}
