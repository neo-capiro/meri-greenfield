/** ACTUAL lifecycle connection: factored composition + beginUploadNativeProvisioning + real store/updater, local fixture
 *  CVD files, INERT program effects only. No injected composition/lifecycle object. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {startNativeProcessingHost} from './entrypoint.mjs';
import {nativeProcessingConfig} from './config.mjs';
import {createUploadDefinitionsComposition} from '../uploads/composition.mjs';
import {definitionsSnapshotId,UPLOAD_DEFINITIONS_SCHEMA} from '../uploads/native-definitions.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex');
const IMAGE=`sha256:${'b'.repeat(64)}`;
const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const LEASE=Date.now()+600000;
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
 MERI_NATIVE_PROCESSING_DEADLINE_MAX_MS:'2000',MERI_NATIVE_PROCESSING_BODY_BYTES:'1100000',
 MERI_NATIVE_PROCESSING_HELPER:'/usr/lib/meri/meri-host-launcher',MERI_NATIVE_PROCESSING_NODE:'/usr/local/bin/node',
 MERI_NATIVE_PROCESSING_CHILD:'/opt/meri/child-cli.mjs',MERI_NATIVE_PROCESSING_HOME:'/run/meri/processing',
 MERI_NATIVE_PROCESSING_DEFINITIONS:'/run/meri/upload-definitions',MERI_NATIVE_PROCESSING_EXTRACTOR:'/opt/meri/extract.py',
 MERI_NATIVE_PROCESSING_SCRATCH:'/run/meri/upload-scratch',MERI_NATIVE_PROCESSING_RUNTIME_UID:'1000',
 MERI_NATIVE_PROCESSING_RUNTIME_GID:'1000',MERI_NATIVE_PROCESSING_CREDENTIAL_PATHS:'/proc/1/environ'});
const configFor=root=>({...nativeProcessingConfig({env:ENV}),paths:{...nativeProcessingConfig({env:ENV}).paths,
 definitionsRoot:root}});
const serverFactory=()=>({once(){},listen(_p,_a,cb){cb();},close(cb){cb?.();}});
const readFile=()=>Buffer.from('x');
const hostArgs=(root,extra)=>Object.assign({env:ENV,config:configFor(root),verifyCustody:async()=>({authorized:true}),
 openHost:async()=>({}),serverFactory,readFile,authenticatePeer:async()=>({verified:true,notAfterMs:Date.now()+60000})},extra);

/** A REAL published snapshot layout the existing store verifies (sigtool effect inert). */
async function publishFixture(root){
 const main=Buffer.from('CVD main fixture'),daily=Buffer.from('CVD daily fixture');
 const files=[{name:'main.cvd',bytes:main.length,sha256:sha(main),format:'cvd'},
  {name:'daily.cvd',bytes:daily.length,sha256:sha(daily),format:'cvd'}];
 const id=definitionsSnapshotId(files);
 const dir=join(root,'snapshots',id);
 await mkdir(join(dir,'database'),{recursive:true});
 await writeFile(join(dir,'database','main.cvd'),main);
 await writeFile(join(dir,'database','daily.cvd'),daily);
 await writeFile(join(dir,'snapshot.json'),JSON.stringify({schema:UPLOAD_DEFINITIONS_SCHEMA,sha256:id,
  publishedAt:new Date(Date.now()-1000).toISOString(),publishedAtMs:Date.now()-1000,signatureVerified:true,
  version:'fixture-1',files}));
 await writeFile(join(root,'current'),id);
 return {id,dir,files};
}

test('STARTUP FRESH: the host probes the actual store and does not provision', async () => {
 const root=await mkdtemp(join(tmpdir(),'meri-life-'));
 try{
  const fixture=await publishFixture(root);
  const calls=[];
  const definitionsRun=async program=>{calls.push(program);return {stdout:Buffer.alloc(0)};};
  const started=await startNativeProcessingHost(hostArgs(root,{definitionsRun}));
  assert.equal(started.started,true,JSON.stringify(started.readiness));
  assert.equal(started.startupState.attempted,true,'the probe actually read the store');
  assert.equal(started.startupState.reason,null,'a valid snapshot is fresh');
  assert.equal(started.provisioning.started,false,'nothing to provision');
  assert.ok(calls.includes('sigtool'),'the store verified the fixture with the inert sigtool port');
  assert.equal(calls.includes('freshclam'),false,'no provisioning on a fresh root');
  const pin=await started.definitionsOwner.pin({deadlineMs:Date.now()+2000});
  assert.equal(pin.sha256,fixture.id,'the host owner pins the same exact snapshot');
  assert.equal(pin.databaseDirectory,join(fixture.dir,'database'));
  pin.release({completed:true});
  await started.close();
 }finally{await rm(root,{recursive:true,force:true});}
});

