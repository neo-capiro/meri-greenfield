/** Bounded provisioning and the bounded storage disposition (findings F1/F2/F8 follow-up).
 *
 * Covers: the per-scan when-stale refresh on the existing composition owner — freshness conditions only, exactly one
 * attempt, shared serialization, this child's own absolute deadline; the reader-pin proof the bounded disposition
 * requires before it may remove anything; and the source check that every pinned archive in the upload image layer is
 * bound to an exact lock record and cannot resolve against a live index.
 *
 * Fixture bytes and injected ports only. No real freshclam/sigtool/clamscan run, no image build, no namespace
 * admission, no corpus, no Docker and no network is exercised here, and nothing in this file is qualification
 * evidence for any of those.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {mkdtemp,rm,mkdir,writeFile,readFile,realpath,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {UPLOAD_DEFINITIONS_SCHEMA,definitionsSnapshotId,createSignedDefinitionStore,pruneSnapshots} from '../native-definitions.mjs';
import {createUploadNativeInspection} from '../native-inspection.mjs';

const T0=Date.parse('2026-10-28T00:00:00Z'),OPEN=T0+30000;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const fault=code=>Object.assign(new Error(code),{code});
const okRun=async()=>({stdout:Buffer.alloc(0)});
/** The seven already-approved upload pins; their exact official archive hashes must survive any closure work. */
const APPROVED=['5bac4b03f75d4c2548d29d135dff14e8be63493298f28dd4dae144b61f67e7ce',
 'c6613152d9ebb613148d4672c40f2d55abe84404ec07ae8f1195f0129312483e',
 '5360d1b790d8b2835321cb4b3231c66bf7bc36cac76cb920b84d015624b65cd2',
 '284483a771e9a8828b17bdf67eb7e7c9a6dd3d9f129f358dd7ea0e10eabe5050',
 '2db390ba3ff19c010e11cd75af6d36285264cd25fe24f5f5e7ecdb603eaae02e',
 'dacdd5b4174dd5a2621e784f1dea9ad61bfb034ad1682e7f326417baf2163cdd',
 'a22f29a723c0705f014bc2cb07848c94427728967d51147cc01ece5058557c81'];

async function withRoot(body){
 const root=await mkdtemp(join(await realpath(tmpdir()),'meri-provisioning-'));
 try{return await body(root);}finally{await rm(root,{recursive:true,force:true});}
}
/** Publish one signed-looking snapshot into `root` and point `current` at it. Fixture bytes, not a real ClamAV CV. */
async function publish(root,{publishedAtMs,seed}){
 const set={main:Buffer.from(`main-${seed}`),daily:Buffer.from(`daily-${seed}`)};
 const files=Object.entries(set).map(([stem,data])=>({name:`${stem}.cvd`,bytes:data.length,sha256:sha(data),format:'cvd'}));
 const id=definitionsSnapshotId(files),directory=join(root,'snapshots',id);
 await mkdir(join(directory,'database'),{recursive:true});
 for(const [stem,data] of Object.entries(set))await writeFile(join(directory,'database',`${stem}.cvd`),data);
 await writeFile(join(directory,'snapshot.json'),JSON.stringify({schema:UPLOAD_DEFINITIONS_SCHEMA,sha256:id,
  publishedAt:new Date(publishedAtMs).toISOString(),publishedAtMs,signatureVerified:true,
  version:files.map(file=>file.name).join(','),files}));
 await writeFile(join(root,'current'),id);
 return id;
}

