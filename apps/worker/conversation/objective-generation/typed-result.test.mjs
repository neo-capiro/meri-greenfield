import test from 'node:test';
import assert from 'node:assert/strict';
import {request as candidateRequest,result as candidateResult,binding as candidateBinding,id} from '../../../../packages/contracts/strategy-operations-candidate/fixture-source.mjs';
import {requestInputHash,without} from '../../../../packages/contracts/strategy-operations-candidate/validate.mjs';
import {assertPreparedObjectiveSelection,assertTypedSelection,hash,rawTypedSha256,sourceAdmissionDigest} from '../../../../packages/runtime/objective-generation-custody.mjs';
import {loadTypedDraftCodec} from './typed-result.mjs';

function prepared(typeHint=null){
 const request=structuredClone(candidateRequest()),binding={...candidateBinding(),tenantId:id(36)};
 request.principal.tenantId=binding.tenantId;
 request.input.typeHint=typeHint;request.context.draft.input.typeHint=typeHint;
 request.context.contextSha256=hash(without(request.context,'contextSha256'));request.inputSha256=requestInputHash(request);
 const acceptedRequest={requestId:request.requestId,prompt:'Draft a synthetic strategy',skill:null,window:null,windowRequest:null};
 const admission={schemaVersion:1,namespace:'capiro.objective-strategy.admission:v1',canonical:{canonicalPlanId:id(30),tenantId:binding.tenantId,clientId:request.principal.clientId,objectiveId:request.source.objectiveId,canonicalStrategyId:id(31),canonicalProjectId:id(32),bindingVersion:1,epoch:1,requestedIntentId:id(33),requestedObjectiveRevisionId:request.source.objectiveRevisionId,requestedObjectiveVersion:request.source.objectiveVersion,snapshotHash:request.source.snapshotSha256},actorUserId:id(34),clerkUserId:binding.actorId,consentId:id(35),controlVersion:1,generationJobId:request.jobId,generationRequestId:request.requestId,admittedAtMs:request.requestedAtMs,effectExpiresAtMs:request.originalExpiresAtMs,expectedStrategyVersionId:null};
 const executionSelection={provider:'synthetic-provider',model:'synthetic-trusted-model'};
 const strategy={schemaVersion:1,operation:'strategy.draft',request,requestSha256:hash(request),executionContext:{schemaVersion:1,prompt:acceptedRequest.prompt,promptSha256:rawTypedSha256(Buffer.from(acceptedRequest.prompt)),ownerRefs:request.context.ownerRefs.map(ownerRef=>({ownerRef,clerkUserId:binding.actorId})),contextPacketId:request.context.packetId},queuedType:typeHint,executionSelection};
 const pair={objectiveGeneration:{sourceAdmission:admission,sourceAdmissionSha256:sourceAdmissionDigest(admission)},objectiveStrategy:strategy};
 return {request,binding,acceptedRequest,pair,executionSelection,expiresAtMs:request.originalExpiresAtMs-1};
}

test('initial Objective draft with no type picker retains and reads the model proposed Strategy type',async()=>{
 const f=prepared(),selected=assertPreparedObjectiveSelection(f.pair,{binding:f.binding,acceptedRequest:f.acceptedRequest,expiresAtMs:f.expiresAtMs}),codec=await loadTypedDraftCodec(),selection=codec.selection(selected);
 assert.equal(selection.strategy.queuedType,null);
 const proposal=candidateResult(f.request),sdkResult={type:'result',subtype:'success',is_error:false,structured_output:{operation:'strategy.draft',state:'succeeded',payload:proposal.payload,issues:[]}};
 const encoded=codec.encode({selection,executionSelection:f.executionSelection,sdkResult,sessionId:id(40),receiptRef:id(41),resultRef:id(42),completedAtMs:f.request.requestedAtMs+1000});
 assert.equal(encoded.result.payload.type,'authorization');
 assert.deepEqual(codec.decode(encoded.bytes,encoded.descriptor,selection),encoded.result);
 assert.deepEqual(assertTypedSelection(selection,encoded.descriptor,{binding:f.binding,acceptedRequest:f.acceptedRequest}),selection);
 const mismatched=structuredClone(f.pair);mismatched.objectiveStrategy.queuedType='authorization';
 assert.throws(()=>assertPreparedObjectiveSelection(mismatched,{binding:f.binding,acceptedRequest:f.acceptedRequest,expiresAtMs:f.expiresAtMs}),/OBJECTIVE_TYPED_RESULT_REFUSED/);
 const forged=structuredClone(sdkResult);forged.structured_output.payload.type='invented';
 assert.throws(()=>codec.encode({selection,executionSelection:f.executionSelection,sdkResult:forged,sessionId:id(40),receiptRef:id(41),resultRef:id(42),completedAtMs:f.request.requestedAtMs+1000}),/STRATEGY_CANDIDATE_REFUSED/);
});

test('an initial Objective draft type hint remains advisory, not an output type lock',async()=>{
 const f=prepared('appropriations'),selected=assertPreparedObjectiveSelection(f.pair,{binding:f.binding,acceptedRequest:f.acceptedRequest,expiresAtMs:f.expiresAtMs}),codec=await loadTypedDraftCodec(),selection=codec.selection(selected);
 const proposal=candidateResult(f.request),sdkResult={type:'result',subtype:'success',is_error:false,structured_output:{operation:'strategy.draft',state:'succeeded',payload:proposal.payload,issues:[]}};
 const encoded=codec.encode({selection,executionSelection:f.executionSelection,sdkResult,sessionId:id(40),receiptRef:id(41),resultRef:id(42),completedAtMs:f.request.requestedAtMs+1000});
 assert.equal(selection.strategy.queuedType,'appropriations');assert.equal(codec.decode(encoded.bytes,encoded.descriptor,selection).payload.type,'authorization');
});
