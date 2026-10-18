/** Build-only, inert lock/download/package-database checks. No package installation or service startup. */
import * as fs from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash} from 'node:crypto';
import https from 'node:https';
import {Readable} from 'node:stream';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

// TOTAL_LIMIT covers the signed index plus the document-generation executor closure (CPython, Pillow, lxml, matplotlib/numpy/openblas; ~83 MiB).
const LOCK_LIMIT=256*1024, FILE_LIMIT=16*1024*1024, TOTAL_LIMIT=128*1024*1024, DB_LIMIT=8*1024*1024;
const ORIGIN='https://packages.wolfi.dev/os/x86_64/';
const NAME=/^[a-z0-9][a-z0-9+_.-]{0,127}$/u, VERSION=/^[0-9][A-Za-z0-9._+~-]{0,127}$/u;
const HASH=/^[a-f0-9]{64}$/u;
const locks=new WeakMap();
const codes=new Set(['LOCK','FETCH','TIMEOUT','INTEGRITY','DIRECTORY','IO','CLEANUP_UNKNOWN','VERIFY','USAGE']);
const fail=code=>{throw Object.assign(Error('RUNTIME_PACKAGES_'+code),{code:'RUNTIME_PACKAGES_'+code});};
const need=(ok,code)=>{if(!ok)fail(code);};
const safe=error=>{let code;try{code=error?.code;}catch{}if(typeof code!=='string'||!code.startsWith('RUNTIME_PACKAGES_')||!codes.has(code.slice(17)))code='RUNTIME_PACKAGES_IO';return Object.assign(Error(code),{code});};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const integer=(n,low,high)=>Number.isSafeInteger(n)&&n>=low&&n<=high;
const same=(a,b)=>a.dev===b.dev&&a.ino===b.ino;
const contained=(root,file)=>{const rel=path.relative(root,file);return rel!==''&&rel!=='..'&&!rel.startsWith('..'+path.sep)&&!path.isAbsolute(rel);};
function exact(value,keys){need(value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key)),'LOCK');}
function utf8(bytes){return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}
function decodeLock(raw){
 const text=utf8(raw),stack=[];
 // Reject duplicate object keys before JSON.parse can discard them. Native JSON
 // parsing still owns grammar/string validation; this bounded scanner adds only
 // duplicate-key and nesting refusal for this specific lock format.
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(c==='"'){
   const start=i;
   for(i++;i<text.length;i++){if(text[i]==='\\')i++;else if(text[i]==='"')break;}
   need(i<text.length,'LOCK');
   let next=i+1;while(/\s/u.test(text[next]??'')&&next<text.length)next++;
   if(text[next]===':'){
    const frame=stack.at(-1),key=JSON.parse(text.slice(start,i+1));
    need(frame?.kind==='{'&&!frame.keys.has(key),'LOCK');frame.keys.add(key);
   }
  }else if(c==='{'||c==='['){stack.push({kind:c,keys:new Set()});need(stack.length<=6,'LOCK');}
  else if(c==='}'||c===']'){need(stack.pop()?.kind===(c==='}'?'{':'['),'LOCK');}
 }
 need(stack.length===0,'LOCK');return JSON.parse(text);
}
function packageRow(row,additional){
 exact(row,additional?['name','version','file','url','sha256','bytes']:['name','version']);
 need(typeof row.name==='string'&&NAME.test(row.name)&&typeof row.version==='string'&&VERSION.test(row.version),'LOCK');
 if(additional)need(row.file===row.name+'-'+row.version+'.apk'&&row.url===ORIGIN+row.file&&typeof row.sha256==='string'&&HASH.test(row.sha256)&&integer(row.bytes,1,FILE_LIMIT),'LOCK');
 return Object.freeze({...row});
}
/** Parse exact source bytes, preserving their SHA256 independently of JSON formatting. */
export function parseRuntimePackageLock(input){
 try{
  need(typeof input==='string'||Buffer.isBuffer(input),'LOCK');
  const raw=Buffer.from(input);need(raw.length>0&&raw.length<=LOCK_LIMIT,'LOCK');
  if(typeof input==='string')need(raw.toString('utf8')===input,'LOCK');
  const value=decodeLock(raw);
  exact(value,['schemaVersion','platform','runtimeImageUri','nodeVersion','glibcVersion','basePackages','additionalPackages','repositoryIndex','requiredPaths']);
  need(value.schemaVersion===1&&value.platform==='linux/amd64'&&typeof value.runtimeImageUri==='string'&&/^cgr\.dev\/chainguard\/wolfi-base@sha256:[a-f0-9]{64}$/u.test(value.runtimeImageUri)&&
   typeof value.nodeVersion==='string'&&/^v24\.[0-9]+\.[0-9]+$/u.test(value.nodeVersion)&&typeof value.glibcVersion==='string'&&/^[0-9]+\.[0-9]+$/u.test(value.glibcVersion),'LOCK');
  const identities=new Set();
  const rows=(items,additional)=>{
   need(Array.isArray(items)&&items.length<=(additional?128:2048)&&Boolean(items.length||additional),'LOCK');
   let prior='';return Object.freeze(items.map(item=>{const row=packageRow(item,additional);need(prior<row.name&&!identities.has(row.name),'LOCK');prior=row.name;identities.add(row.name);return row;}));
  };
  const basePackages=rows(value.basePackages,false),additionalPackages=rows(value.additionalPackages,true);
  exact(value.repositoryIndex,['file','url','sha256','bytes','signingKeySha256']);const index=value.repositoryIndex;
  need(index.file==='APKINDEX.tar.gz'&&index.url===ORIGIN+index.file&&typeof index.sha256==='string'&&HASH.test(index.sha256)&&
   typeof index.signingKeySha256==='string'&&HASH.test(index.signingKeySha256)&&integer(index.bytes,1,FILE_LIMIT),'LOCK');
  need(index.bytes+additionalPackages.reduce((n,row)=>n+row.bytes,0)<=TOTAL_LIMIT,'LOCK');
  const paths=value.requiredPaths;
  need(Array.isArray(paths)&&paths.length>0&&paths.length<=128&&new Set(paths).size===paths.length&&paths.every(p=>typeof p==='string'&&p.length<=512&&
   /^\/[A-Za-z0-9._+/-]+$/u.test(p)&&path.posix.normalize(p)===p&&!p.endsWith('/')&&p!=='/'),'LOCK');
  const lock=Object.freeze({...value,basePackages,additionalPackages,repositoryIndex:Object.freeze({...index}),requiredPaths:Object.freeze([...paths])});
  locks.set(lock,{runtimePackagesSha256:hash(raw)});return lock;
 }catch{fail('LOCK');}
}
function selected(input){const lock=locks.has(input)?input:parseRuntimePackageLock(input);return {lock,...locks.get(lock)};}
function packageSet(lock){return [...lock.basePackages,...lock.additionalPackages].map(({name,version})=>({name,version})).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0);}

