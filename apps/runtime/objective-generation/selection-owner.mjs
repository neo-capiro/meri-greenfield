/** Existing accepted Objective selection joined to the actual run and SDK settings.
 * Called only behind the canonical execution or Core owner; this read grants no admission. */
import {own,data,hash,assertPreparedObjectiveSelection,assertTypedSelection,typedFault} from '../../../packages/runtime/objective-generation-custody.mjs';
import {validateShape} from '../../../packages/contracts/validate.mjs';
import {assertNativeConversationScope} from '../../../packages/contracts/runtime-0.2/session.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {assertObjectiveRunStartRecord,objectiveAcceptedRequest} from '../objective-source/run-starts.mjs';
import {resolveSdkModelConfiguration} from '../../control/conversations/usage.mjs';
const same=(a,b)=>hash(a)===hash(b),refuse=()=>{throw typedFault();};
export function createObjectiveSelectionOwner(configuration){
 const c=own(configuration,['runStarts','store'],['now','maxRequestMs']),now=c.now??Date.now,maxRequestMs=c.maxRequestMs??3000;
 if(typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)refuse();
 const readStart=storageMethod(c.runStarts,'read'),readRun=storageMethod(c.store,'read'),readPolicy=storageMethod(c.store,'readModelPolicy'),readModel=storageMethod(c.store,'readModelSelection');
 async function read(value){const v=own(value,['binding'],['typedResult','signal']);validateShape('RunBinding',v.binding);
  const life=createOperationLifetime({now,signal:v.signal,deadlineMs:now()+maxRequestMs,errorFactory:typedFault});
  try{
   const first=data(await life.run(signal=>readStart({binding:v.binding,signal})));own(first,['state'],['record']);
   if(first.state==='ABSENT'){if(Object.hasOwn(first,'record')||v.typedResult!==undefined)refuse();return null;}
   if(first.state!=='STARTED')refuse();const record=assertObjectiveRunStartRecord(first.record);
   if(!same(record.binding,v.binding)||record.effectExpiresAtMs<=now())refuse();life.limitDeadline(record.effectExpiresAtMs);
   const saved=data(await life.run(()=>readRun(v.binding,{},life.check))),run=saved.run;validateShape('Run',run);
   const acceptedRequest=objectiveAcceptedRequest(record.selection),clientId=record.selection.sourceAdmission.canonical.clientId;
   if(!same(run.binding,v.binding)||!same(saved.request,acceptedRequest)||!['queued','starting','running','completed'].includes(run.state)||run.scopes.some(scope=>scope.policyRevision!==run.policyRevision))refuse();
   assertNativeConversationScope({binding:v.binding,scopes:run.scopes,selectedClientId:clientId});
   // Exactly the settings owner used by loadForExecution; no model grant or worker-provided provider/model.
   const policy=await life.run(()=>readPolicy(v.binding,life.check)),model=resolveSdkModelConfiguration(await life.run(()=>readModel(v.binding,life.check)),policy);
   const s=record.selection,wire={objectiveGeneration:{sourceAdmission:s.sourceAdmission,sourceAdmissionSha256:record.sourceAdmissionSha256},
    objectiveStrategy:{schemaVersion:1,operation:'strategy.draft',request:s.request,requestSha256:record.typedRequestSha256,executionContext:s.executionContext,queuedType:s.queuedType,
     executionSelection:{provider:model.usageBasis.provider,model:model.model}},expiresAtMs:record.effectExpiresAtMs};
   const selected=assertPreparedObjectiveSelection({objectiveGeneration:wire.objectiveGeneration,objectiveStrategy:wire.objectiveStrategy},{binding:v.binding,acceptedRequest,expiresAtMs:wire.expiresAtMs,nowMs:now()});
   const again=data(await life.run(signal=>readStart({binding:v.binding,signal}))),latest=data(await life.run(()=>readRun(v.binding,{},life.check)));
   if(!same(again,first)||!same(latest.run,run)||!same(latest.request,acceptedRequest))refuse();life.check();
   return v.typedResult===undefined?data(wire):assertTypedSelection(selected,v.typedResult,{binding:v.binding,acceptedRequest});
  }finally{life.close();}
 }
 return Object.freeze({read});
}
