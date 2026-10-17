/** Private startup join over the existing native material, conversation and Core owners.
 * No credential is issued, persisted, logged or returned by this facade. */
import {createHash} from 'node:crypto';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {createPostgresConversationStore} from '../../control/conversations/postgres-store.mjs';
import {createInitialRunBindingJournal} from '../../control/conversations/initial-run-binding-journal.mjs';
import {validateConfiguration,readSecret} from '../../runtime/config.mjs';
import {compilePreparedRunConfigurationSha256} from '../../runtime/prepared-run-configuration.mjs';
import {compileNativeTaskRequest} from '../../runtime/native-authority/task-request.mjs';
import {createProductOwnerCredentialDelivery} from './owner-credential-delivery.mjs';

const fail=()=>{throw Error('PRODUCT_OWNER_NATIVE_UNAVAILABLE');};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const same=(a,b)=>hash(a)===hash(b);
const active=run=>['queued','starting','running'].includes(run.state);
// A process cannot replace an uncertain helper over the same borrowed authority.
const poolAuthorities=new WeakMap();

/** configuration is the same SHA-pinned control-file snapshot used for placement.
 * credentialFileSha256 is the independently pinned static material inventory entry.
 * A changed deployment must retain/pin-route its predecessor; this owner never
 * adopts a new credential/config for an old original. Core independently checks
 * the actual native session and current tenant/member/client/conversation.
 * readMaterial is a trusted test boundary; production always uses readSecret. */
