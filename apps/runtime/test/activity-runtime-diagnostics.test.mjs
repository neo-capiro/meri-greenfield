import test from 'node:test';
import assert from 'node:assert/strict';
import {assembleConversationRunner} from '../conversation-runner.mjs';
import {withRunnerDiagnostics} from '../runner-runtime-diagnostics.mjs';
import {createConversationActivity} from '../../worker/conversation/activity.mjs';
import {attemptCleanup} from '../../worker/conversation/cleanup.mjs';
import {binding,versions,scopes,id} from '../../control/conversations/test/store-fixture.mjs';

const fail=code=>Object.assign(Error('synthetic private bearer detail'),{code});
const configuration={sourceEnabled:false,binding,versions,workspace:'/workspace/'+binding.conversationId,
 proxyOrigin:'https://proxy.example.invalid',limits:{shutdownMs:1000}};
const admitted=()=>({binding,versions,proxyUrl:configuration.proxyOrigin,proxyCredential:'synthetic-proxy-cap',model:'synthetic-test-model',
 deadlineMs:Date.now()+3000,maxTurns:2,maxCostMicroUSD:1,maxOutputBytes:1024});
const success={type:'result',subtype:'success',is_error:false};
function fixture({failureAt,code='NATIVE_UNAVAILABLE',cleanupFailure=false,frames=[success]}={}){
 const saved={run:{binding,versions,scopes,state:'queued',createdAt:'2026-10-18T00:00:00.000Z',policyRevision:'policy1'},
  request:{requestId:id(6),prompt:'Synthetic prompt',window:null,windowRequest:null,skill:null}},calls=[],events=[];
 let queries=0,closes=0;
 const native={async call(operation,input){
  calls.push(operation);
  if(operation==='runner/load'){if(failureAt==='load')throw fail(code);return saved;}
  if(operation==='runner/runtime')return admitted();
  if(operation==='runner/publish'){
   const event=input.event,state=event.type==='run.status'?event.data.state:'output';
   if(failureAt===state)throw fail(code);
   events.push(event);if(event.type==='run.status')saved.run.state=state;return {committed:true};
  }
  throw Error('unexpected native operation');
 }};
 const query=()=>{
  queries++;if(failureAt==='query')throw fail(code);
  return {async *[Symbol.asyncIterator](){if(failureAt==='stream')throw fail(code);yield* frames;},close(){closes++;if(cleanupFailure)throw fail('NATIVE_UNAVAILABLE');}};
 };
 return {saved,calls,events,native,query,counts:()=>({queries,closes}),execute:assembleConversationRunner({configuration,native,query})};
}

for(const entry of [
 {failureAt:'load',code:'STORE_UNAVAILABLE',stage:'activity-load',states:[],queries:0,closes:0},
 {failureAt:'starting',code:'STORE_COMMIT_UNKNOWN',stage:'activity-starting',states:[],queries:0,closes:0},
 {failureAt:'running',stage:'activity-running',states:['starting','failed'],queries:0,closes:0},
 {failureAt:'query',code:'SDK_STREAM_REFUSED',stage:'activity-query',states:['starting','running','failed'],queries:1,closes:0},
 {failureAt:'stream',stage:'activity-stream',states:['starting','running','failed'],queries:1,closes:1},
 {failureAt:'output',stage:'activity-output',frames:[{type:'assistant',parent_tool_use_id:null,message:{id:'msg_1',content:[{type:'text',text:'Synthetic answer'}]}},success],states:['starting','running','failed'],queries:1,closes:1},
 {frames:[],stage:'activity-finalize',reportedCode:'SDK_RESULT_MISSING',states:['starting','running','failed'],queries:1,closes:1},
 {failureAt:'completed',code:'STORE_COMMIT_UNKNOWN',stage:'activity-complete',states:['starting','running','failed'],queries:1,closes:1},
 {cleanupFailure:true,stage:'activity-cleanup',returnedCode:'SDK_CLEANUP_UNKNOWN',states:['starting','running','completed'],queries:1,closes:1},
 {failureAt:'stream',code:'EACCES',cleanupFailure:true,stage:'activity-stream',returnedCode:'SDK_CLEANUP_UNKNOWN',states:['starting','running','failed'],queries:1,closes:1},
])test(`canonical activity preserves ${entry.stage} before generic failure${entry.cleanupFailure?' and cleanup uncertainty':''}`,async()=>{
 const f=fixture(entry),lines=[];
 await assert.rejects(withRunnerDiagnostics(()=>f.execute({binding}),{write:line=>lines.push(line)}),{code:entry.returnedCode??'EXECUTION_FAILED'});
 assert.deepEqual(lines,[`RUNNER_FIRST_FAILURE origin=runtime code=${entry.reportedCode??entry.code??'NATIVE_UNAVAILABLE'}\n`,`RUNNER_RUNTIME_FAILED stage=${entry.stage} code=${entry.reportedCode??entry.code??'NATIVE_UNAVAILABLE'}\n`]);
 assert.deepEqual(f.events.filter(event=>event.type==='run.status').map(event=>event.data.state),entry.states);
 assert.deepEqual(f.counts(),{queries:entry.queries,closes:entry.closes});
 assert.equal(f.saved.run.state,entry.states.at(-1)??'queued');
});

test('successful activity remains silent and publishes starting, running, completed in order',async()=>{
 const f=fixture(),lines=[];
 assert.deepEqual(await withRunnerDiagnostics(()=>f.execute({binding}),{write:line=>lines.push(line)}),{state:'completed'});
 assert.deepEqual(lines,[]);assert.deepEqual(f.events.map(event=>event.data.state),['starting','running','completed']);
 assert.deepEqual(f.counts(),{queries:1,closes:1});
});

test('diagnostic observer throws and rejections do not replace activity failure or prevent cleanup',async()=>{
 const f=fixture({failureAt:'stream'}),execute=createConversationActivity({
  runOwner:{load:input=>f.native.call('runner/load',input),append:input=>f.native.call('runner/publish',input)},
  prepareRuntime:async()=>({...admitted(),cwd:configuration.workspace,sessionStore:{load:async()=>null,append:async()=>{}}}),query:f.query,
  diagnostics:{stage(){throw Error('observer exception');},failure(){return Promise.reject(Error('observer rejection'));}},
 });
 await assert.rejects(execute({binding}),{code:'EXECUTION_FAILED'});
 assert.deepEqual(f.events.map(event=>event.data.state),['starting','running','failed']);assert.deepEqual(f.counts(),{queries:1,closes:1});
});

test('cleanup observers cannot change failed cleanup into success or replace its bounded result',async()=>{
 for(const onFailure of [()=>{throw Error('observer exception');},()=>Promise.reject(Error('observer rejection'))]){
  assert.equal(await attemptCleanup(async()=>{throw fail('EACCES');},{now:Date.now,timeoutMs:100,onFailure}),false);
 }
});
