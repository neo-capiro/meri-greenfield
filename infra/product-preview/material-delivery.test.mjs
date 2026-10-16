import test from 'node:test';
import assert from 'node:assert/strict';
import {compileProductMaterialPlan,verifyProductMaterial} from './material-delivery.mjs';
import {runtimeUser as user,materialRoot as root,controlMaterialConfiguration as control,workerMaterialConfiguration as worker} from './material-test-fixture.mjs';

const plan=(role,configuration)=>compileProductMaterialPlan({role,configuration,runtimeUser:user});

test('control plan derives exactly the canonical static files, including candidate credentials, without material values',()=>{
 const c=control(),p=plan('control',c),paths=p.requiredFiles.map(file=>file.path);
 assert.deepEqual(paths,[
  'control-capability','control.json','database-url','identity-capability','proxy-capability','task-capability','temporal-ca','temporal-cert','temporal-key',
 ].map(name=>root+name).sort());
 assert.deepEqual(p.requiredFiles.find(file=>file.path===c.native.capabilityFile).purposes,['control-capability','native-capability']);
 assert.equal(p.containerName,'control');assert.equal(p.configurationPath,root+'control.json');
 assert.equal(p.directoryMode,'0700');assert.ok(p.requiredFiles.every(file=>file.mode==='0600'&&file.maxBytes===32768));
 assert.equal(p.uid,1000);assert.equal(p.gid,1000);assert.equal(p.requiresTokenRotation,false);
 assert.equal(JSON.stringify(p).includes('synthetic-existing'),false,'the plan carries paths and constraints, not values');
});

test('worker plan omits control-only files and exposes an explicit Temporal rotation requirement',()=>{
 const c=worker();c.temporal.authorization={tokenFile:root+'temporal-token',namespace:c.temporal.namespace,audience:'temporal.meri',issuer:'https://issuer.synthetic.invalid',refreshMs:5000,maxLifetimeMs:60000};
 const p=plan('temporal-worker',c);
 assert.deepEqual(p.requiredFiles.map(file=>file.path),[
  'control-capability','temporal-ca','temporal-cert','temporal-key','temporal-token','worker.json',
 ].map(name=>root+name).sort());
 assert.equal(p.requiresTokenRotation,true);assert.equal(p.containerName,'temporal-worker');
});

test('optional signing material and control dynamic directory are declared only when configured',()=>{
 const c=control();c.downloadLinks={enabled:true,keyFile:root+'download-key',ttlMs:60000};
 c.nativeCandidate.multiRun={runWindowMs:600000,materialDirectory:'/tmp/meri-material'};
 const p=plan('control',c);
 assert.ok(p.requiredFiles.some(file=>file.path===root+'download-key'));
 assert.equal(p.dynamicMaterialDirectory,'/tmp/meri-material');
 const disabled=control();disabled.downloadLinks={enabled:false};
 assert.equal(plan('control',disabled).requiredFiles.some(file=>file.path===root+'download-key'),false);
});

test('wrong role, runtime user, HTTP binding, foreign secret paths and accidental credential aliases fail closed',()=>{
 const c=control();
 for(const role of ['conversation-runner','other',null])assert.throws(()=>plan(role,c),/PRODUCT_MATERIAL_REFUSED/);
 for(const runtimeUser of ['0:0','1000:0','node','1000:1000:1','99999999999:1000'])assert.throws(()=>compileProductMaterialPlan({role:'control',configuration:c,runtimeUser}),/PRODUCT_MATERIAL_REFUSED/);
 for(const changed of [
  x=>{x.http.port=80;},x=>{x.http.hostname='127.0.0.1';},
  x=>{delete x.privateHttp;},x=>{x.privateHttp.port=8080;},x=>{x.privateHttp.frontendOrigin='https://foreign.synthetic.invalid';},
  x=>{x.database.connectionFile='/run/secrets/database';},
  x=>{x.nativeCandidate.identity.credentialFile='/run/meri/nested/identity';},
  x=>{x.temporal.tls.keyFile=x.temporal.tls.certFile;},
  x=>{x.temporal.tls.caFile=x.native.capabilityFile;},
  x=>{x.temporal.tls.caFile=root+'control.json';},
  x=>{x.nativeCandidate.controlCapabilityFile=root+'different-capability';},
  x=>{x.nativeCandidate.multiRun={runWindowMs:600000,materialDirectory:'/run/meri'};},
  x=>{x.nativeCandidate.multiRun={runWindowMs:600000,materialDirectory:'/run/meri/issued'};},
 ]){const bad=structuredClone(c);changed(bad);assert.throws(()=>plan('control',bad),/PRODUCT_MATERIAL_REFUSED/);}
});

test('preflight rejects a forged plan and refuses this non-Linux host before any file IO',async()=>{
 await assert.rejects(verifyProductMaterial({role:'control'},{}),/PRODUCT_MATERIAL_REFUSED/);
 if(process.platform!=='linux')await assert.rejects(verifyProductMaterial(plan('control',control()),{expectedSha256ByPath:{}}),/PRODUCT_MATERIAL_REFUSED/);
});
