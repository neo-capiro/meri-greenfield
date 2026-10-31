/** Canonical NATIVE currentness producer, built only from EXISTING Control owners.
 *
 * - executions.readCurrentOnClient(client,{binding,signal,deadlineMs},check) on the caller's transaction;
 * - createCurrentBrowserCoreAccess({core,nativeCredentials:sessions,now}) → {receipt,recheck};
 * - uploadStore.readOnClient(client,owner,uploadId,check) for the exact saved row;
 * - retentionGate.assertServable({tenantId,kind:'conversation',subjectId}) — a NORMAL return is success.
 *
 * The policy digest comes from trusted configuration, never from the request grant. Any mismatch refuses.
 */
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {assertHostRunBinding} from '../../worker/conversation/host/binding.mjs';
import {createCurrentBrowserCoreAccess} from './current-core.mjs';

const fail=code=>{throw Object.assign(new Error(code),{code});};
const ACTIVE_RUN=Object.freeze(['queued','starting','running']);
const ACTIVE_PHASE=Object.freeze(['launching','started']);

export function createCanonicalHostExternalAuthority({core,nativeCredentials,retentionGate,now=Date.now,policySha256,maxFreshMs=30000}={}){
 if(typeof retentionGate?.assertServable!=='function'||typeof nativeCredentials?.nativeCredentialFor!=='function'||
  typeof core?.readCurrent!=='function'||typeof now!=='function'||typeof policySha256!=='string'||!/^[a-f0-9]{64}$/u.test(policySha256))fail('NATIVE_HOST_AUTHORITY_CONFIGURATION');
 const coreAccess=createCurrentBrowserCoreAccess({core,nativeCredentials,now});
 return Object.freeze({policySha256,async verify({binding,selectedClientId,expectedPolicySha256,signal,deadlineMs}={}){
  const nowMs=now();
  try{validateShape('RunBinding',binding);}catch{fail('NATIVE_HOST_AUTHORITY_REFUSED');}
  if(expectedPolicySha256!==policySha256||!Number.isSafeInteger(deadlineMs)||deadlineMs<=nowMs||
   (selectedClientId!==null&&(typeof selectedClientId!=='string'||!selectedClientId))||
   typeof binding?.tenantId!=='string'||!binding.tenantId||typeof binding?.conversationId!=='string'||!binding.conversationId||
   typeof binding?.actorId!=='string'||!binding.actorId)fail('NATIVE_HOST_AUTHORITY_REFUSED');
  const limit=Math.min(deadlineMs,nowMs+maxFreshMs);
  const life=createOperationLifetime({now,deadlineMs:limit,signal,errorFactory:()=>Object.assign(Error('NATIVE_HOST_AUTHORITY_REFUSED'),{code:'NATIVE_HOST_AUTHORITY_REFUSED'})});
  try{const {receipt,recheck}=await coreAccess({binding,selectedClientId,life});life.check();
   if(receipt===null||receipt===undefined||!Number.isSafeInteger(receipt.expiresAtMs))fail('NATIVE_HOST_AUTHORITY_REFUSED');
   await life.run(()=>retentionGate.assertServable({tenantId:binding.tenantId,kind:'conversation',subjectId:binding.conversationId}));life.check();
   const rechecked=await recheck();life.check();const currentUntilMs=Math.min(life.deadline(),receipt.expiresAtMs,...(Number.isSafeInteger(rechecked)?[rechecked]:[]));
   if(!Number.isSafeInteger(currentUntilMs)||currentUntilMs<=now())fail('NATIVE_HOST_AUTHORITY_REFUSED');
   return Object.freeze({binding,selectedClientId,currentUntilMs,policySha256});
  }finally{life.close();}
 }});
}
export function createCanonicalHostAuthority(options={}){
 const external=createCanonicalHostExternalAuthority(options);
 return Object.freeze({policySha256:external.policySha256,async verify(_client,request){return external.verify(request);}});
}
export function createCanonicalNativeCurrentness({executions,core,nativeCredentials,uploads,retentionGate,now=Date.now,
 policySha256,maxFreshMs=30000}={}){
 if(typeof executions?.readCurrentOnClient!=='function'||typeof uploads?.readOnClient!=='function'||
  typeof retentionGate?.assertServable!=='function'||typeof nativeCredentials?.nativeCredentialFor!=='function'||
  typeof core?.readCurrent!=='function'||typeof now!=='function'||typeof policySha256!=='string'||
  !/^[a-f0-9]{64}$/u.test(policySha256))fail('NATIVE_CURRENTNESS_CONFIGURATION');
 const external=createCanonicalHostExternalAuthority({core,nativeCredentials,retentionGate,now,policySha256,maxFreshMs});
 return Object.freeze({policySha256,async readCanonicalNative(client,{allocation,binding,custody,declaration,signal}={}){
  const bound=assertHostRunBinding(allocation,binding);
  const nowMs=now();
  const deadlineMs=Math.min(allocation.leaseDeadlineMs,nowMs+maxFreshMs);
  const life=createOperationLifetime({now,deadlineMs,signal,errorFactory:()=>Object.assign(
   Error('NATIVE_CURRENTNESS_CANCELLED'),{code:'NATIVE_CURRENTNESS_CANCELLED'})});
  try{
   const check=()=>life.check();
   // 1. Canonical execution currentness on the SAME transaction and the exact full binding.
   const execution=await life.run(()=>executions.readCurrentOnClient(client,{binding:bound,signal:life.signal,
    deadlineMs:life.deadline()},check));
   check();
   if(execution===null||execution===undefined||!ACTIVE_RUN.includes(execution.run?.state)||
    !ACTIVE_PHASE.includes(execution.executionPhase)||hash(execution.binding)!==hash(bound))
    fail('NATIVE_CURRENTNESS_REFUSED');
   let selectedClientId;
   if(custody===undefined){
    // Host currentness (native lifecycle/verifier): execution scopes ARE the current authority. No upload row is
    // involved, and an absent custody is never treated as an upload absence.
    const priv=execution.scopes.length===1&&execution.scopes[0].kind==='private-user'&&
     execution.scopes[0].resourceId===bound.actorId;
    const clientScope=execution.scopes.find(scope=>scope.kind==='client');
    if(!priv&&clientScope===undefined)fail('NATIVE_CURRENTNESS_REFUSED');
    selectedClientId=priv?null:clientScope.resourceId;
   }else{
    const owner={tenantId:bound.tenantId,actorId:bound.actorId,conversationId:bound.conversationId,clientId:custody.owner.clientId};
    const record=await life.run(()=>uploads.readOnClient(client,owner,custody.uploadId,check));
    check();
    if(record===null||record===undefined||record.state!=='stored'||hash(record)!==custody.recordSha256||
     record.revision!==custody.revision||record.object===null||record.object.versionId!==custody.versionId||
     record.object.sha256!==custody.sha256||hash(record.scopes)!==hash(custody.scopes)||
     record.declaration.sha256!==declaration.sha256||record.declaration.bytes!==declaration.bytes||
     hash(record.declaration)!==hash(declaration))fail('NATIVE_CURRENTNESS_REFUSED');
    if(hash(execution.scopes)!==hash(record.scopes))fail('NATIVE_CURRENTNESS_REFUSED');
    selectedClientId=record.owner.clientId;
    if(!(selectedClientId===null
     ?execution.scopes.length===1&&execution.scopes[0].kind==='private-user'&&
      execution.scopes[0].resourceId===bound.actorId
     :execution.scopes.some(scope=>scope.kind==='client'&&scope.resourceId===selectedClientId)))
     fail('NATIVE_CURRENTNESS_REFUSED');
   }
   // 4. Shared external phase: Core credential receipt, retention and recheck. No duplicate sequence here.
   const authority=await life.run(s=>external.verify({binding:bound,selectedClientId,expectedPolicySha256:policySha256,
    deadlineMs:life.deadline(),signal:s}));
   check();
   if(hash(authority.binding)!==hash(bound)||authority.selectedClientId!==selectedClientId||
    authority.policySha256!==policySha256)fail('NATIVE_CURRENTNESS_REFUSED');
   const currentUntilMs=Math.min(life.deadline(),execution.deadlineMs??life.deadline(),authority.currentUntilMs);
   if(!Number.isSafeInteger(currentUntilMs)||currentUntilMs<=now())fail('NATIVE_CURRENTNESS_REFUSED');
   return Object.freeze({binding:bound,scopes:custody===undefined?execution.scopes:execution.scopes,selectedClientId,currentUntilMs,policySha256});
  }finally{life.close();}
 }});
}
