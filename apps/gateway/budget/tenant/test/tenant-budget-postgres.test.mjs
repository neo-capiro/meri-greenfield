import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID as uuid} from 'node:crypto';
import {createRequire as requireFrom} from 'node:module';
import {createPostgresTenantBudgetStore} from '../postgres-store.mjs';
import {tenantBudgetGate} from '../gate.mjs';
import {BudgetStateDenied,BudgetCommitUncertain} from '../../postgres-budget-store.mjs';
const NOW=Date.UTC(2026,9,15),run=n=>`11111111-1111-4111-8111-${String(n).padStart(12,'0')}`,tenant='tenant-pg';

/** Scripted SQL transaction model of the proposed tables. It establishes the adapter's SQL control flow and row decoding, not
 * PostgreSQL isolation, driver behavior or the unapplied migration. */
function scripted({cap='1000',max=2}={}){
 const commands=[];let state={budgets:new Map([[tenant,{tenant_id:tenant,monthly_cap_micro_usd:cap,max_concurrent_runs:max}]]),reservations:new Map()},lose=false,tail=Promise.resolve();
 const pool={async connect(){let local,unlock;return {async query(sql,p=[]){commands.push({sql,p});const rows=v=>({rows:structuredClone(v),rowCount:v.length});
  if(sql.startsWith('BEGIN')||sql.startsWith('SET LOCAL'))return rows([]);
  if(sql==='COMMIT'){state=local;local=null;if(lose){lose=false;throw Error('synthetic lost COMMIT acknowledgement');}return rows([]);}
  if(sql==='ROLLBACK'){local=null;return rows([]);}
  if(sql.includes('FROM meri_product_budget.tenant_budgets WHERE tenant_id=$1 FOR UPDATE')){if(!local){const prior=tail;tail=new Promise(r=>unlock=r);await prior;local=structuredClone(state);}const b=local.budgets.get(p[0]);return rows(b?[sql.startsWith('SELECT 1')?{'?column?':1}:b]:[]);}
  assert.ok(local,'tenant row must be locked before any reservation SQL');
  const mine=[...local.reservations.values()].filter(r=>r.tenant_id===p[0]);
  if(sql.startsWith('SELECT count(*) FILTER')){const held=mine.filter(r=>r.state==='HELD');return rows([{active:String(held.length),held:String(held.filter(r=>r.month===p[1]).reduce((a,r)=>a+BigInt(r.hold_micro_usd),0n)),settled:String(mine.filter(r=>r.state==='SETTLED'&&r.month===p[1]).reduce((a,r)=>a+BigInt(r.settled_micro_usd),0n))}]);}
  if(sql.startsWith('SELECT * FROM meri_product_budget.tenant_run_reservations WHERE tenant_id=$1 AND run_id=$2 FOR UPDATE')){const r=local.reservations.get(p[0]+':'+p[1]);return rows(r?[r]:[]);}
  if(sql.startsWith('INSERT INTO meri_product_budget.tenant_run_reservations')){assert.equal(local.reservations.has(p[0]+':'+p[1]),false);local.reservations.set(p[0]+':'+p[1],{tenant_id:p[0],run_id:p[1],month:p[2],hold_micro_usd:String(p[3]),settled_micro_usd:null,state:'HELD'});return rows([]);}
  if(sql.startsWith('UPDATE meri_product_budget.tenant_run_reservations SET state=$3')){const r=local.reservations.get(p[0]+':'+p[1]);if(!r||r.state!==p[4])return {rows:[],rowCount:0};r.state=p[2];r.settled_micro_usd=p[3]===null?null:String(p[3]);return {rows:[],rowCount:1};}
  assert.fail('unsupported SQL '+sql);
 },release(error){releases.push(error);unlock?.();}};}};
 const releases=[];
 return {pool,commands,releases,state:()=>state,lose(){lose=true;}};
}
const refused=(promise,code)=>assert.rejects(promise,error=>error instanceof BudgetStateDenied&&error.message===code);

