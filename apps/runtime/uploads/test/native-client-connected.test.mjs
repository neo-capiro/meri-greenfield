/** Real compiled per-operation mount -> canonical custody -> native client -> actual request/result -> one saved
 * transition per conversation, through ONE mounted port. Only SQL/TLS/object effects are inert. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const IMAGE=`sha256:${'b'.repeat(64)}`,POLICY='f'.repeat(64);
const BYTES=Buffer.from('native upload exact bytes\n');
const DECLARATION={filename:'note.txt',mimeType:'text/plain',bytes:BYTES.length,sha256:sha(BYTES)};
const {compileUploadNativeConfiguration,mountUploadNativeControl}=await import('../control-lifecycle.mjs');
const INVENTORY=Object.freeze(['/run/meri','/var/run/secrets']);
const {nativeUploadInspectionRequest}=await import('../native-host-contract.mjs');
const {uploadInspectionBody}=await import('../agentcore-contract.mjs');
const {createUploadCustody}=await import('../../../control/uploads/custody.mjs');
const {createUploadInspection}=await import('../../../control/uploads/extraction.mjs');

const tool={name:'synthetic',version:'1',binarySha256:'a'.repeat(64)};
const observed=()=>({sourceSha256:DECLARATION.sha256,sourceBytes:BYTES.length,checkedAtMs:Date.now()});
const actualInspection=createUploadInspection({
 scanner:{scan:async()=>({...observed(),status:'clean',tool,definitionsSha256:'b'.repeat(64),reason:null})},
 extractor:{extract:async()=>({...observed(),status:'available',tool,segments:[],limitations:[]})}});

async function responseFor(body){
 const {envelope,bytes}=nativeUploadInspectionRequest(JSON.parse(body));
 assert.deepEqual(bytes,BYTES);
 const q=envelope.request;
 const value=await actualInspection.inspect(q.declaration,bytes,{deadlineMs:q.deadlineMs});
 return {status:200,body:JSON.stringify(uploadInspectionBody({requestId:q.requestId,imageDigest:q.imageDigest,value}))};
}

function conversation(n){
 const binding={tenantId:uuid(1),actorId:uuid(2),conversationId:uuid(n),runId:uuid(40+n),attemptId:uuid(5),
  workerId:uuid(6),writerFence:1};
 const scopes=[{tenantId:binding.tenantId,kind:'private-user',resourceId:binding.actorId,policyRevision:'p1'}];
 const record={uploadId:uuid(20+n),requestId:uuid(21+n),
  owner:{tenantId:binding.tenantId,actorId:binding.actorId,conversationId:binding.conversationId,clientId:null},
  declaration:DECLARATION,scopes,objectId:uuid(22+n),
  object:{objectId:uuid(22+n),versionId:'V',sha256:DECLARATION.sha256,bytes:DECLARATION.bytes,scopes},
  state:'stored',inspection:null,createdAtMs:Date.now()-1000,updatedAtMs:Date.now()-1000,revision:2};
 const allocation={schema:'meri-conversation-host-allocation/1',tenantId:binding.tenantId,
  conversationId:binding.conversationId,generation:3,hostId:uuid(70+n),hostMode:'native-processing',
  imageDigest:IMAGE,leaseDeadlineMs:Date.now()+600000};
 const hostIdentity={schema:'meri-d005-host-identity/1',hostId:allocation.hostId,conversationId:binding.conversationId,
  instanceId:'i-0123456789abcdef0',bootId:uuid(8)};
 const endpoint={address:`10.1.2.${n}`,port:9443,serverName:'native.meri.internal',serverFingerprintSha256:'c'.repeat(64)};
 const current=async()=>({binding,scopes,selectedClientId:null,checkedAtMs:Date.now(),expiresAtMs:Date.now()+30000});
 return {binding,scopes,record,allocation,hostIdentity,endpoint,current};
}
const compiled=compileUploadNativeConfiguration({uploads:{native:{enabled:true,policySha256:POLICY,
 host:{tls:{certPath:'/synthetic/cert',keyPath:'/synthetic/key',caPath:'/synthetic/ca'},maxRequestMs:3000}}}});

test('CONNECTED: one mounted per-operation port resolves EACH conversation to its own allocation and saves one transition',async()=>{
 const a=conversation(3),b=conversation(4);
 const seen=[];let connects=0,closes=0,transitions=0;
 const targets=new Map([[a.binding.conversationId,a],[b.binding.conversationId,b]]);
 const allocations={async resolve({binding,custody,declaration}){
  const t=targets.get(binding.conversationId);assert.ok(t,'only known conversations resolve');
  assert.equal(custody.owner.conversationId,binding.conversationId);
  assert.equal(declaration.sha256,DECLARATION.sha256);
  seen.push(t.endpoint.address);
  return {allocation:t.allocation,hostIdentity:t.hostIdentity,endpoint:t.endpoint,ownerInstanceId:uuid(9),
   recordSha256:'e'.repeat(64),expiresAtMs:Date.now()+30000};}};
 const addresses=[];
 const mounted=await mountUploadNativeControl({credentialPaths:INVENTORY,configuration:{uploads:{native:compiled}},allocations,
  connect:async options=>{connects++;addresses.push(options.address);
   return {close:async()=>{closes++;return {closed:true};},send:async({body})=>responseFor(body)};}});
 assert.equal(mounted.missing.length,0);
 const unused=()=>{throw Error('UNEXPECTED_EFFECT');};
 const owners=new Map();
 for(const t of [a,b]){
  let saved=structuredClone(t.record);
  owners.set(t.binding.conversationId,createUploadCustody({inspection:mounted.inspection,current:t.current,
   now:Date.now,ids:()=>uuid(99),
   store:{prepare:unused,read:async()=>structuredClone(saved),
    transition:async(before,after)=>{assert.deepEqual(before,saved);transitions++;saved=structuredClone(after);
     return structuredClone(saved);}},
   objects:{put:unused,observePut:unused,get:async()=>Buffer.from(BYTES)},
   retention:{assertServable:async()=>{},withRelease:async(subjects,fn,options)=>fn(options.signal,async()=>{})},
   removeOriginal:unused}));
 }
 const results=[await owners.get(a.binding.conversationId).inspect(a.record.uploadId,{deadlineMs:Date.now()+2000}),
  await owners.get(b.binding.conversationId).inspect(b.record.uploadId,{deadlineMs:Date.now()+2000})];
 assert.equal(results.every(r=>r.inspection.scan.status==='clean'),true);
 assert.equal(transitions,2,'one saved transition per conversation');
 assert.equal(results.length,2);
 assert.equal(connects,2);assert.equal(closes,2,'each close was actually observed inside its callback');
 assert.deepEqual(addresses,[a.endpoint.address,b.endpoint.address],'connect options carried the per-conversation address');
 assert.deepEqual(seen,[a.endpoint.address,b.endpoint.address],'each conversation targeted its own endpoint');
});

test('HELD LOOKUP: caller abort during the allocation lookup refuses with zero connects',async()=>{
 let release,connects=0;
 const allocations={async resolve(){return new Promise(resolve=>{release=resolve;});}};
 const mounted=await mountUploadNativeControl({credentialPaths:INVENTORY,configuration:{uploads:{native:compiled}},allocations,
  connect:async()=>{connects++;throw Error('MUST_NOT_CONNECT');}});
 const t=conversation(3);const controller=new AbortController();
 const pending=mounted.inspection.inspect(DECLARATION,BYTES,{deadlineMs:Date.now()+80,signal:controller.signal,
  custodyContext:{record:t.record,current:await t.current(),assertCurrent:t.current}});
 const error=await pending.then(value=>({value}),error=>({error}));
 assert.equal(error.error?.code,'UPLOAD_INSPECTION_CANCELLED');
 release({allocation:t.allocation,hostIdentity:t.hostIdentity,endpoint:t.endpoint,ownerInstanceId:uuid(9),
  recordSha256:'e'.repeat(64),expiresAtMs:Date.now()+30000});
 await new Promise(resolve=>setTimeout(resolve,20));
 assert.equal(connects,0,'no connection after the caller cancelled the lookup');
});

test('EXPIRED TARGET: a late already-expired allocation resolves zero connects',async()=>{
 let connects=0;
 const t=conversation(3);
 const allocations={async resolve(){await new Promise(resolve=>setTimeout(resolve,40));
  return {allocation:t.allocation,hostIdentity:t.hostIdentity,endpoint:t.endpoint,ownerInstanceId:uuid(9),
   recordSha256:'e'.repeat(64),expiresAtMs:Date.now()-1};}};
 const mounted=await mountUploadNativeControl({credentialPaths:INVENTORY,configuration:{uploads:{native:compiled}},allocations,
  connect:async()=>{connects++;throw Error('MUST_NOT_CONNECT');}});
 await assert.rejects(mounted.inspection.inspect(DECLARATION,BYTES,{deadlineMs:Date.now()+2000,
  custodyContext:{record:t.record,current:await t.current(),assertCurrent:t.current}}),e=>e?.code==='NATIVE_HOST_ALLOCATION_REFUSED');
 assert.equal(connects,0);
});

test('WRONG PURPOSE: a browser-only target is refused with zero connects',async()=>{
 let connects=0;const t=conversation(3);
 const allocations={async resolve(){return {allocation:{...t.allocation,hostMode:'browser-only'},hostIdentity:t.hostIdentity,
  endpoint:t.endpoint,ownerInstanceId:uuid(9),recordSha256:'e'.repeat(64),expiresAtMs:Date.now()+30000};}};
 const mounted=await mountUploadNativeControl({credentialPaths:INVENTORY,configuration:{uploads:{native:compiled}},allocations,
  connect:async()=>{connects++;throw Error('MUST_NOT_CONNECT');}});
 await assert.rejects(mounted.inspection.inspect(DECLARATION,BYTES,{deadlineMs:Date.now()+2000,
  custodyContext:{record:t.record,current:await t.current(),assertCurrent:t.current}}),e=>e?.code==='NATIVE_HOST_ALLOCATION_REFUSED');
 assert.equal(connects,0);
});

test('ABSENT DEPENDENCY: no allocations port means the native host is unavailable',async()=>{
 const mounted=await mountUploadNativeControl({credentialPaths:INVENTORY,configuration:{uploads:{native:compiled}}});
 assert.deepEqual([...mounted.missing],['uploads.native.allocations']);
 assert.equal(mounted.inspection??null,null);
});

test('FRESH EXPIRY: the derived transport signal aborts when the owner authority expires',async()=>{
 const t=conversation(3);let forwarded,release;
 const allocations={async resolve(){return {allocation:t.allocation,hostIdentity:t.hostIdentity,endpoint:t.endpoint,
  ownerInstanceId:uuid(9),recordSha256:'e'.repeat(64),expiresAtMs:Date.now()+30000};}};
 const mounted=await mountUploadNativeControl({credentialPaths:INVENTORY,configuration:{uploads:{native:compiled}},allocations,
  connect:async options=>{forwarded=options.signal;return {close:async()=>({closed:true}),
   send:()=>new Promise(resolve=>{release=resolve;})};}});
 const expires=Date.now()+120;
 const error=await mounted.inspection.inspect(DECLARATION,BYTES,{deadlineMs:Date.now()+5000,
  custodyContext:{record:t.record,current:{...await t.current(),expiresAtMs:expires},
   assertCurrent:async()=>({...await t.current(),expiresAtMs:expires})}}).then(v=>({v}),e=>({e}));
 assert.equal(error.e?.code,'UPLOAD_INSPECTION_CANCELLED');
 assert.equal(forwarded?.aborted,true,'the transport signal observed the fresh custody expiry, not the caller deadline');
 release?.({status:500,body:'{}'});
});

test('HELD LOOKUP + FRESH EXPIRY: lookup signal aborts before the caller deadline and the late target never connects',async()=>{
 const t=conversation(3);let capturedSignal,release,connects=0;
 const expires=Date.now()+120;
 const allocations={async resolve({signal}){capturedSignal=signal;return new Promise(resolve=>{release=resolve;});}};
 const mounted=await mountUploadNativeControl({credentialPaths:INVENTORY,configuration:{uploads:{native:compiled}},allocations,
  connect:async()=>{connects++;throw Error('MUST_NOT_CONNECT');}});
 const pending=mounted.inspection.inspect(DECLARATION,BYTES,{deadlineMs:Date.now()+5000,
  custodyContext:{record:t.record,current:{...await t.current(),expiresAtMs:expires},
   assertCurrent:async()=>({...await t.current(),expiresAtMs:expires})}}).then(v=>({v}),e=>({e}));
 const error=await pending;
 assert.equal(error.e?.code,'UPLOAD_INSPECTION_CANCELLED');
 assert.equal(capturedSignal?.aborted,true,'the lookup signal aborted at the fresh expiry, before the caller deadline');
 release({allocation:t.allocation,hostIdentity:t.hostIdentity,endpoint:t.endpoint,ownerInstanceId:uuid(9),
  recordSha256:'e'.repeat(64),expiresAtMs:Date.now()+30000});
 await new Promise(r=>setTimeout(r,20));
 assert.equal(connects,0,'the late target is never connected');
});
