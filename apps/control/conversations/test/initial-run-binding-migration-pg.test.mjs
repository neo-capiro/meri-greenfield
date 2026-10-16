/** Native 0017 qualification only. Run against a separately attested,
 * disposable PostgreSQL 16 Unix-socket cluster, never a deployed database. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {execFile as execFileCallback} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,readFile,readdir,rm,rmdir} from 'node:fs/promises';
import {join,posix} from 'node:path';
import pg from 'pg';
import {createInitialRunBindingJournal} from '../initial-run-binding-journal.mjs';
import {hash} from '../boundary.mjs';
import {versions} from './store-fixture.mjs';

const execFile=promisify(execFileCallback);
const migrations=new URL('../migrations/',import.meta.url);
const manifest=[
 '0001_conversations.sql','0002_lifecycle.sql','0003_selected_outputs.sql',
 '0004_sdk_sessions.sql','0005_selected_reads.sql','0006_native_executions.sql',
 '0007_native_preparation.sql','0008_native_prepared_launch.sql',
 '0009_next_runs.sql','0010_retention.sql','0011_run_issuance.sql',
 '0013_retention_recovery_watermark.sql','0015_model_run_issuance.sql',
 '0016_initial_inputs.sql','0017_initial_run_bindings.sql'
];
const quoted=name=>{assert.match(name,/^[a-z_][a-z_0-9]*$/u);return `"${name}"`;};
const check=()=>{};
function deferred(){let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};}
async function boundedWait(promise,ms,message){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(message)),ms);})]);}finally{clearTimeout(timer);}}

function configuration(env){
 const host=env.MERI_INSPECTION_TEST_SOCKET,controlDatabase=env.MERI_INSPECTION_TEST_DATABASE;
 const dataDirectory=env.MERI_INITIAL_RUN_MIGRATION_TEST_DATA_DIRECTORY;
 const port=Number(env.MERI_INITIAL_RUN_MIGRATION_TEST_PORT);
 if(host!=='/tmp/meri-prepared-kickoff-pg-20261014/socket'||controlDatabase!=='meri_inspection_final'||env.MERI_INITIAL_RUN_MIGRATION_TEST_ISOLATED!=='1')throw Error('EXPLICIT_ISOLATED_LOCAL_POSTGRES_REQUIRED');
 if(typeof dataDirectory!=='string'||!posix.isAbsolute(dataDirectory)||dataDirectory==='/'||dataDirectory.endsWith('/')||posix.normalize(dataDirectory)!==dataDirectory||/[\x00-\x1f\x7f]/u.test(dataDirectory)||dataDirectory.length>4096)throw Error('EXPLICIT_VALIDATOR_DATA_DIRECTORY_REQUIRED');
 if(!Number.isInteger(port)||port<1024||port>65535)throw Error('EXPLICIT_PRIVATE_POSTGRES_PORT_REQUIRED');
 return {host,controlDatabase,dataDirectory,port};
}
function privateServer(row,config){
 if(!row||!/^16[0-9]{4}$/u.test(row.version_num)||row.listen_addresses!==''||row.data_directory!==config.dataDirectory||Number(row.port)!==config.port)throw Error('PRIVATE_POSTGRES_SERVER_PREFLIGHT_REFUSED');
}
async function files(){
 const names=await readdir(migrations);
 assert.deepEqual(names.filter(name=>/^00(?:0[1-9]|1[0-7])_[a-z_]+[.]sql$/u.test(name)).sort(),manifest,'the through-0017 deploy predecessor graph must match the reviewed manifest');
 assert.deepEqual(manifest.map(name=>name.slice(0,4)),['0001','0002','0003','0004','0005','0006','0007','0008','0009','0010','0011','0013','0015','0016','0017']);
 return Promise.all(manifest.map(name=>readFile(new URL(name,migrations),'utf8')));
}
async function fixture(t,{preexisting=false,probeAbsent=false}={}){
 const config=configuration(process.env),sql=await files();
 const connection={host:config.host,port:config.port,user:'postgres',connectionTimeoutMillis:3000,options:'-c statement_timeout=5000'};
 const admin=new pg.Client({...connection,database:config.controlDatabase});
 const databases=[],pools=[],clients=[],roles=[];
 t.after(async()=>{
  await Promise.allSettled(pools.map(p=>p.end()));
  await Promise.allSettled(clients.map(c=>c.end()));
  try{
   const uncertain=[];
   for(const entry of databases.reverse()){
    const {name}=entry;
    if(entry.oid===null){uncertain.push(name);continue;}
    const row=(await admin.query('SELECT oid::text FROM pg_database WHERE datname=$1',[name])).rows;
    assert.equal(row.length,1,'a fixture-created database must still exist for guarded cleanup');
    assert.equal(row[0].oid,entry.oid,'drop only this fixture-owned database');
    await admin.query(`DROP DATABASE ${quoted(name)}`);
   }
   if(uncertain.length)throw Error(`DATABASE_OWNERSHIP_UNCERTAIN_MANUAL_RECONCILIATION: ${uncertain.join(',')}`);
   for(const role of roles)await admin.query(`DROP ROLE ${quoted(role)}`);
  }finally{await admin.end();}
 });
 await admin.connect();
 const metadata=(await admin.query("SELECT current_setting('server_version_num') AS version_num,current_setting('listen_addresses') AS listen_addresses,current_setting('data_directory') AS data_directory,current_setting('port') AS port")).rows[0];
 privateServer(metadata,config);
 async function database(prefix){
  const name=prefix+'_'+randomUUID().replaceAll('-','');quoted(name);
  assert.notEqual(name,config.controlDatabase);
  assert.equal((await admin.query('SELECT oid::text FROM pg_database WHERE datname=$1',[name])).rows.length,0,'random database name must be unused before CREATE');
  await admin.query(`CREATE DATABASE ${quoted(name)} TEMPLATE template0`);
  const entry={name,oid:null};databases.push(entry);
  const oid=(await admin.query('SELECT oid::text FROM pg_database WHERE datname=$1',[name])).rows[0]?.oid;
  assert.ok(oid);entry.oid=oid;return name;
 }
 const name=await database('meri_initial_0017');
 async function connect(databaseName=name){const c=new pg.Client({...connection,database:databaseName});try{await c.connect();clients.push(c);return c;}catch(error){await c.end().catch(()=>{});throw error;}}
 const client=await connect();
 for(let i=0;i<manifest.length-1;i++)await client.query(sql[i]);
 assert.equal((await client.query("SELECT to_regclass('meri_conversations.initial_run_bindings') AS relation")).rows[0].relation,null,'0017 must not exist before application');
 const before=preexisting?await seedAccepted(client):null;
 const original=preexisting?await snapshotExisting(client,before.binding):null;
 if(probeAbsent){
  const prePool=new pg.Pool({...connection,database:name,max:1});pools.push(prePool);
  const raw={principal:{tenantId:'absent-'+randomUUID(),actorId:'synthetic-actor'},conversationId:randomUUID(),selectedClientId:randomUUID(),policyRevision:'synthetic-policy',versions,configurationSha256:'c'.repeat(64),proposedExpiresAtMs:1800000060000};
  await assert.rejects(createInitialRunBindingJournal({pool:prePool,now:()=>1800000000000}).claim(raw,check),{code:'INITIAL_RUN_BINDING_STORE_UNAVAILABLE'});
  assert.equal((await client.query("SELECT to_regclass('meri_conversations.initial_run_bindings') AS relation")).rows[0].relation,null);
 }
 await client.query(sql.at(-1));
 if(preexisting)assert.deepEqual(await snapshotExisting(client,before.binding),original,'0017 must preserve existing rows and hashes');
 const catalog=(await client.query("SELECT relname FROM pg_class WHERE oid='meri_conversations.initial_run_bindings'::regclass")).rows;
 assert.deepEqual(catalog,[{relname:'initial_run_bindings'}]);
 const pool=new pg.Pool({...connection,database:name,max:4});pools.push(pool);
 const tenantId='initial-0017-'+randomUUID(),conversationId=randomUUID();
 const input={principal:{tenantId,actorId:'synthetic-actor'},conversationId,selectedClientId:randomUUID(),policyRevision:'synthetic-policy',versions,configurationSha256:'c'.repeat(64),proposedExpiresAtMs:1800000060000};
 let clock=1800000000000;
 const journal=(ownedPool=pool)=>createInitialRunBindingJournal({pool:ownedPool,now:()=>clock});
 async function row(){return (await client.query('SELECT * FROM meri_conversations.initial_run_bindings WHERE tenant_id=$1 AND conversation_id=$2',[tenantId,conversationId])).rows[0]??null;}
 return {admin,client,pool,connect,database,name,config,connection,pools,roles,input,journal,row,before,clock:()=>clock,advance:ms=>{clock+=ms;}};
}

async function seedAccepted(client,binding={tenantId:'prior-'+randomUUID(),actorId:'synthetic-actor',conversationId:randomUUID(),runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:1},options={}){
 const policyRevision=options.policyRevision??'synthetic-policy',selectedClientId=options.selectedClientId??randomUUID();
 const scopes=[{tenantId:binding.tenantId,kind:'client',resourceId:selectedClientId,policyRevision}];
 const createdAt='2026-10-16T12:00:00.000Z';
 const conversation={conversationId:binding.conversationId,owner:{tenantId:binding.tenantId,actorId:binding.actorId},scopes,policyRevision,createdAt};
 const run={binding,state:'queued',scopes,policyRevision,createdAt,versions};
 const request={requestId:randomUUID(),prompt:'synthetic retained original',skill:null,window:null,windowRequest:null};
 const allocation={binding,scopes,versions,selectedClientId,requestId:request.requestId,inputSha256:'a'.repeat(64),requestSha256:hash(request),allocatedAtMs:options.createdAtMs??1800000000000,expiresAtMs:options.expiresAtMs??1800000060000};
 const target={...binding,runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:2};
 const reservation={source:binding,target};
 await client.query('INSERT INTO meri_conversations.conversations(tenant_id,conversation_id,owner_actor_id,projection,projection_sha256) VALUES($1,$2,$3,$4,$5)',[binding.tenantId,binding.conversationId,binding.actorId,conversation,hash(conversation)]);
 await client.query('INSERT INTO meri_conversations.runs(tenant_id,conversation_id,run_id,projection,projection_sha256,request_id,request,request_sha256,last_sequence) VALUES($1,$2,$3,$4,$5,$6,$7,$8,0)',[binding.tenantId,binding.conversationId,binding.runId,run,hash(run),request.requestId,request,hash(request)]);
 await client.query("INSERT INTO meri_conversations.initial_inputs(tenant_id,conversation_id,run_id,request_id,allocation,allocation_sha256,state,accepted_request_sha256) VALUES($1,$2,$3,$4,$5,$6,'ACCEPTED',$7)",[binding.tenantId,binding.conversationId,binding.runId,request.requestId,allocation,hash(allocation),allocation.requestSha256]);
 await client.query("INSERT INTO meri_conversations.next_runs(tenant_id,conversation_id,source_run_id,target_run_id,reservation,reservation_sha256,state) VALUES($1,$2,$3,$4,$5,$6,'RESERVED')",[binding.tenantId,binding.conversationId,binding.runId,target.runId,reservation,hash(reservation)]);
 return {binding,conversation,run,request,allocation,reservation};
}
async function snapshotExisting(client,b){
 const key=[b.tenantId,b.conversationId];
 return {
  conversation:(await client.query('SELECT projection,projection_sha256 FROM meri_conversations.conversations WHERE tenant_id=$1 AND conversation_id=$2',key)).rows,
  run:(await client.query('SELECT projection,projection_sha256,request,request_sha256,last_sequence::text,sequence_base::text,sequence_end::text FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2',key)).rows,
  input:(await client.query('SELECT allocation,allocation_sha256,state,accepted_request_sha256 FROM meri_conversations.initial_inputs WHERE tenant_id=$1 AND conversation_id=$2',key)).rows,
  next:(await client.query('SELECT reservation,reservation_sha256,state FROM meri_conversations.next_runs WHERE tenant_id=$1 AND conversation_id=$2',key)).rows
 };
}
async function grantAppRole(f){
 const role='meri_0017_'+randomUUID().replaceAll('-','');quoted(role);
 await f.admin.query(`CREATE ROLE ${quoted(role)} NOLOGIN`);f.roles.push(role);
 const sql=[
  `GRANT USAGE ON SCHEMA meri_conversations TO ${quoted(role)}`,
  `GRANT SELECT,INSERT ON meri_conversations.initial_run_bindings TO ${quoted(role)}`,
  `GRANT UPDATE(record_sha256) ON meri_conversations.initial_run_bindings TO ${quoted(role)}`,
  `GRANT SELECT,UPDATE(sequence_base) ON meri_conversations.runs TO ${quoted(role)}`,
  `GRANT SELECT,UPDATE(allocation_sha256) ON meri_conversations.initial_inputs TO ${quoted(role)}`,
  `GRANT SELECT,UPDATE(reservation_sha256) ON meri_conversations.next_runs TO ${quoted(role)}`
 ];
 for(const query of sql)await f.client.query(query);
 const pool=new pg.Pool({...f.connection,database:f.name,max:4});f.pools.push(pool);
 const appPool={async connect(){const client=await pool.connect();try{await client.query(`SET ROLE ${quoted(role)}`);return client;}catch(error){client.release(error);throw error;}}};
 return {role,appPool};
}

test('0017 fixture refuses unapproved servers before database creation',()=>{
 const env={MERI_INSPECTION_TEST_SOCKET:'/tmp/meri-prepared-kickoff-pg-20261014/socket',MERI_INSPECTION_TEST_DATABASE:'meri_inspection_final',MERI_INITIAL_RUN_MIGRATION_TEST_ISOLATED:'1',MERI_INITIAL_RUN_MIGRATION_TEST_DATA_DIRECTORY:'/tmp/validator-owned-0017/data',MERI_INITIAL_RUN_MIGRATION_TEST_PORT:'55432'};
 const config=configuration(env);assert.doesNotThrow(()=>privateServer({version_num:'160015',listen_addresses:'',data_directory:config.dataDirectory,port:'55432'},config));
 for(const change of [{MERI_INITIAL_RUN_MIGRATION_TEST_ISOLATED:'0'},{MERI_INITIAL_RUN_MIGRATION_TEST_DATA_DIRECTORY:'/'},{MERI_INITIAL_RUN_MIGRATION_TEST_DATA_DIRECTORY:'/tmp/../tmp/data'},{MERI_INITIAL_RUN_MIGRATION_TEST_PORT:'0'},{MERI_INSPECTION_TEST_SOCKET:'localhost'}])assert.throws(()=>configuration({...env,...change}));
 for(const change of [{version_num:'150015'},{listen_addresses:'localhost'},{data_directory:'/tmp/other/data'},{port:'5432'}])assert.throws(()=>privateServer({version_num:'160015',listen_addresses:'',data_directory:config.dataDirectory,port:'55432',...change},config));
});

test('0017 applies after exact predecessors and preserves older accepted rows',async t=>{
 const f=await fixture(t,{preexisting:true,probeAbsent:true});
 const triggers=(await f.client.query("SELECT tgname FROM pg_trigger WHERE tgrelid='meri_conversations.initial_run_bindings'::regclass AND NOT tgisinternal ORDER BY tgname")).rows.map(r=>r.tgname);
 assert.deepEqual(triggers,['immutable_initial_run_binding','immutable_initial_run_binding_truncate']);
 const constraints=(await f.client.query("SELECT contype FROM pg_constraint WHERE conrelid='meri_conversations.initial_run_bindings'::regclass")).rows.map(r=>r.contype);
 assert.ok(constraints.includes('p'));assert.ok(constraints.includes('u'));assert.ok(constraints.includes('c'));
 const preserved=await snapshotExisting(f.client,f.before.binding);
 assert.equal(preserved.conversation[0].projection_sha256,hash(preserved.conversation[0].projection));
 assert.equal(preserved.run[0].projection_sha256,hash(preserved.run[0].projection));
 assert.equal(preserved.input[0].allocation_sha256,hash(preserved.input[0].allocation));
 assert.equal(preserved.next[0].reservation_sha256,hash(preserved.next[0].reservation));
 const first=await f.journal().claim(f.input,check),saved=await f.row();assert.equal(first.created,true);assert.deepEqual(saved.record,first.record);assert.equal(saved.record_sha256,hash(first.record));
});

test('0017 rejects every missing key, wrong JSON type, unsafe time, identity mismatch, and duplicate key',async t=>{
 const f=await fixture(t),baseline=await f.journal().claim(f.input,check);
 const mutations=[];
 for(const key of ['schemaVersion','state','binding','selectedClientId','policyRevision','versions','configurationSha256','createdAtMs','expiresAtMs'])mutations.push([`missing ${key}`,r=>{delete r[key];}]);
 for(const key of ['tenantId','actorId','conversationId','runId','attemptId','workerId','writerFence'])mutations.push([`missing binding ${key}`,r=>{delete r.binding[key];}]);
 for(const key of ['imageDigest','sdk','cli','contracts','skillsDigest','checkpointFormat'])mutations.push([`missing versions ${key}`,r=>{delete r.versions[key];}]);
 mutations.push(
  ['extra top-level',r=>{r.extra=true;}],['extra binding',r=>{r.binding.extra=true;}],['extra versions',r=>{r.versions.extra=true;}],
  ['null state',r=>{r.state=null;}],['array binding',r=>{r.binding=[];}],['array versions',r=>{r.versions=[];}],
  ['string schema',r=>{r.schemaVersion='1';}],['string fence',r=>{r.binding.writerFence='1';}],['fractional fence',r=>{r.binding.writerFence=1.5;}],
  ['string time',r=>{r.createdAtMs='1800000000000';}],['fractional time',r=>{r.createdAtMs=1800000000000.5;}],
  ['negative time',r=>{r.createdAtMs=-1;}],['unsafe time',r=>{r.expiresAtMs=9007199254740992;}],
  ['reversed time',r=>{r.expiresAtMs=r.createdAtMs;}],['bad client UUID',r=>{r.selectedClientId='not-a-uuid';}],
  ['bad configuration hash',r=>{r.configurationSha256='x'.repeat(64);}],['bad image digest',r=>{r.versions.imageDigest='sha256:bad';}],
  ['bad actor type',r=>{r.binding.actorId=3;}],['bad run echo',r=>{r.binding.runId=randomUUID();}]
 );
 for(const [name,mutate] of mutations){
  const r=structuredClone(baseline.record);r.binding.conversationId=randomUUID();r.binding.runId=randomUUID();r.binding.attemptId=randomUUID();r.binding.workerId=randomUUID();
  const columns=[r.binding.tenantId,r.binding.conversationId,r.binding.runId];mutate(r);
  const before=(await f.client.query('SELECT count(*)::int AS n FROM meri_conversations.initial_run_bindings')).rows[0].n;
  await assert.rejects(f.client.query('INSERT INTO meri_conversations.initial_run_bindings(tenant_id,conversation_id,run_id,record,record_sha256) VALUES($1,$2,$3,$4,$5)',[...columns,r,hash(r)]),{code:'23514'},name);
  assert.equal((await f.client.query('SELECT count(*)::int AS n FROM meri_conversations.initial_run_bindings')).rows[0].n,before,name);
 }
 const original=baseline.record;
 await assert.rejects(f.client.query('INSERT INTO meri_conversations.initial_run_bindings(tenant_id,conversation_id,run_id,record,record_sha256) VALUES($1,$2,$3,$4,$5)',[original.binding.tenantId,original.binding.conversationId,original.binding.runId,original,hash(original)]),{code:'23505'});
 const other={...original,binding:{...original.binding,conversationId:randomUUID()}};
 await assert.rejects(f.client.query('INSERT INTO meri_conversations.initial_run_bindings(tenant_id,conversation_id,run_id,record,record_sha256) VALUES($1,$2,$3,$4,$5)',[other.binding.tenantId,other.binding.conversationId,other.binding.runId,other,hash(other)]),{code:'23505'});
 const badDigest={...original,binding:{...original.binding,conversationId:randomUUID(),runId:randomUUID()}};
 await assert.rejects(f.client.query('INSERT INTO meri_conversations.initial_run_bindings(tenant_id,conversation_id,run_id,record,record_sha256) VALUES($1,$2,$3,$4,$5)',[badDigest.binding.tenantId,badDigest.binding.conversationId,badDigest.binding.runId,badDigest,'not-a-digest']),{code:'23514'});
 assert.equal((await f.client.query('SELECT count(*)::int AS n FROM meri_conversations.initial_run_bindings')).rows[0].n,1);
});

test('0017 syntactically valid but false stored SHA is rejected by the journal',async t=>{
 const f=await fixture(t),first=await f.journal().claim(f.input,check);
 const wrong={...first.record,binding:{...first.record.binding,conversationId:randomUUID(),runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID()}};
 const falseSha='f'.repeat(64);assert.notEqual(falseSha,hash(wrong));
 await f.client.query('INSERT INTO meri_conversations.initial_run_bindings(tenant_id,conversation_id,run_id,record,record_sha256) VALUES($1,$2,$3,$4,$5)',[wrong.binding.tenantId,wrong.binding.conversationId,wrong.binding.runId,wrong,falseSha]);
 await assert.rejects(f.journal().readConversation({principal:{tenantId:wrong.binding.tenantId,actorId:wrong.binding.actorId},conversationId:wrong.binding.conversationId,selectedClientId:wrong.selectedClientId},check),{code:'INITIAL_RUN_BINDING_CORRUPT'});
 assert.equal((await f.client.query('SELECT count(*)::int AS n FROM meri_conversations.initial_run_bindings')).rows[0].n,2);
});

test('0017 narrow app role can lock all journal rows but cannot mutate or administer them',async t=>{
 const f=await fixture(t,{preexisting:true}),{role,appPool}=await grantAppRole(f),first=await f.journal(appPool).claim(f.input,check);
 assert.equal(first.created,true);assert.deepEqual((await f.journal(appPool).claim(f.input,check)).record,first.record);
 const app=await appPool.connect();
 try{
  assert.equal((await app.query('SELECT current_user AS role')).rows[0].role,role);
  await app.query('BEGIN');
  await app.query('SELECT * FROM meri_conversations.initial_run_bindings WHERE tenant_id=$1 AND conversation_id=$2 FOR UPDATE',[f.input.principal.tenantId,f.input.conversationId]);
  const p=[f.before.binding.tenantId,f.before.binding.conversationId];
  await app.query('SELECT projection,projection_sha256 FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2 ORDER BY sequence_base LIMIT 1 FOR UPDATE',p);
  await app.query('SELECT * FROM meri_conversations.initial_inputs WHERE tenant_id=$1 AND conversation_id=$2 FOR UPDATE',p);
  await app.query('SELECT reservation,reservation_sha256 FROM meri_conversations.next_runs WHERE tenant_id=$1 AND conversation_id=$2 AND source_run_id=$3 FOR UPDATE',[...p,f.before.binding.runId]);
  await app.query('ROLLBACK');
  await assert.rejects(app.query('UPDATE meri_conversations.runs SET sequence_base=sequence_base+1 WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3',[...p,f.before.binding.runId]),/run sequence base is immutable/u);
  await assert.rejects(app.query("UPDATE meri_conversations.initial_inputs SET allocation_sha256=$3 WHERE tenant_id=$1 AND conversation_id=$2",[...p,'f'.repeat(64)]),/INITIAL_INPUT_IMMUTABLE/u);
  await assert.rejects(app.query("UPDATE meri_conversations.next_runs SET reservation_sha256=$3 WHERE tenant_id=$1 AND conversation_id=$2",[...p,'f'.repeat(64)]),/next_runs identity is immutable/u);
  await assert.rejects(app.query('UPDATE meri_conversations.initial_run_bindings SET record_sha256=record_sha256 WHERE tenant_id=$1 AND conversation_id=$2',[f.input.principal.tenantId,f.input.conversationId]),/INITIAL_RUN_BINDING_IMMUTABLE/u);
  for(const sql of [
   'UPDATE meri_conversations.initial_run_bindings SET record=record',
   'DELETE FROM meri_conversations.initial_run_bindings',
   'TRUNCATE meri_conversations.initial_run_bindings',
   'CREATE TABLE meri_conversations.illicit_0017 (x integer)'
  ])await assert.rejects(app.query(sql),{code:'42501'},sql);
  assert.equal((await f.row()).record_sha256,hash(first.record));
 }finally{app.release();}
});

test('0017 real concurrent claims block on the same advisory lock and preserve one original',async t=>{
 const f=await fixture(t),paused=deferred(),resume=deferred(),secondConnected=deferred();let firstPid,secondPid,second;
 const firstPool={async connect(){const client=await f.pool.connect();try{firstPid=(await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;return {async query(...args){if(args[0]==='COMMIT'){paused.resolve();await resume.promise;}return client.query(...args);},release(error){client.release(error);}};}catch(error){client.release(error);throw error;}}};
 const secondPool={async connect(){const client=await f.pool.connect();try{secondPid=(await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;secondConnected.resolve();return client;}catch(error){client.release(error);throw error;}}};
 const first=f.journal(firstPool).claim(f.input,check);
 try{
  await boundedWait(paused.promise,4000,'first claim did not reach the pre-COMMIT barrier');
  second=f.journal(secondPool).claim(f.input,check);
  await boundedWait(secondConnected.promise,1000,'second claim did not acquire an independent backend');
  let blocked=false;
  for(let i=0;i<100&&!blocked;i++){
   blocked=(await f.client.query('SELECT $1::int=ANY(pg_blocking_pids($2::int)) AS blocked',[firstPid,secondPid])).rows[0].blocked;
   if(!blocked)await new Promise(resolve=>setTimeout(resolve,10));
  }
  assert.equal(blocked,true,'PostgreSQL must show second claim waiting on first transaction');
 }finally{resume.resolve();await Promise.allSettled([first,second].filter(Boolean));}
 const j=f.journal(),[a,b]=await Promise.all([first,second]);
 assert.equal(a.created!==b.created,true);assert.deepEqual(a.record,b.record);
 const saved=await f.row();assert.equal(saved.record_sha256,hash(a.record));
 assert.deepEqual(await j.claim({...f.input,proposedExpiresAtMs:f.input.proposedExpiresAtMs+30000},check),{record:a.record,created:false});
 for(const change of [{principal:{...f.input.principal,actorId:'other'}},{selectedClientId:randomUUID()},{policyRevision:'other'},{configurationSha256:'d'.repeat(64)}])await assert.rejects(j.claim({...f.input,...change},check),{code:'INITIAL_RUN_BINDING_CONFLICT'});
 f.advance(60000);await assert.rejects(j.claim({...f.input,proposedExpiresAtMs:f.input.proposedExpiresAtMs+60000},check),{code:'INITIAL_RUN_BINDING_EXPIRED'});
 assert.deepEqual(await j.read({binding:a.record.binding},check),a.record);
 assert.equal((await f.client.query('SELECT count(*)::int AS n FROM meri_conversations.initial_run_bindings')).rows[0].n,1);
});

test('0017 refuses a new original when an older accepted run, input, and successor already exist',async t=>{
 const f=await fixture(t,{preexisting:true}),prior=f.before;
 const proposal={...f.input,principal:{tenantId:prior.binding.tenantId,actorId:prior.binding.actorId},conversationId:prior.binding.conversationId,selectedClientId:prior.allocation.selectedClientId,policyRevision:prior.run.policyRevision};
 const before=await snapshotExisting(f.client,prior.binding);
 await assert.rejects(f.journal().claim(proposal,check),{code:'INITIAL_RUN_BINDING_ALREADY_EXISTS'});
 assert.equal((await f.client.query('SELECT count(*)::int AS n FROM meri_conversations.initial_run_bindings')).rows[0].n,0);
 assert.deepEqual(await snapshotExisting(f.client,prior.binding),before);
});

test('0017 lost acknowledgment after real COMMIT recovers only the persisted binding',async t=>{
 const f=await fixture(t),base=f.pool;let suppress=true;
 const ackLost={async connect(){const client=await base.connect();return {async query(...args){const result=await client.query(...args);if(args[0]==='COMMIT'&&suppress){suppress=false;throw Error('synthetic lost COMMIT acknowledgment');}return result;},release(error){client.release(error);}};}};
 await assert.rejects(f.journal(ackLost).claim(f.input,check),{code:'INITIAL_RUN_BINDING_COMMIT_UNKNOWN'});
 const saved=await f.row();assert.ok(saved);assert.equal(saved.record_sha256,hash(saved.record));
 assert.deepEqual(await f.journal().claim(f.input,check),{record:saved.record,created:false});
 assert.equal((await f.client.query('SELECT count(*)::int AS n FROM meri_conversations.initial_run_bindings')).rows[0].n,1);
});

test('0017 private pg_dump/pg_restore retains admitted binding and accepted source rows',async t=>{
 const bin=process.env.MERI_INITIAL_RUN_MIGRATION_TEST_PG_BIN_DIRECTORY,scratch=process.env.MERI_INITIAL_RUN_MIGRATION_TEST_SCRATCH_DIRECTORY;
 for(const path of [bin,scratch])if(typeof path!=='string'||!posix.isAbsolute(path)||path==='/'||path.endsWith('/')||posix.normalize(path)!==path||/[\x00-\x1f\x7f]/u.test(path))throw Error('EXPLICIT_PRIVATE_RESTORE_PATH_REQUIRED');
 const f=await fixture(t,{preexisting:true}),claim=await f.journal().claim(f.input,check);
 await seedAccepted(f.client,claim.record.binding,{selectedClientId:claim.record.selectedClientId,policyRevision:claim.record.policyRevision,createdAtMs:claim.record.createdAtMs,expiresAtMs:claim.record.expiresAtMs});
 const source=await snapshotExisting(f.client,claim.record.binding),saved=await f.row();
 const restored=await f.database('meri_initial_0017_restore');
 const directory=await mkdtemp(join(scratch,'meri-0017-')),dump=join(directory,'source.dump');
 t.after(async()=>{await rm(dump,{force:true});await rmdir(directory);});
 const env={PATH:process.env.PATH,PGPASSFILE:'/dev/null',PGCONNECT_TIMEOUT:'3'};
 const run=async(executable,args)=>{const result=await execFile(join(bin,executable),args,{timeout:30000,maxBuffer:1048576,env});assert.equal(result.stderr,'');return result.stdout;};
 for(const executable of ['pg_dump','pg_restore'])assert.match(await run(executable,['--version']),/PostgreSQL\) 16[.]/u);
 const target=`--host=${f.config.host}`,port=`--port=${f.config.port}`;
 await run('pg_dump',['--format=custom','--no-owner','--no-acl',target,port,'--username=postgres',`--dbname=${f.name}`,`--file=${dump}`]);
 await run('pg_restore',['--exit-on-error','--single-transaction','--no-owner','--no-acl',target,port,'--username=postgres',`--dbname=${restored}`,dump]);
 const reader=await f.connect(restored),rows=(await reader.query('SELECT * FROM meri_conversations.initial_run_bindings WHERE tenant_id=$1 AND conversation_id=$2',[f.input.principal.tenantId,f.input.conversationId])).rows;
 assert.equal(rows.length,1);assert.deepEqual(rows[0].record,saved.record);assert.equal(rows[0].record_sha256,hash(rows[0].record));
 assert.deepEqual(await snapshotExisting(reader,claim.record.binding),source);
 assert.deepEqual(await snapshotExisting(reader,f.before.binding),await snapshotExisting(f.client,f.before.binding));
 const restoredPool=new pg.Pool({...f.connection,database:restored,max:2});f.pools.push(restoredPool);
 assert.deepEqual(await f.journal(restoredPool).readConversation({principal:f.input.principal,conversationId:f.input.conversationId,selectedClientId:f.input.selectedClientId},check),saved.record);
 assert.deepEqual(await f.journal(restoredPool).claim(f.input,check),{record:saved.record,created:false});
 await assert.rejects(reader.query('UPDATE meri_conversations.initial_run_bindings SET record_sha256=record_sha256 WHERE tenant_id=$1 AND conversation_id=$2',[f.input.principal.tenantId,f.input.conversationId]),/INITIAL_RUN_BINDING_IMMUTABLE/u);
});
