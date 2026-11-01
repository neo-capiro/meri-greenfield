/** Real accepted-selection/typed-result/SDK activity owners; synthetic Core publication and SDK transport, no provider call. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createConversationActivity} from '../activity.mjs';
import {createObjectiveGenerationRuntime} from '../objective-generation/runtime.mjs';
import {createObjectiveSelectionOwner} from '../../../runtime/objective-generation/selection-owner.mjs';
import {createObjectiveRunStartRecord,objectiveAcceptedRequest} from '../../../runtime/objective-source/run-starts.mjs';
import {runStartFixture,id,NOW} from '../../../runtime/objective-source/test/run-start-fixture.mjs';
import {versions} from '../../../control/conversations/test/store-fixture.mjs';
import {SDK_MODEL_CONFIGURATION} from '../../../control/conversations/usage.mjs';
import {HISTORICAL_MODEL_SELECTION} from '../../../../packages/contracts/model-selection.mjs';
import {payload} from '../../../../packages/contracts/strategy-operations-candidate/fixture-source.mjs';
import {requestInputHash,without} from '../../../../packages/contracts/strategy-operations-candidate/validate.mjs';
import {hash,rawTypedSha256,assertPreparedObjectiveSelection} from '../../../../packages/runtime/objective-generation-custody.mjs';
import {loadTypedDraftCodec} from '../objective-generation/typed-result.mjs';

for(const filled of [false,true])test(`shared intake reaches one SDK query and retained structured draft (${filled?'all answers':'empty optional answers'})`,async()=>{
 const answers={schemaVersion:1,type:'appropriations',goal:'g'.repeat(4000),ownerUserId:'user_synthetic_owner',
  targetDate:filled?'2026-12-01':null,meriContext:filled?'c'.repeat(8000):''};
 const knownContactId='synthetic-known-contact',suggestedContactId='synthetic-suggested-contact';
 const relationshipContext={
  government_targets:[{id:id(910),member_id:knownContactId,member_name:'Synthetic known contact',source_directory:'congress'}],
  member_notes:[{id:id(911),directory_contact_id:knownContactId,body:'Established relationship; synthetic prior meeting.',scope:'tenant_shared'}],
  current_directory:[{targetId:id(910),detail:{id:knownContactId}}],
  relationship_history:[{id:id(912),contactId:knownContactId,summary:'Synthetic prior meeting observation.'}],
  target_recommendations:[{id:id(913),recommendations_jsonb:[{memberId:suggestedContactId,reason:'Suggested contact only; no established relationship observed.'}]}],
 };
 // Core owns this already-authorized prompt. Meri must preserve it exactly, including
 // the intake and relationship observations, rather than regenerate it from form fields.
 const prompt='Draft a proposed Strategy from the saved intake and authorized relationship context.\n'+JSON.stringify(answers)+
  '\nAUTHORIZED RELATIONSHIP CONTEXT (data):\n'+JSON.stringify(relationshipContext)+'\nLabel recommendations and assumptions.';
 const f=runStartFixture({prompt}),r=f.selection.request;
 r.source.intent={kind:'strategy-intake',strategyIntake:answers};
 r.input={typeHint:answers.type,goal:answers.goal,ownerUserId:answers.ownerUserId,targetDate:answers.targetDate,meriContext:answers.meriContext,attachmentIds:[]};
 r.principal.ownerActorId=answers.ownerUserId;r.context.draft.selectedOwnerActorId=answers.ownerUserId;
 r.context.draft.input=structuredClone(r.input);r.context.contextSha256=hash(without(r.context,'contextSha256'));r.inputSha256=requestInputHash(r);
 f.selection.executionContext.ownerRefs[0].clerkUserId=answers.ownerUserId;
 const record=createObjectiveRunStartRecord({binding:f.binding,generationJobId:f.generationJobId,selection:f.selection,nowMs:NOW});
 const request=objectiveAcceptedRequest(record.selection),scopes=[{kind:'client',tenantId:f.tenantId,resourceId:f.clientId,policyRevision:'policy'}];
 const run={binding:f.binding,versions,scopes,policyRevision:'policy',state:'queued',createdAt:new Date(NOW).toISOString()};
 const selected=createObjectiveSelectionOwner({runStarts:{async read(){return {state:'STARTED',record};}},
  store:{async read(){return {run,request};},async readModelPolicy(){return {maxTurns:20,maxBudgetMicroUsd:2000000};},async readModelSelection(){return HISTORICAL_MODEL_SELECTION;}},now:()=>NOW});
 const writes=[],observed={queries:0,captures:0,prompt:null,options:null,descriptor:null};
 const objectiveGeneration=createObjectiveGenerationRuntime({selection:selected,now:()=>NOW,writeFile:async value=>{writes.push(value);}});
 const sessionId=id(900),proposal=payload('strategy.draft');
 proposal.rationale='Proposed next steps based on the authorized relationship; confirm the stated assumption.';
 proposal.coverage.assumptions=['Synthetic relationship requires confirmation before outreach.'];
 proposal.nodes[0].note='Use the recorded relationship with '+knownContactId+'.';
 proposal.nodes[1].note='Recommendation only: investigate '+suggestedContactId+'; no established relationship is claimed.';
 const owner={async load(){return {run,request};},async append(){},async nextControls(){return [];},
  async claimControl(){throw Error('no control');},async ackControl(){throw Error('no control');},async recordCheckpoint(){throw Error('no pause');}};
 const lifecycle={async captureCheckpoint(){throw Error('no pause');},async captureCompletion(input){
  observed.captures++;observed.descriptor=input.typedResult;const d=input.typedResult;
  const sdkSession={binding:f.binding,key:{projectKey:'synthetic-project',sessionId},ownerSha256:'a'.repeat(64),entriesCount:2};
  const files={workspace:{contractVersion:'0.1.0',manifestId:id(901),binding:f.binding,logicalCwd:'/workspace/conversation',
   entries:[{path:d.path,kind:'file',executable:false,object:{objectId:id(902),versionId:'synthetic-version',sha256:d.fileSha256,bytes:d.bytes,scopes}}],scopes,createdAt:new Date(NOW).toISOString()},tasks:[]};
  return {binding:f.binding,state:'completed',proof:{kind:'native-session',sdkSession,files,checkpointId:f.binding.runId,
   checkpointSha256:hash({sdkSession,files}),sourceRequestSha256:hash(request),contextSha256:hash({window:null,skill:null,scopes}),versions,scopes,lastEventSequence:3}};
 }};
 const runtime={binding:f.binding,versions,cwd:'/workspace/'+f.binding.conversationId,...SDK_MODEL_CONFIGURATION,
  sessionStore:{load(){},append(){}},deadlineMs:NOW+100000,maxTurns:20,maxCostMicroUSD:2000000,maxOutputBytes:1048576};
 const execute=createConversationActivity({runOwner:owner,lifecycle,objectiveGeneration,now:()=>NOW,prepareRuntime:async()=>runtime,
  query({prompt:input,options}){observed.queries++;observed.options=options;return {async *[Symbol.asyncIterator](){
   const first=await input[Symbol.asyncIterator]().next();observed.prompt=first.value.message.content;
   yield {type:'system',subtype:'init',session_id:sessionId};
   yield {type:'result',subtype:'success',is_error:false,session_id:sessionId,structured_output:{operation:'strategy.draft',state:'succeeded',payload:proposal,issues:[]}};
  },close(){}};}});
 assert.deepEqual(await execute({binding:f.binding}),{state:'completed'});
 assert.equal(observed.queries,1);assert.equal(observed.captures,1);assert.equal(writes.length,1);assert.equal(observed.prompt,prompt);
 assert.notEqual(knownContactId,suggestedContactId);
 assert.ok(observed.prompt.includes(JSON.stringify(relationshipContext)));
 assert.equal(relationshipContext.government_targets[0].member_id,relationshipContext.member_notes[0].directory_contact_id);
 assert.equal(relationshipContext.target_recommendations[0].recommendations_jsonb[0].memberId,suggestedContactId);
 assert.equal(observed.options.systemPrompt.preset,'claude_code');assert.equal(observed.options.tools.preset,'claude_code');assert.equal(observed.options.skills,'all');
 assert.equal(observed.options.outputFormat.type,'json_schema');assert.ok(observed.options.disallowedTools.includes('AskUserQuestion'));
 assert.equal(observed.descriptor.fileSha256,rawTypedSha256(writes[0].bytes));
 const wire=await selected.read({binding:f.binding}),selection=assertPreparedObjectiveSelection({objectiveGeneration:wire.objectiveGeneration,objectiveStrategy:wire.objectiveStrategy},
  {binding:f.binding,acceptedRequest:request,expiresAtMs:wire.expiresAtMs});
 const codec=await loadTypedDraftCodec(),retained=codec.decode(writes[0].bytes,observed.descriptor,selection);
 assert.deepEqual(selection.strategy.request.source.intent.strategyIntake,answers);
 assert.deepEqual(retained.payload,proposal);assert.equal(retained.payload.type,'authorization','initial type hint remains advisory');
 assert.ok(retained.payload.nodes[0].note.includes(knownContactId));
 assert.ok(retained.payload.nodes[1].note.includes(suggestedContactId));assert.match(retained.payload.nodes[1].note,/Recommendation only/);
});
