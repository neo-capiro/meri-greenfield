/** Real task-owned PostgreSQL 16 with migrations 0001–0010 and artifacts 0001–0002 applied by provision-postgres.sh: the retention
 * journal adapter, the trigger amendments (a purge DELETE is admitted only inside the transaction that recorded the PLANNED purge
 * row) and recovery after a simulated restore. Synthetic tenants, actors, objects and hashes; no bucket, credential or provider. */
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import pg from '../../../runtime/node_modules/pg/lib/index.js';
import {createPostgresRetentionJournal} from '../postgres-journal.mjs';
import {createRetentionLedger,createMemoryLedgerSink} from '../ledger.mjs';
import {createSuppressionOwner} from '../suppression.mjs';
import {createRecoveryReconciler,createServingGate} from '../reconciliation.mjs';
import {planPurge,createPurgeExecutor} from '../purge.mjs';
import {enumerateReferences} from '../inventory.mjs';
import {hash,subjectKey} from '../boundary.mjs';
import {policy,snapshot,bucket,clock,tenant,owner} from './fixture.mjs';
import {createVersionStorage} from '../storage-port.mjs';
const socket=process.env.MERI_BROKER_TEST_SOCKET??'/tmp/meri-broker-pg-socket-20261014';
async function fixture(t){
 const pool=new pg.Pool({host:socket,user:'postgres',database:'postgres',max:6});t.after(()=>pool.end());
 const listen=(await pool.query("SELECT current_setting('listen_addresses') AS l")).rows[0].l;assert.equal(listen,'','task-owned socket-only cluster');
 await pool.query('TRUNCATE meri_conversations.retention_purges,meri_conversations.retention_subjects,meri_artifacts.retention_purges,meri_artifacts.retention_subjects CASCADE');
 await pool.query('TRUNCATE meri_conversations.conversations CASCADE');await pool.query('TRUNCATE meri_artifacts.versions,meri_artifacts.heads CASCADE');
 const c=clock(),sink=createMemoryLedgerSink(),ledger=createRetentionLedger({sink,now:c.now}),journal=createPostgresRetentionJournal({pool}),serving=createServingGate();
 const suppression=createSuppressionOwner({ledger,journal,serving,now:c.now});
 async function conversation(){const conversationId=randomUUID(),projection={conversationId,owner:{tenantId:tenant,actorId:owner},scopes:[],createdAt:new Date(c.now()).toISOString(),policyRevision:'p'};
  await pool.query('INSERT INTO meri_conversations.conversations(tenant_id,conversation_id,owner_actor_id,projection,projection_sha256) VALUES($1,$2,$3,$4,$5)',[tenant,conversationId,owner,projection,hash(projection)]);
  return {tenantId:tenant,kind:'conversation',subjectId:conversationId,ownerActorId:owner};}
 return {pool,clock:c,sink,ledger,journal,serving,suppression,conversation,principal:{tenantId:tenant,actorId:owner}};
}
test('the PostgreSQL journal round-trips suppression and release for conversation and artifact subjects, mirrors purge steps as rows, and refuses corrupt projections',async t=>{
 const f=await fixture(t),s=await f.conversation(),key=subjectKey(s);
 assert.equal(await f.journal.get(key),null);
 const row=await f.suppression.suppress({principal:f.principal,subject:s,reason:'owner request'});assert.equal(row.state,'SUPPRESSED');
 const saved=await f.journal.get(key);assert.equal(saved.state,'SUPPRESSED');assert.equal(saved.ledgerSequence,1);assert.equal(saved.entrySha256,row.entrySha256);
 const db=(await f.pool.query('SELECT state,owner_actor_id,suppressed_at,released_at FROM meri_conversations.retention_subjects WHERE conversation_id=$1',[s.subjectId])).rows[0];assert.equal(db.state,'SUPPRESSED');assert.equal(db.owner_actor_id,owner);assert.ok(db.suppressed_at);assert.equal(db.released_at,null);
 const a={tenantId:tenant,kind:'artifact',subjectId:randomUUID(),ownerActorId:owner};await f.suppression.suppress({principal:f.principal,subject:a,reason:'artifact'});assert.equal((await f.journal.get(subjectKey(a))).state,'SUPPRESSED');
 assert.deepEqual(new Set(await f.journal.keys()),new Set([key,subjectKey(a)]));
 const released=await f.suppression.release({principal:f.principal,subject:s,reason:'withdrawn'});assert.equal(released.state,'RELEASED');assert.equal((await f.journal.get(key)).state,'RELEASED');
 assert.equal((await f.pool.query('SELECT suppressed_at FROM meri_conversations.retention_subjects WHERE conversation_id=$1',[s.subjectId])).rows[0].suppressed_at,null);
 await f.suppression.suppress({principal:f.principal,subject:s,reason:'again'});f.clock.advance(2*86400000);
 const inv=enumerateReferences(snapshot(s)),js=await f.journal.get(key),plan=planPurge({subject:s,journalState:js,policy:policy(),inventory:inv,shared:[],holds:()=>({objectLockRetainUntilMs:null,legalHold:false}),liabilities:[],lastActivityAtMs:f.clock.now()-30*86400000,nowMs:f.clock.now()});
 const store=bucket();for(const st of plan.steps)store.put(`${tenant}/${st.objectId}/${st.sha256}`,st.versionId);
 const storage=createVersionStorage({send:store.send,bucket:'synthetic-bucket',expectedBucketOwner:'967807252336',permissions:{getObjectVersion:true,listBucketVersions:true,deleteObjectVersion:true},now:f.clock.now,maxRequestMs:200});
 const exec=createPurgeExecutor({storage,ledger:f.ledger,journal:f.journal,keyFor:st=>`${tenant}/${st.objectId}/${st.sha256}`,enabled:true,now:f.clock.now});
 const done=await exec.execute(plan);assert.equal(done.state,'EXECUTED');
 const purges=(await f.pool.query('SELECT workflow_id,state,class,receipt_sha256 FROM meri_conversations.retention_purges WHERE conversation_id=$1 ORDER BY workflow_id',[s.subjectId])).rows;
 assert.equal(purges.length,plan.steps.length);assert.ok(purges.every(p=>p.state==='EXECUTED'&&p.receipt_sha256));assert.deepEqual(purges.map(p=>p.workflow_id).sort(),plan.steps.map(st=>st.workflowId).sort());
 await f.pool.query("UPDATE meri_conversations.retention_subjects SET projection=jsonb_set(projection,'{state}','\"RELEASED\"') WHERE conversation_id=$1",[s.subjectId]);
 await assert.rejects(f.journal.get(key),/RETENTION_STORE_CORRUPT/,'a projection whose bytes no longer match its hash is refused');
 await assert.rejects(f.journal.set('nonsense',{state:'SUPPRESSED'}),/RETENTION_INVALID_REQUEST/);
});
test('trigger amendments: SDK mirror rows and artifact versions stay immutable except for a DELETE inside the transaction that recorded the PLANNED purge rows',async t=>{
 const f=await fixture(t),s=await f.conversation(),key=subjectKey(s);await f.suppression.suppress({principal:f.principal,subject:s,reason:'owner request'});
 const runId=randomUUID(),sessionId=randomUUID(),projection={binding:{tenantId:tenant,actorId:owner,conversationId:s.subjectId,runId,attemptId:randomUUID(),workerId:randomUUID(),writerFence:1},state:'completed'},request={requestId:randomUUID()};
 await f.pool.query('INSERT INTO meri_conversations.runs(tenant_id,conversation_id,run_id,projection,projection_sha256,request_id,request,request_sha256,last_sequence) VALUES($1,$2,$3,$4,$5,$6,$7,$8,0)',[tenant,s.subjectId,runId,projection,hash(projection),request.requestId,request,hash(request)]);
 await f.pool.query('INSERT INTO meri_conversations.sdk_sessions(tenant_id,conversation_id,run_id,session_id,project_key,owner,owner_sha256) VALUES($1,$2,$3,$4,$5,$6,$7)',[tenant,s.subjectId,runId,sessionId,'project',{o:1},hash({o:1})]);
 await f.pool.query('INSERT INTO meri_conversations.sdk_session_streams(tenant_id,conversation_id,run_id,session_id,subpath,last_sequence) VALUES($1,$2,$3,$4,$5,1)',[tenant,s.subjectId,runId,sessionId,'main']);
 await f.pool.query('INSERT INTO meri_conversations.sdk_session_entries(tenant_id,conversation_id,run_id,session_id,subpath,sequence,entry,entry_sha256) VALUES($1,$2,$3,$4,$5,1,$6,$7)',[tenant,s.subjectId,runId,sessionId,'main',{e:1},hash({e:1})]);
 await assert.rejects(f.pool.query('DELETE FROM meri_conversations.sdk_session_entries WHERE run_id=$1',[runId]),/SDK_MIRROR_IMMUTABLE/,'no purge row: refused');
 await assert.rejects(f.pool.query("UPDATE meri_conversations.sdk_session_entries SET entry='{}' WHERE run_id=$1",[runId]),/SDK_MIRROR_IMMUTABLE/,'update always refused');
 const plan={planSha256:'1'.repeat(64),ledgerSequence:1,steps:[{workflowId:'2'.repeat(64),className:'sdkSession',objectId:randomUUID(),versionId:'v1',sha256:'3'.repeat(64)}]};
 // Rows recorded in a committed, separate transaction do not admit a later DELETE: the trigger requires the recording transaction itself.
 await f.journal.tx(c=>f.journal.planRows(c,key,plan));
 await assert.rejects(f.pool.query('DELETE FROM meri_conversations.sdk_session_entries WHERE run_id=$1',[runId]),/SDK_MIRROR_IMMUTABLE/,'planned in another transaction: still refused');
 await f.pool.query('DELETE FROM meri_conversations.retention_purges WHERE conversation_id=$1',[s.subjectId]);
 const deleted=await f.journal.tx(async c=>{await f.journal.planRows(c,key,plan);const r=await c.query('DELETE FROM meri_conversations.sdk_session_entries WHERE run_id=$1',[runId]);return r.rowCount;});
 assert.equal(deleted,1,'planned in the same transaction: admitted');assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM meri_conversations.sdk_session_entries WHERE run_id=$1',[runId])).rows[0].n,0);
 // Artifact versions: the same rule keyed by the exact version.
 const versionId=randomUUID(),artifactId=randomUUID(),record={v:1};
 await f.pool.query('INSERT INTO meri_artifacts.versions(version_id,artifact_id,tenant_id,actor_id,conversation_id,request_sha256,record,record_sha256) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[versionId,artifactId,tenant,owner,s.subjectId,'4'.repeat(64),record,hash(record)]);
 await assert.rejects(f.pool.query('DELETE FROM meri_artifacts.versions WHERE version_id=$1',[versionId]),/MERI_ARTIFACT_VERSION_IMMUTABLE/);
 const a={tenantId:tenant,kind:'artifact',subjectId:artifactId,ownerActorId:owner};await f.suppression.suppress({principal:f.principal,subject:a,reason:'artifact'});
 const aplan={planSha256:'5'.repeat(64),ledgerSequence:2,steps:[{workflowId:'6'.repeat(64),artifactVersionId:versionId,objectId:randomUUID(),versionId:'ov1',sha256:'7'.repeat(64)}]};
 const otherPlan={...aplan,steps:[{...aplan.steps[0],workflowId:'8'.repeat(64),artifactVersionId:randomUUID()}]};
 await assert.rejects(f.journal.tx(async c=>{await f.journal.planRows(c,subjectKey(a),otherPlan);await c.query('DELETE FROM meri_artifacts.versions WHERE version_id=$1',[versionId]);}),e=>e.code==='RETENTION_STORE_UNAVAILABLE'&&/MERI_ARTIFACT_VERSION_IMMUTABLE/.test(e.cause?.message),'a planned purge of a different version does not admit this one');
 const n=await f.journal.tx(async c=>{await f.journal.planRows(c,subjectKey(a),aplan);return (await c.query('DELETE FROM meri_artifacts.versions WHERE version_id=$1',[versionId])).rowCount;});assert.equal(n,1);
});
test('recovery over the PostgreSQL journal: a restore that predates a suppression is re-applied from the ledger behind the barrier',async t=>{
 const f=await fixture(t),s=await f.conversation(),key=subjectKey(s);
 await f.suppression.suppress({principal:f.principal,subject:s,reason:'owner request'});assert.equal(await f.suppression.isSuppressed(s),true);
 await f.pool.query('DELETE FROM meri_conversations.retention_subjects WHERE conversation_id=$1',[s.subjectId]);assert.equal(await f.journal.get(key),null,'the restored database has forgotten the suppression');
 const reconciler=createRecoveryReconciler({ledger:f.ledger,journal:f.journal,storage:{headVersion:async()=>({outcome:'UNKNOWN'})},serving:f.serving,keyFor:st=>st.objectId,holds:()=>({objectLockRetainUntilMs:null,legalHold:false}),liabilities:async()=>[],now:f.clock.now});
 f.serving.disable();await assert.rejects(f.suppression.isSuppressed(s),/RETENTION_RECOVERY_BARRIER/);
 const report=await reconciler.reconcile();assert.deepEqual(report.reapplied,[key]);assert.equal(await f.suppression.isSuppressed(s),true);
 const row=(await f.pool.query('SELECT state,ledger_sequence::int AS seq FROM meri_conversations.retention_subjects WHERE conversation_id=$1',[s.subjectId])).rows[0];assert.deepEqual(row,{state:'SUPPRESSED',seq:1});
 assert.deepEqual((await reconciler.reconcile()).reapplied,[],'idempotent');
});
