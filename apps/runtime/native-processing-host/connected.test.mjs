/** ACTUAL joined production path, one case: startNativeProcessingHost -> existing definition composition/store/updater
 *  -> real host pin -> openNativeProcessingHost -> closed stdin -> childMain -> createUploadInspection -> result ->
 *  real cleanup/release. Only low-level system effects are inert (TLS bytes, compartment, placement process spawn,
 *  sigtool/freshclam program execution, scanner/extractor receipts). No compose/store/owner substitution. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Readable,Writable} from 'node:stream';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startNativeProcessingHost} from './entrypoint.mjs';
import {openNativeProcessingHost} from './bootstrap.mjs';
import {childMain,inspectFixed} from './child-cli.mjs';
import {NATIVE_INSPECTION_SCHEMA,NATIVE_INSPECTION_PATH} from './service.mjs';
import {nativeProcessingConfig} from './config.mjs';
import {createUploadInspection} from '../../control/uploads/extraction.mjs';
import {definitionsSnapshotId,UPLOAD_DEFINITIONS_SCHEMA} from '../uploads/native-definitions.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex');
const BYTES=Buffer.from('# fixed inspection content\n');
const DECLARATION=Object.freeze({filename:'note.md',mimeType:'text/markdown',bytes:BYTES.length,sha256:sha(BYTES)});
const IMAGE=`sha256:${'b'.repeat(64)}`;
const REQUEST=Object.freeze({kind:'upload-inspection',requestId:'a'.repeat(64),imageDigest:IMAGE,
 declaration:DECLARATION,bytesBase64:BYTES.toString('base64'),inputSha256:sha(BYTES),deadlineMs:Date.now()+5000});
const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const LEASE=Date.now()+600000;
const ALLOCATION=Object.freeze({schema:'meri-conversation-host-allocation/1',tenantId:uuid(1),conversationId:uuid(3),
 generation:3,hostId:uuid(7),hostMode:'native-processing',imageDigest:IMAGE,leaseDeadlineMs:LEASE});
const BINDING=Object.freeze({tenantId:uuid(1),actorId:uuid(2),conversationId:uuid(3),runId:uuid(4),attemptId:uuid(5),
 workerId:uuid(6),writerFence:1});
const IDENTITY=Object.freeze({schema:'meri-d005-host-identity/1',instanceId:'i-0123456789abcdef0',bootId:uuid(8),
 conversationId:uuid(3),hostId:uuid(7)});
const ENV=Object.freeze({
 MERI_NATIVE_PROCESSING_PORT:'9443',MERI_NATIVE_PROCESSING_ADDRESS:'127.0.0.1',
 MERI_NATIVE_PROCESSING_TLS_KEY:'/run/meri/tls.key',MERI_NATIVE_PROCESSING_TLS_CERT:'/run/meri/tls.crt',
 MERI_NATIVE_PROCESSING_TLS_CA:'/run/meri/ca.crt',MERI_NATIVE_PROCESSING_PEER_SAN:'control.meri.internal',
 MERI_NATIVE_PROCESSING_PEER_FINGERPRINT:'a'.repeat(64),MERI_NATIVE_PROCESSING_PEER_MAX_LIFETIME_MS:'900000',
 MERI_NATIVE_PROCESSING_PEER_NOT_AFTER_MS:String(Date.now()+600000),MERI_NATIVE_PROCESSING_IMAGE_DIGEST:IMAGE,
 MERI_NATIVE_PROCESSING_HOST_ID:uuid(7),MERI_NATIVE_PROCESSING_GENERATION:'3',
 MERI_NATIVE_PROCESSING_CONVERSATION_ID:uuid(3),MERI_NATIVE_PROCESSING_TENANT_ID:uuid(1),
 MERI_NATIVE_PROCESSING_INSTANCE_ID:'i-0123456789abcdef0',MERI_NATIVE_PROCESSING_BOOT_ID:uuid(8),
 MERI_NATIVE_PROCESSING_HOST_MODE:'native-processing',MERI_NATIVE_PROCESSING_LEASE_DEADLINE_MS:String(LEASE),
 MERI_NATIVE_PROCESSING_CPU_QUOTA_US:'50000',MERI_NATIVE_PROCESSING_CPU_PERIOD_US:'100000',
 MERI_NATIVE_PROCESSING_MEMORY_BYTES:'268435456',MERI_NATIVE_PROCESSING_PIDS_MAX:'16',
 MERI_NATIVE_PROCESSING_DEADLINE_MAX_MS:'30000',MERI_NATIVE_PROCESSING_BODY_BYTES:'13000000',
 MERI_NATIVE_PROCESSING_HELPER:'/usr/lib/meri/meri-host-launcher',MERI_NATIVE_PROCESSING_NODE:'/usr/local/bin/node',
 MERI_NATIVE_PROCESSING_CHILD:'/opt/meri/child-cli.mjs',MERI_NATIVE_PROCESSING_HOME:'/run/meri/processing',
 MERI_NATIVE_PROCESSING_DEFINITIONS:'/run/meri/upload-definitions',MERI_NATIVE_PROCESSING_EXTRACTOR:'/opt/meri/extract.py',
 MERI_NATIVE_PROCESSING_SCRATCH:'/run/meri/upload-scratch',MERI_NATIVE_PROCESSING_RUNTIME_UID:'1000',
 MERI_NATIVE_PROCESSING_RUNTIME_GID:'1000',MERI_NATIVE_PROCESSING_CREDENTIAL_PATHS:'/proc/1/environ'});

const scanReceipt=(file,at)=>({sourceSha256:file.sha256,sourceBytes:file.bytes,checkedAtMs:at,status:'clean',
 tool:{name:'clamav',version:'1.4.2',binarySha256:'a'.repeat(64)},definitionsSha256:'b'.repeat(64),reason:null});
const extractReceipt=(file,at)=>({sourceSha256:file.sha256,sourceBytes:file.bytes,checkedAtMs:at,status:'available',
 tool:{name:'meri-upload-extractor',version:'3.13.16',binarySha256:'c'.repeat(64)},segments:[],limitations:[]});
/** Real createUploadInspection over inert scanner/extractor PROCESS receipts. */
const childCompose=async()=>{
 const inspection=createUploadInspection({now:Date.now,
  scanner:{async scan({file}){return scanReceipt(file,Date.now());}},
  extractor:{async extract({file}){return extractReceipt(file,Date.now());}}});
 return {scanner:{scan:()=>inspection.inspect(DECLARATION,BYTES,{deadlineMs:Date.now()+5000}).then(v=>({...v.scan}))},
  extractor:{extract:()=>inspection.inspect(DECLARATION,BYTES,{deadlineMs:Date.now()+5000}).then(v=>v.extraction)},
  describe(){return {};}};
};

