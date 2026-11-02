import test from 'node:test';import assert from 'node:assert/strict';import {setImmediate as turn} from 'node:timers/promises';
import {managementFixture,binding,id,check} from './management-fixture.mjs';
import {ProductError,productFailure} from '../../product-access/errors.mjs';
import {hash} from '../boundary.mjs';
import {createExecutionBinding} from '../execution-boundary.mjs';
const code=(expected,outcome)=>error=>productFailure(error)?.code===expected&&(!outcome||productFailure(error)?.outcome===outcome);
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
test('owned empty Core chat registers a real conversation without a fake run, and still accepts its first input',async()=>{
 const f=await managementFixture();await f.manage(f.request('rename',{title:'Owned title'}));assert.equal(f.state.conversations.size,1);assert.equal(f.state.runs.size,0);assert.equal(f.state.events.size,0);
 await assert.rejects(f.store.history.transcript({principal:f.principal,conversationId:binding.conversationId,after:0,limit:20},check),code('NOT_FOUND'));
 await f.store.initialInputs.claim(f.p.facts,check);await f.store.initialInputs.accept(f.p.acceptance,check);assert.equal(f.state.runs.size,1);
});
test('revocation after registration authority read leaves only inert identity and cannot admit or change metadata',async()=>{
 const f=await managementFixture();let checked=false;
 await f.store.management.register({principal:f.principal,conversation:f.p.acceptance.conversation,recheckActive:async()=>{
  assert.equal(f.metadata.status,'active');checked=true;
  // Authority changes after the fresh read but before the short insert. The
  // immutable row is not a permission or an admitted prompt.
  f.setMetadata({...f.metadata,status:'archived'});
 }},check);
 assert.equal(checked,true);assert.equal(f.state.conversations.size,1);assert.equal(f.state.runs.size,0);assert.equal(f.state.events.size,0);
 await assert.rejects(f.store.initialInputs.claim(f.p.facts,check),/STORE_UNAVAILABLE/);
 f.faults.read=()=>{throw new ProductError('ACCESS_DENIED','NOT_DISPATCHED');};
 await assert.rejects(f.manage(f.request('rename',{title:'Must not change'})),code('ACCESS_DENIED'));
 assert.equal(f.applies.length,0);assert.equal(f.allocations.size,0);assert.equal(f.sink.size(),0);assert.equal(f.metadata.title,'Original');
});
test('registered empty projection cannot admit a foreign scope or owner',async()=>{
 const f=await managementFixture();await f.register();const row=[...f.state.conversations.values()][0];row.projection.scopes[0].resourceId=id(99);row.projection_sha256=hash(row.projection);
 await assert.rejects(f.store.initialInputs.claim(f.p.facts,check),/CONVERSATION_SCOPE_REFUSED/);assert.equal(f.allocations.size,0);
});
test('Trash then Restore changes metadata exactly once and releases only the committed Trash generation',async()=>{
 const f=await managementFixture(),trash=f.request('trash');const first=await f.manage(trash);assert.equal(first.conversation.status,'trashed');assert.equal(await f.suppression.isSuppressed(f.subject),true);
 assert.deepEqual(await f.manage(trash),first);assert.equal(f.receipts.size,1);
 const restore=f.request('restore',{requestId:id(81)});await f.manage(restore);await f.manage(restore);
 assert.equal(f.metadata.status,'active');assert.equal(await f.suppression.isSuppressed(f.subject),false);assert.equal(f.sink.size(),2);
});
test('committed lost acknowledgement recovers the actual immutable receipt without a second change',async()=>{
 const f=await managementFixture(),q=f.request('trash');f.faults.afterApply=()=>{f.faults.afterApply=null;throw Error('lost response');};
 assert.equal((await f.manage(q)).conversation.status,'trashed');assert.equal(f.receipts.size,1);assert.equal(f.metadata.revision,'1');assert.equal(f.sink.size(),1);
});
test('UNKNOWN and absent readback keeps suppression; retry settles the SAME idempotent command',async()=>{
 const f=await managementFixture(),q=f.request('trash');f.faults.apply=()=>{throw Error('network timeout');};
 await assert.rejects(f.manage(q),code('CONVERSATION_UNAVAILABLE','UNKNOWN'));assert.equal(f.metadata.status,'active');assert.equal(await f.suppression.isSuppressed(f.subject),true);
 f.faults.apply=null;await f.manage(q);assert.deepEqual(f.applies,[q.requestId,q.requestId]);assert.equal(f.receipts.size,1);assert.equal(f.sink.size(),1);
 // A delayed original request is the same receipt, never another metadata change.
 await f.core.apply(q);assert.equal(f.metadata.revision,'1');
});
test('a definite higher-revision CAS conflict compensates only its own suppression',async()=>{
 const f=await managementFixture(),q=f.request('trash');f.faults.apply=()=>{f.setMetadata({...f.metadata,revision:'1',title:'Concurrent rename'});throw new ProductError('CONVERSATION_MANAGEMENT_CONFLICT','NOT_DISPATCHED');};
 await assert.rejects(f.manage(q),code('CONVERSATION_MANAGEMENT_CONFLICT','NOT_DISPATCHED'));assert.equal(await f.suppression.isSuppressed(f.subject),false);assert.equal(f.sink.size(),2);
});
test('unrelated administrative suppression is never compensated or replaced',async()=>{
 const f=await managementFixture();await f.register();await f.suppression.suppress({principal:{tenantId:binding.tenantId,actorId:binding.actorId},subject:f.subject,reason:'administrative hold'});
 await assert.rejects(f.manage(f.request('trash')),code('CONVERSATION_UNAVAILABLE','NOT_DISPATCHED'));assert.equal(f.applies.length,0);assert.equal(f.sink.size(),1);assert.equal(await f.suppression.isSuppressed(f.subject),true);
});
test('failed Restore retains suppression; committed Restore lost ACK releases on exact readback',async()=>{
 const f=await managementFixture();await f.manage(f.request('trash'));const q=f.request('restore',{requestId:id(81)});f.faults.apply=()=>{throw Error('timeout');};
 await assert.rejects(f.manage(q),code('CONVERSATION_UNAVAILABLE','UNKNOWN'));assert.equal(await f.suppression.isSuppressed(f.subject),true);
 f.faults.apply=null;f.faults.afterApply=()=>{f.faults.afterApply=null;throw Error('lost restore reply');};await f.manage(q);assert.equal(await f.suppression.isSuppressed(f.subject),false);
});

