/** Trusted Temporal poller. Control owns the AgentCore invocation and durable outcome. */
import {fileURLToPath} from 'node:url';
import {NativeConnection,Worker} from '@temporalio/worker';
import {Context} from '@temporalio/activity';
import {validateShape,canonicalSha256} from '../../packages/contracts/validate.mjs';
import {own,data} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createNativeCapabilityClient} from './native-client.mjs';
import {readRuntimeTemporalTls as temporalTls} from './temporal-tls.mjs';
import {readSecret,fault} from './config.mjs';
import {listenRuntime} from './http-server.mjs';
import {createTemporalRuntimeFence,assertTemporalRuntimeCleanup,temporalCleanupUnknown} from './temporal-runtime-fence.mjs';
import {createObjectiveWorkerActivities,objectiveWorkerPorts} from './objective-generation/worker-activities.mjs';
import {createRetentionSweepActivity} from './retention-sweep.mjs';
import {stopOriginal,createOriginalReconciler as createReconcileActivity} from './original-stop.mjs';
import {reportRuntimeStartupFailure} from './runner-runtime-diagnostics.mjs';
import {createNativeWorkerOwners} from './native-worker-owners.mjs';
import {nativeHostId} from './native-host-provisioning.mjs';
export {createReconcileActivity};
/** Bounded control calls fit inside the activity heartbeat; model execution outlives any one exchange. */
export const BROKER_NATIVE_MS=10000;
async function sleep(signal,ms){signal.throwIfAborted();await new Promise((resolve,reject)=>{const abort=()=>{clearTimeout(timer);reject(fault('CANCELLED'));},timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();});}
/**
 * A terminal status means the SDK has ended and its session store has flushed. It does not stop the reusable runtime.
 * Cancellation, an expired run or an uncertain dispatch uses the existing stop owner with an independent bounded signal.
 * A lost Stop acknowledgement stays unknown; it never becomes a successful activity receipt.
 */
