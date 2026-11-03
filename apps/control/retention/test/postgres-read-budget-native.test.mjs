/** VQA025 native read-budget verification fixture — SOURCE PREPARATION ONLY (R1).
 *
 * Committed for a separately allocated native execution; it must not be run by the preparation author.
 * It exercises the real chain
 *   createRetentionReadGate -> watermarkedJournal -> createPostgresWatermarkStore.readProjection
 *   -> createPostgresRetentionJournal.tx
 * and the real createArtifactService.inspect with plan-allowed synthetic object/version ports.
 *
 * Required custody inputs (refused, never defaulted):
 *   MERI_VQA025_NATIVE_TARGET = {"socketDir","database","user","nonce"} where socketDir is EXACTLY
 *   /tmp/vqa025-native-<nonce>/socket, database is meri_vqa025_native and user is postgres.
 *   MERI_VQA025_NATIVE_CUSTODY = the same nonce (matching fresh owned setup custody).
 *   MERI_VQA025_NATIVE_TOTAL_DEADLINE_MS = absolute epoch ms of ONE shared 180s lifecycle deadline
 *   anchored before setup; every connect, case and shutdown is bounded by the remaining budget.
 *   The checkout must carry the existing qualified pg dependency at ../../../runtime/node_modules/pg.
 *
 * Finite unit: exactly 3 gate-owner calls; at most 3 native clients including the blocker; exactly 4
 * transaction attempts (2+1+1); at most 80 SQL statements; 60s per case; 180s whole lifecycle. Guards
 * run BEFORE each dispatch. One synthetic tenant/conversation/retention subject/singleton watermark.
 * No TRUNCATE/reset, no deletion, no customer rows, no object/provider/Core/HTTP calls. Evidence is
 * emitted as bounded metadata-only JSON lines to stderr on success and failure; the runner tees it.
 */
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import pg from '../../../runtime/node_modules/pg/lib/index.js';
import {createPostgresRetentionJournal} from '../postgres-journal.mjs';
import {createPostgresWatermarkStore} from '../postgres-watermark.mjs';
import {watermarkedJournal} from '../recovery-watermark.mjs';
import {createRetentionReadGate} from '../suppression.mjs';
import {createServingFence} from '../serving-fence.mjs';
import {hash} from '../boundary.mjs';
import {createArtifactService} from '../../../artifacts/service.mjs';
import {v as artifactValidators} from '../../../artifacts/storage/boundary.mjs';

const CAPS=Object.freeze({gateOwnerCalls:3,nativeClients:3,transactionAttempts:4,statements:80,caseMs:60000,connectMs:10000,endMs:5000,totalMs:180000});
const TRACE_LIMIT=240;

