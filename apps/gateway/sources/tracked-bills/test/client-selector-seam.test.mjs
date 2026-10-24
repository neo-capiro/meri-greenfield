/** Actual current execution/Core composition with synthetic fixed HTTP replies; no native DB qualification. */
import test from 'node:test';import assert from 'node:assert/strict';
import {fixture} from '../../../../runtime/test/reads-native-fixture.mjs';
import {id,clientId} from './fixture.mjs';
test('a current authorized roster cannot replace a refused native name resolution',async()=>{
 const f=await fixture('tracked-bills',id,{request:{clientId}});f.referenceStatus(403);
 const r=await f.execute({...f.scene.arguments,clientId:'Synthetic named client'});assert.notEqual(r.status,200);
 assert(f.calls.some(p=>p.endsWith('/clients/check-ref')));assert(!f.calls.some(p=>p===`/api/clio/tools/${id}`));
});
test('a later read cannot retain a removed client from the current Core roster',async()=>{
 const f=await fixture('tracked-bills',id,{request:{clientId}}),first=await f.execute();assert.equal(first.status,200,await first.clone().text());
 const before=f.calls.filter(p=>p===`/api/clio/tools/${id}`).length;f.setClients([]);const denied=await f.execute();
 assert.equal(denied.status,403);assert.equal(f.calls.filter(p=>p===`/api/clio/tools/${id}`).length,before);
});
