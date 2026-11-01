/** Inner container-side application for the custody-mediated fixed native inspection purpose.
 *
 * It serves exactly ONE server-selected session identity and runs exactly ONE fixed scanner/parser invocation
 * through the inspection port the host owner composed (`createUploadNativeInspection` over the signed-definition
 * store and the observed native sandbox). It accepts no command, program, image, tool, environment, plugin or
 * configuration from the caller or from the upload, never starts an SDK run or a model loop, and needs no secret:
 * the declaration and the exact original bytes are the only request-controlled values that reach the port.
 *
 * The port is server-constructed and opt-in. When the host owner could not attest the sandbox, the tools or a signed
 * definition snapshot -- or when no digest was declared at all -- this application is present and honestly
 * UNAVAILABLE. A missing tool, a stale or corrupt definition, a failed child and a scan that could not fully examine
 * the content all stay unavailable and are never reported as clean or extracted; an ambiguous outcome is never
 * upgraded, and the environment is poisoned rather than reused for a second attempt.
 */
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {jsonBody} from '../../control/action-application/http.mjs';
import {AGENTCORE_SESSION_HEADER} from '../agentcore-contract.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {UPLOAD_NATIVE_MOUNT_MS,mountUploadNativeControl} from './control-lifecycle.mjs';
import {RUNTIME_CREDENTIAL_PATHS} from '../credential-inventory.mjs';
import {agentcoreRuntimePlatform} from '../agentcore-platform.mjs';
import {uploadInspectionFault,uploadInspectionPurpose,uploadInspectionRequest,uploadInspectionBody,
 UPLOAD_INSPECTION_WIRE_BYTES,UPLOAD_INSPECTION_RESULT_BYTES,UPLOAD_INSPECTION_MAX_DEADLINE_MS} from './agentcore-contract.mjs';

const DIGEST=/^sha256:[a-f0-9]{64}$/u;
/** Build the inner application. `inspection` is the fixed owner's inspection port (or null when the host could not
 * attest it); `imageDigest` is the DECLARED expectation this environment was built for -- an expectation only, never
 * an observation, since observing a running image is the existing image owner's separate join. The factory itself
 * never throws: an unusable host yields a present, honestly unavailable application so the platform's readiness and
 * the SDK purpose are unaffected. */
