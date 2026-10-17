/** Trusted Temporal poller. The broker launches a fresh isolated SDK runner. */
import {fileURLToPath} from 'node:url';
import {NativeConnection,Worker} from '@temporalio/worker';
import {Context} from '@temporalio/activity';
import {validateShape,canonicalSha256} from '../../packages/contracts/validate.mjs';
import {own,data} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createNativeCapabilityClient} from './native-client.mjs';
import {readRuntimeTemporalTls as temporalTls,startRuntimeTemporalAuthorization as temporalAuthorization} from './temporal-product-runtime.mjs';
import {readSecret,fault} from './config.mjs';
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
import {listenRuntime} from './http-server.mjs';
import {createTemporalRuntimeFence,assertTemporalRuntimeCleanup,temporalCleanupUnknown} from './temporal-runtime-fence.mjs';
async function sleep(signal,ms){signal.throwIfAborted();await new Promise((resolve,reject)=>{const abort=()=>{clearTimeout(timer);reject(fault('CANCELLED'));},timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();});}
/**
 * The only admitted broker mode is the prepared original kickoff. Every exit after dispatch (terminal result, cancellation,
 * heartbeat/lease failure, lost kickoff acknowledgment, refused receipt) closes the original through execution/kickoff/stop
 * with an independent bounded signal, and an unknown cleanup never yields a successful activity receipt. The legacy
 * execution/start mode is not composed: its routes have no original stop owner, so a cancelled activity left the launched
 * task running (audit L5).
 */
/** The original's independent stop through execution/kickoff/stop. The control owner retires the original and settles a run
 * it left nonterminal (run reconciler); an unproven stop or a mismatched receipt is UNKNOWN. */
async function stopOriginal({native,binding,expiresAtMs,now,timeoutMs,code}){const executionKey=canonicalSha256(binding),life=createOperationLifetime({now,deadlineMs:now()+timeoutMs,errorFactory:()=>fault(code)});
 try{const p=own(await life.run(signal=>native.call('execution/kickoff/stop',{binding,executionId:executionKey},{signal})),['binding','executionId','expiresAtMs']);if(canonicalSha256(p.binding)!==executionKey||p.executionId!==executionKey||!Number.isSafeInteger(p.expiresAtMs)||expiresAtMs!==undefined&&p.expiresAtMs!==expiresAtMs)throw fault(code);}finally{life.close();}}
export function createBrokerActivity({native,context=()=>Context.current(),now=Date.now,pollMs=1000}){
 if(!Number.isSafeInteger(pollMs)||pollMs<10||pollMs>1000)throw fault('BROKER_CONFIGURATION');
 return async function executeConversation(input){own(input,['binding']);validateShape('RunBinding',input.binding);const activity=context(),signal=activity.cancellationSignal;signal.throwIfAborted();const executionKey=canonicalSha256(input.binding);let started,cleaning;
  const cleanup=()=>cleaning??=stopOriginal({native,binding:input.binding,expiresAtMs:started?.expiresAtMs,now,timeoutMs:3000,code:'BROKER_KICKOFF_CLEANUP_UNKNOWN'});
  try{started=own(await native.call('execution/kickoff',{binding:input.binding,executionKey},{signal}),['binding','executionId','expiresAtMs']);if(canonicalSha256(started.binding)!==executionKey||started.executionId!==executionKey||!Number.isSafeInteger(started.expiresAtMs)||started.expiresAtMs<=now())throw fault('BROKER_START_REFUSED');
   const currentLease=()=>{signal.throwIfAborted();if(now()>=started.expiresAtMs)throw fault('BROKER_LEASE_EXPIRED');};
   const observe=(value,preparing=false)=>{const current=data(value);own(current,['binding','executionId','state'],preparing?['expiresAtMs']:[]);if(canonicalSha256(current.binding)!==executionKey||current.executionId!==started.executionId||!['executing','completed','failed','cancelled','paused','waiting-for-approval',...(preparing?['preparing']:[])].includes(current.state)||preparing&&current.expiresAtMs!==started.expiresAtMs)throw fault('BROKER_RECEIPT_REFUSED');activity.heartbeat({runId:input.binding.runId,executionId:started.executionId});currentLease();return current;};
   for(;;){currentLease();const current=observe(await native.call('execution/kickoff/status',{binding:input.binding,executionId:started.executionId},{signal}),true);if(current.state==='executing')break;if(current.state!=='preparing'){await cleanup();return {state:current.state};}await sleep(signal,pollMs);}
   for(;;){currentLease();const current=observe(await native.call('execution/poll',{binding:input.binding,executionId:started.executionId},{signal}));if(current.state!=='executing'){await cleanup();return {state:current.state};}await sleep(signal,pollMs);}
  }catch(error){try{await cleanup();}catch(cleanupError){throw Object.assign(fault('BROKER_KICKOFF_CLEANUP_UNKNOWN'),{cause:cleanupError});}throw error;}
 };
}
/** Original-attempt reconciliation, scheduled by the workflow after executeConversation failed or was lost (for example the
 * heartbeat timeout of a crashed poller, which never ran its own cleanup). It repeats the same idempotent independent stop;
 * it never starts, kicks off or redispatches the original. */
