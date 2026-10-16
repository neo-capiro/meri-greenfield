/** Two independent startup owners share synthetic restorable stores and an authoritative non-restored ledger. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createRetentionStartup} from '../startup.mjs';import {composeStartup,subjectOf,ownership} from './fixture.mjs';
import {createRetentionLedger,createMemoryLedgerSink} from '../ledger.mjs';
async function restoredPair(){const f=composeStartup(),subject=subjectOf();await f.startup.start();
 const reader=createRetentionStartup({journal:f.journal,watermark:f.watermark,ledgerSink:f.sink,ownership,purge:{enabled:false},now:f.clock.now});await reader.start();
 const saved=f.backup();await f.startup.suppression.suppress({principal:f.principal,subject,reason:'other owner suppression'});
 assert.equal(reader.state().highWater,0,'reader never observed the other owner at one');f.restore(saved);
 assert.equal((await f.watermark.read()).sequence,0);assert.equal((await f.sink.read()).length,1);return {f,reader,subject};}

test('synthetic current head: an owner that never observed the suppression cannot serve its restored-away subject',async()=>{
 const {f,reader,subject}=await restoredPair();await assert.rejects(reader.gate.assertServable(subject),/RETENTION_RECOVERY_BARRIER/);
 assert.equal(reader.state().enabled,false);await reader.recover();await assert.rejects(reader.gate.assertServable(subject),/RETENTION_SUPPRESSED/);
 assert.equal((await f.sink.read()).length,1);
});

test('synthetic current head: readiness replays an unseen acknowledged decision before it opens serving',async()=>{
 const {f,reader,subject}=await restoredPair();const position=await reader.ensureServing();assert.equal(position.sequence,1);
 await assert.rejects(reader.gate.assertServable(subject),/RETENTION_SUPPRESSED/);assert.equal((await f.sink.read()).length,1);
});

test('synthetic current head: an unseen restore cannot append another decision before recovery',async()=>{
 const {f,reader}=await restoredPair();await assert.rejects(reader.suppression.suppress({principal:f.principal,subject:subjectOf(),reason:'new owner request'}),/RETENTION_WATERMARK_STALE|RETENTION_RECOVERY_BARRIER/);
 assert.equal((await f.sink.read()).length,1,'the unprojected durable head is not concealed by a new decision');
});

test('synthetic current head: each served observation reads the durable owner and unavailable or corrupt heads refuse',async()=>{
 for(const failure of ['unavailable','corrupt']){const f=composeStartup(),subject=subjectOf();let failRead=false,reads=0;
  const sink={append:(...args)=>f.sink.append(...args),async read(){reads++;if(failRead&&failure==='unavailable')throw Error('synthetic unavailable head');const rows=await f.sink.read();return failRead?rows.map(row=>({...row,facts:{tampered:true}})):rows;}};
  const startup=createRetentionStartup({journal:f.journal,watermark:f.watermark,ledgerSink:sink,ownership,purge:{enabled:false},now:f.clock.now});await startup.start();
  await startup.suppression.suppress({principal:f.principal,subject,reason:'retained suppression'});reads=0;
  for(let i=0;i<2;i++){await assert.rejects(startup.gate.assertServable(subject),/RETENTION_SUPPRESSED/);assert.equal(reads,i+1,'no process-local head cache');}
  failRead=true;await assert.rejects(startup.gate.assertServable(subject),/RETENTION_RECOVERY_BARRIER/);assert.equal(startup.state().reason,'RETENTION_LEDGER_UNVERIFIED');
 }
});

test('synthetic current head: the verified head is bounded and a late sink result never releases the caller',async()=>{
 const sink=createMemoryLedgerSink();let resolve;const pending=new Promise(r=>{resolve=r;});
 const ledger=createRetentionLedger({sink:{append:sink.append,read:()=>pending},now:Date.now,maxHeadMs:20});
 await assert.rejects(ledger.head(),/RETENTION_LEDGER_UNVERIFIED/);resolve([]);
 const current=createRetentionLedger({sink,now:Date.now});assert.deepEqual(await current.head(),{sequence:0,entrySha256:null});
 const row=await current.append({subject:subjectOf(),state:'SUPPRESSED',facts:{}});assert.deepEqual(await current.head(),{sequence:row.sequence,entrySha256:row.entrySha256});
});

test('synthetic current head: a recovered hash mismatch or database position ahead of the ledger is not proof',async()=>{
 for(const kind of ['hash','ahead']){const f=composeStartup(),subject=subjectOf();await f.startup.start();
  await f.startup.suppression.suppress({principal:f.principal,subject,reason:'retained suppression'});await f.startup.recover();
  await f.watermark.record({sequence:kind==='ahead'?2:1,entrySha256:kind==='ahead'?null:'f'.repeat(64)});
  await assert.rejects(f.startup.gate.assertServable(subject),/RETENTION_RECOVERY_BARRIER/);assert.equal(f.startup.state().reason,'RETENTION_WATERMARK_UNVERIFIED');
 }
});
