/** Install the budget grant of one Core-minted execution capability on the run's EXISTING allocation (dot PR #121 item 5, lane X).
 *
 * `createNativeAllocationAdmission` installs only the grants declared at admission and `bindTrustedGrant` requires an already
 * ACTIVE matching `grants` row, so nothing else creates the row an execution capability needs. This owner does, under the same
 * discipline as admission: the canonical budget lock, `readCurrentAdmission` (the run must be ADMITTED and current, on the same
 * allocation hash), INSERT ... ON CONFLICT DO NOTHING, then an exact read-back inside the same transaction.
 *
 *   createExecutionGrantAdmission({pool, allocationJson, grantFactsJsons, now, limits, namespace?})
 *     .install({facts, expiresAtMs, signal})  -> {state:'ACTIVE', grantId, expiresAtMs, deadlineMs}
 *     .revoke({grantId?, signal})             -> {state:'REVOKED', grantIds}
 *
 * `facts` is the full immutable grant identity (`parseToolGrantFacts` shape): `grantId` = jti, `binding` = the admitted run's
 * binding exactly, `qualificationBinding` = the admitted set's qualification exactly, `capabilitySha256` = the exact compact-token
 * digest, `allocationSha256` = the admitted allocation's digest. The admitted task/model grants are never reused: a `grantId` or
 * digest that collides with one is refused before any SQL. The row is inserted ACTIVE (never PENDING: nothing activates it later)
 * with `expires_at` = the token `exp`, which rev 3 Core bounds by the run deadline Meri sent. Idempotent on `grantId`: a replay
 * with the same facts and expiry answers the same ACTIVE row; the same `grantId` with another binding, qualification, digest or
 * expiry is `EXECUTION_GRANT_CONFLICT`, and a revoked grant never comes back (`EXECUTION_GRANT_REVOKED`). The facts row
 * (`tool_grant_bindings`) is written once and never updated.
 *
 * Revocation: `revoke` sets every execution grant of the run (every grant row that is not in the admitted set) to REVOKED under
 * the budget lock; it works after expiry or quarantine. The run-terminal cleanup (`createNativeAllocationAdmission(...).revoke`)
 * revokes them too, and a fence advance refuses them implicitly: every use re-reads the `runs` row and the grant row against the
 * facts' fence (`assertRun`). `assertExecutionGrantBinding` is the invariant the native admission applies to any grant row on the
 * run it did not declare: bound (`tool_grant_bindings`) to this exact run, allocation and qualification, with the row's digest. */
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {parseToolGrantFacts,same} from './tool-budget-binding.mjs';
import {admittedConfiguration,assertRun,dbTime} from './admitted-run-binding.mjs';
import {readCurrentAdmission} from './admitted-run-current.mjs';
import {PostgresBudgetStore,BudgetStateDenied,refuse} from './postgres-budget-store.mjs';
const FACT_KEYS=['grantId','binding','qualificationBinding','capabilitySha256','allocationSha256'];
const ROW_STATES=['ACTIVE','REVOKED'];
/** A grant row the admission did not declare must be an execution-capability grant of this exact run. Throws NATIVE_ADMISSION_CONFLICT. */
export function assertExecutionGrantBinding({grant,bound,allocation,mapping}){
 let facts;
 try{
  if(!grant||!bound||!ROW_STATES.includes(grant.state)||bound.grant_id!==grant.grant_id||bound.run_id!==grant.run_id||grant.run_id!==mapping.runId)throw Error();
  facts=parseToolGrantFacts(JSON.stringify(bound.facts),allocation);
  if(facts.grantId!==grant.grant_id||!same(facts.qualificationBinding,mapping)||facts.capabilitySha256!==grant.capability_sha256)throw Error();
  assertRun(grant,facts);dbTime(grant.expires_at);
 }catch{refuse('NATIVE_ADMISSION_CONFLICT');}
 return facts;
}
export function createExecutionGrantAdmission(configuration){
 const raw=own(configuration,['pool','allocationJson','grantFactsJsons','now','limits'],['namespace']);
 // Production allocation only, like native admission; the qualification namespace never holds execution grants.
 if(raw.namespace!==undefined&&raw.namespace!=='product')refuse('EXECUTION_GRANT_CONFIGURATION');
 let c;try{c=admittedConfiguration({...raw,namespace:'product'});}catch{refuse('EXECUTION_GRANT_CONFIGURATION');}
 const store=new PostgresBudgetStore(c.pool,{namespace:'product'}),t=store.tables,mapping=c.facts[0].qualificationBinding;
 const admittedIds=new Set(c.facts.map(f=>f.grantId)),admittedDigests=new Set(c.facts.map(f=>f.capabilitySha256));
 const checked=(client,check)=>Object.freeze({async query(...args){check();const result=await client.query(...args);check();return result;}});
 /** The execution grant identity: the facts shape over THIS allocation, this binding and this qualification, never an admitted grant. */
 function executionFacts(value){
  let facts;
  try{facts=parseToolGrantFacts(JSON.stringify(data(own(value,FACT_KEYS))),c.a);}catch{refuse('EXECUTION_GRANT_REFUSED');}
  if(!same(facts.binding,c.binding)||!same(facts.qualificationBinding,mapping)||admittedIds.has(facts.grantId)||admittedDigests.has(facts.capabilitySha256))refuse('EXECUTION_GRANT_REFUSED');
  return facts;
 }
 function lifetime(signal,deadlineMs){
  const life=createOperationLifetime({now:c.now,signal,deadlineMs,errorFactory:()=>new BudgetStateDenied('EXECUTION_GRANT_STOPPED')});
  return {life,check:()=>{life.check();if(signal?.aborted)refuse('EXECUTION_GRANT_STOPPED');}};
 }
 async function install(value){
  const v=own(value,['facts','expiresAtMs'],['signal']);nativeSignal(v.signal);const facts=executionFacts(v.facts),at=c.now();
  if(!Number.isSafeInteger(at)||at<0||!Number.isSafeInteger(v.expiresAtMs)||v.expiresAtMs<=at||v.expiresAtMs>Date.parse(c.a.schedule.expiresAt))refuse('EXECUTION_GRANT_REFUSED');
  const {life,check}=lifetime(v.signal,Math.min(at+c.limits.maxRequestMs,v.expiresAtMs));
  try{return await life.run(()=>store.transact(async raw=>{
   const client=checked(raw,check);
   // Budget lock, run/allocation/admitted-grant currency, all FOR UPDATE: the same predicate every admitted-run effect takes.
   const deadline=await readCurrentAdmission({c,store,client,life,check,locked:true});
   await client.query(`INSERT INTO ${t.grants}(grant_id,run_id,attempt,worker_arn,fence,policy_revision,capability_sha256,expires_at,state) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING`,
    [facts.grantId,mapping.runId,mapping.attempt,mapping.workerArn,mapping.fence,mapping.policyRevision,facts.capabilitySha256,new Date(v.expiresAtMs),'ACTIVE']);
   await client.query(`INSERT INTO ${t.tool_grant_bindings}(grant_id,run_id,facts) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,[facts.grantId,mapping.runId,facts]);
   // Exact read-back: the row that exists now is this grant with these facts, or nothing was installed and nothing is reused.
   const grants=(await client.query(`SELECT * FROM ${t.grants} WHERE grant_id=$1 FOR UPDATE`,[facts.grantId])).rows;
   if(grants.length!==1)refuse('EXECUTION_GRANT_CONFLICT');const g=grants[0];
   try{assertRun(g,facts);}catch{refuse('EXECUTION_GRANT_CONFLICT');}
   if(g.grant_id!==facts.grantId||g.capability_sha256!==facts.capabilitySha256||dbTime(g.expires_at)!==v.expiresAtMs)refuse('EXECUTION_GRANT_CONFLICT');
   if(g.state==='REVOKED')refuse('EXECUTION_GRANT_REVOKED');
   if(g.state!=='ACTIVE')refuse('EXECUTION_GRANT_CONFLICT');
   const bound=(await client.query(`SELECT * FROM ${t.tool_grant_bindings} WHERE grant_id=$1 FOR UPDATE`,[facts.grantId])).rows;
   if(bound.length!==1||bound[0].grant_id!==facts.grantId||bound[0].run_id!==mapping.runId||!same(bound[0].facts,facts))refuse('EXECUTION_GRANT_CONFLICT');
   return data({state:'ACTIVE',grantId:facts.grantId,expiresAtMs:v.expiresAtMs,deadlineMs:deadline});
  },check));}finally{life.close();}
 }
 async function revoke(value={}){
  const v=own(value,[],['grantId','signal']);nativeSignal(v.signal);const at=c.now();
  if(!Number.isSafeInteger(at)||at<0||v.grantId!==undefined&&(typeof v.grantId!=='string'||admittedIds.has(v.grantId)))refuse('EXECUTION_GRANT_REFUSED');
  const {life,check}=lifetime(v.signal,at+c.limits.maxRequestMs);
  try{return await life.run(()=>store.transact(async raw=>{
   const client=checked(raw,check);await store.lock(client);
   const rows=(await client.query(`SELECT * FROM ${t.grants} WHERE run_id=$1 ORDER BY grant_id FOR UPDATE`,[c.binding.runId])).rows;
   const targets=rows.filter(row=>!admittedIds.has(row.grant_id)&&(v.grantId===undefined||row.grant_id===v.grantId));
   if(v.grantId!==undefined&&targets.length!==1)refuse('EXECUTION_GRANT_UNKNOWN');
   for(const row of targets)await client.query(`UPDATE ${t.grants} SET state='REVOKED' WHERE grant_id=$1 AND state IN ('ACTIVE','PENDING')`,[row.grant_id]);
   for(const row of targets){
    const after=(await client.query(`SELECT * FROM ${t.grants} WHERE grant_id=$1 FOR UPDATE`,[row.grant_id])).rows;
    if(after.length!==1||after[0].state!=='REVOKED')refuse('EXECUTION_REVOCATION_UNKNOWN');
   }
   return data({state:'REVOKED',grantIds:targets.map(row=>row.grant_id)});
  },check));}finally{life.close();}
 }
 return Object.freeze({install,revoke});
}
