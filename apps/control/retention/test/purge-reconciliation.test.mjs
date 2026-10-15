import test from 'node:test';import assert from 'node:assert/strict';
import {planPurge,createPurgeExecutor,workflowIdentity} from '../purge.mjs';
import {createRecoveryReconciler} from '../reconciliation.mjs';
import {enumerateReferences,createReferenceIndex,sharedReferences} from '../inventory.mjs';
import {subjectKey} from '../boundary.mjs';
import {compose,subjectOf,snapshot,policy,object} from './fixture.mjs';
const day=86400000,noHold=()=>({objectLockRetainUntilMs:null,legalHold:false});
async function suppressed(f,s){await f.suppression.suppress({principal:f.principal,subject:s,reason:'owner request'});f.clock.advance(2*day);return f.journal.get(subjectKey(s));}
const planFor=(f,s,inv,extra={})=>planPurge({subject:s,journalState:extra.journalState,policy:extra.policy===undefined?policy():extra.policy,inventory:inv,shared:extra.shared??[],holds:extra.holds??noHold,liabilities:extra.liabilities??[],lastActivityAtMs:f.clock.now()-30*day,nowMs:f.clock.now()});
test('purge planning: refused without suppression or policy; cooling, holds, liabilities and shared fork references block; identities are deterministic and duplicates coalesce',async()=>{
 const f=compose(),s=subjectOf(),inv=enumerateReferences(snapshot(s));
 assert.throws(()=>planFor(f,s,inv,{journalState:null}),/RETENTION_NOT_SUPPRESSED/);
 const js=await suppressed(f,s);assert.throws(()=>planFor(f,s,inv,{journalState:js,policy:null}),/RETENTION_POLICY_REQUIRED/);
 const early={...js,suppressedAtMs:f.clock.now()-1000};assert.equal(planFor(f,s,inv,{journalState:early}).state,'BLOCKED');assert.ok(planFor(f,s,inv,{journalState:early}).blocks.every(b=>b.reason==='COOLING_PERIOD'));
 const plan=planFor(f,s,inv,{journalState:js});assert.equal(plan.state,'PLANNED');assert.equal(plan.steps.length,inv.objects.length);assert.equal(plan.planSha256,planFor(f,s,inv,{journalState:js}).planSha256,'same inputs, same plan');
 assert.equal(plan.steps[0].workflowId,workflowIdentity({tenantId:s.tenantId,className:plan.steps[0].className,objectId:plan.steps[0].objectId,versionId:plan.steps[0].versionId,policyVersion:3}));
 const held=inv.objects[0];const withHold=planFor(f,s,inv,{journalState:js,holds:o=>o.objectId===held.objectId?{objectLockRetainUntilMs:f.clock.now()+day,legalHold:false}:noHold()});assert.equal(withHold.state,'BLOCKED');assert.deepEqual(withHold.blocks.map(b=>b.reason),['OBJECT_LOCK']);
 assert.deepEqual(planFor(f,s,inv,{journalState:js,liabilities:[{runId:'r',kind:'UNKNOWN_LAUNCH'}]}).blocks.map(b=>b.reason),['UNKNOWN_LIABILITY']);
 const shared=object(),a=subjectOf(),b=subjectOf(),invA=enumerateReferences(snapshot(a,{shared:[shared]})),invB=enumerateReferences(snapshot(b,{shared:[shared]})),index=createReferenceIndex();index.record(subjectKey(a),invA);index.record(subjectKey(b),invB);
 const jsA=await suppressed(f,a),sharedA=sharedReferences(invA,index,subjectKey(a),()=>false),planA=planFor(f,a,invA,{journalState:jsA,shared:sharedA});
 assert.equal(planA.state,'BLOCKED');assert.deepEqual(planA.blocks.map(x=>x.reason),['SHARED_REFERENCE']);assert.equal(planA.steps.length,invA.objects.length-1,'the shared version is excluded from the steps');
});
test('the executor is disabled by default and fails closed before any effect; enabled against the injected store it deletes exact versions, marks a step executed only after an ABSENT readback, replays idempotently, and leaves UNKNOWN on ambiguity',async()=>{
 const f=compose(),s=subjectOf(),inv=enumerateReferences(snapshot(s)),js=await suppressed(f,s),plan=planFor(f,s,inv,{journalState:js});
 for(const st of plan.steps)f.store.put(f.keyFor(st),st.versionId);
 const disabled=createPurgeExecutor({storage:f.storage,ledger:f.ledger,journal:f.journal,keyFor:f.keyFor,now:f.clock.now});assert.equal(disabled.enabled,false);
 await assert.rejects(disabled.execute(plan),/RETENTION_PURGE_DISABLED/);assert.equal(f.sink.size(),1,'no ledger entry');assert.equal((await f.journal.get(subjectKey(s))).purge,null);assert.ok(plan.steps.every(st=>f.store.has(f.keyFor(st),st.versionId)),'nothing deleted');
 const enabled=createPurgeExecutor({storage:f.storage,ledger:f.ledger,journal:f.journal,keyFor:f.keyFor,enabled:true,now:f.clock.now});
 const blocked=planFor(f,s,inv,{journalState:js,liabilities:[{runId:'r',kind:'UNKNOWN_LAUNCH'}]});await assert.rejects(enabled.execute(blocked),/RETENTION_PURGE_BLOCKED/);
 const done=await enabled.execute(plan);assert.equal(done.state,'EXECUTED');assert.equal(done.steps.length,plan.steps.length);assert.ok(done.steps.every(st=>st.state==='EXECUTED'&&st.readback.outcome==='ABSENT'));assert.ok(plan.steps.every(st=>!f.store.has(f.keyFor(st),st.versionId)));
 assert.deepEqual((await f.sink.read()).map(r=>r.state),['SUPPRESSED','PURGE_PLANNED','PURGE_EXECUTED']);
 const again=await enabled.execute(plan);assert.equal(again.replayed,true);assert.equal(f.sink.size(),3,'replay adds nothing');
 const t=subjectOf(),invT=enumerateReferences(snapshot(t)),jsT=await suppressed(f,t),planT=planFor(f,t,invT,{journalState:jsT});for(const st of planT.steps)f.store.put(f.keyFor(st),st.versionId);
 const ambiguous=compose({permissions:{getObjectVersion:true,listBucketVersions:false,deleteObjectVersion:true}});
 const execT=createPurgeExecutor({storage:ambiguous.storage,ledger:f.ledger,journal:f.journal,keyFor:f.keyFor,enabled:true,now:f.clock.now});
 const r=await execT.execute(planT);assert.equal(r.state,'UNKNOWN');assert.equal(r.steps[0].readback.reason,'NOT_FOUND_WITHOUT_LIST_PERMISSION');assert.equal(r.steps.length,1,'stops at the first ambiguous step');
 assert.equal((await f.sink.read()).at(-1).state,'PURGE_UNKNOWN');assert.equal(await f.suppression.isSuppressed(t),true,'the subject stays suppressed');
});
test('recovery: a restore predating a suppression with no purge receipt is re-suppressed from the ledger behind the serving barrier; revived versions are re-planned; a cleared block returns to PLANNED; reconciliation is idempotent',async()=>{
 const f=compose(),s=subjectOf();const holds={legalHold:false,objectLockRetainUntilMs:null};
 const reconciler=createRecoveryReconciler({ledger:f.ledger,journal:f.journal,storage:f.storage,serving:f.serving,keyFor:f.keyFor,holds:()=>holds,liabilities:async()=>[],now:f.clock.now});
 const backup=f.journal.snapshot();await f.suppression.suppress({principal:f.principal,subject:s,reason:'owner request'});assert.equal(await f.suppression.isSuppressed(s),true);
 f.journal.restore(backup);assert.equal(await f.journal.get(subjectKey(s)),null,'the restored database has forgotten the suppression');assert.equal(f.sink.size(),1,'the ledger outside the rollback boundary has not');
 f.serving.disable();await assert.rejects(f.suppression.isSuppressed(s),/RETENTION_RECOVERY_BARRIER/,'reads are refused until reconciliation completes');
 const report=await reconciler.reconcile();assert.deepEqual(report.reapplied,[subjectKey(s)]);assert.equal(report.servingEnabled,true);assert.equal(await f.suppression.isSuppressed(s),true);assert.equal((await f.journal.get(subjectKey(s))).ledgerSequence,1);
 const second=await reconciler.reconcile();assert.deepEqual(second.reapplied,[]);assert.equal(f.sink.size(),1,'idempotent: no new ledger entry');
 // Purge, then a bucket restore revives the versions: the executed receipt is re-verified and the subject is re-planned, never trusted.
 f.clock.advance(2*day);const inv=enumerateReferences(snapshot(s)),js=await f.journal.get(subjectKey(s)),plan=planFor(f,s,inv,{journalState:js});for(const st of plan.steps)f.store.put(f.keyFor(st),st.versionId);
 const exec=createPurgeExecutor({storage:f.storage,ledger:f.ledger,journal:f.journal,keyFor:f.keyFor,enabled:true,now:f.clock.now});assert.equal((await exec.execute(plan)).state,'EXECUTED');
 const afterPurge=f.journal.snapshot();assert.equal((await reconciler.reconcile()).verified.length,1,'absent versions verify as executed');
 f.store.put(f.keyFor(plan.steps[0]),plan.steps[0].versionId);const revived=await reconciler.reconcile();assert.deepEqual(revived.replanned,[subjectKey(s)]);assert.equal((await f.journal.get(subjectKey(s))).purge.state,'PLANNED');assert.equal((await f.sink.read()).at(-1).reason,'RESTORE_REVIVED_VERSION');
 f.journal.restore(afterPurge);
 // A blocked plan recorded before a restore is re-evaluated against the current holds.
 const h=subjectOf(),invH=enumerateReferences(snapshot(h));await f.suppression.suppress({principal:f.principal,subject:h,reason:'owner request'});f.clock.advance(2*day);const jsH=await f.journal.get(subjectKey(h));
 holds.legalHold=true;const blocked=planFor(f,h,invH,{journalState:jsH,holds:()=>holds});assert.equal(blocked.state,'BLOCKED');await exec.recordBlocked(blocked);assert.equal((await f.journal.get(subjectKey(h))).purge.state,'BLOCKED');
 f.journal.restore(backup);const stillHeld=await reconciler.reconcile();assert.equal((await f.journal.get(subjectKey(h))).purge.state,'BLOCKED');assert.equal(stillHeld.replanned.length,0);
 holds.legalHold=false;const cleared=await reconciler.reconcile();assert.ok(cleared.replanned.includes(subjectKey(h)));assert.equal((await f.journal.get(subjectKey(h))).purge.state,'PLANNED');assert.equal((await f.sink.read()).at(-1).reason,'RECONCILED_BLOCK_CLEARED');
 // A release recorded after a suppression is honored by reconciliation: the subject is not re-suppressed.
 const r=subjectOf();await f.suppression.suppress({principal:f.principal,subject:r,reason:'x'});await f.suppression.release({principal:f.principal,subject:r,reason:'withdrawn'});f.journal.restore(backup);await reconciler.reconcile();assert.equal(await f.suppression.isSuppressed(r),false);assert.equal((await f.journal.get(subjectKey(r))).state,'RELEASED');
});
