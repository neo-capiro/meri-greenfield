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
import {mkdtemp,rm,realpath,lstat,readFile} from 'node:fs/promises';
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
const CGROUP_MOUNT='/sys/fs/cgroup';
const CGROUP_FILES=Object.freeze({
 memoryMax:Object.freeze(['memory.max']),
 pidsMax:Object.freeze(['pids.max']),
 cpuMax:Object.freeze(['cpu.max'])
});
const CGROUP_DIR_MARKERS=Object.freeze(['cgroup.controllers','memory.max','pids.max','cpu.max']);
function cgroupSegments(cgroupPath){
 if(typeof cgroupPath!=='string'||!cgroupPath.startsWith('/'))return null;
 const parts=cgroupPath.split('/').filter(Boolean);
 if(parts.some(part=>part==='.'||part==='..'))return null;
 return parts;
}
function cgroupLevels(cgroupPath,mount){
 const parts=cgroupSegments(cgroupPath);
 if(parts===null||typeof mount!=='string'||!mount.startsWith('/'))return null;
 const levels=[mount];
 for(const part of parts)levels.push(levels[levels.length-1]+'/'+part);
 return levels;
}
/** Map a cgroup-namespace-relative membership path onto the selected cgroup2 mount root. A subtree-Rooted mount at
 * `mountRoot` exposes that cgroup as `/`; membership must be at or below it. An outside-root, unrelated or malformed
 * pair returns null rather than reading a branch the process does not belong to. */
function cgroupRelativePath(cgroupPath,mountRoot){
 const membership=cgroupSegments(cgroupPath),root=cgroupSegments(mountRoot);
 if(membership===null||root===null)return null;
 if(root.length===0)return '/'+membership.join('/');
 if(root.length>membership.length)return null;
 for(let i=0;i<root.length;i++)if(membership[i]!==root[i])return null;
 return '/'+membership.slice(root.length).join('/');
}
/** The unified-hierarchy path of this process. Only the `0::<path>` line is a cgroup v2 path; a v1-only layout has no
 * single path and is deliberately unresolved. Traversal components are refused rather than normalised. */
export function parseCgroupPath(text){
 if(typeof text!=='string')return null;
 for(const raw of text.split('\n')){
  // Linux /proc writes LF records; a raw CR is a path byte, not a CRLF terminator. Reject it before any
  // normalization so a CR-bearing cgroup path cannot alias the finite sibling without the CR.
  if(raw.includes('\r'))return null;
  const match=/^0::(.*)$/u.exec(raw);
  if(match===null)continue;
  const path=match[1];
  if(!path.startsWith('/'))return null;
  const parts=path.split('/').filter(Boolean);
  if(parts.some(part=>part==='.'||part==='..'))return null;
  return '/'+parts.join('/');
 }
 return null;
}
/** Decode only the mountinfo octal escapes defined for path fields (space, tab, newline, backslash). Any other
 * backslash sequence is unsupported and fails closed rather than being treated as a literal path. */
function unescapeMountField(value){
 if(typeof value!=='string')return null;
 let out='';
 for(let i=0;i<value.length;i++){
  if(value[i]!=='\\'){out+=value[i];continue;}
  const code=value.slice(i+1,i+4);
  if(code==='040'){out+=' ';i+=3;}
  else if(code==='011'){out+='\t';i+=3;}
  else if(code==='012'){out+='\n';i+=3;}
  else if(code==='134'){out+='\\';i+=3;}
  else return null;
 }
 return out;
}
/** The selected cgroup2 mount record. mountinfo is `<id> <parent> <major:minor> <root> <mountpoint> <opts> ...
 * - <fstype> <source> <superopts>`; the root field is the cgroup path the mount exposes at its mountpoint. The last
 * row for /sys/fs/cgroup is the visible mount, and it must be cgroup2. */
