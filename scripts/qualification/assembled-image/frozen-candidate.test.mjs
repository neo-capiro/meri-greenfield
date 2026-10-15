/** Frozen-candidate selection for the Docker COPY byte check. Runs without Docker: the copied tree is a temporary directory. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {copyFileSync,mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {FROZEN_CANDIDATE,HISTORICAL_MANIFEST,proofCopyMismatches,selectFrozenCandidate} from './frozen-candidate.mjs';
const root=fileURLToPath(new URL('../../../',import.meta.url)),here=name=>readFileSync(new URL('./'+name,import.meta.url));
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const journal='apps/control/conversations/native-preparation-journal.mjs';
function copiedTree(t,paths){
 const tree=mkdtempSync(join(tmpdir(),'meri-frozen-candidate-'));t.after(()=>rmSync(tree,{recursive:true,force:true}));
 for(const path of paths){mkdirSync(dirname(join(tree,path)),{recursive:true});copyFileSync(join(root,path),join(tree,path));}
 return tree;
}
/** Reader over edited copies of the real manifests; `frozen` is re-pinned so only the injected inconsistency is tested. */
function edited(editCandidate=c=>c,editHistorical=h=>h){
 const historical=Buffer.from(JSON.stringify(editHistorical(JSON.parse(here(HISTORICAL_MANIFEST).toString('utf8')))));
 const candidate=JSON.parse(here(FROZEN_CANDIDATE.file).toString('utf8'));candidate.historicalManifest={...candidate.historicalManifest,sha256:sha256(historical)};
 const candidateBytes=Buffer.from(JSON.stringify(editCandidate(candidate)));
 return {read:name=>name===HISTORICAL_MANIFEST?historical:candidateBytes,frozen:{file:FROZEN_CANDIDATE.file,sha256:sha256(candidateBytes)}};
}

test('the reviewed candidate f is selected and bound to every historical row: 45 paths, 18 changed, 27 unchanged',()=>{
 const s=selectFrozenCandidate();
 assert.equal(s.candidate.sha256,'3215210633f64dcb4c8d98aa1c7e17af658c512511bc4f7bdf3df4f8a4085017');
 assert.equal(s.historical.files.length,45);assert.equal(s.expected.size,45);assert.equal(s.candidate.changedRows,18);
 assert.equal(s.historical.files.filter(row=>row.sha256===s.expected.get(row.path)).length,27);
 const old=s.historical.files.find(row=>row.path===journal);
 assert.equal(old.sha256,'6f0d34c67d179af93f15dd6179c56a4ae437f1ca63250baf637a836df8dd63a5','historical bytes are retained and verified');
 assert.equal(s.expected.get(journal),'b8aadcb9ca7b06cb5ad9571da5b72b1134827b7c949498a949a54dcbafb439c9','current bytes come from the frozen candidate');
});

test('a COPY tree holding the current reviewed bytes passes; the obsolete historical hashes could never match it',t=>{
 const s=selectFrozenCandidate(),tree=copiedTree(t,[...s.expected.keys()]);
 assert.deepEqual(proofCopyMismatches(tree,s),[]);
 // The former assertion compared the copy with the historical manifest: every changed row fails regardless of Docker.
 const stale=s.historical.files.filter(row=>sha256(readFileSync(join(tree,row.path)))!==row.sha256).map(row=>row.path);
 assert.equal(stale.length,18);assert.ok(stale.includes(journal));
});

test('a copy that is excluded or differs from the frozen bytes is reported per path',t=>{
 const s=selectFrozenCandidate(),paths=[...s.expected.keys()],tree=copiedTree(t,paths.filter(path=>path!=='apps/runtime/Dockerfile'));
 writeFileSync(join(tree,journal),readFileSync(join(tree,journal),'utf8')+'\n// drift\n');
 const found=proofCopyMismatches(tree,s);
 assert.deepEqual(found.map(m=>m.path).sort(),['apps/runtime/Dockerfile',journal].sort());
 assert.equal(found.find(m=>m.path==='apps/runtime/Dockerfile').actual,null);
 assert.equal(found.find(m=>m.path===journal).expected,s.expected.get(journal));
});

test('any edit to the frozen candidate bytes refuses selection, even a whitespace-only one',()=>{
 const bytes=Buffer.concat([here(FROZEN_CANDIDATE.file),Buffer.from('\n')]);
 assert.throws(()=>selectFrozenCandidate({read:name=>name===FROZEN_CANDIDATE.file?bytes:here(name)}),{code:'FROZEN_CANDIDATE_BYTES_CHANGED'});
});

test('a historical manifest that the candidate does not name byte-exact refuses selection',()=>{
 const historical=Buffer.concat([here(HISTORICAL_MANIFEST),Buffer.from(' ')]);
 assert.throws(()=>selectFrozenCandidate({read:name=>name===HISTORICAL_MANIFEST?historical:here(name)}),{code:'HISTORICAL_MANIFEST_NOT_BOUND'});
});

test('internally inconsistent candidates refuse: unbound changed/unchanged rows, path drift and duplicate rows',()=>{
 const refuses=(code,...edits)=>assert.throws(()=>selectFrozenCandidate(edited(...edits)),{code});
 assert.doesNotThrow(()=>selectFrozenCandidate(edited()),'the re-pinned unedited copy is consistent');
 refuses('CANDIDATE_ROW_NOT_BOUND_TO_HISTORY',c=>{c.changedRows.find(r=>r.path===journal).historicalSha256='0'.repeat(64);return c;});
 refuses('CANDIDATE_ROW_NOT_BOUND_TO_HISTORY',c=>{c.changedRows=c.changedRows.filter(r=>r.path!==journal);return c;});
 refuses('CANDIDATE_ROW_NOT_BOUND_TO_HISTORY',c=>{const unchanged=c.files.find(f=>!c.changedRows.some(r=>r.path===f.path));unchanged.sha256='1'.repeat(64);return c;});
 refuses('CANDIDATE_ROW_NOT_BOUND_TO_HISTORY',c=>{c.files.find(f=>f.path===journal).sha256='2'.repeat(64);return c;});
 refuses('PROOF_PATHS_DIFFER',c=>{c.files=c.files.slice(1);return c;});
 refuses('PROOF_PATHS_DIFFER',c=>c,h=>{h.files=h.files.slice(1);return h;});
 refuses('CHANGED_ROW_OUTSIDE_PROOF',c=>{c.changedRows.push({...c.changedRows[0],path:'apps/runtime/elsewhere.mjs'});return c;});
 refuses('DUPLICATE_PROOF_ROW',c=>{c.files.push(c.files[0]);return c;});
});

test('the static source proof and the Docker COPY check select the same frozen candidate file',()=>{
 assert.ok(readFileSync(join(root,'scripts/qualification/assembled-image/source-proof.test.mjs'),'utf8').includes(`'./${FROZEN_CANDIDATE.file}'`));
 assert.match(readFileSync(join(root,'apps/runtime/test/image-closure.test.mjs'),'utf8'),/proofCopyMismatches\(tree,proof\)/u);
});
