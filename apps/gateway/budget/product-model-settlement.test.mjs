import test from 'node:test';
import assert from 'node:assert/strict';
import {productFixture,NOW} from './product-scripted-fixture.mjs';
import {createProductModelSettlement} from './product-model-settlement.mjs';
import {BudgetCommitUncertain} from './postgres-budget-store.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';

const modelId='anthropic.claude-sonnet-4-6',profileId='us.anthropic.claude-sonnet-4-6';
function fixture(){
 const seed=productFixture(),fact=seed.context(),pricing={modelId,profileId,revision:'b'.repeat(64),validUntilMs:NOW+8000,
  actualInputMicroUSDPerK:3300,reserveInputMicroUSDPerK:6600,outputMicroUSDPerK:16500,maxInputTokens:8192,maxOutputTokens:256};
 const request={request_id:'request_A',grant_id:fact.grantId,run_id:fact.binding.runId,attempt:fact.qualificationBinding.attempt,
  worker_arn:fact.qualificationBinding.workerArn,fence:fact.qualificationBinding.fence,policy_revision:fact.qualificationBinding.policyRevision,
  native_body_sha256:'c'.repeat(64),raw_request_sha256:'d'.repeat(64),model_id:modelId,profile_id:profileId,
  pricing_revision:pricing.revision,pricing_valid_until:new Date(pricing.validUntilMs),input_tokens:1,max_output_tokens:1,
  hold_micro_usd:'24',state:'UNKNOWN',actual_micro_usd:null,evidence_sha256:null,settled_at:null};
 let state={budget:{id:1,cap_micro_usd:'100',consumed_micro_usd:'0',quarantined:false},request,
  run:seed.state().run,grant:seed.state().grant,allocation:{run_id:fact.binding.runId,
   allocation_sha256:canonicalSha256(seed.allocation),allocation:seed.allocation,max_tool_calls:String(seed.allocation.budgets.maxToolCalls),
   max_cost_micro_usd:String(seed.allocation.budgets.maxCostMicroUSD)},
  binding:{grant_id:fact.grantId,run_id:fact.binding.runId,facts:fact},other:[]};
 let completion={requestId:'request_A',binding:fact.binding,taskArn:fact.qualificationBinding.workerArn,capabilitySha256:fact.capabilitySha256,nativeBodySha256:'c'.repeat(64),rawRequestSha256:'d'.repeat(64),
  modelId,profileId,pricingRevision:pricing.revision,evidenceSha256:'e'.repeat(64),httpStatus:200,complete:true,eof:true,usage:{inputTokens:1,outputTokens:1}};
 const commands=[],releases=[];let lose=false;
 const pool={async connect(){let local,readOnly=false;return {async query(sql,p=[]){
  commands.push({sql,p});const rows=values=>({rows:structuredClone(values),rowCount:values.length});
  if(sql.startsWith('BEGIN')){readOnly=sql.includes('READ ONLY');local=structuredClone(state);return rows([]);}
  if(sql.startsWith('SET LOCAL'))return rows([]);
  if(sql==='ROLLBACK')return rows([]);
  if(sql==='COMMIT'){if(!readOnly)state=local;if(lose){lose=false;throw Error('lost commit acknowledgement');}return rows([]);}
  if(sql==='SELECT clock_timestamp() AS now')return rows([{now:new Date(NOW+20_000)}]);
  assert.equal(sql.includes('meri_qualification.'),false);
  if(sql==='SELECT * FROM meri_product_budget.budget WHERE id=1 FOR UPDATE')return rows([local.budget]);
  if(sql.startsWith('SELECT * FROM meri_product_budget.requests WHERE'))return rows(local.request.request_id===p[0]?[local.request]:[]);
  if(sql.startsWith('SELECT * FROM meri_product_budget.tool_run_allocations WHERE'))return rows([local.allocation]);
  if(sql.startsWith('SELECT * FROM meri_product_budget.runs WHERE'))return rows([local.run]);
  if(sql.startsWith('SELECT * FROM meri_product_budget.grants WHERE'))return rows([local.grant]);
  if(sql.startsWith('SELECT * FROM meri_product_budget.tool_grant_bindings WHERE'))return rows([local.binding]);
  if(sql.includes(' AS held FROM meri_product_budget.budget_liabilities'))return rows([{held:String(local.other.filter(r=>r.state==='UNKNOWN').reduce((v,r)=>v+BigInt(r.hold),0n))}]);
  if(sql.includes(' AS total FROM meri_product_budget.budget_liabilities'))return rows([{total:String(local.other.filter(r=>r.runId===p[0]).reduce((v,r)=>v+BigInt(r.state==='UNKNOWN'?r.hold:r.consumed),0n))}]);
  if(sql.startsWith('UPDATE meri_product_budget.budget SET')){local.budget.consumed_micro_usd=String(BigInt(local.budget.consumed_micro_usd)+BigInt(p[0]));local.budget.quarantined||=p[1];return {rows:[],rowCount:1};}
  if(sql.startsWith('UPDATE meri_product_budget.requests SET')){if(local.request.state!=='UNKNOWN')return {rows:[],rowCount:0};Object.assign(local.request,{state:'SETTLED',actual_micro_usd:p[1],evidence_sha256:p[2],settled_at:new Date(NOW+20_000)});return {rows:[],rowCount:1};}
  assert.fail('unsupported product settlement SQL: '+sql);
 },release(error){releases.push(error);}};}};
 const config={pool,allocationJson:JSON.stringify(seed.allocation),grantFactsJsons:[JSON.stringify(fact)],modelGrantId:fact.grantId,pricing,
  observeComplete:async()=>structuredClone(completion)};
 return {config,commands,releases,state:()=>state,completion:()=>completion,setCompletion:value=>{completion=value;},lose:()=>{lose=true;}};
}

