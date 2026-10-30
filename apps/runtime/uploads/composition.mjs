/** Upload native-host composition — the caller that supplies the CONTROL upload owner's inspection ports.
 *
 * Caller join (existing owner): A5's CONTROL upload application builds its inspection port with
 *   createUploadInspection({scanner, extractor, now})
 * and hands it to createUploadApplication({inspection}). This module is where those two ports come from. It issues them
 * only for an observed upload-sandbox admission (`qualifyNativeUploadSandbox`) and observed tool identities
 * (`observeUploadTools`); otherwise it returns null ports plus a `missing` list, so the upload owner reports
 * SCANNER_UNAVAILABLE / EXTRACTOR_UNAVAILABLE instead of a fabricated qualified flag. No cloud probe, no credential owner,
 * no S3/IAM change and no new transport is introduced here — the host prerequisite remains explicit.
 *
 * Inert, host-owned inputs only: the DECLARED expected image digest from configuration (an expectation, never an observed
 * image; see the provenance limits in native-inspection.mjs), the fixed definition and extractor roots, the pinned tool
 * paths in `native-sandbox.mjs`, and (for tests) an injected process runner.
 *
 * This module is the SINGLE source-level refresh owner (finding F2). It builds one `refresh` closure and hands it to
 * both callers that can observe a non-fresh definitions root — this composition at startup and the per-scan resolve
 * path inside `createUploadNativeInspection` — so a long-lived CONTROL host is not left permanently stale until a
 * restart. The closure is serialized: a refresh already in flight is shared instead of duplicated, so an ordinary
 * serialized owner suffices and there is no parallel provisioning and no second refresh path. It is bounded by the
 * caller's remaining deadline, never looped, never retried in the background, and it is neither a daemon, a timer, a
 * credential owner nor a new platform. It runs through the same injected fixed process port and the same host-owned
 * freshclam configuration as everything else here.
 *
 * Only a FRESHNESS condition (unavailable or stale) is ever answered by a refresh. A corrupt, unsigned, cancelled or
 * expired snapshot is never repaired by fetching a fresh one, so corruption can never be silently replaced by a
 * clean-looking publication. After a publish the bounded storage disposition runs on the resolve owner
 * (`definitions.prune`), which removes only snapshots that owner can PROVE unreferenced and otherwise reports a
 * bounded storage-unavailable state. */
import {UPLOAD_IMAGE_PATHS,UPLOAD_DEFINITIONS_ROOT,UPLOAD_EXTRACTOR_PATH,uploadFault,qualifyNativeUploadSandbox,runUploadSandbox} from './native-sandbox.mjs';
import {createSignedDefinitionStore,createSignedDefinitionUpdater,runDefinitionProgram,
 UPLOAD_DEFINITIONS_MAX_AGE_MS} from './native-definitions.mjs';
import {createUploadNativeInspection,observeUploadTools} from './native-inspection.mjs';

const fail=()=>{throw uploadFault('UPLOAD_HOST_CONFIGURATION');};
const isHash=value=>typeof value==='string'&&/^sha256:[a-f0-9]{64}$/u.test(value);
const disabled=(missing,reason=null,requirements=[],diagnostic=null)=>Object.freeze({scanner:null,extractor:null,definitions:null,admission:null,describe:null,missing:Object.freeze([...missing]),
 ...(typeof reason==='string'&&reason?{reason}:{}),...(Array.isArray(requirements)&&requirements.length?{requirements:Object.freeze([...requirements])}:{}),
 ...(diagnostic&&typeof diagnostic==='object'?{diagnostic}:{})});
/** The only conditions a bounded refresh may answer. An unknown or invalid condition (unverified signature,
 * corruption, cancellation, expiry, configuration) is never repaired by fetching a fresh snapshot. */
const REFRESHABLE=new Set(['UPLOAD_DEFINITIONS_UNAVAILABLE','UPLOAD_DEFINITIONS_STALE']);
/** Compose the upload native host. `configuration.uploads.native` is the fixed, server-owned declaration:
 * `{enabled, imageDigest, definitionsRoot, extractorPath, maxDefinitionsAgeMs?}`. Returns
 * `{scanner,extractor,definitions,admission,describe,provisionDefinitions,missing}`; the host owner binds
 * `scanner`/`extractor` into createUploadInspection and may drive `provisionDefinitions({deadlineMs})` under its own
 * bounded lifecycle. */
