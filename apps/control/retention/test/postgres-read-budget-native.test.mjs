/** VQA025 native read-budget verification fixture — SOURCE PREPARATION ONLY (R2).
 *
 * Committed for a separately allocated native execution; it must not be run by the preparation author.
 * It exercises the real chain
 *   createRetentionReadGate -> watermarkedJournal -> createPostgresWatermarkStore.readProjection
 *   -> createPostgresRetentionJournal.tx
 * and the real createArtifactService.inspect with plan-allowed synthetic object/version ports.
 *
 * Custody inputs (refused, never defaulted):
 *   MERI_VQA025_NATIVE_TARGET = {"socketDir","database","user","nonce"} where socketDir is EXACTLY
 *   /tmp/vqa025-native-<nonce>/socket, database is meri_vqa025_native and user is postgres.
 *   MERI_VQA025_NATIVE_CUSTODY = the same nonce.
 *   MERI_VQA025_NATIVE_MONO_DEADLINE_S = absolute /proc/uptime seconds of ONE sealed 180s lifecycle
 *   deadline anchored before setup. Wall UTC is evidence only. A 5000ms escalation reserve is INSIDE
 *   the 180s ceiling: all work stops at deadline-5s; the remaining 5s covers shutdown/forced exit.
 *
 * Finite unit: 3 cases together <=60s; setup<=120s; total<=180s; 3 gate calls; <=3 native clients;
 * exactly 4 transactions; <=80 SQL. Guards run BEFORE dispatch via thunks and refuse aborted/expired
 * budgets. Evidence is complete bounded (<=240) metadata-only JSON on stderr; 121..240 is never
 * shortened. No deletion, TRUNCATE, reset, customer rows, object/provider/Core/HTTP calls.
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

const CAPS=Object.freeze({gateOwnerCalls:3,nativeClients:3,transactionAttempts:4,statements:80,casePhaseMs:60000,setupMs:120000,totalMs:180000,connectMs:10000,endMs:5000,reserveMs:5000});
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
const EVIDENCE_PATH=`${CANONICAL_ROOT}/evidence.jsonl`;
if(process.env.MERI_VQA025_NATIVE_EVIDENCE_FILE!==EVIDENCE_PATH)throw new Error('VQA025_NATIVE_EVIDENCE_PATH');

// ---- ONE sealed monotonic lifecycle authority; wall UTC is evidence only. --------------------------
const monoNowS=()=>{const raw=fs.readFileSync('/proc/uptime','utf8').split(/\s+/u)[0];const value=Number(raw);if(!Number.isFinite(value)||value<0)throw new Error('VQA025_NATIVE_MONO_CLOCK');return value;};
const startedMonoS=monoNowS();
const rawMonoDeadline=process.env.MERI_VQA025_NATIVE_MONO_DEADLINE_S;
if(typeof rawMonoDeadline!=='string'||!/^[0-9]+(\.[0-9]{1,6})?$/u.test(rawMonoDeadline))throw new Error('VQA025_NATIVE_MONO_DEADLINE_REQUIRED');
const MONO_DEADLINE_S=Number(rawMonoDeadline);
const initialRemainingMs=(MONO_DEADLINE_S-startedMonoS)*1000;
if(!Number.isFinite(initialRemainingMs)||initialRemainingMs<=0||initialRemainingMs>CAPS.totalMs)throw new Error('VQA025_NATIVE_MONO_DEADLINE_INVALID');
const WORK_DEADLINE_S=MONO_DEADLINE_S-CAPS.reserveMs/1000;
const workRemainingMs=()=>(WORK_DEADLINE_S-monoNowS())*1000;
let casePhaseDeadlineS=null;
const caseRemainingMs=()=>casePhaseDeadlineS===null?Infinity:(casePhaseDeadlineS-monoNowS())*1000;
const wallStartedAt=Date.now();
const wallDeadlineEvidence=process.env.MERI_VQA025_NATIVE_WALL_UTC_DEADLINE_MS??null;
const workBudget=capMs=>{const ms=Math.min(capMs,workRemainingMs());return Number.isFinite(ms)&&ms>0?Math.floor(ms):0;};
const caseBudget=capMs=>{const ms=Math.min(capMs,workRemainingMs(),caseRemainingMs());return Number.isFinite(ms)&&ms>0?Math.floor(ms):0;};

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
const released=deferred();
const codeError=(label,kind)=>Object.assign(new Error(`VQA025_NATIVE_${label}_${kind}`),{code:`VQA025_NATIVE_${label}_${kind}`});
const capError=label=>codeError(label,'CAP');
const state={aborted:false,failed:false,reason:null,caseId:null,completed:[],skipped:[]};
let caseAbort=null;
const abortOwned=reason=>{state.aborted=true;state.failed=true;state.reason??=reason;try{caseAbort?.abort();}catch{}};
const assertDispatchable=(label,inCase=false)=>{
  if(state.aborted)throw codeError(label,'ABORTED');
  if(workRemainingMs()<=0)throw codeError(label,'BUDGET');
  if(inCase&&casePhaseDeadlineS!==null&&caseRemainingMs()<=0)throw codeError(label,'CASE_BUDGET');
};
const runBounded=(thunk,ms,label,inCase=false)=>{
  if(!Number.isSafeInteger(ms)||ms<=0)return Promise.reject(codeError(label,'BUDGET'));
  let timer;
  const work=Promise.resolve().then(()=>{assertDispatchable(label,inCase);return thunk();});
  const guard=new Promise((_,reject)=>{timer=setTimeout(()=>{abortOwned(`${label}_TIMEOUT`);reject(codeError(label,'TIMEOUT'));},ms);});
  return Promise.race([work,guard]).finally(()=>clearTimeout(timer));
};

let traceOmitted=0;
const rec={
  startedAt:Date.now(),startedMonoS,evidence:[],statements:[],errors:[],releases:[],gateCalls:[],trace:[],
  begin:0,commit:0,rollback:0,rollbackAck:0,firstRollbackAckAt:null,firstRollbackAckMono:null,nativeClients:0,leaseReleaseRequested:false,
  endRequestedAt:null,endSettled:false,shutdownFailed:false,shutdownError:null,blockerLocks:0,blockerUnlocks:0,firstSharedSqlstate:null,onLockTimeout:null,onPhase:null,
  push(entry){if(this.trace.length<TRACE_LIMIT)this.trace.push(entry);else traceOmitted++;},
  note(sql){const phase=classify(sql);const at=Date.now(),m=monoNowS();this.statements.push({phase,at,mono:m});this.push({e:'start',phase,at,mono:m});
    if(phase==='BEGIN')this.begin++;if(phase==='COMMIT')this.commit++;if(phase==='ROLLBACK')this.rollback++;this.onPhase?.(phase);},
  ok(sql){const phase=classify(sql);const at=Date.now(),m=monoNowS();this.push({e:'result',phase,at,mono:m});
    if(phase==='ROLLBACK'){this.rollbackAck++;if(this.firstRollbackAckAt===null){this.firstRollbackAckAt=at;this.firstRollbackAckMono=m;}}},
  error(sql,error){const phase=classify(sql);const at=Date.now(),m=monoNowS();this.errors.push({phase,code:error?.code??null,at,mono:m});this.push({e:'error',phase,code:error?.code??null,at,mono:m});
    if(phase==='LOCK_SHARED'&&this.firstSharedSqlstate===null)this.firstSharedSqlstate=error?.code??null;
    if(phase==='LOCK_SHARED'&&error?.code==='55P03'&&this.onLockTimeout){const fire=this.onLockTimeout;this.onLockTimeout=null;fire({at,mono:m});}},
  release(error){this.releases.push({error:error?String(error.code??'error').slice(0,64):null,at:Date.now(),mono:monoNowS()});
    if(error&&!this.leaseReleaseRequested){this.leaseReleaseRequested=true;this.endRequestedAt=Date.now();released.resolve();}},
  count(phase){return this.statements.filter(entry=>entry.phase===phase).length;},
  mark(){return {begin:this.begin,commit:this.commit,rollback:this.rollback,rollbackAck:this.rollbackAck,joined:this.count('JOINED_READ'),lock:this.count('LOCK_SHARED'),statements:this.statements.length,errors:this.errors.length,releases:this.releases.length};},
  delta(before){return {begin:this.begin-before.begin,commit:this.commit-before.commit,rollback:this.rollback-before.rollback,rollbackAck:this.rollbackAck-before.rollbackAck,joined:this.count('JOINED_READ')-before.joined,lock:this.count('LOCK_SHARED')-before.lock,statements:this.statements.length-before.statements,errors:this.errors.length-before.errors,releases:this.releases.length-before.releases};},
};

const emit=(label,extra={})=>{
  const payload={vqa025NativeEvidence:true,label,at:Date.now(),monoAt:monoNowS(),wallStartedAt,wallDeadlineEvidence,monoDeadlineS:MONO_DEADLINE_S,workDeadlineS:WORK_DEADLINE_S,remainingWorkMs:Math.floor(workRemainingMs()),
    counts:{statements:rec.statements.length,begin:rec.begin,commit:rec.commit,rollback:rec.rollback,rollbackAck:rec.rollbackAck,gateCalls:rec.gateCalls.length,nativeClients:rec.nativeClients,releases:rec.releases.length},
    traceOmitted,traceTruncated:traceOmitted>0,trace:rec.trace,evidence:rec.evidence,gateCalls:rec.gateCalls.map(call=>({deadlineMs:call.deadlineMs,signal:call.signal instanceof AbortSignal,at:call.at})),releases:rec.releases,errors:rec.errors.slice(-20),...extra};
  const line=`${JSON.stringify(payload)}\n`;
  try{fs.appendFileSync(EVIDENCE_PATH,line,{encoding:'utf8',mode:0o600});}catch{}
  try{fs.writeSync(2,line);}catch{}
};

const guarded=async(t,caseId,body)=>{
  if(state.aborted){state.skipped.push(caseId);return;}
  state.caseId=caseId;caseAbort=new AbortController();
  const onAbort=()=>abortOwned(`TEST_ABORT_${caseId}`);
  t.signal?.addEventListener('abort',onAbort,{once:true});
  try{assertDispatchable(`CASE_${caseId}`,true);await body(caseAbort.signal);state.completed.push(caseId);emit('case',{case:caseId,ok:true});}
  catch(error){abortOwned(error?.code??String(error?.message??error));emit('case',{case:caseId,ok:false,code:error?.code??null});throw error;}
  finally{t.signal?.removeEventListener('abort',onAbort);caseAbort=null;}
};

/** Pass-through observer: the real driver executes each statement; guards/thunks precede dispatch. */
const observed=(client)=>{let endRequested=false;return {
  async query(sql,values){
    const phase=classify(sql);
    const ms=(caseAbort!==null?caseBudget:workBudget)(5000);
    return runBounded(async()=>{
      assertDispatchable('QUERY',caseAbort!==null);
      if(rec.statements.length>=CAPS.statements)throw capError('SQL');
      if(phase==='BEGIN'&&rec.begin>=CAPS.transactionAttempts)throw capError('BEGIN');
      rec.note(sql);
      try{const result=await client.query(sql,values);rec.ok(sql);return result;}catch(error){rec.error(sql,error);throw error;}
    },ms,'SQL',caseAbort!==null);
  },
  release(error){rec.release(error??null);if(error&&!endRequested){endRequested=true;void client.end().then(()=>{rec.endSettled=true;},()=>{});}},
  get ended(){return endRequested;},
};};

