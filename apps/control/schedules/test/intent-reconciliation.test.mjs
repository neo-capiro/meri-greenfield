// Synthetic: the real Postgres schedule owner over its scripted SQL fixture. Provider evidence comes from the REAL SDK 1.24
// ScheduleClient over a protobuf-encoded synthetic schedule service (temporal-schedule-wire-fixture.mjs), and approved schedules are
// put there by the production mutation adapter. Real Temporal server canonicalization of stored schedules remains a separate
// qualification; a difference there can only keep an intent unresolved.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createScheduleIntentReconciler} from '../intent-reconciliation.mjs';
import {mutateTemporalSchedule,scheduleSdkOptions} from '../temporal-schedule-mutations.mjs';
import {temporalScheduleService} from './temporal-schedule-wire-fixture.mjs';
import {harness,createIntent,updateIntent,cancelIntent,configuration,occurrence,ownerBinding,check,ids,ScheduleNotFoundError,NOW} from './scheduled-dispatch-harness.mjs';

const scheduleId='application/schedule-a';
function provider() {
 const service=temporalScheduleService(),runs=new Map();
 const workflowClient={connection:{withDeadline:(_d,fn)=>fn(),withAbortSignal:(_s,fn)=>fn()},getHandle(workflowId,runId){return {async describe(){return {workflowId,runId,status:{name:runs.get(runId)??'RUNNING',code:1}};}};}};
 // The production adapter applies the intent through the SDK, exactly as the lifecycle's execute does.
 const applied=intent=>mutateTemporalSchedule({scheduleClient:service.scheduleClient,workflowClient,binding:{intent},lifetime:{check(){}},effect:(_kind,fn)=>fn()});
 // A provider schedule created from SDK options that differ from the approved request.
 const createdAs=async(intent,change)=>{const o=scheduleSdkOptions(intent);change(o);await service.scheduleClient.create(o);};
 const schedule=()=>service.scheduleClient.getHandle(scheduleId);
 return {...service,runs,workflowClient,applied,createdAs,schedule};
}
async function uncertain(h,intent,to='UNKNOWN'){const b=ownerBinding(intent);await h.scheduleOwner.claim(b,check);if(to==='CLAIMED')return;await h.scheduleOwner.markDispatching(b,check);if(to==='UNKNOWN')await h.scheduleOwner.markUnknown(b,check);}
const reconcilerFor=(h,scheduleClient,workflowClient)=>createScheduleIntentReconciler({scheduleClient,workflowClient,scheduleOwner:h.scheduleOwner,scheduleNotFoundError:ScheduleNotFoundError,clock:()=>NOW});
function setup(){const h=harness(),p=provider();return {h,p,reconciler:reconcilerFor(h,p.scheduleClient,p.workflowClient)};}
const firing=h=>h.scheduleOwner.readFiring({tenantId:'tenant-a',scheduleId:ids.schedule},check);
const intentState=(h,id)=>h.schedules.state.intents.get(`tenant-a:${id}`).state;
const brief=r=>({outcome:r.outcome,code:r.code,reconciled:r.reconciled});
async function stillBlocked(h,reconciler,intentId,code='SCHEDULE_INTENT_EFFECT_NOT_OBSERVED',label) {
 assert.deepEqual(brief(await reconciler.reconcile({tenantId:'tenant-a',intentId})),{outcome:'UNRESOLVED',code,reconciled:false},label);
 assert.notEqual(intentState(h,intentId),'ACKNOWLEDGED',label);assert.equal((await firing(h)).activeIntent,intentId,label);
 assert.equal((await h.scheduled.dispatch({occurrence:occurrence()})).code,'SCHEDULE_FIRING_UNRESOLVED',label);
}

test('an UNKNOWN create blocks firings until exact provider evidence acknowledges it; then the firing dispatches once',async()=>{
 const {h,p,reconciler}=setup();await uncertain(h,createIntent());
 assert.equal((await h.scheduled.dispatch({occurrence:occurrence()})).code,'SCHEDULE_FIRING_UNRESOLVED');
 await p.applied(createIntent());
 const r=await reconciler.reconcile({tenantId:'tenant-a',intentId:ids.create});
 assert.deepEqual(r,{intentId:ids.create,operation:'schedule_task',generation:1,outcome:'ACKNOWLEDGED',code:null,reconciled:true});
 const f=await firing(h);assert.equal(f.generation,1);assert.equal(f.activeIntent,null);assert.equal(f.intent.intentId,ids.create);
 assert.equal(intentState(h,ids.create),'ACKNOWLEDGED');
 assert.equal((await h.scheduled.dispatch({occurrence:occurrence()})).outcome,'DISPATCHED');assert.equal(h.runCount(),1);
 assert.equal((await reconciler.reconcile({tenantId:'tenant-a',intentId:ids.create})).reconciled,false);
});

