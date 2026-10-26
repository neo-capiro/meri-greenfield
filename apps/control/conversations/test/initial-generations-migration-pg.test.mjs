/** Native 0020 qualification (O117) on the local-baseline PostgreSQL 16 Unix-socket cluster only: each case creates and drops its
 * own disposable database, applies 0001..0017 exactly, populates 0016/0017, then applies 0020 and times its transaction.
 * Elapsed transaction time includes acquisition/network overhead: an upper bound, NOT an exact ACCESS EXCLUSIVE lock duration.
 * Never a deployed database. Run with the local-baseline provision-postgres.sh environment exports; no implicit skip. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import pg from 'pg';
import {createInitialRunBindingJournal} from '../initial-run-binding-journal.mjs';
import {createPostgresConversationStore} from '../postgres-store.mjs';
import {prepareOriginalInputFacts} from '../initial-input-facts.mjs';
import {hash} from '../boundary.mjs';
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
 const suffix=randomUUID().replaceAll('-',''),name='meri_c12_'+suffix,role='meri_c12_app_'+suffix;
 const pools=[],closed=[];let allocated=false;
 // pg-pool can resolve end() before its removed clients finish closing their sockets.
 const trackPool=p=>{p.on('connect',client=>closed.push(new Promise(resolve=>client.once('end',resolve))));pools.push(p);return p;};
 t.after(async()=>{try{for(const p of pools)await p.end();await Promise.all(closed);if(allocated){await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);await admin.query(`DROP ROLE IF EXISTS ${role}`);}}finally{await admin.end();}});
 assert.equal((await admin.query("SELECT current_setting('listen_addresses') AS listen")).rows[0].listen,'','Unix socket only');
 allocated=true;
 await admin.query(`CREATE DATABASE ${name}`);
 await admin.query(`CREATE ROLE ${role} LOGIN NOSUPERUSER NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`);
 // Privileged provisioning/migration remains separate from every candidate operation.
 const main=trackPool(new pg.Pool({host,database:name,user:'postgres',max:4}));
 for(const file of manifest)await main.query(await readFile(new URL(file,migrations),'utf8'));
 await main.query(`REVOKE CREATE ON SCHEMA public FROM PUBLIC; GRANT CONNECT ON DATABASE ${name} TO ${role};
  GRANT USAGE ON SCHEMA meri_conversations TO ${role};
  GRANT SELECT,INSERT,UPDATE ON meri_conversations.conversations,meri_conversations.runs,meri_conversations.events,
   meri_conversations.initial_inputs,meri_conversations.initial_run_bindings,meri_conversations.next_runs TO ${role};
  GRANT SELECT ON meri_conversations.native_allocations TO ${role}`);
 const pool=()=>{const p=trackPool(new pg.Pool({host,database:name,user:role,max:4}));return {async connect(){
  const client=await p.connect();try{
   const r=(await client.query(`SELECT current_user AS actor,session_user AS login,current_database() AS db,
    rolsuper,rolinherit,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls,
    EXISTS(SELECT 1 FROM pg_auth_members WHERE member=ordinary_role.oid) AS membership,
    EXISTS(SELECT 1 FROM pg_class WHERE relnamespace='meri_conversations'::regnamespace AND relowner=ordinary_role.oid) AS owns_tables
    FROM pg_roles ordinary_role WHERE rolname=current_user`)).rows[0];
   assert.deepEqual(r,{actor:role,login:role,db:name,rolsuper:false,rolinherit:false,rolcreatedb:false,rolcreaterole:false,rolreplication:false,rolbypassrls:false,membership:false,owns_tables:false});
   return client;
  }catch(error){client.release(error);throw error;}
 }};};
 const ordinary=await pool().connect();try{
  await assert.rejects(ordinary.query('ALTER TABLE meri_conversations.initial_run_bindings ADD COLUMN forbidden_fixture_ddl text'),{code:'42501'});
 }finally{ordinary.release();}
 return {pool,main,role};
}
/** Only the two actual input-acceptance cases need current model-policy dependencies; never part of 0020 timing. */
async function prepareAcceptancePolicy(main,role,principal){
 for(const path of ['../../../gateway/budget/migrations/0001_product_budget.sql','../../../gateway/budget/migrations/0002_tenant_budgets.sql',
  '../../settings/migrations/0001_settings.sql','../migrations/0021_sdk_run_usage.sql'])await main.query(await readFile(new URL(path,import.meta.url),'utf8'));
 // Same synthetic tenant-cap seed convention as store-pg.test.mjs; no historical budget reservations are seeded.
 await main.query('INSERT INTO meri_settings.tenant_settings(tenant_id,revision,document,document_sha256,updated_at,updated_by,monthly_cap_micro_usd) VALUES($1,1,$2,$3,clock_timestamp(),$4,100000000)',[principal.tenantId,{},hash({}),principal.actorId]);
 // Canonical 0022 policy-read columns, adapted only to this fixture's generated ordinary role.
 await main.query(`GRANT USAGE ON SCHEMA meri_settings TO ${role}; GRANT SELECT (tenant_id,monthly_cap_micro_usd,sdk_max_turns,sdk_max_budget_micro_usd) ON meri_settings.tenant_settings TO ${role}`);
}
/** `rows` conversations with a generation-1 original (0017 shape); every other one also has a RESERVED original input (0016 shape). */
async function populate(main,rows){
 const r=record(Date.now());
 // Bound each batch's memory while giving every existing row a genuine application-canonical digest and scope.
 for(let start=0;start<rows;start+=500){const bindings=[],inputs=[];
  for(let i=start;i<Math.min(rows,start+500);i++){
   const binding={tenantId:'tenant-pop',actorId:'actor-pop',conversationId:randomUUID(),runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:1};
   const value={schemaVersion:1,state:'ADMITTED',binding,selectedClientId:r.clientId,policyRevision:r.policyRevision,versions,
    configurationSha256:r.configurationSha256,createdAtMs:r.createdAtMs,expiresAtMs:r.expiresAtMs};
   bindings.push({tenant_id:binding.tenantId,conversation_id:binding.conversationId,run_id:binding.runId,record:value,record_sha256:hash(value)});
   if(i%2===0){const allocation={binding,scopes:[{kind:'client',tenantId:binding.tenantId,resourceId:r.clientId,policyRevision:r.policyRevision}],versions,
    selectedClientId:r.clientId,requestId:randomUUID(),inputSha256:'a'.repeat(64),requestSha256:'b'.repeat(64),allocatedAtMs:r.createdAtMs,expiresAtMs:r.expiresAtMs};
    inputs.push({tenant_id:binding.tenantId,conversation_id:binding.conversationId,run_id:binding.runId,request_id:allocation.requestId,allocation,allocation_sha256:hash(allocation)});}
  }
  await main.query(`INSERT INTO meri_conversations.initial_run_bindings(tenant_id,conversation_id,run_id,record,record_sha256)
   SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(tenant_id text,conversation_id uuid,run_id uuid,record jsonb,record_sha256 text)`,[JSON.stringify(bindings)]);
  await main.query(`INSERT INTO meri_conversations.initial_inputs(tenant_id,conversation_id,run_id,request_id,allocation,allocation_sha256,state,accepted_request_sha256)
   SELECT x.*,'RESERVED',NULL FROM jsonb_to_recordset($1::jsonb) AS x(tenant_id text,conversation_id uuid,run_id uuid,request_id uuid,allocation jsonb,allocation_sha256 text)`,[JSON.stringify(inputs)]);
 }
 return (await main.query('SELECT (SELECT count(*) FROM meri_conversations.initial_run_bindings)::int AS bindings,(SELECT count(*) FROM meri_conversations.initial_inputs)::int AS inputs')).rows[0];
}
async function migrate(main){const sql=await readFile(new URL('0020_initial_generations.sql',migrations),'utf8'),started=performance.now();await main.query(sql);return Math.round(performance.now()-started);}

