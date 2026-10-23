/** Build-time extraction through SWC's real loader; no application or model startup. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';

export function inspectNativeImage(bytes) {
  assert(bytes.length >= 64 && bytes.subarray(0,4).equals(Buffer.from([127,69,76,70])) &&
    bytes[4] === 2 && bytes[5] === 1 && bytes.readUInt16LE(18) === 183,
    'Expected native AArch64 ELF64 little-endian image');
}
export function inspectNativeFile(file) {
  const descriptor=fs.openSync(file,'r');
  try {
    const header=Buffer.alloc(64);
    assert.equal(fs.readSync(descriptor,header,0,64,0),64,'Truncated native image');
    inspectNativeImage(header);
  } finally { fs.closeSync(descriptor); }
}
export function swcBinding(root) {
  assert(process.platform === 'linux' && process.arch === 'arm64');
  const require = createRequire(path.join(root,'apps/runtime/package.json'));
  const corePackage = require.resolve('@swc/core/package.json');
  const core = JSON.parse(fs.readFileSync(corePackage,'utf8'));
  const name = '@swc/core-linux-arm64-gnu';
  assert.equal(core.version,'1.16.18');
  assert.equal(core.optionalDependencies[name],core.version);
  const nativeRequire = createRequire(corePackage);
  const native = fs.realpathSync(nativeRequire.resolve(name));
  assert.equal(nativeRequire(name+'/package.json').version,core.version);
  inspectNativeFile(native);
  return {owner:path.join(root,'apps/runtime/package.json'),native,version:core.version};
}
const loader = String.raw`
const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const swc=createRequire(process.argv[1])('@swc/core');
const code=swc.transformSync('const answer: number = 7;', {jsc:{parser:{syntax:'typescript'}}}).code;
if(!code.includes('7')||swc.getBinaryMetadata().target!=='aarch64-unknown-linux-gnu')throw Error('SWC transform/architecture mismatch');
const cache=process.argv[3],inside=file=>{const rel=path.relative(cache,file);return rel!==''&&!rel.startsWith('..')&&!path.isAbsolute(rel);};
const objects=process.report.getReport().sharedObjects.filter(file=>file.endsWith('.node')).map(file=>fs.realpathSync(file));
const extracted=objects.filter(inside);
if(extracted.length>1||objects.some(file=>file!==process.argv[2]&&!inside(file)))throw Error('Unexpected SWC native image');
const loaded=extracted[0]??process.argv[2];
if(!objects.includes(loaded))throw Error('SWC native image not loaded');
console.log(JSON.stringify({loaded}));
`;
export function materializeSwc(root) {
  const binding=swcBinding(root),cache=path.join(root,'.build-native');
  assert(!fs.existsSync(cache),'Build cache must be absent');
  const load=()=>JSON.parse(execFileSync(process.execPath,['-e',loader,binding.owner,binding.native,cache],{
    env:{PATH:process.env.PATH,HOME:cache,SWC_NATIVE_BINDING_CACHE:cache},
    encoding:'utf8',timeout:30000,maxBuffer:65536,stdio:['ignore','pipe','pipe'],
  }));
  fs.mkdirSync(cache,{mode:0o700});
  try {
    const {loaded}=load();
    inspectNativeFile(loaded);
    if(loaded!==binding.native)fs.copyFileSync(loaded,binding.native);
    // The upstream extraction is owner-only; the final image runs as UID1000.
    // Keep the baked addon root-owned and readable, without runtime write access.
    fs.chmodSync(binding.native,0o444);
    assert.equal(fs.statSync(binding.native).mode & 0o777,0o444);
    fs.rmSync(cache,{recursive:true});
    assert.equal(load().loaded,binding.native);
    assert(!fs.existsSync(cache),'Installed native image must not need a runtime cache');
    return {package:'@swc/core-linux-arm64-gnu',version:binding.version,transform:true,cacheIndependent:true};
  } finally {
    if(fs.existsSync(cache))fs.rmSync(cache,{recursive:true});
  }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  assert.equal(process.version,'v24.22.1');
  console.log(JSON.stringify(materializeSwc(fileURLToPath(new URL('../../../',import.meta.url)))));
}
