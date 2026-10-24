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
const cases=[['research-legal-legislation','get_legal_reference'],['research-legal-news','search_legiwatch_news'],['outreach-query','query_outreach'],['research-legal-candidates','search_research_sources'],['business-development','get_business_development_evidence']];



for(const [family,id] of cases){
 test(`ordinary MCP ${id}: measured profile invokes without a selected skill or delegated-token service`,async t=>{
  const f=await fixture(family,id),policy={generalReads:true,readFamilies:[family],activeReadOperations:[f.operation]},m=await connect(t,f,{policy,mount:'profile'});assert.ok(m);assert.equal(f.scene.wire.length,0);
  const out=await m.call();assert.equal(out.isError,undefined);const value=JSON.parse(out.content[0].text);assert.equal(m.runtime.receipts()[0].resultSha256,hash(value));assert.equal(f.scene.wire.length,1);assert.equal(f.scene.wire[0].options.headers.authorization,'Bearer SYNTHETIC_NATIVE');
 });
 test(`ordinary MCP ${id}: omitted profile pin exposes no tool`,async t=>{const f=await fixture(family,id);assert.equal(await connect(t,f,{policy:{generalReads:true,readFamilies:[family]},mount:'profile'}),null);assert.equal(f.scene.wire.length,0);});
 test(`ordinary MCP ${id}: revocation during source withholds the result and receipt`,async t=>{const f=await fixture(family,id);f.scene.state.afterSource=f.revoke;const m=await connect(t,f),out=await m.call();assert.equal(out.isError,true);assert.deepEqual(m.runtime.receipts(),[]);assert.equal(f.scene.wire.length,1);});
}
