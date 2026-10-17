import test from 'node:test';
import assert from 'node:assert/strict';
import {compileObjectiveProtectedFacts} from '../../../runtime/objective-source/protected-facts.mjs';
import {coreApplicationSha256} from '../../../../packages/runtime/core-application-digest.mjs';
import {decodeAdmissionReply,decodeAdmissionReadReply,decodePublicationReply,decodeAcceptanceReply,decodeCompletionReply,objectiveSourceSelection} from '../core-replies.mjs';
import {coreRepliesFixture,NOW} from './core-replies-fixture.mjs';
const refused=/OBJECTIVE_GENERATION_CORE_REPLY_REFUSED/;
const mutate=(value,change)=>{const copy=structuredClone(value);change(copy);return copy;};

test('admission reply decodes to the exact closed Core admission and its sorted-key digest',()=>{
 const x=coreRepliesFixture(),decoded=decodeAdmissionReply(x.replies.admit(),x.source);
 assert.deepEqual(decoded,{sourceAdmission:x.admission,sourceAdmissionSha256:x.sourceAdmissionSha256});
 assert.equal(decoded.sourceAdmissionSha256,coreApplicationSha256(x.admission));assert.equal(Object.isFrozen(decoded.sourceAdmission.canonical),true);
});

test('admission reply refuses extra/missing fields, digest drift, foreign job/actor/tenant and regeneration',()=>{
 const x=coreRepliesFixture(),base=x.replies.admit();
 for(const change of [
  r=>{r.extra=1;},r=>{delete r.sourceAdmissionSha256;},r=>{r.schemaVersion=2;},r=>{r.sourceAdmissionSha256='0'.repeat(64);},
  r=>{r.sourceAdmission.namespace='capiro.other:v1';},r=>{r.sourceAdmission.extra=true;},r=>{r.sourceAdmission.canonical.epoch=2;},
  r=>{r.sourceAdmission.generationJobId='00000000-0000-4000-8000-000000000099';},r=>{r.sourceAdmission.clerkUserId='someone-else';},
  r=>{r.sourceAdmission.canonical.tenantId='00000000-0000-4000-8000-000000000098';},
  r=>{r.sourceAdmission.expectedStrategyVersionId='00000000-0000-4000-8000-000000000097';},
  r=>{r.sourceAdmission.effectExpiresAtMs=r.sourceAdmission.admittedAtMs;},r=>{r.sourceAdmission.controlVersion=0;},
  r=>{r.sourceAdmission.canonical.snapshotHash='A'.repeat(64);},r=>{r.sourceAdmission.consentId='not-a-uuid';},
 ]){
  const raw=mutate(base,change);
  // Recompute the digest where it is not the mutation so the semantic check is what refuses.
  if(raw.sourceAdmissionSha256===x.sourceAdmissionSha256&&raw.sourceAdmission&&!('extra' in raw))try{raw.sourceAdmissionSha256=coreApplicationSha256(raw.sourceAdmission);}catch{}
  assert.throws(()=>decodeAdmissionReply(raw,x.source),refused);
 }
 assert.throws(()=>decodeAdmissionReply(Object.create({schemaVersion:1}),x.source),refused);
 assert.throws(()=>decodeAdmissionReply(base,{...x.source,binding:{...x.source.binding,actorId:'other'}}),refused);
});

test('admission read decodes available acceptance with acceptedAtMs and an explicit unavailable state',()=>{
 const x=coreRepliesFixture(),available=decodeAdmissionReadReply(x.replies.admissionRead(),x.source,{issuance:x.issuance});
 assert.equal(available.acceptance.acceptedAtMs,NOW);assert.deepEqual(available.acceptance.issuance,x.issuance);
 assert.equal(decodeAdmissionReadReply(x.replies.admissionRead(null),x.source).acceptance,null);
 for(const change of [
  r=>{r.acceptance={availability:'unavailable',value:r.acceptance.value};},r=>{r.acceptance={availability:'available',value:null};},
  r=>{r.acceptance.availability='pending';},r=>{delete r.acceptance.value.acceptedAtMs;},
  r=>{r.acceptance.value.acceptedAtMs=r.sourceAdmission.admittedAtMs-1;},r=>{r.acceptance.value.acceptedAtMs=r.acceptance.value.issuance.expiresAtMs;},
  r=>{r.acceptance.value.sourceBinding.writerFence=2;},r=>{r.acceptance.value.issuance.factsSha256='0'.repeat(64);},
 ])assert.throws(()=>decodeAdmissionReadReply(mutate(x.replies.admissionRead(),change),x.source,{issuance:x.issuance}),refused);
});

test('publication decodes the closed initial request bound to the admission and queued type',()=>{
 const x=coreRepliesFixture(),p=decodePublicationReply(x.replies.publication(),x.source,{admission:x.admission});
 assert.equal(p.requestSha256,x.replies.publication().requestSha256);assert.equal(p.queuedType,'appropriations');
 assert.deepEqual(p.executionContext,x.executionContext);assert.deepEqual(p.request,x.request);
});

