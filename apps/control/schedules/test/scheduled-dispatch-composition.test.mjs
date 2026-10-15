// Synthetic composition through the real schedule owner, conversation store, dispatcher and run-evidence reader (scripted SQL and
// Temporal fixtures). Real PostgreSQL/Temporal schedule firing remains a separate qualification.
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {occurrenceIdentity,snapshotOccurrence} from '../scheduled-occurrence.mjs';
import {createScheduledDispatchActivities} from '../scheduled-activities.mjs';
import {workflowId} from '../../conversations/temporal-dispatch.mjs';
import {harness,occurrence,createIntent,cancelIntent,updateIntent,owner,instruction,projection,configuration} from './scheduled-dispatch-harness.mjs';

async function ready(){const h=harness();await h.acknowledge(createIntent());return h;}
const expected=(o=occurrence())=>occurrenceIdentity(snapshotOccurrence(o));

test('a due occurrence issues exactly one run as the original owner through the canonical store and dispatcher',async()=>{
 const h=await ready(),id=expected(),r=await h.scheduled.dispatch({occurrence:occurrence()});
 assert.deepEqual({outcome:r.outcome,code:r.code,admitted:r.admitted},{outcome:'DISPATCHED',code:null,admitted:true});
 assert.equal(r.occurrenceKey,id.occurrenceKey);assert.deepEqual(r.binding,id.binding);
 assert.equal(h.runCount(),1);assert.equal(h.workflowCount(),1);assert.ok(h.temporal.workflows.has(workflowId(id.binding)));
 assert.equal(h.temporal.workflows.get(workflowId(id.binding)).workflowType,'meriConversationLifecycleWorkflow');
 const saved=await h.store.read(id.binding,{after:0,limit:10},()=>{});
 assert.deepEqual({tenantId:saved.run.binding.tenantId,actorId:saved.run.binding.actorId},owner);
 assert.equal(saved.request.prompt,instruction);assert.equal(saved.request.requestId,id.requestId);assert.equal(saved.run.state,'queued');
 assert.deepEqual(saved.run.scopes,projection().scopes);
 assert.deepEqual(h.authority.state.calls.map(c=>c.phase),['before_admission','before_start']);
 assert.ok(h.authority.state.calls.every(c=>canonicalSha256(c.owner)===canonicalSha256(owner)));
 assert.equal(h.instructions.calls[0].instructionSha256,canonicalSha256(instruction));
});

test('replay of the same occurrence never issues a second run or workflow',async()=>{
 const h=await ready();await h.scheduled.dispatch({occurrence:occurrence()});
 for(let i=0;i<3;i++)assert.equal((await h.scheduled.dispatch({occurrence:occurrence()})).outcome,'DISPATCHED');
 assert.equal((await h.scheduled.reconcile({occurrence:occurrence()})).outcome,'DISPATCHED');
 assert.equal(h.runCount(),1);assert.equal(h.workflowCount(),1);
 // A different firing is a different occurrence with its own identity.
 const next=occurrence({workflowId:'schedule-a-2026-10-15T12:01:00Z',scheduledAt:'2026-10-15T12:00:00.500Z'});
 assert.notEqual(expected(next).binding.runId,expected().binding.runId);
});

test('concurrent claimers of one occurrence produce one run and one workflow',async()=>{
 const h=await ready(),results=await Promise.all([1,2,3,4].map(()=>h.scheduled.dispatch({occurrence:occurrence()})));
 assert.deepEqual(results.map(r=>r.outcome),['DISPATCHED','DISPATCHED','DISPATCHED','DISPATCHED']);
 assert.equal(new Set(results.map(r=>r.binding.runId)).size,1);assert.equal(h.runCount(),1);assert.equal(h.workflowCount(),1);
});

