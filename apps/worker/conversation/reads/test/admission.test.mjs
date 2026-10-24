/** Actual current control composition with adversarial worker-facing availability snapshots. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {retainedCase} from '../../../../gateway/general-reads/test/retained-cases.mjs';
import {fixture} from '../../../../runtime/test/reads-native-fixture.mjs';
import {connect} from './native-mcp-fixture.mjs';
import {fixture as portfolioFixture} from '../../../../runtime/test/reads-portfolio-fixture.mjs';
const IDS=['get_research_portfolio','get_research_portfolio_changes','get_florida_budget_project'];
const make=id=>id==='get_florida_budget_project'?fixture('florida-budget',id,{scene:retainedCase(id)}):portfolioFixture(id);
for(const id of IDS){
 test(`${id}: revoked execution and disabled worker policy expose no server`,async t=>{
  const f=await make(id);assert.equal(await connect(t,f,{policy:{generalReads:false}}),null);
  f.revoke();assert.equal(await connect(t,f),null);assert.deepEqual(f.calls,[]);
 });
 test(`${id}: foreign, stale and duplicate transport snapshots expose no server`,async t=>{
  for(const mutate of [r=>{r.discovery.binding.writerFence=2;},r=>{r.discovery.policyRevision='other';},r=>{r.discovery.expiresAtMs=0;},r=>{r.discovery.checkedAtMs=Number.MAX_SAFE_INTEGER;},r=>{r.discovery.operations.push({...r.discovery.operations[0]});}]){
   const f=await make(id),port={async readAvailability(args){const out=structuredClone(await f.port.readAvailability(args));mutate(out);return out;},execute:args=>f.port.execute(args)};
   assert.equal(await connect(t,f,{port}),null);assert.deepEqual(f.calls,[]);
  }
 });
 test(`${id}: current execution revocation after listing refuses without Core dispatch`,async t=>{
  const f=await make(id),m=await connect(t,f);assert.ok(m);assert.deepEqual((await m.client.listTools()).tools.map(x=>x.name),[id]);
  f.revoke();assert.equal((await m.call()).isError,true);assert.deepEqual(m.runtime.receipts(),[]);assert.deepEqual(f.calls,[]);
 });
 test(`${id}: selected skill narrows the current transport operations`,async t=>{
  const f=await make(id);assert.equal(await connect(t,f,{skill:{allowedOperations:[],budgets:{maxToolCalls:1,maxOutputBytes:65536}}}),null);
  const snapshot=await f.port.readAvailability(),m=await connect(t,f);assert.ok(m);const result=await m.call();assert.equal(result.isError,undefined,JSON.stringify(result));
  const receipt=m.runtime.receipts()[0];assert.equal(receipt.executionCatalogSha256,snapshot.installation.executionCatalogSha256);assert.deepEqual(receipt.operation,f.operation);
  assert.equal(f.calls.length,1);
 });
}
