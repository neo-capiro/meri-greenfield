/** Audit DA-1 (meri-comprehensive-20261015): a planner-accepted mixed subject deleted bytes before its database target was refused, and a
 * thrown or lost step left no per-step record. Controls: the exact counterexample (a conversation snapshot carrying an artifact version)
 * is BLOCKED with zero deletes and stays blocked until the artifact is purged under its own subject; every target is preflighted before
 * anything is recorded or deleted; once effects begin, every step is durably UNKNOWN before its effect, and an exception or a lost process
 * is never read back as done. Synthetic subjects, objects, hashes and ports; no bucket, database, credential or provider. */
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {planDigest,createPurgeExecutor} from '../purge.mjs';
import {enumerateReferences} from '../inventory.mjs';
import {subjectKey} from '../boundary.mjs';
import {createPostgresRetentionJournal} from '../postgres-journal.mjs';
import {compose,subjectOf,snapshot,object,planFrom} from './fixture.mjs';
const day=86400000,refusal=code=>Object.assign(new Error(code),{code});
async function suppressed(f,s,inventory){await f.suppression.suppress({principal:f.principal,subject:s,reason:'owner request'});f.clock.advance(2*day);f.current.inventories.set(subjectKey(s),inventory);f.rows.seed(subjectKey(s),inventory);return f.journal.get(subjectKey(s));}
const seed=(f,plan)=>{for(const st of plan.steps)f.store.put(f.keyFor(st),st.versionId);};
const allPresent=(f,plan)=>plan.steps.every(st=>f.store.has(f.keyFor(st),st.versionId));
const states=async f=>(await f.sink.read()).map(r=>r.state);
const executorWith=(f,overrides)=>createPurgeExecutor({storage:f.storage,ledger:f.ledger,journal:f.journal,keyFor:f.keyFor,facts:f.facts,serving:f.serving,rows:f.rows,enabled:true,now:f.clock.now,...overrides});

test('DA-1 counterexample: a conversation snapshot carrying an artifact version is BLOCKED, refuses with zero deletes even as a re-hashed PLANNED forgery, stays blocked through recovery, and completes only after the artifact is purged under its own subject',async()=>{
 const f=compose(),s=subjectOf(),artifactObject=object(),versionId=randomUUID();
 const inv=enumerateReferences(snapshot(s,{artifactVersions:[{versionId,object:artifactObject}]})),js=await suppressed(f,s,inv),plan=planFrom(f,s,js);seed(f,plan);
 assert.equal(plan.state,'BLOCKED','the planner no longer accepts a row target the conversation row owner must refuse');
 const mismatch=plan.blocks.filter(b=>b.reason==='ROW_TARGET_SUBJECT_MISMATCH');assert.equal(mismatch.length,1);assert.deepEqual(mismatch[0].detail,{className:'artifactVersions',target:{className:'artifactVersions',artifactVersionId:versionId},subjectKind:'conversation',requiredSubjectKind:'artifact'});
 assert.ok(plan.rowSteps.some(r=>r.className==='artifactVersions'),'the foreign target stays visible in the plan, never silently dropped');
 const exec=f.executor();await assert.rejects(exec.execute(plan),/RETENTION_PURGE_BLOCKED/);
 const forged={...plan,blocks:[],state:'PLANNED'};const forgedPlan=Object.freeze({...forged,planSha256:planDigest(forged)});await assert.rejects(exec.execute(forgedPlan),/RETENTION_PURGE_BLOCKED/,'the authoritative recomputation blocks a re-hashed PLANNED forgery');
 assert.ok(allPresent(f,plan),'zero storage deletes');assert.equal(await f.rows.present(subjectKey(s),plan.rowSteps.find(r=>r.className==='sdkSession')),true,'zero row deletes');assert.deepEqual(await states(f),['SUPPRESSED'],'nothing recorded as planned or begun');
 await exec.recordBlocked(plan);const report=await f.reconciler().reconcile();assert.ok(report.stillBlocked.includes(subjectKey(s)));assert.ok((await f.journal.get(subjectKey(s))).purge.blocked.some(b=>b.reason==='ROW_TARGET_SUBJECT_MISMATCH'),'recovery re-plans and keeps the block');
 // The artifact is purged under its own authorized subject; the conversation's authoritative inventory then no longer carries it.
 const a=subjectOf('artifact'),invA=enumerateReferences(snapshot(a,{sdkEntries:[],artifactVersions:[{versionId,object:artifactObject}]})),planA=planFrom(f,a,await suppressed(f,a,invA));seed(f,planA);
 assert.equal(planA.state,'PLANNED');assert.equal((await exec.execute(planA)).state,'EXECUTED');assert.equal(await f.rows.present(subjectKey(a),planA.rowSteps[0]),false);
 const rest=enumerateReferences({...snapshot(s),subject:s});f.current.inventories.set(subjectKey(s),rest);f.rows.seed(subjectKey(s),rest);
 assert.ok((await f.reconciler().reconcile()).replanned.includes(subjectKey(s)),'the recorded block clears only through re-planning from current facts');const cleared=await f.journal.get(subjectKey(s)),after=planFrom(f,s,cleared);assert.equal(after.planSha256,cleared.purge.planSha256);seed(f,after);
 assert.equal(after.state,'PLANNED');assert.equal((await exec.execute(after)).state,'EXECUTED');assert.ok(after.steps.every(st=>!f.store.has(f.keyFor(st),st.versionId)));
});

