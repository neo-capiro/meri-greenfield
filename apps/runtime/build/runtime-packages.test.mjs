import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import https from 'node:https';
import {Readable} from 'node:stream';
import {EventEmitter} from 'node:events';
import {parseRuntimePackageLock,fetchRuntimePackages,verifyInstalledPackages,retainedFetch} from './runtime-packages.mjs';

const helper=fileURLToPath(new URL('./runtime-packages.mjs',import.meta.url));
const origin='https://packages.wolfi.dev/os/x86_64/';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const bytes=value=>Buffer.from(JSON.stringify(value)+'\n');
const runtime=()=>({platform:'linux',architecture:'x64',nodeVersion:'v24.21.0',glibcVersion:'2.44'});
function fixture(){
 const payloads=new Map([['APKINDEX.tar.gz',Buffer.from('signed-index-fixture')],['bash-5.3-r14.apk',Buffer.from('bash-apk-fixture')],['libstdc++-16.2.0-r1.apk',Buffer.from('libstdc++-apk-fixture')]]);
 const pin=file=>({file,url:origin+file,sha256:sha(payloads.get(file)),bytes:payloads.get(file).length});
 const lock={schemaVersion:1,platform:'linux/amd64',runtimeImageUri:'cgr.dev/chainguard/wolfi-base@sha256:'+'a'.repeat(64),nodeVersion:'v24.21.0',glibcVersion:'2.44',
  basePackages:[{name:'apk-tools',version:'3.0.2-r1'},{name:'glibc',version:'2.44-r4'}],
  additionalPackages:[{name:'bash',version:'5.3-r14',...pin('bash-5.3-r14.apk')},{name:'libstdc++',version:'16.2.0-r1',...pin('libstdc++-16.2.0-r1.apk')}],
  repositoryIndex:{...pin('APKINDEX.tar.gz'),signingKeySha256:'b'.repeat(64)},requiredPaths:['/bin/sh','/lib/libc.so.6','/usr/local/bin/node']};
 return {lock,payloads,raw:bytes(lock)};
}
async function temporary(t){
 const root=await fs.mkdtemp(path.join(tmpdir(),'meri-runtime-pkgs-'));
 t.after(async()=>{assert.equal(path.dirname(path.resolve(root)),path.resolve(tmpdir()));assert.ok(path.basename(root).startsWith('meri-runtime-pkgs-'));await fs.rm(root,{recursive:true,force:true});});return root;
}
const absent=async p=>{await assert.rejects(fs.lstat(p),{code:'ENOENT'});};
function reply(payload,{status=200,headers={}}={}){return new Response(payload,{status,headers:{'content-length':String(payload.length),...headers}});}
function getter(f,calls=[]){return async(url,options)=>{calls.push({url,options});const file=url.slice(origin.length);assert.ok(f.payloads.has(file));return reply(f.payloads.get(file));};}
function quickTimers(){return {setTimer:(fn,ms)=>setTimeout(fn,Math.min(ms,5)),clearTimer:clearTimeout};}
async function installedFixture(t,f=fixture()){
 const root=await temporary(t),rows=[...f.lock.basePackages,...f.lock.additionalPackages].map(({name,version})=>({name,version}));
 const database=path.join(root,'usr/lib/apk/db/installed');await fs.mkdir(path.dirname(database),{recursive:true});
 const db=items=>items.map(row=>'P:'+row.name+'\nV:'+row.version+'\nA:x86_64\nF:usr/lib\n').join('\n');await fs.writeFile(database,db([...rows].reverse()));
 for(const name of f.lock.requiredPaths){const file=path.join(root,...name.slice(1).split('/'));await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,'fixture-required-file');}
 return {root,database,rows,db,f};
}

test('strict Buffer/string lock parser is inert and preserves frozen complete identities',()=>{
 const f=fixture(),lock=parseRuntimePackageLock(f.raw);assert.deepEqual(lock,JSON.parse(f.raw));assert.deepEqual(parseRuntimePackageLock(f.raw.toString()),lock);
 assert.ok(Object.isFrozen(lock)&&Object.isFrozen(lock.basePackages)&&Object.isFrozen(lock.repositoryIndex)&&Object.isFrozen(lock.requiredPaths));
 assert.throws(()=>{lock.additionalPackages[0].bytes=1;},TypeError);
});

