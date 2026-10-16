/** Existing Temporal1.24 client scope pattern; original workflow identity survives start ACK loss and browser closure. */
import {WorkflowIdReusePolicy,WorkflowIdConflictPolicy} from '@temporalio/client';
import {own,data,continuationWork as work,continuationWorkflowId as workflowId,coreDigest as hash,fail} from './contract.mjs';
import {nativeSignal} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {ProductError,productFailure} from '../../product-access/errors.mjs';
export function createObjectivePlannerDispatcher({client,taskQueue,now=Date.now,maxRequestMs=3000}){
 if(typeof client?.workflow?.start!=='function'||typeof client?.workflow?.getHandle!=='function'||typeof taskQueue!=='string'||!taskQueue||taskQueue.length>256||typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)fail('CONFIGURATION');
 async function call(mode,value){
  const v=own(value,['work','deadlineMs'],['signal']),w=work(v.work),id=workflowId(w),digest=hash(w);nativeSignal(v.signal);
  if(!Number.isSafeInteger(v.deadlineMs)||typeof client.connection?.withDeadline!=='function'||typeof client.connection?.withAbortSignal!=='function')fail('TEMPORAL_UNAVAILABLE');
  const cutoff=Math.min(v.deadlineMs,now()+maxRequestMs),life=createOperationLifetime({now,signal:v.signal,deadlineMs:cutoff,errorFactory:()=>new ProductError('OBJECTIVE_PLANNER_TEMPORAL_UNKNOWN','UNKNOWN')});
  try{
   return await life.run(signal=>client.connection.withDeadline(cutoff,()=>client.connection.withAbortSignal(signal,async()=>{
    life.check();
    if(mode==='start'){
     // Any lost start ACK is reconciled with the exact workflow ID, never a newly minted one.
     try{await client.workflow.start('meriObjectivePlannerWorkflow',{workflowId:id,taskQueue,args:[{work:w,workSha256:digest}],workflowIdReusePolicy:WorkflowIdReusePolicy.REJECT_DUPLICATE,workflowIdConflictPolicy:WorkflowIdConflictPolicy.USE_EXISTING});}catch{}
     life.check();
    }
    const handle=client.workflow.getHandle(id),observed=await handle.query('meriObjectivePlannerIdentity');life.check();
    if(observed!==digest)fail('WORK_CONFLICT');
    if(mode==='stop'){await handle.signal('meriObjectivePlannerStop');life.check();return data({workflowId:id,workSha256:digest,stopRequested:true});}
    const state=data(await handle.query('meriObjectivePlannerState'));life.check();own(state,['phase','prepareAttempted','stopRequested','ack']);
    if(typeof state.phase!=='string'||typeof state.prepareAttempted!=='boolean'||typeof state.stopRequested!=='boolean')fail('TEMPORAL_UNKNOWN');
    return data({workflowId:id,workSha256:digest,state});
   })));
  }catch(error){if(productFailure(error)?.code==='OBJECTIVE_PLANNER_WORK_CONFLICT')throw error;fail('TEMPORAL_UNKNOWN','UNKNOWN');}
  finally{life.close();}
 }
 return Object.freeze({start:call.bind(null,'start'),read:call.bind(null,'read'),stop:call.bind(null,'stop')});
}
