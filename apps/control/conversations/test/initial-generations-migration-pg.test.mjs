/** Native 0020 qualification (O117) on the local-baseline PostgreSQL 16 Unix-socket cluster only: each case creates and drops its
 * own disposable database, applies 0001..0017 exactly, populates 0016/0017, then applies 0020 and times its transaction (the
 * ACCESS EXCLUSIVE window of the primary-key swaps). Never a deployed database. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import pg from 'pg';
import {createInitialRunBindingJournal} from '../initial-run-binding-journal.mjs';
import {versions} from './store-fixture.mjs';

const migrations=new URL('../migrations/',import.meta.url);
const manifest=['0001_conversations.sql','0002_lifecycle.sql','0003_selected_outputs.sql','0004_sdk_sessions.sql','0005_selected_reads.sql',
 '0006_native_executions.sql','0007_native_preparation.sql','0008_native_prepared_launch.sql','0009_next_runs.sql','0010_retention.sql',
 '0011_run_issuance.sql','0013_retention_recovery_watermark.sql','0015_model_run_issuance.sql','0016_initial_inputs.sql','0017_initial_run_bindings.sql'];
const check=()=>{};
const record=(at)=>({clientId:randomUUID(),policyRevision:'policy1',versions,configurationSha256:'c'.repeat(64),createdAtMs:at,expiresAtMs:at+60000});

async function database(t){
 const host=process.env.MERI_INSPECTION_TEST_SOCKET,control=process.env.MERI_INSPECTION_TEST_DATABASE;
 if(host!=='/tmp/meri-prepared-kickoff-pg-20261014/socket'||control!=='meri_inspection_final')throw Error('NEW_OWNED_GENERATIONS_DATABASE_REQUIRED');
 const admin=new pg.Client({host,database:control,user:'postgres'});await admin.connect();
 assert.equal((await admin.query("SELECT current_setting('listen_addresses') AS listen")).rows[0].listen,'','Unix socket only');
 const name='meri_c12_'+randomUUID().replaceAll('-','');await admin.query(`CREATE DATABASE ${name}`);
 const pools=[];t.after(async()=>{for(const p of pools)await p.end().catch(()=>{});await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);await admin.end();});
 const pool=()=>{const p=new pg.Pool({host,database:name,user:'postgres',max:4});pools.push(p);return p;};
 const main=pool();for(const file of manifest)await main.query(await readFile(new URL(file,migrations),'utf8'));
 return {pool,main};
}
/** `rows` conversations with a generation-1 original (0017 shape); every other one also has a RESERVED original input (0016 shape). */
async function populate(main,rows){
 const r=record(Date.now());
 await main.query(`INSERT INTO meri_conversations.initial_run_bindings(tenant_id,conversation_id,run_id,record,record_sha256)
  SELECT 'tenant-pop',c,r,jsonb_build_object('schemaVersion',1,'state','ADMITTED',
   'binding',jsonb_build_object('tenantId','tenant-pop','actorId','actor-pop','conversationId',c::text,'runId',r::text,'attemptId',gen_random_uuid()::text,'workerId',gen_random_uuid()::text,'writerFence',1),
   'selectedClientId',$1::text,'policyRevision',$2::text,'versions',$3::jsonb,'configurationSha256',$4::text,'createdAtMs',$5::bigint,'expiresAtMs',$6::bigint),repeat('0',64)
  FROM (SELECT gen_random_uuid() AS c,gen_random_uuid() AS r FROM generate_series(1,$7)) s`,[r.clientId,r.policyRevision,JSON.stringify(versions),r.configurationSha256,r.createdAtMs,r.expiresAtMs,rows]);
 await main.query(`INSERT INTO meri_conversations.initial_inputs(tenant_id,conversation_id,run_id,request_id,allocation,allocation_sha256,state,accepted_request_sha256)
  SELECT b.tenant_id,b.conversation_id,b.run_id,q,jsonb_build_object('binding',b.record->'binding','scopes','[]'::jsonb,'versions',$1::jsonb,'selectedClientId',b.record->>'selectedClientId',
   'requestId',q::text,'inputSha256',repeat('a',64),'requestSha256',repeat('b',64),'allocatedAtMs',1,'expiresAtMs',2),repeat('0',64),'RESERVED',NULL
  FROM (SELECT *,gen_random_uuid() AS q,row_number() OVER () AS n FROM meri_conversations.initial_run_bindings) b WHERE b.n%2=0`,[JSON.stringify(versions)]);
 return (await main.query('SELECT (SELECT count(*) FROM meri_conversations.initial_run_bindings)::int AS bindings,(SELECT count(*) FROM meri_conversations.initial_inputs)::int AS inputs')).rows[0];
}
async function migrate(main){const sql=await readFile(new URL('0020_initial_generations.sql',migrations),'utf8'),started=performance.now();await main.query(sql);return Math.round(performance.now()-started);}

