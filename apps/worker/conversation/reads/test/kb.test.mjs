/** Actual SDK MCP and control/Core transport; only external Core and execution identity are synthetic.
 * Removed proxy grants/reservation ledgers are covered by their replacements in native-control.test.mjs. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {familyReads,resolveAvailableReads} from '../availability.mjs';
import {READ_FAMILIES,READ_FAMILY_IDS} from '../families.mjs';
import {advertisedArguments} from '../schema.mjs';
import {fixture,uuid} from '../../../../runtime/test/reads-native-fixture.mjs';
import {connect} from './native-mcp-fixture.mjs';
import {storedCase,searchId,id as graphId} from '../../../../gateway/sources/client-knowledge-search/test/fixture.mjs';
import {NATIVE_READ_OBSERVATION_HEADER as HEADER} from '../../../../../packages/contracts/native-read-observation-0.2/validate.mjs';
const family='client-knowledge-search',operations=[searchId,graphId].map(id=>({id,version:'0.2.0'}));

test('KB SDK: graph and semantic search are discoverable in General with explicit source selectors', () => {
    assert.equal(familyReads().length, 84);
    assert.equal(READ_FAMILY_IDS.length, 48);
    assert.equal(READ_FAMILIES[family].clientScope, 'optional');
    assert.equal(READ_FAMILIES[family].operationIds, undefined);
    assert.equal(READ_FAMILIES[family].requiredClientOperations, undefined);
    assert.deepEqual(familyReads().filter(row => row.family === family).map(row => row.operation), operations);
    const overclaimed = [...operations, { id: 'get_business_development_evidence', version: '0.2.0' }];
    const select = scopes => resolveAvailableReads({ policy: { generalReads: true, readFamilies: [family] }, installation: { operations: overclaimed }, discovery: { operations: overclaimed }, scopes });
    assert.deepEqual(select([{ kind: 'client' }]).available.map(row => row.operation), operations);
    for (const scopes of [[], [{ kind: 'tenant' }], [{ kind: 'private-user' }]])
        assert.deepEqual(select(scopes).available.map(row => row.operation), operations);
});
test('KB SDK: semantic literal schema refuses model context, authority and carrier fields', () => {
    const f = storedCase(searchId), schema = advertisedArguments(f.contract.descriptor.inputSchema);
    assert.equal(schema.mode, 'canonical');
    assert.deepEqual(schema.arguments.parse(f.arguments), f.arguments);
    for (const extra of [{ asOf: f.normalizationContext.asOf }, { normalizationContext: f.normalizationContext }, { tenantId: f.authority.binding.tenantId },
        { subject: f.authority.subject }, { [HEADER]: 'forged' }, { input: f.arguments }])
        assert.equal(schema.arguments.safeParse({ ...f.arguments, ...extra }).success, false);
});

for(const branch of ['available','empty','unavailable'])test(`KB MCP semantic ${branch}: native result remains honest through the SDK`,async t=>{
 const f=await fixture(family,searchId,{knowledgePageOptions:{empty:branch==='empty',unavailable:branch==='unavailable'}}),m=await connect(t,f),out=await m.call();assert.equal(out.isError,undefined);
 const value=JSON.parse(out.content[0].text);assert.deepEqual(value.result,f.scene.state.nativeValue);assert.equal(value.result.results.length,branch==='available'?1:0);
 if(branch==='unavailable')assert.match(value.result.note,/temporarily unavailable/);assert.equal(m.runtime.receipts()[0].resultSha256,hash(value));
});
test('KB MCP graph: personal context works without a semantic carrier or client tool',async t=>{
 const f=await fixture(family,graphId,{privateUser:true}),m=await connect(t,f),out=await m.call();assert.equal(out.isError,undefined);assert.deepEqual((await m.client.listTools()).tools.map(x=>x.name),[graphId]);assert.equal(f.scene.wire[0].options.headers[HEADER],undefined);
});
test('KB MCP semantic: source timestamp substitution cannot become an accepted result',async t=>{
 const f=await fixture(family,searchId);f.scene.state.resultMutator=v=>{v.generatedAt='2001-01-01T00:00:00.000Z';};const m=await connect(t,f),out=await m.call();assert.equal(out.isError,true);assert.deepEqual(m.runtime.receipts(),[]);
});
