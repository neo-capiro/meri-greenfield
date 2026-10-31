import test from 'node:test';
import assert from 'node:assert/strict';
import {compileProductMaterialPlan,verifyProductMaterial} from './material-delivery.mjs';
import {configurationMaxBytes} from '../../apps/runtime/config.mjs';
import {runtimeUser as user,materialRoot as root,controlMaterialConfiguration as control,workerMaterialConfiguration as worker} from './material-test-fixture.mjs';
import {observerFixture} from '../../apps/runtime/test/native-observer-fixture.mjs';

const plan=(role,configuration)=>compileProductMaterialPlan({role,configuration,runtimeUser:user});

test('control plan derives exactly the canonical static files without per-run or user credentials',()=>{
 const c=control(),p=plan('control',c),paths=p.requiredFiles.map(file=>file.path);
 assert.deepEqual(paths,[
  'control-capability','control.json','database-url','temporal-ca','temporal-cert','temporal-key',
 ].map(name=>root+name).sort());
 assert.deepEqual(p.requiredFiles.find(file=>file.path===c.native.capabilityFile).purposes,['native-capability']);
 assert.equal(p.containerName,'control');assert.equal(p.configurationPath,root+'control.json');
 assert.equal(p.directoryMode,'0700');assert.ok(p.requiredFiles.every(file=>file.mode==='0600'&&file.maxBytes===(file.path===p.configurationPath?configurationMaxBytes(p.role):32768)));
 assert.equal(p.uid,1000);assert.equal(p.gid,1000);assert.equal(p.requiresTokenRotation,false);
 assert.equal(p.dynamicMaterialDirectory,null);
 assert.equal(JSON.stringify(p).includes('synthetic-existing'),false,'the plan carries paths and constraints, not values');
});

test('worker plan retains the current mTLS-only inventory and refuses the retired token authorization field',()=>{
 const c=worker();
 const p=plan('temporal-worker',c);
 assert.deepEqual(p.requiredFiles.map(file=>file.path),[
  'control-capability','temporal-ca','temporal-cert','temporal-key','worker.json',
 ].map(name=>root+name).sort());
 assert.equal(p.requiresTokenRotation,false);assert.equal(p.containerName,'temporal-worker');
 c.temporal.authorization={tokenFile:root+'temporal-token',namespace:c.temporal.namespace,audience:'temporal.meri',issuer:'https://issuer.synthetic.invalid',refreshMs:5000,maxLifetimeMs:60000};
 assert.throws(()=>plan('temporal-worker',c),/PRODUCT_MATERIAL_REFUSED/);
});

test('optional signing material is declared only when configured; per-run material is absent',()=>{
 const c=control();c.downloadLinks={enabled:true,keyFile:root+'download-key',ttlMs:60000};
 const p=plan('control',c);
 assert.ok(p.requiredFiles.some(file=>file.path===root+'download-key'));
 assert.equal(p.dynamicMaterialDirectory,null);
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
  x=>{delete x.agentcore;},x=>{x.taskRouter={enabled:true};},x=>{x.agentcore.identity.credentialFile=root+'identity';},
  x=>{x.database.connectionFile='/run/secrets/database';},
  x=>{x.native.capabilityFile='/run/meri/nested/capability';},
  x=>{x.temporal.tls.keyFile=x.temporal.tls.certFile;},
  x=>{x.temporal.tls.caFile=x.native.capabilityFile;},
  x=>{x.database.connectionFile=x.temporal.tls.caFile;},
  x=>{x.temporal.tls.caFile=root+'control.json';},
  x=>{x.nativeCandidate={multiRun:{runWindowMs:600000,materialDirectory:'/run/meri'}};},
  x=>{x.agentcore.identity.commandContext={tenantId:'deployment-tenant'};},
 ]){const bad=structuredClone(c);changed(bad);assert.throws(()=>plan('control',bad),/PRODUCT_MATERIAL_REFUSED/);}
});

test('preflight rejects a forged plan and refuses this non-Linux host before any file IO',async()=>{
 await assert.rejects(verifyProductMaterial({role:'control'},{}),/PRODUCT_MATERIAL_REFUSED/);
 if(process.platform!=='linux')await assert.rejects(verifyProductMaterial(plan('control',control()),{expectedSha256ByPath:{}}),/PRODUCT_MATERIAL_REFUSED/);
});

test('enabled native worker adds only its three protected files and retains ordinary path and alias refusals',async()=>{
 const f=await observerFixture(),d=f.declaration,w=d.watchdog,c=worker(),ordinary=plan('temporal-worker',c);
 c.nativeProvisioning={enabled:false};assert.deepEqual(plan('temporal-worker',c),ordinary);
 c.nativeProvisioning={enabled:true,databaseFile:root+'native-db',issuerCaCertFile:root+'native-issuer-ca',issuerCaKeyFile:root+'native-issuer-key',
  deployment:Object.fromEntries(['accountId','region','placement','launch','imageDigest','sourceCommit','bootstrapSha256','bootstrapSpec','physicalObserver','launchTagPolicy'].map(k=>[k,d[k]])),
  watchdog:{stateMachineVersionArn:w.stateMachineVersionArn,definitionSha256:w.definitionSha256,qualificationEvidenceSha256:w.qualificationEvidenceSha256}};
 const enabled=plan('temporal-worker',c),originalPaths=new Set(ordinary.requiredFiles.map(f=>f.path));
 assert.deepEqual(enabled.requiredFiles.filter(f=>originalPaths.has(f.path)),ordinary.requiredFiles);
 assert.deepEqual(enabled.requiredFiles.filter(f=>!originalPaths.has(f.path)).map(f=>[f.path,f.purposes]),[
  [root+'native-db',['database-connection']],[root+'native-issuer-ca',['native-issuer-ca']],[root+'native-issuer-key',['native-issuer-key']]]);
 for(const mutate of [x=>{x.nativeProvisioning.issuerCaKeyFile=x.temporal.tls.keyFile;},x=>{x.nativeProvisioning.databaseFile='/outside/native-db';},
  x=>{x.nativeProvisioning.issuerCaCertFile=root+'nested/issuer-ca';}]){
  const invalid=structuredClone(c);mutate(invalid);assert.throws(()=>plan('temporal-worker',invalid),/PRODUCT_MATERIAL_REFUSED/);
 }
});
