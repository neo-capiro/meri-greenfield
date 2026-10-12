// Integration checks through the private loader; never execute a memory producer.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as commands from '../commands-0.2/validate.mjs';
import {canonicalSha256, assertProposalIntegrity, assertCommandExecution} from '../validate.mjs';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const context=()=>({binding:{tenantId:'integration-tenant',actorId:'integration-actor',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1},conversationClientId:id(9)});
function intent(scope='personal') {
  const ctx=context();
  return {ctx,command:{contractVersion:'0.1.0',commandId:id(5),binding:ctx.binding,action:'memory.propose',
    arguments:commands.normalizeMemoryProposeInput({content:' Keep this preference. ',scope,ttlDays:0.5},ctx),
    attachments:[],scopes:[{tenantId:ctx.binding.tenantId,kind:'tenant',resourceId:'integration-tenant',policyRevision:'p1'}],idempotencyKey:'integration-proposal-1'}};
}
test('private loader connects all three memory proposal validators',()=>{
  for(const name of ['normalizeMemoryProposeInput','assertMemoryProposeCommand','assertMemoryProposeResult'])assert.equal(typeof commands[name],'function');
  for(const scope of ['personal','firm','client']){
    const {ctx,command}=intent(scope),result={candidateId:id(6),status:'pending',commandSha256:canonicalSha256(command)};
    assert.equal(commands.assertMemoryProposeResult(result,command,ctx).status,'pending');
    assert.equal(command.arguments.clientId,scope==='client'?id(9):null);
  }
});
test('connected schema check alone cannot establish exact command correlation',()=>{
  const {ctx,command}=intent(),result={candidateId:id(6),status:'pending',commandSha256:'a'.repeat(64)};
  commands.validateCommandShape('MemoryProposeResult',result);
  assert.throws(()=>commands.assertMemoryProposeResult(result,command,ctx));
});
test('caller cannot supply trusted context, approval or a different client',()=>{
  for(const raw of [{content:'x',binding:context().binding},{content:'x',approved:true},{content:'x',scope:'client',clientId:id(8)}])
    assert.throws(()=>commands.normalizeMemoryProposeInput(raw,context()));
});
test('pending result cannot become legacy personal auto-commit success',()=>{
  const {ctx,command}=intent();
  for(const result of [{candidateId:id(6),status:'auto_committed',commandSha256:canonicalSha256(command)},
    {candidateId:id(6),status:'pending',commandSha256:canonicalSha256(command),saved:true}])
    assert.throws(()=>commands.assertMemoryProposeResult(result,command,ctx));
});
test('new private payload still uses canonical immutable approval and recovered executor checks',()=>{
  const {ctx,command}=intent('client');
  const proposal={proposalId:id(7),command,commandSha256:canonicalSha256(command),createdAt:'2026-10-12T20:00:00Z',expiresAt:'2026-10-12T21:00:00Z',requiredApprover:{tenantId:ctx.binding.tenantId,actorId:ctx.binding.actorId}};
  const execution={contractVersion:'0.1.0',requestId:id(8),capabilityId:id(10),executorBinding:{...ctx.binding,workerId:id(11),attemptId:id(12),writerFence:2},proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,idempotencyKey:command.idempotencyKey};
  assertProposalIntegrity(proposal);assertCommandExecution(proposal,execution);
  command.arguments.content='changed';assert.throws(()=>assertProposalIntegrity(proposal));
});
test('connected result and command values remain detached from caller objects',()=>{
  const {ctx,command}=intent(),result={candidateId:id(6),status:'pending',commandSha256:canonicalSha256(command)};
  const accepted=commands.assertMemoryProposeCommand(command,ctx),out=commands.assertMemoryProposeResult(result,command,ctx);
  command.arguments.content='changed';result.status='committed';
  assert.equal(accepted.arguments.content,'Keep this preference.');assert.equal(out.status,'pending');
});
test('loader admission rejects accessors without evaluating them',()=>{
  let reads=0;const raw={get content(){reads++;return 'x';}};
  assert.throws(()=>commands.normalizeMemoryProposeInput(raw,context()));assert.equal(reads,0);
});
