/** Production readRun for the browser-only service: built from the SAME authenticated currentness client and the
 * SAME pinned allocation/binding the service already validated. The client's own ingest method is the artifact
 * port the fragment calls; no second store, listener or authority is created here. */
import {createBrowserHostReadRun} from '../../worker/conversation/host/control/runtime-read-run.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
/** The fragment's artifacts.ingest request is mapped onto the client's closed wire method: the client derives
 * host identity, nonce, provenance and the deterministic key; only the reviewed file facts travel. */
export function clientArtifactPort(client){
 if(typeof client?.ingest!=='function')fail('BROWSER_HOST_SERVICE_READRUN_UNBOUND');
 return Object.freeze({async ingest(request,options={}){
  const r=request;
  if(!r||typeof r!=='object'||!Buffer.isBuffer(r.bytes)||typeof r.filename!=='string'||
   typeof r.format!=='string'||typeof r.mimeType!=='string'||typeof r.sha256!=='string'||
   typeof r.source?.origin!=='string')fail('BROWSER_HOST_SERVICE_READRUN_REFUSED');
  return client.ingest({filename:r.filename,format:r.format,mimeType:r.mimeType,sha256:r.sha256,
   origin:r.source.origin,bytes:Buffer.from(r.bytes)},{signal:options.signal});
 },
 /** READ-ONLY recovery: the fragment may ask for the ORIGINAL committed download of this run+filename when the
  * output file is gone. No bytes are uploaded and no receipt is appended here. */
 async reconcile(request,options={}){
  if(!request||typeof request.filename!=='string')fail('BROWSER_HOST_SERVICE_READRUN_REFUSED');
  return client.reconcileBrowserDownload({filename:request.filename},{signal:options.signal});
 }});
}
/** The operation host's readRun over the authenticated client. Sessions are replaced by the SAME physical
 * sessionHost in the composition wrapper, exactly as the existing external readRun was. */
export function createBrowserOnlyReadRun(inputs){
 const client=inputs.browserClient;
 return createBrowserHostReadRun({allocation:inputs.allocation,binding:inputs.binding,cwd:inputs.cwd,
  client,installation:inputs.installation,egress:inputs.browser,processes:inputs.processes,
  artifacts:clientArtifactPort(client)});
}
