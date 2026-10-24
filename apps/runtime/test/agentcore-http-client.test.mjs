import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createAgentCoreApplication} from '../agentcore-http.mjs';
import {createAgentCoreClient} from '../agentcore-client.mjs';
import {AGENTCORE_SESSION_HEADER,settlementFor} from '../agentcore-contract.mjs';
import {createExecutionBinding} from '../../control/conversations/execution-boundary.mjs';
import {binding,versions,id} from '../../control/conversations/test/store-fixture.mjs';
const arn='arn:aws:bedrock-agentcore:us-east-1:123456789012:runtime/synthetic_runtime';
function input(changes={}){const {versions:_,...execution}=createExecutionBinding({binding,versions,plan:{synthetic:true},expiresAtMs:Date.now()+60000,runtimeSessionId:'synthetic-session-11111111111111111111',...changes});return {execution,versions,credential:'synthetic-run-only'};}
function request(value,changes={}){return new Request('http://synthetic.invalid/invocations',{method:'POST',headers:{'content-type':'application/json',[AGENTCORE_SESSION_HEADER]:value.execution.runtimeSessionId},body:JSON.stringify(value),...changes});}
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const body=value=>Readable.from([Buffer.from('data: '+JSON.stringify(value)+'\n\n')]);
function response(value,changes={}){return {$metadata:{httpStatusCode:200},statusCode:200,runtimeSessionId:value.execution.runtimeSessionId,contentType:'text/event-stream',response:body(settlementFor(value.execution,'completed')),...changes};}
function client(send){return createAgentCoreClient({region:'us-east-1',agentRuntimeArn:arn,qualifier:'preview',client:{send}});}

