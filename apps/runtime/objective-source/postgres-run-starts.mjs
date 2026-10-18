/** Default-off, tenant-bound PostgreSQL store for meri_objective_source.run_starts (D7-4, migration 0002). Borrowed pool only.
 *
 * putOnce is one insert-or-read transaction under the conversation store's own advisory key (`${tenantId}:${conversationId}`)
 * and then the job key, so it serializes with every original-binding, initial-input and run write of that conversation. A new
 * start is refused once anything already exists for the derived conversation (run, initial input or original binding): a start
 * never adopts a run that was accepted without it. Identical replay returns the stored record; a different record for the same
 * job or run is a conflict. A lost COMMIT acknowledgement is ACK_UNKNOWN and is sticky in this instance: it never reports ABSENT
 * or claims again for that job until an exact durable row resolves it. No UPDATE, FOR UPDATE or DELETE is ever issued. */
import {types} from 'node:util';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {createObjectivePostgresTransactions,advisory,databaseNow} from './postgres-transaction.mjs';
import {assertObjectiveRunStartRecord,objectiveRunStartColumns,decodeObjectiveRunStartRow,OBJECTIVE_RUN_START_COLUMNS} from './run-starts.mjs';

const unavailable=()=>Object.assign(Error('OBJECTIVE_RUN_START_UNAVAILABLE'),{code:'OBJECTIVE_RUN_START_UNAVAILABLE'});
const unknown=()=>Object.assign(Error('OBJECTIVE_RUN_START_ACK_UNKNOWN'),{code:'OBJECTIVE_RUN_START_ACK_UNKNOWN'});
const conflictError=()=>Object.assign(Error('OBJECTIVE_RUN_START_CONFLICT'),{code:'OBJECTIVE_RUN_START_CONFLICT'});
const refuse=()=>{throw unavailable();};
const conflict=()=>{throw conflictError();};
const same=(a,b)=>hash(a)===hash(b);
const COLUMNS=OBJECTIVE_RUN_START_COLUMNS.map(c=>c==='effect_expires_at_ms'?'effect_expires_at_ms::text AS effect_expires_at_ms':c).join(',');
const INSERT='INSERT INTO meri_objective_source.run_starts(generation_job_id,tenant_id,conversation_id,run_id,issuance_key,binding,source_admission_sha256,source_request_sha256,typed_request_sha256,selection_sha256,record_sha256,effect_expires_at_ms,record) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT DO NOTHING RETURNING '+COLUMNS;
const BY_JOB='SELECT '+COLUMNS+' FROM meri_objective_source.run_starts WHERE generation_job_id=$1';
const BY_RUN='SELECT '+COLUMNS+' FROM meri_objective_source.run_starts WHERE tenant_id=$1 AND conversation_id=$2 AND run_id=$3';
// Anything already present for the derived conversation forecloses a new start (the conversation store's own tables, SELECT only).
const OCCUPIED=['runs','initial_inputs','initial_run_bindings'].map(table=>`SELECT 1 AS present FROM meri_conversations.${table} WHERE tenant_id=$1 AND conversation_id=$2 LIMIT 1`);
const maybe=rows=>{if(!Array.isArray(rows)||rows.length>1)refuse();return rows[0]??null;};

