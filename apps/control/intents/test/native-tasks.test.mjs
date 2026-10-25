/** Real approval/list owners and public receiver over a synthetic atomic Core task owner. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {receiveIntentsResponse} from '../../../../packages/contracts/dist/intents-application.mjs';
import {id} from '../../conversations/test/application-fixture.mjs';
import {nativeTaskFixture,deliveryId} from './native-task-fixture.mjs';
for(const action of ['task.create','task.update'])for(const general of [false,true])test(`${action} ${general?'General':'client'} native result and history reach public receiver without issuance`,async()=>{
 const f=nativeTaskFixture({action,general}),out=await f.owner.decide({principal:f.principal,request:f.decideRequest});
 const accepted=await receiveIntentsResponse('decide',200,JSON.stringify(out),{request:f.decideRequest,proposal:f.proposal});
 assert.equal(accepted.status,'executed');assert.deepEqual(accepted.outcome,f.outcome);assert.equal(f.state.legacyCalls,0);
 const page=await f.owner.list({principal:f.principal,request:f.listRequest});
 const history=await receiveIntentsResponse('list',200,JSON.stringify(page),{request:f.listRequest});
 assert.equal(history.intents[0].phase,'completed');assert.deepEqual(history.intents[0].execution.outcome,f.outcome);
});
test('lost task acknowledgement is reconciled by read-only history with no second execute',async()=>{
 const f=nativeTaskFixture({action:'task.update',general:true});f.state.loseAck=true;
 await assert.rejects(f.owner.decide({principal:f.principal,request:f.decideRequest}),/INTENT_EXECUTION_UNKNOWN/);
 const page=await f.owner.list({principal:f.principal,request:f.listRequest});
 assert.equal(page.intents[0].phase,'completed');assert.equal(f.state.dispatches,1);assert.equal(f.state.legacyCalls,0);
});
for(const [name,mutate] of [
 ['another proposal',o=>{o.execution.proposalId=id(999);}],['changed original run',o=>{o.execution.binding.runId=id(999);}],
 ['another decision',o=>{o.execution.approvalDecisionSha256='f'.repeat(64);}],['wrong task',o=>{o.result.id=id(999);}],
 ['wrong patch',o=>{o.result.status='todo';}],['noncanonical date',o=>{o.execution.completedAt='2026-02-30T00:00:00.000Z';}],
 ['completion before approval',o=>{o.execution.completedAt='2026-10-24T11:59:59.000Z';}],
])test(`native task result refuses ${name} at owner and public response boundary`,async()=>{
 const f=nativeTaskFixture({action:'task.update'});f.state.mutate=mutate;
 await assert.rejects(f.owner.decide({principal:f.principal,request:f.decideRequest}),/INTENT_RESULT_NOT_RELEASED/);
 const out={status:'executed',deliveryId,proposalId:f.proposal.proposalId,decision:f.decision,outcome:structuredClone(f.outcome)};mutate(out.outcome);
 await assert.rejects(receiveIntentsResponse('decide',200,JSON.stringify(out),{request:f.decideRequest,proposal:f.proposal}));
});
