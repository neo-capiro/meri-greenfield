/** VQA025 native read-budget verification fixture — SOURCE PREPARATION ONLY.
 *
 * This file is committed for a separately allocated native execution; it must not be run by the preparation
 * author. It exercises the real chain
 *   createRetentionReadGate -> watermarkedJournal -> createPostgresWatermarkStore.readProjection
 *   -> createPostgresRetentionJournal.tx
 * and the real createArtifactService.inspect with plan-allowed synthetic object/version ports.
 *
 * Requirements (refused, never defaulted):
 *   MERI_VQA025_NATIVE_TARGET = JSON {"socketDir","database","user","nonce"} for ONE fresh task-owned
 *   PostgreSQL 16 Unix-socket namespace. No PG environment/default socket fallback.
 *   The checkout must carry the existing qualified pg dependency at ../../../runtime/node_modules/pg.
 *
 * Finite unit: exactly 3 gate-owner calls; at most 3 native clients including the blocker; exactly 4
 * transaction attempts (2+1+1); at most 80 SQL statements; 60s per case; 180s total. One synthetic
 * tenant/conversation/retention subject/singleton watermark. No TRUNCATE/reset, no customer rows, no
 * object/provider/Core/HTTP calls. Any missing schema/target/dependency, unexpected count, timeout or
 * failure stops the unit and preserves evidence; it is not repeated.
 */
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import pg from '../../../runtime/node_modules/pg/lib/index.js';
import {createPostgresRetentionJournal} from '../postgres-journal.mjs';
import {createPostgresWatermarkStore} from '../postgres-watermark.mjs';
import {watermarkedJournal} from '../recovery-watermark.mjs';
import {createRetentionReadGate} from '../suppression.mjs';
import {createServingFence} from '../serving-fence.mjs';
import {hash} from '../boundary.mjs';
import {createArtifactService} from '../../../artifacts/service.mjs';
import {v as artifactValidators} from '../../../artifacts/storage/boundary.mjs';

const CAPS=Object.freeze({gateOwnerCalls:3,nativeClients:3,transactionAttempts:4,statements:80,caseMs:60000,setupMs:120000,totalMs:180000});

// ---- Explicit isolated target. No implicit PG defaults, secret or environment dump. ----------------
const rawTarget=process.env.MERI_VQA025_NATIVE_TARGET;
if(typeof rawTarget!=='string'||!rawTarget)throw new Error('VQA025_NATIVE_TARGET_REQUIRED');
let parsedTarget;try{parsedTarget=JSON.parse(rawTarget);}catch{throw new Error('VQA025_NATIVE_TARGET_INVALID');}
if(!parsedTarget||typeof parsedTarget!=='object'||Array.isArray(parsedTarget)||Object.keys(parsedTarget).sort().join(',')!=='database,nonce,socketDir,user')throw new Error('VQA025_NATIVE_TARGET_SHAPE');
const TARGET=Object.freeze({socketDir:parsedTarget.socketDir,database:parsedTarget.database,user:parsedTarget.user,nonce:parsedTarget.nonce});
for(const value of Object.values(TARGET))if(typeof value!=='string'||!value||value.length>256)throw new Error('VQA025_NATIVE_TARGET_INVALID');
if(!/^[a-f0-9]{16,64}$/u.test(TARGET.nonce))throw new Error('VQA025_NATIVE_TARGET_INVALID');
if(!/vqa025/u.test(TARGET.socketDir)||/meri-broker-pg-socket-20261014|meri-local-baseline-pg|meri-prepared-kickoff-pg-20261014/u.test(TARGET.socketDir))throw new Error('VQA025_NATIVE_TARGET_NOT_ISOLATED');

// ---- One fictional tenant/conversation/subject/watermark. -----------------------------------------
const TENANT='vqa025-native-tenant';
const ACTOR='vqa025-native-actor';
const CONVERSATION='02500000-0000-4000-8000-000000000001';
const RUN='02500000-0000-4000-8000-000000000003';
const ATTEMPT='02500000-0000-4000-8000-000000000004';
const WORKER='02500000-0000-4000-8000-000000000005';
const VERSION='02500000-0000-4000-8000-000000000006';
const CLIENT='vqa025-native-client';
const ENTRY_SHA='a'.repeat(64);
const SUBJECT=Object.freeze({tenantId:TENANT,kind:'conversation',subjectId:CONVERSATION,ownerActorId:ACTOR});
const WATERMARK={sequence:1,entrySha256:null};

