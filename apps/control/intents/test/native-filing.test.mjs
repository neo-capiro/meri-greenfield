import test from 'node:test';import assert from 'node:assert/strict';
import {nativeFilingFixture} from './native-filing-fixture.mjs';
import {receiveIntentsResponse as receive} from '../../../../packages/contracts/dist/intents-application.mjs';
import {productFailure} from '../../product-access/errors.mjs';
const code=expected=>e=>productFailure(e)?.code===expected;
const admitted=async(s,route,value)=>receive(route,200,JSON.stringify(value),route==='decide'?{request:s.request,proposal:s.proposal}:{request:{conversationId:s.binding.conversationId}});

test('native filing actual preparation, approval, original result and history retain per-file observations',async()=>{
 const s=await nativeFilingFixture();assert.equal(s.sql.rows.size,1);assert.equal(s.state.effects,0);
 assert.deepEqual((await s.prepare()).proposal,s.proposal);assert.equal(s.sql.rows.size,1);
 assert.equal((await admitted(s,'list',await s.list())).intents[0].phase,'awaiting_approval');
 const result=await s.decide(),publicResult=await admitted(s,'decide',result);assert.equal(publicResult.status,'executed');assert.equal(publicResult.outcome.execution.kind,'native-artifact-file');
 assert.equal(publicResult.outcome.result.files[0].indexingStatus,'pending');assert.deepEqual((await s.decide()).outcome,result.outcome);assert.equal(s.state.effects,1);
 s.state.now+=120000;
 const history=await admitted(s,'list',await s.list());assert.equal(history.intents[0].phase,'completed');assert.deepEqual(history.intents[0].execution.outcome,result.outcome);
 await assert.rejects(s.decide(),code('INTENT_EXPIRED'));assert.equal(s.state.effects,1);
});

test('lost native filing acknowledgement recovers original outcome from history',async()=>{
 const s=await nativeFilingFixture();s.state.loseAck=true;await assert.rejects(s.decide(),code('INTENT_EXECUTION_UNKNOWN'));
 const recovered=await admitted(s,'list',await s.list());assert.equal(recovered.intents[0].phase,'completed');assert.equal(s.state.effects,1);assert.equal(s.state.executes,1);
});

test('unknown native filing never becomes success or a failed per-file observation',async()=>{
 const s=await nativeFilingFixture();s.state.unknown=true;
 assert.equal((await admitted(s,'decide',await s.decide())).status,'indeterminate');assert.equal((await admitted(s,'list',await s.list())).intents[0].phase,'unknown');assert.equal(s.state.effects,0);
});

test('rejection, missing filing owner and current client access loss cannot file',async()=>{
 const s=await nativeFilingFixture();assert.equal((await s.decide({decision:'rejected'})).status,'rejected');assert.equal(s.state.executes,0);
 const absent=await nativeFilingFixture({missing:true});await assert.rejects(absent.decide(),code('EXECUTION_OWNER_UNAVAILABLE'));assert.equal(absent.state.effects,0);
 const hidden=await nativeFilingFixture();hidden.principal.clientIds=[];await assert.rejects(hidden.decide(),code('INTENT_SCOPE_WITHHELD'));
 assert.equal((await admitted(hidden,'list',await hidden.list())).intents[0].withheld,true);assert.equal(hidden.state.records,0);
});

test('foreign or contradictory native filing outcome is never released as executed',async()=>{
 const s=await nativeFilingFixture();s.state.mutate=value=>{value.result.files[0].object.versionId='another-version';};
 await assert.rejects(s.decide(),code('INTENT_RESULT_NOT_RELEASED'));assert.equal(s.state.effects,1);
});

test('public filing result rejects substituted original identity, object, observations and decision',async()=>{
 const s=await nativeFilingFixture(),result=await s.decide();
 const changes=[r=>{r.outcome.execution.binding.runId='00000000-0000-4000-8000-000000000099';},r=>{r.outcome.execution.kind='native-task';},
  r=>{r.outcome.execution.approvalDecisionSha256='f'.repeat(64);},r=>{r.outcome.execution.completedAt='2026-01-01T00:00:00.000Z';},
  r=>{r.outcome.result.commandSha256='f'.repeat(64);},r=>{r.outcome.result.files[0].object.versionId='substituted';},
  r=>{r.outcome.result.files.push(r.outcome.result.files[0]);},r=>{delete r.outcome.result.files[0].documentId;},
  r=>{r.outcome.result.files[0].indexingStatus='not_indexed';},r=>{r.outcome.result.files[0].fileName=null;},
  r=>{r.outcome.result.files[0].status='pending';}];
 for(const mutate of changes){const value=structuredClone(result);mutate(value);await assert.rejects(admitted(s,'decide',value));}
});