// ---- Exact canonical custody target. No defaults, substrings, TCP, alternate or shared namespaces. ----
const rawTarget=process.env.MERI_VQA025_NATIVE_TARGET;
if(typeof rawTarget!=='string'||!rawTarget)throw new Error('VQA025_NATIVE_TARGET_REQUIRED');
let parsedTarget;try{parsedTarget=JSON.parse(rawTarget);}catch{throw new Error('VQA025_NATIVE_TARGET_INVALID');}
if(!parsedTarget||typeof parsedTarget!=='object'||Array.isArray(parsedTarget)||Object.keys(parsedTarget).sort().join(',')!=='database,nonce,socketDir,user')throw new Error('VQA025_NATIVE_TARGET_SHAPE');
const TARGET=Object.freeze({socketDir:parsedTarget.socketDir,database:parsedTarget.database,user:parsedTarget.user,nonce:parsedTarget.nonce});
for(const value of Object.values(TARGET))if(typeof value!=='string'||!value||value.length>256)throw new Error('VQA025_NATIVE_TARGET_INVALID');
if(!/^[a-f0-9]{16,64}$/u.test(TARGET.nonce))throw new Error('VQA025_NATIVE_TARGET_INVALID');
const CANONICAL_ROOT=`/tmp/vqa025-native-${TARGET.nonce}`;
const CANONICAL_SOCKET=`${CANONICAL_ROOT}/socket`;
if(TARGET.socketDir!==CANONICAL_SOCKET)throw new Error('VQA025_NATIVE_TARGET_NOT_CANONICAL');
if(TARGET.database!=='meri_vqa025_native')throw new Error('VQA025_NATIVE_TARGET_DATABASE');
if(TARGET.user!=='postgres')throw new Error('VQA025_NATIVE_TARGET_USER');
if(process.env.MERI_VQA025_NATIVE_CUSTODY!==TARGET.nonce)throw new Error('VQA025_NATIVE_CUSTODY_REQUIRED');
const rawDeadline=process.env.MERI_VQA025_NATIVE_TOTAL_DEADLINE_MS;
if(typeof rawDeadline!=='string'||!/^[0-9]{13,16}$/u.test(rawDeadline))throw new Error('VQA025_NATIVE_TOTAL_DEADLINE_REQUIRED');
const TOTAL_DEADLINE_MS=Number(rawDeadline);
if(!Number.isSafeInteger(TOTAL_DEADLINE_MS)||TOTAL_DEADLINE_MS-Date.now()<=0)throw new Error('VQA025_NATIVE_TOTAL_DEADLINE_INVALID');
if(TOTAL_DEADLINE_MS-Date.now()>CAPS.totalMs+5000)throw new Error('VQA025_NATIVE_TOTAL_DEADLINE_INVALID');

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
const remaining=()=>TOTAL_DEADLINE_MS-Date.now();
const budget=cap=>Math.max(0,Math.min(cap,remaining()));
const mustBudget=label=>{const ms=remaining();if(!Number.isSafeInteger(ms)||ms<=0)throw Object.assign(new Error(`VQA025_NATIVE_${label}_DEADLINE`),{code:`VQA025_NATIVE_${label}_DEADLINE`});return ms;};
const withDeadline=(promise,ms,label)=>{if(!Number.isSafeInteger(ms)||ms<=0)return Promise.reject(Object.assign(new Error(`VQA025_NATIVE_${label}_TIMEOUT`),{code:`VQA025_NATIVE_${label}_TIMEOUT`}));let timer;const guard=new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(new Error(`VQA025_NATIVE_${label}_TIMEOUT`),{code:`VQA025_NATIVE_${label}_TIMEOUT`})),ms);});return Promise.race([promise,guard]).finally(()=>clearTimeout(timer));};
const capError=label=>Object.assign(new Error(`VQA025_NATIVE_${label}_CAP`),{code:`VQA025_NATIVE_${label}_CAP`});

const state={aborted:false,caseId:null};
const released=deferred();
let traceTruncated=false;
const rec={
  startedAt:Date.now(),startedMono:mono(),evidence:[],statements:[],errors:[],releases:[],gateCalls:[],trace:[],
  begin:0,commit:0,rollback:0,rollbackAck:0,firstRollbackAckAt:null,nativeClients:0,leaseReleaseRequested:false,
  endRequestedAt:null,endSettled:false,blockerLocks:0,blockerUnlocks:0,firstSharedSqlstate:null,onLockTimeout:null,onPhase:null,
  push(entry){if(this.trace.length<TRACE_LIMIT)this.trace.push(entry);else traceTruncated=true;},
  note(sql){const phase=classify(sql);const at=Date.now(),m=mono();this.statements.push({phase,at,mono:m});this.push({e:'start',phase,at,mono:m});
    if(phase==='BEGIN')this.begin++;if(phase==='COMMIT')this.commit++;if(phase==='ROLLBACK')this.rollback++;this.onPhase?.(phase);},
  ok(sql){const phase=classify(sql),at=Date.now(),m=mono();this.push({e:'result',phase,at,mono:m});
    if(phase==='ROLLBACK'){this.rollbackAck++;if(this.firstRollbackAckAt===null)this.firstRollbackAckAt=at;}},
  error(sql,error){const phase=classify(sql),at=Date.now(),m=mono();this.errors.push({phase,code:error?.code??null,at,mono:m});this.push({e:'error',phase,code:error?.code??null,at,mono:m});
    if(phase==='LOCK_SHARED'&&this.firstSharedSqlstate===null)this.firstSharedSqlstate=error?.code??null;
    if(phase==='LOCK_SHARED'&&error?.code==='55P03'&&this.onLockTimeout){const fire=this.onLockTimeout;this.onLockTimeout=null;fire({at,mono:m});}},
  release(error){this.releases.push({error:error?String(error.code??'error').slice(0,64):null,at:Date.now(),mono:mono()});
    if(error&&!this.leaseReleaseRequested){this.leaseReleaseRequested=true;this.endRequestedAt=Date.now();released.resolve();}},
  count(phase){return this.statements.filter(entry=>entry.phase===phase).length;},
  mark(){return {begin:this.begin,commit:this.commit,rollback:this.rollback,rollbackAck:this.rollbackAck,joined:this.count('JOINED_READ'),lock:this.count('LOCK_SHARED'),statements:this.statements.length,errors:this.errors.length,releases:this.releases.length};},
  delta(before){return {begin:this.begin-before.begin,commit:this.commit-before.commit,rollback:this.rollback-before.rollback,rollbackAck:this.rollbackAck-before.rollbackAck,joined:this.count('JOINED_READ')-before.joined,lock:this.count('LOCK_SHARED')-before.lock,statements:this.statements.length-before.statements,errors:this.errors.length-before.errors,releases:this.releases.length-before.releases};},
};

