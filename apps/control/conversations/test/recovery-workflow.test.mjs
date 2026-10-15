// Upstream workflow isolate Activator, synthetic activations only; no server/native durability claim. The two-minute recovery
// figure is a model from the configured timeouts on healthy infrastructure, not a live qualification.
import test from 'node:test';import assert from 'node:assert/strict';import {AsyncLocalStorage} from 'node:async_hooks';import {createRequire} from 'node:module';
globalThis.AsyncLocalStorage=AsyncLocalStorage;
const require=createRequire(import.meta.url),{Activator}=require('@temporalio/workflow/lib/internals'),{setActivator}=require('@temporalio/workflow/lib/global-attributes'),{defaultPayloadConverter}=require('@temporalio/common');
const {meriConversationWorkflow,meriConversationLifecycleWorkflow}=await import('../workflow.ts');
const id=n=>`${String(n).padStart(8,'0')}-0000-4000-8000-000000000000`,binding={tenantId:'synthetic',actorId:'actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
const turn=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
const seconds=d=>Number(d?.seconds??0)+Number(d?.nanos??0)/1e9;
const lost={failed:{failure:{message:'activity heartbeat timeout',timeoutFailureInfo:{timeoutType:4}}}};
const ok=value=>({completed:{result:defaultPayloadConverter.toPayload(value)}});
async function start(workflow,type){const a=new Activator({info:{workflowType:type,workflowId:'synthetic',runId:id(8),taskQueue:'synthetic',unsafe:{isReplaying:false},historyLength:1,historySize:0},now:0,randomnessSeed:new Uint8Array([1]),registeredActivityNames:new Set(['executeConversation','reconcileConversation']),getTimeOfDay:()=>0,stackTracesEnabled:false,showStackTraceSources:false});setActivator(a);
 let outcome;const result=workflow({binding});result.then(v=>outcome={value:v},e=>outcome={error:e});await turn();
 const scheduled=()=>a.commands.filter(c=>c.scheduleActivity).map(c=>c.scheduleActivity);
 return {a,result,outcome:()=>outcome,scheduled,async resolve(type,result){const s=scheduled().filter(x=>x.activityType===type).at(-1);assert.ok(s,type);a.resolveActivity({seq:s.seq,result});await turn();}};}
for(const [name,workflow] of Object.entries({meriConversationWorkflow,meriConversationLifecycleWorkflow})){
 test(`${name}: a lost or failed attempt schedules one reconciliation, never a second execution, then fails as before`,async()=>{const w=await start(workflow,name);try{
  assert.deepEqual(w.scheduled().map(s=>s.activityType),['executeConversation']);await w.resolve('executeConversation',lost);
  assert.deepEqual(w.scheduled().map(s=>s.activityType),['executeConversation','reconcileConversation']);const r=w.scheduled()[1];
  assert.deepEqual(defaultPayloadConverter.fromPayload(r.arguments[0]),{binding});assert.equal(r.retryPolicy.maximumAttempts??0,0,'bounded by schedule-to-close, not an attempt count');
  assert.equal(w.outcome(),undefined);await w.resolve('reconcileConversation',ok({state:'reconciled'}));
  assert.match(String(w.outcome().error?.cause?.message??w.outcome().error?.message),/heartbeat timeout/);assert.equal(w.scheduled().filter(s=>s.activityType==='executeConversation').length,1);}finally{setActivator(undefined);}});
 test(`${name}: a failed reconciliation still ends the workflow without further activity`,async()=>{const w=await start(workflow,name);try{
  await w.resolve('executeConversation',lost);await w.resolve('reconcileConversation',{failed:{failure:{message:'reconcile unknown'}}});assert.ok(w.outcome().error);assert.equal(w.scheduled().length,2);}finally{setActivator(undefined);}});
 test(`${name}: Stop (workflow cancellation) still runs the reconciliation in a non-cancellable scope`,async()=>{const w=await start(workflow,name);try{
  w.a.cancelWorkflow({});await turn();assert.ok(w.a.commands.some(c=>c.requestCancelActivity),'the attempt is cancelled, not restarted');
  await w.resolve('executeConversation',{cancelled:{failure:{message:'cancelled',canceledFailureInfo:{}}}});assert.deepEqual(w.scheduled().map(s=>s.activityType),['executeConversation','reconcileConversation']);
  await w.resolve('reconcileConversation',ok({state:'reconciled'}));assert.match(String(w.outcome().error?.message),/cancel/i);}finally{setActivator(undefined);}});
 test(`${name}: a terminal result needs no reconciliation`,async()=>{const w=await start(workflow,name);try{
  await w.resolve('executeConversation',ok({state:'completed'}));assert.deepEqual(w.outcome().value,{state:'completed'});assert.equal(w.scheduled().length,1);}finally{setActivator(undefined);}});
}
test('modeled healthy-infrastructure recovery: crash detection plus reconciliation fits within two minutes (unqualified live)',async()=>{const w=await start(meriConversationWorkflow,'meriConversationWorkflow');try{
 const execute=w.scheduled()[0];await w.resolve('executeConversation',lost);const reconcile=w.scheduled()[1];
 const detect=seconds(execute.heartbeatTimeout),budget=seconds(reconcile.scheduleToCloseTimeout),attempt=seconds(reconcile.startToCloseTimeout);
 assert.equal(detect,30);assert.equal(attempt,20);assert.equal(budget,85);assert.ok(detect+budget<120,`${detect}+${budget} s`);
 assert.ok(seconds(reconcile.retryPolicy.maximumInterval)<=10&&seconds(reconcile.retryPolicy.initialInterval)<=1);}finally{setActivator(undefined);}});
