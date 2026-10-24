/** New stored-family MCP exposure through current control owners and synthetic Core HTTP. No model/Core calls. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {advertisedArguments} from '../schema.mjs';
import {nativeFamilyCase,NATIVE_FAMILY_CASES} from '../../../../gateway/general-reads/test/native-family-cases.mjs';
import {fixture} from '../../../../runtime/test/reads-native-fixture.mjs';
import {connect} from './native-mcp-fixture.mjs';
const families=['pe-references','federal-legislation','state-legislation','stored-intelligence','regulatory-dockets','intelligence-summary'];
for(const [family,id] of NATIVE_FAMILY_CASES.filter(([family])=>families.includes(family))){
 test(`${id}: canonical schema preserves literal input while refusing model context/authority`,()=>{
  const f=nativeFamilyCase(family,id),schema=advertisedArguments(f.contract.descriptor.inputSchema);assert.equal(schema.mode,'canonical');assert.deepEqual(schema.arguments.parse(f.arguments),f.arguments);
  for(const extra of [{tenantId:'foreign'},{actorRole:'capiro_admin'},{normalizationContext:{}},{defaultCongress:119},{input:f.arguments}])assert.equal(schema.arguments.safeParse({...f.arguments,...extra}).success,false);
 });
 test(`${id}: current Core result reaches MCP with an exact completion receipt`,async t=>{
  const f=await fixture(family,id,{}),m=await connect(t,f);assert.ok(m);
  const result=await m.call();assert.equal(result.isError,undefined);assert.deepEqual((await m.client.listTools()).tools.map(x=>x.name),[id]);
  const value=JSON.parse(result.content[0].text);assert.deepEqual(value.result,JSON.parse(JSON.stringify(f.scene.page)));
  assert.equal(m.runtime.receipts()[0].resultSha256,hash(value));assert.equal(f.calls.filter(p=>p===`/api/clio/tools/${id}`).length,1);
 });
 test(`${id}: current execution and local family policy control availability`,async t=>{
  const f=await fixture(family,id,{});assert.equal(await connect(t,f,{policy:{generalReads:false}}),null);
  assert.equal(await connect(t,f,{policy:{generalReads:true,readFamilies:['mail']}}),null);
  f.revoke();assert.equal(await connect(t,f),null);assert.equal(f.calls.length,0);
 });
}
