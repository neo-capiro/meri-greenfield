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
const candidate=JSON.parse(fs.readFileSync(new URL('./candidate-manifest-fable-20261015.json',import.meta.url),'utf8'));

test('the preceding Fable and dot candidates are preserved byte-exact and the new candidate carries no image acceptance',()=>{
 const fable=hash(fs.readFileSync(new URL('./candidate-manifest-fable-20261014.json',import.meta.url))),dot=JSON.parse(fs.readFileSync(new URL('./candidate-manifest-dot-20261014.json',import.meta.url),'utf8')),previous=hash(fs.readFileSync(new URL('./candidate-manifest-dot-20261014.json',import.meta.url)));
 assert.equal(fable,'dc425cffa60a5a6bffc2d089cdf421be33694c3682d99d7c6b2b7818d3e1c627');assert.equal(dot.previousCandidate.sha256,fable);
 assert.equal(previous,'fb97f11639d173fd15781df776ea8c49d9c2c53cc868dc9e8512e957195b310b');assert.equal(candidate.previousCandidate.sha256,previous);assert.equal(candidate.status,'CANDIDATE_HOLD_SOURCE_REVIEW');
 assert.equal(candidate.pickupHead,'215930c8092577e84da563b1496d1cca9a4ad4d7');assert.deepEqual(candidate.historicalManifest,dot.historicalManifest);assert.deepEqual(candidate.priorPublishedDotManifest,dot.priorPublishedDotManifest);
 for(const row of dot.changedRows)assert.deepEqual(candidate.changedRows.find(r=>r.path===row.path),row,row.path+': every dot-enumerated change is carried unchanged');
});

test('all45 historical proof paths and44 non-recipe hashes remain in the preserved historical manifest',()=>{
  assert.equal(proof.files.length,45);
  assert.equal(hash(proof.files.map(row=>row.path).sort().join('\n')+'\n'),'d340511c6f520b2de292626640a96f06df1c0284ff29bb960cbbfd8d37b6fde8');
  assert.equal(hash(proof.files.filter(row=>row.path!=='apps/runtime/Dockerfile').sort((a,b)=>a.path.localeCompare(b.path)).map(row=>row.path+':'+row.sha256).join('\n')+'\n'),'79e334ed6f997a9bf3938c31dcbd9bb368b617754f589f0168c302d02344cd32');
  assert.equal(proof.sourceHead,null);assert.equal(proof.publicationSource,null);
  assert.equal(hash(fs.readFileSync(new URL('./source-manifest.json',import.meta.url))),candidate.historicalManifest.sha256,'the historical manifest bytes are the ones the candidate was derived from');
});

test('the candidate manifest enumerates every changed proof row with both hashes, a reason and the recorded decision; every other row equals its historical bytes; the recipe is unchanged',()=>{
  assert.equal(candidate.files.length,45);assert.equal(candidate.sourceHead,null);assert.equal(candidate.publicationSource,null);
  assert.deepEqual(candidate.files.map(row=>row.path).sort(),proof.files.map(row=>row.path).sort());
  const changed=new Map(candidate.changedRows.map(row=>[row.path,row]));
  assert.equal(changed.size,candidate.changedRows.length);assert.equal(changed.size,candidate.changedRowCount);assert.equal(45-changed.size,candidate.unchangedRowCount);assert.ok(changed.size>0&&changed.size<45);assert.ok(!changed.has('apps/runtime/Dockerfile'));
  for(const row of proof.files){
    const current=hash(fs.readFileSync(path.join(root,row.path))),declared=candidate.files.find(f=>f.path===row.path);
    assert.equal(current,declared.sha256,row.path);
    const change=changed.get(row.path);
    if(change){assert.equal(change.historicalSha256,row.sha256,row.path);assert.equal(change.sha256,current,row.path);assert.notEqual(change.sha256,change.historicalSha256,row.path);assert.ok(typeof change.reason==='string'&&change.reason.length>0&&typeof change.decision==='string'&&change.decision.length>0,row.path);}
    else assert.equal(current,row.sha256,row.path);
  }
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
