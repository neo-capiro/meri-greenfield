/** Actual meri_reads MCP server over synthetic Core HTTP; no SDK model query. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {advertisedArguments} from '../schema.mjs';
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {directoryCase,ids,requests} from '../../../../gateway/sources/legislative-directory/test/fixture.mjs';
import {fixture} from '../../../../runtime/test/reads-native-fixture.mjs';
import {connect} from './native-mcp-fixture.mjs';
for(const id of ids){
 test(`${id}: canonical schema retains optional literal selectors and excludes authority`,()=>{
  const c=resolveOperationContract({id,version:'0.2.0'}),s=advertisedArguments(c.descriptor.inputSchema);assert.equal(s.mode,'canonical');assert.deepEqual(s.arguments.parse(requests[id]),requests[id]);assert.deepEqual(s.arguments.parse({}),{});
  for(const extra of [{tenantId:'other'},{actorRole:'capiro_admin'},{normalizationContext:{}},{input:{}}])assert.equal(s.arguments.safeParse({...requests[id],...extra}).success,false);
 });
 test(`${id}: current Core result reaches MCP with an exact completion receipt`,async t=>{
  const f=await fixture('legislative-directory',id,{scene:directoryCase(id)}),m=await connect(t,f);assert.ok(m);
  const result=await m.call();assert.equal(result.isError,undefined);assert.deepEqual((await m.client.listTools()).tools.map(x=>x.name),[id]);
  const value=JSON.parse(result.content[0].text);assert.deepEqual(value.result,JSON.parse(JSON.stringify(f.scene.page)));
  assert.equal(m.runtime.receipts()[0].resultSha256,hash(value));assert.equal(f.calls.filter(p=>p===`/api/clio/tools/${id}`).length,1);
 });
 test(`${id}: current execution and local family policy control availability`,async t=>{
  const f=await fixture('legislative-directory',id,{scene:directoryCase(id)});assert.equal(await connect(t,f,{policy:{generalReads:false}}),null);
  assert.equal(await connect(t,f,{policy:{generalReads:true,readFamilies:['mail']}}),null);
  f.revoke();assert.equal(await connect(t,f),null);assert.equal(f.calls.length,0);
 });
}
