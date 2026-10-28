/** The CONTROL-native upload lifecycle seam.
 *
 * A5 owns the sandbox, the definitions store, the native host composition (`composition.mjs`) and the upload
 * inspection itself (`apps/control/uploads/extraction.mjs`). This module owns only the JOIN: it turns the
 * server-owned, closed `uploads.native` declaration into a mounted inspection port and drives exactly one bounded
 * provisioning attempt through the same serialized owner.
 *
 * It is opt-in and trusted. The declaration is JSON configuration and the mount is CONTROL assembly state, so nothing
 * here is reachable from an incoming request: a request body cannot enable native execution, cannot name a sandbox,
 * image or tool, and cannot create these ports. When the declaration is absent or disabled, or when the host owner
 * cannot back `scanner`/`extractor`, this returns `inspection:null` and the uploads family keeps its existing honest
 * UNAVAILABLE; no other product family is affected and CONTROL still starts.
 *
 * The declaration selects WHERE the inspection runs, and only the server selects it:
 *
 *  - `native.agentcore = {imageDigest}` declares that the inspection runs in the AgentCore runtime named by the
 *    existing `configuration.agentcore` declaration (`runtimeArn` + `qualifier`), in the runtime image the digest is
 *    an EXPECTATION for. This host then issues the ordinary IAM `InvokeAgentRuntime` port
 *    (`uploads/agentcore-client.mjs`) and composes nothing locally: CONTROL never executes the uploaded bytes, and a
 *    missing or unconfigured runtime/qualifier/image is an honest `inspection:null` (`uploads.native.agentcore`) --
 *    never a local fallback, because a local sandbox this host cannot attest is exactly what must not run the bytes.
 *  - otherwise the existing local composition runs, unchanged, exactly as before.
 *
 * The SAME join is used by the purpose-locked AgentCore container's own startup, through
 * `uploads/agentcore-http.mjs` `composeUploadInspectionHost`: there the declaration comes from that image's own
 * environment and therefore never carries `agentcore`, so the composition is local by construction.
 *
 * It adds no platform privilege, no namespace/`unshare` assumption, and no daemon, timer, scheduler or new job.
 * Whether a CONTROL host actually satisfies the sandbox prerequisite is a separate, still-open host/platform
 * question: this seam only composes what the host owner can attest at startup, and reports `missing` when it cannot.
 */
import {isAbsolute} from 'node:path';
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createUploadInspection} from '../../control/uploads/extraction.mjs';
import {composeUploadNativeHost} from './composition.mjs';
import {createUploadInspectionClient} from './agentcore-client.mjs';
import {UPLOAD_DEFINITIONS_ROOT,UPLOAD_EXTRACTOR_PATH,UPLOAD_IMAGE_PATHS,uploadFault} from './native-sandbox.mjs';

const DIGEST=/^sha256:[a-f0-9]{64}$/u;
const integer=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const requireValue=condition=>{if(!condition)throw uploadFault('UPLOAD_NATIVE_CONFIGURATION');};
const absolute=value=>{requireValue(typeof value==='string'&&isAbsolute(value)&&!value.includes('/../')&&value.length<=4096);return value;};

/** The bounded startup mount budget. CONTROL's startup deadline is at most 30s and the process must still reach
 * `listen`, so the mount (sandbox qualification, tool observation, one opportunistic snapshot probe) gets the smaller
 * of this and the remaining startup budget. The full signed-CVD download does not belong here: it is the separately
 * bounded provisioning attempt below. */
export const UPLOAD_NATIVE_MOUNT_MS=10000;
/** The bounded default budget for the one post-listen provisioning attempt, overridable by the declaration. */
export const UPLOAD_NATIVE_DEFAULT_PROVISION_MS=120000;
/** One content-free stderr event, carrying only the unsatisfied declarations. It never carries stderr, paths or text. */
export const UPLOAD_NATIVE_UNAVAILABLE_EVENT='runtime.uploads.native.unavailable';
/**
 * The only definition conditions under which one bounded re-provision is meaningful: the snapshot could not be made
 * available and neither its integrity nor the runtime's lifetime is in question (a longer budget may simply succeed
 * where the short mount budget expired). This is an explained mirror of `composition.mjs`'s own REFRESHABLE
 * (`UPLOAD_DEFINITIONS_UNAVAILABLE`/`UPLOAD_DEFINITIONS_STALE`) extended by the provisioning outcomes its updater can
 * report, because only that owner can answer a freshness question. Integrity and teardown conditions -- CORRUPT,
 * UNVERIFIED, CANCELLED, CONFIGURATION, SCHEMA, MAX_AGE_MS, FORMATS -- are deliberately absent: a corrupt or
 * unverified snapshot is never replaced as if it were merely stale, and a cancelled or misconfigured runtime is never
 * re-provisioned.
 */