test('STARTUP UNAVAILABLE: one bounded updater attempt through the existing lifecycle', async () => {
 const root=await mkdtemp(join(tmpdir(),'meri-life-'));
 try{
  const calls=[];
  const definitionsRun=async program=>{calls.push(program);return {stdout:Buffer.alloc(0)};};
  const started=await startNativeProcessingHost(hostArgs(root,{definitionsRun}));
  assert.equal(started.startupState.attempted,true);
  assert.equal(started.startupState.reason,'UPLOAD_DEFINITIONS_UNAVAILABLE');
  assert.equal(started.provisioning.started,true,'the existing lifecycle started the attempt');
  await started.provisioning.completion;
  assert.ok(calls.filter(name=>name==='freshclam').length>=1,'the updater was reached');
  await started.close();
 }finally{await rm(root,{recursive:true,force:true});}
});

test('STARTUP CORRUPT: corruption is never refreshed', async () => {
 const root=await mkdtemp(join(tmpdir(),'meri-life-'));
 try{
  const fixture=await publishFixture(root);
  await writeFile(join(fixture.dir,'database','main.cvd'),Buffer.from('tampered'));   // present but corrupt bytes
  const calls=[];
  const definitionsRun=async program=>{calls.push(program);return {stdout:Buffer.alloc(0)};};
  const started=await startNativeProcessingHost(hostArgs(root,{definitionsRun}));
  assert.equal(started.startupState.reason,'UPLOAD_DEFINITIONS_CORRUPT');
  assert.equal(started.provisioning.started,false,'corrupt is not provisionable');
  assert.equal(calls.includes('freshclam'),false,'corruption never fetches');
  await started.close();
 }finally{await rm(root,{recursive:true,force:true});}
});

test('CONCURRENT: real publication path shares exactly one attempt', async () => {
 const root=await mkdtemp(join(tmpdir(),'meri-life-'));
 try{
  await publishFixture(root);                     // fresh store, refresh is explicit here
  let freshclam=0;
  const definitionsRun=async program=>{if(program==='freshclam'){freshclam+=1;await new Promise(r=>setTimeout(r,20));}
   return {stdout:Buffer.alloc(0)};};
  const composition=createUploadDefinitionsComposition({definitionsRoot:root,definitionsRun});
  const results=await Promise.allSettled([composition.provisionDefinitions({deadlineMs:Date.now()+2000}),
   composition.provisionDefinitions({deadlineMs:Date.now()+2000})]);
  assert.equal(results.length,2);
  assert.equal(freshclam,1,'one shared inFlight attempt');
 }finally{await rm(root,{recursive:true,force:true});}
});

test('SHUTDOWN: the held attempt observes abort; an unsettled lifecycle is never reported closed', async () => {
 const root=await mkdtemp(join(tmpdir(),'meri-life-'));
 try{
  let entered=null;const enteredPromise=new Promise(resolve=>{entered=resolve;});
  let aborted=false;
  const definitionsRun=async(program,args,options)=>{entered();
   options.signal?.addEventListener('abort',()=>{aborted=true;},{once:true});
   if(options.signal?.aborted)aborted=true;
   return new Promise(()=>{});                    // only the shutdown abort can end this attempt
  };
  const started=await startNativeProcessingHost(hostArgs(root,{definitionsRun}));
  await enteredPromise;                           // the updater effect has actually begun
  const closed=await started.close();
  assert.equal(aborted,true,'the held provisioning attempt observed the shutdown abort');
  assert.equal(closed.closed,false,'a permanently unsettled lifecycle is reported unknown');
 }finally{await rm(root,{recursive:true,force:true});}
});