test('an expired attempt whose acceptance commit was lost is recovered without a duplicate',async()=>{
 const h=await ready(),connect=h.conversations.pool.connect;
 // The acceptance transaction commits but its acknowledgement is lost (the fixture keeps committed rows).
 h.conversations.pool.connect=async()=>{const c=await connect(),query=c.query;let inserted=false;c.query=async(sql,p)=>{const r=await query(sql,p);if(sql.startsWith('INSERT INTO meri_conversations.runs'))inserted=true;if(sql==='COMMIT'&&inserted)throw Error('synthetic acknowledgement lost');return r;};return c;};
 const lost=await h.scheduled.dispatch({occurrence:occurrence()});h.conversations.pool.connect=connect;
 assert.deepEqual({outcome:lost.outcome,code:lost.code,admitted:lost.admitted},{outcome:'UNKNOWN',code:'STORE_COMMIT_UNKNOWN',admitted:null});
 assert.equal(h.runCount(),1);assert.equal(h.workflowCount(),0);
 const reconciled=await h.scheduled.reconcile({occurrence:occurrence()});
 assert.deepEqual({outcome:reconciled.outcome,admitted:reconciled.admitted},{outcome:'ADMITTED',admitted:true});
 assert.equal((await h.scheduled.dispatch({occurrence:occurrence()})).outcome,'DISPATCHED');
 assert.equal(h.runCount(),1);assert.equal(h.workflowCount(),1);
});

test('an attempt that admitted the run but never reached Temporal completes the same start once',async()=>{
 const h=await ready();h.temporal.faults.start.push('before');
 const first=await h.scheduled.dispatch({occurrence:occurrence()});
 assert.deepEqual({outcome:first.outcome,code:first.code,admitted:first.admitted},{outcome:'UNKNOWN',code:'TEMPORAL_DISPATCH_UNKNOWN',admitted:true});
 assert.equal((await h.scheduled.reconcile({occurrence:occurrence()})).outcome,'ADMITTED');
 assert.equal((await h.scheduled.dispatch({occurrence:occurrence()})).outcome,'DISPATCHED');
 assert.equal(h.runCount(),1);assert.equal(h.workflowCount(),1);assert.equal(h.temporal.calls.start,2);
});

test('UNKNOWN with the run and its workflow present reconciles to DISPATCHED with no further start',async()=>{
 const h=await ready();h.temporal.faults.start.push('lose');
 assert.equal((await h.scheduled.dispatch({occurrence:occurrence()})).outcome,'UNKNOWN');
 const r=await h.scheduled.reconcile({occurrence:occurrence()});
 assert.deepEqual({outcome:r.outcome,admitted:r.admitted},{outcome:'DISPATCHED',admitted:true});
 assert.equal((await h.scheduled.dispatch({occurrence:occurrence()})).outcome,'DISPATCHED');
 assert.equal(h.temporal.calls.start,1);assert.equal(h.runCount(),1);assert.equal(h.workflowCount(),1);
});

test('UNKNOWN with proof of absence reconciles to NOT_DISPATCHED and stays eligible for the same identity',async()=>{
 const h=await ready();
 const orig=h.conversations.pool.connect;let failNextInsert=true;
 h.conversations.pool.connect=async()=>{const c=await orig();const q=c.query;c.query=async(sql,p)=>{if(failNextInsert&&sql.startsWith('INSERT INTO meri_conversations.runs')){failNextInsert=false;throw Object.assign(Error('synthetic'),{code:'STORE_UNAVAILABLE'});}return q(sql,p);};return c;};
 assert.equal((await h.scheduled.dispatch({occurrence:occurrence()})).outcome,'UNKNOWN');assert.equal(h.runCount(),0);
 const r=await h.scheduled.reconcile({occurrence:occurrence()});
 assert.deepEqual({outcome:r.outcome,code:r.code,admitted:r.admitted},{outcome:'NOT_DISPATCHED',code:null,admitted:false});
 assert.equal((await h.scheduled.dispatch({occurrence:occurrence()})).outcome,'DISPATCHED');
 assert.equal(h.runCount(),1);assert.equal(h.workflowCount(),1);
});

