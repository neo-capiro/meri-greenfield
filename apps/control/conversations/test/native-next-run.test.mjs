import {contentRows} from './retention-content-fixture.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {nativeFixture,binding,scopes,id,check,rowKey} from './native-next-run-fixture.mjs';
import {hash} from '../boundary.mjs';
import {createNextRunOwner} from '../next-run.mjs';
import {versions} from './lifecycle-fixture.mjs';
import {decodeConversationInventoryRows} from '../retention-inventory-decode.mjs';
const request=b=>({principal:{tenantId:b.tenantId,actorId:b.actorId},conversationId:b.conversationId,sourceRunId:b.runId});
test('settled native source with 22 entries admits exactly one successor and preserves exact main/substream data',async()=>{
 const x=await nativeFixture();try{await x.complete();const owner=createNextRunOwner({store:x.f.store,versions});
  assert.deepEqual(await owner.assessNextTurn(request(binding)),{admissible:true,reason:null});assert.equal(x.f.state.nextRuns.size,0);
  const [a,b]=await Promise.all([x.owner.admitTurn(request(binding)),x.owner.admitTurn(request(binding))]);assert.deepEqual(a.targetBinding,b.targetBinding);assert.equal(x.f.state.nextRuns.size,1);
  await x.accept(a.targetBinding);const saved=await x.lineage(a.targetBinding);assert.deepEqual(saved.nextTurn.sdkSession.binding,binding);assert.equal(saved.nextTurn.sdkSession.entriesCount,22);assert.equal('checkpoint' in saved.nextTurn,false);
  const snapshot=await x.snapshot(a.targetBinding);assert.deepEqual(snapshot.transcripts,x.transcripts);assert.deepEqual(snapshot.key,x.sessionKey);assert.equal(x.f.state.completions.size,0);
 }finally{x.f.close();}
});
test('third turn resumes the second completed native session, including both exact prompt histories',async()=>{
 const x=await nativeFixture();try{const second=await x.second();await x.allocate(second);const parts=structuredClone(x.transcripts);parts[0].entries.push({type:'user',uuid:id(1300),message:{role:'user',content:'Second prompt retained exactly'}});await x.complete(second,parts);
  const third=(await x.select()).binding;await x.accept(third,'third prompt');assert.deepEqual((await x.lineage(third)).nextTurn.sdkSession.binding,second);assert.deepEqual((await x.snapshot(third)).transcripts,parts);assert.equal(x.f.state.completions.size,0);
 }finally{x.f.close();}
});
for(const state of ['failed','cancelled'])test(`${state} successor discards its partial session and resumes the older completed native donor`,async()=>{
 const x=await nativeFixture();try{const second=await x.second();await x.allocate(second);await x.running(second);x.seed(second,[{entries:[{type:'user',text:'partial failed turn must not become completed history'}]}]);await x.f.store.append(second,x.status(state,state==='failed'?'synthetic-failure':null),check);await x.settle(second);
  const third=(await x.select()).binding;await x.accept(third);assert.deepEqual((await x.lineage(third)).nextTurn.sdkSession.binding,binding);assert.deepEqual((await x.snapshot(third)).transcripts,x.transcripts);
 }finally{x.f.close();}
});
for(const [name,mutate] of Object.entries({
 'missing session':x=>x.f.state.sdkSessions.clear(),
 'owner digest':x=>x.f.state.sdkSessions.get(rowKey(binding)).owner_sha256='f'.repeat(64),
 'foreign actor':x=>{const r=x.f.state.sdkSessions.get(rowKey(binding));r.owner.binding={...binding,actorId:'foreign'};r.owner_sha256=hash(r.owner);},
 'foreign selected client':x=>{const r=x.f.state.sdkSessions.get(rowKey(binding));r.owner.selectedClientId=id(999);r.owner_sha256=hash(r.owner);},
 'changed source key':x=>{const r=x.f.state.sdkSessions.get(rowKey(binding));r.owner.key.sessionId=id(999);r.owner_sha256=hash(r.owner);r.session_id=id(999);},
 'count mismatch':x=>x.f.state.sdkSessions.get(rowKey(binding)).entries_count++,
 'byte mismatch':x=>x.f.state.sdkSessions.get(rowKey(binding)).bytes++,
 'missing main stream':x=>{x.f.state.sdkStreams=x.f.state.sdkStreams.filter(s=>s.subpath);},
 'empty main stream':x=>{x.f.state.sdkStreams.find(s=>s.subpath==='').last_sequence=0;},
 'duplicate stream':x=>x.f.state.sdkStreams.push(structuredClone(x.f.state.sdkStreams[0])),
 'sequence gap':x=>x.f.state.sdkEntries[0].sequence=2,
 'entry hash':x=>x.f.state.sdkEntries[0].entry_sha256='f'.repeat(64),
 'stream count':x=>x.f.state.sdkStreams[0].last_sequence++,
 'settlement removed':x=>{const r=x.f.state.executions.get(rowKey(binding));r.record.phase='unknown';r.record.native=null;r.record_sha256=hash(r.record);},
}))test(`native snapshot refuses ${name}, without returning empty/fresh history`,async()=>{const x=await nativeFixture();try{const target=await x.second();mutate(x);await assert.rejects(x.snapshot(target));}finally{x.f.close();}});
test('foreign target, selected client, stale source and incompatible SDK cannot obtain native lineage',async()=>{
 const x=await nativeFixture();try{const target=await x.second();await assert.rejects(x.f.store.nextRuns.sessionSnapshot({binding:target,scopes,selectedClientId:id(999)},check));await assert.rejects(x.snapshot({...target,actorId:'foreign'}));
  await assert.rejects(x.owner.admitTurn({...request(binding),principal:{tenantId:binding.tenantId,actorId:'foreign'}}));
  const y=await nativeFixture();try{await y.complete();y.deploy({...versions,sdk:'0.3.294'});await assert.rejects(y.select(),/NEXT_TURN_SDK_CHANGED/);}finally{y.f.close();}
 }finally{x.f.close();}
});
test('Stop stays fenced; cancelled snapshot and terminal target never release history',async()=>{
 const x=await nativeFixture();try{const target=await x.second(),abort=new AbortController();abort.abort();await assert.rejects(x.f.store.nextRuns.sessionSnapshot({binding:target,scopes,selectedClientId:id(5)},()=>{if(abort.signal.aborted)throw Error('cancelled');}));
  await x.f.store.append(target,x.status('cancelled'),check);await assert.rejects(x.snapshot(target));
 }finally{x.f.close();}
});
test('lost reservation acknowledgement retains one exact immutable mapping and refuses changed native facts',async()=>{
 const x=await nativeFixture();try{await x.complete();x.f.faults.onCommit=()=>{if(x.f.state.nextRuns.size){x.f.faults.onCommit=null;throw Error('lost reservation COMMIT acknowledgement');}};await assert.rejects(x.owner.admitTurn(request(binding)));assert.equal(x.f.state.nextRuns.size,1,'the unknown acknowledgement followed the durable reservation');
  const target=(await x.owner.admitTurn(request(binding))).targetBinding;assert.equal(x.f.state.nextRuns.size,1);assert.deepEqual((await x.owner.admitTurn(request(binding))).targetBinding,target);
  const r=[...x.f.state.nextRuns.values()][0].reservation;await assert.rejects(x.f.store.nextRuns.reserve({...r,facts:{...r.facts,sdkSession:{...r.facts.sdkSession,entriesCount:23}}},check));
 }finally{x.f.close();}
});
test('native snapshot preserves deep opaque SDK fields and more than the ordinary 2MiB result limit',async()=>{
 const x=await nativeFixture();try{const parts=structuredClone(x.transcripts),deep={};let at=deep;for(let n=0;n<100;n++){at.next={};at=at.next;}at.value='exact SDK data';parts[0].entries[0].future=deep;parts[0].entries[0].large='s'.repeat(2097152);
  await x.complete(binding,parts);const target=(await x.select()).binding;await x.accept(target);assert.deepEqual((await x.snapshot(target)).transcripts,parts);
 }finally{x.f.close();}
});
test('retention inventory accepts actual native successor rows and rejects forged predecessor lineage',async()=>{
 const x=await nativeFixture();try{await x.second();const s=x.f.state,raw={subject:{tenantId:binding.tenantId,kind:'conversation',subjectId:binding.conversationId,ownerActorId:binding.actorId},conversation:[...s.conversations.values()][0],runs:[...s.runs.values()],events:[...s.events.values()].flat().map(e=>({...e,tenant_id:e.event.binding.tenantId,conversation_id:e.event.binding.conversationId,run_id:e.event.binding.runId})),controls:[],checkpoints:[],completionCheckpoints:[],nextRuns:[...s.nextRuns.values()],memoryContinuations:[],memoryContextRows:[],contentRows:contentRows(s,binding)};
  const inventory=decodeConversationInventoryRows(raw);assert.equal(inventory.nextRuns.length,1);assert.equal(inventory.completionCheckpoints.length,0);
  for(const field of ['actorId','tenantId','runId','writerFence']){const changed=structuredClone(raw),r=changed.nextRuns[0];r.reservation.facts.sdkSession.binding[field]=field==='writerFence'?2:field==='runId'?id(999):'foreign';r.reservation_sha256=hash(r.reservation);assert.throws(()=>decodeConversationInventoryRows(changed),/STORE_CORRUPT/);}
 }finally{x.f.close();}
});