export async function composeUploadNativeHost(options={}){
 const configuration=options.configuration??{},now=options.now??Date.now,processing=options.processing,
  run=processing??options.run??runUploadSandbox,
  // Definitions use their OWN fixed-program port: sigtool/freshclam are not inspection roles and never reach
  // runUploadSandbox. A caller may supply the sanitized runner, never an arbitrary program/argv.
  definitionsRun=options.definitionsRun??runDefinitionProgram,
  tempRoot=options.tempRoot??UPLOAD_IMAGE_PATHS.tempRoot,declared=configuration?.uploads?.native;
 if(typeof now!=='function'||typeof run!=='function'||typeof definitionsRun!=='function'||
  (processing!==undefined&&typeof processing!=='function'))fail();
 if(declared===null||typeof declared!=='object'||declared.enabled!==true)return disabled(['uploads.native.enabled']);
 if(!isHash(declared.imageDigest))return disabled(['uploads.native.imageDigest']);
 // Fixed image paths unless the host declares an explicit override; both are read-only bind entries for every child.
 const definitionsRoot=typeof declared.definitionsRoot==='string'?declared.definitionsRoot:UPLOAD_DEFINITIONS_ROOT;
 const extractorPath=typeof declared.extractorPath==='string'?declared.extractorPath:UPLOAD_EXTRACTOR_PATH;
 const deadlineMs=options.deadlineMs??now()+60000;
 let qualification;try{qualification=await qualifyNativeUploadSandbox({imageDigest:declared.imageDigest,deadlineMs,signal:options.signal,
  credentialPaths:Array.isArray(options.credentialPaths)?options.credentialPaths:[],tempRoot,run});}
 catch(error){return disabled(['uploads.native.sandbox'],typeof error?.code==='string'?error.code:null,[]);}
 if(qualification.admitted!==true)return disabled(['uploads.native.sandbox'],qualification.reason,qualification.missing,qualification.diagnostic??null);
 let tools;try{tools=await observeUploadTools({run,tempRoot,definitionsRoot,extractorPath,deadlineMs,signal:options.signal,
  ...(options.paths===undefined?{}:{paths:options.paths}),...(options.readFileImpl===undefined?{}:{readFileImpl:options.readFileImpl})});}
 catch{return disabled(['uploads.native.tools']);}
 // A host-pinned snapshot owner may be supplied: it is used verbatim (no second reader, no updater, no refresh).
 const pinned=options.definitions;
 const definitions=pinned??createSignedDefinitionStore({root:definitionsRoot,now,run:definitionsRun,
  ...(declared.maxDefinitionsAgeMs===undefined?{}:{maxAgeMs:declared.maxDefinitionsAgeMs})});
 const updater=pinned===undefined?createSignedDefinitionUpdater({root:definitionsRoot,run:definitionsRun,now}):null;
 /** The ONE bounded refresh owner. `inFlight` is what serializes it: a refresh already running is shared with every
  * other caller, so two scans that both observe a stale root cause exactly one provisioning attempt and nothing can
  * provision in parallel. It never loops, and it cannot outlive its caller's deadline — the absolute `deadlineMs` is
  * passed straight through, so freshclam fails EXPIRED rather than the refresh extending a child's budget. */
 let inFlight=null,disposition=null,provisioned=false,attempted=false,reason=null,storageUnavailable=false;
 const refresh=({signal,deadlineMs:until}={})=>{
  if(inFlight!==null)return inFlight;
  attempted=true;
  if(updater===null)return Promise.resolve(Object.freeze({skipped:true,reason:'HOST_PINNED_SNAPSHOT'}));
  const attempt=(async()=>{
   await updater.provision({signal,deadlineMs:until});
   provisioned=true;reason=null;
   // Bounded storage disposition on the reader-pin owner, immediately after a publish. A disposition failure never
   // fails the caller: the definitions are published either way, and an unreclaimable root is reported, not hidden.
   try{
    disposition=await definitions.prune({signal});
    storageUnavailable=disposition.storage.overBound!==false;
   }catch{disposition=null;}
  })();
  const shared=attempt.then(()=>{if(inFlight===shared)inFlight=null;},
   error=>{if(inFlight===shared)inFlight=null;reason=typeof error?.code==='string'?error.code:'UPLOAD_DEFINITIONS_REFRESH_FAILED';throw error;});
  inFlight=shared;
  return shared;
 };
 // Startup probe: a fresh task-local definitions root resolves UNAVAILABLE and an over-age root resolves STALE, so this
 // host makes ONE bounded attempt through the same closure and then re-resolves the next time definitions are needed.
 // A failed attempt changes nothing: the ports are still issued and every scan stays fail-closed, because the store
 // re-verifies the publisher signature at resolve. The probe releases its own reader immediately (it binds no child),
 // so the snapshot it proved is immediately provable-idle for a later disposition.
 try{
  const probe=await definitions.snapshot({deadlineMs,signal:options.signal});
  try{probe.reader.release({completed:true});}catch{/* an unreleased probe reader only keeps a snapshot retained */}
 }catch(initial){
  const code=typeof initial?.code==='string'?initial.code:'UPLOAD_DEFINITIONS_UNAVAILABLE';
  attempted=true;reason=code;
  if(REFRESHABLE.has(code)){try{await refresh({signal:options.signal,deadlineMs});}catch{/* reported through `provisioned` */}}
 }
 const host=createUploadNativeInspection({admission:qualification.admission,tools,definitions,definitionsRoot,
  extractorPath,run,tempRoot,now,refresh});
 const provisioningState=()=>Object.freeze({attempted,provisioned,reason,storageUnavailable,
  storageFault:storageUnavailable?'UPLOAD_DEFINITIONS_STORAGE_UNAVAILABLE':null,
  disposition:disposition===null?null:disposition});
 /** The SAME one refresh owner, exposed as a bounded handle for the EXISTING host lifecycle owner, so a stale
  * task-local definitions root can be re-provisioned under that owner's own lifecycle budget instead of a scan's
  * deadline. It starts no timer, daemon, scheduler or second provisioning path: concurrent callers still share the one
  * `inFlight` attempt, an unknown mutation is never retried, and the absolute `deadlineMs` it is given is passed
  * straight through, so it can never extend a caller's budget. This is a source-level join only — the production
  * lifecycle wiring stays with the host owner — and every scan remains unavailable until an ACTUAL fresh snapshot
  * resolves. */
 const provisionDefinitions=async({deadlineMs:until,signal}={})=>{await refresh({signal,deadlineMs:until});return provisioningState();};
 return Object.freeze({scanner:host.scanner,extractor:host.extractor,definitions,admission:qualification.admission,describe:host.describe,
  provisionDefinitions,
  definitionsProvisioning:provisioningState(),definitionsProvisioningState:provisioningState,missing:Object.freeze([])});
}
export {UPLOAD_DEFINITIONS_MAX_AGE_MS};
