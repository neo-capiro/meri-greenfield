/** Real conversation owner and persisted request protocol; no model call or product-target fixture. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {applicationFixture,binding,id} from './application-fixture.mjs';
const procedure={source:'firm',recordId:id(700),version:2,manifestDigest:'a'.repeat(64)};
test('allocation pins complete procedure identity before submission and execution reads the persisted selector',async()=>{
 const f=await applicationFixture({initialInput:true});try{
  const input={...f.input,procedure};const allocation=await f.service.allocateInput({credential:f.credential,input});
  await f.service.submit({credential:f.credential,input});assert.equal(f.state.starts,1);
  const saved=await f.store.findRequest(binding,input.requestId,()=>{});assert.deepEqual(saved.request.procedure,procedure);
  const repeated=await f.service.allocateInput({credential:f.credential,input});assert.deepEqual(repeated.allocation,allocation.allocation);
  const loaded=await f.service.loadForExecution({credential:f.credential,binding});assert.deepEqual(loaded.request.procedure,procedure);
  assert.equal(Object.hasOwn(loaded.request.procedure,'allowedTools'),false);
  for(const changed of [{...input,procedure:{...procedure,version:3}},{...input,procedure:{...procedure,manifestDigest:'b'.repeat(64)}},f.input])
   await assert.rejects(f.service.submit({credential:f.credential,input:changed}));
  assert.equal(f.state.starts,1,'changed or removed selection cannot dispatch');
 }finally{f.close();}
});
test('invalid or skill-conflicting selection is refused before allocation and dispatch',async()=>{
 const f=await applicationFixture({initialInput:true});try{
  for(const input of [{...f.input,procedure:{...procedure,allowedTools:['*']}},{...f.input,procedure:null},{...f.input,procedure,skill:{skillId:'quick_skill.bill_watch',skillVersion:'1.1.0'}}])
   await assert.rejects(f.service.allocateInput({credential:f.credential,input}),{code:'INVALID_REQUEST'});
  assert.equal(f.state.starts,0);assert.equal(await f.store.findRequest(binding,f.input.requestId,()=>{}),null);
 }finally{f.close();}
});
test('current account revocation prevents dispatch of an already allocated exact procedure',async()=>{
 const f=await applicationFixture({initialInput:true});try{
  const input={...f.input,procedure};await f.service.allocateInput({credential:f.credential,input});f.state.revoked=true;
  await assert.rejects(f.service.submit({credential:f.credential,input}));assert.equal(f.state.starts,0);
 }finally{f.close();}
});
