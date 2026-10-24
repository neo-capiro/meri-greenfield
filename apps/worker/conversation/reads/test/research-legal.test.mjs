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
import {storedCase} from '../../../../gateway/sources/research-legal-legislation/test/fixture.mjs';
const family='research-legal-legislation',id='search_legislative_research',referenceId='get_legal_reference',clientId=uuid('d');
const operation={id,version:'0.2.0'},sibling={id:referenceId,version:'0.2.0'},name='Synthetic Research Client';
const requests={global:{sessionKey:'2026',query:'water'},client:{sessionKey:'2026',query:'water',clientId,folderId:'synthetic-folder'},named:{sessionKey:'2026',query:'water',clientId:`  ${name}  `,folderId:'synthetic-folder'}};
function sceneFor(branch='global'){return storedCase(id,{request:requests[branch],...(branch==='named'?{context:{clientResolution:{reference:name,clientId},citationResolution:null}}:{})});}

test('legal SDK81/45: optional family exposes search and the bounded reference read only under current gates', () => {
    assert.equal(familyReads().length, 81);
    assert.equal(READ_FAMILY_IDS.length, 45);
    assert.equal(READ_FAMILIES[family].clientScope, 'optional');
    assert.deepEqual(READ_FAMILIES[family].operationIds, [id, referenceId]);
    assert.deepEqual(familyReads().filter(row => row.family === family).map(row => row.operation), [operation, sibling]);
    for (const scopes of [[{ kind: 'private-user' }], [{ kind: 'client' }]]) {
        const result = resolveAvailableReads({ policy: { generalReads: true, readFamilies: [family] }, installation: { operations: [operation, sibling] }, discovery: { operations: [sibling, operation] }, scopes });
        assert.deepEqual(result.available.map(row => row.operation), [operation, sibling]);
        assert.deepEqual(resolveAvailableReads({ policy: { generalReads: true, readFamilies: [family] }, installation: { operations: [operation] }, discovery: { operations: [operation, sibling] }, scopes }).available.map(row => row.operation), [operation]);
    }
    assert.equal(familyReads().some(row => row.operation.id === referenceId), true);
});
test('legal SDK: literal search schema admits no model resolution, current authority or nested request', () => {
    const f = sceneFor(), schema = advertisedArguments(f.contract.descriptor.inputSchema);
    assert.equal(schema.mode, 'canonical');
    assert.deepEqual(schema.arguments.parse(f.arguments), f.arguments);
    for (const extra of [{ normalizationContext: f.normalizationContext }, { clientResolution: { reference: name, clientId } }, { citationResolution: null }, { tenantId: f.authority.binding.tenantId }, { input: f.arguments }])
        assert.equal(schema.arguments.safeParse({ ...f.arguments, ...extra }).success, false);
});

for(const branch of ['global','client','named'])test(`legal MCP ${branch}: actual current source preserves selectors and receipt`,async t=>{
 const f=await fixture(family,id,{scene:sceneFor(branch)}),m=await connect(t,f),out=await m.call();assert.equal(out.isError,undefined,JSON.stringify(out));
 const value=JSON.parse(out.content[0].text);assert.deepEqual(value.result,f.scene.state.nativeValue);assert.equal(m.runtime.receipts()[0].resultSha256,hash(value));
 if(branch==='named'){assert(f.calls.some(p=>p.endsWith('/clients/check-ref')));assert.equal(f.scene.wire[0].body.clientId,clientId);}else assert.deepEqual(f.scene.wire[0].body,requests[branch]);
});
for(const status of [403,404,409])test(`legal MCP named: Core reference refusal ${status} never dispatches legal data`,async t=>{
 const f=await fixture(family,id,{scene:sceneFor('named')});f.referenceStatus(status);const m=await connect(t,f),out=await m.call();assert.equal(out.isError,true);assert.equal(f.scene.wire.length,0);assert.deepEqual(m.runtime.receipts(),[]);
});
