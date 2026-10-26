import test from 'node:test';import assert from 'node:assert/strict';
import {sourceReceivers} from './source-receiver-fixture.mjs';
import {hearingProof} from '../../../apps/control/conversations/sources/test/hearing-fixture.mjs';
import {mediaResult} from '../../../apps/control/conversations/sources/test/hearing-media-fixture.mjs';
const {sources}=await sourceReceivers(),bytes=v=>new TextEncoder().encode(JSON.stringify(v)),schemaVersion='meri.hearing-media-read/1';
function fixture(playback=null){const {event}=hearingProof(),request={schemaVersion,conversationId:event.binding.conversationId,runId:event.binding.runId,referenceId:event.eventId,playback},result=mediaResult(event,playback);return {request,q:sources.receiveHearingMediaRequest(bytes(request)),body:{schemaVersion,event,current:{source:result.source,media:result.media}}};}
test('public receiver admits only a branded saved reference, exact source and selected media time',async()=>{
 for(const playback of [null,{epochId:'epoch',positionMs:1500}]){const f=fixture(playback);assert.ok(Object.isFrozen(f.q));assert.deepEqual(await sources.receiveHearingMediaResponse(200,bytes(f.body),f.q),f.body);
  await assert.rejects(sources.receiveHearingMediaResponse(200,bytes(f.body),structuredClone(f.q)),/UNADMITTED/);
  for(const mutate of [v=>v.current.source.recordId='other',v=>v.current.source.hearingId='other',v=>v.current.source.contentHash='b'.repeat(64),v=>v.event.binding.runId='00000099-0000-4000-8000-000000000000',v=>v.current.captions='invented']){const v=structuredClone(f.body);mutate(v);await assert.rejects(sources.receiveHearingMediaResponse(200,bytes(v),f.q));}
 }
});
test('coverage and playback substitution, unsafe addresses and out-of-part selections are refused',async()=>{
 const f=fixture();for(const mutate of [v=>v.current.media.manifest.epochs.push(v.current.media.manifest.epochs[0]),v=>v.current.media.manifest.epochs[0].durableEndMs=0,v=>v.current.media.manifest.hearingId='other']){const v=structuredClone(f.body);mutate(v);await assert.rejects(sources.receiveHearingMediaResponse(200,bytes(v),f.q));}
 const p=fixture({epochId:'epoch',positionMs:1500});for(const mutate of [v=>v.current.media.playback.epochId='other',v=>v.current.media.playback.startMs=1501,v=>v.current.media.playback.endMs=1500,v=>v.current.media.playback.url='javascript:alert(1)',v=>v.current.media.playback.url='https://user:secret@media.example.test/',v=>v.current.media.playback.expiresAt='invalid']){const v=structuredClone(p.body);mutate(v);await assert.rejects(sources.receiveHearingMediaResponse(200,bytes(v),p.q));}
});
test('closed requests, byte bounds, content-free errors and family separation stay enforced',async()=>{
 const f=fixture();for(const request of [{...f.request,url:'https://forged.example.test'},{...f.request,playback:{epochId:'epoch',positionMs:-1}},{...f.request,playback:{epochId:'epoch',positionMs:0.5}}])assert.throws(()=>sources.receiveHearingMediaRequest(bytes(request)));
 assert.throws(()=>sources.receiveHearingMediaRequest(new Uint8Array(4097)));
 for(const [code,statuses]of Object.entries(sources.billTextSourceErrors))for(const status of statuses)assert.deepEqual(await sources.receiveHearingMediaResponse(status,bytes({error:{code}}),f.q),{error:{code}});
 await assert.rejects(sources.receiveHearingMediaResponse(403,bytes({error:{code:'ACCESS_DENIED',url:'https://media.example.test/'}}),f.q));
 await assert.rejects(sources.receiveHearingSourceResponse(403,bytes({error:{code:'ACCESS_DENIED'}}),f.q),/UNADMITTED/);
});
