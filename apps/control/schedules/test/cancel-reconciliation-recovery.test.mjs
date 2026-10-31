// Synthetic restart recovery: real canonical schedule owner over its SQL fixture, real SDK WorkflowClient over protobuf.
// No Temporal server, database, worker or native retirement is exercised. Only the listed immutable run IDs are observed.
import test from 'node:test';
import assert from 'node:assert/strict';
import {WorkflowClient} from '@temporalio/client';
import {createScheduleIntentReconciler} from '../intent-reconciliation.mjs';
import {temporalScheduleService} from './temporal-schedule-wire-fixture.mjs';
import {mutateTemporalSchedule} from '../temporal-schedule-mutations.mjs';
import {harness,createIntent,cancelIntent,ownerBinding,check,ids,NOW,ScheduleNotFoundError,WorkflowService} from './scheduled-dispatch-harness.mjs';

const first={workflowId:'schedule-a-first',runId:ids.run};
const second={workflowId:'schedule-a-second',runId:'77777777-7777-4777-8777-777777777777'};
const request={tenantId:'tenant-a',intentId:ids.cancel};
function workflowProvider() {
 const statuses=new Map(),calls=[];
 const workflowService=WorkflowService.create((method,data,callback)=>{
  let bytes;
  try {
   assert.equal(method.name,'DescribeWorkflowExecution','recovery must only describe, never resend cancellation');
   const q=method.resolvedRequestType.decode(data);calls.push({workflowId:q.execution.workflowId,runId:q.execution.runId});
   const response={workflowExecutionInfo:{execution:q.execution,type:{name:'SyntheticWorkflow'},taskQueue:'synthetic',
    status:statuses.get(q.execution.runId)??1,historyLength:1,startTime:{seconds:1760529600}}};
   bytes=method.resolvedResponseType.encode(method.resolvedResponseType.create(response)).finish();
  }catch(error){callback(error);return;}
  callback(null,bytes);
 },false,false);
 const connection={workflowService,withDeadline:(_d,fn)=>fn(),withAbortSignal:(_s,fn)=>fn(),withMetadata:(_m,fn)=>fn()};
 return {statuses,calls,client:new WorkflowClient({connection,namespace:'default'})};
}
async function pending({mode='delete',state='UNKNOWN',runs=[first]}={}) {
 const h=harness(),s=temporalScheduleService(),w=workflowProvider();
 await h.acknowledge(createIntent());
 await mutateTemporalSchedule({scheduleClient:s.scheduleClient,workflowClient:w.client,binding:{intent:createIntent()},lifetime:{check(){}},effect:(_k,fn)=>fn()});
 const intent=cancelIntent({mode,running:'request_cancel',runs}),b=ownerBinding(intent);
 await h.scheduleOwner.claim(b,check);await h.scheduleOwner.markDispatching(b,check);
 if(state==='UNKNOWN')await h.scheduleOwner.markUnknown(b,check);
 const handle=s.scheduleClient.getHandle(intent.projection.temporalScheduleId);
 if(mode==='delete')await handle.delete();else await handle.pause(intent.cancel.note);
 const restart=(extra={})=>createScheduleIntentReconciler({scheduleClient:s.scheduleClient,workflowClient:w.client,scheduleOwner:h.scheduleOwner,scheduleNotFoundError:ScheduleNotFoundError,clock:()=>NOW,...extra});
 const firing=()=>h.scheduleOwner.readFiring({tenantId:'tenant-a',scheduleId:ids.schedule},check);
 const assertBarrier=async()=>{assert.equal(h.schedules.state.intents.get(`tenant-a:${ids.cancel}`).state,state);assert.equal((await firing()).activeIntent,ids.cancel);};
 return {h,s,w,restart,firing,assertBarrier};
}

