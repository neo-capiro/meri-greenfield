/** Actual MCP/gateway owners with synthetic source JSON and scripted SQL; no model or live Core calls. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {validateShape as validateReadShape} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {advertisedArguments,canonicalInputSchema} from '../schema.mjs';
import {resolveAvailableReads,familyReads} from '../availability.mjs';
import {nativeFamilyCase,GOVERNED_NEXT_FAMILY_CASES} from '../../../../gateway/general-reads/test/native-family-cases.mjs';
import {durableFamilyFixture} from '../../../../gateway/general-reads/test/durable-fixture.mjs';
import {mountReads} from './fixture.mjs';

test('new read fixtures enumerate exactly thirteen operations across seven canonical families',()=>{
 assert.equal(GOVERNED_NEXT_FAMILY_CASES.length,13);
 assert.equal(new Set(GOVERNED_NEXT_FAMILY_CASES.map(([family])=>family)).size,7);
 assert.equal(new Set(GOVERNED_NEXT_FAMILY_CASES.map(([,id])=>id)).size,13);
});

test('data-search remains unexposed while the frozen normalized schema conflicts with the raw request grammar',()=>{
 const f=nativeFamilyCase('data-search','search_capiro_data');
 const normalized=f.contract.normalizeInput(f.arguments,{}),canonical=canonicalInputSchema(f.contract.descriptor.inputSchema);
 assert.ok(canonical.required.includes('window'));assert.equal(Object.hasOwn(f.arguments,'window'),false);
 assert.equal(Object.hasOwn(normalized.input,'window'),true);
 assert.throws(()=>validateReadShape(f.contract.binding.input,f.arguments));
 assert.doesNotThrow(()=>validateReadShape(f.contract.binding.input,normalized.input));
 assert.throws(()=>f.contract.normalizeInput({...f.arguments,window:normalized.input.window},{}));
 assert.throws(()=>f.contract.normalizeInput(normalized.input,{}));
 assert.throws(()=>advertisedArguments(f.contract.descriptor.inputSchema),{code:'READ_SCHEMA_CONFIGURATION'});
 assert.equal(familyReads().some(row=>row.operation.id==='search_capiro_data'),false);
});

for(const [family,id] of GOVERNED_NEXT_FAMILY_CASES.filter(([family])=>family!=='data-search')){
 test(`${id}: SDK schema preserves original literal selectors and refuses model authority/context`,()=>{
  const f=nativeFamilyCase(family,id),schema=advertisedArguments(f.contract.descriptor.inputSchema);
  assert.equal(schema.mode,'canonical');assert.deepEqual(schema.arguments.parse(f.arguments),f.arguments);
  for(const extra of [{tenantId:'foreign'},{actorRole:'capiro_admin'},{normalizationContext:{}},{defaultAsOf:'2026-10-12T00:00:00.000Z'},{input:f.arguments}]){
   assert.equal(schema.arguments.safeParse({...f.arguments,...extra}).success,false);
  }
 });
 test(`${id}: measured installation/discovery exposes one MCP read and settles its exact result receipt`,async()=>{
  const f=await durableFamilyFixture(nativeFamilyCase(family,id)),m=await mountReads(f);
  assert.notEqual(m,null);
  try{
   assert.deepEqual((await m.client.listTools()).tools.map(tool=>tool.name),[id]);
   const out=await m.call(id,f.arguments);assert.equal(out.isError,undefined);assert.equal(out.denied,undefined);
   const value=JSON.parse(out.content[0].text),page=JSON.parse(JSON.stringify(f.page));
   assert.deepEqual(value.operation,f.operation);assert.deepEqual(value.binding,f.binding);assert.deepEqual(value.subject,f.authority.subject);
   assert.deepEqual(value.result,['facility-representation','district-nexus'].includes(family)?{binding:f.binding,subject:f.authority.subject,data:page}:page);
   assert.equal(m.runtime.receipts().length,1);assert.equal(m.runtime.receipts()[0].resultSha256,hash(value));
   const [reservation]=f.state.reservations.values();assert.equal(reservation.state,'SETTLED');assert.equal(reservation.output_bytes,Buffer.byteLength(out.content[0].text));
   assert.equal(f.wire.length,1);
   for(const suffix of ['native-handler.mjs','native-families.mjs','native-read-credentials/owner.mjs']){
    assert.ok(f.handlers.get(`${id}@0.2.0`).sourceFiles.some(row=>row.label.endsWith(suffix)),suffix);
   }
   if(family==='public-domain-query'){
    assert.equal(Object.hasOwn(value.result,'sql'),false);
    const normalized=f.contract.normalizeInput(f.arguments,f.normalizationContext).input;
    assert.deepEqual(f.wire[0].body,normalized.asOfDate===null?f.arguments:{...f.arguments,asOfDate:normalized.asOfDate});
    assert.ok(f.handlers.get(`${id}@0.2.0`).sourceFiles.some(row=>row.label.endsWith('public-domain-query/native-result.mjs')));
   }
   if(id==='search_public_web')assert.equal(value.result.contentStatus,'discovered');
   if(id==='scrape_web_page')assert.equal(value.result.trust,'external_untrusted');
  }finally{await m.close();}
 });
 test(`${id}: missing source/installation/discovery or family policy creates no MCP server`,async()=>{
  const f=await durableFamilyFixture(nativeFamilyCase(family,id));
  f.state.installRevoked=true;assert.equal(await mountReads(f),null);f.state.installRevoked=false;
  f.state.discoveryMutator=row=>row.operations=[];assert.equal(await mountReads(f),null);f.state.discoveryMutator=undefined;
  assert.equal(await mountReads(f,{policy:{generalReads:false}}),null);
  assert.equal(await mountReads(f,{policy:{generalReads:true,readFamilies:['mail']}}),null);
  await assert.rejects(mountReads(f,{policy:{generalReads:true,readFamilies:[]}}),{code:'CAPABILITY_POLICY_REFUSED'});
  assert.equal(await mountReads(f,{port:f.mount({sourceEnabled:false})}),null);
  assert.equal(f.wire.length,0);assert.equal(f.state.reservations.size,0);
 });
 if(['facility-representation','district-nexus'].includes(family))test(`${id}: a client-looking model selector cannot open the SDK family without a run client scope`,()=>{
  const scene=nativeFamilyCase(family,id),operation=scene.operation;
  const gates=resolveAvailableReads({policy:{generalReads:true,readFamilies:[family]},installation:{operations:[operation]},discovery:{operations:[operation]},scopes:[{kind:'private-user'}]});
  assert.equal(gates.available.some(row=>row.operation.id===id),false);assert.equal(scene.wire.length,0);
 });
}

test('supported global-query default date is bridged from captured context and SQL stays out of MCP output',async()=>{
 const scene=nativeFamilyCase('public-domain-query','query_global_data',{request:{dataset:'lda_registrations',select:[{field:'registrant_name'}],limit:2}});
 const f=await durableFamilyFixture(scene),m=await mountReads(f);assert.notEqual(m,null);
 try{
  const out=await m.call(f.operation.id,f.arguments);assert.equal(out.isError,undefined);
  const value=JSON.parse(out.content[0].text),normalized=f.contract.normalizeInput(f.arguments,f.normalizationContext);
  assert.notEqual(f.normalizationContext.defaultAsOf,null);assert.equal(f.wire[0].body.asOfDate,normalized.input.asOfDate);
  assert.equal(Object.hasOwn(f.arguments,'asOfDate'),false);assert.equal(Object.hasOwn(value.result,'sql'),false);
  assert.equal(value.argumentsSha256,normalized.argumentsSha256);assert.equal(m.runtime.receipts()[0].resultSha256,hash(value));
 }finally{await m.close();}
});
