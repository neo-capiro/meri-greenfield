/** Actual Core factory output + Meri run/SDK codecs. Synthetic source, result and persistence ports; no model or DB acceptance. */
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import wire from '../objective-source/test/core-regeneration.fixture.json' with {type:'json'};
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {coreApplicationSha256 as coreHash} from '../../../packages/runtime/core-application-digest.mjs';
import {objectiveRunIdentity,createObjectiveRunStartRecord,assertObjectiveRunStartRecord,objectiveAcceptedRequest} from '../objective-source/run-starts.mjs';
import {decodeAdmissionReply,decodePublicationReply} from '../../control/objective-generation/core-replies.mjs';
import {createObjectiveSelectionOwner} from './selection-owner.mjs';
import {loadObjectiveStrategyCodec} from '../../worker/conversation/objective-generation/typed-result.mjs';
import {assertPreparedObjectiveSelection,assertTypedSelection} from '../../../packages/runtime/objective-generation-custody.mjs';
import {versions} from '../../control/conversations/test/store-fixture.mjs';
import {SDK_MODEL_CONFIGURATION} from '../../control/conversations/usage.mjs';
import {HISTORICAL_MODEL_SELECTION} from '../../../packages/contracts/model-selection.mjs';

function fixture(sharedIntake=false){
 const w=structuredClone(wire),a=w.sourceAdmission,now=w.request.requestedAtMs+1;
 if(sharedIntake){const r=w.request;r.source.intent={kind:'strategy-intake',strategyIntake:{schemaVersion:1,type:'appropriations',goal:r.input.goal,ownerUserId:r.principal.ownerActorId,targetDate:r.input.targetDate,meriContext:r.input.meriContext??''}};
  r.input={...r.input,ownerUserId:r.principal.ownerActorId,meriContext:r.source.intent.strategyIntake.meriContext};r.context.draft.input=structuredClone(r.input);
  r.context.contextSha256=hash(Object.fromEntries(Object.entries(r.context).filter(([k])=>k!=='contextSha256')));r.inputSha256=hash(Object.fromEntries(Object.entries(r).filter(([k])=>k!=='inputSha256')));w.requestSha256=hash(r);}
 const binding=objectiveRunIdentity({tenantId:a.canonical.tenantId,actorId:a.actorUserId,generationJobId:a.generationJobId}).binding;
 const source={generationJobId:a.generationJobId,binding};
 const {sourceAdmission,...publication}=w;
 const selected={sourceAdmission,request:w.request,executionContext:w.executionContext,queuedType:w.request.input.typeHint};
 const record=createObjectiveRunStartRecord({binding,generationJobId:a.generationJobId,selection:selected,nowMs:now});
 return {w,a,now,binding,source,publication,selected,record};
}
for(const sharedIntake of [false,true])test(`Core-produced regeneration keeps the actual basis and expected version through native admission and SDK selection (${sharedIntake?'edited intake type':'legacy'})`,async()=>{
 const x=fixture(sharedIntake);assert.deepEqual(decodeAdmissionReply({schemaVersion:1,sourceAdmission:x.a,sourceAdmissionSha256:x.w.sourceAdmissionSha256},x.source).sourceAdmission,x.a);
 const p=decodePublicationReply(x.publication,x.source,{admission:x.a});assert.deepEqual(p.request,x.w.request);assert.equal(p.request.basisSha256,wire.request.basisSha256);
 assert.deepEqual(assertObjectiveRunStartRecord(x.record),x.record);assert.equal(x.record.effectExpiresAtMs,x.w.request.originalExpiresAtMs);
 const run={binding:x.binding,state:'running',scopes:[{tenantId:x.binding.tenantId,kind:'client',resourceId:x.a.canonical.clientId,policyRevision:'policy1'}],createdAt:new Date(x.now).toISOString(),policyRevision:'policy1',versions};
 const owner=createObjectiveSelectionOwner({runStarts:{async read(){return {state:'STARTED',record:x.record};}},store:{async read(){return {run,request:objectiveAcceptedRequest(x.selected)};},async readModelPolicy(){return {maxTurns:20,maxBudgetMicroUsd:2000000};},async readModelSelection(){return HISTORICAL_MODEL_SELECTION;}},now:()=>x.now});
 const actual=await owner.read({binding:x.binding});assert.deepEqual(actual.objectiveStrategy.request.basis,x.w.request.basis);
 const selected=assertPreparedObjectiveSelection(actualPair(actual),{binding:x.binding,acceptedRequest:objectiveAcceptedRequest(x.selected),expiresAtMs:x.record.effectExpiresAtMs});
 const codec=await loadObjectiveStrategyCodec(x.w.request);assert.deepEqual(codec.selection(selected).strategy.request,x.w.request);
 assert.deepEqual(codec.outputFormat(selected).schema.properties.payload.anyOf[0].properties.type,{const:'authorization'});
 const initial=JSON.parse(readFileSync(new URL('../../../packages/contracts/strategy-operations-candidate/fixtures/strategy.draft.result.json',import.meta.url),'utf8'));
 let payload=JSON.stringify(initial.payload).replaceAll('evidence:accepted',x.w.request.context.evidence.find(e=>e.reviewState==='accepted').ref).replaceAll('evidence:pending',x.w.request.context.evidence.find(e=>e.reviewState==='pending').ref);
 const model={type:'result',subtype:'success',is_error:false,structured_output:{operation:'strategy.draft',state:'succeeded',payload:JSON.parse(payload),issues:[]}};
 const encoded=codec.encode({selection:selected,executionSelection:actual.objectiveStrategy.executionSelection,sdkResult:model,sessionId:x.binding.conversationId,receiptRef:x.binding.runId,resultRef:x.binding.runId,completedAtMs:x.now+1});
 assert.equal(encoded.descriptor.kind,'objective.strategy.regeneration');assert.equal(encoded.descriptor.path,'meri-objective-strategy-regeneration.result.json');
 assert.equal(encoded.result.basisSha256,x.w.request.basisSha256);assert.deepEqual(codec.decode(encoded.bytes,encoded.descriptor,selected),encoded.result);
 assert.deepEqual(assertTypedSelection(selected,encoded.descriptor,{binding:x.binding,acceptedRequest:selected.acceptedRequest}),selected);
 const wrongType=structuredClone(model);wrongType.structured_output.payload.type='appropriations';assert.throws(()=>codec.encode({selection:selected,executionSelection:actual.objectiveStrategy.executionSelection,sdkResult:wrongType,sessionId:x.binding.conversationId,receiptRef:x.binding.runId,resultRef:x.binding.runId,completedAtMs:x.now+1}));
});
const actualPair=x=>({objectiveGeneration:x.objectiveGeneration,objectiveStrategy:x.objectiveStrategy});
test('shared intake stays source data while regeneration keeps the existing Strategy type',()=>{
 const x=fixture(),r=structuredClone(x.w.request),answers={schemaVersion:1,type:'appropriations',goal:'g'.repeat(4000),ownerUserId:r.principal.ownerActorId,targetDate:null,meriContext:''};
 r.source.intent={kind:'strategy-intake',strategyIntake:answers};
 r.input={...r.input,goal:answers.goal,ownerUserId:answers.ownerUserId,targetDate:answers.targetDate,meriContext:answers.meriContext};
 r.context.draft.input=structuredClone(r.input);
 r.context.contextSha256=hash(Object.fromEntries(Object.entries(r.context).filter(([k])=>k!=='contextSha256')));
 r.inputSha256=hash(Object.fromEntries(Object.entries(r).filter(([k])=>k!=='inputSha256')));
 const publication={...x.publication,request:r,requestSha256:hash(r)};
 assert.deepEqual(decodePublicationReply(publication,x.source,{admission:x.a}).request.source.intent.strategyIntake,answers);
 const record=createObjectiveRunStartRecord({binding:x.binding,generationJobId:x.a.generationJobId,selection:{...x.selected,request:r},nowMs:x.now});
 assert.equal(record.selection.queuedType,'authorization');
 assert.equal(record.selection.request.source.intent.strategyIntake.type,'appropriations');
});
test('regeneration refuses substituted basis/version/admission, removed delegation and incoherent context even with a new request hash',()=>{
 for(const change of [r=>{r.basis.snapshot.extra='changed';},r=>{r.applicationTarget.expectedStrategyVersionId='00000000-0000-4000-8000-000000000088';},r=>{r.basis.sourceAdmissionSha256='0'.repeat(64);},r=>{r.delegation={credential:'synthetic'};},r=>{r.principal.actorId='user_fixture';},r=>{r.context.draft.selectedOwnerActorId='different';},r=>{r.originalExpiresAtMs=r.requestedAtMs+900001;}]){
  const x=fixture(),p=structuredClone(x.publication);change(p.request);p.request.inputSha256=hash(Object.fromEntries(Object.entries(p.request).filter(([k])=>k!=='inputSha256')));p.requestSha256=hash(p.request);
  assert.throws(()=>decodePublicationReply(p,x.source,{admission:x.a}));
  assert.throws(()=>createObjectiveRunStartRecord({binding:x.binding,generationJobId:x.a.generationJobId,selection:{...x.selected,request:p.request},nowMs:x.now}));
 }
 const x=fixture(),admission={...x.a,expectedStrategyVersionId:null};assert.throws(()=>decodePublicationReply({...x.publication,sourceAdmissionSha256:coreHash(admission)},x.source,{admission}));
});