const emit=(label,extra={})=>{
  const payload={vqa025NativeEvidence:true,label,at:Date.now(),remainingMs:remaining(),
    counts:{statements:rec.statements.length,begin:rec.begin,commit:rec.commit,rollback:rec.rollback,rollbackAck:rec.rollbackAck,gateCalls:rec.gateCalls.length,nativeClients:rec.nativeClients,releases:rec.releases.length},
    traceTruncated,trace:rec.trace.slice(-120),evidence:rec.evidence,gateCalls:rec.gateCalls.map(call=>({deadlineMs:call.deadlineMs,signal:call.signal instanceof AbortSignal,at:call.at})),releases:rec.releases,errors:rec.errors.slice(-20),...extra};
  console.error(JSON.stringify(payload));
};

const guarded=async(t,caseId,body)=>{
  state.caseId=caseId;
  if(state.aborted){t.skip('unit stopped after an earlier failure, timeout or ambiguity');return;}
  try{await body();emit('case',{case:caseId,ok:true});}
  catch(error){state.aborted=true;emit('case',{case:caseId,ok:false,code:error?.code??null});throw error;}
};

/** Pass-through observer: the real driver executes every statement; guards run before each dispatch. */
const observed=(client)=>{let endRequested=false;return {
  async query(sql,values){
    const phase=classify(sql);
    if(rec.statements.length>=CAPS.statements)throw capError('SQL');
    if(phase==='BEGIN'&&rec.begin>=CAPS.transactionAttempts)throw capError('BEGIN');
    rec.note(sql);
    try{const result=await client.query(sql,values);rec.ok(sql);return result;}catch(error){rec.error(sql,error);throw error;}
  },
  release(error){rec.release(error??null);if(error&&!endRequested){endRequested=true;void client.end().then(()=>{rec.endSettled=true;},()=>{});}},
  get ended(){return endRequested;},
};};

let readClient,blocker,readLease,blockerLease,journal,tracked,gate,gatePort,service;
const versionReads=[],objectReads=[],publications=[],executions=[];

// Shared-lifecycle watchdog: starts at module evaluation, bounded hard stop within the same 180s.
let watchdog;
const startWatchdog=()=>{watchdog=setTimeout(()=>{state.aborted=true;rec.evidence.push({event:'TOTAL_DEADLINE',at:Date.now(),remainingMs:remaining()});emit('total-deadline');setTimeout(()=>process.exit(1),250);},Math.max(0,remaining()));};
startWatchdog();

