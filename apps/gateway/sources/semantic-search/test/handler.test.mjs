import test from 'node:test';
import assert from 'node:assert/strict';
import {semanticCase,VECTORS} from './fixture.mjs';
import {fixture} from '../../../../runtime/test/reads-native-fixture.mjs';
import {connect} from '../../../../worker/conversation/reads/test/native-mcp-fixture.mjs';
import {advertisedArguments} from '../../../../worker/conversation/reads/schema.mjs';
import {familyOperations} from '../../../general-reads/registration.mjs';
import {generalReadTariff} from '../../../budget/general-read-allocation.mjs';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
const IDS=Object.keys(VECTORS);
test('the family mounts exactly the three semantic reads at 0.2.0 with the embedding tariff',()=>{
 assert.deepEqual(familyOperations('semantic-search').map(op=>op.id).sort(),[...IDS].sort());
 for(const id of IDS)assert.equal(generalReadTariff({id,version:'0.2.0'},[]),165);
});
for(const id of IDS)test(`${id}: fixed native route carries the literal request and preserves the Core page`,async()=>{
 const f=semanticCase(id),output=JSON.parse(await f.handler()(f.call()));assert.deepEqual(output.result,f.state.page);
 assert.equal(new URL(f.wire[0].url).pathname,`/api/clio/tools/${id}`);assert.deepEqual(f.wire[0].body,f.arguments);
 assert.equal(f.wire[0].options.method,'POST');assert.equal(f.wire[0].options.redirect,'error');assert.equal(f.wire[0].options.credentials,'omit');
 assert.equal(f.wire[0].options.headers['x-internal-service-secret'],'SYNTHETIC_INTERNAL_SERVICE');assert.equal(f.wire[0].options.headers.authorization,'Bearer SYNTHETIC_NATIVE_USER');
 assert.equal(Object.hasOwn(f.wire[0].options.headers,'x-meri-read-observation'),false);
 const schema=advertisedArguments(f.contract.descriptor.inputSchema);assert.deepEqual(schema.arguments.parse(f.arguments),f.arguments);
 for(const patch of [{tenantId:'forged'},{limit:26},{query:'ab'},{clientId:'00000003-0000-4000-8000-000000000001'}])assert.equal(schema.arguments.safeParse({...f.arguments,...patch}).success,false);
});
test('a filter the family does not apply is refused before any Core call',async()=>{
 const f=semanticCase('semantic_search_grants');
 await assert.rejects(f.handler()({...f.call(),request:{...f.arguments,congress:119}}),error=>error.code==='INVALID_ARGUMENTS'||/INVALID_ARGUMENTS/.test(String(error.message)));
 assert.equal(f.wire.length,0);
});
test('a page that drifts from the request (tool, query, order, filters) is withheld as INVALID_RESULT',async()=>{
 for(const [id,change] of [['semantic_search_bills',value=>{value.tool='semantic_search_grants';}],['semantic_search_bills',value=>{value.query='other';}],
  ['semantic_search_grants',value=>{value.results[0].record.status='closed';}],['semantic_search_contract_opportunities',value=>{value.results[0].record.active=false;}],
  ['semantic_search_bills',value=>{value.total=5;}]]){
  const f=semanticCase(id);f.state.resultMutator=change;
  await assert.rejects(f.handler()(f.call()),error=>error.code==='INVALID_RESULT'||/INVALID_RESULT/.test(String(error.message)));
 }
});
for(const options of [{client:false},{client:true}])test(`SDK current native scope ${JSON.stringify(options)}`,async t=>{
 const scene=semanticCase('semantic_search_bills',options),f=await fixture('semantic-search','semantic_search_bills',{scene}),m=await connect(t,f);
 assert.ok(m);const out=await m.call();assert.equal(out.isError,undefined,JSON.stringify(out));
 const value=JSON.parse(out.content[0].text);assert.deepEqual(value.result,scene.state.page);
 assert.equal(m.runtime.receipts()[0].resultSha256,canonicalSha256(value));
 f.revoke();assert.equal((await m.call()).isError,true);assert.equal(scene.wire.length,1);assert.equal(m.runtime.receipts().length,1);
});
test('current authority loss during a read withholds the page',async t=>{
 const scene=semanticCase('semantic_search_grants',{client:true}),f=await fixture('semantic-search','semantic_search_grants',{scene}),m=await connect(t,f);
 scene.state.afterSource=()=>f.revoke();assert.equal((await m.call()).isError,true);assert.equal(scene.wire.length,1);assert.deepEqual(m.runtime.receipts(),[]);
});
test('the model-facing description names what the read covers, how to cite and when SQL takes over',async t=>{
 const scene=semanticCase('semantic_search_contract_opportunities'),f=await fixture('semantic-search','semantic_search_contract_opportunities',{scene}),m=await connect(t,f);
 const {tools}=await m.client.listTools();const tool=tools.find(row=>row.name==='semantic_search_contract_opportunities');assert.ok(tool);
 assert.match(tool.description,/^Find contract opportunities by meaning\. /);
 assert.match(tool.description,/Covers: Meaning-based discovery of public federal bills, Grants\.gov grants and SAM\.gov contract opportunities/);
 assert.match(tool.description,/stable reference \(congress_bill, federal_grant or sam_opportunity plus id\) to cite/);
 assert.match(tool.description,/total is the page size, never a count/);
 assert.doesNotMatch(tool.description,/Structured questions:/,'a semantic read is not a structured family');
});
