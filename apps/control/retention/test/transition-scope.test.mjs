import test from 'node:test';
import assert from 'node:assert/strict';
import {compose,subjectOf} from './fixture.mjs';
const latch=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const turn=()=>new Promise(r=>setImmediate(r));

test('same subject nested suppression and release reuse one transition and retain ordinary ownership checks',async()=>{
 const f=compose(),subject=subjectOf(),selection={principal:f.principal,subject};
 await f.suppression.withTransition(selection,async()=>{
  await f.suppression.suppress({...selection,reason:'conversation-trash'});
  assert.equal(await f.suppression.isSuppressed(subject),true);
  await f.suppression.release({...selection,reason:'conversation-restore'});
 });
 assert.equal(await f.suppression.isSuppressed(subject),false);
 await assert.rejects(f.suppression.withTransition({...selection,principal:{...f.principal,actorId:'foreign'}},()=>{}),{code:'RETENTION_OWNERSHIP_REFUSED'});
});
test('competing management and history wait for the transition before acquiring their conversation lock',async()=>{
 const f=compose(),subject=subjectOf(),selection={principal:f.principal,subject},entered=latch(),finish=latch(),order=[];
 const management=f.suppression.withTransition(selection,async()=>{order.push('management-conversation');entered.resolve();await finish.promise;await f.suppression.suppress({...selection,reason:'conversation-trash'});});
 await entered.promise;
 const history=f.suppression.withRelease([subject],async(_signal,assertServable)=>{order.push('history-conversation');await assertServable(subject);});
 const competing=f.suppression.withTransition(selection,async()=>{order.push('next-management');});
 await turn();assert.deepEqual(order,['management-conversation']);finish.resolve();
 await management;await assert.rejects(history,{code:'RETENTION_SUPPRESSED'});await competing;
 assert.deepEqual(order,['management-conversation','history-conversation','next-management']);
});
test('different subject cannot borrow a transition; an independent caller can lock it',async()=>{
 const f=compose(),subject=subjectOf(),other=subjectOf(),selection={principal:f.principal,subject},entered=latch(),finish=latch();
 const work=f.suppression.withTransition(selection,async()=>{
  await assert.rejects(f.suppression.suppress({principal:f.principal,subject:other,reason:'other'}),{code:'RETENTION_TRANSITION_MISMATCH'});
  entered.resolve();await finish.promise;
 });await entered.promise;
 await f.suppression.suppress({principal:f.principal,subject:other,reason:'independent'});finish.resolve();await work;
 assert.equal(await f.suppression.isSuppressed(subject),false);assert.equal(await f.suppression.isSuppressed(other),true);
});
test('throw releases the journal lock and inherited asynchronous work cannot reuse an expired transition',async()=>{
 const f=compose(),subject=subjectOf(),selection={principal:f.principal,subject},escaped=latch();let late;
 await assert.rejects(f.suppression.withTransition(selection,async()=>{
  late=escaped.promise.then(()=>f.suppression.suppress({...selection,reason:'escaped'}));throw Error('unknown Core commit');
 }),/unknown Core commit/);
 escaped.resolve();await assert.rejects(late,{code:'RETENTION_TRANSITION_EXPIRED'});
 await f.suppression.suppress({...selection,reason:'new-owner-call'});assert.equal(await f.suppression.isSuppressed(subject),true);
});
test('unknown metadata commit after suppression leaves history closed',async()=>{
 const f=compose(),subject=subjectOf(),selection={principal:f.principal,subject};
 await assert.rejects(f.suppression.withTransition(selection,async()=>{await f.suppression.suppress({...selection,reason:'conversation-trash'});throw Error('metadata commit unknown');}),/metadata commit unknown/);
 await assert.rejects(f.suppression.assertServable(subject),{code:'RETENTION_SUPPRESSED'});
});
