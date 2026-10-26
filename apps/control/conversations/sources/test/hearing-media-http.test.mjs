import test from 'node:test';import assert from 'node:assert/strict';
import {fixture} from './http-fixture.mjs';import {mediaResult} from './hearing-media-fixture.mjs';
import {id} from '../../test/store-fixture.mjs';
const schemaVersion='meri.hearing-media-read/1';
async function mediaFixture(options={}){
 const f=await fixture({hearing:true,media:true,runtimeMount:true,...options});
 f.request={...f.request,schemaVersion,playback:null};f.state.result=mediaResult(f.p.event);
 const read=f.read;f.read=(request=f.request)=>read(request);return f;
}
test('current router releases manifest and selected playback only against the saved hearing binding',async()=>{
 for(const view of ['published','briefs','reconciliation'])for(const playback of [null,{epochId:'epoch',positionMs:1500}]){
  const f=await mediaFixture({view});f.request.playback=playback;f.state.result=mediaResult(f.p.event,playback);
  const response=await f.read();assert.equal(response.status,200,await response.clone().text());
  assert.deepEqual((await response.json()).current,{source:f.state.result.source,media:f.state.result.media});
  assert.deepEqual(f.state.body,{schemaVersion:'capiro.hearing-media-read/1',selection:f.p.event.data.selection,source:{recordId:f.p.event.data.source.recordId,contentHash:f.p.event.data.source.provenance.contentHash},playback});
  assert.equal(f.state.currentness,2);assert.equal(f.state.membership,1);assert.equal(f.state.retentionChecks,2);assert.equal(response.headers.get('cache-control'),'no-store');
  assert.doesNotMatch(JSON.stringify(f.p.event),/media\.example|epoch|partId/);
 }
});
test('foreign identity, client loss, suppressed history and forged media selectors deny before Core',async()=>{
 for(const mutate of [f=>f.state.principal.tenantId=id(90),f=>f.state.principal.actorId=id(90),f=>f.state.principal.clientIds=[],f=>f.state.suppressed=true,f=>f.state.currentDenied=true,f=>f.request.referenceId=id(90),f=>f.request.playback={epochId:'epoch',positionMs:1500,url:'https://forged.example.test'}]){
  const f=await mediaFixture();mutate(f);assert.notEqual((await f.read()).status,200);assert.equal(f.state.sourceCalls,0);
 }
 const bill=await fixture();assert.equal((await bill.read({...bill.request,schemaVersion,playback:null})).status,404);assert.equal(bill.state.sourceCalls,0);
});
test('stale, denied, substituted and unsafe owner responses never release a media URL',async()=>{
 for(const status of [401,403,409,503]){const f=await mediaFixture();f.state.sourceStatus=status;const response=await f.read();assert.equal(response.status,status);assert.doesNotMatch(await response.text(),/media\.example|epochs|contentHash/);}
 for(const mutate of [r=>r.source.contentHash='b'.repeat(64),r=>r.source.hearingId='other',r=>r.media.manifest.hearingId='other',r=>r.media.manifest.epochs[0].durableEndMs=0,r=>r.schemaVersion='other']){
  const f=await mediaFixture();mutate(f.state.result);const response=await f.read();assert.notEqual(response.status,200);assert.doesNotMatch(await response.text(),/media\.example|epochs|contentHash/);
 }
 const f=await mediaFixture();f.request.playback={epochId:'epoch',positionMs:1500};f.state.result=mediaResult(f.p.event,f.request.playback);f.state.result.media.playback.url='javascript:alert(1)';assert.notEqual((await f.read()).status,200);
});
test('revocation or suppression during media read prevents final publication',async()=>{
 for(const key of ['membershipDenied','finalDenied','suppressed']){const f=await mediaFixture();f.state.afterRead=()=>{f.state[key]=true;};const response=await f.read();assert.notEqual(response.status,200);assert.equal(f.state.sourceCalls,1);assert.doesNotMatch(await response.text(),/media\.example|epochs|contentHash/);}
});
