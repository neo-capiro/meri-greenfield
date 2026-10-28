/** Scanner and extractor ports for the CONTROL upload owner's `createUploadInspection`. Each port runs one fixed child
 * through the observed upload sandbox, binds the observation to the exact original bytes/hash, and stamps a receipt that
 * names the native tool, its program hash and the signed definition snapshot the scan was bound to. The admission image
 * digest is only a DECLARED expectation here (`describe()` marks it unobserved); observed image/toolchain provenance
 * belongs to the existing image owner, not to this module. Nothing here
 * accepts a command, environment, plugin or configuration from the caller or an upload.
 *
 * ClamAV max-size and encrypted-content alerts are treated as a NON-clean, non-infected condition (`SCAN_LIMIT_REACHED`):
 * content that could not be fully examined is never reported clean. A missing or stale signed definition snapshot, an
 * unadmitted host, a tool that cannot be observed or a child that fails all yield `unavailable`, never `clean`.
 *
 * When the host owner supplies a bounded `refresh` port, a resolve that reports a FRESHNESS condition (unavailable or
 * stale) triggers exactly ONE bounded provisioning attempt and ONE re-resolve, both on this same child's absolute
 * deadline, so a long-lived host is not stuck stale until a restart. Corrupt, unsigned, cancelled or expired
 * definitions never trigger it: corruption is never repaired, and therefore never silently replaced, by a refresh. */
import {createHash} from 'node:crypto';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {join,isAbsolute,relative,sep} from 'node:path';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {UPLOAD_IMAGE_PATHS,UPLOAD_ROLE_PREFIX,UPLOAD_SCAN_INPUT,UPLOAD_EXTRACT_FORMATS,uploadFault,runUploadSandbox} from './native-sandbox.mjs';

export const UPLOAD_SCANNER_NAME='clamav',UPLOAD_EXTRACTOR_NAME='meri-upload-extractor';
export const UPLOAD_SCAN_MAX_OUTPUT=65536,UPLOAD_EXTRACT_MAX_OUTPUT=16*1024*1024;
/** Existing owners that can OBSERVE a running image digest. There is no local upload-inspection observation seam, so
 * this host only carries a DECLARED expectation and never claims observed image/toolchain provenance. Production must
 * bind the declaration to an observation from one of these owners (or an equivalent accepted one); that join is A5's. */
export const UPLOAD_IMAGE_OBSERVATION_OWNERS=Object.freeze(['apps/runtime/native-authority/ecs-task-binding.mjs',
 'apps/runtime/artifacts/renderer-contract.mjs','apps/runtime/material-init.mjs']);
const fail=code=>{throw uploadFault(code);};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const isHash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/u.test(value);
const isCode=value=>typeof value==='string'&&/^[A-Z][A-Z0-9_]{0,79}$/u.test(value);
/** ClamAV alerts that mean the scan did not fully examine the content (encrypted, over a limit, or broken media).
 * The prefixes are the real ClamAV 1.5.2 strings `Heuristics.Limits.Exceeded.<limit>` (MaxFileSize/MaxScanSize/
 * MaxFiles/MaxScanTime/MaxRecursion), `Heuristics.Encrypted.*` and `Heuristics.Broken.Media.*`; no unproven
 * `Oversized.*` alternative is matched. */
const LIMIT_SIGNATURE=/^Heuristics\.(Limits|Encrypted|Broken)\./u;
const CANCELLED=new Set(['ARTIFACT_CANCELLED','ARTIFACT_DEADLINE','ARTIFACT_CLEANUP_FAILED']);
/** The only resolve conditions a bounded refresh may answer; see the module header. */
const REFRESHABLE=new Set(['UPLOAD_DEFINITIONS_UNAVAILABLE','UPLOAD_DEFINITIONS_STALE']);