before(async()=>{
  mustBudget('SETUP');
  if(rec.nativeClients>=CAPS.nativeClients)throw capError('CLIENT');
  if(typeof process.getuid!=='function'||typeof process.getgid!=='function')throw new Error('VQA025_NATIVE_POSIX_REQUIRED');
  for(const path of [CANONICAL_ROOT,CANONICAL_SOCKET]){
    const info=fs.statSync(path);
    if(!info.isDirectory()||info.uid!==process.getuid()||(info.mode&0o777)!==0o700)throw Object.assign(new Error('VQA025_NATIVE_CUSTODY_FS'),{code:'VQA025_NATIVE_CUSTODY_FS'});
  }
  if(fs.realpathSync(CANONICAL_SOCKET)!==CANONICAL_SOCKET)throw new Error('VQA025_NATIVE_CUSTODY_FS');
  const firstConnectMs=Math.min(CAPS.connectMs,mustBudget('CONNECT'));
  readClient=new pg.Client({host:TARGET.socketDir,database:TARGET.database,user:TARGET.user,application_name:'vqa025-native-read',connectionTimeoutMillis:firstConnectMs,options:'-c statement_timeout=5000'});
  rec.nativeClients++;
  await withDeadline(readClient.connect(),firstConnectMs,'CONNECT');
  if(rec.nativeClients>=CAPS.nativeClients)throw capError('CLIENT');
  const secondConnectMs=Math.min(CAPS.connectMs,mustBudget('CONNECT'));
  blocker=new pg.Client({host:TARGET.socketDir,database:TARGET.database,user:TARGET.user,application_name:'vqa025-native-blocker',connectionTimeoutMillis:secondConnectMs,options:'-c statement_timeout=5000'});
  rec.nativeClients++;
  await withDeadline(blocker.connect(),secondConnectMs,'CONNECT');
  readLease=observed(readClient);blockerLease=observed(blocker);
  const server=(await q(readLease,"SELECT current_setting('listen_addresses') AS listen,current_database() AS db,current_setting('server_version') AS version,current_user AS usr")).rows[0];
  if(server.listen!=='')throw new Error('VQA025_NATIVE_NOT_SOCKET_ONLY');
  if(server.db!==TARGET.database||server.usr!==TARGET.user)throw new Error('VQA025_NATIVE_TARGET_MISMATCH');
  if(!/^16\./u.test(server.version))throw new Error('VQA025_NATIVE_PG16_REQUIRED');
  const schema=(await q(readLease,"SELECT to_regclass('meri_conversations.conversations') IS NOT NULL AS c,to_regclass('meri_conversations.retention_subjects') IS NOT NULL AS s,to_regclass('meri_conversations.retention_recovery_watermark') IS NOT NULL AS w")).rows[0];
  if(!schema.c||!schema.s||!schema.w)throw new Error('VQA025_NATIVE_SCHEMA_MISSING');
  const conversationProjection={conversationId:CONVERSATION,owner:{tenantId:TENANT,actorId:ACTOR},scopes:[],createdAt:new Date(1700000000000).toISOString(),policyRevision:'vqa025-native'};
  await q(readLease,'INSERT INTO meri_conversations.conversations(tenant_id,conversation_id,owner_actor_id,projection,projection_sha256) VALUES($1,$2,$3,$4,$5) ON CONFLICT (tenant_id,conversation_id) DO NOTHING',[TENANT,CONVERSATION,ACTOR,conversationProjection,hash(conversationProjection)]);
  const subjectProjection={state:'RELEASED',ledgerSequence:WATERMARK.sequence,entrySha256:ENTRY_SHA,ownerActorId:ACTOR,releasedAtMs:1700000000000};
  await q(readLease,'INSERT INTO meri_conversations.retention_subjects(tenant_id,conversation_id,owner_actor_id,state,suppressed_at,released_at,ledger_sequence,entry_sha256,projection,projection_sha256) VALUES($1,$2,$3,$4,NULL,NULL,$5,$6,$7,$8) ON CONFLICT (tenant_id,conversation_id) DO NOTHING',[TENANT,CONVERSATION,ACTOR,'RELEASED',WATERMARK.sequence,ENTRY_SHA,subjectProjection,hash(subjectProjection)]);
  await q(readLease,'INSERT INTO meri_conversations.retention_recovery_watermark(singleton,sequence,entry_sha256) VALUES(true,$1,$2) ON CONFLICT (singleton) DO NOTHING',[WATERMARK.sequence,WATERMARK.entrySha256]);
  const pool={async connect(){return observed(readClient);}};
  journal=createPostgresRetentionJournal({pool,now:()=>Date.now(),maxRequestMs:10000});
  const watermark=createPostgresWatermarkStore({journal});
  const fence=createServingFence();fence.enable({watermark:WATERMARK});
  tracked=watermarkedJournal({journal,watermark,fence,ledger:{async head(){return {...WATERMARK};}}});
  gate=createRetentionReadGate({journal:tracked,serving:fence,log(){}});
  gatePort={assertServable(subject,options){
    if(rec.gateCalls.length>=CAPS.gateOwnerCalls)throw capError('GATE');
    rec.gateCalls.push({deadlineMs:options?.deadlineMs??null,signal:options?.signal??null,at:Date.now()});
    return gate.assertServable(subject,options);
  }};
  service=createArtifactService({validators:artifactValidators,
    authorize:async request=>({receiptId:'vqa025-native-receipt',decision:'allow',action:request.action,binding:structuredClone(request.binding),scopesSha256:artifactValidators.hash(request.scopes),resourceSha256:artifactValidators.hash(request.resource),requestSha256:request.requestSha256,expiresAtMs:request.deadlineMs}),
    versions:{read:async()=>{versionReads.push(1);throw Object.assign(Error('UNEXPECTED_VERSION_READ'),{code:'UNEXPECTED_VERSION_READ'});},commit:async()=>{publications.push(1);throw Object.assign(Error('UNEXPECTED_VERSION_COMMIT'),{code:'UNEXPECTED_VERSION_COMMIT'});}},
    objects:{get:async()=>{objectReads.push(1);throw Object.assign(Error('UNEXPECTED_OBJECT_READ'),{code:'UNEXPECTED_OBJECT_READ'});},put:async()=>{publications.push(1);throw Object.assign(Error('UNEXPECTED_OBJECT_WRITE'),{code:'UNEXPECTED_OBJECT_WRITE'});}},
    executor:{execute:async()=>{executions.push(1);throw Object.assign(Error('UNEXPECTED_EXECUTION'),{code:'UNEXPECTED_EXECUTION'});}},
    now:()=>Date.now(),ids:()=>({}),retention:gatePort});
});

