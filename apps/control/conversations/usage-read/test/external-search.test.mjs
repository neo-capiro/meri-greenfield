/** Writer/reader compatibility over real accounting/persistence owners and scripted SQL; no provider or database call. */
import test from 'node:test';import assert from 'node:assert/strict';
import {fixture,payload,binding,request,check} from './fixture.mjs';
import {projectRecordedUsage} from '../projection.mjs';
import {createPostgresConversationStore} from '../../postgres-store.mjs';
import {hash} from '../../boundary.mjs';
const facts=(outcome='completed')=>({provider:'managed-search-synthetic',attempts:1,estimateMicroUsd:7005,billedMicroUsd:null,outcome,
 calls:[{provider:'managed-search-synthetic',attempts:1,estimateMicroUsd:7005,billedMicroUsd:null,outcome}],truncated:false});
const unobserved={provider:null,attempts:0,estimateMicroUsd:0,billedMicroUsd:null,outcome:'unknown',calls:[],truncated:false,incomplete:true,unobserved:['synthetic-lost']};

test('persisted search facts are validated without changing the public SDK usage or private record',async()=>{
 for(const unavailable of [false,true]){
  const plain=await fixture({input:payload({unavailable})}),expected=projectRecordedUsage(await plain.store.readUsage(binding,check),request);
  for(const externalSearch of [facts(),facts('failed'),facts('unknown'),{...facts(),truncated:true,incomplete:true,unobserved:['synthetic-missing']},unobserved]){
   const input={...payload({unavailable}),externalSearch},f=await fixture({input}),before=structuredClone(f.row());
   const reconstructed=createPostgresConversationStore({pool:f.pool}),saved=await reconstructed.readUsage(binding,check),sqlStart=f.state.calls.length;
   assert.deepEqual(saved.externalSearch,externalSearch);assert.equal(saved.inputSha256,hash(input));
   const projected=projectRecordedUsage(saved,request);
   assert.deepEqual(projected,expected,'private search facts must not alter the public SDK estimate or fabricate a bill');
   assert.equal(projected.usage.providerBilledUsd,null);
   assert.doesNotMatch(JSON.stringify(projected),/externalSearch|managed-search-synthetic|synthetic-lost|synthetic-missing|billedMicroUsd/);
   assert.deepEqual(f.row(),before);assert.equal(f.state.calls.length,sqlStart,'projection has no storage effects');
   const replay=await reconstructed.recordUsage({binding,scopes:f.scopes,input},check);assert.equal(replay.replayed,true);
   assert.deepEqual(f.row(),before);
  }
 }
});

test('reader rejects malformed private search facts even when the stored record hash is valid',async()=>{
 const f=await fixture({input:{...payload(),externalSearch:facts()}}),valid=structuredClone(f.row().sdk_usage);
 const changes=[
  r=>r.externalSearch=null,r=>delete r.externalSearch.calls,r=>r.externalSearch.extra='private',
  r=>r.externalSearch.billedMicroUsd=0,r=>r.externalSearch.attempts=65,r=>r.externalSearch.estimateMicroUsd=1000001,
  r=>r.externalSearch.outcome='billed',r=>r.externalSearch.truncated='false',r=>r.externalSearch.incomplete='true',
  r=>r.externalSearch.unobserved=['bad identifier'],r=>r.externalSearch.calls[0].provider='other',
  r=>r.externalSearch.calls[0].billedMicroUsd=0,r=>r.externalSearch.calls[0].extra='private',
  r=>r.externalSearch.calls=Array.from({length:9},()=>structuredClone(r.externalSearch.calls[0])),
  r=>r.externalSearch={...unobserved,incomplete:false},r=>r.externalSearch={...unobserved,attempts:1},
  r=>r.unknownPrivateField='private',r=>r.toolsUsed.tools[0].output='private',r=>r.delta['model.alpha'].inputTokens=-1,
 ];
 for(const change of changes){
  const corrupt=structuredClone(valid);change(corrupt);f.row().sdk_usage=corrupt;f.row().sdk_usage_sha256=hash(corrupt);
  const saved=await f.store.readUsage(binding,check);
  assert.throws(()=>projectRecordedUsage(saved,request),/USAGE_RECORD_CORRUPT/);
 }
});
