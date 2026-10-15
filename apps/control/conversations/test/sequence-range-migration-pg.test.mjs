/** Actual private local PostgreSQL only. Each case owns a fresh random database;
 * no shared schemas/tables are modified, dropped or truncated. No optional skips. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {posix} from 'node:path';
import pg from 'pg';
import {canonicalSha256 as hash,validateShape} from '../../../../packages/contracts/validate.mjs';
import {versions} from './store-fixture.mjs';

const MAX='9007199254740991',UNSAFE='9007199254740992';
const migrations=new URL('../migrations/',import.meta.url),migration=await readFile(new URL('0009_next_runs.sql',migrations),'utf8');
function privateConfiguration(environment){
 const host=environment.MERI_INSPECTION_TEST_SOCKET,controlDatabase=environment.MERI_INSPECTION_TEST_DATABASE,expectedDataDirectory=environment.MERI_SEQUENCE_MIGRATION_TEST_DATA_DIRECTORY;
 if(host!=='/tmp/meri-prepared-kickoff-pg-20261014/socket'||controlDatabase!=='meri_inspection_final'||environment.MERI_SEQUENCE_MIGRATION_TEST_ISOLATED!=='1')throw Error('EXPLICIT_ISOLATED_LOCAL_POSTGRES_REQUIRED');
 if(typeof expectedDataDirectory!=='string'||!posix.isAbsolute(expectedDataDirectory)||expectedDataDirectory==='/'||expectedDataDirectory.endsWith('/')||posix.normalize(expectedDataDirectory)!==expectedDataDirectory||/[\x00-\x1f\x7f]/u.test(expectedDataDirectory)||expectedDataDirectory.length>4096)throw Error('EXPLICIT_VALIDATOR_DATA_DIRECTORY_REQUIRED');
 return {host,controlDatabase,expectedDataDirectory};
}
function assertPrivateServer(server,expectedDataDirectory){
 if(!server||!/^16[0-9]{4}$/u.test(server.version_num)||server.listen_addresses!==''||server.data_directory!==expectedDataDirectory)throw Error('PRIVATE_POSTGRES_SERVER_PREFLIGHT_REFUSED');
}
async function fixture(t){
 // These explicit flags are the validator owner's attestation that this is its
 // isolated disposable namespace, not technical proof of exclusive ownership.
 // Server metadata checks independently prevent connecting to a different PG
 // generation, TCP-listening server or data directory before any CREATE.
 const {host,controlDatabase,expectedDataDirectory}=privateConfiguration(process.env);
 const database='meri_sequence_range_'+randomUUID().replaceAll('-','');assert.match(database,/^meri_sequence_range_[a-f0-9]{32}$/u);assert.notEqual(database,controlDatabase);
 const config={host,user:'postgres',connectionTimeoutMillis:3000,options:'-c statement_timeout=5000'},admin=new pg.Client({...config,database:controlDatabase}),clients=[];let created=false,ownedOid;
 try{await admin.connect();}catch(error){await admin.end().catch(()=>{});throw error;}
 t.after(async()=>{
  await Promise.allSettled(clients.map(c=>c.end()));
  try{if(created){const current=await admin.query('SELECT oid::text FROM pg_database WHERE datname=$1',[database]);assert.equal(current.rows.length,1);assert.equal(current.rows[0].oid,ownedOid,'only the exact newly created database may be dropped');await admin.query(`DROP DATABASE "${database}"`);}}finally{await admin.end();}
 });
 const server=(await admin.query("SELECT current_setting('server_version_num') AS version_num,current_setting('listen_addresses') AS listen_addresses,current_setting('data_directory') AS data_directory")).rows[0];assertPrivateServer(server,expectedDataDirectory);
 await admin.query(`CREATE DATABASE "${database}" TEMPLATE template0`);created=true;ownedOid=(await admin.query('SELECT oid::text FROM pg_database WHERE datname=$1',[database])).rows[0].oid;
 async function connect(){const c=new pg.Client({...config,database});try{await c.connect();clients.push(c);return c;}catch(error){await c.end().catch(()=>{});throw error;}}
 const client=await connect(),prior=(await readdir(migrations)).filter(name=>/^000[1-8]_[a-z_]+\.sql$/u.test(name)).sort();assert.equal(prior.length,8);
 for(const name of prior)await client.query(await readFile(new URL(name,migrations),'utf8'));
 const tenantId='migration-'+randomUUID(),actorId='synthetic-actor',conversationId=randomUUID(),policyRevision='b'.repeat(64),scopes=[{tenantId,kind:'client',resourceId:randomUUID(),policyRevision}],createdAt='2026-10-14T12:00:00.000Z',conversation={conversationId,owner:{tenantId,actorId},scopes,policyRevision,createdAt};validateShape('Conversation',conversation);
 await client.query('INSERT INTO meri_conversations.conversations(tenant_id,conversation_id,owner_actor_id,projection,projection_sha256) VALUES($1,$2,$3,$4,$5)',[tenantId,conversationId,actorId,conversation,hash(conversation)]);
 function eventFor(binding,sequence){
  const state=sequence===1?'queued':sequence===2?'starting':sequence===3?'running':null;
  const event={contractVersion:'0.1.0',eventId:randomUUID(),binding,sequence,createdAt,scopes,type:state?'run.status':'message.delta',data:state?{state,reasonCode:null}:{messageId:randomUUID(),text:'synthetic retained event'}};
  if(Number.isSafeInteger(binding.writerFence)&&binding.writerFence>0&&Number.isSafeInteger(sequence))validateShape('UIEvent',event);return event;
 }
 async function insertEvent(c,binding,sequence,mutate){const event=eventFor(binding,Number(sequence));if(mutate)mutate(event);return c.query('INSERT INTO meri_conversations.events(tenant_id,conversation_id,run_id,sequence,event_id,event,event_sha256) VALUES($1,$2,$3,$4,$5,$6,$7)',[tenantId,conversationId,binding.runId,sequence,event.eventId,event,hash(event)]);}
 async function seed({fence=1,lastSequence=1,sequences=[1],range,mutateEvent}={}){
  const binding={tenantId,actorId,conversationId,runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:fence};if(fence==='missing')delete binding.writerFence;
  const run={binding,state:Number(lastSequence)>2?'running':Number(lastSequence)===2?'starting':'queued',scopes,policyRevision,createdAt,versions},request={requestId:randomUUID(),prompt:'synthetic migration history',skill:null,window:null,windowRequest:null};
  if(Number.isSafeInteger(fence)&&fence>0)validateShape('Run',run);
  const params=[tenantId,conversationId,binding.runId,run,hash(run),request.requestId,request,hash(request),String(lastSequence)];
  await client.query('INSERT INTO meri_conversations.runs(tenant_id,conversation_id,run_id,projection,projection_sha256,request_id,request,request_sha256,last_sequence'+(range?',sequence_base,sequence_end':'')+') VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9'+(range?',$10,$11':'')+')',range?[...params,range.base,range.end]:params);
  for(const sequence of sequences)await insertEvent(client,binding,sequence,mutateEvent);return {binding,run,request};
 }
 async function snapshot(){return {runs:(await client.query('SELECT run_id,projection::text,projection_sha256,request::text,request_sha256,last_sequence::text FROM meri_conversations.runs ORDER BY run_id')).rows,events:(await client.query('SELECT run_id,sequence::text,event_id,event::text,event_sha256 FROM meri_conversations.events ORDER BY run_id,sequence')).rows};}
 async function migrate(){try{await client.query(migration);}catch(error){await client.query('ROLLBACK');throw error;}}
 async function rejected(expected){const before=await snapshot();await assert.rejects(migrate(),expected);assert.deepEqual(await snapshot(),before);const artifacts=(await client.query("SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='meri_conversations' AND table_name='runs' AND column_name='sequence_base') AS column_exists,to_regclass('meri_conversations.conversation_writer_fence') AS fence_index,to_regclass('meri_conversations.completion_checkpoints') AS completion_table")).rows[0];assert.deepEqual(artifacts,{column_exists:false,fence_index:null,completion_table:null});}
 async function blockedBy(waiter,holder){for(let i=0;i<200;i++){if((await admin.query('SELECT $1::int=ANY(pg_blocking_pids($2::int)) AS blocked',[holder,waiter])).rows[0].blocked)return;await new Promise(resolve=>setTimeout(resolve,10));}assert.fail('expected actual PostgreSQL row-lock barrier');}
 const key=b=>[b.tenantId,b.conversationId,b.runId];
 return {client,connect,seed,eventFor,insertEvent,snapshot,migrate,rejected,blockedBy,key};
}

test('migration fixture guard requires explicit owner attestation and exact readonly server metadata',()=>{
 const environment={MERI_INSPECTION_TEST_SOCKET:'/tmp/meri-prepared-kickoff-pg-20261014/socket',MERI_INSPECTION_TEST_DATABASE:'meri_inspection_final',MERI_SEQUENCE_MIGRATION_TEST_ISOLATED:'1',MERI_SEQUENCE_MIGRATION_TEST_DATA_DIRECTORY:'/tmp/validator-owned-source-only/data'},configuration=privateConfiguration(environment),server={version_num:'160004',listen_addresses:'',data_directory:configuration.expectedDataDirectory};assert.doesNotThrow(()=>assertPrivateServer(server,configuration.expectedDataDirectory));
 for(const change of [{MERI_SEQUENCE_MIGRATION_TEST_ISOLATED:undefined},{MERI_SEQUENCE_MIGRATION_TEST_ISOLATED:'0'},{MERI_SEQUENCE_MIGRATION_TEST_DATA_DIRECTORY:undefined},{MERI_SEQUENCE_MIGRATION_TEST_DATA_DIRECTORY:'/'},{MERI_SEQUENCE_MIGRATION_TEST_DATA_DIRECTORY:'relative/data'},{MERI_SEQUENCE_MIGRATION_TEST_DATA_DIRECTORY:'/tmp/../tmp/data'}])assert.throws(()=>privateConfiguration({...environment,...change}));
 for(const change of [{version_num:'150010'},{version_num:'170001'},{listen_addresses:'localhost'},{data_directory:'/tmp/different-validator/data'}])assert.throws(()=>assertPrivateServer({...server,...change},configuration.expectedDataDirectory));
});

test('0009 retains valid out-of-insertion-order 5,6,1 history bytes and backfills exact ranges',async t=>{
 const f=await fixture(t),third=await f.seed({fence:3,lastSequence:1,sequences:[1]}),first=await f.seed({fence:1,lastSequence:5,sequences:[1,2,3,4,5]}),second=await f.seed({fence:2,lastSequence:6,sequences:[1,2,3,4,5,6]}),before=await f.snapshot();await f.migrate();assert.deepEqual(await f.snapshot(),before);
 const rows=(await f.client.query("SELECT run_id,sequence_base::text,sequence_end::text FROM meri_conversations.runs ORDER BY (projection#>>'{binding,writerFence}')::numeric")).rows;
 assert.deepEqual(rows,[{run_id:first.binding.runId,sequence_base:'0',sequence_end:'5'},{run_id:second.binding.runId,sequence_base:'5',sequence_end:'11'},{run_id:third.binding.runId,sequence_base:'11',sequence_end:null}]);
});
test('0009 explicitly retains an empty draft only with last_sequence zero and no events',async t=>{const f=await fixture(t);await f.seed({lastSequence:0,sequences:[]});const before=await f.snapshot();await f.migrate();assert.deepEqual(await f.snapshot(),before);assert.deepEqual((await f.client.query('SELECT sequence_base::text,sequence_end::text FROM meri_conversations.runs')).rows,[{sequence_base:'0',sequence_end:null}]);});
for(const [name,fence] of [['negative',-1],['zero',0],['missing','missing'],['null',null],['numeric string','1'],['malformed string','not-an-integer'],['fractional',1.5],['JS-unsafe',Number(UNSAFE)]])test('0009 rejects '+name+' writer fence and rolls back all DDL',async t=>{const f=await fixture(t);await f.seed({fence});await f.rejected();});
test('0009 duplicate valid fences reject instead of guessing history order',async t=>{const f=await fixture(t);await f.seed();await f.seed();await f.rejected();});
for(const [name,lastSequence,sequences] of [['gap',3,[1,3]],['missing retained history',3,[]],['extra retained event',1,[1,2]],['nonempty zero draft',0,[1]]])test('0009 rejects '+name+' and preserves old bytes on rollback',async t=>{const f=await fixture(t);await f.seed({lastSequence,sequences});await f.rejected();});
for(const [name,mutateEvent] of [['sequence',e=>{e.sequence=2;}],['event id',e=>{e.eventId=randomUUID();}],['binding',e=>{e.binding={...e.binding,actorId:'foreign'};}],['scopes',e=>{e.scopes=[];}]])test('0009 rejects retained redundant '+name+' substitution',async t=>{
 const f=await fixture(t);if(name==='event id'){const run=await f.seed();await f.client.query('UPDATE meri_conversations.events SET event_id=$4 WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3',[...f.key(run.binding),randomUUID()]);}else await f.seed({mutateEvent});await f.rejected();
});
// These huge legacy rows are unreconstructible without enormous retained event
// sets, so rejection may precede the window calculation. The persistent range
// cases below independently isolate the numeric cap, including an open final sum.
for(const [name,first] of [['unsafe base',UNSAFE],['unsafe final total',MAX],['bigint overflow','9223372036854775807']])test('0009 refuses unreconstructible huge legacy counts ('+name+') without partial migration',async t=>{const f=await fixture(t);await f.seed({fence:1,lastSequence:first,sequences:[]});await f.seed({fence:2});await f.rejected();});
for(const [name,range,lastSequence] of [['last sequence',{base:'0',end:null},UNSAFE],['base',{base:UNSAFE,end:null},'0'],['end',{base:'0',end:UNSAFE},'1'],['open final total',{base:MAX,end:null},'1'],['incorrect completed end',{base:'0',end:'0'},'1']])test('0009 persistent range constraint rejects unsafe '+name,async t=>{const f=await fixture(t);await f.migrate();await assert.rejects(f.seed({lastSequence,sequences:[],range}));});
test('0009 event-first race blocks the closer and rejects a stale declared end after event commit',async t=>{
 const f=await fixture(t),run=await f.seed();await f.migrate();const writer=await f.connect(),closer=await f.connect(),writerPid=(await writer.query('SELECT pg_backend_pid() AS pid')).rows[0].pid,closerPid=(await closer.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;let closing;
 try{await writer.query('BEGIN');await f.insertEvent(writer,run.binding,2);await closer.query('BEGIN');closing=closer.query('UPDATE meri_conversations.runs SET sequence_end=sequence_base+last_sequence WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3',f.key(run.binding)).then(result=>({result}),error=>({error}));await f.blockedBy(closerPid,writerPid);await writer.query('COMMIT');const outcome=await closing;assert.match(outcome.error?.message??'',/retained run events/u);await closer.query('ROLLBACK');assert.deepEqual((await f.client.query('SELECT last_sequence::text,sequence_end::text FROM meri_conversations.runs')).rows,[{last_sequence:'1',sequence_end:null}]);assert.equal((await f.client.query('SELECT count(*)::int AS n FROM meri_conversations.events')).rows[0].n,2);
 }finally{await writer.query('ROLLBACK');if(closing)await closing;await closer.query('ROLLBACK');}
});
test('0009 close-first race blocks insertion and rejects it after the closed range commits',async t=>{
 const f=await fixture(t),run=await f.seed();await f.migrate();const closer=await f.connect(),writer=await f.connect(),closerPid=(await closer.query('SELECT pg_backend_pid() AS pid')).rows[0].pid,writerPid=(await writer.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;let inserting;
 try{await closer.query('BEGIN');await closer.query('UPDATE meri_conversations.runs SET sequence_end=sequence_base+last_sequence WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3',f.key(run.binding));await writer.query('BEGIN');inserting=f.insertEvent(writer,run.binding,2).then(result=>({result}),error=>({error}));await f.blockedBy(writerPid,closerPid);await closer.query('COMMIT');const outcome=await inserting;assert.match(outcome.error?.message??'',/closed/u);await writer.query('ROLLBACK');assert.equal((await f.client.query('SELECT sequence_end::text FROM meri_conversations.runs')).rows[0].sequence_end,'1');assert.equal((await f.client.query('SELECT count(*)::int AS n FROM meri_conversations.events')).rows[0].n,1);
 }finally{await closer.query('ROLLBACK');if(inserting)await inserting;await writer.query('ROLLBACK');}
});
test('0009 closed ranges reject event INSERT, UPDATE and DELETE',async t=>{
 const f=await fixture(t),run=await f.seed();await f.migrate();await f.client.query('UPDATE meri_conversations.runs SET sequence_end=sequence_base+last_sequence WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3',f.key(run.binding));const before=await f.snapshot();await assert.rejects(f.insertEvent(f.client,run.binding,2),/closed/u);await assert.rejects(f.client.query('UPDATE meri_conversations.events SET event_sha256=$4 WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3',[...f.key(run.binding),'f'.repeat(64)]),/closed/u);await assert.rejects(f.client.query('DELETE FROM meri_conversations.events WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3',f.key(run.binding)),/closed/u);assert.deepEqual(await f.snapshot(),before);
});
test('0009 preserves the existing multi-event insert then counter-update transaction ordering',async t=>{
 const f=await fixture(t),run=await f.seed();await f.migrate();await f.client.query('BEGIN');try{await f.insertEvent(f.client,run.binding,2);await f.insertEvent(f.client,run.binding,3);await f.client.query('UPDATE meri_conversations.runs SET last_sequence=3 WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3',f.key(run.binding));await f.client.query('UPDATE meri_conversations.runs SET sequence_end=sequence_base+last_sequence WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3',f.key(run.binding));await f.client.query('COMMIT');}catch(error){await f.client.query('ROLLBACK');throw error;}assert.equal((await f.client.query('SELECT sequence_end::text FROM meri_conversations.runs')).rows[0].sequence_end,'3');
});
test('0009 open-range insertion refuses JS-unsafe sequence and redundant payload substitutions',async t=>{
 const f=await fixture(t),run=await f.seed();await f.migrate();const before=await f.snapshot();await assert.rejects(f.insertEvent(f.client,run.binding,UNSAFE),/event does not match/u);
 for(const mutate of [e=>{e.sequence=3;},e=>{e.binding={...e.binding,actorId:'foreign'};},e=>{e.scopes=[];}])await assert.rejects(f.insertEvent(f.client,run.binding,2,mutate),/event does not match/u);assert.deepEqual(await f.snapshot(),before);
});
for(const isolation of ['REPEATABLE READ','SERIALIZABLE'])test('0009 migration preflight refuses '+isolation+' before DDL',async t=>{
 const f=await fixture(t);await f.seed();await f.client.query("SET default_transaction_isolation TO '"+isolation.toLowerCase()+"'");try{await f.rejected(/require READ COMMITTED/u);}finally{await f.client.query('RESET default_transaction_isolation');}
});
for(const isolation of ['REPEATABLE READ','SERIALIZABLE'])for(const operation of ['close','insert'])test('0009 '+operation+' refuses '+isolation+' instead of reading a stale post-lock event snapshot',async t=>{
 const f=await fixture(t),run=await f.seed();await f.migrate();const before=await f.snapshot();await f.client.query('BEGIN ISOLATION LEVEL '+isolation);try{await assert.rejects(operation==='close'?f.client.query('UPDATE meri_conversations.runs SET sequence_end=sequence_base+last_sequence WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3',f.key(run.binding)):f.insertEvent(f.client,run.binding,2),/require READ COMMITTED/u);}finally{await f.client.query('ROLLBACK');}assert.deepEqual(await f.snapshot(),before);assert.equal((await f.client.query('SELECT sequence_end FROM meri_conversations.runs')).rows[0].sequence_end,null);
});
test('0009 empty draft seals at zero and its range stays immutable',async t=>{
 const f=await fixture(t),run=await f.seed({lastSequence:0,sequences:[]});await f.migrate();await f.client.query('UPDATE meri_conversations.runs SET sequence_end=0 WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3',f.key(run.binding));const before=await f.snapshot();
 for(const sql of ['last_sequence=1','sequence_end=NULL','sequence_end=1'])await assert.rejects(f.client.query('UPDATE meri_conversations.runs SET '+sql+' WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3',f.key(run.binding)),/closed/u);
 const changed={...run.run,state:'running'};await assert.rejects(f.client.query('UPDATE meri_conversations.runs SET projection=$4,projection_sha256=$5 WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3',[...f.key(run.binding),changed,hash(changed)]),/closed/u);await assert.rejects(f.insertEvent(f.client,run.binding,1),/closed/u);assert.deepEqual(await f.snapshot(),before);assert.equal((await f.client.query('SELECT sequence_end::text FROM meri_conversations.runs')).rows[0].sequence_end,'0');
});
