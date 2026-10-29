/** Fixed no-model native child boundary for upload scan/extraction. This is the upload-role counterpart of
 * `apps/runtime/artifacts/renderer-sandbox.mjs`: one bubblewrap plan spine (user/mount/network namespaces, non-root
 * 1000:1000, cap-drop all, read-only root, private owned workspace, prlimit file/fd/proc caps) shared by the probe and by
 * every real child, so the boundary that is observed is the boundary that scans and extracts. Only host-owned, fixed
 * programs and arguments are admitted; an uploaded executable, argument, environment value, plugin or configuration can
 * never reach a child.
 *
 * The observation, requirement list and child environment are the already-reviewed renderer owners
 * (`apps/artifacts/renderer-probe.mjs`, `renderer-qualification.mjs`, `renderer.mjs`); this module adds the upload role
 * policy and an evaluator that accepts the upload probe workspace name. Tool and definition roots are read-only by
 * construction (fixed `--ro-bind` entries), not by a request-supplied flag. */
import {mkdtemp,rm,realpath,lstat} from 'node:fs/promises';
import {join,dirname,basename,isAbsolute} from 'node:path';
import {runArtifactProcess} from '../../artifacts/process.mjs';
import {RENDERER_SANDBOX_REQUIREMENTS} from '../../artifacts/renderer.mjs';
import {RENDERER_PROBE_PATH,RENDERER_PROBE_SCHEMA,RENDERER_CHILD_ENV} from '../../artifacts/renderer-qualification.mjs';

/** Fixed owned paths. `/run/meri` is the declared task-local writable VOLUME seeded by apps/runtime/Dockerfile; the
 * definitions owner lives under it because a freshclam staging/refresh area must be genuinely writable at runtime,
 * which a directory merely created inside the image filesystem is not. Scratch and the definitions root are owned by
 * the pinned node UID, mode 0700, and are read-only bind entries for every child. */
export const UPLOAD_NATIVE_SCRATCH='/run/meri/upload-scratch';
export const UPLOAD_DEFINITIONS_ROOT='/run/meri/upload-definitions';
export const UPLOAD_EXTRACTOR_PATH='/opt/meri/apps/control/uploads/native/extract.py';
export const UPLOAD_SCAN_MILLISECONDS=30000;
export const UPLOAD_IMAGE_PATHS=Object.freeze({bwrap:'/usr/bin/bwrap',prlimit:'/usr/bin/prlimit',nodeExecutable:'/usr/local/bin/node',
 pythonExecutable:'/usr/bin/python3.13',scanner:'/usr/bin/clamscan',tesseract:'/usr/bin/tesseract',pdftoppm:'/usr/bin/pdftoppm',
 definitionsRoot:UPLOAD_DEFINITIONS_ROOT,extractorPath:UPLOAD_EXTRACTOR_PATH,tempRoot:UPLOAD_NATIVE_SCRATCH});
export const UPLOAD_SANDBOX_REQUIREMENTS=RENDERER_SANDBOX_REQUIREMENTS;
/** The upload child's environment: the renderer's reviewed allowlist plus `PWD`. The upload role is the one that runs its
 * child under `bwrap` (the renderer port spawns its converter directly), and `bwrap` unconditionally sets `PWD` to the
 * child's working directory before exec (`xsetenv("PWD", new_cwd, 1)`, bubblewrap.c). Without this the probe would always
 * report one environment name the allowlist did not anticipate and `noCredentials` could never be attested. `PWD` is the
 * already-attested private workspace path, not a credential, so no additional reach is admitted. */
export const UPLOAD_CHILD_ENV=Object.freeze([...RENDERER_CHILD_ENV,'PWD']);
export const UPLOAD_ROLE_PREFIX=Object.freeze({probe:'meri-upload-probe-',scan:'meri-upload-scan-',extract:'meri-upload-extract-'});
export const UPLOAD_EXTRACT_FORMATS=Object.freeze(['txt','md','pdf','docx','xlsx','pptx','png','jpg','jpeg']);
/** The single scan target name a scanner child may read; the scanner port writes exactly this file into the workspace. */
export const UPLOAD_SCAN_INPUT='input.original';
export const UPLOAD_MAX_OBSERVATION_BYTES=65536,UPLOAD_FSIZE=16777216;
const ROLES=Object.freeze(Object.keys(UPLOAD_ROLE_PREFIX));
export const uploadFault=code=>Object.assign(new Error(code),{code});
const refuse=()=>{throw uploadFault('UPLOAD_SANDBOX_REFUSED');};
/** Fixed ClamAV argument plan. `definitionsRoot` is the EXACT definition directory ClamAV reads: the immutable
 * content-addressed snapshot directory resolved for this scan, never a shared mutable database path. The directory
 * and caps are product constants; no request value is admitted.
 * `mode:'version'` is the one other admitted scanner invocation (identity observation), still host-owned. */
