import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {binding,versions} from '../../control/conversations/test/store-fixture.mjs';
import {createAgentCoreExecutionOwner} from '../agentcore-execution.mjs';

function fixture({predecessor,invokeError,targetBinding=binding,beforeInvocation,browserNeed,browserReady}={}){
 const run={binding:targetBinding,versions,scopes:[],policyRevision:'policy-v1',state:'queued'};
 let record=null,invocations=0,admissions=0,call,unknown=0;
 const response=Promise.withResolvers(),entered=Promise.withResolvers();
 const store={executions:{
  async read(b){return predecessor&&b.runId===predecessor.run.binding.runId?predecessor:{run,record};},
  async claim(execution){if(record)return {run,record,dispatch:false};record={...execution,phase:'launching',native:null};return {run,record,dispatch:true};},
  async record(value){record={...record,phase:value.phase,native:value.native};return {run,record};}},
  nextRuns:{async readTarget(){return predecessor?{source:predecessor.run.binding,facts:{execution:{recordSha256:hash(predecessor.record)}}}:null;}}};
 const owner=createAgentCoreExecutionOwner({store,versions,plan:{runtimeVersion:'qualified-v1'},credentialSecret:'synthetic-control-secret-'.repeat(3),
  now:()=>1000,newId:()=> 'c'.repeat(64),contextFor:async()=>({selectedClientId:null}),...(beforeInvocation?{beforeInvocation}:{}),...(browserNeed?{browserNeed}:{}),...(browserReady?{browserReady}:{}),
  admit:async()=>{admissions++;return {run,expiresAtMs:61000};},onUnknown:()=>unknown++,
  provider:{async invoke(input){invocations++;call=input;entered.resolve();if(invokeError)throw invokeError;return response.promise;},stop:async()=>{throw Error('Stop should not run in these controls');}}});
 return {owner,run,store,response,entered:entered.promise,call:()=>call,counts:()=>({invocations,admissions,unknown}),record:()=>record,
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
test('uncertain provider invocation does not redispatch on a later retry',async()=>{
 const f=fixture({invokeError:Error('LOST_RESPONSE')});await f.owner.kickoff({binding,executionKey:hash(binding)});
 await new Promise(resolve=>setImmediate(resolve));
 await f.owner.kickoff({binding,executionKey:hash(binding)});
 await f.owner.close();assert.equal(f.counts().unknown,1);assert.equal(f.record().phase,'unknown');assert.equal(f.counts().invocations,1);
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

test('the browser prerequisite reports none without a producer, the browser-only need with one, and refuses foreign answers',async()=>{
 const none=fixture();const ack=await none.owner.kickoff({binding,executionKey:hash(binding)});
 assert.deepEqual(await none.owner.browserPrerequisite({binding,executionId:ack.executionId}),{kind:'none'});
 await assert.rejects(none.owner.browserPrerequisite({binding,executionId:'d'.repeat(64)}),{code:'EXECUTION_NOT_FOUND'});
 let answer={kind:'browser-only',hostMode:'browser-only'};
 const f=fixture({browserNeed:async()=>answer,browserReady:async()=>({status:'none'})});
 const started=await f.owner.kickoff({binding,executionKey:hash(binding)});
 assert.deepEqual(await f.owner.browserPrerequisite({binding,executionId:started.executionId}),{kind:'browser-only',hostMode:'browser-only'});
 for(const bad of [{kind:'browser'},{kind:'browser-only',hostMode:'native-processing'},{kind:'browser-only',hostMode:'browser-only',extra:1}]){
  answer=bad;await assert.rejects(f.owner.browserPrerequisite({binding,executionId:started.executionId}),/EXECUTION_BROWSER_PREREQUISITE_REFUSED|EXECUTION_REFUSED|INVALID/u,JSON.stringify(bad));
 }
 answer={kind:'none'};assert.deepEqual(await f.owner.browserPrerequisite({binding,executionId:started.executionId}),{kind:'none'});
 await f.response.resolve({execution:f.call()?.execution,state:'completed',settled:true});
});
test('an unready browser host withholds the invocation exactly like an unready native host',async()=>{
 const absent=fixture({browserReady:async()=>({status:'absent'})});
 await absent.owner.kickoff({binding,executionKey:hash(binding)});
 await new Promise(r=>setTimeout(r,20));
 assert.equal(absent.counts().invocations,0,'no model turn before the browser host is ready');assert.equal(absent.counts().unknown,1);
 const ready=fixture({browserReady:async()=>({status:'ready',currentUntilMs:5000,leaseDeadlineMs:6000,generation:1})});
 await ready.owner.kickoff({binding,executionKey:hash(binding)});await ready.entered;
 assert.equal(ready.counts().invocations,1);
 ready.response.resolve({execution:ready.call().execution,state:'completed',settled:true});
});
