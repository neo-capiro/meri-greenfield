/** Trusted Temporal poller. The broker launches a fresh isolated SDK runner. */
import {fileURLToPath} from 'node:url';
import {NativeConnection,Worker} from '@temporalio/worker';
import {Context} from '@temporalio/activity';
import {validateShape,canonicalSha256} from '../../packages/contracts/validate.mjs';
import {own,data} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createNativeCapabilityClient} from './native-client.mjs';
import {temporalTls,temporalAuthorization} from './control.mjs';
import {readSecret,fault} from './config.mjs';
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
import {listenRuntime} from './http-server.mjs';
async function sleep(signal,ms){signal.throwIfAborted();await new Promise((resolve,reject)=>{const abort=()=>{clearTimeout(timer);reject(fault('CANCELLED'));},timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();});}
export function createBrokerActivity({native,context=()=>Context.current(),now=Date.now,pollMs=1000,preparedKickoff=false}){
 if(typeof preparedKickoff!=='boolean'||!Number.isSafeInteger(pollMs)||pollMs<10||pollMs>1000)throw fault('BROKER_CONFIGURATION');
 return async function executeConversation(input){own(input,['binding']);validateShape('RunBinding',input.binding);const activity=context(),signal=activity.cancellationSignal;signal.throwIfAborted();const executionKey=canonicalSha256(input.binding);let started,dispatched=false,cleaning;
  const cleanup=()=>cleaning??=(async()=>{const life=createOperationLifetime({now,deadlineMs:now()+3000,errorFactory:()=>fault('BROKER_KICKOFF_CLEANUP_UNKNOWN')});try{const p=own(await life.run(signal=>native.call('execution/kickoff/stop',{binding:input.binding,executionId:started?.executionId??executionKey},{signal})),['binding','executionId','expiresAtMs']);if(canonicalSha256(p.binding)!==executionKey||p.executionId!==executionKey||!Number.isSafeInteger(p.expiresAtMs)||started&&p.expiresAtMs!==started.expiresAtMs)throw fault('BROKER_KICKOFF_CLEANUP_UNKNOWN');}finally{life.close();}})();
  try{dispatched=true;started=own(await native.call(preparedKickoff?'execution/kickoff':'execution/start',{binding:input.binding,executionKey},{signal}),['binding','executionId','expiresAtMs']);if(canonicalSha256(started.binding)!==executionKey||typeof started.executionId!=='string'||!started.executionId||preparedKickoff&&started.executionId!==executionKey||!Number.isSafeInteger(started.expiresAtMs)||started.expiresAtMs<=now())throw fault('BROKER_START_REFUSED');
   const currentLease=()=>{signal.throwIfAborted();if(now()>=started.expiresAtMs)throw fault('BROKER_LEASE_EXPIRED');};
   const observe=(value,preparing=false)=>{const current=data(value);own(current,['binding','executionId','state'],preparing?['expiresAtMs']:[]);if(canonicalSha256(current.binding)!==executionKey||current.executionId!==started.executionId||!['executing','completed','failed','cancelled','paused','waiting-for-approval',...(preparing?['preparing']:[])].includes(current.state)||preparing&&current.expiresAtMs!==started.expiresAtMs)throw fault('BROKER_RECEIPT_REFUSED');activity.heartbeat({runId:input.binding.runId,executionId:started.executionId});currentLease();return current;};
   if(preparedKickoff)for(;;){currentLease();const current=observe(await native.call('execution/kickoff/status',{binding:input.binding,executionId:started.executionId},{signal}),true);if(current.state==='executing')break;if(current.state!=='preparing'){await cleanup();return {state:current.state};}await sleep(signal,pollMs);}
   for(;;){currentLease();const current=observe(await native.call('execution/poll',{binding:input.binding,executionId:started.executionId},{signal}));if(current.state!=='executing'){if(preparedKickoff)await cleanup();return {state:current.state};}await sleep(signal,pollMs);}
  }catch(error){if(preparedKickoff&&dispatched)try{await cleanup();}catch(cleanupError){throw Object.assign(fault('BROKER_KICKOFF_CLEANUP_UNKNOWN'),{cause:cleanupError});}throw error;}
 };
}
export function workerOptions({configuration,connection,native}){return {connection,namespace:configuration.temporal.namespace,taskQueue:configuration.temporal.taskQueue,workflowsPath:fileURLToPath(new URL('../control/conversations/workflow.ts',import.meta.url)),activities:{executeConversation:createBrokerActivity({native,preparedKickoff:configuration.native?.preparedKickoff??false})},maxConcurrentActivityTaskExecutions:10,shutdownGraceTime:configuration.limits.shutdownMs,shutdownForceTime:configuration.limits.shutdownMs+1000};}
export async function startTemporalWorker(configuration,{signal}={}){
 let connection,worker,listener,run,closing,authorization;const close=()=>closing??=(async()=>{await listener?.close();if(worker?.getState()==='RUNNING')worker.shutdown();await run?.catch(()=>{});await connection?.close();await authorization?.close();})();
 try{signal?.throwIfAborted();const [tls,bytes]=await Promise.all([temporalTls(configuration.temporal.tls),readSecret(configuration.native.capabilityFile)]);signal?.throwIfAborted();const native=createNativeCapabilityClient({configuration:configuration.native,credential:bytes.toString('utf8').trim()});await native.readiness({signal});signal?.throwIfAborted();
  authorization=await temporalAuthorization(configuration,{signal});connection=await NativeConnection.connect({address:configuration.temporal.address,tls,...(authorization?{apiKey:authorization.apiKey()}:{})});if(authorization)authorization.attach(connection);worker=await Worker.create(workerOptions({configuration,connection,native}));run=worker.run();run.catch(()=>{});
  listener=await listenRuntime({configuration,application:{handle:()=>Response.json({error:{code:'NOT_FOUND'}},{status:404})},readiness:async()=>{if(worker.getState()!=='RUNNING')throw fault('WORKER_NOT_RUNNING');},signal});return Object.freeze({address:listener.address,close,completion:run});
 }catch{await close();throw fault('WORKER_STARTUP_FAILED');}
}
