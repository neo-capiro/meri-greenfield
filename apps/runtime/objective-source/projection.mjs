/** Closed nonsecret custody/projections. Data checks confer no current authority.
 * Historical validation keeps original execution expiry exactly as issued. */
import {createHash} from 'node:crypto';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {objectiveReaderSchema} from '../../../packages/contracts/objective-reader-2/schema.mjs';
import {assertObjectiveReaderShape} from '../../../packages/contracts/objective-reader-2/validate.mjs';
import {assertIssuedObjectiveProtectedFacts} from './protected-facts.mjs';

export const objectiveSourceUnavailable=()=>Object.assign(Error('OBJECTIVE_SOURCE_UNAVAILABLE'),{code:'OBJECTIVE_SOURCE_UNAVAILABLE'});
const refuse=()=>{throw objectiveSourceUnavailable();};
const same=(a,b)=>hash(a)===hash(b);
const integer=value=>Number.isSafeInteger(value)&&value>=0;
const identityKeys=['scopes','createdAt','policyRevision','versions'];
const queuedTypes=new Set(objectiveReaderSchema.$defs.Observation.properties.queuedType.enum);
export const objectiveActiveStates=Object.freeze(['queued','starting','running']);
export const objectiveHistoricalStates=Object.freeze(['completed','failed','cancelled']);
const runIdentity=run=>data(Object.fromEntries(identityKeys.map(key=>[key,run[key]])));

/** Normalize only canonical owner output; no caller binding is accepted. */
export function assertObjectiveAcceptedRun(value){
 try{
  const accepted=data(own(value,['run','request']));validateShape('Run',accepted.run);
  const r=own(accepted.request,['requestId','prompt','skill','window','windowRequest']);
  if(typeof r.prompt!=='string'||!r.prompt.trim()||r.prompt.length>100000||
     accepted.run.scopes.some(scope=>scope.tenantId!==accepted.run.binding.tenantId||scope.policyRevision!==accepted.run.policyRevision))refuse();
  return accepted;
 }catch{refuse();}
}

/** Immutable record: mutable run state and observed time are intentionally absent.
 * Store this only after canonical accepted-run and real ISSUED equality reads. */
export function createObjectiveCustodyRecord(value){
 try{
  const v=own(value,['accepted','issued']),accepted=assertObjectiveAcceptedRun(v.accepted),issued=assertIssuedObjectiveProtectedFacts(v.issued,{accepted});
  if(!queuedTypes.has(issued.objectiveStrategy.queuedType))refuse();
  const admission=issued.objectiveGeneration.sourceAdmission;
  return data({schemaVersion:2,generationJobId:admission.generationJobId,sourceAdmissionSha256:issued.objectiveGeneration.sourceAdmissionSha256,
   binding:accepted.run.binding,acceptedRequest:accepted.request,runIdentity:runIdentity(accepted.run),issued});
 }catch{refuse();}
}

export function assertObjectiveCustodyRecord(value){
 try{
  const v=data(own(value,['schemaVersion','generationJobId','sourceAdmissionSha256','binding','acceptedRequest','runIdentity','issued']));
  if(v.schemaVersion!==2)refuse();own(v.runIdentity,identityKeys);
  const rebuilt=createObjectiveCustodyRecord({accepted:{run:{binding:v.binding,state:'queued',...v.runIdentity},request:v.acceptedRequest},issued:v.issued});
  if(!same(v,rebuilt)||Buffer.byteLength(JSON.stringify(v))>4194304)refuse();return rebuilt;
 }catch{refuse();}
}

/** Compare canonical current row to immutable custody without treating a normal
 * queued to running transition as a new source or silently changing its identity. */
export function assertObjectiveCustodyAccepted(record,value){
 const r=assertObjectiveCustodyRecord(record),accepted=assertObjectiveAcceptedRun(value);
 if(!same(accepted.run.binding,r.binding)||!same(accepted.request,r.acceptedRequest)||!same(runIdentity(accepted.run),r.runIdentity))refuse();
 return accepted;
}

/** This projection contains neither raw configuration nor material references.
 * A caller must have completed fresh native and mode-specific source checks. */
export function projectObjectiveSourceObservation(value){
 try{
  const v=own(value,['record','accepted','purpose','checkedAtMs','expiresAtMs']),record=assertObjectiveCustodyRecord(v.record),accepted=assertObjectiveCustodyAccepted(record,v.accepted);
  const active=v.purpose==='active-source';
  if(!active&&v.purpose!=='historical-source'||!(active?objectiveActiveStates:objectiveHistoricalStates).includes(accepted.run.state)||
     !integer(v.checkedAtMs)||!integer(v.expiresAtMs)||v.expiresAtMs<=v.checkedAtMs||active&&v.expiresAtMs>record.issued.issuance.expiresAtMs)refuse();
  const issued=record.issued,strategy=issued.objectiveStrategy;
  return assertObjectiveReaderShape('Observation',{schemaVersion:2,purpose:v.purpose,generationJobId:record.generationJobId,sourceAdmission:issued.objectiveGeneration.sourceAdmission,
   sourceAdmissionSha256:record.sourceAdmissionSha256,binding:record.binding,sourceRequestSha256:hash(record.acceptedRequest),issuance:issued.issuance,
   typedRequestSha256:strategy.requestSha256,executionContextSha256:hash(strategy.executionContext),acceptedRequestId:record.acceptedRequest.requestId,
   acceptedPromptSha256:createHash('sha256').update(Buffer.from(record.acceptedRequest.prompt,'utf8')).digest('hex'),queuedType:strategy.queuedType,
   runState:accepted.run.state,checkedAtMs:v.checkedAtMs,expiresAtMs:v.expiresAtMs});
 }catch{refuse();}
}