export function uploadScanArguments({definitionsRoot,cwd,mode='scan'}){
 if(typeof definitionsRoot!=='string'||!isAbsolute(definitionsRoot))refuse();
 if(mode==='version')return ['--version'];
 if(mode!=='scan')refuse();
 if(typeof cwd!=='string'||!isAbsolute(cwd))refuse();
 return ['--stdout','--no-summary','--database',definitionsRoot,'--official-db-only=yes',
  '--max-filesize='+UPLOAD_FSIZE,'--max-scansize='+(4*UPLOAD_FSIZE),'--max-scantime='+UPLOAD_SCAN_MILLISECONDS,
  '--alert-encrypted=yes','--alert-encrypted-archive=yes','--alert-encrypted-doc=yes','--alert-exceeds-max=yes',
  '--alert-broken=yes','--tempdir='+cwd,UPLOAD_SCAN_INPUT];
}
/** Fixed extraction argument plan: the pinned child program plus one allowlisted format token. */
export function uploadExtractArguments({extractorPath,format,mode='extract'}){
 if(typeof extractorPath!=='string'||!isAbsolute(extractorPath))refuse();
 if(mode==='version'&&format===undefined)return ['--version'];
 if(!UPLOAD_EXTRACT_FORMATS.includes(format)||mode!=='extract')refuse();
 return [extractorPath,format];
}
export function uploadProbeArguments(){return [RENDERER_PROBE_PATH];}
/** The closed bubblewrap plan. `{executable,args}` are rebuilt from the fixed role policy and then handed to the same
 * `runArtifactProcess` the renderer uses; a mismatched plan is refused before any process exists. */
export function uploadSandboxArguments({role,cwd,definitionsRoot,extractorPath,format,mode='default'}){
 const p=UPLOAD_IMAGE_PATHS;
 if(!ROLES.includes(role)||typeof cwd!=='string'||dirname(cwd)!==p.tempRoot||!isAbsolute(cwd))refuse();
 const name=basename(cwd),prefix=UPLOAD_ROLE_PREFIX[role];
 if(!new RegExp('^'+prefix+'[A-Za-z0-9]{6}$','u').test(name))refuse();
 let executable,args,roots;
 if(role==='probe'){if(mode!=='default')refuse();executable=p.nodeExecutable;args=uploadProbeArguments();
  roots=['--dir','/opt','--dir','/opt/meri','--dir','/opt/meri/apps','--dir','/opt/meri/apps/artifacts','--ro-bind',RENDERER_PROBE_PATH,RENDERER_PROBE_PATH];}
 else if(role==='scan'){executable=p.scanner;args=uploadScanArguments({definitionsRoot,cwd,mode:mode==='version'?'version':'scan'});roots=['--ro-bind',definitionsRoot,definitionsRoot];}
 else{executable=p.pythonExecutable;args=uploadExtractArguments({extractorPath,format,mode:mode==='version'?'version':'extract'});roots=['--ro-bind',extractorPath,extractorPath];}
 return ['--unshare-all','--die-with-parent','--new-session','--uid','1000','--gid','1000','--cap-drop','ALL','--tmpfs','/',
  '--ro-bind','/usr','/usr','--ro-bind-try','/lib','/lib','--ro-bind-try','/lib64','/lib64','--ro-bind-try','/bin','/bin',
  '--dir','/etc','--ro-bind-try','/etc/ld.so.cache','/etc/ld.so.cache',
  '--proc','/proc','--dev','/dev','--dir','/sys','--dir','/sys/fs','--ro-bind','/sys/fs/cgroup','/sys/fs/cgroup',
  ...roots,'--dir','/tmp','--bind',cwd,cwd,'--chdir',cwd,'--remount-ro','/',
  '--',p.prlimit,'--fsize='+UPLOAD_FSIZE+':'+UPLOAD_FSIZE,'--nofile=128:128','--nproc=64:64','--',executable,...args];
}
/** Run one fixed role child. Same host modality checks the renderer runner applies: Linux, real UID 1000, an owned
 * non-symlink 0700 realpath-stable workspace directly under the temp root. */
