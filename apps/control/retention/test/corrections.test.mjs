/** Dot's six corrections (review of d2acf82): obligations preserved per exact object and holder eligibility; complete recovery facts
 * and mismatched replay; every historical block re-evaluated into a usable plan; HTTP ambiguity over exception names; fail-closed
 * acknowledged suppression with serialized transitions; authorization before replay with trusted ownership. */
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {planPurge,createPurgeExecutor,holderEligibility} from '../purge.mjs';
import {createRecoveryReconciler,createServingGate} from '../reconciliation.mjs';
import {enumerateReferences,createReferenceIndex,sharedReferences} from '../inventory.mjs';
import {createSuppressionOwner} from '../suppression.mjs';
import {createRetentionLedger,createMemoryLedgerSink} from '../ledger.mjs';
import {createMemoryRetentionJournal,projectionToken} from '../memory-journal.mjs';
import {subjectKey,hash} from '../boundary.mjs';
import {compose,subjectOf,snapshot,policy,object,ownership,owners,tenant,owner} from './fixture.mjs';
const day=86400000,noHold=()=>({objectLockRetainUntilMs:null,legalHold:false});
async function suppressed(f,s){await f.suppression.suppress({principal:f.principal,subject:s,reason:'owner request'});f.clock.advance(2*day);return f.journal.get(subjectKey(s));}
const planFor=(f,s,inv,x={})=>planPurge({subject:s,journalState:x.journalState,policy:x.policy===undefined?policy():x.policy,inventory:inv,shared:x.shared??[],holds:x.holds??noHold,liabilities:x.liabilities??[],lastActivityAtMs:x.lastActivityAtMs??f.clock.now()-30*day,nowMs:f.clock.now()});
test('1. one exact object referenced by several classes carries every obligation; a non-purgeable class blocks it; enumeration order never changes eligibility',async()=>{
 const f=compose(),s=subjectOf(),sharedObject=object();
 const snap=snapshot(s);snap.selectedOutputs=[{outputId:randomUUID(),object:sharedObject}];snap.uploads=[{uploadId:randomUUID(),object:sharedObject}];
 const inv=enumerateReferences(snap),o=inv.objects.find(x=>x.objectId===sharedObject.objectId);assert.deepEqual(o.classes,['selectedOutputs','uploads']);
 const js=await suppressed(f,s);const p=policy();p.classes.uploads.purgeable=false;const plan=planFor(f,s,inv,{journalState:js,policy:p});
 assert.equal(plan.state,'BLOCKED');assert.deepEqual(plan.blocks.map(b=>[b.reason,b.detail.className]),[['CLASS_NOT_PURGEABLE','uploads']],'the uploads obligation on the shared object blocks even though selectedOutputs is purgeable');
 const reversed=structuredClone(snap);reversed.selectedOutputs=[];reversed.uploads=[{uploadId:randomUUID(),object:sharedObject}];reversed.selectedOutputs=[{outputId:randomUUID(),object:sharedObject}];
 const inv2=enumerateReferences({...reversed,uploads:reversed.uploads,selectedOutputs:reversed.selectedOutputs});assert.equal(inv2.inventorySha256,inv.inventorySha256,'the inventory hash is independent of enumeration order');
 const p2=policy();p2.classes.uploads.retentionMs=365*day;const both=planFor(f,s,inv,{journalState:js,policy:p2});assert.deepEqual(both.blocks.map(b=>[b.reason,b.detail.className]),[['RETENTION_PERIOD','uploads']],'each class is checked under its own retention');
 assert.equal(planFor(f,s,inv,{journalState:js}).state,'PLANNED');
});
test('1b. a shared holder must itself be purge-eligible under its own obligations: suppressed but cooling, retained, held or released holders keep the version',async()=>{
 const f=compose(),a=subjectOf(),b=subjectOf(),shared=object(),invA=enumerateReferences(snapshot(a,{shared:[shared]})),invB=enumerateReferences(snapshot(b,{shared:[shared]})),index=createReferenceIndex();index.record(subjectKey(a),invA);index.record(subjectKey(b),invB);
 const jsA=await suppressed(f,a);
 const holder=state=>holderEligibility({journalState:state,policy:policy(),inventory:invB,holds:noHold,liabilities:[],lastActivityAtMs:f.clock.now()-30*day,nowMs:f.clock.now()});
 const cases={notSuppressed:[null,['HOLDER_NOT_SUPPRESSED']],cooling:[{state:'SUPPRESSED',suppressedAtMs:f.clock.now()-1000},['HOLDER_COOLING_PERIOD']],retained:[{state:'SUPPRESSED',suppressedAtMs:f.clock.now()-2*day},null],released:[{state:'RELEASED'},['HOLDER_RELEASED']]};
 for(const [name,[state,reasons]] of Object.entries(cases)){const e=name==='retained'?holderEligibility({journalState:state,policy:{...policy(),classes:Object.fromEntries(Object.entries(policy().classes).map(([k,v])=>[k,{...v,retentionMs:365*day}]))},inventory:invB,holds:noHold,liabilities:[],lastActivityAtMs:f.clock.now()-30*day,nowMs:f.clock.now()}):holder(state);
  assert.equal(e.eligible,false,name);if(reasons)assert.deepEqual(e.reasons,reasons,name);else assert.ok(e.reasons.includes('HOLDER_RETENTION_PERIOD'),name);
  const sharedA=sharedReferences(invA,index,subjectKey(a),()=>e);const plan=planFor(f,a,invA,{journalState:jsA,shared:sharedA});assert.equal(plan.state,'BLOCKED',name);assert.ok(plan.blocks.some(x=>x.reason==='SHARED_REFERENCE'&&x.detail.blocking[0].holder===subjectKey(b)),name);}
 const held=holderEligibility({journalState:{state:'SUPPRESSED',suppressedAtMs:f.clock.now()-2*day},policy:policy(),inventory:invB,holds:o=>o.objectId===shared.objectId?{objectLockRetainUntilMs:null,legalHold:true}:noHold(),liabilities:[],lastActivityAtMs:f.clock.now()-30*day,nowMs:f.clock.now()});assert.deepEqual(held.reasons,['HOLDER_LEGAL_HOLD']);
 const clear=holderEligibility({journalState:{state:'SUPPRESSED',suppressedAtMs:f.clock.now()-2*day},policy:policy(),inventory:invB,holds:noHold,liabilities:[],lastActivityAtMs:f.clock.now()-30*day,nowMs:f.clock.now()});assert.equal(clear.eligible,true);
 const plan=planFor(f,a,invA,{journalState:jsA,shared:sharedReferences(invA,index,subjectKey(a),()=>clear)});assert.equal(plan.state,'PLANNED');assert.ok(plan.steps.some(st=>st.objectId===shared.objectId),'the fork cleared its own obligations: the shared version is in the plan');
});
test('2. recovery facts live in the ledger: total projection loss is rebuilt exactly, a second reconciliation changes nothing, EXECUTED replay with another plan refuses, and a backup predating suppression with no purge receipt is re-suppressed',async()=>{
 const f=compose(),s=subjectOf(),inventories=new Map();const holds={legalHold:false,objectLockRetainUntilMs:null};
 const reconciler=createRecoveryReconciler({ledger:f.ledger,journal:f.journal,storage:f.storage,serving:f.serving,keyFor:f.keyFor,holds:()=>holds,liabilities:async()=>[],policy:async()=>policy(),inventoryFor:async sub=>inventories.get(subjectKey(sub)),lastActivityFor:async()=>f.clock.now()-30*day,now:f.clock.now});
 const backup=f.journal.snapshot();const js=await suppressed(f,s),inv=enumerateReferences(snapshot(s));inventories.set(subjectKey(s),inv);const plan=planFor(f,s,inv,{journalState:js});for(const st of plan.steps)f.store.put(f.keyFor(st),st.versionId);
 const exec=createPurgeExecutor({storage:f.storage,ledger:f.ledger,journal:f.journal,keyFor:f.keyFor,enabled:true,now:f.clock.now});const done=await exec.execute(plan);assert.equal(done.state,'EXECUTED');
 const facts=(await f.sink.read()).at(-1).facts;assert.equal(facts.steps.length,plan.steps.length);assert.ok(facts.steps.every(x=>x.objectId&&x.versionId&&x.sha256&&x.classes.length&&x.state==='EXECUTED'),'the ledger carries every exact target');
 const before=await f.journal.get(subjectKey(s));f.journal.restore(new Map());assert.equal(await f.journal.get(subjectKey(s)),null,'total projection loss');
 const first=await reconciler.reconcile();assert.deepEqual(first.reapplied,[subjectKey(s)]);assert.deepEqual(first.verified,[subjectKey(s)]);
 const rebuilt=await f.journal.get(subjectKey(s));assert.equal(rebuilt.purge.state,'EXECUTED');assert.equal(rebuilt.purge.planSha256,plan.planSha256);assert.deepEqual(rebuilt.purge.steps.map(x=>[x.objectId,x.versionId,x.state]).sort(),before.purge.steps.map(x=>[x.objectId,x.versionId,x.state]).sort(),'exact object, version and plan preserved');assert.ok(!JSON.stringify(rebuilt).includes('UNVERIFIED'));
 const size=f.sink.size();const second=await reconciler.reconcile();assert.deepEqual(second.reapplied,[]);assert.equal(f.sink.size(),size);assert.deepEqual(await f.journal.get(subjectKey(s)),rebuilt,'second reconciliation is a no-op');
 const other=planFor(f,s,inv,{journalState:rebuilt,policy:{...policy(),version:4}});await assert.rejects(exec.execute(other),/RETENTION_PURGE_PLAN_MISMATCH/,'EXECUTED replay with a different plan hash refuses');
 const r=subjectOf();const pre=f.journal.snapshot();await f.suppression.suppress({principal:f.principal,subject:r,reason:'x'});f.journal.restore(pre);f.serving.disable();await assert.rejects(f.suppression.isSuppressed(r),/RETENTION_RECOVERY_BARRIER/);
 const third=await reconciler.reconcile();assert.ok(third.reapplied.includes(subjectKey(r)));assert.equal(await f.suppression.isSuppressed(r),true);
});
test('3. every historical block reason is re-evaluated against current facts; a cleared block yields the ordinary current plan; combined reasons stay blocked until all clear',async()=>{
 const f=compose(),s=subjectOf(),inv=enumerateReferences(snapshot(s)),inventories=new Map([[subjectKey(s),inv]]);const state={holds:{legalHold:true,objectLockRetainUntilMs:null},liabilities:[{runId:randomUUID(),kind:'UNKNOWN_LAUNCH'}],lastActivityAtMs:0,policy:policy(),shared:[]};
 const reconciler=createRecoveryReconciler({ledger:f.ledger,journal:f.journal,storage:f.storage,serving:f.serving,keyFor:f.keyFor,holds:()=>state.holds,liabilities:async()=>state.liabilities,policy:async()=>state.policy,inventoryFor:async()=>inv,sharedFor:async()=>state.shared,lastActivityFor:async()=>state.lastActivityAtMs,now:f.clock.now});
 const js=await suppressed(f,s);state.lastActivityAtMs=f.clock.now()-1*day;
 const exec=createPurgeExecutor({storage:f.storage,ledger:f.ledger,journal:f.journal,keyFor:f.keyFor,enabled:true,now:f.clock.now});
 const blocked=planPurge({subject:s,journalState:js,policy:state.policy,inventory:inv,shared:state.shared,holds:()=>state.holds,liabilities:state.liabilities,lastActivityAtMs:state.lastActivityAtMs,nowMs:f.clock.now()});
 assert.deepEqual([...new Set(blocked.blocks.map(b=>b.reason))].sort(),['LEGAL_HOLD','RETENTION_PERIOD','UNKNOWN_LIABILITY']);await exec.recordBlocked(blocked);
 const expectStill=async label=>{const r=await reconciler.reconcile();assert.ok(r.stillBlocked.includes(subjectKey(s)),label);assert.equal((await f.journal.get(subjectKey(s))).purge.state,'BLOCKED',label);};
 await expectStill('all three');state.liabilities=[];await expectStill('liability cleared, hold and retention remain');state.holds={legalHold:false,objectLockRetainUntilMs:null};await expectStill('hold cleared, retention remains');
 const current=await f.journal.get(subjectKey(s));assert.deepEqual([...new Set(current.purge.blocked.map(b=>b.reason))],['RETENTION_PERIOD'],'the recorded block reflects current facts');
 state.lastActivityAtMs=f.clock.now()-30*day;const r=await reconciler.reconcile();assert.ok(r.replanned.includes(subjectKey(s)));
 const regenerated=await f.journal.get(subjectKey(s));assert.equal(regenerated.purge.state,'PLANNED');assert.notEqual(regenerated.purge.planSha256,blocked.planSha256,'not the blocked plan hash');
 const usable=planPurge({subject:s,journalState:regenerated,policy:state.policy,inventory:inv,shared:[],holds:()=>state.holds,liabilities:[],lastActivityAtMs:state.lastActivityAtMs,nowMs:f.clock.now()});assert.equal(usable.planSha256,regenerated.purge.planSha256,'the regenerated plan passes ordinary planning');
 for(const st of usable.steps)f.store.put(f.keyFor(st),st.versionId);assert.equal((await exec.execute(usable)).state,'EXECUTED','the regenerated plan executes under current authority');
});
test('5. an acknowledged suppression whose projection write fails closes serving; duplicate suppression is idempotent; a stale purge cannot overwrite an accepted release; delayed writes across reconciliation are refused',async()=>{
 const f=compose(),s=subjectOf();const failing={...f.journal,async set(){throw new Error('disk full');}};
 const broken=createSuppressionOwner({ledger:f.ledger,journal:failing,ownership,serving:f.serving,now:f.clock.now});
 await assert.rejects(broken.suppress({principal:f.principal,subject:s,reason:'x'}),/RETENTION_PROJECTION_FAILED/);assert.equal(f.sink.size(),1,'the ledger holds the acknowledged transition');assert.equal(f.serving.isEnabled(),false,'serving closed: the old projection cannot be served');
 await assert.rejects(f.suppression.isSuppressed(s),/RETENTION_RECOVERY_BARRIER/);
 const reconciler=createRecoveryReconciler({ledger:f.ledger,journal:f.journal,storage:f.storage,serving:f.serving,keyFor:f.keyFor,holds:()=>({legalHold:false,objectLockRetainUntilMs:null}),liabilities:async()=>[],now:f.clock.now});await reconciler.reconcile();assert.equal(await f.suppression.isSuppressed(s),true,'reconciliation projects the acknowledged suppression and reopens serving');
 const dup=await f.suppression.suppress({principal:f.principal,subject:s,reason:'again'});assert.equal(dup.replayed,true);assert.equal(f.sink.size(),1);
 const stale=await f.journal.get(subjectKey(s));await f.suppression.release({principal:f.principal,subject:s,reason:'withdrawn'});
 await assert.rejects(f.journal.set(subjectKey(s),{...stale,purge:{state:'PLANNED',planSha256:'0'.repeat(64),ledgerSequence:9,steps:[]}},{expected:projectionToken(stale)}),/RETENTION_STALE_WRITE/,'a purge decided on the pre-release projection cannot land');
 const exec=createPurgeExecutor({storage:f.storage,ledger:f.ledger,journal:f.journal,keyFor:f.keyFor,enabled:true,now:f.clock.now});f.clock.advance(2*day);const inv=enumerateReferences(snapshot(s));
 await assert.rejects(exec.execute(planFor(f,s,inv,{journalState:{...stale,suppressedAtMs:f.clock.now()-3*day}})),/RETENTION_NOT_SUPPRESSED/,'execution over a stale suppressed view is refused by the current projection');
 const again=await f.suppression.suppress({principal:f.principal,subject:s,reason:'re-suppress'});const token=projectionToken(await f.journal.get(subjectKey(s)));
 await f.suppression.release({principal:f.principal,subject:s,reason:'released before the delayed write lands'});await reconciler.reconcile();
 await assert.rejects(f.journal.set(subjectKey(s),{...again,purge:{state:'EXECUTED',planSha256:'1'.repeat(64),ledgerSequence:99,steps:[]}},{expected:token}),/RETENTION_STALE_WRITE/,'a delayed purge write carrying the pre-release token cannot restore eligibility');
 assert.equal((await f.journal.get(subjectKey(s))).state,'RELEASED');
 assert.equal(tenant,'tenant-a');void owner;
});
test('6. authorization runs before replay and ownership comes from the application: wrong-actor replay, altered ownership claim and unauthorized release refuse; authorized exact replay succeeds',async()=>{
 const f=compose(),s=subjectOf();const first=await f.suppression.suppress({principal:f.principal,subject:s,reason:'owner request'});assert.equal(first.replayed,false);
 await assert.rejects(f.suppression.suppress({principal:{tenantId:tenant,actorId:'actor-intruder'},subject:s,reason:'replay by another actor'}),/RETENTION_AUTHORIZATION_REFUSED/,'no receipt is returned before authorization');
 await assert.rejects(f.suppression.suppress({principal:f.principal,subject:{...s,ownerActorId:'actor-intruder'},reason:'altered claim'}),/RETENTION_OWNERSHIP_REFUSED/);
 await assert.rejects(f.suppression.release({principal:{tenantId:tenant,actorId:'actor-intruder'},subject:s,reason:'unauthorized release'}),/RETENTION_AUTHORIZATION_REFUSED/);
 const replay=await f.suppression.suppress({principal:f.principal,subject:s,reason:'owner request'});assert.equal(replay.replayed,true);assert.equal(replay.entrySha256,first.entrySha256);
 const {ownerActorId:_claim,...bare}=s;const bareReplay=await f.suppression.suppress({principal:f.principal,subject:bare,reason:'owner request'});assert.equal(bareReplay.replayed,true,'the caller need not claim ownership at all');
 owners.set(subjectKey(s),'actor-transferred');await assert.rejects(f.suppression.release({principal:f.principal,subject:bare,reason:'after transfer'}),/RETENTION_AUTHORIZATION_REFUSED/,'ownership is read from the application each time');owners.set(subjectKey(s),owner);void _claim;void hash;void createRetentionLedger;void createMemoryLedgerSink;void createMemoryRetentionJournal;void createServingGate;
});
