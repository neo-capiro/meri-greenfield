import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const probe=new URL('./runtime-base-probe.mjs',import.meta.url);
const run=args=>spawnSync(process.execPath,args,{encoding:'utf8',timeout:10000,
 env:{PATH:process.env.PATH??'',...(process.platform==='win32'?{SystemRoot:process.env.SystemRoot}:{})}});

test('native probe imports without loading a native application or producing output',()=>{
 const script=`import(${JSON.stringify(probe.href)}).then(module=>{if(typeof module.measureRuntimeNative!=='function')process.exitCode=3;});`;
 const result=run(['--input-type=module','-e',script]);
 assert.equal(result.status,0,result.stderr);assert.equal(result.stdout,'');assert.equal(result.stderr,'');
});

test('help and argument refusal do not need dependencies or configuration',()=>{
 const help=run([fileURLToPath(probe),'--help']);
 assert.equal(help.status,0,help.stderr);assert.match(help.stdout,/Exit0 verified\/help; exit2 refused/u);
 assert.equal(help.stderr,'');
 for(const args of [[],['--measure','unexpected'],['--secret=do-not-print']]){
  const refused=run([fileURLToPath(probe),...args]);
  assert.equal(refused.status,2);assert.equal(refused.stdout,'');
  assert.equal(refused.stderr,'RUNTIME_NATIVE_REFUSED\n');
 }
});

test('unsupported local platform refuses before dependency load, with a static error',t=>{
 if(process.platform==='linux'&&process.arch==='x64'&&process.version==='v24.21.0')return t.skip('Real final-image invocation belongs to allocated Linux qualification');
 const result=run([fileURLToPath(probe),'--measure']);
 assert.equal(result.status,2);assert.equal(result.stdout,'');assert.equal(result.stderr,'RUNTIME_NATIVE_REFUSED\n');
});
