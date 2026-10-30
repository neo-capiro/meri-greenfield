import {spawn} from 'node:child_process';
import {runArtifactProcess} from '../../artifacts/process.mjs';
/** Fixed, server-owned signed scanner-definition owner for uploads: immutable, atomic, content-addressed snapshots.
 *
 * Why it is shaped this way. A refresh must never be able to change what an in-flight scan read. So a refresh is
 * staged in a uniquely owned directory of its own, every staged definition file is verified against the ClamAV
 * publisher signature, the verified set is published as a CONTENT-ADDRESSED IMMUTABLE directory that nobody later
 * writes to, and only then is the `current` pointer moved atomically. A scan resolves the pointer once and is bound
 * to that exact directory for its whole lifetime. The store re-reads and re-hashes the real database bytes on every
 * resolve and then re-verifies every container against the publisher signature through the fixed process port, so
 * neither a local `signatureVerified` flag, a hand-edited snapshot JSON, nor a whole forged-but-self-consistent
 * snapshot directory can make a scan believe it used definitions that ClamAV did not read.
 *
 * Published snapshots are removed only by the explicit bounded `prune`, whose rules can never delete the snapshot an
 * in-flight scan holds. Reader accounting and storage disposition: the resolve owner records every reader it issues and
 * the completion the caller reports back for it. That record — not elapsed time, not the `current` pointer, not a
 * caller keep-list — is the only proof `prune` accepts: an id is removed only when this owner can prove no reader is
 * active AND at least one reader finished. A cancelled or abandoned child whose cleanup state is unknown releases
 * WITHOUT the completion confirmation, so its snapshot stays unproved and is retained. Storage accounting measures the
 * bytes actually present under the root — every snapshot, every unparsable directory, every junk file and every orphan
 * staging directory, never following a symlink — and reports the disposition as UNKNOWN when enumeration or `stat`
 * cannot complete, so an unprovable root is never presented as if it were empty. Anything that cannot be reclaimed
 * under the declared bound is reported as a bounded storage-unavailable disposition, and nothing is ever deleted on an
 * inference.
 *
 * Supported database form, taken from the pinned ClamAV 1.5.2 sources. The only published form is the
 * signature-verified `.cvd` container. `CompressLocalDatabase` is NOT such a guarantee: the vendor sample documents it
 * as local `.cld` compression only ("By default freshclam will keep the local databases (.cld) uncompressed ... With
 * this option you can enable the compression"), so it never retains a signed container. A scripted update builds an
 * unsigned local `.cld` and then deletes the container it replaced ("CLD's can't be signed, so we don't need to worry
 * about the signature file"), a downloaded `.cld` is installed with no signature verification at all while a
 * downloaded `.cvd` is verified with its embedded publisher signature, and ClamAV's loader prefers a same-stem `.cld`
 * whose version is higher, refusing the older `.cvd`. An unauthenticated `.cld` beside a verified `.cvd` can therefore
 * be the database the engine actually reads, so a `.cld`/`.cdiff` in the staged directory fails closed and is never
 * published however plausible it looks. The fixed configuration disables scripted updates, which makes a refresh a
 * full signed `.cvd` download (the official CDN serves only CVDs); every staged `.cvd` is verified with
 * `sigtool --info` (MD5 plus embedded publisher signature) before it is published. FreshClam's own bookkeeping and
 * detached-signature sidecars (`freshclam.dat`, `mirrors.dat`, `*.sign`) are recognised so normal output is not
 * refused, and are removed from the staged database directory before publication, so a published directory contains
 * only verified database bytes.
 *
 * No daemon, socket or global cache is touched: nothing here starts a service, and the fixed freshclam
 * configuration sets no `NotifyClamd`, so no clamd ever runs or is contacted. ClamAV is no longer installed from a
 * Wolfi package at all: the source-built 1.5.4 payload provides `so:libclamav.so.12` for the scanner and the whole
 * tool surface (daemon, milter, clamdscan, clamdtop, signature tools, UnRAR support and the database layout) under
 * one install prefix, so `clamd`, `clamav-milter` and `clamdscan` are present because they are built, not because a
 * distribution package pulled them in; no daemon configuration exists and no child runs anything but
 * `clamscan`/`sigtool`/`freshclam` under the observed sandbox. No live download runs here; the updater is exercised
 * through an injected fixed process port and real execution is Release.
 */
import {createHash} from 'node:crypto';
import {copyFile,mkdir,readFile,readdir,writeFile,rename,rm,lstat,mkdtemp,chmod} from 'node:fs/promises';

/** Fixed definition programs run as UID/GID 1000: prepare ONLY these exact owner-generated paths for them. Published
 * snapshots stay root-owned and READ-ONLY for the upload child (0755 dirs / 0644 files, never writable); the staging area
 * and its generated freshclam configuration are the only writable-for-refresh inputs. */
