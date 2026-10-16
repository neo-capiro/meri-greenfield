/** Private native credential delivery into the existing Core identity join.
 *
 * Trusted startup supplies delivery.read, backed by its already approved
 * authority (or its existing readSecret owner). This module defines no issuer,
 * file authority, credential persistence or listener. It never exposes bearer
 * material in its result or error. The fixed original run/client and current
 * Core identity/context, not delivery metadata alone, authorize a receipt.
 */
import {createHash} from 'node:crypto';
import {types} from 'node:util';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {createNativeIdentityContext} from '../../runtime/native-authority/identity-context.mjs';
import {retainedOrigin} from '../../../packages/contracts/runtime-0.2/retained-reads.mjs';

const unavailable=()=>Error('PRODUCT_OWNER_CREDENTIAL_UNAVAILABLE');
const fail=()=>{throw unavailable();};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const sha=/^[a-f0-9]{64}$/u,slot=/^[A-Za-z0-9_-]{1,128}$/u;
const same=(a,b)=>hash(a)===hash(b);
const credentialSha=value=>createHash('sha256').update(value,'utf8').digest('hex');
const responseGetters=Object.fromEntries(['body','redirected','status','statusText','headers']
 .map(name=>[name,Object.getOwnPropertyDescriptor(Response.prototype,name).get]));

/** Exact private delivery.read result (never an HTTP request or public DTO):
 * {schemaVersion:1,leaseId,binding,selectedClientId,credential,
 *  credentialSha256,checkedAtMs,expiresAtMs}.
 * Both reads must freshly resolve the same currently valid lease and digest;
 * revoke by refusing read or returning a changed/expired lease. A new lease can
 * be admitted only by a later independent identity/context check. No raw bearer
 * is returned by this composition. maxCredentialMs is at most five minutes.
 */
