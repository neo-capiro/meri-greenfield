/** Trusted Temporal poller. The broker launches a fresh isolated SDK runner. */
import {fileURLToPath} from 'node:url';
import {NativeConnection,Worker} from '@temporalio/worker';
import {Context} from '@temporalio/activity';
import {validateShape,canonicalSha256} from '../../packages/contracts/validate.mjs';
import {own,data} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createNativeCapabilityClient} from './native-client.mjs';
import {temporalTls} from './control.mjs';
import {readSecret,fault} from './config.mjs';
import {listenRuntime} from './http-server.mjs';
export function createBrokerActivity({native,context=()=>Context.current(),now=Date.now,pollMs=1000}){
 return async function executeConversation(input){own(input,['binding']);validateShape('RunBinding',input.binding);const activity=context(),signal=activity.cancellationSignal;signal.throwIfAborted();
  const started=await native.call('execution/start',{binding:input.binding,executionKey:canonicalSha256(input.binding)},{signal});own(started,['binding','executionId','expiresAtMs']);if(canonicalSha256(started.binding)!==canonicalSha256(input.binding)||typeof started.executionId!=='string'||!started.executionId||!Number.isSafeInteger(started.expiresAtMs)||started.expiresAtMs<=now())throw fault('BROKER_START_REFUSED');
  while(true){signal.throwIfAborted();if(now()>=started.expiresAtMs)throw fault('BROKER_LEASE_EXPIRED');const current=data(await native.call('execution/poll',{binding:input.binding,executionId:started.executionId},{signal}));own(current,['binding','executionId','state']);if(canonicalSha256(current.binding)!==canonicalSha256(input.binding)||current.executionId!==started.executionId||!['executing','completed','failed','cancelled','paused','waiting-for-approval'].includes(current.state))throw fault('BROKER_RECEIPT_REFUSED');activity.heartbeat({runId:input.binding.runId,executionId:started.executionId});if(current.state!=='executing')return {state:current.state};
   await new Promise((resolve,reject)=>{const abort=()=>{clearTimeout(timer);reject(fault('CANCELLED'));};const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},pollMs);signal.addEventListener('abort',abort,{once:true});});
  }
 };
}
export function workerOptions({configuration,connection,native}){return {connection,namespace:configuration.temporal.namespace,taskQueue:configuration.temporal.taskQueue,workflowsPath:fileURLToPath(new URL('../control/conversations/workflow.ts',import.meta.url)),activities:{executeConversation:createBrokerActivity({native})},maxConcurrentActivityTaskExecutions:10,shutdownGraceTime:configuration.limits.shutdownMs,shutdownForceTime:configuration.limits.shutdownMs+1000};}
export async function startTemporalWorker(configuration,{signal}={}){
 let connection,worker,listener,run,closing;const close=()=>closing??=(async()=>{await listener?.close();if(worker?.getState()==='RUNNING')worker.shutdown();await run?.catch(()=>{});await connection?.close();})();
 try{const [tls,bytes]=await Promise.all([temporalTls(configuration.temporal.tls),readSecret(configuration.native.capabilityFile)]);const native=createNativeCapabilityClient({configuration:configuration.native,credential:bytes.toString('utf8').trim()});await native.readiness({signal});
  connection=await NativeConnection.connect({address:configuration.temporal.address,tls});worker=await Worker.create(workerOptions({configuration,connection,native}));run=worker.run();run.catch(()=>{});
  listener=await listenRuntime({configuration,application:{handle:()=>Response.json({error:{code:'NOT_FOUND'}},{status:404})},readiness:async()=>{if(worker.getState()!=='RUNNING')throw fault('WORKER_NOT_RUNNING');},signal});return Object.freeze({address:listener.address,close,completion:run});
 }catch{await close();throw fault('WORKER_STARTUP_FAILED');}
}
