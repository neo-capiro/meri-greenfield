/** Only external startup owners are module-mocked; no test selectors reach case startup. */
import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {descriptor,credential,origin} from './operator-callback.fixture.mjs';
import {binding} from '../../control/conversations/test/store-fixture.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
let events=[],transports=[],paths=[],workerOptions,nativeOwnerClient,queryOptions,secret=credential,connectFails=false,mode;
const ordinaryFetch=()=>assert.fail('No ordinary fetch in operator case');
mock.module('../operator-callback-transport.mjs',{namedExports:{createOperatorCallbackTransport(raw){
 const expiresAtMs=Date.now()+60000;
 const transport={raw,async fetch(url,options){paths.push(url);assert.equal(options.headers.authorization,'Bearer '+credential);
  const body=JSON.parse(options.body),path=new URL(url).pathname;
  const value=path==='/v1/readiness'?{service:'meri-native-capability-provider/1',ready:true}:path==='/v1/execution/kickoff'?{binding:body.binding,executionId:hash(body.binding),expiresAtMs}:
   path.endsWith('/prerequisite')?{kind:'none'}:path==='/v1/execution/kickoff/status'?{binding:body.binding,executionId:body.executionId,expiresAtMs,state:'completed'}:{original:true};
  return Response.json(value);},close(){events.push('transport-close');}};transports.push(transport);return transport;
}}});
mock.module('../config.mjs',{namedExports:{readSecret:async()=>Buffer.from(secret),fault:code=>Object.assign(Error(code),{code})}});
mock.module('../temporal-tls.mjs',{namedExports:{readRuntimeTemporalTls:async()=>({synthetic:true})}});
mock.module('@temporalio/activity',{namedExports:{Context:{current:()=>({cancellationSignal:new AbortController().signal,heartbeat(){}})}}});
mock.module('@temporalio/worker',{namedExports:{NativeConnection:{connect:async()=>{if(connectFails)throw Error('synthetic connect failure');return {close:async()=>{events.push('connection-close');}};}},Worker:{create:async options=>{
 workerOptions=options;let state='INITIALIZED';const completion=Promise.withResolvers();return {getState:()=>state,run(){state='RUNNING';return completion.promise;},shutdown(){state='STOPPED';events.push('worker-stop');completion.resolve();}};
}}}});
mock.module('../native-worker-owners.mjs',{namedExports:{createNativeWorkerOwners:async({native})=>{nativeOwnerClient=native;return {close:async()=>{events.push('native-owners-close');}};}}});
mock.module('../http-server.mjs',{namedExports:{listenRuntime:async()=>{if(mode==='agentcore')queueMicrotask(()=>process.emit('SIGTERM'));return {address:'synthetic',close:async()=>{events.push('listener-close');return {listenerStopped:true,pendingRequests:0};}};}}});
mock.module('../agentcore-control-client.mjs',{namedExports:{agentcoreEnvironment:()=>({origin:'https://ordinary.invalid',region:'us-east-1'}),createAgentCoreControlTransport:()=>({fetch:ordinaryFetch,close:()=>events.push('ordinary-close')})}});
mock.module('../agentcore-workspace.mjs',{namedExports:{createAgentCoreWorkspace:()=>({synthetic:true})}});
mock.module('../agentcore-query.mjs',{namedExports:{createAgentCoreQuery:options=>{queryOptions=options;return async()=>assert.fail('No SDK/model invocation');}}});
mock.module('../agentcore-http.mjs',{namedExports:{createAgentCoreApplication:()=>({close:async()=>({settled:true})})}});
mock.module('../sdk-provider-credentials.mjs',{namedExports:{createSdkProviderCredentials:()=>({close:()=>events.push('provider-close')})}});
mock.module('../artifacts/renderer-http.mjs',{namedExports:{createRuntimeRendererApplication:()=>({})}});
mock.module('../uploads/agentcore-http.mjs',{namedExports:{composeUploadInspectionHost:async()=>({missing:[],inspection:{}}),createUploadInspectionApplication:()=>({})}});
const {startOperatorTemporalWorker}=await import('../temporal-worker.mjs');
const {main,mainOperatorAgentCore}=await import('../agentcore-entrypoint.mjs');
const configuration=()=>({native:{origin,loopback:false,preparedKickoff:true,capabilityFile:'/synthetic/case-control',maxResponseBytes:1048576},nativeProvisioning:{enabled:false},
 temporal:{namespace:'meri',taskQueue:'synthetic',address:'temporal.synthetic.invalid:7233',tls:{}},limits:{requestMs:1000,shutdownMs:100},http:{port:8081}});
function reset(){events=[];transports=[];paths=[];secret=credential;connectFails=false;mode='worker';}
test('operator Temporal uses one native client/transport for readiness, actual broker and native cleanup owners',async()=>{
 reset();const runtime=await startOperatorTemporalWorker(configuration(),descriptor());
 try{
  assert.equal(transports.length,1);assert.deepEqual(await workerOptions.activities.executeConversation({binding}),{state:'completed'});
  await nativeOwnerClient.call('execution/native/host-authority',{binding});await nativeOwnerClient.call('execution/native/host-teardown',{binding});
  assert.deepEqual(paths.map(x=>new URL(x).pathname),['/v1/readiness','/v1/execution/kickoff','/v1/execution/native/prerequisite','/v1/execution/browser/prerequisite','/v1/execution/kickoff/status','/v1/execution/native/host-authority','/v1/execution/native/host-teardown']);
  assert.ok(paths.every(x=>x.startsWith(origin+'/')));
 }finally{await runtime.close();}
 assert.equal(events.filter(x=>x==='transport-close').length,1);assert.ok(events.indexOf('native-owners-close')<events.indexOf('transport-close'));
});
test('operator Temporal rejects test selectors/mixed identity before startup; startup failure closes the owned transport',async()=>{
 reset();assert.throws(()=>startOperatorTemporalWorker(configuration(),descriptor(),{testOwners:{}}));
 assert.throws(()=>startOperatorTemporalWorker({...configuration(),nativeProvisioning:{enabled:true}},descriptor()));assert.equal(transports.length,0);
 secret='synthetic-production-'.repeat(3);await assert.rejects(startOperatorTemporalWorker(configuration(),descriptor()));assert.equal(transports.length,0);assert.equal(paths.length,0);
 reset();connectFails=true;await assert.rejects(startOperatorTemporalWorker(configuration(),descriptor()));assert.equal(transports.length,1);assert.equal(events.filter(x=>x==='transport-close').length,1);
});
test('named AgentCore startup supplies one case fetch to existing query; default startup remains ordinary',async()=>{
 reset();mode='agentcore';const region=process.env.AWS_REGION;process.env.AWS_REGION='us-east-1';
 try{
  assert.equal(await mainOperatorAgentCore(descriptor()),0);assert.equal(transports.length,1);assert.equal(queryOptions.fetchImpl,transports[0].fetch);assert.equal(queryOptions.origin,origin);
  assert.equal(events.filter(x=>x==='transport-close').length,1);assert.equal(events.filter(x=>x==='provider-close').length,1);
  assert.equal(await main([]),0);assert.equal(queryOptions.fetchImpl,ordinaryFetch);assert.equal(queryOptions.origin,'https://ordinary.invalid');assert.equal(transports.length,1);
  assert.throws(()=>mainOperatorAgentCore({...descriptor(),testOwners:{}}));
 }finally{if(region===undefined)delete process.env.AWS_REGION;else process.env.AWS_REGION=region;}
});
