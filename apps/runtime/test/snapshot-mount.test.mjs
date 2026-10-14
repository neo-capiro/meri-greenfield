import test from 'node:test';import assert from 'node:assert/strict';
import {assembleControl} from '../control.mjs';
import {captureRuntimePorts} from '../product-applications.mjs';
import {createNativeRunnerGateway} from '../native-runner-gateway.mjs';
import {listenRuntime} from '../http-server.mjs';
import {versions,binding} from '../../control/conversations/test/store-fixture.mjs';
const configuration={sourceEnabled:false,http:{hostname:'127.0.0.1',port:0,frontendOrigin:'http://127.0.0.1'},limits:{requestMs:1000,requestBytes:131072,shutdownMs:1000},native:{maxResponseBytes:131072},temporal:{taskQueue:'synthetic'},sessions:{maxSessions:10,maxTtlMs:3000},versions};
const unused=()=>{throw Error('Unrelated owner must remain unused');};
const assembly=productPorts=>assembleControl({configuration,pool:{query:unused,connect:unused},client:{workflow:{start:unused,getHandle:unused}},native:{call:unused},productPorts});
const post=(origin,credential='original-task')=>fetch(origin+'/v1/runner/session/snapshot',{method:'POST',headers:{authorization:'Bearer '+credential,'content-type':'application/json'},body:JSON.stringify({binding})});
test('actual control mount and fixed loopback relay deliver snapshot to captured canonical port',async()=>{
 let calls=0,revoked=false;const expected={binding,fixture:'synthetic-checkpoint',entries:[{opaque:[1,1]}]};
 const supplied={async readSnapshot(v){calls++;assert.deepEqual(v.request,{binding});assert.ok(v.signal instanceof AbortSignal);assert.ok(Number.isSafeInteger(v.deadlineMs));if(v.credential!=='original-task'||revoked)throw Object.assign(Error('refused'),{code:'SDK_SESSION_REFUSED'});return expected;}};
 const control=assembly({sdkSessionSnapshot:supplied});supplied.readSnapshot=unused;let server,relay;
 try{server=await listenRuntime({configuration,application:control.application,readiness:async()=>{}});const controlOrigin='http://127.0.0.1:'+server.address.port;
  const gateway=createNativeRunnerGateway({controlOrigin,fetchImpl:fetch,enabled:true,loopback:true,limits:{maxRequestMs:1000,maxRequestBytes:9437184,maxResponseBytes:35651584}});
  relay=await listenRuntime({configuration,application:{handle:async request=>(await gateway.handle(request))??Response.json({error:'NOT_FOUND'},{status:404})},readiness:async()=>{}});
  const relayOrigin='http://127.0.0.1:'+relay.address.port,result=await post(relayOrigin);assert.equal(result.status,200);assert.equal(result.headers.get('cache-control'),'no-store');assert.deepEqual(await result.json(),expected);
  assert.equal((await post(relayOrigin,'foreign-task')).status,403);revoked=true;assert.equal((await post(relayOrigin)).status,403);assert.equal(calls,3);
  assert.equal((await fetch(relayOrigin+'/api/conversations/snapshot',{method:'POST',body:'{}'})).status,404);
 }finally{await relay?.close();await server?.close();control.close();}
});
test('snapshot remains 404 when no borrowed snapshot port is supplied',async()=>{const control=assembly({});try{const request=new Request('https://control.synthetic.invalid/v1/runner/session/snapshot',{method:'POST',headers:{authorization:'Bearer original-task','content-type':'application/json'},body:JSON.stringify({binding})});assert.equal((await control.application.handle(request)).status,404);}finally{control.close();}});
test('snapshot port getters and proxies refuse without invocation or transport',()=>{let reads=0;for(const snapshot of [Object.defineProperty({},'readSnapshot',{enumerable:true,get(){reads++;throw Error('getter');}}),new Proxy({}, {get(){reads++;throw Error('proxy');}})])assert.throws(()=>captureRuntimePorts({sdkSessionSnapshot:snapshot}));const ports=Object.defineProperty({},'sdkSessionSnapshot',{enumerable:true,get(){reads++;throw Error('outer getter');}});assert.throws(()=>captureRuntimePorts(ports));assert.equal(reads,0);});
