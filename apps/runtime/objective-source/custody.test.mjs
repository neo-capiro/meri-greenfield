import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {sourceAdmissionDigest} from '../../../packages/runtime/objective-generation-custody.mjs';
import {createObjectiveSourceCustody} from './custody.mjs';
import {custodyFixture,id,NOW} from './test/custody-fixture.mjs';
const unavailable=/OBJECTIVE_SOURCE_UNAVAILABLE/;

test('synthetic CAS publication binds canonical accepted run and already-ISSUED facts; replay is immutable',async()=>{
 const f=custodyFixture(),owner=f.create(),first=await owner.publish({issued:f.issued});
 f.state.accepted.run.state='running';const replay=await owner.publish({issued:f.issued});
 assert.deepEqual(first,replay);assert.equal(f.state.calls.put,1);assert.equal(f.state.rows.size,1);
 const row=f.state.rows.get(f.selector.generationJobId);assert.equal(first.custodySha256,hash(row));assert.equal(row.binding.workerId,f.binding.workerId);
 assert.equal('runState' in row,false);assert.equal(JSON.stringify(row).includes('SYNTHETIC-PRIVATE-MATERIAL'),false);
});

test('disabled or incomplete composition makes no owner calls',async()=>{
 for(const options of [{enabled:false},{store:undefined},{issuanceStore:undefined},{acceptedRuns:undefined},{freshAuthority:undefined}]){
  const f=custodyFixture(),owner=f.create(options);assert.equal(owner.available(),false);await assert.rejects(owner.publish({issued:f.issued}),unavailable);
  assert.equal(Object.values(f.state.calls).reduce((a,b)=>a+b,0),0);assert.equal(f.state.nativeCalls,0);
 }
 assert.equal(createObjectiveSourceCustody().available(),false);
});

test('lost acknowledgement succeeds only after identical committed readback; unresolved claim is never retried',async()=>{
 const f=custodyFixture();f.state.putMode='ack-lost';await f.create().publish({issued:f.issued});assert.equal(f.state.calls.put,1);
 const g=custodyFixture(),owner=g.create();g.state.putMode='unknown';await assert.rejects(owner.publish({issued:g.issued}),unavailable);
 await assert.rejects(owner.publish({issued:g.issued}),unavailable);assert.equal(g.state.calls.put,1);
 // Even a broken synthetic store that later lies about ABSENT cannot trigger another write in this owner.
 g.state.unknown=false;await assert.rejects(owner.publish({issued:g.issued}),unavailable);assert.equal(g.state.calls.put,1);
});

test('source cannot be created from substituted caller binding, request, unissued metadata or malformed facts',async()=>{
 for(const mutate of [
  f=>{f.state.accepted.run.binding.workerId=id(99);},
  f=>{f.state.accepted.request.prompt='different accepted request';},
  f=>{f.state.issued.issuance.factsSha256='9'.repeat(64);},
  f=>{f.issued.runtime={proxyCredential:'SYNTHETIC-SECRET-REJECT'};},
  f=>{f.issued.issuance.materialRef='SYNTHETIC-SECRET-REJECT';},
 ]){const f=custodyFixture();mutate(f);await assert.rejects(f.create().publish({issued:f.issued}),unavailable);assert.equal(f.state.calls.put,0);}
 const f=custodyFixture();f.ports.issuanceStore.read=async()=>({state:'CLAIMED'});await assert.rejects(f.create().publish({issued:f.issued}),unavailable);assert.equal(f.state.calls.put,0);
});

test('global job collision refuses changing immutable admission or accepted source even through publication replay',async()=>{
 const f=custodyFixture(),owner=f.create();await owner.publish({issued:f.issued});
 const original=f.state.rows.get(f.selector.generationJobId);f.state.rows.set(f.selector.generationJobId,{...original,sourceAdmissionSha256:'8'.repeat(64)});
 await assert.rejects(owner.publish({issued:f.issued}),unavailable);assert.equal(f.state.calls.put,1);
 // A second internally valid source for the same job is also a conflict, not a rebind.
 const g=custodyFixture(),second=g.create();await second.publish({issued:g.issued});const changed=structuredClone(g.issued);
 changed.objectiveGeneration.sourceAdmission.canonical.canonicalProjectId=id(99);
 changed.objectiveGeneration.sourceAdmissionSha256=sourceAdmissionDigest(changed.objectiveGeneration.sourceAdmission);
 const {issuance:ignored,factsSha256:ignoredHash,...facts}=changed;changed.factsSha256=hash(facts);changed.issuance.factsSha256=changed.factsSha256;
 g.state.issued=structuredClone(changed);await assert.rejects(second.publish({issued:changed}),unavailable);assert.equal(g.state.calls.put,1);
});

