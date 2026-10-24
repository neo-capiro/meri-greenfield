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
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {MODE_READ_OPERATIONS,decodeNativeReadObservation,NATIVE_READ_OBSERVATION_HEADER as HEADER} from '../../../../../packages/contracts/native-read-observation-0.2/validate.mjs';
import {storedCase as publicCase} from '../../../../gateway/sources/public-data/test/fixture.mjs';
import {storedCase as programCase} from '../../../../gateway/sources/program-elements/test/fixture.mjs';
const families={'public-data':['query_economic_data','search_federal_grants','search_federal_awards'],'program-elements':['search_program_elements','get_program_element','get_pe_budget_timeline']};
const familyOf=id=>resolveOperationContract({id,version:'0.2.0'}).binding.group;
const sceneFor=(id,mode='off')=>(familyOf(id)==='public-data'?publicCase:programCase)(id,{evidenceAccuracyMode:mode});

test('mode SDK source policy derives81/45 and keeps public/program families optional with exact canonical operations', () => {
    assert.equal(familyReads().length, 81);
    assert.equal(READ_FAMILY_IDS.length, 45);
    for (const [family, ids] of Object.entries(families)) {
        assert.equal(READ_FAMILIES[family].clientScope, 'optional');
        assert.deepEqual(familyReads().filter(row => row.family === family).map(row => row.operation.id).sort(), [...ids].sort());
        const operations = [...MODE_READ_OPERATIONS, 'get_legal_reference', 'get_business_development_evidence'].map(id => ({ id, version: '0.2.0' }));
        for (const scopes of [[], [{ kind: 'private-user' }], [{ kind: 'client' }]])
            assert.deepEqual(resolveAvailableReads({ policy: { generalReads: true, readFamilies: [family] }, installation: { operations }, discovery: { operations }, scopes }).available.map(row => row.operation.id).sort(), ids.filter(id => MODE_READ_OPERATIONS.includes(id)).sort());
    }
    for (const id of ['get_legal_reference', 'get_business_development_evidence'])
        assert.equal(familyReads().some(row => row.operation.id === id), true);
    assert.throws(() => familyReads({ 'public-data': { clientScope: 'optional', operationIds: ['search_program_elements'] } }), /READ_FAMILY_CONFIGURATION/u);
    assert.throws(() => familyReads({ 'program-elements': { clientScope: 'optional', operationIds: ['search_federal_grants'] } }), /READ_FAMILY_CONFIGURATION/u);
});
for (const id of MODE_READ_OPERATIONS) {
    test(`mode SDK ${id}: literal schema excludes caller mode, context, private carrier and authority`, () => {
        const f = sceneFor(id), schema = advertisedArguments(f.contract.descriptor.inputSchema);
        assert.equal(schema.mode, 'canonical');
        assert.deepEqual(schema.arguments.parse(f.arguments), f.arguments);
        for (const extra of [{ evidenceAccuracyMode: 'enforce' }, { surface: 'chat' }, { normalizationContext: f.normalizationContext }, { tenantId: f.authority.binding.tenantId }, { [HEADER]: 'forged' }, { input: f.arguments }])
            assert.equal(schema.arguments.safeParse({ ...f.arguments, ...extra }).success, false);
    });
}

for(const id of MODE_READ_OPERATIONS)for(const mode of ['off','shadow','enforce'])test(`mode MCP ${id}/${mode}: Core mode and literal body reach the actual source and SDK`,async t=>{
 const f=await fixture(familyOf(id),id,{scene:sceneFor(id,mode),evidenceAccuracyMode:mode}),m=await connect(t,f),out=await m.call();assert.equal(out.isError,undefined,JSON.stringify(out));
 const value=JSON.parse(out.content[0].text),wire=f.scene.wire[0],context=decodeNativeReadObservation(wire.options.headers[HEADER],{operation:f.operation,request:wire.body}).context;
 assert.deepEqual(context,{evidenceAccuracyMode:mode});assert.deepEqual(wire.body,f.scene.arguments);assert.deepEqual(value.result,f.scene.state.nativeValue);assert.equal(m.runtime.receipts()[0].resultSha256,hash(value));
});
test('mode MCP: economic data has no mode carrier or mode lookup',async t=>{
 const f=await fixture('public-data','query_economic_data'),m=await connect(t,f),out=await m.call();assert.equal(out.isError,undefined);assert.equal(f.scene.wire[0].options.headers[HEADER],undefined);assert(!f.calls.some(p=>p.endsWith('/read-mode-observation')));
});
