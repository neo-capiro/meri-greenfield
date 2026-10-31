/** Internal, content-free context for an existing capture refusal; the thrown Error stays unchanged. */
const roots=Object.freeze(['CWD','SDK_TASKS']);
const reasons=Object.freeze(['TYPE','SYMLINK','LINK_COUNT','CANONICAL_PATH','FILE_COUNT','FILE_SIZE','TOTAL_BYTES']);
export const WORKSPACE_CAPTURE_DIAGNOSTIC_CODES=Object.freeze(roots.flatMap(root=>reasons.map(reason=>`WORKSPACE_CAPTURE_${root}_${reason}`)));
const failures=new WeakMap();
export function workspaceCaptureEntryRefusal(reason){
 const error=Error('WORKSPACE_CAPTURE_REFUSED');
 if(reasons.includes(reason))failures.set(error,{reason,root:null});
 return error;
}
/** Only the native-files owner knows which of its two separately owned roots it called. */
export function identifyWorkspaceCaptureRoot(error,root){
 const failure=failures.get(error);if(failure&&roots.includes(root)&&failure.root===null)failure.root=root;
 return error;
}
/** No properties, getters, paths or messages from the Error are inspected. */
export function workspaceCaptureDiagnosticCause(error){
 const failure=failures.get(error);return failure?.root?`WORKSPACE_CAPTURE_${failure.root}_${failure.reason}`:undefined;
}
