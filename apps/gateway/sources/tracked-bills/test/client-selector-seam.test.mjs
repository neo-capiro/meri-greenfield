/** Actual current execution/Core composition with synthetic fixed HTTP replies; no native DB qualification. */
import test from 'node:test';import assert from 'node:assert/strict';
import {fixture} from '../../../../runtime/test/reads-native-fixture.mjs';
import {id,clientId} from './fixture.mjs';
for(const [status,http,code] of [[401,403,'ACCESS_DENIED'],[403,403,'ACCESS_DENIED'],[404,503,'UNAVAILABLE'],[429,503,'SOURCE_UNAVAILABLE'],[503,503,'SOURCE_UNAVAILABLE']])test(`current roster cannot replace failed name resolution ${status} or change its meaning`,async()=>{
 const f=await fixture('tracked-bills',id,{request:{clientId}});f.referenceStatus(status);
 const r=await f.execute({...f.scene.arguments,clientId:'Synthetic named client'});assert.equal(r.status,http);assert.deepEqual(await r.json(),{error:{code}});
 assert(f.calls.some(p=>p.endsWith('/clients/check-ref')));assert(!f.calls.some(p=>p===`/api/clio/tools/${id}`));
});
test('a later read cannot retain a removed client from the current Core roster',async()=>{
 const f=await fixture('tracked-bills',id,{request:{clientId}}),first=await f.execute();assert.equal(first.status,200,await first.clone().text());
 const before=f.calls.filter(p=>p===`/api/clio/tools/${id}`).length;f.setClients([]);const denied=await f.execute();
 assert.equal(denied.status,403);assert.equal(f.calls.filter(p=>p===`/api/clio/tools/${id}`).length,before);
});