export function createBrokerActivity({native,provisioner,hostTeardown,context=()=>Context.current(),now=Date.now,pollMs=1000}){
 if(!Number.isSafeInteger(pollMs)||pollMs<10||pollMs>1000)throw fault('BROKER_CONFIGURATION');
 if(provisioner!==undefined&&typeof provisioner?.provision!=='function')throw fault('BROKER_CONFIGURATION');
 if(hostTeardown!==undefined&&typeof hostTeardown!=='function')throw fault('BROKER_CONFIGURATION');
 return async function executeConversation(input){own(input,['binding']);validateShape('RunBinding',input.binding);const activity=context(),signal=activity.cancellationSignal;signal.throwIfAborted();const executionKey=canonicalSha256(input.binding);let started,cleaning,heartbeatTimer,host;
  const heartbeat=()=>{try{activity.heartbeat({runId:input.binding.runId,executionId:started?.executionId});}catch{}};
  const cleanup=()=>cleaning??=stopOriginal({native,binding:input.binding,expiresAtMs:started?.expiresAtMs,now,timeoutMs:BROKER_NATIVE_MS,code:'BROKER_KICKOFF_CLEANUP_UNKNOWN'});
  // Original host teardown is separate from retaining the warm settled SDK runtime. It gets its own bounded
  // independent lifetime so an already-cancelled activity signal cannot block cleanup; a missing owner is a refusal.
  const cleanupHost=async()=>{if(host===undefined)return;if(typeof hostTeardown!=='function')throw fault('BROKER_NATIVE_CLEANUP_UNAVAILABLE');
   const value=await hostTeardown({binding:input.binding,generation:host.generation,hostId:host.hostId,signal:AbortSignal.timeout(BROKER_NATIVE_MS)});
   if(value?.closed!==true||value?.verified!==true)throw fault('BROKER_NATIVE_CLEANUP_UNKNOWN');
   // The actual private route binds the original requested identity in its reply. If present it must match exactly;
   // closed/verified booleans alone are never physical proof and never authorize another host.
   if(value.binding!==undefined&&(canonicalSha256(value.binding)!==canonicalSha256(input.binding)||
    value.hostId!==host.hostId||value.generation!==host.generation))throw fault('BROKER_NATIVE_CLEANUP_REFUSED');
  };
  try{started=own(await native.call('execution/kickoff',{binding:input.binding,executionKey},{signal}),['binding','executionId','expiresAtMs']);if(canonicalSha256(started.binding)!==executionKey||started.executionId!==executionKey||!Number.isSafeInteger(started.expiresAtMs)||started.expiresAtMs<=now())throw fault('BROKER_START_REFUSED');
   // The ACK above is prompt and durable. Only after it do we read retained native need; ordinary conversations
   // never allocate. A required-but-missing provisioner is a refusal, never a silent no-native answer.
   const need=own(await native.call('execution/native/prerequisite',{binding:input.binding,executionId:started.executionId},{signal}),
    ['kind'],['hostMode','policySha256','uploadCount']);
   if(!['none','native-processing'].includes(need.kind))throw fault('BROKER_NATIVE_PREREQUISITE_REFUSED');
   if(need.kind==='native-processing'){
    if(provisioner===undefined)throw fault('BROKER_NATIVE_PROVISION_UNAVAILABLE');
    heartbeatTimer=setInterval(heartbeat,Math.max(10,Math.min(pollMs,1000)));heartbeatTimer.unref?.();
    try{
     // Generation comes only from the canonical durable binding's writer fence, never from queue/model flags.
     const generation=input.binding.writerFence;
     // The original host identity is deterministic from the binding/generation and exists before provision effects.
     // Retaining it here preserves original custody when provision launches then fails before returning.
     if(hostTeardown!==undefined)host=Object.freeze({hostId:nativeHostId({binding:input.binding,generation}),generation});
     const provisioned=await provisioner.provision({binding:input.binding,generation,deadlineMs:started.expiresAtMs,signal});
     own(provisioned,['state'],['instanceId','privateIp','leaseDeadlineMs','saved','hostId','generation','ownerInstanceId','token']);
     if(hostTeardown!==undefined){
      if(typeof provisioned.hostId!=='string'||!Number.isSafeInteger(provisioned.generation)||provisioned.generation!==generation)
       throw fault('BROKER_NATIVE_PROVISION_REFUSED');
      host=Object.freeze({hostId:provisioned.hostId,generation:provisioned.generation});
     }
    }finally{clearInterval(heartbeatTimer);heartbeatTimer=undefined;}
   }
   const currentLease=()=>{signal.throwIfAborted();if(now()>=started.expiresAtMs)throw fault('BROKER_LEASE_EXPIRED');};
   const observe=(value,preparing=false)=>{const current=data(value);own(current,['binding','executionId','state'],preparing?['expiresAtMs']:[]);if(canonicalSha256(current.binding)!==executionKey||current.executionId!==started.executionId||!['executing','completed','failed','cancelled','paused','waiting-for-approval',...(preparing?['preparing']:[])].includes(current.state)||preparing&&current.expiresAtMs!==started.expiresAtMs)throw fault('BROKER_RECEIPT_REFUSED');heartbeat();currentLease();return current;};
   for(;;){currentLease();const current=observe(await native.call('execution/kickoff/status',{binding:input.binding,executionId:started.executionId},{signal}),true);if(!['preparing','executing'].includes(current.state)){
    // A completed run retains the warm settled SDK runtime. A failed/cancelled/stopped original run tears down its
    // original native host separately from that retained SDK state.
    // Native host cleanup is separate from retaining the warm completed SDK runtime; it runs on every terminal path.
    await cleanupHost();return {state:current.state};}await sleep(signal,pollMs);}
  }catch(error){if(heartbeatTimer!==undefined)clearInterval(heartbeatTimer);let cleanupError;
   try{await cleanup();}catch(value){cleanupError=value;}
   try{await cleanupHost();}catch(value){cleanupError??=value;}
   if(cleanupError!==undefined)throw Object.assign(fault('BROKER_KICKOFF_CLEANUP_UNKNOWN'),{cause:cleanupError});
   throw error;}
 };
}
export function workerOptions({configuration,connection,native,provisioner,hostTeardown}){return {connection,namespace:configuration.temporal.namespace,taskQueue:configuration.temporal.taskQueue,workflowsPath:fileURLToPath(new URL('../control/conversations/workflow.ts',import.meta.url)),activities:{executeConversation:createBrokerActivity({native,provisioner,hostTeardown}),reconcileConversation:createReconcileActivity({native}),sweepConversationRetention:createRetentionSweepActivity({native}),...createObjectiveWorkerActivities(objectiveWorkerPorts({configuration,native}))},maxConcurrentActivityTaskExecutions:10,shutdownGraceTime:configuration.limits.shutdownMs,shutdownForceTime:configuration.limits.shutdownMs+1000};}
/** Native SDK poller state determines readiness; the server checks its mTLS identity on each RPC. */
export function createWorkerReadiness({worker}){
 if(typeof worker?.getState!=='function')throw fault('WORKER_CONFIGURATION');
 return async()=>{if(worker.getState()!=='RUNNING')throw fault('WORKER_NOT_RUNNING');};
}
/** Trusted test constructors are explicit function arguments, never configuration selectors. */
export async function startTemporalWorker(configuration,{signal,testOwners={}}={}){
 const owners=own(testOwners,[],['tls','readMaterial','nativeClient','connect','createWorker','listen','createPool','createEc2Client','createSsmTransport','createIssuer','createMaterial','createSfnClient','readSecret']);
 for(const value of Object.values(owners))if(typeof value!=='function')throw fault('WORKER_CONFIGURATION');
 const fence=createTemporalRuntimeFence(),startupSignal=signal?AbortSignal.any([signal,fence.signal]):fence.signal;
 const onExternalAbort=()=>{fence.lose(signal.reason);try{if(worker?.getState()==='RUNNING')worker.shutdown();}catch{}};
 let connection,worker,listener,run,closing,nativeOwners,stage='worker-material';
 signal?.addEventListener('abort',onExternalAbort,{once:true});if(signal?.aborted)onExternalAbort();
 const checkAuthorization=()=>{fence.check();startupSignal.throwIfAborted();};
 const close=()=>closing??=(async()=>{
  fence.lose('RUNTIME_STOPPING');signal?.removeEventListener('abort',onExternalAbort);const results=[];
  try{if(worker?.getState()==='RUNNING')worker.shutdown();}catch(reason){results.push({status:'rejected',reason});}
  for(const step of [()=>listener?.close(),()=>run,()=>nativeOwners?.close?.(),()=>connection?.close()]){
   try{results.push({status:'fulfilled',value:await step()});}catch(reason){results.push({status:'rejected',reason});}
  }
  // SDK 1.24 cannot publicly dispose an INITIALIZED worker. Do not run a stale
  // poller or mutate its private refs to manufacture a cleanup receipt.
  assertTemporalRuntimeCleanup(results,{...(worker?{workerState:worker.getState()}:{})});
 })();
 try{
  checkAuthorization();
  const [tls,bytes]=await Promise.all([(owners.tls??temporalTls)(configuration.temporal.tls),(owners.readMaterial??readSecret)(configuration.native.capabilityFile)]);checkAuthorization();
  stage='worker-readiness';const native=(owners.nativeClient??createNativeCapabilityClient)({configuration:configuration.native,credential:bytes.toString('utf8').trim(),maxRequestMs:BROKER_NATIVE_MS});
  await native.readiness({signal:startupSignal});checkAuthorization();
  stage='worker-connect';connection=await (owners.connect??(options=>NativeConnection.connect(options)))({address:configuration.temporal.address,tls});checkAuthorization();
  stage='worker-native-owners';
  nativeOwners=await createNativeWorkerOwners({configuration,native,owners:{createPool:owners.createPool,
   createEc2Client:owners.createEc2Client,createSsmTransport:owners.createSsmTransport,
   createIssuer:owners.createIssuer,createMaterial:owners.createMaterial,createSfnClient:owners.createSfnClient,
   readSecret:owners.readSecret}});checkAuthorization();
  stage='worker-create';worker=await (owners.createWorker??(options=>Worker.create(options)))(workerOptions({configuration,connection,native,
   ...(nativeOwners===null?{}:{provisioner:nativeOwners.provisioner,hostTeardown:nativeOwners.hostTeardown})}));checkAuthorization();
  stage='worker-run';run=worker.run();run.catch(error=>reportRuntimeStartupFailure('temporal-worker','worker-run',error));
  stage='worker-listen';listener=await (owners.listen??listenRuntime)({configuration,application:fence.wrap({handle:()=>Response.json({error:{code:'NOT_FOUND'}},{status:404})}),readiness:createWorkerReadiness({worker}),signal});
  checkAuthorization();return Object.freeze({address:listener.address,close,completion:run});
 }catch(error){
  reportRuntimeStartupFailure('temporal-worker',stage,error);
  try{await close();}catch(cleanup){reportRuntimeStartupFailure('temporal-worker','worker-cleanup',cleanup);throw temporalCleanupUnknown(new AggregateError([error,cleanup],'WORKER_STARTUP_AND_CLEANUP_FAILED'));}
  if(error?.code==='TEMPORAL_PRODUCT_CLEANUP_UNKNOWN')throw error;
  throw Object.assign(fault('WORKER_STARTUP_FAILED'),{cause:error});
 }
}
