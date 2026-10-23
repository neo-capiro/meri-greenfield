/** Root-operated disposable PG16 gate. Never reads ambient PG connection settings. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import pg from 'pg';
import {PLAN,DATABASE_SCRIPT,INTEGRATION_SCRIPT,runPsqlScript} from '../../../infra/product-preview/first-chat-migrate.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {runOwnerFixture} from './run-owner.fixture.mjs';
import {createPostgresRunOwner} from './run-owner.mjs';
import {createDurableSdkSessionOwner} from '../../runtime/native-authority/session-owner.mjs';
import {createPostgresConversationStore} from '../conversations/postgres-store.mjs';
import {sdkUsageSnapshot} from '../conversations/usage.mjs';
import {productFailure} from '../product-access/errors.mjs';

const enabled=process.env.MERI_STEP2_PG==='1',socket=process.env.MERI_STEP2_PG_SOCKET;
const id=n=>`22222222-2222-4222-8222-${String(n).padStart(12,'0')}`;
const noop=()=>{};
const sdkGrantsPath='apps/control/conversations/migrations/0022_sdk_run_usage_grants.sql';
async function pinnedText(path){
 const entry=PLAN.find(e=>e.path===path);assert.ok(entry,path);
 const bytes=await readFile(new URL('../../../'+path,import.meta.url));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.pinned,path+' exact Git bytes');
 return bytes.toString('utf8');
}
/** Only baseline grants for this existing fixture's schemas, taken from the real phase interpreter.
 * No copied privilege list and no administrator/SET ROLE connection masquerading as control. */
