/** Retention startup composition, the restore serving fence and the recovered watermark: serving is fenced from construction and opens
 * only after reconciliation records a watermark that reads back exactly; a restore (at startup or underneath a running process) is
 * refused from its first read until the ledger is replayed; ledger, projection and watermark faults close the fence; purge stays
 * inactive behind an explicit switch and nothing deletes while it is off. Synthetic: in-process journal, watermark store, ledger
 * sink and bucket; no PostgreSQL, S3 or credential. */
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {createRetentionStartup} from '../startup.mjs';
import {createServingFence} from '../serving-fence.mjs';
import {createMemoryRetentionJournal} from '../memory-journal.mjs';
import {createMemoryLedgerSink} from '../ledger.mjs';
import {enumerateReferences} from '../inventory.mjs';
import {subjectKey} from '../boundary.mjs';
import {composeStartup,subjectOf,snapshot,planFrom,ownership} from './fixture.mjs';
const day=86400000;
const suppress=(f,s)=>f.startup.suppression.suppress({principal:f.principal,subject:s,reason:'owner request'});
const refused=(f,s)=>assert.rejects(f.startup.gate.assertServable(s),e=>e.code==='RETENTION_RECOVERY_BARRIER');

test('serving is fenced from construction: nothing is read or suppressed before startup reconciles, the plain enable is refused, and startup opens only with the read-back watermark',async()=>{
 const f=composeStartup(),s=subjectOf();
 assert.equal(f.startup.serving.isEnabled(),false);assert.equal(f.startup.state().reason,'RETENTION_STARTUP_FENCE');
 await refused(f,s);await assert.rejects(suppress(f,s),/RETENTION_RECOVERY_BARRIER/);
 assert.throws(()=>f.startup.serving.enable(),/RETENTION_WATERMARK_UNVERIFIED/,'an argument-less enable (the plain gate\'s) cannot open the fence');
 const opened=await f.startup.start();assert.deepEqual({...opened},{sequence:0,entrySha256:null});assert.equal(f.startup.serving.isEnabled(),true);
 await f.startup.gate.assertServable(s);await suppress(f,s);await assert.rejects(f.startup.gate.assertServable(s),e=>e.code==='RETENTION_SUPPRESSED');
 assert.deepEqual(await f.watermark.read(),{sequence:1,entrySha256:null},'the projection write advanced the persisted watermark');
 assert.equal(f.startup.state().highWater,1);
});

test('without a ledger sink or a watermark store the fence never opens; reads refuse with the public barrier code and the state names the missing owner',async()=>{
 for(const [options,reason] of [[{ledger:false},'RETENTION_LEDGER_UNAVAILABLE'],[{watermark:false},'RETENTION_WATERMARK_UNAVAILABLE']]){
  const f=composeStartup(options),s=subjectOf();
  await assert.rejects(f.startup.start(),e=>e.code===reason,reason);assert.equal(f.startup.serving.isEnabled(),false);assert.equal(f.startup.state().unavailable,reason);
  await refused(f,s);if(options.ledger===false)assert.equal(f.startup.suppression,null,'no suppression owner without the authoritative ledger');
 }
 assert.throws(()=>createRetentionStartup({journal:createMemoryRetentionJournal(),purge:{}}),/RETENTION_CONFIGURATION/,'the purge switch is required');
 assert.throws(()=>createRetentionStartup({journal:createMemoryRetentionJournal(),purge:{enabled:true}}),/RETENTION_CONFIGURATION/,'enabling purge without every deletion owner is refused');
});

test('suppression before serving across a restore underneath a running process: the restored projection is refused from its first read and serves only after the ledger re-applies the suppression',async()=>{
 const f=composeStartup(),a=subjectOf(),b=subjectOf(),art=subjectOf('artifact');await f.startup.start();
 await suppress(f,a);const backup=f.backup();await suppress(f,b);await suppress(f,art);
 assert.equal(f.watermark.snapshot().sequence,3);
 f.restore(backup);
 assert.equal(await f.journal.get(subjectKey(b)),null,'the restored projection has lost the later suppressions');
 // b's restored row says nothing: without the watermark check this read would serve suppressed data.
 await refused(f,b);await refused(f,art);await refused(f,a);assert.equal(f.startup.serving.isEnabled(),false);assert.equal(f.startup.state().reason,'RETENTION_WATERMARK_STALE');
 await assert.rejects(suppress(f,subjectOf()),/RETENTION_RECOVERY_BARRIER/,'no transition starts on a fenced projection');
 const recovered=await f.startup.ensureServing();assert.equal(recovered.sequence,3);
 for(const s of [a,b,art])await assert.rejects(f.startup.gate.assertServable(s),e=>e.code==='RETENTION_SUPPRESSED');
 assert.equal((await f.sink.read()).length,3,'recovery re-applied from the ledger without writing new decisions');
});