test('lock refuses malformed UTF8, duplicate/escaped keys, excess nesting and closed-shape changes',()=>{
 const f=fixture();for(const raw of [Buffer.from([0xff]),Buffer.from('{'),Buffer.from('{"schemaVersion":1,"schemaVersion":1}'),
  Buffer.from('{"schemaVersion":1,"schema\\u0056ersion":1}'),Buffer.from('{"x":[[[[[[[]]]]]]]}'),Buffer.alloc(256*1024+1),Buffer.from('\ufeff'+f.raw)])assert.throws(()=>parseRuntimePackageLock(raw),/^Error: RUNTIME_PACKAGES_LOCK$/u);
 const mutations=[x=>{x.extra='private';},x=>{delete x.repositoryIndex;},x=>{x.platform='linux/arm64';},x=>{x.runtimeImageUri='cgr.dev/chainguard/wolfi-base:latest';},x=>{x.nodeVersion='v22.0.0';},
  x=>{x.basePackages.reverse();},x=>{x.basePackages.push(x.basePackages[0]);},x=>{x.additionalPackages[0].name='glibc';},x=>{x.requiredPaths=['/bin/../etc/passwd'];},x=>{x.requiredPaths=['/bin/sh','/bin/sh'];},
  x=>{x.repositoryIndex.signingKeySha256='';},x=>{x.repositoryIndex.extra=true;},x=>{x.additionalPackages[0].sha256=[x.additionalPackages[0].sha256];}];
 for(const mutate of mutations){const lock=structuredClone(f.lock);mutate(lock);assert.throws(()=>parseRuntimePackageLock(bytes(lock)),/^Error: RUNTIME_PACKAGES_LOCK$/u);}
});

test('lock permits only exact public APK/index URLs and strict per-file/combined byte bounds',()=>{
 for(const mutate of [x=>{x.additionalPackages[0].url='http://packages.wolfi.dev/os/x86_64/bash-5.3-r14.apk';},x=>{x.additionalPackages[0].url+='?token=private';},
  x=>{x.additionalPackages[0].url=x.additionalPackages[0].url.replace('https://','https://private@');},x=>{x.additionalPackages[0].file='../bash.apk';},
  x=>{x.repositoryIndex.url=x.repositoryIndex.url.replace('packages.wolfi.dev','foreign.example');},x=>{x.repositoryIndex.bytes=16*1024*1024+1;},x=>{x.repositoryIndex.bytes=0;},
  x=>{x.additionalPackages=Array.from({length:5},(_,i)=>({name:'package'+i,version:'1-r0',file:'package'+i+'-1-r0.apk',url:origin+'package'+i+'-1-r0.apk',sha256:'c'.repeat(64),bytes:16*1024*1024}));}]){
  const f=fixture();mutate(f.lock);assert.throws(()=>parseRuntimePackageLock(bytes(f.lock)),/^Error: RUNTIME_PACKAGES_LOCK$/u);
 }
});

test('fetch verifies index and APK bytes into only the new x86_64 directory without credential/redirect options',async t=>{
 const root=await temporary(t),f=fixture(),directory=path.join(root,'new'),calls=[];
 const receipt=await fetchRuntimePackages(f.raw,directory,{fetchImpl:getter(f,calls)});
 assert.deepEqual(receipt,{runtimePackagesSha256:sha(f.raw),files:3,bytes:[...f.payloads.values()].reduce((n,p)=>n+p.length,0)});
 assert.deepEqual((await fs.readdir(path.join(directory,'x86_64'))).sort(),[...f.payloads.keys()].sort());
 for(const [file,payload]of f.payloads)assert.deepEqual(await fs.readFile(path.join(directory,'x86_64',file)),payload);
 for(const call of calls){assert.equal(call.options.credentials,'omit');assert.equal(call.options.redirect,'error');assert.equal(call.options.method,'GET');assert.ok(call.options.signal instanceof AbortSignal);assert.deepEqual(call.options.headers,{'accept-encoding':'identity'});}
});

test('existing or malformed destinations/locks make no fetch and preserve unrelated files',async t=>{
 const root=await temporary(t),f=fixture(),directory=path.join(root,'existing');await fs.mkdir(directory);await fs.writeFile(path.join(directory,'keep'),'unrelated');let calls=0;
 await assert.rejects(fetchRuntimePackages(f.raw,directory,{fetchImpl:()=>{calls++;}}),/^Error: RUNTIME_PACKAGES_IO$/u);
 assert.equal(await fs.readFile(path.join(directory,'keep'),'utf8'),'unrelated');
 await assert.rejects(fetchRuntimePackages(Buffer.from('{}'),path.join(root,'invalid'),{fetchImpl:()=>{calls++;}}),/^Error: RUNTIME_PACKAGES_LOCK$/u);
 assert.equal(calls,0);await absent(path.join(root,'invalid'));
});

