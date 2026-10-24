import test from 'node:test';import assert from 'node:assert/strict';
import {listenRuntime} from '../http-server.mjs';import {createAgentCoreApplication} from '../agentcore-http.mjs';import {createExecutionBinding} from '../../control/conversations/execution-boundary.mjs';import {binding,versions} from '../../control/conversations/test/store-fixture.mjs';import {AGENTCORE_SESSION_HEADER,settlementFor} from '../agentcore-contract.mjs';
test('real HTTP listener serves AgentCore ping and invocation, closes owned sockets and never replays a run',async()=>{
 const {versions:_,...execution}=createExecutionBinding({binding,versions,plan:{synthetic:true},expiresAtMs:Date.now()+60000,runtimeSessionId:'synthetic-session-11111111111111111111'});let calls=0;
 const app=createAgentCoreApplication({execute:async value=>{calls++;return settlementFor(value.execution,'completed');}}),server=await listenRuntime({configuration:{http:{hostname:'127.0.0.1',port:0},limits:{requestMs:3000,shutdownMs:1000}},application:app,readiness:async()=>{},exposeReadiness:false});
 try{const origin='http://127.0.0.1:'+server.address.port;assert.deepEqual(await (await fetch(origin+'/ping')).json(),{status:'Healthy'});
 const options={method:'POST',headers:{'content-type':'application/json',[AGENTCORE_SESSION_HEADER]:execution.runtimeSessionId},body:JSON.stringify({execution,versions,credential:'synthetic-run-only'})};
 const response=await fetch(origin+'/invocations',options);assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/event-stream/);assert.match(await response.text(),/"settled":true/);
 const duplicate=await fetch(origin+'/invocations',options);assert.equal(duplicate.status,409);await duplicate.arrayBuffer();assert.equal(calls,1);const hidden=await fetch(origin+'/health/ready');assert.equal(hidden.status,404);await hidden.arrayBuffer();
 }finally{assert.deepEqual(await app.close({deadlineMs:Date.now()+1000}),{settled:true});const result=await server.close();assert.equal(result.listenerStopped,true);assert.equal(result.pendingRequests,0);}
});
