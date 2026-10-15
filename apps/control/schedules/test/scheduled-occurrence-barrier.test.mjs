// Synthetic composition through the real schedule owner (scripted SQL, including the proposed meri_schedules.occurrences rows),
// conversation store, dispatcher and run-evidence reader. "The dispatch workflow ended" is modelled by never calling its
// reconcile again; real Temporal run timeouts and PostgreSQL constraints remain separate qualifications.
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {occurrenceIdentity,snapshotOccurrence} from '../scheduled-occurrence.mjs';
import {workflowId} from '../../conversations/temporal-dispatch.mjs';
import {harness,occurrence,createIntent} from './scheduled-dispatch-harness.mjs';

async function ready(){const h=harness();await h.acknowledge(createIntent());return h;}
const first=occurrence(),second=occurrence({workflowId:'schedule-a-2026-10-15T12:00:00.500Z',scheduledAt:'2026-10-15T12:00:00.500Z'}),third=occurrence({workflowId:'schedule-a-2026-10-15T12:00:00.900Z',scheduledAt:'2026-10-15T12:00:00.900Z'});
const identity=o=>occurrenceIdentity(snapshotOccurrence(o));
const row=(h,o)=>h.schedules.state.occurrences.get(`tenant-a:${identity(o).occurrenceKey}`);
const brief=r=>({outcome:r.outcome,code:r.code,admitted:r.admitted});
// Make the accept INSERT fail before any write: an UNKNOWN with neither a run nor a workflow.
function failRunInsertOnce(h){const connect=h.conversations.pool.connect;let armed=true;h.conversations.pool.connect=async()=>{const c=await connect(),query=c.query;c.query=async(sql,p)=>{if(armed&&sql.startsWith('INSERT INTO meri_conversations.runs')){armed=false;throw Object.assign(Error('synthetic'),{code:'STORE_UNAVAILABLE'});}return query(sql,p);};return c;};}

test('before its first effect an occurrence durably names the exact conversation run and native workflow it may issue',async()=>{
 const h=await ready(),id=identity(first);h.temporal.faults.start.push('before');
 assert.equal((await h.scheduled.dispatch({occurrence:first})).outcome,'UNKNOWN');
 const r=row(h,first);
 assert.equal(r.state,'OPEN');assert.equal(r.schedule_id,first.projection.scheduleId);assert.deepEqual(r.occurrence,first);
 assert.deepEqual(r.effect,{binding:id.binding,requestId:id.requestId,eventId:id.eventId,workflowId:workflowId(id.binding)});
 assert.equal(r.effect_sha256,canonicalSha256(r.effect));
 assert.equal((await h.scheduled.dispatch({occurrence:first})).outcome,'DISPATCHED');assert.equal(row(h,first).state,'DISPATCHED');
 assert.ok(h.temporal.workflows.has(r.effect.workflowId));
});

test('an UNKNOWN occurrence keeps blocking later firings after its dispatch workflow has ended, until its own run is observed started',async()=>{
 const h=await ready();h.temporal.faults.start.push('before');
 assert.deepEqual(brief(await h.scheduled.dispatch({occurrence:first})),{outcome:'UNKNOWN',code:'TEMPORAL_DISPATCH_UNKNOWN',admitted:true});
 // The first firing's wrapper is gone (timed out). A later firing reconciles the predecessor through its durable row: admitted but
 // not started is no evidence, so the later firing is refused with no run of its own.
 assert.deepEqual(brief(await h.scheduled.dispatch({occurrence:second})),{outcome:'REFUSED',code:'SCHEDULE_OCCURRENCE_UNRESOLVED',admitted:false});
 assert.equal(h.runCount(),1);assert.equal(h.workflowCount(),0);assert.equal(row(h,first).state,'OPEN');assert.equal(row(h,second),undefined);
 // A straggling start of the predecessor's exact workflow is positive evidence: the next firing settles it and proceeds.
 const p=identity(first);h.temporal.workflows.set(workflowId(p.binding),{workflowType:'meriConversationLifecycleWorkflow',args:[{binding:p.binding}]});
 assert.deepEqual(brief(await h.scheduled.dispatch({occurrence:third})),{outcome:'DISPATCHED',code:null,admitted:true});
 assert.equal(row(h,first).state,'DISPATCHED');assert.equal(row(h,third).state,'DISPATCHED');assert.equal(h.runCount(),2);
});