async function prepareDefinitionAccess({root,staging,config,snapshot,id}){
 for(const dir of [root,join(root,'snapshots'),join(root,'staging'),staging,join(staging,'database')])
  await chmod(dir,0o755).catch(()=>{});
 if(config!==undefined)await chmod(config,0o644).catch(()=>{});
 if(snapshot!==undefined){const target=join(root,'snapshots',id);
  for(const dir of [target,join(target,'database')])await chmod(dir,0o755).catch(()=>{});
  for(const file of snapshot.files)await chmod(join(target,'database',file.name),0o644).catch(()=>{});
  await chmod(join(target,'snapshot.json'),0o644).catch(()=>{});}
 await chmod(join(root,'current'),0o644).catch(()=>{});
}
import {join,isAbsolute} from 'node:path';

export const UPLOAD_DEFINITIONS_SCHEMA='meri-upload-definitions/3';
/** Official ClamAV CDN mirror; the only host freshclam is configured to contact. */
export const UPLOAD_DEFINITIONS_HOST='database.clamav.net';
export const UPLOAD_FRESHCLAM='freshclam',UPLOAD_SIGTOOL='sigtool';
/** The ONLY definition programs and their fixed host paths. A caller can name a program, never a path or argv. */
export const DEFINITION_PROGRAMS=Object.freeze({[UPLOAD_SIGTOOL]:'/usr/bin/sigtool',[UPLOAD_FRESHCLAM]:'/usr/bin/freshclam'});
/** Sanitized bounded runner for the signed-definition owner. It refuses any program outside DEFINITION_PROGRAMS and keeps
 * the existing bounded artifact-process contract (bounded output, deadline, cancellation, owned-group cleanup). */
export const DEFINITION_CHILD_UID=1000,DEFINITION_CHILD_GID=1000;
/** Fixed ordinary identity for definition programs: root bootstrap must NOT be inherited by sigtool/freshclam. */
export function definitionSpawnPort(port=spawn){
 return (exe,args,options)=>port(exe,args,{...options,uid:DEFINITION_CHILD_UID,gid:DEFINITION_CHILD_GID,
  env:{PATH:'/usr/bin:/bin',LANG:'C.UTF-8',HOME:options?.cwd??'/tmp'}});
}
export async function runDefinitionProgram(program,args,{cwd='/',input=Buffer.alloc(0),signal,deadlineMs,maxOutput=262144,ports}={}){
 const exe=DEFINITION_PROGRAMS[program];
 if(typeof exe!=='string'||!Array.isArray(args)||args.some(a=>typeof a!=='string'||a.includes('\0')))fail('UPLOAD_DEFINITIONS_CONFIGURATION');
 const effective=ports===undefined?{spawn:definitionSpawnPort()}:{spawn:definitionSpawnPort(ports.spawn??spawn),kill:ports.kill};
 return runArtifactProcess(exe,args,{cwd,input,signal,deadlineMs,maxOutput},effective);
}
export const UPLOAD_DEFINITIONS_MAX_AGE_MS=72*60*60*1000;
/** Safety floor of the bounded storage disposition: it never reduces the published snapshot count below this, however
 * provably idle the removal candidates are. */
export const UPLOAD_DEFINITIONS_RETAINED_SNAPSHOTS=4;
/** Declared storage bound of a definitions root. When a root still exceeds either bound after the bounded disposition
 * has removed everything it can PROVE unreferenced, the caller is told through `storage.overBound` (surfaced as
 * UPLOAD_DEFINITIONS_STORAGE_UNAVAILABLE) instead of this owner deleting a snapshot it cannot prove unused. Elapsed
 * time is deliberately NOT a rule: a cancelled child or a failed cleanup leaves reader state UNKNOWN, and a reader
 * grace window would turn that unknown into a deletion. */
export const UPLOAD_DEFINITIONS_MAX_SNAPSHOTS=8;
export const UPLOAD_DEFINITIONS_MAX_BYTES=512*1024*1024;
/** Logical databases that must be covered by a published snapshot. Omitting the daily database is never silent. */
export const UPLOAD_DEFINITIONS_REQUIRED=Object.freeze(['main','daily']);
/** The only publishable database format: the signed container. A locally unpacked `.cld` carries no publisher
 * signature, so it can never be a published definition file. */
export const UPLOAD_DEFINITIONS_FORMATS=Object.freeze(['cvd']);
export const definitionsFault=code=>Object.assign(new Error(code),{code});
const fail=code=>{throw definitionsFault(code);};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const isHash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/u.test(value);
const DATABASE_NAME=/^[a-z0-9][a-z0-9._-]{0,63}\.cvd$/u;
/** FreshClam's own files: its update bookkeeping and the detached `.sign` it may fetch beside a container. They are
 * not database bytes, so they are recognised (normal output is never refused) and never published. */