test('a restart over a restored backup is fenced until startup replays the ledger; a stale watermark that cannot be re-recorded keeps refusing to serve',async()=>{
 const f=composeStartup(),s=subjectOf();await f.startup.start();const empty=f.backup();await suppress(f,s);f.restore(empty);
 const restart=()=>createRetentionStartup({journal:f.journal,watermark:f.watermark,ledgerSink:f.sink,ownership,purge:{enabled:false},now:f.clock.now});
 const next=restart();await assert.rejects(next.gate.assertServable(s),e=>e.code==='RETENTION_RECOVERY_BARRIER');
 f.watermark.faults.record=true;await assert.rejects(next.start(),/RETENTION_STORE_UNAVAILABLE/);assert.equal(next.serving.isEnabled(),false,'a watermark that cannot be recorded never opens serving');
 await assert.rejects(next.gate.assertServable(s),e=>e.code==='RETENTION_RECOVERY_BARRIER');
 f.watermark.faults.record=false;const lying={...f.watermark,record:f.watermark.record,advance:f.watermark.advance,read:async()=>({sequence:0,entrySha256:null})};
 const misread=createRetentionStartup({journal:f.journal,watermark:lying,ledgerSink:f.sink,ownership,purge:{enabled:false},now:f.clock.now});
 await assert.rejects(misread.start(),/RETENTION_WATERMARK_UNVERIFIED/,'a recorded watermark that does not read back exactly is not a recovered watermark');assert.equal(misread.serving.isEnabled(),false);
 await next.start();await assert.rejects(next.gate.assertServable(s),e=>e.code==='RETENTION_SUPPRESSED');
 f.watermark.faults.read=true;await assert.rejects(next.gate.assertServable(s),e=>e.code==='RETENTION_RECOVERY_BARRIER','an unreadable watermark refuses');assert.equal(next.state().reason,'RETENTION_WATERMARK_UNVERIFIED');
 f.watermark.faults.read=false;await next.ensureServing();assert.equal(next.serving.isEnabled(),true);
});

test('transactional faults close the fence: a lost ledger acknowledgement, a failed projection after an acknowledged entry and an unknown watermark advance each refuse serving until reconciliation proves the suppression',async()=>{
 // Lost acknowledgement: the entry is durable, the owner never learned it, the projection was never written.
 const f=composeStartup(),s=subjectOf();await f.startup.start();
 f.faults.lostAck=true;await assert.rejects(suppress(f,s),/RETENTION_LEDGER_UNACKNOWLEDGED/);f.faults.lostAck=false;assert.equal(f.sink.size(),1,'the entry is durable');
 assert.equal(f.startup.state().reason,'RETENTION_LEDGER_UNKNOWN');await refused(f,s);
 await f.startup.ensureServing();await assert.rejects(f.startup.gate.assertServable(s),e=>e.code==='RETENTION_SUPPRESSED','the durable decision is applied before serving resumes');
 // Projection failure after an acknowledged entry.
 const g=composeStartup(),t=subjectOf();await g.startup.start();g.faults.failSets=1;
 await assert.rejects(suppress(g,t),/RETENTION_PROJECTION_FAILED/);assert.equal(await g.journal.get(subjectKey(t)),null,'the projection was not written');await refused(g,t);
 await g.startup.ensureServing();await assert.rejects(g.startup.gate.assertServable(t),e=>e.code==='RETENTION_SUPPRESSED');
 // An advance whose outcome is unknown: the projection stands but serving waits for a recovered watermark.
 const h=composeStartup(),u=subjectOf();await h.startup.start();h.watermark.faults.advance=true;
 const row=await suppress(h,u);assert.equal(row.state,'SUPPRESSED');assert.equal(h.startup.state().reason,'RETENTION_WATERMARK_UNKNOWN');await refused(h,u);
 // Recovery proves the position by recording the exact ledger head; the next transition whose advance is still unknown closes it again.
 await h.startup.ensureServing();await assert.rejects(h.startup.gate.assertServable(u),e=>e.code==='RETENTION_SUPPRESSED');assert.deepEqual(await h.watermark.read(),{sequence:1,entrySha256:(await h.sink.read())[0].entrySha256});
 await suppress(h,subjectOf());assert.equal(h.startup.serving.isEnabled(),false);assert.equal(h.startup.state().reason,'RETENTION_WATERMARK_UNKNOWN');
 h.watermark.faults.advance=false;await h.startup.ensureServing();assert.equal(h.startup.serving.isEnabled(),true);
});

