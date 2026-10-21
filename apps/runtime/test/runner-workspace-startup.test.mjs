/** Source composition regression, with synthetic mount/identity and authenticated
 * transport/material fixtures. No provider process, request or host /workspace. */
import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import * as nativeFs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {workspaceFixture} from './runner-workspace-fixture.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {validateConfiguration} from '../config.mjs';
let mount,providerCalls=0;
mock.module('node:fs/promises',{namedExports:{...nativeFs,
 lstat:(...args)=>mount.fs.lstat(...args),realpath:(...args)=>mount.fs.realpath(...args),
 open:(...args)=>mount.fs.open(...args),mkdir:(...args)=>mount.fs.mkdir(...args),rmdir:(...args)=>mount.fs.rmdir(...args)}});
mock.module('../../worker/conversation/activity.mjs',{namedExports:{createConversationActivity(){providerCalls++;throw Error('PROVIDER_FORBIDDEN');}}});
const {runRunnerPoststart}=await import('../runner-poststart-bootstrap.mjs');
const {startRunnerProductTask}=await import('../runner-poststart-cli.mjs');
const {assertRunnerWorkspace}=await import('../conversation-runner.mjs');

function syntheticIdentity(t){for(const [key,value]of Object.entries({platform:'linux',getuid:()=>1000,getgid:()=>1000})){
 const descriptor=Object.getOwnPropertyDescriptor(process,key);Object.defineProperty(process,key,{configurable:true,value});
 t.after(()=>{if(descriptor)Object.defineProperty(process,key,descriptor);else delete process[key];});
 }t.mock.method(globalThis,'fetch',()=>{providerCalls++;throw Error('NETWORK_FORBIDDEN');});}
function startupFixture(){
 mount=workspaceFixture();const f=mount,events=[],ca=Buffer.from('synthetic public CA'),caSha=createHash('sha256').update(ca).digest('hex'),origin='https://control.invalid',taskArn='arn:aws:ecs:us-east-1:967807252336:task/test/'+'a'.repeat(32);
 const expected={binding:f.configuration.binding,versions:f.configuration.versions,taskArn,taskRevision:1,expiresAtMs:f.original.expiresAtMs,origin,san:['control.invalid'],caSha256:caSha,capabilitySha256:'c'.repeat(64),materialRef:'material:'+f.original.executionKey,bootstrapRef:'d'.repeat(64)};
 f.configuration={version:1,profile:'isolated-preview',sourceEnabled:false,runWindowMs:900000,limits:{startupMs:5000,shutdownMs:1000,requestMs:1000,requestBytes:131072},
  ...f.configuration,native:{origin,capabilityFile:'/run/meri/poststart/bootstrap/task-capability',loopback:false,maxResponseBytes:2097152},
  proxyOrigin:'https://proxy.invalid',bootstrap:{remote:true,expiresAtMs:f.original.expiresAtMs},captureOwnsClose:true};
 validateConfiguration(f.configuration,'conversation-runner');
 const response={schemaVersion:1,original:f.original,expected,delivery:{synthetic:true},tls:{zone:'runner.invalid',ca:ca.toString('base64'),cert:ca.toString('base64'),candidate:{taskArn,executionKey:f.original.executionKey,bindingSha256:hash(expected.binding),expiresAtMs:f.original.expiresAtMs}}};
 const dependencies={
  async readMetadata(){return {TaskARN:taskArn,Cluster:'arn:aws:ecs:us-east-1:967807252336:cluster/test',Containers:[{Name:'worker'}]};},
  createTransport(){return {async post(step){events.push(step);return step==='challenge'?{schemaVersion:1,challengeId:'11111111-1111-4111-8111-111111111111',proofMessage:Buffer.alloc(32,1).toString('base64'),expiresAtMs:Date.now()+15000}:response;}};},
  createCsr(){return {csrPem:'synthetic CSR',keyPem:'synthetic key',signProof:()=> 'synthetic-proof'};},
  async createDirectory(){events.push('material-directory');return {dev:1,ino:90,uid:1000};},
  async writeTls(){events.push('tls');return {descriptor:{zone:'runner.invalid'},receipt:{synthetic:true}};},
  async materialize(){events.push('materialize');return {configuration:f.configuration,configFile:'/run/meri/poststart/bootstrap/runner-config.json',caFile:'/run/meri/poststart/bootstrap/control-ca.pem',receipt:{synthetic:true}};},
  async release(){events.push('failed-bootstrap-release');},
 };
 const environment={MERI_PRODUCT_PREVIEW_REQUIRED:'1',MERI_POSTSTART_CONTROL_ORIGIN:origin,MERI_POSTSTART_CA_BASE64:ca.toString('base64'),MERI_POSTSTART_CA_SHA256:caSha,ECS_CONTAINER_METADATA_URI_V4:'http://169.254.170.2/v4/test',MERI_RUNNER_SHA256:'b'.repeat(64)};
 return {f,events,options:{argv:['start'],environment,bootstrap:input=>runRunnerPoststart(input,dependencies),
  makeNativeFetch:async()=>async()=>{providerCalls++;throw Error('PROVIDER_FORBIDDEN');},
  runtime:async()=>{await assertRunnerWorkspace(f.configuration);events.push('runtime-preflight');return 0;},
  release:async()=>{events.push('completed-release');},report:(stage,error)=>events.push([stage,error.step,error.code])}};
}

test('real poststart initializer makes a fresh image-style mount pass the unchanged runtime workspace preflight',async t=>{
 syntheticIdentity(t);const {f,events,options}=startupFixture();
 assert.deepEqual([...f.directories.keys()],['/workspace']);await assert.rejects(assertRunnerWorkspace(f.configuration),{code:'ENOENT'});
 assert.equal(await startRunnerProductTask(options),0);
 assert.deepEqual(events,['challenge','redeem','material-directory','tls','materialize','runtime-preflight','completed-release']);
 assert.equal(f.events.filter(([operation])=>operation==='mkdir').length,1);assert.ok(f.directories.has(f.configuration.workspace));assert.equal(providerCalls,0);
});

test('a bad mount fails after materialization and before runtime, with exact bundle cleanup and no provider call',async t=>{
 syntheticIdentity(t);const {f,events,options}=startupFixture();f.directories.get('/workspace').uid=0;
 assert.equal(await startRunnerProductTask(options),2);
 assert.deepEqual(events,['challenge','redeem','material-directory','tls','materialize','failed-bootstrap-release',['bootstrap','workspace','RUNNER_WORKSPACE_REFUSED']]);
 assert.equal(f.directories.has(f.configuration.workspace),false);assert.equal(providerCalls,0);
});
