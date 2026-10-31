/** Real lifecycle client/handler/coordinator/receipt validator; TLS, OS and cloud are explicit inert boundaries. */
import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
const root=new URL('../../../',import.meta.url).href;
const tls=await import(root+'apps/worker/conversation/host/control/tls.mjs');
mock.module(root+'apps/worker/conversation/host/control/tls.mjs',{exports:{...tls,
 checkedCertificate:(_raw,{nowMs,notAfterMs})=>({fingerprintSha256:'a'.repeat(64),notAfterMs:notAfterMs??nowMs+60000})}});
const {canonicalSha256:hash}=await import(root+'packages/contracts/validate.mjs');
const {createNativeLifecycleClient}=await import(root+'apps/runtime/native-lifecycle-client.mjs');
const {createNativeHostLifecycle}=await import(root+'apps/runtime/native-host-lifecycle.mjs');
const {createLifecycleHandler}=await import(root+'apps/runtime/native-processing-host/lifecycle-http.mjs');
const {verifiedTeardownReceipt}=await import(root+'apps/control/browser-hosts/teardown-receipt.mjs');
const {canonicalEvidence}=await import(root+'apps/runtime/test/native-physical-evidence-fixture.mjs');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const allocation={schema:'meri-conversation-host-allocation/1',tenantId:'tenant',conversationId:id(1),generation:2,
 hostId:id(7),hostMode:'native-processing',imageDigest:'sha256:'+'c'.repeat(64),leaseDeadlineMs:Date.now()+600000};
