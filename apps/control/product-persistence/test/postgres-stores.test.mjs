/** Proposed DDL static checks (always run) and the PostgreSQL memory journal / settings store against a real engine, ONLY when an operator
 * has applied the proposed DDL and set MERI_PRODUCT_PG_SOCKET (UNRUN otherwise; this source never creates or alters schema). The live
 * test uses unique synthetic tenant ids and deletes its own candidate and settings rows; audit rows are left (immutable by design). */
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {randomUUID} from 'node:crypto';
import {createRequire as requireFrom} from 'node:module';
import {productFailure} from '../../product-access/errors.mjs';
import {SUBMISSION_STATES,createPostgresMemoryJournal} from '../../memory/postgres-journal.mjs';
import {createPostgresSettingsStore} from '../../settings/postgres-store.mjs';
import {buildCandidate} from '../../memory/candidate.mjs';
const sqlUrl=new URL('../../../../docs/coordination/proposals/memory-settings-20261016/proposed-memory-settings.sql',import.meta.url);
test('proposed DDL declares the journal states, immutability and audit shape, and changes no data, role or grant',async()=>{
 const sql=await readFile(sqlUrl,'utf8');
 assert.match(sql,/PROPOSED DDL ONLY/u);assert.match(sql,/never executed/u);
 assert.deepEqual(/submission_state IN \(([^)]*)\)/u.exec(sql)[1].split(',').map(s=>s.trim().replace(/'/gu,'')),[...SUBMISSION_STATES]);
 for(const table of ['meri_memory.candidates','meri_settings.user_preferences','meri_settings.tenant_settings','meri_settings.settings_audit'])assert.match(sql,new RegExp(`CREATE TABLE ${table.replace('.','\\.')} `,'u'));
 assert.match(sql,/UNIQUE \(tenant_id, proposer_actor_id, idempotency_key\)/u);assert.match(sql,/memory candidates are immutable/u);
 assert.doesNotMatch(sql.replace(/--[^\n]*/gu,''),/\b(?:INSERT|DELETE|DROP|TRUNCATE|GRANT|REVOKE|CREATE ROLE|ALTER ROLE)\b/u);
});
const socket=process.env.MERI_PRODUCT_PG_SOCKET;
test('real PostgreSQL journal and settings store over the proposed tables',{skip:socket?false:'MERI_PRODUCT_PG_SOCKET is not set (UNRUN)'},async()=>{
 const {Pool}=requireFrom(new URL('../../../runtime/package.json',import.meta.url))('pg');
 const pool=new Pool({host:socket,database:process.env.MERI_PRODUCT_PG_DATABASE??'meri_product',user:process.env.MERI_PRODUCT_PG_USER??process.env.USER,max:3,connectionTimeoutMillis:5000,query_timeout:6000});
 const tenant=`synthetic-${randomUUID()}`,principal={tenantId:tenant,actorId:'actor-1'};
 try{
  const journal=createPostgresMemoryJournal({pool});
  const built=buildCandidate({principal,candidateId:randomUUID(),createdAt:new Date().toISOString(),scope:'personal',clientId:null,content:'synthetic',key:null,ttlDays:null,sources:[],origin:{kind:'surface'},idempotencyKey:randomUUID()});
  assert.equal((await journal.insert({...built,requestSha256:'a'.repeat(64)})).inserted,true);
  assert.equal((await journal.insert({...built,requestSha256:'a'.repeat(64)})).inserted,false);
  await assert.rejects(journal.insert({...built,requestSha256:'b'.repeat(64)}),e=>productFailure(e)?.code==='MEMORY_IDEMPOTENCY_CONFLICT');
  await journal.recordUnknown({tenantId:tenant,candidateId:built.candidate.candidateId});
  const reviewId=randomUUID();await journal.recordSubmission({tenantId:tenant,candidateId:built.candidate.candidateId,candidateSha256:built.candidateSha256,reviewId});
  const listed=await journal.listOwn({tenantId:tenant,proposerActorId:'actor-1',clientIds:[],clientId:null,cursor:null,limit:5});
  assert.equal(listed.length,1);assert.deepEqual(listed[0].submission,{state:'SUBMITTED',reviewId});assert.equal(listed[0].candidateSha256,built.candidateSha256);
  await assert.rejects(pool.query('UPDATE meri_memory.candidates SET candidate_sha256=$3 WHERE tenant_id=$1 AND candidate_id=$2',[tenant,built.candidate.candidateId,'0'.repeat(64)]));
  const store=createPostgresSettingsStore({pool}),audit=()=>({auditId:randomUUID(),actorId:'actor-1',platformSha256:null});
  assert.equal((await store.save({kind:'user',tenantId:tenant,actorId:'actor-1',expectedRevision:0,document:{theme:'dark'},audit:audit(1)})).revision,1);
  await assert.rejects(store.save({kind:'user',tenantId:tenant,actorId:'actor-1',expectedRevision:0,document:{theme:'light'},audit:audit(2)}),e=>productFailure(e)?.code==='SETTINGS_REVISION_CONFLICT');
  assert.deepEqual((await store.read({kind:'user',tenantId:tenant,actorId:'actor-1'})).document,{theme:'dark'});
  assert.deepEqual((await store.listAudit({tenantId:tenant,beforeSequence:null,limit:5})).map(e=>e.changedFields),[['theme']]);
 }finally{
  try{await pool.query('DELETE FROM meri_memory.candidates WHERE tenant_id=$1',[tenant]);await pool.query('DELETE FROM meri_settings.user_preferences WHERE tenant_id=$1',[tenant]);}finally{await pool.end();}
 }
});
