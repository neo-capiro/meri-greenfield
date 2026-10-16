import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {productFixture,NOW} from '../../gateway/budget/product-scripted-fixture.mjs';
import {versions} from '../../control/conversations/test/store-fixture.mjs';
import {createProductProxyPersistedFacts} from './product-owner-facts.mjs';

const clientId='11111111-1111-4111-8111-111111111111';
const otherId='22222222-2222-4222-8222-222222222222';
const refused=/PRODUCT_PROXY_FACTS_UNAVAILABLE/;

/** Scripted fixed PostgreSQL rows only. No pg client, SQL server or socket. */
function fixture(){
 const seed=productFixture(),model=seed.context(),binding=model.binding,q=model.qualificationBinding;
 const task={...structuredClone(model),grantId:otherId,capabilitySha256:'c'.repeat(64)};
 const request={requestId:'33333333-3333-4333-8333-333333333333',prompt:'synthetic',skill:null,window:null};
 const expiresAtMs=NOW+8000,issuanceKey=hash(binding),createdAt=new Date(NOW).toISOString();
 const run={binding,state:'running',scopes:[{kind:'client',tenantId:binding.tenantId,resourceId:clientId,policyRevision:q.policyRevision}],policyRevision:q.policyRevision,versions,createdAt};
 const original={binding,executionKey:issuanceKey,executionId:issuanceKey,planSha256:'d'.repeat(64),expiresAtMs,versions};
 const resource={taskArn:q.workerArn,createdAtMs:NOW,clusterArn:'arn:aws:ecs:us-east-1:967807252336:cluster/Synthetic',
  taskDefinitionArn:'arn:aws:ecs:us-east-1:967807252336:task-definition/MeriSynthetic:1',containerName:'worker',grantFactsJsons:[model,task].map(JSON.stringify)};
 const record={binding,allocationKey:issuanceKey,original,allocationSha256:model.allocationSha256,
  qualification:{attempt:q.attempt,policyRevision:q.policyRevision},grantIntents:[model,task].map(f=>({grantId:f.grantId,capabilitySha256:f.capabilitySha256,expiresAtMs})),
  taskRequestSha256:'e'.repeat(64),expiresAtMs,state:'ADMITTED',resource};
 const state={
  budget:{id:1,cap_micro_usd:'10000',consumed_micro_usd:'0',quarantined:false},
  budgetRun:{run_id:q.runId,attempt:q.attempt,worker_arn:q.workerArn,fence:q.fence,policy_revision:q.policyRevision},
  grants:[model,task].map(f=>({grant_id:f.grantId,run_id:q.runId,attempt:q.attempt,worker_arn:q.workerArn,fence:q.fence,policy_revision:q.policyRevision,capability_sha256:f.capabilitySha256,state:'ACTIVE',expires_at:new Date(expiresAtMs)})),
  facts:[model,task].map(f=>({grant_id:f.grantId,run_id:binding.runId,facts:f})),
  allocation:{run_id:binding.runId,allocation:seed.allocation,allocation_sha256:model.allocationSha256,max_tool_calls:String(seed.allocation.budgets.maxToolCalls),max_cost_micro_usd:String(seed.allocation.budgets.maxCostMicroUSD),started_at:new Date(NOW)},
  issuance:{issuance_key:issuanceKey,binding,request_sha256:hash(request),expires_at_ms:String(expiresAtMs),state:'ISSUED',claim_fence:'44444444-4444-4444-8444-444444444444',version:'1',grant_id:model.grantId,capability_sha256:model.capabilitySha256,material_ref:'model-material:v1:'+issuanceKey,facts_sha256:null,claimed_at:new Date(NOW),issued_at:new Date(NOW)},
  run:{tenant_id:binding.tenantId,conversation_id:binding.conversationId,run_id:binding.runId,request_id:request.requestId,request,request_sha256:hash(request),projection:run,projection_sha256:hash(run),last_sequence:1},
  native:{tenant_id:binding.tenantId,conversation_id:binding.conversationId,run_id:binding.runId,intent_key:issuanceKey,record,record_sha256:hash(record)},
  event:{sequence:1,event_id:'55555555-5555-4555-8555-555555555555',event:{contractVersion:'0.1.0',eventId:'55555555-5555-4555-8555-555555555555',binding,sequence:1,createdAt,scopes:run.scopes,type:'run.status',data:{state:'running',reasonCode:null}}},
 };
 state.event.event_sha256=hash(state.event.event);
 const calls=[],releases=[],released=[];let before=()=>{},loseCommit=false,acquisitions=0;
 async function query(sql,p=[],connectionId='direct'){
  calls.push({sql,p,connectionId});await before(sql,p);
  const rows=value=>({rows:structuredClone(value),rowCount:value.length});
  if(sql.startsWith('BEGIN')||sql.startsWith('SET LOCAL')||sql.startsWith('SELECT pg_advisory')||sql==='ROLLBACK')return rows([]);
  if(sql==='COMMIT'){if(loseCommit){loseCommit=false;throw Error('synthetic lost read COMMIT');}return rows([]);}
  assert.equal(/(?:INSERT|UPDATE|DELETE|TRUNCATE|CREATE|ALTER|DROP)\s/iu.test(sql.replace(/FOR UPDATE/gu,'')),false,'resolver has no data mutation');
  assert.equal(sql.includes('meri_qualification.'),false);
  if(sql==='SELECT clock_timestamp() AS now')return rows([{now:new Date(NOW)}]);
  if(sql.startsWith('SELECT * FROM meri_product_budget.grants WHERE capability_sha256='))return rows(state.grants.filter(g=>g.capability_sha256===p[0]));
  if(sql.startsWith('SELECT * FROM meri_product_budget.grants WHERE grant_id='))return rows(state.grants.filter(g=>g.grant_id===p[0]));
  if(sql.startsWith('SELECT * FROM meri_product_budget.grants WHERE run_id='))return rows(state.grants.filter(g=>g.run_id===p[0]).sort((a,b)=>a.grant_id.localeCompare(b.grant_id)));
  if(sql.startsWith('SELECT * FROM meri_product_budget.tool_grant_bindings WHERE grant_id='))return rows(state.facts.filter(f=>f.grant_id===p[0]));
  if(sql.startsWith('SELECT * FROM meri_product_budget.tool_grant_bindings WHERE run_id='))return rows(state.facts.filter(f=>f.run_id===p[0]).sort((a,b)=>a.grant_id.localeCompare(b.grant_id)));
  if(sql.startsWith('SELECT * FROM meri_product_budget.tool_run_allocations WHERE'))return rows(state.allocation&&state.allocation.run_id===p[0]?[state.allocation]:[]);
  if(sql==='SELECT * FROM meri_product_budget.budget WHERE id=1')return rows([state.budget]);
  if(sql.startsWith('SELECT * FROM meri_product_budget.runs WHERE'))return rows(state.budgetRun&&state.budgetRun.run_id===p[0]?[state.budgetRun]:[]);
  if(sql.includes('FROM meri_conversations.model_run_issuances WHERE'))return rows(state.issuance?.issuance_key===p[0]?[state.issuance]:[]);
  if(sql.startsWith('SELECT * FROM meri_conversations.runs WHERE'))return rows(state.run&&state.run.tenant_id===p[0]&&state.run.conversation_id===p[1]&&state.run.run_id===p[2]?[state.run]:[]);
  if(sql.startsWith('SELECT * FROM meri_conversations.native_allocations WHERE'))return rows(state.native&&state.native.tenant_id===p[0]&&state.native.conversation_id===p[1]&&state.native.run_id===p[2]?[state.native]:[]);
  if(sql.startsWith('SELECT * FROM meri_conversations.events WHERE'))return rows([state.event]);
  assert.fail('Unexpected scripted resolver SQL: '+sql);
 }
 const pool={query,async connect(){const connectionId=++acquisitions;return {
  query:(sql,p)=>query(sql,p,connectionId),release:error=>{releases.push(error);released.push({connectionId,error});}};}};
 const configuration={pool,selectedClientId:clientId,now:()=>NOW,limits:{maxRequestMs:1000,maxFactBytes:131072},enabled:true};
 return {configuration,state,calls,releases,released,model,task,acquisitions:()=>acquisitions,query:()=>({capabilitySha256:model.capabilitySha256,deadlineMs:NOW+5000}),
  resolver:()=>createProductProxyPersistedFacts(configuration),before:callback=>{before=callback;},loseCommit:()=>{loseCommit=true;}};
}