after(async()=>{
  clearTimeout(watchdog);
  const endRequestedAt=Date.now();
  let settled=false;
  try{await withDeadline(Promise.allSettled([readClient?.end(),blocker?.end()]),Math.max(1,Math.min(CAPS.endMs,Math.max(0,remaining()))),'END');settled=true;}catch{}
  rec.endSettled=settled;
  emit('final',{endRequestedAt,endSettled:settled,serverAcknowledged:false,elapsedMono:mono()-rec.startedMono});
  assert.ok(Date.now()<=TOTAL_DEADLINE_MS,'the whole lifecycle including owned connection shutdown stayed inside the shared 180s deadline');
});

const lockBlocker=async()=>{const result=await withDeadline(blockerLease.query("SELECT pg_advisory_lock(hashtextextended('meri_retention_recovery',0)) AS locked"),Math.max(1,Math.min(5000,remaining())),'BLOCKER_LOCK');rec.blockerLocks++;return result;};
const unlockBlocker=async()=>{const result=await withDeadline(blockerLease.query("SELECT pg_advisory_unlock(hashtextextended('meri_retention_recovery',0)) AS unlocked"),Math.max(1,Math.min(5000,remaining())),'BLOCKER_UNLOCK');rec.blockerUnlocks++;assert.equal(result.rows[0].unlocked,true,'the owned blocker was released');};
const artifactContext=deadlineMs=>({binding:{tenantId:TENANT,actorId:ACTOR,conversationId:CONVERSATION,runId:RUN,attemptId:ATTEMPT,workerId:WORKER,writerFence:1},scopes:[{tenantId:TENANT,kind:'client',resourceId:CLIENT,policyRevision:'vqa025-native'}],evidence:[],assets:[],deadlineMs,maxBytes:1048576});
const q=(lease,sql,values)=>withDeadline(lease.query(sql,values),Math.max(1,Math.min(5000,remaining())),'QUERY');

