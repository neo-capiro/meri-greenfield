import {readFileSync} from 'node:fs';
import {createNativeHostInspectionClient} from './native-host-client.mjs';
import {NATIVE_UPLOAD_INSPECTION_PATH,nativeUploadCustody} from './native-host-contract.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import * as tls from '../../worker/conversation/host/control/tls.mjs';
import * as binding from '../../worker/conversation/host/binding.mjs';
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
  native=own(uploads.native,['enabled'],['imageDigest','definitionsRoot','extractorPath','scratchRoot','maxDefinitionsAgeMs','provisionMs','agentcore','host','policySha256']);
 }catch{throw uploadFault('UPLOAD_NATIVE_CONFIGURATION');}
 requireValue(typeof native.enabled==='boolean');
 // A disabled declaration names nothing else, matching the `reads` convention: an inert digest or root is refused
 // rather than kept as an untested leftover the next reader might mistake for an attested host.
 if(native.enabled!==true){requireValue(Object.keys(native).length===1);return Object.freeze({enabled:false});}
 // The REMOTE selection. `agentcore` names the runtime image this purpose is EXPECTED in; the runtime itself (ARN
 // and qualifier) is the existing `configuration.agentcore` declaration. Nothing else may be declared beside it: this
 // host composes no sandbox at all in this case, so an unconsumed local digest, root or budget could only be mistaken
 // for an attested host, and it is refused here for the same reason a disabled declaration refuses them.
 if(native.host!==undefined){
  // Per-operation target: configuration carries ONLY the trusted TLS references, budget and policy digest. The physical
  // allocation/identity/binding/endpoint come from the canonical allocation reader for the saved upload.
  // EXACT closed shape for a host declaration: enabled/host/policySha256 only; nested host: tls/maxRequestMs only.
  requireValue(Object.keys(native).length===3);
  let h;try{h=own(native.host,['tls'],['maxRequestMs','deployment','observer']);}catch{throw uploadFault('UPLOAD_NATIVE_CONFIGURATION');}
  if(h.maxRequestMs!==undefined)requireValue(integer(h.maxRequestMs,1,30000));
  let tlsRefs;try{tlsRefs=own(h.tls,['caPath','certPath','keyPath'],['clientName']);}catch{throw uploadFault('UPLOAD_NATIVE_CONFIGURATION');}
  for(const k of ['caPath','certPath','keyPath'])absolute(tlsRefs[k]);
  if(tlsRefs.clientName!==undefined)requireValue(typeof tlsRefs.clientName==='string'&&
   /^[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$/u.test(tlsRefs.clientName));
  requireValue(native.policySha256!==undefined&&typeof native.policySha256==='string'&&/^[a-f0-9]{64}$/u.test(native.policySha256));
  // Exact physical facts for the EXISTING Control-owned EC2 teardown port. These are closed and explicit:
  // no security-group array is accepted, so no arbitrary first member can be chosen.
  let deployment;
  if(h.deployment!==undefined){
   let d;try{d=own(h.deployment,['accountId','region','amiId','vpcId','subnetId','securityGroupId','rootDeviceName']);}
   catch{throw uploadFault('UPLOAD_NATIVE_CONFIGURATION');}
   const AWS_ID=/^(?:ami|vpc|subnet|sg)-(?:[0-9a-f]{8}|[0-9a-f]{17})$/u;
   requireValue(typeof d.accountId==='string'&&/^[0-9]{12}$/u.test(d.accountId)&&
    typeof d.region==='string'&&/^[a-z]{2}-[a-z]+-[0-9]$/u.test(d.region)&&
    typeof d.amiId==='string'&&d.amiId.startsWith('ami-')&&AWS_ID.test(d.amiId)&&
    typeof d.vpcId==='string'&&d.vpcId.startsWith('vpc-')&&AWS_ID.test(d.vpcId)&&
    typeof d.subnetId==='string'&&d.subnetId.startsWith('subnet-')&&AWS_ID.test(d.subnetId)&&
    typeof d.securityGroupId==='string'&&d.securityGroupId.startsWith('sg-')&&AWS_ID.test(d.securityGroupId)&&
    d.rootDeviceName==='/dev/xvda');
   deployment=Object.freeze({...d});
  }
  let observer;
  if(h.observer!==undefined){
   let o;try{o=own(h.observer,['keyId','keyPath']);}catch{throw uploadFault('UPLOAD_NATIVE_CONFIGURATION');}
   requireValue(typeof o.keyId==='string'&&/^[A-Za-z0-9_-]{1,64}$/u.test(o.keyId));absolute(o.keyPath);
   requireValue(deployment!==undefined);observer=Object.freeze({...o});
  }
  return Object.freeze({enabled:true,host:Object.freeze({tls:Object.freeze({...tlsRefs}),
   maxRequestMs:h.maxRequestMs??3000,...(deployment===undefined?{}:{deployment}),...(observer===undefined?{}:{observer}),policySha256:native.policySha256}),
   policySha256:native.policySha256});
 }
 if(native.agentcore!==undefined){
  // A malformed nested block is the same declaration fault as a malformed top-level key, so the closed-shape
  // refusal and the digest refusal are reported identically rather than as a raw shape error.
  let remote;try{remote=own(native.agentcore,['imageDigest']);}catch{throw uploadFault('UPLOAD_NATIVE_CONFIGURATION');}
  requireValue(Object.keys(native).length===2&&typeof remote.imageDigest==='string'&&DIGEST.test(remote.imageDigest));
  return Object.freeze({enabled:true,agentcore:Object.freeze({imageDigest:remote.imageDigest})});
 }
 if(native.policySha256!==undefined)requireValue(typeof native.policySha256==='string'&&/^[a-f0-9]{64}$/u.test(native.policySha256));
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
 ...(typeof host?.reason==='string'?{reason:host.reason}:{}),
 ...(Array.isArray(host?.requirements)&&host.requirements.length?{requirements:Object.freeze([...host.requirements])}:{}),
 ...(host?.diagnostic&&typeof host.diagnostic==='object'?{diagnostic:host.diagnostic}:{}),
 provisionDefinitions:typeof host?.provisionDefinitions==='function'?host.provisionDefinitions:null});

