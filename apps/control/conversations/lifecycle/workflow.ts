/** Temporal owns durable waiting; the activity/SDK owns the only model loop. */
import {proxyActivities,defineSignal,defineQuery,setHandler,condition} from '@temporalio/workflow';
import {reconcileAfterFailure} from '../recovery-workflow.ts';
interface Binding {tenantId:string;actorId:string;conversationId:string;runId:string;attemptId:string;workerId:string;writerFence:number}
type Terminal='completed'|'failed'|'cancelled';
type Held='paused'|'waiting-for-approval';
interface Activities {executeConversation(input:{binding:Binding}):Promise<{state:Terminal|Held}>}
interface Continued {controlId:string;sourceRunId:string;targetRunId:string;admissionReceiptId:string;retirementReceiptId:string}
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(v);
export const controlsAvailable=defineSignal<[{controlId:string}]>('meriControlsAvailable');
export const lifecycleContinued=defineSignal<[Continued]>('meriLifecycleContinued');
export const lifecycleState=defineQuery<{state:Terminal|Held|'executing'|'continued';lastControlId:string|null;targetRunId:string|null}>('meriLifecycleState');
const {executeConversation}=proxyActivities<Activities>({startToCloseTimeout:'30 minutes',heartbeatTimeout:'30 seconds',retry:{maximumAttempts:1}});
export async function meriConversationLifecycleWorkflow(input:{binding:Binding}):Promise<{state:Terminal|'continued'}>{
 let state:Terminal|Held|'executing'|'continued'='executing',lastControlId:string|null=null,target:Continued|null=null;
 setHandler(controlsAvailable,v=>{if(v&&Object.keys(v).length===1&&uuid(v.controlId))lastControlId=v.controlId;});
 setHandler(lifecycleContinued,v=>{if(v&&Object.keys(v).sort().join(',')==='admissionReceiptId,controlId,retirementReceiptId,sourceRunId,targetRunId'&&Object.values(v).every(uuid)&&v.sourceRunId===input.binding.runId&&v.targetRunId!==input.binding.runId&&!target)target=v;});
 setHandler(lifecycleState,()=>({state,lastControlId,targetRunId:target?.targetRunId??null}));
 const result=await reconcileAfterFailure(input,()=>executeConversation(input));state=result.state;
 if(state==='paused'||state==='waiting-for-approval'){
  await condition(()=>target!==null);state='continued';return {state};
 }
 return {state};
}
