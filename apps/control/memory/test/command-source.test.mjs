/** SYNTHETIC: conversational memory.propose through the actual durable command owner (inherited scripted budget SQL harness, command
 * fixture journal/authority/approval) with the governed producer as its source. Not native database, Core or SDK qualification. */
import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {harness} from '../../../../docs/qualification/candidates/durable-invocation-20261012/review/invocation-harness.mjs';
import {fixture,NOW,id} from '../../test/commands-fixture.mjs';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {createPostgresCommandExecutor} from '../../commands/durable-executor.mjs';
import {createMemoryProducer} from '../producer.mjs';
import {createCoreReview} from '../core-review.mjs';
import {createCoreMemoryReads} from '../core-memory.mjs';
import {createMemoryCommandSource,principalFromCommandAuthority} from '../command-source.mjs';
import {createCoreDouble,createJournalDouble,ids} from './fixtures.mjs';
function setup(mutate){
 const f=fixture('memory.propose',{policy:'a'.repeat(64)});mutate?.(f);
 f.proposal.commandSha256=canonicalSha256(f.command);f.execution.commandSha256=f.proposal.commandSha256;f.decision.commandSha256=f.proposal.commandSha256;
 const b=harness();b.setClock(NOW);
 Object.assign(b.allocation.run,Object.fromEntries(Object.keys(b.allocation.run).map(k=>[k,f.binding[k]])));
 b.allocation.manifest.allowedOperations=[f.descriptor.operation];b.allocation.manifestSha256=canonicalSha256(b.allocation.manifest);
 b.allocation.schedule.operations=[{operation:f.descriptor.operation,chargeMicrousd:10}];b.allocation.schedule.expiresAt=new Date(NOW+10000).toISOString();
 b.invocation.binding=structuredClone(f.binding);b.invocation.qualificationBinding.runId=f.binding.runId;
 b.invocation.allocationSha256=canonicalSha256(b.allocation);b.invocation.capabilitySha256=createHash('sha256').update('synthetic').digest('hex');
 b.state().run.run_id=f.binding.runId;b.state().grant.run_id=f.binding.runId;b.state().grant.capability_sha256=b.invocation.capabilitySha256;b.state().grant.expires_at=new Date(NOW+10000);
 const {invocationId:ignored,...context}=b.invocation;
 const journal=createJournalDouble(),core=createCoreDouble();
 const producer=createMemoryProducer({journal,review:createCoreReview({transport:core.transport}),memory:createCoreMemoryReads({transport:core.transport}),newId:ids(300),now:()=>NOW});
 const create=source=>createPostgresCommandExecutor({pool:b.pool,allocationJson:JSON.stringify(b.allocation),producerContext:{context,producer:b.producer},
  journal:f.journal,authority:f.authority,approvalStore:f.approvalStore,source,contracts:f.contracts,descriptor:f.descriptor,context:f.context,
  now:()=>f.state.now,newId:()=>id(50),limits:{maxRequestMs:9000,maxResponseBytes:65536,maxCleanupMs:40},sourceEnabled:true});
 return {f,b,journal,core,producer,create,ready:executor=>executor.bindTrustedGrant(JSON.stringify(b.invocation))};
}
const personal=f=>{f.command.arguments.scope='personal';f.command.arguments.clientId=null;};

test('personal memory.propose completes as one pending candidate through the canonical executor; replay never dispatches again',async()=>{
 const t=setup(personal),executor=t.create(createMemoryCommandSource({producer:t.producer}));await t.ready(executor);
 const value=await executor.execute(t.f.call(),'synthetic');
 assert.equal(value.status,'observed');
 const result=value.outcome.result;assert.equal(result.status,'pending');assert.equal(result.commandSha256,t.f.proposal.commandSha256);
 const [row]=t.journal.rows.values();
 assert.equal(row.candidate.candidateId,result.candidateId);assert.equal(row.candidate.scope,'personal');
 assert.deepEqual(row.candidate.origin,{kind:'conversation',conversationId:t.f.binding.conversationId,runId:t.f.binding.runId,commandId:t.f.command.commandId,commandSha256:t.f.proposal.commandSha256});
 assert.equal(t.core.reviews.size,1);assert.equal([...t.core.reviews.values()][0].status,'pending');
 assert.deepEqual(await executor.execute(t.f.call(),'synthetic'),value);assert.equal(t.core.reviews.size,1);assert.equal(t.journal.calls.filter(c=>c==='insert').length,1);
});