function tool(value,name){
 if(value===null||typeof value!=='object'||!isHash(value.binarySha256)||typeof value.version!=='string'||!value.version||value.version.length>128||value.name!==name)fail('UPLOAD_TOOL_IDENTITY');
 return Object.freeze({name:value.name,version:value.version,binarySha256:value.binarySha256});
}
function assertTools(tools){
 if(tools===null||typeof tools!=='object')fail('UPLOAD_TOOL_IDENTITY');
 const scanner=tool(tools.scanner,UPLOAD_SCANNER_NAME),extractor=tool(tools.extractor,UPLOAD_EXTRACTOR_NAME);
 if(!isHash(tools.pythonSha256))fail('UPLOAD_TOOL_IDENTITY');
 return Object.freeze({scanner,extractor,pythonSha256:tools.pythonSha256});
}
/** `ClamAV 1.4.2/27450/...` -> `1.4.2`; `Python 3.13.16` -> `3.13.16`; anything else is null. */
export function parseScannerVersion(stdout){const m=/^ClamAV ([0-9][0-9A-Za-z.+-]{0,63})(?:\/|\s|$)/u.exec(String(stdout).trim());return m?m[1]:null;}
export function parsePythonVersion(stdout){const m=/^Python ([0-9][0-9A-Za-z.+-]{0,63})(?:\s|$)/u.exec(String(stdout).trim());return m?m[1]:null;}
/** `path: Signature FOUND` -> `{file,signature}`; other lines are ignored. */
export function parseClamDetections(stdout){
 const out=[];
 for(const line of String(stdout).split('\n')){
  const m=/^(.*): ([A-Za-z0-9_.\-() ]+) FOUND$/u.exec(line.trim());
  if(m)out.push({file:m[1],signature:m[2]});
 }
 return out;
}
/** Map scanner detections to a receipt status: malware wins, then any limit/encryption alert is unavailable, else clean. */
export function classifyScan(detections){
 if(!detections.length)return {status:'clean',reason:null};
 if(detections.some(d=>!LIMIT_SIGNATURE.test(d.signature)))return {status:'infected',reason:'MALWARE_DETECTED'};
 return {status:'unavailable',reason:'SCAN_LIMIT_REACHED'};
}
/** Map one scanner exit plus its parsed detections to a receipt status. ClamAV exits 0 only for a clean scan of content
 * it fully examined; exit 1 means "something was found", so an exit 1 whose output yielded ZERO parseable detections is
 * unknown/truncated/unparseable output — unavailable, never clean. Any other exit is unavailable. Exit 0 carrying
 * detections is contradictory output and is also unavailable rather than clean. */
export function classifyScanExit({exitCode,detections}){
 if(!Number.isInteger(exitCode))return {status:'unavailable',reason:'SCANNER_UNAVAILABLE'};
 if(exitCode===0)return detections.length?{status:'unavailable',reason:'SCANNER_OUTPUT_UNEXPECTED'}:{status:'clean',reason:null};
 if(exitCode!==1)return {status:'unavailable',reason:'SCANNER_UNAVAILABLE'};
 if(!detections.length)return {status:'unavailable',reason:'SCANNER_OUTPUT_UNPARSED'};
 return classifyScan(detections);
}
async function withWorkspace(role,tempRoot,body){
 const cwd=await mkdtemp(join(tempRoot,UPLOAD_ROLE_PREFIX[role]));
 try{return await body(cwd);}finally{await rm(cwd,{recursive:true,force:true});}
}
/** Run one child and return `{stdout,exitCode}` even for a non-zero exit; cancellation/cleanup faults still throw. */
async function runChild(run,role,options){
 try{const out=await run(role,options);return {stdout:Buffer.from(out.stdout??''),exitCode:0};}
 catch(error){
  if(CANCELLED.has(error?.code))throw error;
  if(Number.isInteger(error?.receipt?.exitCode))return {stdout:Buffer.from(error.stdout??Buffer.alloc(0)),exitCode:error.receipt.exitCode};
  throw error;
 }
}
/** Observe the fixed tool identities through the same sandbox. Returns `{scanner,extractor,pythonSha256}` or throws;
 * a tool that cannot be read or versioned is unavailable, never assumed. */
