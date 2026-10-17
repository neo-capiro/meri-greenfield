/** Actual upstream workflow isolate; synthetic activations, no Temporal server or running task. */
import test from 'node:test';import assert from 'node:assert/strict';import {AsyncLocalStorage} from 'node:async_hooks';import {createRequire} from 'node:module';
globalThis.AsyncLocalStorage=AsyncLocalStorage;
const require=createRequire(import.meta.url),{Activator}=require('@temporalio/workflow/lib/internals'),{setActivator}=require('@temporalio/workflow/lib/global-attributes'),{defaultPayloadConverter,TypedSearchAttributes}=require('@temporalio/common');
const {meriScheduledDispatchWorkflow}=await import('../../conversations/scheduled-dispatch-workflow.ts');
const turn=async()=>{for(let n=0;n<16;n++)await Promise.resolve();};
function fixture(){const at=new Date('2026-10-15T12:00:00.000Z'),typedSearchAttributes=new TypedSearchAttributes([{key:{name:'TemporalScheduledById',type:'KEYWORD'},value:'application/schedule-a'},{key:{name:'TemporalScheduledStartTime',type:'DATETIME'},value:at}]);
 const a=new Activator({info:{workflowType:'meriScheduledDispatchWorkflow',workflowId:'schedule-wrapper',runId:'00000000-0000-4000-8000-000000000008',taskQueue:'synthetic',typedSearchAttributes,searchAttributes:{},unsafe:{isReplaying:false},historyLength:1,historySize:0},now:0,randomnessSeed:new Uint8Array([1]),registeredActivityNames:new Set(['dispatchScheduledOccurrence','reconcileScheduledOccurrence','cancelScheduledOccurrence']),getTimeOfDay:()=>0,stackTracesEnabled:false,showStackTraceSources:false});
 setActivator(a);let settled=false;const result=meriScheduledDispatchWorkflow({projection:{scheduleId:'s'},generation:1,task:{taskId:'t'}});result.then(()=>settled=true,()=>settled=true);
 const activities=()=>a.commands.filter(c=>c.scheduleActivity).map(c=>c.scheduleActivity),timers=()=>a.commands.filter(c=>c.startTimer).map(c=>c.startTimer);let seq=0,timerSeq=0;
 async function complete(name,outcome){await turn();const call=activities()[seq++];assert.equal(call.activityType,name);assert.equal(call.retryPolicy.maximumAttempts,1);a.resolveActivity({seq:call.seq,result:{completed:{result:defaultPayloadConverter.toPayload({outcome,occurrenceKey:'k',binding:null,admitted:true,code:null})}}});await turn();return call;}
 async function timer(){await turn();const timer=timers()[timerSeq++];assert(timer);assert.equal(Number(timer.startToFireTimeout.seconds),120);a.fireTimer({seq:timer.seq});await turn();}
 return {a,result,complete,timer,activities,settled:()=>settled};
}
test('ACTIVE/held and partial UNKNOWN work is observed without redispatch, even after later admitted/absent answers',async()=>{
 const f=fixture();try{await f.complete('dispatchScheduledOccurrence','ACTIVE');for(const state of ['ACTIVE','UNKNOWN','ADMITTED','NOT_DISPATCHED','ACTIVE']){assert.equal(f.settled(),false);await f.timer();await f.complete('reconcileScheduledOccurrence',state);}
  assert.equal(f.activities().filter(a=>a.activityType==='dispatchScheduledOccurrence').length,1);await f.timer();await f.complete('reconcileScheduledOccurrence','DISPATCHED');assert.equal((await f.result).outcome,'DISPATCHED');
 }finally{setActivator(undefined);}
});
for(const unknown of [false,true])test(`wrapper cancellation invokes actual job owner once${unknown?' and preserves failure uncertainty':''}`,async()=>{
 const f=fixture();try{const first=await f.complete('dispatchScheduledOccurrence','ACTIVE');f.a.cancelWorkflow({});await turn();assert.equal(f.settled(),false);const cleanup=f.activities().at(-1);
  assert.equal(cleanup.activityType,'cancelScheduledOccurrence');assert.deepEqual(defaultPayloadConverter.fromPayload(cleanup.arguments[0]),defaultPayloadConverter.fromPayload(first.arguments[0]));assert.equal(cleanup.retryPolicy.maximumAttempts,1);
  f.a.resolveActivity({seq:cleanup.seq,result:unknown?{failed:{failure:{message:'retirement unknown',applicationFailureInfo:{type:'Unknown'}}}}:{completed:{result:defaultPayloadConverter.toPayload({outcome:'DISPATCHED'})}}});
  await assert.rejects(f.result,/cancel/i);assert.equal(f.activities().length,2);
 }finally{setActivator(undefined);}
});
