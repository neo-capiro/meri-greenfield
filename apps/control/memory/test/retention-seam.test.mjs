/** Synthetic source-only witness for the Meri candidate journal's conversation inventory port. The central retention owner has
 * not bound this port, allocated guarded deletion, or defined a subject for surface-origin candidates. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCandidate} from '../candidate.mjs';
import {createPostgresMemoryJournal} from '../postgres-journal.mjs';
import {createMemoryCandidateRetentionPayloadOwner,MEMORY_CANDIDATE_ROW_CLASS} from '../retention-payload-owner.mjs';
import {productFailure} from '../../product-access/errors.mjs';
import {hash,subjectKey} from '../../retention/boundary.mjs';
import {planDigest} from '../../retention/purge.mjs';
import {createMemoryPoolFixture} from './pool-fixture.mjs';
import {id,NOW,principal} from './fixtures.mjs';

test('conversation inventory pages exact local payload IDs under tenant and trusted origin, excluding surface and another conversation',async()=>{
 const f=createMemoryPoolFixture(),journal=createPostgresMemoryJournal({pool:f.pool}),conversationId=id(801);
 async function seed(n,{tenantId=principal().tenantId,origin={kind:'conversation',conversationId,runId:id(802),commandId:id(803),commandSha256:'a'.repeat(64)}}={}){
  const built=buildCandidate({candidateId:id(n),principal:principal({tenantId}),scope:'personal',clientId:null,content:`fact ${n}`,key:null,ttlDays:null,
   sources:[],origin,idempotencyKey:id(n+100),createdAt:new Date(NOW).toISOString()});
  await journal.insert({...built,requestSha256:'b'.repeat(64)});
 }
 await seed(1);await seed(2);await seed(3,{origin:{kind:'surface'}});
 await seed(4,{origin:{kind:'conversation',conversationId:id(804),runId:id(802),commandId:id(803),commandSha256:'a'.repeat(64)}});
 await seed(5,{tenantId:'another-tenant'});
 const query={tenantId:principal().tenantId,conversationId,proposerActorId:principal().actorId,limit:1};
 assert.deepEqual(await journal.listConversationCandidateIds(query),[id(1)]);
 assert.deepEqual(await journal.listConversationCandidateIds({...query,afterCandidateId:id(1)}),[id(2)]);
 assert.deepEqual(await journal.listConversationCandidateIds({...query,afterCandidateId:id(2)}),[]);
 assert.match(f.statements.find(s=>s.startsWith('SELECT candidate_id')),/tenant_id=\$1 AND origin_kind='conversation' AND origin_conversation_id=\$2 AND proposer_actor_id=\$5 AND candidate IS NOT NULL/u);
});

test('conversation inventory refuses unbounded or malformed enumeration before opening a connection',async()=>{
 let connects=0;const journal=createPostgresMemoryJournal({pool:{async connect(){connects++;throw Error('unexpected connection');}}});
 for(const request of [{tenantId:'t',conversationId:'not-a-uuid',proposerActorId:'a'},{tenantId:'t',conversationId:id(1),proposerActorId:'a',limit:501},
  {tenantId:'t',conversationId:id(1),proposerActorId:'a',afterCandidateId:'not-a-uuid'},{tenantId:'t',conversationId:id(1)}]){
  await assert.rejects(journal.listConversationCandidateIds(request),e=>productFailure(e)?.code==='MEMORY_JOURNAL_STATE');
 }
 assert.equal(connects,0);
});

test('payload owner pages local IDs and verifies exact tenant, conversation and candidate without reading candidate content',async()=>{
 const f=createMemoryPoolFixture(),journal=createPostgresMemoryJournal({pool:f.pool}),owner=createMemoryCandidateRetentionPayloadOwner({pool:f.pool});
 const conversationId=id(801),subject={tenantId:principal().tenantId,kind:'conversation',subjectId:conversationId,ownerActorId:principal().actorId};
 const origin={kind:'conversation',conversationId,runId:id(802),commandId:id(803),commandSha256:'a'.repeat(64)};
 for(const [n,tenantId,from] of [[1,subject.tenantId,origin],[2,'other-tenant',origin],[3,subject.tenantId,{kind:'surface'}],
  [4,subject.tenantId,{...origin,conversationId:id(804)}]]){
  const built=buildCandidate({candidateId:id(n),principal:principal({tenantId}),scope:'personal',clientId:null,content:'fact '+n,key:null,ttlDays:null,
   sources:[],origin:from,idempotencyKey:id(n+100),createdAt:new Date(NOW).toISOString()});
  await journal.insert({...built,requestSha256:'b'.repeat(64)});
 }
 assert.equal(owner.className,MEMORY_CANDIDATE_ROW_CLASS);
 assert.deepEqual(await owner.inventoryPage({subject,limit:1}),[id(1)]);
 assert.deepEqual(await owner.inventoryPage({subject,afterCandidateId:id(1),limit:1}),[]);
 assert.equal(await owner.present({subject,candidateId:id(1)}),true);
 for(const candidateId of [id(2),id(3),id(4),id(99)])assert.equal(await owner.present({subject,candidateId}),false);
 assert.ok(f.statements.filter(s=>s.startsWith('SELECT 1 FROM meri_memory.candidates')).every(s=>s.includes('origin_conversation_id=$2')&&s.includes('proposer_actor_id=$4')&&!s.includes('candidate_sha256')));
 assert.equal(await owner.present({subject:{...subject,ownerActorId:'other'},candidateId:id(1)}),false);
 assert.throws(()=>owner.present({subject:{...subject,kind:'artifact'},candidateId:id(1)}),e=>e.code==='RETENTION_INVALID_REQUEST');
});

test('candidate content tombstone keeps replay identity but withholds get, idempotent replay, list, status and resubmission',async()=>{
 const f=createMemoryPoolFixture(),journal=createPostgresMemoryJournal({pool:f.pool}),conversationId=id(801);
 const built=buildCandidate({candidateId:id(901),principal:principal(),scope:'personal',clientId:null,content:'private fact',key:null,ttlDays:null,
  sources:[],origin:{kind:'conversation',conversationId,runId:id(802),commandId:id(803),commandSha256:'a'.repeat(64)},
  idempotencyKey:id(902),createdAt:new Date(NOW).toISOString()});
 const request={...built,requestSha256:'b'.repeat(64)};
 await journal.insert(request);const stored=f.rows[0];stored.candidate=null;stored.candidate_purged_at=new Date(NOW).toISOString();
 assert.equal(f.rows.length,1);assert.equal(stored.idempotency_key,id(902));assert.equal(stored.candidate_sha256,built.candidateSha256);
 for(const read of [()=>journal.get({tenantId:stored.tenant_id,proposerActorId:stored.proposer_actor_id,candidateId:stored.candidate_id}),
  ()=>journal.findOwnByKey({tenantId:stored.tenant_id,proposerActorId:stored.proposer_actor_id,idempotencyKey:stored.idempotency_key}),
  ()=>journal.insert(request)])await assert.rejects(read(),e=>productFailure(e)?.code==='MEMORY_PROPOSAL_NOT_FOUND');
 assert.deepEqual(await journal.listOwn({tenantId:stored.tenant_id,proposerActorId:stored.proposer_actor_id,clientIds:[],clientId:null,cursor:null,limit:10}),[]);
 assert.deepEqual(await journal.listConversationCandidateIds({tenantId:stored.tenant_id,conversationId,proposerActorId:stored.proposer_actor_id}),[]);
 assert.equal(await journal.hasConversationCandidate({tenantId:stored.tenant_id,conversationId,proposerActorId:stored.proposer_actor_id,candidateId:stored.candidate_id}),false);
 await assert.rejects(journal.recordSubmission({tenantId:stored.tenant_id,candidateId:stored.candidate_id,candidateSha256:stored.candidate_sha256,reviewId:id(903)}),
  e=>productFailure(e)?.code==='MEMORY_JOURNAL_STATE');
 await assert.rejects(journal.recordUnknown({tenantId:stored.tenant_id,candidateId:stored.candidate_id}),
  e=>productFailure(e)?.code==='MEMORY_PROPOSAL_NOT_FOUND');
});

function candidatePlan(){
 const subject={tenantId:principal().tenantId,kind:'conversation',subjectId:id(801),ownerActorId:principal().actorId},workflowId='c'.repeat(64);
 const rowStep={workflowId,className:MEMORY_CANDIDATE_ROW_CLASS,target:{className:MEMORY_CANDIDATE_ROW_CLASS,key:id(1)}};
 const base={subject,subjectKey:subjectKey(subject),suppression:{ledgerSequence:1,entrySha256:'a'.repeat(64)},policyId:'policy',policyVersion:1,
  policySha256:'b'.repeat(64),inventorySha256:'d'.repeat(64),steps:[],rowSteps:[rowStep],blocks:[],state:'PLANNED',plannedAtMs:NOW};
 return {plan:{...base,planSha256:planDigest(base)},workflowId};
}

function purgeFixture(plan,{subjectState='SUPPRESSED',generation=1,targetPresent=true,redactionReadback=true,ownerActorId=principal().actorId}={}){
 const statements=[],queries=[];
 const projection={state:subjectState,ownerActorId,ledgerSequence:generation,entrySha256:'a'.repeat(64),
  purge:{state:'UNKNOWN',planSha256:plan.planSha256,ledgerSequence:2}};
 const client={async query(text,params=[]){const sql=text.replace(/\s+/gu,' ').trim();statements.push(sql);queries.push({sql,params});
  if(sql.startsWith('SELECT pg_advisory_xact_lock'))return {rows:[]};
  if(sql.startsWith('SELECT owner_actor_id,state,ledger_sequence'))return {rows:[{owner_actor_id:ownerActorId,state:subjectState,ledger_sequence:generation,entry_sha256:projection.entrySha256,
   projection,projection_sha256:hash(projection)}]};
  if(sql.startsWith('SELECT workflow_id FROM meri_conversations.retention_purge_targets'))return {rows:targetPresent?[{workflow_id:plan.rowSteps[0].workflowId}]:[]};
  if(sql.startsWith('UPDATE meri_memory.candidates SET candidate=NULL'))return {rowCount:1};
  if(sql.startsWith('SELECT candidate,candidate_purged_at FROM meri_memory.candidates'))return {rows:redactionReadback?[{candidate:null,candidate_purged_at:new Date(NOW).toISOString()}]:[{candidate:{},candidate_purged_at:null}]};
  throw Error('unexpected SQL');}};
 return {client,statements,queries};
}

test('payload redaction requires a matching same-transaction target and current suppression generation before any update',async()=>{
 const {plan,workflowId}=candidatePlan(),owner=createMemoryCandidateRetentionPayloadOwner({pool:{connect(){throw Error('unused');}}});
 for(const options of [{targetPresent:false},{subjectState:'RELEASED'},{generation:3},{ownerActorId:'other-owner'}]){
  const f=purgeFixture(plan,options);
  await assert.rejects(owner.purgeInTransaction({client:f.client,plan,workflowId}),e=>e.code?.startsWith('RETENTION_'));
  assert.equal(f.statements.some(sql=>sql.startsWith('UPDATE meri_memory.candidates')),false);
 }
 const f=purgeFixture(plan),tampered={...plan,rowSteps:[{...plan.rowSteps[0],target:{...plan.rowSteps[0].target,key:id(2)}}]};
 await assert.rejects(owner.purgeInTransaction({client:f.client,plan:tampered,workflowId}),e=>e.code==='RETENTION_PLAN_DIGEST_REFUSED');
 assert.deepEqual(f.statements,[]);
});

test('payload redaction preserves replay identity and returns terminal readback without opening a transaction',async()=>{
 const {plan,workflowId}=candidatePlan(),owner=createMemoryCandidateRetentionPayloadOwner({pool:{connect(){throw Error('unused');}}}),f=purgeFixture(plan);
 const result=await owner.purgeInTransaction({client:f.client,plan,workflowId});
 assert.deepEqual(result,{workflowId,className:MEMORY_CANDIDATE_ROW_CLASS,target:plan.rowSteps[0].target,deleted:0,redacted:1,state:'EXECUTED'});
 assert.deepEqual(f.statements.map(s=>s.split(' ')[0]),['SELECT','SELECT','SELECT','SELECT','UPDATE','SELECT']);
 assert.deepEqual(f.queries.at(-2).params,[plan.subject.tenantId,plan.subject.subjectId,id(1),plan.subject.ownerActorId]);
 assert.match(f.queries[3].sql,/candidate_id=\$4 AND plan_sha256=\$5 AND ledger_sequence=\$6 AND actor_id=\$7 AND state='PLANNED' AND xmin=pg_current_xact_id\(\)::xid FOR UPDATE$/u);
 assert.match(f.queries.at(-2).sql,/SET candidate=NULL,candidate_purged_at=clock_timestamp\(\)/u);
 assert.equal(f.statements.some(s=>s.startsWith('DELETE')),false);
 const unknown=purgeFixture(plan,{redactionReadback:false});
 await assert.rejects(owner.purgeInTransaction({client:unknown.client,plan,workflowId}),e=>e.code==='RETENTION_ROW_PURGE_UNAVAILABLE');
});

test('conversation candidate insert checks canonical projection under recovery and subject locks before writing',async()=>{
 const f=createMemoryPoolFixture(),journal=createPostgresMemoryJournal({pool:f.pool,guardConversationRetention:true}),conversationId=id(801),tenantId=principal().tenantId;
 const built=buildCandidate({candidateId:id(91),principal:principal(),scope:'personal',clientId:null,content:'A pending fact',key:null,ttlDays:null,
  sources:[],origin:{kind:'conversation',conversationId,runId:id(802),commandId:id(803),commandSha256:'a'.repeat(64)},
  idempotencyKey:id(92),createdAt:new Date(NOW).toISOString()});
 const insert=()=>journal.insert({...built,requestSha256:'b'.repeat(64)});
 f.retentionRows.set(tenantId+'/'+conversationId,'SUPPRESSED');
 await assert.rejects(insert(),e=>productFailure(e)?.code==='MEMORY_PROPOSAL_NOT_FOUND');
 assert.equal(f.rows.length,0);
 assert.deepEqual(f.statements.slice(0,7),['BEGIN',"SET LOCAL statement_timeout = '5s'","SET LOCAL lock_timeout = '2s'",
  'SET TRANSACTION ISOLATION LEVEL READ COMMITTED',
  "SELECT pg_advisory_xact_lock_shared(hashtextextended('meri_retention_recovery',0))",
  'SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
  'SELECT state FROM meri_conversations.retention_subjects WHERE tenant_id=$1 AND conversation_id=$2 FOR UPDATE']);
 assert.deepEqual(f.queries[5].params,['meri_retention_subject:'+tenantId+':conversation:'+conversationId]);
 assert.deepEqual(f.queries[6].params,[tenantId,conversationId]);
 assert.equal(f.statements[7],'ROLLBACK','a suppressed insert never reaches the candidate table');
 f.retentionRows.set(tenantId+'/'+conversationId,'RELEASED');
 await insert();assert.equal(f.rows.length,1);
 assert.ok(f.statements.some(s=>s.startsWith('INSERT INTO meri_memory.candidates')));
});

test('retention projection read failure closes a conversation insert before candidate SQL',async()=>{
 const built=buildCandidate({candidateId:id(93),principal:principal(),scope:'personal',clientId:null,content:'A pending fact',key:null,ttlDays:null,
  sources:[],origin:{kind:'conversation',conversationId:id(801),runId:id(802),commandId:id(803),commandSha256:'a'.repeat(64)},
  idempotencyKey:id(94),createdAt:new Date(NOW).toISOString()});
 const statements=[],pool={async connect(){return {async query(sql){statements.push(sql);if(sql.startsWith('SELECT state FROM meri_conversations.retention_subjects'))throw Error('database unavailable');return {rows:[]};},release(){}};}};
 const journal=createPostgresMemoryJournal({pool,guardConversationRetention:true});
 await assert.rejects(journal.insert({...built,requestSha256:'b'.repeat(64)}),e=>productFailure(e)?.code==='MEMORY_JOURNAL_UNAVAILABLE');
 assert.equal(statements.some(s=>s.startsWith('INSERT INTO meri_memory.candidates')),false);
});