test('active read needs real prepared-reader owner port and returns bounded nonsecret v2 projection',async()=>{
 const f=custodyFixture(),owner=f.create();await owner.publish({issued:f.issued});f.state.accepted.run.state='running';f.state.nativeCalls=0;
 const value=await owner.read({...f.selector,purpose:'active-source'});
 assert.equal(value.schemaVersion,2);assert.equal(value.runState,'running');assert.equal(value.queuedType,'appropriations');assert.equal(value.expiresAtMs,NOW+2000);
 assert.equal(value.issuance.factsSha256,f.issued.factsSha256);assert.equal(f.state.calls.prepared,1);assert.equal(f.state.nativeCalls,2);
 assert.equal(JSON.stringify(value).includes('SYNTHETIC-PRIVATE-MATERIAL'),false);assert.equal('acceptedRequest' in value,false);assert.equal('objectiveStrategy' in value,false);
 const missing=f.create({preparedReader:undefined});assert.equal(missing.available(),false);assert.equal(missing.available('historical-source'),true);
 await assert.rejects(missing.read({...f.selector,purpose:'active-source'}),unavailable);
});

test('historical read survives original expiry only with fresh native read authority, never executing prepared reader',async()=>{
 const f=custodyFixture(),owner=f.create();await owner.publish({issued:f.issued});f.state.accepted.run.state='completed';f.state.now=NOW+200000;f.state.nativeCalls=0;
 const value=await owner.read({...f.selector,purpose:'historical-source'});
 assert.equal(value.issuance.expiresAtMs,NOW+100000);assert.equal(value.checkedAtMs,NOW+200000);assert.equal(value.expiresAtMs,NOW+202000);assert.equal(value.runState,'completed');
 assert.equal(f.state.calls.prepared,0);assert.equal(f.state.nativeCalls,2);
 await assert.rejects(owner.read({...f.selector,purpose:'active-source'}),unavailable);assert.equal(f.state.nativeCalls,2);
});

test('historical cannot turn a current active run into terminal evidence or publish expired execution facts',async()=>{
 const f=custodyFixture(),owner=f.create();await owner.publish({issued:f.issued});
 await assert.rejects(owner.read({...f.selector,purpose:'historical-source'}),unavailable);
 f.state.now=NOW+200000;await assert.rejects(owner.publish({issued:f.issued}),unavailable);
});

test('current authority is required again for publication and read replays',async()=>{
 const f=custodyFixture(),owner=f.create();await owner.publish({issued:f.issued});f.state.nativeMode='revoked';
 await assert.rejects(owner.publish({issued:f.issued}),unavailable);await assert.rejects(owner.read({...f.selector,purpose:'active-source'}),unavailable);assert.equal(f.state.calls.put,1);
 const g=custodyFixture();g.state.nativeMode='revoke-second';await assert.rejects(g.create().publish({issued:g.issued}),unavailable);assert.equal(g.state.rows.size,1);
});

test('source, native, prepared proof or canonical run changes during reads fail closed',async()=>{
 for(const mutate of [
  f=>{f.state.accepted.request.prompt='changed after first source read';},
  f=>{f.state.accepted.run.state='failed';},
  f=>{f.state.issued.issuance.factsSha256='8'.repeat(64);},
  f=>{f.state.rows.delete(f.selector.generationJobId);},
 ]){
  const f=custodyFixture(),owner=f.create();await owner.publish({issued:f.issued});const normal=f.ports.preparedReader.read;
  // Constructor captures actual port method, so create the reader after replacing it.
  f.ports.preparedReader.read=async function(){const result=await normal();mutate(f);return result;};await assert.rejects(f.create().read({...f.selector,purpose:'active-source'}),unavailable);
 }
 const f=custodyFixture(),owner=f.create();await owner.publish({issued:f.issued});f.state.nativeCalls=0;f.state.nativeMode='revoke-second';await assert.rejects(owner.read({...f.selector,purpose:'active-source'}),unavailable);
});

test('closed selector rejects caller binding, wrong admission, extra fields and aborted signals',async()=>{
 const f=custodyFixture(),owner=f.create();await owner.publish({issued:f.issued});
 for(const input of [{...f.selector,purpose:'active-source',binding:f.binding},{...f.selector,purpose:'active-source',sourceAdmissionSha256:'8'.repeat(64)},{...f.selector,purpose:'retained-result'},
  {...f.selector,purpose:'active-source',signal:AbortSignal.abort()}])await assert.rejects(owner.read(input),unavailable);
});

test('fresh authority must bind exact native client/binding and a fresh unexpired check',async()=>{
 for(const amend of [v=>({...v,clientId:id(99)}),v=>({...v,binding:{...v.binding,writerFence:2}}),v=>({...v,checkedAtMs:NOW-1}),v=>({...v,checkedAtMs:NOW+1}),v=>({...v,expiresAtMs:NOW}),v=>({...v,extra:'SYNTHETIC-SECRET'})]){
  const f=custodyFixture(),normal=f.ports.freshAuthority.assertCurrent;f.ports.freshAuthority.assertCurrent=async function(v){return amend(await normal(v));};await assert.rejects(f.create().publish({issued:f.issued}),unavailable);assert.equal(f.state.calls.put,0);
 }
});

