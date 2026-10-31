/** Lifecycle credential ownership and deadlines with a strict inert certificate boundary; no real PKI or sockets. */
import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
const root=new URL('../../../',import.meta.url).href;
const tls=await import(root+'apps/worker/conversation/host/control/tls.mjs');
let certName='control.meri.internal',certUntil=Date.now()+60000,copies=[];
mock.module(root+'apps/worker/conversation/host/control/tls.mjs',{exports:{...tls,
 tlsBytes:raw=>{const copy=tls.tlsBytes(raw);copies.push(copy);return copy;},
 checkedCertificate:(_raw,{name,nowMs,notAfterMs=Infinity})=>{
  if(name!==certName||certUntil<=nowMs||certUntil>notAfterMs)throw Error('CERTIFICATE_REFUSED');
  return {fingerprintSha256:'a'.repeat(64),notAfterMs:certUntil};}}});
const {createNativeLifecycleClient}=await import(root+'apps/runtime/native-lifecycle-client.mjs');
const {canonicalSha256:hash}=await import(root+'packages/contracts/validate.mjs');
const {hostClientDnsName}=await import(root+'apps/worker/conversation/host/control/protocol.mjs');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const binding={tenantId:'tenant',actorId:id(2),conversationId:id(1),runId:id(3),attemptId:id(4),workerId:id(5),writerFence:1};
const hostIdentity={schema:'meri-d005-host-identity/1',hostId:id(7),conversationId:id(1),instanceId:'i-0123456789abcdef0',bootId:id(8)};
const allocation=lease=>({schema:'meri-conversation-host-allocation/1',tenantId:'tenant',conversationId:id(1),generation:2,
 hostId:id(7),hostMode:'native-processing',imageDigest:'sha256:'+'c'.repeat(64),leaseDeadlineMs:lease});
const endpoint={address:'10.0.0.11',port:9443,serverName:'host.example',serverFingerprintSha256:'b'.repeat(64)};
const original={cert:Buffer.from('synthetic-cert'),key:Buffer.from('synthetic-key'),ca:Buffer.from('synthetic-ca')};
function create({lease=Date.now()+600000,peerName='control.meri.internal',delay=0}={}){
 const a=allocation(lease),timers=new Set();
 const transport={request(options,callback){const request=new EventEmitter();
  request.end=()=>{const timer=setTimeout(()=>{
   timers.delete(timer);
   const payload=Buffer.from(JSON.stringify({schema:'meri-native-host-lifecycle/1',action:'close',allocationSha256:hash(a),
    bindingSha256:hash(binding),hostIdentitySha256:hash(hostIdentity),status:'closed',quiescedAtMs:Date.now()}));
   const response=Object.assign(new EventEmitter(),{statusCode:200,headers:{'content-type':'application/json','content-length':String(payload.length)}});
   callback(response);setImmediate(()=>{response.emit('data',payload);response.emit('end');});
  },delay);timers.add(timer);
  options.signal?.addEventListener('abort',()=>{clearTimeout(timer);timers.delete(timer);request.emit('error',Error('aborted'));},{once:true});};
  return request;}};
 const client=createNativeLifecycleClient({allocation:a,binding,hostIdentity,endpoint,
  tls:{...original,...(peerName===null?{}:{clientName:peerName})},requestMs:500,httpsModule:transport});
 return {client,cleanup(){for(const timer of timers)clearTimeout(timer);timers.clear();}};
}
function reset(){copies=[];certName='control.meri.internal';certUntil=Date.now()+60000;}

test('native credentials: missing protected Control peer identity refuses even when a guest-identity certificate is valid',()=>{
 reset();certName=hostClientDnsName(allocation(Date.now()+600000));
 assert.throws(()=>create({peerName:null}));
});
test('native credentials: current Control credential permits bounded cleanup after workload lease expiry',async()=>{
 reset();const c=create({lease:Date.now()-1000});
 try{assert.equal((await c.client.close()).status,'closed');}finally{c.cleanup();await c.client.dispose?.();}
});
test('native credentials: a lifecycle request cannot release success after its Control credential expires',async()=>{
 reset();certUntil=Date.now()+70;const c=create({delay:200});
 try{await assert.rejects(c.client.close());}finally{c.cleanup();await c.client.dispose?.();}
});
test('native credentials: local disposal zeroes owned TLS copies, preserves borrowed bytes and refuses further exchanges',async()=>{
 reset();const c=create();
 try{assert.equal(typeof c.client.dispose,'function');await c.client.dispose();await c.client.dispose();
  assert.ok(copies.every(buffer=>buffer.every(byte=>byte===0)));
  assert.equal(original.key.toString(),'synthetic-key');assert.equal(original.cert.toString(),'synthetic-cert');
  await assert.rejects(c.client.close());
 }finally{c.cleanup();await c.client.dispose?.();}
});
test('native credentials: failed credential construction retains no uncleared owned TLS copies',()=>{
 reset();certUntil=Date.now()-1000;assert.throws(()=>create());
 assert.ok(copies.every(buffer=>buffer.every(byte=>byte===0)),'owned credential copies must be cleared on construction failure');
});