test('hash, length, encoding and HTTP/redirect failures remove only generated files',async t=>{
 const root=await temporary(t),f=fixture();let index=0;
 const variants=[()=>reply(Buffer.from('tampered')),()=>reply(Buffer.from('x'.repeat(f.lock.repositoryIndex.bytes+1))),()=>reply(f.payloads.get('APKINDEX.tar.gz'),{headers:{'content-encoding':'gzip'}}),
  ()=>reply(f.payloads.get('APKINDEX.tar.gz'),{headers:{'content-length':'invalid'}}),()=>reply(Buffer.from('private-server-error'),{status:403}),()=>reply(Buffer.from('private-location'),{status:302}),
  ()=>{const r=reply(f.payloads.get('APKINDEX.tar.gz'));Object.defineProperty(r,'redirected',{value:true});return r;},()=>{const r=reply(f.payloads.get('APKINDEX.tar.gz'));Object.defineProperty(r,'url',{value:'https://foreign.example/'});return r;}];
 for(const make of variants){const directory=path.join(root,'failure'+index++);await assert.rejects(fetchRuntimePackages(f.raw,directory,{fetchImpl:make}),error=>/^RUNTIME_PACKAGES_(INTEGRITY|FETCH)$/u.test(error.message));await absent(directory);}
});

test('a later package mismatch cleans earlier verified generated files and never exposes remote errors',async t=>{
 const root=await temporary(t),f=fixture(),directory=path.join(root,'new');let calls=0;
 await assert.rejects(fetchRuntimePackages(f.raw,directory,{fetchImpl:async(url)=>{calls++;return url.endsWith('.apk')?reply(Buffer.from('altered-package')):reply(f.payloads.get('APKINDEX.tar.gz'));}}),/^Error: RUNTIME_PACKAGES_INTEGRITY$/u);
 assert.equal(calls,2);await absent(directory);
 const raw=Object.assign(Error('private bearer must never escape'),{code:'RUNTIME_PACKAGES_FETCH'});
 await assert.rejects(fetchRuntimePackages(f.raw,directory,{fetchImpl:()=>{throw raw;}}),error=>error!==raw&&error.message==='RUNTIME_PACKAGES_FETCH');await absent(directory);
});

test('per-request and total deadlines reject late responses and cancel their owned bodies',async t=>{
 const root=await temporary(t),f=fixture();let clock=0,cancelled=0;
 const body=new ReadableStream({cancel(){cancelled++;}});
 await assert.rejects(fetchRuntimePackages(f.raw,path.join(root,'late'),{now:()=>clock,fetchImpl:()=>{clock=30001;return new Response(body);}}),/^Error: RUNTIME_PACKAGES_TIMEOUT$/u);
 assert.equal(cancelled,1);await absent(path.join(root,'late'));
 const many=fixture();many.lock.additionalPackages=Array.from({length:7},(_,i)=>{const name='package'+i,file=name+'-1-r0.apk',payload=Buffer.from(name);many.payloads.set(file,payload);return {name,version:'1-r0',file,url:origin+file,sha256:sha(payload),bytes:payload.length};});
 clock=0;let calls=0;
 await assert.rejects(fetchRuntimePackages(bytes(many.lock),path.join(root,'total'),{now:()=>clock,fetchImpl:url=>{calls++;clock+=29900;return reply(many.payloads.get(url.slice(origin.length)));}}),/^Error: RUNTIME_PACKAGES_TIMEOUT$/u);
 assert.equal(calls,7);assert.equal(clock,209300);await absent(path.join(root,'total'));
});

test('unsettled fetch refuses as cleanup unknown; a late response is cancelled without writing',async t=>{
 const root=await temporary(t),f=fixture(),directory=path.join(root,'hung');let release,cancelled=0;
 await assert.rejects(fetchRuntimePackages(f.raw,directory,{...quickTimers(),fetchImpl:()=>new Promise(resolve=>{release=resolve;})}),/^Error: RUNTIME_PACKAGES_CLEANUP_UNKNOWN$/u);
 await absent(directory);release(new Response(new ReadableStream({cancel(){cancelled++;}})));await new Promise(resolve=>setTimeout(resolve,5));assert.equal(cancelled,1);await absent(directory);
});

