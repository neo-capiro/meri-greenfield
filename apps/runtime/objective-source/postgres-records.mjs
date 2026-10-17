/** Pure decoding of fixed PostgreSQL column projections. No database, query,
 * issuance or current-native authority is supplied by these integrity checks.
 * Callers own the source-row locks and fresh native checks before/after use. */
import {types} from 'node:util';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {assertObjectiveCustodyRecord,assertObjectiveCustodyAccepted,assertObjectiveAcceptedRun,objectiveActiveStates,objectiveSourceUnavailable} from './projection.mjs';
const refuse=()=>{throw objectiveSourceUnavailable();};
const same=(a,b)=>hash(a)===hash(b);
const digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/u.test(value);
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(value);
const runColumns=['tenant_id','conversation_id','run_id','projection','projection_sha256','request_id','request','request_sha256'];
const issuanceColumns=['issuance_key','tenant_id','conversation_id','run_id','binding','binding_sha256','request_sha256','expires_at_ms','state','grant_id','capability_sha256','facts_sha256'];
const custodyColumns=['generation_job_id','tenant_id','conversation_id','run_id','issuance_key','binding_sha256','binding','source_admission_sha256','source_request_sha256','facts_sha256','record_sha256','original_expires_at_ms','record','state','claim_fence','version','claimed_at','committed_at'];

// Preserve the canonical RunBinding/Scope tenant bound; storage does not widen it.
function tenant(value){if(typeof value!=='string'||!value||value.length>128||value.trim()!==value)refuse();return value;}
/** PostgreSQL bigint normally arrives as decimal text. Never round, coerce an
 * empty/alternate-base value or silently accept a fractional/unsafe integer. */
function exactInteger(value,minimum=0){
 if(typeof value==='string'){if(!/^(?:0|[1-9][0-9]*)$/u.test(value)||value.length>16)refuse();value=Number(value);}
 if(!Number.isSafeInteger(value)||value<minimum)refuse();return value;
}
function timestamp(value){
 let instant;
 if(types.isProxy(value))refuse();
 if(value instanceof Date){if(Object.getPrototypeOf(value)!==Date.prototype||Reflect.ownKeys(value).length)refuse();instant=Date.prototype.getTime.call(value);}
 else if(typeof value==='string'){instant=Date.parse(value);if(!Number.isSafeInteger(instant)||new Date(instant).toISOString()!==value)refuse();}
 else refuse();
 return exactInteger(instant);
}
function boundRow(row,binding,tenantId){
 if(row.tenant_id!==tenantId||row.tenant_id!==binding.tenantId||row.conversation_id!==binding.conversationId||row.run_id!==binding.runId)refuse();
}

function canonicalSources(runValue,issuanceValue,bindingValue,tenantId){
 const binding=data(bindingValue),run=data(own(runValue,runColumns)),row=data(own(issuanceValue,issuanceColumns));
 validateShape('RunBinding',binding);boundRow(run,binding,tenantId);boundRow(row,binding,tenantId);
 if(!digest(run.projection_sha256)||hash(run.projection)!==run.projection_sha256||!digest(run.request_sha256)||hash(run.request)!==run.request_sha256||
    !uuid(run.request_id)||run.request_id!==run.request.requestId)refuse();
 const accepted=assertObjectiveAcceptedRun({run:run.projection,request:run.request});
 const issuance=data({issuanceKey:row.issuance_key,binding:row.binding,requestSha256:row.request_sha256,
  expiresAtMs:exactInteger(row.expires_at_ms,1),grantId:row.grant_id,capabilitySha256:row.capability_sha256,factsSha256:row.facts_sha256});
 validateShape('RunBinding',issuance.binding);
 if(row.state!=='ISSUED'||!same(accepted.run.binding,binding)||!same(issuance.binding,binding)||!digest(row.binding_sha256)||
    row.binding_sha256!==hash(binding)||row.binding_sha256!==issuance.issuanceKey||!digest(issuance.issuanceKey)||
    issuance.requestSha256!==run.request_sha256||!uuid(issuance.grantId)||!digest(issuance.capabilitySha256)||!digest(issuance.factsSha256))refuse();
 return data({accepted,issuance});
}

/** The one immutable row-field projection shared by writes and row decoding.
 * Lifecycle state, claim fence, versions and timestamps belong to the adapter. */
