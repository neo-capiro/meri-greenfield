/** Reproduce the bounded PR193 source proof from immutable Git objects; never read production worktree bytes. */
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';

export const SOURCE_COMMIT='5b395d4ce9218b872b21c420dc00a3af31739824';
export const BASE_SOURCE_COMMIT='a16cc40d2a7ca3695eb6cc5a8d45440d0c40d040';
export const PREVIOUS_SOURCE_COMMIT='9acbfe7168eb4e9c1e2c3acb02e2a28d08bbd262';
export const CANDIDATE_FILE='candidate-manifest-fable-20261015m.json';
const PREDECESSOR_FILE='candidate-manifest-fable-20261015l.json';
const PREDECESSOR_SHA256='81d3edec29a2d720089e3d5ff127732ceed11950c17707ca3f58141644925c45';
const CONTROL='apps/runtime/control.mjs';
const NEW_REGRESSION='apps/runtime/test/worker-load-retention.test.mjs';
const WORKER='apps/runtime/worker-http.mjs';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const decision='Exact combined source proof only; HOLD. No image, security, or live acceptance transfers.';
const supplemental=[
 {path:'apps/control/action-host/session/authenticated-current-state.test.mjs',kind:'regression',dockerCopy:true,reason:'Retain load authority checkpoints and the three combined-reader caller-cancellation regressions.'},
 {path:'apps/control/action-host/session/cancellation.test.mjs',kind:'regression',dockerCopy:true,reason:'Retain the original 44-case cancellation regression file byte-exact from the cancellation repair.'},
 {path:'apps/control/action-host/session/owner.mjs',kind:'production',dockerCopy:true,reason:'Combine fresh authenticated current-state reads with preservation only after the exact winning caller cancellation; deadline and invalid-authority failures still remove the session.'},
 {path:'apps/control/conversations/service.mjs',kind:'production',dockerCopy:true,reason:'Resolve load-session authority once per existing checkpoint through the private owner capability, retaining fallback and non-load observations.'},
 {path:'apps/control/conversations/test/load-amplification.test.mjs',kind:'regression',dockerCopy:false,reason:'Retain the frozen load-count, freshness, authority, retention, and synthetic latency regressions.'},
 {path:NEW_REGRESSION,kind:'regression',dockerCopy:false,reason:'Verify canonical retention release ordering, refusal before serialization, effective authority expiry, cancellation, cleanup, and malformed release configuration.'},
 {path:WORKER,kind:'production',dockerCopy:true,reason:'Retain the authenticated current-state load capability and serialize configured load responses inside canonical withRelease after final task verification and a scoped retention assertion, with cancellation and effective authority deadlines preserved.'},
];