async function controlPools(t,admin,options){
 assert.equal((await admin.query("SELECT count(*)::int AS n FROM pg_roles WHERE rolname='meri_control_runtime'")).rows[0].n,0,'fresh disposable cluster role required');
 await admin.query('CREATE ROLE meri_control_runtime LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS');
 for(const [path,phase] of [[DATABASE_SCRIPT,'meri_grants'],[INTEGRATION_SCRIPT,'integration_grants']]){
  const statements=[];
  await runPsqlScript({text:await pinnedText(path),variables:{['phase_'+phase]:'1'},connect:async()=>({async query(sql){if(typeof sql==='string')statements.push(sql.replace(/\s+/gu,' ').trim());return {rows:[]};},async end(){}})});
  for(const sql of statements){
   const grant=/^GRANT (.+?) ON (?:(TABLE|SEQUENCE|SCHEMA) )?(.+?) TO (.+?);$/u.exec(sql);
   if(!grant||!grant[4].split(',').map(s=>s.trim()).includes('meri_control_runtime'))continue;
   const kind=grant[2]??'TABLE',objects=grant[3].split(',').map(s=>s.trim()).filter(s=>kind==='SCHEMA'?['meri_conversations','meri_settings'].includes(s):/^(meri_conversations|meri_settings)\.[a-z_]+$/u.test(s));
   if(objects.length)await admin.query(`GRANT ${grant[1]} ON ${kind} ${objects.join(',')} TO meri_control_runtime`);
  }
 }
 const denied=[],pools=[0,1].map(()=>new pg.Pool({...options,user:'meri_control_runtime',max:2}));
 t.after(async()=>{await Promise.all(pools.map(p=>p.end()));});
 const wrap=pool=>({async connect(){const client=await pool.connect();return {async query(...args){try{return await client.query(...args);}catch(e){if(e.code==='42501')denied.push(String(args[0]));throw e;}},release:e=>client.release(e)};}});
 for(const pool of pools){
  const role=(await pool.query('SELECT current_user,session_user,rolsuper,rolinherit,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];
  assert.deepEqual(role,{current_user:'meri_control_runtime',session_user:'meri_control_runtime',rolsuper:false,rolinherit:false,rolcreatedb:false,rolcreaterole:false,rolreplication:false,rolbypassrls:false});
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM pg_auth_members WHERE member=current_user::regrole")).rows[0].n,0);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM pg_class WHERE oid IN ('meri_conversations.runs'::regclass,'meri_settings.tenant_settings'::regclass) AND relowner=current_user::regrole")).rows[0].n,0);
 }
 return {pool:pools[0],wrapped:pools.map(wrap),denied};
}
async function blocked(pool,pid){
 const end=Date.now()+1500;
 while(Date.now()<end){if((await pool.query('SELECT cardinality(pg_blocking_pids($1))>0 AS blocked',[pid])).rows[0].blocked)return;await new Promise(r=>setTimeout(r,10));}
 assert.fail('contender never reached a PostgreSQL lock wait');
}
test('actual migration, canonical current run/session, contention and idempotent SDK accounting', {skip:!enabled,timeout:30000},async t=>{
 assert.match(socket??'',/^\/tmp\/meri-step2-[a-z0-9-]+\/socket$/u);
 const options={host:socket,database:'meri_step2',user:'postgres',max:8,connectionTimeoutMillis:2000};
 const pool=new pg.Pool(options),contender=new pg.Pool({...options,max:1,application_name:'meri-step2-contender'});
 t.after(async()=>{await contender.end();await pool.end();});
 const server=(await pool.query("SELECT current_setting('listen_addresses') AS listen,current_database() AS db,version() AS version")).rows[0];
 assert.equal(server.listen,'');assert.equal(server.db,'meri_step2');assert.match(server.version,/^PostgreSQL 16\./u);
 assert.equal((await pool.query("SELECT count(*)::int AS n FROM pg_namespace WHERE nspname IN ('meri_conversations','meri_product_budget','meri_settings')")).rows[0].n,0,'fresh disposable database required; no truncation or drops');
 const migrations=PLAN.filter(e=>e.kind==='migration'&&e.path!==sdkGrantsPath&&(e.path.startsWith('apps/control/conversations/migrations/')||e.path.startsWith('apps/gateway/budget/migrations/')||e.path==='apps/control/settings/migrations/0001_settings.sql'));
 for(const entry of migrations){
  if(entry.path.endsWith('0021_sdk_run_usage.sql')){
   await pool.query("INSERT INTO meri_product_budget.tenant_budgets(tenant_id,monthly_cap_micro_usd,max_concurrent_runs) VALUES('legacy-settings',123456789,2),('legacy-no-settings',987654321,2)");
   const document={defaultTimezone:'Europe/London',capabilityPolicy:{}};
   await pool.query("INSERT INTO meri_settings.tenant_settings(tenant_id,revision,document,document_sha256,updated_at,updated_by) VALUES('legacy-settings',7,$1,$2,clock_timestamp(),'synthetic')",[document,hash(document)]);
  }
  const bytes=await readFile(new URL('../../../'+entry.path,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.pinned,entry.path+' exact Git bytes');
  await pool.query(bytes.toString('utf8'));
 }
 const policies=(await pool.query('SELECT * FROM meri_settings.tenant_settings ORDER BY tenant_id')).rows;
 assert.equal(policies[0].tenant_id,'legacy-no-settings');assert.equal(policies[0].monthly_cap_micro_usd,'987654321');assert.equal(policies[0].document_sha256,hash(policies[0].document));
 assert.equal(policies[1].monthly_cap_micro_usd,'123456789');assert.equal(policies[1].revision,'7');assert.equal(policies[1].document.defaultTimezone,'Europe/London');assert.equal(policies[1].document_sha256,hash(policies[1].document));
 assert.ok(policies.every(p=>p.sdk_max_turns===20&&p.sdk_max_budget_micro_usd==='2000000'));

 const f=runOwnerFixture({at:Date.now()-1000,leaseMs:120000}),{state,binding,grantId}=f,tuple=[binding.tenantId,binding.conversationId,binding.runId];
 // Fresh direct SDK admission has one task grant. There is no model grant or financial budget row.
 state.allocation.record.grantIntents=state.allocation.record.grantIntents.filter(g=>g.grantId===grantId);
 state.allocation.record.resource.grantFactsJsons=state.allocation.record.resource.grantFactsJsons.filter(g=>JSON.parse(g).grantId===grantId);
 state.allocation.record_sha256=hash(state.allocation.record);
 const c=state.conversation,r=state.runs[0],q=state.qualified,g=state.grants.find(g=>g.grant_id===grantId),fact=state.bound.find(g=>g.grant_id===grantId).facts;
 await pool.query('INSERT INTO meri_conversations.conversations(tenant_id,conversation_id,owner_actor_id,projection,projection_sha256) VALUES($1,$2,$3,$4,$5)',[c.tenant_id,c.conversation_id,c.owner_actor_id,c.projection,c.projection_sha256]);
 await pool.query('INSERT INTO meri_conversations.runs(tenant_id,conversation_id,run_id,projection,projection_sha256,request_id,request,request_sha256,last_sequence) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[...tuple,r.projection,r.projection_sha256,r.request_id,r.request,r.request_sha256,r.last_sequence]);
 // The current run projection has reached sequence 3; readback requires its complete event history.
 for(const [index,state] of ['queued','starting','running'].entries()){
  const event={contractVersion:'0.1.0',eventId:id(30+index),binding,sequence:index+1,createdAt:r.projection.createdAt,scopes:r.projection.scopes,type:'run.status',data:{state,reasonCode:null}};
  await pool.query('INSERT INTO meri_conversations.events(tenant_id,conversation_id,run_id,sequence,event_id,event,event_sha256) VALUES($1,$2,$3,$4,$5,$6,$7)',[...tuple,event.sequence,event.eventId,event,hash(event)]);
 }
 await pool.query('INSERT INTO meri_conversations.native_allocations(tenant_id,conversation_id,run_id,intent_key,record,record_sha256) VALUES($1,$2,$3,$4,$5,$6)',[...tuple,state.allocation.intent_key,state.allocation.record,state.allocation.record_sha256]);
 await pool.query('INSERT INTO meri_product_budget.runs(run_id,attempt,worker_arn,fence,policy_revision) VALUES($1,$2,$3,$4,$5)',[q.run_id,q.attempt,q.worker_arn,q.fence,q.policy_revision]);
 await pool.query('INSERT INTO meri_product_budget.grants(grant_id,run_id,attempt,worker_arn,fence,policy_revision,capability_sha256,expires_at,state) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[grantId,q.run_id,q.attempt,q.worker_arn,q.fence,q.policy_revision,g.capability_sha256,g.expires_at,g.state]);
 await pool.query('INSERT INTO meri_product_budget.tool_run_allocations(run_id,allocation_sha256,allocation,max_tool_calls,max_cost_micro_usd) VALUES($1,$2,$3,1,1)',[q.run_id,fact.allocationSha256,{}]);
 await pool.query('INSERT INTO meri_product_budget.tool_grant_bindings(grant_id,run_id,facts) VALUES($1,$2,$3)',[grantId,q.run_id,fact]);
 const owner=createPostgresRunOwner({pool,binding,grantId,expiresAtMs:f.expiresAtMs,maxRequestMs:5000});
 assert.deepEqual(JSON.parse(await owner.currentRun(binding)).binding,binding);
 assert.equal((await pool.query('SELECT count(*)::int AS n FROM meri_product_budget.budget')).rows[0].n,0);
 const authority={async verify({binding:b,operation,inputSha256}){const current=JSON.parse(await owner.currentTaskRun(b));return {binding:b,operation,inputSha256,identityCredential:'synthetic-only',scopes:r.projection.scopes,selectedClientId:r.projection.scopes[0].resourceId,policyRevision:current.policyRevision,authorizationDecisionId:'synthetic-core-current',checkedAtMs:Date.now(),expiresAtMs:current.deadlineMs};}};
 const sessions=createDurableSdkSessionOwner({admission:owner,authority,enabled:true,maxRequestMs:5000}),key={projectKey:'native.opaque.project',sessionId:id(1)},credential='synthetic-task';
 const register=key=>sessions.register({credential,request:{binding,key}});
 assert.equal((await register(key)).registered,true);
 await assert.rejects(register({...key,sessionId:id(2)}),/SDK_SESSION_REGISTRATION_CONFLICT/);
 const entries=[{type:'system',marker:'synthetic'}],append={binding,key,appendId:id(3),expectedOffset:0,entriesSha256:hash(entries),entries};
 assert.equal((await sessions.append({credential,request:append})).added,1);
 assert.equal((await sessions.append({credential,request:append})).added,1,'same receipt, not another insertion');
 assert.equal((await pool.query('SELECT count(*)::int AS n FROM meri_conversations.sdk_session_entries')).rows[0].n,1);

 const pid=(await contender.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
 let resume,entered,escaped;const wait=new Promise(r=>resume=r),inside=new Promise(r=>entered=r);
 const guarded=owner.withCurrentRun({binding},async({client})=>{escaped=client;entered();await wait;return 'saved';});await inside;
 const revocation=contender.query("UPDATE meri_product_budget.grants SET state='REVOKED' WHERE grant_id=$1",[grantId]);
 await blocked(pool,pid);resume();assert.equal(await guarded,'saved');await revocation;
 await assert.rejects(escaped.query('SELECT 1'),/CURRENT_RUN_EFFECT_CLOSED/);
 await assert.rejects(owner.currentRun(binding),/CURRENT_RUN_REFUSED/);
 await assert.rejects(register(key));
 await pool.query("UPDATE meri_product_budget.grants SET state='ACTIVE' WHERE grant_id=$1",[grantId]);
 const store=createPostgresConversationStore({pool}),competingStore=createPostgresConversationStore({pool:contender});
 let releaseRun,enteredRun;const runWait=new Promise(r=>releaseRun=r),runInside=new Promise(r=>enteredRun=r);
 const held=owner.withCurrentRun({binding},async()=>{enteredRun();await runWait;return 'session-flushed';});await runInside;
 const completion=competingStore.append(binding,{eventId:id(4),createdAt:new Date().toISOString(),type:'run.status',data:{state:'completed',reasonCode:null}},noop);
 await blocked(pool,pid);releaseRun();assert.equal(await held,'session-flushed');await completion;
 await assert.rejects(owner.currentRun(binding),/CURRENT_RUN_REFUSED/);
 assert.equal((await store.read(binding,{},noop)).run.state,'completed');

 const usage={usage:sdkUsageSnapshot({type:'result',session_id:key.sessionId,total_cost_usd:0.01,modelUsage:{'us.anthropic.claude-sonnet-4-6':{inputTokens:100,outputTokens:20,cacheReadInputTokens:200,cacheCreationInputTokens:40,webSearchRequests:0,costUSD:0.01,provider:'bedrock',costBasis:'list'}}}),toolsUsed:{tools:[],omitted:0}};
 const policyDocument={defaultTimezone:'UTC',capabilityPolicy:{}};
 await pool.query('INSERT INTO meri_settings.tenant_settings(tenant_id,revision,document,document_sha256,updated_at,updated_by,monthly_cap_micro_usd) VALUES($1,1,$2,$3,clock_timestamp(),\'synthetic\',1000000)',[binding.tenantId,policyDocument,hash(policyDocument)]);
 const control=await controlPools(t,pool,options),controlStore=createPostgresConversationStore({pool:control.wrapped[0]}),otherControlStore=createPostgresConversationStore({pool:control.wrapped[1]});
 await assert.rejects(controlStore.readModelPolicy(binding,noop),e=>e.code==='42501');
 await assert.rejects(controlStore.recordUsage({binding,scopes:r.projection.scopes,input:usage},noop),/SDK_USAGE_STORE_UNAVAILABLE/);
 assert.equal(control.denied.length,2);assert.match(control.denied[0],/FROM meri_settings\.tenant_settings/u);assert.match(control.denied[1],/^UPDATE meri_conversations\.runs SET sdk_usage=/u);
 assert.equal((await pool.query('SELECT sdk_usage FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3',tuple)).rows[0].sdk_usage,null);
 const grants=await pinnedText(sdkGrantsPath);await pool.query(grants);await pool.query(grants); // Exact forward GRANT is idempotent.
 control.denied.length=0;
 assert.deepEqual(await controlStore.readModelPolicy(binding,noop),{monthlyCapMicroUsd:1000000,maxTurns:20,maxBudgetMicroUsd:2000000});
 for(const change of [{tenantId:'other'},{actorId:'other'},{conversationId:id(70)},{runId:id(71)},{attemptId:id(72)},{workerId:id(73)},{writerFence:2}]){
  await assert.rejects(controlStore.readModelPolicy({...binding,...change},noop));
  await assert.rejects(controlStore.recordUsage({binding:{...binding,...change},scopes:r.projection.scopes,input:usage},noop));
 }
 await assert.rejects(controlStore.recordUsage({binding,scopes:[{...r.projection.scopes[0],resourceId:id(74)}],input:usage},noop),/STALE_WRITER/);
 assert.deepEqual(control.denied,[],'binding/scope refusals are real owner checks, not privilege failures');
 const calls=await Promise.all([controlStore.recordUsage({binding,scopes:r.projection.scopes,input:usage},noop),otherControlStore.recordUsage({binding,scopes:r.projection.scopes,input:usage},noop)]);
 assert.deepEqual(calls.map(v=>v.replayed).sort(),[false,true]);
 const saved=(await pool.query('SELECT sdk_usage,sdk_usage_sha256,sdk_charge_micro_usd FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3',tuple)).rows[0];
 assert.equal(saved.sdk_charge_micro_usd,'891');assert.equal(saved.sdk_usage_sha256,hash(saved.sdk_usage));
 await assert.rejects(controlStore.recordUsage({binding,scopes:r.projection.scopes,input:{...usage,toolsUsed:{tools:[],omitted:1}}},noop),/SDK_USAGE_REPLAY_REFUSED/);
 // A policy read grant never authorizes a policy write, row lock, or unrelated document read.
 for(const sql of ['SELECT * FROM meri_settings.tenant_settings','SELECT document FROM meri_settings.tenant_settings',
  'SELECT monthly_cap_micro_usd FROM meri_settings.tenant_settings FOR SHARE',
  'INSERT INTO meri_settings.tenant_settings DEFAULT VALUES','DELETE FROM meri_settings.tenant_settings',
  ...['tenant_id','monthly_cap_micro_usd','sdk_max_turns','sdk_max_budget_micro_usd','revision','document','document_sha256','updated_at','updated_by'].map(c=>`UPDATE meri_settings.tenant_settings SET ${c}=${c}`),
  'UPDATE meri_conversations.runs SET request=request'])await assert.rejects(control.pool.query(sql),e=>e.code==='42501',sql);
 const acceptInput=()=>{const b={...binding,conversationId:randomUUID(),runId:randomUUID(),attemptId:randomUUID(),workerId:randomUUID()},at=new Date().toISOString();return {
  conversation:{...c.projection,conversationId:b.conversationId,createdAt:at},run:{...r.projection,binding:b,state:'queued',createdAt:at},request:{...r.request,requestId:randomUUID()},
  event:{contractVersion:'0.1.0',eventId:randomUUID(),binding:b,sequence:1,createdAt:at,scopes:r.projection.scopes,type:'run.status',data:{state:'queued',reasonCode:null}}};};
 const accepted=acceptInput();assert.equal((await controlStore.accept(accepted,noop)).replayed,false);
 await pool.query('UPDATE meri_settings.tenant_settings SET monthly_cap_micro_usd=891 WHERE tenant_id=$1',[binding.tenantId]);
 await assert.rejects(controlStore.accept(acceptInput(),noop),/TENANT_MONTHLY_CAP_REACHED/);
 assert.equal((await controlStore.accept(accepted,noop)).replayed,true,'historical replay does not consume another admission');
 // Replay after a lost COMMIT acknowledgement reads the same existing run row.
 const ambiguous={async connect(){const c=await control.wrapped[0].connect();return {async query(...args){const result=await c.query(...args);if(args[0]==='COMMIT')throw Error('synthetic lost ACK');return result;},release:e=>c.release(e)};}};
 await assert.rejects(createPostgresConversationStore({pool:ambiguous}).recordUsage({binding,scopes:r.projection.scopes,input:usage},noop),e=>productFailure(e)?.code==='SDK_USAGE_COMMIT_UNKNOWN');
 assert.equal((await controlStore.recordUsage({binding,scopes:r.projection.scopes,input:usage},noop)).replayed,true);
});
