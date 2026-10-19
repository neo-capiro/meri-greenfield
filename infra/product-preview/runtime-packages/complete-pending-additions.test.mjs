/** Offline controls for the retained executor inputs: real snapshot identity against the signed index, closed record shapes,
 * tamper refusal and the inert CLI. No network: `run` is exercised only with an injected fetch over fixture bytes. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {gzipSync} from 'node:zlib';
import {PATHS,gzipMembers,inspectApk,parseRetainedIndex,verifyApk,readPending,readWheelLock,fetchExact,check} from './complete-pending-additions.mjs';
import {parseRuntimePackageLock} from '../../../apps/runtime/build/runtime-packages.mjs';

const script=fileURLToPath(new URL('./complete-pending-additions.mjs',import.meta.url));
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
async function state(){const lock=parseRuntimePackageLock(await fs.readFile(PATHS.lock));return {lock,index:parseRetainedIndex(await fs.readFile(path.join(PATHS.apkDirectory,lock.repositoryIndex.file)),lock.repositoryIndex.sha256)};}
/** A synthetic unsigned APK: control member (.PKGINFO) + data member, like Wolfi's unsigned package files. */
function syntheticApk({name='synthetic',version='1-r0',datahash}={}){
 const tar=entries=>Buffer.concat([...entries.map(([entryName,content])=>{const header=Buffer.alloc(512);header.write(entryName,0,'utf8');header.write(content.length.toString(8).padStart(11,'0')+'\0',124,'ascii');header.write('ustar\0',257,'ascii');return Buffer.concat([header,content,Buffer.alloc((512-content.length%512)%512)]);}),Buffer.alloc(1024)]);
 const data=gzipSync(tar([['usr/share/synthetic',Buffer.from('payload')]]));
 const control=gzipSync(tar([['.PKGINFO',Buffer.from(`pkgname = ${name}\npkgver = ${version}\ndatahash = ${datahash??sha256(data)}\n`)]]));
 return {bytes:Buffer.concat([control,data]),control,data};
}

test('every retained APK re-identifies against the signed index: control checksum, .PKGINFO name/version/datahash, size, lock sha256',async()=>{
 const {lock,index}=await state();assert.ok(lock.additionalPackages.length>=15);
 for(const row of lock.additionalPackages){
  const bytes=await fs.readFile(path.join(PATHS.apkDirectory,row.file)),identity=verifyApk(bytes,{name:row.name,version:row.version,bytes:row.bytes},index,{sha256:row.sha256});
  assert.equal(identity.controlChecksum,index.get(row.name+'='+row.version).C);assert.equal(identity.signed,false);assert.equal(identity.datahash,identity.dataSha256);
 }
 const result=await check();assert.equal(result.status,'RETAINED_SNAPSHOT_VERIFIED');assert.equal(result.apks,lock.additionalPackages.length);
});

test('the pending record (while present) names only indexed packages absent from the lock, with index-derived sizes and checksums',async t=>{
 let text;try{text=await fs.readFile(PATHS.pending,'utf8');}catch(error){if(error.code!=='ENOENT')throw error;t.skip('no pending-additions.json: every executor addition is retained');return;}
 const {lock,index}=await state(),pending=readPending(text),locked=new Set(lock.additionalPackages.map(r=>r.name));
 assert.equal(pending.repositoryIndexSha256,lock.repositoryIndex.sha256);
 for(const row of pending.apkPackages){const entry=index.get(row.name+'='+row.version);assert.ok(entry,row.name);assert.equal(entry.C,row.indexControlChecksum);assert.equal(entry.S,row.bytes);assert.equal(entry.c,row.sourceRecipeCommit);assert.ok(!locked.has(row.name),row.name+' already locked');}
});

test('the wheel lock is closed, hash-pinned to the qualification requirements and retained wheels (if any) match it',async()=>{
 const wheels=readWheelLock(await fs.readFile(PATHS.wheelLock,'utf8')),requirements=await fs.readFile(new URL('../../../apps/worker/qualification/requirements.lock.txt',import.meta.url),'utf8');
 assert.deepEqual(wheels.wheels.map(w=>w.importName).sort(),['docx','et_xmlfile','openpyxl','xlsxwriter']);
 for(const row of wheels.wheels){assert.ok(requirements.includes(`${row.name}==${row.version} --hash=sha256:${row.sha256}`),row.name);
  let bytes;try{bytes=await fs.readFile(path.join(PATHS.wheelDirectory,row.file));}catch(error){if(error.code!=='ENOENT')throw error;continue;}
  assert.equal(bytes.length,row.bytes);assert.equal(sha256(bytes),row.sha256);}
});

