import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {binding,versions} from '../../control/conversations/test/store-fixture.mjs';
import {createAgentCoreExecutionOwner} from '../agentcore-execution.mjs';

function fixture({predecessor,invokeError,targetBinding=binding,beforeInvocation,browserNeed,settings,reconcileEnded,stop,now=()=>1000}={}){
 const run={binding:targetBinding,versions,scopes:[],policyRevision:'policy-v1',state:'queued'};
 let record=null,invocations=0,admissions=0,call;
 const response=Promise.withResolvers(),entered=Promise.withResolvers();
 const store={executions:{
  async read(b){return predecessor&&b.runId===predecessor.run.binding.runId?predecessor:{run,record};},
  async claim(execution){if(record)return {run,record,dispatch:false};record={...execution,phase:'launching',native:null};return {run,record,dispatch:true};},
  async record(value){record={...record,phase:value.phase,native:value.native};return {run,record};}},
  nextRuns:{async readTarget(){return predecessor?{source:predecessor.run.binding,facts:{execution:{recordSha256:hash(predecessor.record)}}}:null;}}};
 const owner=createAgentCoreExecutionOwner({store,versions,plan:{runtimeVersion:'qualified-v1'},credentialSecret:'synthetic-control-secret-'.repeat(3),
 now,newId:()=> 'c'.repeat(64),contextFor:async()=>({selectedClientId:null}),...(beforeInvocation?{beforeInvocation}:{}),...(browserNeed?{browserNeed}:{}),
  admit:async()=>{admissions++;return {run,expiresAtMs:61000,...(settings?{settings}:{})};},...(reconcileEnded?{reconcileEnded}:{}),
  provider:{async invoke(input){invocations++;call=input;entered.resolve();if(invokeError)throw invokeError;return response.promise;},stop:stop??(async()=>{throw Error('Stop should not run in these controls');})}});
 return {owner,run,store,response,entered:entered.promise,call:()=>call,counts:()=>({invocations,admissions}),record:()=>record,
  reorderRecord:()=>{record=Object.fromEntries(Object.entries(record).reverse());}};
}
test('kickoff replay invokes once and terminal publication alone is not settled execution',async()=>{
 const f=fixture(),request={binding,executionKey:hash(binding)};
 await f.owner.kickoff(request);await f.entered;await f.owner.kickoff(request);
 assert.equal(f.counts().invocations,1);assert.equal(f.counts().admissions,1);
 const {execution,credential}=f.call();
 await f.owner.admitted({execution,versions,credential});f.run.state='completed';
 assert.equal((await f.owner.status({binding,executionId:execution.executionId})).state,'executing');
 const result=await f.owner.settle({execution,state:'completed',credential});f.response.resolve(result);
 assert.equal((await f.owner.status({binding,executionId:execution.executionId})).state,'completed');
 await f.owner.close();
});
test('a successor cancelled while its continuation is preparing cannot invoke after the wait resolves',async()=>{
 const waiting=Promise.withResolvers(),targetBinding={...binding,writerFence:2},f=fixture({targetBinding,beforeInvocation:()=>waiting.promise});
 await f.owner.kickoff({binding:targetBinding,executionKey:hash(targetBinding)});assert.equal(f.counts().invocations,0);
 assert.equal((await f.owner.status({binding:targetBinding,executionId:hash(targetBinding)})).state,'preparing');
 f.run.state='cancelled';waiting.resolve();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(f.counts().invocations,0);assert.equal(f.record().phase,'unknown');await f.owner.close();
});
test('credentials survive database JSON key ordering but reject a foreign bearer or changed execution',async()=>{
 const f=fixture();await f.owner.kickoff({binding,executionKey:hash(binding)});await f.entered;
 const {execution,credential}=f.call();f.reorderRecord();
 assert.equal((await f.owner.admitted({execution,versions,credential})).state,'queued');
 await assert.rejects(f.owner.admitted({execution,versions,credential:'foreign'}),/EXECUTION_AUTHORITY_REFUSED/u);
 await assert.rejects(f.owner.admitted({execution:{...execution,runtimeSessionId:'d'.repeat(64)},versions,credential}),/EXECUTION_AUTHORITY_REFUSED/u);
 f.run.state='failed';f.response.resolve(await f.owner.settle({execution,state:'failed',credential}));await f.owner.close();
});
test('uncertain provider invocation does not redispatch on a later retry and is never reconciled as ended',async()=>{
 const reconciled=[],f=fixture({invokeError:Error('LOST_RESPONSE'),reconcileEnded:value=>reconciled.push(value)});await f.owner.kickoff({binding,executionKey:hash(binding)});
 await new Promise(resolve=>setImmediate(resolve));
 await f.owner.kickoff({binding,executionKey:hash(binding)});
 await f.owner.close();assert.equal(f.record().phase,'unknown');assert.equal(f.counts().invocations,1);
 assert.deepEqual(reconciled,[],'a lost stream says nothing about the SDK process: the run may still settle itself');
});
test('an invocation that ended unsettled is reconciled once, so its run cannot stay "working" until the lease expires',async()=>{
 // 2 Nov: a first turn refused at activity-load (runner/load 403) published nothing; control recorded the phase unknown and the
 // worker polled it as executing for minutes. The runtime's ended-unsettled answer now hands the run to the reconciler.
 const reconciled=[],ended=Object.assign(Error('AGENTCORE_EXECUTION_ENDED'),{code:'AGENTCORE_EXECUTION_ENDED'});
 const f=fixture({invokeError:ended,reconcileEnded:async value=>{reconciled.push(value);}});
 await f.owner.kickoff({binding,executionKey:hash(binding)});await new Promise(resolve=>setTimeout(resolve,20));await f.owner.close();
 assert.equal(f.record().phase,'unknown');assert.equal(f.counts().invocations,1);
 assert.equal(reconciled.length,1);assert.deepEqual(reconciled[0].binding,binding);assert.ok(reconciled[0].signal instanceof AbortSignal);
 // A reconciler that cannot finish leaves the run to the workflow's own reconcile; the invocation owner never throws for it.
 const g=fixture({invokeError:ended,reconcileEnded:async()=>{throw Error('RECONCILE_UNKNOWN');}});
 await g.owner.kickoff({binding,executionKey:hash(binding)});await new Promise(resolve=>setTimeout(resolve,20));await g.owner.close();assert.equal(g.record().phase,'unknown');
 assert.throws(()=>fixture({reconcileEnded:'not a function'}),/EXECUTION_CONFIGURATION/u);
});
test('settlement rejects a state different from the canonical run',async()=>{
 const f=fixture();await f.owner.kickoff({binding,executionKey:hash(binding)});await f.entered;const {execution,credential}=f.call();
 await assert.rejects(f.owner.settle({execution,state:'completed',credential}),/EXECUTION_SETTLEMENT_REFUSED/u);
 f.run.state='failed';f.response.resolve(await f.owner.settle({execution,state:'failed',credential}));await f.owner.close();
});
test('successor reuses only an ordinary settled session of the same scope and runtime plan',async()=>{
 const sourceBinding={...binding,runId:'a0a0a0a0-0000-4000-8000-000000000001'};
 const targetBinding={...binding,writerFence:binding.writerFence+1};
 for(const stopped of [false,true]){
  const predecessor={run:{binding:sourceBinding,versions,scopes:[],state:'completed'},record:{binding:sourceBinding,executionKey:hash(sourceBinding),executionId:hash(sourceBinding),
   planSha256:hash({binding:sourceBinding,versions,plan:{runtimeVersion:'qualified-v1'}}),expiresAtMs:60000,runtimeSessionId:'e'.repeat(64),
   phase:'settled',native:{state:'completed',...(stopped?{stopped:true}:{})}}};
  const f=fixture({predecessor,targetBinding});await f.owner.kickoff({binding:targetBinding,executionKey:hash(targetBinding)});await f.entered;
  const {execution,credential}=f.call();assert.equal(execution.runtimeSessionId,(stopped?'c':'e').repeat(64));
  f.run.state='completed';f.response.resolve(await f.owner.settle({execution,state:'completed',credential}));await f.owner.close();
 }
});