test('inert, disabled default and malformed selectors refuse before any pool use',async()=>{
 const f=fixture(),{enabled,...configuration}=f.configuration,disabled=createProductProxyPersistedFacts(configuration);
 assert.equal(disabled.available,false);assert.equal(f.calls.length,0);
 await assert.rejects(disabled.resolve(f.query()),refused);
 const resolver=f.resolver();assert.equal(resolver.available,true);
 for(const input of [{...f.query(),grantId:f.model.grantId},{...f.query(),capabilitySha256:'bad'},{...f.query(),deadlineMs:NOW}])await assert.rejects(resolver.resolve(input),refused);
 assert.equal(f.calls.length,0);
});

test('exact persisted model custody resolves immutable constructor inputs and repeats fresh reads',async()=>{
 const f=fixture(),resolver=f.resolver(),first=await resolver.resolve(f.query()),count=f.calls.length,second=await resolver.resolve(f.query());
 assert.deepEqual(second,first);assert.ok(f.calls.length>count);
 assert.equal(first.modelGrantId,f.model.grantId);assert.equal(first.selectedClientId,clientId);
 assert.deepEqual(first.binding,f.model.binding);assert.equal(first.requestSha256,f.state.issuance.request_sha256);
 assert.equal(first.expiresAtMs,NOW+8000);assert.equal(first.grantFactsJsons.length,2);
 assert.equal(Object.isFrozen(first),true);assert.equal(Object.isFrozen(first.binding),true);
 assert.deepEqual(Object.keys(first),['binding','allocationJson','grantFactsJsons','modelGrantId','selectedClientId','original','resource','requestSha256','expiresAtMs']);
 assert.equal(JSON.stringify(first).includes('model-material:'),false);
 assert.equal(f.calls.some(c=>c.sql.includes('FROM meri_conversations.run_issuances ')),false,'task issuance cannot authorize model identity');
 assert.ok(f.calls.filter(c=>c.sql.startsWith('BEGIN')).length>=8,'all canonical owners borrow the same pool');
 assert.equal(resolver.available,true);
 assert.equal(f.calls.some(call=>call.connectionId==='direct'),false,'all reads use the borrowed connection transaction path');
 const issuance=f.calls.find(call=>call.sql.includes('FROM meri_conversations.model_run_issuances'));
 const transaction=f.calls.filter(call=>call.connectionId===issuance.connectionId).map(call=>call.sql);
 assert.deepEqual(transaction.slice(0,3),['BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY',"SET LOCAL statement_timeout = '5s'","SET LOCAL lock_timeout = '2s'"]);
 assert.equal(transaction.at(-1),'COMMIT');
 assert.ok(f.released.some(release=>release.connectionId===issuance.connectionId&&release.error===undefined));
});