test('a DISPATCHING update whose provider still shows the previous generation stays unresolved and keeps blocking edits',async()=>{
 const {h,p,reconciler}=setup();await h.acknowledge(createIntent());await p.applied(createIntent());await uncertain(h,updateIntent(),'DISPATCHING');
 await stillBlocked(h,reconciler,ids.update);
 const next={...updateIntent(),intentId:'77777777-7777-4777-8777-777777777777'};
 await assert.rejects(h.scheduleOwner.claim(ownerBinding(next),check),{code:'SCHEDULE_STALE'});
 // The production update applied the exact new schedule: acknowledged.
 await p.applied(updateIntent());const done=await reconciler.reconcile({tenantId:'tenant-a',intentId:ids.update});
 assert.equal(done.outcome,'ACKNOWLEDGED');assert.equal((await firing(h)).generation,2);
});

// Each change keeps the matching action tuple (schedule ID, workflow type/ID, task queue and the approved argument) unless the
// change is to that tuple itself; the provider schedule is created through the SDK and read back through describe().
const mismatches={
 'interval cadence':o=>{o.spec.intervals=[{every:120000,offset:0}];},
 'interval offset':o=>{o.spec.intervals=[{every:60000,offset:1000}];},
 'added calendar cadence':o=>{o.spec.calendars=[{second:[{start:0,end:0,step:1}],minute:[{start:0,end:0,step:1}],hour:[{start:9,end:9,step:1}],dayOfMonth:'*',month:'*',year:'*',dayOfWeek:'*',comment:''}];},
 'skip calendar':o=>{o.spec.skip=[{second:'*',minute:'*',hour:'*',dayOfMonth:[{start:25,end:25,step:1}],month:[{start:'DECEMBER',end:'DECEMBER',step:1}],year:'*',dayOfWeek:'*',comment:''}];},
 'time zone':o=>{o.spec.timezone='Europe/London';},
 'start time':o=>{o.spec.startAt=new Date('2026-11-01T00:00:00.000Z');},
 'end time':o=>{o.spec.endAt=new Date('2027-01-01T00:00:00.000Z');},
 'jitter':o=>{o.spec.jitter=1000;},
 'overlap policy':o=>{o.policies.overlap='ALLOW_ALL';},
 'catch-up window':o=>{o.policies.catchupWindow=60000;},
 'pause on failure':o=>{o.policies.pauseOnFailure=true;},
 'paused state':o=>{o.state.paused=true;},
 'state note':o=>{o.state.note='another note';},
 'remaining-action limit':o=>{o.state.remainingActions=5;},
 'retry limit':o=>{o.action.retry={maximumAttempts:5};},
 'retry backoff':o=>{o.action.retry={...o.action.retry,backoffCoefficient:3};},
 'run timeout':o=>{o.action.workflowRunTimeout=1000;},
 'execution timeout':o=>{o.action.workflowExecutionTimeout=600000;},
 'task timeout':o=>{o.action.workflowTaskTimeout=20000;},
 'action memo':o=>{o.action.memo={injected:'value'};},
 'static summary':o=>{o.action.staticSummary='another summary';},
 'priority':o=>{o.action.priority={priorityKey:3};},
 'task queue':o=>{o.action.taskQueue='another-queue';},
 'workflow type':o=>{o.action.workflowType='OtherWorkflow';},
 'workflow ID':o=>{o.action.workflowId='schedule-other';},
 'argument generation':o=>{o.action.args=[{...o.action.args[0],generation:2}];},
 'argument task':o=>{o.action.args=[{...o.action.args[0],task:{...o.action.args[0].task,version:3}}];},
 'argument projection':o=>{o.action.args=[{...o.action.args[0],projection:{...o.action.args[0].projection,maxCostMicrousd:1}}];},
 'extra argument':o=>{o.action.args=[...o.action.args,{}];},
};
for(const [name,change] of Object.entries(mismatches))test(`a provider schedule that differs only in ${name} never acknowledges the create`,async()=>{
 const {h,p,reconciler}=setup();await uncertain(h,createIntent());await p.createdAs(createIntent(),change);
 await stillBlocked(h,reconciler,ids.create,undefined,name);assert.equal(intentState(h,ids.create),'UNKNOWN');
});

