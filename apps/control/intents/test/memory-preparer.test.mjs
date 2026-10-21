import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {CommandError} from '../../commands/protocol.mjs';
import {memoryKind} from '../../commands/approval-metadata/memory-kind.mjs';
import {createMemoryProposalServices} from '../memory-preparer.mjs';
import {memoryComposition,operation,id,NOW,delivery} from './memory-fixture.mjs';
const code=want=>error=>error.code===want;

test('memory proposal composition is inert and reuses the canonical pending-only codec',()=>{
 const t=memoryComposition();assert.equal(t.sql.calls.length,0);assert.equal(t.policy.calls.length,0);
 assert.equal(t.core.calls.length,0);assert.equal(t.memorySql.rows.length,0);assert.equal(t.state.executions,0);
 assert.deepEqual(memoryKind.operation,operation);assert.equal(memoryKind.contextShape,'MemoryProposeContext');
 assert.equal(t.services.preparer.owner,'command');assert.equal(t.services.commandOptions.action,'memory.propose');
});

for(const scope of ['personal','client','firm'])test(`${scope}: preparation stores immutable command metadata and performs no memory effect`,async()=>{
 const t=memoryComposition({scope}),out=await t.prepare(),proposal=out.proposal;
 assert.equal(out.status,'approval_required');assert.equal(proposal.command.action,'memory.propose');
 assert.equal(proposal.command.arguments.content,'Retain the source attribution');
 assert.equal(proposal.command.arguments.scope,scope);assert.equal(proposal.command.arguments.clientId,scope==='client'?id(9):null);
 assert.equal(proposal.command.arguments.ttlDays,0.5);assert.deepEqual(proposal.command.attachments,[]);
 assert.equal(proposal.commandSha256,canonicalSha256(proposal.command));
 assert.deepEqual(proposal.requiredApprover,{tenantId:'tenant',actorId:'actor'});
 assert.equal(t.sql.rows.size,1);assert.equal(t.memorySql.rows.length,0);assert.equal(t.core.calls.length,0);assert.equal(t.state.executions,0);
 assert.deepEqual(t.policy.calls.map(call=>call.phase),['prepare','before_release']);
 const payload=[...t.sql.rows.values()][0].payload;
 assert.deepEqual(payload.commandContext,t.commandContext);assert.equal(payload.commandSha256,proposal.commandSha256);
 t.raw.content='Mutation after prepare';assert.equal(payload.record.request.content,'  Retain the source attribution  ');
});

test('raw IDs and authority cannot override actor, tenant, selected client, scope policy or approver',async()=>{
 const t=memoryComposition({scope:'client'});
 const invalid=[{...t.raw,clientId:id(88)},{...t.raw,scope:'canonical'},...['binding','tenantId','actorId','scopes','requiredApprover','proposalId','commandId','sources','attachments'].map(key=>({...t.raw,[key]:'model'}))];
 for(let i=0;i<invalid.length;i++)await assert.rejects(t.prepare(invalid[i],delivery(10+i)),code('INVALID_ARGUMENTS'));
 assert.equal(t.sql.rows.size,0);assert.equal(t.policy.calls.length,0);assert.equal(t.core.calls.length,0);
 const missingClient=memoryComposition({conversationClientId:null});
 await assert.rejects(missingClient.prepare({...missingClient.raw,scope:'client'}),code('INVALID_ARGUMENTS'));
 assert.equal(missingClient.sql.rows.size,0);
});

test('same durable intent delivery replays the identical proposal after a new mount; changed payload conflicts',async()=>{
 const t=memoryComposition(),first=await t.prepare(),replay=await t.prepare();
 assert.deepEqual(replay,first);assert.equal(t.sql.rows.size,1);assert.equal(t.policy.calls.length,2);
 await assert.rejects(t.prepare({...t.raw,content:'Different'},delivery(1)),code('CONFLICT'));
 assert.equal(t.sql.rows.size,1);assert.equal(t.memorySql.rows.length,0);
 const next=await t.prepare(t.raw,delivery(2));assert.notEqual(next.proposal.proposalId,first.proposal.proposalId);
});