export function createProductOwnerNativeCurrentness(configuration,{readMaterial=readSecret}={}){
 const c=own(configuration,['configuration','pool','credentialFileSha256','now','limits','fetchImpl'],['enabled']);
 const enabled=c.enabled??false,startup=validateConfiguration(data(c.configuration),'control'),candidate=startup.nativeCandidate;
 const limits=data(own(c.limits,['maxRequestMs','maxFactBytes']));
 if(typeof enabled!=='boolean'||!candidate||candidate.multiRun?.dynamicInitialRuns!==true||
    typeof c.now!=='function'||typeof c.fetchImpl!=='function'||typeof readMaterial!=='function'||
    typeof c.pool?.connect!=='function'||typeof c.credentialFileSha256!=='string'||!/^[a-f0-9]{64}$/u.test(c.credentialFileSha256)||
    !Number.isSafeInteger(limits.maxRequestMs)||limits.maxRequestMs<1||limits.maxRequestMs>3000||
    !Number.isSafeInteger(limits.maxFactBytes)||limits.maxFactBytes<1||limits.maxFactBytes>131072)fail();
 const original=candidate.runtime.binding,selectedClientId=candidate.identity.commandContext.clientResolution.clientId,
  store=createPostgresConversationStore({pool:c.pool,now:c.now}),initialBindings=createInitialRunBindingJournal({pool:c.pool,now:c.now}),
  configurationSha256=compilePreparedRunConfigurationSha256(startup),owners=new Map();
 const fingerprint=hash({configuration:startup,credentialFileSha256:c.credentialFileSha256});
 if(!poolAuthorities.has(c.pool))poolAuthorities.set(c.pool,{fingerprint,quarantined:false});
 const authorityState=poolAuthorities.get(c.pool);if(authorityState.fingerprint!==fingerprint)fail();
 let closed=false;
 function scoped(binding){validateShape('RunBinding',binding);if(binding.tenantId!==original.tenantId||binding.actorId!==original.actorId)fail();}
 function make(binding){
  const currentOwner={async currentRun(request,{signal}={}){
   scoped(request);if(closed||authorityState.quarantined||!same(request,binding))fail();const started=c.now(),check=()=>{signal?.throwIfAborted();if(closed||authorityState.quarantined)fail();};
   check();const before=await store.readOptional(binding,{limit:1},check);check();
   if(!before||!active(before.run)||!same(before.run.binding,binding)||!same(before.run.versions,startup.versions)||
      before.run.policyRevision!==candidate.qualification.policyRevision)fail();
   const expected=[{kind:'client',tenantId:binding.tenantId,resourceId:selectedClientId,policyRevision:before.run.policyRevision}];
   if(!same(before.run.scopes,expected))fail();
   const allocation=await store.allocations.read({binding,allocationKey:hash(binding)},check);check();
   const record=allocation?.record;
   if(!record||record.state!=='ADMITTED'||!same(record.original.binding,binding)||!same(allocation.run,before.run)||
      record.qualification.policyRevision!==candidate.qualification.policyRevision||!same(record.original.versions,startup.versions)||
      record.original.expiresAtMs<=c.now()||record.taskRequestSha256!==compileNativeTaskRequest({original:record.original,
       taskRequest:candidate.taskRequest,containerName:candidate.containerName}).taskRequestSha256)fail();
   let originalBinding=original;
   if(binding.conversationId===original.conversationId){if(binding.writerFence===1&&!same(binding,original))fail();}
   else{
    const admission=await initialBindings.readConversation({principal:{tenantId:binding.tenantId,actorId:binding.actorId},
     conversationId:binding.conversationId,selectedClientId},check);check();
    if(!admission||admission.state!=='ADMITTED'||admission.createdAtMs>c.now()||admission.configurationSha256!==configurationSha256||
       admission.policyRevision!==candidate.qualification.policyRevision||!same(admission.versions,startup.versions)||
       admission.binding.writerFence!==1||binding.writerFence===1&&(!same(admission.binding,binding)||admission.expiresAtMs!==record.original.expiresAtMs))fail();
    originalBinding=admission.binding;
   }
   if(binding.writerFence>1){const first=await store.readOptional(originalBinding,{limit:1},check);check();
    if(!first||!same(first.run.binding,originalBinding)||!same(first.run.scopes,expected)||
       first.run.policyRevision!==candidate.qualification.policyRevision||!same(first.run.versions,startup.versions))fail();
   }
   const current=await store.nextRuns.current(binding,check);check();
   if(current.reserved!==false||!same(current.binding,binding)||current.policyRevision!==before.run.policyRevision||!same(current.scopes,expected))fail();
   const after=await store.readOptional(binding,{limit:1},check);check();
   if(!after||!active(after.run)||!same(after.run.binding,binding)||!same(after.run.scopes,expected)||
      after.run.policyRevision!==before.run.policyRevision||!same(after.run.versions,startup.versions))fail();
   const at=c.now();if(!Number.isSafeInteger(at)||at<started)fail();
   return JSON.stringify({binding,policyRevision:after.run.policyRevision,checkedAtMs:at,deadlineMs:Math.min(at+limits.maxRequestMs,record.original.expiresAtMs)});
  }};
  const delivery={async read(value){
   const v=own(value,['binding','selectedClientId','deadlineMs'],['signal']);nativeSignal(v.signal);
   if(closed||authorityState.quarantined||!same(v.binding,binding)||v.selectedClientId!==selectedClientId)fail();
   v.signal?.throwIfAborted();let bytes;
   try{
    bytes=await readMaterial(candidate.identity.credentialFile);v.signal?.throwIfAborted();
    if(!Buffer.isBuffer(bytes)||sha(bytes)!==c.credentialFileSha256)fail();
    const credential=bytes.toString('utf8').trim();if(!/^[\x21-\x7e]{1,8192}$/u.test(credential))fail();
    const at=c.now(),expiry=Math.min(v.deadlineMs,at+limits.maxRequestMs);
    if(!Number.isSafeInteger(at)||!Number.isSafeInteger(expiry)||expiry<=at)fail();
    return {schemaVersion:1,leaseId:'native_'+c.credentialFileSha256,binding,selectedClientId,credential,
     credentialSha256:sha(Buffer.from(credential,'utf8')),checkedAtMs:at,expiresAtMs:expiry};
   }finally{bytes?.fill(0);}
  }};
  return createProductOwnerCredentialDelivery({binding,selectedClientId,expiresAtMs:Number.MAX_SAFE_INTEGER,
   origin:candidate.identity.origin,currentOwner,delivery,fetchImpl:c.fetchImpl,now:c.now,
   limits:{...limits,maxCredentialMs:limits.maxRequestMs},enabled});
 }
 return Object.freeze({get available(){return enabled&&!closed&&!authorityState.quarantined;},async checkCurrentConversation(value){
  let life,owner;
  try{
   const v=own(value,['binding','deadlineMs'],['signal']);nativeSignal(v.signal);const binding=data(v.binding);scoped(binding);
   const at=c.now();if(!enabled||closed||authorityState.quarantined||!Number.isSafeInteger(v.deadlineMs)||!Number.isSafeInteger(at)||v.deadlineMs<=at)fail();
   const key=hash(binding);if(!owners.has(key)){if(owners.size>=1024)fail();owners.set(key,make(binding));}
   owner=owners.get(key);if(!owner.available){authorityState.quarantined=true;fail();}
   life=createOperationLifetime({now:c.now,signal:v.signal,deadlineMs:Math.min(v.deadlineMs,at+limits.maxRequestMs),errorFactory:()=>Error('PRODUCT_OWNER_NATIVE_UNAVAILABLE')});
   const receipt=await life.run(signal=>owner.checkCurrentConversation({binding,deadlineMs:v.deadlineMs,signal}));life.check();return receipt;
  }catch{fail();}finally{if(life?.close().unsettledOperations>0||owner?.available===false)authorityState.quarantined=true;}
 },close(){closed=true;if(enabled)authorityState.quarantined=true;owners.clear();}});
}