/** No work is performed on import. The injected Git reader supports focused failure checks without modifying a checkout. */
export function generateCandidate({git=(...args)=>execFileSync('git',args,{cwd:root,maxBuffer:8*1024*1024}),read=name=>readFileSync(new URL('./'+name,import.meta.url))}={}){
 const predecessorBytes=read(PREDECESSOR_FILE);
 if(sha256(predecessorBytes)!==PREDECESSOR_SHA256)throw Error('PREDECESSOR_BYTES_CHANGED');
 const predecessor=JSON.parse(predecessorBytes.toString('utf8'));
 if(predecessor.candidateSourceCommit!==PREVIOUS_SOURCE_COMMIT)throw Error('PREDECESSOR_SOURCE_CHANGED');
 const historicalBytes=read('source-manifest.json');
 if(sha256(historicalBytes)!==predecessor.historicalManifest.sha256)throw Error('HISTORICAL_BYTES_CHANGED');
 const changedSince=commit=>git('diff','--name-only','--no-renames',commit,SOURCE_COMMIT).toString('utf8').trim().split('\n').filter(name=>name&&!name.startsWith('docs/')).sort();
 if(JSON.stringify(changedSince(BASE_SOURCE_COMMIT))!==JSON.stringify([CONTROL,...supplemental.map(row=>row.path)].sort()))throw Error('UNREVIEWED_SOURCE_DELTA');
 if(JSON.stringify(changedSince(PREVIOUS_SOURCE_COMMIT))!==JSON.stringify([CONTROL,NEW_REGRESSION,WORKER].sort()))throw Error('UNREVIEWED_PREDECESSOR_DELTA');
 for(const ancestor of [PREVIOUS_SOURCE_COMMIT,'546782fb28f0e496004f6fca790734409ff96969','816b5873d693f49d0383c0808d1d2319f246052a'])git('merge-base','--is-ancestor',ancestor,SOURCE_COMMIT);
 const blob=(commit,path)=>git('show',`${commit}:${path}`);
 const candidate=structuredClone(predecessor);
 candidate.files=predecessor.files.map(row=>{
  const current=sha256(blob(SOURCE_COMMIT,row.path));
  if(row.path===CONTROL?current===row.sha256:current!==row.sha256)throw Error('UNREVIEWED_HISTORICAL_ROW_DELTA: '+row.path);
  if(row.path===CONTROL){
   const change=candidate.changedRows.find(entry=>entry.path===row.path);
   if(!change)throw Error('HISTORICAL_CONTROL_ROW_MISSING');
   change.previousCandidateSha256=row.sha256;change.sha256=current;
   change.reason+=' Retention-release successor: inject the exact canonical retention gate into the worker HTTP boundary so configured load response serialization uses its serving lease.';
   change.decision=decision;
  }
  return {...row,sha256:current};
 });
 candidate.rule='The historical manifest and all preceding candidates through l remain byte-exact; l is superseded evidence. The original 45 proof paths retain all historical hashes; control.mjs alone changes from l and names its exact l predecessor. Together with that control row, supplementalSourceProof binds every non-doc path changed from a16 to the reviewed retention-release source: four production files and four regressions. Supplemental rows record both a16 and l predecessor bytes or absence. Five supplemental dockerCopy rows add to the original45; the load and worker-retention regressions are source-only. The fixed image gate remains B6/R6/W12 (24 cases), with the separate startup-budget regression requiring exact-source Linux evidence. This proof grants no image or live admission.';
 candidate.previousCandidate={path:PREDECESSOR_FILE,sha256:PREDECESSOR_SHA256};
 candidate.candidateSourceCommit=SOURCE_COMMIT;
 candidate.supplementalSourceProof={
  baseSourceCommit:BASE_SOURCE_COMMIT,
  sourceCommit:SOURCE_COMMIT,
  previousCandidateSourceCommit:PREVIOUS_SOURCE_COMMIT,
  scope:'Every non-doc path changed from the a16 base and outside the original45 proof paths; apps/runtime/control.mjs is covered by its historical row. Prior-candidate hashes bind the exact superseded l source.',
  productionFileCount:3,regressionFileCount:4,dockerCopyFileCount:5,
  files:supplemental.map(spec=>{
   const bytes=blob(SOURCE_COMMIT,spec.path);
   const exists=git('ls-tree',BASE_SOURCE_COMMIT,'--',spec.path).length>0;
   const existedPreviously=git('ls-tree',PREVIOUS_SOURCE_COMMIT,'--',spec.path).length>0;
   return {...spec,change:exists?'modified':'added',previousSha256:exists?sha256(blob(BASE_SOURCE_COMMIT,spec.path)):null,previousCandidateSha256:existedPreviously?sha256(blob(PREVIOUS_SOURCE_COMMIT,spec.path)):null,sha256:sha256(bytes),bytes:bytes.length,decision};
  }),
 };
 return Buffer.from(JSON.stringify(candidate,null,1)+'\n');
}

function main(args){
 if(args.length===1&&['--help','-h'].includes(args[0])){
  console.log('Usage: node scripts/qualification/assembled-image/generate-pr193-candidate.mjs --check|--write\nReproduce candidate m from exact 5b395d4c Git blobs and retained l. --check reads only; --write updates only candidate m.\nExit codes: 0 success, 1 source/manifest mismatch or Git/read failure, 2 invalid arguments.');return 0;
 }
 if(args.length!==1||!['--check','--write'].includes(args[0])){console.error('Use --help for usage.');return 2;}
 try{
  const bytes=generateCandidate(),target=new URL('./'+CANDIDATE_FILE,import.meta.url);
  if(args[0]==='--write')writeFileSync(target,bytes);
  else if(!readFileSync(target).equals(bytes))throw Error('GENERATED_CANDIDATE_DIFFERS');
  console.log(JSON.stringify({file:CANDIDATE_FILE,sha256:sha256(bytes),bytes:bytes.length,sourceCommit:SOURCE_COMMIT,historicalPaths:45,supplementalPaths:7,dockerCopyPaths:50}));return 0;
 }catch(error){console.error(error.message);return 1;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)process.exitCode=main(process.argv.slice(2));
