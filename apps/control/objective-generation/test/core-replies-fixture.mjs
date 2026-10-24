/** SYNTHETIC Core-shaped replies only (shapes from capiro-backend PR66 49f328eb).
 * No Core process, credential, signature, database or network is involved. */
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {requestInputHash} from '../../../../packages/contracts/strategy-operations-candidate/validate.mjs';
import {runStartFixture,NOW} from '../../../runtime/objective-source/test/run-start-fixture.mjs';
import {createObjectiveRunStartRecord} from '../../../runtime/objective-source/run-starts.mjs';
import {SDK_MODEL_CONFIGURATION} from '../../conversations/usage.mjs';
import {coreApplicationSha256} from '../../../../packages/runtime/core-application-digest.mjs';
export {NOW};
const clone=value=>structuredClone(value);
export function coreRepliesFixture(){
 const f=runStartFixture(),admission=clone(f.selection.sourceAdmission),sourceAdmissionSha256=f.record.sourceAdmissionSha256;
 const request=clone(f.selection.request);request.originalExpiresAtMs=admission.effectExpiresAtMs;request.inputSha256=requestInputHash(request);
 const executionContext=clone(f.selection.executionContext),source={generationJobId:f.generationJobId,binding:clone(f.binding)};
 const record=createObjectiveRunStartRecord({binding:f.binding,generationJobId:f.generationJobId,selection:{...clone(f.selection),request},nowMs:NOW});
 const admit={schemaVersion:1,sourceAdmission:admission,sourceAdmissionSha256};
 const publication={schemaVersion:1,sourceAdmissionSha256,request,requestSha256:hash(request),executionContext};
 const accept={schemaVersion:1,sourceAdmissionSha256,sourceBinding:clone(f.binding),sourceRequestSha256:record.sourceRequestSha256,effectExpiresAtMs:record.effectExpiresAtMs,acceptedAtMs:NOW};
 const admissionRead=(acceptedAtMs=NOW)=>({...clone(admit),acceptance:acceptedAtMs===null?{availability:'unavailable',value:null}:{availability:'available',value:{...clone(accept),acceptedAtMs}}});
 const c=admission.canonical,at=new Date(NOW).toISOString(),completionId=f.binding.runId;
 const objectiveReceipt={schemaVersion:1,requestId:admission.generationRequestId,source:{clientId:c.clientId,objectiveId:c.objectiveId,objectiveVersion:c.requestedObjectiveVersion,objectiveRevisionId:c.requestedObjectiveRevisionId},
  context:{reobservedAt:at,state:'complete',packetId:'synthetic-packet',compiledAt:at,sourceDigest:'b'.repeat(64),coverageDigest:'c'.repeat(64),inputDigest:'d'.repeat(64),issues:[]},
  result:{strategyId:c.canonicalStrategyId,strategyVersionId:'00000000-0000-4000-8000-000000000061',savedAt:at,sourceDigest:'b'.repeat(64),contextPacketId:'synthetic-packet',coverageDigest:'c'.repeat(64),inputDigest:'d'.repeat(64)},failure:null};
 const completion={schemaVersion:1,generationJobId:admission.generationJobId,sourceAdmissionSha256,sourceBinding:clone(f.binding),sourceRequestSha256:record.sourceRequestSha256,
  completion:{schemaVersion:1,namespace:'capiro.objective-strategy.completion:v1',generationJobId:admission.generationJobId,generationRequestId:admission.generationRequestId,
   sourceAdmissionSha256,sourceRequestSha256:record.sourceRequestSha256,sourceBindingSha256:hash(f.binding),typedRequestSha256:publication.requestSha256,executionContextSha256:hash(executionContext),
   completionId,checkpointId:'00000000-0000-4000-8000-000000000062',checkpointSha256:'1'.repeat(64),resultRef:completionId,resultSha256:'2'.repeat(64),rawFileSha256:'3'.repeat(64),
   executionSha256:'4'.repeat(64),completedAtMs:NOW+10,payloadSha256:'5'.repeat(64),corePayloadSha256:'6'.repeat(64)},
  objectiveReceipt,objectiveReceiptSha256:coreApplicationSha256(objectiveReceipt),snapshotDigest:'7'.repeat(64)};
 return {f,source,admission,sourceAdmissionSha256,request,executionContext,record,
  replies:{admit:()=>clone(admit),publication:()=>clone(publication),accept:()=>clone(accept),admissionRead,completion:()=>clone(completion)},
  executionSelection:{provider:SDK_MODEL_CONFIGURATION.usageBasis.provider,model:SDK_MODEL_CONFIGURATION.model}};
}
