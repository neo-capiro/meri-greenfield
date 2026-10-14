/** Build-only materialization via the pinned upstream loader; safe to import. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {swcDiagnostic} from './swc-diagnostic.mjs';

const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const need = (ok, message) => {if (!ok) throw Error(message);};
function contained(root,file) {const p=path.relative(root,file);return p!==''&&p!=='..'&&!p.startsWith('..'+path.sep)&&!path.isAbsolute(p);}

export function inspectNativeImage(bytes,platform,architecture) {
  if (platform==='linux') {
    need(architecture==='x64'&&bytes.length>=64&&bytes.subarray(0,4).equals(Buffer.from([127,69,76,70]))&&bytes[4]===2&&bytes[5]===1&&bytes.readUInt16LE(18)===62,'Expected Linux x64 ELF64 little-endian addon');
  } else {
    // Windows support is for meaningful local carrier tests, never Linux image admission.
    need(platform==='win32'&&architecture==='x64'&&bytes.length>=64&&bytes.toString('ascii',0,2)==='MZ','Expected Windows x64 PE addon');
    const pe=bytes.readUInt32LE(60);
    need(pe+26<=bytes.length&&bytes.toString('ascii',pe,pe+4)==='PE\0\0'&&bytes.readUInt16LE(pe+4)===0x8664,'Expected Windows x64 PE machine');
  }
}

export function swcBinding(root) {
  root=fs.realpathSync(root);
  need(['linux','win32'].includes(process.platform)&&process.arch==='x64','Unsupported native qualification platform');
  if(process.platform==='linux')need(Boolean(process.report.getReport().header.glibcVersionRuntime),'Pinned Bookworm glibc evidence missing');
  const owner=path.join(root,'apps/runtime/package.json'),require=createRequire(owner);
  const corePackage=fs.realpathSync(require.resolve('@swc/core/package.json'));
  need(contained(root,corePackage),'SWC core escapes owned root');
  const core=JSON.parse(fs.readFileSync(corePackage,'utf8'));
  const name=process.platform==='linux'?'@swc/core-linux-x64-gnu':'@swc/core-win32-x64-msvc';
  need(core.name==='@swc/core'&&core.version==='1.16.18'&&core.optionalDependencies?.[name]===core.version,'SWC owner dependency pin differs');
  const fromCore=createRequire(corePackage);
  const nativePackage=fs.realpathSync(fromCore.resolve(name+'/package.json'));
  const pkg=JSON.parse(fs.readFileSync(nativePackage,'utf8'));
  need(contained(root,nativePackage)&&pkg.name===name&&pkg.version===core.version&&pkg.os?.includes(process.platform)&&pkg.cpu?.includes(process.arch),'SWC native package identity differs');
  if(process.platform==='linux')need(pkg.libc?.includes('glibc'),'SWC native libc differs');
  const candidate=fromCore.resolve(name);
  need(!fs.lstatSync(candidate).isSymbolicLink(),'SWC native link refused');
  const native=fs.realpathSync(candidate),packageRoot=path.dirname(nativePackage);
  need(contained(packageRoot,native)&&native===path.join(packageRoot,pkg.main),'SWC native package entry differs');
  const stat=fs.statSync(native);
  need(stat.isFile()&&stat.size>0&&stat.size<=512*1024*1024,'SWC native file bound');
  inspectNativeImage(fs.readFileSync(native),process.platform,process.arch);
  return {root,owner,corePackage,name,version:pkg.version,native,packageRoot};
}

// Actual upstream require and transform, in a fresh process that owns no app startup.
const loadScript=String.raw`
const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const owner=process.argv[1],expected=process.argv[2],cache=process.argv[3];
try {
let networkAttempts=0;const deny=()=>{networkAttempts++;throw Error('BUILD_NATIVE_NETWORK_REFUSED');};
globalThis.fetch=deny;
for(const name of ['node:http','node:https']){const mod=require(name);mod.request=deny;mod.get=deny;}
const net=require('node:net');net.connect=deny;net.createConnection=deny;net.Socket.prototype.connect=deny;net.Server.prototype.listen=deny;require('node:tls').connect=deny;
const swc=createRequire(owner)('@swc/core');
const transformed=swc.transformSync('const value: number = 7;', {jsc:{parser:{syntax:'typescript'}},sourceMaps:false});
const target=swc.getBinaryMetadata().target;
const expectedTarget=process.platform==='linux'?'x86_64-unknown-linux-gnu':'x86_64-pc-windows-msvc';
if(!transformed.code.includes('7')||target!==expectedTarget)throw Error('SWC native transform/target failed');
let observed=process.report.getReport().sharedObjects;
if(process.platform==='win32'&&process.argv[4]==='windows-test-observer'){
  // Explicit local-test adapter: inspect only this task-owned child's module filenames.
  const shell=path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe');
  const command='(Get-Process -Id '+process.pid+' -Module -ErrorAction Stop).FileName | ConvertTo-Json -Compress';
  observed=JSON.parse(require('node:child_process').execFileSync(shell,['-NoProfile','-NonInteractive','-Command',command],{encoding:'utf8',timeout:10000,maxBuffer:1024*1024,stdio:['ignore','pipe','pipe']}));
  if(!Array.isArray(observed))observed=[observed];
}
const objects=[...new Set(observed.map(p=>{try{return fs.realpathSync(p);}catch{return '';}}))];
const inside=(base,file)=>{const r=path.relative(base,file);return r!==''&&r!=='..'&&!r.startsWith('..'+path.sep)&&!path.isAbsolute(r);};
const nativeObjects=objects.filter(p=>p.endsWith('.node'));
if(nativeObjects.some(p=>path.relative(p,expected)!==''&&!inside(cache,p))){
  if(process.platform==='win32'&&process.argv[4]==='windows-test-observer')console.error(JSON.stringify({ownedChildNativeModules:nativeObjects}));
  throw Error('Unexpected native image outside selected binding/build cache');
}
const raw=objects.filter(p=>inside(cache,p)&&p.endsWith('.node'));
// Both the carrier and its raw payload remain mapped during first load.
const loaded=raw.length===1?raw[0]:raw.length===0&&objects.some(p=>path.relative(p,expected)==='')?expected:null;
if(!loaded)throw Error('SWC loaded addon identity ambiguous: '+JSON.stringify({rawCount:raw.length,ownedObjects:objects.filter(p=>inside(path.dirname(owner),p)).map(p=>path.relative(path.dirname(owner),p)),cacheObjects:objects.filter(p=>inside(cache,p)).map(p=>path.relative(cache,p))}));
console.log(JSON.stringify({loaded,target,transformed:true,networkAttempts}));
} catch(error) {
  const {loaderCauses,exactNativeCauses}=require(process.argv[5]);
  console.error('MERI_NATIVE_LOAD_CAUSES '+JSON.stringify({classes:loaderCauses(error),exact:exactNativeCauses(error)}));
  process.exitCode=1;
}
`;

function load(binding,cache,windowsTestObserver) {
  const env={PATH:process.env.PATH??'',HOME:cache,SWC_NATIVE_BINDING_CACHE:cache};
  if(process.platform==='win32')env.SystemRoot=process.env.SystemRoot;
  const diagnostic=path.join(path.dirname(fileURLToPath(import.meta.url)),'swc-diagnostic.mjs');
  return JSON.parse(execFileSync(process.execPath,['-e',loadScript,binding.owner,binding.native,cache,windowsTestObserver?'windows-test-observer':'native-report',diagnostic],{env,timeout:30000,maxBuffer:64*1024,encoding:'utf8',stdio:['ignore','pipe','pipe']}));
}

export function materializeSwc(root,{cacheParent=path.join(root,'.build-native'),windowsTestObserver=false}={}) {
  const binding=swcBinding(root);
  cacheParent=path.resolve(cacheParent);
  need(contained(binding.root,cacheParent),'Build cache must remain in owned root');
  need(!fs.existsSync(cacheParent),'Build materialization directory already exists');
  fs.mkdirSync(cacheParent,{mode:0o700});
  const originalSha256=sha(binding.native);
  const originalMode=fs.statSync(binding.native).mode&0o777;
  const stage=path.join(binding.packageRoot,'.meri-materialized-'+process.pid+'.node');
  try {
    const loaded=load(binding,cacheParent,windowsTestObserver);
    need(loaded.networkAttempts===0,'SWC build load attempted network');
    const raw=fs.realpathSync(loaded.loaded);
    need(raw===binding.native||contained(cacheParent,raw),'SWC loaded image escapes owned binding/cache');
    const stat=fs.lstatSync(raw);
    need(stat.isFile()&&!stat.isSymbolicLink()&&stat.size>0&&stat.size<=512*1024*1024,'SWC materialized file bound');
    const bytes=fs.readFileSync(raw);inspectNativeImage(bytes,process.platform,process.arch);
    const materializedSha256=sha(raw);
    // The child has exited, so its carrier is unmapped before replacement (also on Windows).
    if(raw!==binding.native){
      fs.writeFileSync(stage,bytes,{flag:'wx',mode:originalMode&~0o022});
      need(sha(stage)===materializedSha256,'SWC staged bytes differ');
      fs.renameSync(stage,binding.native);
    }
    need(sha(binding.native)===materializedSha256,'SWC installed materialized bytes differ');
    const cachedFile=raw!==binding.native;
    // Remove every build cache before proving the installed raw addon loads independently.
    fs.rmSync(cacheParent,{recursive:true});
    const verified=load(binding,cacheParent,windowsTestObserver);
    need(verified.loaded===binding.native&&!fs.existsSync(cacheParent)&&verified.networkAttempts===0,'SWC cache-independent load failed');
    return {version:binding.version,package:binding.name,native:binding.native,originalSha256,materializedSha256,materializedBytes:bytes.length,copiedFromVerifiedCache:cachedFile,target:verified.target,nativeTransform:true,cacheIndependent:true};
  } finally {
    if(fs.existsSync(stage))fs.unlinkSync(stage);
    if(fs.existsSync(cacheParent))fs.rmSync(cacheParent,{recursive:true});
  }
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  if(process.argv.includes('--help'))console.log('Build-only SWC materialization: node apps/runtime/build/materialize-swc.mjs. Exit 0 verified; 1 HOLD. No network, app/service or model calls.');
  else try {
    need(process.platform==='linux'&&process.arch==='x64'&&process.version==='v24.21.0','Production materialization requires pinned Linux x64 Node v24.21.0');
    const root=fileURLToPath(new URL('../../../',import.meta.url));
    console.log('MERI_BUILD_SWC '+JSON.stringify(materializeSwc(root)));
  } catch(error) {
    const root=fileURLToPath(new URL('../../../',import.meta.url));
    console.error('MERI_SWC_DIAGNOSTIC '+JSON.stringify(swcDiagnostic(root,error,'build-materialization')));
    console.error('HOLD: SWC build materialization failed');process.exitCode=1;
  }
}
