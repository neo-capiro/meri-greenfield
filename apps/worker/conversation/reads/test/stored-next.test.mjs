/** New stored-family MCP exposure over actual gateway owners and synthetic HTTP/SQL. No model/Core calls. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {advertisedArguments} from '../schema.mjs';
import {nativeFamilyCase,NATIVE_FAMILY_CASES} from '../../../../gateway/general-reads/test/native-family-cases.mjs';
import {durableFamilyFixture} from '../../../../gateway/general-reads/test/durable-fixture.mjs';
import {mountReads} from './fixture.mjs';
const families=['pe-references','federal-legislation','state-legislation','stored-intelligence','regulatory-dockets','intelligence-summary'];
for(const [family,id] of NATIVE_FAMILY_CASES.filter(([family])=>families.includes(family))){
 test(`${id}: canonical schema preserves literal input while refusing model context/authority`,()=>{
  const f=nativeFamilyCase(family,id),schema=advertisedArguments(f.contract.descriptor.inputSchema);assert.equal(schema.mode,'canonical');assert.deepEqual(schema.arguments.parse(f.arguments),f.arguments);
  for(const extra of [{tenantId:'foreign'},{actorRole:'capiro_admin'},{normalizationContext:{}},{defaultCongress:119},{input:f.arguments}])assert.equal(schema.arguments.safeParse({...f.arguments,...extra}).success,false);
 });
 test(`${id}: measured installation plus discovery exposes one MCP tool with an exact settled receipt`,async()=>{
  const f=await durableFamilyFixture(nativeFamilyCase(family,id)),m=await mountReads(f);
  try{assert.deepEqual((await m.client.listTools()).tools.map(tool=>tool.name),[id]);const out=await m.call(id,f.arguments);assert.equal(out.isError,undefined);const value=JSON.parse(out.content[0].text);assert.deepEqual(value.result,JSON.parse(JSON.stringify(f.page)));assert.equal(m.runtime.receipts()[0].resultSha256,hash(value));assert.equal([...f.state.reservations.values()][0].state,'SETTLED');
   for(const suffix of ['native-handler.mjs','native-families.mjs','native-read-credentials/owner.mjs'])assert.ok(f.handlers.get(`${id}@0.2.0`).sourceFiles.some(row=>row.label.endsWith(suffix)),suffix);
  }finally{await m.close();}
 });
 test(`${id}: source, installation, discovery and family policy remain mandatory`,async()=>{
  const f=await durableFamilyFixture(nativeFamilyCase(family,id));f.state.installRevoked=true;assert.equal(await mountReads(f),null);f.state.installRevoked=false;f.state.discoveryMutator=row=>row.operations=[];assert.equal(await mountReads(f),null);f.state.discoveryMutator=undefined;
  assert.equal(await mountReads(f,{policy:{generalReads:true,readFamilies:['mail']}}),null);await assert.rejects(mountReads(f,{policy:{generalReads:true,readFamilies:[]}}),{code:'CAPABILITY_POLICY_REFUSED'});assert.equal(await mountReads(f,{port:f.mount({sourceEnabled:false})}),null);assert.equal(f.wire.length,0);assert.equal(f.state.reservations.size,0);
 });
}
