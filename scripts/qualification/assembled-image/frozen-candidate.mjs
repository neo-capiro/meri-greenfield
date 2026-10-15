/** Selects the reviewed, frozen proof candidate whose rows the current source bytes must equal, after verifying that it is
 * bound row by row to the immutable historical manifest. Historical hashes are verified, never used as current bytes.
 * Pure and import-safe: reads only the two manifests (or an injected reader) and never the source tree on its own. */
import {createHash} from 'node:crypto';
import {existsSync,readFileSync} from 'node:fs';
import {join} from 'node:path';

/** dot-reviewed static candidate (PACKAGE3-REVIEW-20261015). A successor candidate replaces both values together. */
export const FROZEN_CANDIDATE=Object.freeze({file:'candidate-manifest-fable-20261015f.json',sha256:'3215210633f64dcb4c8d98aa1c7e17af658c512511bc4f7bdf3df4f8a4085017'});
export const HISTORICAL_MANIFEST='source-manifest.json';
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const refuse=(code,detail)=>{throw Object.assign(Error(code+(detail?': '+detail:'')),{code});};
const fromHere=name=>readFileSync(new URL('./'+name,import.meta.url));

export function selectFrozenCandidate({read=fromHere,frozen=FROZEN_CANDIDATE}={}){
 const candidateBytes=read(frozen.file),historicalBytes=read(HISTORICAL_MANIFEST);
 if(sha256(candidateBytes)!==frozen.sha256)refuse('FROZEN_CANDIDATE_BYTES_CHANGED',frozen.file);
 const candidate=JSON.parse(candidateBytes.toString('utf8')),historical=JSON.parse(historicalBytes.toString('utf8')),historicalSha256=sha256(historicalBytes);
 if(candidate.historicalManifest?.sha256!==historicalSha256)refuse('HISTORICAL_MANIFEST_NOT_BOUND',HISTORICAL_MANIFEST);
 const rows=list=>{const map=new Map();for(const row of list??[]){if(map.has(row.path))refuse('DUPLICATE_PROOF_ROW',row.path);map.set(row.path,row);}return map;};
 const past=rows(historical.files),current=rows(candidate.files),changed=rows(candidate.changedRows);
 if(past.size===0||past.size!==current.size||[...past.keys()].some(path=>!current.has(path)))refuse('PROOF_PATHS_DIFFER');
 if([...changed.keys()].some(path=>!past.has(path)))refuse('CHANGED_ROW_OUTSIDE_PROOF');
 const expected=new Map();
 for(const [path,old] of past){
  const now=current.get(path).sha256,change=changed.get(path);
  if(change?(change.historicalSha256!==old.sha256||change.sha256!==now||now===old.sha256):now!==old.sha256)refuse('CANDIDATE_ROW_NOT_BOUND_TO_HISTORY',path);
  expected.set(path,now);
 }
 return {candidate:{file:frozen.file,sha256:frozen.sha256,changedRows:changed.size},historical:{file:HISTORICAL_MANIFEST,sha256:historicalSha256,files:[...past.values()]},expected};
}

/** Proof rows whose copy under `tree` is absent or differs from the selected candidate's bytes. */
export function proofCopyMismatches(tree,selection){
 const mismatches=[];
 for(const [path,expected] of selection.expected){
  const file=join(tree,path);
  if(!existsSync(file)){mismatches.push({path,expected,actual:null});continue;}
  const actual=sha256(readFileSync(file));if(actual!==expected)mismatches.push({path,expected,actual});
 }
 return mismatches;
}
