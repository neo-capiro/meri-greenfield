import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixture} from '../../../../runtime/test/reads-native-fixture.mjs';
import {capiroDataCase} from '../../../../gateway/sources/capiro-data/test/fixture.mjs';
import {connect} from './native-mcp-fixture.mjs';
import {profileReads,resolveAvailableReads} from '../availability.mjs';
import {advertisedArguments} from '../schema.mjs';
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
const vectors=JSON.parse(readFileSync(new URL('../../../../../packages/contracts/test/capiro-data-domain-producer-vectors.json',import.meta.url)));
for(const id of ['describe_capiro_data','query_capiro_data'])test(id+': v5 SDK exposes source only; all authority stays out of model arguments',()=>{
 const contract=resolveOperationContract({id,version:'0.5.0'}),schema=advertisedArguments(contract.descriptor.inputSchema).arguments;
 for(const source of ['research_portfolio','classic_outreach']){
  const request=id==='describe_capiro_data'?{source}:{source,sql:'SELECT COUNT(*) AS total FROM research_portfolio_members',parameters:[]};
  assert.deepEqual(schema.parse(request),request);
  for(const extra of [{clientId:'00000000-0000-4000-8000-000000000001'},{researchPortfolioId:'00000000-0000-4000-8000-000000000001'},{scopeVersion:'a'.repeat(64)},{eligibleIds:[]},{normalizationContext:{}},{capiroDataScope:{}}])assert.equal(schema.safeParse({...request,...extra}).success,false);
  for(const version of ['0.2.0','0.3.0','0.4.0'])assert.equal(advertisedArguments(resolveOperationContract({id,version}).descriptor.inputSchema).arguments.safeParse(request).success,false);
 }
});
test('Classic actual SDK/Control/native receiver accepts Core-produced v5 response unchanged',async t=>{
 const request={source:'classic_outreach',sql:'SELECT COUNT(*) AS total FROM classic_outreach_records',parameters:[]};
 const scene=capiroDataCase('query_capiro_data',{version:'0.5.0',request});
 for(const key of Object.keys(scene.page))delete scene.page[key];Object.assign(scene.page,structuredClone(vectors.classic.query));
 const f=await fixture(scene.family,'query_capiro_data',{scene,privateUser:true}),m=await connect(t,f);
 assert.ok(m);assert.deepEqual((await m.client.listTools()).tools.map(tool=>tool.name),['query_capiro_data']);
 const out=await m.call();assert.equal(out.isError,undefined,JSON.stringify(out));assert.equal(out.denied,undefined,JSON.stringify(out));
 const envelope=JSON.parse(out.content[0].text);assert.equal(envelope.operation.version,'0.5.0');assert.deepEqual(envelope.result,vectors.classic.query);assert.deepEqual(scene.wire[0].body,request);assert.equal(m.runtime.receipts().length,1);
});
test('four installations select v5 once and preserve exact saved pins without denied-discovery fallback',()=>{
 const refs=['0.2.0','0.3.0','0.4.0','0.5.0'].map(version=>({id:'describe_capiro_data',version}));
 const policy={generalReads:true,readFamilies:['capiro-data','capiro-data-v3','capiro-data-v4','capiro-data-v5'],activeReadOperations:refs};
 const input={policy,installation:{operations:refs},discovery:{operations:refs},scopes:[]};
 assert.deepEqual(profileReads({policy}).map(r=>r.operation),[refs[3]]);assert.deepEqual(resolveAvailableReads(input).available.map(r=>r.operation),[refs[3]]);
 for(const ref of refs)assert.deepEqual(profileReads({policy,narrowTo:[ref]}).map(r=>r.operation),[ref]);
 assert.deepEqual(resolveAvailableReads({...input,installation:{operations:refs.slice(0,3)}}).available.map(r=>r.operation),[refs[2]]);
 assert.deepEqual(resolveAvailableReads({...input,discovery:{operations:refs.slice(0,3)}}).available,[]);
});
