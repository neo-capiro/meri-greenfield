/** Existing admitted grant + the admitted run row -> canonical worker receipt. No issuance and no Core call: the user was
 * authorized once, at admission; each runner operation is then checked against local facts only (capability, binding,
 * operation, the admitted run's current row and the grant/run lease). */
import {createHash,timingSafeEqual} from 'node:crypto';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {assertWorkerAuthorization,runOwnerOperations} from '../../../packages/contracts/runtime-0.2/validate.mjs';
import {sdkSessionOperations} from '../../../packages/contracts/runtime-0.2/session.mjs';
import {nativeReadOperations} from '../../../packages/contracts/runtime-0.2/reads.mjs';
import {parseAdmittedGrantSet} from '../../gateway/budget/admitted-run-binding.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {carryAuthorityUnavailable} from '../../../packages/runtime/authority-availability.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
export const taskFault=code=>Object.assign(Error('NATIVE_TASK_'+code),{code:'NATIVE_TASK_'+code});
export const capabilityDigest=token=>createHash('sha256').update(token).digest('hex');
export function matchesCapability(token,digest){return typeof token==='string'&&/^\S{1,8192}$/u.test(token)&&timingSafeEqual(Buffer.from(capabilityDigest(token),'hex'),Buffer.from(digest,'hex'));}
const vocabulary=new Set([...Object.keys(runOwnerOperations),...sdkSessionOperations.map(op=>'runner/session/'+op),...nativeReadOperations]);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
/** Inert access compiler shared by original allocation preflight and admitted verification. */
export function compileNativeTaskAccess(configuration){
 const c=own(configuration,['identityCredential','taskCapabilitySha256','operations']),operations=data(c.operations);
 if(typeof c.taskCapabilitySha256!=='string'||!/^[a-f0-9]{64}$/u.test(c.taskCapabilitySha256)||typeof c.identityCredential!=='string'||!/^\S{1,8192}$/u.test(c.identityCredential)||matchesCapability(c.identityCredential,c.taskCapabilitySha256)||!Array.isArray(operations)||!operations.length||operations.length>vocabulary.size||new Set(operations).size!==operations.length||operations.some(op=>!vocabulary.has(op)))throw taskFault('CONFIGURATION');
 return operations;
}
export function createNativeTaskVerifier(configuration){
 const c=own(configuration,['allocationJson','grantFactsJsons','grantId','identityCredential','selectedClientId','currentOwner','operations','expiresAtMs'],['enabled','now','maxRequestMs','signal']);nativeSignal(c.signal);
 const {facts}=parseAdmittedGrantSet(c),grant=facts.find(f=>f.grantId===c.grantId);if(!grant)throw taskFault('CONFIGURATION');const operations=compileNativeTaskAccess({identityCredential:c.identityCredential,taskCapabilitySha256:grant.capabilitySha256,operations:c.operations});
 const enabled=c.enabled??false,now=c.now??Date.now,maxRequestMs=c.maxRequestMs??3000;
 if(typeof enabled!=='boolean'||typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000||
  !Number.isSafeInteger(c.expiresAtMs)||c.expiresAtMs<=now()||typeof c.selectedClientId!=='string'||!uuid.test(c.selectedClientId))throw taskFault('CONFIGURATION');
 const current=storageMethod(c.currentOwner,'currentTaskRun');
 const binding=data(grant.binding),policy=grant.qualificationBinding.policyRevision,selectedClientId=c.selectedClientId;
 // The run's scope as admission fixed it: its one selected client at the grant's policy revision.
 const scopes=data([{kind:'client',tenantId:binding.tenantId,resourceId:selectedClientId,policyRevision:policy}]);validateShape('Scope',scopes[0]);
 async function verify(value){let life;try{
  if(!enabled)throw taskFault('UNAVAILABLE');
  if(c.signal?.aborted)throw taskFault('REFUSED');
  const input=own(value,['capability','binding','operation','inputSha256'],['signal','deadlineMs']);nativeSignal(input.signal);
  const requested=data(input.binding);validateShape('RunBinding',requested);
  if(hash(requested)!==hash(binding)||!operations.includes(input.operation)||!matchesCapability(input.capability,grant.capabilitySha256)||
   typeof input.inputSha256!=='string'||!/^[a-f0-9]{64}$/u.test(input.inputSha256)||input.deadlineMs!==undefined&&!Number.isSafeInteger(input.deadlineMs))throw taskFault('REFUSED');
  const started=now();if(started>=c.expiresAtMs)throw taskFault('REFUSED');
  const signal=c.signal||input.signal?AbortSignal.any([c.signal,input.signal].filter(Boolean)):undefined;
  life=createOperationLifetime({now,deadlineMs:Math.min(input.deadlineMs??started+maxRequestMs,started+maxRequestMs,c.expiresAtMs),signal,errorFactory:()=>taskFault('REFUSED')});
  // The admitted run row is current: same binding, same policy revision, deadline not passed (the owner's read-only snapshot).
  const raw=await life.run(signal=>current(binding,{signal}));
  if(typeof raw!=='string'||Buffer.byteLength(raw)>131072)throw taskFault('REFUSED');
  const fact=data(JSON.parse(raw));own(fact,['binding','policyRevision','deadlineMs','checkedAtMs']);
  if(hash(fact.binding)!==hash(binding)||fact.policyRevision!==policy||!Number.isSafeInteger(fact.checkedAtMs)||fact.checkedAtMs<started||fact.checkedAtMs>now()||!Number.isSafeInteger(fact.deadlineMs)||fact.deadlineMs<=now())throw taskFault('REFUSED');
  life.check();const checkedAtMs=now(),expiresAtMs=Math.min(c.expiresAtMs,fact.deadlineMs);if(checkedAtMs>=expiresAtMs)throw taskFault('REFUSED');
  const receipt={binding,operation:input.operation,inputSha256:input.inputSha256,identityCredential:c.identityCredential,scopes,selectedClientId,policyRevision:policy,
   authorizationDecisionId:hash({grantId:grant.grantId,binding,operation:input.operation,inputSha256:input.inputSha256,checkedAtMs}),checkedAtMs,expiresAtMs};
  return assertWorkerAuthorization(receipt,{binding,operation:input.operation,inputSha256:input.inputSha256,started,now});
 }catch(error){throw carryAuthorityUnavailable(error,taskFault(!enabled?'UNAVAILABLE':'REFUSED'));}finally{life?.close();}}
 return Object.freeze({verify});
}
