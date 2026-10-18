import path from 'node:path';
export const target=Object.freeze({host:'127.0.0.1',port:55436,database:'meri_prefs_task6_qual_20261017',restoreDatabase:'meri_prefs_task6_restore_20261017',sqlBlob:'048a834c4335f97aa5f8691afc3c310188ec4388'});
export const usage=`Usage: node scripts/qualification/user-preferences/cli.mjs --help
  --plan|--execute --repo ABS --out ABS [--pg-bin ABS]
  --source-commit 40HEX --source-tree 40HEX
Execution additionally requires future approval and:
  --approval-ref NONSECRET --approved-until UTC_ISO
Fixed disposable target: 127.0.0.1:55436/meri_prefs_task6_qual_20261017
--help/--plan perform no database/process/filesystem I/O.
Exit: 0 help/plan or fully verified run; 1 execution failed; 2 invalid arguments.
`;
const bad=label=>{const error=Error(label);error.code='USAGE';throw error;};
export function configuration(argv,now=Date.now()){
 if(argv.length===1&&argv[0]==='--help')return {mode:'help'};
 const values={},switches=new Set(['--plan','--execute']),keys=new Set(['--repo','--out','--pg-bin','--source-commit','--source-tree','--approval-ref','--approved-until']);
 for(let i=0;i<argv.length;i++){
  const key=argv[i];if(Object.hasOwn(values,key)||!switches.has(key)&&!keys.has(key))bad('UNKNOWN_OR_DUPLICATE_ARGUMENT');
  if(switches.has(key))values[key]=true;else{const value=argv[++i];if(!value||value.startsWith('--')||/[\x00-\x1f\x7f]/u.test(value))bad('MISSING_OR_UNSAFE_ARGUMENT');values[key]=value;}
 }
 if(Boolean(values['--plan'])===Boolean(values['--execute']))bad('CHOOSE_PLAN_OR_EXECUTE');
 for(const key of ['--repo','--out'])if(!values[key]||!path.isAbsolute(values[key])||path.resolve(values[key])===path.parse(values[key]).root)bad('EXPLICIT_ABSOLUTE_REPO_AND_OUT_REQUIRED');
 for(const key of ['--source-commit','--source-tree'])if(!/^[a-f0-9]{40}$/u.test(values[key]??''))bad('FULL_SOURCE_COMMIT_AND_TREE_REQUIRED');
 if(values['--pg-bin']&&!path.isAbsolute(values['--pg-bin']))bad('ABSOLUTE_PG_BIN_REQUIRED');
 const repo=path.resolve(values['--repo']),out=path.resolve(values['--out']);
 const relative=path.relative(repo,out);if(!relative||!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative))bad('OUTPUT_MUST_BE_OUTSIDE_SOURCE');
 const result={mode:values['--execute']?'execute':'plan',repo,out,pgBin:values['--pg-bin']?path.resolve(values['--pg-bin']):null,sourceCommit:values['--source-commit'],sourceTree:values['--source-tree'],target};
 if(result.mode==='execute'){
  const cutoff=Date.parse(values['--approved-until']??'');
  if(!/^[\w .:/-]{1,160}$/u.test(values['--approval-ref']??'')||!values['--approved-until']?.endsWith('Z')||!Number.isFinite(cutoff)||cutoff<=now+120000||cutoff>now+1200000)bad('EXPLICIT_FUTURE_APPROVAL_REFERENCE_AND_TWO_TO_TWENTY_MINUTE_WINDOW_REQUIRED');
  result.cutoff=cutoff;result.approvalReferenceProvided=true;
 }else if(values['--approval-ref']||values['--approved-until'])bad('APPROVAL_FLAGS_ARE_EXECUTION_ONLY');
 return Object.freeze(result);
}