const classify=sql=>sql==='BEGIN'||sql.startsWith('BEGIN ')?'BEGIN':sql==='COMMIT'?'COMMIT':sql==='ROLLBACK'?'ROLLBACK':
 sql.startsWith('SET LOCAL')?'SET':sql.startsWith('SELECT pg_advisory_xact_lock_shared')?'LOCK_SHARED':
 sql.startsWith('SELECT s.projection,')?'JOINED_READ':sql.startsWith('SELECT pg_advisory_lock(')?'BLOCKER_LOCK':
 sql.startsWith('SELECT pg_advisory_unlock(')?'BLOCKER_UNLOCK':sql.startsWith('INSERT INTO')?'SEED':
 sql.startsWith('SELECT to_regclass')?'SCHEMA':sql.startsWith('SELECT current_setting')?'SERVER':'OTHER';

const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
const mono=()=>Number(process.hrtime.bigint())/1e6;
const retired=deferred();
const withDeadline=(promise,ms,label)=>{let timer;const guard=new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(new Error(`VQA025_NATIVE_${label}_TIMEOUT`),{code:`VQA025_NATIVE_${label}_TIMEOUT`})),ms);});return Promise.race([promise,guard]).finally(()=>clearTimeout(timer));};

const rec={
  startedAt:Date.now(),startedMono:mono(),evidence:[],statements:[],errors:[],releases:[],gateCalls:[],begin:0,commit:0,rollback:0,rollbackAck:0,
  nativeClients:0,clientEnded:false,blockerLocks:0,blockerUnlocks:0,firstSharedSqlstate:null,onLockTimeout:null,onPhase:null,
  note(sql){const phase=classify(sql);this.statements.push({phase,sql:sql.slice(0,160),at:Date.now(),mono:mono()});
    if(phase==='BEGIN')this.begin++;if(phase==='COMMIT')this.commit++;if(phase==='ROLLBACK')this.rollback++;this.onPhase?.(phase);},
  ok(sql){if(sql==='ROLLBACK')this.rollbackAck++;},
  error(sql,error){const phase=classify(sql);this.errors.push({phase,code:error?.code??null,at:Date.now(),mono:mono()});
    if(phase==='LOCK_SHARED'&&this.firstSharedSqlstate===null)this.firstSharedSqlstate=error?.code??null;
    if(phase==='LOCK_SHARED'&&error?.code==='55P03'&&this.onLockTimeout){const fire=this.onLockTimeout;this.onLockTimeout=null;fire({at:Date.now(),mono:mono()});}},
  release(error){this.releases.push({error:error?String(error.code??'error').slice(0,64):null,at:Date.now(),mono:mono()});},
  count(phase){return this.statements.filter(entry=>entry.phase===phase).length;},
  mark(){return {begin:this.begin,commit:this.commit,rollback:this.rollback,rollbackAck:this.rollbackAck,joined:this.count('JOINED_READ'),lock:this.count('LOCK_SHARED'),statements:this.statements.length,errors:this.errors.length,releases:this.releases.length};},
  delta(before){return {begin:this.begin-before.begin,commit:this.commit-before.commit,rollback:this.rollback-before.rollback,rollbackAck:this.rollbackAck-before.rollbackAck,joined:this.count('JOINED_READ')-before.joined,lock:this.count('LOCK_SHARED')-before.lock,statements:this.statements.length-before.statements,errors:this.errors.length-before.errors,releases:this.releases.length-before.releases};},
};
const state={aborted:false};
const guarded=async(t,body)=>{if(state.aborted){t.skip('unit stopped after an earlier failure');return;}try{await body();}catch(error){state.aborted=true;throw error;}};

/** Pass-through observer: the real driver executes every statement; the unit only records phase/result. */
const observed=(client)=>{let ended=false;return {
  async query(sql,values){rec.note(sql);try{const result=await client.query(sql,values);rec.ok(sql);return result;}catch(error){rec.error(sql,error);throw error;}},
  release(error){rec.release(error??null);if(error&&!ended){ended=true;rec.clientEnded=true;retired.resolve();client.end().catch(()=>{});}},
  ended:()=>ended,
};};

let readClient,blocker,readLease,blockerLease,journal,tracked,gate,gatePort,service;
const versionReads=[],objectReads=[],publications=[],executions=[];

