/** Joins native authority facts to the separately owned, prebound Meri run. */
import {assertAuthorityIdentityReceipt,assertAuthorityContextReceipt} from '../../../../packages/contracts/action-authority-0.2/validate.mjs';
import {canonicalSha256,validateShape} from '../../../../packages/contracts/validate.mjs';
import {own,data,nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
const refuse=()=>{throw Error('APPLICATION_CONTEXT_REFUSED');};
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b),uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
export function createApplicationContextAdapters(configuration){
 const {client,currentRun,commandContext,now,limits}=own(configuration,['client','currentRun','commandContext','now','limits']);
 const ports=own(client,['readIdentity','readContext']),context=data(commandContext),l=data(own(limits,['maxRequestMs','maxFactBytes']));own(context,['binding','clientResolution']);own(context.clientResolution,['reference','clientId']);validateShape('RunBinding',context.binding);
 if(Object.values(ports).some(p=>typeof p!=='function')||typeof currentRun!=='function'||typeof now!=='function'||!Number.isSafeInteger(l.maxRequestMs)||l.maxRequestMs<1||l.maxRequestMs>30000||!Number.isSafeInteger(l.maxFactBytes)||l.maxFactBytes<1||l.maxFactBytes>131072||typeof context.clientResolution.clientId!=='string'||!uuid.test(context.clientResolution.clientId)||context.clientResolution.reference!==context.clientResolution.clientId)refuse();
 const principal=data({tenantId:context.binding.tenantId,actorId:context.binding.actorId});
 function start(call){nativeSignal(call.signal);const at=now();if(!Number.isSafeInteger(at)||at<0||!Number.isSafeInteger(call.deadlineMs))refuse();return createOperationLifetime({deadlineMs:Math.min(call.deadlineMs,at+l.maxRequestMs),now,signal:call.signal,errorFactory:()=>Error('APPLICATION_CONTEXT_REFUSED')});}
 function snapshot(value){if(typeof value==='string'){if(Buffer.byteLength(value)>l.maxFactBytes)refuse();value=JSON.parse(value);}const out=data(value);if(Buffer.byteLength(JSON.stringify(out))>l.maxFactBytes)refuse();return out;}
 function fact(value,validator,started,life){const v=validator(snapshot(value));const at=now();life.check();if(!Number.isSafeInteger(at)||at<0||!Number.isSafeInteger(v.checkedAtMs)||v.checkedAtMs<started||v.checkedAtMs>at||!Number.isSafeInteger(v.expiresAtMs)||v.expiresAtMs<=at)refuse();life.limitDeadline(v.expiresAtMs);return v;}
 function identity(v){own(v.principal,['tenantId','actorId']);if(!same(v.principal,principal)||typeof v.identityRevision!=='string'||!v.identityRevision||v.identityRevision.length>256)refuse();}
 async function verifyIdentity(value){const call=own(value,['credential','deadlineMs'],['signal']),life=start(call);try{const started=now();const result=fact(await life.run(signal=>ports.readIdentity({...call,signal})),assertAuthorityIdentityReceipt,started,life);identity(result);life.check();return result;}catch{refuse();}finally{life.close();}}
 async function resolveContext(value){
  const call=own(value,['identityCredential','identity','identitySha256','hints','deadlineMs'],['signal']),original=assertAuthorityIdentityReceipt(snapshot(call.identity)),hints=snapshot(call.hints);identity(original);own(hints,[],['conversationId','runId','clientId']);
  if(call.identitySha256!==canonicalSha256(original)||Object.keys(hints).some(k=>hints[k]!==({conversationId:context.binding.conversationId,runId:context.binding.runId,clientId:context.clientResolution.clientId})[k]))refuse();
  const life=start(call);let cutoff=Math.min(call.deadlineMs,original.expiresAtMs,now()+l.maxRequestMs);
  async function run(){const started=now();const raw=await life.run(signal=>currentRun(data(context.binding),{signal,deadlineMs:cutoff}));if(typeof raw!=='string')refuse();const r=snapshot(raw);own(r,['binding','policyRevision','deadlineMs','checkedAtMs']);validateShape('RunBinding',r.binding);const at=now();life.check();if(!same(r.binding,context.binding)||typeof r.policyRevision!=='string'||!r.policyRevision||r.policyRevision.length>256||!Number.isSafeInteger(r.checkedAtMs)||r.checkedAtMs<started||r.checkedAtMs>at||!Number.isSafeInteger(r.deadlineMs)||r.deadlineMs<=at)refuse();cutoff=Math.min(cutoff,r.deadlineMs);life.limitDeadline(cutoff);return r;}
  try{
   life.limitDeadline(original.expiresAtMs);const before=await run(),started=now();const native=fact(await life.run(signal=>ports.readContext({credential:call.identityCredential,identitySha256:call.identitySha256,conversationId:context.binding.conversationId,clientId:context.clientResolution.clientId,signal,deadlineMs:cutoff})),assertAuthorityContextReceipt,started,life);identity(native);
   if(native.identitySha256!==call.identitySha256||native.identityRevision!==original.identityRevision||native.conversationId!==context.binding.conversationId||native.selectedClientId!==context.clientResolution.clientId||typeof native.contextRevision!=='string'||!native.contextRevision||native.contextRevision.length>256)refuse();cutoff=Math.min(cutoff,native.expiresAtMs);const after=await run();if(before.policyRevision!==after.policyRevision)refuse();
   const scopes=[{kind:'client',tenantId:principal.tenantId,resourceId:native.selectedClientId,policyRevision:after.policyRevision}];validateShape('Scope',scopes[0]);
   const result=data({identitySha256:call.identitySha256,binding:context.binding,scopes,selectedClientId:native.selectedClientId,contextRevision:canonicalSha256({identityRevision:original.identityRevision,nativeContextRevision:native.contextRevision,binding:context.binding,policyRevision:after.policyRevision}),checkedAtMs:now(),expiresAtMs:Math.min(original.expiresAtMs,native.expiresAtMs,before.deadlineMs,after.deadlineMs)});life.check();if(call.signal?.aborted)refuse();return result;
  }catch{refuse();}finally{life.close();}
 }
 return Object.freeze({verifyIdentity,resolveContext});
}