const caseTimeout=()=>Math.max(1,Math.min(CAPS.caseMs,remaining()));

test('case 1: one genuine shared-wait 55P03, confirmed ROLLBACK, one fresh retry accepted before the 5s cutoff',{timeout:caseTimeout()},async t=>{
  await guarded(t,1,async()=>{
    const before=rec.mark();await lockBlocker();
    const entry=Date.now();const firstTimeout=deferred();rec.onLockTimeout=firstTimeout.resolve;
    const attempt=gatePort.assertServable(SUBJECT);
    const observedTimeout=await withDeadline(firstTimeout.promise,Math.max(1,Math.min(10000,remaining())),'FIRST_55P03');
    assert.equal(rec.firstSharedSqlstate,'55P03','the first shared recovery-lock wait is the original SQLSTATE');
    await unlockBlocker();
    const acceptedAt=await withDeadline(attempt.then(()=>Date.now()),Math.max(1,budget(CAPS.caseMs)),'ACCEPTED');
    const delta=rec.delta(before);
    assert.equal(delta.lock,2,'exactly two shared-lock attempts');
    assert.equal(delta.begin,2,'exactly two read-only transactions');
    assert.equal(delta.rollback,1,'the first attempt rolled back');
    assert.equal(delta.rollbackAck,1,'the ROLLBACK was acknowledged before the retry');
    assert.equal(delta.joined,1,'one fresh joined projection/watermark snapshot');
    assert.equal(delta.commit,1,'the retry committed');
    assert.ok(observedTimeout.at-entry>=1900,'the first wait used the real 2s server lock timeout');
    assert.ok(acceptedAt<entry+5000,`accepted ${acceptedAt} before the ${entry+5000} absolute cutoff`);
    assert.ok(acceptedAt<TOTAL_DEADLINE_MS,'accepted inside the shared lifecycle deadline');
    const begins=rec.statements.filter(entry=>entry.phase==='BEGIN');
    assert.ok(begins[1].at>=observedTimeout.at,'the retry began after the first timeout');
    assert.ok(rec.firstRollbackAckAt!==null&&rec.firstRollbackAckAt<=begins[1].at,'the first ROLLBACK acknowledgement preceded the second BEGIN');
    assert.equal(rec.firstSharedSqlstate,'55P03');
    rec.evidence.push({case:1,entryAt:entry,deadlineAt:entry+5000,timeoutAt:observedTimeout.at,timeoutMono:observedTimeout.mono,rollbackAckAt:rec.firstRollbackAckAt,acceptedAt,monoElapsed:mono()-rec.startedMono,originalSqlstate:rec.firstSharedSqlstate,lockAttempts:delta.lock,transactions:delta.begin,rollbackAcknowledged:delta.rollbackAck});
  });
});

