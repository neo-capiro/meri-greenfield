/** Trusted Temporal poller. The broker launches a fresh isolated SDK runner. */
import {fileURLToPath} from 'node:url';
import {budget,assertHotPathBudgets,HOP} from '../../packages/runtime/hot-path-budgets.mjs';
import {runtimeHotPathBudgets} from './hot-path-budget-inputs.mjs';
import {createHotPathFetch} from './hot-path-transports.mjs';
import {NativeConnection,Worker} from '@temporalio/worker';
import {Context} from '@temporalio/activity';
import {validateShape,canonicalSha256} from '../../packages/contracts/validate.mjs';
import {own,data} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createNativeCapabilityClient} from './native-client.mjs';
import {readRuntimeTemporalTls as temporalTls,startRuntimeTemporalAuthorization as temporalAuthorization} from './temporal-product-runtime.mjs';
import {readSecret,fault} from './config.mjs';
import {listenRuntime} from './http-server.mjs';
import {createTemporalRuntimeFence,assertTemporalRuntimeCleanup,temporalCleanupUnknown} from './temporal-runtime-fence.mjs';
import {createObjectiveWorkerActivities,objectiveWorkerPorts} from './objective-generation/worker-activities.mjs';
import {stopOriginal,createOriginalReconciler as createReconcileActivity} from './original-stop.mjs';
export {createReconcileActivity};
/** The broker's control calls (kickoff, status, poll, stop) each cross control's task router, which allows 8 s per exchange
 * (control.mjs), plus a Core-backed task verify. They get one control margin above that, the native client's cap, inside the
 * activity's 30 s heartbeat. The former 3 s client default and 3 s cleanup were below one router hop at tail latency. */
export const BROKER_NATIVE_MS=HOP['broker.native.request'].ms;
async function sleep(signal,ms){signal.throwIfAborted();await new Promise((resolve,reject)=>{const abort=()=>{clearTimeout(timer);reject(fault('CANCELLED'));},timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();});}
/**
 * The only admitted broker mode is the prepared original kickoff. Every exit after dispatch (terminal result, cancellation,
 * heartbeat/lease failure, lost kickoff acknowledgment, refused receipt) closes the original through execution/kickoff/stop
 * with an independent bounded signal, and an unknown cleanup never yields a successful activity receipt. The legacy
 * execution/start mode is not composed: its routes have no original stop owner, so a cancelled activity left the launched
 * task running (audit L5).
 */
