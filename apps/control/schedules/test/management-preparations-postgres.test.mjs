/** Explicit opt-in proof against a newly created, task-owned PG16 cluster only.
 * Run phase=prepare, restart that owned cluster externally, then phase=restarted.
 * No DATABASE_URL, inherited server, migration reset or shared database is used. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {createRoutineManagementPreparations} from '../management-preparations.mjs';
import {applicationFixture, binding, clientId, id} from './application-fixture.mjs';
const require=createRequire(new URL('../../../runtime/package.json',import.meta.url));
const configFile=process.env.MERI_SCHEDULE_MANAGEMENT_PG_CONFIG;
const phase=process.env.MERI_SCHEDULE_MANAGEMENT_PG_PHASE;
const migrations=['0001_schedule_owner.sql','0002_occurrences.sql','0003_run_cancel_proofs.sql','0004_read_consent.sql','0005_management_preparations.sql','0006_management_preparation_grants.sql'];
const versions={imageDigest:'sha256:'+'a'.repeat(64),sdk:'0.3.295',cli:'2.1.295',contracts:'0.1.0',skillsDigest:'b'.repeat(64),checkpointFormat:'0.1.0'};
const table='meri_schedules.management_preparations';
const check=()=>{};
test('owned PG16: real migration, concurrency, grants and durable management protocol', {skip:!configFile},async t=>{
 assert(['prepare','restarted'].includes(phase));assert.equal(process.env.DATABASE_URL,undefined);
 const c=JSON.parse(await readFile(configFile,'utf8'));
 assert.equal(c.marker,'wave5-m7-management-protocol-20261027');
 assert.match(c.name,/^w5-m7-management-20261027-[a-f0-9]{8}$/);assert.equal(c.network,c.name+'-net');assert.equal(c.volume,c.name+'-data');
 assert.equal(c.host,'127.0.0.1');assert(Number.isInteger(c.port)&&c.port>1024&&c.port<65536);
 assert.deepEqual(c.databases,['m7_management_fresh','m7_management_upgrade']);assert.equal(typeof c.password,'string');assert(c.password.length>=32);
 const {Client,Pool}=require('pg'),options={host:c.host,port:c.port,password:c.password,connectionTimeoutMillis:5000,query_timeout:10000};
 const admin=new Client({...options,user:'postgres',database:'postgres'});await admin.connect();
 try{
  const facts=(await admin.query("SELECT version(),current_setting('server_version_num')::integer AS number,current_setting('fsync') AS fsync,current_setting('synchronous_commit') AS sync,current_setting('full_page_writes') AS pages")).rows[0];
  assert(facts.number>=160000&&facts.number<170000);assert.deepEqual([facts.fsync,facts.sync,facts.pages],['on','on','on']);
  t.diagnostic(`${facts.version}; node=${process.version}; pg=${require('pg/package.json').version}; phase=${phase}`);
  if(phase==='prepare'){
   assert.equal((await admin.query("SELECT datname FROM pg_database WHERE datname=ANY($1)",[c.databases])).rowCount,0,'fresh task databases must not already exist');
   await admin.query('CREATE ROLE meri_product_migrator NOLOGIN');await admin.query('CREATE ROLE meri_control_runtime NOLOGIN');await admin.query('CREATE ROLE meri_schedule_worker NOLOGIN');
   for(const database of c.databases)await admin.query(`CREATE DATABASE ${database} OWNER meri_product_migrator`);
  }
 }finally{await admin.end();}
 const f=await applicationFixture();let prepared,record,key;
 try{
  const initial=await f.prepare();await f.approve(initial);
  const request={scheduleId:initial.proposal.projection.scheduleId,mode:'pause',running:'leave',runs:[],note:'Reviewed future-only local fixture'};
  prepared=await f.prepare(request,'cancel_scheduled_task','pg-management');
  record={operation:'cancel_scheduled_task',request,requestSha256:hash({operation:'cancel_scheduled_task',request}),selectedClientId:clientId,scopes:f.scopes(),versions};
  key={tenantId:binding.tenantId,actorId:binding.actorId,scopeSha256:hash({selectedClientId:clientId}),requestId:'pg-management'};
 }finally{f.close();}
 for(const [index,database] of c.databases.entries())await t.test(database,async t=>{
  const owner=new Client({...options,user:'postgres',database});await owner.connect();
  const pool=new Pool({...options,user:'postgres',database,max:10,options:'-c role=meri_control_runtime'});
  const store=createRoutineManagementPreparations({pool});
  try{
   await owner.query('SET ROLE meri_product_migrator');
   if(phase==='prepare'){
    const apply=async name=>owner.query(await readFile(new URL('../migrations/'+name,import.meta.url),'utf8'));
    for(const name of migrations.slice(0,4))await apply(name);
    const old={marker:'upgrade-fixture',unchanged:true};
    if(index===1)await owner.query('INSERT INTO meri_schedules.projections (tenant_id,schedule_id,temporal_schedule_id,owner_actor_id,generation,projection,projection_sha256) VALUES($1,$2,$3,$4,7,$5,$6)',[binding.tenantId,id(900),'local-upgrade-only',binding.actorId,old,hash(old)]);
    for(const name of migrations.slice(4))await apply(name);
    // Existing stage-one integration grants provide schema USAGE. New migration 0006 grants only this new table's columns.
    await owner.query('GRANT USAGE ON SCHEMA meri_schedules TO meri_control_runtime,meri_schedule_worker');
    if(index===1){const row=(await owner.query('SELECT generation,projection,read_consent FROM meri_schedules.projections WHERE schedule_id=$1',[id(900)])).rows[0];assert.deepEqual(row,{generation:'7',projection:old,read_consent:null});}
    await t.test('one concurrent winner; changed request and foreign claims refuse; exact replay retains identity',async()=>{
     const attempts=await Promise.all(Array.from({length:10},()=>store.claim({key,record,claimId:randomUUID()},check)));
     assert.equal(attempts.filter(x=>x.claimed).length,1);const winner=attempts.find(x=>x.claimed).row;
     assert(attempts.every(x=>x.row.claimId===winner.claimId));assert.equal(winner.state,'PENDING');
     const changed=structuredClone(record);changed.request.note='Different review';changed.requestSha256=hash({operation:changed.operation,request:changed.request});
     await assert.rejects(store.claim({key,record:changed,claimId:randomUUID()},check),e=>e.code==='ROUTINES_STALE');
     await assert.rejects(store.settle({key,claimId:randomUUID(),state:'PREPARED',outcome:prepared},check),e=>e.code==='ROUTINES_STALE');
     const settled=await store.settle({key,claimId:winner.claimId,state:'PREPARED',outcome:prepared},check);
     assert.deepEqual(await store.settle({key,claimId:winner.claimId,state:'PREPARED',outcome:prepared},check),settled);
     assert.deepEqual(await store.readProposal({tenantId:key.tenantId,actorId:key.actorId,scopeSha256:key.scopeSha256,proposalId:prepared.proposal.proposalId},check),settled);
     assert.equal(await store.readProposal({tenantId:key.tenantId,actorId:'different-actor',scopeSha256:key.scopeSha256,proposalId:prepared.proposal.proposalId},check),null);
    });
    await t.test('only existing control grants; immutable record, terminal state and deletion are fenced',async()=>{
     for(const sql of [`UPDATE ${table} SET record='{}'::jsonb`,`DELETE FROM ${table}`,`TRUNCATE ${table}`])await assert.rejects(pool.query(sql),e=>e.code==='42501');
     await assert.rejects(pool.query(`UPDATE ${table} SET state='FAILED',proposal_id=NULL,outcome='{"code":"REFUSED"}'::jsonb,settled_at=clock_timestamp()`),e=>e.code==='P0001'&&e.message==='ROUTINE_MANAGEMENT_TERMINAL');
     await assert.rejects(owner.query(`UPDATE ${table} SET record='{}'::jsonb`),e=>e.code==='P0001'&&e.message==='ROUTINE_MANAGEMENT_IMMUTABLE');
     await assert.rejects(owner.query(`DELETE FROM ${table}`),e=>e.code==='P0001'&&e.message==='ROUTINE_MANAGEMENT_FENCE_REQUIRED');
     const worker=new Client({...options,user:'postgres',database,options:'-c role=meri_schedule_worker'});await worker.connect();
     try{await assert.rejects(worker.query(`SELECT * FROM ${table}`),e=>e.code==='42501');}finally{await worker.end();}
    });
    await t.test('pending barrier, failed terminal and multi-scope result survive independent durable records',async()=>{
     const pendingKey={...key,requestId:'pending'},pending=await store.claim({key:pendingKey,record,claimId:randomUUID()},check);assert.equal(pending.row.state,'PENDING');
     const failedKey={...key,requestId:'failed'},failed=await store.claim({key:failedKey,record,claimId:randomUUID()},check);
     await store.settle({key:failedKey,claimId:failed.row.claimId,state:'FAILED',outcome:{code:'REFUSED'}},check);
     const multiKey={...key,requestId:'multi'},multi=await store.claim({key:multiKey,record,claimId:randomUUID()},check),outcome=structuredClone(prepared);
     outcome.proposal.proposalId=id(901);outcome.proposal.projection.scopes.push({...record.scopes[0],resourceId:id(902)});
     // Custody validates the canonical proposal shape; fresh scope authority is exercised by the runtime/Core owner tests.
     const settled=await store.settle({key:multiKey,claimId:multi.row.claimId,state:'PREPARED',outcome},check);assert.equal(settled.outcome.proposal.projection.scopes.length,2);
    });
   }else await t.test('committed proposals and unresolved pending barrier persist after owned PG restart',async()=>{
    const existing=await store.claim({key,record,claimId:randomUUID()},check);assert.equal(existing.claimed,false);assert.equal(existing.row.state,'PREPARED');assert.deepEqual(existing.row.outcome,prepared);
    assert.deepEqual(await store.settle({key,claimId:existing.row.claimId,state:'PREPARED',outcome:prepared},check),existing.row);
    const pending=await store.claim({key:{...key,requestId:'pending'},record,claimId:randomUUID()},check);assert.equal(pending.claimed,false);assert.equal(pending.row.state,'PENDING');
    const failed=await store.claim({key:{...key,requestId:'failed'},record,claimId:randomUUID()},check);assert.equal(failed.claimed,false);assert.equal(failed.row.state,'FAILED');
    const multi=await store.claim({key:{...key,requestId:'multi'},record,claimId:randomUUID()},check);assert.equal(multi.claimed,false);assert.equal(multi.row.outcome.proposal.projection.scopes.length,2);
    assert.equal((await owner.query(`SELECT count(*)::int AS count FROM ${table}`)).rows[0].count,4);
   });
  }finally{await pool.end();await owner.end();}
 });
});
