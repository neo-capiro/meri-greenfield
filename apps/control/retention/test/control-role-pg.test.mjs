/** Actual control-role assay. Root provisions the canonical 48-entry schema and
 * grants in this disposable socket-only PG16 database and owns its destruction.
 * This test never connects as an administrator, creates schema, changes roles or
 * cleans shared content. The in-memory ledger is an explicit fixture input, not
 * proof of production durable-ledger composition or physical-purge readiness. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from '../../../runtime/node_modules/pg/lib/index.js';
import {createPostgresRetentionJournal} from '../postgres-journal.mjs';
import {createPostgresWatermarkStore} from '../postgres-watermark.mjs';
import {createRetentionStartup} from '../startup.mjs';
import {createMemoryLedgerSink} from '../ledger.mjs';
import {hash,subjectKey} from '../boundary.mjs';
import {createPostgresConversationStore} from '../../conversations/postgres-store.mjs';
import {versions} from '../../conversations/test/store-fixture.mjs';
import {createPostgresMemoryJournal} from '../../memory/postgres-journal.mjs';
import {buildCandidate} from '../../memory/candidate.mjs';
import {productFailure} from '../../product-access/errors.mjs';

const SOCKET='/tmp/meri-retention-role-pg-20261024/socket',DATABASE='meri_retention_role_fixture';
const supplied=process.env.MERI_RETENTION_ROLE_PG_SOCKET!==undefined||process.env.MERI_RETENTION_ROLE_PG_DATABASE!==undefined;
if(supplied&&(process.platform==='win32'||process.env.MERI_RETENTION_ROLE_PG_SOCKET!==SOCKET||process.env.MERI_RETENTION_ROLE_PG_DATABASE!==DATABASE))
 throw Error('MERI_RETENTION_ROLE_PG_TARGET_REFUSED');
const enabled=supplied&&process.platform!=='win32';
const denied=error=>error?.code==='42501';
const subjectOf=b=>({tenantId:b.tenantId,kind:'conversation',subjectId:b.conversationId});

async function seedRun(pool,now){
 const binding={tenantId:randomUUID(),actorId:randomUUID(),conversationId:randomUUID(),runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:1};
 const clientId=randomUUID(),policyRevision='synthetic-policy-1',scopes=[{tenantId:binding.tenantId,kind:'client',resourceId:clientId,policyRevision}],createdAt=new Date(now()).toISOString();
 const conversation={conversationId:binding.conversationId,owner:{tenantId:binding.tenantId,actorId:binding.actorId},scopes,createdAt,policyRevision};
 const run={binding,state:'running',scopes,createdAt,policyRevision,versions},request={requestId:randomUUID(),prompt:'Synthetic retention role fixture',skill:null,window:null};
 await pool.query('INSERT INTO meri_conversations.conversations(tenant_id,conversation_id,owner_actor_id,projection,projection_sha256) VALUES($1,$2,$3,$4,$5)',
  [binding.tenantId,binding.conversationId,binding.actorId,conversation,hash(conversation)]);
 await pool.query('INSERT INTO meri_conversations.runs(tenant_id,conversation_id,run_id,projection,projection_sha256,request_id,request,request_sha256,last_sequence) VALUES($1,$2,$3,$4,$5,$6,$7,$8,1)',
  [binding.tenantId,binding.conversationId,binding.runId,run,hash(run),request.requestId,request,hash(request)]);
 const expiresAtMs=now()+120000,execution={binding,executionKey:hash(binding),executionId:hash(binding),planSha256:'a'.repeat(64),expiresAtMs,runtimeSessionId:'synthetic-retention-role-session-00000001',phase:'started',native:null};
 await pool.query('INSERT INTO meri_conversations.native_executions(tenant_id,conversation_id,run_id,execution_key,execution_id,record,record_sha256) VALUES($1,$2,$3,$4,$5,$6,$7)',
  [binding.tenantId,binding.conversationId,binding.runId,execution.executionKey,execution.executionId,execution,hash(execution)]);
 return {binding,clientId,policyRevision,scopes,expiresAtMs,principal:{tenantId:binding.tenantId,actorId:binding.actorId},subject:subjectOf(binding)};
}

function memoryContext(f,at){
 const {binding,clientId,policyRevision,scopes,expiresAtMs}=f;
 const task={binding,clientId,policyRevision,expiresAtMs},subject={kind:'client',entityType:'client',entityIds:[clientId],tenantId:binding.tenantId,actorId:binding.actorId,policyRevision,scopes,rosterVersionId:null};
 const page={tool:'list_memory_proposals',enabled:true,authority:'own_pending_proposals',claimsAreApprovedFacts:false,scope:{tenantId:binding.tenantId,userId:binding.actorId,clientId},
  candidates:[{id:randomUUID(),status:'pending',approvedFact:false,scope:'client',clientId,sourceKind:'explicit_user',createdAt:new Date(at-1000).toISOString(),restricted:false,title:'Synthetic draft',proposedText:'Synthetic pending memory',contentTruncated:false}],
  nextCursor:'synthetic-next-page',coverage:{firstPage:true,complete:false,reason:'unread_pages_restricted_or_truncated_content'}};
 const key={binding,operation:{id:'memory.list_own_proposals',version:'0.2.0'},policyRevision,subject,cursor:page.nextCursor};
 const previous={request:{clientId,cursor:null,limit:5},page};
 return {task,key,record:{key,previous,previousSha256:hash(previous),recordedAtMs:at,expiresAtMs}};
}

test('canonical control role serves and recovers retention without content mutation privileges',{
 skip:!enabled&&'requires the exact disposable Unix PG16 role fixture',timeout:60000
},async t=>{
 const pool=new pg.Pool({host:SOCKET,port:5432,database:DATABASE,user:'meri_control_runtime',password:'',max:6,
  connectionTimeoutMillis:3000,query_timeout:5000,options:'-c statement_timeout=5000 -c lock_timeout=2000'});
 t.after(()=>pool.end());
 const identity=(await pool.query("SELECT current_user,session_user,current_database() AS database,current_setting('listen_addresses') AS listen,current_setting('server_version_num')::int AS version,inet_server_addr() AS address")).rows[0];
 assert.equal(identity.current_user,'meri_control_runtime');assert.equal(identity.session_user,'meri_control_runtime');
 assert.equal(identity.database,DATABASE);assert.equal(identity.listen,'');assert.equal(identity.address,null);assert.ok(identity.version>=160000&&identity.version<170000);
 const role=(await pool.query('SELECT rolsuper,rolcreaterole,rolcreatedb,rolreplication,rolbypassrls,rolinherit FROM pg_roles WHERE rolname=current_user')).rows[0];
 assert.ok(Object.values(role).every(v=>v===false),'real nonowner role has no elevated attributes');
 assert.equal((await pool.query("SELECT pg_has_role(current_user,'meri_product_migrator','MEMBER') AS member")).rows[0].member,false);
 const owned=(await pool.query("SELECT count(*)::int AS n FROM pg_class WHERE relnamespace IN ('meri_conversations'::regnamespace,'meri_artifacts'::regnamespace,'meri_memory'::regnamespace) AND relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)")).rows[0].n;
 assert.equal(owned,0,'control owns no product relation');
 const now=Date.now,journal=createPostgresRetentionJournal({pool,now}),watermark=createPostgresWatermarkStore({journal}),sink=createMemoryLedgerSink();
 const makeStartup=()=>createRetentionStartup({journal,watermark,ledgerSink:sink,ownership:journal,purge:{enabled:false},now});
 let startup=makeStartup();
 await t.test('empty-ledger startup writes and reads the exact watermark; purge remains disabled',async()=>{
  assert.deepEqual(await watermark.read(),{sequence:0,entrySha256:null});
  await startup.start();assert.equal(startup.state().enabled,true);
  assert.deepEqual(await watermark.read(),{sequence:0,entrySha256:null});
  await assert.rejects(startup.purge.execute({}),{code:'RETENTION_PURGE_DISABLED'});
 });
 const f=await seedRun(pool,now),key=subjectKey(f.subject);
 await t.test('actual suppression/release, stale CAS, restore and restart keep projection and watermark coherent',async()=>{
  await startup.gate.assertServable(f.subject);
  await assert.rejects(startup.suppression.suppress({principal:{...f.principal,actorId:randomUUID()},subject:f.subject,reason:'foreign actor'}),{code:'RETENTION_AUTHORIZATION_REFUSED'});
  await assert.rejects(startup.suppression.suppress({principal:f.principal,subject:{...f.subject,tenantId:randomUUID()},reason:'foreign tenant'}),{code:'RETENTION_SUBJECT_UNKNOWN'});
  const suppressedResult=await startup.suppression.suppress({principal:f.principal,subject:f.subject,reason:'synthetic suppression'}),suppressed=await journal.get(key);
  assert.deepEqual(suppressedResult,{...suppressed,replayed:false});
  await assert.rejects(startup.gate.assertServable(f.subject),{code:'RETENTION_SUPPRESSED'});
  await assert.rejects(journal.set(key,suppressed,{expected:'f'.repeat(64)}),{code:'RETENTION_STALE_WRITE'});
  const releasedResult=await startup.suppression.release({principal:f.principal,subject:f.subject,reason:'synthetic release'}),released=await journal.get(key);
  assert.deepEqual(releasedResult,{...released,replayed:false});
  await startup.gate.assertServable(f.subject);
  // Simulate a restore through the same permitted projection owner, never through an owner/admin connection.
  await journal.set(key,suppressed,{expected:hash(released)});
  await watermark.record({sequence:suppressed.ledgerSequence,entrySha256:suppressed.entrySha256});
  await assert.rejects(startup.gate.assertServable(f.subject),{code:'RETENTION_RECOVERY_BARRIER'});
  startup=makeStartup();await startup.start();
  assert.equal((await journal.get(key)).state,'RELEASED');await startup.gate.assertServable(f.subject);
  assert.deepEqual(await watermark.read(),await startup.ledger.head());
  await assert.rejects(watermark.advanceProjection({key,projectionSha256:'f'.repeat(64),sequence:released.ledgerSequence,minimumSequence:0}),{code:'RETENTION_PROJECTION_UNVERIFIED'});
 });
 await t.test('recovery rebuilds both purge metadata projections but cannot erase content',async()=>{
  const a={tenantId:f.binding.tenantId,kind:'artifact',subjectId:randomUUID(),ownerActorId:f.binding.actorId};
  const authorization={mode:'owner',receiptId:null},outstandingAccess={signedUrlsExpireAtMs:null,inFlightRuns:[]};
  for(const subject of [f.subject,a]){
   await startup.ledger.append({subject:{...subject,ownerActorId:f.binding.actorId},state:'SUPPRESSED',reason:'synthetic recovery',facts:{authorization,outstandingAccess,cancelled:[]}});
   await startup.recover();
   const object={workflowId:hash({subject,kind:'object'}),classes:['sdkSession'],objectId:randomUUID(),versionId:'synthetic-version',sha256:'1'.repeat(64),state:'UNKNOWN'};
   const row={workflowId:hash({subject,kind:'row'}),className:'sdkSession',target:{runId:f.binding.runId,sessionId:randomUUID(),subpath:'main',sequence:1},state:'UNKNOWN'};
   await startup.ledger.append({subject:{...subject,ownerActorId:f.binding.actorId},state:'PURGE_UNKNOWN',facts:{planSha256:'2'.repeat(64),steps:[object],rowSteps:subject.kind==='conversation'?[row]:[]}});
   await startup.recover();
   const table=subject.kind==='conversation'?'meri_conversations':'meri_artifacts',id=subject.kind==='conversation'?'conversation_id':'artifact_id';
   assert.equal((await pool.query(`SELECT count(*)::int AS n FROM ${table}.retention_purges WHERE tenant_id=$1 AND ${id}=$2`,[subject.tenantId,subject.subjectId])).rows[0].n,1);
   if(subject.kind==='conversation')assert.equal((await pool.query('SELECT count(*)::int AS n FROM meri_conversations.retention_purge_targets WHERE tenant_id=$1 AND conversation_id=$2',[subject.tenantId,subject.subjectId])).rows[0].n,1);
   assert.equal((await journal.get(subjectKey(subject))).purge.state,'UNKNOWN','missing physical storage cannot turn a purge into success');
   // A later authoritative release clears only the recovery projection rows.
   await startup.ledger.append({subject:{...subject,ownerActorId:f.binding.actorId},state:'RELEASED',facts:{authorization}});await startup.recover();
   assert.equal((await pool.query(`SELECT count(*)::int AS n FROM ${table}.retention_purges WHERE tenant_id=$1 AND ${id}=$2`,[subject.tenantId,subject.subjectId])).rows[0].n,0);
   await startup.gate.assertServable(subject);
  }
 });
 const context=memoryContext(f,now()),makeStore=()=>createPostgresConversationStore({pool,now,retentionGate:startup.gate,retentionHead:startup.ledger.head});
 await t.test('immutable context retain/replay/read/inventory stays scope-bound and obeys suppression',async()=>{
  const ports=makeStore().memoryProposalContexts.forTask(context.task);
  assert.equal(JSON.parse(await ports.retain({record:context.record})).decision,'retained');
  await ports.retain({record:context.record});
  assert.deepEqual(JSON.parse(await makeStore().memoryProposalContexts.forTask(context.task).loadPrevious({key:context.key})).record,context.record);
  const inventory=await makeStore().memoryProposalContexts.inventoryForConversation({tenantId:f.binding.tenantId,conversationId:f.binding.conversationId});
  assert.deepEqual(inventory,[{runId:f.binding.runId,keySha256:hash(context.key)}]);
  assert.deepEqual(await makeStore().memoryProposalContexts.inventoryForConversation({tenantId:randomUUID(),conversationId:f.binding.conversationId}),[]);
  for(const [changed,code] of [[{actorId:randomUUID()},'EXECUTION_CORRUPT'],[{tenantId:randomUUID()},'MEMORY_CONTEXT_REFUSED']]){
   const binding={...f.binding,...changed},task={...context.task,binding},key={...context.key,binding,subject:{...context.key.subject,...changed,
    scopes:context.key.subject.scopes.map(s=>({...s,tenantId:binding.tenantId}))}};
   await assert.rejects(makeStore().memoryProposalContexts.forTask(task).loadPrevious({key}),{code});
  }
  const previous=structuredClone(context.record.previous);previous.page.candidates[0].proposedText='Different immutable page';
  await assert.rejects(ports.retain({record:{...context.record,previous,previousSha256:hash(previous)}}),{code:'MEMORY_CONTEXT_REPLAY_REFUSED'});
  await startup.suppression.suppress({principal:f.principal,subject:f.subject,reason:'context suppression'});
  await assert.rejects(ports.loadPrevious({key:context.key}),{code:'RETENTION_SUPPRESSED'});
  await startup.suppression.release({principal:f.principal,subject:f.subject,reason:'context release'});
  assert.deepEqual(JSON.parse(await ports.loadPrevious({key:context.key})).record,context.record);
  await assert.rejects(pool.query('UPDATE meri_conversations.memory_proposal_contexts SET record_sha256=record_sha256 WHERE tenant_id=$1 AND conversation_id=$2',[f.binding.tenantId,f.binding.conversationId]),e=>e.code==='P0001'&&e.message==='MEMORY_PROPOSAL_CONTEXT_IMMUTABLE');
 });
 await t.test('real rollback preserves projection and a lost COMMIT acknowledgement retires the lease',async()=>{
  const saved=await journal.get(key);
  await assert.rejects(journal.tx(async c=>{
   await c.query('UPDATE meri_conversations.retention_subjects SET projection_sha256=$3 WHERE tenant_id=$1 AND conversation_id=$2',[f.binding.tenantId,f.binding.conversationId,'f'.repeat(64)]);
   throw Error('synthetic failure before COMMIT');
  }),{code:'RETENTION_STORE_UNAVAILABLE'});
  assert.deepEqual(await journal.get(key),saved,'actual rollback restores the original projection hash');
  let lost=false,discarded=0;
  const transport={async connect(){const client=await pool.connect();return {
   async query(sql,params){const result=await client.query(sql,params);if(sql==='COMMIT'&&!lost){lost=true;throw Error('synthetic lost acknowledgement after actual COMMIT');}return result;},
   release(error){if(error)discarded++;client.release(error);}
  };}};
  const uncertain=createPostgresRetentionJournal({pool:transport,now});
  await assert.rejects(uncertain.set(key,saved,{expected:hash(saved)}),{code:'RETENTION_COMMIT_UNKNOWN'});
  assert.equal(discarded,1);assert.deepEqual(await journal.get(key),saved,'readback resolves actual committed bytes, not an assumed rollback');
  await startup.recover();assert.deepEqual(await watermark.read(),await startup.ledger.head());
 });
 await t.test('ordinary memory candidate ownership, replay and submission work with the appended origin columns',async()=>{
  const memory=createPostgresMemoryJournal({pool,guardConversationRetention:true});
  const candidate=buildCandidate({candidateId:randomUUID(),principal:f.principal,scope:'client',clientId:f.clientId,content:'Synthetic candidate',key:null,ttlDays:null,sources:[],
   origin:{kind:'conversation',conversationId:f.binding.conversationId,runId:f.binding.runId,commandId:randomUUID(),commandSha256:'a'.repeat(64)},idempotencyKey:randomUUID(),createdAt:new Date(now()).toISOString()});
  const input={...candidate,requestSha256:hash({synthetic:'request'})};
  assert.equal((await memory.insert(input)).inserted,true);assert.equal((await memory.insert(input)).inserted,false);
  await assert.rejects(memory.insert({...input,requestSha256:'b'.repeat(64)}),e=>productFailure(e)?.code==='MEMORY_IDEMPOTENCY_CONFLICT');
  const selection={tenantId:f.binding.tenantId,proposerActorId:f.binding.actorId,candidateId:candidate.candidate.candidateId};
  assert.deepEqual((await memory.get(selection)).candidate,candidate.candidate);
  assert.equal(await memory.get({...selection,proposerActorId:randomUUID()}),null);assert.equal(await memory.get({...selection,tenantId:randomUUID()}),null);
  assert.equal((await memory.listOwn({...selection,clientIds:[f.clientId],clientId:f.clientId,cursor:null,limit:10})).length,1);
  await memory.recordUnknown(selection);const reviewId=randomUUID();await memory.recordSubmission({...selection,candidateSha256:candidate.candidateSha256,reviewId});
  assert.deepEqual((await memory.get(selection)).submission,{state:'SUBMITTED',reviewId});
  await startup.suppression.suppress({principal:f.principal,subject:f.subject,reason:'candidate suppression'});
  await assert.rejects(memory.insert(input),e=>productFailure(e)?.code==='MEMORY_PROPOSAL_NOT_FOUND');
  await startup.suppression.release({principal:f.principal,subject:f.subject,reason:'candidate release'});
 });
 await t.test('content, tombstone, schedule and DDL privileges remain forbidden on the same role',async()=>{
  const statements=[
   'DELETE FROM meri_conversations.sdk_session_entries','DELETE FROM meri_conversations.memory_proposal_contexts',
   'DELETE FROM meri_artifacts.versions','DELETE FROM meri_conversations.retention_subjects','DELETE FROM meri_artifacts.retention_subjects',
   'DELETE FROM meri_memory.candidates','DELETE FROM meri_conversations.retention_recovery_watermark',
   'UPDATE meri_memory.candidates SET candidate=NULL,candidate_purged_at=now()',
   'UPDATE meri_settings.tenant_settings SET monthly_cap_micro_usd=0',
   'INSERT INTO meri_conversations.memory_proposal_retention_targets DEFAULT VALUES','INSERT INTO meri_schedules.occurrences DEFAULT VALUES',
   'TRUNCATE meri_conversations.memory_proposal_contexts','TRUNCATE meri_conversations.retention_subjects',
   'CREATE TABLE meri_conversations.forbidden_role_fixture(id integer)','SET ROLE meri_product_migrator'
  ];
  for(const sql of statements)await assert.rejects(pool.query(sql),denied,sql);
  assert.equal((await pool.query('SELECT current_user')).rows[0].current_user,'meri_control_runtime');
  assert.deepEqual(JSON.parse(await makeStore().memoryProposalContexts.forTask(context.task).loadPrevious({key:context.key})).record,context.record,'failed writes did not change retained bytes');
  const head=await startup.ledger.head();
  const projected={sequence:head.sequence,entrySha256:null};
  assert.deepEqual(await watermark.read(),projected,'ordinary projection advancement awaits recovery certification');
  assert.deepEqual(await startup.ensureServing(),projected,'the current verified projection serves without forcing recovery');
  assert.deepEqual(await watermark.read(),projected);
  const recovered=await startup.recover();
  assert.deepEqual(recovered.recovered,head,'explicit recovery certifies the exact durable head');
  assert.deepEqual(await watermark.read(),await startup.ledger.head());
 });
});
