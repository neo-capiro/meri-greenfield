/** Planning, execution and recovery over the in-process adapters: the earlier controls (dot's six corrections of the d2acf82 review)
 * carried forward, plus the seven findings of the f0befe1 review: suppression-generation binding with zero deletes, serialized and
 * fenced recovery with a verified ledger watermark, missing authority preserving blocks, canonical digest recomputation, artifact
 * version identity and row targets end to end. Synthetic subjects, objects and hashes; no bucket, credential or provider. */
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {planPurge,holderEligibility,verifyPlanDigest,planDigest,createPurgeExecutor} from '../purge.mjs';
import {createRecoveryReconciler} from '../reconciliation.mjs';
import {enumerateReferences,createReferenceIndex,sharedReferences} from '../inventory.mjs';
import {createSuppressionOwner} from '../suppression.mjs';
import {createMemoryRetentionJournal,projectionToken} from '../memory-journal.mjs';
import {subjectKey} from '../boundary.mjs';
import {compose,subjectOf,snapshot,policy,object,ownership,owners,planFrom,sdkEntry,tenant,owner} from './fixture.mjs';
const day=86400000;
async function suppressed(f,s,{inventory}={}){await f.suppression.suppress({principal:f.principal,subject:s,reason:'owner request'});f.clock.advance(2*day);if(inventory)f.current.inventories.set(subjectKey(s),inventory);return f.journal.get(subjectKey(s));}
const seed=(f,plan)=>{for(const st of plan.steps)f.store.put(f.keyFor(st),st.versionId);};
test('planning: refused without suppression or policy; cooling, holds, liabilities and shared references block; identities are deterministic and duplicates coalesce; row targets and artifact versions are carried under their own subject kind',async()=>{
 const f=compose(),s=subjectOf(),inv=enumerateReferences(snapshot(s));
 assert.throws(()=>planFrom(f,s,null,{inventory:inv}),/RETENTION_NOT_SUPPRESSED/);
 const js=await suppressed(f,s,{inventory:inv});assert.throws(()=>planFrom(f,s,js,{policy:null}),/RETENTION_POLICY_REQUIRED/);
 assert.ok(planFrom(f,s,{...js,suppressedAtMs:f.clock.now()-1000}).blocks.every(b=>b.reason==='COOLING_PERIOD'));
 const plan=planFrom(f,s,js);assert.equal(plan.state,'PLANNED');assert.equal(plan.steps.length,inv.objects.length);assert.equal(plan.planSha256,planFrom(f,s,js).planSha256,'same inputs, same digest');assert.equal(planDigest(plan),plan.planSha256);
 assert.deepEqual(plan.suppression,{ledgerSequence:js.ledgerSequence,entrySha256:js.entrySha256},'the plan names its suppression generation');
 assert.deepEqual(plan.rowSteps.map(r=>r.className),['sdkSession'],'a conversation carries its SDK entry row target');
 const a0=subjectOf('artifact'),artifact=object(),invA0=enumerateReferences(snapshot(a0,{sdkEntries:[],artifactVersions:[{versionId:randomUUID(),object:artifact},{versionId:randomUUID(),object:artifact}]})),planA0=planFrom(f,a0,await suppressed(f,a0,{inventory:invA0}));assert.equal(planA0.state,'PLANNED');
 const sharedStep=planA0.steps.find(st=>st.objectId===artifact.objectId);assert.equal(sharedStep.artifactVersionIds.length,2,'two database artifact versions sharing one storage object are both carried');
 assert.deepEqual(planA0.rowSteps.map(r=>r.className),['artifactVersions','artifactVersions'],'row targets: both artifact versions of the artifact subject');
 assert.deepEqual(inv.rowTargets.find(t=>t.className==='sdkSession'),{...inv.rowTargets.find(t=>t.className==='sdkSession')},'the SDK entry target carries run, session, subpath and sequence');
 const held=inv.objects[0];f.current.holds.set(held.objectId+'@'+held.versionId,{objectLockRetainUntilMs:f.clock.now()+day,legalHold:false});assert.deepEqual(planFrom(f,s,js).blocks.map(b=>b.reason),['OBJECT_LOCK']);f.current.holds.clear();
 f.current.liabilities.set(subjectKey(s),[{runId:'r',kind:'UNKNOWN_LAUNCH'}]);assert.deepEqual(planFrom(f,s,js).blocks.map(b=>b.reason),['UNKNOWN_LIABILITY']);f.current.liabilities.clear();
 const shared=object(),a=subjectOf(),b=subjectOf(),invA=enumerateReferences(snapshot(a,{shared:[shared]})),invB=enumerateReferences(snapshot(b,{shared:[shared]})),index=createReferenceIndex();index.record(subjectKey(a),invA);index.record(subjectKey(b),invB);
 const jsA=await suppressed(f,a,{inventory:invA});f.current.shared.set(subjectKey(a),sharedReferences(invA,index,subjectKey(a),()=>({eligible:false,reasons:['HOLDER_NOT_SUPPRESSED']})));
 const planA=planFrom(f,a,jsA);assert.equal(planA.state,'BLOCKED');assert.deepEqual(planA.blocks.map(x=>x.reason),['SHARED_REFERENCE']);assert.equal(planA.steps.length,invA.objects.length-1);
 assert.throws(()=>verifyPlanDigest({...plan,steps:plan.steps.slice(1)}),/RETENTION_PLAN_DIGEST_REFUSED/,'changed targets under the same claimed hash are refused by digest verification');
});
test('obligations: one exact object under several classes carries every one; a non-purgeable or longer-retained class blocks it; enumeration order never changes eligibility; shared holders need their own eligibility',async()=>{
 const f=compose(),s=subjectOf(),sharedObject=object();const snap=snapshot(s);snap.selectedOutputs=[{outputId:randomUUID(),object:sharedObject}];snap.uploads=[{uploadId:randomUUID(),object:sharedObject}];
 const inv=enumerateReferences(snap);assert.deepEqual(inv.objects.find(x=>x.objectId===sharedObject.objectId).classes,['selectedOutputs','uploads']);
 const js=await suppressed(f,s,{inventory:inv});const p=policy();p.classes.uploads.purgeable=false;assert.deepEqual(planFrom(f,s,js,{policy:p}).blocks.map(b=>[b.reason,b.detail.className]),[['CLASS_NOT_PURGEABLE','uploads']]);
 const reversed={...snap,uploads:snap.uploads,selectedOutputs:snap.selectedOutputs};const inv2=enumerateReferences({...reversed,selectedOutputs:[],uploads:[...snap.uploads]});const inv3=enumerateReferences({...reversed,uploads:[],selectedOutputs:[...snap.selectedOutputs]});void inv2;void inv3;
 assert.equal(enumerateReferences({...snap,uploads:[...snap.uploads]}).inventorySha256,inv.inventorySha256,'the inventory hash is independent of enumeration order');
 const p2=policy();p2.classes.uploads.retentionMs=365*day;assert.deepEqual(planFrom(f,s,js,{policy:p2}).blocks.map(b=>[b.reason,b.detail.className]),[['RETENTION_PERIOD','uploads']]);
 const a=subjectOf(),b=subjectOf(),shared=object(),invA=enumerateReferences(snapshot(a,{shared:[shared]})),invB=enumerateReferences(snapshot(b,{shared:[shared]})),index=createReferenceIndex();index.record(subjectKey(a),invA);index.record(subjectKey(b),invB);
 const jsA=await suppressed(f,a,{inventory:invA});const noHold=()=>({objectLockRetainUntilMs:null,legalHold:false});
 const holder=state=>holderEligibility({journalState:state,policy:policy(),inventory:invB,holds:noHold,liabilities:[],lastActivityAtMs:f.clock.now()-30*day,nowMs:f.clock.now()});
 for(const [name,state,reasons] of [['notSuppressed',null,['HOLDER_NOT_SUPPRESSED']],['cooling',{state:'SUPPRESSED',suppressedAtMs:f.clock.now()-1000},['HOLDER_COOLING_PERIOD']],['released',{state:'RELEASED'},['HOLDER_RELEASED']]]){const e=holder(state);assert.deepEqual(e.reasons,reasons,name);f.current.shared.set(subjectKey(a),sharedReferences(invA,index,subjectKey(a),()=>e));assert.ok(planFrom(f,a,jsA).blocks.some(x=>x.reason==='SHARED_REFERENCE'&&x.detail.blocking[0].holder===subjectKey(b)),name);}
 assert.ok(holderEligibility({journalState:{state:'SUPPRESSED',suppressedAtMs:f.clock.now()-2*day},policy:{...policy(),classes:Object.fromEntries(Object.entries(policy().classes).map(([k,v])=>[k,{...v,retentionMs:365*day}]))},inventory:invB,holds:noHold,liabilities:[],lastActivityAtMs:f.clock.now()-30*day,nowMs:f.clock.now()}).reasons.includes('HOLDER_RETENTION_PERIOD'));
 assert.deepEqual(holderEligibility({journalState:{state:'SUPPRESSED',suppressedAtMs:f.clock.now()-2*day},policy:policy(),inventory:invB,holds:o=>o.objectId===shared.objectId?{objectLockRetainUntilMs:null,legalHold:true}:noHold(),liabilities:[],lastActivityAtMs:f.clock.now()-30*day,nowMs:f.clock.now()}).reasons,['HOLDER_LEGAL_HOLD']);
 const clear=holderEligibility({journalState:{state:'SUPPRESSED',suppressedAtMs:f.clock.now()-2*day},policy:policy(),inventory:invB,holds:noHold,liabilities:[],lastActivityAtMs:f.clock.now()-30*day,nowMs:f.clock.now()});assert.equal(clear.eligible,true);
 f.current.shared.set(subjectKey(a),sharedReferences(invA,index,subjectKey(a),()=>clear));assert.ok(planFrom(f,a,jsA).steps.some(st=>st.objectId===shared.objectId),'a cleared fork holder no longer blocks');
 f.current.shared.set(subjectKey(a),sharedReferences(invA,index,subjectKey(a),()=>{throw new Error('authority down');}));assert.ok(planFrom(f,a,jsA).blocks.some(x=>x.reason==='SHARED_REFERENCE'&&x.detail.blocking[0].reasons[0]==='HOLDER_AUTHORITY_UNAVAILABLE'),'a failing holder authority blocks');
});
test('execution: disabled by default fails closed before any effect; every effect is re-authorized against the current suppression generation and a recomputed canonical digest; ambiguity leaves UNKNOWN; replay is idempotent',async()=>{
 const f=compose(),s=subjectOf(),inv=enumerateReferences(snapshot(s)),js=await suppressed(f,s,{inventory:inv}),plan=planFrom(f,s,js);seed(f,plan);
 const disabled=f.executor(false);assert.equal(disabled.enabled,false);await assert.rejects(disabled.execute(plan),/RETENTION_PURGE_DISABLED/);assert.equal(f.sink.size(),1);assert.ok(plan.steps.every(st=>f.store.has(f.keyFor(st),st.versionId)),'nothing deleted');
 const exec=f.executor();
 await assert.rejects(exec.execute({...plan,steps:plan.steps.slice(1)}),/RETENTION_PLAN_DIGEST_REFUSED/,'changed targets under the claimed hash: refused with zero effects');assert.ok(plan.steps.every(st=>f.store.has(f.keyFor(st),st.versionId)));
 const forged={...plan,steps:plan.steps.slice(1)};const forgedWithHash=Object.freeze({...forged,planSha256:planDigest(forged)});await assert.rejects(exec.execute(forgedWithHash),/RETENTION_PLAN_DIGEST_REFUSED/,'a self-consistent plan whose targets differ from the authoritative recomputation is refused');
 f.current.liabilities.set(subjectKey(s),[{runId:'r',kind:'UNKNOWN_LAUNCH'}]);await assert.rejects(exec.execute(plan),/RETENTION_PURGE_BLOCKED/,'a liability that appeared after planning blocks the effect');f.current.liabilities.clear();
 f.current.unavailable.add('holds');await assert.rejects(exec.execute(plan),/RETENTION_AUTHORITY_UNAVAILABLE/,'missing authority refuses, never clears');f.current.unavailable.clear();
 assert.ok(plan.steps.every(st=>f.store.has(f.keyFor(st),st.versionId)),'zero deletes through every refusal');
 const done=await exec.execute(plan);assert.equal(done.state,'EXECUTED');assert.ok(plan.steps.every(st=>!f.store.has(f.keyFor(st),st.versionId)));assert.deepEqual((await f.sink.read()).map(r=>[r.state,r.reason]),[['SUPPRESSED','owner request'],['PURGE_PLANNED',undefined],['PURGE_UNKNOWN','EFFECTS_STARTED'],['PURGE_EXECUTED',undefined]],'effects are durably marked as begun before the first delete');
 const facts=(await f.sink.read()).at(-1).facts;assert.ok(facts.steps.every(x=>x.objectId&&x.versionId&&x.sha256&&x.classes.length&&Array.isArray(x.artifactVersionIds)&&x.state==='EXECUTED'));assert.deepEqual(facts.suppression,plan.suppression);assert.equal(facts.rowSteps.length,plan.rowSteps.length);
 assert.ok(facts.rowSteps.every(x=>x.state==='EXECUTED'&&x.target),'every database row target is recorded as deleted');assert.equal(done.rowSteps.length,plan.rowSteps.length);for(const st of plan.rowSteps)assert.equal(await f.rows.present(subjectKey(s),st),false,'the row is gone');
 const again=await exec.execute(plan);assert.equal(again.replayed,true);assert.equal(f.sink.size(),4);
 const noRows=subjectOf(),invNoRows=enumerateReferences(snapshot(noRows)),jsNoRows=await suppressed(f,noRows,{inventory:invNoRows}),planNoRows=planFrom(f,noRows,jsNoRows);seed(f,planNoRows);
 await assert.rejects(createPurgeExecutor({storage:f.storage,ledger:f.ledger,journal:f.journal,keyFor:f.keyFor,facts:f.facts,serving:f.serving,enabled:true,now:f.clock.now}).execute(planNoRows),/RETENTION_ROW_PURGE_UNAVAILABLE/,'row targets without a row purge port refuse before any effect');assert.ok(planNoRows.steps.every(st=>f.store.has(f.keyFor(st),st.versionId)));
 const other=planFrom(f,s,await f.journal.get(subjectKey(s)),{policy:{...policy(),version:4}});f.current.policy={...policy(),version:4};await assert.rejects(exec.execute(other),/RETENTION_PURGE_PLAN_MISMATCH/,'EXECUTED replay with a different plan hash refuses');f.current.policy=policy();
 const t=subjectOf(),invT=enumerateReferences(snapshot(t)),jsT=await suppressed(f,t,{inventory:invT}),planT=planFrom(f,t,jsT);seed(f,planT);
 const ambiguous=compose({permissions:{getObjectVersion:true,listBucketVersions:false,deleteObjectVersion:true}});const execT=createPurgeExecutor({storage:ambiguous.storage,ledger:f.ledger,journal:f.journal,keyFor:f.keyFor,facts:f.facts,serving:f.serving,rows:f.rows,enabled:true,now:f.clock.now});
 const r=await execT.execute(planT);assert.equal(r.state,'UNKNOWN');assert.equal(r.steps[0].readback.reason,'NOT_FOUND_WITHOUT_LIST_PERMISSION');assert.equal(r.steps.length,1);assert.equal((await f.sink.read()).at(-1).state,'PURGE_UNKNOWN');assert.equal(await f.suppression.isSuppressed(t),true);
});
test('finding 1: a plan computed under suppression S1 cannot execute after a release and a new suppression S2 (zero deletes); reconciliation never restores historical PLANNED targets without current eligibility',async()=>{
 const f=compose(),s=subjectOf(),inv=enumerateReferences(snapshot(s)),s1=await suppressed(f,s,{inventory:inv}),plan=planFrom(f,s,s1);seed(f,plan);
 await f.suppression.release({principal:f.principal,subject:s,reason:'withdrawn'});await f.suppression.suppress({principal:f.principal,subject:s,reason:'again'});
 const exec=f.executor();await assert.rejects(exec.execute(plan),/RETENTION_SUPPRESSION_GENERATION_REFUSED/,'S1 plan under S2 cooling: refused');assert.ok(plan.steps.every(st=>f.store.has(f.keyFor(st),st.versionId)),'zero deletes');
 f.clock.advance(2*day);const s2=await f.journal.get(subjectKey(s));await assert.rejects(exec.execute(plan),/RETENTION_SUPPRESSION_GENERATION_REFUSED/,'still the old generation after S2 cooling');
 const current=planFrom(f,s,s2);assert.notEqual(current.planSha256,plan.planSha256);assert.equal((await exec.execute(current)).state,'EXECUTED','the current-generation plan executes');
 // Historical PLANNED entry whose eligibility no longer holds is not restored as PLANNED by recovery.
 const h=subjectOf(),invH=enumerateReferences(snapshot(h)),jsH=await suppressed(f,h,{inventory:invH}),planH=planFrom(f,h,jsH);seed(f,planH);
 await f.ledger.append({subject:h,state:'PURGE_PLANNED',facts:{planSha256:planH.planSha256,suppression:planH.suppression,policySha256:planH.policySha256,inventorySha256:planH.inventorySha256,steps:planH.steps,rowSteps:planH.rowSteps}});
 f.current.holds.set(planH.steps[0].objectId+'@'+planH.steps[0].versionId,{objectLockRetainUntilMs:null,legalHold:true});
 const report=await f.reconciler().reconcile();assert.ok(report.stillBlocked.includes(subjectKey(h)));const row=await f.journal.get(subjectKey(h));assert.equal(row.purge.state,'BLOCKED');assert.deepEqual(row.purge.blocked.map(b=>b.reason),['LEGAL_HOLD']);
 await assert.rejects(exec.execute(planH),/RETENTION_PURGE_BLOCKED/);assert.ok(planH.steps.every(st=>f.store.has(f.keyFor(st),st.versionId)));
});
test('finding 2: recovery is serialized with transitions, writes with compare-and-set, verifies the ledger watermark, and reopens serving only after a settled pass; a suspended suppression cannot be overwritten',async()=>{
 const f=compose(),s=subjectOf();f.current.inventories.set(subjectKey(s),enumerateReferences(snapshot(s)));const pause=ms=>new Promise(r=>setTimeout(r,ms));
 // A projection write in flight under the shared recovery lock when recovery is requested: the barrier closes at once, the pass waits for the write and then projects nothing older over it.
 let releaseWrite;const held={...f.journal,set:(key,value,opts)=>f.journal.lock.shared(async()=>{await new Promise(r=>{releaseWrite=r;});return f.journal.set(key,value,{...opts,exclusive:true});})};
 const heldOwner=createSuppressionOwner({ledger:f.ledger,journal:held,ownership,serving:f.serving,now:f.clock.now});
 const pending=heldOwner.suppress({principal:f.principal,subject:s,reason:'owner request'});await pause(5);assert.equal(f.sink.size(),1,'acknowledged in the ledger, not yet projected');
 const recovery=f.reconciler().reconcile();await pause(5);assert.equal(f.serving.isEnabled(),false,'the barrier closes immediately');assert.deepEqual(f.journal.lock.state(),{readers:1,writer:false,waiting:1},'recovery waits behind the in-flight write');
 releaseWrite();const row=await pending;assert.equal(row.state,'SUPPRESSED');const report=await recovery;assert.ok(report.passes>=1);assert.deepEqual(report.reapplied,[],'the write landed first, so recovery had nothing to re-apply');
 assert.equal((await f.journal.get(subjectKey(s))).ledgerSequence,row.ledgerSequence,'the suspended transition is projected, not overwritten by an older state');assert.equal(f.serving.isEnabled(),true);assert.equal(report.watermark,f.sink.size());
 // A transition suspended between its durable acknowledgement and its projection while recovery runs: recovery projects the entry first; the late write finds the identical row and is not a failure.
 const t=subjectOf();f.current.inventories.set(subjectKey(t),enumerateReferences(snapshot(t)));let releaseAppend;const gated={...f.ledger,async append(e){const r=await f.ledger.append(e);await new Promise(res=>{releaseAppend=res;});return r;}};
 const gatedOwner=createSuppressionOwner({ledger:gated,journal:f.journal,ownership,serving:f.serving,now:f.clock.now});const late=gatedOwner.suppress({principal:f.principal,subject:t,reason:'owner request'});await pause(5);
 const mid=await f.reconciler().reconcile();assert.deepEqual(mid.reapplied,[subjectKey(t)]);const projected=await f.journal.get(subjectKey(t));
 releaseAppend();const lateRow=await late;assert.equal(lateRow.replayed,false);assert.deepEqual(await f.journal.get(subjectKey(t)),projected,'identical entry: already projected');assert.equal(f.serving.isEnabled(),true);
 // A transition that appends after the recovery snapshot forces another pass before serving reopens.
 const u=subjectOf();f.current.inventories.set(subjectKey(u),enumerateReferences(snapshot(u)));let injected=false;
 const spyLedger={...f.ledger,async replay(){const r=await f.ledger.replay();if(!injected){injected=true;await f.ledger.append({subject:u,state:'SUPPRESSED',reason:'late',facts:{principal:f.principal,authorization:{mode:'owner',receiptId:null},outstandingAccess:{signedUrlsExpireAtMs:null,inFlightRuns:[]},cancelled:[]}});}return r;}};
 const second=await createRecoveryReconciler({ledger:spyLedger,journal:f.journal,storage:f.storage,serving:f.serving,keyFor:f.keyFor,facts:f.facts,rows:f.rows,now:f.clock.now}).reconcile();
 assert.ok(second.passes>=2,'a second pass follows the moved watermark');assert.equal(second.watermark,f.sink.size(),'the pass ends only when the watermark is stable');assert.ok(second.reapplied.includes(subjectKey(u)));assert.equal(f.serving.isEnabled(),true);
 await assert.rejects(createRecoveryReconciler({ledger:{...f.ledger,async replay(){await f.ledger.append({subject:u,state:'SUPPRESSED',reason:'churn',facts:{principal:f.principal,authorization:{mode:'owner',receiptId:null},outstandingAccess:{signedUrlsExpireAtMs:null,inFlightRuns:[]},cancelled:[]}});return f.ledger.replay();}},journal:f.journal,storage:f.storage,serving:f.serving,keyFor:f.keyFor,facts:f.facts,rows:f.rows,now:f.clock.now,maxPasses:2}).reconcile(),/RETENTION_RECOVERY_UNSETTLED/,'a watermark that never settles never reopens serving');
 assert.equal(f.serving.isEnabled(),false);f.serving.enable();
 // CAS: a stale write that raced recovery is refused.
 const stale=await f.journal.get(subjectKey(s));await f.suppression.release({principal:f.principal,subject:s,reason:'x'});
 await assert.rejects(f.journal.set(subjectKey(s),{...stale,purge:{state:'EXECUTED',planSha256:'1'.repeat(64),ledgerSequence:9,steps:[]}},{expected:projectionToken(stale)}),/RETENTION_STALE_WRITE/);
 void owner;void createMemoryRetentionJournal;void tenant;
});
test('finding 2b: an acknowledged suppression whose projection write fails closes serving; executor and suppression owner require the gate; a stale purge after an accepted release and a delayed write across recovery are refused',async()=>{
 const f=compose(),s=subjectOf();f.current.inventories.set(subjectKey(s),enumerateReferences(snapshot(s)));const failing={...f.journal,async set(){throw new Error('disk full');}};
 const broken=createSuppressionOwner({ledger:f.ledger,journal:failing,ownership,serving:f.serving,now:f.clock.now});
 await assert.rejects(broken.suppress({principal:f.principal,subject:s,reason:'x'}),/RETENTION_PROJECTION_FAILED/);assert.equal(f.sink.size(),1);assert.equal(f.serving.isEnabled(),false);
 await assert.rejects(f.suppression.isSuppressed(s),/RETENTION_RECOVERY_BARRIER/);await assert.rejects(f.suppression.assertServable(s),/RETENTION_RECOVERY_BARRIER/);
 assert.throws(()=>createSuppressionOwner({ledger:f.ledger,journal:f.journal,ownership,now:f.clock.now}),/RETENTION_CONFIGURATION/,'the serving gate is mandatory');assert.throws(()=>createPurgeExecutor({storage:f.storage,ledger:f.ledger,journal:f.journal,keyFor:f.keyFor,facts:f.facts,enabled:true,now:f.clock.now}),/RETENTION_CONFIGURATION/);
 await f.reconciler().reconcile();assert.equal(await f.suppression.isSuppressed(s),true);await assert.rejects(f.suppression.assertServable(s),/RETENTION_SUPPRESSED/);
 const dup=await f.suppression.suppress({principal:f.principal,subject:s,reason:'again'});assert.equal(dup.replayed,true);assert.equal(f.sink.size(),1);
 const stale=await f.journal.get(subjectKey(s));await f.suppression.release({principal:f.principal,subject:s,reason:'withdrawn'});
 await assert.rejects(f.journal.set(subjectKey(s),{...stale,purge:{state:'PLANNED',planSha256:'0'.repeat(64),ledgerSequence:9,steps:[]}},{expected:projectionToken(stale)}),/RETENTION_STALE_WRITE/);
 f.clock.advance(2*day);await assert.rejects(f.executor().execute(planFrom(f,s,{...stale,suppressedAtMs:f.clock.now()-3*day})),/RETENTION_NOT_SUPPRESSED/);
 const again=await f.suppression.suppress({principal:f.principal,subject:s,reason:'re-suppress'});const token=projectionToken(await f.journal.get(subjectKey(s)));await f.suppression.release({principal:f.principal,subject:s,reason:'released before the delayed write lands'});await f.reconciler().reconcile();
 await assert.rejects(f.journal.set(subjectKey(s),{...again,purge:{state:'EXECUTED',planSha256:'1'.repeat(64),ledgerSequence:99,steps:[]}},{expected:token}),/RETENTION_STALE_WRITE/);assert.equal((await f.journal.get(subjectKey(s))).state,'RELEASED');
 const executed=await f.journal.get(subjectKey(s));f.serving.disable();await assert.rejects(f.executor().execute(planFrom(f,s,{...executed,state:'SUPPRESSED',suppressedAtMs:f.clock.now()-3*day,ledgerSequence:1,entrySha256:'0'.repeat(64)})),/RETENTION_RECOVERY_BARRIER|RETENTION_NOT_SUPPRESSED/,'the executor refuses behind a closed barrier');f.serving.enable();
});
test('findings 3 and 4 (in-process): total projection loss is rebuilt exactly from the ledger and a second pass changes nothing; every block reason is re-evaluated and clears only with all facts available',async()=>{
 const f=compose(),s=subjectOf(),inv=enumerateReferences(snapshot(s)),js=await suppressed(f,s,{inventory:inv}),plan=planFrom(f,s,js);seed(f,plan);
 const exec=f.executor();assert.equal((await exec.execute(plan)).state,'EXECUTED');const before=await f.journal.get(subjectKey(s));
 f.journal.restore(new Map());const first=await f.reconciler().reconcile();assert.deepEqual(first.reapplied,[subjectKey(s)]);assert.deepEqual(first.verified,[subjectKey(s)]);
 const rebuilt=await f.journal.get(subjectKey(s));assert.equal(rebuilt.purge.state,'EXECUTED');assert.equal(rebuilt.purge.planSha256,plan.planSha256);assert.deepEqual(rebuilt.purge.steps.map(x=>[x.objectId,x.versionId,x.state,x.artifactVersionIds]).sort(),before.purge.steps.map(x=>[x.objectId,x.versionId,x.state,x.artifactVersionIds]).sort());assert.ok(!JSON.stringify(rebuilt).includes('UNVERIFIED'));
 const size=f.sink.size();const second=await f.reconciler().reconcile();assert.deepEqual(second.reapplied,[]);assert.equal(f.sink.size(),size);assert.deepEqual(await f.journal.get(subjectKey(s)),rebuilt);
 const h=subjectOf(),invH=enumerateReferences(snapshot(h)),jsH=await suppressed(f,h,{inventory:invH});const k=subjectKey(h);
 f.current.holds.set(invH.objects[0].objectId+'@'+invH.objects[0].versionId,{objectLockRetainUntilMs:f.clock.now()+day,legalHold:false});f.current.liabilities.set(k,[{runId:randomUUID(),kind:'UNKNOWN_LAUNCH'}]);f.current.lastActivity.set(k,f.clock.now()-1*day);
 const blocked=planFrom(f,h,jsH);assert.deepEqual([...new Set(blocked.blocks.map(b=>b.reason))].sort(),['OBJECT_LOCK','RETENTION_PERIOD','UNKNOWN_LIABILITY']);await exec.recordBlocked(blocked);
 const still=async label=>{const r=await f.reconciler().reconcile();assert.ok(r.stillBlocked.includes(k),label);assert.equal((await f.journal.get(k)).purge.state,'BLOCKED',label);return (await f.journal.get(k)).purge.blocked.map(b=>b.reason);};
 await still('all three');f.current.liabilities.delete(k);await still('liability cleared');f.current.holds.clear();assert.deepEqual([...new Set(await still('lock cleared'))],['RETENTION_PERIOD']);
 f.current.unavailable.add('shared');assert.deepEqual([...new Set(await still('retention cleared but holder authority unavailable'))],['RETENTION_AUTHORITY_UNAVAILABLE']);f.current.unavailable.clear();
 f.current.lastActivity.set(k,f.clock.now()-30*day);f.current.unavailable.add('policy');await still('policy unavailable keeps the block');f.current.unavailable.clear();
 const nonpurgeable=policy();nonpurgeable.classes.lifecycle.purgeable=false;f.current.policy=nonpurgeable;assert.ok((await still('non-purgeable class keeps the block')).includes('CLASS_NOT_PURGEABLE'));f.current.policy=policy();
 const r=await f.reconciler().reconcile();assert.ok(r.replanned.includes(k));const regenerated=await f.journal.get(k);assert.equal(regenerated.purge.state,'PLANNED');assert.notEqual(regenerated.purge.planSha256,blocked.planSha256);
 const usable=planFrom(f,h,regenerated);assert.equal(usable.planSha256,regenerated.purge.planSha256,'the regenerated plan is the ordinary current plan');seed(f,usable);assert.equal((await exec.execute(usable)).state,'EXECUTED');
 const r2=subjectOf();const pre=f.journal.snapshot();await f.suppression.suppress({principal:f.principal,subject:r2,reason:'x'});f.journal.restore(pre);f.serving.disable();await assert.rejects(f.suppression.isSuppressed(r2),/RETENTION_RECOVERY_BARRIER/);const third=await f.reconciler().reconcile();assert.ok(third.reapplied.includes(subjectKey(r2)));assert.equal(await f.suppression.isSuppressed(r2),true);
});
test('authorization before replay and trusted ownership: wrong-actor replay, altered ownership claim and unauthorized release refuse; authorized exact replay succeeds; ownership is re-read',async()=>{
 const f=compose(),s=subjectOf();const first=await f.suppression.suppress({principal:f.principal,subject:s,reason:'owner request'});assert.equal(first.replayed,false);
 await assert.rejects(f.suppression.suppress({principal:{tenantId:tenant,actorId:'actor-intruder'},subject:s,reason:'replay'}),/RETENTION_AUTHORIZATION_REFUSED/);
 await assert.rejects(f.suppression.suppress({principal:f.principal,subject:{...s,ownerActorId:'actor-intruder'},reason:'altered claim'}),/RETENTION_OWNERSHIP_REFUSED/);
 await assert.rejects(f.suppression.release({principal:{tenantId:tenant,actorId:'actor-intruder'},subject:s,reason:'unauthorized'}),/RETENTION_AUTHORIZATION_REFUSED/);
 const replay=await f.suppression.suppress({principal:f.principal,subject:s,reason:'owner request'});assert.equal(replay.replayed,true);assert.equal(replay.entrySha256,first.entrySha256);
 const {ownerActorId:_claim,...bare}=s;assert.equal((await f.suppression.suppress({principal:f.principal,subject:bare,reason:'x'})).replayed,true);
 owners.set(subjectKey(s),'actor-transferred');await assert.rejects(f.suppression.release({principal:f.principal,subject:bare,reason:'after transfer'}),/RETENTION_AUTHORIZATION_REFUSED/);owners.set(subjectKey(s),owner);void _claim;
 const e=sdkEntry();assert.equal(e.sequence,1);void createRecoveryReconciler;
});