export function parseCgroupMount(text){
 if(typeof text!=='string')return null;
 let selected=null;
 for(const raw of text.split('\n')){
  const row=raw.trim();
  const fields=row.split(' ');
  if(fields.length<7)continue;
  const separator=fields.indexOf('-',6);
  if(separator<0||fields.length<separator+4)continue;
  const mountpoint=unescapeMountField(fields[4]);
  if(mountpoint!==CGROUP_MOUNT)continue;
  const root=unescapeMountField(fields[3]);
  if(root===null)return null;
  selected={id:fields[0],parent:fields[1],majorMinor:fields[2],root,mountpoint,fstype:fields[separator+1]};
 }
 if(selected===null||selected.fstype!=='cgroup2')return null;
 return Object.freeze(selected);
}
export function parseCgroupMountRoot(text){
 const mount=parseCgroupMount(text);
 return mount===null?null:mount.root;
}
function readFirst(read,dir,names){
 for(const name of names){const value=read(dir+'/'+name);if(typeof value==='string')return value;}
 return null;
}
/** Parse one v2 controller record. Only `max` is unlimited for memory/pids; `-1` is a v1 sentinel and is invalid in the
 * selected v2 hierarchy. CPU requires exactly two valid fields: `max|<quota> <period>` with a real kernel period range.
 * Missing, malformed, invalid-period and out-of-range values are `missing`, never a bound. */
function boundState(value,{controller}={}){
 if(typeof value!=='string')return {kind:'missing'};
 const text=value.trim();
 if(text==='')return {kind:'missing'};
 if(controller==='cpu'){
  const fields=text.split(/\s+/u);
  if(fields.length!==2)return {kind:'missing'};
  const [quotaText,periodText]=fields;
  if(!/^[0-9]{1,20}$/u.test(periodText))return {kind:'missing'};
  const period=BigInt(periodText);
  if(period<1000n||period>1000000n)return {kind:'missing'};
  if(quotaText==='max')return {kind:'max',value:text,period};
  if(!/^[0-9]{1,20}$/u.test(quotaText))return {kind:'missing'};
  const quota=BigInt(quotaText);
  if(quota>=UNLIMITED)return {kind:'missing'};
  if(quota===0n)return {kind:'zero',value:text,period};
  return {kind:'finite',value:text,quota,period};
 }
 if(text==='max')return {kind:'max',value:text};
 if(!/^[0-9]{1,20}$/u.test(text))return {kind:'missing'};
 const n=BigInt(text);
 if(n===0n)return {kind:'zero',value:text};
 if(n>=UNLIMITED)return {kind:'missing'};
 return {kind:'finite',value:text,n};
}
/** True when candidate's quota/period is strictly tighter than current's, without floating-point loss. */
function tighterCpu(candidate,current){
 const candidateQuota=candidate.kind==='zero'?0n:candidate.quota;
 const currentQuota=current.kind==='zero'?0n:current.quota;
 return candidateQuota*current.period<currentQuota*candidate.period;
}
/** Pure: the effective bound visible below the selected cgroup2 mount root. Membership is mapped relative to
 * `mountRoot` first (a subtree-rooted mount exposes that cgroup as `/`), so an unrelated branch cannot contribute. The
 * effective limit is hierarchical: a finite ancestor bounds a `max` leaf; a literal zero is the strictest failing value;
 * malformed or missing values are never a bound. `read(path)` is the only filesystem port. */
