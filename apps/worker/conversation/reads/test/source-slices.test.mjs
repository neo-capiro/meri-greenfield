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
import catalog from '../../../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {assertCapabilityPolicy} from '../../capabilities/policy.mjs';
import {nativeFamilyCase,SOURCE_SLICE_CASES} from '../../../../gateway/general-reads/test/native-family-cases.mjs';
const complete=[['public-data',['query_economic_data']],['client-knowledge-search',['query_knowledge_graph']],['business-development',['get_business_development_context','get_business_development_recent_changes']]];
const completedSourceOperations=new Set(['get_state_bill_status','search_state_floor_votes','search_tracked_bills','search_committee_hearings','search_legislative_research']);
const received=SOURCE_SLICE_CASES.filter(([family,id])=>!completedSourceOperations.has(id)&&!complete.some(([selected,ids])=>selected===family&&ids.includes(id)));
const familyOperations=family=>catalog.operations.filter(row=>resolveOperationContract(row.operation).binding.group===family).map(row=>row.operation);

for (const [family, ids] of complete) {
    if (family === 'client-knowledge-search')
        test('client-knowledge-search: complete family preserves graph and requires client scope only for semantic search', () => {
            const operations = familyOperations(family), expected = ['search_client_knowledge', 'query_knowledge_graph'];
            assert.deepEqual(operations.map(row => row.id), expected);
            assert.equal(READ_FAMILIES[family].operationIds, undefined);
            assert.deepEqual(READ_FAMILIES[family].requiredClientOperations, ['search_client_knowledge']);
            assert.deepEqual(familyReads().filter(row => row.family === family).map(row => row.operation.id), expected);
            const select = scopes => resolveAvailableReads({ policy: { generalReads: true, readFamilies: [family] }, installation: { operations }, discovery: { operations }, scopes });
            assert.deepEqual(select([{ kind: 'client' }]).available.map(row => row.operation.id), expected);
            assert.deepEqual(select([{ kind: 'private-user' }]).available.map(row => row.operation.id), ['query_knowledge_graph']);
        });
    else if (family === 'public-data')
        test('public-data: the complete PR132 family admits economic and both mode reads with no operation filter', () => {
            const operations = familyOperations(family), expected = operations.map(row => row.id);
            assert.deepEqual([...expected].sort(), ['query_economic_data', 'search_federal_awards', 'search_federal_grants']);
            assert.equal(READ_FAMILIES[family].operationIds, undefined);
            assert.deepEqual(familyReads().filter(row => row.family === family).map(row => row.operation.id), expected);
            const gates = resolveAvailableReads({ policy: { generalReads: true, readFamilies: [family] }, installation: { operations }, discovery: { operations }, scopes: [{ kind: 'private-user' }] });
            assert.deepEqual(gates.available.map(row => row.operation.id), expected);
        });
    else {
        test(`${family}: optional context/change reads retain a separate selected-client evidence requirement`, () => {
            const operations = familyOperations(family), evidence = 'get_business_development_evidence', expected = [ids[0], evidence, ids[1]];
            assert.deepEqual(READ_FAMILIES[family].operationIds, [...ids, evidence]);
            assert.deepEqual(READ_FAMILIES[family].requiredClientOperations, [evidence]);
            assert.deepEqual(familyReads().filter(row => row.family === family).map(row => row.operation.id), expected);
            const select = scopes => resolveAvailableReads({ policy: { generalReads: true, readFamilies: [family] }, installation: { operations }, discovery: { operations }, scopes });
            assert.deepEqual(select([{ kind: 'client' }]).available.map(row => row.operation.id), expected);
            assert.deepEqual(select([{ kind: 'private-user' }]).available.map(row => row.operation.id), ids);
        });
    }
    for (const id of ids) {
        test(`${id}: SDK arguments use the frozen raw contract and refuse model authority or normalization context`, () => {
            const f = nativeFamilyCase(family, id), schema = advertisedArguments(f.contract.descriptor.inputSchema);
            assert.equal(schema.mode, 'canonical');
            assert.deepEqual(schema.arguments.parse(f.arguments), f.arguments);
            for (const extra of [{ tenantId: 'foreign' }, { normalizationContext: {} }, { actorRole: 'capiro_admin' }, { input: f.arguments }])
                assert.equal(schema.arguments.safeParse({ ...f.arguments, ...extra }).success, false);
        });
    }
}
test('received source slices require current installation and discovery despite registry presence', () => {
    assert.deepEqual(received.map(([, id]) => id).sort(), ['get_legal_reference', 'query_outreach', 'search_legiwatch_news', 'search_research_sources']);
    assert.equal(received.some(([family]) => family === 'funding-opportunities'), false, 'funding retains separate complete-family coverage');
    for (const [family, id] of received) {
        const operation = { id, version: '0.2.0' }, policy = { generalReads: true, readFamilies: [family] }, scopes = [{ kind: 'client' }];
        assertCapabilityPolicy(policy);
        assert.equal(familyReads().some(row => row.operation.id === id), true);
        const select = (installation, discovery) => resolveAvailableReads({ policy, installation: { operations: installation }, discovery: { operations: discovery }, scopes });
        assert.deepEqual(select([operation], [operation]).available.map(row => row.operation), [operation]);
        assert.deepEqual(select([], [operation]).available, []);
        assert.deepEqual(select([operation], []).available, []);
    }
});
test('operation filters cannot name duplicate, unknown, foreign or empty operation sets', () => {
    for (const operationIds of [[], ['query_economic_data', 'query_economic_data'], ['missing'], ['query_knowledge_graph'], ['propose_task']]) {
        assert.throws(() => familyReads({ 'public-data': { clientScope: 'optional', operationIds } }), { message: 'READ_FAMILY_CONFIGURATION' });
    }
});

for(const [family,ids] of complete)for(const id of ids)test(`${id}: current MCP source bytes and receipt agree without a reservation ledger`,async t=>{
 const f=await fixture(family,id),m=await connect(t,f),out=await m.call();assert.equal(out.isError,undefined);const value=JSON.parse(out.content[0].text);assert.deepEqual(value.result,f.scene.state.nativeValue);assert.equal(m.runtime.receipts()[0].resultSha256,hash(value));assert.equal(f.scene.wire.length,1);
});
