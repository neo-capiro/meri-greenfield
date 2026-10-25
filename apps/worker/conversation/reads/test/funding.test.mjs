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
import {storedCase,ids} from '../../../../gateway/sources/funding-opportunities/test/fixture.mjs';
import {decodeNativeReadObservation,NATIVE_READ_OBSERVATION_HEADER as HEADER} from '../../../../../packages/contracts/native-read-observation-0.2/validate.mjs';
const family='funding-opportunities',operations=ids.map(id=>({id,version:'0.2.0'}));

test('funding SDK: the complete five-operation family requires a task client scope despite forged inventories', () => {
    assert.equal(familyReads().length, 84);
    assert.equal(READ_FAMILY_IDS.length, 48);
    assert.equal(READ_FAMILIES[family].clientScope, 'required');
    assert.deepEqual(familyReads().filter(row => row.family === family).map(row => row.operation), operations);
    const overclaimed = [...operations, { id: 'get_business_development_evidence', version: '0.2.0' }, { id: 'search_federal_grants', version: '0.2.0' }];
    const select = scopes => resolveAvailableReads({ policy: { generalReads: true, readFamilies: [family] }, installation: { operations: overclaimed }, discovery: { operations: overclaimed }, scopes });
    assert.deepEqual(select([{ kind: 'client' }]).available.map(row => row.operation), operations);
    for (const scopes of [[], [{ kind: 'tenant' }], [{ kind: 'private-user' }]])
        assert.deepEqual(select(scopes).available, []);
});
for (const id of ids) {
    test(`funding SDK ${id}: canonical literal arguments admit no model context, authority or header`, () => {
        const f = storedCase(id), schema = advertisedArguments(f.contract.descriptor.inputSchema);
        assert.equal(schema.mode, 'canonical');
        assert.deepEqual(schema.arguments.parse(f.arguments), f.arguments);
        for (const extra of [{ asOf: f.normalizationContext.asOf }, { normalizationContext: f.normalizationContext }, { tenantId: f.authority.binding.tenantId }, { subject: f.authority.subject }, { [HEADER]: 'forged' }, { input: f.arguments }])
            assert.equal(schema.arguments.safeParse({ ...f.arguments, ...extra }).success, false);
        const { clientId: ignored, ...noClient } = f.arguments;
        assert.equal(schema.arguments.safeParse(noClient).success, false);
        assert.equal(schema.arguments.safeParse({ ...f.arguments, clientId: 'named client' }).success, false);
    });
}

for(const id of ids){
 test(`funding MCP ${id}: raw request, captured asOf and exact result receipt reach the SDK`,async t=>{
  const f=await fixture(family,id),m=await connect(t,f),result=await m.call();assert.equal(result.isError,undefined);
  const value=JSON.parse(result.content[0].text),wire=f.scene.wire[0];
  assert.deepEqual(wire.body,f.scene.arguments);const context=decodeNativeReadObservation(wire.options.headers[HEADER],{operation:f.operation,request:wire.body}).context;
  assert.equal(value.result.asOf,context.asOf);assert.deepEqual(value.result,f.scene.state.nativeValue);
  assert.equal(value.argumentsSha256,f.scene.contract.normalizeInput(wire.body,context).argumentsSha256);assert.equal(m.runtime.receipts()[0].resultSha256,hash(value));
 });
 test(`funding MCP ${id}: selected-client boundary refuses a different literal client before source`,async t=>{
  const f=await fixture(family,id),m=await connect(t,f),out=await m.call({...f.scene.arguments,clientId:uuid('f')});assert.equal(out.isError,true);assert.equal(f.scene.wire.length,0);assert.deepEqual(m.runtime.receipts(),[]);
 });
}
