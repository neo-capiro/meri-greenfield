import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {compareNpmBundle,verifyNpmResolution} from './npm-bundle.mjs';

function fixture(t) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'meri-npm-bundle-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const upstream=path.join(root,'upstream'),installed=path.join(root,'installed'),undici=path.join(root,'undici');
  const put=(directory,name,bytes)=>{const target=path.join(directory,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);};
  for(const dir of [upstream,installed]){
    put(dir,'package.json',JSON.stringify({version:'12.2.1'}));
    put(dir,'bin/npm-cli.js','retained npm');put(dir,'bin/npx-cli.js','retained npx');
    put(dir,'node_modules/node-gyp/package.json',JSON.stringify({dependencies:{undici:'^6.25.0'}}));
  }
  put(upstream,'node_modules/undici/package.json',JSON.stringify({version:'6.29.0'}));
  for(const dir of [undici,path.join(installed,'node_modules/undici')]){
    put(dir,'package.json',JSON.stringify({version:'6.29.1'}));put(dir,'index.js','complete replacement');
  }
  return {upstream,installed,undici,put,check:()=>compareNpmBundle(upstream,installed,undici)};
}
test('bundle comparison permits only the complete explicitly identified replacement',t=>{
  const f=fixture(t);assert.deepEqual(f.check(),{unchangedFiles:4,replacementFiles:2});
});
for(const [name,mutate,pattern] of [
  ['changed npm CLI',f=>f.put(f.installed,'bin/npm-cli.js','tampered'),/NPM_UNRELATED_BUNDLE_CHANGE/],
  ['extra unrelated file',f=>f.put(f.installed,'extra.js','injected'),/NPM_UNRELATED_BUNDLE_CHANGE/],
  ['missing npx CLI',f=>fs.unlinkSync(path.join(f.installed,'bin/npx-cli.js')),/NPM_UNRELATED_BUNDLE_CHANGE/],
  ['incomplete replacement',f=>fs.unlinkSync(path.join(f.installed,'node_modules/undici/index.js')),/NPM_REPLACEMENT_BYTES/],
  ['altered replacement',f=>f.put(f.installed,'node_modules/undici/index.js','patched by hand'),/NPM_REPLACEMENT_BYTES/],
  ['different upstream npm',f=>f.put(f.upstream,'package.json','{"version":"12.2.2"}'),/12\.2\.1/],
  ['different original bundle',f=>f.put(f.upstream,'node_modules/undici/package.json','{"version":"6.28.0"}'),/6\.29\.0/],
])test(`bundle comparison refuses ${name}`,t=>{const f=fixture(t);mutate(f);assert.throws(f.check,pattern);});
test('runtime resolution refuses npm version drift before loading the package',t=>{
  const f=fixture(t);f.put(f.installed,'package.json','{"version":"12.2.0"}');
  assert.throws(()=>verifyNpmResolution(f.installed),/12\.2\.1/);
});
