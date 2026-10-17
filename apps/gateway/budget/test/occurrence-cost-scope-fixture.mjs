/** Scripted SQL boundary over actual native admission/model/tool/settlement owners. Synthetic trusted observations, no pg/network.
 * The fixture implements fixed SQL results/serialization/rollback only, never budget admission or lineage decisions. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {createNativeAllocationAdmission} from '../native-allocation-admission.mjs';
import {createPostgresToolBudget} from '../postgres-tool-budget.mjs';
import {createProductModelReservation} from '../product-model-budget.mjs';
import {createProductModelSettlement} from '../product-model-settlement.mjs';
export const NOW=1800000000000;
export const id=n=>`${String(n).padStart(8,'0')}-0000-4000-8000-000000000000`;
const clone=v=>structuredClone(v),decimal=v=>BigInt(v??0),sum=(rows,fn)=>rows.reduce((v,r)=>v+decimal(fn(r)),0n).toString();
export function occurrenceCostFixture(){
 let state={budget:{id:1,cap_micro_usd:'1000000',consumed_micro_usd:'0',quarantined:false},runs:new Map(),grants:new Map(),allocations:new Map(),bindings:new Map(),requests:new Map(),tools:new Map(),tenantReservations:new Map()};
 const queries=[],releases=[],faults={query:null,commit:false,release:false},observed=new Map();let tail=Promise.resolve(),tick=NOW,reservations=1000;
 const liabilities=s=>[...s.requests.values()].map(r=>({...r,kind:'model',slot:r.request_id,consumed_micro_usd:r.actual_micro_usd??'0'})).concat([...s.tools.values()].map(r=>({...r,kind:'tool',slot:r.invocation_id,consumed_micro_usd:r.charged_micro_usd??'0'})));
 const pool={async connect(){let local,unlock,readOnly=false;return {async query(sql,p=[]){
  queries.push({sql,params:clone(p)});await faults.query?.(sql,p);
  const rows=v=>({rows:clone(v),rowCount:v.length});
  if(sql.startsWith('BEGIN')){readOnly=sql.includes('READ ONLY');if(readOnly)local=clone(state);return rows([]);}
  if(sql.startsWith('SET LOCAL'))return rows([]);
  if(sql==='COMMIT'){if(!readOnly)state=local;if(faults.commit){faults.commit=false;throw Error('synthetic committed acknowledgement lost');}return rows([]);}
  if(sql==='ROLLBACK')return rows([]);
  if(sql==='SELECT clock_timestamp() AS now')return rows([{now:new Date(tick)}]);
  assert.equal(sql.includes('meri_qualification.'),false);
  if(sql.includes('meri_product_budget.budget WHERE')){
   if(!local){const previous=tail;tail=new Promise(r=>unlock=r);await previous;local=clone(state);}
   return rows([local.budget]);
  }
  if(sql.includes('to_regclass('))return rows([{reservations:'meri_product_budget.tenant_run_reservations'}]);
  if(sql.includes('.tenant_budgets WHERE'))return rows([{tenant_id:p[0],monthly_cap_micro_usd:'1000000',max_concurrent_runs:100}]);
  if(sql.startsWith('SELECT count(*) FILTER')){
   if(sql.includes('budget_liabilities')){const all=liabilities(local).filter(r=>r.run_id===p[0]);return rows([{unresolved:String(all.filter(r=>r.state==='UNKNOWN').length),consumed:sum(all,r=>r.consumed_micro_usd)}]);}
   const all=[...local.tenantReservations.values()].filter(r=>r.tenant_id===p[0]);
   return rows([{active:String(all.filter(r=>r.state==='HELD').length),held:sum(all.filter(r=>['HELD','RELEASED'].includes(r.state)&&r.month===p[1]),r=>r.hold_micro_usd),settled:sum(all.filter(r=>r.state==='SETTLED'&&r.month===p[1]),r=>r.settled_micro_usd)}]);
  }
  if(sql.includes('.tenant_run_reservations WHERE')){const row=local.tenantReservations.get(`${p[0]}:${p[1]}`);return rows(row?[row]:[]);}
  if(sql.startsWith('INSERT INTO meri_product_budget.tenant_run_reservations')){local.tenantReservations.set(`${p[0]}:${p[1]}`,{tenant_id:p[0],run_id:p[1],month:p[2],hold_micro_usd:String(p[3]),settled_micro_usd:null,state:'HELD'});return rows([]);}
  if(sql.startsWith('UPDATE meri_product_budget.tenant_run_reservations')){const row=local.tenantReservations.get(`${p[0]}:${p[1]}`);if(!row||row.state!==p[4])return rows([]);Object.assign(row,{state:p[2],settled_micro_usd:p[3]});return {rows:[],rowCount:1};}
  if(sql.startsWith('SELECT run_id,allocation,allocation_sha256'))return rows([...local.allocations.values()].filter(r=>r.allocation.run.tenantId===p[0]&&r.allocation.occurrenceCostScope?.occurrenceKey===p[1]).sort((a,b)=>a.run_id.localeCompare(b.run_id)).map(({run_id,allocation,allocation_sha256,max_tool_calls,max_cost_micro_usd})=>({run_id,allocation,allocation_sha256,max_tool_calls,max_cost_micro_usd})));
  if(sql.includes(' FROM meri_product_budget.budget_liabilities')){
   const all=liabilities(local);
   if(sql.startsWith('SELECT 1'))return rows(all.filter(r=>sql.includes("kind='model'")?(r.kind==='model'&&r.slot===p[0]||r.grant_id===p[1]&&r.state==='UNKNOWN'):r.grant_id===p[0]&&r.state==='UNKNOWN').map(()=>({one:1})));
   if(sql.includes(' AS run_total'))return rows([{held:sum(all.filter(r=>r.state==='UNKNOWN'),r=>r.hold_micro_usd),run_total:sum(all.filter(r=>r.run_id===p[0]),r=>r.state==='UNKNOWN'?r.hold_micro_usd:r.consumed_micro_usd)}]);
   if(sql.includes('run_id=ANY'))return rows([{total:sum(all.filter(r=>p[0].includes(r.run_id)&&!(p.length>1&&r.kind===p[1]&&r.slot===p[2])),r=>r.state==='UNKNOWN'?r.hold_micro_usd:r.consumed_micro_usd)}]);
   if(sql.includes(' AS held'))return rows([{held:sum(all.filter(r=>r.state==='UNKNOWN'&&!(r.kind==='model'&&r.slot===p[0])),r=>r.hold_micro_usd)}]);
   if(sql.includes(' AS total'))return rows([{total:sum(all.filter(r=>r.run_id===p[0]&&!(r.kind==='model'&&r.slot===p[1])),r=>r.state==='UNKNOWN'?r.hold_micro_usd:r.consumed_micro_usd)}]);
  }
  if(sql.startsWith('SELECT count(*) AS calls FROM'))return rows([{calls:String([...local.tools.values()].filter(r=>r.run_id===p[0]).length)}]);
  if(sql.startsWith('SELECT * FROM meri_product_budget.')){
   const name=sql.match(/meri_product_budget\.([a-z_]+)/u)[1],map={runs:local.runs,grants:local.grants,tool_run_allocations:local.allocations,tool_grant_bindings:local.bindings,requests:local.requests,tool_reservations:local.tools}[name];assert.ok(map,`known table ${name}`);
   if(name==='grants'&&sql.includes('WHERE run_id'))return rows([...map.values()].filter(r=>r.run_id===p[0]||p[1]?.includes(r.grant_id)).sort((a,b)=>a.grant_id.localeCompare(b.grant_id)));
   return rows(map.has(p[0])?[map.get(p[0])]:[]);
  }
  if(sql.startsWith('INSERT INTO meri_product_budget.')){
   const name=sql.match(/meri_product_budget\.([a-z_]+)/u)[1];let map,row;
   if(name==='runs'){map=local.runs;row={run_id:p[0],attempt:p[1],worker_arn:p[2],fence:p[3],policy_revision:p[4]};}
   if(name==='tool_run_allocations'){map=local.allocations;row={run_id:p[0],allocation_sha256:p[1],allocation:clone(p[2]),max_tool_calls:String(p[3]),max_cost_micro_usd:String(p[4]),started_at:new Date(tick)};}
   if(name==='grants'){map=local.grants;row={grant_id:p[0],run_id:p[1],attempt:p[2],worker_arn:p[3],fence:p[4],policy_revision:p[5],capability_sha256:p[6],expires_at:p[7],state:'PENDING'};}
   if(name==='tool_grant_bindings'){map=local.bindings;row={grant_id:p[0],run_id:p[1],facts:clone(p[2])};}
   if(name==='tool_reservations'){map=local.tools;row={invocation_id:p[0],reservation_id:p[1],grant_id:p[2],run_id:p[3],facts:clone(p[4]),operation:clone(p[5]),arguments_sha256:p[6],hold_micro_usd:String(p[7]),max_output_bytes:String(p[8]),state:'UNKNOWN',charged_micro_usd:null,output_bytes:null,settled_at:null};}
   if(name==='requests'){map=local.requests;row={request_id:p[0],grant_id:p[1],run_id:p[2],attempt:p[3],worker_arn:p[4],fence:p[5],policy_revision:p[6],native_body_sha256:p[7],raw_request_sha256:p[8],model_id:p[9],profile_id:p[10],pricing_revision:p[11],pricing_valid_until:p[12],input_tokens:p[13],max_output_tokens:p[14],hold_micro_usd:String(p[15]),state:'UNKNOWN',actual_micro_usd:null,evidence_sha256:null,settled_at:null};}
   assert.ok(map,`known insertion ${name}`);if(!map.has(p[0]))map.set(p[0],row);return rows([]);
  }
  if(sql.startsWith('UPDATE meri_product_budget.grants')){const row=local.grants.get(p[0]);if(sql.includes("state='REVOKED'")){if(row&&['PENDING','ACTIVE'].includes(row.state))row.state='REVOKED';}else if(row?.state==='PENDING')row.state='ACTIVE';return rows([]);}
  if(sql.startsWith('UPDATE meri_product_budget.budget SET')){local.budget.consumed_micro_usd=String(decimal(local.budget.consumed_micro_usd)+decimal(p[0]));local.budget.quarantined||=p[1]===true;return {rows:[],rowCount:1};}
  if(sql.startsWith('UPDATE meri_product_budget.tool_reservations SET')){const row=local.tools.get(p[0]);Object.assign(row,{state:'SETTLED',charged_micro_usd:row.hold_micro_usd,output_bytes:String(p[1]),settled_at:new Date(tick)});return {rows:[],rowCount:1};}
  if(sql.startsWith('UPDATE meri_product_budget.requests SET')){const row=local.requests.get(p[0]);if(row?.state!=='UNKNOWN')return rows([]);Object.assign(row,{state:'SETTLED',actual_micro_usd:p[1],evidence_sha256:p[2],settled_at:new Date(tick)});return {rows:[],rowCount:1};}
  assert.fail('unsupported scoped budget SQL '+sql);
 },release(error){releases.push(error);unlock?.();if(faults.release){faults.release=false;throw Error('synthetic release acknowledgement lost');}}};}};
 const originBinding={tenantId:'tenant-a',actorId:'actor-a',conversationId:id(1),runId:id(101),attemptId:id(201),workerId:id(301),writerFence:1};
 const scope={version:1,kind:'schedule-occurrence',occurrenceKey:'e'.repeat(64),originBinding,maxCostMicroUSD:50};
 const manifest=JSON.parse(readFileSync(new URL('../../../../packages/skills/originals/relationship_brief/1.0.0/manifest.json',import.meta.url))),operation=manifest.allowedOperations[0],clientId=id(5),now=()=>tick;
 async function attempt(n,{costScope=scope,principal={tenantId:'tenant-a',actorId:'actor-a'},conversationId=id(1),install=true}={}){
  const binding={...principal,conversationId,runId:id(100+n),attemptId:id(200+n),workerId:id(300+n),writerFence:n},policyRevision='a'.repeat(64),taskArn=`arn:aws:ecs:us-east-1:967807252336:task/Synthetic/${String(n).padStart(32,'0')}`;
  const a={run:{...principal,conversationId,runId:binding.runId},manifest:clone(manifest),manifestSha256:hash(manifest),catalogSha256:'b'.repeat(64),budgets:clone(manifest.budgets),schedule:{revision:'c'.repeat(64),expiresAt:new Date(NOW+60000).toISOString(),operations:[{operation,chargeMicrousd:20}]},...(costScope===null?{}:{occurrenceCostScope:clone(costScope)})};
  const qualification={attempt:n,policyRevision},grantIntents=[{grantId:id(400+n),capabilitySha256:hash({n,kind:'tool'}),expiresAtMs:NOW+50000},{grantId:id(500+n),capabilitySha256:hash({n,kind:'model'}),expiresAtMs:NOW+50000}];
  const config={pool,allocationJson:JSON.stringify(a),grantIntents,qualification,binding,now,limits:{maxRequestMs:1000,maxFactBytes:131072}},native=createNativeAllocationAdmission(config);
  const facts=grantIntents.map(g=>({grantId:g.grantId,binding,qualificationBinding:{runId:binding.runId,...qualification,workerArn:taskArn,fence:n},capabilitySha256:g.capabilitySha256,allocationSha256:hash(a)}));
  const scopes=[{tenantId:binding.tenantId,kind:'client',resourceId:clientId,policyRevision}],pricing={modelId:'synthetic-never-called',profileId:'synthetic',revision:'d'.repeat(64),validUntilMs:NOW+40000,actualInputMicroUSDPerK:3300,reserveInputMicroUSDPerK:6600,outputMicroUSDPerK:16500,maxInputTokens:8192,maxOutputTokens:256};
  const modelConfig={pool,allocationJson:config.allocationJson,grantFactsJsons:facts.map(JSON.stringify),modelGrantId:facts[1].grantId,selectedClientId:clientId,pricing,now,limits:config.limits,
   async observe(q){const value={binding,taskArn,capabilitySha256:facts[1].capabilitySha256,nativeBodySha256:hash({slot:q.requestId}),rawRequestSha256:hash({slot:q.requestId,raw:true}),modelId:pricing.modelId,profileId:pricing.profileId,maxOutputTokens:1,count:{nativeBodySha256:hash({slot:q.requestId}),modelId:pricing.modelId,inputTokens:1}};observed.set(q.requestId,value);return value;},
   async checkCurrentConversation(){return {identitySha256:'a'.repeat(64),binding,scopes,selectedClientId:clientId,contextRevision:'b'.repeat(64),checkedAtMs:tick,expiresAtMs:NOW+50000};}};
  const model=createProductModelReservation(modelConfig),settlement=createProductModelSettlement({pool,allocationJson:config.allocationJson,grantFactsJsons:facts.map(JSON.stringify),modelGrantId:facts[1].grantId,pricing,async observeComplete({requestId}){const o=observed.get(requestId);return {requestId,binding,taskArn,capabilitySha256:facts[1].capabilitySha256,nativeBodySha256:o.nativeBodySha256,rawRequestSha256:o.rawRequestSha256,modelId:pricing.modelId,profileId:pricing.profileId,pricingRevision:pricing.revision,evidenceSha256:hash({requestId,complete:true}),httpStatus:200,complete:true,eof:true,usage:{inputTokens:1,outputTokens:1}};}});
  const toolBudget=createPostgresToolBudget({pool,allocationJson:config.allocationJson,namespace:'product',now});
  async function tool(slot){const reservationId=id(++reservations),invocation={...facts[0],invocationId:`attempt_${n}_${slot}`},owner=toolBudget.forInvocation(JSON.stringify(invocation));
   const budgets={maxTurns:manifest.budgets.maxTurns,maxCostMicrousd:manifest.budgets.maxCostMicroUSD,maxOutputBytes:manifest.budgets.maxOutputBytes,maxRuntimeSeconds:manifest.budgets.maxRuntimeSeconds},claims={binding,policyRevision,budgets,issuedAt:new Date(NOW).toISOString(),expiresAt:new Date(NOW+50000).toISOString()};
   const reserved=await owner.reserve({reservationId,binding,claims,budgets,operation,argumentsSha256:hash({slot}),deadlineMs:NOW+50000});return {reserved,owner,reservationId};}
  if(install)await native.admit({taskArn});
  return {a,binding,facts,config,native,taskArn,tool,model,settlement,modelConfig,request:requestId=>({requestId,binding,deadlineMs:NOW+30000})};
 }
 return {pool,queries,releases,faults,scope,originBinding,state:()=>state,attempt,now,advance:ms=>{tick+=ms;}};
}