const SIDECAR_NAME=/^(freshclam|mirrors)\.dat$|\.sign$/u;
const UNPUBLISHABLE_NAME=/\.(cld|cdiff)$/u;
const databaseFormat=name=>DATABASE_NAME.test(name)?name.slice(name.lastIndexOf('.')+1):null;
const databaseStem=name=>name.slice(0,name.lastIndexOf('.'));
/** The snapshot identity: a stable hash over the exact verified file records (name, format, sha256), so tampering with
 * any recorded property changes the identity the store recomputes from the real database bytes. */
export const definitionsSnapshotId=files=>hash(JSON.stringify([...files].map(f=>[f.name,f.format,f.sha256]).sort()));

/** Server-owned freshclam configuration text for one staging directory. `ScriptedUpdates no` makes a refresh a full
 * signed `.cvd` download instead of an unsigned locally built `.cld`; the official CDN carries only CVDs. `Checks 24`
 * is the vendor default check interval and `TestDatabases no` keeps test signatures out. Never uploaded. */
export function freshclamConfiguration(stagingRoot){
 if(typeof stagingRoot!=='string'||!isAbsolute(stagingRoot))fail('UPLOAD_DEFINITIONS_CONFIGURATION');
 return ['DatabaseDirectory '+join(stagingRoot,'database'),'DatabaseMirror '+UPLOAD_DEFINITIONS_HOST,'ScriptedUpdates no','Checks 24',
  'TestDatabases no','UpdateLogFile '+join(stagingRoot,'freshclam.log'),'Foreground yes',''].join('\n');
}
export const freshclamArguments=configPath=>['--config-file='+configPath,'--foreground','--no-warnings'];
/** Supported publisher-signature verification, taken from the vendor `sigtool` manual for the pinned ClamAV 1.5.x.
 * `--info` prints a container's information and verifies its MD5 and embedded digital signature; it is the only form
 * this module uses, both when a staged container is published and when a published container is resolved for a scan.
 * The detached-signature `sigtool --verify` form is deliberately NOT used: it expects a detached `.sign` file, and a
 * sidecar is neither published nor treated as database bytes. The vendor's delta form (`--verify-cdiff=<file>`, which
 * verifies a CDIFF against the current container) is not admitted at all: no delta is ever accepted or applied by this
 * owner, so there is no caller and no unreachable dispatcher for it. Host-owned constant. */
export const cvdVerificationArguments=file=>['--info',file];

function fileShape(raw){
 if(raw===null||typeof raw!=='object'||Array.isArray(raw))fail('UPLOAD_DEFINITIONS_CORRUPT');
 const {name,bytes,sha256,format}=raw;
 if(typeof name!=='string'||!DATABASE_NAME.test(name)||databaseFormat(name)!==format||!Number.isSafeInteger(bytes)||
  bytes<1||!isHash(sha256))fail('UPLOAD_DEFINITIONS_CORRUPT');
 const value={name,bytes,sha256,format};
 return Object.freeze(value);
}
function filesShape(raw){
 if(!Array.isArray(raw)||!raw.length||raw.length>64)fail('UPLOAD_DEFINITIONS_CORRUPT');
 const files=raw.map(fileShape);
 const names=files.map(f=>f.name);
 if(new Set(names).size!==names.length)fail('UPLOAD_DEFINITIONS_CORRUPT');
 const stems=new Set(files.map(f=>databaseStem(f.name)));
 if(!UPLOAD_DEFINITIONS_REQUIRED.every(stem=>stems.has(stem)))fail('UPLOAD_DEFINITIONS_INCOMPLETE');
 return Object.freeze(files);
}
function snapshotShape(raw,expectedId){
 if(raw===null||typeof raw!=='object'||Array.isArray(raw))fail('UPLOAD_DEFINITIONS_CORRUPT');
 const {schema,sha256,publishedAt,publishedAtMs,signatureVerified,version,files}=raw;
 if(schema!==UPLOAD_DEFINITIONS_SCHEMA||!isHash(sha256)||signatureVerified!==true||typeof version!=='string'||
  !version||version.length>256||!Number.isSafeInteger(publishedAtMs)||typeof publishedAt!=='string')fail('UPLOAD_DEFINITIONS_CORRUPT');
 const shaped=filesShape(files);
 if(expectedId!==undefined&&sha256!==expectedId)fail('UPLOAD_DEFINITIONS_CORRUPT');
 if(definitionsSnapshotId(shaped)!==sha256)fail('UPLOAD_DEFINITIONS_CORRUPT');
 return Object.freeze({schema,sha256,publishedAt,publishedAtMs,signatureVerified:true,version,files:shaped});
}
/** Verify one staged database file against the publisher signature. Only the signed `.cvd` container is publishable,
 * so this is the single verification form; an unpacked `.cld` or an unapplied `.cdiff` never reaches it. */
