import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {canonicalSha256} from '../../packages/contracts/validate.mjs';
import {parseStaticProductMaterialExpected,validateStaticProductDelivery,materializeStaticProductMaterial,releaseStaticProductMaterial} from '../../apps/runtime/material-init.mjs';
import {materialInitEnvironment,runMaterialInitCli} from '../../apps/runtime/material-init-cli.mjs';
import {staticMaterialFixture,controlMaterialConfiguration,workerMaterialConfiguration} from './material-test-fixture.mjs';

function repin(expected){const {materialContractSha256:_,...contract}=expected;void _;return {...contract,materialContractSha256:canonicalSha256(contract)};}
function updateFile(f,path,bytes){
 f.bundle.files.find(file=>file.path===path).base64=Buffer.from(bytes).toString('base64');
 f.expected.sha256ByPath[path]=createHash('sha256').update(bytes).digest('hex');f.expected=repin(f.expected);
}

test('control/poller delivery validates exact independent pins and returns only a content-free startup receipt',()=>{
 for(const role of ['control','temporal-worker']){
  const f=staticMaterialFixture(role),s=validateStaticProductDelivery(f);
  assert.deepEqual(s,{ready:true,role,runtimeUser:'1000:1000',sourceCommit:f.expected.sourceCommit,imageDigest:f.expected.imageDigest,
   materialContractSha256:f.expected.materialContractSha256,configurationPath:f.plan.configurationPath,fileCount:f.bundle.files.length});
  assert.equal(Object.isFrozen(s),true);
  assert.equal(JSON.stringify(s).includes('synthetic-static-material'),false);
  assert.equal(JSON.stringify(s).includes('sha256ByPath'),false);
  assert.equal(JSON.stringify(s).includes('base64'),false);
  assert.deepEqual(parseStaticProductMaterialExpected(f.expected),f.expected);
 }
});

test('expected contract rejects changes, foreign fields, unsafe paths, roles, users and unpinned source/image before delivery',()=>{
 const f=staticMaterialFixture();
 const variants=[
  e=>({...e,sourceCommit:'3'.repeat(40)}),e=>({...e,imageDigest:'sha256:'+'4'.repeat(64)}),
  e=>({...e,taskArn:'observed-task-is-not-authority'}),e=>({...e,materialContractSha256:'5'.repeat(64)}),
  e=>repin({...e,schemaVersion:2}),e=>repin({...e,role:'conversation-runner'}),
  e=>repin({...e,runtimeUser:'0:0'}),e=>repin({...e,runtimeUser:'1000:0'}),e=>repin({...e,runtimeUser:'2147483648:1000'}),
  e=>repin({...e,sourceCommit:'HEAD'}),e=>repin({...e,imageDigest:'image:latest'}),
  e=>repin({...e,sha256ByPath:{'/elsewhere/control.json':'a'.repeat(64)}}),
  e=>repin({...e,sha256ByPath:{'/run/meri/nested/control.json':'a'.repeat(64)}}),
  e=>repin({...e,sha256ByPath:{'/run/meri//control.json':'a'.repeat(64)}}),
  e=>repin({...e,sha256ByPath:{'/run/meri/control.json':'invalid'}}),
 ];
 for(const mutate of variants)assert.throws(()=>parseStaticProductMaterialExpected(mutate(structuredClone(f.expected))),{code:'STATIC_INIT_EXPECTED_REFUSED'});
 const accessor={...f.expected};Object.defineProperty(accessor,'role',{enumerable:true,get(){throw Error('must not read');}});
 assert.throws(()=>parseStaticProductMaterialExpected(accessor),{code:'STATIC_INIT_EXPECTED_REFUSED'});
});

test('bundle refuses missing, duplicated, foreign, changed, malformed, empty and oversized files without trusting echoes',()=>{
 const fixture=()=>structuredClone(staticMaterialFixture());
 const variants=[
  f=>{f.bundle.files.pop();},f=>{f.bundle.files.push({...f.bundle.files[0]});},
  f=>{f.bundle.files[0].path='/run/meri/foreign';},f=>{f.bundle.files[1]={...f.bundle.files[0]};},
  f=>{f.bundle.files[0].base64=Buffer.from('changed').toString('base64');},
  f=>{f.bundle.files[0].base64+='\n';},f=>{f.bundle.files[0].base64='!';},f=>{f.bundle.files[0].base64='';},
  f=>{f.bundle.files[0].base64=Buffer.alloc(32769).toString('base64');},
  f=>{f.bundle.authenticated=true;},f=>{f.bundle.files[0].sha256='a'.repeat(64);},
  f=>{for(const file of f.bundle.files)file.base64=Buffer.alloc(32768).toString('base64');},
 ];
 for(const mutate of variants){const f=fixture();mutate(f);assert.throws(()=>validateStaticProductDelivery(f),/^Error: STATIC_INIT_/);}
});

