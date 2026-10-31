import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeObserverHttpApplication,NATIVE_OBSERVER_ORIGIN} from '../native-observer-http.mjs';
import {createNativeObserverBridge} from '../native-observer-bridge.mjs';
import {observerFixture} from './native-observer-fixture.mjs';
const f=await observerFixture(),original=f.declaration.watchdog.input,version=f.declaration.physicalObserver.bridgeFunctionVersionArn;
const secret=Buffer.alloc(32,37),ca=Buffer.from('synthetic-private-CA');
const input={schema:'meri-native-observer-invocation/1',mode:'prepare',originalInput:original,executionArn:f.declaration.watchdog.executionArn};
const context={invokedFunctionArn:version,getRemainingTimeInMillis:()=>10000};
function options(extra={}){return {functionVersionArn:version,stateMachineVersionArn:f.declaration.watchdog.stateMachineVersionArn,
 keyId:'observer-v1',readKey:async()=>secret,readCa:async()=>ca,now:()=>62000,...extra};}
test('version-pinned adapter and dedicated verifier join exact bytes, invocation and original graph input',async()=>{
 let observed=0;
 const app=createNativeObserverHttpApplication({now:()=>62001,readKey:async key=>{assert.equal(key,'observer-v1');return secret;},
  observeIntent:async body=>{observed++;assert.equal(body.mode,'prepare');assert.equal(body.expiresAtMs,65000);
   assert.equal(body.originalInputSha256,f.declaration.watchdog.inputSha256);return {disposition:'pending'};}});
 const bridge=createNativeObserverBridge(options({post:async({body,headers,ca:privateCa})=>{
  assert.deepEqual(privateCa,ca);const result=await app.handle(new Request(NATIVE_OBSERVER_ORIGIN+'/v1/execution/native/physical-observer',
   {method:'POST',body,headers}));assert.equal(result.status,200);return result.json();}}));
 assert.deepEqual(await bridge(input,context),{disposition:'pending'});assert.equal(observed,1);
 assert.deepEqual(secret,Buffer.alloc(32,37),'borrowed secret is never cleared');
});
test('wrong mode/version, MAC/body tampering, bearer substitution and expired calls never reach observation',async()=>{
 let observed=0,packet;
 const bridge=createNativeObserverBridge(options({post:async p=>{packet=p;return {disposition:'pending'};}}));
 await assert.rejects(()=>bridge({...input,mode:'cleanup'},context));
 await assert.rejects(()=>bridge(input,{...context,invokedFunctionArn:version.replace(':3',':4')}));
 await bridge(input,context);
 for(const change of [
  p=>{p.headers['x-meri-observer-mac']='0'.repeat(64);},
  p=>{p.body=Buffer.from('{}');},p=>{p.headers.authorization='Bearer broad-control';},
  p=>{p.headers['x-meri-observer-expires']='62000';},
 ]){
  const p={body:Buffer.from(packet.body),headers:{...packet.headers}};change(p);
  const app=createNativeObserverHttpApplication({now:()=>62001,readKey:async()=>secret,observeIntent:async()=>{observed++;}});
  const result=await app.handle(new Request(NATIVE_OBSERVER_ORIGIN+'/v1/execution/native/physical-observer',{method:'POST',...p}));
  assert.equal(result.status,403);
 }
 assert.equal(observed,0);
});