async function verifyStaged({run,database,file,staging,signal,deadlineMs}){
 try{await run(UPLOAD_SIGTOOL,cvdVerificationArguments(join(database,file)),{cwd:staging,input:Buffer.alloc(0),signal,deadlineMs});}
 catch{fail('UPLOAD_DEFINITIONS_UNVERIFIED');}
}
/** Bounded byte measurement of one path. A regular file contributes its own size, a symlink contributes its link size
 * and is NEVER followed, a directory contributes the sum of its children, and enumeration stops at depth 8 or 4096
 * visited entries. Any failed `lstat`/`readdir`, or a path that is neither file, directory nor symlink, marks the whole
 * measurement UNPROVEN so a caller can never be handed a confident false zero. Nothing is deleted, moved or repaired. */
async function measureTree(path,state,depth){
 let stat;
 try{stat=await lstat(path);}
 catch(error){state.proven=false;if(state.unmeasured.length<8)state.unmeasured.push(`${path}: ${error?.code??'UNREADABLE'}`);return 0;}
 if(stat.isSymbolicLink()){state.symlinks+=1;state.bytes+=stat.size;return stat.size;}
 if(!stat.isDirectory()){state.bytes+=stat.size;return stat.size;}
 if(depth>8){state.proven=false;if(state.unmeasured.length<8)state.unmeasured.push(`${path}: depth exceeded`);return 0;}
 let listing;
 try{listing=await readdir(path,{withFileTypes:true});}
 catch(error){state.proven=false;if(state.unmeasured.length<8)state.unmeasured.push(`${path}: ${error?.code??'UNREADABLE'}`);return 0;}
 let total=0;
 for(const entry of listing){
  state.visited+=1;
  if(state.visited>4096){state.proven=false;if(state.unmeasured.length<8)state.unmeasured.push(`${path}: entries exceeded`);return total;}
  total+=await measureTree(join(path,entry.name),state,depth+1);
 }
 return total;
}
/** Bounded storage disposition for published snapshots, run by the provisioning caller on the RESOLVE owner's proof.
 *
 * The rule that matters: elapsed time is NOT evidence that a reader released a snapshot. A scan can be cancelled or its
 * cleanup can fail, so neither the `current` pointer, a caller keep-list, nor any grace window proves that no child
 * still holds a directory. Removal therefore requires an ACTUAL proof of reader state, supplied by the owner that
 * issues the readers (`isIdle`, wired by `createSignedDefinitionStore` to its live reader accounting and to the
 * known-child completion its callers report). With no such proof nothing is removed: every candidate is RETAINED and
 * reported with a reason, and a root that therefore cannot be brought under its declared bound is reported through
 * `storage.overBound` so the caller can surface a bounded storage-unavailable disposition instead of this function
 * guessing. No global lease system is introduced: the proof is the resolve owner's own accounting.
 *
 * Storage accounting is MEASURED, never assumed. `storage.bytes` is the sum of the real sizes present under the root —
 * every published snapshot, every unparsable directory, every junk file and every orphan staging directory, with a
 * symlink contributing only its link size and never followed — and `storage.classes` accounts for each kind.
 * Enumeration is bounded (depth 8, 4096 visited entries) and any failed `readdir`/`lstat` sets `storage.proven` false,
 * makes `storage.overBound` null and `storage.state` `UNMEASURED`, and suppresses every removal: an unprovable root is
 * reported as unknown rather than as a false zero, and no path that was not enumerated is ever touched.
 *
 * Enforced rules, each checked rather than assumed:
 *  - the snapshot `current` names is never removed, and neither is any id in `keep`;
 *  - an id is removed only when `isIdle(id)` is true, re-checked immediately before each removal, so a reader that
 *    began between the probe and the removal still wins;
 *  - a directory that cannot first be parsed as the snapshot it claims to be is RETAINED as evidence, never deleted,
 *    so a corrupt or half-written snapshot stays available instead of being quietly pruned;
 *  - the published snapshot count never drops below `retain`;
 *  - staging directories are never removed here: a refresh owns its staging directory and removes it in its own
 *    `finally`, so a concurrent refresh's staging area cannot be proved idle by this function. Orphaned staging is
 *    reported instead (`storage.stagingEntries`) as part of the bounded disposition.
 * It returns what it did, so the disposition is a reported fact rather than a silent side effect. */
