import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,id,NOW,nextTurn} from './commands-independent-fixture.mjs';

for(const action of ['task.create','task.update','memory.propose','artifact.file'])test(`actual ${action} executor to fixed HTTP adapter to durable receipt`,async()=>{
 const f=fixture(action),out=await f.make().execute(f.value,'synthetic');
 assert.equal(out.status,'observed');assert.equal(out.outcome.receipt.outcome,'succeeded');assert.equal(out.outcome.receipt.sourceTransactionId,null);
 assert.equal(f.state.effects,1);assert.equal(f.state.sqlRows[0].state,'OUTCOME');assert.ok(f.calls.indexOf('commit')<f.calls.indexOf('http'));
 assert.equal(f.state.lastRequest.options.method,'POST');assert.equal(f.state.lastRequest.options.redirect,'error');assert.equal(f.state.lastRequest.options.credentials,'omit');
 assert.equal(new URL(f.state.lastRequest.url).origin,'https://source.invalid');
 assert.ok(Object.isFrozen(out));if(action==='artifact.file')assert.equal(out.outcome.result.files[0].reason,'Partial extracted text');
});
test('default disabled executor refuses before trusted ports',async()=>{const f=fixture();await assert.rejects(f.make({sourceEnabled:false}).execute(f.value,'synthetic'),/UNAVAILABLE/);assert.deepEqual(f.calls,[]);});
test('personal pending proposal refuses before credential, claim or source effects',async()=>{
 const f=fixture('memory.propose');f.command.arguments.scope='personal';f.resign();await assert.rejects(f.make().execute(f.value,'synthetic'),/PENDING_PRODUCER_UNAVAILABLE/);assert.equal(f.state.effects,0);assert.equal(f.calls.includes('credentials'),false);assert.equal(f.calls.includes('insert'),false);
});
test('immutable command changed after approval cannot become a source effect',async()=>{const f=fixture();f.command.arguments.title='Substituted';await assert.rejects(f.make().execute(f.value,'synthetic'));assert.equal(f.state.effects,0);assert.deepEqual(f.calls,[]);});
for(const [name,decisionOverride] of [
 ['rejected',{decision:'rejected'}],['foreign hash',{commandSha256:'e'.repeat(64)}],['foreign proposal',{proposalId:id(40)}],['foreign approver',{approver:{tenantId:'review-tenant',actorId:'intruder'}}],['foreign policy',{policyRevision:'foreign'}],['expired',{expiresAt:new Date(NOW).toISOString()}],['future decision',{decidedAt:new Date(NOW+1).toISOString()}],['nonrepresentable date',{decidedAt:'2026-10-11T23:59:60Z'}]
])test(`current approval ${name} refuses before claim/effect`,async()=>{const f=fixture();f.state.decisionOverride=decisionOverride;await assert.rejects(f.make().execute(f.value,'synthetic'));assert.equal(f.state.effects,0);assert.equal(f.calls.includes('insert'),false);});
test('revoked approval cannot start a source effect',async()=>{const f=fixture();f.state.approvalRevoked=true;await assert.rejects(f.make().execute(f.value,'synthetic'));assert.equal(f.state.effects,0);});
test('durable replay across actual executor replacement never redispatches',async()=>{
 const f=fixture(),first=await f.make().execute(f.value,'synthetic');Object.assign(f.execution.executorBinding,{attemptId:id(40),workerId:id(41),writerFence:2});
 const second=await f.make().execute(f.value,'synthetic');assert.equal(f.state.effects,1);assert.deepEqual(second.outcome,first.outcome);assert.equal(f.state.sqlRows.length,1);
});
test('same trusted delivery cannot adopt a changed immutable command',async()=>{
 const f=fixture();await f.make().execute(f.value,'synthetic');f.command.arguments.title='Changed';f.resign();await assert.rejects(f.make().execute(f.value,'synthetic'),/IDEMPOTENCY_CONFLICT/);assert.equal(f.state.effects,1);assert.equal(f.state.sqlRows.length,1);
});
test('read absent is an observation and never dispatch permission',async()=>{const f=fixture(),out=await f.make().readOutcome(f.value,'synthetic');assert.deepEqual(out,{status:'absent',outcome:null});assert.equal(f.state.effects,0);assert.equal(f.calls.includes('insert'),false);});
test('lost claim acknowledgement never issues source effect and later read retains unknown liability',async()=>{
 const f=fixture();f.state.failCommit=1;await assert.rejects(f.make().execute(f.value,'synthetic'),/COMMIT_UNCERTAIN/);assert.equal(f.state.effects,0);assert.equal(f.state.sqlRows[0].state,'CLAIMED');
 assert.deepEqual(await f.make().readOutcome(f.value,'synthetic'),{status:'indeterminate',outcome:null});await f.make().execute(f.value,'synthetic');assert.equal(f.state.effects,0);
});
test('lost final receipt acknowledgement may recover exact outcome but cannot redispatch',async()=>{
 const f=fixture();f.state.failCommit=2;await assert.rejects(f.make().execute(f.value,'synthetic'),/COMMIT_UNCERTAIN/);assert.equal(f.state.effects,1);assert.equal(f.state.sqlRows[0].state,'OUTCOME');
 const result=await f.make().readOutcome(f.value,'synthetic');assert.equal(result.status,'observed');assert.equal(result.outcome.receipt.outcome,'succeeded');assert.equal(f.state.effects,1);
});
test('unknown source acknowledgement is immediately indeterminate and remains non-retryable',async()=>{
 const f=fixture();f.state.hooks.http=()=>{throw Error('source may already have committed');};await assert.rejects(f.make().execute(f.value,'synthetic'),/OUTCOME_UNKNOWN/);assert.equal(f.state.sqlRows[0].state,'UNKNOWN');assert.equal(f.state.effects,1);
 await f.make().execute(f.value,'synthetic');assert.equal(f.state.effects,1);
});
test('revoked authority after external effect cannot release success or erase liability',async()=>{
 const f=fixture();f.state.hooks.http=()=>{f.state.revoked=true;};await assert.rejects(f.make().execute(f.value,'synthetic'),/OUTCOME_UNKNOWN/);assert.equal(f.state.effects,1);assert.equal(f.state.sqlRows[0].state,'UNKNOWN');
});
test('caller mutation during parked credentials cannot substitute immutable intent',async()=>{
 const f=fixture(),parked=Promise.withResolvers(),entered=Promise.withResolvers();f.state.hooks.credentials=()=>{entered.resolve();return parked.promise;};
 const pending=f.make().execute(f.value,'synthetic');await entered.promise;f.command.arguments.title='Late substitution';parked.resolve();
 // Synthetic backend fixture follows the caller-mutated title; canonical output must refuse it.
 await assert.rejects(pending,/OUTCOME_UNKNOWN/);assert.equal(JSON.parse(f.state.lastRequest.options.body).title,'Independently reviewed task');assert.equal(f.state.sqlRows[0].payload.proposal.command.arguments.title,'Independently reviewed task');
});
for(const port of ['credentials','approval','connect','insert','http'])test(`abort while ${port} is parked starts no later source/receipt effect`,async()=>{
 const f=fixture(),controller=new AbortController(),parked=Promise.withResolvers(),entered=Promise.withResolvers();
 let seen=false;f.state.hooks[port]=()=>{if(!seen){seen=true;entered.resolve();return parked.promise;}};
 const pending=f.make().execute(f.value,'synthetic',controller.signal);await entered.promise;controller.abort();
 await assert.rejects(pending);const before=f.state.effects;parked.resolve();await nextTurn();await nextTurn();assert.equal(f.state.effects,before);assert.equal(f.calls.includes('complete'),false);
});
test('late cleanup connection after original cleanup deadline cannot start another transaction',async()=>{
 const f=fixture(),parked=Promise.withResolvers(),entered=Promise.withResolvers();
 f.state.hooks.http=()=>{throw Error('source effect acknowledgement lost');};
 f.state.hooks.connect=()=>{if(f.state.effects){entered.resolve();return parked.promise;}};
 const pending=f.make().execute(f.value,'synthetic');await entered.promise;await assert.rejects(pending,/OUTCOME_UNKNOWN/);
 const stopped=f.calls.length;parked.resolve();await nextTurn();await nextTurn();
 assert.deepEqual(f.calls.slice(stopped).filter(x=>x!=='release'),[],'only release of a late borrowed connection is permitted');
 assert.equal(f.state.sqlRows[0].state,'CLAIMED');
});