test('canonical expired Restore with absent readback remains a definitive refusal and never releases Trash',async()=>{
 const f=await managementFixture();await f.manage(f.request('trash'));const q=f.request('restore',{requestId:id(81)});
 f.faults.apply=()=>{throw new ProductError('CONVERSATION_RESTORE_EXPIRED','NOT_DISPATCHED');};
 await assert.rejects(f.manage(q),code('CONVERSATION_RESTORE_EXPIRED','NOT_DISPATCHED'));
 assert.equal(f.metadata.status,'trashed');assert.equal(await f.suppression.isSuppressed(f.subject),true);assert.equal(f.sink.size(),1);
});
test('old Restore never releases a later pending Trash, even before that new Core change commits',async()=>{
 const f=await managementFixture();await f.manage(f.request('trash'));const restore=f.request('restore',{requestId:id(81)});await f.manage(restore);
 const later=f.request('trash',{requestId:id(82)});f.faults.apply=()=>{throw Error('unknown');};await assert.rejects(f.manage(later),code('CONVERSATION_UNAVAILABLE','UNKNOWN'));
 await assert.rejects(f.manage(restore),code('CONVERSATION_UNAVAILABLE','RESULT_NOT_RELEASED'));assert.equal(await f.suppression.isSuppressed(f.subject),true);assert.equal(f.sink.size(),3);
});
test('live and recovery projections preserve the same existing ledger reason',async()=>{
 const f=await managementFixture();await f.manage(f.request('trash'));const before=f.journal.snapshot();f.journal.restore(new Map());await f.recover();assert.deepEqual(f.journal.snapshot(),before);
 await f.manage(f.request('restore',{requestId:id(81)}));const released=f.journal.snapshot();f.journal.restore(new Map());await f.recover();assert.deepEqual(f.journal.snapshot(),released);
});
test('a reserved original or unfinished run blocks archive without any Core effect',async()=>{
 const f=await managementFixture();await f.register();await f.store.initialInputs.claim(f.p.facts,check);
 await assert.rejects(f.manage(f.request('archive')),code('CONVERSATION_MANAGEMENT_CONFLICT','NOT_DISPATCHED'));assert.equal(f.applies.length,0);
 await f.store.initialInputs.accept(f.p.acceptance,check);await assert.rejects(f.manage(f.request('archive')),code('CONVERSATION_MANAGEMENT_CONFLICT','NOT_DISPATCHED'));assert.equal(f.applies.length,0);
});
test('terminal projection with unknown invocation stays unmanageable; malformed execution is an outage',async()=>{
 const f=await managementFixture();await f.store.initialInputs.claim(f.p.facts,check);await f.store.initialInputs.accept(f.p.acceptance,check);
 const {versions:ignored,...identity}=createExecutionBinding({binding,versions:f.p.acceptance.run.versions,plan:{test:true},expiresAtMs:f.now()+30000,runtimeSessionId:'conversation-'+hash(binding)});
 await f.store.executions.claim(identity,check);await f.store.append(binding,{...f.p.acceptance.event,eventId:id(90),data:{state:'failed',reasonCode:'EXECUTION_FAILED'}},check);
 const query={principal:f.principal,conversationId:binding.conversationId};assert.equal((await f.store.management.inspect(query,check)).canManage,false);
 const row=[...f.state.executions.values()][0];row.record_sha256='a'.repeat(64);await assert.rejects(f.store.management.inspect(query,check),/EXECUTION_CORRUPT/);
});
test('archive exclusion wins admission race and admission rechecks actual active state after the lock',async()=>{
 const f=await managementFixture();await f.register();const entered=deferred(),finish=deferred();f.faults.apply=async()=>{entered.resolve();await finish.promise;};
 const archive=f.manage(f.request('archive'));await entered.promise;let completed=false;const claim=f.store.initialInputs.claim(f.p.facts,check).finally(()=>{completed=true;});claim.catch(()=>{});
 await turn();assert.equal(completed,false);finish.resolve();await archive;await assert.rejects(claim,/STORE_UNAVAILABLE/);assert.equal(f.allocations.size,0);
});
test('summary joins actual transcript state and propagates unavailable ownership instead of dropping a row',async()=>{
 const f=await managementFixture(),request={version:'meri.conversation-management.v1',status:'active',title:'',before:null};
 const result=await f.service.summaries({principal:f.principal,request,management:f.core});assert.equal(result.conversations[0].hasTranscript,false);assert.equal(result.conversations[0].canManage,true);
 f.core.summaries=async()=>{throw Error('Core unavailable');};await assert.rejects(f.service.summaries({principal:f.principal,request,management:f.core}),/Core unavailable/);
});
test('an unrenamed chat is summarized by its first prompt, or as New conversation before one exists; a Core title passes through',async()=>{
 const f=await managementFixture(),request={version:'meri.conversation-management.v1',status:'active',title:'',before:null},summaries=()=>f.service.summaries({principal:f.principal,request,management:f.core});
 assert.equal((await summaries()).conversations[0].title,'Original');
 f.setMetadata({...f.metadata,title:'New Meri session'});await f.register();
 assert.equal((await summaries()).conversations[0].title,'New conversation');
 await f.store.initialInputs.claim(f.p.facts,check);await f.store.initialInputs.accept(f.p.acceptance,check);
 assert.equal((await summaries()).conversations[0].title,'Original prompt');
 await f.manage(f.request('rename',{title:'Owned title'}));assert.equal((await summaries()).conversations[0].title,'Owned title');
});
