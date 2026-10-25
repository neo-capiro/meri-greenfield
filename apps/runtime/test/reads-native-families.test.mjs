/** Actual current execution and ordinary Core adapters over finite synthetic source DTOs. */
import test from 'node:test';import assert from 'node:assert/strict';
import {fixture,CASES,uuid} from './reads-native-fixture.mjs';
import {nativeFamilyCase} from '../../gateway/general-reads/test/native-family-cases.mjs';
for(const [family,id] of CASES)test(`${family}/${id}: canonical normalizer and actual ordinary HTTP adapter`,async()=>{
 const f=await fixture(family,id),r=await f.execute();assert.equal(r.status,200,await r.clone().text());assert.equal(f.calls.filter(p=>p===`/api/clio/tools/${id}`).length,1);
 const out=JSON.parse((await r.json()).resultJson);assert(out&&typeof out==='object');assert.equal(f.calls.filter(p=>p.endsWith('/application-authority/current')).length,family==='client-registry'?3:2);
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

// One advancing-clock pass through the shared owner, using each existing family's
// own request and result fixture. A frozen clock hides repeated-observation errors.
for(const [family,id] of CASES)test(`clock: ${family}/${id} keeps current access without extra Core reads`,async()=>{
 const f=await fixture(family,id,{advancingClock:true}),r=await f.execute();
 assert.equal(r.status,200,await r.clone().text());
 assert.equal(f.calls.filter(p=>p===`/api/clio/tools/${id}`).length,1);
 assert.equal(f.calls.filter(p=>p.endsWith('/application-authority/current')).length,family==='client-registry'?3:2);
});

async function registryClockFixture(general){
 const scene=nativeFamilyCase('client-registry','lookup_client_registry'),a=scene.authority;
 const selected=general?a.binding.actorId:scene.visibleClientIds[0];
 Object.assign(a.subject,{kind:general?'personal':'client',entityType:general?'user':'client',entityIds:[selected],
  scopes:[{tenantId:a.binding.tenantId,kind:general?'private-user':'client',resourceId:selected,policyRevision:a.subject.policyRevision}]});
 return fixture('client-registry','lookup_client_registry',{scene,advancingClock:true});
}
for(const general of [true,false]){
 const scope=general?'General':'selected-client';
 test(`clock: ${scope} registry returns a currently visible client`,async()=>{
  const f=await registryClockFixture(general),r=await f.execute();
  assert.equal(r.status,200,await r.clone().text());
  const result=JSON.parse((await r.json()).resultJson);
  assert.equal(result.result.existingClient.id,f.scene.page.existingClient.id);
  assert.equal(f.calls.filter(p=>p.endsWith('/application-authority/current')).length,3);
  assert.equal(f.calls.filter(p=>p.endsWith('/tools/lookup_client_registry')).length,1);
 });
 for(const denial of ['hidden','hidden after source','revoked after source','source refusal']){
  test(`clock: ${scope} registry withholds bytes for ${denial}`,async()=>{
   const f=await registryClockFixture(general);
   if(denial==='hidden')f.setClients([]);
   if(denial==='hidden after source')f.scene.state.afterSource=()=>f.setClients([]);
   if(denial==='revoked after source')f.scene.state.afterSource=f.revoke;
   if(denial==='source refusal')f.deny();
   const r=await f.execute(),body=await r.json();
   assert.equal(r.status,403,JSON.stringify(body));
   assert.equal(body.error.code,'ACCESS_DENIED');assert.equal(body.resultJson,undefined);
   assert.equal(f.calls.filter(p=>p.endsWith('/tools/lookup_client_registry')).length,!general&&denial==='hidden'?0:1);
  });
 }
}
test('clock: local revalidation does not extend the original Core authority expiry',async()=>{
 const f=await fixture('bill-text','read_bill_text',{advancingClock:true});
 // Core current authority is bounded to three seconds, while this execution and
 // the read budget remain live. A new observation timestamp must not renew it.
 f.scene.state.afterSource=()=>f.advanceClock(3100);
 const r=await f.execute(),body=await r.json();
 assert.equal(body.error?.code,'DEADLINE');assert.equal(body.resultJson,undefined);
 assert.equal(f.calls.filter(p=>p.endsWith('/application-authority/current')).length,1);
 assert.equal(f.calls.filter(p=>p.endsWith('/tools/read_bill_text')).length,1);
 assert(f.now()<f.deadlineMs);
});
