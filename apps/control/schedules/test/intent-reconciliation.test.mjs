// Synthetic: the real Postgres schedule owner over its scripted SQL fixture and a scripted Temporal schedule/workflow client.
// Real Temporal describe shapes after a dropped acknowledgement remain a separate qualification.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createScheduleIntentReconciler} from '../intent-reconciliation.mjs';
import {harness,createIntent,updateIntent,cancelIntent,occurrence,ownerBinding,check,ids,ScheduleNotFoundError,NOW} from './scheduled-dispatch-harness.mjs';

function provider() {
 const state={schedule:null,describe:[],runs:new Map(),calls:0};
 const connection={withDeadline:(_d,fn)=>fn(),withAbortSignal:(_s,fn)=>fn()};
 const scheduleClient={connection,getHandle(id){return {scheduleId:id,async describe(){state.calls++;if(state.describe.shift()==='error')throw Error('synthetic transport');if(!state.schedule)throw new ScheduleNotFoundError('not found',id);return structuredClone(state.schedule);}};}};
 const workflowClient={connection,getHandle(workflowId,runId){return {async describe(){return {workflowId,runId,status:{name:state.runs.get(runId)??'RUNNING',code:1}};}};}};
 const applied=intent=>{const w=intent.configuration.workflow;state.schedule={scheduleId:intent.projection.temporalScheduleId,state:{paused:intent.configuration.paused,note:intent.configuration.note},
  action:{type:'startWorkflow',workflowType:w.workflowType,workflowId:w.workflowId,taskQueue:w.taskQueue,args:[{projection:intent.projection,generation:intent.generation,task:intent.configuration.task}]}};};
 return {state,scheduleClient,workflowClient,applied};
}
async function uncertain(h,intent,to='UNKNOWN'){const b=ownerBinding(intent);await h.scheduleOwner.claim(b,check);if(to==='CLAIMED')return;await h.scheduleOwner.markDispatching(b,check);if(to==='UNKNOWN')await h.scheduleOwner.markUnknown(b,check);}
function setup(){const h=harness(),p=provider();return {h,p,reconciler:createScheduleIntentReconciler({scheduleClient:p.scheduleClient,workflowClient:p.workflowClient,scheduleOwner:h.scheduleOwner,scheduleNotFoundError:ScheduleNotFoundError,clock:()=>NOW})};}
const firing=h=>h.scheduleOwner.readFiring({tenantId:'tenant-a',scheduleId:ids.schedule},check);

test('an UNKNOWN create blocks firings until exact provider evidence acknowledges it; then the firing dispatches once',async()=>{
 const {h,p,reconciler}=setup();await uncertain(h,createIntent());
 assert.equal((await h.scheduled.dispatch({occurrence:occurrence()})).code,'SCHEDULE_FIRING_UNRESOLVED');
 p.applied(createIntent());
 const r=await reconciler.reconcile({tenantId:'tenant-a',intentId:ids.create});
 assert.deepEqual(r,{intentId:ids.create,operation:'schedule_task',generation:1,outcome:'ACKNOWLEDGED',code:null,reconciled:true});
 const f=await firing(h);assert.equal(f.generation,1);assert.equal(f.activeIntent,null);assert.equal(f.intent.intentId,ids.create);
 assert.equal(h.schedules.state.intents.get(`tenant-a:${ids.create}`).state,'ACKNOWLEDGED');
 assert.equal((await h.scheduled.dispatch({occurrence:occurrence()})).outcome,'DISPATCHED');assert.equal(h.runCount(),1);
 assert.equal((await reconciler.reconcile({tenantId:'tenant-a',intentId:ids.create})).reconciled,false);
});

test('a DISPATCHING update whose provider still shows the previous generation stays unresolved and keeps blocking edits',async()=>{
 const {h,p,reconciler}=setup();await h.acknowledge(createIntent());p.applied(createIntent());await uncertain(h,updateIntent(),'DISPATCHING');
 const r=await reconciler.reconcile({tenantId:'tenant-a',intentId:ids.update});
 assert.deepEqual({outcome:r.outcome,code:r.code,reconciled:r.reconciled},{outcome:'UNRESOLVED',code:'SCHEDULE_INTENT_EFFECT_NOT_OBSERVED',reconciled:false});
 assert.equal((await firing(h)).activeIntent,ids.update);
 const next={...updateIntent(),intentId:'77777777-7777-4777-8777-777777777777'};
 await assert.rejects(h.scheduleOwner.claim(ownerBinding(next),check),{code:'SCHEDULE_STALE'});
 assert.equal((await h.scheduled.dispatch({occurrence:occurrence()})).code,'SCHEDULE_FIRING_UNRESOLVED');
 // The exact new generation, projection and task are present: acknowledged.
 p.applied(updateIntent());const done=await reconciler.reconcile({tenantId:'tenant-a',intentId:ids.update});
 assert.equal(done.outcome,'ACKNOWLEDGED');assert.equal((await firing(h)).generation,2);
});