export function createPostgresObjectiveRunStartStore(configuration={}){
 let enabled=false,tenantId,tx;
 try{
  const flag=configuration&&typeof configuration==='object'&&!types.isProxy(configuration)?Object.getOwnPropertyDescriptor(configuration,'enabled'):null;
  if(flag&&'value'in flag&&flag.value===true){
   const c=own(configuration,['enabled','pool','tenantId'],['now','maxRequestMs']);tenantId=c.tenantId;
   if(typeof tenantId!=='string'||!tenantId||tenantId.trim()!==tenantId||tenantId.length>128)refuse();
   tx=createObjectivePostgresTransactions({connect:storageMethod(c.pool,'connect'),now:c.now??Date.now,maxRequestMs:c.maxRequestMs??3000,unavailable,unknown,semantic:['OBJECTIVE_RUN_START_CONFLICT']});
   enabled=true;
  }
 }catch{enabled=false;}
 const uncertainJobs=new Set(),uncertainRuns=new Set();
 const conversationKey=binding=>`${tenantId}:${binding.conversationId}`;
 const jobKey=job=>`meri_objective_source:run-start:${job}`;
 function bound(binding){validateShape('RunBinding',binding);if(binding.tenantId!==tenantId)refuse();return binding;}
 async function putOnce(value){
  if(!enabled)refuse();
  let v,record,columns,b;
  try{v=own(value,['record'],['signal']);record=assertObjectiveRunStartRecord(v.record);columns=objectiveRunStartColumns(record,{tenantId});b=bound(record.binding);}catch{refuse();}
  const unresolved=uncertainJobs.has(record.generationJobId)||uncertainRuns.has(columns.issuance_key);
  try{
   const answer=await tx.operation(v.signal,life=>tx.transaction(life,true,async q=>{
    await advisory(q,conversationKey(b));await advisory(q,jobKey(record.generationJobId));
    const prior=maybe((await q(BY_JOB,[record.generationJobId])).rows);
    if(prior){if(prior.tenant_id!==tenantId)conflict();const saved=decodeObjectiveRunStartRow(prior,{tenantId});if(!same(saved,record))conflict();return {created:false,record:saved};}
    if(maybe((await q(BY_RUN,[tenantId,b.conversationId,b.runId])).rows))conflict();
    // An earlier ambiguous acknowledgement in this instance is never permission to insert again.
    if(unresolved)throw unknown();
    for(const text of OCCUPIED)if(maybe((await q(text,[tenantId,b.conversationId])).rows))conflict();
    if(record.effectExpiresAtMs<=await databaseNow(q,refuse))refuse();
    const p=[columns.generation_job_id,columns.tenant_id,columns.conversation_id,columns.run_id,columns.issuance_key,columns.binding,columns.source_admission_sha256,
     columns.source_request_sha256,columns.typed_request_sha256,columns.selection_sha256,columns.record_sha256,columns.effect_expires_at_ms,columns.record];
    const inserted=maybe((await q(INSERT,p)).rows);if(!inserted)conflict();
    const saved=decodeObjectiveRunStartRow(inserted,{tenantId});if(!same(saved,record))refuse();
    return {created:true,record:saved};
   }));
   uncertainJobs.delete(record.generationJobId);uncertainRuns.delete(columns.issuance_key);
   return data({state:'STARTED',created:answer.created,record:answer.record});
  }catch(error){
   if(error?.code==='OBJECTIVE_RUN_START_ACK_UNKNOWN'){uncertainJobs.add(record.generationJobId);uncertainRuns.add(columns.issuance_key);}
   throw error;
  }
 }
 /** The run-start for one exact binding: ABSENT (ordinary chat), STARTED with the record, or UNKNOWN after an ambiguous write. */
 async function read(value){
  if(!enabled)refuse();let v,b;try{v=own(value,['binding'],['signal']);b=bound(data(v.binding));}catch{refuse();}const key=hash(b);
  return tx.operation(v.signal,life=>tx.transaction(life,false,async q=>{
   await advisory(q,conversationKey(b));
   const row=maybe((await q(BY_RUN,[tenantId,b.conversationId,b.runId])).rows);
   if(!row)return data(uncertainRuns.has(key)?{state:'UNKNOWN'}:{state:'ABSENT'});
   const saved=decodeObjectiveRunStartRow(row,{tenantId});if(!same(saved.binding,b))refuse();
   uncertainRuns.delete(key);uncertainJobs.delete(saved.generationJobId);return data({state:'STARTED',record:saved});
  }));
 }
 return Object.freeze({available:()=>enabled,putOnce,read});
}
