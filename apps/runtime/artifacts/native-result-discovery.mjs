/** Bounded, read-only projection of a run's published native workspace capture into discoverable selectors.
 *
 * A selector is metadata only: it names the immutable object a workspace entry already carries so a client can ask the
 * EXISTING current-authorized document release path for that versionId. This leaf creates no artifact, no version, no
 * object, no event and no new public contract; it reuses the ordinary run `authenticate` port and the existing
 * conversation journal read owner, and it re-authenticates after the read so a revoked or rebound session cannot keep
 * a selector list alive. SDK task state is never projected, and entry bytes are never returned.
 *
 * Host/native qualification is unaffected: nothing here executes a sandbox or a model. */
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertNativeConversationScope} from '../../../packages/contracts/runtime-0.2/session.mjs';
import {assertNativeFileState} from '../../../packages/contracts/runtime-0.2/files.mjs';
import {assertExecutionIdentity} from '../../control/conversations/execution-boundary.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
/** @param {string} code @returns {never} */
const fail=code=>{throw Object.assign(Error(code),{code});};
export const MAX_NATIVE_RESULTS=32,MAX_NATIVE_RESULT_PATH=240,MAX_NATIVE_RESULT_BYTES=10485760;
/** A selector path is a relative, bounded workspace path; nothing absolute, traversing, escaped or host-shaped. */
export const isSelectableWorkspacePath=path=>typeof path==='string'&&path.length>0&&path.length<=MAX_NATIVE_RESULT_PATH&&
 !path.startsWith('/')&&!path.endsWith('/')&&!path.includes('\\')&&!path.includes('\0')&&!path.split('/').includes('..')&&
 !path.split('/').some(segment=>segment===''||segment==='.');
/** Pure, bounded projection of a settled capture into workspace-only metadata selectors. Shared by the public
 * current-session port (apps/runtime/artifacts/composition.mjs) and the run-authenticated private reader below, so the
 * bounded rules and the workspace-only privacy rule have exactly one implementation. Returns metadata only: no bytes,
 * no base64, no host path and never the SDK `tasks` tree. `owner` is the caller's own context binding, which the route
 * re-checks before release. */
export function projectNativeResults({files,binding,scopes,owner,maxResults=MAX_NATIVE_RESULTS}){
 if(!Number.isSafeInteger(maxResults)||maxResults<1||maxResults>MAX_NATIVE_RESULTS)fail('NATIVE_RESULT_CONFIGURATION');
 const state=assertNativeFileState(files,{binding,scopes});
 const selectable=state.workspace.entries.filter(entry=>isSelectableWorkspacePath(entry.path)&&entry.object.bytes<=MAX_NATIVE_RESULT_BYTES)
  .map(entry=>({versionId:entry.object.objectId,path:entry.path,bytes:entry.object.bytes,sha256:entry.object.sha256,executable:entry.executable}))
  .sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
 return {binding:owner,scopes,manifestId:state.workspace.manifestId,capturedAt:state.workspace.createdAt,
  results:selectable.slice(0,maxResults),truncated:selectable.length>maxResults};
}
export function createNativeResultDiscovery(configuration){
 const c=own(configuration,['authenticate','store','selectedClientId','now'],['maxRequestMs','maxResults']);
 const read=storageMethod(c.store?.lifecycle,'readSessionCapture');
 if(typeof c.authenticate!=='function'||typeof c.now!=='function'||typeof c.selectedClientId!=='string'||c.selectedClientId==='')fail('NATIVE_RESULT_CONFIGURATION');
 const maxResults=c.maxResults??MAX_NATIVE_RESULTS,maxRequestMs=c.maxRequestMs??23000;
 if(!Number.isSafeInteger(maxResults)||maxResults<1||maxResults>MAX_NATIVE_RESULTS||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1)fail('NATIVE_RESULT_CONFIGURATION');
 return Object.freeze({async list(value){
  const raw=own(value,['credential','request'],['signal','deadlineMs']),binding=own(raw.request,['binding']).binding;nativeSignal(raw.signal);
  if(raw.deadlineMs!==undefined&&!Number.isSafeInteger(raw.deadlineMs))fail('NATIVE_RESULT_REFUSED');
  if(raw.deadlineMs!==undefined&&raw.deadlineMs<=c.now())fail('DEADLINE');
  const life=createOperationLifetime({deadlineMs:Math.min(raw.deadlineMs??Infinity,c.now()+maxRequestMs),now:c.now,signal:raw.signal,errorFactory:code=>Object.assign(Error(code),{code})});
  try{
   const identity=a=>JSON.stringify([a.selectedClientId,a.policyRevision,a.scopes,assertExecutionIdentity(a.execution)]);
   const authenticate=async()=>{const a=data(await life.run(signal=>c.authenticate({credential:raw.credential,binding,signal})));
    own(a,['execution','versions','state','scopes','selectedClientId','policyRevision']);assertNativeConversationScope({binding,scopes:a.scopes,selectedClientId:a.selectedClientId});return a;};
   const first=await authenticate();
   if(first.selectedClientId!==c.selectedClientId)fail('NATIVE_RESULT_REFUSED');
   // The run execution's own expiry can only tighten, never extend, this bounded read.
   if(Number.isSafeInteger(first.execution.expiresAtMs)&&first.execution.expiresAtMs>c.now())life.limitDeadline(first.execution.expiresAtMs);
   const captured=await life.run(signal=>read({binding,scopes:first.scopes,selectedClientId:first.selectedClientId,checkpointId:binding.runId},life.check));
   // The selector list is only ever released under the same current authority that produced it.
   const after=await authenticate();if(identity(after)!==identity(first))fail('NATIVE_RESULT_REFUSED');life.check();
   const files=captured?.proof?.files;
   if(!files)return {binding,manifestId:null,createdAt:null,results:[],truncated:false};
   const state=assertNativeFileState(files,{binding:captured.proof.sdkSession.binding,scopes:first.scopes});
   const projected=projectNativeResults({files,binding:captured.proof.sdkSession.binding,scopes:first.scopes,owner:binding,maxResults});
   return {binding,manifestId:projected.manifestId,createdAt:projected.capturedAt,results:projected.results,truncated:projected.truncated};
  }finally{life.close();}
 }});
}
