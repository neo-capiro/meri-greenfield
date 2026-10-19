/** Retain the document-generation executor's pending public inputs and verify the retained snapshot.
 *
 *   node complete-pending-additions.mjs check   (offline) every retained APK under x86_64/ is re-identified against the
 *                                              RETAINED SIGNED INDEX (control checksum, .PKGINFO name/version/datahash,
 *                                              size) and the lock's sha256; every retained wheel matches runtime-wheels.lock.json.
 *   node complete-pending-additions.mjs run     downloads each exact URL that pending-additions.json / runtime-wheels.lock.json
 *                                              names and whose bytes are not retained yet, applies the same checks, writes the
 *                                              bytes with O_EXCL next to the existing snapshot, moves each APK row (with the
 *                                              sha256 measured from the verified bytes) into runtime-packages.lock.json, removes
 *                                              pending-additions.json and writes retained-additions-receipt.json.
 *
 * The image build never runs this: it stays --network=none and consumes only the retained bytes. Network here is limited to the
 * exact URLs the two records name (packages.wolfi.dev and files.pythonhosted.org), TLS-verified, no redirects, exact length.
 * No sha256 is guessed: an APK is accepted only when its control member hashes to the checksum the signed index records for
 * exactly that name/version, its .PKGINFO datahash equals the SHA-256 of its data member and its size equals the index size;
 * a wheel only when its bytes hash to the repository's existing pin. Exit 0 success, 2 refusal (no partial file is kept). */
import {createHash} from 'node:crypto';
import * as fs from 'node:fs/promises';
import https from 'node:https';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {inflateRawSync} from 'node:zlib';
import {parseRuntimePackageLock,fetchRuntimePackages,retainedFetch} from '../../../apps/runtime/build/runtime-packages.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
export const PATHS=Object.freeze({
 lock:path.resolve(here,'../runtime-packages.lock.json'),wheelLock:path.resolve(here,'../runtime-wheels.lock.json'),
 pending:path.join(here,'pending-additions.json'),receipt:path.join(here,'retained-additions-receipt.json'),
 apkDirectory:path.join(here,'x86_64'),wheelDirectory:path.join(here,'wheels')});
const APK_ORIGIN='https://packages.wolfi.dev/os/x86_64/',WHEEL_ORIGIN='https://files.pythonhosted.org/packages/';
const NAME=/^[a-z0-9][a-z0-9+_.-]{0,127}$/u,VERSION=/^[0-9][A-Za-z0-9._+~-]{0,127}$/u,HEX64=/^[a-f0-9]{64}$/u;
const FILE_LIMIT=16*1024*1024;
const fail=code=>{throw Object.assign(Error('RETAINED_ADDITIONS_'+code),{code:'RETAINED_ADDITIONS_'+code});};
const need=(ok,code)=>{if(!ok)fail(code);};
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const plain=(value,keys)=>{need(value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k)),'SHAPE');return value;};

/** Every concatenated gzip member of an APK or APKINDEX: [{start, end, output}]. Node's gunzip would swallow all members at
 * once, so each header (RFC 1952) is walked by hand and its deflate stream inflated raw to find the exact member boundary. */
