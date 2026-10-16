/** SYNTHETIC real store/journal/public semantic validators; in-memory SQL protocol, no provider/Temporal/network or DB engine. */
import test from 'node:test';import assert from 'node:assert/strict';
import {initialInputFixture} from './initial-input-fixture.mjs';
import {id,binding} from './store-fixture.mjs';
import {hash} from '../boundary.mjs';
import {prepareOriginalInputFacts,originalInputReceipt} from '../initial-input-facts.mjs';
const check=()=>{};
test('new acknowledgement allocates exactly one immutable identity without a run, event or dispatch',async()=>{
 const f=initialInputFixture(),p=await f.proposal(),out=await f.store().initialInputs.claim(p.facts,check);
 assert.equal(out.created,true);assert.equal(out.state,'RESERVED');assert.equal(out.allocation.inputSha256,hash(p.input));assert.equal(Object.hasOwn(out.allocation,'requestSha256'),false);
 assert.equal(f.allocations.size,1);assert.equal(f.state.runs.size,0);assert.equal(f.state.events.size,0);assert.equal(JSON.stringify([...f.allocations.values()]).includes(p.input.prompt),false);
});
test('concurrent exact claims have one new acknowledgement; reconstruction and later lease proposals never refresh it',async()=>{
 const f=initialInputFixture(),p=await f.proposal(),store=f.store();const results=await Promise.all([store.initialInputs.claim(p.facts,check),store.initialInputs.claim(p.facts,check)]);
 assert.equal(results.filter(r=>r.created).length,1);f.advance(10);const proposed={...p.facts,allocatedAtMs:f.now(),expiresAtMs:p.facts.expiresAtMs+10000};
 const replay=await f.store().initialInputs.claim(proposed,check);assert.equal(replay.created,false);assert.equal(replay.allocation.allocatedAtMs,p.facts.allocatedAtMs);assert.equal(replay.allocation.expiresAtMs,p.facts.expiresAtMs);
});
test('concurrent different intents cannot overwrite the winner',async()=>{
 const f=initialInputFixture(),a=await f.proposal(),b=await f.proposal({input:{requestId:id(62),prompt:'Other prompt'}});
 const results=await Promise.allSettled([f.store().initialInputs.claim(a.facts,check),f.store().initialInputs.claim(b.facts,check)]);
 assert.equal(results.filter(r=>r.status==='fulfilled'&&r.value.created).length,1);assert.equal(results.filter(r=>r.status==='rejected'&&r.reason.code==='INITIAL_INPUT_CONFLICT').length,1);assert.equal(f.allocations.size,1);
});
test('lost allocation COMMIT acknowledgement yields UNKNOWN, and its recovered identity is never new',async()=>{
 const f=initialInputFixture(),p=await f.proposal();f.state.commitUnknown=true;await assert.rejects(f.store().initialInputs.claim(p.facts,check),/STORE_COMMIT_UNKNOWN/);
 assert.equal(f.allocations.size,1);f.state.commitUnknown=false;const out=await f.store().initialInputs.claim(p.facts,check);assert.equal(out.created,false);assert.equal(out.state,'RESERVED');assert.equal(f.state.runs.size,0);
});
test('no allocation cannot be interpreted as acceptance permission',async()=>{
 const f=initialInputFixture(),p=await f.proposal();await assert.rejects(f.store().initialInputs.accept(p.acceptance,check),/INITIAL_INPUT_REQUIRED/);assert.equal(f.state.conversations.size,0);assert.equal(f.state.runs.size,0);
});
test('acceptance atomically matches the allocation and preserves the original prompt/context on exact replay',async()=>{
 const f=initialInputFixture(),p=await f.proposal(),store=f.store();await store.initialInputs.claim(p.facts,check);
 const first=await store.initialInputs.accept(p.acceptance,check),again=await f.store().initialInputs.accept(p.acceptance,check);
 assert.equal(first.replayed,false);assert.equal(again.replayed,true);assert.deepEqual(again.request,p.acceptance.request);assert.deepEqual(again.run.scopes,p.acceptance.run.scopes);
 assert.equal(f.state.runs.size,1);assert.equal([...f.state.events.values()].flat().length,1);assert.equal(f.allocations.get(f.key()).state,'ACCEPTED');
 const receipt=await f.store().initialInputs.claim(p.facts,check);assert.equal(receipt.created,false);assert.equal(receipt.state,'ACCEPTED');
});
for(const changed of ['requestId','prompt','window','windowRequest','skill'])test(`acceptance refuses altered ${changed} before any run/event can be committed`,async()=>{
 const f=initialInputFixture(),p=await f.proposal();await f.store().initialInputs.claim(p.facts,check);const changedInput=structuredClone(p.acceptance);
 changedInput.request[changed]=changed==='requestId'?id(70):changed==='prompt'?'Changed':{unexpected:'changed'};
 await assert.rejects(f.store().initialInputs.accept(changedInput,check),/INITIAL_INPUT_CONFLICT/);assert.equal(f.state.runs.size,0);assert.equal(f.state.events.size,0);assert.equal(f.allocations.get(f.key()).state,'RESERVED');
});
for(const change of ['actor','run','attempt','worker','fence','scope','client','versions','rawIntent','preparedRequest'])test(`a different ${change} cannot recover or accept another original identity`,async()=>{
 const f=initialInputFixture(),p=await f.proposal();await f.store().initialInputs.claim(p.facts,check);const candidate=structuredClone(p.facts);
 if(change==='actor')candidate.binding.actorId='other';if(change==='run')candidate.binding.runId=id(80);if(change==='attempt')candidate.binding.attemptId=id(81);if(change==='worker')candidate.binding.workerId=id(82);if(change==='fence')candidate.binding.writerFence=2;
 if(change==='scope')candidate.scopes[0].policyRevision='changed';if(change==='client'){candidate.selectedClientId=id(83);candidate.scopes[0].resourceId=id(83);}if(change==='versions')candidate.versions.skillsDigest='c'.repeat(64);
 if(change==='rawIntent')candidate.inputSha256='c'.repeat(64);if(change==='preparedRequest')candidate.requestSha256='c'.repeat(64);
 await assert.rejects(f.store().initialInputs.claim(candidate,check),/INITIAL_INPUT_(CONFLICT|REFUSED)/);assert.equal(f.allocations.size,1);assert.equal(f.state.runs.size,0);
});
test('expired original identity cannot be renewed or accepted',async()=>{
 const f=initialInputFixture(),p=await f.proposal();await f.store().initialInputs.claim(p.facts,check);f.advance(30000);
 await assert.rejects(f.store().initialInputs.claim({...p.facts,allocatedAtMs:f.now(),expiresAtMs:f.now()+30000},check),/INITIAL_INPUT_EXPIRED/);
 await assert.rejects(f.store().initialInputs.accept(p.acceptance,check),/INITIAL_INPUT_EXPIRED/);assert.equal(f.state.runs.size,0);assert.equal(f.allocations.get(f.key()).allocation.expiresAtMs,p.facts.expiresAtMs);
});
test('failure after marking acceptance rolls back the allocation, run and event together',async()=>{
 const f=initialInputFixture(),p=await f.proposal();await f.store().initialInputs.claim(p.facts,check);f.faults.afterAccept=true;
 await assert.rejects(f.store().initialInputs.accept(p.acceptance,check));assert.equal(f.allocations.get(f.key()).state,'RESERVED');assert.equal(f.state.runs.size,0);assert.equal(f.state.conversations.size,0);assert.equal(f.state.events.size,0);
});
test('authority check invalidated during acceptance refuses release and rolls back all three records',async()=>{
 const f=initialInputFixture(),p=await f.proposal();await f.store().initialInputs.claim(p.facts,check);let revoked=false;f.faults.onAccept=()=>{revoked=true;};
 await assert.rejects(f.store().initialInputs.accept(p.acceptance,()=>{if(revoked)throw Error('SYNTHETIC_AUTHORITY_REVOKED');}),/STORE_UNAVAILABLE/);
 assert.equal(f.state.runs.size,0);assert.equal(f.state.events.size,0);assert.equal(f.allocations.get(f.key()).state,'RESERVED');
});
test('lost acceptance ACK reconstructs the same accepted input without a duplicate event',async()=>{
 const f=initialInputFixture(),p=await f.proposal();await f.store().initialInputs.claim(p.facts,check);f.state.commitUnknown=true;
 await assert.rejects(f.store().initialInputs.accept(p.acceptance,check),/STORE_COMMIT_UNKNOWN/);assert.equal(f.allocations.get(f.key()).state,'ACCEPTED');f.state.commitUnknown=false;
 assert.equal((await f.store().initialInputs.accept(p.acceptance,check)).replayed,true);assert.equal(f.state.runs.size,1);assert.equal([...f.state.events.values()].flat().length,1);
});
test('corrupt or inconsistent stored state never becomes fresh allocation evidence',async()=>{
 const f=initialInputFixture(),p=await f.proposal();await f.store().initialInputs.claim(p.facts,check);const row=f.allocations.get(f.key());row.allocation_sha256='0'.repeat(64);
 await assert.rejects(f.store().initialInputs.claim(p.facts,check),/INITIAL_INPUT_CORRUPT/);row.allocation_sha256=hash(row.allocation);row.state='ACCEPTED';row.accepted_request_sha256=p.facts.requestSha256;
 await assert.rejects(f.store().initialInputs.claim(p.facts,check),/INITIAL_INPUT_CORRUPT/);assert.throws(()=>originalInputReceipt(p.facts,'ACCEPTED',true),/INITIAL_INPUT_CORRUPT/);
});
test('any existing original input, conversation shell or successor journal refuses a new original claim',async()=>{
 for(const occupied of ['run','conversation','next']){const f=initialInputFixture(),p=await f.proposal();
  if(occupied==='run')await f.store().accept(p.acceptance,check);if(occupied==='conversation')f.state.conversations.set(f.key(),{});if(occupied==='next')f.state.nextRuns.set(f.key(),{tenant_id:binding.tenantId,conversation_id:binding.conversationId});
  await assert.rejects(f.store().initialInputs.claim(p.facts,check),/INITIAL_INPUT_ALREADY_EXISTS/);assert.equal(f.allocations.size,0);
 }
});
test('canonical public input/request correlation refuses an altered prepared prompt before store IO',async()=>{
 const f=initialInputFixture(),p=await f.proposal();await assert.rejects(prepareOriginalInputFacts({...p.facts,input:p.input,request:{...p.acceptance.request,prompt:'Changed'}}));assert.equal(f.allocations.size,0);assert.equal(f.state.calls.length,0);
});
for(const phase of ['claim','accept'])test(`expiry during ${phase} COMMIT cannot release a positive acknowledgement`,async()=>{
 const f=initialInputFixture(),p=await f.proposal();if(phase==='accept')await f.store().initialInputs.claim(p.facts,check);f.faults.onCommit=()=>f.advance(30000);
 await assert.rejects(phase==='claim'?f.store().initialInputs.claim(p.facts,check):f.store().initialInputs.accept(p.acceptance,check),/STORE_COMMIT_UNKNOWN/);
 assert.equal(f.allocations.size,1);assert.equal(f.allocations.get(f.key()).state,phase==='claim'?'RESERVED':'ACCEPTED');
});
test('global request identity collision cannot create another tenant/conversation slot',async()=>{
 const f=initialInputFixture(),p=await f.proposal();await f.store().initialInputs.claim(p.facts,check);
 const other=await f.proposal({context:{binding:{...binding,tenantId:'tenant-other',conversationId:id(90)},scopes:[{...p.facts.scopes[0],tenantId:'tenant-other'}]}});
 await assert.rejects(f.store().initialInputs.claim(other.facts,check),/INITIAL_INPUT_CONFLICT/);assert.equal(f.allocations.size,1);assert.equal(f.state.runs.size,0);
});
test('original normalized calendar window is retained, never recomputed at acceptance or replay',async()=>{
 const f=initialInputFixture(),p=await f.proposal({input:{requestId:id(60),prompt:'Original dated prompt',windowRequest:{basis:'calendar-week',offset:-1,timezone:'America/New_York',weekStartsOn:'monday'}}});
 await f.store().initialInputs.claim(p.facts,check);f.advance(1000);const saved=await f.store().initialInputs.accept(p.acceptance,check);
 assert.deepEqual(saved.request,p.acceptance.request);assert.equal(hash(saved.request),p.facts.requestSha256);const retry=await f.store().initialInputs.accept(p.acceptance,check);assert.deepEqual(retry.request.window,saved.request.window);
});
test('current selected client must match the original allocation even if the run scope array is unchanged',async()=>{
 const f=initialInputFixture(),p=await f.proposal();await f.store().initialInputs.claim(p.facts,check);
 await assert.rejects(f.store().initialInputs.accept({...p.acceptance,selectedClientId:id(99)},check),/INITIAL_INPUT_CONFLICT/);assert.equal(f.state.runs.size,0);assert.equal(f.state.events.size,0);
});