test('DA-1 preflight: a row target the row owner refuses, an unresolvable object key or a missing delete permission refuses the whole plan before anything is recorded or deleted',async()=>{
 const f=compose(),s=subjectOf(),inv=enumerateReferences(snapshot(s)),js=await suppressed(f,s,inv),plan=planFrom(f,s,js);seed(f,plan);assert.equal(plan.state,'PLANNED');assert.ok(plan.steps.length>=3);
 const refusing={...f.rows,async preflight(){throw refusal('RETENTION_INVALID_REQUEST');},async purge(){throw refusal('RETENTION_INVALID_REQUEST');}};
 await assert.rejects(executorWith(f,{rows:refusing}).execute(plan),/RETENTION_INVALID_REQUEST/,'the row owner refuses a target');
 const lastKey=plan.steps.at(-1).workflowId;await assert.rejects(executorWith(f,{keyFor:st=>{if(st.workflowId===lastKey)throw new Error('no key');return f.keyFor(st);}}).execute(plan),/RETENTION_INVALID_REQUEST/,'the last object key cannot be resolved');
 await assert.rejects(executorWith(f,{rows:{...f.rows,async preflight(){throw new Error('row owner down');}}}).execute(plan),/RETENTION_ROW_PURGE_UNAVAILABLE/,'an unavailable row owner refuses');
 const readOnly=compose({permissions:{getObjectVersion:true,listBucketVersions:true,deleteObjectVersion:false}});await assert.rejects(executorWith(f,{storage:readOnly.storage}).execute(plan),/RETENTION_STORAGE_PERMISSION/);
 assert.ok(allPresent(f,plan),'zero storage deletes through every refusal');assert.deepEqual(await states(f),['SUPPRESSED'],'no PURGE_PLANNED or later entry');assert.equal((await f.journal.get(subjectKey(s))).purge,null,'no purge projection');
 assert.throws(()=>executorWith(f,{rows:{purge:f.rows.purge,present:f.rows.present}}),/RETENTION_CONFIGURATION/,'a row port without preflight is refused at composition');
 assert.equal((await f.executor().execute(plan)).state,'EXECUTED','the same plan executes once every target passes');
});

test('DA-1 per-step state: a row-port failure after the storage deletes is durably UNKNOWN per step, recovery never reads it as done, and the purge completes on a later run',async()=>{
 const f=compose(),s=subjectOf(),inv=enumerateReferences(snapshot(s)),js=await suppressed(f,s,inv),plan=planFrom(f,s,js);seed(f,plan);
 const lostCommit={...f.rows,async purge(){throw refusal('RETENTION_COMMIT_UNKNOWN');}};
 await assert.rejects(executorWith(f,{rows:lostCommit}).execute(plan),/RETENTION_COMMIT_UNKNOWN/,'the original failure reaches the caller');
 const ledger=await f.sink.read();assert.deepEqual(ledger.map(r=>[r.state,r.reason]),[['SUPPRESSED','owner request'],['PURGE_PLANNED',undefined],['PURGE_UNKNOWN','EFFECTS_STARTED'],['PURGE_UNKNOWN','RETENTION_COMMIT_UNKNOWN']]);
 const last=ledger.at(-1).facts;assert.ok(last.steps.every(x=>x.state==='EXECUTED'),'each storage step carries its verified outcome');assert.deepEqual(last.rowSteps.map(x=>x.state),plan.rowSteps.map(()=>'UNKNOWN'),'the uncertain row transaction is UNKNOWN, never PENDING or EXECUTED');
 const row=await f.journal.get(subjectKey(s));assert.equal(row.purge.state,'UNKNOWN');assert.ok(row.purge.rowSteps.length===plan.rowSteps.length&&row.purge.rowSteps.every(x=>x.state==='UNKNOWN'));assert.equal(row.purge.ledgerSequence,ledger.at(-1).sequence);
 const report=await f.reconciler().reconcile();assert.ok(!report.verified.includes(subjectKey(s)),'recovery re-verifies and does not report done');assert.ok(report.replanned.includes(subjectKey(s)),'the surviving row target is re-planned');
 const replanned=await f.journal.get(subjectKey(s));assert.equal(replanned.purge.state,'PLANNED');const again=planFrom(f,s,replanned);assert.equal(again.planSha256,replanned.purge.planSha256);
 assert.equal((await f.executor().execute(again)).state,'EXECUTED');for(const st of plan.rowSteps)assert.equal(await f.rows.present(subjectKey(s),st),false);
});

