/** Static source/allowlist audit; actual Docker COPY verification remains separately mandatory. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const proof=JSON.parse(fs.readFileSync(new URL('./source-manifest.json',import.meta.url),'utf8'));

test('all45 historical proof paths and44 non-recipe hashes remain; every candidate source hash matches',()=>{
  assert.equal(proof.files.length,45);
  assert.equal(hash(proof.files.map(row=>row.path).sort().join('\n')+'\n'),'d340511c6f520b2de292626640a96f06df1c0284ff29bb960cbbfd8d37b6fde8');
  assert.equal(hash(proof.files.filter(row=>row.path!=='apps/runtime/Dockerfile').sort((a,b)=>a.path.localeCompare(b.path)).map(row=>row.path+':'+row.sha256).join('\n')+'\n'),'79e334ed6f997a9bf3938c31dcbd9bb368b617754f589f0168c302d02344cd32');
  for(const row of proof.files)assert.equal(hash(fs.readFileSync(path.join(root,row.path))),row.sha256,row.path);
  assert.equal(proof.sourceHead,null);assert.equal(proof.publicationSource,null);
});

test('exact16 proof-test files are allowlisted with parent reopening and sibling denial',()=>{
  const paths=proof.files.map(row=>row.path).filter(file=>file.includes('/test/')).sort();
  assert.equal(paths.length,16);
  const patterns=fs.readFileSync(path.join(root,'.dockerignore'),'utf8').split(/\r?\n/).map(line=>line.trim()).filter(line=>line&&!line.startsWith('#'));
  const exceptions=patterns.filter(line=>line.startsWith('!')&&line.includes('/test/')&&!line.endsWith('/')).map(line=>line.slice(1)).sort();
  assert.deepEqual(exceptions,paths);
  for(const parent of new Set(paths.map(file=>path.posix.dirname(file)))){
    const i=patterns.indexOf('!'+parent+'/');assert.ok(i>=0,parent);assert.equal(patterns[i+1],parent+'/*');
  }
});

test('exact observed Linux helper bytes and network-isolated build recipe are promoted',()=>{
  assert.equal(hash(fs.readFileSync(path.join(root,'apps/runtime/build/materialize-swc.mjs'))),'cd34a83e28ebbd70ff6acdfaf636938d30d609d86a1f509d8c0d8a7abda897fe');
  assert.equal(hash(fs.readFileSync(path.join(root,'apps/runtime/build/swc-diagnostic.mjs'))),'de82332711daf9af8a3475eb0f97305ee2b127696c08f78b04e2b9f72a2ad329');
  const recipe=fs.readFileSync(path.join(root,'apps/runtime/Dockerfile'),'utf8');
  const step='RUN --network=none node apps/runtime/build/materialize-swc.mjs';
  assert.ok(recipe.indexOf(step)>recipe.indexOf('COPY packages ./packages'));
  assert.ok(recipe.indexOf(step)<recipe.indexOf('\nUSER node'));
  assert.ok(!recipe.includes('SWC_NATIVE_BINDING_CACHE_SKIP_SECURITY_CHECK'));
});