test('hung body cancellation remains cleanup unknown and never admits a partial package',async t=>{
 const root=await temporary(t),f=fixture(),directory=path.join(root,'hung-body');
 const body=new ReadableStream({pull(){return new Promise(()=>{});},cancel(){return new Promise(()=>{});}});
 await assert.rejects(fetchRuntimePackages(f.raw,directory,{...quickTimers(),fetchImpl:()=>new Response(body)}),/^Error: RUNTIME_PACKAGES_CLEANUP_UNKNOWN$/u);await absent(directory);
});

test('foreign files cause cleanup unknown and are preserved',async t=>{
 const root=await temporary(t),f=fixture(),directory=path.join(root,'interference');
 await assert.rejects(fetchRuntimePackages(f.raw,directory,{fetchImpl:async()=>{await fs.writeFile(path.join(directory,'x86_64/foreign'),'unrelated');return reply(Buffer.from('wrong'));}}),/^Error: RUNTIME_PACKAGES_CLEANUP_UNKNOWN$/u);
 assert.equal(await fs.readFile(path.join(directory,'x86_64/foreign'),'utf8'),'unrelated');
});

test('concurrently occupied package files are preserved, never overwritten or deleted',async t=>{
 const root=await temporary(t),f=fixture(),directory=path.join(root,'collision'),file=path.join(directory,'x86_64/APKINDEX.tar.gz');
 await assert.rejects(fetchRuntimePackages(f.raw,directory,{fetchImpl:async()=>{await fs.writeFile(file,'foreign-owner');return reply(f.payloads.get('APKINDEX.tar.gz'));}}),/^Error: RUNTIME_PACKAGES_CLEANUP_UNKNOWN$/u);
 assert.equal(await fs.readFile(file,'utf8'),'foreign-owner');
});

test('invalid destination parents and dependency failures remain static before resource ownership',async t=>{
 const root=await temporary(t),f=fixture();let called=0;
 await assert.rejects(fetchRuntimePackages(f.raw,path.join(root,'private-missing-parent/new'),{fetchImpl:()=>{called++;}}),error=>error.message==='RUNTIME_PACKAGES_IO'&&!error.message.includes('private'));
 await assert.rejects(fetchRuntimePackages(f.raw,path.join(root,'new'),{fetchImpl:()=>{called++;},now:()=>{throw Error('private-clock');}}),/^Error: RUNTIME_PACKAGES_IO$/u);
 await assert.rejects(fetchRuntimePackages(f.raw,path.join(root,'new'),{arbitrary:'private'}),/^Error: RUNTIME_PACKAGES_FETCH$/u);
 assert.equal(called,0);await absent(path.join(root,'new'));
});

test('default public transport fixes TLS validation, headers and no redirect without contacting a network',async t=>{
 const root=await temporary(t),f=fixture(),seen=[];
 t.mock.method(https,'request',(url,options,callback)=>{seen.push({url,options});const req=new EventEmitter();req.end=()=>queueMicrotask(()=>{const payload=f.payloads.get(String(url).slice(origin.length)),res=Readable.from([payload]);res.statusCode=200;res.headers={'content-length':String(payload.length)};callback(res);});return req;});
 await fetchRuntimePackages(f.raw,path.join(root,'tls'));assert.equal(seen.length,3);
 for(const {url,options}of seen){assert.ok(String(url).startsWith(origin));assert.equal(options.rejectUnauthorized,true);assert.equal(options.minVersion,'TLSv1.2');assert.equal(options.agent,false);assert.deepEqual(options.headers,{accept:'application/octet-stream','accept-encoding':'identity'});assert.equal(options.maxHeaderSize,8192);}
});

test('installed verification joins every base/addition name and version with exact lock-byte and sorted set hashes',async t=>{
 const f=fixture(),x=await installedFixture(t,f),result=await verifyInstalledPackages(f.raw,{rootDirectory:x.root,measureRuntime:runtime});
 const sorted=[...x.rows].sort((a,b)=>a.name<b.name?-1:1);
 assert.deepEqual(result,{schemaVersion:1,status:'RUNTIME_PACKAGES_VERIFIED',runtimeBaseImageUri:f.lock.runtimeImageUri,runtimePackagesSha256:sha(f.raw),installedPackageSetSha256:sha(Buffer.from(JSON.stringify(sorted)+'\n')),nodeVersion:'v24.21.0',glibcVersion:'2.44'});
 assert.deepEqual(Object.keys(result),['schemaVersion','status','runtimeBaseImageUri','runtimePackagesSha256','installedPackageSetSha256','nodeVersion','glibcVersion']);
 const reformatted=Buffer.from(JSON.stringify(f.lock,null,2));assert.notEqual((await verifyInstalledPackages(reformatted,{rootDirectory:x.root,measureRuntime:runtime})).runtimePackagesSha256,result.runtimePackagesSha256);
});

