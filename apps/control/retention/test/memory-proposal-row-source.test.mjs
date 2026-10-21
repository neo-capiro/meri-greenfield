/** Source qualification for the distinct local proposal-continuation row target.
 * Synthetic PostgreSQL transcript only: its table, exact-target table and
 * same-transaction DELETE trigger still require a centrally allocated migration. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createPostgresRetentionJournal} from '../postgres-journal.mjs';
import {hash} from '../boundary.mjs';

const tenantId='tenant-a',conversationId=randomUUID(),runId=randomUUID(),keySha256='a'.repeat(64);
const key=`${tenantId}:conversation:${conversationId}`;
const step={workflowId:'b'.repeat(64),className:'conversation',target:{className:'conversation',table:'memory_proposal_contexts',runId,keySha256}};
const planSha256='c'.repeat(64),entrySha256='d'.repeat(64);
const projection={state:'SUPPRESSED',ledgerSequence:2,entrySha256,purge:{state:'PLANNED',planSha256,ledgerSequence:3,steps:[],rowSteps:[]}};
const plan={planSha256,suppression:{ledgerSequence:2,entrySha256},rowSteps:[step],steps:[]};
function syntheticPool(){
 const queries=[];let present=true;
 const answer=(sql,args)=>{
  queries.push({sql,args});
  if(sql.startsWith('SELECT * FROM meri_conversations.retention_subjects'))return {rows:[{state:'SUPPRESSED',ledger_sequence:2,projection,projection_sha256:hash(projection)}],rowCount:1};
  if(sql.startsWith('DELETE FROM meri_conversations.memory_proposal_contexts')){present=false;return {rows:[],rowCount:1};}
  if(sql.startsWith('SELECT 1 FROM meri_conversations.memory_proposal_contexts'))return {rows:present?[{exists:1}]:[],rowCount:present?1:0};
  if(sql.startsWith('UPDATE meri_conversations.retention_subjects'))return {rows:[],rowCount:1};
  return {rows:[],rowCount:0};
 };
 const pool={retentionSourceQualificationOnly:true,async connect(){return {query:async(sql,args)=>answer(sql,args),release(){}};},async query(sql,args){return answer(sql,args);}};
 return {pool,queries};
}

test('memory continuation row source is disabled by default, then admits only the exact conversation target when explicitly qualified',async()=>{
 const f=syntheticPool(),closed=createPostgresRetentionJournal({maxRequestMs:10000,pool:f.pool});
 await assert.rejects(closed.rows.preflight(key,plan),/RETENTION_ROW_CLASS_UNSUPPORTED/);
 await assert.rejects(closed.rows.purge(key,plan),/RETENTION_ROW_CLASS_UNSUPPORTED/);
 assert.deepEqual(f.queries,[],'default production path does not acquire a lease');
 assert.throws(()=>createPostgresRetentionJournal({maxRequestMs:10000,pool:{...f.pool,retentionSourceQualificationOnly:false},memoryContinuationPurgeSourceQualified:true}),/RETENTION_CONFIGURATION/,'an unmarked pool cannot enable the source-only route');
 const qualified=createPostgresRetentionJournal({maxRequestMs:10000,pool:f.pool,memoryContinuationPurgeSourceQualified:true});
 assert.equal(await qualified.rows.preflight(key,plan),true);
 for(const target of [
  {...step.target,table:'runs'},
  {...step.target,keySha256:'bad'},
  {...step.target,runId:'bad'},
  {...step.target,extra:1},
 ])await assert.rejects(qualified.rows.preflight(key,{...plan,rowSteps:[{...step,target}]}),/RETENTION_INVALID_REQUEST/);
 await assert.rejects(qualified.rows.preflight(`${tenantId}:artifact:${conversationId}`,plan),/RETENTION_INVALID_REQUEST/);
 assert.deepEqual(f.queries,[],'all malformed requests refuse before connection');
});

test('qualified source records exact target under current plan, deletes the selected row, reads it back and projects state in the same transaction',async()=>{
 const f=syntheticPool(),journal=createPostgresRetentionJournal({maxRequestMs:10000,pool:f.pool,memoryContinuationPurgeSourceQualified:true});
 const result=await journal.rows.purge(key,plan);
 assert.deepEqual(result,[{workflowId:step.workflowId,className:step.className,target:step.target,deleted:1,state:'EXECUTED'}]);
 const recorded=f.queries.find(q=>q.sql.startsWith('INSERT INTO meri_conversations.memory_proposal_retention_targets'));
 assert.deepEqual(recorded.args,[step.workflowId,tenantId,conversationId,runId,keySha256,planSha256,3]);
 const deletion=f.queries.find(q=>q.sql.startsWith('DELETE FROM meri_conversations.memory_proposal_contexts'));
 assert.deepEqual(deletion.args,[tenantId,conversationId,runId,keySha256]);
 const order=f.queries.map(q=>q.sql.split(' ').slice(0,3).join(' '));
 assert.ok(order.indexOf('INSERT INTO meri_conversations.memory_proposal_retention_targets')<order.indexOf('DELETE FROM meri_conversations.memory_proposal_contexts'));
 assert.ok(f.queries.some(q=>q.sql.startsWith('UPDATE meri_conversations.memory_proposal_retention_targets SET state=$2')&&q.args[1]==='EXECUTED'));
 assert.equal(f.queries.at(-1).sql,'COMMIT');
 assert.equal(await journal.rows.present(key,step),false);
});

test('qualified source reprojects executed and unknown memory targets from a retention ledger projection',async()=>{
 const f=syntheticPool(),journal=createPostgresRetentionJournal({maxRequestMs:10000,pool:f.pool,memoryContinuationPurgeSourceQualified:true});
 const value={state:'SUPPRESSED',ledgerSequence:4,entrySha256:'e'.repeat(64),ownerActorId:'actor-a',suppressedAtMs:1000,
  purge:{state:'UNKNOWN',planSha256,ledgerSequence:4,steps:[],rowSteps:[{...step,state:'UNKNOWN'}]}};
 await journal.set(key,value,{expected:hash(projection)});
 assert.ok(f.queries.some(q=>q.sql.startsWith('DELETE FROM meri_conversations.memory_proposal_retention_targets WHERE tenant_id=$1')&&q.args[1]===conversationId));
 const rebuilt=f.queries.find(q=>q.sql.startsWith('INSERT INTO meri_conversations.memory_proposal_retention_targets'));
 assert.deepEqual(rebuilt.args,[step.workflowId,tenantId,conversationId,runId,keySha256,planSha256,'UNKNOWN',4]);
 assert.equal(f.queries.at(-1).sql,'COMMIT');
});

test('a stale or unrecorded plan cannot delete a memory continuation row',async()=>{
 const f=syntheticPool(),journal=createPostgresRetentionJournal({maxRequestMs:10000,pool:f.pool,memoryContinuationPurgeSourceQualified:true});
 await assert.rejects(journal.rows.purge(key,{...plan,planSha256:'0'.repeat(64)}),/RETENTION_PURGE_PLAN_MISMATCH/);
 assert.ok(f.queries.some(q=>q.sql==='ROLLBACK'));
 assert.ok(!f.queries.some(q=>q.sql.startsWith('DELETE FROM meri_conversations.memory_proposal_contexts')));
});
