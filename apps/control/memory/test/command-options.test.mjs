import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeMemoryFixture} from '../../intents/test/native-memory-fixture.mjs';
for(const general of [false,true])test(`invalid memory request in ${general?'General':'client'} writes neither metadata nor candidate`,async()=>{
 for(const args of [{content:' '},{content:'x'.repeat(4001)},{content:'Preference',scope:'global'},{content:'Preference',unexpected:true},{content:'Preference',clientId:null}]){
  const f=nativeMemoryFixture({general});
  await assert.rejects(f.port.prepare({...f.call,arguments:args}));
  assert.equal(f.metadata.rows.size,0);assert.equal(f.journal.rows.size,0);assert.equal(f.core.calls.length,0);
 }
});
test('General rejects missing client destination and firm proposals without Core permission',async()=>{
 for(const scope of ['client','firm']){
  const f=nativeMemoryFixture({general:true});await assert.rejects(f.port.prepare({...f.call,arguments:{content:'Preference',scope}}));
  assert.equal(f.metadata.rows.size,0);assert.equal(f.journal.rows.size,0);
 }
});
test('normalization is visible in immutable proposal before any submission',async()=>{
 const f=nativeMemoryFixture({general:true});
 const r=await f.port.prepare({...f.call,arguments:{content:'  Remember this  ',key:'  preference  ',scope:'user_private',ttlDays:400}});
 assert.deepEqual(r.proposal.command.arguments,{content:'Remember this',key:'preference',scope:'personal',clientId:null,ttlDays:365});
 assert.deepEqual(r.proposal.requiredApprover,{tenantId:f.binding.tenantId,actorId:f.binding.actorId});
 assert.equal(f.core.calls.length,0);assert.equal(f.journal.rows.size,0);
});