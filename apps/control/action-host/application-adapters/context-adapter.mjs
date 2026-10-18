/** Joins native authority facts to a fixed run or a trusted control-selected run. */
import {assertAuthorityIdentityReceipt,assertAuthorityContextReceipt} from '../../../../packages/contracts/action-authority-0.2/validate.mjs';
import {canonicalSha256,validateShape} from '../../../../packages/contracts/validate.mjs';
import {own,data,nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
const refuse=()=>{throw Error('APPLICATION_CONTEXT_REFUSED');};
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b),uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
export function createApplicationContextAdapters(configuration){
 // Optional trusted port: selectRun({principal,conversationId,signal,deadlineMs}) returns
 // JSON {binding,policyRevision,deadlineMs,checkedAtMs}; browser hints are never selectors.
 const {client,currentRun,commandContext,now,limits,selectRun,admitInitialConversation}=own(configuration,['client','currentRun','commandContext','now','limits'],['selectRun','admitInitialConversation']);
 const ports=own(client,['readIdentity','readContext']),context=data(commandContext),l=data(own(limits,['maxRequestMs','maxFactBytes']));own(context,['binding','clientResolution']);own(context.clientResolution,['reference','clientId']);validateShape('RunBinding',context.binding);
 if(Object.values(ports).some(p=>typeof p!=='function')||typeof currentRun!=='function'||(selectRun!==undefined&&typeof selectRun!=='function')||(admitInitialConversation!==undefined&&typeof admitInitialConversation!=='function')||typeof now!=='function'||!Number.isSafeInteger(l.maxRequestMs)||l.maxRequestMs<1||l.maxRequestMs>30000||!Number.isSafeInteger(l.maxFactBytes)||l.maxFactBytes<1||l.maxFactBytes>131072||typeof context.clientResolution.clientId!=='string'||!uuid.test(context.clientResolution.clientId)||context.clientResolution.reference!==context.clientResolution.clientId)refuse();
 const principal=data({tenantId:context.binding.tenantId,actorId:context.binding.actorId});
 function start(call){nativeSignal(call.signal);const at=now();if(!Number.isSafeInteger(at)||at<0||!Number.isSafeInteger(call.deadlineMs))refuse();let cutoff=Math.min(call.deadlineMs,at+l.maxRequestMs);const timer=createOperationLifetime({deadlineMs:cutoff,now,signal:call.signal,errorFactory:()=>Error('APPLICATION_CONTEXT_REFUSED')});return {...timer,deadline:()=>cutoff,limitDeadline(next){cutoff=Math.min(cutoff,next);timer.limitDeadline(cutoff);}};}
 function snapshot(value){if(typeof value==='string'){if(Buffer.byteLength(value)>l.maxFactBytes)refuse();value=JSON.parse(value);}const out=data(value);if(Buffer.byteLength(JSON.stringify(out))>l.maxFactBytes)refuse();return out;}
 function fact(value,validator,started,life){const v=validator(snapshot(value));const at=now();life.check();if(!Number.isSafeInteger(at)||at<0||!Number.isSafeInteger(v.checkedAtMs)||v.checkedAtMs<started||v.checkedAtMs>at||!Number.isSafeInteger(v.expiresAtMs)||v.expiresAtMs<=at)refuse();life.limitDeadline(v.expiresAtMs);return v;}
 function identity(v){own(v.principal,['tenantId','actorId']);if(!same(v.principal,principal)||typeof v.identityRevision!=='string'||!v.identityRevision||v.identityRevision.length>256)refuse();}
 async function verifyIdentity(value){const call=own(value,['credential','deadlineMs'],['signal']),life=start(call);try{const started=now();const result=fact(await life.run(signal=>ports.readIdentity({...call,signal,deadlineMs:life.deadline()})),assertAuthorityIdentityReceipt,started,life);identity(result);life.check();return result;}catch{refuse();}finally{life.close();}}
 async function resolve(value,retained){
  const call=own(value,['identityCredential','identity','identitySha256','hints','deadlineMs'],['signal']),original=assertAuthorityIdentityReceipt(snapshot(call.identity)),hints=snapshot(call.hints);identity(original);own(hints,[],['conversationId','runId','clientId']);
  const conversationId=hints.conversationId??context.binding.conversationId,dynamic=conversationId!==context.binding.conversationId;
  if(call.identitySha256!==canonicalSha256(original)||typeof conversationId!=='string'||!uuid.test(conversationId)||hints.clientId!==undefined&&hints.clientId!==context.clientResolution.clientId||dynamic&&!admitInitialConversation||!dynamic&&!selectRun&&Object.hasOwn(hints,'runId')&&hints.runId!==context.binding.runId)refuse();
  const life=start(call);let cutoff=Math.min(life.deadline(),original.expiresAtMs),binding=context.binding,selected,preflight;
  function runFact(raw,started){if(typeof raw!=='string')refuse();const r=snapshot(raw);own(r,['binding','policyRevision','deadlineMs','checkedAtMs']);validateShape('RunBinding',r.binding);const at=now();life.check();if(typeof r.policyRevision!=='string'||!r.policyRevision||r.policyRevision.length>256||!Number.isSafeInteger(r.checkedAtMs)||r.checkedAtMs<started||r.checkedAtMs>at||!Number.isSafeInteger(r.deadlineMs)||r.deadlineMs<=at)refuse();cutoff=Math.min(cutoff,r.deadlineMs);life.limitDeadline(cutoff);return r;}
  async function run(){const started=now(),r=runFact(await life.run(signal=>currentRun(binding,{signal})),started);if(!same(r.binding,binding)||(selected&&r.policyRevision!==selected.policyRevision))refuse();return r;}
  try{
   life.limitDeadline(original.expiresAtMs);
   if(dynamic){
    const started=now();preflight=fact(await life.run(signal=>ports.readContext({credential:call.identityCredential,identitySha256:call.identitySha256,conversationId,clientId:context.clientResolution.clientId,signal,deadlineMs:cutoff})),assertAuthorityContextReceipt,started,life);identity(preflight);
    if(preflight.identitySha256!==call.identitySha256||preflight.identityRevision!==original.identityRevision||preflight.conversationId!==conversationId||preflight.selectedClientId!==context.clientResolution.clientId||typeof preflight.contextRevision!=='string'||!preflight.contextRevision||preflight.contextRevision.length>256)refuse();
    const selectedAt=now();selected=runFact(await life.run(signal=>admitInitialConversation({principal,conversationId,selectedClientId:context.clientResolution.clientId,signal,deadlineMs:cutoff})),selectedAt);binding=selected.binding;
   }else if(selectRun){const started=now();selected=runFact(await life.run(signal=>selectRun({principal,conversationId,signal,deadlineMs:cutoff})),started);binding=selected.binding;}
   if(selected&&(binding.tenantId!==principal.tenantId||binding.actorId!==principal.actorId||binding.conversationId!==conversationId||Object.hasOwn(hints,'runId')&&hints.runId!==binding.runId))refuse();
   const before=await run(),started=now();const native=fact(await life.run(signal=>ports.readContext({credential:call.identityCredential,identitySha256:call.identitySha256,conversationId:binding.conversationId,clientId:context.clientResolution.clientId,signal,deadlineMs:cutoff})),assertAuthorityContextReceipt,started,life);identity(native);
   if(native.identitySha256!==call.identitySha256||native.identityRevision!==original.identityRevision||native.conversationId!==binding.conversationId||native.selectedClientId!==context.clientResolution.clientId||typeof native.contextRevision!=='string'||!native.contextRevision||native.contextRevision.length>256||preflight&&preflight.contextRevision!==native.contextRevision)refuse();cutoff=Math.min(cutoff,native.expiresAtMs);const after=await run();if(before.policyRevision!==after.policyRevision)refuse();
   const scopes=[{kind:'client',tenantId:principal.tenantId,resourceId:native.selectedClientId,policyRevision:after.policyRevision}];validateShape('Scope',scopes[0]);
   if(retained){const {sourceContext,transition}=retained;
    const sourceRevision=canonicalSha256({identityRevision:original.identityRevision,nativeContextRevision:native.contextRevision,binding:sourceContext.binding,policyRevision:after.policyRevision});
    if(!same(binding,transition.targetBinding)||after.policyRevision!==transition.policyRevision||!same(scopes,sourceContext.scopes)||!same(scopes,transition.scopes)||sourceRevision!==sourceContext.contextRevision)refuse();
   }
   const result=data({identitySha256:call.identitySha256,binding,scopes,selectedClientId:native.selectedClientId,contextRevision:canonicalSha256({identityRevision:original.identityRevision,nativeContextRevision:native.contextRevision,binding,policyRevision:after.policyRevision}),checkedAtMs:now(),expiresAtMs:Math.min(original.expiresAtMs,native.expiresAtMs,before.deadlineMs,after.deadlineMs,selected?.deadlineMs??Infinity)});life.check();if(call.signal?.aborted)refuse();return result;
  }catch{refuse();}finally{life.close();}
 }
 const resolveContext=value=>resolve(value);
 async function resolveTransitionContext(value){
  const call=own(value,['identityCredential','identity','identitySha256','sourceContext','transition','deadlineMs'],['signal']),sourceContext=snapshot(call.sourceContext),transition=snapshot(call.transition);
  own(sourceContext,['binding','scopes','selectedClientId','contextRevision']);validateShape('RunBinding',sourceContext.binding);validateShape('RunBinding',transition.sourceBinding);validateShape('RunBinding',transition.targetBinding);
  const source=sourceContext.binding,target=transition.targetBinding,fork=transition.intent==='fork';
  // The transition's `intent` is the lifecycle journal's (session owner `readTransition`). A resume continues the source conversation
  // under a higher writer fence; a fork opens a NEW conversation of the same principal whose first run (writer fence 1) only the
  // dynamic initial-conversation owner admits, never the fixed conversation and never the source's own.
  if(!['resume','fork'].includes(transition.intent)||!same(source,transition.sourceBinding)||source.tenantId!==principal.tenantId||source.actorId!==principal.actorId||!admitInitialConversation&&source.conversationId!==context.binding.conversationId||target.tenantId!==principal.tenantId||target.actorId!==principal.actorId||(fork?!admitInitialConversation||target.conversationId===source.conversationId||target.conversationId===context.binding.conversationId||target.writerFence!==1:target.conversationId!==source.conversationId||target.writerFence<=source.writerFence)||target.runId===source.runId||target.attemptId===source.attemptId||target.workerId===source.workerId||sourceContext.selectedClientId!==context.clientResolution.clientId||transition.selectedClientId!==sourceContext.selectedClientId||typeof sourceContext.contextRevision!=='string'||!/^[a-f0-9]{64}$/u.test(sourceContext.contextRevision))refuse();
  return resolve({identityCredential:call.identityCredential,identity:call.identity,identitySha256:call.identitySha256,hints:{conversationId:target.conversationId,runId:target.runId,clientId:sourceContext.selectedClientId},deadlineMs:call.deadlineMs,signal:call.signal},{sourceContext,transition});
 }
 return Object.freeze({verifyIdentity,resolveContext,resolveTransitionContext});
}
