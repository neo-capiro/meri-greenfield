/** Opt-in actual PostgreSQL 16 qualification for conversation 0020. It creates
 * and drops only its own random database on an explicitly attested private
 * Unix-socket cluster. The ordinary test run performs source checks only. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';

const migrations=new URL('../migrations/',import.meta.url);
const sql=await readFile(new URL('0020_next_run_adoptions.sql',migrations),'utf8');
const sha=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const versions={imageDigest:`sha256:${'a'.repeat(64)}`,sdk:'0.3.295',cli:'2.1.295',contracts:'0.1.0',skillsDigest:'b'.repeat(64),checkpointFormat:'0.1.0'};
const newVersions={...versions,imageDigest:`sha256:${'c'.repeat(64)}`};

test('0020 source names every independent first-write fence and rejects missing budget dependencies',()=>{
 for(const [table,column] of [['next_runs','target_run_id'],['runs','run_id'],['initial_run_bindings','run_id']])
  assert.match(sql,new RegExp(`CREATE INDEX next_run_adoption_[a-z_]+_uuid_idx\\s+ON meri_conversations\\.${table} \\(${column}\\) INCLUDE \\(tenant_id,conversation_id\\)`));
 for(const table of ['tenant_run_reservations','grants','tool_grant_bindings','requests','tool_reservations'])
  assert.match(sql,new RegExp(`CREATE INDEX next_run_adoption_[a-z_]+_run_idx\\s+ON meri_product_budget\\.${table} \\(run_id\\)`));
 assert.match(sql,/tool_invocations\(run_id,producer_key_sha256\)/);
 for(const table of ['runs','run_issuances','model_run_issuances','native_allocations','native_executions','native_restorations'])
  assert.match(sql,new RegExp(`CREATE TRIGGER adoption_[a-z_]+ BEFORE INSERT OR UPDATE OR DELETE ON meri_conversations\\.${table}\\b`));
 for(const table of ['runs','tenant_run_reservations','tool_run_allocations','grants','requests','tool_reservations','tool_invocations','tool_grant_bindings'])
  assert.match(sql,new RegExp(`CREATE TRIGGER adoption_[a-z_]+ BEFORE INSERT OR UPDATE OR DELETE ON meri_product_budget\\.${table}\\b`));
 assert.match(sql,/NEXT_RUN_ADOPTION_DEPENDENCY_MISSING/);
 assert.match(sql,/NEXT_RUN_ADOPTION_TARGET_ALREADY_CLAIMED/);
 assert.match(sql,/NEXT_RUN_ADOPTION_SOURCE_GRANT_ACTIVE/);
 assert.match(sql,/NEXT_RUN_ADOPTION_ACCEPTANCE_REFUSED/);
 assert.match(sql,/NEXT_RUN_ADOPTION_ACCEPTED_FACTS_REFUSED/);
 assert.match(sql,/NEXT_RUN_ADOPTION_BUDGET_STATE_REVIVAL/);
 assert.match(sql,/NEXT_RUN_ADOPTION_CLAIM_LOCATOR_IMMUTABLE/);
 assert.match(sql,/NEXT_RUN_ADOPTION_CLAIM_DELETE_REFUSED/);
 assert.match(sql,/Source UNKNOWN model\/tool reservations/);
 assert.match(sql,/retained liabilities/);
 assert.doesNotMatch(sql,/DELETE FROM meri_product_budget|UPDATE meri_product_budget\.requests SET|UPDATE meri_product_budget\.tool_reservations SET/);
});

function privateConfig(env){
 if(env.MERI_ADOPTION_PG_TEST_ISOLATED!=='1'
    ||env.MERI_ADOPTION_PG_TEST_SOCKET!=='/tmp/meri-adoption-pg-20261018/socket'
    ||env.MERI_ADOPTION_PG_TEST_CONTROL_DATABASE!=='postgres'
    ||env.MERI_ADOPTION_PG_TEST_DATA_DIRECTORY!=='/tmp/meri-adoption-pg-20261018/data')
  throw Error('EXPLICIT_PRIVATE_ADOPTION_POSTGRES_REQUIRED');
 return {host:env.MERI_ADOPTION_PG_TEST_SOCKET,database:env.MERI_ADOPTION_PG_TEST_CONTROL_DATABASE,
  dataDirectory:env.MERI_ADOPTION_PG_TEST_DATA_DIRECTORY};
}
test('0020 test harness refuses unapproved local database targets',()=>{
 const env={MERI_ADOPTION_PG_TEST_ISOLATED:'1',MERI_ADOPTION_PG_TEST_SOCKET:'/tmp/meri-adoption-pg-20261018/socket',
  MERI_ADOPTION_PG_TEST_CONTROL_DATABASE:'postgres',MERI_ADOPTION_PG_TEST_DATA_DIRECTORY:'/tmp/meri-adoption-pg-20261018/data'};
 assert.deepEqual(privateConfig(env),{host:env.MERI_ADOPTION_PG_TEST_SOCKET,database:'postgres',dataDirectory:env.MERI_ADOPTION_PG_TEST_DATA_DIRECTORY});
 for(const patch of [{MERI_ADOPTION_PG_TEST_ISOLATED:'0'},{MERI_ADOPTION_PG_TEST_SOCKET:'localhost'},
  {MERI_ADOPTION_PG_TEST_CONTROL_DATABASE:'capiro'},{MERI_ADOPTION_PG_TEST_DATA_DIRECTORY:'/tmp/other/data'}])
  assert.throws(()=>privateConfig({...env,...patch}),/EXPLICIT_PRIVATE_ADOPTION_POSTGRES_REQUIRED/);
});

async function fixture(t){
 const config=privateConfig(process.env),{default:pg}=await import('pg');
 const connection={host:config.host,user:'postgres',ssl:false,connectionTimeoutMillis:3000,
  options:'-c statement_timeout=5000 -c lock_timeout=2000'},
  admin=new pg.Client({...connection,database:config.database}),database=`meri_adoption_${randomUUID().replaceAll('-','')}`;
 const clients=[],roles=[];let oid=null;
 await admin.connect();
 t.after(async()=>{
  await Promise.allSettled(clients.map(client=>client.end()));
  let cleanupError;
  try{if(oid!==null){const rows=(await admin.query('SELECT oid::text FROM pg_database WHERE datname=$1',[database])).rows;
   assert.equal(rows.length,1);assert.equal(rows[0].oid,oid,'drop only the exact fixture-owned database');
   await admin.query(`DROP DATABASE "${database}"`);}}catch(error){cleanupError=error;}
  for(const role of roles)try{await admin.query(`DROP ROLE "${role}"`);}catch(error){cleanupError??=error;}
  await admin.end();if(cleanupError)throw cleanupError;
 });
 const server=(await admin.query("SELECT current_setting('server_version_num') AS version_num,current_setting('listen_addresses') AS addresses,current_setting('data_directory') AS data_directory")).rows[0];
 if(!/^16[0-9]{4}$/.test(server.version_num)||server.addresses!==''||server.data_directory!==config.dataDirectory)
  throw Error('PRIVATE_ADOPTION_POSTGRES_PREFLIGHT_REFUSED');
 assert.equal((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[database])).rowCount,0);
 await admin.query(`CREATE DATABASE "${database}" TEMPLATE template0`);
 oid=(await admin.query('SELECT oid::text FROM pg_database WHERE datname=$1',[database])).rows[0].oid;
 async function connect(){const client=new pg.Client({...connection,database});await client.connect();clients.push(client);return client;}
 const client=await connect();
 // This fixture isolates 0020's fence on the existing through-0017 first-chat
 // schema. Release registration still follows separately owned 0018/0019.
 const names=(await readdir(migrations)).filter(name=>/^00(?:0[1-9]|1[0-7])_[a-z_]+\.sql$/.test(name)).sort();
 for(const name of names)await client.query(await readFile(new URL(name,migrations),'utf8'));
 await client.query(await readFile(new URL('../../../gateway/budget/migrations/0001_product_budget.sql',import.meta.url),'utf8'));
 await client.query(await readFile(new URL('../../../gateway/budget/migrations/0002_tenant_budgets.sql',import.meta.url),'utf8'));
 await client.query(sql);
 async function syntheticAppRole(){
  const role=`meri_adoption_app_${randomUUID().replaceAll('-','')}`;
  await admin.query(`CREATE ROLE "${role}" NOLOGIN`);roles.push(role);
  await client.query(`GRANT USAGE ON SCHEMA meri_conversations TO "${role}"`);
  await client.query(`GRANT SELECT,INSERT ON meri_conversations.next_run_adoptions TO "${role}"`);
  return role;
 }
 return {client,connect,admin,syntheticAppRole};
}

async function seed(client,{retired=false,sourceUnknown=false,missingGrant=false,pendingGrant=false}={}){
 const tenantId=`adoption-${randomUUID()}`,conversationId=randomUUID(),actorId='synthetic-actor',clientId=randomUUID(),policyRevision='synthetic-policy';
 const source={tenantId,conversationId,actorId,runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:1};
 const target={...source,runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:2};
 const scopes=[{tenantId,kind:'client',resourceId:clientId,policyRevision}],now=Date.now(),grantId=randomUUID();
 const conversation={conversationId,owner:{tenantId,actorId},scopes,policyRevision,createdAt:new Date(now-5000).toISOString()};
 const sourceRun={binding:source,state:'failed',scopes,policyRevision,createdAt:conversation.createdAt,versions};
 const request={requestId:randomUUID(),prompt:'synthetic original',skill:null,window:null,windowRequest:null};
 const original={schemaVersion:1,state:'ADMITTED',binding:source,selectedClientId:clientId,policyRevision,versions,
  configurationSha256:'d'.repeat(64),createdAtMs:now-10000,expiresAtMs:now+60000};
 await client.query('INSERT INTO meri_conversations.conversations(tenant_id,conversation_id,owner_actor_id,projection,projection_sha256) VALUES($1,$2,$3,$4,$5)',[tenantId,conversationId,actorId,conversation,sha(conversation)]);
 await client.query('INSERT INTO meri_conversations.runs(tenant_id,conversation_id,run_id,projection,projection_sha256,request_id,request,request_sha256,last_sequence) VALUES($1,$2,$3,$4,$5,$6,$7,$8,0)',[tenantId,conversationId,source.runId,sourceRun,sha(sourceRun),request.requestId,request,sha(request)]);
 await client.query('INSERT INTO meri_conversations.initial_run_bindings(tenant_id,conversation_id,run_id,record,record_sha256) VALUES($1,$2,$3,$4,$5)',[tenantId,conversationId,source.runId,original,sha(original)]);
 let facts,allocation;
 if(retired){
  allocation={binding:source,allocationKey:sha(source),original:{binding:source},state:'RETIRED',grantIntents:[{grantId}],resource:{physicalStopProven:true}};
  facts={checkpoint:null,retirement:{physicalStopProven:true},revocation:{receiptSha256:'e'.repeat(64),grantIds:[grantId]}};
  await client.query('INSERT INTO meri_product_budget.runs(run_id,attempt,worker_arn,fence,policy_revision) VALUES($1,1,$2,1,$3)',[source.runId,'arn:aws:ecs:us-east-1:967807252336:task/Synthetic/'+randomUUID().replaceAll('-',''),'f'.repeat(64)]);
  if(!missingGrant)await client.query("INSERT INTO meri_product_budget.grants(grant_id,run_id,attempt,worker_arn,fence,policy_revision,capability_sha256,expires_at,state) VALUES($1,$2,1,'synthetic',1,$3,$4,now()+interval '1 hour',$5)",[grantId,source.runId,'f'.repeat(64),sha(grantId),pendingGrant?'PENDING':'ACTIVE']);
  if(sourceUnknown)await client.query("INSERT INTO meri_product_budget.requests(request_id,grant_id,run_id,attempt,worker_arn,fence,policy_revision,native_body_sha256,raw_request_sha256,model_id,profile_id,pricing_revision,pricing_valid_until,input_tokens,max_output_tokens,hold_micro_usd,state) VALUES($1,$2,$3,1,'synthetic',1,$4,$5,$5,'model','profile',$5,now()+interval '1 hour',1,1,5,'UNKNOWN')",['source-unknown-'+randomUUID(),grantId,source.runId,'f'.repeat(64),'a'.repeat(64)]);
  if(!missingGrant&&!pendingGrant)await client.query("UPDATE meri_product_budget.grants SET state='REVOKED' WHERE grant_id=$1",[grantId]);
 }else{
  allocation={binding:source,allocationKey:sha(source),state:'FORECLOSED',foreclosure:{eventId:randomUUID(),eventSha256:'a'.repeat(64),state:'failed'}};
  facts={checkpoint:null,noAuthority:{foreclosureSha256:sha(allocation)}};
 }
 await client.query('INSERT INTO meri_conversations.native_allocations(tenant_id,conversation_id,run_id,intent_key,record,record_sha256) VALUES($1,$2,$3,$4,$5,$6)',[tenantId,conversationId,source.runId,sha(source),allocation,sha(allocation)]);
 const reservation={source,target,facts,scopes,versions,policyRevision,reservedAt:new Date(now-1000).toISOString()};
 await client.query("INSERT INTO meri_conversations.next_runs(tenant_id,conversation_id,source_run_id,target_run_id,reservation,reservation_sha256,state) VALUES($1,$2,$3,$4,$5,$6,'RESERVED')",[tenantId,conversationId,source.runId,target.runId,reservation,sha(reservation)]);
 const receipt={schemaVersion:1,source,target,originalAdmissionSha256:sha(original),reservationSha256:sha(reservation),selectedClientId:clientId,
  scopes,policyRevision,fromConfigurationSha256:original.configurationSha256,fromVersions:versions,toConfigurationSha256:'1'.repeat(64),toVersions:newVersions,
  authorityDecisionSha256:'2'.repeat(64),authorityCheckedAtMs:now,authorityExpiresAtMs:now+60000,adoptedAtMs:now,validUntilMs:now+30000};
 const receiptSha256=sha(receipt);
 const adoptionParams=[tenantId,conversationId,target.runId,receipt,receiptSha256];
 const adopt=(c=client)=>c.query('INSERT INTO meri_conversations.next_run_adoptions(tenant_id,conversation_id,target_run_id,receipt,receipt_sha256) VALUES($1,$2,$3,$4,$5)',adoptionParams);
 const task=(c=client,transition=null)=>c.query("INSERT INTO meri_conversations.run_issuances(issuance_key,tenant_id,conversation_id,run_id,binding,binding_sha256,request_sha256,expires_at_ms,state,claim_fence,transition_sha256) VALUES($1,$2,$3,$4,$5,$1,$6,$7,'CLAIMED',$8,$9)",[sha(target),tenantId,conversationId,target.runId,target,'3'.repeat(64),now+30000,randomUUID(),transition]);
 const product=(c=client,transition=null)=>c.query('INSERT INTO meri_product_budget.runs(run_id,attempt,worker_arn,fence,policy_revision,transition_sha256) VALUES($1,1,$2,2,$3,$4)',[target.runId,'synthetic','f'.repeat(64),transition]);
 const accept=async(c=client)=>{
  await c.query('UPDATE meri_conversations.runs SET sequence_end=0 WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3',[tenantId,conversationId,source.runId]);
  const targetRun={binding:target,state:'queued',scopes,policyRevision,createdAt:new Date().toISOString(),versions:newVersions};
  const nextRequest={requestId:randomUUID(),prompt:'synthetic new input',skill:null,window:null,windowRequest:null};
  await c.query('INSERT INTO meri_conversations.runs(tenant_id,conversation_id,run_id,projection,projection_sha256,request_id,request,request_sha256,last_sequence,sequence_base,transition_sha256) VALUES($1,$2,$3,$4,$5,$6,$7,$8,0,0,$9)',
   [tenantId,conversationId,target.runId,targetRun,sha(targetRun),nextRequest.requestId,nextRequest,sha(nextRequest),receiptSha256]);
  await c.query("UPDATE meri_conversations.next_runs SET state='ACCEPTED' WHERE tenant_id=$1 AND conversation_id=$2 AND target_run_id=$3",[tenantId,conversationId,target.runId]);
 };
 return {tenantId,conversationId,source,target,grantId,receipt,receiptSha256,adopt,accept,task,product};
}

const pgEnabled=process.env.MERI_ADOPTION_PG_TEST_ISOLATED==='1';
async function assertBlocked(admin,holderPid,waiterPid){
 const deadline=Date.now()+1000;
 while(Date.now()<deadline){const row=(await admin.query('SELECT $1::int=ANY(pg_blocking_pids($2::int)) AS blocked',[holderPid,waiterPid])).rows[0];
  if(row.blocked)return;await new Promise(resolve=>setTimeout(resolve,10));}
 assert.fail('expected actual PostgreSQL conversation lock wait');
}
test('0020 adoption preserves source UNKNOWN liability but refuses any target UNKNOWN claim', {skip:!pgEnabled},async t=>{
 const f=await fixture(t),x=await seed(f.client,{retired:true,sourceUnknown:true});
 await x.adopt();
 assert.equal((await f.client.query("SELECT state FROM meri_product_budget.requests WHERE run_id=$1",[x.source.runId])).rows[0].state,'UNKNOWN');
 await assert.rejects(f.client.query("INSERT INTO meri_product_budget.grants(grant_id,run_id,attempt,worker_arn,fence,policy_revision,capability_sha256,expires_at,state) VALUES($1,$2,1,'synthetic',1,$3,$4,now()+interval '1 hour','PENDING')",
  [randomUUID(),x.source.runId,'f'.repeat(64),'9'.repeat(64)]),/NEXT_RUN_ADOPTION_SOURCE_SUPERSEDED/);
 const y=await seed(f.client,{retired:false});
 await f.client.query('BEGIN');
 await y.product(f.client);
 const targetGrant=randomUUID();
 await f.client.query("INSERT INTO meri_product_budget.grants(grant_id,run_id,attempt,worker_arn,fence,policy_revision,capability_sha256,expires_at,state) VALUES($1,$2,1,'synthetic',2,$3,$4,now()+interval '1 hour','PENDING')",[targetGrant,y.target.runId,'f'.repeat(64),'8'.repeat(64)]);
 await f.client.query("INSERT INTO meri_product_budget.requests(request_id,grant_id,run_id,attempt,worker_arn,fence,policy_revision,native_body_sha256,raw_request_sha256,model_id,profile_id,pricing_revision,pricing_valid_until,input_tokens,max_output_tokens,hold_micro_usd,state) VALUES($1,$2,$3,1,'synthetic',2,$4,$5,$5,'model','profile',$5,now()+interval '1 hour',1,1,5,'UNKNOWN')",['target-unknown-'+randomUUID(),targetGrant,y.target.runId,'f'.repeat(64),'a'.repeat(64)]);
 await assert.rejects(y.adopt(),/NEXT_RUN_ADOPTION_TARGET_ALREADY_CLAIMED/);
 await f.client.query('ROLLBACK');
 const z=await seed(f.client);
 await f.client.query('BEGIN');
 await z.product();
 await f.client.query('INSERT INTO meri_product_budget.tool_run_allocations(run_id,allocation_sha256,allocation,max_tool_calls,max_cost_micro_usd) VALUES($1,$2,$3,1,1)',
  [z.target.runId,'7'.repeat(64),{}]);
 const toolGrant=randomUUID();
 await f.client.query("INSERT INTO meri_product_budget.grants(grant_id,run_id,attempt,worker_arn,fence,policy_revision,capability_sha256,expires_at,state) VALUES($1,$2,1,'synthetic',2,$3,$4,now()+interval '1 hour','PENDING')",
  [toolGrant,z.target.runId,'f'.repeat(64),'6'.repeat(64)]);
 await f.client.query('INSERT INTO meri_product_budget.tool_grant_bindings(grant_id,run_id,facts) VALUES($1,$2,$3)',[toolGrant,z.target.runId,{}]);
 await f.client.query("INSERT INTO meri_product_budget.tool_reservations(invocation_id,reservation_id,grant_id,run_id,facts,operation,arguments_sha256,hold_micro_usd,max_output_bytes,state) VALUES($1,$2,$3,$4,$5,$6,$7,1,1,'UNKNOWN')",
  ['owned_'+randomUUID(),randomUUID(),toolGrant,z.target.runId,{},{} ,'5'.repeat(64)]);
 await assert.rejects(z.adopt(),/NEXT_RUN_ADOPTION_TARGET_ALREADY_CLAIMED/);
 await f.client.query('ROLLBACK');
});

test('0020 retired source needs every exact revoked grant, with no missing row', {skip:!pgEnabled},async t=>{
 const f=await fixture(t),x=await seed(f.client,{retired:true,missingGrant:true});
 await assert.rejects(x.adopt(),/NEXT_RUN_ADOPTION_REVOCATION_REFUSED/);
});

test('0020 product writer cannot preclaim an unlocated future reservation UUID', {skip:!pgEnabled},async t=>{
 const f=await fixture(t);
 await assert.rejects(f.client.query('INSERT INTO meri_product_budget.runs(run_id,attempt,worker_arn,fence,policy_revision) VALUES($1,1,$2,1,$3)',
  [randomUUID(),'synthetic','f'.repeat(64)]),/NEXT_RUN_ADOPTION_PRODUCT_RUN_UNBOUND/);
});

test('0020 rejects a future-dated adoption despite a still-valid authority expiry', {skip:!pgEnabled},async t=>{
 const f=await fixture(t),x=await seed(f.client),future={...x.receipt,adoptedAtMs:Date.now()+6000};
 await assert.rejects(f.client.query('INSERT INTO meri_conversations.next_run_adoptions(tenant_id,conversation_id,target_run_id,receipt,receipt_sha256) VALUES($1,$2,$3,$4,$5)',
  [x.tenantId,x.conversationId,x.target.runId,future,sha(future)]),/NEXT_RUN_ADOPTION_CLOCK_REFUSED/);
});

test('0020 serializes adoption with stale task and product claim writers', {skip:!pgEnabled},async t=>{
 const f=await fixture(t),x=await seed(f.client),writer=await f.connect();
 await f.client.query('BEGIN');await x.adopt();
 const writerPid=(await writer.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
 const holderPid=(await f.client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
 const attempt=x.task(writer);
 await assertBlocked(f.admin,holderPid,writerPid);
 await f.client.query('COMMIT');
 await assert.rejects(attempt,/NEXT_RUN_ADOPTION_TRANSITION_REFUSED/);
 await assert.rejects(x.product(writer),/NEXT_RUN_ADOPTION_TRANSITION_REFUSED/);
 await assert.rejects(x.task(writer,x.receiptSha256),/NEXT_RUN_ADOPTION_ACCEPTANCE_REFUSED/);
 await assert.rejects(x.product(writer,x.receiptSha256),/NEXT_RUN_ADOPTION_ACCEPTANCE_REFUSED/);
 await x.accept();
 await x.task(writer,x.receiptSha256);
 await x.product(writer,x.receiptSha256);
});

test('0020 refuses claim relocation, deletion and a false task binding', {skip:!pgEnabled},async t=>{
 const f=await fixture(t),x=await seed(f.client,{retired:true,sourceUnknown:true});
 await assert.rejects(f.client.query('UPDATE meri_product_budget.requests SET run_id=$1 WHERE run_id=$2',
  [x.target.runId,x.source.runId]),/NEXT_RUN_ADOPTION_CLAIM_LOCATOR_IMMUTABLE/);
 await assert.rejects(f.client.query('DELETE FROM meri_product_budget.grants WHERE grant_id=$1',
  [x.grantId]),/NEXT_RUN_ADOPTION_CLAIM_DELETE_REFUSED/);
 await assert.rejects(f.client.query("INSERT INTO meri_conversations.run_issuances(issuance_key,tenant_id,conversation_id,run_id,binding,binding_sha256,request_sha256,expires_at_ms,state,claim_fence) VALUES($1,$2,$3,$4,$5,$1,$6,$7,'CLAIMED',$8)",
  [sha(x.target),x.tenantId,x.conversationId,x.target.runId,x.source,'3'.repeat(64),Date.now()+30000,randomUUID()]),/NEXT_RUN_ADOPTION_CLAIM_BINDING_REFUSED/);
});

test('0020 narrow conversation app role inserts and reads adoption through definer trigger without product SELECT', {skip:!pgEnabled},async t=>{
 const f=await fixture(t),x=await seed(f.client),role=await f.syntheticAppRole();
 await f.client.query(`SET ROLE "${role}"`);
 try{
  assert.equal((await f.client.query("SELECT has_schema_privilege(current_user,'meri_product_budget','USAGE') AS allowed")).rows[0].allowed,false);
  await assert.rejects(f.client.query('SELECT count(*) FROM meri_product_budget.grants'),/permission denied/);
  await x.adopt();
  assert.equal((await f.client.query('SELECT receipt_sha256 FROM meri_conversations.next_run_adoptions WHERE target_run_id=$1',
   [x.target.runId])).rows[0].receipt_sha256,x.receiptSha256);
 }finally{await f.client.query('RESET ROLE');}
});

test('0020 inherited Run facts stay pinned through descendants and accepted Run updates', {skip:!pgEnabled},async t=>{
 const f=await fixture(t),x=await seed(f.client);
 await x.adopt();await x.accept();
 const saved=(await f.client.query('SELECT projection FROM meri_conversations.runs WHERE run_id=$1',[x.target.runId])).rows[0].projection;
 for(const changed of [{...saved,scopes:[]},{...saved,policyRevision:'changed-policy'}])
  await assert.rejects(f.client.query('UPDATE meri_conversations.runs SET projection=$1,projection_sha256=$2 WHERE run_id=$3',
   [changed,sha(changed),x.target.runId]),/NEXT_RUN_ADOPTION_CLAIM_BINDING_IMMUTABLE/);
 const terminal={...saved,state:'failed'};
 await f.client.query('UPDATE meri_conversations.runs SET projection=$1,projection_sha256=$2,sequence_end=0 WHERE run_id=$3',
  [terminal,sha(terminal),x.target.runId]);
 const child={...x.target,runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID(),writerFence:3};
 const reservation={source:x.target,target:child,facts:{checkpoint:null,noAuthority:{foreclosureSha256:'a'.repeat(64)}},
  scopes:x.receipt.scopes,versions:x.receipt.toVersions,policyRevision:x.receipt.policyRevision,reservedAt:new Date().toISOString()};
 await f.client.query("INSERT INTO meri_conversations.next_runs(tenant_id,conversation_id,source_run_id,target_run_id,reservation,reservation_sha256,state) VALUES($1,$2,$3,$4,$5,$6,'RESERVED')",
  [x.tenantId,x.conversationId,x.target.runId,child.runId,reservation,sha(reservation)]);
 const request={requestId:randomUUID(),prompt:'synthetic descendant input',skill:null,window:null,windowRequest:null};
 const insert=projection=>f.client.query('INSERT INTO meri_conversations.runs(tenant_id,conversation_id,run_id,projection,projection_sha256,request_id,request,request_sha256,last_sequence,sequence_base,transition_sha256) VALUES($1,$2,$3,$4,$5,$6,$7,$8,0,0,$9)',
  [x.tenantId,x.conversationId,child.runId,projection,sha(projection),request.requestId,request,sha(request),x.receiptSha256]);
 const good={binding:child,state:'queued',scopes:x.receipt.scopes,policyRevision:x.receipt.policyRevision,
  createdAt:new Date().toISOString(),versions:x.receipt.toVersions};
 await assert.rejects(insert({...good,versions:{...good.versions,imageDigest:`sha256:${'e'.repeat(64)}`}}),/NEXT_RUN_ADOPTION_ACCEPTED_FACTS_REFUSED/);
 await assert.rejects(insert({...good,scopes:[]}),/NEXT_RUN_ADOPTION_ACCEPTED_FACTS_REFUSED/);
 await assert.rejects(insert({...good,policyRevision:'changed-policy'}),/NEXT_RUN_ADOPTION_ACCEPTED_FACTS_REFUSED/);
 await insert(good);
 await f.client.query("UPDATE meri_conversations.next_runs SET state='ACCEPTED' WHERE tenant_id=$1 AND conversation_id=$2 AND target_run_id=$3",
  [x.tenantId,x.conversationId,child.runId]);
});

test('0020 terminal budget states and superseded grants cannot regain effect', {skip:!pgEnabled},async t=>{
 const f=await fixture(t),x=await seed(f.client,{retired:true,sourceUnknown:true});
 await x.adopt();
 await assert.rejects(f.client.query("UPDATE meri_product_budget.grants SET state='ACTIVE' WHERE grant_id=$1",[x.grantId]),
  /NEXT_RUN_ADOPTION_REVOKED_GRANT_TERMINAL/);
 await f.client.query("UPDATE meri_product_budget.requests SET state='NO_DISPATCH',actual_micro_usd=0,evidence_sha256=$1,settled_at=clock_timestamp() WHERE run_id=$2",
  ['f'.repeat(64),x.source.runId]);
 await assert.rejects(f.client.query("UPDATE meri_product_budget.requests SET state='UNKNOWN',actual_micro_usd=NULL,evidence_sha256=NULL,settled_at=NULL WHERE run_id=$1",
  [x.source.runId]),/NEXT_RUN_ADOPTION_BUDGET_STATE_REVIVAL/);
 const y=await seed(f.client,{retired:true,pendingGrant:true});
 await assert.rejects(f.client.query("UPDATE meri_product_budget.grants SET state='ACTIVE' WHERE grant_id=$1",[y.grantId]),
  /NEXT_RUN_ADOPTION_SOURCE_SUPERSEDED/);
});

test('0020 existing task claim wins before adoption; rolled-back budget claim does not', {skip:!pgEnabled},async t=>{
 const f=await fixture(t),writer=await f.connect(),x=await seed(f.client);
 await writer.query('BEGIN');await x.task(writer);
 const writerPid=(await writer.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
 const adopterPid=(await f.client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
 const denied=x.adopt();await assertBlocked(f.admin,writerPid,adopterPid);
 await writer.query('COMMIT');await assert.rejects(denied,/NEXT_RUN_ADOPTION_TARGET_ALREADY_CLAIMED/);

 const y=await seed(f.client);
 await writer.query('BEGIN');await y.product(writer);
 const admitted=y.adopt();await assertBlocked(f.admin,writerPid,adopterPid);
 await writer.query('ROLLBACK');await admitted;
 assert.equal((await f.client.query('SELECT receipt_sha256 FROM meri_conversations.next_run_adoptions WHERE target_run_id=$1',[y.target.runId])).rows[0].receipt_sha256,y.receiptSha256);
});
