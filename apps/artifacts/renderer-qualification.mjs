/** Renderer qualification owner: the source of the admission record `renderer.mjs` binds. Before this module nothing issued
 * one, so the qualified-renderer port could only ever be `unavailable` (PDF generation and office previews fail closed).
 *
 * `qualifyLibreOfficeRenderer` attests the converter's sandbox by OBSERVATION, in the container that will run it: it runs
 * `renderer-probe.mjs` through the exact spawn path the LibreOffice transformer uses (`runArtifactProcess`, fixed env, owned
 * private working directory, own process group) and reads `soffice --version` the same way. Each of the eight
 * `RENDERER_SANDBOX_REQUIREMENTS` is set `true` only when the observation proves it; anything missing, unreadable, malformed
 * or non-Linux is `false`, so the resulting port is unavailable with the exact missing requirements named.
 *
 * Trusted inputs, never request or model data: the converter executable, the node executable, the temp root, the image
 * digest and qualification id from the image provenance owner (a container cannot observe its own digest), and the
 * credential paths this role mounts (the probe checks that a converter child cannot open them). This module proves nothing
 * about other hosts or images; one admission covers one process lifetime in one container. No network, no cloud call. */
import {mkdtemp,rm,stat,realpath} from 'node:fs/promises';
import {isAbsolute,join,dirname,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {runArtifactProcess} from './process.mjs';
import {RENDERER_SANDBOX_REQUIREMENTS,createLibreOfficeRendererPort} from './renderer.mjs';
export const RENDERER_PROBE_PATH=fileURLToPath(new URL('./renderer-probe.mjs',import.meta.url));
export const RENDERER_PROBE_SCHEMA='meri-renderer-sandbox-observation/1';
/** The only environment a converter child may receive: exactly what `process.mjs` sets. Any other name fails `noCredentials`. */
export const RENDERER_CHILD_ENV=Object.freeze(['HOME','LANG','MPLCONFIGDIR','OMP_NUM_THREADS','OPENBLAS_NUM_THREADS','PATH','PYTHONDONTWRITEBYTECODE','TMPDIR']);
const WORKSPACE_PREFIX='meri-renderer-probe-',MAX_OBSERVATION_BYTES=65536,UNLIMITED=2n**62n;
const fail=code=>{throw Object.assign(new Error(code),{code});};
const sha=value=>createHash('sha256').update(value).digest('hex');
const zeroCaps=value=>typeof value==='string'&&/^0{16}$/u.test(value);
const positiveIds=value=>Array.isArray(value)&&value.length===4&&value.every(n=>Number.isSafeInteger(n)&&n>0);
function finiteLimit(value,{quota=false}={}){
 if(typeof value!=='string')return false;
 // cgroup v2 cpu.max is "<quota> <period>"; v1 cfs_quota_us is "-1" when unlimited.
 const first=quota?value.split(/\s+/u)[0]:value;
 if(!/^[0-9]{1,20}$/u.test(first))return false;
 const n=BigInt(first);return n>0n&&n<UNLIMITED;
}
/** Pure: one observation -> the eight requirement flags plus a finding per false flag. Never throws; malformed input is all false. */
export function evaluateRendererSandbox(observation,{tempRoot}={}){
 const o=observation!==null&&typeof observation==='object'&&!Array.isArray(observation)?observation:{};
 const linux=o.schema===RENDERER_PROBE_SCHEMA&&o.platform==='linux';
 const caps=o.capabilities&&typeof o.capabilities==='object'?o.capabilities:{};
 const cg=o.cgroup&&typeof o.cgroup==='object'?o.cgroup:{};
 const ifaces=Array.isArray(o.interfaces)?o.interfaces:null;
 const env=Array.isArray(o.envNames)?o.envNames:null;
 const creds=Array.isArray(o.credentialPathsReadable)?o.credentialPathsReadable:null;
 const ws=o.workspace&&typeof o.workspace==='object'?o.workspace:null;
 const sandbox={
  nonRootUser:linux&&positiveIds(o.uid)&&positiveIds(o.gid),
  noNetwork:linux&&ifaces!==null&&ifaces.length>0&&ifaces.every(name=>name==='lo'),
  readOnlyRootFilesystem:linux&&typeof o.rootMountOptions==='string'&&o.rootMountOptions.split(',').includes('ro'),
  noNewPrivileges:linux&&o.noNewPrivs===1,
  dropAllCapabilities:linux&&['CapInh','CapPrm','CapEff','CapAmb'].every(k=>zeroCaps(caps[k])),
  privateWorkspace:linux&&typeof o.cwd==='string'&&typeof tempRoot==='string'&&dirname(o.cwd)===tempRoot&&basename(o.cwd).startsWith(WORKSPACE_PREFIX)&&
   o.home===o.cwd&&o.tmpdir===o.cwd&&ws!==null&&ws.mode===0o700&&positiveIds(o.uid)&&ws.uid===o.uid[1],
  boundedResources:linux&&finiteLimit(cg.memoryMax)&&finiteLimit(cg.pidsMax)&&finiteLimit(cg.cpuMax,{quota:true}),
  noCredentials:false,
 };
 // Without network isolation a child can reach instance/task credential endpoints, so noCredentials also requires noNetwork.
 sandbox.noCredentials=linux&&sandbox.noNetwork&&env!==null&&env.every(name=>RENDERER_CHILD_ENV.includes(name))&&creds!==null&&creds.every(c=>c&&c.readable===false);
 const findings=RENDERER_SANDBOX_REQUIREMENTS.filter(k=>sandbox[k]!==true).map(requirement=>({requirement,reason:linux?'NOT_OBSERVED':'NOT_LINUX'}));
 return {sandbox:Object.freeze(sandbox),findings:Object.freeze(findings)};
}
/** `LibreOffice 24.2.7.2 <build>` -> `24.2.7.2`; anything else is null. */
export function parseLibreOfficeVersion(stdout){
 const match=/^LibreOffice ([0-9][0-9A-Za-z.+-]{0,63})(?:\s|$)/u.exec(String(stdout).trim());return match?match[1]:null;
}
function configuration(value){
 const c=value!==null&&typeof value==='object'?value:{};
 const absolute=p=>typeof p==='string'&&isAbsolute(p);
 if(!absolute(c.executable)||!absolute(c.nodeExecutable)||!absolute(c.tempRoot)||typeof c.imageDigest!=='string'||!/^sha256:[a-f0-9]{64}$/u.test(c.imageDigest)||
  typeof c.qualificationId!=='string'||!/^[A-Za-z0-9._:-]{1,128}$/u.test(c.qualificationId)||!Array.isArray(c.credentialPaths??[])||!(c.credentialPaths??[]).every(absolute)||
  (c.credentialPaths??[]).length>64||!Number.isSafeInteger(c.deadlineMs)||c.run!==undefined&&typeof c.run!=='function')fail('RENDERER_QUALIFICATION_CONFIGURATION');
 return {...c,credentialPaths:[...(c.credentialPaths??[])],run:c.run??runArtifactProcess};
}
/** Observe, evaluate and bind. Returns `{port,admission,evaluation,receipt}`; `port` is always a renderer port, available only
 * when every requirement was observed. A probe or version failure yields an unadmitted port and a closed `failure` code. */
export async function qualifyLibreOfficeRenderer(options){
 const c=configuration(options),receipt={qualificationId:c.qualificationId,imageDigest:c.imageDigest,probeSchema:RENDERER_PROBE_SCHEMA,processes:[]};
 const unadmitted=failure=>({port:createLibreOfficeRendererPort({admission:undefined,executable:c.executable,tempRoot:c.tempRoot}),admission:null,evaluation:null,receipt:{...receipt,failure}});
 const owned=async(executable,args,input)=>{
  const workspace=await mkdtemp(join(c.tempRoot,WORKSPACE_PREFIX));
  try{const run=await c.run(executable,args,{cwd:workspace,input:Buffer.from(input),signal:c.signal,deadlineMs:c.deadlineMs});receipt.processes.push(run.receipt??null);return {stdout:Buffer.from(run.stdout??''),workspace};}
  finally{await rm(workspace,{recursive:true,force:true});if(await stat(workspace).then(()=>true,()=>false))fail('RENDERER_PROBE_CLEANUP_FAILED');}
 };
 let version,observation;
 try{version=parseLibreOfficeVersion((await owned(c.executable,['--version'],'')).stdout.toString('utf8'));}catch(error){return unadmitted(error?.code==='RENDERER_PROBE_CLEANUP_FAILED'?error.code:'RENDERER_VERSION_UNAVAILABLE');}
 if(version===null)return unadmitted('RENDERER_VERSION_UNAVAILABLE');
 try{const out=(await owned(c.nodeExecutable,[RENDERER_PROBE_PATH],JSON.stringify({credentialPaths:c.credentialPaths}))).stdout;
  if(out.length>MAX_OBSERVATION_BYTES)return unadmitted('RENDERER_PROBE_INVALID');receipt.observationSha256=sha(out);observation=JSON.parse(out.toString('utf8'));}
 catch(error){return unadmitted(error?.code==='RENDERER_PROBE_CLEANUP_FAILED'?error.code:error instanceof SyntaxError?'RENDERER_PROBE_INVALID':'RENDERER_PROBE_FAILED');}
 // The probe reports getcwd(), which resolves symlinks, so the workspace parent is compared with the resolved temp root.
 const evaluation=evaluateRendererSandbox(observation,{tempRoot:await realpath(c.tempRoot).catch(()=>null)});
 const admission={rendererId:'libreoffice',rendererVersion:version,executable:c.executable,imageDigest:c.imageDigest,qualificationId:c.qualificationId,sandbox:{...evaluation.sandbox}};
 const port=createLibreOfficeRendererPort({admission,executable:c.executable,tempRoot:c.tempRoot});
 return {port,admission,evaluation,receipt:{...receipt,state:port.state,reason:port.reason,missingRequirements:[...port.missingRequirements]}};
}
