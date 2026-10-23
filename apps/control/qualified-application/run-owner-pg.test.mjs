/** Root-operated disposable PG16 gate. Never reads ambient PG connection settings. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import pg from 'pg';
import {PLAN} from '../../../infra/product-preview/first-chat-migrate.mjs';
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
 const migrations=PLAN.filter(e=>e.kind==='migration'&&(e.path.startsWith('apps/control/conversations/migrations/')||e.path.startsWith('apps/gateway/budget/migrations/')||e.path==='apps/control/settings/migrations/0001_settings.sql'));
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
 const calls=await Promise.all([store.recordUsage({binding,scopes:r.projection.scopes,input:usage},noop),competingStore.recordUsage({binding,scopes:r.projection.scopes,input:usage},noop)]);
 assert.deepEqual(calls.map(v=>v.replayed).sort(),[false,true]);
 const saved=(await pool.query('SELECT sdk_usage,sdk_usage_sha256,sdk_charge_micro_usd FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3',tuple)).rows[0];
 assert.equal(saved.sdk_charge_micro_usd,'891');assert.equal(saved.sdk_usage_sha256,hash(saved.sdk_usage));
 await assert.rejects(store.recordUsage({binding,scopes:r.projection.scopes,input:{...usage,toolsUsed:{tools:[],omitted:1}}},noop),/SDK_USAGE_REPLAY_REFUSED/);
 // Replay after a lost COMMIT acknowledgement reads the same existing run row.
 const ambiguous={async connect(){const c=await pool.connect();return {async query(...args){const result=await c.query(...args);if(args[0]==='COMMIT')throw Error('synthetic lost ACK');return result;},release:e=>c.release(e)};}};
 await assert.rejects(createPostgresConversationStore({pool:ambiguous}).recordUsage({binding,scopes:r.projection.scopes,input:usage},noop),e=>productFailure(e)?.code==='SDK_USAGE_COMMIT_UNKNOWN');
 assert.equal((await store.recordUsage({binding,scopes:r.projection.scopes,input:usage},noop)).replayed,true);
});