test('policy revocation before storage and at metadata release keeps effect classifications truthful',async()=>{
 const a=memoryComposition();a.policy.state.denyPhase='prepare';
 await assert.rejects(a.prepare(),code('REFUSED'));assert.equal(a.sql.rows.size,0);assert.equal(a.memorySql.rows.length,0);
 const b=memoryComposition();b.policy.state.denyPhase='before_release';
 await assert.rejects(b.prepare(),code('UNKNOWN'));assert.equal(b.sql.rows.size,1);assert.equal(b.memorySql.rows.length,0);
 b.policy.state.denyPhase=null;await assert.rejects(b.prepare(),code('UNKNOWN'));assert.equal(b.sql.rows.size,1);
});

test('lost metadata SQL acknowledgment retains UNKNOWN and the delivery never allocates another proposal',async()=>{
 const t=memoryComposition();t.state.loseMetadataInsertAck=true;
 await assert.rejects(t.prepare(),code('UNKNOWN'));assert.equal(t.sql.rows.size,1);
 await assert.rejects(t.prepare(),code('UNKNOWN'));
 assert.equal(t.sql.rows.size,1);assert.equal(t.memorySql.rows.length,0);assert.equal(t.core.calls.length,0);
});

test('lost intent settlement ACK withholds success then replays its retained proposal without another metadata call',async()=>{
 const t=memoryComposition();t.intentStore.state.loseSettleAck=true;
 await assert.rejects(t.prepare(),code('UNKNOWN'));
 const replay=await t.prepare();assert.equal(replay.status,'approval_required');assert.equal(t.sql.rows.size,1);
 assert.equal(t.policy.calls.length,2);assert.equal(t.memorySql.rows.length,0);
});

test('current result-release revocation and original expiry prevent retained proposal release',async()=>{
 const t=memoryComposition();await t.prepare();t.state.releaseRevoked=true;
 await assert.rejects(t.prepare(),code('UNKNOWN'));assert.equal(t.sql.rows.size,1);
 t.state.releaseRevoked=false;t.f.state.now=NOW+45001;
 await assert.rejects(t.prepare(),code('ACCESS_DENIED'));assert.equal(t.sql.rows.size,1);assert.equal(t.memorySql.rows.length,0);
});

test('proposal readback refuses scope/hash/payload substitutions and read-policy revocation before execution',async()=>{
 const t=memoryComposition(),{proposal}=await t.prepare();t.approve(proposal);
 const wrong=structuredClone(proposal);wrong.command.arguments.content='Substituted';wrong.commandSha256=canonicalSha256(wrong.command);
 await assert.rejects(t.executeApproved(wrong));assert.equal(t.state.executions,0);
 t.policy.state.denyPhase='read_release';await assert.rejects(t.executeApproved(proposal));assert.equal(t.state.executions,0);
 assert.equal(t.memorySql.rows.length,0);assert.equal(t.core.calls.length,0);
});

test('current approval, grant, writer fence and original expiry are checked before any pending candidate is created',async()=>{
 for(const mode of ['missing-approval','revoked-approval','revoked-grant','stale-fence','expired']){
  const t=memoryComposition(),{proposal}=await t.prepare();
  if(mode!=='missing-approval')t.approve(proposal);
  if(mode==='revoked-approval')t.f.state.approvalRevoked=true;
  if(mode==='revoked-grant')t.f.state.revoked=true;
  if(mode==='stale-fence')t.f.state.fence++;
  if(mode==='expired')t.f.state.now=NOW+45001;
  await assert.rejects(t.executeApproved(proposal));assert.equal(t.memorySql.rows.length,0);assert.equal(t.core.calls.length,0);
 }
});