before(async()=>{
  readClient=new pg.Client({host:TARGET.socketDir,database:TARGET.database,user:TARGET.user,application_name:'vqa025-native-read'});
  await readClient.connect();rec.nativeClients++;
  blocker=new pg.Client({host:TARGET.socketDir,database:TARGET.database,user:TARGET.user,application_name:'vqa025-native-blocker'});
  await blocker.connect();rec.nativeClients++;
  if(rec.nativeClients>CAPS.nativeClients)throw new Error('VQA025_NATIVE_CLIENT_CAP');
  readLease=observed(readClient);blockerLease=observed(blocker);
  const server=(await readLease.query("SELECT current_setting('listen_addresses') AS listen,current_database() AS db,current_setting('server_version') AS version,current_user AS usr")).rows[0];
  if(server.listen!=='')throw new Error('VQA025_NATIVE_NOT_SOCKET_ONLY');
  if(server.db!==TARGET.database||server.usr!==TARGET.user)throw new Error('VQA025_NATIVE_TARGET_MISMATCH');
  if(!/^16\./u.test(server.version))throw new Error('VQA025_NATIVE_PG16_REQUIRED');
  const schema=(await readLease.query("SELECT to_regclass('meri_conversations.conversations') IS NOT NULL AS c,to_regclass('meri_conversations.retention_subjects') IS NOT NULL AS s,to_regclass('meri_conversations.retention_recovery_watermark') IS NOT NULL AS w")).rows[0];
  if(!schema.c||!schema.s||!schema.w)throw new Error('VQA025_NATIVE_SCHEMA_MISSING');
  const conversationProjection={conversationId:CONVERSATION,owner:{tenantId:TENANT,actorId:ACTOR},scopes:[],createdAt:new Date(1700000000000).toISOString(),policyRevision:'vqa025-native'};
  await readLease.query('INSERT INTO meri_conversations.conversations(tenant_id,conversation_id,owner_actor_id,projection,projection_sha256) VALUES($1,$2,$3,$4,$5) ON CONFLICT (tenant_id,conversation_id) DO NOTHING',[TENANT,CONVERSATION,ACTOR,conversationProjection,hash(conversationProjection)]);
  const subjectProjection={state:'RELEASED',ledgerSequence:WATERMARK.sequence,entrySha256:ENTRY_SHA,ownerActorId:ACTOR,releasedAtMs:1700000000000};
  await readLease.query('INSERT INTO meri_conversations.retention_subjects(tenant_id,conversation_id,owner_actor_id,state,suppressed_at,released_at,ledger_sequence,entry_sha256,projection,projection_sha256) VALUES($1,$2,$3,$4,NULL,NULL,$5,$6,$7,$8) ON CONFLICT (tenant_id,conversation_id) DO NOTHING',[TENANT,CONVERSATION,ACTOR,'RELEASED',WATERMARK.sequence,ENTRY_SHA,subjectProjection,hash(subjectProjection)]);
  await readLease.query('INSERT INTO meri_conversations.retention_recovery_watermark(singleton,sequence,entry_sha256) VALUES(true,$1,$2) ON CONFLICT (singleton) DO NOTHING',[WATERMARK.sequence,WATERMARK.entrySha256]);
  if(rec.statements.length>CAPS.statements)throw new Error('VQA025_NATIVE_STATEMENT_CAP');
  const pool={async connect(){return observed(readClient);}};
  journal=createPostgresRetentionJournal({pool,now:()=>Date.now(),maxRequestMs:10000});
  const watermark=createPostgresWatermarkStore({journal});
  const fence=createServingFence();fence.enable({watermark:WATERMARK});
  tracked=watermarkedJournal({journal,watermark,fence,ledger:{async head(){return {...WATERMARK};}}});
  gate=createRetentionReadGate({journal:tracked,serving:fence,log(){}});
  gatePort={assertServable(subject,options){rec.gateCalls.push({subject,deadlineMs:options?.deadlineMs??null,signal:options?.signal??null,at:Date.now()});return gate.assertServable(subject,options);}};
  service=createArtifactService({validators:artifactValidators,
    authorize:async request=>({receiptId:'vqa025-native-receipt',decision:'allow',action:request.action,binding:structuredClone(request.binding),scopesSha256:artifactValidators.hash(request.scopes),resourceSha256:artifactValidators.hash(request.resource),requestSha256:request.requestSha256,expiresAtMs:request.deadlineMs}),
    versions:{read:async()=>{versionReads.push(1);throw Object.assign(Error('UNEXPECTED_VERSION_READ'),{code:'UNEXPECTED_VERSION_READ'});},commit:async()=>{publications.push(1);throw Object.assign(Error('UNEXPECTED_VERSION_COMMIT'),{code:'UNEXPECTED_VERSION_COMMIT'});}},
    objects:{get:async()=>{objectReads.push(1);throw Object.assign(Error('UNEXPECTED_OBJECT_READ'),{code:'UNEXPECTED_OBJECT_READ'});},put:async()=>{publications.push(1);throw Object.assign(Error('UNEXPECTED_OBJECT_WRITE'),{code:'UNEXPECTED_OBJECT_WRITE'});}},
    executor:{execute:async()=>{executions.push(1);throw Object.assign(Error('UNEXPECTED_EXECUTION'),{code:'UNEXPECTED_EXECUTION'});}},
    now:()=>Date.now(),ids:()=>({}),retention:gatePort});
});