function publicFetch(url,{signal}){
 // Explicit certificate validation remains enabled even if an inherited process
 // environment tries to disable TLS validation. No cookies, auth or redirects.
 return new Promise((resolve,reject)=>{
  const request=https.request(url,{method:'GET',signal,agent:false,rejectUnauthorized:true,minVersion:'TLSv1.2',maxHeaderSize:8192,
   headers:{accept:'application/octet-stream','accept-encoding':'identity'}},response=>{
    const headers=new Headers();
    for(const key of ['content-length','content-encoding'])if(response.headers[key]!==undefined)headers.set(key,String(response.headers[key]));
    try{resolve(new Response(Readable.toWeb(response),{status:response.statusCode,headers}));}catch(error){response.destroy();reject(error);}
   });
  request.on('error',reject);request.end();
 });
}
/** Serve exact lock URLs from a retained offline snapshot; same integrity path, no network. */
export function retainedFetch(directory){
 need(typeof directory==='string'&&directory.length>0&&!directory.includes('\0'),'FETCH');
 return async(url,{signal}={})=>{
  need(typeof url==='string'&&url.startsWith(ORIGIN)&&!signal?.aborted,'FETCH');
  const name=url.slice(ORIGIN.length);need(/^[A-Za-z0-9][A-Za-z0-9+_.-]{0,255}$/u.test(name),'FETCH');
  const root=await fs.realpath(directory),bytes=await boundedRead(path.join(root,name),FILE_LIMIT);
  return new Response(bytes,{status:200,headers:{'content-length':String(bytes.length)}});
 };
}
function lifetime({now=()=>performance.now(),setTimer=setTimeout,clearTimer=clearTimeout}={}){
 need(typeof now==='function'&&typeof setTimer==='function'&&typeof clearTimer==='function','FETCH');
 let last=now();need(Number.isFinite(last),'FETCH');const end=last+180000,pending=new Set();
 const clock=()=>{const n=now();need(Number.isFinite(n)&&n>=last,'TIMEOUT');last=n;return n;};
 const track=value=>{const p=Promise.resolve(value);pending.add(p);p.then(()=>pending.delete(p),()=>pending.delete(p));return p;};
 const wait=async(work,deadline=end)=>{
  const remaining=Math.min(end,deadline)-clock();need(remaining>0,'TIMEOUT');let timer;
  const task=track(Promise.resolve().then(()=>{need(clock()<Math.min(end,deadline),'TIMEOUT');return work();}));
  try{const result=await Promise.race([task,new Promise((_,reject)=>{timer=setTimer(()=>reject(Object.assign(Error('RUNTIME_PACKAGES_TIMEOUT'),{code:'RUNTIME_PACKAGES_TIMEOUT'})),remaining);})]);
   need(clock()<Math.min(end,deadline),'TIMEOUT');return result;
  }finally{if(timer!==undefined)clearTimer(timer);}
 };
 const settle=async()=>{if(!pending.size)return true;let timer;try{return await Promise.race([Promise.allSettled([...pending]).then(()=>pending.size===0),new Promise(resolve=>{timer=setTimer(()=>resolve(false),1000);})]);}finally{if(timer!==undefined)clearTimer(timer);}};
 return {clock,end,track,wait,settle};
}
async function createDirectory(directory,owned){
 await fs.mkdir(directory,{mode:0o700});const observed=await fs.lstat(directory);
 need(observed.isDirectory()&&!observed.isSymbolicLink(),'DIRECTORY');owned.push({file:directory,observed,directory:true});
}
async function removeOwned(owned){
 let okay=true;
 for(const entry of [...owned].reverse())try{
  const current=await fs.lstat(entry.file);need(same(current,entry.observed)&&!current.isSymbolicLink(),'CLEANUP_UNKNOWN');
  if(entry.directory)await fs.rmdir(entry.file);else{need(current.isFile(),'CLEANUP_UNKNOWN');await fs.unlink(entry.file);}
 }catch{okay=false;}
 return okay;
}
/** Fetch exact public repository/index bytes only. Signature verification belongs to apk and the pinned base key. */
export async function fetchRuntimePackages(input,directory,options={}){
 const {lock,runtimePackagesSha256}=selected(input);
 need(typeof directory==='string'&&directory.length>0&&!directory.includes('\0'),'DIRECTORY');
 directory=path.resolve(directory);need(directory!==path.parse(directory).root,'DIRECTORY');
 let fetchImpl,life;
 try{
  need(options!==null&&typeof options==='object'&&!Array.isArray(options)&&Object.keys(options).every(key=>['fetchImpl','now','setTimer','clearTimer'].includes(key)),'FETCH');
  directory=path.join(await fs.realpath(path.dirname(directory)),path.basename(directory));
  fetchImpl=options.fetchImpl??publicFetch;need(typeof fetchImpl==='function','FETCH');life=lifetime(options);
 }catch(error){throw safe(error);}
 const owned=[],readers=new Set(),controller=new AbortController();let closing=false,total=0;
 try{
  await createDirectory(directory,owned);const target=path.join(directory,'x86_64');await createDirectory(target,owned);
  for(const item of [lock.repositoryIndex,...lock.additionalPackages]){
   const deadline=Math.min(life.end,life.clock()+30000);let response;
   const fetched=()=>Promise.resolve(fetchImpl(item.url,{method:'GET',credentials:'omit',redirect:'error',cache:'no-store',signal:controller.signal,headers:{'accept-encoding':'identity'}})).then(value=>{
    need(value instanceof Response&&value.body!==null,'FETCH');
    if(closing){life.track(value.body.cancel()).catch(()=>{});return {response:value,reader:null};}
    const reader=value.body.getReader();readers.add(reader);return {response:value,reader};
   });
   const received=await life.wait(fetched,deadline);response=received.response;const reader=received.reader;
   need(reader!==null,'FETCH');
   need(response.status===200&&!response.redirected&&(!response.url||response.url===item.url),'FETCH');
   const length=response.headers.get('content-length'),encoding=response.headers.get('content-encoding');
   need((length===null||/^[0-9]{1,10}$/u.test(length)&&Number(length)===item.bytes)&&(encoding===null||encoding==='identity'),'INTEGRITY');
   const chunks=[],digest=createHash('sha256');let count=0;
   while(true){const next=await life.wait(()=>reader.read(),deadline);if(next.done)break;
    need(next.value instanceof Uint8Array,'FETCH');count+=next.value.byteLength;total+=next.value.byteLength;
    need(count<=item.bytes&&count<=FILE_LIMIT&&total<=TOTAL_LIMIT,'INTEGRITY');
    const bytes=Buffer.from(next.value);chunks.push(bytes);digest.update(bytes);
   }
   reader.releaseLock();readers.delete(reader);
   need(count===item.bytes&&digest.digest('hex')===item.sha256,'INTEGRITY');
   for(const entry of owned.filter(row=>row.directory)){const current=await fs.lstat(entry.file);need(current.isDirectory()&&!current.isSymbolicLink()&&same(current,entry.observed),'DIRECTORY');}
   const file=path.join(target,item.file),handle=await fs.open(file,'wx',0o600);
   try{const observed=await handle.stat();owned.push({file,observed,directory:false});await handle.writeFile(Buffer.concat(chunks,count));}
   finally{await handle.close();}
   need(life.clock()<life.end,'TIMEOUT');
  }
  need((await fs.readdir(path.join(directory,'x86_64'))).sort().join('\0')===[lock.repositoryIndex.file,...lock.additionalPackages.map(row=>row.file)].sort().join('\0'),'DIRECTORY');
  return Object.freeze({runtimePackagesSha256,files:1+lock.additionalPackages.length,bytes:total});
 }catch(error){
  closing=true;controller.abort();let stopped=true;
  for(const reader of readers)try{life.track(reader.cancel()).catch(()=>{stopped=false;});}catch{stopped=false;}
  try{if(!await life.settle())stopped=false;}catch{stopped=false;}
  const removed=await removeOwned(owned);
  if(!stopped||!removed)fail('CLEANUP_UNKNOWN');throw safe(error);
 }
}

