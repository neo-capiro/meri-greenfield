/** Task-local failure context. Only fixed stages and reviewed codes may reach stderr. */
import {AsyncLocalStorage} from 'node:async_hooks';
import {types} from 'node:util';

const context=new AsyncLocalStorage();
const stages=new Set(['module-import','runner-preflight','capability-load','binding-bootstrap','remote-module-import','admission-wait','activity',
 'runtime-prepare','runtime-admission','sdk-session','sdk-directories','skill-plugin','runner-cleanup',
 'activity-input','activity-load','activity-policy','activity-setup','activity-starting','activity-running','activity-query',
 'activity-stream','activity-output','activity-result','activity-finalize','activity-complete','activity-terminal','activity-cleanup',
 'remote-config','remote-tls','remote-clients','remote-worker','remote-listen','kickoff-wait','remote-cleanup']);
const codes=new Set(['UNKNOWN','ENOENT','EACCES','EPERM','ENOTDIR','EEXIST','EADDRINUSE','ERR_MODULE_NOT_FOUND','MODULE_NOT_FOUND','ERR_DLOPEN_FAILED',
 'DEADLINE','CANCELLED','NATIVE_CONFIGURATION','NATIVE_UNAVAILABLE','RUNTIME_SECRET_FILE','RUNNER_AMBIENT_CREDENTIAL_REFUSED',
 'RUNNER_WORKSPACE_REFUSED','RUNNER_POSTSTART_REFUSED','TASK_BOOTSTRAP_REFUSED','TASK_BOOTSTRAP_BINDING_REFUSED',
 'RUNNER_VERSION_REFUSED','RUNNER_RUNTIME_REFUSED','RUNNER_SDK_REGISTRATION_UNAVAILABLE','RUNNER_SDK_CA_REFUSED','RUNNER_SDK_DIRECTORY_REFUSED',
 'RUNNER_SDK_RESTORE_REFUSED','RUNNER_SDK_SESSION_UNKNOWN','RUNNER_SESSION_CONFIGURATION','RUNNER_SESSION_STOPPED','RUNNER_CLEANUP_UNKNOWN',
 'EXECUTION_FAILED','EXECUTION_STOPPED','SDK_CLEANUP_UNKNOWN','KICKOFF_UNKNOWN','NATIVE_EXECUTION_KICKOFF_UNKNOWN','TASK_ROUTER_REFUSED','TASK_ROUTER_UNKNOWN',
 'RUN_NOT_QUEUED','CONTINUATION_REFUSED','CONTINUATION_UNAVAILABLE','RUNTIME_PIN_REFUSED','SKILL_PIN_REFUSED','SKILL_RUNTIME_REFUSED',
 'SDK_STREAM_REFUSED','SESSION_PERSISTENCE_FAILED','OUTPUT_LIMIT','SDK_RESULT_DUPLICATE','SDK_EXECUTION_FAILED','SDK_RESULT_MISSING',
 'OUTPUT_PUBLICATION_UNAVAILABLE','OBJECTIVE_COMPLETION_UNAVAILABLE','STORE_UNAVAILABLE','STORE_COMMIT_UNKNOWN']);

function codeOf(error){
 if(error===null||typeof error!=='object'||types.isProxy(error))return 'UNKNOWN';
 const descriptor=Object.getOwnPropertyDescriptor(error,'code');
 return descriptor&&Object.hasOwn(descriptor,'value')&&codes.has(descriptor.value)?descriptor.value:'UNKNOWN';
}
export function markRunnerStage(stage){
 const active=context.getStore();if(active)active.stage=stages.has(stage)?stage:'runner-preflight';
}
export function captureRunnerFailure(error){
 const active=context.getStore();if(active&&active.failure===undefined)active.failure={stage:active.stage,code:codeOf(error)};
}
/** A nested failure is captured before activity translation or cleanup can replace it. */
export async function atRunnerStage(stage,operation){
 markRunnerStage(stage);try{return await operation();}catch(error){captureRunnerFailure(error);throw error;}
}
export async function withRunnerDiagnostics(operation,{write=line=>process.stderr.write(line)}={}){
 return context.run({stage:'module-import'},async()=>{
  try{return await operation();}catch(error){
   captureRunnerFailure(error);const {stage,code}=context.getStore().failure;
   try{write(`RUNNER_RUNTIME_FAILED stage=${stage} code=${code}\n`);}catch{}
   throw error;
  }
 });
}
