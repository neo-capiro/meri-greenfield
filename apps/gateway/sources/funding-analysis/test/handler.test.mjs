import test from 'node:test';
import assert from 'node:assert/strict';
import {analysisCase,ids,requests} from './fixture.mjs';
import {createFundingAnalysisHandlers} from '../handler.mjs';
import {familyOperations} from '../../../general-reads/registration.mjs';
import {decodeNativeReadObservation,NATIVE_READ_OBSERVATION_HEADER as HEADER} from '../../../../../packages/contracts/native-read-observation-0.2/validate.mjs';
import {advertisedArguments} from '../../../../worker/conversation/reads/schema.mjs';
import {fixture} from '../../../../runtime/test/reads-native-fixture.mjs';
import {connect} from '../../../../worker/conversation/reads/test/native-mcp-fixture.mjs';
const other='ffffffff-ffff-4fff-8fff-ffffffffffff';
for(const id of ids){
 test(`${id} preserves typed native bytes, request and the server observation`,async()=>{
  const f=analysisCase(id),out=JSON.parse(await f.handler()(f.call()));
  assert.deepEqual(out.result,f.page);assert.equal(f.wire.length,1);
  const wire=f.wire[0];assert.equal(new URL(wire.url).pathname,`/api/clio/tools/${id}`);assert.deepEqual(wire.body,f.arguments);
  assert.deepEqual(decodeNativeReadObservation(wire.options.headers[HEADER],{operation:f.operation,request:wire.body}).context,f.normalizationContext);
  assert.equal(wire.options.redirect,'error');assert.equal(wire.options.credentials,'omit');
  const schema=advertisedArguments(f.contract.descriptor.inputSchema);assert.deepEqual(schema.arguments.parse(f.arguments),f.arguments);
  for(const extra of [{asOf:f.normalizationContext.asOf},{tenantId:other},{approval:true}])assert.equal(schema.arguments.safeParse({...f.arguments,...extra}).success,false);
 });
 test(`${id} refuses foreign clients, changed clocks, and current authority loss`,async()=>{
  const f=analysisCase(id),call=f.call({...f.arguments,clientId:other});
  await assert.rejects(f.handler()(call),{message:'ACCESS_DENIED'});assert.equal(f.wire.length,0);
  f.state.resultMutator=value=>value.asOf='2020-01-01T00:00:00.000Z';
  await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});assert.equal(f.wire.length,1);
  f.state.resourceDenied=true;await assert.rejects(f.handler()(f.call()),{message:'ACCESS_DENIED'});assert.equal(f.wire.length,1);
 });
 test(`${id} is connected through control, current native credentials and SDK MCP`,async t=>{
  const f=await fixture('funding-analysis',id,{scene:analysisCase(id)}),m=await connect(t,f);
  assert.ok(m);const output=await m.call();assert.equal(output.isError,undefined,JSON.stringify(output));
  const value=JSON.parse(output.content[0].text);assert.equal(value.result.tool,id);assert.equal(m.runtime.receipts().length,1);
  f.revoke();const denied=await m.call();assert.equal(denied.isError,true);assert.equal(m.runtime.receipts().length,1);
 });
}
test('family registration is exactly three approved reads',()=>{
 const f=analysisCase();assert.deepEqual(familyOperations('funding-analysis').map(r=>r.id),ids);
 assert.equal(createFundingAnalysisHandlers({...f.transport,now:f.now},familyOperations('funding-analysis')).length,3);
});
test('comparison retains unsupported rows and exact loss; cannot hide a failed row or mix identities',()=>{
 const id=ids[1],request={...requests[id],opportunities:[...requests[id].opportunities,{source:'forecast',sourceRecordId:'not-connected'},...Array.from({length:3},()=>requests[id].opportunities[0])]},f=analysisCase(id,request);
 const validate=value=>f.contract.assertOutput(value,{request,...f.normalizationContext});validate(f.page);
 assert.equal(f.page.data.rows[2].state,'unsupported_source');assert.deepEqual(f.page.truncated,[{collection:'rows',kept:5,total:6}]);
 for(const mutate of [v=>v.data.rows.splice(2,1),v=>delete v.truncated,v=>v.data.rows[0].facts.clientId=other,v=>v.data.rows.reverse(),v=>v.data.rows[0].facts.grantFunding={estimatedProgramFunding:10}]){const value=structuredClone(f.page);mutate(value);assert.throws(()=>validate(value));}
});
test('plan identity, stage, task status, due-date basis and schedule are closed',()=>{
 const f=analysisCase(ids[2]),validate=value=>f.contract.assertOutput(value,{request:f.arguments,...f.normalizationContext});validate(f.page);
 for(const mutate of [v=>v.data.clientId=other,v=>v.data.ref.sourceRecordId='other',v=>v.data.actions[0].committed=true,v=>{v.data.stage='forecast';v.data.actions[0].intent='pursuit';},v=>v.data.actions[0].dueDate='2026-10-30T00:00:00.000Z',v=>v.data.actions[0].suggestedTarget='Unbacked office',v=>v.data.proposedSchedule=[]]){const value=structuredClone(f.page);mutate(value);assert.throws(()=>validate(value));}
});
