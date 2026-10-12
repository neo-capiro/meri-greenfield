/** Actual journal/HTTP/authority/canonical budget; inherited scripted SQL only. */
import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {harness} from '../../../docs/qualification/candidates/durable-invocation-20261012/review/invocation-harness.mjs';
import {fixture,NOW,id} from './commands-fixture.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {createPostgresCommandExecutor} from '../commands/durable-executor.mjs';
function setup(action='task.create'){
 const f=fixture(action,{policy:'a'.repeat(64)}),b=harness();b.setClock(NOW);
 Object.assign(b.allocation.run,Object.fromEntries(Object.keys(b.allocation.run).map(k=>[k,f.binding[k]])));
 b.allocation.manifest.allowedOperations=[f.descriptor.operation];b.allocation.manifestSha256=canonicalSha256(b.allocation.manifest);
 b.allocation.schedule.operations=[{operation:f.descriptor.operation,chargeMicrousd:10}];b.allocation.schedule.expiresAt=new Date(NOW+10000).toISOString();
 b.invocation.binding=structuredClone(f.binding);b.invocation.qualificationBinding.runId=f.binding.runId;
 b.invocation.allocationSha256=canonicalSha256(b.allocation);b.invocation.capabilitySha256=createHash('sha256').update('synthetic').digest('hex');
 b.state().run.run_id=f.binding.runId;b.state().grant.run_id=f.binding.runId;b.state().grant.capability_sha256=b.invocation.capabilitySha256;b.state().grant.expires_at=new Date(NOW+10000);
 const {invocationId:ignored,...context}=b.invocation;
 const create=changes=>createPostgresCommandExecutor({pool:b.pool,allocationJson:JSON.stringify(b.allocation),producerContext:{context,producer:b.producer},
  journal:f.journal,authority:f.authority,approvalStore:f.approvalStore,source:f.source,contracts:f.contracts,descriptor:f.descriptor,context:f.context,
  now:()=>f.state.now,newId:()=>id(50),limits:{maxRequestMs:9000,maxResponseBytes:65536,maxCleanupMs:40},sourceEnabled:true,...changes});
 const run=signal=>create().execute(f.call(),'synthetic',signal);
 return {f,b,create,run,ready:()=>create().bindTrustedGrant(JSON.stringify(b.invocation))};
}
for(const action of ['task.create','task.update','memory.propose','artifact.file'])test(`${action}: actual private budget producer/source/journal completes and replay never dispatches`,async()=>{
 const t=setup(action);await t.ready();const value=await t.run();assert.equal(value.status,'observed');assert.equal(t.f.state.fetches,1);
 const row=[...t.b.state().produced.values()][0],reservation=[...t.b.state().reservations.values()][0];
 assert.equal(row.arguments_sha256,t.f.proposal.commandSha256);assert.equal(row.completion.resultSha256,canonicalSha256(value));assert.equal(reservation.state,'SETTLED');
 assert.equal(t.b.state().budget.consumed_micro_usd,'10');assert.deepEqual(await t.run(),value);assert.equal(t.f.state.fetches,1);assert.equal(t.b.state().reservations.size,1);
 const r=await t.create().reconcileInvocation(t.f.call());assert.equal(r.stage,'SETTLED');assert.equal(r.resultDelivered,false);assert.equal(t.b.state().budget.consumed_micro_usd,'10');
});
for(const phase of ['prepare','reserve','marker','settle'])test(`lost ${phase} ACK retains stable identity/liability and never retries issued effects`,async()=>{
 const t=setup();await t.ready();t.b.loseStage(phase);await assert.rejects(t.run());const rows=[...t.b.state().produced.values()];assert.equal(rows.length,1);
 const r=await t.create().reconcileInvocation(t.f.call());assert.equal(r.stage,phase==='prepare'?'PREPARED':phase==='reserve'?'UNKNOWN':'SETTLED');
 assert.equal(t.f.state.fetches,['marker','settle'].includes(phase)?1:0);
 if(phase!=='prepare'){assert.equal((await t.run()).status,'indeterminate');assert.equal(t.f.state.fetches,['marker','settle'].includes(phase)?1:0);}
 assert.equal(t.b.state().budget.consumed_micro_usd,['marker','settle'].includes(phase)?'10':'0');
});
test('personal pending and default disabled refuse before canonical budget/source ports',async()=>{
 const t=setup();assert.throws(()=>t.create({sourceEnabled:false}).execute(t.f.call(),'synthetic'),/UNAVAILABLE/);assert.equal(t.b.commands.length,0);
 const p=setup('memory.propose');p.f.command.arguments.scope='personal';p.f.command.arguments.clientId=null;p.f.proposal.commandSha256=canonicalSha256(p.f.command);p.f.execution.commandSha256=p.f.proposal.commandSha256;
 assert.throws(()=>p.create().execute(p.f.call(),'synthetic'),/PENDING_PRODUCER_UNAVAILABLE/);assert.equal(p.b.commands.length,0);assert.equal(p.f.state.fetches,0);
});
for(const stage of ['connect','BEGIN',"SET LOCAL statement_timeout = '5s'"])test(`late ${stage} during preparation starts no later production port`,async()=>{
 const t=setup();await t.ready();const gate=t.b.parkSetup(stage),controller=new AbortController(),start=t.b.commands.length;
 const pending=t.run(controller.signal);await gate.ready;controller.abort();gate.resume();await assert.rejects(pending);await new Promise(r=>setImmediate(r));
 assert.equal(t.f.state.fetches,0);assert.equal(t.b.state().produced.size,0);
 const added=t.b.commands.slice(start).map(x=>x.sql);if(stage==='connect')assert.deepEqual(added,[]);else assert.equal(added.at(-1),'ROLLBACK');
});
test('cancelled marker ACK cannot start live accounting; explicit historical marker reconciliation only',async()=>{
 const t=setup();await t.ready();const gate=t.b.parkCommit('marker'),controller=new AbortController();
 const pending=t.run(controller.signal);await gate.ready;controller.abort();gate.resume();await assert.rejects(pending);await new Promise(r=>setImmediate(r));
 assert.equal(t.b.state().budget.consumed_micro_usd,'0');assert.equal(t.f.state.fetches,1);
 assert.equal((await t.create().reconcileInvocation(t.f.call())).stage,'SETTLED');assert.equal(t.b.state().budget.consumed_micro_usd,'10');
 assert.equal((await t.run()).status,'indeterminate');assert.equal(t.f.state.fetches,1);
});
test('returned owner has no producer/writer/legacy execute path and caller cannot install ports',()=>{
 const t=setup(),owner=t.create();for(const key of ['producer','settle','forInvocation','executeOwned','budget','createExecutor'])assert.equal(Object.hasOwn(owner,key),false);
 assert.throws(()=>t.create({budget:{}}));assert.throws(()=>t.create({createExecutor(){throw Error('never');}}));assert.equal(t.b.commands.length,0);
});
test('fresh approval-only cutoff survives parked marker ACK without starting live accounting',async()=>{
 const t=setup();await t.ready();t.f.state.fetchHook=async(_u,_o,result)=>{t.f.decision.expiresAt=new Date(NOW+500).toISOString();return new Response(JSON.stringify(result),{headers:{'content-type':'application/json'}});};
 const gate=t.b.parkCommit('marker'),pending=t.run();await gate.ready;t.f.state.now=NOW+501;gate.resume();await assert.rejects(pending);
 assert.equal(t.b.state().budget.consumed_micro_usd,'0');assert.equal(t.f.state.fetches,1);assert.ok([...t.b.state().produced.values()][0].completion);
 assert.equal((await t.create().reconcileInvocation(t.f.call())).stage,'SETTLED');assert.equal(t.b.state().budget.consumed_micro_usd,'10');
});
