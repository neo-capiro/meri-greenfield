import test from 'node:test';
import assert from 'node:assert/strict';
import {productFixture,NOW} from './product-scripted-fixture.mjs';
import {createProductModelReservation} from './product-model-budget.mjs';
import {BudgetCommitUncertain} from './postgres-budget-store.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';

const pin=()=>({modelId:'anthropic.claude-sonnet-4-6',profileId:'us.anthropic.claude-sonnet-4-6',revision:'b'.repeat(64),validUntilMs:NOW+8000,actualInputMicroUSDPerK:3300,reserveInputMicroUSDPerK:6600,outputMicroUSDPerK:16500,maxInputTokens:8192,maxOutputTokens:256});
function fixture({cap='100',liabilities=[],observe}={}){
 const seed=productFixture(),fact=seed.context(),pricing=pin(),commands=[],releases=[];
 let clock=NOW,dbClock=NOW,lose=false,afterInsert=()=>{};
 let state={budget:{id:1,cap_micro_usd:cap,consumed_micro_usd:'0',quarantined:false},run:seed.state().run,grant:seed.state().grant,
  allocation:{run_id:fact.binding.runId,allocation_sha256:canonicalSha256(seed.allocation),allocation:seed.allocation,max_tool_calls:String(seed.allocation.budgets.maxToolCalls),max_cost_micro_usd:String(seed.allocation.budgets.maxCostMicroUSD),started_at:new Date(NOW)},
  binding:{grant_id:fact.grantId,run_id:fact.binding.runId,facts:fact},requests:new Map(),liabilities};
 const pool={async connect(){let local;return {async query(sql,p=[]){
  commands.push({sql,p});const rows=values=>({rows:structuredClone(values),rowCount:values.length});
  if(sql==='BEGIN'){local=structuredClone(state);return rows([]);}
  if(sql.startsWith('SET LOCAL'))return rows([]);
  if(sql==='ROLLBACK'){local=null;return rows([]);}
  if(sql==='COMMIT'){state=local;local=null;if(lose){lose=false;throw Error('synthetic lost COMMIT ACK');}return rows([]);}
  if(sql==='SELECT clock_timestamp() AS now')return rows([{now:new Date(dbClock)}]);
  assert.equal(sql.includes('meri_qualification.'),false);
  if(sql==='SELECT * FROM meri_product_budget.budget WHERE id=1 FOR UPDATE'||sql==='SELECT cap_micro_usd,consumed_micro_usd,quarantined FROM meri_product_budget.budget WHERE id=1')return rows([local.budget]);
  if(sql.startsWith('SELECT * FROM meri_product_budget.runs WHERE'))return rows([local.run]);
  if(sql.startsWith('SELECT * FROM meri_product_budget.tool_run_allocations WHERE'))return rows([local.allocation]);
  if(sql.startsWith('SELECT * FROM meri_product_budget.grants WHERE'))return rows(local.grant.grant_id===p[0]?[local.grant]:[]);
  if(sql.startsWith('SELECT * FROM meri_product_budget.tool_grant_bindings WHERE'))return rows(local.binding.grant_id===p[0]?[local.binding]:[]);
  if(sql.startsWith('SELECT 1 FROM meri_product_budget.budget_liabilities'))return rows([...local.liabilities,...local.requests.values()].filter(r=>r.kind==='model'&&r.slot===p[0]||r.grant_id===p[1]&&r.state==='UNKNOWN').map(()=>({one:1})));
  if(sql.includes(' AS run_total FROM meri_product_budget.budget_liabilities')){
   const all=[...local.liabilities,...local.requests.values()],held=all.filter(r=>r.state==='UNKNOWN').reduce((a,r)=>a+BigInt(r.hold_micro_usd),0n),runTotal=all.filter(r=>r.run_id===p[0]).reduce((a,r)=>a+BigInt(r.state==='UNKNOWN'?r.hold_micro_usd:r.consumed_micro_usd),0n);
   return rows([{held:String(held),run_total:String(runTotal)}]);
  }
  if(sql.startsWith('INSERT INTO meri_product_budget.requests(')){
   assert.equal(local.requests.has(p[0]),false);local.requests.set(p[0],{kind:'model',slot:p[0],request_id:p[0],grant_id:p[1],run_id:p[2],attempt:p[3],worker_arn:p[4],fence:p[5],policy_revision:p[6],native_body_sha256:p[7],raw_request_sha256:p[8],model_id:p[9],profile_id:p[10],pricing_revision:p[11],pricing_valid_until:p[12],input_tokens:p[13],max_output_tokens:p[14],hold_micro_usd:p[15],state:'UNKNOWN',consumed_micro_usd:'0'});
   afterInsert();return rows([]);
  }
  assert.fail('unsupported model SQL: '+sql);
 },release(error){releases.push(error);}};}};
 const defaultObservation=()=>({binding:fact.binding,taskArn:fact.qualificationBinding.workerArn,capabilitySha256:fact.capabilitySha256,nativeBodySha256:'c'.repeat(64),rawRequestSha256:'d'.repeat(64),modelId:pricing.modelId,profileId:pricing.profileId,maxOutputTokens:1,count:{nativeBodySha256:'c'.repeat(64),modelId:pricing.modelId,inputTokens:1}});
 const config={pool,allocationJson:JSON.stringify(seed.allocation),grantFactsJsons:[JSON.stringify(fact)],modelGrantId:fact.grantId,pricing,observe:observe??defaultObservation,now:()=>clock,limits:{maxRequestMs:1000,maxFactBytes:65536}};
 return {seed,fact,pricing,config,commands,releases,state:()=>state,request:(requestId='request_A')=>({requestId,binding:fact.binding,deadlineMs:NOW+5000}),setDatabaseClock:value=>{dbClock=value;},afterInsert:fn=>{afterInsert=fn;},loseCommit:()=>{lose=true;}};
}

