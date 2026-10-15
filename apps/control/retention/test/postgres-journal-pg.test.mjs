/** Real task-owned PostgreSQL 16 with migrations 0001–0011 and artifacts 0001–0002 applied by provision-postgres.sh: the retention
 * journal adapter, the absent-row compare-and-set under concurrency (finding 3), the exact database-row targets consulted by the
 * trigger amendments (finding 5), database artifact-version identity end to end (finding 6) and ledger-only recovery after a
 * simulated restore. Synthetic tenants, actors, objects and hashes; no bucket, credential or provider. */
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import pg from '../../../runtime/node_modules/pg/lib/index.js';
import {createPostgresRetentionJournal} from '../postgres-journal.mjs';
import {createRetentionLedger,createMemoryLedgerSink} from '../ledger.mjs';
import {createSuppressionOwner} from '../suppression.mjs';
import {createRecoveryReconciler,createServingGate} from '../reconciliation.mjs';
import {createPurgeExecutor} from '../purge.mjs';
import {enumerateReferences} from '../inventory.mjs';
import {hash,subjectKey} from '../boundary.mjs';
import {projectionToken} from '../memory-journal.mjs';
import {snapshot,bucket,clock,tenant,owner,currentFacts,planFrom,object} from './fixture.mjs';
import {createVersionStorage} from '../storage-port.mjs';
const socket=process.env.MERI_BROKER_TEST_SOCKET??'/tmp/meri-broker-pg-socket-20261014';const day=86400000;
const unavailable=code=>e=>e.code==='RETENTION_STORE_UNAVAILABLE'&&new RegExp(code).test(e.cause?.message);
async function fixture(t){
 const pool=new pg.Pool({host:socket,user:'postgres',database:'postgres',max:6});t.after(()=>pool.end());
 const listen=(await pool.query("SELECT current_setting('listen_addresses') AS l")).rows[0].l;assert.equal(listen,'','task-owned socket-only cluster');
 await pool.query('TRUNCATE meri_conversations.retention_purge_targets,meri_conversations.retention_purges,meri_conversations.retention_subjects,meri_artifacts.retention_purges,meri_artifacts.retention_subjects CASCADE');
 await pool.query('TRUNCATE meri_conversations.conversations CASCADE');await pool.query('TRUNCATE meri_artifacts.versions,meri_artifacts.heads CASCADE');
 const c=clock(),sink=createMemoryLedgerSink(),ledger=createRetentionLedger({sink,now:c.now}),journal=createPostgresRetentionJournal({pool}),serving=createServingGate(),store=bucket();
 const suppression=createSuppressionOwner({ledger,journal,ownership:journal,serving,now:c.now});const {current,facts}=currentFacts(c);
 const storage=createVersionStorage({send:store.send,bucket:'synthetic-bucket',expectedBucketOwner:'967807252336',permissions:{getObjectVersion:true,listBucketVersions:true,deleteObjectVersion:true},now:c.now,maxRequestMs:200});
 const keyFor=st=>`${tenant}/${st.objectId}/${st.sha256}`;
 const executor=(enabled=true)=>createPurgeExecutor({storage,ledger,journal,keyFor,facts,serving,rows:journal.rows,enabled,now:c.now});
 const reconciler=()=>createRecoveryReconciler({ledger,journal,storage,serving,keyFor,facts,rows:journal.rows,now:c.now});
 async function conversation(){const conversationId=randomUUID(),projection={conversationId,owner:{tenantId:tenant,actorId:owner},scopes:[],createdAt:new Date(c.now()).toISOString(),policyRevision:'p'};
  await pool.query('INSERT INTO meri_conversations.conversations(tenant_id,conversation_id,owner_actor_id,projection,projection_sha256) VALUES($1,$2,$3,$4,$5)',[tenant,conversationId,owner,projection,hash(projection)]);
  return {tenantId:tenant,kind:'conversation',subjectId:conversationId,ownerActorId:owner};}
 /** SDK mirror rows for a conversation: one run, one session, one stream and `sequences` entries; returns the exact row targets. */
 const fences=new Map();
 async function sdkRows(s,sequences=[1]){const writerFence=(fences.get(s.subjectId)??0)+1;fences.set(s.subjectId,writerFence);const runId=randomUUID(),sessionId=randomUUID(),projection={binding:{tenantId:tenant,actorId:owner,conversationId:s.subjectId,runId,attemptId:randomUUID(),workerId:randomUUID(),writerFence},state:'completed'},request={requestId:randomUUID()};
  await pool.query('INSERT INTO meri_conversations.runs(tenant_id,conversation_id,run_id,projection,projection_sha256,request_id,request,request_sha256,last_sequence) VALUES($1,$2,$3,$4,$5,$6,$7,$8,0)',[tenant,s.subjectId,runId,projection,hash(projection),request.requestId,request,hash(request)]);
  await pool.query('INSERT INTO meri_conversations.sdk_sessions(tenant_id,conversation_id,run_id,session_id,project_key,owner,owner_sha256) VALUES($1,$2,$3,$4,$5,$6,$7)',[tenant,s.subjectId,runId,sessionId,'project',{o:1},hash({o:1})]);
  await pool.query('INSERT INTO meri_conversations.sdk_session_streams(tenant_id,conversation_id,run_id,session_id,subpath,last_sequence) VALUES($1,$2,$3,$4,$5,$6)',[tenant,s.subjectId,runId,sessionId,'main',Math.max(...sequences)]);
  for(const sequence of sequences)await pool.query('INSERT INTO meri_conversations.sdk_session_entries(tenant_id,conversation_id,run_id,session_id,subpath,sequence,entry,entry_sha256) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[tenant,s.subjectId,runId,sessionId,'main',sequence,{e:sequence},hash({e:sequence})]);
  return sequences.map(sequence=>({entryId:randomUUID(),runId,sessionId,subpath:'main',sequence}));}
 const entryCount=async e=>(await pool.query('SELECT count(*)::int AS n FROM meri_conversations.sdk_session_entries WHERE run_id=$1 AND session_id=$2 AND subpath=$3 AND sequence=$4',[e.runId,e.sessionId,e.subpath,e.sequence])).rows[0].n;
 /** An artifact with `objects.length` database versions, the first one the head; each version binds the storage object given for it. */
 async function artifact(objects,conversationId){const artifactId=randomUUID(),versions=[];
  for(const [i,o] of objects.entries()){const versionId=randomUUID(),record={v:i,object:o};await pool.query('INSERT INTO meri_artifacts.versions(version_id,artifact_id,tenant_id,actor_id,conversation_id,request_sha256,record,record_sha256) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[versionId,artifactId,tenant,owner,conversationId,hash({r:i}),record,hash(record)]);versions.push({versionId,object:o});}
  await pool.query('INSERT INTO meri_artifacts.heads(artifact_id,version_id,tenant_id,actor_id,conversation_id,projection,projection_sha256) VALUES($1,$2,$3,$4,$5,$6,$7)',[artifactId,versions[0].versionId,tenant,owner,conversationId,{h:1},hash({h:1})]);
  return {subject:{tenantId:tenant,kind:'artifact',subjectId:artifactId,ownerActorId:owner},versions};}
 const versionCount=async artifactId=>(await pool.query('SELECT count(*)::int AS n FROM meri_artifacts.versions WHERE artifact_id=$1',[artifactId])).rows[0].n;
 const seed=plan=>{for(const st of plan.steps)store.put(keyFor(st),st.versionId);};
 const f={pool,clock:c,sink,ledger,journal,serving,suppression,store,storage,keyFor,current,facts,executor,reconciler,conversation,sdkRows,entryCount,artifact,versionCount,seed,principal:{tenantId:tenant,actorId:owner}};
 f.suppressed=async(s,inventory)=>{await suppression.suppress({principal:f.principal,subject:s,reason:'owner request'});c.advance(2*day);current.inventories.set(subjectKey(s),inventory);return journal.get(subjectKey(s));};
 return f;
}
test('the PostgreSQL journal round-trips suppression and release for conversation and artifact subjects, refuses stale and corrupt projections, and a purge executes storage, SDK mirror rows and the purge projection end to end',async t=>{
 const f=await fixture(t),s=await f.conversation(),key=subjectKey(s);
 assert.equal(await f.journal.get(key),null);
 const row=await f.suppression.suppress({principal:f.principal,subject:s,reason:'owner request'});assert.equal(row.state,'SUPPRESSED');
 const saved=await f.journal.get(key);assert.equal(saved.state,'SUPPRESSED');assert.equal(saved.ledgerSequence,1);assert.equal(saved.entrySha256,row.entrySha256);
 const db=(await f.pool.query('SELECT state,owner_actor_id,suppressed_at,released_at FROM meri_conversations.retention_subjects WHERE conversation_id=$1',[s.subjectId])).rows[0];assert.equal(db.state,'SUPPRESSED');assert.equal(db.owner_actor_id,owner);assert.ok(db.suppressed_at);assert.equal(db.released_at,null);
 const a={tenantId:tenant,kind:'artifact',subjectId:randomUUID(),ownerActorId:owner};await assert.rejects(f.suppression.suppress({principal:f.principal,subject:a,reason:'artifact'}),/RETENTION_SUBJECT_UNKNOWN/,'an artifact without a trusted head has no owner');
 const made=await f.artifact([object()],s.subjectId);await f.suppression.suppress({principal:f.principal,subject:made.subject,reason:'artifact'});assert.equal((await f.journal.get(subjectKey(made.subject))).state,'SUPPRESSED');
 await assert.rejects(f.suppression.suppress({principal:f.principal,subject:{...made.subject,ownerActorId:'actor-claimed'},reason:'altered claim'}),/RETENTION_OWNERSHIP_REFUSED/,'a caller-supplied ownership claim that differs from the application record is refused');
 await assert.rejects(f.journal.set(key,{...(await f.journal.get(key)),state:'RELEASED'},{expected:'0'.repeat(64)}),/RETENTION_STALE_WRITE/,'compare-and-set refuses a stale token');
 assert.deepEqual(new Set(await f.journal.keys()),new Set([key,subjectKey(made.subject)]));
 const released=await f.suppression.release({principal:f.principal,subject:s,reason:'withdrawn'});assert.equal(released.state,'RELEASED');assert.equal((await f.journal.get(key)).state,'RELEASED');
 assert.equal((await f.pool.query('SELECT suppressed_at FROM meri_conversations.retention_subjects WHERE conversation_id=$1',[s.subjectId])).rows[0].suppressed_at,null);
 const entries=await f.sdkRows(s,[1,2]);const js=await f.suppressed(s,enumerateReferences(snapshot(s,{sdkEntries:entries})));
 const plan=planFrom(f,s,js);assert.equal(plan.state,'PLANNED');assert.equal(plan.rowSteps.length,2);f.seed(plan);
 const done=await f.executor().execute(plan);assert.equal(done.state,'EXECUTED');assert.equal(done.rowSteps.length,2);assert.ok(done.rowSteps.every(r=>r.state==='EXECUTED'&&r.deleted===1));
 assert.ok(plan.steps.every(st=>!f.store.has(f.keyFor(st),st.versionId)),'storage versions deleted');for(const e of entries)assert.equal(await f.entryCount(e),0,'SDK mirror rows deleted');
 const purges=(await f.pool.query('SELECT workflow_id,state,class,receipt_sha256 FROM meri_conversations.retention_purges WHERE conversation_id=$1 ORDER BY workflow_id',[s.subjectId])).rows;
 assert.equal(purges.length,plan.steps.length);assert.ok(purges.every(p=>p.state==='EXECUTED'&&p.receipt_sha256));assert.deepEqual(purges.map(p=>p.workflow_id).sort(),plan.steps.map(st=>st.workflowId).sort());
 const targets=(await f.pool.query('SELECT workflow_id,state,run_id,session_id,subpath,sequence::int AS sequence FROM meri_conversations.retention_purge_targets WHERE conversation_id=$1 ORDER BY sequence',[s.subjectId])).rows;
 assert.deepEqual(targets.map(x=>[x.state,x.run_id,x.session_id,x.subpath,x.sequence]),entries.map(e=>['EXECUTED',e.runId,e.sessionId,e.subpath,e.sequence]),'the executed exact targets are projected');
 assert.equal((await f.executor().execute(plan)).replayed,true);
 await f.pool.query("UPDATE meri_conversations.retention_subjects SET projection=jsonb_set(projection,'{state}','\"RELEASED\"') WHERE conversation_id=$1",[s.subjectId]);
 await assert.rejects(f.journal.get(key),/RETENTION_STORE_CORRUPT/,'a projection whose bytes no longer match its hash is refused');
 await assert.rejects(f.journal.set('nonsense',{state:'SUPPRESSED'}),/RETENTION_INVALID_REQUEST/);
});
test('finding 3: two connections that both observed an absent row cannot both create it; concurrent suppressions of one subject leave exactly one row and a consistent generation after reconciliation',async t=>{
 const f=await fixture(t),s=await f.conversation(),key=subjectKey(s);
 const other=new pg.Pool({host:socket,user:'postgres',database:'postgres',max:4});t.after(()=>other.end());const second=createPostgresRetentionJournal({pool:other});
 assert.equal(await f.journal.get(key),null);assert.equal(await second.get(key),null,'both observed absence');
 const row=n=>({state:'SUPPRESSED',ownerActorId:owner,suppressedAtMs:f.clock.now(),ledgerSequence:n,entrySha256:String(n).repeat(64),authorization:{mode:'owner',receiptId:null},outstandingAccess:{signedUrlsExpireAtMs:null,inFlightRuns:[]},cancelled:[],purge:null});
 const outcomes=await Promise.allSettled([f.journal.set(key,row(1),{expected:null}),second.set(key,row(2),{expected:null})]);
 assert.deepEqual(outcomes.map(o=>o.status).sort(),['fulfilled','rejected'],'exactly one absent-row write wins');assert.match(outcomes.find(o=>o.status==='rejected').reason.message,/RETENTION_STALE_WRITE/);
 const rows=(await f.pool.query('SELECT ledger_sequence::int AS n FROM meri_conversations.retention_subjects WHERE conversation_id=$1',[s.subjectId])).rows;assert.equal(rows.length,1);
 assert.equal(rows[0].n,(await f.journal.get(key)).ledgerSequence,'the surviving row is the winner, never a blend');
 // Two suppression owners sharing one ledger race the same subject from two connections after both read absence.
 await f.pool.query('DELETE FROM meri_conversations.retention_subjects WHERE conversation_id=$1',[s.subjectId]);
 const ownerB=createSuppressionOwner({ledger:f.ledger,journal:second,ownership:f.journal,serving:f.serving,now:f.clock.now});
 const results=await Promise.allSettled([f.suppression.suppress({principal:f.principal,subject:s,reason:'a'}),ownerB.suppress({principal:f.principal,subject:s,reason:'b'})]);
 const ok=results.filter(r=>r.status==='fulfilled');assert.ok(ok.length>=1&&ok.length<=2);
 const after=(await f.pool.query('SELECT ledger_sequence::int AS n,entry_sha256 FROM meri_conversations.retention_subjects WHERE conversation_id=$1',[s.subjectId])).rows;assert.equal(after.length,1,'one row');
 if(ok.length===2)assert.ok(ok.some(r=>r.value.replayed===true),'a second reader after the first write replays the same entry');
 else{assert.match(results.find(r=>r.status==='rejected').reason.message,/RETENTION_PROJECTION_FAILED/,'the loser of the absent-row race acknowledged a different entry and fails closed');assert.equal(f.serving.isEnabled(),false);}
 const report=await f.reconciler().reconcile();assert.equal(f.serving.isEnabled(),true);const final=await f.journal.get(key);const lastEntry=(await f.ledger.replay()).filter(e=>subjectKey(e.subject)===key).at(-1);
 assert.equal(final.ledgerSequence,lastEntry.sequence,'the projected generation is the latest acknowledged suppression');assert.equal(final.entrySha256,lastEntry.entrySha256);void report;
});
test('finding 5: a SDK mirror row is deleted only by the transaction that recorded its exact target under the current serialized plan while the subject is SUPPRESSED; wrong class, run, session or entry, a released subject, a stale plan or generation, and UPDATE are refused; a failed transaction rolls everything back',async t=>{
 const f=await fixture(t),s=await f.conversation(),key=subjectKey(s);const [e1,e2]=await f.sdkRows(s,[1,2]);const [foreign]=await f.sdkRows(s,[1]);
 const js=await f.suppressed(s,enumerateReferences(snapshot(s,{sdkEntries:[e1]})));const plan=planFrom(f,s,js);assert.equal(plan.rowSteps.length,1);
 const del=(c,e)=>c.query('DELETE FROM meri_conversations.sdk_session_entries WHERE run_id=$1 AND session_id=$2 AND subpath=$3 AND sequence=$4',[e.runId,e.sessionId,e.subpath,e.sequence]);
 await assert.rejects(del(f.pool,e1),/SDK_MIRROR_IMMUTABLE/,'no target: refused');
 await assert.rejects(f.journal.tx(c=>f.journal.planRows(c,key,plan)),/RETENTION_PURGE_PLAN_MISMATCH/,'targets need the subject to carry this plan as its current plan');
 const planned={...js,purge:{state:'PLANNED',planSha256:plan.planSha256,ledgerSequence:js.ledgerSequence,steps:[],rowSteps:[]}};await f.journal.set(key,planned,{expected:projectionToken(js)});
 const stalePlan=planFrom(f,s,js,{policy:{...f.current.policy,version:4}});await assert.rejects(f.journal.tx(c=>f.journal.planRows(c,key,stalePlan)),/RETENTION_PURGE_PLAN_MISMATCH/,'a plan that is not the current recorded plan records no target');
 await assert.rejects(f.journal.tx(c=>f.journal.planRows(c,key,{...plan,suppression:{ledgerSequence:9,entrySha256:'9'.repeat(64)}})),/RETENTION_SUPPRESSION_GENERATION_REFUSED/,'another suppression generation records no target');
 await assert.rejects(f.journal.tx(async c=>{await f.journal.planRows(c,key,plan);await del(c,e2);}),unavailable('SDK_MIRROR_IMMUTABLE'),'same run and session, another entry: refused');
 await assert.rejects(f.journal.tx(async c=>{await f.journal.planRows(c,key,plan);await del(c,foreign);}),unavailable('SDK_MIRROR_IMMUTABLE'),'another run and session with the same sequence: refused');
 await assert.rejects(f.journal.tx(async c=>{await f.journal.planRows(c,key,plan);await c.query("UPDATE meri_conversations.sdk_session_entries SET entry='{}' WHERE run_id=$1 AND sequence=1",[e1.runId]);}),unavailable('SDK_MIRROR_IMMUTABLE'),'UPDATE is refused even with a target');
 await assert.rejects(f.journal.tx(async c=>{await f.journal.planRows(c,key,plan);await c.query("UPDATE meri_conversations.retention_subjects SET state='RELEASED',suppressed_at=NULL,released_at=now() WHERE conversation_id=$1",[s.subjectId]);await del(c,e1);}),unavailable('SDK_MIRROR_IMMUTABLE'),'a subject released inside the transaction admits nothing');
 await f.journal.tx(c=>f.journal.planRows(c,key,plan));await assert.rejects(del(f.pool,e1),/SDK_MIRROR_IMMUTABLE/,'a target recorded by another transaction admits nothing');
 await assert.rejects(f.journal.rows.purge(key,{...plan,rowSteps:[{workflowId:'a'.repeat(64),className:'artifactVersions',target:{artifactVersionId:randomUUID()}}]}),/RETENTION_INVALID_REQUEST/,'a row class that does not belong to the subject kind is refused');
 await assert.rejects(f.journal.tx(async c=>{await f.journal.planRows(c,key,plan);assert.equal((await del(c,e1)).rowCount,1,'admitted inside the recording transaction');throw new Error('simulated failure after the delete');}),/RETENTION_STORE_UNAVAILABLE/);
 assert.equal(await f.entryCount(e1),1,'rolled back: the entry is still there');assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM meri_conversations.retention_purge_targets WHERE conversation_id=$1 AND state=$2',[s.subjectId,'PLANNED'])).rows[0].n,1,'only the committed target remains');
 const records=await f.journal.rows.purge(key,plan);assert.deepEqual(records.map(r=>[r.state,r.deleted]),[['EXECUTED',1]]);assert.equal(await f.entryCount(e1),0);assert.equal(await f.entryCount(e2),1,'the untargeted entry survives');assert.equal(await f.entryCount(foreign),1);
 assert.equal(await f.journal.rows.present(key,plan.rowSteps[0]),false);assert.equal((await f.pool.query('SELECT state FROM meri_conversations.retention_purge_targets WHERE workflow_id=$1',[plan.rowSteps[0].workflowId])).rows[0].state,'EXECUTED');
 await f.suppression.release({principal:f.principal,subject:s,reason:'x'}).catch(()=>{});await f.journal.set(key,{...(await f.journal.get(key)),state:'RELEASED',releasedAtMs:f.clock.now(),purge:null},{expected:projectionToken(await f.journal.get(key))});
 await assert.rejects(f.journal.tx(c=>f.journal.planRows(c,key,plan)),/RETENTION_NOT_SUPPRESSED/,'a released subject records no target');
});
test('finding 6: database artifact versions keep their identity end to end: several versions sharing one storage object are each carried, deleted with the retired head in one transaction, projected per version, rebuilt from the ledger alone, and a revived version is re-planned',async t=>{
 const f=await fixture(t),conv=await f.conversation(),shared=object(),own=object();const made=await f.artifact([shared,shared,own],conv.subjectId),a=made.subject,key=subjectKey(a);
 const inv=enumerateReferences(snapshot(a,{sdkEntries:[],artifactVersions:made.versions}));assert.equal(inv.objects.length,2+2+1+2,'one checkpoint and one completion checkpoint of two objects each, one selected output, and the two artifact storage objects');
 const sharedObject=inv.objects.find(o=>o.objectId===shared.objectId);assert.deepEqual(sharedObject.artifactVersionIds,made.versions.slice(0,2).map(v=>v.versionId).sort());assert.deepEqual(inv.rowTargets.map(r=>r.className),['artifactVersions','artifactVersions','artifactVersions']);
 const js=await f.suppressed(a,inv),plan=planFrom(f,a,js);f.seed(plan);assert.equal(plan.rowSteps.length,3);
 await assert.rejects(f.pool.query('DELETE FROM meri_artifacts.versions WHERE version_id=$1',[made.versions[2].versionId]),/MERI_ARTIFACT_VERSION_IMMUTABLE/);
 const done=await f.executor().execute(plan);assert.equal(done.state,'EXECUTED');assert.deepEqual(done.rowSteps.map(r=>[r.state,r.deleted]),[['EXECUTED',1],['EXECUTED',1],['EXECUTED',1]]);
 assert.equal(await f.versionCount(a.subjectId),0);assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM meri_artifacts.heads WHERE artifact_id=$1',[a.subjectId])).rows[0].n,0,'the head was retired in the same transaction');
 const projected=async()=>(await f.pool.query('SELECT version_id,state,object_id FROM meri_artifacts.retention_purges WHERE artifact_id=$1 ORDER BY version_id',[a.subjectId])).rows;
 const rows=(await projected()).filter(r=>r.version_id);assert.deepEqual(rows.map(r=>r.version_id).sort(),made.versions.map(v=>v.versionId).sort(),'one purge row per database version');assert.ok((await projected()).every(r=>r.state==='EXECUTED'));
 assert.equal(rows.filter(r=>r.object_id===shared.objectId).length,2,'both versions name the storage object they shared');assert.equal((await projected()).filter(r=>!r.version_id).length,inv.objects.length-2,'storage-only steps carry no database version');
 const facts=(await f.sink.read()).at(-1).facts;assert.deepEqual(facts.rowSteps.map(r=>r.target.artifactVersionId).sort(),made.versions.map(v=>v.versionId).sort(),'the ledger carries every version identity');
 // Ledger-only recovery: the retention tables are restored to before the suppression; everything is rebuilt from the ledger and re-verified.
 await f.pool.query('DELETE FROM meri_artifacts.retention_purges WHERE artifact_id=$1',[a.subjectId]);await f.pool.query('DELETE FROM meri_artifacts.retention_subjects WHERE artifact_id=$1',[a.subjectId]);assert.equal(await f.journal.get(key),null);
 const report=await f.reconciler().reconcile();assert.deepEqual(report.reapplied,[key]);assert.deepEqual(report.verified,[key]);const rebuilt=await f.journal.get(key);assert.equal(rebuilt.purge.state,'EXECUTED');assert.equal(rebuilt.purge.planSha256,plan.planSha256);
 assert.deepEqual(rebuilt.purge.rowSteps.map(r=>[r.target.artifactVersionId,r.state]).sort(),made.versions.map(v=>[v.versionId,'EXECUTED']).sort());assert.deepEqual((await projected()).map(r=>r.version_id).filter(Boolean).sort(),made.versions.map(v=>v.versionId).sort());
 // A restored database brings one version back: recovery sees the revival, re-plans under the current generation, and the plan executes again deleting exactly it.
 const revived=made.versions[1];await f.pool.query('INSERT INTO meri_artifacts.versions(version_id,artifact_id,tenant_id,actor_id,conversation_id,request_sha256,record,record_sha256) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[revived.versionId,a.subjectId,tenant,owner,conv.subjectId,hash({r:1}),{v:1},hash({v:1})]);
 const second=await f.reconciler().reconcile();assert.deepEqual(second.replanned,[key]);const replanned=await f.journal.get(key);assert.equal(replanned.purge.state,'PLANNED');assert.equal((await f.sink.read()).at(-1).reason,'RESTORE_REVIVED_VERSION');
 const again=planFrom(f,a,replanned);assert.equal(again.planSha256,replanned.purge.planSha256);const redo=await f.executor().execute(again);assert.equal(redo.state,'EXECUTED');
 assert.deepEqual(redo.rowSteps.map(r=>[r.target.artifactVersionId,r.deleted]).sort(),made.versions.map(v=>[v.versionId,v.versionId===revived.versionId?1:0]).sort(),'exactly the revived version is deleted');assert.equal(await f.versionCount(a.subjectId),0);
});
test('recovery over the PostgreSQL journal: a restore that predates a suppression is re-applied from the ledger behind the barrier; a restore that revives a purged SDK mirror row is re-planned',async t=>{
 const f=await fixture(t),s=await f.conversation(),key=subjectKey(s);
 await f.suppression.suppress({principal:f.principal,subject:s,reason:'owner request'});assert.equal(await f.suppression.isSuppressed(s),true);
 await f.pool.query('DELETE FROM meri_conversations.retention_subjects WHERE conversation_id=$1',[s.subjectId]);assert.equal(await f.journal.get(key),null,'the restored database has forgotten the suppression');
 f.serving.disable();await assert.rejects(f.suppression.isSuppressed(s),/RETENTION_RECOVERY_BARRIER/);
 const report=await f.reconciler().reconcile();assert.deepEqual(report.reapplied,[key]);assert.equal(await f.suppression.isSuppressed(s),true);
 const row=(await f.pool.query('SELECT state,ledger_sequence::int AS seq FROM meri_conversations.retention_subjects WHERE conversation_id=$1',[s.subjectId])).rows[0];assert.deepEqual(row,{state:'SUPPRESSED',seq:1});
 assert.deepEqual((await f.reconciler().reconcile()).reapplied,[],'idempotent');
 const [e1]=await f.sdkRows(s,[1]);f.clock.advance(2*day);f.current.inventories.set(key,enumerateReferences(snapshot(s,{sdkEntries:[e1]})));const plan=planFrom(f,s,await f.journal.get(key));f.seed(plan);
 assert.equal((await f.executor().execute(plan)).state,'EXECUTED');assert.equal(await f.entryCount(e1),0);
 await f.pool.query('INSERT INTO meri_conversations.sdk_session_entries(tenant_id,conversation_id,run_id,session_id,subpath,sequence,entry,entry_sha256) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[tenant,s.subjectId,e1.runId,e1.sessionId,e1.subpath,e1.sequence,{e:1},hash({e:1})]);
 const revived=await f.reconciler().reconcile();assert.deepEqual(revived.replanned,[key]);assert.equal((await f.journal.get(key)).purge.state,'PLANNED');
 const again=planFrom(f,s,await f.journal.get(key));assert.equal((await f.executor().execute(again)).state,'EXECUTED');assert.equal(await f.entryCount(e1),0);
});
