/** Control-owned original native host teardown over the EXISTING canonical owners.
 *
 * The worker never receives Control's private client TLS or EC2 credentials. A closed control:true request names only
 * the canonical original binding/generation/host id; this owner reads that exact host row, creates the pinned private
 * lifecycle client from the declared Control TLS refs, and drives the existing createNativeHostLifecycle.settle()
 * coordinator (remote cleanup + physical EC2 absence + canonical writer.recordTeardown). No second allocation, ledger,
 * cleanup framework or credential is introduced.
 */
import {createPostgresHostAllocationWriter} from '../control/browser-hosts/postgres-allocations.mjs';
import {createNativeLifecycleClient} from './native-lifecycle-client.mjs';
import {createNativeHostLifecycle} from './native-host-lifecycle.mjs';
import {readSecret,fault} from './config.mjs';
import {canonicalSha256,validateShape} from '../../packages/contracts/validate.mjs';
import {own} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {verifiedTeardownReceipt} from '../control/browser-hosts/teardown-receipt.mjs';
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
import {createNativeObserverRuntime,retainedNativePhysicalOutcome} from './native-observer-runtime.mjs';
import {createNativeObserverHttpApplication} from './native-observer-http.mjs';
import {NATIVE_DECLARATION_V2} from '../../packages/contracts/native-observer.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const AWS_ID=/^(?:ami|vpc|subnet|sg)-(?:[0-9a-f]{8}|[0-9a-f]{17})$/u;