export function createUploadInspectionApplication({inspection=null,imageDigest,now=Date.now,signal}={}){
 if(typeof now!=='function')throw uploadInspectionFault('UPLOAD_INSPECTION_CONFIGURATION');
 const declared=typeof imageDigest==='string'&&DIGEST.test(imageDigest)?imageDigest:null;
 const port=inspection===null||declared===null?null:{inspect:storageMethod(inspection,'inspect')};
 let used=false,active=false,poisoned=false,pending;const stop=new AbortController();
 const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
 const unavailable=()=>json({error:{code:'UPLOAD_INSPECTION_UNAVAILABLE'}},503);
 const refused=()=>json({error:{code:'UPLOAD_INSPECTION_REQUEST_REFUSED'}},400);
 return Object.freeze({
  async close({deadlineMs}){stop.abort();const life=createOperationLifetime({now,deadlineMs,errorFactory:uploadInspectionFault});
   try{if(pending)await life.run(()=>pending);return {settled:!active};}finally{life.close();}},
  async handle(request){const url=new URL(request.url);
   if(url.pathname==='/ping'&&!url.search)return request.method!=='GET'?
    json({error:{code:'METHOD_NOT_ALLOWED'}},405):json({status:poisoned||stop.signal.aborted?'Unhealthy':active?'HealthyBusy':'Healthy'},poisoned||stop.signal.aborted?503:200);
   if(url.pathname!=='/invocations'||url.search||request.method!=='POST')return refused();
   if(port===null)return unavailable();
   if(used||active||stop.signal.aborted||signal?.aborted)return json({error:{code:'UPLOAD_INSPECTION_SESSION_USED'}},409);
   const joined=AbortSignal.any([request.signal,stop.signal,...(signal?[signal]:[])]),
    readLife=createOperationLifetime({now,deadlineMs:now()+10000,signal:joined,errorFactory:uploadInspectionFault});
   let parsed;
   try{
    if(request.headers.get('content-type')!=='application/json'||request.headers.get('content-encoding'))throw Error();
    const rawLength=request.headers.get('content-length');if(rawLength!==null&&!/^(0|[1-9][0-9]*)$/u.test(rawLength))throw Error();
    parsed=uploadInspectionRequest(await jsonBody({body:request.body,length:rawLength===null?null:Number(rawLength)},
     UPLOAD_INSPECTION_WIRE_BYTES,readLife,readLife.check));
    const purpose=uploadInspectionPurpose(request.headers.get(AGENTCORE_SESSION_HEADER)??'');
    // The server-selected session IS this environment's identity and the declared image is the one it was built for:
    // another session, another purpose or another image is refused rather than served as if it were equal.
    if(purpose===null||purpose.requestId!==parsed.request.requestId||parsed.request.imageDigest!==declared||
     parsed.request.deadlineMs<=now()||parsed.request.deadlineMs>now()+UPLOAD_INSPECTION_MAX_DEADLINE_MS)throw Error();
   }catch{return refused();}finally{readLife.close();}
   // Body reads yield: a second invocation may have claimed this one-use environment meanwhile.
   if(used||active||stop.signal.aborted||signal?.aborted)return json({error:{code:'UPLOAD_INSPECTION_SESSION_USED'}},409);
   used=true;active=true;
   const call=parsed.request,life=createOperationLifetime({now,deadlineMs:call.deadlineMs,signal:joined,errorFactory:uploadInspectionFault});
   pending=(async()=>{try{
    const value=await life.run(callSignal=>port.inspect(call.declaration,Buffer.from(parsed.bytes),
     {deadlineMs:life.deadline(),signal:callSignal}));
    life.check();
    const body=uploadInspectionBody({requestId:call.requestId,imageDigest:declared,value}),text=JSON.stringify(body);
    if(Buffer.byteLength(text)>UPLOAD_INSPECTION_RESULT_BYTES)throw Error();
    return new Response(text,{headers:{'content-type':'application/json','cache-control':'no-store'}});
   }catch{poisoned=true;return unavailable();}finally{active=false;life.close();}})();
   return pending;
  }});
}
/** The one environment entry this host reads: the runtime image digest its own deployment gave it. It is a DECLARED
 * expectation carried into the wire and into the receipts, never evidence that a running image was observed. */
export const UPLOAD_INSPECTION_IMAGE_ENVIRONMENT='MERI_RENDERER_IMAGE_DIGEST';
/** The closed container-side `uploads.native` declaration. This host names exactly one thing -- the image digest of
 * the deployment it runs in -- and no root, program, tool, session, runtime, budget or command can be selected from
 * the environment, a request or the upload. An absent or malformed digest declares NO native inspection, so the
 * purpose stays honestly unavailable instead of offering a scanner this host cannot attest. */
