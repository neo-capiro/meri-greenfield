/** Opt-in real SQL proof on a newly created database inside the marked, disposable local M7 cluster. */
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createRequire} from 'node:module';import {randomBytes} from 'node:crypto';import {execFileSync} from 'node:child_process';
import {createRunIndexStore} from '../store.mjs';import {hash} from '../../boundary.mjs';import {row,principal,request,id} from './fixture.mjs';
const config=process.env.MERI_RUN_INDEX_PG_CONFIG,require=createRequire(new URL('../../../../runtime/package.json',import.meta.url));
test('owned PG16: real durable run SQL, keyset reload, scope filtering and read-only role', {skip:!config},async t=>{
 assert.equal(process.env.DATABASE_URL,undefined);const c=JSON.parse(await readFile(config,'utf8'));
 assert.equal(c.marker,'wave5-m7-management-protocol-20261027');assert.equal(c.host,'127.0.0.1');assert.match(c.name,/^w5-m7-management-20261027-[a-f0-9]{8}$/);
 const actual=JSON.parse(execFileSync('wsl.exe',['-d','Codex-Gates','--exec','docker','inspect',c.name],{encoding:'utf8',windowsHide:true}))[0];
 assert.equal(actual.Id,c.containerId);assert.equal(actual.Config.Labels['codex.owner'],c.marker);assert.equal(actual.State.Running,true);
 const {Client}=require('pg'),connection={host:c.host,port:c.port,user:'postgres',password:c.password,connectionTimeoutMillis:5000,query_timeout:10000};
 const database='m7_run_index_'+randomBytes(6).toString('hex'),marker='wave5-m7-run-index-read-proof',admin=new Client({...connection,database:'postgres'});
 assert.match(database,/^m7_run_index_[a-f0-9]{12}$/);await admin.connect();let made=false,db;
 try{
  await admin.query(`CREATE DATABASE ${database}`);made=true;await admin.query(`COMMENT ON DATABASE ${database} IS '${marker}'`);
  db=new Client({...connection,database});await db.connect();const facts=(await db.query("SELECT version(),current_setting('server_version_num')::integer AS number,current_setting('fsync') AS fsync")).rows[0];assert(facts.number>=160000&&facts.number<170000);assert.equal(facts.fsync,'on');t.diagnostic(`${facts.version}; Node${process.version}; pg${require('pg/package.json').version}; newly created owned database`);
  // Actual immutable DDL dependencies for 0021. Historical budget tables are migration input only, never a reservation owner.
  await db.query('CREATE SCHEMA meri_product_budget');
  for(const path of ['../../../../gateway/budget/migrations/0002_tenant_budgets.sql','../../../settings/migrations/0001_settings.sql','../../migrations/0001_conversations.sql','../../migrations/0021_sdk_run_usage.sql'])await db.query(await readFile(new URL(path,import.meta.url),'utf8'));
  await db.query('GRANT USAGE ON SCHEMA meri_conversations TO meri_control_runtime');await db.query('GRANT SELECT ON ALL TABLES IN SCHEMA meri_conversations TO meri_control_runtime');
  async function seed(raw){const a=raw.conversation_row,r=raw.run_row,e=raw.status_row;
   await db.query('INSERT INTO meri_conversations.conversations VALUES($1,$2,$3,$4,$5)',[a.tenant_id,a.conversation_id,a.owner_actor_id,a.projection,a.projection_sha256]);
   await db.query('INSERT INTO meri_conversations.runs(tenant_id,conversation_id,run_id,projection,projection_sha256,request_id,request,request_sha256,last_sequence,sdk_usage,sdk_usage_sha256,sdk_charge_micro_usd,sdk_usage_recorded_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',[r.tenant_id,r.conversation_id,r.run_id,r.projection,r.projection_sha256,r.request_id,r.request,r.request_sha256,r.last_sequence,r.sdk_usage,r.sdk_usage_sha256,r.sdk_usage?.chargeMicroUsd??null,r.sdk_usage===null?null:new Date()]);
   await db.query('INSERT INTO meri_conversations.events VALUES($1,$2,$3,$4,$5,$6,$7)',[e.tenant_id,e.conversation_id,e.run_id,e.sequence,e.event_id,e.event,e.event_sha256]);
  }
  await seed(row(1,{state:'failed',usage:'unavailable'}));await seed(row(2,{state:'cancelled',general:true,usage:'absent'}));await seed(row(3,{state:'running',usage:'zero'}));
  const tx=async(key,check,read)=>{await db.query('BEGIN READ ONLY');try{await db.query('SET LOCAL ROLE meri_control_runtime');const value=await read(db);await db.query('COMMIT');return value;}catch(error){await db.query('ROLLBACK');throw error;}};
  const store=createRunIndexStore({tx}),read=(q=request,p=principal)=>store.list({principal:p,request:q},()=>{});
  await t.test('all durable rows page without duplicates across a newly reconstructed reader',async()=>{
   const first=await read();assert.deepEqual(first.entries.map(v=>v.summary.runId),[id(203),id(202)]);assert(first.nextCursor);
   await seed(row(4,{at:'2026-10-27T13:00:00.000Z'}));
   const next=await createRunIndexStore({tx}).list({principal,request:{...request,cursor:first.nextCursor}},()=>{});assert.deepEqual(next.entries.map(v=>v.summary.runId),[id(201)]);assert.equal(next.nextCursor,null);
  });
  await t.test('SQL applies actor/current-client/general/state filters before pagination',async()=>{
   assert.equal((await read({...request,scope:{kind:'general'}})).entries[0].summary.runId,id(202));
   assert.deepEqual((await read({...request,status:'active'})).entries.map(v=>v.summary.runId),[id(203)]);
   assert.deepEqual((await read(request,{...principal,clientIds:[]})).entries.map(v=>v.summary.runId),[id(202)]);
   assert.equal((await read(request,{...principal,actorId:'foreign'})).entries.length,0);assert.equal((await read(request,{...principal,tenantId:'foreign'})).entries.length,0);
  });
  await t.test('database composite run identity is retained even when run UUID and time tie across conversations',async()=>{
   const tied=row(5);tied.run_row.run_id=id(201);tied.run_row.projection.binding.runId=id(201);tied.status_row.run_id=id(201);tied.status_row.event.binding.runId=id(201);tied.run_row.projection_sha256=hash(tied.run_row.projection);tied.status_row.event_sha256=hash(tied.status_row.event);await seed(tied);
   const observed=[];let cursor=null;do{const page=await read({...request,limit:1,cursor});observed.push(...page.entries.map(e=>e.summary.conversationId));cursor=page.nextCursor;}while(cursor);
   assert.deepEqual(observed,[id(104),id(103),id(102),id(105),id(101)]);assert.equal(new Set(observed).size,5);
  });
  await t.test('exact detail revalidates row integrity and mutation is denied under the read role',async()=>{
   const q={schemaVersion:'meri.run-detail/1',conversationId:id(101),runId:id(201)},detail=await store.detail({principal,request:q},()=>{});assert.equal(detail.summary.usage.recording,'unavailable');
   await assert.rejects(store.detail({principal,request:{...q,runId:id(999)}},()=>{}),/NOT_FOUND/);
   await db.query("UPDATE meri_conversations.events SET event_sha256=repeat('0',64) WHERE run_id=$1",[id(201)]);await assert.rejects(store.detail({principal,request:q},()=>{}),/CORRUPT/);
   await assert.rejects(tx(null,()=>{},db=>db.query('DELETE FROM meri_conversations.runs')),e=>e.code==='25006'||e.code==='42501');
  });
 }finally{
  if(db)await db.end();if(made){const marked=await admin.query('SELECT shobj_description(oid,\'pg_database\') AS marker FROM pg_database WHERE datname=$1',[database]);assert.equal(marked.rows[0]?.marker,marker);await admin.query(`DROP DATABASE ${database}`);t.diagnostic('Removed only this newly created marked run-index test database; prior management evidence databases retained.');}await admin.end();
 }
});