for(const scope of ['personal','client','firm'])test(`${scope}: approved effect produces one pending candidate; command journal replay does not resubmit`,async()=>{
 const t=memoryComposition({scope}),{proposal}=await t.prepare();t.approve(proposal);
 const out=await t.executeApproved(proposal);assert.equal(out.status,'observed');assert.equal(out.outcome.result.status,'pending');
 assert.equal(out.outcome.result.commandSha256,proposal.commandSha256);assert.equal(out.outcome.receipt.outcome,'succeeded');
 const candidate=t.memorySql.rows[0].candidate;
 assert.equal(candidate.scope,scope);assert.equal(candidate.clientId,scope==='client'?id(9):null);
 assert.deepEqual(candidate.origin,{kind:'conversation',conversationId:t.f.binding.conversationId,runId:t.f.binding.runId,
  commandId:proposal.command.commandId,commandSha256:proposal.commandSha256});
 assert.equal(t.memorySql.rows.length,1);assert.equal(t.core.reviews.size,1);assert.equal([...t.core.reviews.values()][0].status,'pending');
 assert.equal(t.f.pg.rows.size,1);assert.equal([...t.f.pg.rows.values()][0].state,'OUTCOME');
 assert.deepEqual(await t.executeApproved(proposal),out);assert.equal(t.memorySql.statements.filter(sql=>sql.startsWith('INSERT INTO meri_memory.candidates')).length,1);
 assert.equal(t.core.calls.filter(call=>call.route==='submit').length,1);assert.equal(t.f.state.fetches,0,'legacy save_memory HTTP is unreachable');
});

test('uncertain Core submission is an UNKNOWN command, never a published/pending success or automatic resubmission',async()=>{
 const t=memoryComposition(),{proposal}=await t.prepare();t.approve(proposal);t.core.failSubmit='lostAck';
 await assert.rejects(t.executeApproved(proposal),/COMMAND_OUTCOME_UNKNOWN/);
 assert.equal(t.core.reviews.size,1);assert.equal(t.memorySql.rows.length,1);
 assert.equal(t.memorySql.rows[0].submission_state,'SUBMISSION_UNKNOWN');
 assert.equal([...t.f.pg.rows.values()][0].state,'UNKNOWN');
 const again=await t.executeApproved(proposal);assert.equal(again.status,'indeterminate');
 assert.equal(t.core.calls.filter(call=>call.route==='submit').length,1);
});

test('retention suppression refuses the governed source and cannot reach legacy save or publish memory',async()=>{
 const t=memoryComposition(),{proposal}=await t.prepare();t.approve(proposal);t.state.retentionSuppressed=true;
 await assert.rejects(t.executeApproved(proposal),/COMMAND_OUTCOME_UNKNOWN/);
 assert.ok(t.state.retentionReads>0);assert.equal(t.memorySql.rows.length,0);assert.equal(t.core.calls.length,0);assert.equal(t.f.state.fetches,0);
});

test('projected suppression is rechecked by the actual candidate journal before INSERT',async()=>{
 const t=memoryComposition(),{proposal}=await t.prepare();t.approve(proposal);
 t.memorySql.retentionRows.set(t.f.binding.tenantId+'/'+t.f.binding.conversationId,'SUPPRESSED');
 await assert.rejects(t.executeApproved(proposal),/COMMAND_OUTCOME_UNKNOWN/);
 assert.ok(t.state.retentionReads>0);assert.equal(t.memorySql.rows.length,0);assert.equal(t.core.calls.length,0);
 assert.ok(t.memorySql.statements.some(sql=>sql.startsWith('SELECT state FROM meri_conversations.retention_subjects')));
 assert.equal(t.memorySql.statements.some(sql=>sql.startsWith('INSERT INTO meri_memory.candidates')),false);
});

test('invalid trusted memory context is a configuration refusal before any borrowed SQL or execution owner is used',()=>{
 const t=memoryComposition();
 assert.throws(()=>createMemoryProposalServices({metadata:{pool:t.sql.pool,preparePolicy:t.policy.preparePolicy},
  commandContext:{binding:t.f.binding,conversationClientId:'invalid'},executor:{execute(){throw new CommandError('must-not-run');}},
  now:()=>NOW,newId:()=>id(1),limits:{maxRequestMs:1000,maxFactBytes:65536}}),code('INTENT_CONFIGURATION'));
 assert.equal(t.sql.calls.length,0);assert.equal(t.state.executions,0);
});