export function createProductOwnerCredentialDelivery(configuration){
 const c=own(configuration,['binding','selectedClientId','expiresAtMs','origin','currentOwner','delivery','fetchImpl','now','limits'],['enabled']);
 const binding=data(c.binding),limits=data(own(c.limits,['maxRequestMs','maxFactBytes','maxCredentialMs'])),enabled=c.enabled??false;
 validateShape('RunBinding',binding);
 if(typeof enabled!=='boolean'||typeof c.now!=='function'||typeof c.fetchImpl!=='function'||
    typeof c.selectedClientId!=='string'||!uuid.test(c.selectedClientId)||
    !Number.isSafeInteger(c.expiresAtMs)||c.expiresAtMs<1||
    !Number.isSafeInteger(limits.maxRequestMs)||limits.maxRequestMs<1||limits.maxRequestMs>30000||
    !Number.isSafeInteger(limits.maxFactBytes)||limits.maxFactBytes<1||limits.maxFactBytes>131072||
    !Number.isSafeInteger(limits.maxCredentialMs)||limits.maxCredentialMs<1||limits.maxCredentialMs>300000)fail();
 const read=storageMethod(c.delivery,'read'),currentRun=storageMethod(c.currentOwner,'currentRun'),origin=retainedOrigin(c.origin);
 let quarantined=false;
 return Object.freeze({get available(){return enabled&&!quarantined;},async checkCurrentConversation(value){
  let life,cutoff;const pending=new Set(),bodies=new Set();
  const track=operation=>{
   const work=Promise.resolve().then(operation);pending.add(work);
   work.then(()=>pending.delete(work),()=>pending.delete(work));return work;
  };
  async function fetchObserved(...args){
   const response=await track(()=>c.fetchImpl(...args));
   if(!response||types.isProxy(response)||!(response instanceof Response))return response;
   const sourceBody=responseGetters.body.call(response);if(!sourceBody)return response;
   const reader=sourceBody.getReader();let done=false,stopping;
   const state={stop(){
    if(done)return Promise.resolve();
    return stopping??=(track(()=>reader.cancel()).then(()=>{
     done=true;bodies.delete(state);reader.releaseLock();
    }));
   }};
   bodies.add(state);
   // A wrapped Response cannot preserve redirected=true. Refuse that source
   // after an acknowledged body stop instead of erasing the native flag.
   if(responseGetters.redirected.call(response)){await state.stop();fail();}
   const body=new ReadableStream({
    async pull(controller){try{
     const part=await track(()=>reader.read());
     if(part.done){done=true;bodies.delete(state);reader.releaseLock();controller.close();}
     else controller.enqueue(part.value);
    }catch{controller.error(unavailable());}},
    cancel:()=>state.stop(),
   },{highWaterMark:0});
   return new Response(body,{status:responseGetters.status.call(response),
    statusText:responseGetters.statusText.call(response),headers:responseGetters.headers.call(response)});
  }
  try{
   const v=own(value,['binding','deadlineMs'],['signal']);nativeSignal(v.signal);
   const at=c.now();
   if(!enabled||quarantined||!same(data(v.binding),binding)||!Number.isSafeInteger(at)||at<0||
      !Number.isSafeInteger(v.deadlineMs)||v.deadlineMs<=at)fail();
   cutoff=Math.min(v.deadlineMs,c.expiresAtMs,at+limits.maxRequestMs);
   life=createOperationLifetime({deadlineMs:cutoff,now:c.now,signal:v.signal,errorFactory:unavailable});
   const identity=createNativeIdentityContext({origin,
    currentOwner:{currentRun:(...args)=>track(()=>currentRun(...args))},
    commandContext:{binding,clientResolution:{reference:c.selectedClientId,clientId:c.selectedClientId}},
    fetchImpl:fetchObserved,now:c.now,limits:{maxRequestMs:limits.maxRequestMs,maxFactBytes:limits.maxFactBytes},enabled});
   const limit=expiry=>{cutoff=Math.min(cutoff,expiry);life.limitDeadline(cutoff);};
   async function delivery(){
    const started=c.now();
    const raw=own(await life.run(signal=>track(()=>read({binding,selectedClientId:c.selectedClientId,deadlineMs:cutoff,signal}))),
     ['schemaVersion','leaseId','binding','selectedClientId','credential','credentialSha256','checkedAtMs','expiresAtMs']);
    const current=c.now();life.check();
    if(!Number.isSafeInteger(current)||current<started||raw.schemaVersion!==1||typeof raw.leaseId!=='string'||!slot.test(raw.leaseId)||
       !same(data(raw.binding),binding)||raw.selectedClientId!==c.selectedClientId||
       typeof raw.credential!=='string'||!/^[\x21-\x7e]{1,8192}$/u.test(raw.credential)||
       typeof raw.credentialSha256!=='string'||!sha.test(raw.credentialSha256)||credentialSha(raw.credential)!==raw.credentialSha256||
       !Number.isSafeInteger(raw.checkedAtMs)||raw.checkedAtMs<started||raw.checkedAtMs>current||
       !Number.isSafeInteger(raw.expiresAtMs)||raw.expiresAtMs<=current||raw.expiresAtMs>raw.checkedAtMs+limits.maxCredentialMs)fail();
    limit(raw.expiresAtMs);return raw;
   }
   const before=await delivery();
   // Existing native transport/parser verifies the original configured
   // tenant/actor, exact client/conversation/run and current run before/after
   // Core context. The private delivery response is never identity authority.
   const principal=await life.run(signal=>identity.verifyIdentity({credential:before.credential,deadlineMs:cutoff,signal}));
   limit(principal.expiresAtMs);
   const receipt=await life.run(signal=>identity.resolveContext({identityCredential:before.credential,
    identity:principal,identitySha256:hash(principal),
    hints:{conversationId:binding.conversationId,runId:binding.runId,clientId:c.selectedClientId},deadlineMs:cutoff,signal}));
   limit(receipt.expiresAtMs);
   const after=await delivery();
   if(after.leaseId!==before.leaseId||after.credentialSha256!==before.credentialSha256)fail();
   life.check();return data({...receipt,expiresAtMs:cutoff});
  }catch{fail();}finally{
   // The canonical transport may finish before its reader.cancel promise.
   // Await the underlying body owner's stop within the original lifetime;
   // known complete denials can retry, unresolved I/O closes this instance.
   if(bodies.size&&life)try{await life.run(()=>Promise.all([...bodies].map(body=>body.stop())));}catch{}
   if(life?.close().unsettledOperations>0||pending.size>0||bodies.size>0)quarantined=true;
  }
 }});
}
