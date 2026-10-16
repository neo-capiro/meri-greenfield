/** Separately supervised control-domain Temporal schedule poller. HTTP is health-only; Temporal owns firing/retry identity. */
import {fileURLToPath} from 'node:url';
import {NativeConnection,Worker} from '@temporalio/worker';
import {Context} from '@temporalio/activity';
import {own,nativeSignal} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {storageMethod} from '../artifacts/storage/boundary.mjs';
import {createPostgresConversationStore} from '../control/conversations/postgres-store.mjs';
import {createTemporalConversationDispatcher} from '../control/conversations/temporal-dispatch.mjs';
import {createTemporalRunEvidence} from '../control/conversations/temporal-run-evidence.mjs';
import {createPostgresScheduleOwner} from '../control/schedules/postgres-schedule-owner.mjs';
import {createScheduledDispatch} from '../control/schedules/scheduled-dispatch.mjs';
import {createScheduledDispatchActivities} from '../control/schedules/scheduled-activities.mjs';
import {temporalTls,temporalAuthorization} from './control.mjs';
import {createWorkerReadiness,stopWorkerOnAuthorizationFailure} from './temporal-worker.mjs';
import {listenRuntime} from './http-server.mjs';
import {fault} from './config.mjs';
/** Real canonical domain composition over borrowed resources. Trusted authority/instruction owners are never configuration selectors. */
export function assembleScheduleDispatch({configuration,pool,client,authority,taskInstructions,now=Date.now}){
 const s=configuration.scheduledDispatch;if(s?.enabled!==true)throw fault('SCHEDULE_WORKER_CONFIGURATION');
 return createScheduledDispatch({scheduleOwner:createPostgresScheduleOwner({pool}),store:createPostgresConversationStore({pool}),
  dispatcher:createTemporalConversationDispatcher({client,taskQueue:s.conversationTaskQueue,lifecycle:true,now,maxRequestMs:configuration.limits.requestMs}),
  runs:createTemporalRunEvidence({client,now,maxRequestMs:configuration.limits.requestMs}),authority,taskInstructions,versions:configuration.versions,now,maxRequestMs:configuration.limits.requestMs});
}
export function scheduleWorkerOptions({configuration,connection,dispatch,context=()=>Context.current()}){
 const s=configuration.scheduledDispatch;
 if(s?.enabled!==true)throw fault('SCHEDULE_WORKER_CONFIGURATION');own(s,['enabled','conversationTaskQueue','maxConcurrentActivities']);
 if(!Number.isSafeInteger(s.maxConcurrentActivities)||s.maxConcurrentActivities<1||s.maxConcurrentActivities>10||typeof s.conversationTaskQueue!=='string'||!/^[a-zA-Z0-9._\-]{1,128}$/u.test(s.conversationTaskQueue)||s.conversationTaskQueue===configuration.temporal.taskQueue)throw fault('SCHEDULE_WORKER_CONFIGURATION');
 if(dispatch===undefined)throw fault('SCHEDULE_DISPATCH_UNAVAILABLE');own(dispatch,['dispatch','reconcile']);
 const borrowed=Object.freeze({dispatch:storageMethod(dispatch,'dispatch'),reconcile:storageMethod(dispatch,'reconcile')});
 return {connection,namespace:configuration.temporal.namespace,taskQueue:configuration.temporal.taskQueue,
  workflowsPath:fileURLToPath(new URL('../control/conversations/scheduled-dispatch-workflow.ts',import.meta.url)),
  activities:createScheduledDispatchActivities({dispatch:borrowed,context}),maxConcurrentActivityTaskExecutions:s.maxConcurrentActivities,
  shutdownGraceTime:configuration.limits.shutdownMs,shutdownForceTime:configuration.limits.shutdownMs+1000};
}
/** Caller owns compiled dispatch and its SQL/client/authority dependencies. This process owns only its poller/connection/health listener. */
export async function startScheduleWorker(configuration,options={}){
 const {signal,dispatch}=own(options,[],['signal','dispatch']);nativeSignal(signal);
 // Missing or malformed real dispatch fails before TLS secrets, connection or poller allocation. No fallback fake owner.
 const compiled=scheduleWorkerOptions({configuration,dispatch});
 let connection,worker,listener,run,closing,authorization,unwatch;
 const close=()=>closing??=(async()=>{const errors=[];for(const step of [()=>listener?.close(),()=>{unwatch?.();if(worker?.getState()==='RUNNING')worker.shutdown();},()=>run?.catch(()=>{}),()=>connection?.close(),()=>authorization?.close()])try{await step();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'SCHEDULE_WORKER_CLEANUP_UNKNOWN');})();
 try{signal?.throwIfAborted();const tls=await temporalTls(configuration.temporal.tls);authorization=await temporalAuthorization(configuration,{signal});signal?.throwIfAborted();
  connection=await NativeConnection.connect({address:configuration.temporal.address,tls,...(authorization?{apiKey:authorization.apiKey()}:{})});if(authorization)authorization.attach(connection);signal?.throwIfAborted();
  worker=await Worker.create({...compiled,connection});if(authorization)unwatch=stopWorkerOnAuthorizationFailure({worker,authorization});run=worker.run();run.catch(()=>{});
  listener=await listenRuntime({configuration,application:{handle:()=>Response.json({error:{code:'NOT_FOUND'}},{status:404})},readiness:createWorkerReadiness({worker,authorization}),signal});
  return Object.freeze({address:listener.address,completion:run,close});
 }catch(error){await close().catch(()=>{});throw Object.assign(fault('SCHEDULE_WORKER_STARTUP_FAILED'),{cause:error});}
}
