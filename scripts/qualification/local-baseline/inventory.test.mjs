/** Suite inventory completeness: every test file is run by a suite or excluded with a reason. Nothing is executed here. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {inventory,loadSuites} from './inventory.mjs';
const root=fileURLToPath(new URL('../../..',import.meta.url));
function checkout(t,files){
 const dir=mkdtempSync(join(tmpdir(),'meri-inventory-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 for(const [path,text] of Object.entries(files)){mkdirSync(dirname(join(dir,path)),{recursive:true});writeFileSync(join(dir,path),text);}
 return dir;
}

test('every repository test file is covered by a suite or excluded with a reason; no suite, cover or exclusion is stale',()=>{
 const r=inventory(root);
 assert.deepEqual(r.uncovered,[],'test files that are neither run by a suite nor excluded: add them to suites.json or exclude them with a reason');
 assert.deepEqual(r.emptySuites,[]);assert.deepEqual(r.staleCovers,[]);assert.deepEqual(r.staleExclusions,[]);assert.deepEqual(r.excludedButCovered,[]);
 assert.equal(r.covered.size+r.excluded.size,r.testFiles.length);assert.ok(r.covered.size>500&&r.excluded.size>0,'the scan sees the repository test files');
});

test('the review-named gaps are covered: runtime telemetry, worker browser and reads, matching apps/runtime npm test',()=>{
 const r=inventory(root),by=file=>r.covered.get(file)??[];
 for(const file of ['apps/runtime/telemetry/test/sdk.test.mjs','apps/runtime/telemetry/test/redaction.test.mjs'])assert.deepEqual(by(file),['runtime-tests'],file);
 for(const file of ['apps/worker/conversation/browser/test/policy.test.mjs','apps/worker/conversation/reads/test/server.test.mjs'])assert.deepEqual(by(file),['worker-conversation'],file);
 const runtime=loadSuites().suites.find(s=>s.name==='runtime-tests');
 assert.deepEqual(runtime.files,['test/*.test.mjs','telemetry/test/*.test.mjs']);
});

test('a test directory that is neither covered nor excluded fails the inventory; exclusion with a reason accounts for it',t=>{
 const dir=checkout(t,{'package.json':'{"scripts":{"check":"node --test pkg/test/listed.test.mjs"}}','pkg/test/a.test.mjs':'','pkg/test/listed.test.mjs':'','new/test/b.test.mjs':'','tools/test_c.py':''});
 const suites=(extra={})=>({schema:'meri.local-baseline-suites.v1',suites:[{name:'pkg',cwd:'pkg',files:['test/a.test.mjs']},{name:'npm',kind:'npm',prefix:'.',script:'check',covers:['pkg/test/listed.test.mjs']}],...extra});
 assert.deepEqual(inventory(dir,suites()).uncovered,['new/test/b.test.mjs','tools/test_c.py']);
 const r=inventory(dir,suites({exclusions:[{paths:['new/**'],reason:'r'},{paths:['**/test_*.py'],reason:'r'}]}));
 assert.deepEqual(r.uncovered,[]);assert.equal(r.excluded.get('new/test/b.test.mjs'),'r');assert.deepEqual(r.covered.get('pkg/test/listed.test.mjs'),['npm']);
});

test('stale entries fail: an empty suite glob, an npm cover absent from the package scripts, an unmatched or contradictory exclusion',t=>{
 const dir=checkout(t,{'package.json':'{"scripts":{"check":"node --test x.test.mjs"}}','x.test.mjs':'','y.test.mjs':''});
 const r=inventory(dir,{schema:'meri.local-baseline-suites.v1',exclusions:[{paths:['gone/**'],reason:'r'},{paths:['x.test.mjs'],reason:'r'}],
  suites:[{name:'empty',files:['missing/*.test.mjs']},{name:'npm',kind:'npm',script:'check',covers:['x.test.mjs','y.test.mjs']}]});
 assert.deepEqual(r.emptySuites,['empty']);assert.deepEqual(r.staleCovers,['npm: y.test.mjs']);
 assert.deepEqual(r.staleExclusions,['gone/**']);assert.deepEqual(r.excludedButCovered,['x.test.mjs']);
});

test('suites.json refuses duplicate names and reasonless exclusions',t=>{
 const dir=checkout(t,{'a.json':JSON.stringify({schema:'meri.local-baseline-suites.v1',suites:[{name:'a'},{name:'a'}]}),'b.json':JSON.stringify({schema:'meri.local-baseline-suites.v1',suites:[],exclusions:[{paths:['x'],reason:' '}]}),'c.json':'{"schema":"other","suites":[]}'});
 assert.throws(()=>loadSuites(join(dir,'a.json')),/duplicate suite name/u);
 assert.throws(()=>loadSuites(join(dir,'b.json')),/needs paths and a reason/u);
 assert.throws(()=>loadSuites(join(dir,'c.json')),/unknown suites schema/u);
});
