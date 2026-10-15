// Synthetic composition harness over the REAL owners: the Postgres schedule owner and conversation store (each over its scripted
// SQL fixture), the conversation Temporal dispatcher and run-evidence reader (over a scripted Temporal client), and the scheduled
// dispatch. Authority and instruction ports are synthetic. No PostgreSQL, Temporal server or native durability claim.
import {createRequire} from 'node:module';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {createPostgresScheduleOwner} from '../postgres-schedule-owner.mjs';
import {createScheduledDispatch} from '../scheduled-dispatch.mjs';
import {createPostgresConversationStore} from '../../conversations/postgres-store.mjs';
import {createTemporalConversationDispatcher} from '../../conversations/temporal-dispatch.mjs';
import {createTemporalRunEvidence} from '../../conversations/temporal-run-evidence.mjs';
import {storeFixture,versions} from '../../conversations/test/store-fixture.mjs';
import {scheduleOwnerFixture} from './schedule-owner-fixture.mjs';

const require=createRequire(new URL('../../conversations/package.json',import.meta.url));
export const {WorkflowNotFoundError,ScheduleNotFoundError,ScheduleClient,WorkflowService}=require('@temporalio/client');
export const NOW=Date.parse('2026-10-15T12:00:01.000Z');
export const ids={schedule:'22222222-2222-4222-8222-222222222222',task:'33333333-3333-4333-8333-333333333333',create:'11111111-1111-4111-8111-111111111111',update:'44444444-4444-4444-8444-444444444444',cancel:'55555555-5555-4555-8555-555555555555',run:'66666666-6666-4666-8666-666666666666'};
export const instruction='Summarise new committee activity for the selected client.';
export const owner={tenantId:'tenant-a',actorId:'owner-a'};
export const projection=(changes={})=>({scheduleId:ids.schedule,owner,temporalScheduleId:'application/schedule-a',timezone:'UTC',
 scopes:[{tenantId:'tenant-a',kind:'client',resourceId:'client-a',policyRevision:'policy-a'}],state:'active',maxCostMicrousd:120,maxRuntimeSeconds:300,retryLimit:1,
 destinationId:'destination-a',createdAt:'2026-10-12T00:00:00.000Z',...changes});
export const configuration=(changes={})=>({spec:{calendars:[],intervals:[{every:60000,offset:0}],cronExpressions:[],skip:[],startAt:null,endAt:null,jitterMs:500,timezone:'UTC'},
 overlap:'SKIP',catchupWindowMs:2000,pauseOnFailure:false,remainingActions:null,paused:false,note:'approved schedule',runNow:false,runNowOverlap:'ALLOW_ALL',
 task:{taskId:ids.task,manifestSha256:'a'.repeat(64),version:2},workflow:{workflowType:'meriScheduledDispatchWorkflow',workflowId:'schedule-a',taskQueue:'meri-schedules'},...changes});
export const createIntent=()=>({intentId:ids.create,operation:'schedule_task',expectedGeneration:0,generation:1,previousProjectionSha256:null,projection:projection(),configuration:configuration(),cancel:null,taskInstructionSha256:canonicalSha256(instruction)});
export const updateIntent=(changes={})=>({intentId:ids.update,operation:'update_scheduled_task',expectedGeneration:1,generation:2,previousProjectionSha256:canonicalSha256(projection()),projection:projection({maxCostMicrousd:200}),configuration:configuration(),cancel:null,taskInstructionSha256:canonicalSha256(instruction),...changes});
export const cancelIntent=(cancel={})=>({intentId:ids.cancel,operation:'cancel_scheduled_task',expectedGeneration:1,generation:2,previousProjectionSha256:canonicalSha256(projection()),
 projection:projection({state:cancel.mode==='pause'?'paused':'cancelled'}),configuration:null,cancel:{mode:'delete',note:'approved cancellation',running:'leave',runs:[],...cancel}});
