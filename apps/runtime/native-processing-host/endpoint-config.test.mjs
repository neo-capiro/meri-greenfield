import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {nativeProcessingConfig} from './config.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const IMAGE=`sha256:${'b'.repeat(64)}`;
const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const LEASE=Date.now()+600000;
const BINDING=Object.freeze({tenantId:uuid(1),actorId:uuid(2),conversationId:uuid(3),runId:uuid(4),
 attemptId:uuid(5),workerId:uuid(6),writerFence:1});
export const ENV=Object.freeze({
 MERI_NATIVE_PROCESSING_PORT:'9443',MERI_NATIVE_PROCESSING_ADDRESS:'127.0.0.1',
 MERI_NATIVE_PROCESSING_TLS_KEY:'/run/meri/tls.key',MERI_NATIVE_PROCESSING_TLS_CERT:'/run/meri/tls.crt',
 MERI_NATIVE_PROCESSING_TLS_CA:'/run/meri/ca.crt',
 MERI_NATIVE_PROCESSING_CONTROL_CLIENT_KEY:'/run/meri/client.key',MERI_NATIVE_PROCESSING_CONTROL_CLIENT_CERT:'/run/meri/client.crt',
 MERI_NATIVE_PROCESSING_CONTROL_CA:'/run/meri/control-ca.crt',MERI_NATIVE_PROCESSING_PEER_SAN:'control.meri.internal',
 MERI_NATIVE_PROCESSING_PEER_FINGERPRINT:'a'.repeat(64),MERI_NATIVE_PROCESSING_PEER_MAX_LIFETIME_MS:'900000',
 MERI_NATIVE_PROCESSING_PEER_NOT_AFTER_MS:String(Date.now()+600000),MERI_NATIVE_PROCESSING_IMAGE_DIGEST:IMAGE,
 MERI_NATIVE_PROCESSING_HOST_ID:uuid(7),MERI_NATIVE_PROCESSING_GENERATION:'3',
 MERI_NATIVE_PROCESSING_CONVERSATION_ID:uuid(3),MERI_NATIVE_PROCESSING_TENANT_ID:uuid(1),
 MERI_NATIVE_PROCESSING_INSTANCE_ID:'i-0123456789abcdef0',MERI_NATIVE_PROCESSING_BOOT_ID:uuid(8),
 MERI_NATIVE_PROCESSING_HOST_MODE:'native-processing',MERI_NATIVE_PROCESSING_ORIGINAL_BINDING:JSON.stringify(BINDING),MERI_NATIVE_PROCESSING_LEASE_DEADLINE_MS:String(LEASE),
 MERI_NATIVE_PROCESSING_CPU_QUOTA_US:'50000',MERI_NATIVE_PROCESSING_CPU_PERIOD_US:'100000',
 MERI_NATIVE_PROCESSING_MEMORY_BYTES:'268435456',MERI_NATIVE_PROCESSING_PIDS_MAX:'16',
 MERI_NATIVE_PROCESSING_DEADLINE_MAX_MS:'2000',MERI_NATIVE_PROCESSING_BODY_BYTES:'1100000',
 MERI_NATIVE_PROCESSING_HELPER:'/usr/lib/meri/meri-host-launcher',MERI_NATIVE_PROCESSING_NODE:'/usr/local/bin/node',
 MERI_NATIVE_PROCESSING_CHILD:'/opt/meri/child-cli.mjs',MERI_NATIVE_PROCESSING_HOME:'/run/meri/processing',
 MERI_NATIVE_PROCESSING_DEFINITIONS:'/run/meri/upload-definitions',MERI_NATIVE_PROCESSING_EXTRACTOR:'/opt/meri/extract.py',
 MERI_NATIVE_PROCESSING_SCRATCH:'/run/meri/upload-scratch',MERI_NATIVE_PROCESSING_RUNTIME_UID:'1000',
 MERI_NATIVE_PROCESSING_RUNTIME_GID:'1000',MERI_NATIVE_PROCESSING_CREDENTIAL_PATHS:'/proc/1/environ'});

const control={MERI_NATIVE_PROCESSING_CONTROL_ADDRESS:'127.0.0.1',MERI_NATIVE_PROCESSING_CONTROL_PORT:'8443',MERI_NATIVE_PROCESSING_CONTROL_SERVER_NAME:'control.native.invalid',MERI_NATIVE_PROCESSING_CONTROL_FINGERPRINT:'d'.repeat(64),MERI_NATIVE_PROCESSING_POLICY_SHA256:'f'.repeat(64)};
import {startNativeProcessingHost} from './entrypoint.mjs';
import {makeInertHierarchyPort} from './test-hierarchy-port.mjs';

