/** Focused public wiring for the additive metadata-only upload source event; no apps/ imports. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {hash} from 'node:crypto';
import {UPLOAD_SOURCE_EVENT,assertUploadSourceEventSemantics} from '../conversation-sources/upload-semantics.mjs';
import {assertConversationEvent,assertSourceShape,isNativeSourceEventType} from '../conversation-sources/validate.mjs';
import {validateShape} from '../validate.mjs';
import {assertConversationHistoryResponse} from '../conversation-history/validate.mjs';
import {receiveConversationRequest,receiveConversationResponse,createConversationCursor,receiveConversationEvent} from '@capiro/meri-contracts/conversation-application';
import {receiveConversationHistoryRequest,receiveConversationHistoryResponse} from '@capiro/meri-contracts/conversation-history';
import {transcript} from './conversation-history-fixture.mjs';

const bytes=v=>new TextEncoder().encode(JSON.stringify(v));
const sha='a'.repeat(64);
const binding={tenantId:'tenant1',actorId:'actor1',conversationId:'00000001-0000-4000-8000-000000000000',runId:'00000002-0000-4000-8000-000000000000',attemptId:'00000003-0000-4000-8000-000000000000',workerId:'00000004-0000-4000-8000-000000000000',writerFence:1};
const scope={tenantId:'tenant1',kind:'client',resourceId:'00000005-0000-4000-8000-000000000000',policyRevision:'p1'};
const upload=()=>({
 contractVersion:'0.1.0',eventId:'00000008-0000-4000-8000-000000000000',binding:structuredClone(binding),scopes:[structuredClone(scope)],sequence:1,
 createdAt:'2026-10-28T00:00:00.000Z',type:UPLOAD_SOURCE_EVENT,data:{
  schemaVersion:'meri.native-upload-source/1',deliveryId:'delivery-1',operation:{id:'read_upload_source',version:'0.2.0'},
  requestSha256:sha,argumentsSha256:sha,resultSha256:sha,executionSha256:sha,policyRevision:'p1',
  source:{authoritativeOwner:'upload_custody',uploadId:'00000009-0000-4000-8000-000000000000',sha256:sha,versionId:'v1',filename:'synthetic.pdf',mimeType:'application/pdf',
   bytes:1024,extractedSourceSha256:sha,extractionStatus:'available',limitations:[]},
  page:{number:0,count:1,sha256:sha,nextPage:null,fragmentCount:0,extractionStatus:'available',limitations:[]}}});

test('source family admits the upload event and refuses unknown/foreign metadata',()=>{
 const event=upload();
 assert.equal(isNativeSourceEventType(UPLOAD_SOURCE_EVENT),true);
 assert.deepEqual(assertSourceShape('NativeUploadSourceEvent',event),event);
 assert.deepEqual(assertUploadSourceEventSemantics(event),event);
 assert.deepEqual(assertConversationEvent(event),event);
 const mutations=[
  e=>e.type='source.native-bill-text',
  e=>e.data.fragments=[{text:'extracted text must never be stored'}],
  e=>e.data.page.fragmentCount=65,
  e=>e.data.page.nextPage=1,
  e=>e.data.page.extractionStatus='partial',
  e=>e.scopes[0].policyRevision='foreign',
  e=>e.scopes[0].tenantId='foreign',
  e=>e.data.policyRevision='foreign',
  e=>e.data.deliveryId='',
  e=>e.data.operation.version='9.9.9',
  e=>e.data.source.authoritativeOwner='other',
  e=>e.data.source.uploadId='not-a-uuid',
  e=>e.data.source.bytes=0,
  e=>e.data.requestSha256='not-a-hash',
  e=>e.eventId='not-a-uuid',
  e=>e.sequence=0,
  e=>e.createdAt='2026-10-28T00:00:00+01:00',
  e=>e.data.authorizationDecisionId='invented',
  e=>e.data.sourceLocator='https://example.test/private',
  e=>delete e.data.executionSha256];
 for(const mutate of mutations){const value=upload();mutate(value);assert.throws(()=>assertConversationEvent(value));assert.throws(()=>assertUploadSourceEventSemantics(value));}
});

test('application and history receivers accept the upload event and deny malformed pages',async()=>{
 const page=transcript(),run=page.latestRun;
 Object.assign(run,{binding:structuredClone(binding),scopes:[structuredClone(scope)],policyRevision:'p1',state:'running'});
 page.turns[0].run=structuredClone(run);page.turns[0].lastSequence=1;
 page.conversation={...page.conversation,conversationId:binding.conversationId,owner:{tenantId:binding.tenantId,actorId:binding.actorId},scopes:[structuredClone(scope)],policyRevision:'p1'};
 const event=upload();page.events=[{sequence:1,event:structuredClone(event)}];
 const view=await receiveConversationResponse('submit',200,bytes({run,requestId:page.turns[0].request.requestId,lastSequence:1,replayed:false}),receiveConversationRequest('submit',bytes({requestId:page.turns[0].request.requestId,prompt:'Synthetic'})));
 assert.deepEqual(receiveConversationEvent(bytes(event),createConversationCursor(view,0)).event,event);
 const request=receiveConversationHistoryRequest('transcript',bytes({conversationId:binding.conversationId}));
 const received=await receiveConversationHistoryResponse('transcript',200,bytes(page),request);
 assert.deepEqual(received.events[0].event,event);
 assert.deepEqual(assertConversationHistoryResponse('transcript',page,{conversationId:binding.conversationId}),page);
 for(const mutate of [p=>p.events[0].event.data.page.nextPage=2,p=>p.events[0].event.data.fragments=[],p=>p.events[0].event.scopes[0].tenantId='foreign',p=>p.events[0].event.data.authorizationDecisionId='invented']){
  const value=transcript();const r=value.latestRun;Object.assign(r,{binding:structuredClone(binding),scopes:[structuredClone(scope)],policyRevision:'p1',state:'running'});
  value.turns[0].run=structuredClone(r);value.turns[0].lastSequence=1;
  value.conversation={...value.conversation,conversationId:binding.conversationId,owner:{tenantId:binding.tenantId,actorId:binding.actorId},scopes:[structuredClone(scope)],policyRevision:'p1'};
  value.events=[{sequence:1,event:structuredClone(event)}];mutate(value);
  await assert.rejects(receiveConversationHistoryResponse('transcript',200,bytes(value),request));
  assert.throws(()=>assertConversationHistoryResponse('transcript',value,{conversationId:binding.conversationId}));
 }
});

test('frozen UIEvent/SourceEvidence validators still refuse the upload event and meri.schema bytes are unchanged',async()=>{
 const event=upload();
 assert.throws(()=>validateShape('UIEvent',event));
 assert.throws(()=>validateShape('SourceEvidence',{...structuredClone(event.data),authorizationDecisionId:null}));
 assert.equal(hash('sha256',await readFile(new URL('../meri.schema.json',import.meta.url)),'hex'),'e3de878198bbd557843ac440e48664ad5175eecd99f7ec932021ffc465bf8c5b');
});
