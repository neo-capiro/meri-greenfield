/** Durable owner of ONE Temporal schedule firing. The schedule action starts this workflow with {projection, generation, task};
 * Temporal's server-set TemporalScheduledById/TemporalScheduledStartTime and the scheduled workflow ID fix the occurrence identity.
 * The workflow never fires, retries or re-identifies anything itself: an uncertain dispatch is reconciled against the canonical
 * owners after a settle period longer than the activity bound, and only evidence (DISPATCHED, REFUSED) ends it. While UNKNOWN the
 * workflow stays open, so the schedule's overlap policy keeps treating the firing as running. */
import {proxyActivities,sleep,workflowInfo,isCancellation,CancellationScope} from '@temporalio/workflow';
interface Firing {projection:unknown;generation:unknown;task:unknown}
interface Occurrence extends Firing {workflowId:string;temporalScheduleId:string;scheduledAt:string}
export interface ScheduledOutcome {outcome:'DISPATCHED'|'REFUSED'|'UNKNOWN'|'ADMITTED'|'NOT_DISPATCHED'|'ACTIVE';occurrenceKey:string|null;binding:unknown;code:string|null;admitted:boolean|null}
interface Activities {
 dispatchScheduledOccurrence(input:{occurrence:Occurrence}):Promise<ScheduledOutcome>;
 reconcileScheduledOccurrence(input:{occurrence:Occurrence}):Promise<ScheduledOutcome>;
 cancelScheduledOccurrence(input:{occurrence:Occurrence}):Promise<ScheduledOutcome>;
}
const {dispatchScheduledOccurrence,reconcileScheduledOccurrence}=proxyActivities<Activities>({startToCloseTimeout:'1 minute',retry:{maximumAttempts:1}});
const {cancelScheduledOccurrence}=proxyActivities<Activities>({startToCloseTimeout:'1 minute',retry:{maximumAttempts:1}});
// Server-set system search attributes of a schedule-started workflow (typed keys; no caller-supplied value is trusted).
const scheduledBy={name:'TemporalScheduledById',type:'KEYWORD'} as const,scheduledStart={name:'TemporalScheduledStartTime',type:'DATETIME'} as const;
/** Longer than the activity's startToClose bound plus the store/Temporal request bounds, so a lost attempt has settled. */
export const settleAfterUnknown='2 minutes';
async function attempt(activity:()=>Promise<ScheduledOutcome>):Promise<ScheduledOutcome>{
 try{return await activity();}catch(error){if(isCancellation(error))throw error;return {outcome:'UNKNOWN',occurrenceKey:null,binding:null,code:'SCHEDULE_ACTIVITY_UNKNOWN',admitted:null};}
}
export async function meriScheduledDispatchWorkflow(firing:Firing):Promise<ScheduledOutcome>{
 const info=workflowInfo(),temporalScheduleId=info.typedSearchAttributes.get(scheduledBy),at=info.typedSearchAttributes.get(scheduledStart);
 if(typeof temporalScheduleId!=='string'||!(at instanceof Date))return {outcome:'REFUSED',occurrenceKey:null,binding:null,code:'SCHEDULE_OCCURRENCE_UNSCHEDULED',admitted:false};
 const occurrence:Occurrence={workflowId:info.workflowId,temporalScheduleId,scheduledAt:at.toISOString(),projection:firing?.projection,generation:firing?.generation,task:firing?.task};
 try{
  let result=await attempt(()=>dispatchScheduledOccurrence({occurrence})),jobObserved=result.outcome==='ACTIVE';
  while(result.outcome!=='DISPATCHED'&&result.outcome!=='REFUSED'){
   // ACTIVE includes held/approval-waiting work. Observation never re-enters the model or releases overlap on a wrapper timeout.
   if(jobObserved||result.outcome==='UNKNOWN'||result.outcome==='ACTIVE'){await sleep(settleAfterUnknown);result=await attempt(()=>reconcileScheduledOccurrence({occurrence}));jobObserved ||= result.outcome==='ACTIVE';}
   // ADMITTED or NOT_DISPATCHED only completes the SAME immutable admission/start; executeConversation itself never retries.
   else result=await attempt(()=>dispatchScheduledOccurrence({occurrence}));
  }
  return result;
 }catch(error){
  // Cancelling this schedule wrapper must request cancellation of its actual effect, including a verified resumed run.
  // An unavailable cleanup owner leaves the durable OPEN barrier intact; no cancellation ACK proves physical retirement.
  if(isCancellation(error))try{await CancellationScope.nonCancellable(()=>cancelScheduledOccurrence({occurrence}));}catch{}
  throw error;
 }
}
