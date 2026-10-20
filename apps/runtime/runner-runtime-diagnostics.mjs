/** Task-local failure context. Only fixed stages and reviewed codes may reach stderr. */
import {AsyncLocalStorage} from 'node:async_hooks';
import {createHash} from 'node:crypto';
import {types} from 'node:util';

/** The pinned native transport's fixed failure classes (pinned-native-transport.mjs documents each), owned here with the
 * rest of the allowlist so the transport, the clients that read its answers and RUNNER_FIRST_FAILURE share one vocabulary. */
export const PINNED_NATIVE_FAILURE_CODES=Object.freeze(['PINNED_NATIVE_CONFIGURATION','PINNED_NATIVE_REFUSED','PINNED_NATIVE_ABORTED','PINNED_NATIVE_TIMEOUT',
 'PINNED_NATIVE_CONNECT','PINNED_NATIVE_TLS','PINNED_NATIVE_SOCKET','PINNED_NATIVE_TRANSPORT','PINNED_NATIVE_RESPONSE',
 'PINNED_NATIVE_STATUS_403','PINNED_NATIVE_STATUS_503','PINNED_NATIVE_STATUS_4XX','PINNED_NATIVE_STATUS_5XX','PINNED_NATIVE_STATUS_OTHER']);
/** Rejections after which no answer arrived (the connection, its TLS or socket failed, or a 200 was cut short): an idempotent
 * caller may send again. A timeout or abort is a deadline, and a non-200 status is an answer. */
export const PINNED_NATIVE_UNANSWERED=Object.freeze(['PINNED_NATIVE_CONNECT','PINNED_NATIVE_TLS','PINNED_NATIVE_SOCKET','PINNED_NATIVE_RESPONSE']);
/** The largest non-200 body the transport delivers, and the most the native client reads of one. */
export const PINNED_NATIVE_ERROR_BODY_MAX_BYTES=4096;
/** A rejection carrying exactly one class as `code`; its message is constant and nothing observed is attached. */
export const pinnedNativeRefusal=code=>Object.assign(Error('PINNED_NATIVE_REFUSED'),{code:PINNED_NATIVE_FAILURE_CODES.includes(code)?code:'PINNED_NATIVE_TRANSPORT'});
export function classifyPinnedStatus(statusCode){
 if(statusCode===403)return 'PINNED_NATIVE_STATUS_403';if(statusCode===503)return 'PINNED_NATIVE_STATUS_503';
 if(Number.isInteger(statusCode)&&statusCode>=400&&statusCode<500)return 'PINNED_NATIVE_STATUS_4XX';
 if(Number.isInteger(statusCode)&&statusCode>=500&&statusCode<600)return 'PINNED_NATIVE_STATUS_5XX';return 'PINNED_NATIVE_STATUS_OTHER';
}
/** A non-200 answer's fixed status class, for a client to keep as the `cause` of its own refusal (never a body, status text
 * or header). */
export const pinnedStatusRefusal=statusCode=>pinnedNativeRefusal(classifyPinnedStatus(statusCode));
const context=new AsyncLocalStorage();
const origins=new Set(['runtime','sdk-prepare','native-prepare','native-start']);
const stages=new Set(['module-import','runner-preflight','capability-load','binding-bootstrap','remote-module-import','admission-wait','activity',
 'runtime-prepare','runtime-admission','sdk-session','sdk-directories','skill-plugin','runner-cleanup',
 'activity-input','activity-load','activity-policy','activity-setup','activity-starting','activity-running','activity-query',
 'activity-stream','activity-output','activity-result','activity-finalize','activity-complete','activity-terminal','activity-cleanup',
 'remote-config','remote-tls','remote-clients','remote-worker','remote-listen','kickoff-wait','remote-cleanup']);