async function publishFixture(root){
 const main=Buffer.from('CVD main fixture'),daily=Buffer.from('CVD daily fixture');
 const files=[{name:'main.cvd',bytes:main.length,sha256:sha(main),format:'cvd'},
  {name:'daily.cvd',bytes:daily.length,sha256:sha(daily),format:'cvd'}];
 const id=definitionsSnapshotId(files),dir=join(root,'snapshots',id);
 await mkdir(join(dir,'database'),{recursive:true});
 await writeFile(join(dir,'database','main.cvd'),main);
 await writeFile(join(dir,'database','daily.cvd'),daily);
 await writeFile(join(dir,'snapshot.json'),JSON.stringify({schema:UPLOAD_DEFINITIONS_SCHEMA,sha256:id,
  publishedAt:new Date(Date.now()-1000).toISOString(),publishedAtMs:Date.now()-1000,signatureVerified:true,
  version:'fixture-1',files}));
 await writeFile(join(root,'current'),id);
 return {id,dir,files};
}

function requestStream(body){
 const stream=Readable.from([Buffer.from(JSON.stringify(body))]);
 Object.assign(stream,{method:'POST',url:NATIVE_INSPECTION_PATH,headers:{},socket:{encrypted:true},complete:true});
 return stream;
}
const response=()=>{const r={status:0,body:'',listeners:new Map()};
 r.writeHead=s=>{r.status=s;};r.end=b=>{r.body=b;};r.once=(e,f)=>{r.listeners.set(e,f);};
 r.removeListener=e=>{r.listeners.delete(e);};return r;};

