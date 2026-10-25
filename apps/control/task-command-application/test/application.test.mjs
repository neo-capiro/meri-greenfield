import test from 'node:test';
import assert from 'node:assert/strict';
import {standaloneFixture} from '../../../runtime/native-authority/test/standalone-tasks-fixture.mjs';

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
