import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {canonicalSha256} from '../../packages/contracts/validate.mjs';
import {synthesizeProductPreview} from './manifest.mjs';

const account='967807252336',sha='a'.repeat(64),sourceCommit='c'.repeat(40),refused=/PRODUCT_PREVIEW_BINDING_REFUSED/u;
const controlCa=Buffer.from('synthetic reviewed public control CA'),controlCaSha=createHash('sha256').update(controlCa).digest('hex');
const resources=(template,type)=>Object.values(template.Resources).filter(resource=>resource.Type===type).map(resource=>resource.Properties);
function fixture(){
 const writer=()=>({status:'HOLD',initialTokenState:'absent',tokenFile:'/run/meri-temporal/token.json',
  publicKey:{manifestFile:'/run/meri/issuer-jwks.json'},tls:{issuerCaFile:'/run/meri/issuer-ca.pem'},
  bootstrap:{clientCaFile:'/run/meri/bootstrap-client-ca.pem',identityDirectory:'/run/meri-temporal/identity',
   clientKeyFile:'/run/meri-temporal/identity/client-key.pem',clientCertFile:'/run/meri-temporal/identity/client-cert.pem',initialIdentityState:'absent'},
  sha256ByPath:{'/run/meri/issuer-jwks.json':'d'.repeat(64),'/run/meri/issuer-ca.pem':'e'.repeat(64),'/run/meri/bootstrap-client-ca.pem':'f'.repeat(64)}});
 const temporalTokenWriters={control:writer(),temporalWorker:writer()};
 const envelope=role=>{
  const expected={schemaVersion:1,role:role==='control'?'control':'temporal-worker',runtimeUser:'1000:1000',sourceCommit,imageDigest:'sha256:'+sha,
   sha256ByPath:{[`/run/meri/${role==='control'?'control':'worker'}.json`]:'f'.repeat(64),
    ...temporalTokenWriters[role].sha256ByPath,...(role==='control'?{'/run/meri/control-ca.pem':controlCaSha}:{})}};
  return {valueFrom:`arn:aws:secretsmanager:us-east-1:${account}:secret:meri/${role}-ABC123:::${(role==='control'?'1':'2').repeat(32)}`,
   expected:{...expected,materialContractSha256:canonicalSha256(expected)}};
 };
 return {account,region:'us-east-1',enabled:false,sourceCommit,temporalTokenWriters,materialDelivery:{control:envelope('control'),temporalWorker:envelope('temporalWorker')},
  runnerPoststart:{controlOrigin:'https://control.synthetic.invalid',controlCaFile:'/run/meri/control-ca.pem',controlCaBase64:controlCa.toString('base64'),controlCaSha256:controlCaSha},
  clusterArn:`arn:aws:ecs:us-east-1:${account}:cluster/capiro-dev`,imageUri:`${account}.dkr.ecr.us-east-1.amazonaws.com/meri/product@sha256:${sha}`,
  logGroupName:'/meri/product',executionRoleArn:`arn:aws:iam::${account}:role/meri-execution`,controlTaskRoleArn:`arn:aws:iam::${account}:role/meri-control`,runtimeUser:'1000:1000',runnerSha256:sha,
  network:{privateSubnetId:'subnet-1234abcd',controlSecurityGroupId:'sg-1234abcd',workerSecurityGroupId:'sg-5678abcd',runnerSecurityGroupIds:['sg-abcd1234']},
  sizing:{control:{cpu:512,memoryMiB:1024,ephemeralStorageGiB:21},temporalWorker:{cpu:512,memoryMiB:1024,ephemeralStorageGiB:21},runner:{cpu:1024,memoryMiB:2048,ephemeralStorageGiB:50}}};
}
function reseal(binding,role){
 const expected=binding.materialDelivery[role].expected,{materialContractSha256,...value}=expected;void materialContractSha256;
 expected.materialContractSha256=canonicalSha256(value);
}

