/** Canonical v2 boundary validation. These inert checks confer no authority. */
import {readFileSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import formats from 'ajv-formats';
import {own,data} from '../commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../validate.mjs';
import {coreApplicationSha256} from '../../runtime/core-application-digest.mjs';
import {readerLimits} from './schema.mjs';
const schema=JSON.parse(readFileSync(new URL('./reader.schema.json',import.meta.url)));
const ajv=new Ajv({strict:true,allErrors:false});formats(ajv);ajv.addSchema(schema);
const checks=new Map();
const refuse=()=>{throw Object.assign(Error('OBJECTIVE_READER_V2_UNAVAILABLE'),{code:'OBJECTIVE_READER_V2_UNAVAILABLE'});};
export function assertObjectiveReaderShape(name,value){
 try{
  if(!Object.hasOwn(schema.$defs,name))refuse();const copy=data(value);
  let check=checks.get(name);if(!check){check=ajv.compile({$ref:schema.$id+'#/$defs/'+name});checks.set(name,check);}
  if(!check(copy)||Buffer.byteLength(JSON.stringify(copy))>readerLimits.maxResponseBytes)refuse();return copy;
 }catch{refuse();}
}
export function objectiveReaderRequestBody(value){
 const v=assertObjectiveReaderShape('Request',value);
 return Buffer.from(JSON.stringify({schemaVersion:2,purpose:v.purpose,generationJobId:v.generationJobId,sourceAdmissionSha256:v.sourceAdmissionSha256}),'utf8');
}
export function assertObjectiveSourceObservation(value,expected){
 try{
  const v=assertObjectiveReaderShape('Observation',value),e=own(expected,['purpose','selector','readStartedAtMs','nowMs'],['maxExpiresAtMs']);
  const selected=assertObjectiveReaderShape('Selector',e.selector),a=v.sourceAdmission,i=v.issuance;
  if(![e.readStartedAtMs,e.nowMs].every(n=>Number.isSafeInteger(n)&&n>=0)||e.nowMs<e.readStartedAtMs||
   v.purpose!==e.purpose||v.generationJobId!==selected.generationJobId||v.sourceAdmissionSha256!==selected.sourceAdmissionSha256||
   a.generationJobId!==v.generationJobId||coreApplicationSha256(a)!==v.sourceAdmissionSha256||
   a.clerkUserId!==v.binding.actorId||a.canonical.tenantId!==v.binding.tenantId||a.generationRequestId!==v.acceptedRequestId||
   a.effectExpiresAtMs<=a.admittedAtMs||i.expiresAtMs<=a.admittedAtMs||i.expiresAtMs>a.effectExpiresAtMs||
   hash(i.binding)!==hash(v.binding)||i.issuanceKey!==hash(v.binding)||i.requestSha256!==v.sourceRequestSha256||
   v.checkedAtMs<e.readStartedAtMs||v.checkedAtMs>e.nowMs||v.expiresAtMs<=e.nowMs||v.expiresAtMs>e.readStartedAtMs+readerLimits.maxRequestMs||
   e.maxExpiresAtMs!==undefined&&(!Number.isSafeInteger(e.maxExpiresAtMs)||v.expiresAtMs>e.maxExpiresAtMs))refuse();
  if(v.purpose==='active-source'){
   if(!['queued','starting','running'].includes(v.runState)||v.expiresAtMs>i.expiresAtMs)refuse();
  }else if(!['completed','failed','cancelled'].includes(v.runState))refuse();
  return v;
 }catch{refuse();}
}