async function boundedRead(file,maximum,prefixOnly=false){
 const handle=await fs.open(file,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
 try{
  const before=await handle.stat();need(before.isFile()&&before.size>0&&(prefixOnly||before.size<=maximum),'VERIFY');
  const bytes=Buffer.alloc(Math.min(before.size,maximum)+Number(!prefixOnly));let offset=0;
  while(offset<bytes.length){const result=await handle.read(bytes,offset,bytes.length-offset,offset);if(result.bytesRead===0)break;offset+=result.bytesRead;}
  const after=await handle.stat();need(same(before,after)&&before.size===after.size&&before.mtimeMs===after.mtimeMs&&before.ctimeMs===after.ctimeMs&&(prefixOnly||offset<=maximum),'VERIFY');
  return bytes.subarray(0,offset);
 }finally{await handle.close();}
}
async function runtimePath(root,name){const file=await fs.realpath(path.join(root,...name.slice(1).split('/')));need(contained(root,file),'VERIFY');return file;}
function installedSet(bytes){
 const text=utf8(bytes);need(!/[\0\r]/u.test(text),'VERIFY');const result=[],seen=new Set();
 for(const block of text.split(/\n\n+/u)){
  if(!block.trim())continue;let name,version,architecture;
  for(const line of block.split('\n')){
   if(line.startsWith('P:')){need(name===undefined,'VERIFY');name=line.slice(2);}
   if(line.startsWith('V:')){need(version===undefined,'VERIFY');version=line.slice(2);}
   if(line.startsWith('A:')){need(architecture===undefined,'VERIFY');architecture=line.slice(2);}
  }
  need(typeof name==='string'&&NAME.test(name)&&typeof version==='string'&&VERSION.test(version)&&architecture==='x86_64'&&!seen.has(name),'VERIFY');
  seen.add(name);result.push({name,version});need(result.length<=2176,'VERIFY');
 }
 return result.sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0);
}
function realRuntime(){return {platform:process.platform,architecture:process.arch,nodeVersion:process.version,glibcVersion:process.report.getReport().header.glibcVersionRuntime};}
/** Verify complete installed identities, canonical required files and actual runtime version measurements. */
export async function verifyInstalledPackages(input,{rootDirectory='/',measureRuntime=realRuntime}={}){
 try{
  const {lock,runtimePackagesSha256}=selected(input),root=await fs.realpath(path.resolve(rootDirectory));
  const files=new Map();
  for(const name of ['/lib/apk/db/installed','/var/lib/apk/db/installed','/usr/lib/apk/db/installed'])try{
   const file=await runtimePath(root,name),stat=await fs.stat(file);need(stat.isFile(),'VERIFY');files.set(file,file);
  }catch(error){if(error?.code!=='ENOENT')throw error;}
  need(files.size===1,'VERIFY');const installed=installedSet(await boundedRead([...files.values()][0],DB_LIMIT)),expected=packageSet(lock);
  need(JSON.stringify(installed)===JSON.stringify(expected),'VERIFY');
  const runtime=await measureRuntime();need(runtime.platform==='linux'&&runtime.architecture==='x64'&&runtime.nodeVersion===lock.nodeVersion&&runtime.glibcVersion===lock.glibcVersion,'VERIFY');
  for(const name of lock.requiredPaths)need((await boundedRead(await runtimePath(root,name),4096,true)).length>0,'VERIFY');
  return Object.freeze({schemaVersion:1,status:'RUNTIME_PACKAGES_VERIFIED',runtimeBaseImageUri:lock.runtimeImageUri,runtimePackagesSha256,
   installedPackageSetSha256:hash(Buffer.from(JSON.stringify(installed)+'\n')),nodeVersion:runtime.nodeVersion,glibcVersion:runtime.glibcVersion});
 }catch{fail('VERIFY');}
}
async function main(args){
 if(args.length===1&&['--help','-h'].includes(args[0])){console.log('Usage: runtime-packages.mjs fetch --lock FILE --directory NEW_DIRECTORY [--from RETAINED_DIRECTORY] | verify --lock FILE\nExit: 0 success/help; 2 refused input, download, cleanup or verification. No automatic retries.');return 0;}
 try{
  const mode=args[0];need((mode==='fetch'&&(args.length===5||args.length===7&&args[5]==='--from')&&args[1]==='--lock'&&args[3]==='--directory')||(mode==='verify'&&args.length===3&&args[1]==='--lock'),'USAGE');
  const bytes=await boundedRead(await fs.realpath(args[2]),LOCK_LIMIT);
  parseRuntimePackageLock(bytes);
  if(mode==='fetch')await fetchRuntimePackages(bytes,args[4],args.length===7?{fetchImpl:retainedFetch(args[6])}:{});
  else console.log(JSON.stringify(await verifyInstalledPackages(bytes)));
  return 0;
 }catch(error){console.error(safe(error).message);return 2;}
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)main(process.argv.slice(2)).then(code=>{process.exitCode=code;},()=>{console.error('RUNTIME_PACKAGES_IO');process.exitCode=2;});