test('one exact model grant reserves an UNKNOWN product hold under the current allocation lease',async()=>{
 const f=fixture(),owner=createProductModelReservation(f.config);assert.equal(f.commands.length,0);
 const receipt=await owner.reserve(f.request());
 assert.deepEqual(receipt,{requestId:'request_A',nativeBodySha256:'c'.repeat(64),state:'UNKNOWN'});
 const row=f.state().requests.get('request_A');assert.equal(row.grant_id,f.fact.grantId);assert.equal(row.run_id,f.fact.binding.runId);assert.equal(row.worker_arn,f.fact.qualificationBinding.workerArn);assert.equal(row.policy_revision,f.fact.qualificationBinding.policyRevision);assert.equal(row.hold_micro_usd,'24');
 assert.ok(f.commands.findIndex(c=>c.sql==='SELECT * FROM meri_product_budget.budget WHERE id=1 FOR UPDATE')<f.commands.findIndex(c=>c.sql.startsWith('INSERT INTO meri_product_budget.requests(')));
 assert.equal(f.commands.at(-1).sql,'COMMIT');
});
test('missing trusted observer or unconfigured model grant refuses before SQL',()=>{
 const f=fixture();assert.throws(()=>createProductModelReservation({...f.config,observe:null}));
 assert.throws(()=>createProductModelReservation({...f.config,modelGrantId:'11111111-1111-4111-8111-000000000099'}));assert.equal(f.commands.length,0);
});
test('observer mismatch and caller supplied evidence refuse before a database connection',async()=>{
 const f=fixture({observe:()=>({...fixture().config.observe(),capabilitySha256:'e'.repeat(64)})}),owner=createProductModelReservation(f.config);
 await assert.rejects(owner.reserve(f.request()));assert.equal(f.commands.length,0);
 await assert.rejects(owner.reserve({...f.request(),count:{inputTokens:1}}));assert.equal(f.commands.length,0);
});
test('observed task and full tenant/run binding must match the configured model grant',async()=>{
 const f=fixture(),observed=f.config.observe();
 for(const changed of [{...observed,taskArn:'different-task'},{...observed,binding:{...observed.binding,tenantId:'different-tenant'}}]){
  const owner=createProductModelReservation({...f.config,observe:()=>changed});
  await assert.rejects(owner.reserve(f.request()),/PRODUCT_MODEL_OBSERVATION_REFUSED/);
 }
 assert.equal(f.commands.length,0);
});
test('shared tool UNKNOWN hold exhausts global cap; no model INSERT',async()=>{
 const f=fixture({liabilities:[{kind:'tool',slot:'tool_x',grant_id:'another',run_id:'another',state:'UNKNOWN',hold_micro_usd:'77',consumed_micro_usd:'0'}]}),owner=createProductModelReservation(f.config);
 await assert.rejects(owner.reserve(f.request()),/PRODUCT_MODEL_BUDGET_EXHAUSTED/);assert.equal(f.state().requests.size,0);
});
test('shared settled and UNKNOWN tool run liabilities exhaust installed allocation',async()=>{
 const runId=productFixture().f.binding.runId,f=fixture({cap:'1000',liabilities:[{kind:'tool',slot:'tool_x',grant_id:'another',run_id:runId,state:'SETTLED',hold_micro_usd:'40',consumed_micro_usd:'40'},{kind:'tool',slot:'tool_y',grant_id:'another',run_id:runId,state:'UNKNOWN',hold_micro_usd:'40',consumed_micro_usd:'0'}]}),owner=createProductModelReservation(f.config);
 await assert.rejects(owner.reserve(f.request()),/PRODUCT_MODEL_BUDGET_EXHAUSTED/);assert.equal(f.state().requests.size,0);
});
test('one unresolved grant liability blocks another slot without refund or retry',async()=>{
 const f=fixture(),owner=createProductModelReservation(f.config);await owner.reserve(f.request());
 await assert.rejects(owner.reserve(f.request('request_B')),/PRODUCT_MODEL_SLOT_USED/);assert.equal(f.state().requests.size,1);
});
test('pricing expiry at final database clock rolls back the UNKNOWN insert',async()=>{
 const f=fixture();f.afterInsert(()=>f.setDatabaseClock(f.pricing.validUntilMs));
 await assert.rejects(createProductModelReservation(f.config).reserve(f.request()),/PRODUCT_MODEL_PRICING_EXPIRED/);
 assert.equal(f.state().requests.size,0);assert.ok(f.commands.some(c=>c.sql==='ROLLBACK'));
});
test('lost COMMIT acknowledgement releases no receipt and retains UNKNOWN',async()=>{
 const f=fixture(),owner=createProductModelReservation(f.config);f.loseCommit();
 await assert.rejects(owner.reserve(f.request()),BudgetCommitUncertain);
 assert.equal(f.state().requests.get('request_A').state,'UNKNOWN');assert.ok(f.releases.at(-1));
});