export async function pruneSnapshots({root,now=Date.now,keep=[],isIdle,retain=UPLOAD_DEFINITIONS_RETAINED_SNAPSHOTS,
 maxSnapshots=UPLOAD_DEFINITIONS_MAX_SNAPSHOTS,maxBytes=UPLOAD_DEFINITIONS_MAX_BYTES,signal}={}){
 if(typeof root!=='string'||!isAbsolute(root)||typeof now!=='function'||!Array.isArray(keep)||!keep.every(isHash)||
  !Number.isSafeInteger(retain)||retain<1||!Number.isSafeInteger(maxSnapshots)||maxSnapshots<1||
  !Number.isSafeInteger(maxBytes)||maxBytes<1||(isIdle!==undefined&&typeof isIdle!=='function'))fail('UPLOAD_DEFINITIONS_CONFIGURATION');
 if(signal?.aborted)fail('UPLOAD_DEFINITIONS_CANCELLED');
 const supplied=typeof isIdle==='function',idle=supplied?isIdle:()=>false;
 const pointer=(await readFile(join(root,'current'),'utf8').catch(()=>'')).trim();
 const current=isHash(pointer)?pointer:null;
 const pinned=new Set([...keep,...(current===null?[]:[current])]);
 const measurement={bytes:0,proven:true,unmeasured:[],visited:0,symlinks:0};
 const classes={snapshots:0,unreadableSnapshots:0,staging:0,other:0,currentPointer:0};
 const record=reason=>{measurement.proven=false;if(measurement.unmeasured.length<8)measurement.unmeasured.push(String(reason));};
 // Root-level entries. `snapshots` and `staging` are measured by their own passes below so nothing is counted twice.
 try{
  for(const entry of await readdir(root,{withFileTypes:true})){
   if(entry.name==='snapshots'){
    if(!entry.isDirectory()||entry.isSymbolicLink()){
     record('snapshots: not a directory');classes.other+=1;
     measurement.bytes+=await measureTree(join(root,entry.name),measurement,0);
    }
    continue;
   }
   if(entry.name==='staging'){
    if(!entry.isDirectory()||entry.isSymbolicLink()){
     record('staging: not a directory');classes.other+=1;
     measurement.bytes+=await measureTree(join(root,entry.name),measurement,0);
    }
    continue;
   }
   classes[entry.name==='current'?'currentPointer':'other']+=1;
   measurement.bytes+=await measureTree(join(root,entry.name),measurement,0);
  }
 }catch(error){record(`root: ${error?.code??'UNREADABLE'}`);}
 // Orphaned staging is never removed here, but it does occupy the declared bound, so it is measured and counted.
 {const stagingRoot=join(root,'staging');
  let listed=null;
  try{listed=await readdir(stagingRoot,{withFileTypes:true});}
  catch(error){if(error?.code!=='ENOENT')record(`staging: ${error?.code??'UNREADABLE'}`);}
  if(listed!==null){classes.staging=listed.length;measurement.bytes+=await measureTree(stagingRoot,measurement,1);}}
 // An absent `snapshots` directory is an empty root (a fact); any other listing failure is an UNPROVEN measurement.
 const entries=[];let snapshotListing=null;
 try{snapshotListing=await readdir(join(root,'snapshots'),{withFileTypes:true});}
 catch(error){if(error?.code!=='ENOENT')record(`snapshots: ${error?.code??'UNREADABLE'}`);}
 const bytesById=new Map();
 if(snapshotListing!==null)for(const entry of snapshotListing){
  entries.push(entry);
  bytesById.set(entry.name,await measureTree(join(root,'snapshots',entry.name),measurement,1));
 }
 const retained=[],candidates=[];
 let published=0;
 for(const entry of entries){
  if(!entry.isDirectory()||entry.isSymbolicLink()||!isHash(entry.name)){classes.unreadableSnapshots+=1;retained.push({id:entry.name,reason:'NOT_A_SNAPSHOT'});continue;}
  classes.snapshots+=1;
  const directory=join(root,'snapshots',entry.name),size=bytesById.get(entry.name)??0;
  let shaped;
  try{shaped=snapshotShape(JSON.parse(await readFile(join(directory,'snapshot.json'),'utf8')),entry.name);}
  catch{published+=1;retained.push({id:entry.name,reason:'UNREADABLE_RETAINED'});continue;}
  published+=1;
  if(pinned.has(entry.name)){retained.push({id:entry.name,reason:'CURRENT_OR_PINNED'});continue;}
  candidates.push({id:entry.name,bytes:size,publishedAtMs:shaped.publishedAtMs,directory});
 }
 candidates.sort((left,right)=>right.publishedAtMs-left.publishedAtMs);
 const idleIds=new Set();
 for(const item of candidates){
  if(await idle(item.id)===true)idleIds.add(item.id);
  else retained.push({id:item.id,reason:supplied?'READER_NOT_PROVEN_IDLE':'READER_STATE_UNKNOWN'});
 }
 // An unproven measurement is an UNKNOWN disposition, never a licence to remove: with an incomplete enumeration nothing
 // is deleted, because accounting that cannot prove the bound cannot justify a deletion either.
 const budget=measurement.proven?Math.max(0,published-retain):0,removed=[];
 // Oldest idle candidate first, so the newer snapshots are the ones kept when the budget runs out.
 for(const item of [...candidates].reverse()){
  if(removed.length>=budget||!idleIds.has(item.id))continue;
  // Re-proved at the moment of removal: a reader that started after the probe keeps its snapshot.
  if(await idle(item.id)!==true){retained.push({id:item.id,reason:'READER_NOT_PROVEN_IDLE'});idleIds.delete(item.id);continue;}
  await rm(item.directory,{recursive:true,force:true});
  removed.push(item.id);
  measurement.bytes-=item.bytes;
  idleIds.delete(item.id);
 }
 for(const id of idleIds)retained.push({id,reason:measurement.proven?'RETAINED_FLOOR':'STORAGE_UNMEASURED_RETAINED'});
 const remaining=published-removed.length,overBound=remaining>maxSnapshots||measurement.bytes>maxBytes;
 return Object.freeze({current,removed:Object.freeze(removed),retained:Object.freeze(retained.map(entry=>Object.freeze(entry))),
  readerProofSupplied:supplied,
  storage:Object.freeze({published,remaining,bytes:Math.max(0,measurement.bytes),stagingEntries:classes.staging,
   classes:Object.freeze({...classes}),measuredEntries:measurement.visited,symlinkEntries:measurement.symlinks,
   unmeasured:Object.freeze(measurement.unmeasured.slice(0,8)),proven:measurement.proven,
   state:measurement.proven?(overBound?'MEASURED_OVER_BOUND':'MEASURED_UNDER_BOUND'):'UNMEASURED',
   overBound:measurement.proven?overBound:null,maxSnapshots,maxBytes,retain})});
}
/** Provision/refresh. Stages into a uniquely owned directory, verifies every signed container, prepares a publication
 * directory holding only verified database bytes, publishes it as an immutable content-addressed snapshot, then moves
 * `current` atomically. A failure at any point leaves the previous snapshot and pointer untouched, so a failed refresh
 * retains the last valid signed snapshot. Nothing is deleted here: the bounded storage disposition lives on the
 * reader-pin owner (`createSignedDefinitionStore`'s `prune`), which needs the reader accounting only the resolve owner
 * has, so an in-flight reader bound to an older snapshot always keeps a valid directory. */
