/** Private allocation restriction, never authority or a second ledger. The trusted fact producer seals this scope from canonical
 * occurrence/same-job lineage; no browser/model supplied scope is admitted here. All totals are read inside the caller's existing
 * global budget lock. Model and tool UNKNOWN liabilities remain fully held across every run in this deterministic occurrence. */
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {validateShape,canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {budgetTables} from './namespace.mjs';
import {refuse} from './postgres-budget-store.mjs';

export function assertOccurrenceCostScope(value,run){
 try{
  const s=data(own(value,['version','kind','occurrenceKey','originBinding','maxCostMicroUSD']));validateShape('RunBinding',s.originBinding);
  const target=data(own(run,['tenantId','actorId','conversationId','runId']));
  validateShape('RunBinding',{...target,attemptId:target.runId,workerId:target.runId,writerFence:1});
  const b=s.originBinding;
  if(s.version!==1||s.kind!=='schedule-occurrence'||typeof s.occurrenceKey!=='string'||!/^[a-f0-9]{64}$/u.test(s.occurrenceKey)||
   b.writerFence!==1||b.tenantId!==target.tenantId||b.actorId!==target.actorId||b.conversationId!==target.conversationId||
   !Number.isSafeInteger(s.maxCostMicroUSD)||s.maxCostMicroUSD<1)refuse('OCCURRENCE_COST_SCOPE_INVALID');
  return s;
 }catch{refuse('OCCURRENCE_COST_SCOPE_INVALID');}
}
function money(value){
 if(!(typeof value==='string'&&/^(0|[1-9][0-9]*)$/u.test(value)||Number.isSafeInteger(value)&&value>=0))refuse('OCCURRENCE_COST_STATE');
 return BigInt(value);
}
/** `parseAllocation` is the canonical allocation() parser supplied by its owning caller, avoiding a dependency cycle with the
 * allocation parser's scope validator. This helper owns only the additional predicate; callers still enforce global/per-run caps.
 * Historical settlement may exclude its original slot, then add independently observed actual usage. No mutation/refund here. */
export async function readOccurrenceCost({client,tables,allocation:a,parseAllocation,exclude}){
 if(!Object.hasOwn(a,'occurrenceCostScope'))return null;
 const scope=assertOccurrenceCostScope(a.occurrenceCostScope,a.run);
 if(![budgetTables('product'),budgetTables('qualification')].includes(tables)||typeof parseAllocation!=='function')refuse('OCCURRENCE_COST_CONFIGURATION');
 let omitted;
 if(exclude!==undefined){omitted=data(own(exclude,['kind','slot']));if(!['model','tool'].includes(omitted.kind)||typeof omitted.slot!=='string'||!omitted.slot||omitted.slot.length>128)refuse('OCCURRENCE_COST_CONFIGURATION');}
 // Group identity excludes the cap: changing the cap/origin must be a conflict, never a fresh budget group.
 const rows=(await client.query(`SELECT run_id,allocation,allocation_sha256,max_tool_calls,max_cost_micro_usd FROM ${tables.tool_run_allocations} WHERE allocation#>>'{run,tenantId}'=$1 AND allocation#>>'{occurrenceCostScope,occurrenceKey}'=$2 ORDER BY run_id`,[a.run.tenantId,scope.occurrenceKey])).rows;
 if(!Array.isArray(rows)||!rows.length)refuse('OCCURRENCE_COST_STATE');
 const ids=new Set(),scopeSha256=hash(scope);
 for(const raw of rows){
  const row=data(own(raw,['run_id','allocation','allocation_sha256','max_tool_calls','max_cost_micro_usd']));
  const installed=parseAllocation(JSON.stringify(row.allocation));
  if(row.run_id!==installed.run.runId||ids.has(row.run_id)||row.allocation_sha256!==hash(installed)||
   hash(installed.occurrenceCostScope??null)!==scopeSha256||money(row.max_tool_calls)!==BigInt(installed.budgets.maxToolCalls)||
   money(row.max_cost_micro_usd)!==BigInt(installed.budgets.maxCostMicroUSD))refuse('OCCURRENCE_COST_CONFLICT');
  ids.add(row.run_id);
 }
 if(!ids.has(a.run.runId))refuse('OCCURRENCE_COST_STATE');
 const parameters=[[...ids],...(omitted?[omitted.kind,omitted.slot]:[])];
 const totals=(await client.query(`SELECT COALESCE(sum(CASE WHEN state='UNKNOWN' THEN hold_micro_usd ELSE consumed_micro_usd END),0) AS total FROM ${tables.budget_liabilities} WHERE run_id=ANY($1::uuid[])${omitted?' AND NOT (kind=$2 AND slot=$3)':''}`,parameters)).rows;
 if(!Array.isArray(totals)||totals.length!==1)refuse('OCCURRENCE_COST_STATE');
 return Object.freeze({totalMicroUSD:money(totals[0].total),maxCostMicroUSD:BigInt(scope.maxCostMicroUSD)});
}
