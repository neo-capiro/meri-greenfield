/** Bounded, read-only projection of a run's published native workspace capture into discoverable selectors.
 *
 * A selector is metadata only: it names the immutable object a workspace entry already carries so a client can ask the
 * EXISTING current-authorized document release path for that versionId. This leaf creates no artifact, no version, no
 * object, no event and no new public contract, and it owns no reader of its own: the single production caller is the
 * composed document port (apps/runtime/artifacts/composition.mjs `nativeResults`), which reads the settled capture from
 * the existing conversation-journal owner under the session's own current context. SDK task state is never projected,
 * and entry bytes are never returned.
 *
 * Host/native qualification is unaffected: nothing here executes a sandbox or a model. */
import {assertNativeFileState} from '../../../packages/contracts/runtime-0.2/files.mjs';
/** @param {string} code @returns {never} */
const fail=code=>{throw Object.assign(Error(code),{code});};
export const MAX_NATIVE_RESULTS=32,MAX_NATIVE_RESULT_PATH=240,MAX_NATIVE_RESULT_BYTES=10485760;
/** A selector path is a relative, bounded workspace path; nothing absolute, traversing, escaped or host-shaped. */
export const isSelectableWorkspacePath=path=>typeof path==='string'&&path.length>0&&path.length<=MAX_NATIVE_RESULT_PATH&&
 !path.startsWith('/')&&!path.endsWith('/')&&!path.includes('\\')&&!path.includes('\0')&&!path.split('/').includes('..')&&
 !path.split('/').some(segment=>segment===''||segment==='.');
/** Pure, bounded projection of a settled capture into workspace-only metadata selectors. The single production caller is
 * the composed document port (apps/runtime/artifacts/composition.mjs), so the bounded rules and the workspace-only
 * privacy rule have exactly one implementation. Returns metadata only: no bytes,
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