test('publication refuses digest/admission drift, regeneration dialect, foreign source and execution context drift',()=>{
 const x=coreRepliesFixture();
 for(const change of [
  r=>{r.requestSha256='0'.repeat(64);},r=>{r.sourceAdmissionSha256='0'.repeat(64);},r=>{r.request.requestVersion='capiro.objective-strategy.regeneration-request/20261016.1';},
  r=>{r.request.jobId='00000000-0000-4000-8000-000000000099';},r=>{r.request.source.objectiveVersion=99;},r=>{r.request.originalExpiresAtMs+=1;},
  r=>{r.executionContext.prompt='changed';},r=>{r.executionContext.contextPacketId='00000000-0000-4000-8000-000000000099';},
  r=>{r.executionContext.ownerRefs=[];},r=>{r.executionContext.ownerRefs.push({...r.executionContext.ownerRefs[0]});},
  r=>{r.executionContext.extra=1;},r=>{r.extra=1;},
 ])assert.throws(()=>decodePublicationReply(mutate(x.replies.publication(),change),x.source,{admission:x.admission}),refused);
});

test('acceptance reply must equal the genuine original ISSUED receipt and carries no acceptedAtMs',()=>{
 const x=coreRepliesFixture(),a=decodeAcceptanceReply(x.replies.accept(),x.source,{admission:x.admission,issuance:x.issuance});
 assert.deepEqual(a.issuance,x.issuance);assert.deepEqual(a.sourceBinding,x.source.binding);
 assert.throws(()=>decodeAcceptanceReply(x.replies.accept(),x.source,{admission:x.admission}),refused,'a reply cannot introduce its own issuance');
 for(const change of [
  r=>{r.acceptedAtMs=NOW;},r=>{r.issuance.grantId='00000000-0000-4000-8000-000000000099';},r=>{r.issuance.expiresAtMs+=1;},
  r=>{r.sourceBinding.workerId='00000000-0000-4000-8000-000000000099';},r=>{r.sourceRequestSha256='0'.repeat(64);},
  r=>{r.sourceAdmissionSha256='0'.repeat(64);},r=>{r.issuance.issuanceKey='0'.repeat(64);},
 ])assert.throws(()=>decodeAcceptanceReply(mutate(x.replies.accept(),change),x.source,{admission:x.admission,issuance:x.issuance}),refused);
});

test('decoded admission and publication compile into the existing protected Objective facts',()=>{
 const x=coreRepliesFixture(),admitted=decodeAdmissionReply(x.replies.admit(),x.source);
 const publication=decodePublicationReply(x.replies.publication(),x.source,{admission:admitted.sourceAdmission});
 const raw=objectiveSourceSelection({admission:admitted.sourceAdmission,publication,executionSelection:x.executionSelection});
 const pair=compileObjectiveProtectedFacts(structuredClone(raw),{accepted:x.f.accepted,issuance:x.receipt,nowMs:NOW});
 assert.equal(pair.objectiveGeneration.sourceAdmissionSha256,x.sourceAdmissionSha256);assert.equal(pair.objectiveStrategy.requestSha256,publication.requestSha256);
 assert.throws(()=>objectiveSourceSelection({admission:admitted.sourceAdmission,publication,executionSelection:{provider:'p'}}),refused);
});

test('completion receipt decodes Core saved-generation evidence bound to the original source and acceptance',()=>{
 const x=coreRepliesFixture(),admission=x.admission,publication=decodePublicationReply(x.replies.publication(),x.source,{admission});
 const acceptance=decodeAdmissionReadReply(x.replies.admissionRead(),x.source).acceptance,context={admission,publication,acceptance};
 const done=decodeCompletionReply(x.replies.completion(),x.source,context);
 assert.equal(done.strategyId,admission.canonical.canonicalStrategyId);assert.equal(done.completion.completionId,x.replies.completion().completion.resultRef);
 for(const change of [
  r=>{r.extra=1;},r=>{r.generationJobId='00000000-0000-4000-8000-000000000099';},r=>{r.sourceBinding.writerFence=2;},r=>{r.objectiveReceiptSha256='0'.repeat(64);},
  r=>{r.completion.namespace='other';},r=>{r.completion.typedRequestSha256='0'.repeat(64);},r=>{r.completion.executionContextSha256='0'.repeat(64);},
  r=>{r.completion.completionId='00000000-0000-4000-8000-000000000099';},r=>{r.completion.completedAtMs=NOW-1;},
  r=>{r.completion.completedAtMs=x.issuance.expiresAtMs;},r=>{r.objectiveReceipt.failure={code:'x'};r.objectiveReceiptSha256=coreApplicationSha256(r.objectiveReceipt);},
  r=>{r.objectiveReceipt.requestId='00000000-0000-4000-8000-000000000099';r.objectiveReceiptSha256=coreApplicationSha256(r.objectiveReceipt);},
 ])assert.throws(()=>decodeCompletionReply(mutate(x.replies.completion(),change),x.source,context),refused);
 assert.throws(()=>decodeCompletionReply(x.replies.completion(),x.source,{...context,acceptance:{...acceptance,acceptedAtMs:NOW+20}}),refused,'completion before acceptance');
});