export const UPLOAD_NATIVE_PROVISIONABLE=Object.freeze([
 'UPLOAD_DEFINITIONS_UNAVAILABLE','UPLOAD_DEFINITIONS_STALE','UPLOAD_DEFINITIONS_EXPIRED',
 'UPLOAD_DEFINITIONS_REFRESH_FAILED','UPLOAD_DEFINITIONS_INCOMPLETE','UPLOAD_DEFINITIONS_PUBLISH_FAILED',
 'UPLOAD_DEFINITIONS_STORAGE_UNAVAILABLE','UPLOAD_DEFINITIONS_FORMAT_UNSUPPORTED','UPLOAD_DEFINITIONS_HOST',
]);

/** The closed `uploads.native` declaration (control only). Absent or `enabled:false` declares no native inspection;
 * `enabled:true` names the sandbox image digest and may narrow the fixed host paths and the two bounded budgets.
 * Fixed paths and the digest are EXPECTED values only: this compiler never observes or asserts host qualification. */
export function compileUploadNativeConfiguration(configuration){
 let native;
 try{
  const uploads=own(configuration.uploads,['native']);
  native=own(uploads.native,['enabled'],['imageDigest','definitionsRoot','extractorPath','scratchRoot','maxDefinitionsAgeMs','provisionMs','agentcore']);
 }catch{throw uploadFault('UPLOAD_NATIVE_CONFIGURATION');}
 requireValue(typeof native.enabled==='boolean');
 // A disabled declaration names nothing else, matching the `reads` convention: an inert digest or root is refused
 // rather than kept as an untested leftover the next reader might mistake for an attested host.
 if(native.enabled!==true){requireValue(Object.keys(native).length===1);return Object.freeze({enabled:false});}
 // The REMOTE selection. `agentcore` names the runtime image this purpose is EXPECTED in; the runtime itself (ARN
 // and qualifier) is the existing `configuration.agentcore` declaration. Nothing else may be declared beside it: this
 // host composes no sandbox at all in this case, so an unconsumed local digest, root or budget could only be mistaken
 // for an attested host, and it is refused here for the same reason a disabled declaration refuses them.
 if(native.agentcore!==undefined){
  // A malformed nested block is the same declaration fault as a malformed top-level key, so the closed-shape
  // refusal and the digest refusal are reported identically rather than as a raw shape error.
  let remote;try{remote=own(native.agentcore,['imageDigest']);}catch{throw uploadFault('UPLOAD_NATIVE_CONFIGURATION');}
  requireValue(Object.keys(native).length===2&&typeof remote.imageDigest==='string'&&DIGEST.test(remote.imageDigest));
  return Object.freeze({enabled:true,agentcore:Object.freeze({imageDigest:remote.imageDigest})});
 }
 requireValue(typeof native.imageDigest==='string'&&DIGEST.test(native.imageDigest));
 for(const key of ['definitionsRoot','extractorPath','scratchRoot'])if(native[key]!==undefined)absolute(native[key]);
 if(native.maxDefinitionsAgeMs!==undefined)requireValue(integer(native.maxDefinitionsAgeMs,1000,604800000));
 if(native.provisionMs!==undefined)requireValue(integer(native.provisionMs,1000,300000));
 return Object.freeze({enabled:true,imageDigest:native.imageDigest,
  definitionsRoot:native.definitionsRoot??UPLOAD_DEFINITIONS_ROOT,
  extractorPath:native.extractorPath??UPLOAD_EXTRACTOR_PATH,
  scratchRoot:native.scratchRoot??UPLOAD_IMAGE_PATHS.tempRoot,
  ...(native.maxDefinitionsAgeMs===undefined?{}:{maxDefinitionsAgeMs:native.maxDefinitionsAgeMs}),
  provisionMs:native.provisionMs??UPLOAD_NATIVE_DEFAULT_PROVISION_MS});
}

const unavailable=(missing,host)=>Object.freeze({inspection:null,host,missing:Object.freeze([...missing]),
 provisionDefinitions:typeof host?.provisionDefinitions==='function'?host.provisionDefinitions:null});

/** Compose the mounted inspection for CONTROL, or an honest unavailable handle.
 *
 * `inspection` is non-null only when the declaration is enabled AND the host owner could attest both ports. `missing`
 * is a content-free list of unmet declarations for the single stderr event. The returned handle is frozen and holds no
 * request-derived value; `deadlineMs` bounds the mount only.
 */
