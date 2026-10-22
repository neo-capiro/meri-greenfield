/** Private startup join over the existing native material, conversation and Core owners.
 * No credential is issued, persisted, logged or returned by this facade. */
import {createOwnerRequestWork} from './owner-request-work.mjs';
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
import {OWNER_MAX_REQUEST_MS} from './service-pair-discovery.mjs';

const fail=()=>{throw Error('PRODUCT_OWNER_NATIVE_UNAVAILABLE');};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const same=(a,b)=>hash(a)===hash(b);
const active=run=>['queued','starting','running'].includes(run.state);
// A borrowed pool cannot be rebound to different deployment authority.
const poolAuthorities=new WeakMap();

/** configuration is the same SHA-pinned control-file snapshot used for placement.
 * credentialFileSha256 is the independently pinned static material inventory entry.
 * A changed deployment must retain/pin-route its predecessor; this owner never
 * adopts a new credential/config for an old original. Core independently checks
 * the actual native session and current tenant/member/client/conversation.
 * readMaterial is a trusted test boundary; production always uses readSecret. */
export function createProductOwnerNativeCurrentness(configuration,{readMaterial=readSecret}={}){
 const c=own(configuration,['configuration','pool','credentialFileSha256','now','limits','fetchImpl'],['enabled','report']);
 const enabled=c.enabled??false,startup=validateConfiguration(data(c.configuration),'control'),candidate=startup.nativeCandidate;
 const limits=data(own(c.limits,['maxRequestMs','maxFactBytes']));
 if(typeof enabled!=='boolean'||!candidate||candidate.multiRun?.dynamicInitialRuns!==true||
    typeof c.now!=='function'||typeof c.fetchImpl!=='function'||typeof readMaterial!=='function'||
    typeof c.pool?.connect!=='function'||c.report!==undefined&&typeof c.report!=='function'||typeof c.credentialFileSha256!=='string'||!/^[a-f0-9]{64}$/u.test(c.credentialFileSha256)||
    !Number.isSafeInteger(limits.maxRequestMs)||limits.maxRequestMs<1||limits.maxRequestMs>OWNER_MAX_REQUEST_MS||
    !Number.isSafeInteger(limits.maxFactBytes)||limits.maxFactBytes<1||limits.maxFactBytes>131072)fail();
 const original=candidate.runtime.binding,selectedClientId=candidate.identity.commandContext.clientResolution.clientId,
  configurationSha256=compilePreparedRunConfigurationSha256(startup),lives=new Set();
 const fingerprint=hash({configuration:startup,credentialFileSha256:c.credentialFileSha256});
 if(!poolAuthorities.has(c.pool))poolAuthorities.set(c.pool,fingerprint);
 if(poolAuthorities.get(c.pool)!==fingerprint)fail();
 let closed=false;
 function scoped(binding){validateShape('RunBinding',binding);if(binding.tenantId!==original.tenantId||binding.actorId!==original.actorId)fail();}
 function make(binding,pool){
  const store=createPostgresConversationStore({pool,now:c.now}),
   initialBindings=createInitialRunBindingJournal({pool,now:c.now});
  const currentOwner={async currentRun(request,{signal}={}){
   // The step reached is reported on refusal (owner-diagnostics.mjs); the refusal itself is unchanged.
   let step='input';try{
   scoped(request);if(closed||!same(request,binding))fail();const started=c.now(),check=()=>{signal?.throwIfAborted();if(closed)fail();};
   check();step='run';const before=await store.readOptional(binding,{limit:1},check);check();
   if(!before||!active(before.run)||!same(before.run.binding,binding)||!same(before.run.versions,startup.versions)||
      before.run.policyRevision!==candidate.qualification.policyRevision)fail();
   const expected=[{kind:'client',tenantId:binding.tenantId,resourceId:selectedClientId,policyRevision:before.run.policyRevision}];
   if(!same(before.run.scopes,expected))fail();
   step='allocation';const allocation=await store.allocations.read({binding,allocationKey:hash(binding)},check);check();
   const record=allocation?.record;
   if(!record||record.state!=='ADMITTED'||!same(record.original.binding,binding)||!same(allocation.run,before.run)||
      record.qualification.policyRevision!==candidate.qualification.policyRevision||!same(record.original.versions,startup.versions)||
      record.original.expiresAtMs<=c.now()||record.taskRequestSha256!==compileNativeTaskRequest({original:record.original,
       taskRequest:candidate.taskRequest,containerName:candidate.containerName}).taskRequestSha256)fail();
   let originalBinding=original,admission=null;
   if(binding.conversationId===original.conversationId){if(binding.writerFence===1&&!same(binding,original))fail();}
   else{
    step='initial-binding';admission=await initialBindings.readConversation({principal:{tenantId:binding.tenantId,actorId:binding.actorId},
     conversationId:binding.conversationId,selectedClientId},check);check();
    // The original record pins its deployment only for its own run; a later run's deployment is proven by its allocation above.
    if(!admission||admission.state!=='ADMITTED'||admission.createdAtMs>c.now()||
       admission.policyRevision!==candidate.qualification.policyRevision||admission.binding.writerFence!==1||
       binding.writerFence===1&&(admission.configurationSha256!==configurationSha256||!same(admission.versions,startup.versions)||
        !same(admission.binding,binding)||admission.expiresAtMs!==record.original.expiresAtMs))fail();
    originalBinding=admission.binding;
   }
   if(binding.writerFence>1){step='first-run';const first=await store.readOptional(originalBinding,{limit:1},check);check();
    if(!first||!same(first.run.binding,originalBinding)||!same(first.run.scopes,expected)||
       first.run.policyRevision!==candidate.qualification.policyRevision||!same(first.run.versions,admission?admission.versions:startup.versions))fail();
   }
   step='next-run';const current=await store.nextRuns.current(binding,check);check();
   if(current.reserved!==false||!same(current.binding,binding)||current.policyRevision!==before.run.policyRevision||!same(current.scopes,expected))fail();
   step='run-after';const after=await store.readOptional(binding,{limit:1},check);check();
   if(!after||!active(after.run)||!same(after.run.binding,binding)||!same(after.run.scopes,expected)||
      after.run.policyRevision!==before.run.policyRevision||!same(after.run.versions,startup.versions))fail();
   const at=c.now();if(!Number.isSafeInteger(at)||at<started)fail();
   return JSON.stringify({binding,policyRevision:after.run.policyRevision,checkedAtMs:at,deadlineMs:Math.min(at+limits.maxRequestMs,record.original.expiresAtMs)});
   }catch(error){try{c.report?.('currentness',step,error);}catch{}throw error;}
  }};
  const delivery={async read(value){
   const v=own(value,['binding','selectedClientId','deadlineMs'],['signal']);nativeSignal(v.signal);
   if(closed||!same(v.binding,binding)||v.selectedClientId!==selectedClientId)fail();
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
 return Object.freeze({get available(){return enabled&&!closed;},async checkCurrentConversation(value){
  let life,work;
  try{
   const v=own(value,['binding','deadlineMs'],['signal']);nativeSignal(v.signal);const binding=data(v.binding);scoped(binding);
   const at=c.now();if(!enabled||closed||!Number.isSafeInteger(v.deadlineMs)||!Number.isSafeInteger(at)||v.deadlineMs<=at)fail();
   life=createOperationLifetime({now:c.now,signal:v.signal,deadlineMs:Math.min(v.deadlineMs,at+limits.maxRequestMs),errorFactory:code=>Object.assign(Error('PRODUCT_OWNER_NATIVE_UNAVAILABLE'),code==='DEADLINE'?{code}:{})});
   lives.add(life);work=createOwnerRequestWork({pool:c.pool,readOnly:true});
   life.signal.addEventListener('abort',work.close,{once:true});
   const owner=make(binding,work.pool);
   const receipt=await life.run(signal=>owner.checkCurrentConversation({binding,deadlineMs:v.deadlineMs,signal}));life.check();return receipt;
  }catch{fail();}finally{life?.signal.removeEventListener('abort',work?.close);life?.close();work?.close();lives.delete(life);}
 },close(){closed=true;for(const life of lives)life.close();lives.clear();}});
}
