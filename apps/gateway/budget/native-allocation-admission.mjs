/** Install original trusted allocation against the actual qualified task, once.
 * Reuses the canonical budget lock/predicate; never mints capabilities or tasks.
 * Grant rows on the run that this admission did not declare are tolerated ONLY as execution-capability grants
 * (`execution-grant-admission.mjs`): bound to this exact run, allocation and qualification. Revocation revokes them too.
 */
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256,validateShape} from '../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {allocation,same,digest,integer as positive} from './tool-budget-binding.mjs';
import {admittedConfiguration,assertRun,dbTime,integer} from './admitted-run-binding.mjs';
import {readCurrentAdmission} from './admitted-run-current.mjs';
import {PostgresBudgetStore,BudgetStateDenied,refuse} from './postgres-budget-store.mjs';
import {nativeTenantBudget} from './tenant/native-admission.mjs';
import {readOccurrenceCost} from './occurrence-cost-scope.mjs';
import {assertExecutionGrantBinding} from './execution-grant-admission.mjs';

export function createNativeAllocationAdmission(configuration){
 const c=own(configuration,['pool','allocationJson','grantIntents','qualification','binding','now','limits'],['namespace']);
 // Production allocation is never installed in the qualification namespace.
 if(c.namespace!==undefined&&c.namespace!=='product')refuse('NATIVE_ADMISSION_CONFIGURATION');
 const a=allocation(c.allocationJson),binding=data(c.binding),q=data(own(c.qualification,['attempt','policyRevision']));validateShape('RunBinding',binding);
 const intents=data(c.grantIntents),limits=data(own(c.limits,['maxRequestMs','maxFactBytes']));
 if(typeof c.now!=='function'||!Array.isArray(intents)||intents.length<1||intents.length>16)refuse('NATIVE_ADMISSION_CONFIGURATION');
 positive(q.attempt);digest(q.policyRevision);
 if(q.attempt>2147483647||binding.writerFence>2147483647||!same(a.run,Object.fromEntries(Object.keys(a.run).map(k=>[k,binding[k]])))||!Number.isSafeInteger(limits.maxRequestMs)||limits.maxRequestMs<1||limits.maxRequestMs>30000||!Number.isSafeInteger(limits.maxFactBytes)||limits.maxFactBytes<1||limits.maxFactBytes>131072)refuse('NATIVE_ADMISSION_CONFIGURATION');
 const configuredAt=c.now();if(!Number.isSafeInteger(configuredAt)||configuredAt<0)refuse('NATIVE_ADMISSION_CONFIGURATION');
 const ids=new Set(),hashes=new Set();
 for(const intent of intents){
  own(intent,['grantId','capabilitySha256','expiresAtMs']);
  digest(intent.capabilitySha256);
  if(typeof intent.grantId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(intent.grantId)||ids.has(intent.grantId)||hashes.has(intent.capabilitySha256)||!Number.isSafeInteger(intent.expiresAtMs)||intent.expiresAtMs<1||intent.expiresAtMs>Date.parse(a.schedule.expiresAt)||intent.expiresAtMs>configuredAt+a.budgets.maxRuntimeSeconds*1000)refuse('NATIVE_ADMISSION_CONFIGURATION');
  ids.add(intent.grantId);hashes.add(intent.capabilitySha256);
 }
 const store=new PostgresBudgetStore(c.pool,{namespace:'product'}),t=store.tables;
 function configured(taskArn){
  const grantFactsJsons=intents.map(i=>JSON.stringify({grantId:i.grantId,binding,qualificationBinding:{runId:binding.runId,attempt:q.attempt,workerArn:taskArn,fence:binding.writerFence,policyRevision:q.policyRevision},capabilitySha256:i.capabilitySha256,allocationSha256:canonicalSha256(a)}));
  return {...admittedConfiguration({pool:c.pool,namespace:'product',allocationJson:c.allocationJson,grantFactsJsons,now:c.now,limits}),grantFactsJsons};
 }
 // Actual ARN is required at the operation boundary; no stand-in identity exists.
 async function exact(client,configured,locked,revoking=false){
  const suffix=locked?' FOR UPDATE':'',f=configured.facts[0];
  const runs=(await client.query(`SELECT * FROM ${t.runs} WHERE run_id=$1${suffix}`,[binding.runId])).rows;
  if(runs.length!==1)refuse('NATIVE_ADMISSION_CONFLICT');assertRun(runs[0],f);
  const allocations=(await client.query(`SELECT * FROM ${t.tool_run_allocations} WHERE run_id=$1${suffix}`,[binding.runId])).rows,row=allocations[0];
  if(allocations.length!==1||!same(row.allocation,a)||row.allocation_sha256!==configured.allocationSha256||integer(row.max_tool_calls)!==a.budgets.maxToolCalls||integer(row.max_cost_micro_usd)!==a.budgets.maxCostMicroUSD)refuse('NATIVE_ADMISSION_CONFLICT');
  const rows=(await client.query(`SELECT * FROM ${t.grants} WHERE run_id=$1 ORDER BY grant_id${suffix}`,[binding.runId])).rows;
  const declared=rows.filter(row=>intents.some(i=>i.grantId===row.grant_id)),extra=rows.filter(row=>!intents.some(i=>i.grantId===row.grant_id));
  if(declared.length!==intents.length)refuse('NATIVE_ADMISSION_CONFLICT');
  for(const fact of configured.facts){
   const g=declared.find(row=>row.grant_id===fact.grantId),intent=intents.find(i=>i.grantId===fact.grantId);assertRun(g,fact);
   if(!g||!(revoking?['PENDING','ACTIVE','REVOKED']:['PENDING','ACTIVE']).includes(g.state)||g.capability_sha256!==fact.capabilitySha256||dbTime(g.expires_at)!==intent.expiresAtMs)refuse('NATIVE_ADMISSION_CONFLICT');
   const installed=(await client.query(`SELECT * FROM ${t.tool_grant_bindings} WHERE grant_id=$1${suffix}`,[fact.grantId])).rows;
   if(installed.length!==1||installed[0].run_id!==binding.runId||!same(installed[0].facts,fact))refuse('NATIVE_ADMISSION_CONFLICT');
  }
  // Execution-capability grants installed later on this run's allocation; anything else on the run is a conflict.
  for(const row of extra){
   const installed=(await client.query(`SELECT * FROM ${t.tool_grant_bindings} WHERE grant_id=$1${suffix}`,[row.grant_id])).rows;
   assertExecutionGrantBinding({grant:row,bound:installed.length===1?installed[0]:null,allocation:a,mapping:f.qualificationBinding});
  }
  return extra.map(row=>row.grant_id);
 }
 async function operation(value,install,revoking=false){
  const input=own(value,['taskArn'],['signal']);nativeSignal(input.signal);const admitted=configured(input.taskArn),at=c.now();
  if(!Number.isSafeInteger(at)||at<0)refuse('NATIVE_ADMISSION_CONFIGURATION');
  const expiry=Math.min(Date.parse(a.schedule.expiresAt),...intents.map(i=>i.expiresAtMs));
  const life=createOperationLifetime({now:c.now,signal:input.signal,deadlineMs:revoking?at+limits.maxRequestMs:Math.min(at+limits.maxRequestMs,expiry),errorFactory:()=>new BudgetStateDenied('NATIVE_ADMISSION_STOPPED')});
  const check=()=>life.check();
  try{return await life.run(()=>store.transact(async client=>{
   const budget=await(install||revoking?store.lock(client):store.read(client));check();
   if(!revoking&&(budget.quarantined!==false||dbTime(budget.now)>=expiry||BigInt(budget.consumed_micro_usd)>=BigInt(budget.cap_micro_usd)))refuse('NATIVE_ADMISSION_REFUSED');
   if(revoking){
    const runs=(await client.query(`SELECT * FROM ${t.runs} WHERE run_id=$1 FOR UPDATE`,[binding.runId])).rows;check();
    const allocations=(await client.query(`SELECT * FROM ${t.tool_run_allocations} WHERE run_id=$1 FOR UPDATE`,[binding.runId])).rows;check();
    const grants=(await client.query(`SELECT * FROM ${t.grants} WHERE run_id=$1 OR grant_id=ANY($2::uuid[]) FOR UPDATE`,[binding.runId,intents.map(i=>i.grantId)])).rows;check();
    if(!runs.length&&!allocations.length&&!grants.length)return data({state:'REVOKED',taskArn:input.taskArn,grantIds:intents.map(i=>i.grantId),revocationProven:true,authorityAbsent:true});
   }
   if(install){
    await nativeTenantBudget({client,binding,nowMs:dbTime(budget.now),allocation:a,signal:life.signal,check}).admit();check();
    const f=admitted.facts[0],mapping=f.qualificationBinding;
    await client.query(`INSERT INTO ${t.runs}(run_id,attempt,worker_arn,fence,policy_revision) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,[mapping.runId,mapping.attempt,mapping.workerArn,mapping.fence,mapping.policyRevision]);check();
    await client.query(`INSERT INTO ${t.tool_run_allocations}(run_id,allocation_sha256,allocation,max_tool_calls,max_cost_micro_usd) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,[binding.runId,admitted.allocationSha256,a,a.budgets.maxToolCalls,a.budgets.maxCostMicroUSD]);check();
    for(const fact of [...admitted.facts].sort((x,y)=>x.grantId.localeCompare(y.grantId))){
     const i=intents.find(i=>i.grantId===fact.grantId);
     await client.query(`INSERT INTO ${t.grants}(grant_id,run_id,attempt,worker_arn,fence,policy_revision,capability_sha256,expires_at,state) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'PENDING') ON CONFLICT DO NOTHING`,[fact.grantId,binding.runId,mapping.attempt,mapping.workerArn,mapping.fence,mapping.policyRevision,fact.capabilitySha256,new Date(i.expiresAtMs)]);check();
     await client.query(`INSERT INTO ${t.tool_grant_bindings}(grant_id,run_id,facts) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,[fact.grantId,binding.runId,fact]);check();
    }
   }
   const executionGrantIds=await exact(client,admitted,install||revoking,revoking);check();
   if(revoking){
    // The admitted set and every execution-capability grant of the run end together (run terminal).
    for(const grantId of [...admitted.facts.map(f=>f.grantId),...executionGrantIds]){await client.query(`UPDATE ${t.grants} SET state='REVOKED' WHERE grant_id=$1 AND state IN ('ACTIVE','PENDING')`,[grantId]);check();}
    const revoked=(await client.query(`SELECT * FROM ${t.grants} WHERE run_id=$1 ORDER BY grant_id FOR UPDATE`,[binding.runId])).rows;check();
    if(revoked.length!==intents.length+executionGrantIds.length||revoked.some(g=>g.state!=='REVOKED'))refuse('NATIVE_REVOCATION_UNKNOWN');
    await nativeTenantBudget({client,binding,nowMs:dbTime(budget.now),allocation:a,signal:life.signal,check}).revoke();check();
    return data({state:'REVOKED',taskArn:input.taskArn,grantIds:admitted.facts.map(f=>f.grantId),revocationProven:true});
   }
   const occurrence=await readOccurrenceCost({client,tables:t,allocation:a,parseAllocation:allocation});check();
   if(occurrence&&occurrence.totalMicroUSD>occurrence.maxCostMicroUSD)refuse('NATIVE_ADMISSION_REFUSED');
   if(install)for(const fact of admitted.facts){await client.query(`UPDATE ${t.grants} SET state='ACTIVE' WHERE grant_id=$1 AND state='PENDING'`,[fact.grantId]);check();}
   const deadline=await readCurrentAdmission({c:admitted,store,client,life,check,locked:install,readOnly:!install});check();
   return data({state:'ADMITTED',grantFactsJsons:admitted.grantFactsJsons,currentAllocationJson:JSON.stringify({binding,policyRevision:q.policyRevision,deadlineMs:deadline,checkedAtMs:c.now(),allocation:a,allocationSha256:admitted.allocationSha256})});
  },check,undefined,!install&&!revoking));}finally{life.close();}
 }
 return Object.freeze({admit:value=>operation(value,true),read:value=>operation(value,false),revoke:value=>operation(value,false,true)});
}
