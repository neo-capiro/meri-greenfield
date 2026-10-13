import test from 'node:test';
import assert from 'node:assert/strict';
import {createFirstRuntimeSdkSession} from '../../../../../apps/runtime/sdk-first-session.mjs';
import {fixture} from '../../../../../apps/runtime/native-authority/test/fixture.mjs';

// Keep registration parked to check admission before remote authority returns.
// Verify observed queue behavior and refusal outcome, not private queue arithmetic.
test('fresh registration wait keeps canonical pending limit and failed completion barrier',async()=>{
 const f=fixture(),release=Promise.withResolvers();let registrations=0,writes=0;
 const mirror=createFirstRuntimeSdkSession({binding:f.binding,client:{
  async register(){registrations++;await release.promise;return {registered:true};},
  async load(){return {entries:null,offset:0};},
  async append(input){writes++;return {offset:input.expectedOffset+input.entries.length};},
  async listSubkeys(){return {subkeys:[]};},
 }});
 const accepted=Array.from({length:128},(_,i)=>mirror.store.append(f.key,[{type:'system',marker:i}]));
 accepted.forEach(p=>p.catch(()=>{}));
 await assert.rejects(mirror.store.append(f.key,[{type:'system',marker:'overflow'}]),{code:'SESSION_QUEUE_BOUND'});
 assert.equal(registrations,1);assert.equal(writes,0);
 release.resolve();await Promise.all(accepted);assert.equal(writes,128);assert.equal(registrations,1);
 await assert.rejects(mirror.settle(),{code:'RUNNER_SDK_SESSION_UNKNOWN'});
 await assert.rejects(mirror.close(),{code:'RUNNER_SDK_SESSION_UNKNOWN'});
});