/** Compose the mounted inspection for CONTROL, or an honest unavailable handle.
 *
 * `inspection` is non-null only when the declaration is enabled AND the host owner could attest both ports. `missing`
 * is a content-free list of unmet declarations for the single stderr event. The returned handle is frozen and holds no
 * request-derived value; `deadlineMs` bounds the mount only.
 */
/** Existing pinned HTTPS pattern for the fixed native host: TLS with peer verification, the pinned certificate
 * fingerprint re-checked on the live socket, one bounded request, and the socket always destroyed. */
export async function pinnedHttpsConnect({address,port,serverName,serverFingerprintSha256,signal,deadlineMs,tls:material,
 readFile}){
 tls.privateAddress(address);tls.dnsName(serverName);tls.fingerprint(serverFingerprintSha256);
 if(!Number.isSafeInteger(port)||port<1||port>65535)throw uploadFault('UPLOAD_NATIVE_TRANSPORT_CONFIGURATION');
 if(signal?.aborted===true||!Number.isSafeInteger(deadlineMs)||deadlineMs<=Date.now())
  throw uploadFault('UPLOAD_INSPECTION_EXPIRED');
 // The protected material is REQUIRED and loaded ONLY from the trusted declaration paths through the supplied reader.
 const refs=material;
 if(refs===null||typeof refs!=='object'||typeof refs.certPath!=='string'||typeof refs.keyPath!=='string'||
  typeof refs.caPath!=='string'||typeof readFile!=='function')throw uploadFault('UPLOAD_NATIVE_TLS_CONFIGURATION');
 // Canonical bounded material check (existing helper), no new parser.
 const load=path=>{let bytes;try{bytes=readFile(path);}catch{throw uploadFault('UPLOAD_NATIVE_TLS_CONFIGURATION');}
  try{return tls.tlsBytes(bytes);}catch{throw uploadFault('UPLOAD_NATIVE_TLS_CONFIGURATION');}};
 const cert=load(refs.certPath),key=load(refs.keyPath),ca=load(refs.caPath);
 const https=await import('node:https');
 const {createHash}=await import('node:crypto');
 // Close the asynchronous-setup window: nothing is emitted if the operation was cancelled/expired meanwhile.
 if(signal?.aborted===true||deadlineMs<=Date.now())throw uploadFault('UPLOAD_INSPECTION_EXPIRED');
 const request=https.request({host:address,port,servername:serverName,method:'POST',
  path:NATIVE_UPLOAD_INSPECTION_PATH,rejectUnauthorized:true,agent:false,cert,key,ca,
  minVersion:'TLSv1.3',maxVersion:'TLSv1.3',headers:{'content-type':'application/json'}});
 let settled=false,settleOutstanding=null,timer=null,response=null;const chunksRef=[];
 const terminal=error=>{
  if(settled)return;settled=true;
  if(timer!==null)clearTimeout(timer);timer=null;
  signal?.removeEventListener?.('abort',onAbort);
  // Dispose the response by DESTROYING it: no resume, no retained chunks/listeners after refusal.
  try{
   if(response!==null){response.removeAllListeners?.('data');response.removeAllListeners?.('end');
    response.removeAllListeners?.('close');response.removeAllListeners?.('error');
    chunksRef.length=0;response.destroy?.();}
  }catch{void 0;}
  response=null;
  request.destroy();
  settleOutstanding?.(error);
  settleOutstanding=null;
  rejectOnce(error);
 };
 let rejectOnce=()=>{};
 const onAbort=()=>terminal(Object.assign(Error('UPLOAD_INSPECTION_CANCELLED'),
  {code:'UPLOAD_INSPECTION_CANCELLED'}));
 const done=new Promise((resolve,reject)=>{
  rejectOnce=reject;
  let admitted=false,admit=null;
  const admittedPromise=new Promise(r=>{admit=r;});
  request.on('socket',socket=>socket.once('secureConnect',()=>{
   const peer=socket.getPeerCertificate?.();
   const print=peer?.raw?createHash('sha256').update(peer.raw).digest('hex'):null;
   if(print!==serverFingerprintSha256)return terminal(Object.assign(Error('UPLOAD_NATIVE_PEER_REFUSED'),
    {code:'UPLOAD_NATIVE_PEER_REFUSED'}));
   admitted=true;admit();
  }));
  // A premature close or request-side abort terminates ONE outstanding exchange instead of leaving it waiting.
  request.on('error',()=>terminal(Object.assign(Error('UPLOAD_INSPECTION_REFUSED'),
   {code:'UPLOAD_INSPECTION_REFUSED'})));
  request.on('close',()=>{if(!settled)terminal(Object.assign(Error('UPLOAD_INSPECTION_REFUSED'),
   {code:'UPLOAD_INSPECTION_REFUSED'}));});
  request.on('aborted',()=>terminal(Object.assign(Error('UPLOAD_INSPECTION_REFUSED'),
   {code:'UPLOAD_INSPECTION_REFUSED'})));
  timer=setTimeout(()=>terminal(Object.assign(Error('UPLOAD_INSPECTION_EXPIRED'),
   {code:'UPLOAD_INSPECTION_EXPIRED'})),Math.max(1,deadlineMs-Date.now()));
  signal?.addEventListener('abort',onAbort,{once:true});
  // The wire is usable only AFTER the pin is admitted; no request body is written before then.
  resolve(Object.freeze({send:({body})=>new Promise((resolveResponse,rejectResponse)=>{
   if(settled)return rejectResponse(Object.assign(Error('UPLOAD_INSPECTION_REFUSED'),
    {code:'UPLOAD_INSPECTION_REFUSED'}));
   settleOutstanding=rejectResponse;
   const start=()=>{
    if(settled)return;
    request.once('response',res=>{
     response=res;
     const chunks=chunksRef;chunks.length=0;let total=0;
     res.on('data',chunk=>{if(settled)return;total+=chunk.length;
      if(total>16*1024*1024){chunks.length=0;return terminal(Object.assign(Error('UPLOAD_INSPECTION_RESULT_REFUSED'),
       {code:'UPLOAD_INSPECTION_RESULT_REFUSED'}));}
      chunks.push(chunk);});
     res.on('aborted',()=>terminal(Object.assign(Error('UPLOAD_INSPECTION_REFUSED'),
      {code:'UPLOAD_INSPECTION_REFUSED'})));
     res.on('close',()=>{if(!res.complete)terminal(Object.assign(Error('UPLOAD_INSPECTION_REFUSED'),
      {code:'UPLOAD_INSPECTION_REFUSED'}));});
     res.on('error',()=>terminal(Object.assign(Error('UPLOAD_INSPECTION_REFUSED'),
      {code:'UPLOAD_INSPECTION_REFUSED'})));
     res.on('end',()=>{
      if(settled)return;
      if(!res.complete)return terminal(Object.assign(Error('UPLOAD_INSPECTION_REFUSED'),
       {code:'UPLOAD_INSPECTION_REFUSED'}));
      settled=true;if(timer!==null)clearTimeout(timer);timer=null;
      signal?.removeEventListener?.('abort',onAbort);
      settleOutstanding=null;response=null;
      resolveResponse({status:res.statusCode,body:Buffer.concat(chunks)});
     });
    });
    request.end(body);
   };
   const guard=()=>{if(settled)return;
    if(signal?.aborted===true||deadlineMs<=Date.now())
     return terminal(Object.assign(Error('UPLOAD_INSPECTION_CANCELLED'),{code:'UPLOAD_INSPECTION_CANCELLED'}));
    start();};
   if(admitted)guard();else admittedPromise.then(guard);
  }),close:async()=>{
   if(!settled)terminal(Object.assign(Error('UPLOAD_INSPECTION_CANCELLED'),{code:'UPLOAD_INSPECTION_CANCELLED'}));
   else{try{request.destroy();}catch{}}
   return Object.freeze({closed:true});
  }}));
 });
 return await done;
}
export async function mountUploadNativeControl({configuration,allocations,now=Date.now,signal,deadlineMs,run,processing,paths,readFileImpl,connect}={}){
 const declared=configuration?.uploads?.native??null;
 if(declared===null||typeof declared!=='object'||declared.enabled!==true)return unavailable(['uploads.native.enabled'],null);
 // A DECLARED native host (fixed address/port/SAN/fingerprint + the exact protected allocation/identity/binding) is a
 // pinned authenticated remote inspection. It precedes the AgentCore branch: a declared native host is never silently
 // replaced by another transport, and no local composition of the uploaded bytes is attempted.
 if(declared.host!==undefined){
  const reader=allocations;
  if(reader===null||typeof reader?.resolve!=='function')return unavailable(['uploads.native.allocations'],null);
  try{
   const h=declared.host;
   if(typeof h?.tls?.certPath!=='string'||typeof h.tls.keyPath!=='string'||typeof h.tls.caPath!=='string')
    return unavailable(['uploads.native.tls'],null);
   const trustedReader=readFileImpl===undefined?readFileSync:readFileImpl;
   const connectImplementation=connect??(options=>pinnedHttpsConnect({...options,tls:h.tls,readFile:trustedReader}));
   // ONE thin per-operation port over the existing client; no second router/service/authority registry.
   const inspection=Object.freeze({async inspect(declaration,bytes,{deadlineMs,signal,custodyContext}={}){
    const began=now();
    const requested=Math.min(Number.isSafeInteger(deadlineMs)?deadlineMs:began+(h.maxRequestMs??3000),
     began+(h.maxRequestMs??3000));
    if(signal?.aborted===true||requested<=began)throw uploadFault('UPLOAD_INSPECTION_EXPIRED');
    if(custodyContext===null||typeof custodyContext!=='object')throw uploadFault('UPLOAD_NATIVE_CUSTODY_REQUIRED');
    const life=createOperationLifetime({now,deadlineMs:requested,signal,errorFactory:()=>
     Object.assign(Error('UPLOAD_INSPECTION_CANCELLED'),{code:'UPLOAD_INSPECTION_CANCELLED'})});
    try{
     life.check();
     // Canonical owner-current authority first: the derived signal bounds the lookup, and no dispatch happens without it.
     const fresh=await life.run(()=>Promise.resolve(custodyContext.assertCurrent()));
     life.check();
     if(!Number.isSafeInteger(fresh?.expiresAtMs)||fresh.expiresAtMs<=now())
      throw uploadFault('UPLOAD_INSPECTION_CUSTODY_REFUSED');
     const custody=nativeUploadCustody(custodyContext.record,{binding:fresh.binding,scopes:fresh.scopes,
      selectedClientId:fresh.selectedClientId,checkedAtMs:began,expiresAtMs:Math.min(fresh.expiresAtMs,requested)});
     // The fresh authority expiry bounds the ACTUAL lifetime BEFORE the allocation lookup.
     life.limitDeadline(Math.min(requested,fresh.expiresAtMs));
     const resolved=await life.run(()=>Promise.resolve(reader.resolve({binding:fresh.binding,custody,declaration,
      signal:life.signal})));
     life.check();
     if(resolved===null||typeof resolved!=='object')throw uploadFault('NATIVE_HOST_ALLOCATION_REFUSED');
     const a=resolved.allocation;
     if(a?.hostMode!=='native-processing'||a.tenantId!==fresh.binding.tenantId||
      a.conversationId!==fresh.binding.conversationId||typeof a.imageDigest!=='string')throw uploadFault('NATIVE_HOST_ALLOCATION_REFUSED');
     if(!Number.isSafeInteger(resolved.expiresAtMs)||resolved.expiresAtMs<=now())
      throw uploadFault('NATIVE_HOST_ALLOCATION_REFUSED');
     if(resolved.expiresAtMs<a.leaseDeadlineMs&&resolved.expiresAtMs<=began)
      throw uploadFault('NATIVE_HOST_ALLOCATION_REFUSED');
     // Clamp the ACTUAL lifetime again to the resolved per-operation expiry.
     const until=Math.min(requested,resolved.expiresAtMs);
     life.limitDeadline(until);
     const client=createNativeHostInspectionClient({endpoint:resolved.endpoint,allocation:a,
      hostIdentity:resolved.hostIdentity,binding:fresh.binding,imageDigest:a.imageDigest,now,
      maxRequestMs:h.maxRequestMs??3000,connect:connectImplementation});
     try{
      return await client.inspect(declaration,bytes,{deadlineMs:until,signal:life.signal,custodyContext});
     }finally{life.close();}
    }finally{life.close();}
   }});
   return Object.freeze({inspection,host:null,missing:Object.freeze([]),provisionDefinitions:null,remote:true});
  }catch{return unavailable(['uploads.native.host'],null);}
 }
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
   ...(processing===undefined?{}:{processing}),...(run===undefined?{}:{run}),...(paths===undefined?{}:{paths}),
   ...(readFileImpl===undefined?{}:{readFileImpl})});
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