test('provider drift after an exact create or update (pause-on-failure, a changed policy or limit) keeps the intent blocked',async()=>{
 const drift={
  'paused by the server':async p=>{await p.schedule().pause('paused on failure');},
  'overlap policy':async p=>{p.stored(scheduleId).policies.overlapPolicy=6;},
  'catch-up window':async p=>{p.stored(scheduleId).policies.catchupWindow={seconds:3600};},
  'remaining actions':async p=>{const s=p.stored(scheduleId).state;s.limitedActions=true;s.remainingActions=2;},
  'jitter':async p=>{p.stored(scheduleId).spec.jitter={seconds:30};},
 };
 for(const [name,apply] of Object.entries(drift)) {
  const {h,p,reconciler}=setup();await uncertain(h,createIntent());await p.applied(createIntent());await apply(p);
  await stillBlocked(h,reconciler,ids.create,undefined,`create: ${name}`);
  const u=setup();await u.h.acknowledge(createIntent());await u.p.applied(createIntent());await uncertain(u.h,updateIntent());
  await u.p.applied(updateIntent());await apply(u.p);
  assert.deepEqual(brief(await u.reconciler.reconcile({tenantId:'tenant-a',intentId:ids.update})),{outcome:'UNRESOLVED',code:'SCHEDULE_INTENT_EFFECT_NOT_OBSERVED',reconciled:false},`update: ${name}`);
  assert.equal(intentState(u.h,ids.update),'UNKNOWN');assert.equal((await firing(u.h)).activeIntent,ids.update);
 }
});

test('approved non-default policies, limits and state acknowledge only when describe returns every one of them',async()=>{
 const changed=configuration({overlap:'BUFFER_ONE',catchupWindowMs:90000,pauseOnFailure:true,remainingActions:4,note:'limited schedule',
  spec:{...configuration().spec,intervals:[{every:3600000,offset:60000}],jitterMs:2000,timezone:'America/New_York',startAt:'2026-10-16T00:00:00.000Z',endAt:'2027-10-16T00:00:00.000Z',
   calendars:[{second:[{start:0,end:0,step:1}],minute:[{start:30,end:30,step:1}],hour:[{start:8,end:17,step:3}],dayOfMonth:'*',month:'*',year:'*',dayOfWeek:[{start:'MONDAY',end:'FRIDAY',step:1}],comment:'working hours'}]}});
 const intent={...createIntent(),projection:{...createIntent().projection,timezone:'America/New_York'},configuration:changed};
 const {h,p,reconciler}=setup();await uncertain(h,intent);await p.createdAs(intent,o=>{o.state.remainingActions=3;});
 await stillBlocked(h,reconciler,ids.create,undefined,'remaining actions 3 of 4');
 p.schedules.delete(scheduleId);await p.applied(intent);
 assert.equal((await reconciler.reconcile({tenantId:'tenant-a',intentId:ids.create})).outcome,'ACKNOWLEDGED');
});

test('equivalent wire encodings of unset values (absent offset, empty time zone, zero backoff, unspecified overlap) still acknowledge',async()=>{
 const {h,p,reconciler}=setup();await uncertain(h,createIntent());await p.applied(createIntent());
 const s=p.stored(scheduleId);s.spec.interval[0].phase=null;s.spec.timezoneName='';s.policies.overlapPolicy=0;s.action.startWorkflow.retryPolicy.backoffCoefficient=0;
 assert.equal((await reconciler.reconcile({tenantId:'tenant-a',intentId:ids.create})).outcome,'ACKNOWLEDGED');
});

test('an approved effect describe cannot return faithfully (cron cadence, a create that triggers immediately) stays unresolved with no provider read',async()=>{
 const cron={...createIntent(),configuration:configuration({spec:{...configuration().spec,intervals:[],cronExpressions:['0 9 * * MON-FRI']}})};
 const runNow={...createIntent(),configuration:configuration({runNow:true})};
 for(const intent of [cron,runNow]) {
  const {h,p,reconciler}=setup();await uncertain(h,intent);await p.applied(intent);const before=p.calls.describe;
  await stillBlocked(h,reconciler,ids.create,'SCHEDULE_INTENT_EFFECT_NOT_COMPARABLE');
  assert.equal(p.calls.describe,before);assert.equal(intentState(h,ids.create),'UNKNOWN');
 }
});