export async function observeUploadTools({run=runUploadSandbox,tempRoot=UPLOAD_IMAGE_PATHS.tempRoot,definitionsRoot,extractorPath,deadlineMs,signal,paths=UPLOAD_IMAGE_PATHS,readFileImpl=readFile}={}){
 const pythonBytes=await readFileImpl(paths.pythonExecutable).catch(()=>null);
 const scannerBytes=await readFileImpl(paths.scanner).catch(()=>null);
 const extractorBytes=await readFileImpl(extractorPath).catch(()=>null);
 if(!pythonBytes||!scannerBytes||!extractorBytes)fail('UPLOAD_TOOL_UNAVAILABLE');
 const scanOut=await withWorkspace('scan',tempRoot,async cwd=>{
  const {stdout}=await runChild(run,'scan',{cwd,definitionsRoot,mode:'version',input:Buffer.alloc(0),signal,deadlineMs});
  return stdout;
 });
 const pythonOut=await withWorkspace('extract',tempRoot,async cwd=>{
  const {stdout}=await runChild(run,'extract',{cwd,extractorPath,mode:'version',input:Buffer.alloc(0),signal,deadlineMs});
  return stdout;
 });
 const scannerVersion=parseScannerVersion(scanOut.toString('utf8')),pythonVersion=parsePythonVersion(pythonOut.toString('utf8'));
 if(scannerVersion===null||pythonVersion===null)fail('UPLOAD_TOOL_UNAVAILABLE');
 return Object.freeze({scanner:{name:UPLOAD_SCANNER_NAME,version:scannerVersion,binarySha256:hash(scannerBytes)},
  extractor:{name:UPLOAD_EXTRACTOR_NAME,version:pythonVersion,binarySha256:hash(extractorBytes)},pythonSha256:hash(pythonBytes)});
}
/** Build the two ports from an observed admission, observed tools and a read-only definition store. */
export function createUploadNativeInspection({admission,tools,definitions,definitionsRoot,extractorPath,run=runUploadSandbox,tempRoot=UPLOAD_IMAGE_PATHS.tempRoot,now=Date.now,refresh}){
 if(admission===null||typeof admission!=='object'||admission.role!=='upload-native'||!isHash(String(admission.imageDigest).replace(/^sha256:/u,''))||typeof now!=='function')fail('UPLOAD_INSPECTION_CONFIGURATION');
 if(typeof extractorPath!=='string'||(definitionsRoot!==undefined&&typeof definitionsRoot!=='string')||typeof definitions?.snapshot!=='function'||
  (refresh!==undefined&&typeof refresh!=='function'))fail('UPLOAD_INSPECTION_CONFIGURATION');
 const identity=assertTools(tools),snapshot=storageMethod(definitions,'snapshot');
 // The admission digest arrives from configuration: it is a deployment DECLARATION, not an observation made here, so it
 // is exposed as an expectation only (see describe()) and never as claimed observed image provenance.
 const expectedImageDigest=admission.imageDigest;
 // Use the host's path semantics: on POSIX a backslash is a filename character, not a separator. Normalization also
 // refuses traversal-form siblings; the canonical store still owns snapshot identity and signature verification.
 const withinRoot=directory=>{
  if(typeof directory!=='string'||!isAbsolute(directory))return false;
  if(definitionsRoot===undefined)return true;
  const path=relative(definitionsRoot,directory);
  return path!==''&&path!=='..'&&!path.startsWith('..'+sep)&&!isAbsolute(path);
 };
 const expired=(deadlineMs,signal)=>typeof deadlineMs!=='number'||!Number.isSafeInteger(deadlineMs)||deadlineMs<=now()||signal?.aborted;
 const scanUnavailable=(file,began,reason)=>({sourceSha256:file.sha256,sourceBytes:file.bytes,checkedAtMs:Math.max(began,now()),status:'unavailable',tool:null,definitionsSha256:null,
  reason:isCode(reason)?reason:'SCANNER_UNAVAILABLE'});
 const extractUnavailable=(file,began,limitation)=>({sourceSha256:file.sha256,sourceBytes:file.bytes,checkedAtMs:Math.max(began,now()),status:'unavailable',tool:null,segments:[],
  limitations:[isCode(limitation)?limitation:'EXTRACTOR_UNAVAILABLE']});
 /** A scan receipt: exact original binding + native tool + signed definition snapshot the child was bound to. */
 async function scan({file,bytes,limits,deadlineMs,signal}={}){
  const began=now();
  if(expired(deadlineMs,signal))return scanUnavailable(file,began,'UPLOAD_EXPIRED');
  if(!Buffer.isBuffer(bytes)||bytes.length!==file.bytes||hash(bytes)!==file.sha256)return scanUnavailable(file,began,'UPLOAD_ORIGINAL_MISMATCH');
  // Resolve and prove the current signed snapshot ONCE, then bind this child to that exact immutable directory: the
  // receipt's definitions identity is what ClamAV actually read, not a value a concurrent refresh could move under it.
  // The resolve also re-verifies the publisher signature over the published containers, so a whole replaced snapshot
  // directory is refused here rather than being scanned as if it were signed.
  let bound;try{bound=await snapshot({signal,deadlineMs});}
  catch(first){
   const code=typeof first?.code==='string'?first.code:null;
   // ONLY a freshness condition is answered by the bounded refresh the host owner supplies, and at most ONE attempt is
   // made followed by ONE re-resolve. Hybrid/unknown conditions — an unsigned container, corruption, cancellation,
   // expiry, configuration — are never repaired here, so corruption can never be silently replaced by a fresh
   // snapshot. Both the refresh and the child share this call's absolute deadline, so nothing outlives the child.
   if(typeof refresh!=='function'||!REFRESHABLE.has(code))return scanUnavailable(file,began,code);
   try{await refresh({signal,deadlineMs});}catch{/* the re-resolve below reports the real condition */}
   if(expired(deadlineMs,signal))return scanUnavailable(file,began,'UPLOAD_EXPIRED');
   try{bound=await snapshot({signal,deadlineMs});}catch(second){return scanUnavailable(file,began,second?.code??code);}
  }
  if(!withinRoot(bound?.databaseDirectory))return scanUnavailable(file,began,'UPLOAD_DEFINITIONS_UNAVAILABLE');
  const definitionsSha=bound.sha256;
  // The resolve owner pinned a reader for exactly this child's lifetime. `completed:true` is reported only for a child
  // that actually finished; a cancelled child or one whose cleanup is unknown releases without it, so the bounded
  // storage disposition retains that snapshot instead of inferring from elapsed time that it is free.
  const releaseReader=completed=>{try{return bound?.reader?.release?.({completed})===true;}catch{return false;}};
  let out;try{
   out=await withWorkspace('scan',tempRoot,async cwd=>{
    await writeFile(join(cwd,UPLOAD_SCAN_INPUT),Buffer.from(bytes),{flag:'wx',mode:0o600});
    return runChild(run,'scan',{cwd,definitionsRoot:bound.databaseDirectory,input:Buffer.alloc(0),signal,deadlineMs,maxOutput:UPLOAD_SCAN_MAX_OUTPUT});
   });
  }catch(error){releaseReader(false);if(CANCELLED.has(error?.code))throw error;return scanUnavailable(file,began,'SCANNER_UNAVAILABLE');}
  releaseReader(true);
  const {status,reason}=classifyScanExit({exitCode:out.exitCode,detections:parseClamDetections(out.stdout.toString('utf8'))});
  if(status==='unavailable')return scanUnavailable(file,began,reason);
  return {sourceSha256:file.sha256,sourceBytes:file.bytes,checkedAtMs:Math.max(began,now()),
   status,tool:identity.scanner,definitionsSha256:definitionsSha,reason};
 }
 /** An extraction receipt: the fixed child's bounded result, re-anchored to the exact original bytes and tool identity. */
 async function extract({file,bytes,deadlineMs,signal}={}){
  const began=now();
  if(expired(deadlineMs,signal))return extractUnavailable(file,began,'UPLOAD_EXPIRED');
  if(!Buffer.isBuffer(bytes)||bytes.length!==file.bytes||hash(bytes)!==file.sha256)return extractUnavailable(file,began,'UPLOAD_ORIGINAL_MISMATCH');
  if(!UPLOAD_EXTRACT_FORMATS.includes(file.format))return extractUnavailable(file,began,'EXTRACTOR_UNAVAILABLE');
  let out;try{
   out=await withWorkspace('extract',tempRoot,async cwd=>{
    await writeFile(join(cwd,'input.'+file.format),Buffer.from(bytes),{flag:'wx',mode:0o600});
    return runChild(run,'extract',{cwd,extractorPath,format:file.format,input:Buffer.alloc(0),signal,deadlineMs,maxOutput:UPLOAD_EXTRACT_MAX_OUTPUT});
   });
  }catch(error){if(CANCELLED.has(error?.code))throw error;return extractUnavailable(file,began,'EXTRACTOR_UNAVAILABLE');}
  if(out.exitCode===3)return extractUnavailable(file,began,'NATIVE_EXTRACTOR_CONFIGURATION');
  if(out.exitCode!==0)return extractUnavailable(file,began,'EXTRACTOR_UNAVAILABLE');
  let parsed;try{parsed=JSON.parse(out.stdout.toString('utf8'));}catch{return extractUnavailable(file,began,'EXTRACTOR_RECEIPT_INVALID');}
  if(parsed===null||typeof parsed!=='object'||!Array.isArray(parsed.segments)||!Array.isArray(parsed.limitations))return extractUnavailable(file,began,'EXTRACTOR_RECEIPT_INVALID');
  const limitations=[...new Set(parsed.limitations.filter(isCode))];
  let status=['available','partial','unavailable','blocked'].includes(parsed.status)?parsed.status:'unavailable';
  if(status==='available'&&limitations.length)status='partial';
  if(['unavailable','blocked'].includes(status)&&parsed.segments.length)status='partial';
  if(status!=='available'&&!limitations.length)limitations.push(status==='blocked'?'EXTRACTOR_BLOCKED':'EXTRACTOR_PARTIAL');
  return {sourceSha256:file.sha256,sourceBytes:file.bytes,checkedAtMs:Math.max(began,now()),status,
   tool:identity.extractor,segments:parsed.segments,limitations};
 }
 /** Inert provenance of the host this inspection was built on; no secret or request value. The image digest is the
  * DECLARED expectation from configuration and is explicitly unobserved: this module makes no local image observation,
  * and binding an observed digest is the production join requirement carried by UPLOAD_IMAGE_OBSERVATION_OWNERS. */
 const describe=()=>Object.freeze({expectedImageDigest,imageObserved:false,imageObservationOwners:UPLOAD_IMAGE_OBSERVATION_OWNERS,
  qualificationId:admission.qualificationId,sandbox:admission.sandbox,
  toolRootsReadOnly:admission.toolRootsReadOnly===true,scanner:identity.scanner,extractor:identity.extractor,pythonSha256:identity.pythonSha256});
 return Object.freeze({scanner:Object.freeze({scan}),extractor:Object.freeze({extract}),admission,describe});
}
