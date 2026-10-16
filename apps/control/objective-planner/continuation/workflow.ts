/** Opt-in server workflow. SDK/control retain the original run; this workflow schedules no model execution. */
import {proxyActivities,defineQuery,defineSignal,setHandler,condition} from '@temporalio/workflow';
import {drivePlannerContinuation} from './driver.mjs';
interface Input {work:unknown;workSha256:string}
interface Outcome {kind:'ack'|'unavailable'|'refused';ack?:unknown}
interface Activities {inspectObjectivePlanner(input:Input):Promise<Outcome>;prepareObjectivePlanner(input:Input):Promise<Outcome>}
interface State {phase:string;prepareAttempted:boolean;stopRequested:boolean;ack:unknown}
export const plannerIdentity=defineQuery<string>('meriObjectivePlannerIdentity');
export const plannerState=defineQuery<State>('meriObjectivePlannerState');
export const stopPlanner=defineSignal('meriObjectivePlannerStop');
export const wakePlanner=defineSignal('meriObjectivePlannerWake');
// Never repeat a prepare activity after timeout/poller loss. Inspect is safe to schedule again explicitly.
const activities=proxyActivities<Activities>({startToCloseTimeout:'30 seconds',retry:{maximumAttempts:1}});
export async function meriObjectivePlannerWorkflow(input:Input):Promise<State>{
 let stop=false,wake=false,current:State={phase:'starting',prepareAttempted:false,stopRequested:false,ack:null};
 setHandler(plannerIdentity,()=>input.workSha256);setHandler(plannerState,()=>({...current,stopRequested:stop}));
 setHandler(stopPlanner,()=>{stop=true;wake=true;});setHandler(wakePlanner,()=>{wake=true;});
 return drivePlannerContinuation(input,{inspect:activities.inspectObjectivePlanner,prepare:activities.prepareObjectivePlanner,stopped:()=>stop,publish:(value:State)=>{current=value;},wait:async()=>{await condition(()=>wake,'2 minutes');wake=false;}});
}