test('the browser prerequisite reports none without a producer, deferred or the browser-only need with one, and refuses foreign answers',async()=>{
 const none=fixture();const ack=await none.owner.kickoff({binding,executionKey:hash(binding)});
 assert.deepEqual(await none.owner.browserPrerequisite({binding,executionId:ack.executionId}),{kind:'none'});
 await assert.rejects(none.owner.browserPrerequisite({binding,executionId:'d'.repeat(64)}),{code:'EXECUTION_NOT_FOUND'});
 let answer={kind:'browser-only',hostMode:'browser-only'};
 const f=fixture({browserNeed:async()=>answer});
 const started=await f.owner.kickoff({binding,executionKey:hash(binding)});
 assert.deepEqual(await f.owner.browserPrerequisite({binding,executionId:started.executionId}),{kind:'browser-only',hostMode:'browser-only'});
 for(const bad of [{kind:'browser'},{kind:'browser-only',hostMode:'native-processing'},{kind:'browser-only',hostMode:'browser-only',extra:1}]){
  answer=bad;await assert.rejects(f.owner.browserPrerequisite({binding,executionId:started.executionId}),/EXECUTION_BROWSER_PREREQUISITE_REFUSED|EXECUTION_REFUSED|INVALID/u,JSON.stringify(bad));
 }
 answer={kind:'deferred'};assert.deepEqual(await f.owner.browserPrerequisite({binding,executionId:started.executionId}),{kind:'deferred'});
 answer={kind:'none'};assert.deepEqual(await f.owner.browserPrerequisite({binding,executionId:started.executionId}),{kind:'none'});
 await f.response.resolve({execution:f.call()?.execution,state:'completed',settled:true});
});
test('the model turn never waits for the browser host; the browser mounts only when the run browser need is not none',async()=>{
 for(const [kind,enabled] of [['deferred',true],['browser-only',true],['none',false]]){
  const f=fixture({settings:{browser:{enabled:true}},browserNeed:async()=>({kind,...(kind==='browser-only'?{hostMode:'browser-only'}:{})})});
  await f.owner.kickoff({binding,executionKey:hash(binding)});await f.entered;
  assert.equal(f.counts().invocations,1,'no host readiness wait before the model turn');assert.deepEqual(f.call().browser,{enabled},kind);
  f.response.resolve({execution:f.call().execution,state:'completed',settled:true});
 }
 const held=fixture({settings:{browser:{enabled:false}},browserNeed:async()=>({kind:'deferred'})});
 await held.owner.kickoff({binding,executionKey:hash(binding)});await held.entered;assert.deepEqual(held.call().browser,{enabled:false},'a held activation never mounts');
 held.response.resolve({execution:held.call().execution,state:'completed',settled:true});
});