export async function runUploadSandbox(role,{cwd,definitionsRoot,extractorPath,format,mode,input=Buffer.alloc(0),signal,deadlineMs,maxOutput}){
 const p=UPLOAD_IMAGE_PATHS,s=await lstat(cwd);
 if(process.platform!=='linux'||process.getuid?.()!==1000||s.isSymbolicLink()||!s.isDirectory()||s.uid!==1000||
  (s.mode&0o777)!==0o700||await realpath(cwd)!==cwd)refuse();
 const args=uploadSandboxArguments({role,cwd,definitionsRoot,extractorPath,format,mode});
 return runArtifactProcess(p.bwrap,args,{cwd,input,signal,deadlineMs,...(maxOutput===undefined?{}:{maxOutput})});
}
const positiveIds=value=>Array.isArray(value)&&value.length===4&&value.every(n=>Number.isSafeInteger(n)&&n>0);
const zeroCaps=value=>typeof value==='string'&&/^0{16}$/u.test(value);
const UNLIMITED=2n**62n;
function finiteLimit(value,{quota=false}={}){
 if(typeof value!=='string')return false;
 const first=quota?value.split(/\s+/u)[0]:value;
 if(!/^[0-9]{1,20}$/u.test(first))return false;
 const n=BigInt(first);return n>0n&&n<UNLIMITED;
}
/** The numeric boundary the host actually reported. Three distinct states survive here so the event can tell an
 * ABSENT source from a source that is present but UNLIMITED: a finite value, `0` for a cgroup entry the host reports as
 * `max` (present, no limit), or `null` when the source was absent or non-numeric. Content-free: numbers only, never the
 * raw text. A valid limit is always > 0 (`finiteLimit`), so `0` cannot be mistaken for one. */
function numericLimit(value,{quota=false}={}){
 if(typeof value!=='string')return null;
 const first=quota?value.split(/\s+/u)[0]:value;
 if(/^max$/u.test(first))return 0;
 if(!/^[0-9]{1,20}$/u.test(first))return null;
 const n=Number(first);return Number.isSafeInteger(n)?n:null;
}
/** Pure: one probe observation -> the eight shared requirement flags. Mirrors the renderer evaluator but accepts the
 * upload probe workspace prefix; malformed input is all false and never throws. */