export function createSignedDefinitionUpdater({root,run,now=Date.now}){
 if(typeof root!=='string'||!isAbsolute(root)||typeof run!=='function'||typeof now!=='function')fail('UPLOAD_DEFINITIONS_CONFIGURATION');
 return Object.freeze({async provision({signal,deadlineMs}={}){
  if(!Number.isSafeInteger(deadlineMs)||deadlineMs<=now())fail('UPLOAD_DEFINITIONS_EXPIRED');
  await mkdir(join(root,'staging'),{recursive:true,mode:0o700});
  await mkdir(join(root,'snapshots'),{recursive:true,mode:0o700});
  const staging=await mkdtemp(join(root,'staging','refresh-')),database=join(staging,'database');
  try{
   await mkdir(database,{recursive:true,mode:0o700});
   const config=join(staging,'freshclam.conf');
   await writeFile(config,freshclamConfiguration(staging),{mode:0o600});
   await prepareDefinitionAccess({root,staging,config});   // UID/GID 1000 freshclam can read/traverse exactly these
   try{await run(UPLOAD_FRESHCLAM,freshclamArguments(config),{cwd:staging,input:Buffer.alloc(0),signal,deadlineMs});}
   catch{fail('UPLOAD_DEFINITIONS_REFRESH_FAILED');}
   const entries=await readdir(database,{withFileTypes:true}).catch(()=>[]);
   if(!entries.length)fail('UPLOAD_DEFINITIONS_REFRESH_FAILED');
   const sidecars=[];
   for(const entry of entries){
    // An unpacked `.cld` or an unapplied `.cdiff` delta is not a signed database: refuse it rather than publish it,
    // even beside a verified `.cvd`, because the engine prefers a higher-versioned `.cld` over the verified container.
    if(UNPUBLISHABLE_NAME.test(entry.name))fail('UPLOAD_DEFINITIONS_UNVERIFIED');
    if(!DATABASE_NAME.test(entry.name)&&!SIDECAR_NAME.test(entry.name))fail('UPLOAD_DEFINITIONS_FORMAT_UNSUPPORTED');
    const stat=await lstat(join(database,entry.name)).catch(()=>null);
    if(stat===null||!stat.isFile()||stat.isSymbolicLink())fail('UPLOAD_DEFINITIONS_CORRUPT');
    if(!DATABASE_NAME.test(entry.name))sidecars.push(entry.name);
   }
   const names=entries.map(entry=>entry.name).sort().filter(name=>DATABASE_NAME.test(name));
   if(!names.length)fail('UPLOAD_DEFINITIONS_INCOMPLETE');
   filesShape(names.map(name=>({name,bytes:1,sha256:'0'.repeat(64),format:databaseFormat(name)})));
   const files=[];
   for(const name of names){
    await verifyStaged({run,database,file:name,staging,signal,deadlineMs});
    const bytes=await readFile(join(database,name));
    files.push(fileShape({name,bytes:bytes.length,sha256:hash(bytes),format:databaseFormat(name)}));
   }
   const id=definitionsSnapshotId(files),publishedAtMs=now();
   const snapshot=snapshotShape({schema:UPLOAD_DEFINITIONS_SCHEMA,sha256:id,publishedAt:new Date(publishedAtMs).toISOString(),
    publishedAtMs,signatureVerified:true,version:files.map(f=>f.name).join(','),files});
   // Strict separation: a published directory holds only verified database bytes, so freshclam's own bookkeeping and
   // detached-signature sidecars are removed from the staged database directory before anything is published.
   for(const name of sidecars)await rm(join(database,name),{force:true});
   const prepared=join(staging,'publish');
   await mkdir(join(prepared,'database'),{recursive:true,mode:0o700});
   for(const file of files)await copyFile(join(database,file.name),join(prepared,'database',file.name));
   await writeFile(join(prepared,'snapshot.json'),JSON.stringify(snapshot),{mode:0o600});
   const target=join(root,'snapshots',id);
   try{await rename(prepared,target);}
   catch(error){
    if(!['EEXIST','ENOTEMPTY','EPERM'].includes(error?.code))fail('UPLOAD_DEFINITIONS_PUBLISH_FAILED');
    // An identical content-addressed snapshot already exists: it is immutable and already valid, so reuse it.
    let existing;try{existing=JSON.parse(await readFile(join(target,'snapshot.json'),'utf8'));}catch{fail('UPLOAD_DEFINITIONS_CORRUPT');}
    snapshotShape(existing,id);
   }
   // The pointer is staged inside this refresh's uniquely owned directory, so two concurrent refreshes into the same
   // root never share a temporary name. The move onto `current` is atomic and the last writer wins; the bounded retry
   // covers a transient destination lock under writer contention (observed as EPERM on a Windows authoring host) and
   // never publishes a partial pointer.
   await prepareDefinitionAccess({root,staging,snapshot,id});
   const pointer=join(staging,'current.tmp');
   await writeFile(pointer,id,{mode:0o600});
   for(let attempt=0;;attempt+=1){
    try{await rename(pointer,join(root,'current'));break;}
    catch(error){
     if(attempt>=7||!['EPERM','EACCES','EBUSY'].includes(error?.code))fail('UPLOAD_DEFINITIONS_PUBLISH_FAILED');
     await new Promise(resolve=>setTimeout(resolve,10*(attempt+1)));
    }
   }
   return Object.freeze({...snapshot,databaseDirectory:join(target,'database')});
  }finally{await rm(staging,{recursive:true,force:true});}
 }});
}
/** Resolve the current snapshot for one scan and prove it. Read-only: never writes, downloads or refreshes.
 * The pointer is validated (no traversal), the immutable directory is checked for symlinks and for an exact file set,
 * every database byte is re-hashed against the recorded hash, and every container is then re-verified against the
 * ClamAV publisher signature through the injected fixed process port. The re-verification is the point: a same-UID
 * writer that replaces a whole snapshot directory (bytes, manifest and pointer) could otherwise manufacture a
 * self-consistent forgery that the recorded-hash check alone accepts, whereas it cannot forge the publisher's embedded
 * signature. `run` is therefore REQUIRED — a store that cannot verify is a configuration fault, never a silent
 * downgrade to provenance-by-convention. Missing/unreadable is unavailable, tampered/forged/corrupt is corrupt, an
 * unsigned or repackaged container is unverified, expired is stale.
 *
 * This store is also the READER-PIN AUTHORITY for the bounded storage disposition: a successful resolve registers a
 * reader and returns `reader.release({completed})`, which its caller MUST invoke once the child it bound is finished.
 * Only `completed:true` — a known child completion, including a clean exit — is proof of release. A cancelled,
 * abandoned or unknown-cleanup child releases without it, so its snapshot stays unproved and is retained. `prune`
 * closes over this same live accounting, so there is exactly one owner and exactly one proof, and an id this store
 * never issued a reader for is not treated as idle either (a sibling process sharing the root could hold it). */
