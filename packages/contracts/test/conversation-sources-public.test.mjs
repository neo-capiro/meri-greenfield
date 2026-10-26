/** Owned public bytes only; no pack, installation, database or provider. */
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {hash} from 'node:crypto';
import {receiveBillTextSourceRequest as request,receiveBillTextSourceResponse as receive,receiveNativeBillTextSourceEvent as event,billTextSourceErrors} from '@capiro/meri-contracts/conversation-sources';
import {receiveHearingSourceRequest,receiveHearingSourceResponse,receiveNativeHearingSourceEvent,receiveHearingMediaRequest,receiveHearingMediaResponse} from '@capiro/meri-contracts/conversation-sources';
import {receiveConversationRequest,receiveConversationResponse,createConversationCursor,receiveConversationEvent} from '@capiro/meri-contracts/conversation-application';
import {receiveConversationHistoryRequest,receiveConversationHistoryResponse} from '@capiro/meri-contracts/conversation-history';
import {validateShape} from '../validate.mjs';
import {assertConversationHistoryResponse} from '../conversation-history/validate.mjs';
import {proof} from '../../../apps/control/conversations/sources/test/fixture.mjs';
import {releaseBillTextPage} from '../../../apps/control/conversations/sources/bill-text.mjs';
import {hearingProof} from '../../../apps/control/conversations/sources/test/hearing-fixture.mjs';
import {releaseHearingPage} from '../../../apps/control/conversations/sources/hearing-record.mjs';
import {mediaResult} from '../../../apps/control/conversations/sources/test/hearing-media-fixture.mjs';
import {transcript} from './conversation-history-fixture.mjs';
import {createMeriEventStream} from '../../ui-stream/dist/producer.js';
const bytes=v=>new TextEncoder().encode(JSON.stringify(v)),schemaVersion='meri.bill-text-source-read/1';
const input=e=>({schemaVersion,conversationId:e.binding.conversationId,runId:e.binding.runId,referenceId:e.eventId});
test('public source request/event/page are closed, immutable, correlated and preserve UTF-16 offsets',async()=>{
 const p=proof({mutate:r=>{r.text='😀'.repeat(6);}}),q=request(bytes(input(p.event))),body={schemaVersion,event:p.event,current:releaseBillTextPage(p.event,p.result)};
 assert.deepEqual(event(bytes(p.event)),p.event);assert.deepEqual(await receive(200,bytes(body),q),body);assert.ok(Object.isFrozen(q));assert.equal(body.current.text.length,12);
 assert.throws(()=>request(bytes({...input(p.event),authorizationDecisionId:'invented'})));await assert.rejects(receive(200,bytes(body),structuredClone(q)),/UNADMITTED/);
 for(const mutate of [v=>v.event.binding.runId='00000099-0000-4000-8000-000000000000',v=>v.current.text='y'.repeat(12),v=>v.event.data.page.contentComplete=false,v=>v.event.data.page.offset=1,v=>v.event.data.policyRevision='foreign',v=>v.current.sourceLocator='javascript:alert(1)',v=>v.event.data.authorizationDecisionId='invented']){const value=structuredClone(body);mutate(value);await assert.rejects(receive(200,bytes(value),q));}
});
test('public error statuses remain content-free, and byte inputs reject hostile/non-JSON data',async()=>{
 assert.throws(()=>billTextSourceErrors.SOURCE_REFERENCE_STALE.push(503),TypeError);
 const q=request(bytes(input(proof().event)));for(const [code,statuses]of Object.entries(billTextSourceErrors))for(const status of statuses)assert.deepEqual(await receive(status,bytes({error:{code}}),q),{error:{code}});
 for(const value of [{error:{code:'SOURCE_REFERENCE_STALE',text:'secret'}},{error:{code:'SOURCE_REFERENCE_STALE'},sourceLocator:'secret'},{error:{code:'arbitrary'}}])await assert.rejects(receive(409,bytes(value),q));
 for(const value of [new Uint8Array([255]),new Uint8Array(4097),new TextEncoder().encode('{"__proto__":{}}'),bytes({...input(proof().event),referenceId:'\ud800'})])assert.throws(()=>request(value));
});
test('AI SDK stream carries the exact native reference in the existing data part',async()=>{const native=proof().event,chunks=[];for await(const chunk of createMeriEventStream({messageId:'synthetic',events:[native]}))chunks.push(chunk);const parts=chunks.filter(c=>c.type==='data-meri-event');assert.equal(parts.length,1);assert.deepEqual(parts[0].data,native);assert.equal(parts[0].id,native.eventId);assert.equal(parts[0].transient,true);});
test('current conversation event and history receivers admit native source while legacy validation stays strict',async()=>{
 const {event:source}=proof(),page=transcript(),run=page.latestRun;
 Object.assign(run,{binding:source.binding,scopes:source.scopes,policyRevision:source.data.policyRevision,state:'running'});page.turns[0].run=structuredClone(run);page.conversation={...page.conversation,conversationId:source.binding.conversationId,owner:{tenantId:source.binding.tenantId,actorId:source.binding.actorId},scopes:source.scopes,policyRevision:source.data.policyRevision};
 const native={...source,sequence:1};page.events=[{sequence:1,event:native}];
 const received=await receiveConversationHistoryResponse('transcript',200,bytes(page),receiveConversationHistoryRequest('transcript',bytes({conversationId:source.binding.conversationId})));assert.deepEqual(received.events[0].event,native);assert.deepEqual(assertConversationHistoryResponse('transcript',page,{conversationId:source.binding.conversationId}),page);
 const view=await receiveConversationResponse('submit',200,bytes({run,requestId:page.turns[0].request.requestId,lastSequence:1,replayed:false}),receiveConversationRequest('submit',bytes({requestId:page.turns[0].request.requestId,prompt:'Synthetic'})));
 assert.deepEqual(receiveConversationEvent(bytes(native),createConversationCursor(view,0)).event,native);
 assert.throws(()=>validateShape('UIEvent',native));assert.throws(()=>validateShape('SourceEvidence',{...source.data,authorizationDecisionId:null}));
 assert.equal(hash('sha256',await readFile(new URL('../meri.schema.json',import.meta.url)),'hex'),'e3de878198bbd557843ac440e48664ad5175eecd99f7ec932021ffc465bf8c5b');
});

