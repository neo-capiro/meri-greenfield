/** Server-owned Objective generation lifecycle. Opt-in, separate workflow type: the
 * browser only requested work; Temporal keeps admission, the one accepted run, run
 * observation and Core completion going after the browser closes or a worker dies.
 * No model loop or Planner application runs here (see lifecycle-driver.mjs). */
import {proxyActivities,defineSignal,defineQuery,setHandler,condition,isCancellation} from '@temporalio/workflow';
import {driveObjectiveGeneration} from '../objective-generation/lifecycle-driver.mjs';
interface Binding {tenantId:string;actorId:string;conversationId:string;runId:string;attemptId:string;workerId:string;writerFence:number}
export interface ObjectiveGenerationInput {generationJobId:string;binding:Binding;notAfterMs:number}
type Outcome={kind:string;[key:string]:unknown};
interface Activities {
 objectiveGenerationSource(input:ObjectiveGenerationInput):Promise<Outcome>;
 objectiveGenerationStartRun(input:ObjectiveGenerationInput&{mode:'effect'|'read';requestSha256:string}):Promise<Outcome>;
 objectiveGenerationReadRun(input:ObjectiveGenerationInput):Promise<Outcome>;
 objectiveGenerationComplete(input:ObjectiveGenerationInput&{sourceAdmissionSha256:string}):Promise<Outcome>;
}
export interface ObjectiveGenerationState {phase:string;runStartAttempted:boolean;stopRequested:boolean;sourceAdmissionSha256:string|null;requestSha256:string|null;runState:string|null;result:unknown}
export const objectiveGenerationState=defineQuery<ObjectiveGenerationState|null>('meriObjectiveGenerationState');
export const stopObjectiveGeneration=defineSignal('meriObjectiveGenerationStop');
export const wakeObjectiveGeneration=defineSignal('meriObjectiveGenerationWake');
// One attempt per activity call: the driver alone decides effect versus read-back.
const activities=proxyActivities<Activities>({startToCloseTimeout:'1 minute',retry:{maximumAttempts:1}});
export async function meriObjectiveGenerationWorkflow(input:ObjectiveGenerationInput):Promise<ObjectiveGenerationState>{
 let stop=false,wake=false,current:ObjectiveGenerationState|null=null;
 setHandler(objectiveGenerationState,()=>current&&{...current,stopRequested:stop});
 setHandler(stopObjectiveGeneration,()=>{stop=true;wake=true;});setHandler(wakeObjectiveGeneration,()=>{wake=true;});
 return driveObjectiveGeneration(input,{
  source:activities.objectiveGenerationSource,startRun:activities.objectiveGenerationStartRun,
  readRun:activities.objectiveGenerationReadRun,complete:activities.objectiveGenerationComplete,
  wait:async(ms:number)=>{await condition(()=>wake,ms);wake=false;},
  publish:(value:ObjectiveGenerationState)=>{current=value;},stopped:()=>stop,now:()=>Date.now(),fatal:isCancellation,
 });
}
