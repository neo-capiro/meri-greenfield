import {proxyActivities,continueAsNew} from '@temporalio/workflow';
import {RETENTION_SWEEP_BUDGET} from '../../../packages/runtime/retention-sweep-budget.mjs';
interface Result {after:string|null;more:boolean;outcome:'empty'|'executed'|'blocked'|'unknown'}
const {sweepConversationRetention}=proxyActivities<{sweepConversationRetention(input:{after:string|null}):Promise<Result>}>({
 startToCloseTimeout:RETENTION_SWEEP_BUDGET.activityMs,heartbeatTimeout:RETENTION_SWEEP_BUDGET.activityMs,retry:{maximumAttempts:3},
});
/** A bounded pass, serial on the existing worker queue. Holds/unknown outcomes
 * remain retained and are reconsidered on the next fixed schedule. */
export async function meriConversationRetentionWorkflow(input:{after:string|null}={after:null}):Promise<{visited:number;executed:number;blocked:number;unknown:number;more:boolean}>{
 let after=input.after;const summary={visited:0,executed:0,blocked:0,unknown:0,more:false};
 for(let i=0;i<256;i++){
  const result=await sweepConversationRetention({after});summary.more=result.more;
  if(result.outcome!=='empty'){summary.visited++;summary[result.outcome]++;}
  if(!result.more)return summary;
  if(result.after===null||result.after===after)throw Error('RETENTION_CURSOR_REFUSED');
  after=result.after;
 }
 // Bound workflow history without starving subjects beyond the first page.
 return continueAsNew<typeof meriConversationRetentionWorkflow>({after});
}
