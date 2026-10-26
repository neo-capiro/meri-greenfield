import test from 'node:test';import assert from 'node:assert/strict';
import {sourceReceivers} from './source-receiver-fixture.mjs';
import {hearingProof} from '../../../apps/control/conversations/sources/test/hearing-fixture.mjs';
import {releaseHearingPage} from '../../../apps/control/conversations/sources/hearing-record.mjs';
import {transcript} from './conversation-history-fixture.mjs';
import {assertConversationHistoryResponse} from '../conversation-history/validate.mjs';
const {sources,history,conversation}=await sourceReceivers(),bytes=v=>new TextEncoder().encode(JSON.stringify(v)),schemaVersion='meri.hearing-source-read/1';
const input=e=>({schemaVersion,conversationId:e.binding.conversationId,runId:e.binding.runId,referenceId:e.eventId});
test('receiver source admits closed exact whole/partial packets and rejects hash/location/completeness substitutions',async()=>{
 for(const options of [{},{large:true,part:1},{view:'briefs'},{view:'reconciliation'}]){
  const p=hearingProof(options),q=sources.receiveHearingSourceRequest(bytes(input(p.event))),body={schemaVersion,event:p.event,current:releaseHearingPage(p.event,p.result)};
  assert.ok(Object.isFrozen(q));assert.deepEqual(sources.receiveNativeHearingSourceEvent(bytes(p.event)),p.event);assert.deepEqual(await sources.receiveHearingSourceResponse(200,bytes(body),q),body);
  await assert.rejects(sources.receiveHearingSourceResponse(200,bytes(body),structuredClone(q)),/UNADMITTED/);
  for(const mutate of [v=>v.event.data.page.payloadSha256='a'.repeat(64),v=>v.event.data.page.part++,v=>v.event.binding.runId='00000099-0000-4000-8000-000000000000',v=>v.current.result.coverage.complete=true,v=>v.current.result.records[0].payload.injected='changed',v=>v.current.sourceLocator='javascript:alert(1)',v=>v.event.data.selection.recordId='other']){const v=structuredClone(body);mutate(v);await assert.rejects(sources.receiveHearingSourceResponse(200,bytes(v),q));}
 }
});
test('receiver source retains content-free errors, exact request brands and byte bounds',async()=>{
 const q=sources.receiveHearingSourceRequest(bytes(input(hearingProof().event)));
 for(const [code,statuses]of Object.entries(sources.billTextSourceErrors))for(const status of statuses)assert.deepEqual(await sources.receiveHearingSourceResponse(status,bytes({error:{code}}),q),{error:{code}});
 assert.throws(()=>sources.receiveHearingSourceRequest(bytes({...input(hearingProof().event),authority:'invented'})));
 for(const b of [new Uint8Array(4097),new Uint8Array([255])])assert.throws(()=>sources.receiveHearingSourceRequest(b));
 await assert.rejects(sources.receiveHearingSourceResponse(409,bytes({error:{code:'SOURCE_REFERENCE_STALE',content:'secret'}}),q));
 await assert.rejects(sources.receiveBillTextSourceResponse(409,bytes({error:{code:'SOURCE_REFERENCE_STALE'}}),q),/UNADMITTED/);
});
test('source history and conversation receivers carry hearing events through existing canonical envelopes',async()=>{
 const {event:source}=hearingProof(),page=transcript(),run=page.latestRun;
 Object.assign(run,{binding:source.binding,scopes:source.scopes,policyRevision:source.data.policyRevision,state:'running'});page.turns[0].run=structuredClone(run);page.conversation={...page.conversation,conversationId:source.binding.conversationId,owner:{tenantId:source.binding.tenantId,actorId:source.binding.actorId},scopes:source.scopes,policyRevision:source.data.policyRevision};
 const native={...source,sequence:1};page.events=[{sequence:1,event:native}];
 const q=history.receiveConversationHistoryRequest('transcript',bytes({conversationId:source.binding.conversationId}));assert.deepEqual((await history.receiveConversationHistoryResponse('transcript',200,bytes(page),q)).events[0].event,native);assert.deepEqual(assertConversationHistoryResponse('transcript',page,{conversationId:source.binding.conversationId}),page);
 const view=await conversation.receiveConversationResponse('submit',200,bytes({run,requestId:page.turns[0].request.requestId,lastSequence:1,replayed:false}),conversation.receiveConversationRequest('submit',bytes({requestId:page.turns[0].request.requestId,prompt:'Synthetic'})));
 assert.deepEqual(conversation.receiveConversationEvent(bytes(native),conversation.createConversationCursor(view,0)).event,native);
});