after(async()=>{try{await readClient?.end();}catch{}try{await blocker?.end();}catch{}});

const lockBlocker=async()=>{const result=await blockerLease.query("SELECT pg_advisory_lock(hashtextextended('meri_retention_recovery',0)) AS locked");rec.blockerLocks++;return result;};
const unlockBlocker=async()=>{const result=await blockerLease.query("SELECT pg_advisory_unlock(hashtextextended('meri_retention_recovery',0)) AS unlocked");rec.blockerUnlocks++;assert.equal(result.rows[0].unlocked,true,'the owned blocker was released');};
const artifactContext=deadlineMs=>({binding:{tenantId:TENANT,actorId:ACTOR,conversationId:CONVERSATION,runId:RUN,attemptId:ATTEMPT,workerId:WORKER,writerFence:1},scopes:[{tenantId:TENANT,kind:'client',resourceId:CLIENT,policyRevision:'vqa025-native'}],evidence:[],assets:[],deadlineMs,maxBytes:1048576});

test('case 1: one genuine shared-wait 55P03, confirmed ROLLBACK, one fresh retry accepted before the 5s cutoff',{timeout:CAPS.caseMs},async t=>{
  await guarded(t,async()=>{
    const before=rec.mark();await lockBlocker();
    const entry=Date.now();const firstTimeout=deferred();rec.onLockTimeout=firstTimeout.resolve;
    const attempt=gatePort.assertServable(SUBJECT);
    const observedTimeout=await withDeadline(firstTimeout.promise,10000,'FIRST_55P03');
    assert.equal(rec.firstSharedSqlstate,'55P03','the first shared recovery-lock wait is the original SQLSTATE');
    await unlockBlocker();
    const acceptedAt=await withDeadline(attempt.then(()=>Date.now()),CAPS.caseMs,'ACCEPTED');
    const delta=rec.delta(before);
    assert.equal(delta.lock,2,'exactly two shared-lock attempts');
    assert.equal(delta.begin,2,'exactly two read-only transactions');
    assert.equal(delta.rollback,1,'the first attempt rolled back');
    assert.equal(delta.rollbackAck,1,'the ROLLBACK was acknowledged before the retry');
    assert.equal(delta.joined,1,'one fresh joined projection/watermark snapshot');
    assert.equal(delta.commit,1,'the retry committed');
    assert.ok(observedTimeout.at-entry>=1900,'the first wait used the real 2s server lock timeout');
    assert.ok(acceptedAt<entry+5000,`accepted ${acceptedAt} before the ${entry+5000} absolute cutoff`);
    const begins=rec.statements.filter(entry=>entry.phase==='BEGIN');
    assert.ok(begins[1].at>=observedTimeout.at,'the retry began after the first timeout');
    assert.equal(rec.firstSharedSqlstate,'55P03');
    rec.evidence.push({case:1,entryAt:entry,deadlineAt:entry+5000,timeoutAt:observedTimeout.at,timeoutMono:observedTimeout.mono,acceptedAt,monoElapsed:mono()-rec.startedMono,originalSqlstate:rec.firstSharedSqlstate,lockAttempts:delta.lock,transactions:delta.begin,rollbackAcknowledged:delta.rollbackAck});
  });
});

test('case 2: artifact inspect with entry+3000ms cutoff refuses after one attempt; no second BEGIN, read, commit or publication',{timeout:CAPS.caseMs},async t=>{
  await guarded(t,async()=>{
    const before=rec.mark();await lockBlocker();
    const entry=Date.now(),deadlineMs=entry+3000;
    let refused;try{await service.inspect(VERSION,artifactContext(deadlineMs));refused=null;}catch(error){refused=error;}
    await unlockBlocker();
    const delta=rec.delta(before);
    assert.ok(refused,'the inspection is refused');
    assert.equal(refused.code,'RETENTION_READ_UNAVAILABLE');
    const call=rec.gateCalls.at(-1);
    assert.equal(call.deadlineMs,deadlineMs,'the owner passes its absolute caller deadline to the gate');
    assert.ok(call.signal instanceof AbortSignal,'the owner passes its lifetime signal to the gate');
    assert.equal(delta.lock,1,'only the first shared-lock attempt ran');
    assert.equal(delta.begin,1,'no second BEGIN: another 2s wait cannot fit the 3000ms cutoff');
    assert.equal(delta.rollbackAck,1,'the first attempt rolled back cleanly');
    assert.equal(delta.joined,0,'no joined projection read');
    assert.equal(delta.commit,0,'no COMMIT');
    assert.equal(versionReads.length,0);assert.equal(objectReads.length,0);assert.equal(publications.length,0);assert.equal(executions.length,0);
    rec.evidence.push({case:2,entryAt:entry,deadlineMs,gateDeadlineMs:call.deadlineMs,gateSignal:call.signal instanceof AbortSignal,refusedAt:Date.now(),refusalCode:refused.code,monoElapsed:mono()-rec.startedMono,lockAttempts:delta.lock,transactions:delta.begin,rollbackAcknowledged:delta.rollbackAck});
  });
});