let readClient,blocker,readLease,blockerLease,journal,tracked,gate,gatePort,service;
const versionReads=[],objectReads=[],publications=[],executions=[];
let watchdog;

const armWatchdog=()=>{watchdog=setTimeout(()=>{abortOwned('WORK_DEADLINE');emit('total-deadline');process.exit(1);},Math.max(0,workRemainingMs()));};
armWatchdog();
emit('start');

before(async()=>{
  assertDispatchable('SETUP');
  if(rec.nativeClients>=CAPS.nativeClients)throw capError('CLIENT');
  if(typeof process.getuid!=='function'||typeof process.getgid!=='function')throw new Error('VQA025_NATIVE_POSIX_REQUIRED');
  for(const path of [CANONICAL_ROOT,CANONICAL_SOCKET]){
    const info=fs.statSync(path);
    if(!info.isDirectory()||info.uid!==process.getuid()||(info.mode&0o777)!==0o700)throw codeError('CUSTODY','FS');
  }
  if(fs.realpathSync(CANONICAL_SOCKET)!==CANONICAL_SOCKET)throw codeError('CUSTODY','FS');
  const firstConnectMs=workBudget(CAPS.connectMs);
  if(firstConnectMs<=0)throw codeError('CONNECT','BUDGET');
  readClient=new pg.Client({host:TARGET.socketDir,database:TARGET.database,user:TARGET.user,application_name:'vqa025-native-read',connectionTimeoutMillis:firstConnectMs,options:'-c statement_timeout=5000'});
  rec.nativeClients++;
  await runBounded(()=>readClient.connect(),firstConnectMs,'CONNECT',false);
  if(rec.nativeClients>=CAPS.nativeClients)throw capError('CLIENT');
  const secondConnectMs=workBudget(CAPS.connectMs);
  if(secondConnectMs<=0)throw codeError('CONNECT','BUDGET');
  blocker=new pg.Client({host:TARGET.socketDir,database:TARGET.database,user:TARGET.user,application_name:'vqa025-native-blocker',connectionTimeoutMillis:secondConnectMs,options:'-c statement_timeout=5000'});
  rec.nativeClients++;
  await runBounded(()=>blocker.connect(),secondConnectMs,'CONNECT',false);
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
    assertDispatchable('GATE',true);
    if(rec.gateCalls.length>=CAPS.gateOwnerCalls)throw capError('GATE');
    rec.gateCalls.push({deadlineMs:options?.deadlineMs??null,signal:options?.signal??null,at:Date.now()});
    const signals=[options?.signal,caseAbort?.signal].filter(Boolean);
    const signal=signals.length>1?AbortSignal.any(signals):signals[0];
    return runBounded(()=>gate.assertServable(subject,{...options,...(signal?{signal}:{})}),caseBudget(CAPS.casePhaseMs),'GATE',true);
  }};
  service=createArtifactService({validators:artifactValidators,
    authorize:async request=>({receiptId:'vqa025-native-receipt',decision:'allow',action:request.action,binding:structuredClone(request.binding),scopesSha256:artifactValidators.hash(request.scopes),resourceSha256:artifactValidators.hash(request.resource),requestSha256:request.requestSha256,expiresAtMs:request.deadlineMs}),
    versions:{read:async()=>{versionReads.push(1);throw Object.assign(Error('UNEXPECTED_VERSION_READ'),{code:'UNEXPECTED_VERSION_READ'});},commit:async()=>{publications.push(1);throw Object.assign(Error('UNEXPECTED_VERSION_COMMIT'),{code:'UNEXPECTED_VERSION_COMMIT'});}},
    objects:{get:async()=>{objectReads.push(1);throw Object.assign(Error('UNEXPECTED_OBJECT_READ'),{code:'UNEXPECTED_OBJECT_READ'});},put:async()=>{publications.push(1);throw Object.assign(Error('UNEXPECTED_OBJECT_WRITE'),{code:'UNEXPECTED_OBJECT_WRITE'});}},
    executor:{execute:async()=>{executions.push(1);throw Object.assign(Error('UNEXPECTED_EXECUTION'),{code:'UNEXPECTED_EXECUTION'});}},
    now:()=>Date.now(),ids:()=>({}),retention:gatePort});
});