export function objectiveCustodyRecordColumns(value,options){
 try{
  const tenantId=tenant(own(options,['tenantId']).tenantId),record=assertObjectiveCustodyRecord(value),binding=record.binding,receipt=record.issued.issuance;
  if(binding.tenantId!==tenantId)refuse();
  return data({generation_job_id:record.generationJobId,tenant_id:tenantId,conversation_id:binding.conversationId,run_id:binding.runId,
   issuance_key:receipt.issuanceKey,binding_sha256:hash(binding),binding,source_admission_sha256:record.sourceAdmissionSha256,
   source_request_sha256:hash(record.acceptedRequest),facts_sha256:record.issued.factsSha256,record_sha256:hash(record),
   original_expires_at_ms:receipt.expiresAtMs,record});
 }catch{refuse();}
}

/** Compare an already-validated custody record with real, separately locked
 * canonical persistence rows. This result grants no native read/write access.
 * The required projections intentionally exclude material_ref and credentials. */
export function assertObjectivePostgresSources(value,options){
 try{
  const c=own(options,['runRow','issuanceRow','tenantId','nowMs','activeWrite']),tenantId=tenant(c.tenantId),nowMs=exactInteger(c.nowMs),record=assertObjectiveCustodyRecord(value);
  if(typeof c.activeWrite!=='boolean'||record.binding.tenantId!==tenantId)refuse();
  const {accepted,issuance}=canonicalSources(c.runRow,c.issuanceRow,record.binding,tenantId);assertObjectiveCustodyAccepted(record,accepted);
  if(!same(issuance,record.issued.issuance))refuse();
  if(c.activeWrite&&(!objectiveActiveStates.includes(accepted.run.state)||issuance.expiresAtMs<=nowMs))refuse();
  return record;
 }catch{refuse();}
}

/** Reverse-lookup absence is meaningful only after genuine canonical run and
 * ISSUED selector equality. This returns metadata, never an Objective pair,
 * renewed execution expiry or native authority. No custody record is required. */
export function assertObjectivePostgresLookupSources(options){
 try{
  const c=own(options,['runRow','issuanceRow','binding','issuanceKey','factsSha256','tenantId']),tenantId=tenant(c.tenantId);
  if(!digest(c.issuanceKey)||!digest(c.factsSha256))refuse();
  const result=canonicalSources(c.runRow,c.issuanceRow,c.binding,tenantId);
  if(result.issuance.issuanceKey!==c.issuanceKey||result.issuance.factsSha256!==c.factsSha256)refuse();return result;
 }catch{refuse();}
}

/** PRIVATE lifecycle/record decoder for the future adapter's fenced CAS. A
 * decoded CLAIMED record is only an intent comparator, never a store response.
 * Use objectiveCustodyReadState for read responses to suppress that private data. */
export function decodeObjectiveCustodyRow(value,options){
 try{
  const tenantId=tenant(own(options,['tenantId']).tenantId),row=own(value,custodyColumns),expected=objectiveCustodyRecordColumns(row.record,{tenantId}),record=expected.record,binding=record.binding;
  const actualBinding=data(row.binding);boundRow(row,binding,tenantId);validateShape('RunBinding',actualBinding);
  const expiresAtMs=exactInteger(row.original_expires_at_ms,1),version=exactInteger(row.version,1),claimedAtMs=timestamp(row.claimed_at);
  const committedAtMs=row.committed_at===null?null:timestamp(row.committed_at);
  if(!uuid(row.claim_fence)||!same(actualBinding,binding)||expiresAtMs!==expected.original_expires_at_ms)refuse();
  for(const field of ['generation_job_id','tenant_id','conversation_id','run_id','issuance_key','binding_sha256','source_admission_sha256','source_request_sha256','facts_sha256','record_sha256'])if(row[field]!==expected[field])refuse();
  if(row.state==='CLAIMED'){if(version!==1||committedAtMs!==null)refuse();}
  else if(row.state==='COMMITTED'){if(version!==2||committedAtMs===null||committedAtMs<claimedAtMs)refuse();}
  else refuse();
  return data({state:row.state,generationJobId:record.generationJobId,tenantId,issuanceKey:row.issuance_key,claimFence:row.claim_fence,version,
   claimedAtMs,committedAtMs,recordSha256:row.record_sha256,record});
 }catch{refuse();}
}

/** Public store-port answer, not a public HTTP DTO. An unresolved durable claim
 * exposes neither its original prompt/pair nor fence or other private metadata. */
export function objectiveCustodyReadState(row,options){
 const decoded=decodeObjectiveCustodyRow(row,options);
 return decoded.state==='CLAIMED'?data({state:'UNKNOWN'}):data({state:'COMMITTED',record:decoded.record});
}