test('historical complete native usage settles after grant revocation and pricing expiry',async()=>{
 const f=fixture();f.state().grant.state='REVOKED';f.state().grant.expires_at=new Date(NOW-1);
 const owner=createProductModelSettlement(f.config),result=await owner.settle({requestId:'request_A'});
 assert.deepEqual(result,{requestId:'request_A',state:'SETTLED',actualMicroUSD:'20',quarantined:false});
 assert.equal(f.state().budget.consumed_micro_usd,'20');assert.equal(f.state().request.evidence_sha256,'e'.repeat(64));
 assert.ok(f.commands.some(x=>x.sql==='SELECT * FROM meri_product_budget.budget WHERE id=1 FOR UPDATE'));
 assert.equal(f.commands.some(x=>x.sql.includes('meri_qualification.')),false);
 assert.deepEqual(await owner.readOutcome({requestId:'request_A'}),{requestId:'request_A',state:'SETTLED',actualMicroUSD:'20'});
});
test('incomplete native response and caller usage claims leave UNKNOWN without a connection',async()=>{
 const f=fixture(),owner=createProductModelSettlement(f.config);
 f.setCompletion({...f.completion(),eof:false});await assert.rejects(owner.settle({requestId:'request_A'}),/PRODUCT_MODEL_COMPLETION_REFUSED/);
 await assert.rejects(owner.settle({requestId:'request_A',usage:{inputTokens:1,outputTokens:1}}));
 assert.equal(f.commands.length,0);assert.equal(f.state().request.state,'UNKNOWN');
});
test('complete usage over original output bound records actual charge and quarantines',async()=>{
 const f=fixture(),owner=createProductModelSettlement(f.config);
 f.setCompletion({...f.completion(),usage:{inputTokens:1,outputTokens:2}});
 const result=await owner.settle({requestId:'request_A'});
 assert.deepEqual(result,{requestId:'request_A',state:'SETTLED',actualMicroUSD:'37',quarantined:true});
 assert.equal(f.state().budget.consumed_micro_usd,'37');assert.equal(f.state().budget.quarantined,true);
});
test('a separate UNKNOWN tool liability remains held while trusted model usage settles',async()=>{
 const f=fixture(),owner=createProductModelSettlement(f.config);
 f.state().other.push({runId:f.state().request.run_id,state:'UNKNOWN',hold:'81',consumed:'0'});
 const result=await owner.settle({requestId:'request_A'});
 assert.equal(result.quarantined,true);assert.equal(f.state().budget.consumed_micro_usd,'20');
 assert.equal(f.state().other[0].state,'UNKNOWN');
});
test('changed historical task, allocation or response identity refuses without any charge',async()=>{
 for(const alter of [f=>{f.state().run.fence=2;},f=>{f.state().allocation.max_tool_calls='99';},f=>{f.setCompletion({...f.completion(),rawRequestSha256:'f'.repeat(64)});},f=>{f.setCompletion({...f.completion(),binding:{...f.completion().binding,tenantId:'other'}});}]){
  const f=fixture(),owner=createProductModelSettlement(f.config);alter(f);await assert.rejects(owner.settle({requestId:'request_A'}));
  assert.equal(f.state().request.state,'UNKNOWN');assert.equal(f.state().budget.consumed_micro_usd,'0');
 }
});
test('lost COMMIT acknowledgement is reconciled read-only and exact repeat charges once',async()=>{
 const f=fixture(),owner=createProductModelSettlement(f.config);f.lose();
 await assert.rejects(owner.settle({requestId:'request_A'}),BudgetCommitUncertain);
 assert.equal(f.state().request.state,'SETTLED');assert.equal(f.state().budget.consumed_micro_usd,'20');assert.ok(f.releases.at(-1));
 const before=f.commands.length;
 assert.deepEqual(await owner.readOutcome({requestId:'request_A'}),{requestId:'request_A',state:'SETTLED',actualMicroUSD:'20'});
 assert.equal(f.commands.slice(before).some(x=>x.sql.startsWith('UPDATE')),false);
 assert.equal((await owner.settle({requestId:'request_A'})).state,'SETTLED');assert.equal(f.state().budget.consumed_micro_usd,'20');
});
