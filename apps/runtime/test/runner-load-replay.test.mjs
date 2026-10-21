/** A runner/load answered "did not answer" (a Clerk timeout answered 503) is replayed inside the load stage, through the real
 * startup budget, native client and activity. Durations are the tail Core profile's, measured in the first-turn rehearsal. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {runnerStartupBudget,RUNNER_LOAD_MAX_MS,RUNNER_REPLAY_DELAYS_MS} from '../../../packages/runtime/hot-path-budgets.mjs';
import {createNativeCapabilityClient} from '../native-client.mjs';
import {createConversationActivity} from '../../worker/conversation/activity.mjs';
import {binding,scopes,versions,id} from '../../control/conversations/test/store-fixture.mjs';

const TAIL_LOAD_MS=15669,TAIL_LATE_REFUSAL_MS=16760;
const saved={run:{binding,state:'queued',scopes,versions,createdAt:new Date(0).toISOString(),policyRevision:scopes[0].policyRevision},
 request:{requestId:id(6),prompt:'Synthetic only',skill:null,window:null,windowRequest:null},lastSequence:1};

function compose(answers){
 let clock=1_000_000;const loads=[];let claims=0;
 const stages=runnerStartupBudget({requestMs:25_000,shutdownMs:10_000,originalExpiresAtMs:clock+900_000}).stages;
 const native=createNativeCapabilityClient({configuration:{origin:'https://control.synthetic.invalid',maxResponseBytes:2097152},credential:'synthetic',
  now:()=>clock,maxRequestMs:3000,loadMaxRequestMs:stages.load.attemptMs,
  fetch:async url=>{assert.equal(new URL(url).pathname,'/v1/runner/load');const [elapsedMs,answer]=answers[loads.length];loads.push(elapsedMs);clock+=elapsedMs;
   return answer==='saved'?Response.json(saved):Response.json({error:{code:'WORKER_AUTHORITY_UNAVAILABLE'}},{status:503});}});
 const runOwner={load:({signal})=>native.call('runner/load',{binding},{signal,deadlineMs:stages.load.expiresAtMs}),
  async append({event}){if(event.data?.state==='starting'){claims++;return;}throw Error('STOP_BEFORE_MODEL');}};
 const activity=createConversationActivity({...{terminalAttemptMs:3000,cleanupAttemptMs:3000,loadMaxMs:3000,runtimeMaxMs:3000,},runOwner,prepareRuntime:async()=>{throw Error('STOP_AT_RUNTIME');},query:()=>{throw Error('MODEL_CALL_FORBIDDEN');},
  now:()=>clock,loadMaxMs:stages.load.maxMs,loadExpiresAtMs:stages.load.expiresAtMs});
 return {stages,run:()=>activity({binding}),loads,claims:()=>claims};
}

test('the load stage holds a full attempt, the first replay pause and a second full attempt; each attempt keeps its own cap',()=>{
 const {load}=runnerStartupBudget({requestMs:25_000,shutdownMs:10_000,originalExpiresAtMs:2_000_000}).stages;
 assert.equal(load.attemptMs,RUNNER_LOAD_MAX_MS);
 assert.ok(load.maxMs>=2*load.attemptMs+RUNNER_REPLAY_DELAYS_MS[0],JSON.stringify(load));
});

test('a Clerk blip late in a tail-latency load is replayed and the run is claimed',async()=>{
 const f=compose([[TAIL_LATE_REFUSAL_MS,503],[TAIL_LOAD_MS,'saved']]);
 await assert.rejects(f.run(),/EXECUTION_FAILED/u,'the synthetic runtime stops the turn after the claim');
 assert.deepEqual(f.loads,[TAIL_LATE_REFUSAL_MS,TAIL_LOAD_MS],'one replay of the unanswered load');
 assert.equal(f.claims(),1,'the replayed load completed inside the load stage and the run was claimed');
});

test('a load that exhausts the stage still ends the turn before anything is claimed',async()=>{
 const f=compose([[RUNNER_LOAD_MAX_MS-1,503],[RUNNER_LOAD_MAX_MS-1,503],[RUNNER_LOAD_MAX_MS-1,'saved']]);
 await assert.rejects(f.run(),/EXECUTION_FAILED/u);
 assert.equal(f.claims(),0,'no run is claimed after the stage');
 assert.ok(f.loads.length<=3,JSON.stringify(f.loads));
});
