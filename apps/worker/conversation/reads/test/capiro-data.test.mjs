/** Real SDK MCP -> worker -> control -> native HTTP receiver; only Core and identity are synthetic. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {selectSkill} from '../../../../../packages/skills/index.mjs';
import {fixture} from '../../../../runtime/test/reads-native-fixture.mjs';
import {capiroDataCase,ids} from '../../../../gateway/sources/capiro-data/test/fixture.mjs';
import {connect} from './native-mcp-fixture.mjs';
import {advertisedArguments} from '../schema.mjs';
import {assertNativeReadResponse} from '../../../../../packages/contracts/runtime-0.2/reads.mjs';

for(const id of ids){
  test(`${id}: actual MCP carries exact authored input, bounded typed output and correlated receipt`,async t=>{
    const scene=capiroDataCase(id),f=await fixture('capiro-data',id,{scene,privateUser:true}),m=await connect(t,f);
    assert.ok(m);assert.deepEqual((await m.client.listTools()).tools.map(tool=>tool.name),[id]);
    const out=await m.call();assert.equal(out.isError,undefined,JSON.stringify(out));
    const envelope=JSON.parse(out.content[0].text);assert.deepEqual(envelope.result,scene.page);assert.deepEqual(scene.wire[0].body,scene.arguments);
    assert.equal(m.runtime.receipts()[0].resultSha256,canonicalSha256(envelope));assert.equal(scene.wire.length,1);
  });
  test(`${id}: exposed schema accepts raw request and refuses model authority`,()=>{
    const scene=capiroDataCase(id),schema=advertisedArguments(scene.contract.descriptor.inputSchema);
    assert.deepEqual(schema.arguments.parse(scene.arguments),scene.arguments);
    for(const extra of [{tenantId:'foreign'},{normalizationContext:{}},{database:'private'},{endpoint:'https://foreign.invalid'}])assert.equal(schema.arguments.safeParse({...scene.arguments,...extra}).success,false);
  });
}
test('row and byte truncation remain independent through the mounted receiving boundary',async t=>{
  for(const [rowLimitReached,byteTruncated] of [[false,false],[true,false],[false,true],[true,true]]){
    const scene=capiroDataCase();scene.page.rowLimitReached=rowLimitReached;scene.page.byteTruncated=byteTruncated;
    if(byteTruncated){scene.page.rows.pop();scene.page.rowCount=1;}
    const f=await fixture('capiro-data','query_capiro_data',{scene}),m=await connect(t,f),out=await m.call();
    assert.equal(out.isError,undefined,JSON.stringify(out));const result=JSON.parse(out.content[0].text).result;
    assert.equal(result.rowLimitReached,rowLimitReached);assert.equal(result.byteTruncated,byteTruncated);assert.equal(result.rowCount,result.rows.length);
  }
});
test('current revocation and Core denial publish no result receipt',async t=>{
  for(const action of ['revoke','deny']){
    const scene=capiroDataCase(),f=await fixture('capiro-data','query_capiro_data',{scene}),m=await connect(t,f);f[action]();
    assert.equal((await m.call()).isError,true);assert.deepEqual(m.runtime.receipts(),[]);assert.equal(scene.wire.length,0);
  }
});
test('malformed numeric result cannot become model evidence or a completion receipt',async t=>{
  const scene=capiroDataCase();scene.state.resultMutator=page=>page.rows[0].total=100.1;
  const f=await fixture('capiro-data','query_capiro_data',{scene}),m=await connect(t,f);
  assert.equal((await m.call()).isError,true);assert.deepEqual(m.runtime.receipts(),[]);
});
test('actual control response rejects stale binding, request digest and changed result at the canonical HTTP receiver',async()=>{
  const scene=capiroDataCase(),f=await fixture('capiro-data','query_capiro_data',{scene}),availability=await f.port.readAvailability();
  const response=await f.execute();assert.equal(response.status,200);const value=await response.json();
  const request={schemaVersion:'meri-native-general-reads/1',binding:f.binding,operation:f.operation,arguments:scene.arguments,deliveryId:'synthetic',installationId:availability.installation.installationId,executionCatalogSha256:availability.installation.executionCatalogSha256};
  const check=raw=>assertNativeReadResponse('runner/reads/execute',raw,{request,started:f.now(),now:f.now,maxResponseBytes:1048576});
  assert.deepEqual(check(value),value);
  for(const mutate of [r=>r.binding.writerFence++,r=>r.inputSha256='0'.repeat(64),r=>r.deliveryId='other',r=>r.resultSha256='0'.repeat(64)]){
    const changed=structuredClone(value);mutate(changed);assert.throws(()=>check(changed));
  }
});
test('existing selected PE skill remains narrowed and disabled policy exposes no SQL server',async t=>{
  const scene=capiroDataCase(),f=await fixture('capiro-data','query_capiro_data',{scene});
  assert.equal(await connect(t,f,{skill:selectSkill('quick_skill.pe_deep_dive','1.0.0').manifest}),null);
  assert.equal(await connect(t,f,{policy:{generalReads:false}}),null);assert.deepEqual(scene.wire,[]);
});
