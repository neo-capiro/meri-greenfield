import test from 'node:test';
import assert from 'node:assert/strict';
import {startRunnerProductTask} from '../runner-poststart-cli.mjs';

const environment={MERI_PRODUCT_PREVIEW_REQUIRED:'1',MERI_POSTSTART_CONTROL_ORIGIN:'https://control.private.invalid',
 MERI_POSTSTART_CA_BASE64:Buffer.from('synthetic public CA').toString('base64'),MERI_POSTSTART_CA_SHA256:'a'.repeat(64),
 ECS_CONTAINER_METADATA_URI_V4:'http://169.254.170.2/v4/test',MERI_RUNNER_SHA256:'b'.repeat(64)};
test('poststart material is passed only to the product runner and released exactly once',async()=>{
 const calls=[],material={configFile:'/run/meri/poststart/bootstrap/runner-config.json',controlCaFile:'/run/meri/poststart/bootstrap/control-ca.pem',tls:{zone:'runner.private.invalid'},receipt:{owned:true}},nativeFetch=async()=>{};
 const result=await startRunnerProductTask({argv:['start'],environment,bootstrap:async input=>{calls.push(['bootstrap',input.directory]);return material;},
  makeNativeFetch:async input=>{calls.push(['native-ca',input]);return nativeFetch;},runtime:async(argv,options)=>{calls.push(['runtime',argv,options]);return 0;},release:async input=>{calls.push(['release',input.directory,input.receipt]);}});
 assert.equal(result,0);assert.deepEqual(calls.map(row=>row[0]),['bootstrap','native-ca','runtime','release']);
 assert.equal(calls[1][1].caFile,material.controlCaFile);
 assert.deepEqual(calls[2][1],['conversation-runner','--config',material.configFile]);
 assert.strictEqual(calls[2][2].poststartTls,material.tls);assert.strictEqual(calls[2][2].nativeFetch,nativeFetch);
 assert.equal(calls[3][1],'/run/meri/poststart');assert.strictEqual(calls[3][2],material.receipt);
});
test('missing immutable pin refuses before poststart and cleanup uncertainty fails the task',async()=>{
 let calls=0;const bootstrap=async()=>{calls++;return {configFile:'/run/meri/x',controlCaFile:'/run/meri/ca.pem',tls:{},receipt:{}};};
 assert.equal(await startRunnerProductTask({argv:['start'],environment:{...environment,MERI_POSTSTART_CA_SHA256:'bad'},bootstrap}),2);
 assert.equal(calls,0);
 assert.equal(await startRunnerProductTask({argv:['start'],environment,bootstrap,makeNativeFetch:async()=>async()=>{},runtime:async()=>0,release:async()=>{throw Error('uncertain');}}),3);
});
test('a failed startup reports one constant stage and code, never a message or value',async()=>{
 const reports=[],report=(stage,error)=>reports.push([stage,typeof error?.code==='string'&&/^[A-Z][A-Z0-9_]{0,63}$/u.test(error.code)?error.code:'UNKNOWN']);
 assert.equal(await startRunnerProductTask({argv:['start'],environment:{...environment,MERI_POSTSTART_CA_SHA256:'bad'},report}),2);
 assert.deepEqual(reports.at(-1),['pins','UNKNOWN']);
 assert.equal(await startRunnerProductTask({argv:['start'],environment,report,bootstrap:async()=>{throw Object.assign(Error('secret detail'),{code:'RUNNER_POSTSTART_REFUSED'});}}),2);
 assert.deepEqual(reports.at(-1),['bootstrap','RUNNER_POSTSTART_REFUSED']);
 const material={configFile:'/run/meri/x',controlCaFile:'/run/meri/ca.pem',tls:{},receipt:{}};
 assert.equal(await startRunnerProductTask({argv:['start'],environment,report,bootstrap:async()=>material,makeNativeFetch:async()=>{throw Object.assign(Error('x'),{code:'not constant'});},release:async()=>{}}),2);
 assert.deepEqual(reports.at(-1),['native-transport','UNKNOWN']);
});
