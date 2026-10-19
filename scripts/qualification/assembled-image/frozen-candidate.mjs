/** Selects the reviewed, frozen proof candidate whose rows the current source bytes must equal, after verifying that it is
 * bound row by row to the immutable historical manifest. Historical hashes are verified, never used as current bytes.
 * Pure and import-safe: reads only the two manifests (or an injected reader) and never the source tree on its own. */
import {createHash} from 'node:crypto';
import {existsSync,readFileSync} from 'node:fs';
import {join} from 'node:path';

/** Exact source-only successor. Image admission remains a separate gate. */
export const FROZEN_CANDIDATE=Object.freeze({file:'candidate-manifest-fable-20261015m.json',sha256:'9350fb7a077d42369a5a2dc14f598dd228c67a21de76cd6791465581db6d381c'});
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
 // Additional exact-source rows cover the combined repair outside the immutable historical path set.
 const supplement=candidate.supplementalSourceProof,validSha=value=>typeof value==='string'&&/^[a-f0-9]{64}$/u.test(value);
 if(!supplement||!Array.isArray(supplement.files)||supplement.sourceCommit!==candidate.candidateSourceCommit||
  !/^[a-f0-9]{40}$/u.test(supplement.sourceCommit)||!/^[a-f0-9]{40}$/u.test(supplement.baseSourceCommit)||supplement.sourceCommit===supplement.baseSourceCommit||
  !/^[a-f0-9]{40}$/u.test(supplement.previousCandidateSourceCommit)||supplement.previousCandidateSourceCommit===supplement.sourceCommit)refuse('SUPPLEMENTAL_SOURCE_NOT_BOUND');
 const additional=rows(supplement.files);
 let production=0,regression=0,copied=0;
 for(const [path,row] of additional){
  if(past.has(path))refuse('SUPPLEMENTAL_PATH_COLLIDES_WITH_HISTORY',path);
  if(typeof path!=='string'||!/^apps\/[A-Za-z0-9._/-]+$/u.test(path)||path.split('/').some(part=>!part||part==='.'||part==='..')||
   !validSha(row.sha256)||!Number.isSafeInteger(row.bytes)||row.bytes<1||typeof row.dockerCopy!=='boolean'||
   !['production','regression'].includes(row.kind)||row.kind==='production'&&!row.dockerCopy||
   !['added','modified'].includes(row.change)||(row.change==='added'?row.previousSha256!==null:!validSha(row.previousSha256)||row.previousSha256===row.sha256)||
   !(row.previousCandidateSha256===null&&row.change==='added'||validSha(row.previousCandidateSha256))||
   typeof row.reason!=='string'||!row.reason||typeof row.decision!=='string'||!row.decision)refuse('INVALID_SUPPLEMENTAL_ROW',path);
  if(row.kind==='production')production++;else regression++;
  if(row.dockerCopy){copied++;expected.set(path,row.sha256);}
 }
 if(production!==supplement.productionFileCount||regression!==supplement.regressionFileCount||copied!==supplement.dockerCopyFileCount||production===0)refuse('SUPPLEMENTAL_COUNTS_DIFFER');
 return {candidate:{file:frozen.file,sha256:frozen.sha256,changedRows:changed.size},historical:{file:HISTORICAL_MANIFEST,sha256:historicalSha256,files:[...past.values()]},supplemental:{files:[...additional.values()],copiedFiles:copied},expected};
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