for(const [label,change] of [
 ['missing bearer',f=>{f.state.grants=[];}],
 ['duplicate digest',f=>{f.state.grants.push({...f.state.grants[0],grant_id:otherId});}],
 ['task-only grant',f=>{f.query=()=>({capabilitySha256:f.task.capabilitySha256,deadlineMs:NOW+5000});}],
 ['unissued model',f=>{f.state.issuance=null;}],
 ['uncertain model issuance',f=>{Object.assign(f.state.issuance,{state:'CLAIMED',grant_id:null,capability_sha256:null,material_ref:null,issued_at:null});}],
 ['revoked model',f=>{f.state.grants[0].state='REVOKED';}],
 ['expired model',f=>{f.state.grants[0].expires_at=new Date(NOW);}],
 ['model grant expiry extension',f=>{f.state.grants[0].expires_at=new Date(NOW+9000);}],
 ['foreign allocation',f=>{f.state.allocation.allocation.run.actorId='another-actor';}],
 ['allocation digest contradiction',f=>{f.state.allocation.allocation_sha256='f'.repeat(64);}],
 ['grant row contradiction',f=>{f.state.facts[0].run_id='66666666-6666-4666-8666-666666666666';}],
 ['model issuance grant contradiction',f=>{f.state.issuance.grant_id=otherId;}],
 ['model issuance binding contradiction',f=>{f.state.issuance.binding={...f.model.binding,actorId:'another-actor'};}],
 ['model issuance expiry contradiction',f=>{f.state.issuance.expires_at_ms=String(NOW+7000);}],
 ['expired model issuance',f=>{f.state.issuance.expires_at_ms=String(NOW);}],
 ['native record digest contradiction',f=>{f.state.native.record_sha256='f'.repeat(64);}],
 ['native allocation not admitted',f=>{f.state.native.record.state='UNKNOWN';f.state.native.record_sha256=hash(f.state.native.record);}],
 ['native model intent expiry extension',f=>{f.state.native.record.grantIntents[0].expiresAtMs=NOW+9000;f.state.native.record_sha256=hash(f.state.native.record);}],
 ['native sibling intent expiry extension',f=>{f.state.native.record.grantIntents[1].expiresAtMs=NOW+9000;f.state.native.record_sha256=hash(f.state.native.record);}],
 ['native task contradiction',f=>{f.state.native.record.resource.taskArn=f.state.native.record.resource.taskArn.replace(/a{32}$/u,'b'.repeat(32));f.state.native.record_sha256=hash(f.state.native.record);}],
 ['accepted request contradiction',f=>{f.state.issuance.request_sha256='f'.repeat(64);}],
 ['foreign configured client',f=>{f.configuration.selectedClientId=otherId;}],
 ['terminal accepted run',f=>{f.state.run.projection.state='completed';f.state.run.projection_sha256=hash(f.state.run.projection);}],
 ['foreign accepted scope',f=>{f.state.run.projection.scopes[0].resourceId=otherId;f.state.run.projection_sha256=hash(f.state.run.projection);}],
 ['quarantined budget',f=>{f.state.budget.quarantined=true;}],
 ['revoked sibling task grant',f=>{f.state.grants[1].state='REVOKED';}],
 ['expired sibling task grant',f=>{f.state.grants[1].expires_at=new Date(NOW);}],
 ['sibling task grant expiry extension',f=>{f.state.grants[1].expires_at=new Date(NOW+9000);}],
 ['budget writer fence advanced',f=>{f.state.budgetRun.fence++;}],
])test(`persisted resolver refuses ${label}`,async()=>{
 const f=fixture();change(f);await assert.rejects(f.resolver().resolve(f.query()),refused);
});