export async function mountUploadNativeControl({configuration,now=Date.now,signal,deadlineMs,run,paths,readFileImpl}={}){
 const declared=configuration?.uploads?.native??null;
 if(declared===null||typeof declared!=='object'||declared.enabled!==true)return unavailable(['uploads.native.enabled'],null);
 // REMOTE first and unconditionally: no local composition is even attempted, so a declared remote inspection can
 // never degrade into CONTROL executing the uploaded bytes itself. The region is the runtime ARN's own, so the
 // transport cannot be aimed at a runtime in another region than the one the declaration names.
 if(declared.agentcore!==undefined){
  const runtime=configuration?.agentcore;
  try{
   if(runtime===null||typeof runtime!=='object'||typeof runtime.runtimeArn!=='string'||typeof runtime.qualifier!=='string')throw Error();
   const region=runtime.runtimeArn.split(':')[3];
   return Object.freeze({inspection:createUploadInspectionClient({region,agentRuntimeArn:runtime.runtimeArn,qualifier:runtime.qualifier,
    imageDigest:declared.agentcore.imageDigest,now}),host:null,missing:Object.freeze([]),provisionDefinitions:null,remote:true});
  }catch{return unavailable(['uploads.native.agentcore'],null);}
 }
 try{
  // `run`/`paths`/`readFileImpl` are the host owner's narrow fixture ports, exactly as its own composition accepts
  // them. Production startControl supplies none of the three, so from the running system they are unreachable.
  const host=await composeUploadNativeHost({configuration,now,signal,deadlineMs:deadlineMs??now()+UPLOAD_NATIVE_MOUNT_MS,
   ...(typeof declared.scratchRoot==='string'?{tempRoot:declared.scratchRoot}:{}),
   ...(run===undefined?{}:{run}),...(paths===undefined?{}:{paths}),...(readFileImpl===undefined?{}:{readFileImpl})});
  if(host===null||typeof host!=='object'||host.scanner===null||host.extractor===null)
   return unavailable(Array.isArray(host?.missing)&&host.missing.length?host.missing:['uploads.native.sandbox'],host);
  return Object.freeze({inspection:createUploadInspection({scanner:host.scanner,extractor:host.extractor,now}),
   host,missing:Object.freeze([]),provisionDefinitions:host.provisionDefinitions});
 }catch{return unavailable(['uploads.native.composition'],null);}
}

/** Start, but never await, the one bounded provisioning attempt.
 *
 * The mount budget is far shorter than a full signed-CVD download, so the real attempt happens here under its own
 * declared absolute deadline (`now()+provisionMs`) through the same serialized owner. It is started and not awaited:
 * the process does not block and this is not a timer, daemon, scheduler or new job. `signal` is the runtime fence, so
 * closing CONTROL aborts it. At most one attempt is made: there is no retry and no loop. A condition outside
 * `UPLOAD_NATIVE_PROVISIONABLE` -- corrupt, unverified, cancelled, misconfigured -- returns `started:false` and is
 * never repaired as though it were merely stale. A REMOTE mount is not an unavailable host: it has no local
 * snapshot to fetch, so it is an idle with no fault. `completion` never rejects.
 */
export function beginUploadNativeProvisioning({handle,configuration,now=Date.now,signal}={}){
 const state=()=>{const live=handle?.host?.definitionsProvisioningState?.()??null;
  // `remote` distinguishes "this host has nothing to provision" from "this host failed to provision": a healthy
  // remote mount has no local definitions root at all, so it must never read as an unavailable or broken one.
  return Object.freeze({provisioned:live?.provisioned===true,reason:live?.reason??null,remote:handle?.remote===true});};
 const idle=error=>Object.freeze({started:false,error,state,completion:Promise.resolve(null)});
 if(handle===null||typeof handle!=='object'||handle.inspection===null)return idle('UPLOAD_NATIVE_UNAVAILABLE');
 // A REMOTE inspection is provisioned by the host that runs it -- the runtime container provisions its own signed
 // snapshot -- so CONTROL has nothing to attempt and must report no fault. Returning UPLOAD_NATIVE_UNAVAILABLE here
 // made a healthy remote mount look broken to operators: this is an honest not-locally-provisioned idle instead.
 if(handle.remote===true)return idle(null);
 if(typeof handle.provisionDefinitions!=='function')return idle('UPLOAD_NATIVE_UNAVAILABLE');
 const reason=handle.host?.definitionsProvisioningState?.()?.reason??null;
 if(reason===null)return idle(null);
 if(!UPLOAD_NATIVE_PROVISIONABLE.includes(reason))return idle(`UPLOAD_NATIVE_NOT_PROVISIONABLE:${reason}`);
 const provisionMs=configuration?.uploads?.native?.provisionMs??UPLOAD_NATIVE_DEFAULT_PROVISION_MS;
 const completion=Promise.resolve().then(()=>handle.provisionDefinitions({deadlineMs:now()+provisionMs,signal})).then(()=>null,()=>null);
 return Object.freeze({started:true,error:null,state,completion});
}