test('held writers add only a separate task-local RW token volume to each matching main container',()=>{
 const input=fixture(),template=synthesizeProductPreview(input),tasks=resources(template,'AWS::ECS::TaskDefinition');
 for(const family of ['control','temporal-worker']){
  const task=tasks.find(task=>task.Family==='meri-product-preview-'+family),[init,main]=task.ContainerDefinitions;
  assert.deepEqual(task.Volumes.map(volume=>volume.Name),['workspace','tmp','material','temporal-token']);
  assert.deepEqual(main.MountPoints.find(mount=>mount.SourceVolume==='temporal-token'),{SourceVolume:'temporal-token',ContainerPath:'/run/meri-temporal',ReadOnly:false});
  assert.deepEqual(main.MountPoints.find(mount=>mount.SourceVolume==='material'),{SourceVolume:'material',ContainerPath:'/run/meri',ReadOnly:true});
  assert.equal(init.MountPoints.some(mount=>mount.SourceVolume==='temporal-token'||mount.ContainerPath==='/run/meri-temporal'),false);
  assert.deepEqual(init.MountPoints,[{SourceVolume:'material',ContainerPath:'/run/meri',ReadOnly:false}]);
  assert.equal(main.User,'1000:1000');assert.equal(main.ReadonlyRootFilesystem,true);assert.equal(main.Privileged,false);
  assert.deepEqual(main.LinuxParameters.Capabilities.Drop,['ALL']);assert.deepEqual(main.DependsOn,[{ContainerName:'material-init',Condition:'SUCCESS'}]);
  assert.equal(task.ContainerDefinitions.length,2,'the existing main process owns its writer; no second worker/container');
 }
 const runner=tasks.find(task=>task.Family==='meri-product-preview-runner');
 assert.equal(runner.Volumes.some(volume=>volume.Name==='temporal-token'),false);
 assert.equal(runner.ContainerDefinitions.some(container=>container.MountPoints.some(mount=>mount.ContainerPath==='/run/meri-temporal')),false);
 assert.equal(resources(template,'AWS::ECS::Service').every(service=>service.DesiredCount===0),true);
 for(const descriptor of Object.values(input.temporalTokenWriters))assert.equal(descriptor.status,'HOLD');
 assert.equal(JSON.stringify(template).includes('/run/meri-temporal/token.json'),false,'the task template does not prewrite or inject a token');
 assert.equal(JSON.stringify(template).includes('/run/meri-temporal/identity/client-key.pem'),false,'the task template does not deliver a presealed client key');
 assert.equal(JSON.stringify(template).includes('/run/meri-temporal/identity/client-cert.pem'),false,'the task template does not deliver a presealed client certificate');
});

test('omitting the optional writer descriptors preserves the prior task-volume layout',()=>{
 const input=fixture();delete input.temporalTokenWriters;
 for(const task of resources(synthesizeProductPreview(input),'AWS::ECS::TaskDefinition')){
  assert.deepEqual(task.Volumes.map(volume=>volume.Name),['workspace','tmp','material']);
  assert.equal(task.ContainerDefinitions.some(container=>container.MountPoints.some(mount=>mount.ContainerPath==='/run/meri-temporal')),false);
 }
});

