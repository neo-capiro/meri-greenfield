/** Actual meri_reads MCP server over synthetic HTTP/scripted SQL; no SDK model query. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {advertisedArguments} from '../schema.mjs';
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {directoryCase,ids,requests} from '../../../../gateway/sources/legislative-directory/test/fixture.mjs';
import {durableFamilyFixture} from '../../../../gateway/general-reads/test/durable-fixture.mjs';
import {mountReads} from './fixture.mjs';
for(const id of ids){
 test(`${id}: canonical schema retains optional literal selectors and excludes authority`,()=>{
  const c=resolveOperationContract({id,version:'0.2.0'}),s=advertisedArguments(c.descriptor.inputSchema);assert.equal(s.mode,'canonical');assert.deepEqual(s.arguments.parse(requests[id]),requests[id]);assert.deepEqual(s.arguments.parse({}),{});
  for(const extra of [{tenantId:'other'},{actorRole:'capiro_admin'},{normalizationContext:{}},{input:{}}])assert.equal(s.arguments.safeParse({...requests[id],...extra}).success,false);
 });
 test(`${id}: installed/discovered MCP tool returns exact carrier and durable receipt`,async()=>{
  const f=await durableFamilyFixture(directoryCase(id)),m=await mountReads(f);
  try{
   assert.deepEqual((await m.client.listTools()).tools.map(t=>t.name),[id]);const result=await m.call(id,f.arguments);assert.equal(result.isError,undefined);
   const carrier=JSON.parse(result.content[0].text);assert.deepEqual(carrier.result,f.page);assert.equal(m.runtime.receipts()[0].resultSha256,hash(carrier));
   assert.equal([...f.state.reservations.values()][0].state,'SETTLED');assert.deepEqual(f.wire[0].body,f.arguments);
  }finally{await m.close();}
 });
 test(`${id}: absent installation/discovery/policy and disabled source create no server`,async()=>{
  const f=await durableFamilyFixture(directoryCase(id));f.state.installRevoked=true;assert.equal(await mountReads(f),null);f.state.installRevoked=false;
  f.state.discoveryMutator=r=>r.operations=[];assert.equal(await mountReads(f),null);f.state.discoveryMutator=undefined;
  assert.equal(await mountReads(f,{policy:{generalReads:false}}),null);assert.equal(await mountReads(f,{port:f.mount({sourceEnabled:false})}),null);assert.equal(f.wire.length,0);assert.equal(f.state.reservations.size,0);
 });
}