test('synthetic APK identity, tampered control/data/size/name refusals and closed record shapes',async()=>{
 const {bytes,control,data}=syntheticApk(),identity=inspectApk(bytes);
 assert.equal(identity.pkgname,'synthetic');assert.equal(identity.pkgver,'1-r0');assert.equal(identity.datahash,identity.dataSha256);assert.equal(gzipMembers(bytes).length,2);
 const index=new Map([['synthetic=1-r0',{C:identity.controlChecksum,S:bytes.length}]]),row={name:'synthetic',version:'1-r0',bytes:bytes.length};
 assert.equal(verifyApk(bytes,row,index,{sha256:sha256(bytes)}).sha256,sha256(bytes));
 assert.throws(()=>verifyApk(bytes,row,index,{sha256:'0'.repeat(64)}),/RETAINED_ADDITIONS_SHA256/u);
 assert.throws(()=>verifyApk(Buffer.concat([control,gzipSync(Buffer.from('other'))]),row,index),/RETAINED_ADDITIONS_(SIZE|IDENTITY)/u);
 assert.throws(()=>verifyApk(syntheticApk({datahash:'1'.repeat(64)}).bytes,row,index),/RETAINED_ADDITIONS_(SIZE|IDENTITY)/u);
 assert.throws(()=>verifyApk(bytes,{...row,version:'2-r0'},index),/RETAINED_ADDITIONS_NOT_INDEXED/u);
 assert.throws(()=>verifyApk(bytes,{...row,bytes:row.bytes+1},index),/RETAINED_ADDITIONS_SIZE/u);
 assert.throws(()=>inspectApk(data),/RETAINED_ADDITIONS_APK_LAYOUT/u);
 const pending={schemaVersion:1,status:'PENDING_PUBLIC_DOWNLOAD',lock:'infra/product-preview/runtime-packages.lock.json',repositoryIndexSha256:'a'.repeat(64),note:'',apkPackages:[{name:'bash',version:'5.3-r14',file:'bash-5.3-r14.apk',url:'https://packages.wolfi.dev/os/x86_64/bash-5.3-r14.apk',bytes:1,license:'x',indexControlChecksum:'Q1x',sourceRecipeCommit:'c'}]};
 assert.equal(readPending(JSON.stringify(pending)).apkPackages.length,1);
 for(const mutate of [p=>{p.extra=1;},p=>{p.apkPackages[0].url='https://example.com/bash-5.3-r14.apk';},p=>{p.apkPackages[0].file='../bash.apk';},p=>{p.apkPackages.push({...p.apkPackages[0]});},p=>{p.apkPackages[0].sha256='0'.repeat(64);}]){
  const copy=structuredClone(pending);mutate(copy);assert.throws(()=>readPending(JSON.stringify(copy)),/RETAINED_ADDITIONS_(SHAPE|DUPLICATE)/u);}
 const wheels=JSON.parse(await fs.readFile(PATHS.wheelLock,'utf8'));
 for(const mutate of [w=>{w.sitePackages='/opt/site';},w=>{w.wheels[0].url='https://files.pythonhosted.org/packages/evil.whl';},w=>{w.wheels[0].url=w.wheels[0].url.replace('files.pythonhosted.org','example.com');},w=>{w.wheels[0].sha256='x';},w=>{w.wheels.push({...w.wheels[0]});}]){
  const copy=structuredClone(wheels);mutate(copy);assert.throws(()=>readWheelLock(JSON.stringify(copy)),/RETAINED_ADDITIONS_(SHAPE|DUPLICATE)/u);}
});

test('exact fetch refuses redirects, wrong length, encoded bodies and over-long bodies without following anything',async()=>{
 const {EventEmitter}=await import('node:events');
 const request=(statusCode,headers,chunks)=>(url,options,callback)=>{assert.equal(options.rejectUnauthorized,true);assert.equal(options.agent,false);const req=new EventEmitter();req.end=()=>queueMicrotask(()=>{const res=new EventEmitter();res.statusCode=statusCode;res.headers=headers;res.destroy=()=>{};callback(res);queueMicrotask(()=>{for(const c of chunks)res.emit('data',c);res.emit('end');});});req.destroy=()=>{};return req;};
 const payload=Buffer.from('exact-bytes');
 assert.deepEqual(await fetchExact('https://packages.wolfi.dev/os/x86_64/x.apk',payload.length,{request:request(200,{'content-length':String(payload.length)},[payload])}),payload);
 await assert.rejects(fetchExact('https://packages.wolfi.dev/os/x86_64/x.apk',payload.length,{request:request(302,{location:'https://example.com/private'},[])}),/RETAINED_ADDITIONS_FETCH/u);
 await assert.rejects(fetchExact('https://packages.wolfi.dev/os/x86_64/x.apk',payload.length,{request:request(200,{'content-length':'3'},[payload])}),/RETAINED_ADDITIONS_FETCH/u);
 await assert.rejects(fetchExact('https://packages.wolfi.dev/os/x86_64/x.apk',payload.length,{request:request(200,{'content-encoding':'gzip'},[payload])}),/RETAINED_ADDITIONS_FETCH/u);
 await assert.rejects(fetchExact('https://packages.wolfi.dev/os/x86_64/x.apk',payload.length-1,{request:request(200,{},[payload])}),/RETAINED_ADDITIONS_SIZE/u);
 await assert.rejects(fetchExact('https://packages.wolfi.dev/os/x86_64/x.apk',payload.length+1,{request:request(200,{},[payload])}),/RETAINED_ADDITIONS_SIZE/u);
});

test('CLI: help and check are inert; unknown or extra arguments refuse with a static code',()=>{
 const run=args=>spawnSync(process.execPath,[script,...args],{encoding:'utf8',timeout:60000});
 assert.equal(run(['--help']).status,0);
 const checked=run(['check']);assert.equal(checked.status,0,checked.stderr);assert.equal(JSON.parse(checked.stdout).status,'RETAINED_SNAPSHOT_VERIFIED');
 for(const args of [[],['run','private'],['download']]){const result=run(args);assert.equal(result.status,2);assert.match(result.stderr,/^RETAINED_ADDITIONS_[A-Z_]+\r?\n$/u);assert.ok(!result.stderr.includes('private'));}
});
