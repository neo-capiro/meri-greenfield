/** Real MCP server -> production worker transport -> control composer -> typed Core adapter.
 * Only execution identity and the external Core service are synthetic. No model or AWS. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {CASES,fixture} from '../../../../runtime/test/reads-native-fixture.mjs';
import {connect} from './native-mcp-fixture.mjs';
for(const [family,id] of CASES){
 test(`native MCP ${id}: exact typed result and completion receipt survive the actual transport`,async t=>{
  const f=await fixture(family,id),m=await connect(t,f);assert.ok(m);
  assert.deepEqual((await m.client.listTools()).tools.map(x=>x.name),[m.name]);
  const result=await m.call();assert.equal(result.denied,undefined);assert.equal(result.isError,undefined,JSON.stringify(result));
  const value=JSON.parse(result.content[0].text);assert.deepEqual(value.operation,f.operation);assert.deepEqual(value.binding,f.binding);
  assert.equal(f.calls.filter(p=>p===`/api/clio/tools/${id}`).length,1);
  assert.equal(m.runtime.receipts().length,1);assert.equal(m.runtime.receipts()[0].resultSha256,canonicalSha256(value));
 });
 test(`native MCP ${id}: current execution revocation withholds data and receipt`,async t=>{
  const f=await fixture(family,id),m=await connect(t,f);assert.ok(m);f.revoke();
  const result=await m.call();assert.equal(result.isError,true);assert.deepEqual(m.runtime.receipts(),[]);
  assert.equal(f.calls.filter(p=>p===`/api/clio/tools/${id}`).length,0);
 });
 test(`native MCP ${id}: actual Core denial is never a successful result or a retry`,async t=>{
  const f=await fixture(family,id),m=await connect(t,f);assert.ok(m);f.deny();
  const result=await m.call();assert.equal(result.isError,true);assert.deepEqual(m.runtime.receipts(),[]);
  assert.equal(f.calls.filter(p=>p===`/api/clio/tools/${id}`).length,1);
 });
}
test('native MCP skill scope and explicit call limit narrow the actual server without financial reservations',async t=>{
 const f=await fixture('bill-text','read_bill_text'),skill={allowedOperations:[f.operation],budgets:{maxToolCalls:1,maxOutputBytes:1048576}},m=await connect(t,f,{skill});assert.ok(m);
 assert.equal((await m.call()).isError,undefined);assert.match((await m.call()).denied,/RESOURCE_LIMIT/u);
 assert.equal(f.calls.filter(p=>p==='/api/clio/tools/read_bill_text').length,1);assert.equal(m.runtime.receipts().length,1);
 const disabled=await fixture('bill-text','read_bill_text');assert.equal(await connect(t,disabled,{policy:{generalReads:false}}),null);assert.deepEqual(disabled.calls,[]);
 const excluded=await fixture('bill-text','read_bill_text');assert.equal(await connect(t,excluded,{skill:{...skill,allowedOperations:[]}}),null);assert.deepEqual(excluded.calls,[]);
});