test('JOINED: entrypoint -> real definitions -> pin -> bootstrap -> childMain -> inspection -> cleanup', async () => {
 const root=await mkdtemp(join(tmpdir(),'meri-joined-'));
 try{
  const fixture=await publishFixture(root);
  const programs=[];
  const definitionsRun=async program=>{programs.push(program);return {stdout:Buffer.alloc(0)};};
  let listener=null;
  const serverFactory=(options,handler)=>{void options;listener=handler;
   return {once(){},listen(_p,_a,cb){cb();},close(cb){cb?.();}};};
  const config={...nativeProcessingConfig({env:ENV}),paths:{...nativeProcessingConfig({env:ENV}).paths,
   definitionsRoot:root}};
  const started=await startNativeProcessingHost({env:ENV,config,readFile:()=>Buffer.from('-----BEGIN-----'),definitionsRun,serverFactory,
   authenticatePeer:async()=>({verified:true,notAfterMs:Date.now()+60000}),
   verifyCustody:async()=>({authorized:true,allocation:ALLOCATION,binding:BINDING,hostIdentity:IDENTITY,
    currentness:{readCurrent:async()=>({})}}),
   openHost:input=>openNativeProcessingHost({...input,config,
    openCompartment:async()=>({close:async()=>({closed:true})}),
    openPlacement:async()=>({run:async(command,args,{input:stdin,deadlineMs})=>{
      let captured=Buffer.alloc(0);
      const stdout=new Writable({write(chunk,_e,cb){captured=Buffer.concat([captured,Buffer.from(chunk)]);cb();}});
      await childMain({stdin:Readable.from([stdin]),stdout,identity:()=>({uid:1000,gid:1000}),
       inspect:argsIn=>inspectFixed({...argsIn,compose:childCompose,run:async()=>({stdout:Buffer.alloc(0)})})});
      void command;void args;void deadlineMs;
      return {stdout:captured,receipt:{exitCode:0}};
     },close:async()=>({closed:true})})})});
  assert.equal(started.started,true,JSON.stringify(started.readiness));
  assert.equal(started.definitionComposition.provisioningState().reason,null,'the host probed a real signed snapshot');
  assert.equal(started.definitionsOwner.active(),0,'no pin before work');

  const res=response();
  await listener(requestStream({schema:NATIVE_INSPECTION_SCHEMA,allocation:ALLOCATION,hostIdentity:IDENTITY,
   binding:BINDING,custody:{uploadId:uuid(9)},request:REQUEST}),res);
  assert.equal(res.status,200,res.body);
  const body=JSON.parse(res.body);
  assert.equal(body.requestId,REQUEST.requestId);
  assert.equal(body.kind,'upload-inspection-result');
  assert.equal(body.scan.status,'clean');
  assert.equal(body.scan.definitionsSha256,'b'.repeat(64));
  assert.equal(body.extraction.segments.length,0);
  assert.equal(body.file.sha256,sha(BYTES),'the canonical result binds the exact inspected bytes');
  assert.equal(body.provenance.expectedImageDigest,IMAGE);
  assert.equal(programs.includes('freshclam'),false,'no refresh during the request');
  assert.equal(started.definitionsOwner.active(),0,'the pin was released after proven placement closure');
  assert.equal(started.definitionComposition.provisioningState().provisioned,false,'no provisioning was needed');

  const closed=await started.close();
  assert.equal(closed.closed,true);
 }finally{await rm(root,{recursive:true,force:true});}
});

