/** Actual current execution and ordinary Core adapters over finite synthetic source DTOs. */
import test from 'node:test';import assert from 'node:assert/strict';
import {fixture,CASES,uuid} from './reads-native-fixture.mjs';
for(const [family,id] of CASES)test(`${family}/${id}: canonical normalizer and actual ordinary HTTP adapter`,async()=>{
 const f=await fixture(family,id),r=await f.execute();assert.equal(r.status,200,await r.clone().text());assert.equal(f.calls.filter(p=>p===`/api/clio/tools/${id}`).length,1);
 const out=JSON.parse((await r.json()).resultJson);assert(out&&typeof out==='object');assert.equal(f.calls.filter(p=>p.endsWith('/application-authority/current')).length,family==='client-registry'?2:1);
});
for(const [family,id] of [['client-registry','lookup_client_registry'],['tracked-bills','search_tracked_bills'],['public-data','query_economic_data']])test(`${family}: actual owner denial cannot be repaired by initial selection`,async()=>{const f=await fixture(family,id);f.deny();const r=await f.execute();assert.equal(r.status,403,await r.clone().text());});

for(const [family,id] of CASES){
 test(`${family}/${id}: canonical Core refusal releases no result`,async()=>{const f=await fixture(family,id);f.deny();const r=await f.execute();assert.equal(r.status,403,await r.clone().text());assert.equal(f.calls.filter(p=>p===`/api/clio/tools/${id}`).length,1);});
 test(`${family}/${id}: current execution revocation after source withholds bytes`,async()=>{const f=await fixture(family,id);f.scene.state.afterSource=f.revoke;const r=await f.execute();assert.equal(r.status,403,await r.clone().text());assert.equal(f.calls.filter(p=>p===`/api/clio/tools/${id}`).length,1);});
 test(`${family}/${id}: malformed canonical response cannot become a successful page`,async()=>{const f=await fixture(family,id);f.scene.state.responseFactory=()=>Response.json({unexpected:'synthetic'});const r=await f.execute();assert.notEqual(r.status,200,await r.clone().text());assert.equal(f.calls.filter(p=>p===`/api/clio/tools/${id}`).length,1);});
}
for(const [family,id] of CASES.filter(([family])=>['facility-representation','district-nexus','tracked-bills','funding-opportunities'].includes(family)))test(`${family}: another client selector is refused before Core resource read`,async()=>{const f=await fixture(family,id),r=await f.execute({...f.scene.arguments,clientId:uuid('f')});assert.notEqual(r.status,200);assert(!f.calls.some(p=>p===`/api/clio/tools/${id}`));});

for(const id of ['get_business_development_context','get_business_development_recent_changes'])test(`${id}: actual General private-user selection preserves personal data owner`,async()=>{const f=await fixture('business-development',id,{personal:true,privateUser:true}),r=await f.execute();assert.equal(r.status,200,await r.clone().text());assert.equal(f.calls.filter(p=>p.endsWith('/application-authority/context')).length,0);});

test('business-development evidence refuses a changed canonical conversation client before content',async()=>{const f=await fixture('business-development','get_business_development_evidence',{contextClientId:uuid('f')}),r=await f.execute();assert.equal(r.status,403,await r.clone().text());assert(!f.calls.includes('/api/clio/tools/get_business_development_evidence'));});
