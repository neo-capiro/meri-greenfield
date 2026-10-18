/** Compiled foreground feature factory. Constructed by the trusted host with borrowed pool/client and explicit policy;
 * actual opaque sessions are supplied only after the canonical control assembly creates them. No JSON authority selectors.
 * Optional trusted owners for the Core wires: `sessionRelay` (read-credential-relay.mjs) is bound ONCE to the actual sessions
 * given to `create`, so Core calls use the owner's live native session; `cancellationProofs` (`{issue}`, Core wire B) makes
 * running-work cancellation attended-only and hands its proof to `runControl`. */
import {randomUUID} from 'node:crypto';
import {types} from 'node:util';
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
import {createRoutineReadConsents} from './native-authority/read-delegation/routine-consents.mjs';

export function createRuntimeRoutinesFeature(configuration){
 const c=own(configuration,['enabled'],['pool','client','context','now','newId','limits','runControl','retirement','cancellationProofs','sessionRelay','readConsents','log','contextOwnerFactory']);
 if(typeof c.enabled!=='boolean')throw Error('ROUTINES_CONFIGURATION');
 // The kill switch does not inspect authority ports or allocate resources.
 if(c.enabled===false)return Object.freeze({state:()=> 'disabled',inboxState:()=> 'disabled',create:()=>createRoutinesApplication({enabled:false})});
 const now=c.now??Date.now,newId=c.newId??randomUUID;
 const context=own(c.context,['commandContext','allocationJson','template','workflow','policy','limits']);
 const limits=own(c.limits,['maxRequestMs','maxRequestBytes','maxResponseBytes']);
 if(typeof now!=='function'||typeof newId!=='function')throw Error('ROUTINES_CONFIGURATION');
 if(c.contextOwnerFactory!==undefined&&(typeof c.contextOwnerFactory!=='function'||types.isProxy(c.contextOwnerFactory)))throw Error('ROUTINES_CONFIGURATION');
 const scheduleOwner=createPostgresScheduleOwner({pool:c.pool}),journalStore=createPostgresIntentJournalStore({pool:c.pool}),proposalReader=createPostgresScheduleProposalReader({pool:c.pool});
 // Temporal SDK clients remain borrowed. No listener, timer, socket or query starts during construction.
 const scheduleClient=c.client?.schedule,workflowClient=c.client?.workflow;
 if(!scheduleClient||!workflowClient)throw Error('ROUTINES_CONFIGURATION');
 if((c.runControl===undefined)!==(c.retirement===undefined)||c.cancellationProofs!==undefined&&c.runControl===undefined)throw Error('ROUTINES_CONFIGURATION');
 if(c.sessionRelay!==undefined&&(typeof c.sessionRelay?.bind!=='function'||typeof c.sessionRelay?.state!=='function'))throw Error('ROUTINES_CONFIGURATION');
 // Option B (lane RD): the composer's `readDelegation.consents`; bound to the actual sessions at `create`, never before.
 if(c.readConsents!==undefined&&['approve','narrow','resume'].some(k=>typeof c.readConsents?.[k]!=='function')||c.log!==undefined&&typeof c.log!=='function')throw Error('ROUTINES_CONFIGURATION');
 const runCancellation=c.runControl===undefined?undefined:createScheduledRunCancellation({scheduleOwner,store:createPostgresConversationStore({pool:c.pool,now}),runControl:c.runControl,retirement:c.retirement,client:c.client,now,maxRequestMs:limits.maxRequestMs,...(c.cancellationProofs===undefined?{}:{proofs:c.cancellationProofs})});
 let state='pending',inboxState='pending';
 return Object.freeze({state:()=>state,inboxState:()=>inboxState,historyCurrentness(value){
  const {gate,core}=own(value,['gate','core']);try{const owner=createScheduledConversationCurrentness({scheduleOwner,gate,core,now,maxRequestMs:limits.maxRequestMs});inboxState='composed';return owner;}catch(error){inboxState='unavailable';throw error;}
 },create(value){
  const {sessions}=own(value,['sessions']);
  try{
   // The Core wires resolve the owner's native bearer from exactly these sessions (never another owner or credential).
   if(c.sessionRelay!==undefined)c.sessionRelay.bind(sessions);
   const contextOwner=c.contextOwnerFactory===undefined?
    createScheduleRuntimeContext({...context,sessions,scheduleOwner,now,newId,...(runCancellation===undefined?{}:{runCancellation})}):
    c.contextOwnerFactory({...context,sessions,scheduleOwner,now,newId,...(runCancellation===undefined?{}:{runCancellation})});
   // The read-consent port resolves the owner's native bearer from exactly these sessions, for the template's read operations.
   const readConsents=c.readConsents===undefined?undefined:createRoutineReadConsents({consents:c.readConsents,nativeCredentials:sessions,allocationJson:context.allocationJson,now});
   const service=createRoutinesService({contextOwner,journalStore,proposalReader,scheduleOwner,scheduleClient,workflowClient,scheduleNotFoundError:ScheduleNotFoundError,now,maxRequestMs:limits.maxRequestMs,...(runCancellation===undefined?{}:{runCancellation}),
    ...(readConsents===undefined?{}:{readConsents}),...(c.log===undefined?{}:{log:c.log})});
   const application=createRoutinesApplication({service,now,limits,enabled:true});state='composed';return application;
  }catch(error){state='unavailable';throw error;}
 }});
}
