/** Real SDK MCP -> worker -> control -> native HTTP receiver; only Core and identity are synthetic. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {selectSkill} from '../../../../../packages/skills/index.mjs';
import {fixture} from '../../../../runtime/test/reads-native-fixture.mjs';
import {capiroDataCase,ids,sqlRefusal} from '../../../../gateway/sources/capiro-data/test/fixture.mjs';
import {withSqlContract} from '../../../../gateway/sources/capiro-data/test/sql-contract-fixture.mjs';
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
test('a Core SQL refusal reaches the model with its code and message plus fixed correction guidance, and is still receipted',async t=>{
  const scene=capiroDataCase();scene.state.page={version:'0.2.0',generatedAt:scene.page.generatedAt,ok:false,error:{code:'UNKNOWN_FIELD',message:'Unknown or ambiguous published column.'}};
  const f=await fixture('capiro-data','query_capiro_data',{scene}),m=await connect(t,f),out=await m.call();
  assert.equal(out.isError,undefined,JSON.stringify(out));assert.equal(out.content.length,2);
  const envelope=JSON.parse(out.content[0].text);assert.deepEqual(envelope.result,scene.state.page);
  assert.match(out.content[1].text,/^Notice: query_capiro_data refused this request with UNKNOWN_FIELD\. Use column names exactly as describe_capiro_data lists them/);
  assert.equal(m.runtime.receipts()[0].resultSha256,canonicalSha256(envelope));
});
test('a Core 362 refusal reaches the model with PostgreSQL diagnostics rendered after the fixed notice, and its result passes unchanged',async t=>{
  const scene=capiroDataCase();scene.state.page=sqlRefusal();
  const f=await fixture('capiro-data','query_capiro_data',{scene}),m=await connect(t,f),out=await m.call();
  assert.equal(out.isError,undefined,JSON.stringify(out));assert.equal(out.content.length,2);
  const envelope=JSON.parse(out.content[0].text);assert.deepEqual(envelope.result,scene.state.page);
  assert.match(out.content[1].text,/ PostgreSQL 42703: column b\.titel does not exist at character 8\. Hint: Perhaps you meant "b\.title"\. Did you mean: title\. /);
  assert.equal(m.runtime.receipts()[0].resultSha256,canonicalSha256(envelope));
});
test('a successful query carries a separate count line that names truncation without touching the canonical bytes',async t=>{
  const scene=capiroDataCase();scene.page.rowLimitReached=true;
  const f=await fixture('capiro-data','query_capiro_data',{scene}),m=await connect(t,f),out=await m.call();
  assert.equal(out.isError,undefined,JSON.stringify(out));assert.equal(out.content.length,2);
  assert.deepEqual(JSON.parse(out.content[0].text).result,scene.page);
  assert.equal(out.content[1].text,'Notice: 2 row(s) returned of rowLimit 2 from program_elements. rowLimitReached: more rows matched; narrow the filters, aggregate, or page by keyset (ORDER BY the full key, WHERE key > $n).');
  assert.equal(m.runtime.receipts()[0].resultSha256,canonicalSha256(JSON.parse(out.content[0].text)));
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

for(const id of ids)test(`${id}: private wire uses one existing SDK tool name and preserves exact scope and cells`,async t=>{
  const request=id==='describe_capiro_data'?{source:'client_records',relations:['client_objectives']}:
    {source:'client_records',sql:'SELECT COUNT(*) AS total FROM client_objectives',parameters:[],rowLimit:2};
  const scene=capiroDataCase(id,{request}),f=await fixture('capiro-data',id,{scene,privateUser:true}),m=await connect(t,f);
  assert.ok(m);assert.deepEqual((await m.client.listTools()).tools.map(tool=>tool.name),[id]);
  const out=await m.call();assert.equal(out.isError,undefined,JSON.stringify(out));
  const envelope=JSON.parse(out.content[0].text);assert.deepEqual(envelope.result,scene.page);assert.equal(envelope.operation.version,'0.2.0');
  assert.equal(m.runtime.receipts().length,1);assert.equal(scene.wire.length,1);
  assert.ok(scene.wire[0].options.headers['x-meri-read-correlation']);
});

test('Core descriptor reaches the model as current grammar while canonical source and receipt bytes remain exact',async t=>{
 const scene=capiroDataCase('describe_capiro_data');scene.state.page=withSqlContract(scene.page);
 const f=await fixture('capiro-data','describe_capiro_data',{scene}),m=await connect(t,f),out=await m.call();
 assert.equal(out.isError,undefined,JSON.stringify(out));assert.equal(out.content.length,2);
 const envelope=JSON.parse(out.content[0].text);assert.deepEqual(envelope.result,scene.state.page);
 assert.match(out.content[1].text,/Core SQL contract capiro.sql-contract\/1 revision/);
 assert.ok(out.content[1].text.includes(scene.state.page.contract.revisionSha256));
 assert.match(out.content[1].text,/Blocked functions \(exact names\): set_config, pg_sleep,/);
 assert.match(out.content[1].text,/no column-count cap/);assert.match(out.content[1].text,/grants no authority/);
 assert.equal(m.runtime.receipts()[0].resultSha256,canonicalSha256(envelope));
});

for(const version of ['0.2.0','0.3.0'])for(const source of ['public','client_records'])test(`${version} fresh ${source} calls withhold obsolete success and refusal envelopes without receipts`,async t=>{
 for(const ok of [true,false]){
  const request=source==='client_records'?{source,relations:['client_objectives']}:{relations:['program_elements']};
  const scene=capiroDataCase('describe_capiro_data',{version,request});
  scene.state.page=ok?{...scene.page,version:source==='public'?'0.1.0':'0.2.0'}:
   {version:source==='public'?'0.1.0':'0.2.0',generatedAt:scene.page.generatedAt,ok:false,error:{code:'QUERY_TIMEOUT',message:'Synthetic old refusal'}};
  const f=await fixture(scene.family,'describe_capiro_data',{scene,privateUser:true}),m=await connect(t,f),out=await m.call();
  assert.equal(out.isError,true);assert.match(out.content[0].text,/^INVALID_RESULT:/);assert.deepEqual(m.runtime.receipts(),[]);
 }
});