test('DA-1 per-step state: a step that throws after its request is recorded UNKNOWN and is re-run, not skipped; a lost process leaves EFFECTS_STARTED and the in-flight step UNKNOWN',async()=>{
 const f=compose(),s=subjectOf(),inv=enumerateReferences(snapshot(s)),js=await suppressed(f,s,inv),plan=planFrom(f,s,js);seed(f,plan);
 f.store.fault.mode='marker-on-delete';await assert.rejects(f.executor().execute(plan),/RETENTION_DELETE_MARKER/);f.store.fault.mode=null;
 const ledger=await f.sink.read();assert.deepEqual(ledger.slice(-2).map(r=>[r.state,r.reason]),[['PURGE_UNKNOWN','EFFECTS_STARTED'],['PURGE_UNKNOWN','RETENTION_DELETE_MARKER']]);
 const facts=ledger.at(-1).facts;assert.deepEqual(facts.steps.map(x=>x.state),plan.steps.map((_,i)=>i===0?'UNKNOWN':'PENDING'),'the throwing step is UNKNOWN; the rest never started');
 const row=await f.journal.get(subjectKey(s));assert.equal(row.purge.state,'UNKNOWN');assert.deepEqual(row.purge.steps.map(x=>[x.workflowId,x.state]),[[plan.steps[0].workflowId,'UNKNOWN']]);
 const size=f.sink.size(),done=await f.executor().execute(plan);assert.equal(done.state,'EXECUTED','the UNKNOWN step is re-run');assert.ok(plan.steps.every(st=>!f.store.has(f.keyFor(st),st.versionId)));assert.deepEqual((await f.sink.read()).slice(size).map(r=>r.state),['PURGE_EXECUTED'],'a resumed UNKNOWN purge appends no second EFFECTS_STARTED');
 // Process loss: the second delete never returns. What is durable while it is in flight is what a restart sees.
 const t=subjectOf(),invT=enumerateReferences(snapshot(t)),planT=planFrom(f,t,await suppressed(f,t,invT));seed(f,planT);let reached;const inFlight=new Promise(r=>{reached=r;});let calls=0;
 const stalls={...f.storage,async deleteVersion(args){if(++calls===2){reached();return new Promise(()=>{});}return f.storage.deleteVersion(args);}};
 void executorWith(f,{storage:stalls}).execute(planT);await inFlight;
 const durable=(await f.sink.read()).at(-1);assert.equal(durable.state,'PURGE_UNKNOWN');assert.equal(durable.reason,'EFFECTS_STARTED');assert.deepEqual(durable.facts.steps.map(x=>x.state),planT.steps.map(()=>'PENDING'));
 const lost=await f.journal.get(subjectKey(t));assert.equal(lost.purge.state,'UNKNOWN');assert.deepEqual(lost.purge.steps.map(x=>x.state),['EXECUTED','UNKNOWN'],'the in-flight step is UNKNOWN before its effect');assert.equal(lost.purge.steps[1].requested,null);
 const report=await f.reconciler().reconcile();assert.ok(!report.verified.includes(subjectKey(t)));assert.ok(report.replanned.includes(subjectKey(t)),'the step that never completed is re-planned from current facts');assert.notEqual((await f.journal.get(subjectKey(t))).purge.state,'EXECUTED');
});

test('DA-1 adapter routing: the PostgreSQL row owner\'s preflight refuses a row class of another subject kind and a malformed target without a connection, and its purge refuses before any transaction',async()=>{
 let connects=0;const journal=createPostgresRetentionJournal({pool:{async connect(){connects++;throw new Error('no database in this test');}}});
 const conversation=`tenant-a:conversation:${randomUUID()}`,artifact=`tenant-a:artifact:${randomUUID()}`;
 const sdk={workflowId:'a'.repeat(64),className:'sdkSession',target:{className:'sdkSession',runId:randomUUID(),sessionId:randomUUID(),subpath:'main',sequence:1}},version={workflowId:'b'.repeat(64),className:'artifactVersions',target:{className:'artifactVersions',artifactVersionId:randomUUID()}};
 assert.equal(await journal.rows.preflight(conversation,{rowSteps:[sdk]}),true);assert.equal(await journal.rows.preflight(artifact,{rowSteps:[version]}),true);
 await assert.rejects(journal.rows.preflight(conversation,{rowSteps:[sdk,version]}),/RETENTION_INVALID_REQUEST/,'an artifact version under a conversation');
 await assert.rejects(journal.rows.preflight(artifact,{rowSteps:[sdk]}),/RETENTION_INVALID_REQUEST/,'an SDK entry under an artifact');
 await assert.rejects(journal.rows.preflight(conversation,{rowSteps:[{...sdk,target:{...sdk.target,sequence:0}}]}),/RETENTION_INVALID_REQUEST/,'a malformed exact target');
 await assert.rejects(journal.rows.purge(conversation,{planSha256:'c'.repeat(64),steps:[],rowSteps:[sdk,version]}),/RETENTION_INVALID_REQUEST/,'the counterexample row set refuses before the deleting transaction');
 assert.equal(connects,0,'no lease was taken for any refused target');
});