export function resolveEffectiveCgroup({cgroupPath='/',mountRoot='/',mount=CGROUP_MOUNT,read}={}){
 if(typeof read!=='function')return null;
 const relative=cgroupRelativePath(cgroupPath,mountRoot);
 if(relative===null)return null;
 const levels=cgroupLevels(relative,mount);
 if(levels===null)return null;
 const leaf=levels[levels.length-1];
 if(!CGROUP_DIR_MARKERS.some(name=>typeof read(leaf+'/'+name)==='string'))return null;
 const pickScalar=name=>{
  let best=null,unlimited=false,zero=null;
  for(const dir of levels){
   const state=boundState(readFirst(read,dir,[name]));
   if(state.kind==='zero')zero=state.value;
   else if(state.kind==='finite'&&(best===null||state.n<best.n))best=state;
   else if(state.kind==='max')unlimited=true;
  }
  if(zero!==null)return zero;
  if(best!==null)return best.value;
  return unlimited?'max':null;
 };
 const pickCpu=()=>{
  let best=null,unlimited=null,zero=null;
  for(const dir of levels){
   const state=boundState(readFirst(read,dir,['cpu.max']),{controller:'cpu'});
   if(state.kind==='zero'){
    if(zero===null||tighterCpu(state,zero))zero=state;
   } else if(state.kind==='finite'){
    if(best===null||tighterCpu(state,best))best=state;
   } else if(state.kind==='max'&&unlimited===null)unlimited=state;
  }
  if(zero!==null)return zero.value;
  if(best!==null)return best.value;
  return unlimited===null?null:unlimited.value;
 };
 return Object.freeze({levels:levels.length,mountRootIsRoot:mountRoot==='/',
  memoryMax:pickScalar('memory.max'),pidsMax:pickScalar('pids.max'),cpuMax:pickCpu()});
}
/** Combine the child's own cgroup view with the host's effective hierarchy for the same inherited cgroup. Only a
 * present-but-unlimited child value (`max`) can be filled by a finite host ancestor; a missing/malformed child value is
 * never rescued and a zero child value stays strictest. CPU compares quota/period ratios and returns the original valid
 * two-field record of the tighter contributor. */
export function combineCgroupBounds(probe,host){
 const p=probe!==null&&typeof probe==='object'?probe:{};
 const h=host!==null&&typeof host==='object'?host:{};
 const pickScalar=key=>{
  const probeState=boundState(p[key]);
  if(probeState.kind==='missing')return null;
  if(probeState.kind==='zero')return p[key];
  const hostState=boundState(h[key]);
  if(probeState.kind==='finite'){
   if(hostState.kind==='zero')return h[key];
   if(hostState.kind==='finite'&&hostState.n<probeState.n)return h[key];
   return p[key];
  }
  if(hostState.kind==='finite'||hostState.kind==='zero')return h[key];
  return p[key];
 };
 const pickCpu=()=>{
  const probeState=boundState(p.cpuMax,{controller:'cpu'});
  if(probeState.kind==='missing')return null;
  if(probeState.kind==='zero')return p.cpuMax;
  const hostState=boundState(h.cpuMax,{controller:'cpu'});
  if(probeState.kind==='max'){
   if(hostState.kind==='finite'||hostState.kind==='zero')return h.cpuMax;
   return p.cpuMax;
  }
  if(hostState.kind==='zero'||(hostState.kind==='finite'&&tighterCpu(hostState,probeState)))return h.cpuMax;
  return p.cpuMax;
 };
 return Object.freeze({memoryMax:pickScalar('memoryMax'),pidsMax:pickScalar('pidsMax'),cpuMax:pickCpu()});
}
const HOST_READ=async path=>{try{return await readFile(path,'utf8');}catch{return null;}};
function hostMountKey(mount){return mount.id+'|'+mount.majorMinor+'|'+mount.root+'|'+mount.fstype;}
async function readHostIdentity(readText){
 const [self,mountinfo]=await Promise.all([readText('/proc/self/cgroup'),readText('/proc/self/mountinfo')]);
 const cgroupPath=parseCgroupPath(self),mount=parseCgroupMount(mountinfo);
 if(cgroupPath===null||mount===null)return null;
 const relative=cgroupRelativePath(cgroupPath,mount.root);
 if(relative===null)return null;
 return Object.freeze({cgroupPath,relative,mountRoot:mount.root,mountKey:hostMountKey(mount)});
}
function hostIdentityKey(identity){return identity===null?null:identity.mountKey+'\0'+identity.cgroupPath;}
async function hostIdentitySnapshot(){
 if(process.platform!=='linux')return null;
 return readHostIdentity(HOST_READ);
}
/** Observe the host's effective cgroup witness for the same inherited membership the fixed runner's children get.
 * Membership and the selected cgroup2 mount are read before and after the controller reads; a changed identity returns
 * null, so a witness from a different cgroup/mount interval is never combined. `readText` is an injectable inert seam. */
