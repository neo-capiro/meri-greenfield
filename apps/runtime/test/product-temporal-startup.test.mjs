import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {agentcoreControlFixture} from './agentcore-fixture.mjs';
import {validateConfiguration} from '../config.mjs';
import {compileProductMaterialPlan} from '../material-init-plan.mjs';
import {validateStaticProductDelivery} from '../material-init.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';

function configuration(role='control'){
 const c=structuredClone(agentcoreControlFixture().configuration);
 c.native.capabilityFile='/run/meri/native-capability.txt';c.database.connectionFile='/run/meri/database.json';
 c.native.serverCaFile='/run/meri/control-ca.pem';c.native.serverCaSha256='a'.repeat(64);
 c.temporal.tls={caFile:'/run/meri/temporal-ca.pem',certFile:'/run/meri/temporal-cert.pem',keyFile:'/run/meri/temporal-key.pem'};
 c.temporal.namespace='meri';c.temporal.taskQueue='meri-conversations';
 if(role==='temporal-worker'){
  for(const k of ['database','sessions','versions','agentcore','privateHttp','models'])delete c[k];
  c.native.preparedKickoff=true;c.http.port=8081;
 }
 return c;
}

test('control and worker receive only native Temporal TLS material and independent control trust',()=>{
 for(const role of ['control','temporal-worker']){
  const c=configuration(role);validateConfiguration(c,role);
  const plan=compileProductMaterialPlan({role,configuration:c,runtimeUser:'1000:1000'}),paths=plan.requiredFiles.map(f=>f.path);
  assert.equal(plan.requiresTokenRotation,false);assert.equal(plan.dynamicMaterialDirectory,null);assert.equal(plan.temporalTokenWriter,undefined);
  for(const path of Object.values(c.temporal.tls))assert(paths.includes(path));assert(paths.includes(c.native.serverCaFile));
  assert(paths.every(path=>!path.includes('issuer')&&!path.includes('token')));
  const files=plan.requiredFiles.map(f=>({path:f.path,base64:Buffer.from(f.path===plan.configurationPath?JSON.stringify(c):'synthetic-existing-material').toString('base64')}));
  const contract={schemaVersion:1,role,runtimeUser:'1000:1000',sourceCommit:'a'.repeat(40),imageDigest:'sha256:'+'b'.repeat(64),sha256ByPath:Object.fromEntries(files.map(f=>[f.path,createHash('sha256').update(Buffer.from(f.base64,'base64')).digest('hex')]))};
  const expected={...contract,materialContractSha256:canonicalSha256(contract)};
  const receipt=validateStaticProductDelivery({expected,bundle:{files}});assert.equal(receipt.fileCount,files.length);
  assert.equal(JSON.stringify(receipt).includes('synthetic-existing-material'),false);
  files.push({path:'/run/meri/temporal-token.json',base64:Buffer.from('obsolete-static-token').toString('base64')});
  assert.throws(()=>validateStaticProductDelivery({expected,bundle:{files}}),/STATIC_INIT_/);
 }
});

test('old issuer/token blocks and incomplete native TLS cannot silently survive configuration',()=>{
 for(const key of ['authorization','tokenWriter','issuerDelivery','issuerBootstrap']){
  const c=configuration();c.temporal[key]={enabled:true};assert.throws(()=>validateConfiguration(c,'control'));
 }
 for(const key of ['caFile','certFile','keyFile']){const c=configuration();delete c.temporal.tls[key];assert.throws(()=>validateConfiguration(c,'control'));}
 for(const change of [c=>{c.native.serverCaSha256='wrong';},c=>{delete c.native.serverCaFile;},c=>{c.temporal.tls.certFile=c.temporal.tls.keyFile;}]){
  const c=configuration();change(c);assert.throws(()=>compileProductMaterialPlan({role:'control',configuration:c,runtimeUser:'1000:1000'}));
 }
});
import {compileOfficeConfiguration} from '../artifacts/office-configuration.mjs';
const officeConfig=c=>({enabled:true,editorOrigin:'https://office.example.test',wopiOrigin:'https://wopi.example.test',
 browserOrigin:c.http.frontendOrigin,coreOrigin:'https://core.example.test',keyFile:'/run/meri/office.key',
 serviceSecretFile:'/run/meri/office-core.secret'});
test('enabled Control material plan inventories Office signing and Core secret',()=>{
 const c=configuration('control');c.office=officeConfig(c);validateConfiguration(c,'control');compileOfficeConfiguration(c);
 const plan=compileProductMaterialPlan({role:'control',configuration:c,runtimeUser:'1000:1000'});
 const byPath=new Map(plan.requiredFiles.map(file=>[file.path,file.purposes]));
 assert.deepEqual(byPath.get('/run/meri/office.key'),['office-wopi-signing-key']);
 assert.deepEqual(byPath.get('/run/meri/office-core.secret'),['office-core-service-secret']);
 assert.equal([...byPath.keys()].filter(path=>path.includes('office')).length,2);
});
test('Office signing key cannot alias canonical native material',()=>{
 const c=configuration('control');c.office={...officeConfig(c),keyFile:c.native.capabilityFile};
 assert.throws(()=>validateConfiguration(c,'control'),/OFFICE_CONFIGURATION/);
});
test('disabled Office adds no material and other roles are unchanged',()=>{
 const control=configuration('control');const before=compileProductMaterialPlan({role:'control',configuration:control,runtimeUser:'1000:1000'});
 assert.equal(before.requiredFiles.some(file=>file.purposes.some(p=>p.startsWith('office-'))),false);
 const worker=configuration('temporal-worker');const plan=compileProductMaterialPlan({role:'temporal-worker',configuration:worker,runtimeUser:'1000:1000'});
 assert.equal(plan.requiredFiles.some(file=>file.purposes.some(p=>p.startsWith('office-'))),false);
});
