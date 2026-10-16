/** SYNTHETIC store SQL; the canonical payload decoder must retain update integrity across task owner kinds. */
import test from 'node:test';import assert from 'node:assert/strict';
import {commandComposition,id} from '../../../intents/test/fixture.mjs';
import {createTaskCreateApprovalMetadataOwner,createPostgresApprovalMetadataStore} from '../index.mjs';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
test('retained task-update metadata round-trips exact operation/action/input/hash through the shared SQL store',async()=>{
 const c=commandComposition({action:'task.update'}),{proposal}=await c.preparer().prepare({arguments:{taskId:id(21),title:'Updated',status:'open'}});
 const read={proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,operation:c.commandOptions.operation,action:'task.update',binding:c.binding,deadlineMs:c.f.state.now+1000,signal:undefined};
 const fact=await c.commandOptions.approvalMetadataOwner.read(read);assert.equal(fact.action,'task.update');assert.equal(fact.inputSha256,canonicalSha256({arguments:proposal.command.arguments,attachments:[]}));
 assert.deepEqual(c.policy.calls.map(x=>x.selection.action),['task.update','task.update','task.update','task.update']);
 const owner=createTaskCreateApprovalMetadataOwner({store:createPostgresApprovalMetadataStore({pool:c.sql.pool}),commandContext:{binding:c.binding,clientResolution:null},preparePolicy:c.policy.preparePolicy,now:()=>c.f.state.now});
 await assert.rejects(owner.read({...read,operation:{id:'create_task',version:'0.2.0'},action:'task.create'}),e=>e.outcome==='READ_UNAVAILABLE');
});
test('payload action/operation substitution refuses before connecting to the shared store',async()=>{
 const c=commandComposition({action:'task.update'});await c.preparer().prepare({arguments:{taskId:id(21),title:'Updated'}});
 const value=[...c.sql.rows.values()][0].payload,store=createPostgresApprovalMetadataStore({pool:c.sql.pool});
 for(const action of ['task.create','memory.propose','__proto__']){
  const corrupted=structuredClone(value);corrupted.record.action=action;const calls=c.sql.calls.length;
  await assert.rejects(store.insert(corrupted,()=>{}));assert.equal(c.sql.calls.length,calls);
 }
 const corrupted=structuredClone(value);corrupted.record.operation.id='create_task';const calls=c.sql.calls.length;
 await assert.rejects(store.insert(corrupted,()=>{}));assert.equal(c.sql.calls.length,calls);
});