const codes=new Set(['ENOENT','EACCES','EPERM','ENOTDIR','EEXIST','EADDRINUSE','ERR_MODULE_NOT_FOUND','MODULE_NOT_FOUND','ERR_DLOPEN_FAILED',
 'DEADLINE','CANCELLED','NATIVE_CONFIGURATION','NATIVE_UNAVAILABLE','RUNTIME_SECRET_FILE','RUNNER_AMBIENT_CREDENTIAL_REFUSED',
 'RUNNER_WORKSPACE_REFUSED','RUNNER_POSTSTART_REFUSED','TASK_BOOTSTRAP_REFUSED','TASK_BOOTSTRAP_BINDING_REFUSED',
 'RUNNER_VERSION_REFUSED','RUNNER_RUNTIME_REFUSED','RUNNER_SDK_REGISTRATION_UNAVAILABLE','RUNNER_SDK_CA_REFUSED','RUNNER_SDK_DIRECTORY_REFUSED',
 'RUNNER_SDK_RESTORE_REFUSED','RUNNER_SDK_SESSION_UNKNOWN','RUNNER_SESSION_CONFIGURATION','RUNNER_SESSION_STOPPED','RUNNER_CLEANUP_UNKNOWN',
 'EXECUTION_FAILED','EXECUTION_STOPPED','SDK_CLEANUP_UNKNOWN','KICKOFF_UNKNOWN','NATIVE_EXECUTION_KICKOFF_UNKNOWN','TASK_ROUTER_REFUSED','TASK_ROUTER_UNKNOWN',
 'RUN_NOT_QUEUED','CONTINUATION_REFUSED','CONTINUATION_UNAVAILABLE','RUNTIME_PIN_REFUSED','SKILL_PIN_REFUSED','SKILL_RUNTIME_REFUSED',
 'SDK_STREAM_REFUSED','SESSION_PERSISTENCE_FAILED','OUTPUT_LIMIT','SDK_RESULT_DUPLICATE','SDK_EXECUTION_FAILED','SDK_RESULT_MISSING',
 'OUTPUT_PUBLICATION_UNAVAILABLE','OBJECTIVE_COMPLETION_UNAVAILABLE','STORE_UNAVAILABLE','STORE_COMMIT_UNKNOWN',
 'REMOTE_TASK_REFUSED','NATIVE_EXECUTION_SDK_PREPARATION_CONFIGURATION','NATIVE_EXECUTION_SDK_PREPARATION_REFUSED',
 'NATIVE_EXECUTION_SDK_PREPARATION_BINDING_UNKNOWN','NATIVE_EXECUTION_SDK_PREPARATION_NO_LAUNCH',
 'NATIVE_EXECUTION_SDK_PREPARATION_CLEANUP_UNKNOWN','NATIVE_EXECUTION_SDK_ITERATOR_REUSED',
 // Constant codes or messages of code-less throws reachable after native start (runner query, SDK stream, session mirror).
 'INVALID_COMMAND','RUNTIME_CONFIGURATION','SDK_TEXT_REFUSED','SDK_TEXT_LIMIT','SDK_TEXT_INCONSISTENT','SDK_PROGRESS_REFUSED',
 'SESSION_TRANSPORT_UNCERTAIN','SESSION_TRANSPORT_FAILED','SESSION_QUEUE_BOUND','SESSION_MIRROR_CLOSED','RUNNER_SDK_FIRST_LOAD_REFUSED',
 'ABORT_ERR','EPIPE','ECONNRESET','ERR_STREAM_DESTROYED','ERR_STREAM_WRITE_AFTER_END','ERR_STREAM_PREMATURE_CLOSE','ERR_ENCODING_INVALID_ENCODED_DATA',
 'NATIVE_REQUEST_LIMIT','NATIVE_RESPONSE_LIMIT','NATIVE_RESPONSE_INVALID','RUNNER_BINDING_REFUSED','RUNNER_CREDENTIAL_CONFIGURATION',
 // Lifecycle controls (worker/conversation/continuation/activity-lifecycle.mjs), raced against the SDK stream.
 'LIFECYCLE_EXECUTION_UNKNOWN','LIFECYCLE_CONFIGURATION','CONTROL_ENVELOPE_REFUSED','CONTROL_PAGE_REFUSED','CONTROL_PENDING_LIMIT',
 'CONTROL_CLAIM_REFUSED','HOLD_CONTROL_MISSING','HOLD_UNSETTLED','HOLD_CHECKPOINT_FAILED','SDK_SESSION_MISSING','SDK_SESSION_REFUSED',
 'SDK_INPUT_ECHO_REFUSED','CHECKPOINT_RECORD_REFUSED','COMPLETION_CAPTURE_UNAVAILABLE',
 ...PINNED_NATIVE_FAILURE_CODES]);
