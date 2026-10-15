/** Workflow-side original-attempt reconciliation. The single executeConversation attempt is never retried; when it fails or is
 * lost (a crashed poller surfaces as a heartbeat timeout and never ran its own cleanup), the workflow schedules the idempotent
 * reconcile activity, which retires the original and settles a run it left nonterminal, and then fails as before. */
import {proxyActivities,CancellationScope} from '@temporalio/workflow';
interface Binding {tenantId:string;actorId:string;conversationId:string;runId:string;attemptId:string;workerId:string;writerFence:number}
interface RecoveryActivities {reconcileConversation(input:{binding:Binding}):Promise<{state:'reconciled'}>}
/** Healthy-infrastructure bound: 30 s heartbeat detection plus at most 85 s of reconcile attempts stays under two minutes. */
const {reconcileConversation}=proxyActivities<RecoveryActivities>({startToCloseTimeout:'20 seconds',scheduleToCloseTimeout:'85 seconds',retry:{initialInterval:'1 second',backoffCoefficient:2,maximumInterval:'10 seconds'}});
export async function reconcileAfterFailure<T>(input:{binding:Binding},execute:()=>Promise<T>):Promise<T>{
 try{return await execute();}
 catch(error){
  // Runs even when the workflow itself was cancelled (user Stop), so cleanup is never skipped. When its finite budget is exhausted the run
  // stays nonterminal behind an unretired original (a barrier, never a redispatch); any later stop, or the operator's one-shot
  // apps/runtime/reconcile-run.mjs, resumes settlement from that durable state. No background loop is scheduled here.
  try{await CancellationScope.nonCancellable(()=>reconcileConversation(input));}catch{}
  throw error;
 }
}
