/** Server-side starter for meriObjectiveGenerationWorkflow. One workflow per tenant
 * and Core generation job (Temporal workflow ID deduplication); the browser never
 * holds the orchestration. Like temporal-dispatch.mjs, a lost RPC acknowledgement
 * is TEMPORAL_DISPATCH_UNKNOWN and is never retried or rolled back here.
 * The caller must already own a trusted accepted binding for the job and a
 * server-set notAfterMs; neither may come from browser JSON. */
import {WorkflowIdReusePolicy,WorkflowIdConflictPolicy} from '@temporalio/client';
import {validateShape,fail,uuid} from './boundary.mjs';
import {nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
export const objectiveGenerationWorkflowId=({tenantId,generationJobId})=>`meri:objective-generation:${tenantId}:${generationJobId}`;
export function createObjectiveGenerationDispatcher({client,taskQueue,now=Date.now,maxRequestMs=3000}){
 if(typeof client?.workflow?.start!=='function'||typeof client?.workflow?.getHandle!=='function'||typeof taskQueue!=='string'||!taskQueue||taskQueue.length>256||
    typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)fail('TEMPORAL_CONFIGURATION');
 async function dispatch({signal,deadlineMs},operation){
  nativeSignal(signal);signal?.throwIfAborted();const began=now();
  if(!Number.isSafeInteger(began)||deadlineMs!==undefined&&(!Number.isSafeInteger(deadlineMs)||deadlineMs<=began))fail('TEMPORAL_DISPATCH_REFUSED');
  let withDeadline,withAbortSignal;try{withDeadline=storageMethod(client.connection,'withDeadline');withAbortSignal=storageMethod(client.connection,'withAbortSignal');}catch{fail('TEMPORAL_TRANSPORT_UNAVAILABLE');}
  const cutoff=Math.min(deadlineMs??began+maxRequestMs,began+maxRequestMs),unknown=()=>Object.assign(Error('TEMPORAL_DISPATCH_UNKNOWN'),{code:'TEMPORAL_DISPATCH_UNKNOWN'}),life=createOperationLifetime({now,signal,deadlineMs:cutoff,errorFactory:unknown});
  try{life.check();await life.run(rpcSignal=>withDeadline(cutoff,()=>withAbortSignal(rpcSignal,async()=>{life.check();await operation();life.check();})));life.check();}
  catch{throw unknown();}finally{life.close();}
 }
 function source(value){
  const {generationJobId,binding,notAfterMs}=value??{};validateShape('RunBinding',binding);
  if(typeof generationJobId!=='string'||!uuid(generationJobId)||!Number.isSafeInteger(notAfterMs)||Object.keys(value).length!==3)fail('OBJECTIVE_GENERATION_DISPATCH_REFUSED');
  return {generationJobId,binding,notAfterMs};
 }
 return Object.freeze({
  async start({source:raw,signal,deadlineMs}){
   const input=source(raw),workflowId=objectiveGenerationWorkflowId({tenantId:input.binding.tenantId,generationJobId:input.generationJobId});
   await dispatch({signal,deadlineMs},()=>client.workflow.start('meriObjectiveGenerationWorkflow',{workflowId,taskQueue,args:[input],
    workflowIdReusePolicy:WorkflowIdReusePolicy.REJECT_DUPLICATE,workflowIdConflictPolicy:WorkflowIdConflictPolicy.USE_EXISTING}));
   return {workflowId};
  },
  async stop({tenantId,generationJobId,signal,deadlineMs}){
   if(typeof tenantId!=='string'||!tenantId||!uuid(generationJobId))fail('OBJECTIVE_GENERATION_DISPATCH_REFUSED');
   await dispatch({signal,deadlineMs},()=>client.workflow.getHandle(objectiveGenerationWorkflowId({tenantId,generationJobId})).signal('meriObjectiveGenerationStop'));
  },
 });
}
