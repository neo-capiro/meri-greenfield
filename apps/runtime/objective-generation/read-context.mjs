/** Reuse native source normalization for a saved Objective job; no interactive identity or credential is synthesized. */
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {assertSubject,resolveOperationContract} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {MODE_READ_OPERATIONS} from '../../../packages/contracts/native-read-observation-0.2/validate.mjs';
import {assertSourceReadRequest,sourceReadClientReference,createSourceReadContext,assertNativeResultClientIds} from '../read-context/source-read-context.mjs';
import {retainedCall} from '../../gateway/sources/retained-reads/call-context.mjs';
import {deny,safeFailure} from '../../gateway/dispatch/operation-result.mjs';

export function createObjectiveReadContext({record,current,readSource,policyRevision,approvedReads,defaultCongress,now=Date.now}){
 const clientId=record.selection.sourceAdmission.canonical.clientId;
 return createSavedReadContext({binding:record.binding,clientId,clientIds:[clientId],expiresAtMs:record.effectExpiresAtMs,current,readSource,policyRevision,approvedReads,defaultCongress,now});
}
export function createRoutineReadContext({record,current,readSource,policyRevision,approvedReads,defaultCongress,now=Date.now}){
 return createSavedReadContext({binding:record.binding,clientId:record.selectedClientId,clientIds:record.selectedClientId===null?current.clientIds:[record.selectedClientId],expiresAtMs:record.expiresAtMs,current,readSource,policyRevision,approvedReads,defaultCongress,now});
}
function createSavedReadContext({binding,clientId,clientIds,expiresAtMs:effectExpiresAtMs,current,readSource,policyRevision,approvedReads,defaultCongress,now}){
 const pins=new WeakMap(),native={actorRole:current.role,clientIds};
 const same=(a,b)=>hash(a)===hash(b);
 function proof(raw){
  const {signal,...fields}=own(raw,['binding','subject','operation','request','requestSha256','policyRevision','sourceIds','deadlineMs'],['signal']),v=data(fields);
  assertSubject(v.subject,binding);
  const contract=resolveOperationContract(v.operation);
  if(!same(v.binding,binding)||v.policyRevision!==policyRevision||v.subject.policyRevision!==policyRevision||v.subject.kind!==(clientId===null?'personal':'client')||v.subject.entityType!==(clientId===null?'user':'client')||!same(v.subject.entityIds,[clientId??binding.actorId])||
   v.requestSha256!==hash(v.request)||!approvedReads.operations.some(op=>same(op,v.operation))||!Number.isSafeInteger(v.deadlineMs)||!signal||signal.aborted||
   !same([...v.sourceIds].sort(),[...new Set(contract.descriptor.sourceRequirements.map(s=>s.sourceId))].sort()))deny('ACCESS_DENIED');
  assertSourceReadRequest(contract,v.request,v.subject);return {v,signal,contract};
 }
 async function readCurrent(raw){try{
  const {v,signal,contract}=proof(raw),{request,deadlineMs,...echo}=v,at=now(),expiresAtMs=Math.min(deadlineMs,effectExpiresAtMs);
  if(expiresAtMs<=at)deny('DEADLINE');
  const prior=pins.get(signal);if(prior&&!same(prior.echo,echo))deny('ACCESS_DENIED');
  let context=prior?.context;
  if(!context){
   const base={binding,subject:v.subject,policyRevision,normalizationContext:null},reference=sourceReadClientReference(contract,v.request);
   let clientReferenceObservation,modeObservation;
   if(reference!==null){
    const r=await readSource({operation:'job.resolveClientReference',input:{ref:reference},context:base,deadlineMs,signal});
    own(r,['ok','clientId']);if(r.ok!==true||!clientIds.includes(r.clientId))deny('ACCESS_DENIED');clientReferenceObservation={reference,clientId:r.clientId};
   }
   if(MODE_READ_OPERATIONS.includes(v.operation.id)){
    const r=await readSource({operation:'job.readMode',input:{operation:v.operation,requestSha256:v.requestSha256},context:base,deadlineMs,signal});
    own(r,['evidenceAccuracyMode']);if(!['off','shadow','enforce'].includes(r.evidenceAccuracyMode))deny('INVALID_RESULT');modeObservation=r;
   }
   context=createSourceReadContext({contract,proof:v,native,defaultCongress,now,clientReferenceObservation,modeObservation});
   contract.normalizeInput(v.request,context);pins.set(signal,{echo,context});
  }
  signal.throwIfAborted();if(now()>=expiresAtMs)deny('DEADLINE');
  return JSON.stringify({...echo,context,checkedAtMs:now(),expiresAtMs});
 }catch(error){throw safeFailure(error);}}
 function authorizeResultForCall(operation,call){
  const c=retainedCall(operation,call,now);
  if(c.contract.binding.group!=='client-registry'||!same(c.authority.binding,binding))deny('ACCESS_DENIED');
  return async raw=>{const result=data(own(raw,['clientIds']));assertNativeResultClientIds(result.clientIds);if(result.clientIds.some(id=>!clientIds.includes(id)))deny('ACCESS_DENIED');call.signal?.throwIfAborted();};
 }
 return Object.freeze({nativeReadContextPorts:Object.freeze({readCurrent}),authorizeResultForCall});
}