export async function readHostCgroup({readText=HOST_READ,before=undefined,platform=process.platform}={}){
 if(platform!=='linux')return null;
 const identityBefore=before===undefined?await readHostIdentity(readText):before;
 if(identityBefore===null||identityBefore===undefined)return null;
 const levels=cgroupLevels(identityBefore.relative,CGROUP_MOUNT);
 if(levels===null)return null;
 const paths=[];
 for(const dir of levels){
  paths.push(dir+'/cgroup.controllers');
  for(const names of Object.values(CGROUP_FILES))for(const name of names)paths.push(dir+'/'+name);
 }
 const values=new Map();
 await Promise.all([...new Set(paths)].map(async path=>{const value=await readText(path);if(value!==null)values.set(path,value);}));
 const identityAfter=await readHostIdentity(readText);
 if(identityAfter===null||hostIdentityKey(identityAfter)!==hostIdentityKey(identityBefore))return null;
 return resolveEffectiveCgroup({cgroupPath:identityBefore.cgroupPath,mountRoot:identityBefore.mountRoot,mount:CGROUP_MOUNT,read:path=>values.get(path)??null});
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
export async function qualifyNativeUploadSandbox({imageDigest,deadlineMs,signal,credentialPaths=[],tempRoot=UPLOAD_IMAGE_PATHS.tempRoot,run=runUploadSandbox,hostCgroup}={}){
 if(typeof imageDigest!=='string'||!/^sha256:[a-f0-9]{64}$/u.test(imageDigest)||!Number.isSafeInteger(deadlineMs)||
  !Array.isArray(credentialPaths)||credentialPaths.length>64||!credentialPaths.every(p=>typeof p==='string'&&isAbsolute(p)))
  throw uploadFault('UPLOAD_QUALIFICATION_CONFIGURATION');
 const workspace=await mkdtemp(join(tempRoot,UPLOAD_ROLE_PREFIX.probe));
 try{
  const realHost=hostCgroup===undefined&&run===runUploadSandbox;
  const hostBefore=realHost?await hostIdentitySnapshot():null;
  const input=Buffer.from(JSON.stringify({credentialPaths}));
  const out=(await run('probe',{cwd:workspace,input,signal,deadlineMs})).stdout;
  if(out.length<2||out.length>UPLOAD_MAX_OBSERVATION_BYTES)return {admitted:false,reason:'UPLOAD_PROBE_INVALID',evaluation:null,missing:[...UPLOAD_SANDBOX_REQUIREMENTS]};
  const parsed=JSON.parse(out.toString('utf8'));
  const base=parsed!==null&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:{};
  const host=hostCgroup!==undefined?hostCgroup:(realHost?await readHostCgroup({before:hostBefore}):null);
  const observation=host===null||host===undefined?base:{...base,cgroup:combineCgroupBounds(base.cgroup,host)};
  const evaluation=evaluateUploadSandbox(observation,{tempRoot:await realpath(tempRoot).catch(()=>null)});
  const missing=evaluation.findings.map(f=>f.requirement);
  const diagnostic=Object.freeze({...evaluation.diagnostic,
   cgroupHost:Object.freeze({resolved:host!==null&&host!==undefined&&Number.isSafeInteger(host?.levels)&&host.levels>0,levels:host?.levels??0,mountRootIsRoot:host?.mountRootIsRoot===true})});
  if(missing.length)return {admitted:false,reason:'UPLOAD_SANDBOX_UNQUALIFIED',evaluation,missing,diagnostic};
  // Tool/definition roots are read-only bind entries of the fixed plan above, so they share this admission.
  return {admitted:true,reason:'UPLOAD_SANDBOX_QUALIFIED',admission:Object.freeze({role:'upload-native',imageDigest,qualificationId:'upload-native-'+imageDigest.slice(7),
   sandbox:Object.freeze({...evaluation.sandbox}),toolRootsReadOnly:true}),evaluation,missing:[]};
 }catch(error){return {admitted:false,reason:typeof error?.code==='string'?error.code:'UPLOAD_PROBE_FAILED',evaluation:null,missing:[...UPLOAD_SANDBOX_REQUIREMENTS]};}
 finally{await rm(workspace,{recursive:true,force:true});}
}