export function createBrokerActivity({native,context=()=>Context.current(),now=Date.now,pollMs,cleanupMs}){
 if(!Number.isSafeInteger(cleanupMs)||cleanupMs<1||!Number.isSafeInteger(pollMs)||pollMs<10||pollMs>1000)throw fault('BROKER_CONFIGURATION');
 return async function executeConversation(input){own(input,['binding']);validateShape('RunBinding',input.binding);const activity=context(),signal=activity.cancellationSignal;signal.throwIfAborted();const executionKey=canonicalSha256(input.binding);let started,cleaning;
  const cleanup=()=>cleaning??=stopOriginal({native,binding:input.binding,expiresAtMs:started?.expiresAtMs,now,timeoutMs:cleanupMs,code:'BROKER_KICKOFF_CLEANUP_UNKNOWN'});
  try{started=own(await native.call('execution/kickoff',{binding:input.binding,executionKey},{signal}),['binding','executionId','expiresAtMs']);if(canonicalSha256(started.binding)!==executionKey||started.executionId!==executionKey||!Number.isSafeInteger(started.expiresAtMs)||started.expiresAtMs<=now())throw fault('BROKER_START_REFUSED');
   const currentLease=()=>{signal.throwIfAborted();if(now()>=started.expiresAtMs)throw fault('BROKER_LEASE_EXPIRED');};
   const observe=(value,preparing=false)=>{const current=data(value);own(current,['binding','executionId','state'],preparing?['expiresAtMs']:[]);if(canonicalSha256(current.binding)!==executionKey||current.executionId!==started.executionId||!['executing','completed','failed','cancelled','paused','waiting-for-approval',...(preparing?['preparing']:[])].includes(current.state)||preparing&&current.expiresAtMs!==started.expiresAtMs)throw fault('BROKER_RECEIPT_REFUSED');activity.heartbeat({runId:input.binding.runId,executionId:started.executionId});currentLease();return current;};
   for(;;){currentLease();const current=observe(await native.call('execution/kickoff/status',{binding:input.binding,executionId:started.executionId},{signal}),true);if(current.state==='executing')break;if(current.state!=='preparing'){await cleanup();return {state:current.state};}await sleep(signal,pollMs);}
   for(;;){currentLease();const current=observe(await native.call('execution/poll',{binding:input.binding,executionId:started.executionId},{signal}));if(current.state!=='executing'){await cleanup();return {state:current.state};}await sleep(signal,pollMs);}
  }catch(error){try{await cleanup();}catch(cleanupError){throw Object.assign(fault('BROKER_KICKOFF_CLEANUP_UNKNOWN'),{cause:cleanupError});}throw error;}
 };
}
export function workerOptions({configuration,connection,native,budgets}){assertHotPathBudgets(budgets);return {connection,namespace:configuration.temporal.namespace,taskQueue:configuration.temporal.taskQueue,workflowsPath:fileURLToPath(new URL('../control/conversations/workflow.ts',import.meta.url)),activities:{executeConversation:createBrokerActivity({native,pollMs:budget(budgets,'broker.poll'),cleanupMs:budget(budgets,'broker.native.request')}),reconcileConversation:createReconcileActivity({native,timeoutMs:budget(budgets,'runtime.original.reconcile')}),...createObjectiveWorkerActivities(objectiveWorkerPorts({configuration,native,budgets}))},maxConcurrentActivityTaskExecutions:10,shutdownGraceTime:budget(budgets,'worker.shutdown.grace'),shutdownForceTime:budget(budgets,'worker.shutdown.force')};}
/** Readiness fails when the poller is not running or when the trusted-client authorization is not healthy (expired, failed or closed). */
export function createWorkerReadiness({worker,authorization=null}){
 if(typeof worker?.getState!=='function'||authorization!==null&&typeof authorization?.healthy!=='function')throw fault('WORKER_CONFIGURATION');
 return async function readiness(){if(authorization&&!authorization.healthy())throw fault('WORKER_AUTHORIZATION_UNAVAILABLE');if(worker.getState()!=='RUNNING')throw fault('WORKER_NOT_RUNNING');};
}
/** A fail-closed authorization transition stops the poller: the native connection cannot forget the key it last accepted, so the worker does not keep polling with it. */
export function stopWorkerOnAuthorizationFailure({worker,authorization}){
 if(typeof worker?.getState!=='function'||typeof worker?.shutdown!=='function'||typeof authorization?.watch!=='function')throw fault('WORKER_CONFIGURATION');
 return authorization.watch(()=>{try{if(worker.getState()==='RUNNING')worker.shutdown();}catch{}});
}
/** Trusted test constructors are explicit function arguments, never configuration selectors. */
export async function startTemporalWorker(configuration,{signal,testOwners={},budgets=runtimeHotPathBudgets(configuration)}={}){
 assertHotPathBudgets(budgets);
 const owners=own(testOwners,[],['authorization','tls','readMaterial','nativeClient','connect','createWorker','listen']);
 for(const value of Object.values(owners))if(typeof value!=='function')throw fault('WORKER_CONFIGURATION');
 const fence=createTemporalRuntimeFence(),startupSignal=signal?AbortSignal.any([signal,fence.signal]):fence.signal;
 const onExternalAbort=()=>{fence.lose(signal.reason);try{if(worker?.getState()==='RUNNING')worker.shutdown();}catch{}};
 let connection,worker,listener,run,closing,authorization,unwatch,rejectAuthorization,nativeFetch;
 signal?.addEventListener('abort',onExternalAbort,{once:true});if(signal?.aborted)onExternalAbort();
 const authorizationCompletion=new Promise((_,reject)=>{rejectAuthorization=reject;});authorizationCompletion.catch(()=>{});
 const onAuthorizationUnavailable=reason=>{if(fence.lose(reason)){rejectAuthorization(fault('TEMPORAL_AUTHORIZATION_UNAVAILABLE'));try{if(worker?.getState()==='RUNNING')worker.shutdown();}catch{}}};
 const checkAuthorization=()=>{fence.check();startupSignal.throwIfAborted();};
 const close=()=>closing??=(async()=>{
  fence.lose('RUNTIME_STOPPING');signal?.removeEventListener('abort',onExternalAbort);unwatch?.();const results=[];
  try{if(worker?.getState()==='RUNNING')worker.shutdown();}catch(reason){results.push({status:'rejected',reason});}
  for(const step of [()=>listener?.close(),()=>run,()=>connection?.close(),()=>authorization?.close()]){
   try{results.push({status:'fulfilled',value:await step()});}catch(reason){results.push({status:'rejected',reason});}
  }
  void nativeFetch?.close().catch(()=>{});
  // SDK 1.24 cannot publicly dispose an INITIALIZED worker. Do not run a stale
  // poller or mutate its private refs to manufacture a cleanup receipt.
  assertTemporalRuntimeCleanup(results,{...(worker?{workerState:worker.getState()}:{})});
 })();
 try{
  checkAuthorization();
  authorization=await (owners.authorization??temporalAuthorization)(configuration,{signal:startupSignal,onUnavailable:onAuthorizationUnavailable});
  if(authorization)unwatch=authorization.watch(onAuthorizationUnavailable);checkAuthorization();
  const [tls,bytes]=await Promise.all([(owners.tls??temporalTls)(configuration.temporal.tls),(owners.readMaterial??readSecret)(configuration.native.capabilityFile)]);checkAuthorization();
  nativeFetch=createHotPathFetch(budgets);
  const native=(owners.nativeClient??createNativeCapabilityClient)({configuration:configuration.native,credential:bytes.toString('utf8').trim(),fetch:nativeFetch.fetch,maxRequestMs:budget(budgets,'broker.native.request'),loadMaxRequestMs:budget(budgets,'broker.native.request')});
  await native.readiness({signal:startupSignal});checkAuthorization();
  connection=await (owners.connect??(options=>NativeConnection.connect(options)))({address:configuration.temporal.address,tls,...(authorization?{apiKey:authorization.apiKey()}:{})});checkAuthorization();
  if(authorization)authorization.attach(connection);
  worker=await (owners.createWorker??(options=>Worker.create(options)))(workerOptions({configuration,connection,native,budgets}));checkAuthorization();
  run=worker.run();run.catch(()=>{});
  listener=await (owners.listen??listenRuntime)({configuration,budgets,application:fence.wrap({handle:()=>Response.json({error:{code:'NOT_FOUND'}},{status:404})}),readiness:createWorkerReadiness({worker,authorization}),signal});
  checkAuthorization();return Object.freeze({address:listener.address,close,completion:Promise.race([run,authorizationCompletion])});
 }catch(error){
  try{await close();}catch(cleanup){throw temporalCleanupUnknown(new AggregateError([error,cleanup],'WORKER_STARTUP_AND_CLEANUP_FAILED'));}
  if(error?.code==='TEMPORAL_PRODUCT_CLEANUP_UNKNOWN')throw error;
  throw Object.assign(fault('WORKER_STARTUP_FAILED'),{cause:error});
 }
}
