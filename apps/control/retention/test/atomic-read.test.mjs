/** Production startup over synthetic restorable stores. No DB, provider, network or live migration. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createRetentionStartup} from '../startup.mjs';import {subjectKey,hash} from '../boundary.mjs';import {createServingFence} from '../serving-fence.mjs';import {watermarkedJournal} from '../recovery-watermark.mjs';
import {composeStartup,subjectOf,ownership} from './fixture.mjs';
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};

for(const separateOwner of [false,true])test(`synthetic ABA: ${separateOwner?'another owner':'the reading owner'} recovering the same head cannot release a projection captured during restore`,async()=>{
 const f=composeStartup(),subject=subjectOf(),key=subjectKey(subject);let armed=false,saved,captured=false,recovered,recoveryOwner;
 async function window(read,exclusive=false){if(!armed||exclusive)return read();armed=false;f.restore(saved);const value=await read();
  captured=true;assert.equal(await f.journal.get(key),null,'the served read captured the restored-away subject');
  await recoveryOwner.recover();recovered=await f.watermark.read();return value;}
 // The old split-read owner reaches get; the fixed owner reaches readProjection. Both receive the same restore/recover schedule.
 const journal={...f.journal,get:(key,options)=>window(()=>f.journal.get(key,options),options?.exclusive)};
 const watermark={...f.watermark,readProjection:(...args)=>window(()=>f.watermark.readProjection(...args))};
 f.startup=createRetentionStartup({journal,watermark,ledgerSink:f.sink,ownership,purge:{enabled:false},now:f.clock.now});
 await f.startup.start();saved=f.backup();await f.startup.suppression.suppress({principal:f.principal,subject,reason:'owner request'});
 recoveryOwner=separateOwner?createRetentionStartup({journal:f.journal,watermark:f.watermark,ledgerSink:f.sink,ownership,purge:{enabled:false},now:f.clock.now}):f.startup;
 await recoveryOwner.recover();const head=await f.watermark.read();armed=true;
 await assert.rejects(f.startup.gate.assertServable(subject),e=>['RETENTION_RECOVERY_BARRIER','RETENTION_SUPPRESSED'].includes(e.code));
 assert.equal(captured,true);assert.deepEqual(recovered,head,'ABA returns exactly the same sequence AND entry hash');
 // A stale snapshot can close this local fence; replay must still recover the subject without another decision.
 if(!f.startup.state().enabled)await f.startup.recover();
 await assert.rejects(f.startup.gate.assertServable(subject),/RETENTION_SUPPRESSED/);assert.equal((await f.sink.read()).length,1);
});

test('synthetic atomic read: a read overlapping exclusive recovery waits and sees its settled projection and watermark',async()=>{
 const f=composeStartup(),subject=subjectOf(),key=subjectKey(subject);await f.startup.start();
 await f.startup.suppression.suppress({principal:f.principal,subject,reason:'owner request'});
 const entered=deferred(),release=deferred();let reading=false;
 const recovery=f.journal.exclusive(async()=>{entered.resolve();await release.promise;});await entered.promise;
 const read=f.watermark.readProjection(key).then(value=>{reading=true;return value;});
 try{await Promise.resolve();await Promise.resolve();assert.equal(reading,false);assert.equal(f.journal.lock.state().writer,true);assert.equal(f.journal.lock.state().waiting,1);}
 finally{release.resolve();await recovery;}
 const snapshot=await read;assert.equal(snapshot.projection.state,'SUPPRESSED');assert.equal(snapshot.watermark.sequence,1);
 assert.deepEqual(f.journal.lock.state(),{readers:0,writer:false,waiting:0});
});

test('synthetic atomic read: recovery cannot enter between the memory projection and watermark capture',async()=>{
 const f=composeStartup(),subject=subjectOf(),key=subjectKey(subject);await f.startup.start();
 const recoveryDone=deferred();let recovery,entered=false;
 const snapshot=await f.journal.readProjection(key,()=>{recovery=f.journal.exclusive(async()=>{entered=true;recoveryDone.resolve();});
  assert.equal(entered,false);assert.deepEqual(f.journal.lock.state(),{readers:1,writer:false,waiting:1});return {sequence:0,entrySha256:null};});
 await recoveryDone.promise;await recovery;assert.equal(snapshot.projection,null);assert.deepEqual(snapshot.watermark,{sequence:0,entrySha256:null});
 assert.deepEqual(f.journal.lock.state(),{readers:0,writer:false,waiting:0});
});

test('synthetic atomic read: split-read and malformed snapshot stores fail closed rather than guessing unsuppressed',async()=>{
 const f=composeStartup(),subject=subjectOf();const {readProjection,...legacy}=f.watermark;
 assert.throws(()=>createRetentionStartup({journal:f.journal,watermark:legacy,ledgerSink:f.sink,purge:{enabled:false}}),/RETENTION_CONFIGURATION/);
 for(const snapshot of [{watermark:{sequence:0,entrySha256:null}},{projection:undefined,watermark:{sequence:0,entrySha256:null}},{projection:null,watermark:null}]){
  const startup=createRetentionStartup({journal:f.journal,watermark:{...f.watermark,async readProjection(){return snapshot;}},ledgerSink:f.sink,purge:{enabled:false},now:f.clock.now});
  await startup.start();await assert.rejects(startup.gate.assertServable(subject),/RETENTION_RECOVERY_BARRIER/);assert.equal(startup.state().enabled,false);
 }
});

test('synthetic atomic read: a projection not yet covered by its watermark is refused until advance is acknowledged',async()=>{
 const f=composeStartup(),subject=subjectOf(),key=subjectKey(subject);await f.startup.start();
 // This adapter-level certificate control isolates the DB snapshot rule; startup additionally checks the external head.
 const fence=createServingFence();fence.enable({watermark:{sequence:0,entrySha256:null}});
 const tracked=watermarkedJournal({journal:f.journal,watermark:f.watermark,fence,ledger:f.ledger});
 const row={state:'SUPPRESSED',ledgerSequence:1,entrySha256:'1'.repeat(64)};await f.journal.set(key,row);
 await assert.rejects(tracked.get(key),/RETENTION_RECOVERY_BARRIER/);assert.equal(fence.isEnabled(),true);
 const entry=await f.ledger.append({subject,state:'SUPPRESSED',facts:{}}),acknowledged={...row,entrySha256:entry.entrySha256};await f.journal.set(key,acknowledged);
 await f.watermark.advanceProjection({key,projectionSha256:hash(acknowledged),sequence:1,minimumSequence:0});
 assert.equal((await tracked.get(key)).state,'SUPPRESSED');
});