test('missing, extra, duplicate, wrong-version and malformed installed identities cannot verify',async t=>{
 const x=await installedFixture(t);const variants=[x.rows.slice(1),[...x.rows,{name:'foreign',version:'1-r0'}],[...x.rows,x.rows[0]],x.rows.map((r,i)=>i===0?{...r,version:'0-r0'}:r)];
 for(const rows of variants){await fs.writeFile(x.database,x.db(rows));await assert.rejects(verifyInstalledPackages(x.f.raw,{rootDirectory:x.root,measureRuntime:runtime}),/^Error: RUNTIME_PACKAGES_VERIFY$/u);}
 for(const text of ['P:glibc\nV:2.44-r4\nV:2.44-r4\n','private-only-data','P:glibc\nV:2.44-r4\0\n','P:glibc\nV:2.44-r4\r\n']){await fs.writeFile(x.database,text);await assert.rejects(verifyInstalledPackages(x.f.raw,{rootDirectory:x.root,measureRuntime:runtime}),/^Error: RUNTIME_PACKAGES_VERIFY$/u);}
});

test('one physical database may have symlink aliases; distinct databases and escaped targets refuse',async t=>{
 const x=await installedFixture(t),alias=path.join(x.root,'lib/apk/db');await fs.mkdir(path.dirname(alias),{recursive:true});await fs.symlink(path.dirname(x.database),alias,process.platform==='win32'?'junction':'dir');
 assert.equal((await verifyInstalledPackages(x.f.raw,{rootDirectory:x.root,measureRuntime:runtime})).status,'RUNTIME_PACKAGES_VERIFIED');
 const second=path.join(x.root,'var/lib/apk/db/installed');await fs.mkdir(path.dirname(second),{recursive:true});await fs.writeFile(second,x.db(x.rows));await assert.rejects(verifyInstalledPackages(x.f.raw,{rootDirectory:x.root,measureRuntime:runtime}),/^Error: RUNTIME_PACKAGES_VERIFY$/u);await fs.unlink(second);
 const outside=await temporary(t);await fs.writeFile(path.join(outside,'installed'),x.db(x.rows));await fs.unlink(alias);await fs.symlink(outside,alias,process.platform==='win32'?'junction':'dir');
 await assert.rejects(verifyInstalledPackages(x.f.raw,{rootDirectory:x.root,measureRuntime:runtime}),/^Error: RUNTIME_PACKAGES_VERIFY$/u);await fs.unlink(alias);
});

test('oversized database refuses before read and bounded required-file probes accept large regular files',async t=>{
 const x=await installedFixture(t);await fs.truncate(path.join(x.root,'usr/local/bin/node'),32*1024*1024);
 assert.equal((await verifyInstalledPackages(x.f.raw,{rootDirectory:x.root,measureRuntime:runtime})).status,'RUNTIME_PACKAGES_VERIFIED');
 await fs.truncate(x.database,8*1024*1024+1);await assert.rejects(verifyInstalledPackages(x.f.raw,{rootDirectory:x.root,measureRuntime:runtime}),/^Error: RUNTIME_PACKAGES_VERIFY$/u);
});

test('measured Node/glibc/platform mismatches and missing or escaped required paths refuse',async t=>{
 const x=await installedFixture(t);
 for(const delta of [{nodeVersion:'v24.19.0'},{glibcVersion:'2.43'},{platform:'win32'},{architecture:'arm64'}])await assert.rejects(verifyInstalledPackages(x.f.raw,{rootDirectory:x.root,measureRuntime:()=>({...runtime(),...delta})}),/^Error: RUNTIME_PACKAGES_VERIFY$/u);
 await fs.unlink(path.join(x.root,'bin/sh'));await assert.rejects(verifyInstalledPackages(x.f.raw,{rootDirectory:x.root,measureRuntime:runtime}),/^Error: RUNTIME_PACKAGES_VERIFY$/u);
});

