/** Synthetic source-only witness for the Meri candidate journal's conversation inventory port. The central retention owner has
 * not bound this port, allocated guarded deletion, or defined a subject for surface-origin candidates. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCandidate} from '../candidate.mjs';
import {createPostgresMemoryJournal} from '../postgres-journal.mjs';
import {productFailure} from '../../product-access/errors.mjs';
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
 const query={tenantId:principal().tenantId,conversationId,limit:1};
 assert.deepEqual(await journal.listConversationCandidateIds(query),[id(1)]);
 assert.deepEqual(await journal.listConversationCandidateIds({...query,afterCandidateId:id(1)}),[id(2)]);
 assert.deepEqual(await journal.listConversationCandidateIds({...query,afterCandidateId:id(2)}),[]);
 assert.match(f.statements.find(s=>s.startsWith('SELECT candidate_id')),/tenant_id=\$1 AND candidate->'origin'->>'kind'='conversation' AND candidate->'origin'->>'conversationId'=\$2/u);
});

test('conversation inventory refuses unbounded or malformed enumeration before opening a connection',async()=>{
 let connects=0;const journal=createPostgresMemoryJournal({pool:{async connect(){connects++;throw Error('unexpected connection');}}});
 for(const request of [{tenantId:'t',conversationId:'not-a-uuid'},{tenantId:'t',conversationId:id(1),limit:501},
  {tenantId:'t',conversationId:id(1),afterCandidateId:'not-a-uuid'}]){
  await assert.rejects(journal.listConversationCandidateIds(request),e=>productFailure(e)?.code==='MEMORY_JOURNAL_STATE');
 }
 assert.equal(connects,0);
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