after(async()=>{
  const endRequestedAt=Date.now();
  let shutdownOk=false;
  try{
    assertDispatchable('SHUTDOWN');
    const ms=workBudget(CAPS.endMs);
    if(ms<=0)throw codeError('SHUTDOWN','BUDGET');
    const settled=await runBounded(()=>Promise.allSettled([readClient?.end(),blocker?.end()]),ms,'END',false);
    if(settled.some(entry=>entry.status==='rejected'))throw codeError('END','REJECTED');
    rec.endSettled=true;shutdownOk=true;
  }catch(error){rec.shutdownFailed=true;rec.shutdownError=error?.code??String(error?.message??error);}
  emit('final',{endRequestedAt,endSettled:rec.endSettled,serverAcknowledged:false,shutdownOk,shutdownError:rec.shutdownError,failed:state.failed,reason:state.reason,completed:state.completed});
  if(shutdownOk)clearTimeout(watchdog);
  assert.equal(shutdownOk,true,`owned shutdown failed: ${rec.shutdownError??'unknown'}`);
  assert.ok(monoNowS()<=MONO_DEADLINE_S,'whole lifecycle stayed inside the sealed monotonic 180s ceiling');
});

const q=(lease,sql,values)=>{assertDispatchable('QUERY',caseAbort!==null);return lease.query(sql,values);};
const lockBlocker=async()=>{assertDispatchable('BLOCKER_LOCK',true);const result=await runBounded(()=>blockerLease.query("SELECT pg_advisory_lock(hashtextextended('meri_retention_recovery',0)) AS locked"),caseBudget(5000),'BLOCKER_LOCK',true);rec.blockerLocks++;return result;};
const unlockBlocker=async()=>{assertDispatchable('BLOCKER_UNLOCK',true);const result=await runBounded(()=>blockerLease.query("SELECT pg_advisory_unlock(hashtextextended('meri_retention_recovery',0)) AS unlocked"),caseBudget(5000),'BLOCKER_UNLOCK',true);rec.blockerUnlocks++;assert.equal(result.rows[0].unlocked,true,'the owned blocker was released');};
const artifactContext=deadlineMs=>({binding:{tenantId:TENANT,actorId:ACTOR,conversationId:CONVERSATION,runId:RUN,attemptId:ATTEMPT,workerId:WORKER,writerFence:1},scopes:[{tenantId:TENANT,kind:'client',resourceId:CLIENT,policyRevision:'vqa025-native'}],evidence:[],assets:[],deadlineMs,maxBytes:1048576});