test('descriptor refs are closed, direct, distinct and exactly bound to independently pinned static issuer material',()=>{
 for(const mutate of [
  input=>{delete input.temporalTokenWriters.temporalWorker;},
  input=>{input.temporalTokenWriters.runner=structuredClone(input.temporalTokenWriters.control);},
  input=>{input.temporalTokenWriters.control.status='READY';},
  input=>{input.temporalTokenWriters.control.initialTokenState='existing';},
  input=>{input.temporalTokenWriters.control.tokenFile='/run/meri/temporal-token.json';},
  input=>{input.temporalTokenWriters.control.publicKey.manifestFile='/run/meri/../issuer-jwks.json';},
  input=>{input.temporalTokenWriters.control.publicKey.manifestFile='/run/meri/..';},
  input=>{input.temporalTokenWriters.control.tls.clientKeyFile='/run/meri/issuer-client.key';},
  input=>{input.temporalTokenWriters.control.tls.clientCertFile='/run/meri/issuer-client.crt';},
  input=>{input.temporalTokenWriters.control.bootstrap.clientCaFile=input.temporalTokenWriters.control.tls.issuerCaFile;},
  input=>{input.temporalTokenWriters.control.bootstrap.initialIdentityState='existing';},
  input=>{input.temporalTokenWriters.control.bootstrap.identityDirectory='/run/meri-temporal';},
  input=>{input.temporalTokenWriters.control.bootstrap.clientKeyFile='/run/meri/issuer-client.key';},
  input=>{input.temporalTokenWriters.control.bootstrap.clientCertFile='/run/meri-temporal/client-cert.pem';},
  input=>{input.temporalTokenWriters.control.bootstrap.callback='arbitrary.module';},
  input=>{input.temporalTokenWriters.control.publicKey.kid='not-filesystem-authority';},
  input=>{input.temporalTokenWriters.control.tls.serverName='caller.synthetic.invalid';},
  input=>{input.temporalTokenWriters.control.sha256ByPath['/run/meri/issuer-jwks.json']='9'.repeat(64);},
  input=>{delete input.temporalTokenWriters.control.sha256ByPath['/run/meri/issuer-ca.pem'];},
  input=>{input.temporalTokenWriters.control.sha256ByPath['/run/meri/unexpected.pem']='9'.repeat(64);},
  input=>{delete input.materialDelivery.control.expected.sha256ByPath['/run/meri/bootstrap-client-ca.pem'];reseal(input,'control');},
  input=>{input.materialDelivery.control.expected.sha256ByPath['/run/meri/bootstrap-client-ca.pem']='9'.repeat(64);reseal(input,'control');},
  input=>{input.materialDelivery.control.expected.sha256ByPath['/run/meri/temporal-token.json']='9'.repeat(64);reseal(input,'control');},
  input=>{input.materialDelivery.control.expected.sha256ByPath['/run/meri-temporal/token.json']='9'.repeat(64);reseal(input,'control');},
  input=>{input.materialDelivery.control.expected.sha256ByPath['/run/meri-temporal/identity/client-key.pem']='9'.repeat(64);reseal(input,'control');},
  input=>{input.materialDelivery.control.expected.sha256ByPath['/run/meri-temporal/identity/client-cert.pem']='9'.repeat(64);reseal(input,'control');},
  input=>{input.materialDelivery.control.expected.sha256ByPath['/run/meri/issuer-client.crt']='9'.repeat(64);reseal(input,'control');},
  input=>{input.materialDelivery.control.expected.sha256ByPath['/run/meri/issuer-client.key']='9'.repeat(64);reseal(input,'control');},
  input=>{input.materialDelivery.control.expected.sha256ByPath['/run/meri/issuer-client-cert.pem']='9'.repeat(64);reseal(input,'control');},
  input=>{input.materialDelivery.control.expected.sha256ByPath['/run/meri/issuer-client-key.pem']='9'.repeat(64);reseal(input,'control');},
 ]){const input=fixture();mutate(input);assert.throws(()=>synthesizeProductPreview(input),refused);}
});

test('shared public trust pins do not become a static client identity for either role',()=>{
 const input=fixture();assert.deepEqual(input.temporalTokenWriters.control.sha256ByPath,input.temporalTokenWriters.temporalWorker.sha256ByPath);
 for(const [role,writer] of Object.entries(input.temporalTokenWriters)){
  assert.equal(writer.bootstrap.initialIdentityState,'absent');
  assert.equal(Object.keys(writer.sha256ByPath).length,3);
  assert.equal(Object.hasOwn(input.materialDelivery[role].expected.sha256ByPath,writer.bootstrap.clientKeyFile),false);
  assert.equal(Object.hasOwn(input.materialDelivery[role].expected.sha256ByPath,writer.bootstrap.clientCertFile),false);
 }
 assert.equal(resources(synthesizeProductPreview(input),'AWS::ECS::Service').every(service=>service.DesiredCount===0),true);
});