test('UNKNOWN without evidence stays UNKNOWN and never starts or admits anything',async()=>{
 const h=await ready();h.temporal.faults.start.push('before');
 assert.equal((await h.scheduled.dispatch({occurrence:occurrence()})).outcome,'UNKNOWN');
 h.temporal.faults.describe.push('error');
 const noTemporal=await h.scheduled.reconcile({occurrence:occurrence()});
 assert.deepEqual({outcome:noTemporal.outcome,code:noTemporal.code,admitted:noTemporal.admitted},{outcome:'UNKNOWN',code:'TEMPORAL_EVIDENCE_UNKNOWN',admitted:true});
 const connect=h.conversations.pool.connect;h.conversations.pool.connect=async()=>{throw Error('synthetic store down');};
 const noStore=await h.scheduled.reconcile({occurrence:occurrence()});
 assert.deepEqual({outcome:noStore.outcome,admitted:noStore.admitted},{outcome:'UNKNOWN',admitted:null});
 const noStoreDispatch=await h.scheduled.dispatch({occurrence:occurrence()});
 assert.equal(noStoreDispatch.outcome,'UNKNOWN');h.conversations.pool.connect=connect;
 assert.equal(h.temporal.calls.start,1);assert.equal(h.workflowCount(),0);assert.equal(h.runCount(),1);
});

test('cancel before dispatch refuses the firing with no run; a paused schedule refuses too',async()=>{
 for(const cancel of [{mode:'delete'},{mode:'pause'}]){
  const h=await ready();await h.acknowledge(cancelIntent(cancel));
  const r=await h.scheduled.dispatch({occurrence:occurrence()});
  assert.deepEqual({outcome:r.outcome,code:r.code,admitted:r.admitted},{outcome:'REFUSED',code:'SCHEDULE_FIRING_STALE',admitted:false});
  // Even a firing that carries the new generation is inactive.
  const late=await h.scheduled.dispatch({occurrence:occurrence({projection:cancelIntent(cancel).projection,generation:2})});
  assert.equal(late.outcome,'REFUSED');assert.equal(late.code,'SCHEDULE_FIRING_INACTIVE');
  assert.equal(h.runCount(),0);assert.equal(h.workflowCount(),0);assert.equal(h.authority.state.calls.length,0);
 }
});

test('cancel after dispatch leaves the one issued run and replay adds nothing; an admitted unstarted run is not started',async()=>{
 const h=await ready();await h.scheduled.dispatch({occurrence:occurrence()});await h.acknowledge(cancelIntent());
 assert.equal((await h.scheduled.dispatch({occurrence:occurrence()})).outcome,'DISPATCHED');
 assert.equal((await h.scheduled.reconcile({occurrence:occurrence()})).outcome,'DISPATCHED');
 assert.equal(h.runCount(),1);assert.equal(h.workflowCount(),1);
 const g=await ready();g.temporal.faults.start.push('before');
 assert.equal((await g.scheduled.dispatch({occurrence:occurrence()})).outcome,'UNKNOWN');await g.acknowledge(cancelIntent());
 assert.equal((await g.scheduled.reconcile({occurrence:occurrence()})).outcome,'ADMITTED');
 const r=await g.scheduled.dispatch({occurrence:occurrence()});
 assert.deepEqual({outcome:r.outcome,code:r.code,admitted:r.admitted},{outcome:'REFUSED',code:'SCHEDULE_FIRING_STALE',admitted:true});
 assert.equal(g.workflowCount(),0);assert.equal(g.temporal.calls.start,1);
});