const caseWindow=()=>Math.max(0,caseRemainingMs());

test('native cases (aggregate <=60s)',{timeout:CAPS.casePhaseMs},async t=>{
  if(state.aborted)assert.fail(`unit aborted before cases: ${state.reason}`);
  casePhaseDeadlineS=Math.min(monoNowS()+CAPS.casePhaseMs/1000,WORK_DEADLINE_S);
  const onAbort=()=>abortOwned('TEST_TIMEOUT');
  t.signal?.addEventListener('abort',onAbort,{once:true});
  await t.test('case 1: one genuine shared-wait 55P03, confirmed ROLLBACK, one fresh retry accepted before the 5s cutoff',async tt=>{
    await guarded(tt,1,async signal=>{
      const before=rec.mark();await lockBlocker();
      const entryMono=monoNowS(),entryWall=Date.now();
      const firstTimeout=deferred();rec.onLockTimeout=firstTimeout.resolve;
      const attempt=gatePort.assertServable(SUBJECT,{signal});
      const observedTimeout=await runBounded(()=>firstTimeout.promise,caseBudget(10000),'FIRST_55P03',true);
      assert.equal(rec.firstSharedSqlstate,'55P03','the first shared recovery-lock wait is the original SQLSTATE');
      await unlockBlocker();
      const acceptedMono=await runBounded(()=>attempt.then(()=>monoNowS()),caseBudget(CAPS.casePhaseMs),'ACCEPTED',true);
      const delta=rec.delta(before);
      assert.equal(delta.lock,2,'exactly two shared-lock attempts');
      assert.equal(delta.begin,2,'exactly two read-only transactions');
      assert.equal(delta.rollback,1,'the first attempt rolled back');
      assert.equal(delta.rollbackAck,1,'the ROLLBACK was acknowledged before the retry');
      assert.equal(delta.joined,1,'one fresh joined projection/watermark snapshot');
      assert.equal(delta.commit,1,'the retry committed');
      assert.ok(observedTimeout.mono-entryMono>=1.9,'the first wait used the real 2s server lock timeout');
      assert.ok(acceptedMono-entryMono<5,'accepted inside the monotonic 5s window');
      assert.ok(acceptedMono<WORK_DEADLINE_S,'accepted inside the sealed work deadline');
      const begins=rec.statements.filter(entry=>entry.phase==='BEGIN');
      assert.ok(begins[1].mono>=observedTimeout.mono,'the retry began after the first timeout');
      assert.ok(rec.firstRollbackAckMono!==null&&rec.firstRollbackAckMono<=begins[1].mono,'the first ROLLBACK acknowledgement preceded the second BEGIN');
      assert.equal(rec.firstSharedSqlstate,'55P03');
      rec.evidence.push({case:1,entryWall,entryMono,timeoutAt:observedTimeout.at,timeoutMono:observedTimeout.mono,rollbackAckAt:rec.firstRollbackAckAt,rollbackAckMono:rec.firstRollbackAckMono,acceptedMono,acceptedWall:Date.now(),originalSqlstate:rec.firstSharedSqlstate,lockAttempts:delta.lock,transactions:delta.begin,rollbackAcknowledged:delta.rollbackAck});
    });
  });
  await t.test('case 2: artifact inspect with entry+3000ms cutoff refuses after one attempt; no second BEGIN, read, commit or publication',async tt=>{
    await guarded(tt,2,async signal=>{
      if(caseWindow()<3500)throw codeError('CASE_2','CASE_BUDGET');
      const before=rec.mark();await lockBlocker();
      const entryWall=Date.now(),deadlineMs=entryWall+3000;
      const refused=await runBounded(()=>service.inspect(VERSION,artifactContext(deadlineMs),{signal}).then(()=>null,error=>error),caseBudget(CAPS.casePhaseMs),'INSPECT',true);
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
      rec.evidence.push({case:2,entryWall,deadlineMs,gateDeadlineMs:call.deadlineMs,gateSignal:call.signal instanceof AbortSignal,refusedAt:Date.now(),refusalCode:refused.code,lockAttempts:delta.lock,transactions:delta.begin,rollbackAcknowledged:delta.rollbackAck});
    });
  });
  await t.test('case 3: explicit caller abort during the first blocked read retires the lease with no retry, second BEGIN, read or COMMIT',async tt=>{
    await guarded(tt,3,async signal=>{
      if(caseWindow()<2000)throw codeError('CASE_3','CASE_BUDGET');
      const before=rec.mark();await lockBlocker();
      const entryWall=Date.now(),callerDeadline=entryWall+5000;
      const lockStarted=deferred();let abortedAt=null;
      rec.onPhase=phase=>{if(phase==='LOCK_SHARED'&&rec.onPhase){rec.onPhase=null;lockStarted.resolve();}};
      const running=runBounded(()=>service.inspect(VERSION,artifactContext(callerDeadline),{signal}).then(()=>null,error=>error),caseBudget(CAPS.casePhaseMs),'INSPECT',true);
      await runBounded(()=>lockStarted.promise,caseBudget(5000),'LOCK_STARTED',true);
      const abortTimer=setTimeout(()=>{abortedAt=Date.now();caseAbort?.abort();},250);
      let refused;try{refused=await running;}finally{clearTimeout(abortTimer);}
      await runBounded(()=>released.promise,caseBudget(5000),'LEASE_RETIRED',true);
      await unlockBlocker();
      const delta=rec.delta(before);
      assert.equal(signal.aborted,true,'the case signal aborted during the read');
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
      rec.evidence.push({case:3,entryWall,deadlineMs:callerDeadline,abortedAt,retiredAt:Date.now(),refusalCode:refused.code,lockAttempts:delta.lock,transactions:delta.begin,rollbackSent:delta.rollback,physicalRollbackClaim:false,leaseRetirement:rec.releases.at(-1).error,endRequested:true,endSettled:false,serverAcknowledged:false});
    });
  });
  t.signal?.removeEventListener('abort',onAbort);
  assert.equal(state.failed,false,`unit failed: ${state.reason}`);
  assert.deepEqual(state.completed,[1,2,3],`completed ${state.completed}; skipped ${state.skipped}`);
  assert.ok(monoNowS()<=casePhaseDeadlineS,'aggregate case phase stayed inside 60s');
});

