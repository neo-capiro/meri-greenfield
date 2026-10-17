/** Default-off tenant-bound PostgreSQL custody port. Borrowed pool only: import
 * performs no connection and this module never ends the pool. It grants no
 * native access and never reconciles a durable CLAIMED row on a read/retry. */
import {randomUUID} from 'node:crypto';
import {types} from 'node:util';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {objectiveSourceUnavailable} from './projection.mjs';
import {assertObjectivePostgresSources,assertObjectivePostgresLookupSources,decodeObjectiveCustodyRow,
 objectiveCustodyReadState,objectiveCustodyRecordColumns} from './postgres-records.mjs';

const unavailable=()=>objectiveSourceUnavailable();
const refuse=()=>{throw unavailable();};
const conflict=()=>{throw Object.assign(Error('OBJECTIVE_CUSTODY_CONFLICT'),{code:'OBJECTIVE_CUSTODY_CONFLICT'});};
const unknown=()=>Object.assign(Error('OBJECTIVE_CUSTODY_ACK_UNKNOWN'),{code:'OBJECTIVE_CUSTODY_ACK_UNKNOWN'});
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(v);
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/u.test(v);
const same=(a,b)=>hash(a)===hash(b);
const COLUMNS='generation_job_id,tenant_id,conversation_id,run_id,issuance_key,binding_sha256,binding,source_admission_sha256,source_request_sha256,facts_sha256,record_sha256,original_expires_at_ms::text AS original_expires_at_ms,record,state,claim_fence,version::text AS version,claimed_at,committed_at';
const RUN_COLUMNS='tenant_id,conversation_id,run_id,projection,projection_sha256,request_id,request,request_sha256';
const ISSUANCE_COLUMNS='issuance_key,tenant_id,conversation_id,run_id,binding,binding_sha256,request_sha256,expires_at_ms::text AS expires_at_ms,state,grant_id,capability_sha256,facts_sha256';
const insert='INSERT INTO meri_objective_source.custody(generation_job_id,tenant_id,conversation_id,run_id,issuance_key,binding_sha256,binding,source_admission_sha256,source_request_sha256,facts_sha256,record_sha256,original_expires_at_ms,record,state,claim_fence,version) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,\'CLAIMED\',$14,1) ON CONFLICT DO NOTHING RETURNING '+COLUMNS;
const finalization='UPDATE meri_objective_source.custody SET state=\'COMMITTED\',version=2,committed_at=clock_timestamp() WHERE generation_job_id=$1 AND tenant_id=$2 AND claim_fence=$3 AND version=1 AND state=\'CLAIMED\' AND record_sha256=$4 RETURNING '+COLUMNS;
const one=rows=>{if(!Array.isArray(rows)||rows.length!==1)refuse();return rows[0];};
const maybe=rows=>{if(!Array.isArray(rows)||rows.length>1)refuse();return rows[0]??null;};

