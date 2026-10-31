import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createNativeObserverHandler,observerExecutedVersion,observerEntrypointConfiguration,handler} from '../native-observer-entrypoint.mjs';
import {observerFixture} from './native-observer-fixture.mjs';
const f=await observerFixture(),version=f.declaration.physicalObserver.bridgeFunctionVersionArn;
const sha=b=>createHash('sha256').update(b).digest('hex');
const ca=f.declaration.bootstrapSpec.issuerCaCertificate;
const secret=JSON.stringify({schema:'meri-native-observer-material/1',keyId:'observer-v1',keyBase64:Buffer.alloc(32,19).toString('base64'),caCertificate:ca});
const configuration={schema:'meri-native-observer-entrypoint/1',functionArn:version.replace(/:3$/u,''),
 stateMachineArn:f.declaration.watchdog.stateMachineVersionArn.replace(/:[1-9][0-9]*$/u,''),keyId:'observer-v1',
 secretArn:'arn:aws:secretsmanager:us-east-1:111122223333:secret:synthetic/native-observer-Abc123',secretVersionId:'a'.repeat(32),secretSha256:sha(secret),caSha256:sha(ca)};
const response={ARN:configuration.secretArn,VersionId:configuration.secretVersionId,SecretString:secret};
const event={schema:'meri-native-observer-invocation/1',mode:'prepare',originalInput:f.declaration.watchdog.input,executionArn:f.declaration.watchdog.executionArn};
const context={functionName:configuration.functionArn.split(':').at(-1),functionVersion:'3',invokedFunctionArn:version,getRemainingTimeInMillis:()=>10000};
test('actual entrypoint joins immutable secret version, qualified context and existing bridge without persisting key bytes',async()=>{
 let fetched=0,posted=0,borrowed;
 const run=createNativeObserverHandler({configuration,now:()=>62000,fetchSecret:async args=>{
  fetched++;assert.equal(args.secretArn,configuration.secretArn);assert.equal(args.secretVersionId,configuration.secretVersionId);assert.ok(args.signal);return response;
 },post:async packet=>{posted++;borrowed=packet.ca;assert.equal(packet.ca.toString(),ca);
  assert.equal(JSON.parse(packet.body).bridgeFunctionVersionArn,version);return {disposition:'pending'};}});
 assert.deepEqual(await run(event,context),{disposition:'pending'});assert.equal(fetched,1);assert.equal(posted,1);
 assert.ok(borrowed.every(n=>n===0));
});
test('alias/unqualified/latest/mismatched actual version and event-spoofed invocation refuse before secret read',async()=>{
 let calls=0;const run=createNativeObserverHandler({configuration,now:()=>62000,fetchSecret:async()=>{calls++;return response;},post:async()=>({})});
 for(const change of [{invokedFunctionArn:configuration.functionArn},{invokedFunctionArn:configuration.functionArn+':alias'},
  {functionVersion:'$LATEST'},{functionVersion:'4'},{functionVersion:undefined},{functionVersion:'03'},{functionName:'foreign'},
  {invokedFunctionArn:version.replace('observer','foreign')}]){
  await assert.rejects(()=>run({...event,functionVersion:'3',invokedFunctionArn:version},{...context,...change}));
 }
 await assert.rejects(()=>run({...event,mode:'terminate'},context));assert.equal(calls,0);
 for(const mutate of [e=>e.originalInput.physicalObserver.bridgeFunctionVersionArn=version.replace(':3',':4'),
  e=>e.executionArn=e.executionArn.replace(':meri:',':foreign:'),e=>e.originalInput.accountId='999900001111',
  e=>e.target='https://foreign.invalid',e=>e.originalInput.executionName='foreign']){
  const changed=structuredClone(event);mutate(changed);await assert.rejects(()=>run(changed,context));
 }
 await assert.rejects(()=>run(event,undefined));assert.equal(calls,0);
});
test('changed secret response identity, bytes, config or expired original window never posts',async()=>{
 let calls=0;
 for(const altered of [{...response,VersionId:'b'.repeat(32)},{...response,ARN:response.ARN+'x'},{...response,SecretString:secret+' '},
  {...response,SecretBinary:Buffer.from('x')}]){
  const run=createNativeObserverHandler({configuration,now:()=>62000,fetchSecret:async()=>altered,post:async()=>{calls++;return {};}});
  await assert.rejects(()=>run(event,context));
 }
 const expired=createNativeObserverHandler({configuration,now:()=>86000,fetchSecret:async()=>{calls++;return response;}});
 await assert.rejects(()=>expired(event,context));assert.equal(calls,0);
 assert.throws(()=>observerEntrypointConfiguration({...configuration,arbitraryUrl:'https://elsewhere.invalid'}));
 assert.throws(()=>observerExecutedVersion(configuration,{...context,invokedFunctionArn:version+':alias'}));
});
test('default deployment entrypoint refuses absent configuration without a provider client',async()=>{
 const prior=process.env.MERI_NATIVE_OBSERVER_CONFIG;delete process.env.MERI_NATIVE_OBSERVER_CONFIG;
 try{await assert.rejects(()=>handler(event,context),/NATIVE_OBSERVER_ENTRYPOINT_REFUSED/u);}
 finally{if(prior!==undefined)process.env.MERI_NATIVE_OBSERVER_CONFIG=prior;}
});
