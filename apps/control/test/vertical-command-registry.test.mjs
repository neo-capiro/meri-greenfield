import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveOperationContract} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {fixture,id} from './commands-fixture.mjs';
const cases=[['create_task','task.create'],['update_task','task.update'],['save_memory','memory.propose'],['save_chat_attachments','artifact.file']];
function rawFor(f,action){return action==='task.create'?{title:' Task '}:action==='task.update'?{taskId:id(21),title:' Updated ',status:' OPEN '}:action==='memory.propose'?{content:' Memory ',scope:'firm'}:{...f.context.destination,objects:f.command.attachments};}
for(const [operation,action] of cases){
 test(`canonical ${operation} normalizes actual domain and validates actual executor observation`,async()=>{
  const f=fixture(action),raw=rawFor(f,action),contract=resolveOperationContract({id:operation,version:'0.2.0'}),context={commandContext:f.context,command:f.command};
  const selection=contract.normalizeInput(raw,context);
  assert.deepEqual(selection.input,{arguments:f.command.arguments,attachments:f.command.attachments});
  assert.equal(selection.argumentsSha256,canonicalSha256(selection.input));
  const result=await f.run();assert.equal(result.status,'observed');
  assert.deepEqual(contract.assertOutput(result,{...context,request:raw}),result);
  const forged=structuredClone(result);forged.outcome.receipt.commandId=id(123);
  assert.throws(()=>contract.assertOutput(forged,{...context,request:raw}));
  assert.throws(()=>contract.assertOutput({status:'absent',outcome:null},{...context,request:raw}));
  assert.throws(()=>contract.normalizeInput({...raw,authorized:true},context));
  assert.throws(()=>contract.normalizeInput(raw,{...context,approval:true}));
  assert.equal(contract.descriptor.handler,null);assert.equal(contract.descriptor.availability,'unimplemented');
 });
 test(`canonical ${operation} pending review binds the complete exact proposal`,()=>{
  const f=fixture(action),raw=rawFor(f,action),contract=resolveOperationContract({id:operation,version:'0.2.0'}),context={commandContext:f.context,command:f.command,proposal:f.proposal,request:raw};
  const pending={status:'approval_required',proposal:f.proposal};
  assert.deepEqual(contract.assertOutput(pending,context),pending);
  for(const mutate of [p=>{p.requiredApprover.actorId='different';},p=>{p.expiresAt='2026-10-12T21:00:00.000Z';},p=>{p.command.scopes[0].policyRevision='different';p.commandSha256=canonicalSha256(p.command);}]){
   const changed=structuredClone(pending);mutate(changed.proposal);assert.throws(()=>contract.assertOutput(changed,context));
  }
  const absent={...context};delete absent.proposal;assert.throws(()=>contract.assertOutput(pending,absent));
 });
}