test('purge-disabled proof: with the switch off no deletion path exists; execution, block recording, startup and recovery over recorded purge entries delete nothing; the same plan deletes once the switch and every owner are given',async()=>{
 const f=composeStartup({purge:false}),s=subjectOf();await f.startup.start();
 const inv=enumerateReferences(snapshot(s));f.current.inventories.set(subjectKey(s),inv);f.rows.seed(subjectKey(s),inv);for(const o of inv.objects)f.store.put(f.keyFor(o),o.versionId);
 await suppress(f,s);f.clock.advance(30*day);const plan=planFrom(f,s,await f.startup.journal.get(subjectKey(s)));assert.equal(plan.state,'PLANNED');
 assert.equal(f.startup.purge.enabled,false);assert.equal(f.startup.state().purgeEnabled,false);
 await assert.rejects(f.startup.purge.execute(plan),/RETENTION_PURGE_DISABLED/);await assert.rejects(f.startup.purge.recordBlocked(plan),/RETENTION_PURGE_DISABLED/);
 // Purge entries already in the ledger (written by some earlier owner) are re-verified, never executed: with no storage owner every step stays UNKNOWN.
 const steps=plan.steps.map(st=>({workflowId:st.workflowId,classes:st.classes,objectId:st.objectId,versionId:st.versionId,sha256:st.sha256,artifactVersionIds:st.artifactVersionIds,state:'UNKNOWN'}));
 await f.ledger.append({subject:s,state:'PURGE_UNKNOWN',reason:'EFFECTS_STARTED',facts:{planSha256:plan.planSha256,suppression:plan.suppression,policySha256:plan.policySha256,inventorySha256:plan.inventorySha256,steps,rowSteps:plan.rowSteps.map(r=>({workflowId:r.workflowId,className:r.className,target:r.target,state:'UNKNOWN'}))}});
 f.startup.serving.disable('TEST_RESTART');const report=await f.startup.recover();assert.deepEqual(report.unknown,[subjectKey(s)]);
 assert.equal((await f.startup.journal.get(subjectKey(s))).purge.state,'UNKNOWN','an unverifiable step is never read as done');
 assert.equal(f.deletes.length,0,'no storage delete was requested');assert.equal(f.rowPurges.length,0,'no database row was purged');for(const o of inv.objects)assert.ok(f.store.has(f.keyFor(o),o.versionId));
 // Contrast: the identical flow with the switch on and every owner bound deletes, so the switch is what prevented it.
 const on=composeStartup({purge:true}),t=subjectOf();await on.startup.start();const invT=enumerateReferences(snapshot(t));on.current.inventories.set(subjectKey(t),invT);on.rows.seed(subjectKey(t),invT);for(const o of invT.objects)on.store.put(on.keyFor(o),o.versionId);
 await suppress(on,t);on.clock.advance(30*day);const planT=planFrom(on,t,await on.startup.journal.get(subjectKey(t)));const done=await on.startup.purge.execute(planT);
 assert.equal(done.state,'EXECUTED');assert.equal(on.deletes.length,invT.objects.length);assert.equal(on.rowPurges.length,1);
});

test('the fence keeps its first closing reason, refuses a stale opening proof, and reports a persisted watermark behind this process as stale',async()=>{
 const fence=createServingFence();assert.equal(fence.state().reason,'RETENTION_STARTUP_FENCE');fence.disable('LATER');assert.equal(fence.state().reason,'RETENTION_STARTUP_FENCE');
 fence.enable({watermark:{sequence:4,entrySha256:'a'.repeat(64)}});fence.observe(6);assert.throws(()=>fence.enable({watermark:{sequence:5,entrySha256:null}}),/RETENTION_WATERMARK_STALE/);
 await assert.rejects(fence.verify(async()=>({sequence:5,entrySha256:null})),/RETENTION_WATERMARK_STALE/);assert.equal(fence.isEnabled(),false);
 fence.enable({watermark:{sequence:6,entrySha256:null}});assert.equal((await fence.verify(async()=>({sequence:7,entrySha256:null}))).sequence,7,'a persisted watermark ahead of this process (another writer) is not stale');
 fence.disable('FIRST');fence.disable('SECOND');assert.equal(fence.state().reason,'FIRST');
 const sink=createMemoryLedgerSink();assert.equal(sink.size(),0);assert.ok(randomUUID());
});