test('revocation after location refuses at fresh canonical admission and replay never caches authority',async()=>{
 const f=fixture(),resolver=f.resolver();await resolver.resolve(f.query());
 let changed=false;f.before(sql=>{if(!changed&&sql.includes('FROM meri_conversations.model_run_issuances')){changed=true;f.state.grants[0].state='REVOKED';}});
 await assert.rejects(resolver.resolve(f.query()),refused);assert.equal(changed,true);
});

test('read commit uncertainty, cancellation and stalled pool never produce usable facts',async()=>{
 const f=fixture();f.loseCommit();await assert.rejects(f.resolver().resolve(f.query()),refused);assert.ok(f.releases[0]);
 const abort=new AbortController();abort.abort();const g=fixture();await assert.rejects(g.resolver().resolve({...g.query(),signal:abort.signal}),refused);assert.equal(g.calls.length,0);
 const parked=fixture();parked.configuration.now=Date.now;parked.configuration.limits.maxRequestMs=20;parked.configuration.pool.connect=()=>new Promise(()=>{});
 await assert.rejects(parked.resolver().resolve({...parked.query(),deadlineMs:Date.now()+1000}),refused);
});

function deferred(){let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};}
function ticking(f){const started=Date.now();f.configuration.now=()=>NOW+Date.now()-started;f.configuration.limits.maxRequestMs=40;}

