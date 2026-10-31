/** High-level native upload client: owned acquisition/read/cleanup, custody-bounded deadline (inert transport). */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createNativeHostInspectionClient} from '../native-host-client.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex');
const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const BYTES=Buffer.from('native upload exact bytes\n');
const DECL={filename:'note.txt',mimeType:'text/plain',bytes:BYTES.length,sha256:sha(BYTES)};
const IMAGE=`sha256:${'b'.repeat(64)}`;
const LEASE=Date.now()+600000;
const BINDING={tenantId:uuid(1),actorId:uuid(2),conversationId:uuid(3),runId:uuid(4),attemptId:uuid(5),workerId:uuid(6),writerFence:1};
const SCOPES=[{tenantId:BINDING.tenantId,kind:'private-user',resourceId:BINDING.actorId,policyRevision:'p1'}];
const ALLOCATION={schema:'meri-conversation-host-allocation/1',tenantId:BINDING.tenantId,conversationId:BINDING.conversationId,
 generation:3,hostId:uuid(7),hostMode:'native-processing',imageDigest:IMAGE,leaseDeadlineMs:LEASE};
const IDENTITY={schema:'meri-d005-host-identity/1',hostId:uuid(7),conversationId:BINDING.conversationId,
 instanceId:'i-0123456789abcdef0',bootId:uuid(8)};
const RECORD={uploadId:uuid(20),requestId:uuid(21),
 owner:{tenantId:BINDING.tenantId,actorId:BINDING.actorId,conversationId:BINDING.conversationId,clientId:null},
 declaration:DECL,scopes:SCOPES,objectId:uuid(22),
 object:{objectId:uuid(22),versionId:'V',sha256:DECL.sha256,bytes:DECL.bytes,scopes:SCOPES},
 state:'stored',inspection:null,createdAtMs:Date.now()-1000,updatedAtMs:Date.now()-1000,revision:2};
const current=(expires=Date.now()+60000)=>({binding:{...BINDING},scopes:SCOPES.map(s=>({...s})),selectedClientId:null,
 checkedAtMs:Date.now()-10,expiresAtMs:expires});
const endpoint={address:'10.1.2.3',port:9443,serverName:'native.internal',serverFingerprintSha256:'c'.repeat(64)};
const build=(connect,extra={})=>createNativeHostInspectionClient({endpoint,allocation:ALLOCATION,hostIdentity:IDENTITY,
 binding:BINDING,imageDigest:IMAGE,now:Date.now,maxRequestMs:3000,connect,...extra});
const custodyContext=(expires)=>({record:RECORD,current:current(expires),assertCurrent:async()=>current(expires)});

test('LIFECYCLE: the fresh custody expiry narrows the deadline handed to connect',async()=>{
 let seen;
 const expires=Date.now()+150;
 const client=build(async options=>{seen=options;return {send:async()=>({status:500,body:Buffer.from('{"error":"X"}')}),
  close:async()=>({closed:true})};});
 await assert.rejects(client.inspect(DECL,BYTES,{deadlineMs:Date.now()+5000,custodyContext:custodyContext(expires)}));
 assert.equal(seen.deadlineMs<=expires,true,'connect deadline is clamped to the fresh custody expiry');
});

test('LIFECYCLE: a held acquisition returns cleanup-unknown boundedly and closes the late client once',async()=>{
 let release,closes=0;
 const client=build(()=>new Promise(resolve=>{release=resolve;}));
 const controller=new AbortController();
 const pending=client.inspect(DECL,BYTES,{deadlineMs:Date.now()+50,signal:controller.signal,
  custodyContext:custodyContext()});
 const error=await pending.then(value=>({value}),error=>({error}));
 assert.equal(error.error?.code,'UPLOAD_INSPECTION_CLEANUP_UNKNOWN');
 release({send:async()=>{throw Error('MUST_NOT_DISPATCH');},close:async()=>{closes++;return {closed:true};}});
 await new Promise(resolve=>setTimeout(resolve,20));
 assert.equal(closes,1,'the late client is closed exactly once');
});

test('LIFECYCLE: a negative or missing close acknowledgement is never success',async()=>{
 for(const ack of [false,null,{closed:false},undefined]){
  const client=build(async()=>({send:async()=>({status:200,body:Buffer.from('{}')}),close:async()=>ack}));
  await assert.rejects(client.inspect(DECL,BYTES,{deadlineMs:Date.now()+2000,custodyContext:custodyContext()}),
   e=>e?.code==='UPLOAD_INSPECTION_CLEANUP_UNKNOWN');
 }
});

test('LIFECYCLE: a CHANGED fresh authority against the original pinned current is refused',async()=>{
 const original=current();
 const changed={...original,scopes:[{...SCOPES[0],policyRevision:'p2'}]};
 const client=build(async()=>({send:async()=>({status:200,body:Buffer.from('{}')}),close:async()=>({closed:true})}));
 await assert.rejects(client.inspect(DECL,BYTES,{deadlineMs:Date.now()+2000,
  custodyContext:{record:RECORD,current:original,assertCurrent:async()=>changed}}),
  e=>e?.code==='UPLOAD_AUTHORITY_CHANGED');
});
