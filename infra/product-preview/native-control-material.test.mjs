/** Pure configuration -> inventory -> pinned delivery checks. No real material is read or written. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {validateConfiguration} from '../../apps/runtime/config.mjs';
import {compileProductMaterialPlan} from '../../apps/runtime/material-init-plan.mjs';
import {validateStaticProductDelivery} from '../../apps/runtime/material-init.mjs';
import {canonicalSha256} from '../../packages/contracts/validate.mjs';
import {controlMaterialConfiguration,workerMaterialConfiguration,runtimeUser} from './material-test-fixture.mjs';

const root='/run/meri/',ordinary=['control-capability','control.json','database-url','temporal-ca','temporal-cert','temporal-key'];
const tlsFiles=['native-host-ca','native-host-cert','native-host-key'],observerFile='native-observer-key';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const plan=configuration=>compileProductMaterialPlan({role:'control',configuration,runtimeUser});
function configuration(observer=true){
 const c=controlMaterialConfiguration();
 c.uploads={native:{enabled:true,policySha256:'a'.repeat(64),host:{tls:{caPath:root+tlsFiles[0],certPath:root+tlsFiles[1],keyPath:root+tlsFiles[2]}}}};
 if(observer)Object.assign(c.uploads.native.host,{
  deployment:{accountId:'111122223333',region:'us-east-1',amiId:'ami-0123456789abcdef0',vpcId:'vpc-0123456789abcdef0',
   subnetId:'subnet-0123456789abcdef0',securityGroupId:'sg-0123456789abcdef0',rootDeviceName:'/dev/xvda'},
  observer:{keyId:'synthetic-observer',keyPath:root+observerFile}});
 return c;
}
// The independent shipping declaration intentionally does NOT ask the plan for its expected files.
function delivery(c,names){
 const files=names.map(name=>({path:root+name,base64:Buffer.from(name==='control.json'?JSON.stringify(c):'synthetic-material:'+name).toString('base64')}));
 const contract={schemaVersion:1,role:'control',runtimeUser,sourceCommit:'1'.repeat(40),imageDigest:'sha256:'+'2'.repeat(64),
  sha256ByPath:Object.fromEntries(files.map(f=>[f.path,sha(Buffer.from(f.base64,'base64'))]))};
 return {expected:{...contract,materialContractSha256:canonicalSha256(contract)},bundle:{files}};
}
const names=observer=>[...ordinary,...tlsFiles,...(observer?[observerFile]:[])];

test('validated Control host configuration delivers all three TLS files and its optional observer key',()=>{
 for(const observer of [false,true]){
  const c=configuration(observer);validateConfiguration(c,'control');
  const p=plan(c),expectedNames=names(observer);
  assert.deepEqual(p.requiredFiles.map(f=>f.path),expectedNames.map(n=>root+n).sort());
  const old=plan(controlMaterialConfiguration());
  assert.deepEqual(p.requiredFiles.filter(f=>ordinary.includes(f.path.slice(root.length))),old.requiredFiles);
  for(const name of [...tlsFiles,...(observer?[observerFile]:[])]){
   const f=p.requiredFiles.find(f=>f.path===root+name);
   assert.deepEqual(f.purposes,[name]);assert.equal(f.mode,'0600');assert.equal(f.maxBytes,32768);
  }
  assert.deepEqual(validateStaticProductDelivery(delivery(c,expectedNames)),{
   ready:true,role:'control',runtimeUser,sourceCommit:'1'.repeat(40),imageDigest:'sha256:'+'2'.repeat(64),
   materialContractSha256:delivery(c,expectedNames).expected.materialContractSha256,configurationPath:root+'control.json',fileCount:expectedNames.length});
 }
});

test('independently repinned missing native files and extra files cannot satisfy the closed delivery inventory',()=>{
 const c=configuration();validateConfiguration(c,'control');
 for(const missing of [...tlsFiles,observerFile]){
  assert.throws(()=>validateStaticProductDelivery(delivery(c,names(true).filter(n=>n!==missing))),{code:'STATIC_INIT_INVENTORY_REFUSED'},missing);
 }
 assert.throws(()=>validateStaticProductDelivery(delivery(c,ordinary)),{code:'STATIC_INIT_INVENTORY_REFUSED'});
 assert.throws(()=>validateStaticProductDelivery(delivery(c,[...names(true),'foreign-key'])),{code:'STATIC_INIT_INVENTORY_REFUSED'});
 const changed=delivery(c,names(true));changed.bundle.files.find(f=>f.path===root+observerFile).base64=Buffer.from('changed').toString('base64');
 assert.throws(()=>validateStaticProductDelivery(changed),{code:'STATIC_INIT_CONTENT_REFUSED'});
});

test('native purposes cannot alias other material or escape the direct protected root, even with fresh pins',()=>{
 for(const mutate of [
  c=>{c.uploads.native.host.tls.caPath=c.temporal.tls.caFile;},
  c=>{c.uploads.native.host.tls.keyPath=c.uploads.native.host.tls.certPath;},
  c=>{c.uploads.native.host.observer.keyPath=c.uploads.native.host.tls.keyPath;},
  c=>{c.uploads.native.host.observer.keyPath=c.native.capabilityFile;},
  c=>{c.uploads.native.host.tls.certPath=root+'control.json';},
  c=>{c.uploads.native.host.tls.caPath='/outside/native-ca';},
  c=>{c.uploads.native.host.observer.keyPath=root+'nested/key';},
 ]){
  const c=configuration();mutate(c);validateConfiguration(c,'control');
  assert.throws(()=>plan(c),{code:'PRODUCT_MATERIAL_REFUSED'});
  assert.throws(()=>validateStaticProductDelivery(delivery(c,names(true))),{code:'STATIC_INIT_REFUSED'});
 }
});

test('absent and disabled native declarations retain the ordinary inventory and refuse native-file smuggling',()=>{
 const absent=controlMaterialConfiguration(),disabled=controlMaterialConfiguration();disabled.uploads={native:{enabled:false}};
 for(const c of [absent,disabled]){
  validateConfiguration(c,'control');assert.deepEqual(plan(c),plan(absent));
  assert.equal(validateStaticProductDelivery(delivery(c,ordinary)).fileCount,ordinary.length);
  assert.throws(()=>validateStaticProductDelivery(delivery(c,names(true))),{code:'STATIC_INIT_INVENTORY_REFUSED'});
 }
 const invalid=configuration();invalid.uploads.native.enabled=false;
 assert.throws(()=>validateConfiguration(invalid,'control'),{code:'UPLOAD_NATIVE_CONFIGURATION'});
 assert.throws(()=>validateStaticProductDelivery(delivery(invalid,names(true))),{code:'STATIC_INIT_REFUSED'});
});

test('Control native host material cannot be declared or delivered as a Temporal worker',()=>{
 const worker=workerMaterialConfiguration();validateConfiguration(worker,'temporal-worker');
 worker.uploads=configuration().uploads;
 assert.throws(()=>validateConfiguration(worker,'temporal-worker'));
 assert.throws(()=>compileProductMaterialPlan({role:'temporal-worker',configuration:worker,runtimeUser}),{code:'PRODUCT_MATERIAL_REFUSED'});
 const f=delivery(configuration(),names(true));const {materialContractSha256:_,...contract}=f.expected;void _;
 contract.role='temporal-worker';f.expected={...contract,materialContractSha256:canonicalSha256(contract)};
 assert.throws(()=>validateStaticProductDelivery(f),/^Error: STATIC_INIT_/);
});
