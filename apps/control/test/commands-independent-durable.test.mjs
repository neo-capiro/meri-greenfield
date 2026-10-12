/** Actual command owner + canonical produced budget/journal, inert scripted driver only. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {fixture,NOW,id,nextTurn,sourceRoot} from './commands-independent-fixture.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {createCommandAuthority} from '../../gateway/index.mjs';
process.env.MERI_REVIEW_SOURCE_ROOT=sourceRoot??resolve(new URL('../../../',import.meta.url).pathname);
const {harness}=await import('../../../docs/qualification/candidates/durable-invocation-20261012/review/invocation-harness.mjs');
const {createPostgresCommandExecutor}=await import(sourceRoot?pathToFileURL(resolve(sourceRoot,'apps/control/commands/durable-executor.mjs')):new URL('../commands/durable-executor.mjs',import.meta.url));

async function connected(action='task.create',beforeBind=()=>{}){
 const f=fixture(action),h=harness(),policy=h.invocation.qualificationBinding.policyRevision;
 Object.assign(f.binding,h.f.binding);Object.assign(f.execution.executorBinding,h.f.binding);
 Object.assign(f.scope,{tenantId:f.binding.tenantId,resourceId:f.binding.tenantId,policyRevision:policy});
 f.state.policy=policy;f.proposal.requiredApprover.tenantId=f.binding.tenantId;
 if(action==='artifact.file'){f.command.arguments.conversationId=f.binding.conversationId;f.context.destination.conversationId=f.binding.conversationId;}
 f.resign();h.setClock(NOW);h.state().grant.expires_at=new Date(NOW+10000);
 h.allocation.manifest.allowedOperations=[f.descriptor.operation];h.allocation.manifestSha256=canonicalSha256(h.allocation.manifest);
 h.allocation.schedule={...h.allocation.schedule,expiresAt:new Date(NOW+10000).toISOString(),operations:[{operation:f.descriptor.operation,chargeMicrousd:10}]};
 h.invocation.allocationSha256=canonicalSha256(h.allocation);
 beforeBind({f,h});
 const options=()=>({pool:h.pool,allocationJson:JSON.stringify(h.allocation),producerContext:{context:h.context(),producer:h.producer},journal:f.journal,
  authority:createCommandAuthority({authorityPorts:f.ports,now:()=>f.state.now,maxFactBytes:65536}),approvalStore:f.approvalStore,source:f.source,contracts:f.contracts,descriptor:f.descriptor,context:f.context,
  now:()=>f.state.now,newId:()=>id(30),limits:{maxRequestMs:500,maxResponseBytes:65536,maxCleanupMs:30},sourceEnabled:true});
 const make=(extra={})=>createPostgresCommandExecutor({...options(),...extra});
 const owner=make();await owner.bindTrustedGrant(h.json());
 const row=()=>[...h.state().reservations.values()][0],produced=()=>[...h.state().produced.values()][0];
 return {f,h,owner,make,row,produced,run:signal=>owner.execute(f.value,h.credential,signal),read:()=>owner.readOutcome(f.value,h.credential),reconcile:()=>owner.reconcileInvocation(f.value)};
}

for(const action of ['task.create','task.update','memory.propose','artifact.file'])test(`actual canonical producer/accounting path: ${action}`,async()=>{
 const c=await connected(action),result=await c.run();
 assert.equal(result.status,'observed');assert.equal(result.outcome.receipt.outcome,'succeeded');assert.equal(c.f.state.effects,1);
 assert.equal(c.h.state().produced.size,1);assert.equal(c.h.state().reservations.size,1);assert.equal(c.row().state,'SETTLED');
 assert.equal(c.row().charged_micro_usd,'10');assert.equal(c.h.state().budget.consumed_micro_usd,'10');
 assert.equal(c.produced().completion.resultSha256,canonicalSha256(result));assert.equal(c.row().arguments_sha256,c.f.proposal.commandSha256);
 assert.equal(c.f.state.sqlRows[0].state,'OUTCOME');assert.equal((await c.read()).status,'observed');
 const reconciled=await c.reconcile();assert.equal(reconciled.stage,'SETTLED');assert.equal(reconciled.resultDelivered,false);assert.equal(c.f.state.effects,1);
 for(const key of ['executeOwned','forInvocation','forOwnedInvocation','settle','producer','budget','createExecutor'])assert.equal(Object.hasOwn(c.owner,key),false);
});

test('default unavailable and personal pending refusal allocate no invocation/effect',async()=>{
 for(const personal of [false,true]){
  const c=await connected(personal?'memory.propose':'task.create');if(personal){c.f.command.arguments.scope='personal';c.f.resign();}
  const owner=personal?c.owner:c.make({sourceEnabled:false});
  await assert.rejects(async()=>owner.execute(c.f.value,c.h.credential),personal?/PENDING_PRODUCER_UNAVAILABLE/:/UNAVAILABLE/);
  assert.equal(c.h.state().produced.size,0);assert.equal(c.f.state.sqlRows.length,0);assert.equal(c.f.state.effects,0);
 }
});

test('two owners of exact delivery retain one source effect and one fixed charge',async()=>{
 const c=await connected(),other=c.make();const results=await Promise.allSettled([c.run(),other.execute(c.f.value,c.h.credential)]);
 assert.ok(results.some(r=>r.status==='fulfilled'&&r.value.status==='observed'));
 assert.equal(c.f.state.effects,1);assert.equal(c.h.state().produced.size,1);assert.equal(c.h.state().reservations.size,1);assert.equal(c.h.state().budget.consumed_micro_usd,'10');
 assert.equal((await other.readOutcome(c.f.value,c.h.credential)).status,'observed');
});

test('restart-style repeated exact command reads persisted outcome without a second hold/effect',async()=>{
 const c=await connected();await c.run();const again=await c.make().execute(c.f.value,c.h.credential);
 assert.equal(again.status,'observed');assert.equal(c.f.state.effects,1);assert.equal(c.h.state().reservations.size,1);assert.equal(c.h.state().budget.consumed_micro_usd,'10');
});

test('same delivery changed immutable command is conflict before new effect',async()=>{
 const c=await connected();await c.run();c.f.command.arguments.title='substituted';c.f.resign();
 await assert.rejects(c.run());assert.equal(c.f.state.effects,1);assert.equal(c.h.state().produced.size,1);assert.equal(c.h.state().budget.consumed_micro_usd,'10');
});

for(const mutation of ['revoked','expired','wrong-fence','quarantined'])test(`canonical stored ${mutation} denies before effect`,async()=>{
 const c=await connected();if(mutation==='revoked')c.h.state().grant.state='REVOKED';if(mutation==='expired')c.h.state().grant.expires_at=new Date(NOW);
 if(mutation==='wrong-fence')c.h.state().run.fence++;if(mutation==='quarantined')c.h.state().budget.quarantined=true;
 await assert.rejects(c.run());assert.equal(c.f.state.effects,0);assert.equal(c.h.state().reservations.size,0);assert.equal(c.h.state().budget.consumed_micro_usd,'0');
});

test('existing model UNKNOWN liability blocks new canonical command reservation',async()=>{
 const c=await connected();c.h.state().model.push({grant_id:c.h.invocation.grantId,run_id:c.h.invocation.binding.runId,state:'UNKNOWN',hold_micro_usd:'1'});
 await assert.rejects(c.run());assert.equal(c.f.state.effects,0);assert.equal(c.h.state().reservations.size,0);assert.equal((await c.read()).status,'indeterminate');
});

for(const stage of ['prepare','reserve','marker','settle'])test(`lost ${stage} commit ACK does not automatically redispatch/refund`,async()=>{
 const c=await connected();c.h.loseStage(stage);await assert.rejects(c.run());
 assert.equal(c.f.state.effects,['marker','settle'].includes(stage)?1:0);
 if(stage==='prepare'){assert.equal(c.h.state().produced.size,1);assert.equal(c.f.state.sqlRows.length,0);assert.equal((await c.reconcile()).stage,'PREPARED');return;}
 assert.equal(c.row().state,stage==='settle'?'SETTLED':'UNKNOWN');
 assert.equal(c.h.state().budget.consumed_micro_usd,stage==='settle'?'10':'0');
 const before=c.f.state.effects;const replay=await c.make().execute(c.f.value,c.h.credential);assert.equal(replay.status,'indeterminate');assert.equal(c.f.state.effects,before);
 const recovered=await c.reconcile();assert.equal(recovered.stage,stage==='reserve'?'UNKNOWN':'SETTLED');assert.equal(recovered.resultDelivered,false);
 const again=await c.reconcile();assert.equal(again.stage,recovered.stage);assert.equal(c.h.state().budget.consumed_micro_usd,stage==='reserve'?'0':'10');
});

test('aborted parked marker COMMIT retains proof/hold without later automatic accounting; explicit historical reconcile charges once',async()=>{
 const c=await connected(),park=c.h.parkCommit('marker'),ac=new AbortController();const pending=c.run(ac.signal);const rejected=assert.rejects(pending);
 await park.ready;ac.abort();await rejected;park.resume();for(let i=0;i<8;i++)await nextTurn();
 assert.equal(c.f.state.effects,1);assert.equal(c.row().state,'UNKNOWN');assert.equal(c.h.state().budget.consumed_micro_usd,'0');
 c.h.state().grant.state='REVOKED';c.f.state.now=NOW+20000;c.h.setClock(NOW+20000);
 assert.equal((await c.reconcile()).stage,'SETTLED');assert.equal((await c.reconcile()).resultDelivered,false);assert.equal(c.h.state().budget.consumed_micro_usd,'10');
});

test('fresh shortened release deadline fences parked marker ACK and keeps liability',async()=>{
 const c=await connected(),park=c.h.parkCommit('marker');c.f.state.hooks.http=()=>{c.f.state.authorityDeadline=NOW+20;};
 const pending=c.run(),rejected=assert.rejects(pending);await park.ready;c.f.state.now=NOW+21;c.h.setClock(NOW+21);park.resume();await rejected;for(let i=0;i<8;i++)await nextTurn();
 assert.equal(c.f.state.effects,1);assert.equal(c.row().state,'UNKNOWN');assert.equal(c.h.state().budget.consumed_micro_usd,'0');
});

test('source failure after reservation retains UNKNOWN without marker or charge',async()=>{
 const c=await connected();c.f.state.hooks.http=()=>{throw Error('synthetic uncertain transport');};
 await assert.rejects(c.run());assert.equal(c.row().state,'UNKNOWN');assert.equal(c.produced().completion,null);assert.equal(c.f.state.effects,1);
 assert.equal((await c.reconcile()).stage,'UNKNOWN');assert.equal(c.h.state().budget.consumed_micro_usd,'0');
});

test('new authorized executor attempt reads original durable receipt without rebinding effect authority',async()=>{
 const c=await connected();await c.run();const original=structuredClone(c.f.state.sqlRows[0].executor);
 c.f.execution.executorBinding.attemptId=id(71);c.f.execution.executorBinding.workerId=id(72);c.f.execution.executorBinding.writerFence=2;
 const recovered=await c.make().readOutcome(c.f.value,c.h.credential);assert.equal(recovered.status,'observed');
 assert.deepEqual(c.f.state.sqlRows[0].executor,original);assert.equal(c.f.state.effects,1);
 await assert.rejects(c.make().execute(c.f.value,c.h.credential));assert.equal(c.f.state.effects,1);assert.equal(c.h.state().budget.consumed_micro_usd,'10');
});

test('current read authority revocation cannot expose retained command outcome',async()=>{
 const c=await connected();await c.run();c.f.state.revoked=true;
 await assert.rejects(c.read());assert.equal(c.f.state.effects,1);assert.equal(c.h.state().budget.consumed_micro_usd,'10');
 assert.equal((await c.reconcile()).stage,'SETTLED'); // trusted historical accounting only; no returned command body
 assert.equal((await c.reconcile()).resultDelivered,false);
});
