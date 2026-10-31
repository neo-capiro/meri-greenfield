import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {resolve,join,relative,isAbsolute,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {prepareNativeObserverPackage} from './native-processing-package.mjs';
const sourceRoot=resolve(fileURLToPath(new URL('../../',import.meta.url)));
test('sealed package imports the exact committed handler with bundled dependencies and binds ZIP bytes',()=>{
 const work=mkdtempSync(join(tmpdir(),'meri-native-package-')),out=join(work,'sealed');
 try{
  const commit=execFileSync('git',['-C',sourceRoot,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
  const args={sourceRoot,commit,runtimeRoot:process.env.MERI_REVIEW_RUNTIME_ROOT??join(sourceRoot,'apps/runtime'),
   contractsRoot:process.env.MERI_REVIEW_CONTRACTS_ROOT??join(sourceRoot,'packages/contracts'),imageDigest:'sha256:'+'1'.repeat(64),out};
  const result=prepareNativeObserverPackage(args),manifest=JSON.parse(readFileSync(join(out,'manifest.json')));
  assert.equal(result.importPassed,true);assert.equal(result.qualifiedServingImage,false);assert.equal(result.cloudPublished,false);
  assert.equal(result.zipSha256,createHash('sha256').update(readFileSync(join(out,'observer.zip'))).digest('hex'));
  assert.ok(manifest.members.some(m=>m.path==='apps/runtime/native-observer-entrypoint.mjs'));
  assert.ok(manifest.members.some(m=>m.path==='packages/contracts/meri.schema.json'));
  assert.ok(manifest.dependencies.some(d=>d.name==='@aws-sdk/client-secrets-manager'&&d.version==='3.1151.0'));
  assert.ok(!manifest.members.some(m=>/(^|\/)test\//u.test(m.path)&&m.origin==='git'));
  assert.throws(()=>prepareNativeObserverPackage(args),/EEXIST/u,'existing package is never overwritten');
  assert.throws(()=>prepareNativeObserverPackage({...args,commit:'bad',out:join(work,'invalid')}));
  assert.equal(existsSync(join(work,'invalid')),false);
  assert.throws(()=>prepareNativeObserverPackage({...args,out:join(sourceRoot,'..not-outside')}));
 }finally{
  const absolute=resolve(work),rel=relative(resolve(tmpdir()),absolute);
  assert.ok(rel&&!isAbsolute(rel)&&basename(absolute).startsWith('meri-native-package-')&&!rel.startsWith('..'));
  rmSync(absolute,{recursive:true});
 }
});