/** The pinned SDK (0.3.295) tags its own failures with one of these own `errorClass` values; reported as SDK_<CLASS>. */
const sdkErrorClasses=new Set(['aborted','control_request_failed','error_result','executable_launch_failed','executable_not_found',
 'initialize_timeout','process_error','process_exited_nonzero','process_killed_by_signal','unreadable']);
const errorTypes=[[AggregateError,'AGGREGATE_ERROR'],[TypeError,'TYPE_ERROR'],[SyntaxError,'SYNTAX_ERROR'],[RangeError,'RANGE_ERROR'],
 [ReferenceError,'REFERENCE_ERROR'],[DOMException,'DOM_EXCEPTION']];
const signals=new Set(['SIGABRT','SIGALRM','SIGBUS','SIGFPE','SIGHUP','SIGILL','SIGINT','SIGKILL','SIGPIPE','SIGQUIT','SIGSEGV','SIGSYS','SIGTERM',
 'SIGTRAP','SIGUSR1','SIGUSR2','SIGXCPU','SIGXFSZ']);
const nonError=Object.freeze({code:'NON_ERROR',kind:'NON_ERROR',exit:'none',signal:'none',cause:'none',msg:'none',site:'none'});
const ownValue=(error,key)=>{const d=Object.getOwnPropertyDescriptor(error,key);return d&&Object.hasOwn(d,'value')?d.value:undefined;};
/** Twelve hex characters of SHA-256 over an error message. Matched offline against
 * docs/integration/runner-first-failure-message-hashes.json; the message itself is never printed. */
export const firstFailureMessageHash=message=>createHash('sha256').update(message,'utf8').digest('hex').slice(0,12);
// V8 exposes `stack` as one shared native accessor that formats through Node's default prepareStackTrace, reading
// `name` and `message`. It is invoked only when both resolve to data properties, so no user getter ever runs.
const nativeStackGetter=Object.getOwnPropertyDescriptor(Error(),'stack')?.get,nativePrepareStackTrace=Error.prepareStackTrace;
const frame=/^\s+at (?:async )?(?:[^()]*\()?(?:(?:file:\/\/)?\/(?:[^()\s]*\/)?([A-Za-z0-9_.@-]{1,80}\.(?:mjs|cjs|js))|node:(?:[A-Za-z0-9_.-]{1,40}\/){0,4}([A-Za-z0-9_.-]{1,40})):(\d{1,7}):(\d{1,7})\)?$/u;
/** The value `key` resolves to through the prototype chain, but only when every step is an ordinary object and the
 * property found is a data property (no proxy, no accessor is ever touched). */
function dataValue(object,key){
 for(let o=object,depth=0;o!==null;o=Object.getPrototypeOf(o),depth++){
  if(depth>16||types.isProxy(o))return {ok:false};const d=Object.getOwnPropertyDescriptor(o,key);
  if(d)return Object.hasOwn(d,'value')?{ok:true,value:d.value}:{ok:false};
 }
 return {ok:true,value:undefined};
}
const lineBreaks=value=>typeof value==='string'?value.split('\n').length-1:0;
/** Up to three innermost code locations as module basename:line:column (absolute file paths and node: modules only).
 * The header lines that `name: message` occupies are skipped, so message text can never be read as a frame. */