test('case 2: artifact inspect with entry+3000ms cutoff refuses after one attempt; no second BEGIN, read, commit or publication',{timeout:caseTimeout()},async t=>{
  await guarded(t,2,async()=>{
    const before=rec.mark();await lockBlocker();
    const entry=Date.now(),deadlineMs=entry+3000;
    if(deadlineMs>TOTAL_DEADLINE_MS)throw new Error('VQA025_NATIVE_CASE_BUDGET');
    let refused;try{await service.inspect(VERSION,artifactContext(deadlineMs));refused=null;}catch(error){refused=error;}
    await unlockBlocker();
    const delta=rec.delta(before);
    assert.ok(refused,'the inspection is refused');
    assert.equal(refused.code,'RETENTION_READ_UNAVAILABLE');
    const call=rec.gateCalls.at(-1);
    assert.equal(call.deadlineMs,deadlineMs,'the owner passes its absolute caller deadline to the gate');
    assert.ok(call.deadlineMs<=TOTAL_DEADLINE_MS,'the caller deadline stays inside the shared lifecycle deadline');
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

test('case 3: explicit caller abort during the first blocked read retires the lease with no retry, second BEGIN, read or COMMIT',{timeout:caseTimeout()},async t=>{
  await guarded(t,3,async()=>{
    const before=rec.mark();await lockBlocker();
    const entry=Date.now(),callerDeadline=Math.min(entry+5000,TOTAL_DEADLINE_MS);
    if(callerDeadline-entry<1000)throw new Error('VQA025_NATIVE_CASE_BUDGET');
    const controller=new AbortController();const lockStarted=deferred();let abortedAt=null;
    rec.onPhase=phase=>{if(phase==='LOCK_SHARED'&&rec.onPhase){rec.onPhase=null;lockStarted.resolve();}};
    const running=service.inspect(VERSION,artifactContext(callerDeadline),{signal:controller.signal});
    await withDeadline(lockStarted.promise,Math.max(1,Math.min(5000,remaining())),'LOCK_STARTED');
    const abortTimer=setTimeout(()=>{abortedAt=Date.now();controller.abort();},250);
    let refused;try{await running;refused=null;}catch(error){refused=error;}finally{clearTimeout(abortTimer);}
    await withDeadline(released.promise,Math.max(1,Math.min(5000,remaining())),'LEASE_RETIRED');
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
    assert.equal(rec.leaseReleaseRequested,true,'release(error) requested retirement of the uncertain lease');
    assert.equal(rec.releases.at(-1).error!==null,true,'the lease was released with an error');
    assert.equal(versionReads.length,0);assert.equal(objectReads.length,0);assert.equal(publications.length,0);assert.equal(executions.length,0);
    rec.evidence.push({case:3,entryAt:entry,deadlineMs:callerDeadline,abortedAt,retiredAt:Date.now(),refusalCode:refused.code,monoElapsed:mono()-rec.startedMono,lockAttempts:delta.lock,transactions:delta.begin,rollbackSent:delta.rollback,physicalRollbackClaim:false,leaseRetirement:rec.releases.at(-1).error,endRequested:true,endSettled:false,serverAcknowledged:false});
  });
});

test('finite unit caps and pre-dispatch guards',{timeout:Math.max(1,Math.min(10000,remaining()))},async t=>{
  if(state.aborted){t.skip('unit stopped after an earlier failure, timeout or ambiguity');return;}
  assert.equal(rec.gateCalls.length,CAPS.gateOwnerCalls,'exactly three gate-owner calls');
  assert.ok(rec.nativeClients<=CAPS.nativeClients,`native clients ${rec.nativeClients} <= ${CAPS.nativeClients}`);
  assert.equal(rec.begin,CAPS.transactionAttempts,'exactly 4 transaction attempts (2+1+1)');
  assert.equal(rec.rollback,2,'two confirmed ROLLBACK statements');
  assert.equal(rec.rollbackAck,2,'both ROLLBACK statements acknowledged');
  assert.equal(rec.commit,1,'one committed retry');
  assert.equal(rec.count('JOINED_READ'),1,'one accepted joined projection snapshot');
  assert.ok(rec.statements.length<=CAPS.statements,`statements ${rec.statements.length} <= ${CAPS.statements}`);
  assert.ok(Date.now()<=TOTAL_DEADLINE_MS,'the cases stayed inside the shared 180s deadline');
  assert.ok(mono()-rec.startedMono<=CAPS.totalMs,'monotonic elapsed stayed inside 180s');
  assert.ok(rec.blockerLocks===3&&rec.blockerUnlocks===3,'the owned blocker was locked and released once per case');
  assert.ok(rec.trace.length<=TRACE_LIMIT,'the metadata trace stayed bounded');
  assert.equal(rec.evidence.length,3,'three per-case evidence records were retained');
});