test('mismatched task, workflow or projection evidence never acknowledges',async()=>{
 for(const change of [s=>{s.action.args[0].generation=2;},s=>{s.action.args[0].task.version=3;},s=>{s.action.workflowType='OtherWorkflow';},s=>{s.action.args[0].projection.maxCostMicrousd=1;},s=>{s.action.args.push({});},s=>{s.scheduleId='application/other';}]){
  const {h,p,reconciler}=setup();await uncertain(h,createIntent());p.applied(createIntent());change(p.state.schedule);
  assert.equal((await reconciler.reconcile({tenantId:'tenant-a',intentId:ids.create})).outcome,'UNRESOLVED');
  assert.equal(h.schedules.state.intents.get(`tenant-a:${ids.create}`).state,'UNKNOWN');
 }
});

test('unreadable provider evidence, a CLAIMED intent and a foreign tenant leave every barrier unchanged',async()=>{
 const {h,p,reconciler}=setup();await uncertain(h,createIntent());p.applied(createIntent());p.state.describe.push('error');
 await assert.rejects(reconciler.reconcile({tenantId:'tenant-a',intentId:ids.create}),e=>e.code==='SCHEDULE_RECONCILE_FAILED'&&e.outcome==='UNRESOLVED');
 assert.equal(h.schedules.state.intents.get(`tenant-a:${ids.create}`).state,'UNKNOWN');
 // A create that is NOT found is not proof of anything recordable yet (P-L6-1): still unresolved.
 p.state.schedule=null;assert.equal((await reconciler.reconcile({tenantId:'tenant-a',intentId:ids.create})).code,'SCHEDULE_INTENT_EFFECT_NOT_OBSERVED');
 await assert.rejects(reconciler.reconcile({tenantId:'tenant-b',intentId:ids.create}),{code:'SCHEDULE_RECONCILE_FAILED'});
 const c=setup();await uncertain(c.h,createIntent(),'CLAIMED');c.p.applied(createIntent());
 const claimed=await c.reconciler.reconcile({tenantId:'tenant-a',intentId:ids.create});
 assert.deepEqual({outcome:claimed.outcome,code:claimed.code},{outcome:'UNRESOLVED',code:'SCHEDULE_INTENT_NEVER_DISPATCHED'});
 assert.equal(c.p.state.calls,0);assert.equal(c.h.schedules.state.intents.get(`tenant-a:${ids.create}`).state,'CLAIMED');
});

test('delete is acknowledged only by typed not-found and, for request_cancel, only when every listed run has stopped running',async()=>{
 const run={workflowId:'schedule-a-2026-10-15T12:00:00Z',runId:ids.run};
 const {h,p,reconciler}=setup();await h.acknowledge(createIntent());p.applied(createIntent());
 const cancel=cancelIntent({running:'request_cancel',runs:[run]});await uncertain(h,cancel);
 assert.equal((await reconciler.reconcile({tenantId:'tenant-a',intentId:ids.cancel})).outcome,'UNRESOLVED');
 p.state.schedule=null;
 assert.equal((await reconciler.reconcile({tenantId:'tenant-a',intentId:ids.cancel})).outcome,'UNRESOLVED');
 p.state.runs.set(ids.run,'CANCELLED');
 const done=await reconciler.reconcile({tenantId:'tenant-a',intentId:ids.cancel});
 assert.equal(done.outcome,'ACKNOWLEDGED');const f=await firing(h);assert.equal(f.projection.state,'cancelled');assert.equal(f.activeIntent,null);
});

test('pause is acknowledged only when the schedule is paused with this intent\'s note',async()=>{
 const {h,p,reconciler}=setup();await h.acknowledge(createIntent());p.applied(createIntent());
 const pause=cancelIntent({mode:'pause',note:'approved pause'});await uncertain(h,pause);
 p.state.schedule.state={paused:true,note:'some other pause'};
 assert.equal((await reconciler.reconcile({tenantId:'tenant-a',intentId:ids.cancel})).outcome,'UNRESOLVED');
 p.state.schedule.state={paused:true,note:'approved pause'};
 assert.equal((await reconciler.reconcile({tenantId:'tenant-a',intentId:ids.cancel})).outcome,'ACKNOWLEDGED');
 assert.equal((await firing(h)).projection.state,'paused');
});