test('the bounded disposition removes a snapshot only on a proven released reader, never because time passed',async()=>{
 await withRoot(async root=>{
  const store=createSignedDefinitionStore({root,now:()=>T0,run:okRun});
  const ids=[];
  for(let index=0;index<6;index+=1){
   ids.push(await publish(root,{publishedAtMs:T0-60*60*1000+index,seed:String(index)}));
   // Only the four newest are ever resolved, and each of those readers reports a completed child. The two oldest are
   // published and immediately superseded, so this owner never issued a reader for them.
   if(index>=2){const bound=await store.snapshot({deadlineMs:OPEN});assert.equal(bound.sha256,ids[index]);bound.reader.release({completed:true});}
  }
  // No proof of reader state at all: a day later, with the root over its declared bound, nothing is removed and the
  // unreclaimable storage is REPORTED instead. This is the regression guard: elapsed time alone proves nothing.
  const blind=await pruneSnapshots({root,now:()=>T0+24*60*60*1000,retain:1,maxSnapshots:2});
  assert.deepEqual(blind.removed,[]);
  assert.equal(blind.readerProofSupplied,false);
  assert.equal(blind.retained.filter(entry=>entry.reason==='READER_STATE_UNKNOWN').length,5);
  assert.equal(blind.storage.overBound,true);
  assert.equal(blind.storage.remaining,6);
  // With the resolve owner's live accounting only PROVEN-idle snapshots go, oldest first; the retained floor keeps the
  // newer ones and a snapshot this owner never proved idle is retained rather than inferred free.
  const disposition=await store.prune({});
  assert.equal(disposition.readerProofSupplied,true);
  assert.deepEqual(disposition.removed,ids.slice(2,4));
  assert.equal(disposition.retained.find(entry=>entry.id===ids[0]).reason,'READER_NOT_PROVEN_IDLE');
  assert.equal(disposition.retained.find(entry=>entry.id===ids[1]).reason,'READER_NOT_PROVEN_IDLE');
  assert.equal(disposition.retained.find(entry=>entry.id===ids[4]).reason,'RETAINED_FLOOR');
  assert.equal(disposition.retained.find(entry=>entry.id===ids[5]).reason,'CURRENT_OR_PINNED');
  assert.equal(disposition.storage.retain,4);
  assert.equal(disposition.storage.remaining,4);
  // An open reader keeps its snapshot for as long as it is open.
  const open=await store.snapshot({deadlineMs:OPEN});
  assert.equal(store.readerState(open.sha256).active,1);
  const held=await store.prune({keep:[ids[4]]});
  assert.equal(held.removed.includes(open.sha256),false);
  assert.equal(held.retained.find(entry=>entry.id===ids[5]).reason,'CURRENT_OR_PINNED');
 });
});

test('a reader released without a known child completion never becomes provably idle',async()=>{
 await withRoot(async root=>{
  const store=createSignedDefinitionStore({root,now:()=>T0,run:okRun});
  const id=await publish(root,{publishedAtMs:T0-2*60*60*1000,seed:'unknown-cleanup'});
  const bound=await store.snapshot({deadlineMs:OPEN});
  assert.deepEqual(store.readerState(id),{id,active:1,completed:0});
  // A cancelled child, or one whose cleanup state is unknown, releases without the completion confirmation.
  assert.equal(bound.reader.release({completed:false}),true);
  assert.deepEqual(store.readerState(id),{id,active:0,completed:0});
  // A superseding publication makes it a non-current candidate, and the disposition must still refuse to call it idle.
  await publish(root,{publishedAtMs:T0-60*60*1000,seed:'newer-than-unknown-cleanup'});
  const disposition=await store.prune({});
  assert.equal(disposition.removed.includes(id),false);
  assert.equal(disposition.retained.find(entry=>entry.id===id).reason,'READER_NOT_PROVEN_IDLE',
   'an unproved release never authorises removal');
 });
});

test('an unparsable snapshot directory is retained as evidence, never pruned',async()=>{
 await withRoot(async root=>{
  const store=createSignedDefinitionStore({root,now:()=>T0,run:okRun});
  const id=await publish(root,{publishedAtMs:T0-3600000,seed:'evidence'});
  await writeFile(join(root,'snapshots',id,'snapshot.json'),'{"schema":"tampered"}');
  const disposition=await store.prune({});
  assert.deepEqual(disposition.removed,[]);
  assert.equal(disposition.retained.find(entry=>entry.id===id).reason,'UNREADABLE_RETAINED');
 });
});