function siteOf(error){
 const name=dataValue(error,'name'),message=dataValue(error,'message');if(!name.ok||!message.ok)return 'none';
 const d=Object.getOwnPropertyDescriptor(error,'stack');let stack;
 if(d&&Object.hasOwn(d,'value'))stack=d.value;
 else if(nativeStackGetter&&d?.get===nativeStackGetter&&Error.prepareStackTrace===nativePrepareStackTrace)stack=d.get.call(error);
 if(typeof stack!=='string')return 'none';
 const sites=[];
 for(const line of stack.split('\n',64).slice(1+lineBreaks(name.value)+lineBreaks(message.value))){
  const m=frame.exec(line);if(m){sites.push(`${m[1]??'node:'+m[2]}:${m[3]}:${m[4]}`);if(sites.length===3)break;}
 }
 return sites.length?sites.join(','):'none';
}
/** Fixed classification only: an allowlisted own code (or an allowlisted constant message), the SDK error class or built-in
 * error type, and the SDK's own process exit code (0-255) or signal (fixed names). A failure without an allowlisted code
 * reports its class as its code, so no Error is ever printed as UNKNOWN. */
function classify(error){
 if(error===null||typeof error!=='object'||types.isProxy(error))return nonError;
 const errorClass=ownValue(error,'errorClass'),exitCode=ownValue(error,'exitCode'),signal=ownValue(error,'signal'),code=ownValue(error,'code'),message=ownValue(error,'message');
 const kind=typeof errorClass==='string'?sdkErrorClasses.has(errorClass)?'SDK_'+errorClass.toUpperCase():'SDK_OTHER':
  errorTypes.find(([type])=>error instanceof type)?.[1]??(error instanceof Error?'ERROR':'NON_ERROR');
 return {code:codes.has(code)?code:codes.has(message)?message:kind,kind,
  exit:Number.isSafeInteger(exitCode)&&exitCode>=0&&exitCode<=255?String(exitCode):'none',signal:signals.has(signal)?signal:'none'};
}
/** Classification plus code-location detail: the own `cause` classified the same way, a message hash and the throw site.
 * Never a message, stack text, stderr tail or path. */
function describe(error){
 let fixed;try{fixed=classify(error);}catch{return nonError;}if(fixed===nonError)return nonError;
 const detail=(read,fallback)=>{try{return read();}catch{return fallback;}};
 return {...fixed,cause:detail(()=>{const cause=ownValue(error,'cause');return cause===undefined?'none':classify(cause).code;},'NON_ERROR'),
  msg:detail(()=>{const message=ownValue(error,'message');return typeof message==='string'?firstFailureMessageHash(message):'none';},'none'),
  site:detail(()=>siteOf(error),'none')};
}
export function markRunnerStage(stage){
 const active=context.getStore();if(active)active.stage=stages.has(stage)?stage:'runner-preflight';
}
function emit(active,line){try{Promise.resolve(active.write(line)).catch(()=>{});}catch{}}
/** First observed terminal error, not proof of an unexpected cause or provider contact. Its stage is printed here because
 * a cleanup that outlives the shutdown timer never reaches the final RUNNER_RUNTIME_FAILED line. */
export function captureRunnerFailure(error,origin='runtime'){
 const active=context.getStore();if(active&&active.failure===undefined){
  const failure=active.failure=Object.freeze({stage:active.stage,origin:origins.has(origin)?origin:'runtime',...describe(error)});
  emit(active,`RUNNER_FIRST_FAILURE origin=${failure.origin} stage=${failure.stage} code=${failure.code} class=${failure.kind} exit=${failure.exit} signal=${failure.signal} cause=${failure.cause} msg=${failure.msg} site=${failure.site}\n`);
 }
}
/** A nested failure is captured before activity translation or cleanup can replace it. */
export async function atRunnerStage(stage,operation){
 markRunnerStage(stage);try{return await operation();}catch(error){captureRunnerFailure(error);throw error;}
}
export async function withRunnerDiagnostics(operation,{write=line=>process.stderr.write(line)}={}){
 return context.run({stage:'module-import',write},async()=>{
  try{return await operation();}catch(error){
   captureRunnerFailure(error);const {stage,code}=context.getStore().failure;
   emit(context.getStore(),`RUNNER_RUNTIME_FAILED stage=${stage} code=${code}\n`);
   throw error;
  }
 });
}