test('partially readable describe evidence (an accessor or a missing section) is refused without running the accessor',async()=>{
 const {h,p}=setup();await uncertain(h,createIntent());await p.applied(createIntent());
 const real=await p.schedule().describe();let reads=0;
 const variants=[d=>Object.defineProperty(d,'policies',{get(){reads++;return real.policies;},enumerable:true}),d=>{delete d.state;},d=>Object.defineProperty(d.action,'retry',{get(){reads++;return real.action.retry;},enumerable:true})];
 for(const variant of variants) {
  const d={...real,action:{...real.action}};variant(d);
  const scheduleClient={connection:p.scheduleClient.connection,getHandle(id){return {scheduleId:id,async describe(){return d;}};}};
  await assert.rejects(reconcilerFor(h,scheduleClient,p.workflowClient).reconcile({tenantId:'tenant-a',intentId:ids.create}),e=>e.code==='SCHEDULE_RECONCILE_FAILED'&&e.outcome==='UNRESOLVED');
 }
 assert.equal(reads,0);assert.equal(intentState(h,ids.create),'UNKNOWN');assert.equal((await firing(h)).activeIntent,ids.create);
});

test('unreadable provider evidence, a CLAIMED intent and a foreign tenant leave every barrier unchanged',async()=>{
 const {h,p,reconciler}=setup();await uncertain(h,createIntent());await p.applied(createIntent());p.faults.describe.push('error');
 await assert.rejects(reconciler.reconcile({tenantId:'tenant-a',intentId:ids.create}),e=>e.code==='SCHEDULE_RECONCILE_FAILED'&&e.outcome==='UNRESOLVED');
 assert.equal(intentState(h,ids.create),'UNKNOWN');
 // A create that is NOT found is not proof of anything recordable yet (P-L6-1): still unresolved.
 await p.schedule().delete();await stillBlocked(h,reconciler,ids.create);
 await assert.rejects(reconciler.reconcile({tenantId:'tenant-b',intentId:ids.create}),{code:'SCHEDULE_RECONCILE_FAILED'});
 // CLAIMED never reached DISPATCHING: even an exactly matching provider schedule is not read and acknowledges nothing.
 const c=setup();await uncertain(c.h,createIntent(),'CLAIMED');await c.p.applied(createIntent());const before=c.p.calls.describe;
 await stillBlocked(c.h,c.reconciler,ids.create,'SCHEDULE_INTENT_NEVER_DISPATCHED');
 assert.equal(c.p.calls.describe,before);assert.equal(intentState(c.h,ids.create),'CLAIMED');
});

test('delete is acknowledged only by typed not-found and, for request_cancel, only when every listed run has stopped running',async()=>{
 const run={workflowId:'schedule-a-2026-10-15T12:00:00Z',runId:ids.run};
 const {h,p,reconciler}=setup();await h.acknowledge(createIntent());await p.applied(createIntent());
 const cancel=cancelIntent({running:'request_cancel',runs:[run]});await uncertain(h,cancel);
 assert.equal((await reconciler.reconcile({tenantId:'tenant-a',intentId:ids.cancel})).outcome,'UNRESOLVED');
 await p.schedule().delete();
 assert.equal((await reconciler.reconcile({tenantId:'tenant-a',intentId:ids.cancel})).outcome,'UNRESOLVED');
 p.runs.set(ids.run,'CANCELLED');
 const done=await reconciler.reconcile({tenantId:'tenant-a',intentId:ids.cancel});
 assert.equal(done.outcome,'ACKNOWLEDGED');const f=await firing(h);assert.equal(f.projection.state,'cancelled');assert.equal(f.activeIntent,null);
});

test('pause is acknowledged only when the schedule is paused with this intent\'s note',async()=>{
 const {h,p,reconciler}=setup();await h.acknowledge(createIntent());await p.applied(createIntent());
 const pause=cancelIntent({mode:'pause',note:'approved pause'});await uncertain(h,pause);
 await p.schedule().pause('some other pause');
 assert.equal((await reconciler.reconcile({tenantId:'tenant-a',intentId:ids.cancel})).outcome,'UNRESOLVED');
 await p.applied(pause);
 assert.equal((await reconciler.reconcile({tenantId:'tenant-a',intentId:ids.cancel})).outcome,'ACKNOWLEDGED');
 assert.equal((await firing(h)).projection.state,'paused');
});
