import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {readRuntimeTemporalTls} from '../temporal-tls.mjs';

let directory,configuration;
test.before(async()=>{
 directory=await mkdtemp(join(tmpdir(),'meri-temporal-tls-'));
 for(const [name,ca] of [['ca',true],['client',false]]){
  const r=spawnSync(process.env.MERI_TEST_OPENSSL??'openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=Synthetic '+name,
   '-addext','basicConstraints=critical,CA:'+String(ca).toUpperCase(),'-keyout',name+'.key.pem','-out',name+'.pem'],{cwd:directory,encoding:'utf8',timeout:30000});
  assert.equal(r.status,0,'throwaway TLS fixture generation');
 }
 configuration={caFile:join(directory,'ca.pem'),certFile:join(directory,'client.pem'),keyFile:join(directory,'client.key.pem')};
});
test.after(async()=>{if(directory)await rm(directory,{recursive:true,force:true});});

test('native Temporal TLS receives the exact CA, client certificate and matching private key',async()=>{
 const tls=await readRuntimeTemporalTls(configuration,{readMaterial:readFile});
 assert.deepEqual(tls,{serverRootCACertificate:await readFile(configuration.caFile),clientCertPair:{crt:await readFile(configuration.certFile),key:await readFile(configuration.keyFile)}});
 assert.deepEqual(Object.keys(tls),['serverRootCACertificate','clientCertPair']);
});

test('invalid, substituted, expired and CA-as-client credentials refuse before connection',async()=>{
 for(const c of [{...configuration,keyFile:join(directory,'ca.key.pem')},{...configuration,certFile:configuration.caFile,keyFile:join(directory,'ca.key.pem')},{...configuration,caFile:configuration.certFile}])
  await assert.rejects(readRuntimeTemporalTls(c,{readMaterial:readFile}),/TEMPORAL_TLS_MATERIAL_REFUSED/);
 await assert.rejects(readRuntimeTemporalTls(configuration,{readMaterial:readFile,now:()=>Date.now()+172800000}),/TEMPORAL_TLS_MATERIAL_REFUSED/);
 await assert.rejects(readRuntimeTemporalTls(configuration,{readMaterial:async()=>Buffer.from('invalid')}),/TEMPORAL_TLS_MATERIAL_REFUSED/);
 await assert.rejects(readRuntimeTemporalTls(configuration,{readMaterial:async()=>{throw Error('owner-only file unavailable');}}),/owner-only file unavailable/);
});