test('generated public hearing source and history exports preserve the exact saved reference',async()=>{
 const p=hearingProof(),source=p.event,q=receiveHearingSourceRequest(bytes({...input(source),schemaVersion:'meri.hearing-source-read/1'})),body={schemaVersion:'meri.hearing-source-read/1',event:source,current:releaseHearingPage(source,p.result)};
 assert.deepEqual(receiveNativeHearingSourceEvent(bytes(source)),source);assert.deepEqual(await receiveHearingSourceResponse(200,bytes(body),q),body);
 await assert.rejects(receiveHearingSourceResponse(200,bytes(body),structuredClone(q)),/UNADMITTED/);
 const wrong=structuredClone(body);wrong.event.binding.runId='00000099-0000-4000-8000-000000000000';await assert.rejects(receiveHearingSourceResponse(200,bytes(wrong),q));
 const page=transcript(),run=page.latestRun;Object.assign(run,{binding:source.binding,scopes:source.scopes,policyRevision:source.data.policyRevision,state:'running'});page.turns[0].run=structuredClone(run);page.conversation={...page.conversation,conversationId:source.binding.conversationId,owner:{tenantId:source.binding.tenantId,actorId:source.binding.actorId},scopes:source.scopes,policyRevision:source.data.policyRevision};
 const native={...source,sequence:1};page.events=[{sequence:1,event:native}];
 const historyRequest=receiveConversationHistoryRequest('transcript',bytes({conversationId:source.binding.conversationId}));assert.deepEqual((await receiveConversationHistoryResponse('transcript',200,bytes(page),historyRequest)).events[0].event,native);
 assert.throws(()=>validateShape('UIEvent',native));
});

test('generated public hearing media exports bind manifest and playback to the saved hearing',async()=>{
 const {event:source}=hearingProof();
 for(const playback of [null,{epochId:'epoch',positionMs:1500}]){
  const q=receiveHearingMediaRequest(bytes({...input(source),schemaVersion:'meri.hearing-media-read/1',playback})),result=mediaResult(source,playback),body={schemaVersion:'meri.hearing-media-read/1',event:source,current:{source:result.source,media:result.media}};
  assert.deepEqual(await receiveHearingMediaResponse(200,bytes(body),q),body);await assert.rejects(receiveHearingMediaResponse(200,bytes(body),structuredClone(q)),/UNADMITTED/);
  const wrong=structuredClone(body);wrong.current.source.recordId='other';await assert.rejects(receiveHearingMediaResponse(200,bytes(wrong),q));
  if(playback){const wrongTime=structuredClone(body);wrongTime.current.media.playback.startMs=1501;await assert.rejects(receiveHearingMediaResponse(200,bytes(wrongTime),q));}
 }
});