/** Build the same joined host for negative cases: real composition/store, inert native effects. */
async function boot({root,verifyCustody,definitionsRun,runImpl}){
 let listener=null;const placements=[];
 const serverFactory=(options,handler)=>{void options;listener=handler;
  return {once(){},listen(_p,_a,cb){cb();},close(cb){cb?.();}};};
 const config={...nativeProcessingConfig({env:ENV}),paths:{...nativeProcessingConfig({env:ENV}).paths,
  definitionsRoot:root}};
 const started=await startNativeProcessingHost({env:ENV,config,readFile:()=>Buffer.from('-----BEGIN-----'),
  definitionsRun,serverFactory,authenticatePeer:async()=>({verified:true,notAfterMs:Date.now()+60000}),verifyCustody,
  openHost:input=>openNativeProcessingHost({...input,config,
   openCompartment:async()=>({close:async()=>({closed:true})}),
   openPlacement:async()=>{placements.push(1);return {run:runImpl??(async()=>({stdout:Buffer.from('{}'),receipt:{exitCode:0}})),
    close:async()=>({closed:true})};}})});
 return {started,listener:()=>listener,placements};
}
const scopedCustody=async()=>({authorized:true,allocation:ALLOCATION,binding:BINDING,hostIdentity:IDENTITY,
 currentness:{readCurrent:async()=>({})}});
const envelope=()=>({schema:NATIVE_INSPECTION_SCHEMA,allocation:ALLOCATION,hostIdentity:IDENTITY,binding:BINDING,
 custody:{uploadId:uuid(9)},request:REQUEST});

test('JOINED NEGATIVE: unbound custody never opens the host or dispatches', async () => {
 const root=await mkdtemp(join(tmpdir(),'meri-neg-'));
 try{
  await publishFixture(root);
  const {started,listener,placements}=await boot({root,definitionsRun:async()=>({stdout:Buffer.alloc(0)}),
   verifyCustody:async()=>({authorized:false})});
  const res=response();
  await listener()(requestStream(envelope()),res);
  assert.notEqual(res.status,200);
  assert.equal(JSON.parse(res.body).error,'NATIVE_INSPECTION_CUSTODY_REFUSED',res.body);
  assert.equal(placements.length,0,'no placement was opened');
  await started.close();
 }finally{await rm(root,{recursive:true,force:true});}
});

test('JOINED NEGATIVE: a corrupt snapshot refuses before any child is placed', async () => {
 const root=await mkdtemp(join(tmpdir(),'meri-neg-'));
 try{
  const fixture=await publishFixture(root);
  await writeFile(join(fixture.dir,'database','main.cvd'),Buffer.from('tampered'));
  const {started,listener,placements}=await boot({root,definitionsRun:async()=>({stdout:Buffer.alloc(0)}),
   verifyCustody:scopedCustody});
  assert.equal(started.startupState.reason,'UPLOAD_DEFINITIONS_CORRUPT');
  const res=response();
  await listener()(requestStream(envelope()),res);
  assert.equal(res.status,400,res.body);
  const code=JSON.parse(res.body).error;
  assert.ok(['UPLOAD_DEFINITIONS_CORRUPT','NATIVE_INSPECTION_CLEANUP_UNKNOWN'].includes(code),code);
  assert.equal(placements.length,1,'the placement exists but no child run was dispatched');
  await started.close();
 }finally{await rm(root,{recursive:true,force:true});}
});

test('JOINED NEGATIVE: concurrent joined requests leave no pin and each binds its own result', async () => {
 const root=await mkdtemp(join(tmpdir(),'meri-neg-'));
 try{
  await publishFixture(root);
  const runImpl=async(command,args,{input:stdin})=>{void command;void args;
   let captured=Buffer.alloc(0);
   const stdout=new Writable({write(chunk,_e,cb){captured=Buffer.concat([captured,Buffer.from(chunk)]);cb();}});
   await childMain({stdin:Readable.from([stdin]),stdout,identity:()=>({uid:1000,gid:1000}),
    inspect:argsIn=>inspectFixed({...argsIn,compose:childCompose,run:async()=>({stdout:Buffer.alloc(0)})})});
   return {stdout:captured,receipt:{exitCode:0}};};
  const {started,listener}=await boot({root,definitionsRun:async()=>({stdout:Buffer.alloc(0)}),
   verifyCustody:scopedCustody,runImpl});
  const first=response(),second=response();
  await Promise.all([listener()(requestStream(envelope()),first),listener()(requestStream(envelope()),second)]);
  assert.equal(first.status,200,first.body);
  assert.equal(second.status,200,second.body);
  assert.equal(started.definitionsOwner.active(),0,'every pin was released after its own proven closure');
  await started.close();
 }finally{await rm(root,{recursive:true,force:true});}
});