const ADMISSION={role:'upload-native',imageDigest:'sha256:'+'f'.repeat(64),qualificationId:'fixture',sandbox:'fixture',toolRootsReadOnly:true};
const TOOLS={scanner:{name:'clamav',version:'1.4.2',binarySha256:'a'.repeat(64)},
 extractor:{name:'meri-upload-extractor',version:'3.13.16',binarySha256:'b'.repeat(64)},pythonSha256:'c'.repeat(64)};
const DEFINITIONS_ROOT='/srv/defs';
const bound=id=>({sha256:id,publishedAt:new Date(T0).toISOString(),publishedAtMs:T0,version:'main.cvd,daily.cvd',
 files:[],databaseDirectory:`${DEFINITIONS_ROOT}/snapshots/${id}/database`});
async function scanWith({definitions,refresh,now=()=>T0}){
 const tempRoot=await realpath(tmpdir());
 const host=createUploadNativeInspection({admission:ADMISSION,tools:TOOLS,definitions,definitionsRoot:DEFINITIONS_ROOT,
  extractorPath:'/opt/meri/extract.py',run:async()=>({stdout:Buffer.alloc(0),exitCode:0}),tempRoot,now,
  ...(refresh===undefined?{}:{refresh})});
 const bytes=Buffer.from('payload'),file={sha256:sha(bytes),bytes:bytes.length,format:'txt'};
 return host.scanner.scan({file,bytes,limits:{originalBytes:1e7},deadlineMs:OPEN});
}

test('a stale resolve makes exactly one bounded refresh on the child deadline, then one re-resolve',async()=>{
 const calls=[];let attempt=0;
 const definitions={async snapshot(){attempt+=1;if(attempt===1)throw fault('UPLOAD_DEFINITIONS_STALE');return bound('fresh-snapshot');}};
 const receipt=await scanWith({definitions,refresh:args=>{calls.push(args);return Promise.resolve();}});
 assert.equal(calls.length,1,'exactly one attempt, never a loop');
 assert.equal(calls[0].deadlineMs,OPEN,'the refresh runs on the child\'s own absolute deadline');
 assert.equal(receipt.status,'clean');
 assert.equal(receipt.definitionsSha256,'fresh-snapshot','the scan is bound to the re-resolved snapshot');
});

test('an unavailable root is refreshed once; a failed refresh stays unavailable, never clean',async()=>{
 let attempts=0;
 const definitions={async snapshot(){attempts+=1;throw fault('UPLOAD_DEFINITIONS_UNAVAILABLE');}};
 const receipt=await scanWith({definitions,refresh:async()=>{throw fault('UPLOAD_DEFINITIONS_REFRESH_FAILED');}});
 assert.equal(attempts,2,'one initial resolve plus exactly one re-resolve');
 assert.equal(receipt.status,'unavailable');
 assert.equal(receipt.reason,'UPLOAD_DEFINITIONS_UNAVAILABLE');
 const noPort=await scanWith({definitions:{async snapshot(){throw fault('UPLOAD_DEFINITIONS_UNAVAILABLE');}}});
 assert.equal(noPort.status,'unavailable');
 assert.equal(noPort.reason,'UPLOAD_DEFINITIONS_UNAVAILABLE','without a refresh port the host stays fail-closed');
});

test('corruption is never repaired or silently replaced by a refresh',async()=>{
 for(const code of ['UPLOAD_DEFINITIONS_CORRUPT','UPLOAD_DEFINITIONS_UNVERIFIED','UPLOAD_DEFINITIONS_CANCELLED',
  'UPLOAD_DEFINITIONS_CONFIGURATION','UPLOAD_DEFINITIONS_EXPIRED']){
  const calls=[];
  const receipt=await scanWith({definitions:{async snapshot(){throw fault(code);}},
   refresh:args=>{calls.push(args);return Promise.resolve();}});
  assert.equal(calls.length,0,`${code} must not trigger a refresh`);
  assert.equal(receipt.status,'unavailable',`${code} is unavailable, never clean`);
  assert.equal(receipt.reason,code);
 }
});