export function createPostgresObjectiveCustodyStore(configuration={}){
 let enabled=false,connect,tenantId,now=Date.now,maxRequestMs=3000,allocateFence=randomUUID;
 try{
  const flag=configuration&&typeof configuration==='object'&&!types.isProxy(configuration)?Object.getOwnPropertyDescriptor(configuration,'enabled'):null;
  if(flag&&'value'in flag&&flag.value===true){
   const c=own(configuration,['enabled','pool','tenantId'],['now','maxRequestMs','allocateFence']);
   tenantId=c.tenantId;now=c.now??now;maxRequestMs=c.maxRequestMs??maxRequestMs;allocateFence=c.allocateFence??allocateFence;
   if(typeof tenantId!=='string'||!tenantId||tenantId.trim()!==tenantId||tenantId.length>128||typeof now!=='function'||types.isProxy(now)||
    typeof allocateFence!=='function'||types.isProxy(allocateFence)||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>3000)refuse();
   connect=storageMethod(c.pool,'connect');enabled=true;
  }
 }catch{enabled=false;}
 function lifetime(signal){
  nativeSignal(signal);if(!enabled)refuse();let previous=now();if(!Number.isSafeInteger(previous)||previous<0)refuse();const deadlineMs=previous+maxRequestMs;
  const clock=()=>{const current=now();if(!Number.isSafeInteger(current)||current<previous)refuse();previous=current;return current;};
  return Object.freeze({...createOperationLifetime({now:clock,signal,deadlineMs,errorFactory:unavailable}),now:clock,deadlineMs});
 }
 async function transaction(life,writes,body){
  const slot={client:null,released:false,abandoned:false};let query,release,begun=false,poisoned=false,commitSent=false,commitSettled=false,committed=false,releaseFailed=false,reusable=false,failure,result;
  // A cancelled connect may still resolve. Dispose that late borrowed client;
  // never return it to the pool or leave an unobserved rejection behind.
  function dispose(error){
   if(!slot.client||slot.released)return;slot.released=true;
   try{(release??storageMethod(slot.client,'release'))(error);}catch{releaseFailed=true;
    try{Promise.resolve(storageMethod(slot.client,'end')()).catch(()=>{});}catch{/* malformed borrowed client remains unavailable */}}
  }
  // Once COMMIT was sent, a write whose acknowledgement is missing, or whose
  // settled COMMIT cannot be released to the caller (late abort, deadline or
  // release failure), is ACK_UNKNOWN: only exact durable readback may recover it.
  const outcomeUnknown=()=>writes&&commitSent&&(!commitSettled||committed);
  const pending=Promise.resolve().then(()=>{life.check();return connect();}).then(client=>{slot.client=client;if(slot.abandoned)dispose(unavailable());return client;});
  pending.catch(()=>{});
  async function q(text,values=[]){
   life.check();const remaining=Math.max(1,Math.ceil(life.deadlineMs-life.now()));
   try{return await life.run(async()=>{
    life.check();if(text==='COMMIT')commitSent=true;
    const answer=await query({text,values,query_timeout:remaining});
    if(!answer||!Array.isArray(answer.rows))refuse();
    if(text==='COMMIT'){commitSettled=answer.command==='COMMIT'||answer.command==='ROLLBACK';committed=answer.command==='COMMIT';if(!committed)refuse();}
    return answer;
   });}catch(error){poisoned=true;throw error;}
  }
  try{
   const client=await life.run(()=>pending);life.check();query=storageMethod(client,'query');release=storageMethod(client,'release');
   await q('BEGIN ISOLATION LEVEL READ COMMITTED');begun=true;
   const timeout=String(Math.max(1,Math.ceil(life.deadlineMs-life.now())))+'ms';
   await q("SELECT set_config('statement_timeout',$1,true),set_config('lock_timeout',$2,true)",[timeout,timeout]);
   result=await body(q);life.check();await q('COMMIT');life.check();reusable=true;
  }catch(error){
   failure=outcomeUnknown()?unknown():['OBJECTIVE_CUSTODY_CONFLICT','OBJECTIVE_CUSTODY_ACK_UNKNOWN'].includes(error?.code)?error:unavailable();
   // Only a fully settled pre-commit semantic failure permits rollback/reuse.
   // SQL/connection timeout or cancellation can leave SQL in flight: discard.
   if(begun&&!commitSent&&!poisoned){try{life.check();await q('ROLLBACK');reusable=true;}catch{}}
  }finally{slot.abandoned=true;dispose(reusable?undefined:failure??unavailable());}
  if(failure)throw failure;
  // Final release gate after cleanup: a release failure or an abort/deadline that
  // raced client release never turns a result into success, or a write into absence.
  try{if(releaseFailed)refuse();life.check();}catch{throw outcomeUnknown()?unknown():unavailable();}
  return result;
 }
 const globalGate=(q,job)=>q('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`meri_objective_source:custody:${job}`]);
 async function databaseNow(q){
  const value=one((await q('SELECT floor(extract(epoch FROM clock_timestamp())*1000)::text AS now_ms')).rows).now_ms;
  if(typeof value!=='string'||!/^(?:0|[1-9][0-9]*)$/u.test(value)||!Number.isSafeInteger(Number(value)))refuse();return Number(value);
 }
 async function sources(q,binding,issuanceKey){
  await q('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`${tenantId}:${binding.conversationId}`]);
  const runRow=one((await q('SELECT '+RUN_COLUMNS+' FROM meri_conversations.runs WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3 FOR UPDATE',
   [tenantId,binding.conversationId,binding.runId])).rows);
  const issuanceRow=one((await q('SELECT '+ISSUANCE_COLUMNS+' FROM meri_conversations.run_issuances WHERE issuance_key=$1 AND tenant_id=$2 AND conversation_id=$3 AND run_id=$4 FOR UPDATE',
   [issuanceKey,tenantId,binding.conversationId,binding.runId])).rows);
  return {runRow,issuanceRow};
 }
 async function row(q,job,lock=false){
  return maybe((await q('SELECT '+COLUMNS+' FROM meri_objective_source.custody WHERE generation_job_id=$1 AND tenant_id=$2'+(lock?' FOR UPDATE':''),[job,tenantId])).rows);
 }
 async function operation(signal,run){const life=lifetime(signal);try{return await run(life);}finally{life.close();}}
 // Adapter-local sticky uncertainty. After an ambiguous write acknowledgement this
 // instance never reports ABSENT for that job or issuance key, and never attempts
 // another claim for it. Only an exact durable COMMITTED row resolves it. There
 // is no persisted tombstone: a restarted instance relies on serialized reads.
 const uncertainJobs=new Set(),uncertainIssuances=new Set();
 async function remembering(columns,run){
  try{return await run();}catch(error){
   if(error?.code==='OBJECTIVE_CUSTODY_ACK_UNKNOWN'){uncertainJobs.add(columns.generation_job_id);uncertainIssuances.add(columns.issuance_key);}
   throw error;
  }
 }
 function settled(answer,jobId,issuanceKey){
  if(answer.state==='COMMITTED'){uncertainJobs.delete(jobId);uncertainIssuances.delete(issuanceKey);return answer;}
  if(answer.state==='ABSENT'&&(uncertainJobs.has(jobId)||uncertainIssuances.has(issuanceKey)))return data({state:'UNKNOWN'});
  return answer;
 }
 async function read(value){
  if(!enabled)refuse();const v=own(value,['generationJobId'],['signal']);if(!uuid(v.generationJobId))refuse();
  return operation(v.signal,life=>transaction(life,false,async q=>{
   await globalGate(q,v.generationJobId);const found=await row(q,v.generationJobId);
   if(!found)return settled(data({state:'ABSENT'}),v.generationJobId,null);
   const answer=objectiveCustodyReadState(found,{tenantId});
   return settled(answer,v.generationJobId,answer.state==='COMMITTED'?answer.record.issued.issuance.issuanceKey:null);
  }));
 }
 async function putOnce(value){
  if(!enabled)refuse();const v=own(value,['generationJobId','record'],['signal']),columns=objectiveCustodyRecordColumns(v.record,{tenantId}),record=columns.record;
  if(!uuid(v.generationJobId)||v.generationJobId!==columns.generation_job_id)refuse();
  const unresolved=uncertainJobs.has(columns.generation_job_id)||uncertainIssuances.has(columns.issuance_key);
  return operation(v.signal,life=>remembering(columns,async()=>{
   const claim=await transaction(life,true,async q=>{
    const native=await sources(q,record.binding,columns.issuance_key);
    assertObjectivePostgresSources(record,{...native,tenantId,nowMs:await databaseNow(q),activeWrite:false});
    await globalGate(q,v.generationJobId);
    const occupied=maybe((await q('SELECT tenant_id FROM meri_objective_source.custody WHERE generation_job_id=$1',[v.generationJobId])).rows);
    if(occupied&&occupied.tenant_id!==tenantId)conflict();
    const prior=await row(q,v.generationJobId,true);
    if(prior){const decoded=decodeObjectiveCustodyRow(prior,{tenantId});if(!same(decoded.record,record))conflict();
     return {created:false,answer:objectiveCustodyReadState(prior,{tenantId})};}
    // An unresolved earlier acknowledgement in this instance is never permission
    // to claim again, even though the serialized read now observes no row.
    if(unresolved)throw unknown();
    assertObjectivePostgresSources(record,{...native,tenantId,nowMs:await databaseNow(q),activeWrite:true});
    const claimFence=allocateFence();if(!uuid(claimFence))refuse();
    const params=[columns.generation_job_id,columns.tenant_id,columns.conversation_id,columns.run_id,columns.issuance_key,columns.binding_sha256,columns.binding,
     columns.source_admission_sha256,columns.source_request_sha256,columns.facts_sha256,columns.record_sha256,columns.original_expires_at_ms,record,claimFence];
    const inserted=maybe((await q(insert,params)).rows);if(!inserted)conflict();const decoded=decodeObjectiveCustodyRow(inserted,{tenantId});
    if(decoded.state!=='CLAIMED'||decoded.version!==1||decoded.claimFence!==claimFence||!same(decoded.record,record))refuse();
    assertObjectivePostgresSources(record,{...native,tenantId,nowMs:await databaseNow(q),activeWrite:true});
    return {created:true,claimFence};
   });
   if(!claim.created)return settled(claim.answer,columns.generation_job_id,columns.issuance_key);
   // This second transaction is available only to THIS just-acknowledged claim
   // fence. Existing CLAIMED rows above return UNKNOWN and are never resumed.
   return transaction(life,true,async q=>{
    const native=await sources(q,record.binding,columns.issuance_key);
    assertObjectivePostgresSources(record,{...native,tenantId,nowMs:await databaseNow(q),activeWrite:true});
    await globalGate(q,v.generationJobId);const prior=decodeObjectiveCustodyRow(await row(q,v.generationJobId,true),{tenantId});
    if(prior.state!=='CLAIMED'||prior.version!==1||prior.claimFence!==claim.claimFence||!same(prior.record,record))conflict();
    assertObjectivePostgresSources(record,{...native,tenantId,nowMs:await databaseNow(q),activeWrite:true});
    const updated=one((await q(finalization,[v.generationJobId,tenantId,claim.claimFence,columns.record_sha256])).rows),decoded=decodeObjectiveCustodyRow(updated,{tenantId});
    if(decoded.state!=='COMMITTED'||decoded.version!==2||decoded.claimFence!==claim.claimFence||!same(decoded.record,record))refuse();
    assertObjectivePostgresSources(record,{...native,tenantId,nowMs:await databaseNow(q),activeWrite:true});
    return objectiveCustodyReadState(updated,{tenantId});
   }).then(answer=>settled(answer,columns.generation_job_id,columns.issuance_key));
  }));
 }
 async function readByIssuance(value){
  if(!enabled)refuse();const v=own(value,['issuanceKey','binding','factsSha256'],['signal']),binding=data(v.binding);validateShape('RunBinding',binding);
  if(binding.tenantId!==tenantId||!digest(v.issuanceKey)||hash(binding)!==v.issuanceKey||!digest(v.factsSha256))refuse();
  return operation(v.signal,life=>transaction(life,false,async q=>{
   const native=await sources(q,binding,v.issuanceKey);
   assertObjectivePostgresLookupSources({...native,binding,issuanceKey:v.issuanceKey,factsSha256:v.factsSha256,tenantId});
   // Every writer takes the same issuance lock before claiming any Objective
   // job. This unique reverse locator is settled even when no job exists yet.
   const locator=maybe((await q('SELECT generation_job_id FROM meri_objective_source.custody WHERE issuance_key=$1 AND tenant_id=$2',[v.issuanceKey,tenantId])).rows);
   if(!locator)return settled(data({state:'ABSENT'}),null,v.issuanceKey);if(!uuid(locator.generation_job_id))refuse();await globalGate(q,locator.generation_job_id);
   const found=await row(q,locator.generation_job_id);if(!found)refuse();const decoded=decodeObjectiveCustodyRow(found,{tenantId});
   if(decoded.issuanceKey!==v.issuanceKey||!same(decoded.record.binding,binding)||decoded.record.issued.factsSha256!==v.factsSha256)refuse();
   assertObjectivePostgresSources(decoded.record,{...native,tenantId,nowMs:await databaseNow(q),activeWrite:false});
   return settled(objectiveCustodyReadState(found,{tenantId}),decoded.generationJobId,v.issuanceKey);
  }));
 }
 return Object.freeze({available:()=>enabled,read,putOnce,readByIssuance});
}
