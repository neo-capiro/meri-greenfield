/** R1 over the real task-owned PostgreSQL retention journal: an independent connection suppresses the conversation while the serving
 * owner is inside an awaited read (the gate refuses before release); a recovery pass holding the exclusive recovery lock on one
 * connection makes the gate on another connection refuse instead of serving; the owner's own exclusive read still works. */
import test from 'node:test';import assert from 'node:assert/strict';
import pg from '../../../runtime/node_modules/pg/lib/index.js';
import {applicationFixture,binding} from './application-fixture.mjs';
import {createPostgresRetentionJournal} from '../../retention/postgres-journal.mjs';
import {createRetentionLedger,createMemoryLedgerSink} from '../../retention/ledger.mjs';
import {createSuppressionOwner,createRetentionReadGate} from '../../retention/suppression.mjs';
import {createServingGate} from '../../retention/reconciliation.mjs';
import {subjectKey,hash as require_hash} from '../../retention/boundary.mjs';
const socket=process.env.MERI_BROKER_TEST_SOCKET??'/tmp/meri-broker-pg-socket-20261014';
test('an independent PostgreSQL connection suppresses the conversation between the owner\'s read and its release: refused; a recovery pass on another connection blocks the gate',async t=>{
 const poolA=new pg.Pool({host:socket,user:'postgres',database:'postgres',max:4}),poolB=new pg.Pool({host:socket,user:'postgres',database:'postgres',max:4});t.after(async()=>{await poolA.end();await poolB.end();});
 await poolA.query('TRUNCATE meri_conversations.retention_purge_targets,meri_conversations.retention_purges,meri_conversations.retention_subjects CASCADE');
 // The retention projection references the conversation row; the conversation fixture's own store is in-process, so the trusted conversation record is seeded here.
 const projection={conversationId:binding.conversationId,owner:{tenantId:binding.tenantId,actorId:binding.actorId},scopes:[],createdAt:new Date().toISOString(),policyRevision:'p'};
 await poolA.query('INSERT INTO meri_conversations.conversations(tenant_id,conversation_id,owner_actor_id,projection,projection_sha256) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',[binding.tenantId,binding.conversationId,binding.actorId,projection,require_hash(projection)]);
 const journalA=createPostgresRetentionJournal({pool:poolA}),journalB=createPostgresRetentionJournal({pool:poolB}),serving=createServingGate(),gate=createRetentionReadGate({journal:journalA,serving});
 // The conversation fixture's store is in-process, so trusted ownership for the suppression owner is scripted; the journal rows are real.
 const ownerB=createSuppressionOwner({ledger:createRetentionLedger({sink:createMemoryLedgerSink(),now:Date.now}),journal:journalB,ownership:{async ownerOf(){return binding.actorId;}},serving:createServingGate(),now:Date.now});
 const subject={tenantId:binding.tenantId,kind:'conversation',subjectId:binding.conversationId},principal={tenantId:binding.tenantId,actorId:binding.actorId};const state={calls:0,suppressAt:null};
 const port={async assertServable(s){state.calls++;if(state.suppressAt===state.calls){state.suppressAt=null;try{await ownerB.suppress({principal,subject,reason:'from another connection'});}catch(error){state.error=error;throw error;}}return gate.assertServable(s);}};
 const f=await applicationFixture({retention:port});try{
  assert.equal((await f.post('submit')).status,200);assert.equal((await f.post('history',{})).status,200,'serving before suppression');
  const before=state.calls;state.suppressAt=before+2;const refused=await f.post('history',{});assert.equal(refused.status,502);assert.equal((await refused.json()).error.code,'CONVERSATION_UNAVAILABLE');
  assert.equal(state.error,undefined,'the independent suppression succeeded: '+(state.error?.code??''));assert.equal((await journalA.get(subjectKey(subject))).state,'SUPPRESSED','the other connection\'s suppression is what the gate read');
  assert.equal((await f.post('history',{})).status,502);await ownerB.release({principal,subject,reason:'withdrawn'});assert.equal((await f.post('history',{})).status,200);
  // Recovery holds the exclusive recovery lock on connection B: the gate over connection A cannot read (bounded by lock_timeout) and refuses; B's own exclusive read works.
  await journalB.exclusive(async()=>{await assert.rejects(gate.assertServable(subject),/RETENTION_READ_UNAVAILABLE/,'reads wait for recovery and refuse when it does not finish in time');assert.equal((await journalB.get(subjectKey(subject),{exclusive:true})).state,'RELEASED');assert.equal((await f.post('history',{})).status,502,'the serving owner refuses while recovery runs elsewhere');});
  assert.equal((await f.post('history',{})).status,200,'serving resumes after the pass');
 }finally{f.close();}
});
