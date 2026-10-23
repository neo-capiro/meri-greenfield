import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {inspectNativeImage} from './materialize-swc.mjs';
const probe=new URL('./runtime-base-probe.mjs',import.meta.url);
const run=args=>spawnSync(process.execPath,args,{encoding:'utf8',timeout:10000,
  env:{PATH:process.env.PATH??'',...(process.platform==='win32'?{SystemRoot:process.env.SystemRoot}:{})}});

test('probe import and help do not load native packages or start services',()=>{
  const imported=run(['--input-type=module','-e',`import(${JSON.stringify(probe.href)}).then(m=>{if(typeof m.probeRuntimeImage!=='function')process.exitCode=3;});`]);
  assert.equal(imported.status,0,imported.stderr);assert.equal(imported.stdout+imported.stderr,'');
  const help=run([fileURLToPath(probe),'--help']);assert.equal(help.status,0,help.stderr);assert.match(help.stdout,/Native ARM64 image smoke/);
});
test('probe refuses unsupported calls and host architecture before application loading',()=>{
  for(const args of [[],['--check','extra'],['--unexpected=private']]){
    const result=run([fileURLToPath(probe),...args]);assert.equal(result.status,2);assert.equal(result.stdout,'');assert.equal(result.stderr,'RUNTIME_IMAGE_REFUSED\n');
  }
  if(process.platform!=='linux'||process.arch!=='arm64'){
    const result=run([fileURLToPath(probe),'--check']);assert.equal(result.status,2);assert.equal(result.stdout,'');
  }
});
test('native binary check accepts AArch64 and rejects x64, wrong endian and truncated data',()=>{
  const bytes=Buffer.alloc(64);Buffer.from([127,69,76,70,2,1]).copy(bytes);bytes.writeUInt16LE(183,18);
  assert.doesNotThrow(()=>inspectNativeImage(bytes));
  const x64=Buffer.from(bytes);x64.writeUInt16LE(62,18);assert.throws(()=>inspectNativeImage(x64));
  const endian=Buffer.from(bytes);endian[5]=2;assert.throws(()=>inspectNativeImage(endian));
  assert.throws(()=>inspectNativeImage(bytes.subarray(0,63)));
});
