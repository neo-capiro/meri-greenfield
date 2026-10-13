/** Actual application owners over explicitly inert SQL/HTTP/current-policy boundaries. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from '../../../../../apps/control/action-followthrough/test/fixture.mjs';
import {createPostgresApprovalMetadataStore,createTaskCreateApprovalMetadataOwner} from '../../../../../apps/control/commands/approval-metadata/index.mjs';
import {createMetadataPoolFixture,createMetadataPolicyFixture} from '../../../../../apps/control/commands/approval-metadata/test/fixture.mjs';
import {createCommandToolInterface} from '../../../../../apps/control/commands/tool-interface.mjs';

async function composition(){
  const t=await setup(),sql=createMetadataPoolFixture();
  const policy=createMetadataPolicyFixture({binding:t.f.binding,scopes:t.f.scopes,requiredApprover:t.f.proposal.requiredApprover,expiresAt:t.f.proposal.expiresAt,now:t.clock});
  let next=700;
  const owner=createTaskCreateApprovalMetadataOwner({store:createPostgresApprovalMetadataStore({pool:sql.pool}),commandContext:t.f.context,preparePolicy:policy.preparePolicy,now:t.clock,newId:()=>`00000000-0000-4000-8000-${String(next++).padStart(12,'0')}`});
  const commandOptions={...t.commandOptions,approvalMetadataOwner:owner};
  return {t,sql,policy,owner,workflow:t.make({commandOptions}),commands:createCommandToolInterface(commandOptions)};
}

test('selected retained recommendation prepares concrete immutable metadata, then separate approval executes once',async()=>{
  const {t,sql,workflow,commands}=await composition();
  try{
    const draft=await workflow.draft(t.wanted,{title:'Review the selected recommendation',dueDate:null});
    assert.equal(sql.rows.size,0);assert.equal(t.f.state.fetches,0);
    const pending=await workflow.prepare(draft),p=pending.proposal;
    assert.equal(pending.status,'approval_required');assert.equal(sql.rows.size,1);assert.equal(t.f.state.fetches,0);
    assert.equal(t.metadataCalls(),0,'old inert metadata owner is never used');
    assert.deepEqual(p.command.arguments,draft.task);
    assert.equal(p.command.action,'task.create');assert.deepEqual(p.command.attachments,[]);
    assert.equal(pending.draft.source.resultSha256,t.wanted.resultSha256);
    assert.equal(p.command.arguments.clientId,t.clientId);
    const stored=[...sql.rows.values()][0].payload;
    assert.equal(stored.record.proposalId,p.proposalId);assert.equal(stored.commandSha256,p.commandSha256);
    assert.equal(Object.hasOwn(p.command,'source'),false,'supporting recommendation provenance is not an approval-bound command field');
    // Explicit synthetic approval belongs to the existing executor fixture, not workflow preparation.
    Object.assign(t.f.command,structuredClone(p.command));
    Object.assign(t.f.execution,{proposalId:p.proposalId,commandSha256:p.commandSha256,idempotencyKey:p.command.idempotencyKey});
    Object.assign(t.f.decision,{proposalId:p.proposalId,commandSha256:p.commandSha256,decidedAt:p.createdAt});
    const result=await commands.executeApproved(p,t.f.execution,'synthetic');
    assert.equal(result.status,'observed');assert.equal(t.f.state.fetches,1);
    assert.deepEqual(await commands.executeApproved(p,t.f.execution,'synthetic'),result);
    assert.equal(t.f.state.fetches,1,'existing command idempotency prevents a second source effect');
    assert.equal(sql.rows.size,1);assert.equal(t.f.pg.rows.size,1);
  }finally{t.identity.close();}
});

test('fresh preparation policy denial returns no proposal and performs no metadata insert or task effect',async()=>{
  const {t,sql,policy,workflow}=await composition();
  try{
    const draft=await workflow.draft(t.wanted,{title:'Explicit task',dueDate:null});
    policy.state.denyPhase='prepare';
    await assert.rejects(workflow.prepare(draft));
    assert.equal(sql.rows.size,0);assert.equal(t.f.state.fetches,0);assert.equal(t.f.pg.rows.size,0);
  }finally{t.identity.close();}
});

test('policy loss after metadata commit preserves immutable record without granting approval or creating a task',async()=>{
  const {t,sql,policy,workflow}=await composition();
  try{
    const draft=await workflow.draft(t.wanted,{title:'Explicit task',dueDate:null});
    policy.state.denyPhase='before_release';
    await assert.rejects(workflow.prepare(draft),error=>error.outcome==='STORED_NOT_RELEASED');
    assert.equal(sql.rows.size,1);assert.equal(t.f.state.fetches,0);assert.equal(t.f.pg.rows.size,0);
  }finally{t.identity.close();}
});
