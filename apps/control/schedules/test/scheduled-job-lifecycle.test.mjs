import test from 'node:test';import assert from 'node:assert/strict';
import {createScheduledJobLifecycle} from '../scheduled-job-lifecycle.mjs';
import {scheduledJobFixture,hash,id} from './scheduled-job-fixture.mjs';
import {createScheduledDispatch} from '../scheduled-dispatch.mjs';
import {createScheduledJobLineage} from '../scheduled-job-lineage.mjs';
for(const held of ['pause','approval.wait'])test(`${held} retains actual occurrence OPEN even after checkpoint worker is physically retired`,async t=>{
 const h=await scheduledJobFixture();t.after(h.close);await h.running();await h.pause(held);await h.retire();
 const result=await h.scheduled.dispatch({occurrence:h.occurrence});assert.equal(result.outcome,'ACTIVE');assert.equal((await h.inspect()).state,'OCCUPIED');
 const row=h.scheduleSql.state.occurrences.get(`${h.identity.binding.tenantId}:${h.identity.occurrenceKey}`);assert.equal(row.state,'OPEN');assert.equal(h.temporal.calls.start,0);
 const later={...h.occurrence,workflowId:'later-wrapper',scheduledAt:new Date(h.now()+1).toISOString()};assert.equal((await h.scheduled.dispatch({occurrence:later})).code,'SCHEDULE_OCCURRENCE_UNRESOLVED');assert.equal(h.conversations.state.runs.size,1);
});
test('actual terminal alone is insufficient; canonical retirement permits exactly one settlement and next occurrence',async t=>{
 const h=await scheduledJobFixture();t.after(h.close);await h.running();await h.status('completed');assert.equal((await h.scheduled.reconcile({occurrence:h.occurrence})).outcome,'ACTIVE');
 await h.retire();assert.equal((await h.scheduled.reconcile({occurrence:h.occurrence})).outcome,'DISPATCHED');assert.equal((await h.inspect()).state,'SETTLED');assert.equal(h.temporal.calls.start,0);
 h.advance(1);const later={...h.occurrence,workflowId:'next-after-proven-completion',scheduledAt:new Date(h.now()).toISOString()};assert.equal((await h.scheduled.dispatch({occurrence:later})).outcome,'ACTIVE');assert.equal(h.temporal.calls.start,1);assert.equal(h.conversations.state.runs.size,2);
});
test('actual first admission and start keep OPEN; repeated observation never starts model work twice',async t=>{
 const h=await scheduledJobFixture({admit:false});t.after(h.close);assert.equal((await h.scheduled.dispatch({occurrence:h.occurrence})).outcome,'ACTIVE');
 for(let n=0;n<3;n++)assert.equal((await h.scheduled.reconcile({occurrence:h.occurrence})).outcome,'ACTIVE');assert.equal(h.temporal.calls.start,1);assert.equal(h.conversations.state.runs.size,1);
 assert.equal(h.scheduleSql.state.occurrences.get(`${h.identity.binding.tenantId}:${h.identity.occurrenceKey}`).state,'OPEN');
});
test('explicit cancellation of an absent original reports no admitted work and preserves uncertainty',async t=>{
 const h=await scheduledJobFixture({admit:false});t.after(h.close);const result=await h.scheduled.cancel({occurrence:h.occurrence});assert.equal(result.outcome,'ACTIVE');assert.equal(result.admitted,false);assert.equal(result.code,'SCHEDULE_JOB_NOT_ADMITTED');assert.equal(h.calls.cancel.length,0);assert.equal(h.temporal.calls.start,0);
});
test('an approved cancellation lineage cannot expand to a resumed target selected after approval',async t=>{
 const h=await scheduledJobFixture();t.after(h.close);await h.running();await h.pause();const selected=await createScheduledJobLineage({store:h.store}).read(h.selection,()=>{});
 const expectedLineage={currentBinding:selected.currentBinding,bindings:selected.bindings,lineageSha256:selected.lineageSha256};await h.resume();
 const result=await h.owner.cancel({...h.selection,expectedLineage,deadlineMs:h.now()+1000});assert.equal(result.state,'OCCUPIED');assert.equal(result.reason,'SCHEDULE_JOB_LINEAGE_CHANGED');assert.equal(h.calls.cancel.length,0);assert.equal(h.calls.retire.length,0);
});
test('an exact immutable cancellation selection permits only its canonical current binding',async t=>{
 const h=await scheduledJobFixture();t.after(h.close);await h.running();await h.pause();const target=await h.resume();await h.running(target);
 const selected=await createScheduledJobLineage({store:h.store}).read(h.selection,()=>{}),expectedLineage={currentBinding:selected.currentBinding,bindings:selected.bindings,lineageSha256:selected.lineageSha256};
 const result=await h.owner.cancel({...h.selection,expectedLineage,deadlineMs:h.now()+1000});assert.equal(result.state,'SETTLED');assert.deepEqual(h.calls.cancel,[target]);
});
test('a resume immediately before canonical cancellation cannot retarget the captured binding',async t=>{
 const h=await scheduledJobFixture();t.after(h.close);await h.running();await h.pause();const selected=await createScheduledJobLineage({store:h.store}).read(h.selection,()=>{});
 const expectedLineage={currentBinding:selected.currentBinding,bindings:selected.bindings,lineageSha256:selected.lineageSha256};let target;
 h.hooks.cancel=async()=>{target=await h.resume();};
 await assert.rejects(h.owner.cancel({...h.selection,expectedLineage,deadlineMs:h.now()+1000}));assert.deepEqual(h.calls.cancel,[h.identity.binding]);assert.equal(h.calls.retire.length,0);assert.equal(h.row(target).projection.state,'queued');
});
test('a hostile or malformed expected cancellation lineage is refused without getter invocation or effects',async t=>{
 const h=await scheduledJobFixture();t.after(h.close);let getters=0;
 await assert.rejects(h.owner.cancel({...h.selection,expectedLineage:{get currentBinding(){getters++;return h.identity.binding;},bindings:[h.identity.binding],lineageSha256:'a'.repeat(64)},deadlineMs:h.now()+1000}));
 await assert.rejects(h.owner.cancel({...h.selection,expectedLineage:{currentBinding:h.identity.binding,bindings:[],lineageSha256:'a'.repeat(64)},deadlineMs:h.now()+1000}));assert.equal(getters,0);assert.equal(h.calls.cancel.length,0);
});
test('a stale absence reader cannot release a concurrently admitted active occurrence by later refusing it',async t=>{
 const h=await scheduledJobFixture({admit:false});t.after(h.close);const entered=Promise.withResolvers(),release=Promise.withResolvers();let first=true;
 const store={...h.store,async readOptional(...args){const saved=await h.store.readOptional(...args);if(first){first=false;entered.resolve();await release.promise;}return saved;}};
 const delayed=createScheduledDispatch({scheduleOwner:h.scheduleOwner,store,dispatcher:h.dispatcher,runs:h.runs,authority:h.firingAuthority,taskInstructions:{async read(){return {instruction:h.input.request.prompt};}},versions:h.template.versions,runAdmission:h.adapter,jobOwner:h.owner,now:h.now,maxRequestMs:1000});
 const pending=delayed.dispatch({occurrence:h.occurrence});await entered.promise;
 try{assert.equal((await h.scheduled.dispatch({occurrence:h.occurrence})).outcome,'ACTIVE');
  await h.acknowledge({intentId:id(4600),operation:'cancel_scheduled_task',expectedGeneration:1,generation:2,previousProjectionSha256:hash(h.intent.projection),projection:{...h.intent.projection,state:'paused'},configuration:null,cancel:{mode:'pause',note:'synthetic explicit pause',running:'leave',runs:[]}});
 }finally{release.resolve();}
 assert.equal((await pending).outcome,'REFUSED');assert.equal(h.scheduleSql.state.occurrences.get(`${h.identity.binding.tenantId}:${h.identity.occurrenceKey}`).state,'OPEN');assert.equal(h.temporal.calls.start,1);
});
for(const phase of ['cancel','retire'])test(`late ${phase} completion after cancellation cannot publish a settlement`,async t=>{
 const h=await scheduledJobFixture();t.after(h.close);await h.running();const abort=new AbortController();h.hooks[phase]=()=>abort.abort();
 await assert.rejects(h.owner.cancel({...h.selection,signal:abort.signal,deadlineMs:h.now()+1000}));assert.equal(h.scheduleSql.state.occurrences.get(`${h.identity.binding.tenantId}:${h.identity.occurrenceKey}`).state,'OPEN');assert.equal(h.temporal.calls.start,0);
});
for(const state of ['DISPATCHING','UNKNOWN'])test(`explicit containment cancels a verified persisted ${state} target without reapplying model effects`,async t=>{
 const h=await scheduledJobFixture();t.after(h.close);await h.running();await h.pause();const target=await h.resume();await h.running(target);
 const row=[...h.conversations.state.controls.values()].find(r=>r.projection.input.intent==='resume');row.projection.state=state;row.projection_sha256=hash(row.projection);
 assert.equal((await h.inspect()).reason,'SCHEDULE_JOB_CONTROL_UNRESOLVED');const result=await h.cancel();assert.equal(result.state,'SETTLED');assert.equal(result.runState,'cancelled');assert.deepEqual(h.calls.cancel,[target]);assert.equal(h.temporal.calls.start,0);
});
test('resume keeps the same slot until the real target completes and every original allocation is retired',async t=>{
 const h=await scheduledJobFixture();t.after(h.close);await h.running();await h.pause();const target=await h.resume();
 assert.equal((await h.inspect()).state,'OCCUPIED');await h.running(target);await h.status('completed',target);assert.equal((await h.inspect()).reason,'SCHEDULE_JOB_RETIREMENT_UNPROVEN');
 await h.retire(target);const saved=await h.inspect();assert.equal(saved.state,'SETTLED');assert.deepEqual(saved.currentBinding,target);
});
test('explicit cancel uses actual resumed native binding; canonical run cancellation plus retirement is read back',async t=>{
 const h=await scheduledJobFixture();t.after(h.close);await h.running();await h.pause();const target=await h.resume();await h.running(target);
 const result=await h.cancel();assert.equal(result.state,'SETTLED');assert.equal(result.runState,'cancelled');assert.deepEqual(h.calls.cancel,[target]);assert.deepEqual(h.calls.retire,[target]);assert.notEqual(target.runId,h.occurrence.workflowId);
});
test('queued cancellation uses canonical FORECLOSED evidence and never requests native allocation/stop',async t=>{
 const h=await scheduledJobFixture({allocated:false});t.after(h.close);const result=await h.cancel();assert.equal(result.state,'SETTLED');assert.equal(result.runState,'cancelled');assert.equal(h.calls.retire.length,0);
 const saved=await h.store.allocations.read({binding:h.identity.binding,allocationKey:hash(h.identity.binding)},()=>{});assert.equal(saved.record.state,'FORECLOSED');
});
test('a missing allocation for terminal work is not no-authority evidence',async t=>{
 const h=await scheduledJobFixture({allocated:false});t.after(h.close);await h.running();await h.status('completed');assert.equal((await h.inspect()).reason,'SCHEDULE_JOB_RETIREMENT_UNPROVEN');
});
test('lost stop acknowledgement remains occupied; a later observation uses only durable retirement, never model restart',async t=>{
 const h=await scheduledJobFixture();t.after(h.close);await h.running();h.hooks.retire=()=>{throw Error('synthetic native stop unknown');};await assert.rejects(h.cancel());assert.equal((await h.inspect()).state,'OCCUPIED');assert.equal(h.temporal.calls.start,0);
 await h.retire();assert.equal((await h.inspect()).state,'SETTLED');assert.equal(h.calls.cancel.length,1);
});
test('accessor/missing trusted ports and cancelled/expired operation fail before any cancellation',async t=>{
 const h=await scheduledJobFixture();t.after(h.close);let getters=0;assert.throws(()=>createScheduledJobLifecycle({...h.options,runControl:{get cancel(){getters++;return ()=>{};}}}));assert.equal(getters,0);
 assert.throws(()=>createScheduledJobLifecycle({...h.options,retirement:undefined}));const abort=new AbortController();abort.abort();await assert.rejects(h.owner.cancel({...h.selection,signal:abort.signal,deadlineMs:h.now()+1000}));await assert.rejects(h.owner.cancel({...h.selection,deadlineMs:h.now()}));assert.equal(h.calls.cancel.length,0);
 const store={...h.store};Object.defineProperty(store,'initialInputs',{get(){getters++;return h.store.initialInputs;}});assert.throws(()=>createScheduledJobLifecycle({...h.options,store}));assert.equal(getters,0);
});
test('a control change during explicit retirement withholds settlement despite a stopped current target',async t=>{
 const h=await scheduledJobFixture();t.after(h.close);await h.running();await h.pause();const target=await h.resume();await h.running(target);
 h.hooks.retire=()=>{const row=[...h.conversations.state.controls.values()].find(r=>r.projection.input.intent==='resume');row.projection.state='UNKNOWN';row.projection_sha256=hash(row.projection);};
 assert.equal((await h.cancel()).state,'OCCUPIED');assert.equal(h.calls.cancel.length,1);assert.equal(h.calls.retire.length,1);assert.equal(h.temporal.calls.start,0);
});
test('native workflow identity cannot be replaced by a caller-selected schedule wrapper',async t=>{
 const h=await scheduledJobFixture();t.after(h.close);await assert.rejects(h.owner.cancel({...h.selection,effect:{...h.effect,workflowId:h.occurrence.workflowId},deadlineMs:h.now()+1000}));
 await assert.rejects(h.owner.cancel({...h.selection,effect:{...h.effect,binding:{...h.effect.binding,runId:id(999)}},deadlineMs:h.now()+1000}));assert.equal(h.calls.cancel.length,0);
});