test('the legacy route source still refuses personal before budget or source ports (regression kept)',async()=>{
 const t=setup(personal),executor=t.create(t.f.source);
 assert.throws(()=>executor.execute(t.f.call(),'synthetic'),/PENDING_PRODUCER_UNAVAILABLE/);assert.equal(t.b.commands.length,0);assert.equal(t.f.state.fetches,0);
});

test('a keyed conversational proposal matching an eligible memory becomes a correction pinned to that memory',async()=>{
 const t=setup(f=>{personal(f);f.command.arguments.key='brief-length';});
 t.core.addMemory({memoryId:'mem-own',key:'brief-length',memorySha256:'e'.repeat(64),tenantId:t.f.binding.tenantId,ownerActorId:t.f.binding.actorId});
 const executor=t.create(createMemoryCommandSource({producer:t.producer}));await t.ready(executor);
 assert.equal((await executor.execute(t.f.call(),'synthetic')).status,'observed');
 const [row]=t.journal.rows.values();assert.equal(row.candidate.kind,'correction');assert.deepEqual(row.candidate.corrects,{memoryId:'mem-own',memorySha256:'e'.repeat(64)});
});

test('an uncertain Core submission is an unknown command outcome, not a pending result',async()=>{
 const t=setup(personal);t.core.failSubmit='refuse';
 const executor=t.create(createMemoryCommandSource({producer:t.producer}));await t.ready(executor);
 await assert.rejects(executor.execute(t.f.call(),'synthetic'),/COMMAND_OUTCOME_UNKNOWN/);
 assert.equal([...t.journal.rows.values()][0].submission.state,'SUBMISSION_UNKNOWN');
 assert.equal((await executor.execute(t.f.call(),'synthetic')).status,'indeterminate');assert.equal(t.core.reviews.size,0);
});

test('a definite Core refusal keeps the candidate PREPARED (never "unknown" at Core); the executor still folds every post-claim source failure into an unknown command outcome; a keyed proposal becoming a correction drops the ttl',async()=>{
 const t=setup(personal);t.core.failSubmit='refused';
 const executor=t.create(createMemoryCommandSource({producer:t.producer}));await t.ready(executor);
 await assert.rejects(executor.execute(t.f.call(),'synthetic'),/COMMAND_OUTCOME_UNKNOWN/);
 assert.equal([...t.journal.rows.values()][0].submission.state,'PREPARED');assert.equal(t.core.reviews.size,0);
 assert.equal((await executor.execute(t.f.call(),'synthetic')).status,'indeterminate');
 const u=setup(f=>{personal(f);f.command.arguments.key='brief-length';f.command.arguments.ttlDays=3;});
 u.core.addMemory({memoryId:'clio:'+id(77),key:'brief-length',memorySha256:'e'.repeat(64),tenantId:u.f.binding.tenantId,ownerActorId:u.f.binding.actorId});
 const run=u.create(createMemoryCommandSource({producer:u.producer}));await u.ready(run);
 assert.equal((await run.execute(u.f.call(),'synthetic')).status,'observed');
 const [row]=u.journal.rows.values();assert.equal(row.candidate.kind,'correction');assert.equal(row.candidate.ttlDays,null);assert.equal(row.candidate.corrects.memoryId,'clio:'+id(77));
});

test('eligibility derives only from the current decision: client scopes are clients, a tenant scope admits firm',()=>{
 const binding={tenantId:'t',actorId:'a'};
 const scope=(kind,resourceId)=>({tenantId:'t',kind,resourceId,policyRevision:'p'});
 const p=principalFromCommandAuthority({binding,decision:{scopes:[scope('client',id(9).toUpperCase()),scope('mailbox','x')]}});
 assert.deepEqual(p.clientIds,[id(9)]);assert.deepEqual(p.permissions,[]);
 assert.deepEqual(principalFromCommandAuthority({binding,decision:{scopes:[scope('tenant','t')]}}).permissions,['memory.propose.firm']);
 assert.throws(()=>principalFromCommandAuthority({binding,decision:{scopes:[{...scope('client',id(9)),tenantId:'other'}]}}),/COMMAND_AUTHORITY_REFUSED/);
});
