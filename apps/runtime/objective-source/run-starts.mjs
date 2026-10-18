/** D7-4 run-start association (pure). Owner decision D015 #12: a run's selected Objective is persisted at run start, keyed
 * by the central generation job ID, and never read back from a Temporal query.
 *
 * One Objective generation job owns exactly one original Meri run in its own conversation. The full RunBinding is derived
 * from (tenantId, actorId, generationJobId) so the dispatcher, the run-start row, the original binding journal and the
 * workflow all name the same run without any browser-supplied identifier. The run-start record is the immutable Core
 * selection (source admission, typed request, execution context, queued type) captured BEFORE that run is accepted, so a
 * prepared run with a run-start row is always Objective and one without it is ordinary chat; there is no third state.
 *
 * These checks are data integrity only. They confer no authority: Core's current claim, the original binding journal, the
 * conversation store and the issuer remain the owners of admission, acceptance and issuance. */
import {createHash} from 'node:crypto';
import {types} from 'node:util';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {assertRequest} from '../../../packages/contracts/strategy-operations-candidate/validate.mjs';
import {strategyTypes} from '../../../packages/contracts/strategy-operations-candidate/shapes.mjs';
import {assertPreparedObjectiveSelection,sourceAdmissionDigest} from '../../../packages/runtime/objective-generation-custody.mjs';

export const OBJECTIVE_RUN_START_SCHEMA_VERSION=1;
const fault=()=>Object.assign(Error('OBJECTIVE_RUN_START_REFUSED'),{code:'OBJECTIVE_RUN_START_REFUSED'});
const refuse=()=>{throw fault();};
const same=(a,b)=>hash(a)===hash(b);
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/u.test(v);
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(v);
const text=v=>typeof v==='string'&&v.length>=1&&v.length<=128&&v.trim()===v;
const integer=(v,min=0)=>Number.isSafeInteger(v)&&v>=min;
const SELECTION_KEYS=Object.freeze(['sourceAdmission','request','executionContext','queuedType']);
const RECORD_KEYS=Object.freeze(['schemaVersion','generationJobId','binding','sourceAdmissionSha256','sourceRequestSha256','typedRequestSha256','selectionSha256','effectExpiresAtMs','selection']);
export const OBJECTIVE_RUN_START_COLUMNS=Object.freeze(['generation_job_id','tenant_id','conversation_id','run_id','issuance_key','binding','source_admission_sha256','source_request_sha256','typed_request_sha256','selection_sha256','record_sha256','effect_expires_at_ms','record','created_at']);
// assertPreparedObjectiveSelection requires its closed executionSelection member. The genuine provider/model selection is
// issued later with the run's model grant (protected-facts.mjs), never at run start, so this stand-in exists only for the
// call below and is never returned, stored or hashed into a record.
const VALIDATION_ONLY_EXECUTION=Object.freeze({provider:'meri-objective-run-start-validation',model:'meri-objective-run-start-validation'});

// RFC 9562 version 8 layout over a domain-separated SHA-256 (same construction as scheduled occurrences, distinct domain).
function derivedUuid(key,label){
 const h=createHash('sha256').update(`meri.objective.run.v1\0${key}\0${label}`).digest('hex');
 const variant=((Number.parseInt(h[16],16)&3)|8).toString(16);
 return `${h.slice(0,8)}-${h.slice(8,12)}-8${h.slice(13,16)}-${variant}${h.slice(17,20)}-${h.slice(20,32)}`;
}

/** The single run a generation job may start: conversation, run, attempt, worker and first event IDs, writer fence 1. */
export function objectiveRunIdentity(value){
 try{
  const v=own(value,['tenantId','actorId','generationJobId']);
  if(!text(v.tenantId)||!text(v.actorId)||!uuid(v.generationJobId))refuse();
  const runKey=hash({schemaVersion:1,kind:'meri.objective-generation.run',tenantId:v.tenantId,actorId:v.actorId,generationJobId:v.generationJobId});
  const id=label=>derivedUuid(runKey,label);
  const binding={tenantId:v.tenantId,actorId:v.actorId,conversationId:id('conversation'),runId:id('run'),attemptId:id('attempt'),workerId:id('worker'),writerFence:1};
  validateShape('RunBinding',binding);
  return data({runKey,binding,eventId:id('event')});
 }catch{refuse();}
}

/** The canonical five-field conversation request the Objective run is accepted with: Core's request ID and published prompt. */
export function objectiveAcceptedRequest(selection){
 try{
  const s=own(selection,SELECTION_KEYS);
  const requestId=s.sourceAdmission?.generationRequestId,prompt=s.executionContext?.prompt;
  if(!uuid(requestId)||typeof prompt!=='string'||!prompt.trim()||prompt.length>100000)refuse();
  return data({requestId,prompt,skill:null,window:null,windowRequest:null});
 }catch{refuse();}
}

/** Closed Core selection for one derived binding. `nowMs` is required for a new start (the selection must still be inside
 * Core's effect window) and omitted for historical integrity checks of an already stored record. */
