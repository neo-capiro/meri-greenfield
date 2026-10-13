/** Explicit product-namespace SQL script; no pg/network/native qualification. */
import assert from 'node:assert/strict';
import {harness,NOW} from '../../../docs/qualification/candidates/durable-invocation-20261012/review/invocation-harness.mjs';
export {NOW};
export function productFixture(){
 const seed=harness(),commands=[],releases=[];let at=NOW,tail=Promise.resolve(),lose=false;
 let state={budget:{id:1,cap_micro_usd:'100',consumed_micro_usd:'0',quarantined:false},run:structuredClone(seed.state().run),grant:structuredClone(seed.state().grant),allocation:null,bindings:new Map(),reservations:new Map(),produced:new Map()};
 const pool={async connect(){let local,unlock;return{async query(sql,p=[]){
  commands.push({sql,p});const rows=x=>({rows:structuredClone(x),rowCount:x.length});
  if(sql==='BEGIN'||sql.startsWith('SET LOCAL'))return rows([]);
  if(sql==='COMMIT'){state=local;local=null;if(lose){lose=false;throw Error('synthetic lost commit ACK');}return rows([]);}
  if(sql==='ROLLBACK'){local=null;return rows([]);}
  if(sql==='SELECT clock_timestamp() AS now')return rows([{now:new Date(at)}]);
  if(sql==='SELECT synthetic_effect')return rows([{value:'owned SQL result'}]);
  assert.equal(sql.includes('meri_qualification.'),false,'product owner must never issue qualification SQL');
  if(sql==='SELECT * FROM meri_product_budget.budget WHERE id=1 FOR UPDATE'){if(!local){const previous=tail;tail=new Promise(r=>unlock=r);await previous;local=structuredClone(state);}return rows([local.budget]);}
  if(sql.startsWith('SELECT * FROM meri_product_budget.runs'))return rows([local.run]);
  if(sql.startsWith('SELECT * FROM meri_product_budget.grants'))return rows(local.grant.grant_id===p[0]?[local.grant]:[]);
  if(sql.startsWith('SELECT * FROM meri_product_budget.tool_run_allocations'))return rows(local.allocation?[local.allocation]:[]);
  if(sql.startsWith('SELECT * FROM meri_product_budget.tool_grant_bindings'))return rows(local.bindings.has(p[0])?[local.bindings.get(p[0])]:[]);
  if(sql.startsWith('INSERT INTO meri_product_budget.tool_run_allocations')){local.allocation={run_id:p[0],allocation_sha256:p[1],allocation:p[2],max_tool_calls:String(p[3]),max_cost_micro_usd:String(p[4]),started_at:new Date(at)};return rows([]);}
  if(sql.startsWith('INSERT INTO meri_product_budget.tool_grant_bindings')){local.bindings.set(p[0],{grant_id:p[0],run_id:p[1],facts:p[2]});return rows([]);}
  if(sql.startsWith('SELECT * FROM meri_product_budget.tool_invocations'))return rows([...local.produced.values()].filter(r=>r.run_id===p[0]&&r.producer_key_sha256===p[1]));
  if(sql.startsWith('INSERT INTO meri_product_budget.tool_invocations')){local.produced.set(p[0],{invocation_id:p[0],run_id:p[1],producer_key_sha256:p[2],delivery:p[3],facts:p[4],raw_request_sha256:p[5],operation:p[6],deadline_ms:String(p[7]),created_at:new Date(at),reservation_id:null,arguments_sha256:null,completion:null});return rows([]);}
  if(sql.startsWith('UPDATE meri_product_budget.tool_invocations SET')){const row=local.produced.get(p[0]);if(sql.includes('completion='))row.completion=p[1];else{row.reservation_id=p[1];row.arguments_sha256=p[2];}return rows([]);}
  if(sql.startsWith('SELECT * FROM meri_product_budget.tool_reservations'))return rows(local.reservations.has(p[0])?[local.reservations.get(p[0])]:[]);
  if(sql.startsWith('SELECT 1 FROM meri_product_budget.budget_liabilities'))return rows([...local.reservations.values()].filter(r=>r.grant_id===p[0]&&r.state==='UNKNOWN').map(()=>({one:1})));
  if(sql.includes(' AS run_total FROM meri_product_budget.budget_liabilities'))return rows([{held:String([...local.reservations.values()].filter(r=>r.state==='UNKNOWN').reduce((a,r)=>a+BigInt(r.hold_micro_usd),0n)),run_total:String([...local.reservations.values()].filter(r=>r.run_id===p[0]).reduce((a,r)=>a+BigInt(r.state==='UNKNOWN'?r.hold_micro_usd:r.charged_micro_usd),0n))}]);
  if(sql.startsWith('SELECT count(*) AS calls FROM meri_product_budget.tool_reservations'))return rows([{calls:String(local.reservations.size)}]);
  if(sql.startsWith('INSERT INTO meri_product_budget.tool_reservations')){local.reservations.set(p[0],{invocation_id:p[0],reservation_id:p[1],grant_id:p[2],run_id:p[3],facts:p[4],operation:p[5],arguments_sha256:p[6],hold_micro_usd:String(p[7]),max_output_bytes:String(p[8]),state:'UNKNOWN',charged_micro_usd:null,output_bytes:null,created_at:new Date(at),settled_at:null});return rows([]);}
  if(sql.startsWith('UPDATE meri_product_budget.budget SET consumed_micro_usd')){local.budget.consumed_micro_usd=String(BigInt(local.budget.consumed_micro_usd)+BigInt(p[0]));return rows([]);}
  if(sql.startsWith('UPDATE meri_product_budget.tool_reservations SET')){Object.assign(local.reservations.get(p[0]),{state:'SETTLED',charged_micro_usd:local.reservations.get(p[0]).hold_micro_usd,output_bytes:String(p[1]),settled_at:new Date(at)});return rows([]);}
  if(sql==='UPDATE meri_product_budget.grants SET state=$1 WHERE grant_id=$2'){local.grant.state=p[0];return rows([]);}
  if(sql==='UPDATE meri_product_budget.runs SET fence=$1 WHERE run_id=$2'){local.run.fence=p[0];return rows([]);}
  throw Error('unsupported scripted product SQL:'+sql);
 },release(error){releases.push(error);unlock?.();}};}};
 return{...seed,pool,commands,releases,state:()=>state,now:()=>at,setClock(value){at=value;seed.setClock(value);},loseCommit(){lose=true;}};
}