export const occurrence=(changes={})=>({workflowId:'schedule-a-2026-10-15T12:00:00Z',temporalScheduleId:'application/schedule-a',scheduledAt:'2026-10-15T12:00:00.000Z',projection:projection(),generation:1,task:configuration().task,...changes});
export const ownerBinding=intent=>({intent,bindingSha256:canonicalSha256({intent,request:'synthetic approved execute binding'})});
export const check=()=>{};

/** Scripted Temporal client: workflow IDs are unique (the dispatcher's REJECT_DUPLICATE/USE_EXISTING), starts can fail before the
 * effect or lose the acknowledgement after it, and describe answers typed not-found only for a never-started ID. */
export function temporalFixture() {
 const workflows=new Map(),faults={start:[],describe:[]},calls={start:0,describe:0};
 const client={connection:{withDeadline:(_deadline,fn)=>fn(),withAbortSignal:(_signal,fn)=>fn()},workflow:{
  async start(workflowType,options){calls.start++;const fault=faults.start.shift();if(fault==='before')throw Error('synthetic unavailable');
   if(!workflows.has(options.workflowId))workflows.set(options.workflowId,{workflowType,args:structuredClone(options.args)});if(fault==='lose')throw Error('synthetic acknowledgement lost');return {workflowId:options.workflowId};},
  getHandle(workflowId){return {async describe(){calls.describe++;if(faults.describe.shift()==='error')throw Error('synthetic transport');if(!workflows.has(workflowId))throw new WorkflowNotFoundError('not found',workflowId,undefined);return {workflowId};},async cancel(){}};},
 }};
 return {client,workflows,faults,calls};
}
export function authorityFixture() {
 const state={mode:'allow',calls:[]};
 const port={async authorize(q){
  state.calls.push({phase:q.phase,owner:q.projection.owner,occurrenceKey:q.occurrenceKey});
  if(state.mode==='throw')throw Error('synthetic policy unavailable');
  if(state.mode==='revoked')return {authorized:false,occurrenceKey:q.occurrenceKey,code:'OWNER_REVOKED'};
  const scopes=state.mode==='widen'?[...q.projection.scopes,{tenantId:'tenant-a',kind:'client',resourceId:'client-b',policyRevision:'policy-a'}]:q.projection.scopes;
  return {authorized:true,occurrenceKey:q.occurrenceKey,owner:state.mode==='impersonate'?{tenantId:'tenant-a',actorId:'someone-else'}:q.projection.owner,scopes,checkedAtMs:NOW,expiresAtMs:NOW+60000};
 }};
 return {state,port};
}
export function harness() {
 const schedules=scheduleOwnerFixture(),conversations=storeFixture(),temporal=temporalFixture(),authority=authorityFixture(),instructions={calls:[],text:instruction};
 const scheduleOwner=createPostgresScheduleOwner({pool:schedules.pool}),store=createPostgresConversationStore({pool:conversations.pool,now:()=>NOW});
 const dispatcher=createTemporalConversationDispatcher({client:temporal.client,taskQueue:'meri-conversations',lifecycle:true,now:()=>NOW});
 const runs=createTemporalRunEvidence({client:temporal.client,now:()=>NOW});
 const taskInstructions={async read(q){instructions.calls.push(q);return {instruction:instructions.text};}};
 const scheduled=createScheduledDispatch({scheduleOwner,store,dispatcher,runs,authority:authority.port,taskInstructions,versions,now:()=>NOW});
 async function acknowledge(intent){const b=ownerBinding(intent);await scheduleOwner.claim(b,check);await scheduleOwner.markDispatching(b,check);await scheduleOwner.commitKnown(b,check);}
 return {schedules,conversations,temporal,authority,instructions,scheduleOwner,store,scheduled,acknowledge,
  runCount:()=>conversations.state.runs.size,workflowCount:()=>temporal.workflows.size};
}