test('stalled acquisition quarantines once and late acquired connection is evicted without a query',async()=>{
 const f=fixture(),entered=deferred(),acquired=deferred(),released=deferred();ticking(f);
 let attempts=0,queries=0;
 f.configuration.pool.connect=()=>{attempts++;entered.resolve();return acquired.promise;};
 const resolver=f.resolver(),pending=resolver.resolve(f.query());await entered.promise;
 await assert.rejects(pending,refused);assert.equal(resolver.available,false);
 await assert.rejects(resolver.resolve(f.query()),refused);assert.equal(attempts,1);
 acquired.resolve({async query(){queries++;assert.fail('late acquisition must not start SQL');},release:error=>released.resolve(error)});
 assert.ok(await released.promise);assert.equal(queries,0);
 await assert.rejects(resolver.resolve(f.query()),refused);assert.equal(attempts,1);assert.equal(resolver.available,false);
});

test('stalled canonical issuance SELECT quarantines once; late reply rolls back and cannot authorize a replay',async()=>{
 const f=fixture(),entered=deferred(),reply=deferred(),released=deferred();ticking(f);
 const connect=f.configuration.pool.connect;
 f.configuration.pool.connect=async()=>{const client=await connect();let modelRead=false;return {
  query(sql,p){if(sql.includes('FROM meri_conversations.model_run_issuances'))modelRead=true;return client.query(sql,p);},
  release(error){client.release(error);if(modelRead)released.resolve();}};};
 f.before(sql=>{if(sql.includes('FROM meri_conversations.model_run_issuances')){entered.resolve();return reply.promise;}});
 const resolver=f.resolver(),pending=resolver.resolve(f.query());await entered.promise;
 const issuance=f.calls.find(call=>call.sql.includes('FROM meri_conversations.model_run_issuances'));
 const beforeReply=f.calls.filter(call=>call.connectionId===issuance.connectionId).map(call=>call.sql);
 assert.deepEqual(beforeReply.slice(0,3),['BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY',"SET LOCAL statement_timeout = '5s'","SET LOCAL lock_timeout = '2s'"]);
 await assert.rejects(pending,refused);assert.equal(resolver.available,false);
 const acquisitions=f.acquisitions(),count=f.calls.length;
 await assert.rejects(resolver.resolve(f.query()),refused);assert.equal(f.acquisitions(),acquisitions);assert.equal(f.calls.length,count);
 reply.resolve();
 // A healthy ROLLBACK may return the connection to its existing pool, but a
 // read after the expired life still yields no facts and the resolver stays
 // quarantined. Await the original connection's release, not a second query.
 await released.promise;
 const transaction=f.calls.filter(call=>call.connectionId===issuance.connectionId).map(call=>call.sql);
 assert.equal(transaction.at(-1),'ROLLBACK');
 assert.ok(f.released.some(release=>release.connectionId===issuance.connectionId));
 assert.equal(resolver.available,false);
 await assert.rejects(resolver.resolve(f.query()),refused);assert.equal(f.acquisitions(),acquisitions);
});

test('later sibling expiry extension cannot widen the immutable returned grant window',async()=>{
 const f=fixture();let changed=false;
 f.before(sql=>{if(!changed&&sql.includes('FROM meri_conversations.model_run_issuances')){changed=true;f.state.grants[1].expires_at=new Date(NOW+9000);}});
 const result=await f.resolver().resolve(f.query());assert.equal(changed,true);assert.equal(result.expiresAtMs,NOW+8000);
});
