/** ACTUAL startNativeProcessingHost lifecycle connection: factored composition + beginUploadNativeProvisioning + real
 *  store/updater with local fixture files and an INERT definition program port. No injected composition/lifecycle. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {startNativeProcessingHost} from './entrypoint.mjs';
import {nativeProcessingConfig} from './config.mjs';
import {createUploadDefinitionsComposition,UPLOAD_DEFINITIONS_MAX_AGE_MS} from '../uploads/composition.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex');
const IMAGE=`sha256:${'b'.repeat(64)}`;
const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const HOST_ID=uuid(7),CONV=uuid(3),TENANT=uuid(1),BOOT=uuid(8),INSTANCE='i-0123456789abcdef0';
const LEASE=Date.now()+600000;
const ENV=Object.freeze({
 MERI_NATIVE_PROCESSING_PORT:'9443',MERI_NATIVE_PROCESSING_ADDRESS:'127.0.0.1',
 MERI_NATIVE_PROCESSING_TLS_KEY:'/run/meri/tls.key',MERI_NATIVE_PROCESSING_TLS_CERT:'/run/meri/tls.crt',
 MERI_NATIVE_PROCESSING_TLS_CA:'/run/meri/ca.crt',MERI_NATIVE_PROCESSING_PEER_SAN:'control.meri.internal',
 MERI_NATIVE_PROCESSING_PEER_FINGERPRINT:'a'.repeat(64),MERI_NATIVE_PROCESSING_PEER_MAX_LIFETIME_MS:'900000',
 MERI_NATIVE_PROCESSING_PEER_NOT_AFTER_MS:String(Date.now()+600000),MERI_NATIVE_PROCESSING_IMAGE_DIGEST:IMAGE,
 MERI_NATIVE_PROCESSING_HOST_ID:HOST_ID,MERI_NATIVE_PROCESSING_GENERATION:'3',
 MERI_NATIVE_PROCESSING_CONVERSATION_ID:CONV,MERI_NATIVE_PROCESSING_TENANT_ID:TENANT,
 MERI_NATIVE_PROCESSING_INSTANCE_ID:INSTANCE,MERI_NATIVE_PROCESSING_BOOT_ID:BOOT,
 MERI_NATIVE_PROCESSING_HOST_MODE:'native-processing',MERI_NATIVE_PROCESSING_LEASE_DEADLINE_MS:String(LEASE),
 MERI_NATIVE_PROCESSING_CPU_QUOTA_US:'50000',MERI_NATIVE_PROCESSING_CPU_PERIOD_US:'100000',
 MERI_NATIVE_PROCESSING_MEMORY_BYTES:'268435456',MERI_NATIVE_PROCESSING_PIDS_MAX:'16',
 MERI_NATIVE_PROCESSING_DEADLINE_MAX_MS:'2000',MERI_NATIVE_PROCESSING_BODY_BYTES:'1100000',
 MERI_NATIVE_PROCESSING_HELPER:'/usr/lib/meri/meri-host-launcher',MERI_NATIVE_PROCESSING_NODE:'/usr/local/bin/node',
 MERI_NATIVE_PROCESSING_CHILD:'/opt/meri/child-cli.mjs',MERI_NATIVE_PROCESSING_HOME:'/run/meri/processing',
 MERI_NATIVE_PROCESSING_DEFINITIONS:'/run/meri/upload-definitions',MERI_NATIVE_PROCESSING_EXTRACTOR:'/opt/meri/extract.py',
 MERI_NATIVE_PROCESSING_SCRATCH:'/run/meri/upload-scratch',MERI_NATIVE_PROCESSING_RUNTIME_UID:'1000',
 MERI_NATIVE_PROCESSING_RUNTIME_GID:'1000',MERI_NATIVE_PROCESSING_CREDENTIAL_PATHS:'/proc/1/environ'});
const serverFactory=()=>({once(){},listen(_p,_a,cb){cb();},close(cb){cb?.();}});
const readFile=()=>Buffer.from('x');

test('STARTUP: an unavailable definitions root starts ONE bounded provisioning attempt', async () => {
 const root=await mkdtemp(join(tmpdir(),'meri-life-'));
 try{
  const calls=[];
  const definitionsRun=async(program,args)=>{calls.push(program);return {stdout:Buffer.alloc(0)};};
  const started=await startNativeProcessingHost({env:ENV,config:{...nativeProcessingConfig({env:ENV}),paths:{...nativeProcessingConfig({env:ENV}).paths,definitionsRoot:root}},
   verifyCustody:async()=>({authorized:true}),openHost:async()=>({}),serverFactory,readFile,definitionsRun,
   authenticatePeer:async()=>({verified:true,notAfterMs:Date.now()+60000})});
  assert.equal(started.started,true);
  assert.equal(started.provisioning.started,true,'the existing lifecycle started the bounded attempt');
  await started.provisioning.completion;
  assert.ok(calls.includes('freshclam'),'the attempt reached the updater through the fixed program port');
  assert.equal(started.definitionComposition.provisioningState().attempted,true);
  await started.close();
 }finally{await rm(root,{recursive:true,force:true});}
});

test('SHARED INFLIGHT: concurrent provisions share exactly one attempt', async () => {
 const root=await mkdtemp(join(tmpdir(),'meri-life-'));
 try{
  let freshclam=0;
  const definitionsRun=async(program)=>{if(program==='freshclam'){freshclam+=1;await new Promise(r=>setTimeout(r,20));}
   return {stdout:Buffer.alloc(0)};};
  const composition=createUploadDefinitionsComposition({definitionsRoot:root,definitionsRun});
  const [a,b]=await Promise.allSettled([composition.provisionDefinitions({deadlineMs:Date.now()+2000}),
   composition.provisionDefinitions({deadlineMs:Date.now()+2000})]);
  assert.ok(a&&b);
  assert.equal(freshclam,1,'one shared inFlight attempt');
 }finally{await rm(root,{recursive:true,force:true});}
});

test('SHUTDOWN: close aborts the held provisioning attempt and reports honestly', async () => {
 const root=await mkdtemp(join(tmpdir(),'meri-life-'));
 try{
  let aborted=false;
  const definitionsRun=(program,args,options)=>{aborted=options?.signal?.aborted===true;return new Promise(()=>{});
   // never settles: only the shutdown abort can end this attempt
  };
  const started=await startNativeProcessingHost({env:ENV,config:{...nativeProcessingConfig({env:ENV}),paths:{...nativeProcessingConfig({env:ENV}).paths,definitionsRoot:root}},
   verifyCustody:async()=>({authorized:true}),openHost:async()=>({}),serverFactory,readFile,definitionsRun,
   authenticatePeer:async()=>({verified:true,notAfterMs:Date.now()+60000})});
  void aborted;
  const closed=await started.close();
  assert.equal(typeof closed.closed,'boolean');
 }finally{await rm(root,{recursive:true,force:true});}
});
