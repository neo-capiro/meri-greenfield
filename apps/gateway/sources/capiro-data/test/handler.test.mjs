import test from 'node:test';
import assert from 'node:assert/strict';
import {capiroDataCase,ids} from './fixture.mjs';

for(const id of ids)test(`${id}: fixed native route preserves authored input, exact result and request binding`,async()=>{
  const f=capiroDataCase(id),call=f.call(),result=JSON.parse(await f.handler()(call));
  assert.equal(new URL(f.wire[0].url).pathname,`/api/clio/tools/${id}`);
  assert.deepEqual(f.wire[0].body,f.arguments);assert.deepEqual(result.result,f.page);
  assert.deepEqual(result.binding,f.authority.binding);assert.equal(result.argumentsSha256,call.argumentsSha256);
  assert.deepEqual(result.operation,f.operation);assert.equal(f.wire.length,1);
});
test('current authority and original argument hash reject before Core dispatch',async()=>{
  for(const mutate of [call=>call.argumentsSha256='0'.repeat(64),call=>call.authority.deadlineMs=0,call=>call.authority.sourceIds=[]]){
    const f=capiroDataCase(),call=structuredClone(f.call());mutate(call);await assert.rejects(f.handler()(call));assert.equal(f.wire.length,0);
  }
});
test('native error is preserved as an error envelope and never converted to empty rows',async()=>{
  const f=capiroDataCase();f.state.page={version:'0.1.0',generatedAt:f.page.generatedAt,ok:false,error:{code:'QUERY_TIMEOUT',message:'Query exceeded the time budget.'}};
  const result=JSON.parse(await f.handler()(f.call()));assert.deepEqual(result.result,f.state.page);assert.equal(Object.hasOwn(result.result,'rows'),false);
});
test('numeric coercion, false counts, undisclosed fields and mismatched limits fail closed',async()=>{
  for(const mutate of [p=>p.rows[0].total=100.1,p=>p.rows[0].count=9007199254740992,p=>p.rowCount=1,p=>p.rows[0].hidden='x',p=>p.limits.rowLimit=200,p=>p.coverage.sourceUniverseComplete=true]){
    const f=capiroDataCase();f.state.resultMutator=mutate;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});assert.equal(f.wire.length,1);
  }
});
test('UTF8 whole envelope and configured transport caps independently withhold oversized results',async()=>{
  const f=capiroDataCase();f.state.resultMutator=p=>{p.rows[0].pe_code='界'.repeat(90000);};
  await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
  const g=capiroDataCase();await assert.rejects(g.handler({maxResponseBytes:128})(g.call()),{message:'RESOURCE_LIMIT'});
});
test('cancellation after Core returns withholds result bytes',async()=>{
  const f=capiroDataCase(),controller=new AbortController();f.state.afterSource=()=>controller.abort();
  await assert.rejects(f.handler()({...f.call(),signal:controller.signal}),{message:'CANCELLED'});
});