export function evaluateUploadSandbox(observation,{tempRoot}={}){
 const o=observation!==null&&typeof observation==='object'&&!Array.isArray(observation)?observation:{};
 const linux=o.schema===RENDERER_PROBE_SCHEMA&&o.platform==='linux';
 const caps=o.capabilities&&typeof o.capabilities==='object'?o.capabilities:{};
 const cg=o.cgroup&&typeof o.cgroup==='object'?o.cgroup:{};
 const ifaces=Array.isArray(o.interfaces)?o.interfaces:null,env=Array.isArray(o.envNames)?o.envNames:null;
 const creds=Array.isArray(o.credentialPathsReadable)?o.credentialPathsReadable:null;
 const ws=o.workspace&&typeof o.workspace==='object'?o.workspace:null;
 const sandbox={
  nonRootUser:linux&&positiveIds(o.uid)&&positiveIds(o.gid),
  noNetwork:linux&&ifaces!==null&&ifaces.length>0&&ifaces.every(name=>name==='lo'),
  readOnlyRootFilesystem:linux&&typeof o.rootMountOptions==='string'&&o.rootMountOptions.split(',').includes('ro'),
  noNewPrivileges:linux&&o.noNewPrivs===1,
  dropAllCapabilities:linux&&['CapInh','CapPrm','CapEff','CapAmb'].every(k=>zeroCaps(caps[k])),
  privateWorkspace:linux&&typeof o.cwd==='string'&&typeof tempRoot==='string'&&dirname(o.cwd)===tempRoot&&
   basename(o.cwd).startsWith(UPLOAD_ROLE_PREFIX.probe)&&/^[A-Za-z0-9]{6}$/u.test(basename(o.cwd).slice(UPLOAD_ROLE_PREFIX.probe.length))&&
   o.home===o.cwd&&o.tmpdir===o.cwd&&ws!==null&&ws.mode===0o700&&positiveIds(o.uid)&&ws.uid===o.uid[1],
  boundedResources:linux&&finiteLimit(cg.memoryMax)&&finiteLimit(cg.pidsMax)&&finiteLimit(cg.cpuMax,{quota:true}),
  noCredentials:false,
 };
 const envAllowed=env!==null&&env.every(name=>UPLOAD_CHILD_ENV.includes(name));
 sandbox.noCredentials=linux&&sandbox.noNetwork&&envAllowed&&
  creds!==null&&creds.every(c=>c&&c.readable===false);
 const diagnostic=Object.freeze({
  resources:Object.freeze({memoryMax:numericLimit(cg.memoryMax),pidsMax:numericLimit(cg.pidsMax),cpuMax:numericLimit(cg.cpuMax,{quota:true})}),
  credentials:Object.freeze({networkIsolated:sandbox.noNetwork,envCount:env===null?0:env.length,
   allowedCount:UPLOAD_CHILD_ENV.length,envAllowed,
   checked:creds===null?0:creds.length,readable:creds===null?0:creds.filter(c=>c&&c.readable===true).length})
 });
 const findings=UPLOAD_SANDBOX_REQUIREMENTS.filter(k=>sandbox[k]!==true).map(requirement=>({requirement,reason:linux?'NOT_OBSERVED':'NOT_LINUX'}));
 return {sandbox:Object.freeze(sandbox),findings:Object.freeze(findings),diagnostic};
}
/** Observe the upload child boundary and issue an admission only when every shared requirement is attested. The probe
 * runs through the identical `runUploadSandbox('probe',...)` path scan/extract use, in the same owned workspace kind. */
export async function qualifyNativeUploadSandbox({imageDigest,deadlineMs,signal,credentialPaths=[],tempRoot=UPLOAD_IMAGE_PATHS.tempRoot,run=runUploadSandbox}={}){
 if(typeof imageDigest!=='string'||!/^sha256:[a-f0-9]{64}$/u.test(imageDigest)||!Number.isSafeInteger(deadlineMs)||
  !Array.isArray(credentialPaths)||credentialPaths.length>64||!credentialPaths.every(p=>typeof p==='string'&&isAbsolute(p)))
  throw uploadFault('UPLOAD_QUALIFICATION_CONFIGURATION');
 const workspace=await mkdtemp(join(tempRoot,UPLOAD_ROLE_PREFIX.probe));
 try{
  const input=Buffer.from(JSON.stringify({credentialPaths}));
  const out=(await run('probe',{cwd:workspace,input,signal,deadlineMs})).stdout;
  if(out.length<2||out.length>UPLOAD_MAX_OBSERVATION_BYTES)return {admitted:false,reason:'UPLOAD_PROBE_INVALID',evaluation:null,missing:[...UPLOAD_SANDBOX_REQUIREMENTS]};
  const evaluation=evaluateUploadSandbox(JSON.parse(out.toString('utf8')),{tempRoot:await realpath(tempRoot).catch(()=>null)});
  const missing=evaluation.findings.map(f=>f.requirement);
  if(missing.length)return {admitted:false,reason:'UPLOAD_SANDBOX_UNQUALIFIED',evaluation,missing,diagnostic:evaluation.diagnostic};
  // Tool/definition roots are read-only bind entries of the fixed plan above, so they share this admission.
  return {admitted:true,reason:'UPLOAD_SANDBOX_QUALIFIED',admission:Object.freeze({role:'upload-native',imageDigest,qualificationId:'upload-native-'+imageDigest.slice(7),
   sandbox:Object.freeze({...evaluation.sandbox}),toolRootsReadOnly:true}),evaluation,missing:[]};
 }catch(error){return {admitted:false,reason:typeof error?.code==='string'?error.code:'UPLOAD_PROBE_FAILED',evaluation:null,missing:[...UPLOAD_SANDBOX_REQUIREMENTS]};}
 finally{await rm(workspace,{recursive:true,force:true});}
}
