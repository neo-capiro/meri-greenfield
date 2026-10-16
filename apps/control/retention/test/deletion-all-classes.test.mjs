/** Deletion across every retained class: one conversation carrying data in every conversation-scoped class and one artifact carrying
 * versions are purged through the startup owner with purge enabled; every object version and every row target is gone, retained
 * classes are kept, external data blocks with zero deletes, and a row owner that does not admit a class refuses the whole plan at
 * preflight with zero effects. Synthetic in-process bucket and row port (the PostgreSQL row owner is exercised only through its
 * connection-free preflight); not a real PostgreSQL or S3 deletion. */
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {enumerateReferences} from '../inventory.mjs';
import {rowTargetClasses,retainedClasses} from '../data-classes.mjs';
import {createPostgresRetentionJournal} from '../postgres-journal.mjs';
import {subjectKey} from '../boundary.mjs';
import {composeStartup,subjectOf,snapshot,object,planFrom} from './fixture.mjs';
const day=86400000;
/** A conversation with rows in every conversation-scoped class, uploads, and retained budget evidence (schedules are their own subject). */
const everyClass=(s,extra={})=>({...snapshot(s,{checkpoints:2,outputs:2}),nextRuns:[{targetRunId:randomUUID()}],uploads:[{uploadId:randomUUID(),object:object()}],receipts:[{receiptId:randomUUID()},{receiptId:randomUUID()}],budgetRuns:[{runId:randomUUID()}],...extra});
async function prepared(f,s,raw){const inv=enumerateReferences(raw),key=subjectKey(s);f.current.inventories.set(key,inv);f.rows.seed(key,inv);for(const o of inv.objects)f.store.put(f.keyFor(o),o.versionId);
 await f.startup.suppression.suppress({principal:f.principal,subject:s,reason:'owner request'});f.clock.advance(30*day);return {inv,key,plan:planFrom(f,s,await f.startup.journal.get(key))};}

test('a conversation with data in every retained conversation class and an artifact with versions are each deleted completely; retained evidence stays and is never targeted',async()=>{
 const f=composeStartup({purge:true}),s=subjectOf(),a=subjectOf('artifact');await f.startup.start();
 const {inv,key,plan}=await prepared(f,s,everyClass(s));assert.equal(plan.state,'PLANNED');
 const conversationRowClasses=rowTargetClasses.filter(c=>!['artifactVersions','schedules'].includes(c));
 assert.deepEqual([...new Set(plan.rowSteps.map(r=>r.className))].sort(),[...conversationRowClasses].sort(),'every conversation row class has a target');
 assert.deepEqual([...new Set(inv.objects.flatMap(o=>o.classes))].sort(),['completionCheckpoints','conversation','lifecycle','selectedOutputs','uploads'].filter(c=>inv.objects.some(o=>o.classes.includes(c))).sort());
 assert.ok(inv.objects.some(o=>o.classes.includes('uploads')),'stored uploads are object targets');
 for(const r of retainedClasses)assert.ok(inv.rows.some(x=>x.className===r)&&!plan.rowSteps.some(x=>x.className===r)&&!plan.steps.some(st=>st.classes.includes(r)),`${r} is enumerated and kept`);
 const done=await f.startup.purge.execute(plan);assert.equal(done.state,'EXECUTED');
 for(const o of inv.objects)assert.ok(!f.store.has(f.keyFor(o),o.versionId),`object ${o.objectId} deleted`);assert.deepEqual(f.rows.remaining(key),[],'every row target deleted');
 const versions=[{versionId:randomUUID(),object:object()},{versionId:randomUUID(),object:object()}],art=await prepared(f,a,snapshot(a,{artifactVersions:versions}));
 assert.deepEqual(art.plan.rowSteps.map(r=>r.className),['artifactVersions','artifactVersions']);assert.equal((await f.startup.purge.execute(art.plan)).state,'EXECUTED');
 for(const v of versions)assert.ok(!f.store.has(f.keyFor(v.object),v.object.versionId));assert.deepEqual(f.rows.remaining(art.key),[]);
 const executed=(await f.sink.read()).filter(e=>e.state==='PURGE_EXECUTED');assert.equal(executed.length,2);
 assert.ok(executed[0].facts.rowSteps.every(r=>r.state==='EXECUTED')&&executed[0].facts.steps.every(st=>st.state==='EXECUTED'),'every step recorded EXECUTED only after its readback');
});

test('schedules belong to their own subject kind: a conversation plan that carries schedule rows is BLOCKED as a subject mismatch with zero deletes',async()=>{
 const f=composeStartup({purge:true}),s=subjectOf();await f.startup.start();const {plan}=await prepared(f,s,everyClass(s,{schedules:[{scheduleId:randomUUID()}]}));
 assert.equal(plan.state,'BLOCKED');assert.deepEqual(plan.blocks.map(b=>[b.reason,b.detail.requiredSubjectKind]),[['ROW_TARGET_SUBJECT_MISMATCH','schedule']]);
 await assert.rejects(f.startup.purge.execute(plan),/RETENTION_PURGE_BLOCKED/);assert.equal(f.deletes.length,0);assert.equal(f.rowPurges.length,0);
});

test('memory proposals owned outside Meri block the plan with zero deletes until their owner offers a deletion path',async()=>{
 const f=composeStartup({purge:true}),s=subjectOf();await f.startup.start();const candidateId=randomUUID();
 const {plan}=await prepared(f,s,everyClass(s,{memoryProposals:[{candidateId}]}));
 assert.equal(plan.state,'BLOCKED');assert.deepEqual(plan.blocks,[{reason:'EXTERNAL_DELETION_UNAVAILABLE',detail:{className:'memoryProposals',key:candidateId}}]);
 await assert.rejects(f.startup.purge.execute(plan),/RETENTION_PURGE_BLOCKED/);assert.equal(f.deletes.length,0);assert.equal(f.rowPurges.length,0);
});

test('a row owner that does not admit a registered class (the PostgreSQL schema before the amendment migration) refuses the whole plan at preflight: zero deletes and nothing recorded',async()=>{
 const pg=createPostgresRetentionJournal({pool:{connect(){throw Error('no connection expected');},query(){throw Error('no query expected');}}});
 const f=composeStartup({purge:true,rowPreflight:pg.rows.preflight}),s=subjectOf();await f.startup.start();const {plan}=await prepared(f,s,everyClass(s));
 const before=(await f.sink.read()).length;
 await assert.rejects(f.startup.purge.execute(plan),e=>e.code==='RETENTION_ROW_CLASS_UNSUPPORTED');
 assert.equal(f.deletes.length,0);assert.equal(f.rowPurges.length,0);assert.equal((await f.sink.read()).length,before,'no PURGE_PLANNED or EFFECTS_STARTED entry');
 assert.equal((await f.startup.journal.get(subjectKey(s))).purge,null);
});