const binding={tenantId:'tenant',actorId:id(2),conversationId:id(1),runId:id(3),attemptId:id(4),workerId:id(5),writerFence:1};
const hostIdentity={schema:'meri-d005-host-identity/1',hostId:id(7),conversationId:id(1),instanceId:'i-0123456789abcdef0',bootId:id(8)};
const digests={allocationSha256:hash(allocation),bindingSha256:hash(binding),hostIdentitySha256:hash(hostIdentity)};
const closeWire=()=>({schema:'meri-native-host-lifecycle/1',action:'close',...digests,status:'closed',quiescedAtMs:Date.now()});
const processWire=()=>({schema:'meri-d005-process-absence/1',...digests,observedAtMs:Date.now(),scope:'native-processing-descendants',exited:true,remainingPids:[]});
const observeWire=()=>({schema:'meri-d005-native-absence/1',...digests,observedAtMs:Date.now(),scope:'native-processing-descendants',cgroup:'removed',networkNamespace:'removed',status:'absent'});
const endpoint={address:'10.0.0.11',port:9443,serverName:'host.example',serverFingerprintSha256:'b'.repeat(64)};
const tlsMaterial={cert:Buffer.from('synthetic-client'),key:Buffer.from('synthetic-key'),ca:Buffer.from('synthetic-ca'),clientName:'control.meri.internal'};
function owners(){
 const counts={closed:0,destroyed:0,recorded:0};
 const resources={instanceId:hostIdentity.instanceId,rootVolumeId:'vol-0123456789abcdef0',networkInterfaceIds:['eni-0123456789abcdef0']};
 const client={async close(){counts.closed++;return {closed:true,status:'closed',observedAtMs:Date.now()};},
  async processes(){return processWire();},async observe(){return observeWire();}};
 const physical={async destroy(){counts.destroyed++;return {requested:true,...resources};},
  async observeAbsent(){const observedAtMs=Date.now();
   return {schema:'meri-d005-physical-absence/1',...digests,...resources,observedAtMs,
    instanceState:'terminated',rootVolumeAbsent:true,networkInterfacesAbsent:true,
    evidence:canonicalEvidence({instanceId:resources.instanceId,rootVolumeId:resources.rootVolumeId,
     networkInterfaceIds:[...resources.networkInterfaceIds],startedAtMs:observedAtMs,nowMs:observedAtMs+10000})};}};
 const writer={async recordTeardown(){counts.recorded++;return {terminated:true};}};
 return {client,physical,writer,counts};
}
const bridge=o=>createNativeHostLifecycle({...o,allocation,binding,hostIdentity});
async function withActualClient(run){
 const handler=createLifecycleHandler({authenticate:async()=>({verified:true,notAfterMs:Date.now()+60000}),
  readBody:async req=>{const chunks=[];for await(const chunk of req)chunks.push(chunk);return Buffer.concat(chunks);},
  lifecycle:{close:async()=>closeWire(),processes:async()=>processWire(),observe:async()=>observeWire()},
  config:{allocation:{...allocation,instanceId:hostIdentity.instanceId,bootId:hostIdentity.bootId},binding,image:{digest:allocation.imageDigest}},
  now:Date.now,peerNotAfterMs:Date.now()+60000});
 const server=http.createServer((req,res)=>{req.socket.encrypted=true;void handler(req,res);});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 try{
  const transport={request(options,callback){return http.request({host:'127.0.0.1',port:server.address().port,
   path:options.path,method:options.method,headers:options.headers,signal:options.signal},callback);}};
  const client=createNativeLifecycleClient({allocation,binding,hostIdentity,endpoint,tls:tlsMaterial,httpsModule:transport});
  return await run(client);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}

test('native lifecycle: actual lifecycle HTTP client and coordinator receipt is accepted by canonical writer validator',async()=>{
 await withActualClient(async client=>{
  const o=owners();o.client=client;
  o.writer.recordTeardown=async({receipt})=>{o.counts.recorded++;verifiedTeardownReceipt(receipt,
   {allocation,originalBinding:binding,hostIdentity},Date.now()+10000);return {terminated:true};};
  const result=await bridge(o).settle({reason:'conversation-end'});
  assert.equal(result.receipt.status,'VERIFIED');assert.equal(o.counts.destroyed,1);assert.equal(o.counts.recorded,1);
 });
});

test('native lifecycle: duplicate settle and lost receipt acknowledgement replay exactly one receipt without second destruction',async()=>{
 const o=owners(),receipts=[];
 o.writer.recordTeardown=async({receipt})=>{receipts.push(receipt);if(receipts.length===1)
  throw Object.assign(Error('uncertain'),{code:'BROWSER_HOST_TEARDOWN_UNKNOWN'});return {terminated:true};};
 const host=bridge(o),first=host.settle(),second=host.settle();assert.equal(first,second);
 const result=await first;assert.equal(result.verified,true);assert.equal(o.counts.destroyed,1);
 assert.equal(receipts.length,2);assert.equal(receipts[0],receipts[1]);
});

test('native lifecycle: unknown native cleanup still attempts physical teardown and never records verified',async()=>{
 const o=owners();o.client.close=async()=>({closed:false,status:'unknown'});
 await assert.rejects(bridge(o).settle(),error=>error.code==='HOST_TEARDOWN_UNKNOWN');
 assert.equal(o.counts.destroyed,1);assert.equal(o.counts.recorded,0);
});

test('native lifecycle: client owner is captured at construction and cannot be replaced before settle',async()=>{
 const o=owners(),host=bridge(o);o.client.close=async()=>{throw Error('replacement owner');};
 const result=await host.settle();assert.equal(result.verified,true);assert.equal(o.counts.closed,1);
});

test('native lifecycle: physical owner is captured at construction and cannot be replaced before settle',async()=>{
 const o=owners(),host=bridge(o);o.physical.destroy=async()=>{throw Error('replacement owner');};
 const result=await host.settle();assert.equal(result.verified,true);assert.equal(o.counts.destroyed,1);
});

test('native lifecycle: Control to guest client uses the protected Control peer SAN distinct from guest to Control identity',()=>{
 assert.doesNotThrow(()=>createNativeLifecycleClient({allocation,binding,hostIdentity,endpoint,
  tls:{...tlsMaterial,clientName:'control.meri.internal'}}));
});
