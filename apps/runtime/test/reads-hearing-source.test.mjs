import test from 'node:test';import assert from 'node:assert/strict';
import {fixture} from './reads-native-fixture.mjs';
import {storedCase} from '../../gateway/sources/public-domain-hearings/test/fixture.mjs';
import {hearingProof} from '../../control/conversations/sources/test/hearing-fixture.mjs';
import {releaseHearingPage,savedHearingRequest} from '../../control/conversations/sources/hearing-record.mjs';
import {assertNativeSourceEvent} from '../../../packages/contracts/conversation-sources/validate.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
test('actual reads composer captures producer-shaped exact hearing output before native release',async()=>{
 for(const options of [{},{large:true,part:1}]){const proof=hearingProof(options),events=[],scene=storedCase(undefined,{request:proof.request.arguments,page:proof.result});
  const conversationStore={async appendSource(binding,event,check,scopes){check();events.push({...event,binding,scopes,contractVersion:'0.1.0',sequence:1,createdAt:'2026-10-26T05:00:00.000Z'});}};
  const f=await fixture('public-domain-hearings','search_committee_hearings',{scene,conversationStore}),response=await f.execute();assert.equal(response.status,200,await response.clone().text());const wire=await response.json();assert.equal(events.length,1);const event=assertNativeSourceEvent(events[0]);assert.equal(event.data.resultSha256,wire.resultSha256);assert.equal(event.data.requestSha256,wire.inputSha256);assert.equal(savedHearingRequest(event).cursor,proof.request.arguments.cursor??null);assert.deepEqual(releaseHearingPage(event,proof.result).result,proof.result);
 }
});
test('actual Core denial or revoked execution never publishes a hearing reference',async()=>{
 for(const revoke of [false,true]){const p=hearingProof(),events=[],scene=storedCase(undefined,{request:p.request.arguments,page:p.result}),f=await fixture('public-domain-hearings','search_committee_hearings',{scene,conversationStore:{async appendSource(...args){events.push(args);}}});
  if(revoke)scene.state.afterSource=f.revoke;else f.deny();const r=await f.execute();assert.notEqual(r.status,200);assert.equal(events.length,0);assert.doesNotMatch(await r.text(),/Synthetic public record/);
 }
});
test('existing native canonical-hash boundary refuses a Core fragment splitting a surrogate before capture',async()=>{
 const proof=hearingProof({large:true,part:1,text:'x',wireOnly:true});assert.equal(proof.result.records[0].payload.text.isWellFormed(),false);
 assert.throws(()=>canonicalSha256(proof.result),/Lone surrogate/);
 const events=[],scene=storedCase(undefined,{request:proof.request.arguments,page:proof.result}),f=await fixture('public-domain-hearings','search_committee_hearings',{scene,conversationStore:{async appendSource(...args){events.push(args);}}});
 const response=await f.execute();assert.notEqual(response.status,200);assert.equal(events.length,0);assert.doesNotMatch(await response.text(),/hearing_evidence_json_chunk|Synthetic public/);
});
