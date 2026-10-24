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
import {validateShape as validateReadShape} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {canonicalInputSchema} from '../schema.mjs';
import {nativeFamilyCase,GOVERNED_NEXT_FAMILY_CASES} from '../../../../gateway/general-reads/test/native-family-cases.mjs';

test('new read fixtures enumerate exactly thirteen operations across seven canonical families', () => {
    assert.equal(GOVERNED_NEXT_FAMILY_CASES.length, 13);
    assert.equal(new Set(GOVERNED_NEXT_FAMILY_CASES.map(([family]) => family)).size, 7);
    assert.equal(new Set(GOVERNED_NEXT_FAMILY_CASES.map(([, id]) => id)).size, 13);
});
test('data-search advertises raw requests while preserving its separate normalized input boundary', () => {
    const f = nativeFamilyCase('data-search', 'search_capiro_data');
    const normalized = f.contract.normalizeInput(f.arguments, {}), canonical = canonicalInputSchema(f.contract.descriptor.inputSchema);
    assert.deepEqual(canonical.required, ['query', 'domains']);
    assert.equal(Object.hasOwn(f.arguments, 'window'), false);
    assert.equal(Object.hasOwn(normalized.input, 'window'), true);
    assert.doesNotThrow(() => validateReadShape(f.contract.binding.input, f.arguments));
    assert.doesNotThrow(() => validateReadShape('DataSearchInput', normalized.input));
    assert.throws(() => validateReadShape(f.contract.binding.input, normalized.input));
    assert.throws(() => f.contract.normalizeInput({ ...f.arguments, window: normalized.input.window }, {}));
    assert.throws(() => f.contract.normalizeInput(normalized.input, {}));
    assert.deepEqual(advertisedArguments(f.contract.descriptor.inputSchema).arguments.parse(f.arguments), f.arguments);
    assert.equal(familyReads().some(row => row.operation.id === 'search_capiro_data'), true);
});
for (const [family, id] of GOVERNED_NEXT_FAMILY_CASES) {
    test(`${id}: SDK schema preserves original literal selectors and refuses model authority/context`, () => {
        const f = nativeFamilyCase(family, id), schema = advertisedArguments(f.contract.descriptor.inputSchema);
        assert.equal(schema.mode, 'canonical');
        assert.deepEqual(schema.arguments.parse(f.arguments), f.arguments);
        for (const extra of [{ tenantId: 'foreign' }, { actorRole: 'capiro_admin' }, { normalizationContext: {} }, { defaultAsOf: '2026-10-12T00:00:00.000Z' }, { input: f.arguments }]) {
            assert.equal(schema.arguments.safeParse({ ...f.arguments, ...extra }).success, false);
        }
    });
    if (['facility-representation', 'district-nexus'].includes(family))
        test(`${id}: a client-looking model selector cannot open the SDK family without a run client scope`, () => {
            const scene = nativeFamilyCase(family, id), operation = scene.operation;
            const gates = resolveAvailableReads({ policy: { generalReads: true, readFamilies: [family] }, installation: { operations: [operation] }, discovery: { operations: [operation] }, scopes: [{ kind: 'private-user' }] });
            assert.equal(gates.available.some(row => row.operation.id === id), false);
            assert.equal(scene.wire.length, 0);
        });
}

for(const [family,id] of GOVERNED_NEXT_FAMILY_CASES)test(`${id}: actual MCP retains native trust labels and source receiving`,async t=>{
 const f=await fixture(family,id),m=await connect(t,f),out=await m.call();assert.equal(out.isError,undefined);const value=JSON.parse(out.content[0].text);assert.equal(m.runtime.receipts()[0].resultSha256,hash(value));
 if(family==='public-domain-query')assert.equal(Object.hasOwn(value.result,'sql'),false);
 if(id==='search_public_web')assert.equal(value.result.contentStatus,'discovered');
 if(id==='scrape_web_page')assert.equal(value.result.trust,'external_untrusted');
});
test('global-query MCP: captured default date reaches Core while SQL stays out of results',async t=>{
 const scene=nativeFamilyCase('public-domain-query','query_global_data',{request:{dataset:'lda_registrations',select:[{field:'registrant_name'}],limit:2}}),f=await fixture('public-domain-query','query_global_data',{scene}),m=await connect(t,f),out=await m.call();assert.equal(out.isError,undefined,JSON.stringify(out));
 const value=JSON.parse(out.content[0].text);assert.equal(Object.hasOwn(scene.arguments,'asOfDate'),false);assert.equal(typeof scene.wire[0].body.asOfDate,'string');assert.equal(Object.hasOwn(value.result,'sql'),false);assert.equal(m.runtime.receipts()[0].resultSha256,hash(value));
});
