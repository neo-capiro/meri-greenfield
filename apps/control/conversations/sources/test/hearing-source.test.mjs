import test from 'node:test';import assert from 'node:assert/strict';
import {createPostgresConversationStore} from '../../postgres-store.mjs';
import {storeFixture,id} from '../../test/store-fixture.mjs';
import {binding,scopes,seedStore,status,check} from './fixture.mjs';
import {hearingProof,jsonHash} from './hearing-fixture.mjs';
import {createHearingSourceCapture,projectHearingSource,savedHearingRequest,releaseHearingPage} from '../hearing-record.mjs';
import {assertNativeSourceEvent} from '../../../../../packages/contracts/conversation-sources/validate.mjs';
test('exact producer packet persists metadata only and rereads through its exact selectors',async()=>{
 const f=storeFixture(),store=createPostgresConversationStore({pool:f.pool,now:()=>1000});await seedStore(store);const p=hearingProof(),capture=createHearingSourceCapture({store});
 await capture({...p,scopes,check});await capture({...p,scopes,check});const page=await store.read(binding,{},check),event=page.events.at(-1);assert.equal(page.lastSequence,4);assertNativeSourceEvent(event);
 assert.equal(event.type,'source.native-hearing-record');assert.equal(Object.hasOwn(event.data.source.provenance,'sourceKey'),false);assert.doesNotMatch(JSON.stringify(event),/Synthetic public record|evidence|authorizationDecisionId|serviceSecret/);
 assert.deepEqual(savedHearingRequest(event),{recordsView:'published',hearingId:'h',recordId:'record',clientId:null,asOf:null,cursor:null});assert.deepEqual(releaseHearingPage(event,p.result).result,p.result);
 await assert.rejects(capture({...hearingProof({large:true}),scopes,check}),/SOURCE_PUBLICATION_CONFLICT/);
 await store.append(binding,status(10,'completed'),check);const saved=await store.history.source({principal:{tenantId:binding.tenantId,actorId:binding.actorId,clientIds:[id(5)]},conversationId:binding.conversationId,runId:binding.runId,referenceId:event.eventId},check);assert.deepEqual(saved.event,event);
});
test('publication acknowledgement loss retains one immutable event and preserves UNKNOWN',async()=>{
 const f=storeFixture(),store=createPostgresConversationStore({pool:f.pool});await seedStore(store);const p=hearingProof(),capture=createHearingSourceCapture({store});f.state.commitUnknown=true;
 await assert.rejects(capture({...p,scopes,check}),/SOURCE_PUBLICATION_UNKNOWN/);f.state.commitUnknown=false;await capture({...p,scopes,check});assert.equal((await store.read(binding,{},check)).lastSequence,4);
});
test('first, continued and final JSON fragments keep exact UTF16 location, hash and incomplete coverage',()=>{
 const first=hearingProof({large:true}),count=first.result.records[0].payload.chunkCount;
 for(const part of [0,1,count-1]){const p=hearingProof({large:true,part}),current=releaseHearingPage(p.event,p.result);assert.equal(p.event.data.page.part,part);assert.equal(p.event.data.page.contentComplete,false);assert.equal(current.result.coverage.complete,false);assert.equal(current.result.records[0].payload.kind,'hearing_evidence_json_chunk');assert.equal(Object.hasOwn(current,'claims'),false);assert.equal(savedHearingRequest(p.event).cursor,p.request.arguments.cursor??null);assert.equal(p.event.data.page.payloadSha256,jsonHash(p.result.records[0].payload));assert.equal(current.result.coverage.paginationComplete,part===count-1);}
});
test('whole canonical private packets retain owner claims/reviews and historical selectors',()=>{
 for(const view of ['briefs','reconciliation'])for(const asOf of [null,'2026-10-26T06:00:00.000Z']){const p=hearingProof({view,asOf}),current=releaseHearingPage(p.event,p.result);assert.deepEqual(current.result.records[0].payload,p.whole);assert.equal(current.result.records[0].payload.payload.claims[0].id,'owner-claim');if(view==='reconciliation')assert.equal(current.result.records[0].payload.assessments[0].reviews[0].outcome,'needs_review');assert.equal(p.event.data.page.contentComplete,true);assert.equal(p.event.data.source.provenance.tenantId,binding.tenantId);assert.equal(savedHearingRequest(p.event).asOf,asOf);}
});
test('changed record, hash, event, payload, location and coverage never release against a saved reference',()=>{
 const p=hearingProof({large:true,part:1});for(const change of [r=>r.records[0].recordId+='other',r=>r.records[0].provenance.contentHash='a'.repeat(64),r=>r.records[0].provenance.hearingId='other',r=>r.records[0].payload.text='y'.repeat(2000),r=>r.records[0].payload.characterStart++,r=>r.coverage.complete=true]){const raw=structuredClone(p.result);change(raw);assert.throws(()=>releaseHearingPage(p.event,raw));}
 for(const change of [e=>e.data.selection.cursor=null,e=>e.data.selection.recordId='other',e=>e.data.page.part++,e=>e.data.source.provenance.sourceKey='invented',e=>e.data.policyRevision='other']){const event=structuredClone(p.event);change(event);assert.throws(()=>assertNativeSourceEvent(event));}
});
test('well-formed replacement content cannot satisfy the previously captured source binding',()=>{
 const saved=hearingProof(),replacement=hearingProof({text:'A valid but different current source'});
 assert.deepEqual(releaseHearingPage(replacement.event,replacement.result).result,replacement.result);
 assert.throws(()=>releaseHearingPage(saved.event,replacement.result),{message:'SOURCE_REFERENCE_STALE'});
});
test('private JSON fragments preserve the owner packet hash without exposing a complete claims or reviews collection',()=>{
 for(const view of ['briefs','reconciliation']){const p=hearingProof({view,large:true,ascii:true,part:1}),current=releaseHearingPage(p.event,p.result),payload=current.result.records[0].payload;assert.equal(payload.kind,'hearing_evidence_json_chunk');assert.equal(p.event.data.page.contentComplete,false);assert.equal(Object.hasOwn(payload,'claims'),false);assert.equal(Object.hasOwn(payload,'assessments'),false);assert.equal(p.event.data.source.provenance.contentHash,jsonHash(p.whole));}
});
test('unselected, unsupported and unresolved selectors do not invent saved hearing evidence',()=>{
 const p=hearingProof();assert.equal(projectHearingSource({...p,scopes,request:{...p.request,operation:{id:'other',version:'0.2.0'}}}),null);
 for(const args of [{},{hearingId:'h'},{recordsView:'published'},{recordsView:'published',hearingId:'h',recordId:'record',clientId:'Client name'}])assert.equal(projectHearingSource({...p,scopes,request:{...p.request,arguments:args}}),null);
 const changed=structuredClone(p);changed.response.resultSha256='f'.repeat(64);assert.throws(()=>projectHearingSource({...changed,scopes}));
});