test('a session AgentCore no longer holds counts as stopped only once the run lease has passed',async()=>{
 // StopRuntimeSession answers 404 ResourceNotFoundException ("Session not found or already terminated"). The reconciler fences a
 // run, then needs a confirmed stop; an unconfirmed one keeps the record `stopping` and the conversation's next turn waits.
 const clock={now:1000},notFound=Object.assign(Error('AGENTCORE_SESSION_NOT_FOUND'),{code:'AGENTCORE_SESSION_NOT_FOUND'});let failure=notFound;
 const f=fixture({invokeError:Error('LOST_RESPONSE'),now:()=>clock.now,stop:async()=>{throw failure;}});
 await f.owner.kickoff({binding,executionKey:hash(binding)});await new Promise(resolve=>setTimeout(resolve,20));
 const record=f.record(),stop={binding,executionId:record.executionId,runtimeSessionId:record.runtimeSessionId};
 // Inside the lease the session may still be serving this run: the answer stays unknown.
 await assert.rejects(f.owner.stopExecution(stop),{code:'AGENTCORE_STOP_UNKNOWN'});
 clock.now=record.expiresAtMs;
 assert.deepEqual(await f.owner.stopExecution(stop),{...stop,stopped:true});
 // Never for another session of the record, and never for any other stop failure.
 await assert.rejects(f.owner.stopExecution({...stop,runtimeSessionId:'d'.repeat(64)}),{code:'AGENTCORE_STOP_UNKNOWN'});
 failure=Object.assign(Error('AGENTCORE_STOP_UNKNOWN'),{code:'AGENTCORE_STOP_UNKNOWN'});
 await assert.rejects(f.owner.stopExecution(stop),{code:'AGENTCORE_STOP_UNKNOWN'});
 await f.owner.close();
});