export function assertObjectiveRunSelection(value,{binding,nowMs}={}){
 try{
  if(types.isProxy(value))refuse();
  const s=data(own(value,SELECTION_KEYS)),request=assertRequest(s.request);
  if(!strategyTypes.includes(s.queuedType)||nowMs!==undefined&&!integer(nowMs))refuse();
  const acceptedRequest=objectiveAcceptedRequest(s),admission=s.sourceAdmission;
  if(!integer(admission?.effectExpiresAtMs,1)||!integer(request.originalExpiresAtMs,1))refuse();
  const effectExpiresAtMs=Math.min(admission.effectExpiresAtMs,request.originalExpiresAtMs);
  const admitted=assertPreparedObjectiveSelection({objectiveGeneration:{sourceAdmission:admission,sourceAdmissionSha256:sourceAdmissionDigest(admission)},
   objectiveStrategy:{schemaVersion:1,operation:'strategy.draft',request,requestSha256:hash(request),executionContext:s.executionContext,queuedType:s.queuedType,executionSelection:VALIDATION_ONLY_EXECUTION}},
   {binding,acceptedRequest,expiresAtMs:effectExpiresAtMs,...(nowMs===undefined?{}:{nowMs})});
  if(admission.canonical.tenantId!==binding.tenantId)refuse();
  return data({selection:s,acceptedRequest,sourceAdmissionSha256:admitted.sourceAdmissionSha256,sourceRequestSha256:admitted.sourceRequestSha256,
   typedRequestSha256:hash(request),effectExpiresAtMs,clientId:admission.canonical.clientId});
 }catch{refuse();}
}

/** A new run-start record: the derived binding must be the caller's binding exactly, and Core's admission must name this job. */
export function createObjectiveRunStartRecord(value){
 try{
  const v=own(value,['binding','generationJobId','selection','nowMs']);validateShape('RunBinding',v.binding);
  const identity=objectiveRunIdentity({tenantId:v.binding.tenantId,actorId:v.binding.actorId,generationJobId:v.generationJobId});
  if(!same(identity.binding,v.binding)||!integer(v.nowMs))refuse();
  const checked=assertObjectiveRunSelection(v.selection,{binding:identity.binding,nowMs:v.nowMs});
  if(checked.selection.sourceAdmission.generationJobId!==v.generationJobId||checked.selection.request.jobId!==v.generationJobId)refuse();
  return data({schemaVersion:OBJECTIVE_RUN_START_SCHEMA_VERSION,generationJobId:v.generationJobId,binding:identity.binding,
   sourceAdmissionSha256:checked.sourceAdmissionSha256,sourceRequestSha256:checked.sourceRequestSha256,typedRequestSha256:checked.typedRequestSha256,
   selectionSha256:hash(checked.selection),effectExpiresAtMs:checked.effectExpiresAtMs,selection:checked.selection});
 }catch{refuse();}
}

/** Historical integrity check of a stored record (no clock): every digest and the derived identity are recomputed. */
export function assertObjectiveRunStartRecord(value){
 try{
  const r=data(own(value,RECORD_KEYS));validateShape('RunBinding',r.binding);
  const identity=objectiveRunIdentity({tenantId:r.binding.tenantId,actorId:r.binding.actorId,generationJobId:r.generationJobId});
  if(r.schemaVersion!==OBJECTIVE_RUN_START_SCHEMA_VERSION||!same(identity.binding,r.binding))refuse();
  const checked=assertObjectiveRunSelection(r.selection,{binding:r.binding});
  if(r.sourceAdmissionSha256!==checked.sourceAdmissionSha256||r.sourceRequestSha256!==checked.sourceRequestSha256||r.typedRequestSha256!==checked.typedRequestSha256||
     r.selectionSha256!==hash(checked.selection)||r.effectExpiresAtMs!==checked.effectExpiresAtMs||
     checked.selection.sourceAdmission.generationJobId!==r.generationJobId||checked.selection.request.jobId!==r.generationJobId)refuse();
  return r;
 }catch{refuse();}
}

/** Column projection for meri_objective_source.run_starts (0002). `issuance_key` is the canonical binding digest, the same
 * key run_issuances and custody use, so the prepared-run splice can find the selection from an issuance alone. */
export function objectiveRunStartColumns(value,{tenantId}){
 const r=assertObjectiveRunStartRecord(value);if(r.binding.tenantId!==tenantId)refuse();
 return Object.freeze({generation_job_id:r.generationJobId,tenant_id:r.binding.tenantId,conversation_id:r.binding.conversationId,run_id:r.binding.runId,
  issuance_key:hash(r.binding),binding:r.binding,source_admission_sha256:r.sourceAdmissionSha256,source_request_sha256:r.sourceRequestSha256,
  typed_request_sha256:r.typedRequestSha256,selection_sha256:r.selectionSha256,record_sha256:hash(r),effect_expires_at_ms:r.effectExpiresAtMs,record:r});
}

function exactInteger(value){
 if(typeof value==='string'){if(!/^(?:0|[1-9][0-9]*)$/u.test(value)||value.length>16)refuse();value=Number(value);}
 if(!Number.isSafeInteger(value)||value<1)refuse();return value;
}
function instant(value){
 if(types.isProxy(value))refuse();
 if(value instanceof Date){const at=Date.prototype.getTime.call(value);if(!Number.isSafeInteger(at))refuse();return;}
 if(typeof value!=='string'||!Number.isSafeInteger(Date.parse(value)))refuse();
}
/** Decode one fixed-projection row; every duplicated column must equal the canonical record. */
export function decodeObjectiveRunStartRow(row,{tenantId}){
 try{
  const v=own(row,OBJECTIVE_RUN_START_COLUMNS);instant(v.created_at);
  const expected=objectiveRunStartColumns(v.record,{tenantId});
  for(const key of OBJECTIVE_RUN_START_COLUMNS.filter(k=>!['record','created_at','effect_expires_at_ms','binding'].includes(k)))if(v[key]!==expected[key])refuse();
  if(exactInteger(v.effect_expires_at_ms)!==expected.effect_expires_at_ms||!same(v.binding,expected.binding)||!digest(v.record_sha256))refuse();
  return expected.record;
 }catch{refuse();}
}
