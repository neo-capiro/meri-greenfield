import test from 'node:test';
import assert from 'node:assert/strict';
import {standaloneFixture} from '../../../runtime/native-authority/test/standalone-tasks-fixture.mjs';
import {markAuthorityUnavailable} from '../../../../packages/runtime/authority-availability.mjs';

test('hostile routing, credentials and request shape refuse before native preparation',async()=>{
 const f=standaloneFixture();
 for(const request of [f.request('execute?x=1',{}),f.request('prepare',{}, {method:'PUT'}),f.request('prepare',{}, {headers:{'content-type':'text/plain'}}),f.request('prepare',{}, {headers:{'content-type':'application/json'}})])assert.notEqual((await f.app.handle(request)).status,200);
 assert.equal(f.metadata.rows.size,0);assert.equal(f.sql.state.connects,0);
});
test('foreign conversation and malformed proposal never reach native effects',async()=>{
 const f=standaloneFixture(),response=await f.call('prepare',f.raw),{proposal}=await response.json();
 const changed=structuredClone(proposal);changed.command.binding.tenantId='foreign';
 assert.notEqual((await f.call('execute',{proposal:changed})).status,200);assert.equal(f.state.effects,0);assert.equal(f.state.decisions,0);
});

test('an unmarked session error cannot claim authority unavailability',async()=>{
 const f=standaloneFixture();f.sessions.authenticateSession=async()=>{throw Object.assign(Error('SESSION_AUTHORITY_UNAVAILABLE'),{code:'SESSION_AUTHORITY_UNAVAILABLE'});};
 const response=await f.call('prepare',f.raw);
 assert.equal(response.status,401);assert.deepEqual(await response.json(),{error:{code:'UNAUTHENTICATED',outcome:'NOT_DISPATCHED'}});
 assert.equal(f.metadata.rows.size,0);assert.equal(f.sql.state.rows.size,0);assert.equal(f.state.effects,0);
});

test('authority unavailability after preparation begins does not claim non-dispatch',async()=>{
 const f=standaloneFixture();f.state.afterMetadata=()=>{throw markAuthorityUnavailable(Error('upstream unavailable'));};
 const response=await f.call('prepare',f.raw);
 assert.notEqual(response.status,200);assert.equal((await response.json()).error.outcome,'UNKNOWN');
 assert.equal(f.metadata.rows.size,1);assert.equal(f.state.effects,0);
});

test('a definite non-authentication refusal keeps its canonical reason instead of reporting 401',async()=>{
 for(const [code,status] of [['ACCESS_DENIED',403],['DEADLINE',408]]){
  const f=standaloneFixture();f.sessions.authenticateSession=async()=>{throw Object.assign(Error(code),{code});};
  const response=await f.call('prepare',f.raw),body=await response.json();
  assert.equal(response.status,status);assert.equal(body.error.code,code);assert.equal(body.error.outcome,'NOT_DISPATCHED');
  assert.equal(f.metadata.rows.size,0);assert.equal(f.sql.state.rows.size,0);assert.equal(f.state.effects,0);
 }
});
