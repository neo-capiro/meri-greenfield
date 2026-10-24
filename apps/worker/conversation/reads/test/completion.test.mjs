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
import {storedCase as stateCase,ids as stateIds} from '../../../../gateway/sources/state-status-votes/test/fixture.mjs';
import {storedCase as trackedCase,id as trackedId} from '../../../../gateway/sources/tracked-bills/test/fixture.mjs';
import {storedCase as hearingCase,id as hearingId} from '../../../../gateway/sources/public-domain-hearings/test/fixture.mjs';
const ids=[...stateIds,trackedId,hearingId],families={'state-status-votes':stateIds,'tracked-bills':[trackedId],'public-domain-hearings':[hearingId]},absent=['read_chat_attachments','get_certification_status','get_state_rule_status','search_sam_opportunities'];
function sceneFor(id,options={}){return (stateIds.includes(id)?stateCase:id===trackedId?trackedCase:hearingCase)(id,options);}

test('completion SDK81/45: the first four completed reads retain the frozen tracked client requirement', () => {
    assert.equal(familyReads().length, 81);
    assert.equal(READ_FAMILY_IDS.length, 45);
    for (const [family, operations] of Object.entries(families)) {
        const rows = familyReads().filter(row => row.family === family);
        assert.deepEqual(rows.map(row => row.operation.id), operations);
        assert.equal(READ_FAMILIES[family].operationIds, undefined);
        assert.equal(READ_FAMILIES[family].clientScope, family === 'tracked-bills' ? 'required' : 'optional');
        const refs = rows.map(row => row.operation), select = scopes => resolveAvailableReads({ policy: { generalReads: true, readFamilies: [family] }, installation: { operations: refs }, discovery: { operations: refs }, scopes });
        assert.deepEqual(select([{ kind: 'client' }]).available.map(row => row.operation), refs);
        assert.deepEqual(select([{ kind: 'private-user' }]).available.map(row => row.operation), family === 'tracked-bills' ? [] : refs);
    }
    const operations = absent.map(id => ({ id, version: '0.2.0' }));
    assert.equal(absent.length, 4);
    assert.deepEqual(resolveAvailableReads({ policy: { generalReads: true, readFamilies: READ_FAMILY_IDS }, installation: { operations }, discovery: { operations }, scopes: [{ kind: 'client' }] }).available, []);
    for (const id of absent)
        assert.equal(familyReads().some(row => row.operation.id === id), false, id);
});
for (const id of ids) {
    test(`completion SDK ${id}: canonical literal schema rejects model authority or normalization context`, () => {
        const f = sceneFor(id), schema = advertisedArguments(f.contract.descriptor.inputSchema);
        assert.equal(schema.mode, 'canonical');
        assert.deepEqual(schema.arguments.parse(f.arguments), f.arguments);
        for (const extra of [{ normalizationContext: f.normalizationContext }, { tenantId: f.authority.binding.tenantId }, { subject: f.authority.subject }, { input: f.arguments }])
            assert.equal(schema.arguments.safeParse({ ...f.arguments, ...extra }).success, false);
    });
}

for(const id of stateIds)for(const nativeOutcome of ['not-configured','quota','provider-error'])test(`completion MCP ${id}/${nativeOutcome}: provider limitation stays an honest result`,async t=>{
 const scene=stateCase(id,{request:{billId:'HB 1234',state:'TX'},nativeOutcome}),f=await fixture('state-status-votes',id,{scene}),m=await connect(t,f),out=await m.call();assert.equal(out.isError,undefined,JSON.stringify(out));
 const value=JSON.parse(out.content[0].text);assert.deepEqual(value.result,scene.state.nativeValue);assert.match(value.result.note,/No bill found/);assert.equal(m.runtime.receipts()[0].resultSha256,hash(value));
});
for(const [family,id] of [['tracked-bills',trackedId],['public-domain-hearings',hearingId]])test(`completion MCP ${id}: source cancellation releases no result or accepted receipt`,async t=>{
 const scene=sceneFor(id);let entered;const atSource=new Promise(r=>entered=r);let aborted=false;
 scene.transport={...scene.transport,async fetchImpl(url,options){entered();return new Promise((_,reject)=>{options.signal.addEventListener('abort',()=>{aborted=true;reject(options.signal.reason);},{once:true});});}};
 const f=await fixture(family,id,{scene}),m=await connect(t,f),controller=new AbortController(),pending=m.call(undefined,{signal:controller.signal});await atSource;controller.abort();await assert.rejects(pending);await new Promise(r=>setTimeout(r,20));assert(aborted);assert.deepEqual(m.runtime.receipts(),[]);
});
