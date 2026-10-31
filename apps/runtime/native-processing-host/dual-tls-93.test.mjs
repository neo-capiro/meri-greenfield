/** FINITE93: the default entrypoint's two TLS identities are DISTINCT protected pairs and never fall back to one another. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeProcessingConfig} from './config.mjs';

const ENV={MERI_NATIVE_PROCESSING_CONTROL_ADDRESS:'10.0.0.5',MERI_NATIVE_PROCESSING_CONTROL_PORT:'9443',
 MERI_NATIVE_PROCESSING_CONTROL_SERVER_NAME:'control.meri.internal',
 MERI_NATIVE_PROCESSING_CONTROL_FINGERPRINT:'d'.repeat(64),MERI_NATIVE_PROCESSING_POLICY_SHA256:'f'.repeat(64),
 MERI_NATIVE_PROCESSING_PORT:'9443',MERI_NATIVE_PROCESSING_ADDRESS:'127.0.0.1',
 MERI_NATIVE_PROCESSING_TLS_KEY:'/p/server.key',MERI_NATIVE_PROCESSING_TLS_CERT:'/p/server.crt',MERI_NATIVE_PROCESSING_TLS_CA:'/p/peer-ca.crt',
 MERI_NATIVE_PROCESSING_CONTROL_CLIENT_KEY:'/p/client.key',MERI_NATIVE_PROCESSING_CONTROL_CLIENT_CERT:'/p/client.crt',
 MERI_NATIVE_PROCESSING_CONTROL_CA:'/p/control-ca.crt',
 MERI_NATIVE_PROCESSING_PEER_SAN:'control.meri.internal',MERI_NATIVE_PROCESSING_PEER_FINGERPRINT:'a'.repeat(64),
 MERI_NATIVE_PROCESSING_PEER_MAX_LIFETIME_MS:'900000',MERI_NATIVE_PROCESSING_PEER_NOT_AFTER_MS:String(Date.now()+600000),
 MERI_NATIVE_PROCESSING_IMAGE_DIGEST:`sha256:${'b'.repeat(64)}`,MERI_NATIVE_PROCESSING_HOST_ID:'00000000-0000-4000-8000-000000000007',
 MERI_NATIVE_PROCESSING_GENERATION:'3',MERI_NATIVE_PROCESSING_CONVERSATION_ID:'00000000-0000-4000-8000-000000000003',
 MERI_NATIVE_PROCESSING_TENANT_ID:'00000000-0000-4000-8000-000000000001',
 MERI_NATIVE_PROCESSING_INSTANCE_ID:'i-0123456789abcdef0',MERI_NATIVE_PROCESSING_BOOT_ID:'00000000-0000-4000-8000-000000000008',
 MERI_NATIVE_PROCESSING_HOST_MODE:'native-processing',
 MERI_NATIVE_PROCESSING_ORIGINAL_BINDING:JSON.stringify({tenantId:'00000000-0000-4000-8000-000000000001',
  actorId:'00000000-0000-4000-8000-000000000002',conversationId:'00000000-0000-4000-8000-000000000003',
  runId:'00000000-0000-4000-8000-000000000004',attemptId:'00000000-0000-4000-8000-000000000005',
  workerId:'00000000-0000-4000-8000-000000000006',writerFence:1}),
 MERI_NATIVE_PROCESSING_LEASE_DEADLINE_MS:String(Date.now()+600000),
 MERI_NATIVE_PROCESSING_CPU_QUOTA_US:'50000',MERI_NATIVE_PROCESSING_CPU_PERIOD_US:'100000',
 MERI_NATIVE_PROCESSING_MEMORY_BYTES:'268435456',MERI_NATIVE_PROCESSING_PIDS_MAX:'16',
 MERI_NATIVE_PROCESSING_DEADLINE_MAX_MS:'2000',MERI_NATIVE_PROCESSING_BODY_BYTES:'1100000',
 MERI_NATIVE_PROCESSING_HELPER:'/usr/lib/meri/meri-host-launcher',MERI_NATIVE_PROCESSING_NODE:'/usr/local/bin/node',
 MERI_NATIVE_PROCESSING_CHILD:'/opt/meri/child-cli.mjs',MERI_NATIVE_PROCESSING_HOME:'/run/meri/processing',
 MERI_NATIVE_PROCESSING_DEFINITIONS:'/run/meri/upload-definitions',MERI_NATIVE_PROCESSING_EXTRACTOR:'/opt/meri/extract.py',
 MERI_NATIVE_PROCESSING_SCRATCH:'/run/meri/upload-scratch',MERI_NATIVE_PROCESSING_RUNTIME_UID:'1000',
 MERI_NATIVE_PROCESSING_RUNTIME_GID:'1000',MERI_NATIVE_PROCESSING_CREDENTIAL_PATHS:'/proc/1/environ'};


test('DUAL TLS: listener and native-Control client read four distinct protected files plus two CAs',()=>{
 const config=nativeProcessingConfig({env:ENV});
 assert.equal(config.tls.keyPath,'/p/server.key');
 assert.equal(config.tls.certPath,'/p/server.crt');
 assert.equal(config.control.clientKeyPath,'/p/client.key');
 assert.equal(config.control.clientCertPath,'/p/client.crt');
 assert.notEqual(config.tls.keyPath,config.control.clientKeyPath);
 assert.notEqual(config.tls.certPath,config.control.clientCertPath);
 assert.equal(config.tls.caPath,'/p/peer-ca.crt');
 assert.equal(config.control.caPath,'/p/control-ca.crt');
 for(const path of ['/p/server.key','/p/server.crt','/p/peer-ca.crt','/p/client.key','/p/client.crt','/p/control-ca.crt'])
  assert.ok(config.paths.childSettings.credentialPaths.includes(path),path+' is an excluded credential path');
});

test('DUAL TLS: a missing client identity or CA refuses configuration instead of reusing the listener pair',()=>{
 for(const missing of ['MERI_NATIVE_PROCESSING_CONTROL_CLIENT_KEY','MERI_NATIVE_PROCESSING_CONTROL_CLIENT_CERT',
  'MERI_NATIVE_PROCESSING_CONTROL_CA']){
  const env={...ENV};delete env[missing];
  assert.throws(()=>nativeProcessingConfig({env}),e=>e.code==='NATIVE_PROCESSING_CONFIGURATION',missing+' is required');
 }
});