for(const rows of [1000,100000])test(`0020 applies up on populated 0016/0017 tables (${rows} originals): rows kept as generation 1, triggers intact`,async t=>{
 const {pool,main}=await database(t),before=await populate(main,rows),ms=await migrate(main);
 t.diagnostic(`0020 migration transaction elapsed (upper bound on PK-swap lock duration) on ${before.bindings} bindings + ${before.inputs} inputs: ${ms} ms`);
 const after=(await main.query('SELECT count(*)::int AS n,min(generation) AS lo,max(generation) AS hi FROM meri_conversations.initial_run_bindings')).rows[0];
 assert.deepEqual(after,{n:before.bindings,lo:1,hi:1});assert.equal((await main.query('SELECT count(*)::int AS n FROM meri_conversations.initial_inputs')).rows[0].n,before.inputs);
 const sample=(await main.query('SELECT record,record_sha256 FROM meri_conversations.initial_run_bindings LIMIT 1')).rows[0];
 assert.equal(hash(sample.record),sample.record_sha256,'the migration preserved valid canonical record bytes');
 assert.deepEqual(await createInitialRunBindingJournal({pool:pool()}).read({binding:sample.record.binding},check),sample.record);
 const keys=(await main.query(`SELECT conrelid::regclass::text AS t,contype,pg_get_constraintdef(oid) AS d FROM pg_constraint WHERE conrelid IN ('meri_conversations.initial_run_bindings'::regclass,'meri_conversations.initial_inputs'::regclass) AND contype IN ('p','u') ORDER BY 1,2,3`)).rows;
 assert.deepEqual(keys.map(k=>`${k.t} ${k.contype} ${k.d}`),[
  'meri_conversations.initial_inputs p PRIMARY KEY (tenant_id, conversation_id, run_id)','meri_conversations.initial_inputs u UNIQUE (request_id, tenant_id, run_id)',
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
 const input=(binding,requestId)=>{const allocation={binding,scopes:[{kind:'client',tenantId:binding.tenantId,resourceId:selectedClientId,policyRevision:proposal.policyRevision}],versions,
  selectedClientId,requestId,inputSha256:'a'.repeat(64),requestSha256:'b'.repeat(64),allocatedAtMs:1,expiresAtMs:2};
  return main.query(`INSERT INTO meri_conversations.initial_inputs(tenant_id,conversation_id,run_id,request_id,allocation,allocation_sha256,state,accepted_request_sha256)
   VALUES($1,$2,$3,$4,$5,$6,'RESERVED',NULL)`,[binding.tenantId,binding.conversationId,binding.runId,requestId,allocation,hash(allocation)]);};
 const requestId=randomUUID();await input(first.record.binding,requestId);await input(a.record.binding,requestId);
 await assert.rejects(input(a.record.binding,randomUUID()),{code:'23505'},'one original input per run');
 // Earlier code inserts without the column: the default keeps a first claim working (generation 1).
 const other=randomUUID(),runId=randomUUID(),earlier={...first.record,binding:{...first.record.binding,conversationId:other,runId}};
 await main.query('INSERT INTO meri_conversations.initial_run_bindings(tenant_id,conversation_id,run_id,record,record_sha256) VALUES($1,$2,$3,$4,$5)',[principal.tenantId,other,runId,earlier,hash(earlier)]);
 assert.equal((await main.query('SELECT generation FROM meri_conversations.initial_run_bindings WHERE conversation_id=$1',[other])).rows[0].generation,1);
 const duplicate={...earlier,binding:{...earlier.binding,runId:randomUUID()}};
 await assert.rejects(main.query('INSERT INTO meri_conversations.initial_run_bindings(tenant_id,conversation_id,run_id,record,record_sha256,generation) VALUES($1,$2,$3,$4,$5,1)',[principal.tenantId,other,duplicate.binding.runId,duplicate,hash(duplicate)]),{code:'23505'},'one row per generation');
});

// C2 addendum: an exact expected source is required, and two connections racing the same expectedRunId under the
// conversation lock produce exactly one supersession. Nothing here runs without Release's disposable PG slot.
test('after 0020: a mismatched expected source never supersedes and concurrent same-source rebinds create exactly one generation',async t=>{
 const {pool,main}=await database(t);await migrate(main);
 const now=Date.now(),principal={tenantId:'tenant-'+randomUUID(),actorId:'actor-a'},conversationId=randomUUID(),selectedClientId=randomUUID();
 const proposal={principal,conversationId,selectedClientId,policyRevision:'policy1',versions,configurationSha256:'c'.repeat(64),proposedExpiresAtMs:now+60000};
 const first=(await createInitialRunBindingJournal({pool:pool()}).claim(proposal,check)).record;
 const generations=async()=>(await main.query('SELECT generation,run_id FROM meri_conversations.initial_run_bindings WHERE tenant_id=$1 ORDER BY generation',[principal.tenantId])).rows;
 const journal=createInitialRunBindingJournal({pool:pool()});
 await assert.rejects(journal.rebind({...proposal,runId:randomUUID(),configurationSha256:'d'.repeat(64)},check),{code:'INITIAL_RUN_BINDING_CONFLICT'},'a foreign source is refused');
 assert.deepEqual((await generations()).map(r=>r.generation),[1],'a mismatched expected source appends no generation');
 assert.deepEqual(await journal.rebind({...proposal,runId:first.binding.runId,proposedExpiresAtMs:now+90000},check),{record:first,created:false,superseded:false},'naming the live original itself is a no-op replay');
 // The stored original is now dead for this render; two independent connections carry the SAME expectedRunId.
 const exact={...proposal,runId:first.binding.runId,configurationSha256:'d'.repeat(64),proposedExpiresAtMs:now+120000};
 const settled=await Promise.allSettled([createInitialRunBindingJournal({pool:pool()}).rebind(exact,check),createInitialRunBindingJournal({pool:pool()}).rebind(exact,check)]);
 const fulfilled=settled.filter(s=>s.status==='fulfilled'),rejected=settled.filter(s=>s.status==='rejected');
 assert.equal(fulfilled.length,1,'exactly one connection supersedes the named source');
 assert.equal(rejected.length,1,'the other refuses');
 assert.equal(rejected[0].reason.code,'INITIAL_RUN_BINDING_CONFLICT','the loser names an original that is no longer latest');
 assert.equal(fulfilled[0].value.created,true);assert.equal(fulfilled[0].value.superseded,true);
 assert.deepEqual(fulfilled[0].value.source,first.binding,'the atomic result carries the exact superseded source');
 assert.notEqual(fulfilled[0].value.record.binding.runId,first.binding.runId);
 const rows=await generations();
 assert.deepEqual(rows.map(r=>[r.generation,r.run_id]),[[1,first.binding.runId],[2,fulfilled[0].value.record.binding.runId]],'one source, one successor, generation 1 kept as history');
 assert.deepEqual(await journal.readConversation({principal,conversationId,selectedClientId},check),fulfilled[0].value.record,'only the latest generation is served');
 await assert.rejects(journal.rebind({...exact,proposedExpiresAtMs:now+180000},check),{code:'INITIAL_RUN_BINDING_CONFLICT'},'the already-superseded source can never create a third generation');
 assert.deepEqual((await generations()).map(r=>r.generation),[1,2]);
});

/** Observe a real PostgreSQL lock request, then pause only after it is held, to force serial orders across independent connections. */
function heldPool(pool,lockKey){let resume,entered,requested,armed=true;const held=new Promise(resolve=>entered=resolve),requesting=new Promise(resolve=>requested=resolve),release=()=>resume?.(),gate=new Promise(resolve=>resume=resolve);
 return {held,requesting,release,pool:{async connect(){const c=await pool.connect();return {async query(sql,p){
  const target=armed&&sql.startsWith('SELECT pg_advisory_xact_lock(')&&(lockKey===undefined||p?.[0]===lockKey);if(target)requested();const result=await c.query(sql,p);
  if(target){armed=false;entered();await gate;}return result;},release:error=>c.release(error)};}}};}

for(const winner of ['accept','rebind'])test(`original input acceptance and supersession serialize across connections (${winner} holds the lock first)`,async t=>{
 const {pool,main,role}=await database(t);await migrate(main);const now=Date.now(),principal={tenantId:'tenant-'+randomUUID(),actorId:'actor-a'},selectedClientId=randomUUID();
 await prepareAcceptancePolicy(main,role,principal);
 const proposal={principal,conversationId:randomUUID(),selectedClientId,policyRevision:'policy1',versions,configurationSha256:'c'.repeat(64),proposedExpiresAtMs:now+60000};
 const original=(await createInitialRunBindingJournal({pool:pool(),now:()=>now}).claim(proposal,check)).record,binding=original.binding;
 const scopes=[{kind:'client',tenantId:binding.tenantId,resourceId:selectedClientId,policyRevision:proposal.policyRevision}],createdAt=new Date(now).toISOString();
 const input={requestId:randomUUID(),prompt:'accepted exactly once'},request={...input,skill:null,window:null,windowRequest:null};
 const facts=await prepareOriginalInputFacts({binding,scopes,versions,selectedClientId,input,request,allocatedAtMs:now,expiresAtMs:now+60000});
 await createPostgresConversationStore({pool:pool(),now:()=>now}).initialInputs.claim(facts,check);
 const acceptance={conversation:{conversationId:binding.conversationId,owner:principal,scopes,createdAt,policyRevision:proposal.policyRevision},
  run:{binding,state:'queued',scopes,versions,createdAt,policyRevision:proposal.policyRevision},request,selectedClientId,
  event:{contractVersion:'0.1.0',eventId:randomUUID(),binding,sequence:1,createdAt,scopes,type:'run.status',data:{state:'queued',reasonCode:null}}};
 const first=heldPool(pool()),second=pool(),store=createPostgresConversationStore({pool:winner==='accept'?first.pool:second,now:()=>now});
 const journal=createInitialRunBindingJournal({pool:winner==='rebind'?first.pool:second,now:()=>now});
 const operations={accept:()=>store.initialInputs.accept(acceptance,check),rebind:()=>journal.rebind({...proposal,runId:binding.runId,configurationSha256:'d'.repeat(64)},check)};
 let leading,trailing;
 try{leading=operations[winner]();await Promise.race([first.held,leading.then(()=>{throw Error('CONVERSATION_LOCK_NOT_OBSERVED');})]);
  trailing=operations[winner==='accept'?'rebind':'accept']();}finally{first.release();}
 const results=await Promise.allSettled([leading,trailing]);assert.equal(results[0].status,'fulfilled');assert.equal(results[1].status,'rejected');
 assert.equal(results[1].reason.code,winner==='accept'?'INITIAL_RUN_BINDING_CONFLICT':'INITIAL_INPUT_SUPERSEDED');
 const state=(await main.query(`SELECT (SELECT count(*) FROM meri_conversations.initial_run_bindings WHERE tenant_id=$1)::int AS generations,
  (SELECT count(*) FROM meri_conversations.runs WHERE tenant_id=$1)::int AS runs,(SELECT state FROM meri_conversations.initial_inputs WHERE tenant_id=$1) AS input`,[principal.tenantId])).rows[0];
 assert.deepEqual(state,winner==='accept'?{generations:1,runs:1,input:'ACCEPTED'}:{generations:2,runs:0,input:'RESERVED'});
});

test('0020 preserves one request owner across concurrent legacy INSERT and current claims in different conversations',async t=>{
 const {pool,main}=await database(t);await migrate(main);const now=Date.now(),principal={tenantId:'tenant-'+randomUUID(),actorId:'actor-a'},selectedClientId=randomUUID();
 const input={requestId:randomUUID(),prompt:'one request owner'},request={...input,skill:null,window:null,windowRequest:null},facts=[];
 for(let i=0;i<2;i++){
  const original=(await createInitialRunBindingJournal({pool:pool(),now:()=>now}).claim({principal,conversationId:randomUUID(),selectedClientId,
   policyRevision:'policy1',versions,configurationSha256:'c'.repeat(64),proposedExpiresAtMs:now+60000},check)).record;
  facts.push(await prepareOriginalInputFacts({binding:original.binding,scopes:[{kind:'client',tenantId:principal.tenantId,resourceId:selectedClientId,policyRevision:'policy1'}],
   versions,selectedClientId,input,request,allocatedAtMs:now,expiresAtMs:now+60000}));
 }
 const insert=(client,f)=>client.query(`INSERT INTO meri_conversations.initial_inputs(tenant_id,conversation_id,run_id,request_id,allocation,allocation_sha256,state,accepted_request_sha256)
  VALUES($1,$2,$3,$4,$5,$6,'RESERVED',NULL) ON CONFLICT DO NOTHING RETURNING *`,[f.binding.tenantId,f.binding.conversationId,f.binding.runId,f.requestId,f,hash(f)]);
 const legacy=await pool().connect(),requestKey=`meri_initial_input_request:${input.requestId}`,current=heldPool(pool(),requestKey);current.release();
 try{
  // The earlier journal takes only its conversation lock. The migration trigger must supply the request lock itself.
  await legacy.query('BEGIN ISOLATION LEVEL READ COMMITTED');
  await legacy.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`${principal.tenantId}:${facts[0].binding.conversationId}`]);
  assert.equal((await insert(legacy,facts[0])).rows.length,1);
  assert.equal((await main.query('SELECT pg_try_advisory_xact_lock(hashtextextended($1,0)) AS acquired',[requestKey])).rows[0].acquired,false,
   'a legacy INSERT holds the shared request ownership lock until commit');
  const trailing=createPostgresConversationStore({pool:current.pool,now:()=>now}).initialInputs.claim(facts[1],check),settled=Promise.allSettled([trailing]);
  await Promise.race([current.requesting,trailing.then(()=>{throw Error('REQUEST_LOCK_NOT_OBSERVED');})]);
  await legacy.query('COMMIT');
  const [outcome]=await settled;assert.equal(outcome.status,'rejected');assert.equal(outcome.reason.code,'INITIAL_INPUT_CONFLICT');
  // A legacy loser is also rejected by the database, including when it omits the new application ownership check.
  await assert.rejects(insert(main,facts[1]),error=>error.code==='23505'&&error.message==='INITIAL_INPUT_CONFLICT');
  const rows=(await main.query('SELECT tenant_id,conversation_id,run_id,state FROM meri_conversations.initial_inputs WHERE request_id=$1',[input.requestId])).rows;
  assert.deepEqual(rows,[{tenant_id:principal.tenantId,conversation_id:facts[0].binding.conversationId,run_id:facts[0].binding.runId,state:'RESERVED'}]);
  await legacy.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
  await assert.rejects(insert(legacy,facts[1]),error=>error.code==='0A000'&&error.message==='INITIAL_INPUT_ISOLATION_REQUIRED');
 }finally{current.release();await legacy.query('ROLLBACK').catch(()=>{});legacy.release();}
});