test('scripted SQL: reserve, replay, cap/concurrency refusals, release and settle-after-cancel use one locked tenant transaction each',async()=>{
 const f=scripted({cap:'100',max:1}),gate=tenantBudgetGate({store:createPostgresTenantBudgetStore({pool:f.pool}),now:()=>NOW});
 const first=await gate.admit({tenantId:tenant,runId:run(1),holdMicroUSD:60});assert.deepEqual(first,{tenantId:tenant,runId:run(1),month:'2026-10',holdMicroUSD:60,settledMicroUSD:null,state:'HELD',replayed:false});
 assert.equal((await gate.admit({tenantId:tenant,runId:run(1),holdMicroUSD:60})).replayed,true);
 await refused(gate.admit({tenantId:tenant,runId:run(2),holdMicroUSD:1}),'TENANT_CONCURRENCY_EXCEEDED');assert.equal(f.state().reservations.size,1);
 assert.deepEqual(await gate.read({tenantId:tenant}),{tenantId:tenant,month:'2026-10',monthlyCapMicroUSD:100,maxConcurrentRuns:1,activeRuns:1,heldMicroUSD:60,settledMicroUSD:0,remainingMicroUSD:40});
 assert.equal((await gate.release({tenantId:tenant,runId:run(1)})).state,'RELEASED');
 await refused(gate.admit({tenantId:tenant,runId:run(2),holdMicroUSD:101}),'TENANT_BUDGET_EXCEEDED');assert.equal((await gate.admit({tenantId:tenant,runId:run(2),holdMicroUSD:100})).state,'HELD');
 const settled=await gate.settle({tenantId:tenant,runId:run(1),measuredMicroUSD:70});assert.equal(settled.state,'SETTLED');assert.equal(f.state().reservations.get(tenant+':'+run(1)).settled_micro_usd,'70');
 await refused(gate.settle({tenantId:tenant,runId:run(1),measuredMicroUSD:71}),'TENANT_SETTLEMENT_CONFLICT');
 await refused(gate.admit({tenantId:'tenant-other',runId:run(3),holdMicroUSD:1}),'TENANT_BUDGET_UNCONFIGURED');await refused(gate.release({tenantId:tenant,runId:run(9)}),'TENANT_RESERVATION_UNKNOWN');
 const begins=f.commands.filter(c=>c.sql==='BEGIN').length,commits=f.commands.filter(c=>c.sql==='COMMIT').length,rollbacks=f.commands.filter(c=>c.sql==='ROLLBACK').length;
 assert.equal(begins,commits+rollbacks);assert.ok(f.releases.every(e=>e===undefined));
 for(let i=0;i<f.commands.length;i++)if(f.commands[i].sql==='BEGIN')assert.match(f.commands[i+3].sql,/tenant_budgets WHERE tenant_id=\$1 FOR UPDATE/u);
});
test('scripted SQL: concurrent reservations serialize on the tenant lock and a lost COMMIT acknowledgement stays uncertain',async()=>{
 const f=scripted({cap:'1000000',max:2}),gate=tenantBudgetGate({store:createPostgresTenantBudgetStore({pool:f.pool}),now:()=>NOW});
 const outcomes=await Promise.allSettled([1,2,3,4,5].map(n=>gate.admit({tenantId:tenant,runId:run(n),holdMicroUSD:1})));
 assert.equal(outcomes.filter(o=>o.status==='fulfilled').length,2);assert.equal(f.state().reservations.size,2);
 f.lose();await assert.rejects(gate.release({tenantId:tenant,runId:run(1)}),BudgetCommitUncertain);
 assert.equal(f.state().reservations.get(tenant+':'+run(1)).state,'RELEASED');assert.equal(f.releases.at(-1) instanceof BudgetCommitUncertain,true);
});

/** Real PostgreSQL over a Unix socket, only when an operator has applied the proposed DDL and set MERI_TENANT_BUDGET_PG_SOCKET.
 * The test inserts one synthetic tenant policy row and deletes its own rows afterwards; it never creates or alters schema. */
const socket=process.env.MERI_TENANT_BUDGET_PG_SOCKET;
test('real PostgreSQL adapter over the proposed tables',{skip:socket?false:'MERI_TENANT_BUDGET_PG_SOCKET is not set'},async()=>{
 const {Pool}=requireFrom(new URL('../../../../runtime/package.json',import.meta.url))('pg');
 const pool=new Pool({host:socket,database:process.env.MERI_TENANT_BUDGET_PG_DATABASE??'meri_product',user:process.env.MERI_TENANT_BUDGET_PG_USER??process.env.USER,max:3,connectionTimeoutMillis:5000,query_timeout:6000});
 const id='synthetic-'+uuid(),store=createPostgresTenantBudgetStore({pool}),gate=tenantBudgetGate({store,now:()=>NOW});
 try{
  await pool.query(`INSERT INTO ${store.tables.budgets}(tenant_id,monthly_cap_micro_usd,max_concurrent_runs) VALUES($1,100,1)`,[id]);
  const a=run(1),b=run(2);
  assert.equal((await gate.admit({tenantId:id,runId:a,holdMicroUSD:60})).state,'HELD');
  await refused(gate.admit({tenantId:id,runId:b,holdMicroUSD:1}),'TENANT_CONCURRENCY_EXCEEDED');
  assert.equal((await gate.release({tenantId:id,runId:a})).state,'RELEASED');
  await refused(gate.admit({tenantId:id,runId:b,holdMicroUSD:101}),'TENANT_BUDGET_EXCEEDED');
  assert.equal((await gate.admit({tenantId:id,runId:b,holdMicroUSD:100})).state,'HELD');
  assert.equal((await gate.settle({tenantId:id,runId:a,measuredMicroUSD:70})).settledMicroUSD,70);
  assert.deepEqual(await gate.read({tenantId:id}),{tenantId:id,month:'2026-10',monthlyCapMicroUSD:100,maxConcurrentRuns:1,activeRuns:1,heldMicroUSD:100,settledMicroUSD:70,remainingMicroUSD:0});
 }finally{
  try{await pool.query(`DELETE FROM ${store.tables.reservations} WHERE tenant_id=$1`,[id]);await pool.query(`DELETE FROM ${store.tables.budgets} WHERE tenant_id=$1`,[id]);}finally{await pool.end();}
 }
});
