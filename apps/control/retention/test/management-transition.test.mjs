import test from 'node:test';
import assert from 'node:assert/strict';
import {setImmediate as turn} from 'node:timers/promises';
import {compose,subjectOf,ownership} from './fixture.mjs';
import {createSuppressionOwner} from '../suppression.mjs';
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};

test('one held subject lock supports suppress/read/release without recursive acquisition',{timeout:1000},async()=>{
 const f=compose(),subject=subjectOf();let locks=0;
 const journal={...f.journal,withTransition(key,work){locks++;return f.journal.withTransition(key,work);}};
 const owner=createSuppressionOwner({ledger:f.ledger,journal,ownership,serving:f.serving,now:f.clock.now});
 await owner.withTransition({principal:f.principal,subject},async scope=>{
  assert.equal(await scope.current(),null);
  assert.equal((await scope.suppress({reason:'conversation-trash'})).state,'SUPPRESSED');
  assert.equal((await scope.current()).state,'SUPPRESSED');
  assert.equal((await scope.release({reason:'confirmed metadata non-commit'})).state,'RELEASED');
 });
 assert.equal(locks,1);assert.equal(f.sink.size(),2);assert.equal(await owner.isSuppressed(subject),false);
});
test('competing transition and content serving wait for the same management exclusion',{timeout:1000},async()=>{
 const f=compose(),subject=subjectOf(),entered=deferred(),finish=deferred();let releaseStarted=false,served=false;
 const management=f.suppression.withTransition({principal:f.principal,subject},async scope=>{
  await scope.suppress({reason:'conversation-trash'});entered.resolve();await finish.promise;
 });await entered.promise;
 const serving=f.suppression.withRelease([subject],async(_signal,assertServable)=>{await assertServable(subject);served=true;});serving.catch(()=>{});
 const restore=f.suppression.withTransition({principal:f.principal,subject},async scope=>{releaseStarted=true;await scope.release({reason:'confirmed Restore'});});
 await turn();assert.equal(releaseStarted,false);assert.equal(served,false);
 finish.resolve();await management;await assert.rejects(serving,/RETENTION_SUPPRESSED/);await restore;
 assert.equal(served,false);assert.equal(await f.suppression.isSuppressed(subject),false);
});
test('scoped operations cannot escape the callback or switch subject/principal',{timeout:1000},async()=>{
 const f=compose(),subject=subjectOf();let captured;
 await f.suppression.withTransition({principal:f.principal,subject},async scope=>{captured=scope;await scope.suppress({reason:'conversation-trash'});});
 await assert.rejects(captured.release({reason:'late'}),/RETENTION_INVALID_REQUEST/);
 const foreign=subjectOf('conversation','another-owner');
 await assert.rejects(f.suppression.withTransition({principal:f.principal,subject:foreign},scope=>scope.current()),/RETENTION_AUTHORIZATION_REFUSED/);
 assert.equal(await f.suppression.isSuppressed(subject),true);assert.equal(await f.suppression.isSuppressed(foreign),false);
});
test('exception or cancellation releases exclusion but does not compensate uncertain suppression',{timeout:1000},async()=>{
 const f=compose(),subject=subjectOf(),controller=new AbortController();
 await assert.rejects(f.suppression.withTransition({principal:f.principal,subject},async scope=>{
  await scope.suppress({reason:'conversation-trash'});controller.abort(Error('Core timeout'));controller.signal.throwIfAborted();
 }),/Core timeout/);
 await f.suppression.withTransition({principal:f.principal,subject},async scope=>{assert.equal((await scope.current()).state,'SUPPRESSED');await scope.release({reason:'subsequent exact no-commit proof'});});
 assert.equal(await f.suppression.isSuppressed(subject),false);
});
test('pending ledger acknowledgement keeps exclusion until it settles even if callback returns',{timeout:1000},async()=>{
 const f=compose(),subject=subjectOf(),entered=deferred(),finish=deferred();let completed=false,second=false;
 const ledger={...f.ledger,async append(value){entered.resolve();await finish.promise;return f.ledger.append(value);}};
 const owner=createSuppressionOwner({ledger,journal:f.journal,ownership,serving:f.serving,now:f.clock.now});
 const first=owner.withTransition({principal:f.principal,subject},scope=>{void scope.suppress({reason:'conversation-trash'});}).then(()=>{completed=true;});
 await entered.promise;const following=f.suppression.withTransition({principal:f.principal,subject},async scope=>{second=true;assert.equal((await scope.current()).state,'SUPPRESSED');});
 await turn();assert.equal(completed,false);assert.equal(second,false);finish.resolve();await first;await following;
});
test('fresh owner changes and recovery-barrier closure prevent scoped effects',{timeout:1000},async()=>{
 const f=compose(),subject=subjectOf();
 await assert.rejects(f.suppression.withTransition({principal:f.principal,subject},async scope=>{f.serving.disable();await scope.suppress({reason:'conversation-trash'});}),/RETENTION_RECOVERY_BARRIER/);
 assert.equal(f.sink.size(),0);
});
