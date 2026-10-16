import test from 'node:test';
import assert from 'node:assert/strict';
import {productFixture,NOW} from '../product-scripted-fixture.mjs';
import {createNativeAllocationAdmission} from '../native-allocation-admission.mjs';
import {BudgetCommitUncertain} from '../postgres-budget-store.mjs';

/** Scripted SQL transaction model. No PostgreSQL or task allocation is claimed. */
function fixture(){
 const seed=productFixture(),commands=[];let clock=NOW,lose=false,fail=false,chain=Promise.resolve();
 let state={budget:{id:1,cap_micro_usd:'1000000',consumed_micro_usd:'0',quarantined:false},runs:new Map(),grants:new Map(),allocations:new Map(),bindings:new Map(),tenantPolicy:{tenant_id:seed.invocation.binding.tenantId,monthly_cap_micro_usd:'1000000',max_concurrent_runs:2},tenantReservations:new Map(),liabilities:[]};
 const pool={async connect(){let local,unlock,readOnly=false;return{async query(sql,p=[]){
  commands.push({sql,p});const rows=v=>({rows:structuredClone(v),rowCount:v.length});
  if(sql.startsWith('BEGIN')){readOnly=sql.includes('READ ONLY');if(readOnly)local=structuredClone(state);return rows([]);}
  if(sql.startsWith('SET LOCAL'))return rows([]);
  if(sql==='COMMIT'){if(!readOnly)state=local;if(lose){lose=false;throw Error('lost acknowledged commit');}return rows([]);}
  if(sql==='ROLLBACK')return rows([]);
  if(sql==='SELECT clock_timestamp() AS now')return rows([{now:new Date(clock)}]);
  if(sql.includes('.budget WHERE')){if(!readOnly&&!local){const prior=chain;chain=new Promise(r=>unlock=r);await prior;local=structuredClone(state);}return rows([local.budget]);}
  if(sql.includes('to_regclass('))return rows([{reservations:'meri_product_budget.tenant_run_reservations'}]);
  if(sql.includes('.tenant_budgets WHERE'))return rows(local.tenantPolicy?[local.tenantPolicy]:[]);
  if(sql.startsWith('SELECT count(*) FILTER')){
   if(sql.includes('budget_liabilities'))return rows([{unresolved:String(local.liabilities.filter(r=>r.state==='UNKNOWN').length),consumed:String(local.liabilities.reduce((sum,r)=>sum+Number(r.consumed_micro_usd??0),0))}]);
   const reservations=[...local.tenantReservations.values()];return rows([{active:String(reservations.filter(r=>r.state==='HELD').length),held:String(reservations.filter(r=>['HELD','RELEASED'].includes(r.state)&&r.month===p[1]).reduce((sum,r)=>sum+Number(r.hold_micro_usd),0)),settled:String(reservations.filter(r=>r.state==='SETTLED'&&r.month===p[1]).reduce((sum,r)=>sum+Number(r.settled_micro_usd),0))}]);
  }
  if(sql.includes('.tenant_run_reservations WHERE'))return rows(local.tenantReservations.has(p[1])?[local.tenantReservations.get(p[1])]:[]);
  if(sql.startsWith('INSERT INTO meri_product_budget.tenant_run_reservations')){local.tenantReservations.set(p[1],{tenant_id:p[0],run_id:p[1],month:p[2],hold_micro_usd:String(p[3]),settled_micro_usd:null,state:'HELD'});return rows([]);}
  if(sql.startsWith('UPDATE meri_product_budget.tenant_run_reservations')){const r=local.tenantReservations.get(p[1]);if(!r||r.state!==p[4])return {rows:[],rowCount:0};Object.assign(r,{state:p[2],settled_micro_usd:p[3]});return {rows:[],rowCount:1};}
  if(sql.startsWith('SELECT * FROM meri_product_budget.')){
   const name=sql.match(/meri_product_budget\.([a-z_]+)/)[1],map={runs:local.runs,grants:local.grants,tool_run_allocations:local.allocations,tool_grant_bindings:local.bindings}[name];
   assert.ok(map,'known table');
   if(name==='grants'&&sql.includes('WHERE run_id'))return rows([...map.values()].filter(g=>g.run_id===p[0]||p[1]?.includes(g.grant_id)).sort((a,b)=>a.grant_id.localeCompare(b.grant_id)));
   return rows(map.has(p[0])?[map.get(p[0])]:[]);
  }
  if(sql.startsWith('INSERT INTO meri_product_budget.')){
   const name=sql.match(/meri_product_budget\.([a-z_]+)/)[1];let row,map;
   if(name==='runs'){map=local.runs;row={run_id:p[0],attempt:p[1],worker_arn:p[2],fence:p[3],policy_revision:p[4]};}
   if(name==='tool_run_allocations'){map=local.allocations;row={run_id:p[0],allocation_sha256:p[1],allocation:p[2],max_tool_calls:String(p[3]),max_cost_micro_usd:String(p[4]),started_at:new Date(clock)};}
   if(name==='grants'){map=local.grants;row={grant_id:p[0],run_id:p[1],attempt:p[2],worker_arn:p[3],fence:p[4],policy_revision:p[5],capability_sha256:p[6],expires_at:p[7],state:'PENDING'};}
   if(name==='tool_grant_bindings'){map=local.bindings;row={grant_id:p[0],run_id:p[1],facts:p[2]};}
   assert.ok(map);if(!map.has(p[0]))map.set(p[0],structuredClone(row));return rows([]);
  }
  if(sql.startsWith('UPDATE meri_product_budget.grants')){if(fail){fail=false;throw Error('activation unavailable');}const g=local.grants.get(p[0]);if(sql.includes("state='REVOKED'")){if(g&&['ACTIVE','PENDING'].includes(g.state))g.state='REVOKED';}else if(g?.state==='PENDING')g.state='ACTIVE';return rows([]);}
  assert.fail('unsupported SQL '+sql);
 },release(){unlock?.();}};}};
 const binding=seed.invocation.binding,qualification={attempt:1,policyRevision:seed.invocation.qualificationBinding.policyRevision};
 const grantIntents=[{grantId:seed.invocation.grantId,capabilitySha256:seed.invocation.capabilitySha256,expiresAtMs:NOW+9000},{grantId:'11111111-1111-4111-8111-000000000099',capabilitySha256:'c'.repeat(64),expiresAtMs:NOW+8000}];
 const config={pool,allocationJson:JSON.stringify(seed.allocation),grantIntents,qualification,binding,now:()=>clock,limits:{maxRequestMs:1000,maxFactBytes:65536}},taskArn=seed.invocation.qualificationBinding.workerArn;
 return{config,taskArn,commands,state:()=>state,owner:()=>createNativeAllocationAdmission(config),lose(){lose=true;},fail(){fail=true;},clock(value){clock=value;}};
}
test('new actual-task allocation atomically activates original grants and exact replay never extends deadlines',async()=>{
 const f=fixture(),owner=f.owner(),first=await owner.admit({taskArn:f.taskArn});assert.equal(first.state,'ADMITTED');
 assert.equal(f.state().runs.size,1);assert.equal(f.state().grants.size,2);assert.ok([...f.state().grants.values()].every(g=>g.state==='ACTIVE'));
 assert.deepEqual(first.grantFactsJsons.map(JSON.parse).map(f=>f.qualificationBinding.workerArn),[f.taskArn,f.taskArn]);
 const began=f.state().allocations.get(f.config.binding.runId).started_at;
 f.clock(NOW+1000);const read=await owner.read({taskArn:f.taskArn}),replay=await owner.admit({taskArn:f.taskArn});
 assert.equal(JSON.parse(read.currentAllocationJson).deadlineMs,NOW+8000);assert.equal(JSON.parse(replay.currentAllocationJson).deadlineMs,NOW+8000);assert.deepEqual(f.state().allocations.get(f.config.binding.runId).started_at,began);
});
test('concurrent identical admissions share budget owner and leave a single exact allocation',async()=>{
 const f=fixture(),o=f.owner();await Promise.all([o.admit({taskArn:f.taskArn}),o.admit({taskArn:f.taskArn})]);assert.equal(f.state().runs.size,1);assert.equal(f.state().grants.size,2);
});
test('lost commit acknowledgement is UNKNOWN until exact canonical ACTIVE readback',async()=>{
 const f=fixture(),o=f.owner();f.lose();await assert.rejects(o.admit({taskArn:f.taskArn}),BudgetCommitUncertain);assert.ok([...f.state().grants.values()].every(g=>g.state==='ACTIVE'));
 assert.equal((await o.read({taskArn:f.taskArn})).state,'ADMITTED');assert.equal(f.commands.filter(c=>c.sql.startsWith('UPDATE')).length,2);
});
test('activation failure rolls back whole allocation and read cannot release pending task',async()=>{
 const f=fixture();f.fail();await assert.rejects(f.owner().admit({taskArn:f.taskArn}));assert.equal(f.state().runs.size,0);assert.equal(f.state().grants.size,0);await assert.rejects(f.owner().read({taskArn:f.taskArn}));
});
test('original cleanup proves absent authority, revokes only exact original set and works after expiry/quarantine',async()=>{
 const f=fixture(),o=f.owner();assert.equal((await o.revoke({taskArn:f.taskArn})).authorityAbsent,true);assert.equal(f.state().runs.size,0);
 await o.admit({taskArn:f.taskArn});f.clock(NOW+20000);f.state().budget.quarantined=true;
 const proof=await o.revoke({taskArn:f.taskArn});assert.equal(proof.revocationProven,true);assert.ok([...f.state().grants.values()].every(g=>g.state==='REVOKED'));
 assert.equal((await o.revoke({taskArn:f.taskArn})).revocationProven,true);await assert.rejects(o.read({taskArn:f.taskArn}));
 await assert.rejects(o.revoke({taskArn:f.taskArn.replace(/a{32}$/,'b'.repeat(32))}));
});
for(const mutation of ['task','expiry','revoked','extra','allocation'])test(`exact read/admit refuses ${mutation} without rebinding or repair`,async()=>{
 const f=fixture(),o=f.owner();await o.admit({taskArn:f.taskArn});let arn=f.taskArn;
 if(mutation==='task')arn=arn.replace(/a{32}$/,'b'.repeat(32));
 if(mutation==='expiry')[...f.state().grants.values()][0].expires_at=new Date(NOW+9500);
 if(mutation==='revoked')[...f.state().grants.values()][0].state='REVOKED';
 if(mutation==='extra')f.state().grants.set('other',{...structuredClone([...f.state().grants.values()][0]),grant_id:'other'});
 if(mutation==='allocation')f.state().allocations.get(f.config.binding.runId).allocation_sha256='d'.repeat(64);
 const before=structuredClone(f.state());await assert.rejects(o.read({taskArn:arn}));await assert.rejects(o.admit({taskArn:arn}));assert.deepEqual(f.state(),before);
});
test('expired, cancelled, wrong-account and duplicate/extended intent calls refuse before SQL',async()=>{
 const f=fixture(),o=f.owner(),count=f.commands.length;await assert.rejects(o.admit({taskArn:f.taskArn.replace('967807252336','000000000000')}));assert.equal(f.commands.length,count);
 const ac=new AbortController();ac.abort();await assert.rejects(o.admit({taskArn:f.taskArn,signal:ac.signal}));assert.equal(f.commands.length,count);
 for(const change of [c=>c.grantIntents.push({...c.grantIntents[0]}),c=>c.grantIntents[0].expiresAtMs=NOW+11000,c=>c.qualification.attempt=0]){const c={...f.config,grantIntents:structuredClone(f.config.grantIntents),qualification:{...f.config.qualification}};change(c);assert.throws(()=>createNativeAllocationAdmission(c));}
 f.clock(NOW+9000);await assert.rejects(o.admit({taskArn:f.taskArn}));assert.equal(f.commands.length,count);
});
