import test from 'node:test';import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {createDurableSdkSessionOwner} from '../../sdk-session-owner.mjs';
import {fixture,id} from './fixture.mjs';
const append=(entries,n=10,expectedOffset=0)=>({appendId:id(n),expectedOffset,entriesSha256:hash(entries),entries});
test('native authority absent fails before any admitted transaction or SQL',async()=>{let calls=0;const owner=createDurableSdkSessionOwner({admission:{withCurrentRun(){calls++;}}});await assert.rejects(owner.load({credential:'any',request:{}}),{code:'SDK_SESSION_UNAVAILABLE'});assert.equal(calls,0);});
test('observed registration, opaque transcript/subkeys, UUID idempotency and marker duplicates use actual owner',async()=>{const f=fixture();await f.invoke('register');const marker={type:'system',opaque:{future:['keep',null]}};const entries=[{type:'assistant',uuid:id(20),future:{value:'original'}},marker,marker];const a=append(entries);assert.equal((await f.invoke('append',a)).offset,3);assert.deepEqual((await f.invoke('load')).entries,entries);assert.equal((await f.invoke('append',a)).offset,3);assert.equal(f.state().entries.length,3);
 assert.equal((await f.invoke('append',append([entries[0]],11,3))).added,0);const child={...f.key,subpath:'opaque/../subagent:key'};await f.owner.append({credential:'opaque-native-task',request:{binding:f.binding,key:child,...append([marker],12)}});assert.deepEqual((await f.invoke('listSubkeys')).subkeys,[child.subpath]);assert.equal(f.state().entries.length,4);});
test('current authority revocation refuses release and new SQL while retained entries remain',async()=>{const f=fixture();await f.invoke('register');await f.invoke('append',append([{type:'user',uuid:id(22),text:'retained'}]));const before=f.calls();f.revoke();await assert.rejects(f.invoke('load'));assert.equal(f.calls(),before);assert.equal(f.state().entries.length,1);});
test('foreign project key and stale offset cannot append or overwrite original',async()=>{const f=fixture();await f.invoke('register');await f.invoke('append',append([{type:'system',marker:true}]));await assert.rejects(f.invoke('append',append([{type:'system',marker:false}],11,0)),{code:'SDK_SESSION_STALE_OFFSET'});await assert.rejects(f.owner.load({credential:'opaque-native-task',request:{binding:f.binding,key:{...f.key,projectKey:'foreign'}}}));assert.equal(f.state().entries.length,1);});
test('same UUID with altered bytes and same appendId with altered request refuse',async()=>{const f=fixture();await f.invoke('register');const e={type:'assistant',uuid:id(50),text:'first'};await f.invoke('append',append([e]));await assert.rejects(f.invoke('append',append([{...e,text:'changed'}],11,1)),{code:'SDK_SESSION_ENTRY_CONFLICT'});await assert.rejects(f.invoke('append',append([{type:'system',other:true}],10,1)),{code:'SDK_SESSION_APPEND_CONFLICT'});assert.deepEqual((await f.invoke('load')).entries,[e]);});
test('lost COMMIT acknowledgement remains UNKNOWN; exact appendId replay does not duplicate markers',async()=>{const f=fixture();await f.invoke('register');const a=append([{type:'system',marker:'opaque'}]);f.unknown(true);await assert.rejects(f.invoke('append',a),{code:'SDK_SESSION_COMMIT_UNKNOWN'});assert.equal(f.state().entries.length,1);f.unknown(false);assert.equal((await f.invoke('append',a)).offset,1);assert.equal(f.state().entries.length,1);});
test('opaque depth beyond ordinary RPC depth64 is retained through canonical codec',async()=>{const f=fixture();await f.invoke('register');let nested={type:'system',value:'retained'};for(let n=0;n<90;n++)nested={type:'system',unknown:nested};await f.invoke('append',append([nested]));assert.deepEqual((await f.invoke('load')).entries,[nested]);});

test('parked canonical admission is bounded by the original caller lifetime',async()=>{const f=fixture({park:true,maxRequestMs:20}),at=performance.now();await assert.rejects(f.invoke('load'),{code:'SDK_SESSION_DEADLINE'});assert.ok(performance.now()-at<500);assert.equal(f.calls(),0);});

test('immutable registration replay preserves the original execution expiry',async()=>{const f=fixture();await f.invoke('register');const original=structuredClone(f.state().owner);await f.invoke('register');assert.deepEqual(f.state().owner,original);f.setClock(original.owner.expiresAtMs+1);await assert.rejects(f.invoke('load'));assert.deepEqual(f.state().owner,original);});
test('redundant entry/stream/session owner tuples cannot substitute foreign retained rows',async()=>{for(const kind of ['entry','stream','owner']){const f=fixture();await f.invoke('register');await f.invoke('append',append([{type:'system',marker:'retained'}]));if(kind==='entry')f.state().entries[0].tenant_id='foreign';if(kind==='stream')f.state().streams.get('').session_id=id(99);if(kind==='owner')f.state().owner.run_id=id(99);await assert.rejects(f.invoke('load'),{code:'SDK_SESSION_CORRUPT'});}});
test('execution credential authenticates once outside the canonical transaction for every operation',async()=>{const f=fixture(),count=async(op,extra)=>{const before=f.verifies();await f.invoke(op,extra);return f.verifies()-before;},batch=append([{type:'user',uuid:id(40),text:'counted'}],41);
 assert.equal(await count('register'),1);assert.equal(await count('append',batch),1);assert.equal(await count('append',batch),1);assert.equal(await count('load'),1);assert.equal(await count('listSubkeys'),1);});

test('legacy allocation owners and forged execution owners cannot register, append or read through the current port',async()=>{
 for(const kind of ['legacy','changed-execution','extra']){const f=fixture();await f.invoke('register');const row=f.state().owner;row.owner=structuredClone(row.owner);
 if(kind==='legacy'){row.owner.allocationSha256=row.owner.executionSha256;delete row.owner.executionSha256;}if(kind==='changed-execution')row.owner.executionSha256='f'.repeat(64);if(kind==='extra')row.owner.observationId='forged';row.owner_sha256=hash(row.owner);
 for(const operation of ['register','load','append'])await assert.rejects(f.invoke(operation,operation==='append'?append([{type:'system'}]):{}));
 }
});
test('settled/stopping, changed scopes/execution and expired current fences refuse before SQL',async()=>{
 for(const change of [{executionPhase:'settled'},{executionPhase:'stopping'},{scopes:[]},{executionSha256:'bad'},{deadlineMs:0},{deadlineMs:Date.parse('2026-10-13T20:00:00Z')+6000}]){const f=fixture();f.changeCurrent(change);await assert.rejects(f.invoke('register'));assert.equal(f.calls(),0);}
 const f=fixture();await f.invoke('register');f.changeCurrent({executionSha256:'f'.repeat(64)});await assert.rejects(f.invoke('append',append([{type:'system'}])));assert.equal(f.state().entries.length,0);
});

test('another native main key cannot register under the same current run',async()=>{
 const f=fixture();await f.invoke('register');const before=structuredClone(f.state());
 await assert.rejects(f.owner.register({credential:'opaque-native-task',request:{binding:f.binding,key:{...f.key,sessionId:id(98)}}}));
 assert.deepEqual(f.state(),before);
});