test('a refresh can never extend the child budget past its own deadline',async()=>{
 let clock=T0;
 const receipt=await scanWith({definitions:{async snapshot(){throw fault('UPLOAD_DEFINITIONS_STALE');}},
  now:()=>clock,refresh:async()=>{clock=T0+60000;}});
 assert.equal(receipt.status,'unavailable');
 assert.equal(receipt.reason,'UPLOAD_EXPIRED','the refresh shares the deadline, so an overrun is an expiry, not a scan');
});

test('every pinned upload archive is bound to an exact lock record, and the layer cannot resolve live',async()=>{
 const repoRoot=join(import.meta.dirname,'..','..','..','..');
 const dockerfile=await readFile(join(repoRoot,'apps','runtime','Dockerfile'),'utf8');
 const lock=JSON.parse(await readFile(join(repoRoot,'infra','product-preview','runtime-packages.lock.json'),'utf8'));
 const records=new Map((lock.systemPackages??[]).map(record=>[record.source,record]));
 const adds=[...dockerfile.matchAll(/^ADD --checksum=sha256:([a-f0-9]{64}) (\S+) (\S+)$/gmu)]
  .filter(match=>match[3].startsWith('/tmp/meri-native-repo/aarch64/'));
 assert.equal(adds.length>=95,true,`the upload layer pins the approved set plus the whole transitive closure (${adds.length})`);
 for(const [,checksum,url,] of adds){
  const record=records.get(url);
  assert.notEqual(record,undefined,`${url} has no lock record`);
  assert.equal(record.sha256,checksum,`${url} must be pinned to exactly the lock hash`);
  assert.equal(record.architecture,'aarch64');
 }
 const hashes=new Set([...records.values()].map(record=>record.sha256));
 for(const approved of APPROVED)
  assert.equal(hashes.has(approved),true,'an approved pin must stay in the lock, not be replaced by a newer provider revision');
 const install=dockerfile.replace(/\\\r?\n/gu,' ').split(/\r?\n/u)
  .find(line=>line.startsWith('RUN ')&&line.includes('apk add ')&&line.includes(' tesseract='));
 assert.ok(install,'the native upload install must be present');
 assert.equal(install.includes('--no-network'),true,'the upload install cannot resolve against the live index');
 assert.equal(install.includes('--repository /tmp/meri-native-repo --repositories-file /dev/null'),true);
 assert.equal(install.includes('from=native-repository,source=tmp/meri-native-repo,target=/tmp/meri-native-repo,readonly'),true);
 assert.equal(dockerfile.includes('packages.wolfi.dev/os/aarch64/APKINDEX'),false,'no rolling index is consumed at build');
});

