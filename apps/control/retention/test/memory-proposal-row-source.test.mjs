/** Synthetic SQL transcript for the canonical memory-context purge route.
 * Actual schema, trigger and ordinary-role behavior require the separate PG gate. */
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
  if(sql.startsWith('SELECT r.* FROM meri_conversations.memory_proposal_contexts'))return {rows:present?[{tenant_id:tenantId,conversation_id:conversationId,run_id:runId,key_sha256:keySha256}]:[],rowCount:present?1:0};
  if(sql.startsWith('UPDATE meri_conversations.retention_subjects'))return {rows:[],rowCount:1};
  return {rows:[],rowCount:0};
 };
 const pool={async connect(){return {query:async(sql,args)=>answer(sql,args),release(){}};},async query(sql,args){return answer(sql,args);}};
 return {pool,queries};
}

test('canonical memory continuation routing rejects malformed and foreign-subject targets before SQL',async()=>{
 const f=syntheticPool(),qualified=createPostgresRetentionJournal({pool:f.pool});
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
 const f=syntheticPool(),journal=createPostgresRetentionJournal({pool:f.pool});
 const result=await journal.rows.purge(key,plan);
 assert.deepEqual(result,[{workflowId:step.workflowId,className:step.className,target:step.target,deleted:1,state:'EXECUTED'}]);
 const recorded=f.queries.find(q=>q.sql.startsWith('INSERT INTO meri_conversations.retention_purge_targets'));
 assert.deepEqual(recorded.args,[step.workflowId,tenantId,conversationId,'conversation',JSON.stringify({table:'meri_conversations.memory_proposal_contexts',key:{run_id:runId,key_sha256:keySha256},rowSha256:null,mode:'delete'}),planSha256,3]);
 const deletion=f.queries.find(q=>q.sql.startsWith('DELETE FROM meri_conversations.memory_proposal_contexts'));
 assert.deepEqual(deletion.args,[tenantId,conversationId,runId,keySha256]);
 const order=f.queries.map(q=>q.sql.split(' ').slice(0,3).join(' '));
 assert.ok(order.indexOf('INSERT INTO meri_conversations.retention_purge_targets')<order.indexOf('DELETE FROM meri_conversations.memory_proposal_contexts'));
 assert.ok(f.queries.some(q=>q.sql.startsWith('UPDATE meri_conversations.retention_purge_targets SET state=$2')&&q.args[1]==='EXECUTED'));
 assert.equal(f.queries.at(-1).sql,'COMMIT');
 assert.equal(await journal.rows.present(key,step),false);
});

test('qualified source reprojects executed and unknown memory targets from a retention ledger projection',async()=>{
 const f=syntheticPool(),journal=createPostgresRetentionJournal({pool:f.pool});
 const value={state:'SUPPRESSED',ledgerSequence:4,entrySha256:'e'.repeat(64),ownerActorId:'actor-a',suppressedAtMs:1000,
  purge:{state:'UNKNOWN',planSha256,ledgerSequence:4,steps:[],rowSteps:[{...step,state:'UNKNOWN'}]}};
 await journal.set(key,value,{expected:hash(projection)});
 assert.ok(f.queries.some(q=>q.sql.startsWith('DELETE FROM meri_conversations.retention_purge_targets WHERE tenant_id=$1')&&q.args[1]===conversationId));
 const rebuilt=f.queries.find(q=>q.sql.startsWith('INSERT INTO meri_conversations.retention_purge_targets'));
 assert.deepEqual(rebuilt.args,[step.workflowId,tenantId,conversationId,'conversation',JSON.stringify({table:'meri_conversations.memory_proposal_contexts',key:{run_id:runId,key_sha256:keySha256},rowSha256:null,mode:'delete'}),planSha256,'UNKNOWN',4]);
 assert.equal(f.queries.at(-1).sql,'COMMIT');
});

test('a stale or unrecorded plan cannot delete a memory continuation row',async()=>{
 const f=syntheticPool(),journal=createPostgresRetentionJournal({pool:f.pool});
 await assert.rejects(journal.rows.purge(key,{...plan,planSha256:'0'.repeat(64)}),/RETENTION_PURGE_PLAN_MISMATCH/);
 assert.ok(f.queries.some(q=>q.sql==='ROLLBACK'));
 assert.ok(!f.queries.some(q=>q.sql.startsWith('DELETE FROM meri_conversations.memory_proposal_contexts')));
});