for(const rows of [1000,100000])test(`0020 applies up on populated 0016/0017 tables (${rows} originals): rows kept as generation 1, triggers intact`,async t=>{
 const {main}=await database(t),before=await populate(main,rows),ms=await migrate(main);
 t.diagnostic(`0020 transaction (PK swaps, ACCESS EXCLUSIVE) on ${before.bindings} bindings + ${before.inputs} inputs: ${ms} ms`);
 const after=(await main.query('SELECT count(*)::int AS n,min(generation) AS lo,max(generation) AS hi FROM meri_conversations.initial_run_bindings')).rows[0];
 assert.deepEqual(after,{n:before.bindings,lo:1,hi:1});assert.equal((await main.query('SELECT count(*)::int AS n FROM meri_conversations.initial_inputs')).rows[0].n,before.inputs);
 const keys=(await main.query(`SELECT conrelid::regclass::text AS t,contype,pg_get_constraintdef(oid) AS d FROM pg_constraint WHERE conrelid IN ('meri_conversations.initial_run_bindings'::regclass,'meri_conversations.initial_inputs'::regclass) AND contype IN ('p','u') ORDER BY 1,2,3`)).rows;
 assert.deepEqual(keys.map(k=>`${k.t} ${k.contype} ${k.d}`),[
  'meri_conversations.initial_inputs p PRIMARY KEY (tenant_id, conversation_id, run_id)','meri_conversations.initial_inputs u UNIQUE (tenant_id, run_id, request_id)',
  'meri_conversations.initial_run_bindings p PRIMARY KEY (tenant_id, conversation_id, generation)','meri_conversations.initial_run_bindings u UNIQUE (tenant_id, run_id)']);
 for(const sql of ["UPDATE meri_conversations.initial_run_bindings SET record_sha256=repeat('1',64) WHERE tenant_id='tenant-pop'","DELETE FROM meri_conversations.initial_run_bindings WHERE tenant_id='tenant-pop'"])
  await assert.rejects(main.query(sql),/INITIAL_RUN_BINDING_IMMUTABLE/,sql);
 await assert.rejects(main.query("DELETE FROM meri_conversations.initial_inputs WHERE tenant_id='tenant-pop'"),/INITIAL_INPUT_IMMUTABLE/);
 await assert.rejects(main.query("UPDATE meri_conversations.initial_inputs SET run_id=gen_random_uuid() WHERE tenant_id='tenant-pop'"),/INITIAL_INPUT_IMMUTABLE/);
});

test('after 0020: concurrent rebinds on two connections create exactly one generation; earlier code still claims generation 1',async t=>{
 const {pool,main}=await database(t);await populate(main,10);await migrate(main);
 const principal={tenantId:'tenant-'+randomUUID(),actorId:'actor-a'},conversationId=randomUUID(),selectedClientId=randomUUID();
 const proposal={principal,conversationId,selectedClientId,policyRevision:'policy1',versions,configurationSha256:'c'.repeat(64),proposedExpiresAtMs:Date.now()+60000};
 const first=await createInitialRunBindingJournal({pool:pool()}).claim(proposal,check);assert.equal(first.created,true);
 const release={...proposal,configurationSha256:'d'.repeat(64),versions:{...versions,imageDigest:'sha256:'+'f'.repeat(64)}};
 const [a,b]=await Promise.all([createInitialRunBindingJournal({pool:pool()}).rebind(release,check),createInitialRunBindingJournal({pool:pool()}).rebind(release,check)]);
 assert.deepEqual(a.record,b.record);assert.deepEqual([a.created,b.created].sort(),[false,true]);assert.notEqual(a.record.binding.runId,first.record.binding.runId);
 const rows=(await main.query('SELECT generation,run_id FROM meri_conversations.initial_run_bindings WHERE tenant_id=$1 ORDER BY generation',[principal.tenantId])).rows;
 assert.deepEqual(rows.map(r=>[r.generation,r.run_id]),[[1,first.record.binding.runId],[2,a.record.binding.runId]]);
 const journal=createInitialRunBindingJournal({pool:pool()});
 assert.deepEqual(await journal.readConversation({principal,conversationId,selectedClientId},check),a.record,'only the latest generation is served');
 await assert.rejects(journal.read({binding:first.record.binding},check),{code:'INITIAL_RUN_BINDING_CONFLICT'});
 // One input per original run: the same client request id may reach the new run, never twice the same run.
 const input=(binding,requestId)=>main.query(`INSERT INTO meri_conversations.initial_inputs(tenant_id,conversation_id,run_id,request_id,allocation,allocation_sha256,state,accepted_request_sha256)
  VALUES($1,$2,$3,$4,jsonb_build_object('binding',$5::jsonb,'scopes','[]'::jsonb,'versions',$6::jsonb,'selectedClientId',$7::text,'requestId',$4::text,'inputSha256',repeat('a',64),'requestSha256',repeat('b',64),'allocatedAtMs',1,'expiresAtMs',2),repeat('0',64),'RESERVED',NULL)`,
  [binding.tenantId,binding.conversationId,binding.runId,requestId,JSON.stringify(binding),JSON.stringify(versions),selectedClientId]);
 const requestId=randomUUID();await input(first.record.binding,requestId);await input(a.record.binding,requestId);
 await assert.rejects(input(a.record.binding,randomUUID()),{code:'23505'},'one original input per run');
 // Earlier code inserts without the column: the default keeps a first claim working (generation 1).
 const other=randomUUID(),runId=randomUUID(),earlier={...first.record,binding:{...first.record.binding,conversationId:other,runId}};
 await main.query('INSERT INTO meri_conversations.initial_run_bindings(tenant_id,conversation_id,run_id,record,record_sha256) VALUES($1,$2,$3,$4,$5)',[principal.tenantId,other,runId,earlier,'0'.repeat(64)]);
 assert.equal((await main.query('SELECT generation FROM meri_conversations.initial_run_bindings WHERE conversation_id=$1',[other])).rows[0].generation,1);
 await assert.rejects(main.query('INSERT INTO meri_conversations.initial_run_bindings(tenant_id,conversation_id,run_id,record,record_sha256,generation) VALUES($1,$2,$3,$4,$5,1)',[principal.tenantId,other,randomUUID(),earlier,'0'.repeat(64)]),{code:'23505'},'one row per generation');
});
