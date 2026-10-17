/** Compiled foreground feature factory. Constructed by the trusted host with borrowed pool/client and explicit policy;
 * actual opaque sessions are supplied only after the canonical control assembly creates them. No JSON authority selectors. */
import {randomUUID} from 'node:crypto';
import {ScheduleNotFoundError} from '@temporalio/client';
import {own} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createPostgresIntentJournalStore,createPostgresScheduleProposalReader} from '../control/intents/postgres-journal.mjs';
import {createPostgresScheduleOwner} from '../control/schedules/postgres-schedule-owner.mjs';
import {createScheduleRuntimeContext} from '../control/schedules/runtime-context.mjs';
import {createRoutinesService} from '../control/schedules/application.mjs';
import {createRoutinesApplication} from '../control/schedules/application-http.mjs';
import {createScheduledConversationCurrentness} from '../control/schedules/scheduled-conversation-currentness.mjs';
import {createScheduledRunCancellation} from '../control/schedules/scheduled-run-cancellation.mjs';
import {createPostgresConversationStore} from '../control/conversations/postgres-store.mjs';

export function createRuntimeRoutinesFeature(configuration){
 const c=own(configuration,['enabled'],['pool','client','context','now','newId','limits','runControl','retirement']);
 if(typeof c.enabled!=='boolean')throw Error('ROUTINES_CONFIGURATION');
 // The kill switch does not inspect authority ports or allocate resources.
 if(c.enabled===false)return Object.freeze({state:()=> 'disabled',inboxState:()=> 'disabled',create:()=>createRoutinesApplication({enabled:false})});
 const now=c.now??Date.now,newId=c.newId??randomUUID;
 const context=own(c.context,['commandContext','allocationJson','template','workflow','policy','limits']);
 const limits=own(c.limits,['maxRequestMs','maxRequestBytes','maxResponseBytes']);
 if(typeof now!=='function'||typeof newId!=='function')throw Error('ROUTINES_CONFIGURATION');
 const scheduleOwner=createPostgresScheduleOwner({pool:c.pool}),journalStore=createPostgresIntentJournalStore({pool:c.pool}),proposalReader=createPostgresScheduleProposalReader({pool:c.pool});
 // Temporal SDK clients remain borrowed. No listener, timer, socket or query starts during construction.
 const scheduleClient=c.client?.schedule,workflowClient=c.client?.workflow;
 if(!scheduleClient||!workflowClient)throw Error('ROUTINES_CONFIGURATION');
 if((c.runControl===undefined)!==(c.retirement===undefined))throw Error('ROUTINES_CONFIGURATION');
 const runCancellation=c.runControl===undefined?undefined:createScheduledRunCancellation({scheduleOwner,store:createPostgresConversationStore({pool:c.pool,now}),runControl:c.runControl,retirement:c.retirement,client:c.client,now,maxRequestMs:limits.maxRequestMs});
 let state='pending',inboxState='pending';
 return Object.freeze({state:()=>state,inboxState:()=>inboxState,historyCurrentness(value){
  const {gate,core}=own(value,['gate','core']);try{const owner=createScheduledConversationCurrentness({scheduleOwner,gate,core,now,maxRequestMs:limits.maxRequestMs});inboxState='composed';return owner;}catch(error){inboxState='unavailable';throw error;}
 },create(value){
  const {sessions}=own(value,['sessions']);
  try{
   const contextOwner=createScheduleRuntimeContext({...context,sessions,scheduleOwner,now,newId,...(runCancellation===undefined?{}:{runCancellation})});
   const service=createRoutinesService({contextOwner,journalStore,proposalReader,scheduleOwner,scheduleClient,workflowClient,scheduleNotFoundError:ScheduleNotFoundError,now,maxRequestMs:limits.maxRequestMs,...(runCancellation===undefined?{}:{runCancellation})});
   const application=createRoutinesApplication({service,now,limits,enabled:true});state='composed';return application;
  }catch(error){state='unavailable';throw error;}
 }});
}