test('UNKNOWN with no run at all is not proof of non-effect: later firings stay refused and nothing is admitted for them',async()=>{
 const h=await ready();failRunInsertOnce(h);
 assert.equal((await h.scheduled.dispatch({occurrence:first})).outcome,'UNKNOWN');assert.equal(h.runCount(),0);
 for(const later of [second,third])assert.deepEqual(brief(await h.scheduled.dispatch({occurrence:later})),{outcome:'REFUSED',code:'SCHEDULE_OCCURRENCE_UNRESOLVED',admitted:false});
 assert.equal(h.runCount(),0);assert.equal(h.workflowCount(),0);assert.equal(row(h,first).state,'OPEN');
 // The open predecessor itself may still complete its own identity (its workflow reconciles to NOT_DISPATCHED, then dispatches).
 assert.equal((await h.scheduled.reconcile({occurrence:first})).outcome,'NOT_DISPATCHED');
 assert.equal((await h.scheduled.dispatch({occurrence:first})).outcome,'DISPATCHED');assert.equal(row(h,first).state,'DISPATCHED');
 assert.equal((await h.scheduled.dispatch({occurrence:second})).outcome,'DISPATCHED');assert.equal(h.runCount(),2);
});

test('a refused occurrence releases the barrier and can never be reopened into a start',async()=>{
 const h=await ready();h.temporal.faults.start.push('before');await h.scheduled.dispatch({occurrence:first});
 h.authority.state.mode='revoked';
 assert.deepEqual(brief(await h.scheduled.dispatch({occurrence:first})),{outcome:'REFUSED',code:'SCHEDULE_AUTHORITY_REFUSED',admitted:true});
 assert.equal(row(h,first).state,'REFUSED');
 h.authority.state.mode='allow';
 assert.deepEqual(brief(await h.scheduled.dispatch({occurrence:first})),{outcome:'REFUSED',code:'SCHEDULE_OCCURRENCE_SETTLED',admitted:true});
 assert.equal(h.workflowCount(),0);
 assert.equal((await h.scheduled.dispatch({occurrence:second})).outcome,'DISPATCHED');assert.equal(h.workflowCount(),1);
});

test('an association that names a different run is a conflict: no admission, no start, no settlement',async()=>{
 const h=await ready();h.temporal.faults.start.push('before');await h.scheduled.dispatch({occurrence:first});
 const r=row(h,first),other=identity(second);r.effect={...r.effect,binding:other.binding,workflowId:workflowId(other.binding)};r.effect_sha256=canonicalSha256(r.effect);
 for(const o of [first,second])assert.deepEqual(brief(await h.scheduled.dispatch({occurrence:o})),{outcome:'UNKNOWN',code:'SCHEDULE_OCCURRENCE_CONFLICT',admitted:o===first});
 assert.equal(h.workflowCount(),0);assert.equal(h.runCount(),1);assert.equal(row(h,first).state,'OPEN');assert.equal(row(h,second),undefined);
});

test('the barrier is written before the first effect: if it cannot be written nothing is admitted',async()=>{
 const h=await ready();h.schedules.state.failNext='INSERT INTO meri_schedules.occurrences';
 assert.deepEqual(brief(await h.scheduled.dispatch({occurrence:first})),{outcome:'UNKNOWN',code:'SCHEDULE_STORE_UNAVAILABLE',admitted:false});
 assert.equal(h.runCount(),0);assert.equal(h.workflowCount(),0);assert.equal(row(h,first),undefined);
});

test('a lost settlement after the start reports UNKNOWN and keeps the barrier; reconciliation settles it from the observed run',async()=>{
 const h=await ready();h.schedules.state.failNext='UPDATE meri_schedules.occurrences';
 assert.equal((await h.scheduled.dispatch({occurrence:first})).outcome,'UNKNOWN');
 assert.equal(h.workflowCount(),1);assert.equal(row(h,first).state,'OPEN');
 assert.equal((await h.scheduled.dispatch({occurrence:second})).outcome,'DISPATCHED','the next firing observes the started predecessor');
 assert.equal(row(h,first).state,'DISPATCHED');
 assert.equal((await h.scheduled.reconcile({occurrence:first})).outcome,'DISPATCHED');assert.equal(h.workflowCount(),2);assert.equal(h.temporal.calls.start,2);
});