test('revoked owner authority refuses; unavailable, impersonating or widened authority is no evidence; nothing runs as anyone else',async()=>{
 const h=await ready();h.authority.state.mode='revoked';
 const r=await h.scheduled.dispatch({occurrence:occurrence()});
 assert.deepEqual({outcome:r.outcome,code:r.code,admitted:r.admitted},{outcome:'REFUSED',code:'SCHEDULE_AUTHORITY_REFUSED',admitted:false});
 for(const mode of ['throw','impersonate','widen']){h.authority.state.mode=mode;assert.equal((await h.scheduled.dispatch({occurrence:occurrence()})).outcome,'UNKNOWN',mode);}
 assert.equal(h.runCount(),0);assert.equal(h.workflowCount(),0);
 assert.ok(h.authority.state.calls.every(c=>canonicalSha256(c.owner)===canonicalSha256(owner)));
 // Revocation after admission but before start keeps the run unstarted.
 const g=await ready();g.temporal.faults.start.push('before');await g.scheduled.dispatch({occurrence:occurrence()});g.authority.state.mode='revoked';
 const s=await g.scheduled.dispatch({occurrence:occurrence()});
 assert.deepEqual({outcome:s.outcome,code:s.code,admitted:s.admitted},{outcome:'REFUSED',code:'SCHEDULE_AUTHORITY_REFUSED',admitted:true});
 assert.equal(g.workflowCount(),0);
});

test('stale generation, unresolved schedule intent, missed catch-up window and a changed instruction refuse without a run',async()=>{
 const h=await ready();
 const stale=await h.scheduled.dispatch({occurrence:occurrence({generation:2})});assert.equal(stale.code,'SCHEDULE_FIRING_STALE');
 const missed=await h.scheduled.dispatch({occurrence:occurrence({scheduledAt:'2026-10-15T11:59:58.000Z'})});assert.equal(missed.code,'SCHEDULE_OCCURRENCE_MISSED');
 h.instructions.text='A different instruction';
 const changed=await h.scheduled.dispatch({occurrence:occurrence()});assert.equal(changed.code,'SCHEDULE_INSTRUCTION_MISMATCH');
 h.instructions.text=instruction;
 const b={intent:updateIntent(),bindingSha256:canonicalSha256({intent:updateIntent(),request:'synthetic'})};
 await h.scheduleOwner.claim(b,()=>{});await h.scheduleOwner.markDispatching(b,()=>{});
 const unresolved=await h.scheduled.dispatch({occurrence:occurrence()});assert.equal(unresolved.code,'SCHEDULE_FIRING_UNRESOLVED');
 assert.ok([stale,missed,changed,unresolved].every(r=>r.outcome==='REFUSED'&&r.admitted===false));
 assert.equal(h.runCount(),0);assert.equal(h.workflowCount(),0);
});

test('a malformed firing is refused without identity, and a foreign Temporal schedule ID cannot borrow a schedule',async()=>{
 const h=await ready();
 for(const bad of [occurrence({temporalScheduleId:'application/other'}),occurrence({extra:true}),occurrence({task:{...configuration().task,version:0}}),null]){
  const r=await h.scheduled.dispatch({occurrence:bad});assert.deepEqual(r,{outcome:'REFUSED',occurrenceKey:null,binding:null,code:'SCHEDULE_OCCURRENCE',admitted:false});
 }
 assert.equal(h.runCount(),0);
});

test('the activity binding passes the host activity cancellation to the dispatch owner',async()=>{
 const h=await ready(),controller=new AbortController();
 const activities=createScheduledDispatchActivities({dispatch:h.scheduled,context:()=>({cancellationSignal:controller.signal})});
 assert.equal((await activities.dispatchScheduledOccurrence({occurrence:occurrence()})).outcome,'DISPATCHED');
 assert.equal((await activities.reconcileScheduledOccurrence({occurrence:occurrence()})).outcome,'DISPATCHED');
 controller.abort();await assert.rejects(activities.dispatchScheduledOccurrence({occurrence:occurrence()}),{code:'SCHEDULE_DISPATCH_DEADLINE'});
 assert.equal(h.runCount(),1);assert.equal(h.workflowCount(),1);
});
