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
import {createPostgresPreparedScheduleReader} from '../control/intents/postgres-journal.mjs';
import {createApprovedScheduleInstructions} from '../control/schedules/approved-instructions.mjs';
import {createScheduledJobLifecycle} from '../control/schedules/scheduled-job-lifecycle.mjs';
import {readRuntimeTemporalTls as temporalTls} from './temporal-tls.mjs';
import {createWorkerReadiness} from './temporal-worker.mjs';
import {assertTemporalRuntimeCleanup,temporalCleanupUnknown} from './temporal-runtime-fence.mjs';
import {listenRuntime} from './http-server.mjs';
import {fault} from './config.mjs';
/** Real canonical domain composition over borrowed resources. Trusted authority/instruction owners are never configuration selectors. */
export function assembleScheduleDispatch({configuration,pool,client,authority,taskInstructions,runAdmission,runControl,retirement,now=Date.now}){
 const s=configuration.scheduledDispatch;if(s?.enabled!==true)throw fault('SCHEDULE_WORKER_CONFIGURATION');
 const scheduleOwner=createPostgresScheduleOwner({pool});
 const instructions=taskInstructions??createApprovedScheduleInstructions({scheduleOwner,preparations:createPostgresPreparedScheduleReader({pool}),now,maxRequestMs:configuration.limits.requestMs});
 const store=createPostgresConversationStore({pool,now}),jobOwner=runControl&&retirement?createScheduledJobLifecycle({store,runControl,retirement,now,maxRequestMs:configuration.limits.requestMs}):undefined;
 return createScheduledDispatch({scheduleOwner,store,
  dispatcher:createTemporalConversationDispatcher({client,taskQueue:s.conversationTaskQueue,lifecycle:true,now,maxRequestMs:configuration.limits.requestMs}),
  runs:createTemporalRunEvidence({client,now,maxRequestMs:configuration.limits.requestMs}),authority,taskInstructions:instructions,...(runAdmission===undefined?{}:{runAdmission}),...(jobOwner===undefined?{}:{jobOwner}),versions:configuration.versions,now,maxRequestMs:configuration.limits.requestMs});
}
export function scheduleWorkerOptions({configuration,connection,dispatch,context=()=>Context.current()}){
 const s=configuration.scheduledDispatch;
 if(s?.enabled!==true)throw fault('SCHEDULE_WORKER_CONFIGURATION');own(s,['enabled','conversationTaskQueue','maxConcurrentActivities']);
 if(!Number.isSafeInteger(s.maxConcurrentActivities)||s.maxConcurrentActivities<1||s.maxConcurrentActivities>10||typeof s.conversationTaskQueue!=='string'||!/^[a-zA-Z0-9._\-]{1,128}$/u.test(s.conversationTaskQueue)||s.conversationTaskQueue===configuration.temporal.taskQueue)throw fault('SCHEDULE_WORKER_CONFIGURATION');
 if(dispatch===undefined)throw fault('SCHEDULE_DISPATCH_UNAVAILABLE');const supplied=own(dispatch,['dispatch','reconcile'],['cancel']);
 const borrowed=Object.freeze({dispatch:storageMethod(dispatch,'dispatch'),reconcile:storageMethod(dispatch,'reconcile'),...(supplied.cancel===undefined?{}:{cancel:storageMethod(dispatch,'cancel')})});
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
 let connection,worker,listener,run,closing;
 const close=()=>closing??=(async()=>{
  const results=[];
  for(const step of [()=>listener?.close(),()=>{if(worker?.getState()==='RUNNING')worker.shutdown();},()=>run,()=>connection?.close()]){
   try{results.push({status:'fulfilled',value:await step()});}catch(reason){results.push({status:'rejected',reason});}
  }
  // SDK 1.24 has no public disposal for an INITIALIZED worker. Do not run a
  // cancelled poller or claim cleanup when its native connection is retained.
  assertTemporalRuntimeCleanup(results,{...(worker?{workerState:worker.getState()}:{})});
 })();
 try{signal?.throwIfAborted();const tls=await temporalTls(configuration.temporal.tls);signal?.throwIfAborted();
  connection=await NativeConnection.connect({address:configuration.temporal.address,tls});signal?.throwIfAborted();
  worker=await Worker.create({...compiled,connection});signal?.throwIfAborted();run=worker.run();run.catch(()=>{});
  listener=await listenRuntime({configuration,application:{handle:()=>Response.json({error:{code:'NOT_FOUND'}},{status:404})},readiness:createWorkerReadiness({worker}),signal});
  return Object.freeze({address:listener.address,completion:run,close});
 }catch(error){
  try{await close();}catch(cleanup){throw temporalCleanupUnknown(new AggregateError([error,cleanup],'SCHEDULE_WORKER_STARTUP_AND_CLEANUP_FAILED'));}
  if(error?.code==='TEMPORAL_PRODUCT_CLEANUP_UNKNOWN')throw error;
  throw Object.assign(fault('SCHEDULE_WORKER_STARTUP_FAILED'),{cause:error});
 }
}