test('official SDK invoke forwards exact identity once and reads bound settled SSE',async()=>{
 const value=input(),calls=[];const c=client(async(command,options)=>{calls.push(command);assert.equal(options.abortSignal.aborted,false);return response(value);});
 assert.deepEqual(await c.invoke(value),settlementFor(value.execution,'completed'));assert.equal(calls.length,1);
 assert.equal(calls[0].constructor.name,'InvokeAgentRuntimeCommand');assert.equal(calls[0].input.runtimeSessionId,value.execution.runtimeSessionId);assert.equal(calls[0].input.qualifier,'preview');assert.deepEqual(JSON.parse(Buffer.from(calls[0].input.payload)),value);
});
test('invalid response identity, status, missing settlement, duplicate result and truncated stream never replay',async()=>{
 for(const mode of ['session','status','content','binding','missing','duplicate','truncated']){const value=input();let sends=0;const out=response(value);
  if(mode==='session')out.runtimeSessionId='foreign';if(mode==='status')out.statusCode=202;if(mode==='content')out.contentType='text/plain';
  if(mode==='binding')out.response=body({...settlementFor(value.execution,'completed'),execution:{...value.execution,binding:{...binding,tenantId:'foreign'}}});
  if(mode==='missing')out.response=body({state:'completed'});if(mode==='duplicate')out.response=Readable.from([Buffer.from('data: {}\n\ndata: {}\n\n')]);
  if(mode==='truncated')out.response=Readable.from((async function*(){yield Buffer.from(': started\n\n');throw Error('synthetic connection loss');})());
  await assert.rejects(client(async()=>{sends++;return out;}).invoke(value),{code:'AGENTCORE_OUTCOME_UNKNOWN'});assert.equal(sends,1,mode);
 }
});
test('unknown invoke transport is not retried; pre-cancelled and expired never dispatch',async()=>{
 let sends=0;const c=client(async()=>{sends++;throw Error('synthetic socket error');});await assert.rejects(c.invoke(input()),{code:'AGENTCORE_OUTCOME_UNKNOWN'});assert.equal(sends,1);
 await assert.rejects(c.invoke(input({expiresAtMs:Date.now()-1})));const abort=new AbortController();abort.abort();await assert.rejects(c.invoke({...input(),signal:abort.signal}));assert.equal(sends,1);
});
test('Stop reuses execution token and only acknowledges matching definitive response',async()=>{
 const value=input(),calls=[],stop={binding,executionId:value.execution.executionId,runtimeSessionId:value.execution.runtimeSessionId};
 const c=client(async command=>{calls.push(command);return {$metadata:{httpStatusCode:200},statusCode:200,runtimeSessionId:stop.runtimeSessionId};});
 assert.deepEqual(await c.stop(stop),{...stop,stopped:true});assert.deepEqual(await c.stop(stop),{...stop,stopped:true});
 assert.equal(calls[0].constructor.name,'StopRuntimeSessionCommand');assert.equal(calls[0].input.clientToken,stop.executionId);assert.deepEqual(calls[0].input,calls[1].input);
 for(const result of [{statusCode:202,$metadata:{httpStatusCode:202},runtimeSessionId:stop.runtimeSessionId},{statusCode:200,$metadata:{httpStatusCode:200},runtimeSessionId:'foreign'},{}])await assert.rejects(client(async()=>result).stop(stop),{code:'AGENTCORE_STOP_UNKNOWN'});
 await assert.rejects(client(async()=>{throw Error('lost');}).stop(stop),{code:'AGENTCORE_STOP_UNKNOWN'});
});
test('HTTP keeps one query busy until cleanup settlement and permits same-conversation successor',async()=>{
 const finish=deferred(),value=input();let calls=0;const app=createAgentCoreApplication({execute:async value=>{calls++;if(calls===1)await finish.promise;return settlementFor(value.execution,'completed');}});
 assert.equal((await app.handle(new Request('http://synthetic.invalid/ping'))).status,200);
 const stream=await app.handle(request(value));assert.equal(stream.status,200);assert.equal((await (await app.handle(new Request('http://synthetic.invalid/ping'))).json()).status,'HealthyBusy');
 assert.equal((await app.handle(request(value))).status,409);finish.resolve();assert.match(await stream.text(),/"settled":true/u);assert.equal(calls,1);
 assert.equal((await app.handle(request(value))).status,409);
 const next=input({binding:{...binding,runId:id(81),writerFence:binding.writerFence+1}});assert.match(await (await app.handle(request(next))).text(),/"completed"/u);assert.equal(calls,2);
});
test('cross actor, tenant, conversation and runtime session cannot reuse a warm environment',async()=>{
 for(const change of [{binding:{...binding,actorId:'foreign'}},{binding:{...binding,tenantId:'foreign'}},{binding:{...binding,conversationId:id(82)}},{runtimeSessionId:'synthetic-session-22222222222222222222'}]){
  let calls=0;const app=createAgentCoreApplication({execute:async value=>{calls++;return settlementFor(value.execution,'completed');}});await (await app.handle(request(input()))).text();
  const next=input({...change,binding:{...binding,runId:id(81),writerFence:binding.writerFence+1,...change.binding}});assert.equal((await app.handle(request(next))).status,403);assert.equal(calls,1);
 }
});
test('HTTP malformed input/header/expiry and unsupported routes do not execute',async()=>{
 let calls=0;const app=createAgentCoreApplication({execute:async value=>{calls++;}}),value=input();
 for(const req of [request(value,{headers:{'content-type':'application/json',[AGENTCORE_SESSION_HEADER]:'foreign'}}),request({...value,model:'untrusted'}),request(input({expiresAtMs:Date.now()-1})),request(value,{headers:{'content-type':'application/json','content-encoding':'gzip',[AGENTCORE_SESSION_HEADER]:value.execution.runtimeSessionId}})])assert.equal((await app.handle(req)).status,400);
 assert.equal((await app.handle(new Request('http://synthetic.invalid/invocations'))).status,405);assert.equal((await app.handle(new Request('http://synthetic.invalid/unknown'))).status,404);assert.equal(calls,0);
});
test('unknown SDK/flush outcome poisons environment and is never reported settled',async()=>{
 for(const outcome of ['throw','unsettled']){let calls=0;const app=createAgentCoreApplication({execute:async value=>{calls++;if(outcome==='throw')throw Error('private error contents');return {state:'completed',settled:false};}});
  const text=await (await app.handle(request(input()))).text();assert.match(text,/EXECUTION_UNKNOWN/u);assert.doesNotMatch(text,/private error|"settled":true/u);
  assert.equal((await app.handle(new Request('http://synthetic.invalid/ping'))).status,503);assert.equal((await app.handle(request(input()))).status,503);assert.equal(calls,1);
 }
});
test('disconnect cancels actual invocation and keeps active ownership until its promise settles',async()=>{
 const begun=deferred(),finish=deferred();let owned;
 const app=createAgentCoreApplication({execute:async(_,options)=>{owned=options.signal;begun.resolve();await finish.promise;throw Error('cancelled');}}),res=await app.handle(request(input()));
 await begun.promise;await res.body.cancel();assert.equal(owned.aborted,true);assert.equal((await (await app.handle(new Request('http://synthetic.invalid/ping'))).json()).status,'HealthyBusy');
 finish.resolve();await new Promise(resolve=>setImmediate(resolve));assert.equal((await app.handle(new Request('http://synthetic.invalid/ping'))).status,503);
});

test('shutdown waits for SDK settlement even after a disconnected stream; unknown cleanup stays unavailable',async()=>{
 const finish=deferred(),begun=deferred();let sdkSignal;
 const app=createAgentCoreApplication({execute:async(value,{signal})=>{sdkSignal=signal;begun.resolve();await finish.promise;return settlementFor(value.execution,'completed');}});
 const response=await app.handle(request(input()));await begun.promise;await response.body.cancel();
 await assert.rejects(app.close({deadlineMs:Date.now()+20}));assert.equal(sdkSignal.aborted,true);assert.equal((await app.handle(new Request('http://synthetic.invalid/ping'))).status,503);
 finish.resolve();assert.deepEqual(await app.close({deadlineMs:Date.now()+1000}),{settled:true});
});
test('HTTP does not manufacture a receipt for a foreign execution returned by its query owner',async()=>{
 const app=createAgentCoreApplication({execute:async()=>settlementFor(input({binding:{...binding,writerFence:2}}).execution,'completed')});
 const response=await app.handle(request(input()));assert.match(await response.text(),/EXECUTION_UNKNOWN/);assert.equal((await app.handle(new Request('http://synthetic.invalid/ping'))).status,503);
});
