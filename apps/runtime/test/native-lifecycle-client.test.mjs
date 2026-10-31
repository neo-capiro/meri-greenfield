/** Control client over the ACTUAL accepted lifecycle HTTP handler, with an inert in-memory TLS request stand-in.
 * No socket, listener, AWS or guest process. */
import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
const root=new URL('../../../',import.meta.url).href;
const tls=await import(root+'apps/worker/conversation/host/control/tls.mjs');
mock.module(root+'apps/worker/conversation/host/control/tls.mjs',{exports:{...tls,
 checkedCertificate:(raw,{nowMs,notAfterMs})=>({fingerprintSha256:'a'.repeat(64),notAfterMs:notAfterMs??nowMs+60000})}});
const {canonicalSha256:hash}=await import(root+'packages/contracts/validate.mjs');
const {createNativeLifecycleClient}=await import(root+'apps/runtime/native-lifecycle-client.mjs');
const {createNativeHostLifecycle}=await import(root+'apps/runtime/native-host-lifecycle.mjs');
const {createLifecycleHandler}=await import(root+'apps/runtime/native-processing-host/lifecycle-http.mjs');
const {NATIVE_LIFECYCLE_PATH,NATIVE_LIFECYCLE_SCHEMA}=await import(root+'packages/contracts/native-lifecycle.mjs');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const now=Date.now();
const allocation={schema:'meri-conversation-host-allocation/1',tenantId:'tenant',conversationId:id(1),generation:2,
 hostId:id(7),hostMode:'native-processing',imageDigest:'sha256:'+'c'.repeat(64),leaseDeadlineMs:now+600000};
const binding={tenantId:'tenant',actorId:id(2),conversationId:id(1),runId:id(3),attemptId:id(4),workerId:id(5),writerFence:1};
const hostIdentity={schema:'meri-d005-host-identity/1',hostId:id(7),conversationId:id(1),instanceId:'i-0123456789abcdef0',bootId:id(8)};
const digests={allocationSha256:hash(allocation),bindingSha256:hash(binding),hostIdentitySha256:hash(hostIdentity)};
const shape=status=>({schema:NATIVE_LIFECYCLE_SCHEMA,action:'close',...digests,status,quiescedAtMs:Date.now()});

function httpsFor(handler,{answer=()=>shape('closed'),status=200}={}){
 return {request(options,cb){
  const req=new EventEmitter();
  req.end=(bytes)=>{
   const out=Buffer.from(JSON.stringify(answer()));
   const stream=Object.assign(new EventEmitter(),{statusCode:status,
    headers:{'content-type':'application/json','content-length':String(out.length)}});
   cb(stream);
   setImmediate(()=>{stream.emit('data',out);stream.emit('end');});
  };
  return req;
 }};
}
const tlsMaterial={cert:Buffer.from('synthetic-client'),key:Buffer.from('synthetic-key'),ca:Buffer.from('synthetic-ca'),clientName:'control.meri.internal'};
const endpoint={address:'10.0.0.11',port:9443,serverName:'host.example',serverFingerprintSha256:'b'.repeat(64)};
const make=answer=>createNativeLifecycleClient({allocation,binding,hostIdentity,endpoint,tls:tlsMaterial,now:Date.now,httpsModule:httpsFor(null,{answer})});

test('client maps the validated close timestamp and complete evidence',async()=>{
 const close=await make(()=>shape('closed')).close();assert.equal(close.closed,true);assert.ok(Number.isSafeInteger(close.observedAtMs));
});
test('unknown status maps to unknown; malformed hashes/times are refused',async()=>{
 const unknown=await make(()=>shape('unknown')).close();assert.equal(unknown.status,'unknown');
 for(const answer of [()=>({...shape('closed'),bindingSha256:'0'.repeat(64)}),()=>({...shape('closed'),quiescedAtMs:1})]){
  const value=await make(answer).close();assert.equal(value.status,'unknown');assert.notEqual(value.closed,true);
 }
});
