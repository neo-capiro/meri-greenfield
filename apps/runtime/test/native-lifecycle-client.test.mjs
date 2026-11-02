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

test('BROWSER-ONLY: the client carries the host\'s settled browser facts through close and observes the browser-host process scope',async()=>{
 const browserAllocation={...allocation,hostId:id(9),hostMode:'browser-only'},browserIdentity={...hostIdentity,hostId:id(9)};
 const d={allocationSha256:hash(browserAllocation),bindingSha256:hash(binding),hostIdentitySha256:hash(browserIdentity)};
 const client=answer=>createNativeLifecycleClient({allocation:browserAllocation,binding,hostIdentity:browserIdentity,endpoint,tls:tlsMaterial,now:Date.now,httpsModule:httpsFor(null,{answer})});
 const close=await client(()=>({schema:NATIVE_LIFECYCLE_SCHEMA,action:'close',...d,status:'closed',quiescedAtMs:Date.now(),browserEgress:'closed',browserState:'disposed'})).close();
 assert.equal(close.closed,true);assert.equal(close.browserEgress,'closed');assert.equal(close.browserState,'disposed');
 const plain=await client(()=>({schema:NATIVE_LIFECYCLE_SCHEMA,action:'close',...d,status:'closed',quiescedAtMs:Date.now()})).close();
 assert.equal(plain.closed,true);assert.equal(plain.browserEgress,undefined);
 const bad=await client(()=>({schema:NATIVE_LIFECYCLE_SCHEMA,action:'close',...d,status:'closed',quiescedAtMs:Date.now(),browserState:'gone'})).close();
 assert.equal(bad.status,'unknown','an unknown browser state vocabulary is not a close proof');
 const processes=await client(()=>({schema:'meri-d005-process-absence/1',...d,observedAtMs:Date.now(),scope:'browser-host-descendants',exited:true,remainingPids:[]})).processes();
 assert.equal(processes.scope,'browser-host-descendants');
 await assert.rejects(client(()=>({schema:'meri-d005-process-absence/1',...d,observedAtMs:Date.now(),scope:'native-processing-descendants',exited:true,remainingPids:[]})).processes(),{code:'NATIVE_LIFECYCLE_UNKNOWN'});
 assert.throws(()=>createNativeLifecycleClient({allocation:{...allocation,hostMode:undefined},binding,hostIdentity,endpoint,tls:tlsMaterial,now:Date.now,httpsModule:httpsFor(null)}),/HOST_BINDING_REFUSED/u,'a legacy allocation has no lifecycle route');
});
test('BROWSER-ONLY: the control lifecycle drives remote close, browser-scoped processes and the physical port, then records the browser-only receipt',async()=>{
 const {verifiedTeardownReceipt}=await import(root+'apps/control/browser-hosts/teardown-receipt.mjs');
 const browserAllocation={...allocation,hostId:id(9),hostMode:'browser-only'},browserIdentity={...hostIdentity,hostId:id(9)};
 const d={allocationSha256:hash(browserAllocation),bindingSha256:hash(binding),hostIdentitySha256:hash(browserIdentity)};
 const calls=[],resources={instanceId:browserIdentity.instanceId,rootVolumeId:'vol-0123456789abcdef0',networkInterfaceIds:['eni-0123456789abcdef0']};
 const client={async close(){calls.push('close');return {closed:true,status:'closed',observedAtMs:Date.now(),browserEgress:'closed',browserState:'disposed'};},
  async processes(){calls.push('processes');return {schema:'meri-d005-process-absence/1',...d,observedAtMs:Date.now(),scope:'browser-host-descendants',exited:true,remainingPids:[]};},
  async observe(){calls.push('observe');throw Error('a browser-only host has no native compartment to observe');}};
 const physical={async destroy(){calls.push('destroy');return {requested:true,...resources};},
  async observeAbsent(){calls.push('absent');return {schema:'meri-d005-physical-absence/1',...d,...resources,observedAtMs:Date.now(),instanceState:'terminated',rootVolumeAbsent:true,networkInterfacesAbsent:true};}};
 const recorded=[];const writer={async recordTeardown({hostId,generation,receipt}){recorded.push({hostId,generation,receipt});return {terminated:true,receiptSha256:hash(receipt)};}};
 const lifecycle=createNativeHostLifecycle({client,physical,writer,allocation:browserAllocation,binding,hostIdentity:browserIdentity,now:Date.now,localCleanupMs:1000,hostCleanupMs:1000});
 const result=await lifecycle.settle({reason:'conversation-end'});
 assert.equal(result.verified,true);assert.deepEqual(calls,['close','processes','destroy','absent'],'no native observe for a browser-only host');
 assert.equal(recorded.length,1);assert.equal(recorded[0].hostId,id(9));
 const record={allocation:browserAllocation,originalBinding:binding,hostIdentity:browserIdentity};
 assert.deepEqual(verifiedTeardownReceipt(recorded[0].receipt,record,Date.now()),recorded[0].receipt,'the canonical writer accepts the browser-only receipt');
 assert.equal(recorded[0].receipt.processScope,'browser-host-descendants');
});
