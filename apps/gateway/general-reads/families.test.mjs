/** Synthetic: real family adapters, current authority, measured installation and durable dispatch; fake HTTPS/scripted SQL. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {createGeneralReadFamilyHandlers,GENERAL_READ_ADAPTER_FAMILIES} from './integration.mjs';
import {CASES,familyCase} from './test/family-cases.mjs';
import {durableFamilyFixture} from './test/durable-fixture.mjs';
const code=c=>e=>e.message===c&&!e.message.includes('PRIVATE');
for(const [family,id] of CASES){
 test(`synthetic ${id}: canonical family reaches durable scoped receipt once`,async()=>{
  const f=await durableFamilyFixture(familyCase(family,id)),raw=await f.execute(),out=JSON.parse(raw);
  assert.deepEqual(out.binding,f.binding);assert.deepEqual(out.subject,f.authority.subject);
  if(out.operation)assert.deepEqual(out.operation,f.operation);else assert.ok(out.data,'preserve the canonical family wrapper');
  assert.equal(out.result?.tool??out.result?.data?.tool??out.data?.tool??f.operation.id,id==='memory.list_own_proposals'?'list_memory_proposals':id);
  if(['facility-representation','district-nexus'].includes(family))assert.deepEqual(out.result,{binding:f.binding,subject:f.authority.subject,data:JSON.parse(JSON.stringify(f.page))});
  const [reservation]=f.state.reservations.values();assert.equal(reservation.state,'SETTLED');assert.equal(reservation.charged_micro_usd,1);
  assert.equal(f.state.produced.size,1);const [invocation]=f.state.produced.values();
  assert.deepEqual(invocation.operation,f.operation);assert.equal(invocation.delivery.deliveryId,'synthetic:read');
  if(out.argumentsSha256)assert.equal(invocation.arguments_sha256,out.argumentsSha256);
  assert.equal(invocation.completion.argumentsSha256,invocation.arguments_sha256);
  assert.equal(invocation.completion.resultSha256,canonicalSha256(out));
  assert.equal(reservation.output_bytes,Buffer.byteLength(raw));
  if(family==='dataset-metadata'){assert.equal(f.wire.length,0);assert.equal(out.result.datasets.length,12);assert.equal(out.result.datasets.reduce((n,d)=>n+d.fields.length,0),88);}
  else assert.ok(f.wire.length>0);
  const calls=f.wire.length;await assert.rejects(f.execute(),code('BUDGET_UNCERTAIN'));
  assert.equal(f.wire.length,calls);assert.equal(f.state.budget.consumed_micro_usd,1,'restart/duplicate never repeats an effect or charge');
 });
 test(`synthetic ${id}: missing installation, disabled source and revoked actor are closed`,async()=>{
  const f=await durableFamilyFixture(familyCase(family,id));
  await assert.rejects(f.mount({sourceEnabled:undefined}).execute({operation:f.operation,arguments:f.arguments,deliveryId:'disabled'}),code('UNAVAILABLE'));
  f.state.installRevoked=true;await assert.rejects(f.execute('no-installation'),code('UNAVAILABLE'));
  f.state.installRevoked=false;f.state.revoked=true;await assert.rejects(f.execute('revoked'),code('ACCESS_DENIED'));
  assert.equal(f.wire.length,0);assert.equal(f.state.reservations.size,0);
 });
 test(`synthetic ${id}: model authority is refused before source and budget`,async()=>{
  const f=await durableFamilyFixture(familyCase(family,id));
  await assert.rejects(f.execute('forged',{...f.arguments,tenantId:'other-tenant'}),code('INVALID_ARGUMENTS'));
  assert.equal(f.wire.length,0);assert.equal(f.state.reservations.size,0);
 });
 test(`synthetic ${id}: foreign capability binding, expiry and pre-abort cannot read`,async()=>{
  const f=await durableFamilyFixture(familyCase(family,id));
  const old=f.authority.claims.binding;f.authority.claims.binding={...old,tenantId:'other-tenant'};
  await assert.rejects(f.execute('foreign-tenant'),code('ACCESS_DENIED'));f.authority.claims.binding=old;
  const controller=new AbortController();controller.abort();
  await assert.rejects(f.mount().execute({operation:f.operation,arguments:f.arguments,deliveryId:'cancelled',signal:controller.signal}));
  f.state.now=f.deadlineMs;await assert.rejects(f.execute('expired'),code('UNAVAILABLE'));
  assert.equal(f.wire.length,0);assert.equal(f.state.reservations.size,0);
 });
 if(family!=='dataset-metadata')test(`synthetic ${id}: release revocation withholds source data`,async()=>{
  const f=await durableFamilyFixture(familyCase(family,id));f.state.afterSource=()=>{f.state.revoked=true;};
  await assert.rejects(f.execute('release-revoked'),code('ACCESS_DENIED'));assert.ok(f.wire.length>0);
 });
}
test('family registration is inert, closed and does not fabricate native installation receipts',async()=>{
 assert.equal(GENERAL_READ_ADAPTER_FAMILIES.length,32);
 assert.equal((await createGeneralReadFamilyHandlers({families:{},now:Date.now,newId:()=>''})).size,0);
 await assert.rejects(createGeneralReadFamilyHandlers({families:{'florida-budget':{}},now:Date.now,newId:()=>''}));
 let effects=0;const source={get origin(){effects++;return 'https://invalid.example';}};
 await assert.rejects(createGeneralReadFamilyHandlers({families:{'operational-reads':source},now:Date.now,newId:()=>''}));
 assert.equal(effects,0);
 const f=await durableFamilyFixture(familyCase('tenant-contacts','find_contacts'));
 const h=f.handlers.get('find_contacts@0.2.0');assert.equal(h.sourceSha256,canonicalSha256(h.sourceFiles));
 assert.ok(h.sourceFiles.some(r=>r.label.endsWith('/families/tenant-contacts.mjs')));
 assert.ok(h.sourceFiles.some(r=>r.label.endsWith('/identity-contacts/request-context.mjs')));
 assert.equal('qualificationReceiptId' in h,false);
});