for(const mode of ['delete','pause'])for(const [name,code] of [['UNSPECIFIED',0],['RUNNING',1],['PAUSED',8],['UNKNOWN',99]]) {
 test(`${mode} recovery retains its barrier across restart for SDK status ${name}`,async()=>{
  const p=await pending({mode});p.w.statuses.set(first.runId,code);
  assert.deepEqual((await p.w.client.getHandle(first.workflowId,first.runId).describe()).status,{name,code});
  const mutations={...p.s.calls};
  for(let attempt=0;attempt<2;attempt++) {
   const r=await p.restart().reconcile(request);
   assert.equal(r.outcome,'UNRESOLVED');assert.equal(r.code,'SCHEDULE_INTENT_EFFECT_NOT_OBSERVED');await p.assertBarrier();
  }
  for(const key of ['create','update','patch','delete'])assert.equal(p.s.calls[key],mutations[key]);
  assert.ok(p.w.calls.every(q=>q.workflowId===first.workflowId&&q.runId===first.runId));
 });
}
for(const [name,code] of [['COMPLETED',2],['FAILED',3],['CANCELLED',4],['TERMINATED',5],['CONTINUED_AS_NEW',6],['TIMED_OUT',7]]) {
 test(`recovery accepts exact SDK terminal ${name}, and duplicate recovery reads no provider`,async()=>{
  const p=await pending({state:'DISPATCHING'});p.w.statuses.set(first.runId,code);
  assert.equal((await p.restart().reconcile(request)).reconciled,true);
  assert.equal((await p.firing()).activeIntent,null);assert.equal((await p.firing()).projection.state,'cancelled');
  const before={schedule:p.s.calls.describe,workflow:p.w.calls.length};
  assert.equal((await p.restart().reconcile(request)).reconciled,false);
  assert.deepEqual({schedule:p.s.calls.describe,workflow:p.w.calls.length},before);
 });
}
test('a terminal first run cannot clear the barrier while a second listed run remains paused',async()=>{
 const p=await pending({runs:[first,second]});p.w.statuses.set(first.runId,4);p.w.statuses.set(second.runId,8);
 assert.equal((await p.restart().reconcile(request)).outcome,'UNRESOLVED');await p.assertBarrier();
 p.w.statuses.set(second.runId,4);
 assert.equal((await p.restart().reconcile(request)).outcome,'ACKNOWLEDGED');assert.equal((await p.firing()).activeIntent,null);
 assert.deepEqual(p.w.calls,[first,second,first,second]);
});
test('malformed status evidence never executes accessors or clears a durable cancel',async()=>{
 const p=await pending();let getters=0;
 const variants=[{name:'CANCELLED',code:1},{name:'PAUSED',code:4},{name:'CANCELLED'},{name:'UNKNOWN',code:4},
  {name:'CANCELLED',code:'4'},Object.defineProperty({code:4},'name',{get(){getters++;return 'CANCELLED';}}),
  new Proxy({name:'CANCELLED',code:4},{get(){getters++;throw Error('proxy read');}})];
 for(const status of variants) {
  const workflowClient={connection:p.w.client.connection,getHandle(workflowId,runId){return {async describe(){return {workflowId,runId,status};}};}};
  await assert.rejects(p.restart({workflowClient}).reconcile(request),{code:'SCHEDULE_RECONCILE_FAILED',outcome:'UNRESOLVED'});
  await p.assertBarrier();
 }
 assert.equal(getters,0);
});
test('wrong run identity and unavailable evidence retain the cancellation barrier across restart',async()=>{
 const p=await pending();
 for(const change of [d=>({...d,runId:second.runId}),d=>({...d,workflowId:second.workflowId})]) {
  const workflowClient={connection:p.w.client.connection,getHandle(workflowId,runId){return {async describe(){return change({workflowId,runId,status:{name:'CANCELLED',code:4}});}};}};
  assert.equal((await p.restart({workflowClient}).reconcile(request)).outcome,'UNRESOLVED');await p.assertBarrier();
 }
 const workflowClient={connection:p.w.client.connection,getHandle(){return {async describe(){throw Error('synthetic permission denied');}};}};
 await assert.rejects(p.restart({workflowClient}).reconcile(request),{code:'SCHEDULE_RECONCILE_FAILED',outcome:'UNRESOLVED'});await p.assertBarrier();
});
test('aborted recovery leaves its durable barrier for a later process to resolve',async()=>{
 const p=await pending(),controller=new AbortController();
 const workflowClient={connection:p.w.client.connection,getHandle(workflowId,runId){return {async describe(){controller.abort();return {workflowId,runId,status:{name:'CANCELLED',code:4}};}};}};
 await assert.rejects(p.restart({workflowClient}).reconcile({...request,signal:controller.signal}),{code:'CANCELLED',outcome:'UNRESOLVED'});await p.assertBarrier();
 p.w.statuses.set(first.runId,4);assert.equal((await p.restart().reconcile(request)).outcome,'ACKNOWLEDGED');
});
test('terminal evidence arriving at the deadline cannot acknowledge cancellation',async()=>{
 const p=await pending();let now=NOW;
 const workflowClient={connection:p.w.client.connection,getHandle(workflowId,runId){return {async describe(){now+=10000;return {workflowId,runId,status:{name:'CANCELLED',code:4}};}};}};
 await assert.rejects(p.restart({workflowClient,clock:()=>now}).reconcile(request),{code:'DEADLINE',outcome:'UNRESOLVED'});await p.assertBarrier();
 p.w.statuses.set(first.runId,4);assert.equal((await p.restart().reconcile(request)).outcome,'ACKNOWLEDGED');
});
test('a lost durable acknowledgement is recovered without resending any provider effect',async()=>{
 const p=await pending();p.w.statuses.set(first.runId,4);
 const scheduleOwner={readIntent:p.h.scheduleOwner.readIntent,async acknowledgeReconciled(...args){await p.h.scheduleOwner.acknowledgeReconciled(...args);throw Error('synthetic lost reply');}};
 await assert.rejects(p.restart({scheduleOwner}).reconcile(request),{code:'SCHEDULE_RECONCILE_FAILED',outcome:'UNRESOLVED'});
 const before={schedule:p.s.calls.describe,workflow:p.w.calls.length};
 assert.equal((await p.restart().reconcile(request)).reconciled,false);
 assert.deepEqual({schedule:p.s.calls.describe,workflow:p.w.calls.length},before);assert.equal((await p.firing()).activeIntent,null);
});