test('even fully repinned material must contain valid canonical role configuration with the exact declared inventory',()=>{
 for(const changed of [
  c=>{c.sourceEnabled=true;},c=>{c.temporal.tls.keyFile='/run/meri/undeclared-key';},
  c=>{c.nativeCandidate.identity.credentialFile=c.nativeCandidate.proxyCredentialFile;},
  c=>{c.database.connectionFile='/other/database';},c=>{c.http.port=9999;},c=>{c.nativeCandidate.multiRun={...c.nativeCandidate.multiRun,materialDirectory:'/tmp/dynamic'};},
 ]){
  const f=staticMaterialFixture(),c=controlMaterialConfiguration();changed(c);
  updateFile(f,f.plan.configurationPath,Buffer.from(JSON.stringify(c)));
  if(c.nativeCandidate.multiRun.materialDirectory==='/tmp/dynamic'){assert.doesNotThrow(()=>validateStaticProductDelivery(f),'dynamic storage is separate from the immutable static inventory');}
  else assert.throws(()=>validateStaticProductDelivery(f),/^Error: STATIC_INIT_/);
 }
 const f=staticMaterialFixture();updateFile(f,f.plan.configurationPath,Buffer.from([0xff]));
 assert.throws(()=>validateStaticProductDelivery(f),{code:'STATIC_INIT_REFUSED'});
 const worker=workerMaterialConfiguration();worker.native.preparedKickoff=false;
 const w=staticMaterialFixture('temporal-worker');updateFile(w,w.plan.configurationPath,Buffer.from(JSON.stringify(worker)));
 assert.throws(()=>validateStaticProductDelivery(w),{code:'STATIC_INIT_REFUSED'});
});

test('optional static signing/token files are included while token rotation remains a separate runtime responsibility',()=>{
 const c=controlMaterialConfiguration();c.downloadLinks={enabled:true,keyFile:'/run/meri/download-key',ttlMs:60000};
 c.temporal.authorization={tokenFile:'/run/meri/temporal-token',namespace:c.temporal.namespace,audience:'temporal.meri',issuer:'https://issuer.synthetic.invalid',refreshMs:5000,maxLifetimeMs:60000};
 const f=staticMaterialFixture('control',c),s=validateStaticProductDelivery(f);
 assert.equal(s.fileCount,12);assert.equal(f.plan.requiresTokenRotation,true);
});

test('missing delivery/invalid deadline/unsupported host refuse before any delivery effect and forged cleanup receipts refuse',async()=>{
 const f=staticMaterialFixture();let calls=0;
 const delivery={async fetch(){calls++;return f.bundle;}};
 await assert.rejects(materializeStaticProductMaterial({expected:f.expected,delivery:{}}),{code:'STATIC_INIT_CONFIGURATION_REFUSED'});
 await assert.rejects(materializeStaticProductMaterial({expected:f.expected,delivery,maxRequestMs:0}),{code:'STATIC_INIT_CONFIGURATION_REFUSED'});
 if(process.platform!=='linux')await assert.rejects(materializeStaticProductMaterial({expected:f.expected,delivery}),{code:'STATIC_INIT_PLATFORM_REFUSED'});
 await assert.rejects(releaseStaticProductMaterial({ready:true}),{code:'STATIC_INIT_RECEIPT_REFUSED'});
 assert.equal(calls,0);
});

test('CLI has import-safe help, closed arguments, bounded material refusal and no material in diagnostics',async()=>{
 let out='',error='';const environment={},ports={environment,writeOut:text=>{out+=text;},writeError:text=>{error+=text;}};
 assert.equal(await runMaterialInitCli(['--help'],ports),0);assert.match(out,/Exit codes/);assert.equal(error,'');
 assert.equal(await runMaterialInitCli(['write','extra'],ports),64);
 error='';assert.equal(await runMaterialInitCli(['write'],ports),78);assert.equal(error,'STATIC_INIT_REFUSED\n');
 const f=staticMaterialFixture();environment[materialInitEnvironment.expected]=JSON.stringify(f.expected);
 environment[materialInitEnvironment.bundle]=JSON.stringify(f.bundle);error='';
 if(process.platform!=='linux'){
  assert.equal(await runMaterialInitCli(['write'],ports),78);assert.equal(error,'STATIC_INIT_PLATFORM_REFUSED\n');
  assert.equal(Object.hasOwn(environment,materialInitEnvironment.bundle),false);assert.doesNotMatch(out+error,/synthetic-static-material/);
 }
 error='';environment[materialInitEnvironment.bundle]='private-material-that-must-not-appear';
 environment[materialInitEnvironment.expected]='x'.repeat(8193);
 assert.equal(await runMaterialInitCli(['write'],ports),78);assert.equal(error,'STATIC_INIT_REFUSED\n');
 assert.equal(Object.hasOwn(environment,materialInitEnvironment.bundle),false);assert.doesNotMatch(out+error,/private-material/);
 const help=spawnSync(process.execPath,['apps/runtime/material-init-cli.mjs','--help'],{encoding:'utf8',timeout:5000});
 assert.equal(help.status,0);assert.match(help.stdout,/Usage:/);assert.equal(help.stderr,'');
});
