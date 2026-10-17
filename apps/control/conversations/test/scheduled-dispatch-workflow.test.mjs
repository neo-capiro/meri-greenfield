// Upstream workflow isolate Activator, synthetic activations only; no Temporal server, schedule firing or durability claim.
import test from 'node:test';import assert from 'node:assert/strict';import {AsyncLocalStorage} from 'node:async_hooks';import {createRequire} from 'node:module';
globalThis.AsyncLocalStorage=AsyncLocalStorage;
const require=createRequire(import.meta.url),{Activator}=require('@temporalio/workflow/lib/internals'),{setActivator}=require('@temporalio/workflow/lib/global-attributes'),{defaultPayloadConverter,TypedSearchAttributes}=require('@temporalio/common');
const {meriScheduledDispatchWorkflow}=await import('../scheduled-dispatch-workflow.ts');
const turn=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
const firing={projection:{scheduleId:'s'},generation:1,task:{taskId:'t'}},at=new Date('2026-10-15T12:00:00.000Z');
const outcome=(value,code=null)=>({outcome:value,occurrenceKey:'k',binding:null,code,admitted:null});
const attributes=(pairs=[{key:{name:'TemporalScheduledById',type:'KEYWORD'},value:'application/schedule-a'},{key:{name:'TemporalScheduledStartTime',type:'DATETIME'},value:at}])=>new TypedSearchAttributes(pairs);
function fixture(typedSearchAttributes=attributes()){
 const a=new Activator({info:{workflowType:'meriScheduledDispatchWorkflow',workflowId:'schedule-a-2026-10-15T12:00:00Z',runId:'00000000-0000-4000-8000-000000000008',taskQueue:'meri-schedules',typedSearchAttributes,searchAttributes:{},unsafe:{isReplaying:false},historyLength:1,historySize:0},
  now:0,randomnessSeed:new Uint8Array([1]),registeredActivityNames:new Set(['dispatchScheduledOccurrence','reconcileScheduledOccurrence','cancelScheduledOccurrence']),getTimeOfDay:()=>0,stackTracesEnabled:false,showStackTraceSources:false});
 setActivator(a);let settled=false;const result=meriScheduledDispatchWorkflow(firing);result.then(()=>settled=true,()=>settled=true);
 let seen=0;
 const next=()=>{const commands=a.commands.filter(c=>c.scheduleActivity||c.startTimer),command=commands[seen++];assert.ok(command,'expected a command');return command;};
 return {a,result,settled:()=>settled,
  activities:()=>a.commands.filter(c=>c.scheduleActivity).map(c=>c.scheduleActivity),
  async resolve(type,value){await turn();const c=next();assert.equal(c.scheduleActivity?.activityType,type);assert.equal(c.scheduleActivity.retryPolicy.maximumAttempts,1);a.resolveActivity({seq:c.scheduleActivity.seq,result:{completed:{result:defaultPayloadConverter.toPayload(value)}}});await turn();return c.scheduleActivity;},
  async fail(type){await turn();const c=next();assert.equal(c.scheduleActivity?.activityType,type);a.resolveActivity({seq:c.scheduleActivity.seq,result:{failed:{failure:{message:'synthetic activity timeout',applicationFailureInfo:{type:'Synthetic',nonRetryable:false}}}}});await turn();},
  async timer(){await turn();const c=next();assert.ok(c.startTimer,'expected a settle timer');assert.equal(Number(c.startTimer.startToFireTimeout.seconds),120);a.fireTimer({seq:c.startTimer.seq});await turn();}};
}
test('a dispatched firing completes after one dispatch activity carrying the server-set occurrence identity',async()=>{
 const f=fixture();try{const call=await f.resolve('dispatchScheduledOccurrence',outcome('DISPATCHED'));
  const input=defaultPayloadConverter.fromPayload(call.arguments[0]);
  assert.deepEqual(input,{occurrence:{workflowId:'schedule-a-2026-10-15T12:00:00Z',temporalScheduleId:'application/schedule-a',scheduledAt:at.toISOString(),...firing}});
  assert.equal((await f.result).outcome,'DISPATCHED');assert.equal(f.activities().length,1);}finally{setActivator(undefined);}
});
test('UNKNOWN waits a durable settle period, reconciles, and completes an ADMITTED run through the same occurrence',async()=>{
 const f=fixture();try{
  await f.resolve('dispatchScheduledOccurrence',outcome('UNKNOWN','TEMPORAL_DISPATCH_UNKNOWN'));assert.equal(f.settled(),false);
  await f.timer();await f.resolve('reconcileScheduledOccurrence',outcome('ADMITTED'));
  await f.resolve('dispatchScheduledOccurrence',outcome('DISPATCHED'));
  assert.equal((await f.result).outcome,'DISPATCHED');assert.deepEqual(f.activities().map(a=>a.activityType),['dispatchScheduledOccurrence','reconcileScheduledOccurrence','dispatchScheduledOccurrence']);
 }finally{setActivator(undefined);}
});
test('UNKNOWN without evidence keeps the firing open and blocked; a failed activity is UNKNOWN, never a retry of the effect',async()=>{
 const f=fixture();try{
  await f.fail('dispatchScheduledOccurrence');
  for(let i=0;i<3;i++){await f.timer();await f.resolve('reconcileScheduledOccurrence',outcome('UNKNOWN','STORE_UNAVAILABLE'));assert.equal(f.settled(),false);}
  assert.equal(f.activities().filter(a=>a.activityType==='dispatchScheduledOccurrence').length,1);
  await f.timer();await f.resolve('reconcileScheduledOccurrence',outcome('NOT_DISPATCHED'));
  await f.resolve('dispatchScheduledOccurrence',outcome('REFUSED','SCHEDULE_OCCURRENCE_MISSED'));
  assert.equal((await f.result).code,'SCHEDULE_OCCURRENCE_MISSED');
 }finally{setActivator(undefined);}
});
test('a firing without server-set schedule attributes is refused with no activity; cancellation ends the wait',async()=>{
 const f=fixture(attributes([]));try{assert.deepEqual(await f.result,{outcome:'REFUSED',occurrenceKey:null,binding:null,code:'SCHEDULE_OCCURRENCE_UNSCHEDULED',admitted:false});assert.equal(f.activities().length,0);}finally{setActivator(undefined);}
 const g=fixture();try{await g.resolve('dispatchScheduledOccurrence',outcome('UNKNOWN'));await turn();g.a.cancelWorkflow({});await turn();
  // Intentional job semantics: cancellation asks the actual effect owner to retire work before this wrapper rejects.
  const cleanup=g.activities().at(-1);assert.equal(cleanup.activityType,'cancelScheduledOccurrence');assert.equal(cleanup.retryPolicy.maximumAttempts,1);
  g.a.resolveActivity({seq:cleanup.seq,result:{completed:{result:defaultPayloadConverter.toPayload(outcome('DISPATCHED'))}}});
  await assert.rejects(g.result,/cancel/i);assert.equal(g.activities().length,2);
 }finally{setActivator(undefined);}
});
