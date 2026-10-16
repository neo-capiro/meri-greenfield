/** Synthetic existing journal/ledger/watermark only. No SQL engine, S3, provider, renderer or new recovery coordinator. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createRetentionStartup} from '../startup.mjs';import {createRecoveryReconciler} from '../reconciliation.mjs';
import {subjectKey} from '../boundary.mjs';import {composeStartup,subjectOf,ownership} from './fixture.mjs';
const startup=(f,recoverPrerequisitesExclusive,watermark=f.watermark)=>createRetentionStartup({journal:f.journal,watermark,ledgerSink:f.sink,ownership,purge:{enabled:false},now:f.clock.now,recoverPrerequisitesExclusive});
const append=(f,s)=>f.ledger.append({subject:s,state:'SUPPRESSED',reason:'synthetic concurrent decision',facts:{principal:f.principal,authorization:{mode:'owner',receiptId:null},outstandingAccess:{signedUrlsExpireAtMs:null,inFlightRuns:[]},cancelled:[]}});

test('recovery continuation: canonical retention replay precedes one continuation under the SAME exclusion and before watermark/fence',async()=>{
 const f=composeStartup(),s=subjectOf();await f.startup.start();const saved=f.backup();await f.startup.suppression.suppress({principal:f.principal,subject:s,reason:'synthetic'});f.restore(saved);
 const events=[],watermark={...f.watermark,async record(...args){events.push('watermark');return f.watermark.record(...args);}};let owner;
 owner=startup(f,async()=>{events.push('continuation');assert.equal(f.journal.lock.state().writer,true);assert.equal(owner.serving.isEnabled(),false);assert.equal((await f.journal.get(subjectKey(s))).state,'SUPPRESSED');assert.deepEqual(events,['continuation']);await assert.rejects(owner.gate.assertServable(s),/RECOVERY_BARRIER/);},watermark);
 await owner.start();assert.deepEqual(events,['continuation','watermark']);assert.equal(owner.serving.isEnabled(),true);assert.equal(f.journal.lock.state().writer,false);await assert.rejects(owner.gate.assertServable(s),/SUPPRESSED/);assert.equal(f.deletes.length,0);assert.equal(f.rowPurges.length,0);
});

test('recovery continuation: UNKNOWN rejection never records the watermark or opens the fence',async()=>{
 const f=composeStartup(),s=subjectOf();let calls=0,records=0;const watermark={...f.watermark,async record(...args){records++;return f.watermark.record(...args);}};
 const owner=startup(f,async()=>{calls++;throw Object.assign(Error('ARTIFACT_PUBLICATION_ACK_UNKNOWN'),{code:'ARTIFACT_PUBLICATION_ACK_UNKNOWN'});},watermark);
 await assert.rejects(owner.start(),/ARTIFACT_PUBLICATION_ACK_UNKNOWN/);assert.equal(calls,1);assert.equal(records,0);assert.equal(owner.serving.isEnabled(),false);assert.equal(f.journal.lock.state().writer,false);await assert.rejects(owner.gate.assertServable(s),/RECOVERY_BARRIER/);
});

test('recovery continuation: a pending continuation cannot admit serving or release the existing exclusion',async()=>{
 const f=composeStartup(),ready=Promise.withResolvers(),release=Promise.withResolvers(),owner=startup(f,async()=>{ready.resolve();await release.promise;});let pending;
 try{pending=owner.start();await ready.promise;assert.equal(owner.serving.isEnabled(),false);assert.equal(f.journal.lock.state().writer,true);assert.equal(f.journal.lock.state().waiting,0);assert.equal((await f.watermark.read()).sequence,0);}finally{release.resolve();}
 await pending;assert.equal(owner.serving.isEnabled(),true);assert.equal(f.journal.lock.state().writer,false);
});

test('recovery continuation: an unseen decision during the continuation repeats the EXISTING pass before enabling',async()=>{
 const f=composeStartup(),s=subjectOf();let calls=0,records=0,owner;const watermark={...f.watermark,async record(...args){records++;return f.watermark.record(...args);}};
 owner=startup(f,async()=>{calls++;assert.equal(owner.serving.isEnabled(),false);if(calls===1)await append(f,s);else assert.equal((await f.journal.get(subjectKey(s))).state,'SUPPRESSED');},watermark);
 await owner.start();assert.equal(calls,2);assert.equal(records,1);assert.equal((await f.watermark.read()).sequence,1);await assert.rejects(owner.gate.assertServable(s),/SUPPRESSED/);
});

test('recovery continuation: an unseen decision during watermark ACK is checked before the fence opens',async()=>{
 const f=composeStartup(),s=subjectOf();let calls=0,records=0,owner;const watermark={...f.watermark,async record(...args){records++;await f.watermark.record(...args);if(records===1)await append(f,s);}};
 owner=startup(f,async()=>{calls++;assert.equal(owner.serving.isEnabled(),false);},watermark);await owner.start();assert.equal(calls,2);assert.equal(records,2);assert.equal((await f.watermark.read()).sequence,1);await assert.rejects(owner.gate.assertServable(s),/SUPPRESSED/);
});

test('recovery continuation: continuously moving history exhausts the original bounded pass limit and stays closed',async()=>{
 const f=composeStartup(),s=subjectOf();let calls=0;const owner=createRecoveryReconciler({ledger:f.ledger,journal:f.journal,serving:f.startup.serving,watermark:f.watermark,now:f.clock.now,maxPasses:2,recoverPrerequisitesExclusive:async()=>{calls++;await append(f,s);}});
 await assert.rejects(owner.reconcile(),/RECOVERY_UNSETTLED/);assert.equal(calls,2);assert.equal(f.startup.serving.isEnabled(),false);assert.equal(f.journal.lock.state().writer,false);assert.equal((await f.watermark.read()).sequence,0);
});

test('recovery continuation: null is inert and invalid constructor values refuse before any callback or I/O',async()=>{
 const f=composeStartup(),owner=startup(f,null);assert.equal(owner.serving.isEnabled(),false);await owner.start();assert.equal(owner.serving.isEnabled(),true);
 assert.throws(()=>startup(f,{}),/RETENTION_CONFIGURATION/);assert.throws(()=>createRecoveryReconciler({ledger:f.ledger,journal:f.journal,serving:f.startup.serving,watermark:f.watermark,now:f.clock.now,recoverPrerequisitesExclusive:42}),/RETENTION_CONFIGURATION/);
});