export function createSignedDefinitionStore({root,now=Date.now,maxAgeMs=UPLOAD_DEFINITIONS_MAX_AGE_MS,run}={}){
 if(typeof root!=='string'||!isAbsolute(root)||typeof now!=='function'||!Number.isSafeInteger(maxAgeMs)||maxAgeMs<1||
  typeof run!=='function')fail('UPLOAD_DEFINITIONS_CONFIGURATION');
 const readers=new Map();
 const readerState=id=>{const entry=readers.get(id);return Object.freeze({id,active:entry?.tokens.size??0,completed:entry?.completed??0});};
 const idle=id=>{const entry=readers.get(id);return entry!==undefined&&entry.tokens.size===0&&entry.completed>0;};
 const release=(id,token,completed)=>{
  const entry=readers.get(id);
  if(entry===undefined||!entry.tokens.has(token))return false;
  if(completed!==true){
   // An UNKNOWN child keeps its exact token: the snapshot is never provably idle, so it cannot be pruned. A later
   // `completed:true` on this same token is the only thing that may close it.
   return true;
  }
  entry.tokens.delete(token);
  entry.completed+=1;
  if(entry.tokens.size===0&&entry.completed===0)readers.delete(id);
  return true;
 };
 return Object.freeze({async snapshot({signal,deadlineMs}={}){
  if(signal?.aborted)fail('UPLOAD_DEFINITIONS_CANCELLED');
  const id=(await readFile(join(root,'current'),'utf8').catch(()=>fail('UPLOAD_DEFINITIONS_UNAVAILABLE'))).trim();
  if(!isHash(id))fail('UPLOAD_DEFINITIONS_CORRUPT');
  const directory=join(root,'snapshots',id);
  const stat=await lstat(directory).catch(()=>fail('UPLOAD_DEFINITIONS_UNAVAILABLE'));
  if(!stat.isDirectory()||stat.isSymbolicLink())fail('UPLOAD_DEFINITIONS_CORRUPT');
  let raw;try{raw=JSON.parse(await readFile(join(directory,'snapshot.json'),'utf8'));}catch{fail('UPLOAD_DEFINITIONS_UNAVAILABLE');}
  const snapshot=snapshotShape(raw,id);
  const database=join(directory,'database');
  const entries=await readdir(database,{withFileTypes:true}).catch(()=>fail('UPLOAD_DEFINITIONS_UNAVAILABLE'));
  const expected=snapshot.files.map(f=>f.name).sort();
  const found=entries.map(entry=>entry.name).sort();
  if(found.length!==expected.length||found.some((name,index)=>name!==expected[index]))fail('UPLOAD_DEFINITIONS_CORRUPT');
  for(const entry of entries)if(!entry.isFile()||databaseFormat(entry.name)===null)fail('UPLOAD_DEFINITIONS_CORRUPT');
  const verified=[];
  for(const file of snapshot.files){
   const path=join(database,file.name);
   const fileStat=await lstat(path).catch(()=>fail('UPLOAD_DEFINITIONS_CORRUPT'));
   if(!fileStat.isFile()||fileStat.isSymbolicLink())fail('UPLOAD_DEFINITIONS_CORRUPT');
   const bytes=await readFile(path);
   if(bytes.length!==file.bytes||hash(bytes)!==file.sha256)fail('UPLOAD_DEFINITIONS_CORRUPT');
   await verifyStaged({run,database,file:file.name,staging:directory,signal,deadlineMs});
   verified.push({name:file.name,format:file.format,sha256:file.sha256,bytes:file.bytes});
  }
  if(definitionsSnapshotId(verified)!==snapshot.sha256)fail('UPLOAD_DEFINITIONS_CORRUPT');
  if(snapshot.publishedAtMs>now())fail('UPLOAD_DEFINITIONS_CORRUPT');
  if(now()-snapshot.publishedAtMs>maxAgeMs)fail('UPLOAD_DEFINITIONS_STALE');
  // The reader is registered only AFTER the snapshot is fully proved, so a refused resolve never pins anything.
  const token=Symbol('upload-definitions-reader');
  const entry=readers.get(snapshot.sha256)??{tokens:new Set(),completed:0};
  entry.tokens.add(token);
  readers.set(snapshot.sha256,entry);
  return Object.freeze({sha256:snapshot.sha256,publishedAt:snapshot.publishedAt,publishedAtMs:snapshot.publishedAtMs,
   version:snapshot.version,files:snapshot.files,databaseDirectory:database,
   reader:Object.freeze({release({completed=false}={}){return release(snapshot.sha256,token,completed===true);}})});
 },/** Live reader state of one snapshot id: `{id,active,completed}`. Reporting only; never a deletion authority. */
 readerState(id){return readerState(id);},
 /** Bounded storage disposition on the reader-pin owner: removes only snapshots this store can PROVE unreferenced (no
  * active reader and a recorded child completion), never the `current` snapshot, never a `keep` id, never anything it
  * cannot parse, and never below the retained floor. Everything else is retained and reported, and
  * `storage.overBound` tells the caller when the declared bound could not be met. */
 async prune({keep=[],signal,retain,maxSnapshots,maxBytes}={}){
  // The declared bound is the CALLER's: every bound is forwarded when it is given, so a caller that must meet a tighter
  // bound is answered against that bound instead of being silently measured against this module's defaults.
  const disposition=await pruneSnapshots({root,now,keep,isIdle:id=>idle(id),signal,
   ...(retain===undefined?{}:{retain}),...(maxSnapshots===undefined?{}:{maxSnapshots}),
   ...(maxBytes===undefined?{}:{maxBytes})});
  // Bookkeeping for a snapshot this owner PROVED idle and then removed is reclaimed, so the reader map stays bounded
  // by the live snapshot set instead of growing with publication history. Nothing else is ever dropped: an unproved or
  // unknown reader state is exactly what keeps its snapshot retained.
  for(const id of disposition.removed)readers.delete(id);
  return disposition;
 }});
}