export function createReconcileActivity({native,now=Date.now,timeoutMs=15000}){
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000)throw fault('BROKER_CONFIGURATION');
 return async function reconcileConversation(input){own(input,['binding']);validateShape('RunBinding',input.binding);await stopOriginal({native,binding:input.binding,expiresAtMs:undefined,now,timeoutMs,code:'BROKER_RECONCILE_UNKNOWN'});return {state:'reconciled'};};
}
export function workerOptions({configuration,connection,native}){return {connection,namespace:configuration.temporal.namespace,taskQueue:configuration.temporal.taskQueue,workflowsPath:fileURLToPath(new URL('../control/conversations/workflow.ts',import.meta.url)),activities:{executeConversation:createBrokerActivity({native}),reconcileConversation:createReconcileActivity({native})},maxConcurrentActivityTaskExecutions:10,shutdownGraceTime:configuration.limits.shutdownMs,shutdownForceTime:configuration.limits.shutdownMs+1000};}
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
export async function startTemporalWorker(configuration,{signal,testOwners={}}={}){
 const owners=own(testOwners,[],['authorization','tls','readMaterial','nativeClient','connect','createWorker','listen']);
 for(const value of Object.values(owners))if(typeof value!=='function')throw fault('WORKER_CONFIGURATION');
 const fence=createTemporalRuntimeFence(),startupSignal=signal?AbortSignal.any([signal,fence.signal]):fence.signal;
 const onExternalAbort=()=>{fence.lose(signal.reason);try{if(worker?.getState()==='RUNNING')worker.shutdown();}catch{}};
 let connection,worker,listener,run,closing,authorization,unwatch,rejectAuthorization;
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
  // SDK 1.24 cannot publicly dispose an INITIALIZED worker. Do not run a stale
  // poller or mutate its private refs to manufacture a cleanup receipt.
  assertTemporalRuntimeCleanup(results,{...(worker?{workerState:worker.getState()}:{})});
 })();
 try{
  checkAuthorization();
  authorization=await (owners.authorization??temporalAuthorization)(configuration,{signal:startupSignal,onUnavailable:onAuthorizationUnavailable});
  if(authorization)unwatch=authorization.watch(onAuthorizationUnavailable);checkAuthorization();
  const [tls,bytes]=await Promise.all([(owners.tls??temporalTls)(configuration.temporal.tls),(owners.readMaterial??readSecret)(configuration.native.capabilityFile)]);checkAuthorization();
  const native=(owners.nativeClient??createNativeCapabilityClient)({configuration:configuration.native,credential:bytes.toString('utf8').trim()});
  await native.readiness({signal:startupSignal});checkAuthorization();
  connection=await (owners.connect??(options=>NativeConnection.connect(options)))({address:configuration.temporal.address,tls,...(authorization?{apiKey:authorization.apiKey()}:{})});checkAuthorization();
  if(authorization)authorization.attach(connection);
  worker=await (owners.createWorker??(options=>Worker.create(options)))(workerOptions({configuration,connection,native}));checkAuthorization();
  run=worker.run();run.catch(()=>{});
  listener=await (owners.listen??listenRuntime)({configuration,application:fence.wrap({handle:()=>Response.json({error:{code:'NOT_FOUND'}},{status:404})}),readiness:createWorkerReadiness({worker,authorization}),signal});
  checkAuthorization();return Object.freeze({address:listener.address,close,completion:Promise.race([run,authorizationCompletion])});
 }catch(error){
  try{await close();}catch(cleanup){throw temporalCleanupUnknown(new AggregateError([error,cleanup],'WORKER_STARTUP_AND_CLEANUP_FAILED'));}
  if(error?.code==='TEMPORAL_PRODUCT_CLEANUP_UNKNOWN')throw error;
  throw Object.assign(fault('WORKER_STARTUP_FAILED'),{cause:error});
 }
}
