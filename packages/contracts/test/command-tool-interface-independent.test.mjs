import test from 'node:test';import assert from 'node:assert/strict';
import {setup,id,canonicalSha256} from '../../../docs/qualification/candidates/vertical-source-20261012/command-tool-review/fixture.mjs';
for(const action of ['task.create','task.update','memory.propose','artifact.file']){
 test(`${action} advertises raw request, delegates actual payload normalizer and correlates full command`,()=>{
  const t=setup(action);t.shape(t.requestShape,t.raw);const n=t.validators.normalizeCommandToolInput(action,t.raw,{commandContext:t.f.context,command:t.f.command});
  assert.deepEqual(n,{input:{arguments:t.f.command.arguments,attachments:t.f.command.attachments},metadata:null});
  const changed=structuredClone(t.f.command);changed.binding.workerId=id(90);assert.throws(()=>t.validators.normalizeCommandToolInput(action,t.raw,{commandContext:t.f.context,command:changed}));
 });
 test(`${action} pending output needs complete trusted original proposal`,()=>{
  const t=setup(action),out={status:'approval_required',proposal:t.f.proposal},context={commandContext:t.f.context,command:t.f.command,proposal:t.f.proposal};
  assert.deepEqual(t.validators.assertCommandToolOutput(action,t.outputShape,out,t.raw,context),out);
  assert.throws(()=>t.validators.assertCommandToolOutput(action,t.outputShape,out,t.raw,{commandContext:t.f.context,command:t.f.command}));
  const forged=structuredClone(out);forged.proposal.requiredApprover.actorId='foreign';assert.throws(()=>t.validators.assertCommandToolOutput(action,t.outputShape,forged,t.raw,context));
 });
 test(`${action} real executor output is exact-correlated and absence/extra outcome refused`,async()=>{
  const t=setup(action),out=await t.f.make().execute(t.f.value,'synthetic'),context={commandContext:t.f.context,command:t.f.command};
  assert.deepEqual(t.validators.assertCommandToolOutput(action,t.outputShape,out,t.raw,context),out);
  for(const invalid of [{status:'absent',outcome:null},{status:'indeterminate',outcome:out.outcome},{...out,approved:true}])assert.throws(()=>t.validators.assertCommandToolOutput(action,t.outputShape,invalid,t.raw,context));
  const forged=structuredClone(out);forged.outcome.receipt.commandSha256='f'.repeat(64);assert.throws(()=>t.validators.assertCommandToolOutput(action,t.outputShape,forged,t.raw,context));
  assert.deepEqual(t.validators.assertCommandToolOutput(action,t.outputShape,{status:'indeterminate',outcome:null},t.raw,context),{status:'indeterminate',outcome:null});
 });
}

test('model inputs cannot provide server command metadata or approved flags',()=>{
 const t=setup();for(const key of ['command','proposal','binding','scopes','requiredApprover','expiresAt','commandId','idempotencyKey','approved']){
  assert.throws(()=>t.shape(t.requestShape,{...t.raw,[key]:'model'}));assert.throws(()=>t.validators.normalizeCommandToolInput('task.create',{...t.raw,[key]:'model'},{commandContext:t.f.context}));
 }
});
test('closed context and hostile raw values are refused without executing accessors',()=>{
 const t=setup();let hits=0;for(const raw of [{get title(){hits++;return 'bad';}},new Proxy({}, {ownKeys(){hits++;throw Error('trap');}})])assert.throws(()=>t.validators.normalizeCommandToolInput('task.create',raw,{commandContext:t.f.context}));
 assert.throws(()=>t.validators.normalizeCommandToolInput('task.create',t.raw,{commandContext:t.f.context,approved:true}));assert.equal(hits,0);
});
test('proposal guard binds entire original metadata and returns detached data',()=>{
 const t=setup(),p=structuredClone(t.f.proposal),out=t.validators.assertCommandToolProposal('task.create',p,t.raw,{commandContext:t.f.context,command:t.f.command,proposal:t.f.proposal});
 p.command.arguments.title='changed';assert.equal(out.command.arguments.title,t.f.command.arguments.title);
 for(const mutate of [x=>x.commandSha256='f'.repeat(64),x=>x.proposalId=id(91),x=>x.createdAt='2026-10-10T00:00:00.000Z',x=>x.expiresAt='2026-10-20T00:00:00.000Z']){
  const bad=structuredClone(t.f.proposal);mutate(bad);assert.throws(()=>t.validators.assertCommandToolProposal('task.create',bad,t.raw,{commandContext:t.f.context,proposal:t.f.proposal}));
 }
});
test('all domain transformations retain explicit source limitations',()=>{
 const memory=setup('memory.propose');const m=memory.validators.normalizeCommandToolInput('memory.propose',{content:' x ',scope:'personal',ttlDays:0.25},{commandContext:memory.f.context});assert.equal(m.input.arguments.scope,'personal');assert.equal(m.input.arguments.ttlDays,0.25);
 const update=setup('task.update');assert.throws(()=>update.validators.normalizeCommandToolInput('task.update',{taskId:id(22),dueDate:null},{commandContext:update.f.context}));
 for(const action of ['__proto__','constructor','task.create@0.2.0','create_task'])assert.throws(()=>memory.validators.normalizeCommandToolInput(action,{}, {commandContext:memory.f.context}));
});
test('normalized digest describes complete intent including immutable artifact version',()=>{
 const t=setup('artifact.file'),n=t.validators.normalizeCommandToolInput('artifact.file',t.raw,{commandContext:t.f.context}),bad=structuredClone(t.raw);bad.objects[0].sha256='f'.repeat(64);
 assert.notEqual(canonicalSha256(n.input),canonicalSha256(t.validators.normalizeCommandToolInput('artifact.file',bad,{commandContext:t.f.context}).input));
 assert.throws(()=>t.validators.normalizeCommandToolInput('artifact.file',bad,{commandContext:t.f.context,command:t.f.command}));
});