test('finite unit caps and complete evidence',async t=>{
  assert.equal(state.failed,false,`unit failed: ${state.reason}`);
  assert.deepEqual(state.completed,[1,2,3],`completed ${state.completed}; skipped ${state.skipped}`);
  assert.equal(rec.gateCalls.length,CAPS.gateOwnerCalls,'exactly three gate-owner calls');
  assert.ok(rec.nativeClients<=CAPS.nativeClients,`native clients ${rec.nativeClients} <= ${CAPS.nativeClients}`);
  assert.equal(rec.begin,CAPS.transactionAttempts,'exactly 4 transaction attempts (2+1+1)');
  assert.equal(rec.rollback,2,'two confirmed ROLLBACK statements');
  assert.equal(rec.rollbackAck,2,'both ROLLBACK statements acknowledged');
  assert.equal(rec.commit,1,'one committed retry');
  assert.equal(rec.count('JOINED_READ'),1,'one accepted joined projection snapshot');
  assert.ok(rec.statements.length<=CAPS.statements,`statements ${rec.statements.length} <= ${CAPS.statements}`);
  assert.ok(rec.trace.length<=TRACE_LIMIT,'the metadata trace stayed bounded');
  assert.equal(rec.evidence.length,3,'three per-case evidence records were retained');
  assert.ok(Number.isSafeInteger(traceOmitted)&&traceOmitted>=0,'trace omission accounting is exact');
  assert.ok(monoNowS()<=MONO_DEADLINE_S,'cases stayed inside the sealed monotonic ceiling');
});