test('REVIEW46 valid protected configuration loads and private-address correction refuses malformed/public values before effects',async()=>{
 assert.equal(nativeProcessingConfig({env:{...ENV,...control}}).control.address,'127.0.0.1');
 let effects=0;
 for(const address of [undefined,'8.8.8.8','999.999.999.999']){
  await assert.rejects(startNativeProcessingHost({hierarchyPort:makeInertHierarchyPort(),env:{...ENV,...control,MERI_NATIVE_PROCESSING_CONTROL_ADDRESS:address},readFile:()=>{effects++;throw Error('NO_EFFECT');},serverFactory:()=>{effects++;throw Error('NO_EFFECT');}}));
 }
 assert.equal(effects,0);
});

test('INVENTORY: the child credential exclusion inventory carries the protected TLS paths, deduplicated',()=>{
 const config=nativeProcessingConfig({env:{...ENV,...control,MERI_NATIVE_PROCESSING_CREDENTIAL_PATHS:'/proc/1/environ'}});
 const paths=[...config.paths.childSettings.credentialPaths];
 assert.equal(paths.includes('/proc/1/environ'),true,'declared path preserved');
 for(const p of [config.tls.keyPath,config.tls.certPath,config.tls.caPath])
  assert.equal(paths.filter(value=>value===p).length,1,`exactly one ${p}`);
 assert.equal(JSON.stringify(config.paths.childSettings).includes('BEGIN'),false,'no key bytes cross the boundary');
});

test('PROTECTED ORIGINAL BINDING: valid value is parsed, frozen and canonical',()=>{
 const FULL={...ENV,MERI_NATIVE_PROCESSING_CONTROL_ADDRESS:'10.0.0.5',MERI_NATIVE_PROCESSING_CONTROL_PORT:'9443',
  MERI_NATIVE_PROCESSING_CONTROL_SERVER_NAME:'control.meri.internal',
  MERI_NATIVE_PROCESSING_CONTROL_FINGERPRINT:'d'.repeat(64),MERI_NATIVE_PROCESSING_POLICY_SHA256:'f'.repeat(64)};
 const config=nativeProcessingConfig({env:FULL});
 assert.deepEqual({...config.binding},{...BINDING});
 assert.equal(Object.isFrozen(config.binding),true);
 assert.equal(Object.isFrozen(config.allocation),true);
 assert.equal(Object.isFrozen(config),true);
});

test('PROTECTED ORIGINAL BINDING: missing, malformed and widened values refuse',()=>{
 const without=({...ENV});delete without.MERI_NATIVE_PROCESSING_ORIGINAL_BINDING;
 assert.throws(()=>nativeProcessingConfig({env:without}),e=>e?.code==='NATIVE_PROCESSING_CONFIGURATION');
 for(const raw of ['{','[]','null','"binding"','{"tenantId":"x"}']){
  assert.throws(()=>nativeProcessingConfig({env:{...ENV,MERI_NATIVE_PROCESSING_ORIGINAL_BINDING:raw}}),
   e=>e?.code==='NATIVE_PROCESSING_CONFIGURATION',raw);
 }
 const extra=JSON.stringify({...BINDING,hostId:uuid(7)});
 assert.throws(()=>nativeProcessingConfig({env:{...ENV,MERI_NATIVE_PROCESSING_ORIGINAL_BINDING:extra}}),
  e=>e?.code==='NATIVE_PROCESSING_CONFIGURATION');
});

test('PROTECTED ORIGINAL BINDING: cross-tenant, cross-conversation and malformed run IDs refuse',()=>{
 for(const changed of [{tenantId:uuid(9)},{conversationId:uuid(9)},{runId:'not-a-uuid'},{writerFence:0}]){
  const raw=JSON.stringify({...BINDING,...changed});
  let thrown;
  try{nativeProcessingConfig({env:{...ENV,MERI_NATIVE_PROCESSING_ORIGINAL_BINDING:raw}});}
  catch(error){thrown=error;}
  assert.equal(thrown?.code,'NATIVE_PROCESSING_CONFIGURATION',JSON.stringify(changed));
  // The refusal never carries the private binding content.
  assert.equal(String(thrown?.message).includes(raw),false);
 }
});
