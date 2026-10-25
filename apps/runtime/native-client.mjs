/** Fixed native provider boundary. Receipts never replace current native policy. */
import {setTimeout as pause} from 'node:timers/promises';
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
import {data,own} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {RUNNER_LOAD_MAX_MS,RUNNER_REPLAY_DELAYS_MS} from '../../packages/runtime/runner-load-budget.mjs';
import {RETENTION_SWEEP_BUDGET} from '../../packages/runtime/retention-sweep-budget.mjs';
import {markAuthorityUnavailable,isAuthorityUnavailable} from '../../packages/runtime/authority-availability.mjs';
import {PINNED_NATIVE_UNANSWERED,PINNED_NATIVE_ERROR_BODY_MAX_BYTES,pinnedStatusRefusal,runnerTurnTelemetry} from './runner-runtime-diagnostics.mjs';
import {fault} from './config.mjs';
import {classifyStatus} from './telemetry/counting.mjs';
import {NATIVE_FILE_LIMITS,nativeFileBindingHeader,assertNativeFileRequest,assertNativeFileRestore} from '../../packages/contracts/runtime-0.2/files.mjs';
const fileOperations=new Set(['runner/checkpoint/capture','runner/checkpoint/complete','runner/files/restore']);
// The longer window is available only to bounded original-run operations.
// Each caller must also pass its absolute lease-derived deadline; other operations
// retain the ordinary 3s default (or the factory's configured cap).
const startupOperations=new Set([
 'runner/execution','runner/execution/settle',
 'runner/native/bootstrap','runner/native/admitted','runner/native/prepare',
 'runner/native/verify','runner/native/start','runner/native/started',
 'runner/runtime','runner/publish','runner/record-usage','runner/checkpoint/capture','runner/checkpoint/complete','runner/files/restore',
 'runner/session/register','runner/session/load','runner/session/append',
 'runner/next-controls','runner/claim-control','runner/ack-control','runner/record-checkpoint',
]);
const STARTUP_REQUEST_MAX_MS=23000;
// Answers that report a dependency that did not answer, never a decision: control's Core/Clerk authority reads
// (worker-http.mjs), the task verifier's (native-authority/task-verifier-http.mjs), or a gateway that lost a request it had
// dispatched (native-runner-gateway.mjs). Such a failure keeps code NATIVE_UNAVAILABLE and carries the transient mark of
// packages/runtime/authority-availability.mjs; every other non-200 answer, including every refusal, stays definitive. The
// pinned transport delivers every answer as a Response (pinned-native-transport.mjs), so the status decides here. Control's
// in-process provider (prepared-candidate.mjs) classifies the same applications' answers with this rule.
const unansweredCodes=new Set(['WORKER_AUTHORITY_UNAVAILABLE','NATIVE_TASK_AUTHORITY_UNAVAILABLE']);
export const unansweredNativeAnswer=(status,error)=>status===503&&(unansweredCodes.has(error?.code)||error?.code==='NATIVE_GATEWAY_UNAVAILABLE'&&error?.outcome==='UNKNOWN');
// Sent again after an unanswered attempt, and only inside the caller's absolute deadline: runner/load is a read, and
// runner/publish carries a fixed eventId that control's store returns instead of appending twice
// (apps/control/conversations/postgres-store.mjs appendEvent). No other operation is replayed.
const replayable=new Set(['runner/load','runner/publish','runner/record-usage']);
const REPLAY_DELAYS_MS=RUNNER_REPLAY_DELAYS_MS,REPLAY_MIN_ATTEMPT_MS=1000;
// A transport that failed after dispatch before any answer: one of the pinned transport's no-answer rejections, or a plain
// fetch's network TypeError. Its timeout or abort is a deadline, and a non-200 head arrives as a Response, never here.
const noAnswer=error=>error instanceof TypeError||PINNED_NATIVE_UNANSWERED.includes(error?.code);
const json=response=>/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(response.headers.get('content-type')??'')&&!response.headers.get('content-encoding');
export function createNativeCapabilityClient({configuration,credential,fetch:transport=fetch,now=Date.now,maxRequestMs=3000,loadMaxRequestMs=maxRequestMs}){
 if(typeof credential!=='string'||!/^[A-Za-z0-9._~+\/-]{1,8192}={0,2}$/u.test(credential)||
    !Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>10000||
    !Number.isSafeInteger(loadMaxRequestMs)||loadMaxRequestMs<1||loadMaxRequestMs>RUNNER_LOAD_MAX_MS)throw fault('NATIVE_CONFIGURATION');
 const c=configuration;
 async function body(response,life,limit){
  const reader=response.body?.getReader();if(!reader)throw fault('NATIVE_UNAVAILABLE');const parts=[];let size=0;try{while(true){const next=await life.run(()=>reader.read());if(next.done)break;size+=next.value.length;if(size>limit)throw fault('NATIVE_RESPONSE_LIMIT');parts.push(next.value);}}finally{
   // Fetch cancellation is signalled immediately. A transport's unresolved
   // cleanup promise must not extend the owned read deadline.
   void reader.cancel().catch(()=>{});reader.releaseLock();
  }
  try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(parts)));}catch{throw fault('NATIVE_RESPONSE_INVALID');}
 }
 async function attempt(operation,input,{signal,deadlineMs,maxRequestMs:requestMaxMs}){
  const requestCap=operation==='retention/sweep'?RETENTION_SWEEP_BUDGET.nativeMs:startupOperations.has(operation)?STARTUP_REQUEST_MAX_MS:null;
  if(requestMaxMs!==undefined&&(requestCap===null||!Number.isSafeInteger(requestMaxMs)||requestMaxMs<1||requestMaxMs>requestCap||!Number.isSafeInteger(deadlineMs)))throw fault('NATIVE_CONFIGURATION');
  const limitMs=operation==='runner/load'?loadMaxRequestMs:requestMaxMs??maxRequestMs;
  const life=createOperationLifetime({deadlineMs:Math.min(deadlineMs??now()+limitMs,now()+limitMs),now,signal,errorFactory:fault});let response,dispatched=false,transient=false,cause,observedError,startedAt,turnTelemetry;
  try{const payload=JSON.stringify(fileOperations.has(operation)?assertNativeFileRequest(operation,input):data(input));if(Buffer.byteLength(payload)>(fileOperations.has(operation)?NATIVE_FILE_LIMITS.requestBytes:2097152))throw fault('NATIVE_REQUEST_LIMIT');
   response=await life.run(signal=>{dispatched=true;try{turnTelemetry=runnerTurnTelemetry();startedAt=turnTelemetry?.now();}catch{}return transport(c.origin+'/v1/'+operation,{method:'POST',redirect:'error',headers:{authorization:'Bearer '+credential,'content-type':'application/json',...(fileOperations.has(operation)?{'x-meri-run-binding':nativeFileBindingHeader(input.binding)}:{})},body:payload,signal});});
   if(response.status!==200){
    cause=pinnedStatusRefusal(response.status);
    // Only an explicit "did not answer" is transient; an unreadable error body leaves the failure definitive.
    if(json(response))try{transient=unansweredNativeAnswer(response.status,(await body(response,life,PINNED_NATIVE_ERROR_BODY_MAX_BYTES))?.error);}catch(error){if(['DEADLINE','CANCELLED'].includes(error?.code))throw error;}
    throw fault('NATIVE_UNAVAILABLE');
   }
   if(!json(response))throw fault('NATIVE_UNAVAILABLE');
   const value=await body(response,life,operation==='runner/files/restore'?NATIVE_FILE_LIMITS.requestBytes:c.maxResponseBytes);life.check();return operation==='runner/files/restore'?assertNativeFileRestore(value,input.binding):data(value);
  }catch(error){
   observedError=error;const code=['DEADLINE','CANCELLED'].includes(error?.code)?error.code:'NATIVE_UNAVAILABLE',failure=fault(code);
   if(code==='NATIVE_UNAVAILABLE'){
    // RUNNER_FIRST_FAILURE prints the answer's status class or the transport's fixed rejection as `cause`.
    Object.defineProperty(failure,'cause',{value:cause??error,configurable:true,writable:true});
    if(transient||dispatched&&response===undefined&&noAnswer(error))markAuthorityUnavailable(failure);
   }
   throw failure;
  }finally{life.close();if(dispatched&&operation.startsWith('runner/'))try{turnTelemetry?.recordRunOwner(operation,classifyStatus(response?.status,observedError),Math.max(0,turnTelemetry.now()-startedAt));}catch{}}
 }
 async function call(operation,input,options={}){
  for(let replays=0;;replays++){
   try{return await attempt(operation,input,options);}
   catch(error){
    const wait=REPLAY_DELAYS_MS[replays],{deadlineMs,signal}=options;
    if(!replayable.has(operation)||!isAuthorityUnavailable(error)||wait===undefined||!Number.isSafeInteger(deadlineMs)||deadlineMs-now()-wait<REPLAY_MIN_ATTEMPT_MS)throw error;
    try{await pause(wait,undefined,{signal});}catch{throw fault('CANCELLED');}
   }
  }
 }
 return Object.freeze({call,
  verifyIdentity:({credential,signal,deadlineMs})=>call('identity/verify',{credential},{signal,deadlineMs}),
  resolveContext:({identityCredential,identity,identitySha256,hints,signal,deadlineMs})=>call('context/resolve',{identityCredential,identity,identitySha256,hints},{signal,deadlineMs}),
  async readiness({signal}={}){const value=await call('readiness',{}, {signal});own(value,['service','ready']);if(value.service!=='meri-native-capability-provider/1'||value.ready!==true)throw fault('NATIVE_UNAVAILABLE');},
 });
}