export function gzipMembers(bytes){
 const members=[];let offset=0;
 while(offset<bytes.length){
  need(offset+10<=bytes.length&&bytes[offset]===0x1f&&bytes[offset+1]===0x8b&&bytes[offset+2]===8,'GZIP');
  const flags=bytes[offset+3];let pos=offset+10;
  if(flags&4){need(pos+2<=bytes.length,'GZIP');pos+=2+bytes.readUInt16LE(pos);}
  for(const bit of [8,16])if(flags&bit){const end=bytes.indexOf(0,pos);need(end>=0,'GZIP');pos=end+1;}
  if(flags&2)pos+=2;
  need(pos<bytes.length,'GZIP');
  const {buffer,engine}=inflateRawSync(bytes.subarray(pos),{info:true,maxOutputLength:256*1024*1024});
  const end=pos+engine.bytesWritten+8;need(engine.bytesWritten>0&&end<=bytes.length&&bytes.readUInt32LE(end-4)===(buffer.length>>>0),'GZIP');
  members.push({start:offset,end,output:buffer});offset=end;
 }
 need(members.length>0,'GZIP');return members;
}
/** ustar entries of a tar stream (name -> content); the control member holds .PKGINFO. */
function tarEntries(tar){
 const entries=new Map();
 for(let pos=0;pos+512<=tar.length;){
  const name=tar.subarray(pos,pos+100).toString('utf8').split('\0')[0];if(!name)break;
  const size=parseInt(tar.subarray(pos+124,pos+136).toString('ascii').replace(/\0/gu,'').trim()||'0',8);
  need(Number.isSafeInteger(size)&&size>=0&&pos+512+size<=tar.length,'TAR');
  entries.set(name,tar.subarray(pos+512,pos+512+size));pos+=512+Math.ceil(size/512)*512;
 }
 return entries;
}
/** apk-tools identity of one package file: the signed index's control checksum plus the control's own data hash. */
export function inspectApk(bytes){
 const members=gzipMembers(bytes);need(members.length===2||members.length===3,'APK_LAYOUT');
 const signed=members.length===3;if(signed)need([...tarEntries(members[0].output).keys()].some(name=>name.startsWith('.SIGN.')),'APK_LAYOUT');
 const control=members[signed?1:0],data=members[signed?2:1];
 const pkginfo=tarEntries(control.output).get('.PKGINFO');need(pkginfo,'PKGINFO');
 const fields=new Map();for(const line of pkginfo.toString('utf8').split('\n')){const m=/^([a-z_]+) = (.*)$/u.exec(line);if(m&&!fields.has(m[1]))fields.set(m[1],m[2]);}
 const datahash=fields.get('datahash');need(typeof datahash==='string'&&HEX64.test(datahash),'PKGINFO');
 return Object.freeze({signed,controlChecksum:'Q1'+createHash('sha1').update(bytes.subarray(control.start,control.end)).digest('base64'),
  pkgname:fields.get('pkgname'),pkgver:fields.get('pkgver'),datahash,dataSha256:sha256(bytes.subarray(data.start,data.end)),sha256:sha256(bytes),bytes:bytes.length});
}
/** The retained signed APKINDEX, keyed name=version -> {C, S}. Its bytes must be the lock's exact index. */
export function parseRetainedIndex(bytes,expectedSha256){
 need(sha256(bytes)===expectedSha256,'INDEX');
 const members=gzipMembers(bytes),index=tarEntries(members[members.length-1].output).get('APKINDEX');need(index,'INDEX');
 const rows=new Map();
 for(const block of index.toString('utf8').split('\n\n')){
  const f=new Map();for(const line of block.split('\n'))if(line.length>2&&line[1]===':')f.set(line[0],line.slice(2));
  if(f.has('P')&&f.has('V'))rows.set(f.get('P')+'='+f.get('V'),{C:f.get('C'),S:Number(f.get('S')),c:f.get('c'),L:f.get('L')});
 }
 need(rows.size>0,'INDEX');return rows;
}
/** The complete offline acceptance of one APK's bytes for one lock/pending row against the signed index. */
export function verifyApk(bytes,row,index,{sha256:expected}={}){
 const entry=index.get(row.name+'='+row.version);need(entry!==undefined,'NOT_INDEXED');
 need(bytes.length===row.bytes&&bytes.length===entry.S&&bytes.length<=FILE_LIMIT,'SIZE');
 const identity=inspectApk(bytes);
 need(identity.controlChecksum===entry.C&&identity.pkgname===row.name&&identity.pkgver===row.version&&identity.datahash===identity.dataSha256,'IDENTITY');
 if(expected!==undefined)need(identity.sha256===expected,'SHA256');
 return identity;
}
function apkRow(row){
 plain(row,['name','version','file','url','bytes','license','indexControlChecksum','sourceRecipeCommit']);
 need(NAME.test(row.name)&&VERSION.test(row.version)&&row.file===row.name+'-'+row.version+'.apk'&&row.url===APK_ORIGIN+row.file&&Number.isSafeInteger(row.bytes)&&row.bytes>0&&row.bytes<=FILE_LIMIT,'SHAPE');
 return row;
}
function wheelRow(row){
 plain(row,['name','version','file','url','sha256','bytes','license','importName']);
 need(/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/u.test(row.name)&&/^[0-9][A-Za-z0-9.]{0,31}$/u.test(row.version)&&/^[A-Za-z0-9][A-Za-z0-9._-]{0,199}\.whl$/u.test(row.file)&&
  row.url===WHEEL_ORIGIN+row.url.slice(WHEEL_ORIGIN.length)&&/^[a-f0-9]{2}\/[a-f0-9]{2}\/[a-f0-9]{60}\/[^/]+$/u.test(row.url.slice(WHEEL_ORIGIN.length))&&row.url.endsWith('/'+row.file)&&
  HEX64.test(row.sha256)&&Number.isSafeInteger(row.bytes)&&row.bytes>0&&row.bytes<=FILE_LIMIT&&/^[a-z_][a-z0-9_]{0,63}$/u.test(row.importName),'SHAPE');
 return row;
}
export function readPending(text){
 const doc=JSON.parse(text);plain(doc,['schemaVersion','status','lock','repositoryIndexSha256','note','apkPackages']);
 need(doc.schemaVersion===1&&doc.status==='PENDING_PUBLIC_DOWNLOAD'&&doc.lock==='infra/product-preview/runtime-packages.lock.json'&&HEX64.test(doc.repositoryIndexSha256)&&Array.isArray(doc.apkPackages)&&doc.apkPackages.length>0&&doc.apkPackages.length<=128,'SHAPE');
 const names=new Set();for(const row of doc.apkPackages){apkRow(row);need(!names.has(row.name),'DUPLICATE');names.add(row.name);}
 return doc;
}
export function readWheelLock(text){
 const doc=JSON.parse(text);plain(doc,['schemaVersion','platform','pythonMinor','sitePackages','provenance','wheels']);
 need(doc.schemaVersion===1&&doc.platform==='linux/amd64'&&doc.pythonMinor==='3.13'&&doc.sitePackages==='/usr/lib/python3.13/site-packages'&&Array.isArray(doc.wheels)&&doc.wheels.length>0&&doc.wheels.length<=32,'SHAPE');
 const files=new Set();for(const row of doc.wheels){wheelRow(row);need(!files.has(row.file),'DUPLICATE');files.add(row.file);}
 return doc;
}
/** One exact public GET: TLS validation on, no redirect, identity encoding, exact length. Returns the bytes. */
export function fetchExact(url,bytes,{request=https.request}={}){
 return new Promise((resolve,reject)=>{
  const refuse=code=>{reject(Object.assign(Error('RETAINED_ADDITIONS_'+code),{code:'RETAINED_ADDITIONS_'+code}));};
  const req=request(url,{method:'GET',agent:false,rejectUnauthorized:true,minVersion:'TLSv1.2',maxHeaderSize:8192,timeout:60000,
   headers:{accept:'application/octet-stream','accept-encoding':'identity'}},response=>{
    const length=response.headers['content-length'],encoding=response.headers['content-encoding'];
    if(response.statusCode!==200||(encoding!==undefined&&encoding!=='identity')||(length!==undefined&&Number(length)!==bytes)){response.destroy();refuse('FETCH');return;}
    const chunks=[];let count=0;
    response.on('data',chunk=>{count+=chunk.length;if(count>bytes){response.destroy();refuse('SIZE');return;}chunks.push(chunk);});
    response.on('end',()=>{if(count!==bytes)refuse('SIZE');else resolve(Buffer.concat(chunks,count));});
    response.on('error',()=>refuse('FETCH'));
   });
  req.on('timeout',()=>{req.destroy();refuse('TIMEOUT');});req.on('error',()=>refuse('FETCH'));req.end();
 });
}
async function readRetained(file,limit=FILE_LIMIT){const stat=await fs.lstat(file);need(stat.isFile()&&!stat.isSymbolicLink()&&stat.size>0&&stat.size<=limit,'IO');return fs.readFile(file);}
async function present(file){try{await fs.lstat(file);return true;}catch(error){if(error?.code==='ENOENT')return false;throw error;}}
async function writeExclusive(file,bytes){const handle=await fs.open(file,'wx',0o644);try{await handle.writeFile(bytes);}finally{await handle.close();}}

