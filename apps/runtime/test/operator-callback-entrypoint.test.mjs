import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import * as config from '../config.mjs';
let raw,reads=[],loads=[],calls=[],closed=0;
const origin='https://control.meri-preview.internal';
const configuration={profile:'isolated-preview',limits:{startupMs:5000,shutdownMs:100},native:{origin,loopback:false,preparedKickoff:true},http:{port:8081}};
mock.module('../config.mjs',{namedExports:{...config,readSecret:async path=>{reads.push(path);return Buffer.from(JSON.stringify(raw));},loadConfiguration:async(path,role)=>{loads.push({path,role});return configuration;}}});
mock.module('../agentcore-entrypoint.mjs',{namedExports:{mainOperatorAgentCore:async callback=>{calls.push({role:'agentcore',callback});return 0;}}});
mock.module('../temporal-worker.mjs',{namedExports:{startTemporalWorker:async()=>assert.fail('No default startup in case executable'),startOperatorTemporalWorker:async(c,callback,options)=>{
 calls.push({role:'temporal-worker',configuration:c,callback,options});return {address:'synthetic',completion:Promise.resolve(),close:async()=>{closed++;}};
}}});
// The PKI fixture imports the ordinary renderer, which imports cli.mjs. Install
// startup I/O mocks first so that cached CLI binding is the intended test boundary.
const {descriptor}=await import('./operator-callback.fixture.mjs');raw=descriptor();
const {main}=await import('../operator-callback-entrypoint.mjs');
const {mainOperatorTemporalWorker}=await import('../cli.mjs');
test('separate executable reads only the fixed protected mount and selects explicit named startup',async()=>{
 const before=process.env.MERI_PRODUCT_PREVIEW_REQUIRED;delete process.env.MERI_PRODUCT_PREVIEW_REQUIRED;
 try{
  assert.equal(await main(['agentcore']),0);assert.equal(await main(['temporal-worker','--config','/run/meri/worker.json']),0);
  assert.deepEqual(reads,['/run/meri-operator/callback.json','/run/meri-operator/callback.json']);
  assert.deepEqual(loads,[{path:'/run/meri/worker.json',role:'temporal-worker'}]);assert.deepEqual(calls.map(x=>x.role),['agentcore','temporal-worker']);
  assert.deepEqual(calls[0].callback,raw);assert.deepEqual(calls[1].callback,raw);assert.equal(closed,1);assert.ok(calls[1].options.signal instanceof AbortSignal);
 }finally{if(before===undefined)delete process.env.MERI_PRODUCT_PREVIEW_REQUIRED;else process.env.MERI_PRODUCT_PREVIEW_REQUIRED=before;}
});
test('invalid roles/arguments and unknown protected fields cannot reach any startup',async()=>{
 const initialCalls=calls.length,initialReads=reads.length;
 for(const argv of [[],['control'],['agentcore','--endpoint','10.0.0.7'],['temporal-worker','--config']])assert.equal(await main(argv),2);
 assert.equal(reads.length,initialReads);raw={...descriptor(),testOwners:{}};assert.equal(await main(['agentcore']),2);assert.equal(calls.length,initialCalls);
 assert.equal(await mainOperatorTemporalWorker(descriptor(),['control','--config','/run/meri/control.json']),2);assert.equal(calls.length,initialCalls);
});