test('slow custody lookup cannot extend the original bounded current-read window',async()=>{
 const f=custodyFixture(),owner=f.create();await owner.publish({issued:f.issued});
 const original=f.ports.store.read;let once=true;f.ports.store.read=async function(v){if(once){f.state.now+=1000;once=false;}return original(v);};
 f.ports.freshAuthority.assertCurrent=async({source})=>({binding:source.binding,clientId:id(3),checkedAtMs:f.state.now,expiresAtMs:f.state.now+10000});
 const value=await f.create().read({...f.selector,purpose:'active-source'});assert.equal(value.expiresAtMs,NOW+3000);assert.equal(value.checkedAtMs,NOW+1000);
});

test('untrusted accessors and proxies are refused before source owner lookup',async()=>{
 for(const candidate of [new Proxy({},{}),Object.defineProperty({},'original',{enumerable:true,get(){throw Error('SYNTHETIC_GETTER_MUST_NOT_RUN');}})]){
  const f=custodyFixture();await assert.rejects(f.create().publish({issued:candidate}),unavailable);assert.equal(f.state.calls.run,0);assert.equal(f.state.nativeCalls,0);
 }
});

test('backward clock at any source phase refuses active, historical and publication operations',async()=>{
 for(const phase of ['store','issuance','native','prepared']){
  const f=custodyFixture(),owner=f.create();await owner.publish({issued:f.issued});
  if(phase==='store'){const original=f.ports.store.read;f.ports.store.read=async v=>{f.state.now-=1000;return original(v);};}
  if(phase==='issuance'){const original=f.ports.issuanceStore.read;f.ports.issuanceStore.read=async()=>{f.state.now-=1000;return original();};}
  if(phase==='native'){const original=f.ports.freshAuthority.assertCurrent;f.ports.freshAuthority.assertCurrent=async v=>{f.state.now-=1000;return original(v);};}
  if(phase==='prepared'){const original=f.ports.preparedReader.read;f.ports.preparedReader.read=async()=>{f.state.now-=1000;return original();};}
  await assert.rejects(f.create().read({...f.selector,purpose:'active-source'}),unavailable);
 }
 const g=custodyFixture(),owner=g.create();await owner.publish({issued:g.issued});g.state.now=NOW+200000;g.state.accepted.run.state='completed';
 const read=g.ports.store.read;g.ports.store.read=async v=>{g.state.now-=1000;return read(v);};await assert.rejects(g.create().read({...g.selector,purpose:'historical-source'}),unavailable);
 const h=custodyFixture(),accepted=h.ports.acceptedRuns.read;h.ports.acceptedRuns.read=async()=>{h.state.now-=1;return accepted();};await assert.rejects(h.create().publish({issued:h.issued}),unavailable);assert.equal(h.state.calls.put,0);
});

test('explicit malformed, unknown or conflicting CAS answers are denied even when later readback would match',async()=>{
 for(const amend of [()=>({state:'UNKNOWN'}),()=>({state:'ABSENT'}),()=>({state:'COMMITTED',record:{}}),
  result=>({...result,record:{...result.record,binding:{...result.record.binding,writerFence:2}}}),result=>({...result,extra:'SYNTHETIC-FORBIDDEN'})]){
  const f=custodyFixture(),normal=f.ports.store.putOnce;f.ports.store.putOnce=async v=>amend(await normal(v));
  await assert.rejects(f.create().publish({issued:f.issued}),unavailable);assert.equal(f.state.rows.size,1);assert.equal(f.state.calls.put,1);
  assert.equal(f.state.calls.read,1,'explicit invalid acknowledgement must not enter lost-ack readback recovery');
 }
 const f=custodyFixture(),normal=f.ports.store.putOnce;f.ports.store.putOnce=async v=>{await normal(v);throw Object.assign(Error('SYNTHETIC_KNOWN_CONFLICT'),{code:'OBJECTIVE_CUSTODY_CONFLICT'});};
 await assert.rejects(f.create().publish({issued:f.issued}),unavailable);assert.equal(f.state.calls.read,1);
});

test('closed active proof caps the outer expiry and raw facts have no compatibility fallback',async()=>{
 const f=custodyFixture(),owner=f.create();await owner.publish({issued:f.issued});
 f.ports.preparedReader.read=async()=>({issued:structuredClone(f.state.issued),checkedAtMs:NOW,expiresAtMs:NOW+1});
 assert.equal((await f.create().read({...f.selector,purpose:'active-source'})).expiresAtMs,NOW+1);
 for(const result of [f.issued,{issued:f.issued,checkedAtMs:NOW-1,expiresAtMs:NOW+1},{issued:f.issued,checkedAtMs:NOW+1,expiresAtMs:NOW+100},
  {issued:f.issued,checkedAtMs:NOW,expiresAtMs:NOW},{issued:f.issued,checkedAtMs:NOW,expiresAtMs:NOW+1,extra:'SYNTHETIC-FORBIDDEN'}]){
  f.ports.preparedReader.read=async()=>result;await assert.rejects(f.create().read({...f.selector,purpose:'active-source'}),unavailable);
 }
});