async function loadState(){
 const lockRaw=await readRetained(PATHS.lock,256*1024),lock=parseRuntimePackageLock(lockRaw);
 const index=parseRetainedIndex(await readRetained(path.join(PATHS.apkDirectory,lock.repositoryIndex.file)),lock.repositoryIndex.sha256);
 const wheels=readWheelLock(await fs.readFile(PATHS.wheelLock,'utf8'));
 return {lockRaw,lock,index,wheels};
}
/** Offline: the whole retained snapshot re-identified against the signed index and both locks. */
export async function check(){
 const {lock,index,wheels}=await loadState();const apks=[],retainedWheels=[];
 for(const row of lock.additionalPackages){const bytes=await readRetained(path.join(PATHS.apkDirectory,row.file));const identity=verifyApk(bytes,{name:row.name,version:row.version,bytes:row.bytes},index,{sha256:row.sha256});apks.push({file:row.file,sha256:identity.sha256,controlChecksum:identity.controlChecksum,datahash:identity.datahash,signed:identity.signed});}
 need((await fs.readdir(PATHS.apkDirectory)).sort().join('\0')===[lock.repositoryIndex.file,...lock.additionalPackages.map(r=>r.file)].sort().join('\0'),'DIRECTORY');
 const wheelFiles=await present(PATHS.wheelDirectory)?(await fs.readdir(PATHS.wheelDirectory)).sort():[];
 for(const row of wheels.wheels){if(!wheelFiles.includes(row.file))continue;const bytes=await readRetained(path.join(PATHS.wheelDirectory,row.file));need(bytes.length===row.bytes&&sha256(bytes)===row.sha256,'WHEEL');retainedWheels.push(row.file);}
 need(wheelFiles.every(file=>retainedWheels.includes(file)),'DIRECTORY');
 return {status:'RETAINED_SNAPSHOT_VERIFIED',apks:apks.length,wheelsRetained:retainedWheels.length,wheelsLocked:wheels.wheels.length,pending:await present(PATHS.pending)};
}
/** Network: retain what is still pending, then move its rows into the lock. */
export async function run({fetchImpl=fetchExact}={}){
 const {lock,index,wheels}=await loadState();
 need(await present(PATHS.pending)||wheels.wheels.length>0,'NOTHING_PENDING');
 const pending=await present(PATHS.pending)?readPending(await fs.readFile(PATHS.pending,'utf8')):null;
 if(pending)need(pending.repositoryIndexSha256===lock.repositoryIndex.sha256,'INDEX');
 const locked=new Set(lock.additionalPackages.map(r=>r.name)),added=[],receipt={schemaVersion:1,retainedAtUtc:new Date().toISOString(),repositoryIndexSha256:lock.repositoryIndex.sha256,apks:[],wheels:[]};
 for(const row of pending?.apkPackages??[]){
  need(!locked.has(row.name),'DUPLICATE');const entry=index.get(row.name+'='+row.version);need(entry!==undefined&&entry.C===row.indexControlChecksum&&entry.S===row.bytes,'NOT_INDEXED');
  const file=path.join(PATHS.apkDirectory,row.file);let bytes,retained=false;
  if(await present(file)){bytes=await readRetained(file);retained=true;}else bytes=await fetchImpl(row.url,row.bytes);
  const identity=verifyApk(bytes,row,index);
  if(!retained)await writeExclusive(file,bytes);
  added.push({name:row.name,version:row.version,file:row.file,url:row.url,sha256:identity.sha256,bytes:row.bytes});
  receipt.apks.push({file:row.file,url:row.url,bytes:row.bytes,sha256:identity.sha256,controlChecksum:identity.controlChecksum,datahash:identity.datahash,signed:identity.signed,license:row.license,sourceRecipeCommit:row.sourceRecipeCommit,alreadyRetained:retained});
 }
 await fs.mkdir(PATHS.wheelDirectory,{recursive:true});
 for(const row of wheels.wheels){
  const file=path.join(PATHS.wheelDirectory,row.file);let bytes,retained=false;
  if(await present(file)){bytes=await readRetained(file);retained=true;}else bytes=await fetchImpl(row.url,row.bytes);
  need(bytes.length===row.bytes&&sha256(bytes)===row.sha256,'WHEEL');
  if(!retained)await writeExclusive(file,bytes);
  receipt.wheels.push({file:row.file,url:row.url,bytes:row.bytes,sha256:row.sha256,license:row.license,alreadyRetained:retained});
 }
 if(added.length){
  const rows=[...lock.additionalPackages.map(r=>({name:r.name,version:r.version,file:r.file,url:r.url,sha256:r.sha256,bytes:r.bytes})),...added].sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0);
  const nextRaw=Buffer.from(JSON.stringify({...lock,additionalPackages:rows},null,2)+'\n');
  parseRuntimePackageLock(nextRaw);
  const staged=await fs.mkdtemp(path.join(here,'.staging-'));
  try{await fetchRuntimePackages(nextRaw,path.join(staged,'repo'),{fetchImpl:retainedFetch(PATHS.apkDirectory)});}finally{await fs.rm(staged,{recursive:true,force:true});}
  await fs.writeFile(PATHS.lock,nextRaw);
  await fs.unlink(PATHS.pending);
 }
 receipt.lockSha256=sha256(await fs.readFile(PATHS.lock));
 await fs.writeFile(PATHS.receipt,JSON.stringify(receipt,null,2)+'\n');
 return {status:'RETAINED_ADDITIONS_COMPLETE',apksAdded:added.length,wheels:receipt.wheels.length,lockSha256:receipt.lockSha256};
}
async function main(args){
 if(args.length===1&&['--help','-h'].includes(args[0])){console.log('Usage: complete-pending-additions.mjs check | run\nExit: 0 verified/complete/help; 2 refusal (no partial retained file). `check` is offline; `run` downloads only the exact pending URLs.');return 0;}
 try{need(args.length===1&&['check','run'].includes(args[0]),'USAGE');console.log(JSON.stringify(args[0]==='check'?await check():await run()));return 0;}
 catch(error){const code=typeof error?.code==='string'&&error.code.startsWith('RETAINED_ADDITIONS_')?error.code:'RETAINED_ADDITIONS_IO';console.error(code);return 2;}
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)main(process.argv.slice(2)).then(code=>{process.exitCode=code;});
