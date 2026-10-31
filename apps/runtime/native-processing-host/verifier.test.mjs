/** ACTUAL host verifier: canonical native allocation/binding/identity + saved upload custody + existing current authority.
 *  External effects are inert (a recording native currentness client); no native, DB or network action. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createNativeProcessingVerifier} from './verifier.mjs';
import {nativeUploadCustody} from '../uploads/native-host-contract.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const BYTES=Buffer.from('native verifier exact bytes\n');
const DECLARATION={filename:'note.txt',mimeType:'text/plain',bytes:BYTES.length,sha256:sha(BYTES)};
const IMAGE=`sha256:${'b'.repeat(64)}`;
const LEASE=Date.now()+600000;
const BINDING={tenantId:uuid(1),actorId:uuid(2),conversationId:uuid(3),runId:uuid(4),attemptId:uuid(5),workerId:uuid(6),
 writerFence:1};
const SCOPES=[{tenantId:BINDING.tenantId,kind:'private-user',resourceId:BINDING.actorId,policyRevision:'p1'}];
const RECORD={uploadId:uuid(20),requestId:uuid(21),
 owner:{tenantId:BINDING.tenantId,actorId:BINDING.actorId,conversationId:BINDING.conversationId,clientId:null},
 declaration:DECLARATION,scopes:SCOPES,objectId:uuid(22),
 object:{objectId:uuid(22),versionId:'V',sha256:DECLARATION.sha256,bytes:DECLARATION.bytes,scopes:SCOPES},
 state:'stored',inspection:null,createdAtMs:Date.now()-1000,updatedAtMs:Date.now()-1000,revision:2};
const CUSTODY=nativeUploadCustody(RECORD,{binding:BINDING,scopes:SCOPES,selectedClientId:null,
 checkedAtMs:Date.now()-500,expiresAtMs:LEASE});
const ALLOCATION={schema:'meri-conversation-host-allocation/1',tenantId:BINDING.tenantId,
 conversationId:BINDING.conversationId,generation:3,hostId:uuid(7),hostMode:'native-processing',
 imageDigest:IMAGE,leaseDeadlineMs:LEASE};
const IDENTITY={schema:'meri-d005-host-identity/1',hostId:uuid(7),conversationId:BINDING.conversationId,
 instanceId:'i-0123456789abcdef0',bootId:uuid(8)};
const PEER={verified:true,notAfterMs:Date.now()+60000,fingerprintSha256:'a'.repeat(64)};
const REQUEST={kind:'upload-inspection',requestId:'a'.repeat(64),imageDigest:IMAGE,declaration:DECLARATION,
 bytesBase64:BYTES.toString('base64'),inputSha256:sha(BYTES),deadlineMs:Date.now()+5000};
const NOW=()=>Date.now();
// Any canonical refusal of a non-active/stale/foreign receipt is acceptable; it must never admit.
const REFUSED_CODES=new Set(['NATIVE_INSPECTION_CUSTODY_REFUSED','HOST_CURRENTNESS_REFUSED','HOST_CURRENTNESS_EXPIRED']);
const POLICY='f'.repeat(64);

// The EXACT closed six-field receipt the canonical native guard accepts; nothing else is returned.
const receiptFor=(until=Date.now()+30000,overrides={})=>({allocation:ALLOCATION,binding:BINDING,policySha256:POLICY,
 phase:'active',checkedAtMs:Date.now(),currentUntilMs:until,...overrides});
function verifier({current,policy=POLICY}={}){
 const calls=[];const closes=[];
 const createClient=async({allocation,binding,hostIdentity})=>{
  calls.push({allocation,binding,hostIdentity});
  return Object.freeze({async readNativeCurrentness(args){
    calls.push(args);
    if(current===false)throw Object.assign(Error('NATIVE_INSPECTION_CUSTODY_REFUSED'),{code:'NATIVE_INSPECTION_CUSTODY_REFUSED'});
    return current??receiptFor();
   },async close(){closes.push(true);return {closed:true};}});
 };
 return {calls,closes,verify:createNativeProcessingVerifier({createClient,now:NOW,policySha256:policy})};
}
const input=(overrides={})=>({allocation:ALLOCATION,binding:BINDING,hostIdentity:IDENTITY,custody:CUSTODY,
 request:REQUEST,peer:PEER,deadlineMs:Date.now()+2000,...overrides});

test('ACCEPTED: canonical allocation/binding/identity + real custody + current authority yield a bounded authority port', async () => {
 const {calls,closes,verify}=verifier();
 const granted=await verify(input());
 assert.equal(granted.authorized,true);
 assert.equal(granted.allocation.hostMode,'native-processing');
 assert.equal(granted.binding.runId,BINDING.runId);
 assert.equal(granted.currentUntilMs<=granted.allocation.leaseDeadlineMs,true);
 assert.equal(calls.filter(c=>c.allocation).length,1,'exactly one authenticated native currentness client was created');
 assert.equal(calls.at(-1).declaration.sha256,DECLARATION.sha256);
 assert.equal(calls.at(-1).policySha256,POLICY);
 assert.equal(calls.at(-1).deadlineMs<=granted.allocation.leaseDeadlineMs,true,'the transport deadline is bounded');
 const current=await granted.currentness.readCurrent();
 assert.deepEqual(Object.keys(current).sort(),['allocation','binding','checkedAtMs','currentUntilMs','phase','policySha256'],
  'the port returns the EXACT closed six-field receipt');
 assert.equal(current.policySha256,POLICY);
 assert.equal(closes.length,2,'each fresh read closes its client');
 assert.equal(calls.filter(c=>c.allocation).length,2,'the authority port RE-READS instead of returning a cached grant');
 assert.equal(Number.isSafeInteger(current.checkedAtMs),true,'checkedAtMs comes from the receipt');
 assert.equal(current.checkedAtMs<=Date.now(),true,'and is a real observation, not a future synthesis');
});

const refusals=[
 ['unverified peer',{peer:{...PEER,verified:false}}, 'NATIVE_INSPECTION_PEER'],
 ['expired peer certificate',{peer:{...PEER,notAfterMs:Date.now()-1}},'NATIVE_INSPECTION_PEER'],
 ['foreign binding actor',{binding:{...BINDING,actorId:uuid(99)}},'NATIVE_UPLOAD_INSPECTION_REFUSED'],
 ['declaration bytes mismatch',{request:{...REQUEST,declaration:{...DECLARATION,bytes:DECLARATION.bytes+1}}},
  'NATIVE_UPLOAD_INSPECTION_REFUSED'],
 ['foreign identity',{hostIdentity:{...IDENTITY,hostId:uuid(98)}},'HOST_IDENTITY_REFUSED'],
 ['browser-mode allocation',{allocation:{...ALLOCATION,hostMode:'browser-only'}},'HOST_BINDING_REFUSED'],
 ['expired lease',{allocation:{...ALLOCATION,leaseDeadlineMs:Date.now()-1}},'NATIVE_PROCESSING_ALLOCATION_REFUSED'],
 ['image mismatch',{request:{...REQUEST,imageDigest:`sha256:${'c'.repeat(64)}`}},'NATIVE_INSPECTION_CUSTODY_REFUSED'],
];
for(const [name,overrides,code] of refusals){
 test(`REFUSED: ${name}`, async () => {
  const {verify}=verifier();
  await assert.rejects(verify(input(overrides)),error=>error?.code===code,`${name} -> ${code}`);
 });
}

test('REFUSED: a revoked or stale saved-upload current decision never admits', async () => {
 await assert.rejects(verifier({current:false}).verify(input()),e=>REFUSED_CODES.has(e?.code));
 await assert.rejects(verifier({current:receiptFor(Date.now()+5000,{phase:'revoked'})}).verify(input()),
  e=>REFUSED_CODES.has(e?.code));
 await assert.rejects(verifier({current:receiptFor(Date.now()-1)}).verify(input()),
  e=>REFUSED_CODES.has(e?.code));
 // A grant that expires BEFORE use is refused by the port, even though admission succeeded.
 const late=verifier({current:receiptFor(Date.now()+5),policy:POLICY});
 const granted=await late.verify(input());
 await new Promise(resolve=>setTimeout(resolve,20));
 await assert.rejects(granted.readCurrent(),e=>REFUSED_CODES.has(e?.code));
});

test('REFUSED: a tampered custody projection (foreign saved object) never admits', async () => {
 const {verify}=verifier();
 await assert.rejects(verify(input({custody:{...CUSTODY,sha256:'e'.repeat(64)}})),
  e=>e?.code==='NATIVE_UPLOAD_INSPECTION_REFUSED');
 await assert.rejects(verify(input({custody:{...CUSTODY,owner:{...CUSTODY.owner,actorId:uuid(97)}}})),
  e=>e?.code==='NATIVE_UPLOAD_INSPECTION_REFUSED');
});

test('REFUSED: an already-expired deadline or an already-aborted signal never admits', async () => {
 const {verify}=verifier();
 await assert.rejects(verify(input({deadlineMs:Date.now()-1})),e=>e?.code==='NATIVE_PROCESSING_CANCELLED');
 const controller=new AbortController();controller.abort();
 await assert.rejects(verify(input({signal:controller.signal})),e=>e?.code==='NATIVE_PROCESSING_CANCELLED');
});

test('REFUSED: a configuration without a canonical policy hash cannot supervise native work', async () => {
 await assert.rejects(async()=>verifier({policy:'not-a-hash'}).verify(input()),
  e=>e?.code==='NATIVE_PROCESSING_VERIFIER_CONFIGURATION');
});

test('BOUNDED: a read that never settles is refused at the operation deadline, not awaited forever', async()=>{
 const closed=[];let release;
 const client={readNativeCurrentness:()=>new Promise(()=>{}),close:async()=>({closed:true,count:closed.push(true)})};
 const verify=createNativeProcessingVerifier({createClient:()=>({...client}),now:NOW,policySha256:POLICY});
 const started=Date.now();
 await assert.rejects(verify(input({deadlineMs:Date.now()+60})),
  e=>e?.code==='NATIVE_PROCESSING_CANCELLED');
 assert.equal(Date.now()-started<500,true,'bounded by the operation deadline');
 assert.equal(closed.length,1,'the acquired client is still closed');
});

test('BOUNDED: an acquisition that settles late is closed and never dispatches', async()=>{
 const closed=[];let acquire;
 const verify=createNativeProcessingVerifier({now:NOW,policySha256:POLICY,createClient:()=>new Promise(resolve=>{
  acquire=()=>resolve({readNativeCurrentness:async()=>{throw Error('MUST_NOT_DISPATCH');},close:async()=>({closed:true,count:closed.push(true)})});
 })});
 // The acquisition never settles inside the operation: cleanup cannot be established, so this is CLEANUP_UNKNOWN.
 await assert.rejects(verify(input({deadlineMs:Date.now()+50})),e=>e?.code==='NATIVE_PROCESSING_CLEANUP_UNKNOWN');
 acquire();                                          // the late client arrives AFTER the bounded refusal
 await new Promise(resolve=>setTimeout(resolve,10));
 assert.equal(closed.length,1,'the late acquired client is closed');
});

test('BOUNDED: cleanup failure is surfaced as unknown, never hidden by authorization', async()=>{
 const verify=createNativeProcessingVerifier({now:NOW,policySha256:POLICY,
  createClient:()=>({readNativeCurrentness:async()=>receiptFor(),close:()=>new Promise(()=>{})})});
 await assert.rejects(verify(input()),e=>e?.code==='NATIVE_PROCESSING_CLEANUP_UNKNOWN');
});

test('BOUNDED: an aborted operation during a pending read is refused and the client closed', async()=>{
 const closed=[];const controller=new AbortController();
 const verify=createNativeProcessingVerifier({now:NOW,policySha256:POLICY,
  createClient:()=>({readNativeCurrentness:({signal})=>new Promise((_,reject)=>{
   signal?.addEventListener('abort',()=>reject(faultOfCancel()),{once:true});}),close:async()=>({closed:true,count:closed.push(true)})})});
 const faultOfCancel=()=>Object.assign(Error('NATIVE_PROCESSING_CANCELLED'),{code:'NATIVE_PROCESSING_CANCELLED'});
 const pending=verify(input({signal:controller.signal,deadlineMs:Date.now()+5000}));
 setTimeout(()=>controller.abort(),10);
 await assert.rejects(pending,e=>e?.code==='NATIVE_PROCESSING_CANCELLED');
 assert.equal(closed.length,1);
});

test('OWNED: a malformed acquired client is closed exactly once before the configuration refusal', async()=>{
 let closes=0;
 const verify=createNativeProcessingVerifier({now:NOW,policySha256:POLICY,createClient:()=>({close:async()=>({closed:true,count:closes++})})});
 await assert.rejects(verify(input()),e=>e?.code==='NATIVE_PROCESSING_VERIFIER_CONFIGURATION');
 assert.equal(closes,1);
});

test('OWNED: a synchronously throwing factory disposes the lifetime and refuses without native effects', async()=>{
 const verify=createNativeProcessingVerifier({now:NOW,policySha256:POLICY,createClient:()=>{throw Error('FACTORY_THROW');}});
 await assert.rejects(verify(input()),e=>e?.code==='NATIVE_PROCESSING_VERIFIER_CONFIGURATION');
});

test('OWNED: an explicitly negative close never authorizes', async()=>{
 for(const negative of [false,null,{closed:false}]){
  const verify=createNativeProcessingVerifier({now:NOW,policySha256:POLICY,
   createClient:()=>({readNativeCurrentness:async()=>receiptFor(),close:async()=>negative})});
  await assert.rejects(verify(input()),e=>e?.code==='NATIVE_PROCESSING_CLEANUP_UNKNOWN');
 }
});

test('OWNED: a rejecting late close is owned and never authorizes', async()=>{
 const unhandled=[];const onUnhandled=e=>unhandled.push(e?.code);
 process.on('unhandledRejection',onUnhandled);
 try{
  const verify=createNativeProcessingVerifier({now:NOW,policySha256:POLICY,createClient:()=>({
   readNativeCurrentness:async()=>receiptFor(),close:async()=>{throw Object.assign(Error('LATE'),{code:'LATE_CLOSE'});}})});
  await assert.rejects(verify(input()),e=>e?.code==='NATIVE_PROCESSING_CLEANUP_UNKNOWN');
  await new Promise(resolve=>setTimeout(resolve,10));
  assert.deepEqual(unhandled,[]);
 }finally{process.removeListener('unhandledRejection',onUnhandled);}
});

test('OWNED: the transport receives the DERIVED lifetime signal, aborted by the deadline', async()=>{
 let forwarded;let release;
 const verify=createNativeProcessingVerifier({now:NOW,policySha256:POLICY,createClient:()=>({
  readNativeCurrentness:({signal})=>{forwarded=signal;return new Promise(resolve=>{release=resolve;});},close:async()=>({closed:true})})});
 const result=await verify(input({deadlineMs:Date.now()+40})).then(value=>({value}),error=>({error}));
 assert.equal(forwarded.aborted,true,'the derived signal carries the bounded deadline');
 assert.equal(result.error?.code,'NATIVE_PROCESSING_CANCELLED');
 release(receiptFor());
});

test('OWNED: valid work longer than 5 s (inside its own deadline) still authorizes; cleanup still acked', async()=>{
 const verify=createNativeProcessingVerifier({now:NOW,policySha256:POLICY,createClient:()=>({
  readNativeCurrentness:()=>new Promise(resolve=>setTimeout(()=>resolve(receiptFor()),5300)),
  close:async()=>({closed:true})})});
 const granted=await verify(input({deadlineMs:Date.now()+9000}));
 assert.equal(granted.authorized,true);
});