test('storage accounting measures the real root, counts junk and orphan staging, and never deletes them',async()=>{
 await withRoot(async root=>{
  const store=createSignedDefinitionStore({root,now:()=>T0,run:okRun});
  const ids=[];
  for(let index=0;index<3;index+=1){
   ids.push(await publish(root,{publishedAtMs:T0-60*60*1000+index,seed:`measured-${index}`}));
   const bound=await store.snapshot({deadlineMs:OPEN});
   bound.reader.release({completed:true});
  }
  // A junk file, an unparsable hash-named directory and an orphaned staging directory all occupy the root. Each must be
  // MEASURED into the declared bound and each must survive, because none of them is a snapshot this owner owns.
  const junk=Buffer.alloc(4096,7),unparsable=join(root,'snapshots','f'.repeat(64)),staging=join(root,'staging','refresh-orphan');
  await writeFile(join(root,'snapshots','not-a-snapshot.bin'),junk);
  await mkdir(unparsable,{recursive:true});
  await writeFile(join(unparsable,'leftover'),Buffer.alloc(2048,3));
  await mkdir(join(staging,'database'),{recursive:true});
  await writeFile(join(staging,'database','main.cvd'),Buffer.alloc(1024,1));
  const disposition=await store.prune({retain:1,maxSnapshots:2,maxBytes:1024});
  assert.equal(disposition.storage.proven,true,'every entry in this root is measurable');
  assert.equal(disposition.storage.state,'MEASURED_OVER_BOUND');
  assert.equal(disposition.storage.overBound,true);
  assert.equal(disposition.storage.classes.unreadableSnapshots,1,'the junk entry is counted as an unreadable snapshot entry');
  assert.equal(disposition.storage.stagingEntries,1,'orphan staging is counted into the bound even though it is retained');
  assert.equal(disposition.storage.bytes>junk.length+2048+1024,true,'the reported bytes are the MEASURED root contents');
  assert.equal(disposition.retained.find(entry=>entry.id===unparsable.split(/[\\/]/u).pop()).reason,'UNREADABLE_RETAINED');
  assert.deepEqual([...disposition.removed].sort(),[ids[0],ids[1]].sort(),'only proved-idle candidates are removed');
  for(const survivor of [join(root,'snapshots','not-a-snapshot.bin'),unparsable,staging])
   await assert.doesNotReject(()=>lstat(survivor),'an unknown, unparsable or unowned path is never deleted');
 });
});

test('an enumeration that cannot be proved reports UNKNOWN storage, not a false zero, and removes nothing',async()=>{
 await withRoot(async root=>{
  const store=createSignedDefinitionStore({root,now:()=>T0,run:okRun});
  // A `snapshots` entry that is a regular file cannot be enumerated: the disposition must say UNKNOWN, not zero.
  const blocker=Buffer.alloc(777,1);
  await writeFile(join(root,'snapshots'),blocker);
  await mkdir(join(root,'staging','orphan','database'),{recursive:true});
  await writeFile(join(root,'staging','orphan','database','main.cvd'),Buffer.alloc(64,2));
  const disposition=await store.prune({});
  assert.equal(disposition.storage.proven,false);
  assert.equal(disposition.storage.state,'UNMEASURED');
  assert.equal(disposition.storage.overBound,null,'an unprovable root is unknown, never a confident in-bound false');
  assert.deepEqual(disposition.removed,[]);
  assert.equal(disposition.storage.stagingEntries,1);
  assert.equal(disposition.storage.bytes>=blocker.length,true,'the bytes that could be measured are still reported');
  assert.equal(disposition.storage.unmeasured.length>0,true,'the reason the measurement is unproven is named');
  await assert.doesNotReject(()=>lstat(join(root,'snapshots')),'nothing is deleted from an unmeasured root');
 });
});

test('the reader bookkeeping of a confirmed prune is reclaimed, and an unproved reader keeps its snapshot',async()=>{
 await withRoot(async root=>{
  const store=createSignedDefinitionStore({root,now:()=>T0,run:okRun});
  const ids=[];
  for(let index=0;index<3;index+=1){
   ids.push(await publish(root,{publishedAtMs:T0-60*60*1000+index,seed:`reclaim-${index}`}));
   const bound=await store.snapshot({deadlineMs:OPEN});
   // The oldest snapshot is released with an UNKNOWN cleanup state, so it can never become provably idle.
   bound.reader.release({completed:index>0});
  }
  const disposition=await store.prune({retain:1});
  assert.deepEqual(disposition.removed,[ids[1]]);
  assert.equal(disposition.retained.find(entry=>entry.id===ids[0]).reason,'READER_NOT_PROVEN_IDLE');
  // The removed snapshot's bookkeeping is reclaimed: a second disposition neither re-removes it nor resurrects it.
  const again=await store.prune({retain:1});
  assert.equal(again.removed.includes(ids[1]),false,'a removed snapshot is never removed twice');
  assert.equal(again.retained.find(entry=>entry.id===ids[0]).reason,'READER_NOT_PROVEN_IDLE');
  assert.deepEqual(store.readerState(ids[1]),{id:ids[1],active:0,completed:0});
 });
});
