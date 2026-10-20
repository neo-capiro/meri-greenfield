/** Task-local failure context. Only fixed stages and reviewed codes may reach stderr. */
import {AsyncLocalStorage} from 'node:async_hooks';
import {types} from 'node:util';

/** The pinned native transport's fixed failure classes (pinned-native-transport.mjs documents each), owned here with the
 * rest of the allowlist so the transport and RUNNER_FIRST_FAILURE share one vocabulary. */
export const PINNED_NATIVE_FAILURE_CODES=Object.freeze(['PINNED_NATIVE_CONFIGURATION','PINNED_NATIVE_REFUSED','PINNED_NATIVE_ABORTED','PINNED_NATIVE_TIMEOUT',
 'PINNED_NATIVE_CONNECT','PINNED_NATIVE_TLS','PINNED_NATIVE_SOCKET','PINNED_NATIVE_TRANSPORT','PINNED_NATIVE_RESPONSE',
 'PINNED_NATIVE_STATUS_403','PINNED_NATIVE_STATUS_503','PINNED_NATIVE_STATUS_4XX','PINNED_NATIVE_STATUS_5XX','PINNED_NATIVE_STATUS_OTHER']);
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
 ...PINNED_NATIVE_FAILURE_CODES]);
/** The pinned SDK (0.3.295) tags its own failures with one of these own `errorClass` values; reported as SDK_<CLASS>. */
const sdkErrorClasses=new Set(['aborted','control_request_failed','error_result','executable_launch_failed','executable_not_found',
 'initialize_timeout','process_error','process_exited_nonzero','process_killed_by_signal','unreadable']);
const errorTypes=[[AggregateError,'AGGREGATE_ERROR'],[TypeError,'TYPE_ERROR'],[SyntaxError,'SYNTAX_ERROR'],[RangeError,'RANGE_ERROR'],
 [ReferenceError,'REFERENCE_ERROR'],[DOMException,'DOM_EXCEPTION']];
const signals=new Set(['SIGABRT','SIGALRM','SIGBUS','SIGFPE','SIGHUP','SIGILL','SIGINT','SIGKILL','SIGPIPE','SIGQUIT','SIGSEGV','SIGSYS','SIGTERM',
 'SIGTRAP','SIGUSR1','SIGUSR2','SIGXCPU','SIGXFSZ']);
const nonError=Object.freeze({code:'NON_ERROR',kind:'NON_ERROR',exit:'none',signal:'none'});
const ownValue=(error,key)=>{const d=Object.getOwnPropertyDescriptor(error,key);return d&&Object.hasOwn(d,'value')?d.value:undefined;};
/** Fixed fields only: an allowlisted own code (or an allowlisted constant message), the SDK error class or built-in error
 * type, and the SDK's own process exit code (0-255) or signal (fixed names). Never a message, stack, stderr text or path.
 * A failure without an allowlisted code reports its class as its code, so no Error is ever printed as UNKNOWN. */
function describe(error){
 try{
  if(error===null||typeof error!=='object'||types.isProxy(error))return nonError;
  const errorClass=ownValue(error,'errorClass'),exitCode=ownValue(error,'exitCode'),signal=ownValue(error,'signal'),code=ownValue(error,'code'),message=ownValue(error,'message');
  const kind=typeof errorClass==='string'?sdkErrorClasses.has(errorClass)?'SDK_'+errorClass.toUpperCase():'SDK_OTHER':
   errorTypes.find(([type])=>error instanceof type)?.[1]??(error instanceof Error?'ERROR':'NON_ERROR');
  return {code:codes.has(code)?code:codes.has(message)?message:kind,kind,
   exit:Number.isSafeInteger(exitCode)&&exitCode>=0&&exitCode<=255?String(exitCode):'none',signal:signals.has(signal)?signal:'none'};
 }catch{return nonError;}
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
  emit(active,`RUNNER_FIRST_FAILURE origin=${failure.origin} stage=${failure.stage} code=${failure.code} class=${failure.kind} exit=${failure.exit} signal=${failure.signal}\n`);
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