export function uploadInspectionHostConfiguration(environment=globalThis.process?.env??{},options={}){
 const digest=environment===null||typeof environment!=='object'?undefined:environment[UPLOAD_INSPECTION_IMAGE_ENVIRONMENT];
 // `scratchRoot` and `definitionsRoot` are the same kind of narrow fixture port `mountUploadNativeControl` already
 // accepts from a test: production supplies NEITHER, so the fixed task-local image paths are what run, and a focused
 // check can point the composition at its own temporary roots instead of a shared one. Both remain absolute paths
 // validated by the declaration compiler.
 const scratch=typeof options.scratchRoot==='string'?{scratchRoot:options.scratchRoot}:{};
 const definitions=typeof options.definitionsRoot==='string'?{definitionsRoot:options.definitionsRoot}:{};
 const native=typeof digest==='string'&&DIGEST.test(digest)
  ?Object.freeze({enabled:true,imageDigest:digest,...scratch,...definitions}):Object.freeze({enabled:false});
 return Object.freeze({uploads:Object.freeze({native})});
}
/** The container-side host join: this purpose's own startup composition, run BEFORE the application serves.
 *
 * It reuses the accepted owners end to end -- `uploads/composition.mjs` `composeUploadNativeHost` over the fixed
 * native sandbox, the observed tool identities and the signed-definition store, mounted by the SAME
 * `mountUploadNativeControl` the CONTROL host uses. Two things are load-bearing:
 *
 *  - the declaration it is given is built here from this image's own environment and never carries `agentcore`, so
 *    the composition is local by construction and the remote transport cannot be selected on this side;
 *  - the admission must carry the SAME declared expectation this purpose was built for: an admission issued for
 *    another image is refused (UNAVAILABLE) rather than served as if it were this image, the same before/after
 *    correlation the existing renderer owner applies. No observed digest is claimed or invented here -- observing a
 *    running image remains the separate image owner's join.
 *
 * The probe is handed this image's protected-path inventory (`RUNTIME_CREDENTIAL_PATHS`, the same list the renderer
 * purpose in this image proves unreadable). The qualifier admits `noCredentials` only over a NON-EMPTY inventory whose
 * every path the child could not read; without it the live container reported `noCredentials` unmet with
 * `checked:0`, and the purpose was permanently 503 regardless of the actual sandbox.
 *
 * The probe is also handed `agentcoreRuntimePlatform(environment)`: evidence derived from the verified entrypoint
 * environment (control origin, pinned CA, region) that the deployment controls, not an external platform signal (see
 * the accepted limit and follow-up in `agentcore-platform.mjs`). On the AgentCore microVM, whose single unlimited root
 * cgroup uid 1000 can neither tighten nor leaf, that evidence plus the HOST-observed shape attests `boundedResources`
 * as `boundedBy:'agentcore-microvm'`; without the verified environment, or without a resolved host hierarchy, the
 * finite-cgroup requirement stands unchanged.
 *
 * A host that cannot attest the sandbox, observe the tools or resolve a signed snapshot yields `inspection:null` plus
 * the exact `missing` list, so the application answers 503 and no caller ever sees a fabricated scan. */
export async function composeUploadInspectionHost({environment=globalThis.process?.env??{},now=Date.now,signal,deadlineMs,run,processing,paths,readFileImpl,scratchRoot,definitionsRoot,hostCgroup}={}){
 const roots={...(scratchRoot===undefined?{}:{scratchRoot}),...(definitionsRoot===undefined?{}:{definitionsRoot})};
 const configuration=uploadInspectionHostConfiguration(environment,roots);
 const handle=await mountUploadNativeControl({configuration,now,signal,credentialPaths:[...RUNTIME_CREDENTIAL_PATHS],platform:agentcoreRuntimePlatform(environment),
  deadlineMs:Number.isSafeInteger(deadlineMs)?deadlineMs:now()+UPLOAD_NATIVE_MOUNT_MS,
  ...(processing===undefined?{}:{processing}),...(run===undefined?{}:{run}),...(paths===undefined?{}:{paths}),
  ...(readFileImpl===undefined?{}:{readFileImpl}),...(hostCgroup===undefined?{}:{hostCgroup})});
 const declared=configuration.uploads.native.enabled===true?configuration.uploads.native.imageDigest:null;
 if(handle.inspection!==null&&declared!==null&&handle.host?.admission?.imageDigest!==declared)
  return Object.freeze({inspection:null,host:handle.host,missing:Object.freeze(['uploads.native.imageDigest']),
   provisionDefinitions:handle.provisionDefinitions});
 return handle;
}
