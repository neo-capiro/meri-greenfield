/** Focused synthetic producer/adapter/actual durable gateway controls; no native service, SDK or provider call. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {createBillTextHandlers} from '../handler.mjs';
import {prepareBillTextReadContext} from '../../../dispatch/bill-text-context.mjs';
import {durableFamilyFixture} from '../../../general-reads/test/durable-fixture.mjs';
import {billTextCase,origin,cursor} from './fixture.mjs';
const code=expected=>error=>error.message===expected&&!error.message.includes('SYNTHETIC');
const configuration=f=>({...f.transport,now:f.now});
const execute=f=>createBillTextHandlers(configuration(f),[f.operation])[0].execute;
for(const id of ['search_congress_bills','read_bill_text']){
 test(`${id}: fixed flat POST with both native credentials; actual JSON DTO dates`,async()=>{
  const f=billTextCase(id),result=JSON.parse(await execute(f)(f.call()));
  assert.deepEqual(result.binding,f.binding);assert.deepEqual(result.subject,f.subject);assert.equal(result.argumentsSha256,f.call().argumentsSha256);
  assert.equal(f.wire[0].url,origin+'/api/clio/tools/'+id);assert.equal(f.wire[0].options.method,'POST');assert.equal('input' in f.wire[0].body,false);
  assert.equal(f.wire[0].options.headers.authorization,'Bearer SYNTHETIC_NATIVE_USER');assert.equal(f.wire[0].options.headers['x-internal-service-secret'],'SYNTHETIC_INTERNAL_SERVICE');
  assert.equal(f.wire[0].options.redirect,'error');assert.equal(f.wire[0].options.credentials,'omit');
  const stamp=id==='read_bill_text'?'publishedAt':'generatedAt';assert.ok(f.state.nativeValue[stamp] instanceof Date);assert.equal(result.result[stamp],new Date(f.now()).toISOString());
  for(const key of ['authoritative','sourceConnected','producerQualified','absenceEvidence','currentPointerQualified'])assert.equal(f.contract.normalizeInput(f.arguments,f.normalizationContext).metadata[key],false);
 });
 test(`${id}: actual canonical durable dispatch settles once and preserves duplicate uncertainty`,async()=>{
  const f=await durableFamilyFixture(billTextCase(id)),raw=await f.execute(),result=JSON.parse(raw),[reservation]=f.state.reservations.values();
  assert.equal(reservation.state,'SETTLED');assert.equal(reservation.output_bytes,Buffer.byteLength(raw));assert.equal(f.state.budget.consumed_micro_usd,1);
  assert.equal(result.result.tool,id);assert.equal(f.state.produced.size,1);const [invocation]=f.state.produced.values();assert.equal(invocation.completion.resultSha256,canonicalSha256(result));
  const count=f.wire.length;await assert.rejects(f.execute(),code('BUDGET_UNCERTAIN'));assert.equal(f.wire.length,count);assert.equal(f.state.budget.consumed_micro_usd,1);
 });
 test(`${id}: disabled, uninstalled and missing captured Congress cannot fetch`,async()=>{
  const f=await durableFamilyFixture(billTextCase(id));await assert.rejects(f.mount({sourceEnabled:false}).execute({operation:f.operation,arguments:f.arguments,deliveryId:'off'}),code('UNAVAILABLE'));
  f.state.installRevoked=true;await assert.rejects(f.execute('no-install'),code('UNAVAILABLE'));f.state.installRevoked=false;
  await assert.rejects(f.mount({defaultCongress:undefined}).execute({operation:f.operation,arguments:f.arguments,deliveryId:'no-context'}),code('UNAVAILABLE'));assert.equal(f.wire.length,0);assert.equal(f.state.reservations.size,0);
 });
 test(`${id}: model authority is rejected before source and budget`,async()=>{
  const f=await durableFamilyFixture(billTextCase(id));await assert.rejects(f.execute('forged',{...f.arguments,defaultCongress:118,tenantId:'foreign'}),code('INVALID_ARGUMENTS'));assert.equal(f.wire.length,0);assert.equal(f.state.reservations.size,0);
 });
 test(`${id}: release revocation withholds the fetched result`,async()=>{
  const f=await durableFamilyFixture(billTextCase(id));f.state.afterSource=()=>{f.state.revoked=true;};await assert.rejects(f.execute('revoked'),code('ACCESS_DENIED'));assert.equal(f.wire.length,1);
 });
}
test('SEARCH resolves a designation under captured118 before a Core119 clock could retarget it',async()=>{
 const f=billTextCase('search_congress_bills',{defaultCongress:118}),result=JSON.parse(await execute(f)(f.call()));
 assert.equal(f.call().input.query,'H.R. 1');assert.equal(f.wire[0].body.query,'118-hr-1');assert.equal(result.result.data[0].id,'118-hr-1');
 assert.equal(f.credentialCalls[0].normalizationContext.defaultCongress,118);assert.equal(f.credentialCalls[0].requestSha256,canonicalSha256(f.arguments));
});
test('text-search mode preserves literal Unicode notes, counts and selection',async()=>{
 const f=billTextCase('search_congress_bills',{request:{textQuery:'minerals',limit:8}}),result=JSON.parse(await execute(f)(f.call()));
 assert.equal(result.result.mode,'bill_text');assert.ok(result.result.note.includes('« »'));assert.equal(f.wire[0].body.textQuery,'minerals');
});
test('sequential continuation preserves revision/hash/offset and detects a changed native vector',async()=>{
 const f=billTextCase('read_bill_text',{request:{billId:'119-hr-1',cursor:cursor('119-hr-1',9000)}});f.state.total=20000;
 const result=JSON.parse(await execute(f)(f.call()));assert.equal(result.result.coverage.locator.offset,9000);assert.equal(result.result.coverage.contentComplete,false);
 f.state.resultMutator=value=>{value.textHash='c'.repeat(64);};await assert.rejects(execute(f)(f.call()),code('INVALID_RESULT'));
});
test('locator mode remains excerpts, not complete text or a renewable continuation authority',async()=>{
 const f=billTextCase('read_bill_text',{request:{billId:'H.R. 1',query:'minerals'}});f.state.total=2000;
 const result=JSON.parse(await execute(f)(f.call()));assert.equal(result.result.coverage.complete,false);assert.equal(result.result.coverage.contentComplete,false);assert.equal(result.result.coverage.nextCursor,null);
});
test('HTTP200 unavailable revision is explicit UNAVAILABLE and a malformed tool payload is invalid',async()=>{
 const f=billTextCase();f.state.unavailable=true;await assert.rejects(execute(f)(f.call()),code('UNAVAILABLE'));
 f.state.unavailable=false;f.state.resultMutator=value=>{value.error='synthetic failure';};await assert.rejects(execute(f)(f.call()),code('INVALID_RESULT'));
});
test('missing credential owner and forbidden delegated mode cannot reach a native route',async()=>{
 const f=billTextCase(),{getCredentials,...missing}=configuration(f);await assert.rejects(createBillTextHandlers(missing,[f.operation])[0].execute(f.call()),code('UNAVAILABLE'));assert.equal(f.wire.length,0);
 assert.throws(()=>createBillTextHandlers({...configuration(f),delegatedTransport:{read(){}}},[f.operation]));
});
for(const mutation of ['secret','binding','expiry'])test(`native ${mutation} proof mismatch refuses before fetch`,async()=>{
 const f=billTextCase();f.state.credentialMutator=value=>{if(mutation==='secret')delete value.serviceSecret;else if(mutation==='binding')value.binding.writerFence++;else value.expiresAtMs=f.now();};
 await assert.rejects(execute(f)(f.call()),code(mutation==='secret'?'INVALID_ARGUMENTS':'ACCESS_DENIED'));assert.equal(f.wire.length,0);
});
for(const mutation of ['audience','decision'])test(`current ${mutation} mismatch refuses before native credentials`,async()=>{
 const f=billTextCase();if(mutation==='audience')f.authority.claims.audience='other';else f.authority.decision.operation='other@0.2.0';
 await assert.rejects(execute(f)(f.call()),code('ACCESS_DENIED'));assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
});
test('response cap, media and redirects fail closed without changing native DTO validation',async()=>{
 for(const response of [()=>new Response('x'.repeat(100),{headers:{'content-type':'application/json','content-length':'99999999'}}),()=>new Response('{}',{headers:{'content-type':'text/html'}}),()=>new Response('{}',{status:302,headers:{location:'https://elsewhere.example.invalid'}})]){
  const f=billTextCase();f.state.responseFactory=response;await assert.rejects(execute(f)(f.call()));
 }
});
test('pre-abort and original deadline do not start native work',async()=>{
 const f=billTextCase(),controller=new AbortController();controller.abort();await assert.rejects(execute(f)({...f.call(),signal:controller.signal}),code('CANCELLED'));assert.equal(f.wire.length,0);
 f.state.now=f.authority.deadlineMs;await assert.rejects(execute(f)(f.call()),code('DEADLINE'));assert.equal(f.wire.length,0);
});
test('no endpoint or operation selector can widen the finite family',()=>{
 const f=billTextCase();assert.throws(()=>createBillTextHandlers(configuration(f),[{id:'create_word',version:'0.2.0'}]),code('GATEWAY_CONFIGURATION'));
 assert.throws(()=>createBillTextHandlers({...configuration(f),origin:'https://native-core.example.invalid/other'},[f.operation]),code('GATEWAY_CONFIGURATION'));
 const entry={contract:f.contract};assert.throws(()=>prepareBillTextReadContext({entry,authority:f.authority,identity:{claims:f.claims}}),code('UNAVAILABLE'));
});