test('case 3: explicit caller abort during the first blocked read retires the lease with no retry, second BEGIN, read or COMMIT',{timeout:CAPS.caseMs},async t=>{
  await guarded(t,async()=>{
    const before=rec.mark();await lockBlocker();
    const entry=Date.now();const controller=new AbortController();const lockStarted=deferred();let abortedAt=null;
    rec.onPhase=phase=>{if(phase==='LOCK_SHARED'&&rec.onPhase){rec.onPhase=null;lockStarted.resolve();}};
    const running=service.inspect(VERSION,artifactContext(entry+5000),{signal:controller.signal});
    await withDeadline(lockStarted.promise,5000,'LOCK_STARTED');
    const abortTimer=setTimeout(()=>{abortedAt=Date.now();controller.abort();},250);
    let refused;try{await running;refused=null;}catch(error){refused=error;}finally{clearTimeout(abortTimer);}
    await withDeadline(retired.promise,5000,'LEASE_RETIRED');
    await unlockBlocker();
    const delta=rec.delta(before);
    assert.equal(controller.signal.aborted,true,'the explicit caller signal aborted during the read');
    assert.ok(refused,'the inspection is refused');
    assert.ok(['ARTIFACT_CANCELLED','RETENTION_READ_UNAVAILABLE'].includes(refused.code),`refusal ${refused.code}`);
    assert.equal(delta.lock,1,'one shared-lock attempt');
    assert.equal(delta.begin,1,'no second BEGIN after cancellation');
    assert.equal(delta.joined,0,'no joined projection after cancellation');
    assert.equal(delta.commit,0,'no COMMIT after cancellation');
    assert.equal(delta.rollback,0,'no ROLLBACK was sent after the abort (cancellation is not a rollback claim)');
    assert.equal(rec.clientEnded,true,'release(error) retired the uncertain lease connection');
    assert.equal(rec.releases.at(-1).error!==null,true,'the lease was released with an error');
    assert.equal(versionReads.length,0);assert.equal(objectReads.length,0);assert.equal(publications.length,0);assert.equal(executions.length,0);
    rec.evidence.push({case:3,entryAt:entry,deadlineMs:entry+5000,abortedAt,retiredAt:Date.now(),refusalCode:refused.code,monoElapsed:mono()-rec.startedMono,lockAttempts:delta.lock,transactions:delta.begin,rollbackSent:delta.rollback,physicalRollbackClaim:false,leaseRetirement:rec.releases.at(-1).error});
  });
});

test('finite unit caps',{timeout:10000},async t=>{
  if(state.aborted){t.skip('unit stopped after an earlier failure');return;}
  assert.equal(rec.gateCalls.length,CAPS.gateOwnerCalls,'exactly three gate-owner calls');
  assert.ok(rec.nativeClients<=CAPS.nativeClients,`native clients ${rec.nativeClients} <= ${CAPS.nativeClients}`);
  assert.equal(rec.begin,CAPS.transactionAttempts,'exactly 4 transaction attempts (2+1+1)');
  assert.equal(rec.rollback,2,'two confirmed ROLLBACK statements');
  assert.equal(rec.rollbackAck,2,'both ROLLBACK statements acknowledged');
  assert.equal(rec.commit,1,'one committed retry');
  assert.equal(rec.count('JOINED_READ'),1,'one accepted joined projection snapshot');
  assert.ok(rec.statements.length<=CAPS.statements,`statements ${rec.statements.length} <= ${CAPS.statements}`);
  assert.ok(Date.now()-rec.startedAt<=CAPS.totalMs,'the whole unit stayed inside 180s');
  assert.ok(mono()-rec.startedMono<=CAPS.totalMs,'monotonic elapsed stayed inside 180s');
  assert.ok(rec.blockerLocks===3&&rec.blockerUnlocks===3,'the owned blocker was locked and released once per case');
});