function facts(host){
 const d=host?.deployment;
 if(d===undefined)return null;
 if(typeof d.accountId!=='string'||!/^[0-9]{12}$/u.test(d.accountId)||
  typeof d.region!=='string'||!/^[a-z]{2}-[a-z]+-[0-9]$/u.test(d.region)||
  typeof d.amiId!=='string'||!d.amiId.startsWith('ami-')||!AWS_ID.test(d.amiId)||
  typeof d.vpcId!=='string'||!d.vpcId.startsWith('vpc-')||!AWS_ID.test(d.vpcId)||
  typeof d.subnetId!=='string'||!d.subnetId.startsWith('subnet-')||!AWS_ID.test(d.subnetId)||
  typeof d.securityGroupId!=='string'||!d.securityGroupId.startsWith('sg-')||!AWS_ID.test(d.securityGroupId)||
  d.rootDeviceName!=='/dev/xvda')throw fault('NATIVE_TEARDOWN_CONFIGURATION');
 return Object.freeze({accountId:d.accountId,region:d.region,amiId:d.amiId,vpcId:d.vpcId,subnetId:d.subnetId,
  securityGroupId:d.securityGroupId,rootDeviceName:d.rootDeviceName});
}
export function createControlNativeHostTeardown({configuration,pool,owners={},now=Date.now}={}){
 const host=configuration?.uploads?.native?.host;
 if(host===undefined)return null;
 const requestMs=host.maxRequestMs??3000;
 const createEc2Client=owners.createEc2Client,createClient=owners.createLifecycleClient,createPhysical=owners.createPhysical,read=owners.readMaterial??readSecret,verifyCaller=owners.verifyCaller;
 for(const value of [createEc2Client,createClient,createPhysical,read,verifyCaller])if(value!==undefined&&typeof value!=='function')
  throw fault('NATIVE_TEARDOWN_CONFIGURATION');
 let writer,observer;
 let closed=false,closing=null;
 const sessions=new Map();
 const close=()=>closing??=(async()=>{
  closed=true;const results=[];let clean=true;
  // Await in-flight construction before disposal. A construction that observes closed cleans itself up.
  for(const pending of sessions.values())try{
   const session=await pending;results.push({status:'fulfilled',value:await session?.client?.dispose?.()});
  }catch{clean=false;/* construction failure was already returned to its caller */}
  sessions.clear();
  observer?.close();
  const failed=results.find(r=>r.status==='rejected');if(failed)throw failed.reason;
  return Object.freeze({closed:clean});
 })();
 try{
  const expected=facts(host);
  if(host.observer!==undefined&&expected===null)throw fault('NATIVE_TEARDOWN_CONFIGURATION');
  observer=host.observer===undefined?null:createNativeObserverRuntime({pool,now,requestMs,expected,
   ...(owners.createObserverSession?{createSession:owners.createObserverSession}:{})});
  writer=observer?.writer??createPostgresHostAllocationWriter({pool,now});
  async function ownerFor({binding,hostId,generation,signal}){
   if(closed)throw fault('NATIVE_TEARDOWN_REFUSED');
   const row=await writer.readNativeHostTeardown({hostId,generation,signal});
   if(closed)throw fault('NATIVE_TEARDOWN_REFUSED');
   // Compare the CLOSED requested original identity to the canonical row before any privileged read/effect.
   // canonicalSha256 covers the full RunBinding fields; validateShape enforces closed types/extra fields.
   if(canonicalSha256(binding)!==canonicalSha256(row.binding))throw fault('NATIVE_TEARDOWN_BINDING_REFUSED');
   const key=`${hostId}:${generation}`;
   if(sessions.has(key))return sessions.get(key);
   // A terminated original row is recoverable for duplicate/restart without repeating privileged effects. The
   // stored canonical receipt is verified by its digest; an absent/invalid receipt is UNKNOWN, never success.
   if(row.state==='terminated'){
    // Recovery must use the SAME canonical receipt validator as the writer, against the saved original
    // allocation/binding/host identity. Digest integrity alone cannot promote an UNKNOWN/malformed receipt.
    // Both guards are required: exact stored digest integrity AND the canonical semantic receipt chain.
    let verified=false;
    try{
     const digestOk=row.teardownSha256===canonicalSha256(row.teardown);
     if(digestOk){verifiedTeardownReceipt(row.teardown,row.record,now());verified=true;}
    }catch{verified=false;}
    const replay=Object.freeze({client:null,lifecycle:null,
     settle:async()=>verified?Object.freeze({closed:true,verified:true,receipt:row.teardown}):
      Object.freeze({closed:false,verified:false})});
    sessions.set(key,Promise.resolve(replay));return Promise.resolve(replay);
   }
   // Historical /1 rows have no durable original physical attempt. Preserve them for read-only recovery,
   // but never manufacture a fresh destructive deadline after an unknown outcome or process restart.
   if(row.declaration?.schema!==NATIVE_DECLARATION_V2)
    return {client:null,lifecycle:null,settle:async()=>({closed:false,verified:false})};
   let observerRow=null;
   if(row.declaration?.schema===NATIVE_DECLARATION_V2){
    if(row.record===null)return {client:null,lifecycle:null,settle:async()=>({closed:false,verified:false})};
    // Retained recovery is before TLS material, STS, EC2 or graph construction. Expiry never renews O.
    if(row.physical?.observations.closedForFullTeardown!=null||
     (row.physical?.context.ordinary&&now()>=row.physical.context.ordinary.deadlineMs))
     return {client:null,lifecycle:null,settle:async()=>({closed:false,verified:false})};
    if(!observer)throw fault('NATIVE_TEARDOWN_CONFIGURATION');
    observerRow=(await observer.read(hostId,generation)).row;
   }
   if(expected===null)throw fault('NATIVE_TEARDOWN_CONFIGURATION');
   const pending=(async()=>{
    const owned=[];
    let failed=false;
    const track=promise=>promise.then(bytes=>{owned.push(bytes);if(failed)try{bytes.fill(0);}catch{}return bytes;});
    const life=createOperationLifetime({now,deadlineMs:now()+requestMs,signal,
     errorFactory:()=>Object.assign(Error('NATIVE_TEARDOWN_DEADLINE'),{code:'NATIVE_TEARDOWN_DEADLINE'})});
    let lifecycle,client;
    try{
     const reads=[host.tls.certPath,host.tls.keyPath,host.tls.caPath].map(path=>
      track(Promise.resolve().then(()=>read(path))));
     let cert,keyBytes,ca;
     try{[cert,keyBytes,ca]=await life.run(()=>Promise.all(reads));}
     catch(error){failed=true;for(const bytes of owned)try{bytes.fill(0);}catch{}throw error;}
     if(closed)throw fault('NATIVE_TEARDOWN_REFUSED');
     const physical=observer.ordinaryPort(observerRow);
     client=createClient===undefined?createNativeLifecycleClient({allocation:row.allocation,binding:row.binding,
      hostIdentity:row.hostIdentity,endpoint:row.record.endpoint,tls:{clientName:host.tls.clientName,cert,key:keyBytes,ca},
      now,requestMs}):createClient({allocation:row.allocation,binding:row.binding,
      hostIdentity:row.hostIdentity,endpoint:row.record.endpoint,tls:{clientName:host.tls.clientName,cert,key:keyBytes,ca},
      now,requestMs});
     if(closed)throw fault('NATIVE_TEARDOWN_REFUSED');
     const lifecycleWriter=observerRow===null?writer:{...writer,async recordTeardown(input){
      const physicalKey={hostId,generation,originalBindingSha256:canonicalSha256(row.binding),declarationSha256:canonicalSha256(row.declaration)};
      await observer.drainFullTeardown({key:physicalKey,receipt:input.receipt,signal:input.signal,deadlineMs:now()+requestMs});
      return writer.recordTeardown(input);
     }};
     lifecycle=createNativeHostLifecycle({client,physical,writer:lifecycleWriter,allocation:row.allocation,binding:row.binding,
      hostIdentity:row.hostIdentity,now,localCleanupMs:requestMs,hostCleanupMs:requestMs});
     return Object.freeze({client,lifecycle,settle:()=>lifecycle.settle({reason:'conversation-end'})});
    }catch(error){try{await client?.dispose?.();}catch{}throw error;}
    finally{
     failed=true;life.close();
     // Owned buffers are copies; clear every one, including a sibling read that finishes after another failed.
     for(const bytes of owned)try{bytes.fill(0);}catch{}
    }
   })();
   sessions.set(key,pending);return pending;
  }
  return Object.freeze({
   writer,
   observerApplication:observer===null?null:createNativeObserverHttpApplication({now,observeIntent:observer.observeIntent,
    readKey:async keyId=>{if(keyId!==host.observer.keyId)throw fault('NATIVE_OBSERVER_KEY_REFUSED');return read(host.observer.keyPath);}}),
   /** Closed original identity only; the row is the authority for all allocation/host facts. */
   async settle(raw){
    let request;try{request=own(raw,['binding','generation','hostId'],['signal']);}catch{throw fault('NATIVE_TEARDOWN_REQUEST_REFUSED');}
    const {binding,generation,hostId,signal}=request;
    try{validateShape('RunBinding',binding);}catch{throw fault('NATIVE_TEARDOWN_REQUEST_REFUSED');}
    if(typeof hostId!=='string'||!UUID.test(hostId)||!Number.isSafeInteger(generation)||generation<1)
     throw fault('NATIVE_TEARDOWN_REQUEST_REFUSED');
    const session=await ownerFor({binding,hostId,generation,signal});
    let value;
    try{value=await session.settle();}catch(error){
     const retained=await writer.readNativeHostTeardown({hostId,generation,signal});
     if(retained.declaration?.schema!==NATIVE_DECLARATION_V2)throw error;
     value={closed:false,verified:false};
    }
    const retained=await writer.readNativeHostTeardown({hostId,generation,signal});
    const physical=retained.declaration?.schema===NATIVE_DECLARATION_V2?retainedNativePhysicalOutcome({allocation:retained.allocation,
     binding:retained.binding,declaration:retained.declaration,state:retained.physical,nowMs:now()}):null;
    // Bind the original requested/canonical identity in the response; closed/verified alone is not physical proof.
    return Object.freeze({binding,hostId,generation,closed:value.closed===true,verified:value.verified===true,
     ...(value.receipt===undefined?{}:{receipt:value.receipt}),...(physical===null?{}:{physical})});
   },
   close,
  });
 }catch(error){try{close().catch(()=>{});}catch{}throw error;}
}
