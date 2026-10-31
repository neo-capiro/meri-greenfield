/** Joins fresh Core authority to the canonical durable conversation/run owner. */
import {types} from 'node:util';
import {assertAuthorityIdentityReceipt,assertAuthorityContextReceipt} from '../../../../packages/contracts/action-authority-0.2/validate.mjs';
import {canonicalSha256,validateShape} from '../../../../packages/contracts/validate.mjs';
import {own,data,nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {currentReceipt} from './current-receipt.mjs';
import {researchCurrentReceipt} from './research-current-receipt.mjs';
import {researchContextFields,researchContextFromCurrent,sameResearchContext} from './research-context.mjs';
import {markAuthorityUnavailable,isAuthorityUnavailable} from '../../../../packages/runtime/authority-availability.mjs';
// The refusal names only the step it reached and the cause's own code (a fixed constant of our owners), for the session owner's
// refusal line (session/owner.mjs); never a message, identifier or Core answer.
// A cause is read only when it is a plain object, never a proxy: no trap runs and nothing it holds is reflected.
const ownedCode=value=>typeof value==='string'&&/^[A-Z][A-Z0-9_]{2,63}$/u.test(value)?value:undefined;
const inspectable=value=>value!==null&&typeof value==='object'&&!types.isProxy(value);
/** The step and owned reason code a refusal carries, for a layer that replaces it with its own public error. */
export const refusalDiagnostic=cause=>{if(!inspectable(cause))return {};const step=typeof cause.step==='string'?cause.step:undefined,reason=ownedCode(cause.reason);
 return {...(step===undefined?{}:{step}),...(reason===undefined?{}:{reason})};};
const refuse=(step,cause)=>{throw Object.assign(Error('APPLICATION_CONTEXT_REFUSED'),step===undefined?{}:{step,reason:inspectable(cause)?ownedCode(cause.code)??ownedCode(cause.message):undefined});};
// A dependency that did not answer keeps its mark; every other failure is this adapter's refusal.
const refuseUnless=(error,step)=>{if(isAuthorityUnavailable(error)){try{if(step!==undefined&&inspectable(error)&&error.step===undefined)error.step=step;}catch{}throw error;}refuse(step,error);};
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b),uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
export function createApplicationContextAdapters(configuration){
 // Fresh Core receipts establish the principal and exact conversation scope before the durable initial owner runs.
 // An optional runId hint constrains that owner; it never authorizes a new binding or a successor.
 const {client,currentRun,now,limits,admitInitialConversation}=own(configuration,['client','currentRun','now','limits','admitInitialConversation']);
 const ports=own(client,['readIdentity','readContext'],['readCurrent','readResearchCurrent']),l=data(own(limits,['maxRequestMs','maxFactBytes']));
 if(Object.values(ports).some(p=>typeof p!=='function')||typeof currentRun!=='function'||typeof admitInitialConversation!=='function'||typeof now!=='function'||!Number.isSafeInteger(l.maxRequestMs)||l.maxRequestMs<1||l.maxRequestMs>30000||!Number.isSafeInteger(l.maxFactBytes)||l.maxFactBytes<1||l.maxFactBytes>131072)refuse();
 function start(call){nativeSignal(call.signal);const at=now();if(!Number.isSafeInteger(at)||at<0||!Number.isSafeInteger(call.deadlineMs))refuse();let cutoff=Math.min(call.deadlineMs,at+l.maxRequestMs);
 // Running out of time without the caller cancelling means Core did not answer; it is not a refusal.
 const timer=createOperationLifetime({deadlineMs:cutoff,now,signal:call.signal,errorFactory:code=>{const error=Error('APPLICATION_CONTEXT_REFUSED');return code==='DEADLINE'&&!call.signal?.aborted?markAuthorityUnavailable(error):error;}});return {...timer,deadline:()=>cutoff,limitDeadline(next){cutoff=Math.min(cutoff,next);timer.limitDeadline(cutoff);}};}
 function snapshot(value){if(typeof value==='string'){if(Buffer.byteLength(value)>l.maxFactBytes)refuse();value=JSON.parse(value);}const out=data(value);if(Buffer.byteLength(JSON.stringify(out))>l.maxFactBytes)refuse();return out;}
 function fact(value,validator,started,life){const v=validator(snapshot(value));const at=now();life.check();if(!Number.isSafeInteger(at)||at<0||!Number.isSafeInteger(v.checkedAtMs)||v.checkedAtMs<started||v.checkedAtMs>at||!Number.isSafeInteger(v.expiresAtMs)||v.expiresAtMs<=at)refuse();life.limitDeadline(v.expiresAtMs);return v;}
 function identity(v){own(v.principal,['tenantId','actorId']);if(typeof v.identityRevision!=='string'||!v.identityRevision||v.identityRevision.length>256)refuse();}
 async function verifyIdentity(value){const call=own(value,['credential','deadlineMs'],['signal']),life=start(call);try{const started=now();const result=fact(await life.run(signal=>ports.readIdentity({...call,signal,deadlineMs:life.deadline()})),assertAuthorityIdentityReceipt,started,life);identity(result);life.check();return result;}catch(error){refuseUnless(error);}finally{life.close();}}
 async function resolve(value,retained){
  const call=own(value,['identityCredential','identity','identitySha256','hints','deadlineMs'],['signal']),original=assertAuthorityIdentityReceipt(snapshot(call.identity)),hints=snapshot(call.hints);identity(original);own(hints,['conversationId','clientId'],['runId','scopeKind','scope']);
  const subject=researchContextFields(hints),research=subject.scopeKind==='research_portfolio';
  const principal=original.principal;
  const conversationId=hints.conversationId,selectedClientId=hints.clientId;
  if(research&&(selectedClientId!==null||typeof ports.readResearchCurrent!=='function'))refuse();
  if(call.identitySha256!==canonicalSha256(original)||typeof conversationId!=='string'||!uuid.test(conversationId)||selectedClientId!==null&&(typeof selectedClientId!=='string'||!uuid.test(selectedClientId)))refuse();
  const life=start(call),exact=Object.hasOwn(hints,'runId')?{runId:hints.runId}:{};let cutoff=Math.min(life.deadline(),original.expiresAtMs),binding,selected,preflight,step='input';
  function runFact(raw,started){if(typeof raw!=='string')refuse();const r=snapshot(raw);own(r,['binding','policyRevision','deadlineMs','checkedAtMs'],['rebind']);validateShape('RunBinding',r.binding);
   // The initial owner's atomic supersession result. Only a well-formed source-to-target pair whose target is the
   // binding this admission returns may accompany the fact; anything else is refused before any current-run read.
   if(r.rebind!==undefined){own(r.rebind,['source','target']);validateShape('RunBinding',r.rebind.source);validateShape('RunBinding',r.rebind.target);if(!same(r.rebind.target,r.binding)||r.rebind.source.tenantId!==r.binding.tenantId||r.rebind.source.actorId!==r.binding.actorId||r.rebind.source.conversationId!==r.binding.conversationId||r.rebind.source.runId===r.binding.runId)refuse();}
   const at=now();life.check();if(typeof r.policyRevision!=='string'||!r.policyRevision||r.policyRevision.length>256||!Number.isSafeInteger(r.checkedAtMs)||r.checkedAtMs<started||r.checkedAtMs>at||!Number.isSafeInteger(r.deadlineMs)||r.deadlineMs<=at)refuse();cutoff=Math.min(cutoff,r.deadlineMs);life.limitDeadline(cutoff);return r;}
  async function run(){const started=now(),r=runFact(await life.run(signal=>currentRun(binding,{signal,selectedClientId})),started);if(!same(r.binding,binding)||(selected&&r.policyRevision!==selected.policyRevision))refuse();return r;}
  // General is admitted only by Core's current-conversation receipt. The older
  // /context contract remains client-only; membership never substitutes for it.
  async function readContext(conversationId){
   const started=now();
   if(research){
    const r=fact(await life.run(signal=>ports.readResearchCurrent({credential:call.identityCredential,conversationId,clientId:null,signal,deadlineMs:cutoff})),researchCurrentReceipt,started,life);
    const captured=researchContextFromCurrent(r);if(!sameResearchContext(subject,captured))refuse();
    return data({principal:r.principal,identityRevision:r.identityRevision,identitySha256:call.identitySha256,conversationId:r.conversationId,selectedClientId:null,contextRevision:r.contextRevision,...captured,checkedAtMs:r.checkedAtMs,expiresAtMs:r.expiresAtMs});
   }
   if(selectedClientId!==null||!ports.readCurrent)return fact(await life.run(signal=>ports.readContext({credential:call.identityCredential,identitySha256:call.identitySha256,conversationId,clientId:selectedClientId,signal,deadlineMs:cutoff})),assertAuthorityContextReceipt,started,life);
   const r=fact(await life.run(signal=>ports.readCurrent({credential:call.identityCredential,conversationId,clientId:selectedClientId,signal,deadlineMs:cutoff})),currentReceipt,started,life);
   return data({principal:r.principal,identityRevision:r.identityRevision,identitySha256:call.identitySha256,conversationId:r.conversationId,selectedClientId:r.selectedClientId,contextRevision:r.contextRevision,checkedAtMs:r.checkedAtMs,expiresAtMs:r.expiresAtMs});
  }
  try{
   life.limitDeadline(original.expiresAtMs);
   // The lifecycle journal already committed this exact target. Rechecking it must never select or reserve its successor when
   // it finishes before the start acknowledgement; currentRun and fresh Core context still prove the retained target below.
   if(retained)binding=retained.transition.targetBinding;
   else{
    step='context-preflight';preflight=await readContext(conversationId);identity(preflight);
    if(!same(preflight.principal,principal)||preflight.identitySha256!==call.identitySha256||preflight.identityRevision!==original.identityRevision||preflight.conversationId!==conversationId||preflight.selectedClientId!==selectedClientId||typeof preflight.contextRevision!=='string'||!preflight.contextRevision||preflight.contextRevision.length>256)refuse();
    step='initial-binding';const selectedAt=now();selected=runFact(await life.run(signal=>admitInitialConversation({principal,conversationId,selectedClientId,signal,deadlineMs:cutoff,...exact})),selectedAt);binding=selected.binding;
   }
   // An exact run hint is a selector. It may name the returned binding itself, or — only on a verified initial
   // supersession — the source binding the owner's transaction just replaced. A recheck (retained) never rebinds.
   const provenRebind=selected&&selected.rebind&&!retained&&Object.hasOwn(hints,'runId')&&hints.runId===selected.rebind.source.runId&&same(selected.rebind.target,binding);
   if(selected&&(binding.tenantId!==principal.tenantId||binding.actorId!==principal.actorId||binding.conversationId!==conversationId||Object.hasOwn(hints,'runId')&&hints.runId!==binding.runId&&!provenRebind))refuse();
   step='current-run';const before=await run();step='context';const native=await readContext(binding.conversationId);identity(native);
   if(!same(native.principal,principal)||native.identitySha256!==call.identitySha256||native.identityRevision!==original.identityRevision||native.conversationId!==binding.conversationId||native.selectedClientId!==selectedClientId||typeof native.contextRevision!=='string'||!native.contextRevision||native.contextRevision.length>256||preflight&&preflight.contextRevision!==native.contextRevision)refuse();cutoff=Math.min(cutoff,native.expiresAtMs);step='current-run';const after=await run();if(before.policyRevision!==after.policyRevision)refuse();
   const scopes=[{kind:selectedClientId===null?'private-user':'client',tenantId:principal.tenantId,resourceId:selectedClientId===null?principal.actorId:selectedClientId,policyRevision:after.policyRevision}];validateShape('Scope',scopes[0]);
   if(retained){const {sourceContext,transition}=retained;
    const sourceRevision=canonicalSha256({identityRevision:original.identityRevision,nativeContextRevision:native.contextRevision,binding:sourceContext.binding,policyRevision:after.policyRevision});
    if(!sameResearchContext(sourceContext,native)||!same(binding,transition.targetBinding)||after.policyRevision!==transition.policyRevision||!same(scopes,sourceContext.scopes)||!same(scopes,transition.scopes)||sourceRevision!==sourceContext.contextRevision)refuse();
   }
   const result=data({identitySha256:call.identitySha256,binding,scopes,selectedClientId:native.selectedClientId,...researchContextFields(native),contextRevision:canonicalSha256({identityRevision:original.identityRevision,nativeContextRevision:native.contextRevision,binding,policyRevision:after.policyRevision}),checkedAtMs:now(),expiresAtMs:Math.min(original.expiresAtMs,native.expiresAtMs,before.deadlineMs,after.deadlineMs,selected?.deadlineMs??Infinity),...(selected?.rebind?{rebind:selected.rebind}:{})});life.check();if(call.signal?.aborted)refuse();return result;
  }catch(error){refuseUnless(error,step);}finally{life.close();}
 }
 const resolveContext=value=>resolve(value);
 async function resolveTransitionContext(value){
  const call=own(value,['identityCredential','identity','identitySha256','sourceContext','transition','deadlineMs'],['signal']),sourceContext=snapshot(call.sourceContext),transition=snapshot(call.transition);
  own(sourceContext,['binding','scopes','selectedClientId','contextRevision'],['scopeKind','scope']);researchContextFields(sourceContext);validateShape('RunBinding',sourceContext.binding);validateShape('RunBinding',transition.sourceBinding);validateShape('RunBinding',transition.targetBinding);
  const source=sourceContext.binding,target=transition.targetBinding,fork=transition.intent==='fork',principal=assertAuthorityIdentityReceipt(snapshot(call.identity)).principal;
  // The transition's `intent` is the lifecycle journal's (session owner `readTransition`). A resume continues the source conversation
  // under a higher writer fence; a fork opens a NEW conversation of the same principal whose first run (writer fence 1) only the
  // dynamic initial-conversation owner admits, never the fixed conversation and never the source's own.
  if(!['resume','takeover.end','fork'].includes(transition.intent)||!same(source,transition.sourceBinding)||source.tenantId!==principal.tenantId||source.actorId!==principal.actorId||target.tenantId!==principal.tenantId||target.actorId!==principal.actorId||(fork?target.conversationId===source.conversationId||target.writerFence!==1:target.conversationId!==source.conversationId||target.writerFence<=source.writerFence)||target.runId===source.runId||target.attemptId===source.attemptId||target.workerId===source.workerId||transition.selectedClientId!==sourceContext.selectedClientId||typeof sourceContext.contextRevision!=='string'||!/^[a-f0-9]{64}$/u.test(sourceContext.contextRevision))refuse();
  return resolve({identityCredential:call.identityCredential,identity:call.identity,identitySha256:call.identitySha256,hints:{conversationId:target.conversationId,runId:target.runId,clientId:sourceContext.selectedClientId,...researchContextFields(sourceContext)},deadlineMs:call.deadlineMs,signal:call.signal},{sourceContext,transition});
 }
 return Object.freeze({verifyIdentity,resolveContext,resolveTransitionContext});
}