test('import/help and invalid CLI are inert, bounded and redact private input',async t=>{
 const root=await temporary(t);
 const imported=spawnSync(process.execPath,['--input-type=module','-e',`import https from 'node:https';https.request=()=>{throw Error('network must not run')};await import(${JSON.stringify(new URL('./runtime-packages.mjs',import.meta.url).href)});`],{encoding:'utf8',timeout:10000});assert.equal(imported.status,0);assert.equal(imported.stdout+imported.stderr,'');
 const help=spawnSync(process.execPath,[helper,'--help'],{encoding:'utf8',timeout:10000});assert.equal(help.status,0);assert.match(help.stdout,/Exit: 0 success\/help; 2/u);
 for(const args of [[],['unknown','private-secret'],['fetch','--lock',path.join(root,'private-missing'),'--directory',path.join(root,'new')]]){
  const result=spawnSync(process.execPath,[helper,...args],{encoding:'utf8',timeout:10000});assert.equal(result.status,2);assert.equal(result.stdout,'');assert.match(result.stderr,/^RUNTIME_PACKAGES_[A-Z_]+\r?\n$/u);assert.ok(!result.stderr.includes('private'));await absent(path.join(root,'new'));
 }
});

test('retained snapshot stages the real lock offline through the same exact integrity path',async t=>{
 const repo=fileURLToPath(new URL('../../../',import.meta.url)),lockFile=path.join(repo,'infra/product-preview/runtime-packages.lock.json'),retained=path.join(repo,'infra/product-preview/runtime-packages/x86_64');
 const root=await temporary(t),out=path.join(root,'staged');
 const run=spawnSync(process.execPath,['--input-type=module','-e',`import https from 'node:https';https.request=()=>{throw Error('network must not run')};globalThis.fetch=()=>{throw Error('network must not run')};process.argv=[process.execPath,${JSON.stringify(helper)},'fetch','--lock',${JSON.stringify(lockFile)},'--directory',${JSON.stringify(out)},'--from',${JSON.stringify(retained)}];await import(${JSON.stringify(new URL('./runtime-packages.mjs',import.meta.url).href)});`],{encoding:'utf8',timeout:30000});
 assert.equal(run.status,0,run.stderr);
 const lock=parseRuntimePackageLock(await fs.readFile(lockFile));
 for(const item of [lock.repositoryIndex,...lock.additionalPackages]){const staged=await fs.readFile(path.join(out,'x86_64',item.file));assert.equal(staged.length,item.bytes);assert.equal(sha(staged),item.sha256);}
 assert.deepEqual((await fs.readdir(path.join(out,'x86_64'))).sort(),[lock.repositoryIndex.file,...lock.additionalPackages.map(row=>row.file)].sort());
});

test('retained snapshot refuses tampered or missing bytes and non-origin or path-like URLs, leaving nothing behind',async t=>{
 const f=fixture(),root=await temporary(t),retained=path.join(root,'retained');await fs.mkdir(retained);
 for(const [file,payload] of f.payloads)await fs.writeFile(path.join(retained,file),payload);
 const ok=path.join(root,'ok');await fetchRuntimePackages(f.raw,ok,{fetchImpl:retainedFetch(retained)});
 for(const [file,payload] of f.payloads)assert.deepEqual(await fs.readFile(path.join(ok,'x86_64',file)),payload);
 await fs.writeFile(path.join(retained,'bash-5.3-r14.apk'),'bash-apk-fixturX');
 const bad=path.join(root,'bad');await assert.rejects(fetchRuntimePackages(f.raw,bad,{fetchImpl:retainedFetch(retained)}),/RUNTIME_PACKAGES_INTEGRITY/u);await absent(bad);
 await fs.rm(path.join(retained,'bash-5.3-r14.apk'));
 const missing=path.join(root,'missing');await assert.rejects(fetchRuntimePackages(f.raw,missing,{fetchImpl:retainedFetch(retained)}),/RUNTIME_PACKAGES_/u);await absent(missing);
 const serve=retainedFetch(retained);
 for(const url of ['https://example.com/x86_64/APKINDEX.tar.gz',origin+'../retained/APKINDEX.tar.gz',origin+'sub/APKINDEX.tar.gz',origin,origin+'.hidden'])await assert.rejects(serve(url),/RUNTIME_PACKAGES_FETCH/u);
 assert.throws(()=>retainedFetch(''),/RUNTIME_PACKAGES_FETCH/u);
});
