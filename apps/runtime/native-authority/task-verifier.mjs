/** Existing admitted grant + fresh native context -> canonical worker receipt. No issuance. */
import {createHash,timingSafeEqual} from 'node:crypto';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {assertWorkerAuthorization,runOwnerOperations} from '../../../packages/contracts/runtime-0.2/validate.mjs';
import {sdkSessionOperations} from '../../../packages/contracts/runtime-0.2/session.mjs';
import {parseAdmittedGrantSet} from '../../gateway/budget/admitted-run-binding.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
export const taskFault=code=>Object.assign(Error('NATIVE_TASK_'+code),{code:'NATIVE_TASK_'+code});
export const capabilityDigest=token=>createHash('sha256').update(token).digest('hex');
export function matchesCapability(token,digest){return typeof token==='string'&&/^\S{1,8192}$/u.test(token)&&timingSafeEqual(Buffer.from(capabilityDigest(token),'hex'),Buffer.from(digest,'hex'));}
const vocabulary=new Set([...Object.keys(runOwnerOperations),...sdkSessionOperations.map(op=>'runner/session/'+op)]);
/** Inert access compiler shared by original allocation preflight and admitted verification. */
export function compileNativeTaskAccess(configuration){
 const c=own(configuration,['identityCredential','taskCapabilitySha256','operations']),operations=data(c.operations);
 if(typeof c.taskCapabilitySha256!=='string'||!/^[a-f0-9]{64}$/u.test(c.taskCapabilitySha256)||typeof c.identityCredential!=='string'||!/^\S{1,8192}$/u.test(c.identityCredential)||matchesCapability(c.identityCredential,c.taskCapabilitySha256)||!Array.isArray(operations)||!operations.length||operations.length>vocabulary.size||new Set(operations).size!==operations.length||operations.some(op=>!vocabulary.has(op)))throw taskFault('CONFIGURATION');
 return operations;
}
export function createNativeTaskVerifier(configuration){
 const c=own(configuration,['allocationJson','grantFactsJsons','grantId','identityCredential','currentOwner','identityContext','operations','expiresAtMs'],['enabled','now','maxRequestMs','signal']);nativeSignal(c.signal);
 const {facts}=parseAdmittedGrantSet(c),grant=facts.find(f=>f.grantId===c.grantId);if(!grant)throw taskFault('CONFIGURATION');const operations=compileNativeTaskAccess({identityCredential:c.identityCredential,taskCapabilitySha256:grant.capabilitySha256,operations:c.operations});
 const enabled=c.enabled??false,now=c.now??Date.now,maxRequestMs=c.maxRequestMs??3000;
 if(!grant||typeof enabled!=='boolean'||typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000||
  !Number.isSafeInteger(c.expiresAtMs)||c.expiresAtMs<=now())throw taskFault('CONFIGURATION');
 const current=storageMethod(c.currentOwner,'currentTaskRun'),identity=storageMethod(c.identityContext,'verifyIdentity'),context=storageMethod(c.identityContext,'resolveContext');
 const binding=data(grant.binding),policy=grant.qualificationBinding.policyRevision;
 async function verify(value){let life;try{
  if(!enabled)throw taskFault('UNAVAILABLE');
  if(c.signal?.aborted)throw taskFault('REFUSED');
  const input=own(value,['capability','binding','operation','inputSha256'],['signal','deadlineMs']);nativeSignal(input.signal);
  const requested=data(input.binding);validateShape('RunBinding',requested);
  if(hash(requested)!==hash(binding)||!operations.includes(input.operation)||!matchesCapability(input.capability,grant.capabilitySha256)||
   typeof input.inputSha256!=='string'||!/^[a-f0-9]{64}$/u.test(input.inputSha256)||input.deadlineMs!==undefined&&!Number.isSafeInteger(input.deadlineMs))throw taskFault('REFUSED');
  const started=now();let authorityExpiry=c.expiresAtMs,cutoff=Math.min(input.deadlineMs??started+maxRequestMs,started+maxRequestMs,c.expiresAtMs);
  const signal=c.signal||input.signal?AbortSignal.any([c.signal,input.signal].filter(Boolean)):undefined;
  life=createOperationLifetime({now,deadlineMs:cutoff,signal,errorFactory:()=>taskFault('REFUSED')});
  const limit=at=>{authorityExpiry=Math.min(authorityExpiry,at);cutoff=Math.min(cutoff,at);life.limitDeadline(cutoff);};
  async function snapshot(){const began=now(),raw=await life.run(signal=>current(binding,{signal}));
   if(typeof raw!=='string'||Buffer.byteLength(raw)>131072)throw taskFault('REFUSED');
   const fact=data(JSON.parse(raw));own(fact,['binding','policyRevision','deadlineMs','checkedAtMs']);
   if(hash(fact.binding)!==hash(binding)||fact.policyRevision!==policy||!Number.isSafeInteger(fact.checkedAtMs)||fact.checkedAtMs<began||fact.checkedAtMs>now()||!Number.isSafeInteger(fact.deadlineMs)||fact.deadlineMs<=now())throw taskFault('REFUSED');
   limit(fact.deadlineMs);return fact;
  }
  await snapshot();
  const native=await life.run(signal=>identity({credential:c.identityCredential,signal,deadlineMs:cutoff}));limit(native.expiresAtMs);
  const resolved=await life.run(signal=>context({identityCredential:c.identityCredential,identity:native,identitySha256:hash(native),hints:{conversationId:binding.conversationId,runId:binding.runId},signal,deadlineMs:cutoff}));limit(resolved.expiresAtMs);
  if(hash(resolved.binding)!==hash(binding)||resolved.identitySha256!==hash(native)||resolved.scopes.some(s=>s.policyRevision!==policy))throw taskFault('REFUSED');
  await snapshot();life.check();const checkedAtMs=now();
  const receipt={binding,operation:input.operation,inputSha256:input.inputSha256,identityCredential:c.identityCredential,scopes:resolved.scopes,
   selectedClientId:resolved.selectedClientId,policyRevision:policy,authorizationDecisionId:hash({grantId:grant.grantId,binding,operation:input.operation,inputSha256:input.inputSha256,identitySha256:hash(native),contextRevision:resolved.contextRevision,checkedAtMs}),checkedAtMs,expiresAtMs:authorityExpiry};
  return assertWorkerAuthorization(receipt,{binding,operation:input.operation,inputSha256:input.inputSha256,started,now});
 }catch(error){throw taskFault(!enabled?'UNAVAILABLE':'REFUSED');}finally{life?.close();}}
 return Object.freeze({verify});
}
