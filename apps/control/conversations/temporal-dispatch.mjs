/** Upstream Temporal client owns start/cancel and workflow ID deduplication. */
import {WorkflowIdReusePolicy,WorkflowIdConflictPolicy,WorkflowNotFoundError} from '@temporalio/client';
import {assertWorkerControl} from '../../../packages/contracts/conversation-lifecycle/validate.mjs';
import {validateShape,fail,same,own,uuid} from './boundary.mjs';
import {nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
export const workflowId=b=>`meri:${b.tenantId}:${b.conversationId}:${b.runId}`;
export function createTemporalConversationDispatcher({client,taskQueue,lifecycle=false,now=Date.now,maxRequestMs=3000}){
 if(typeof client?.workflow?.start!=='function'||typeof client?.workflow?.getHandle!=='function'||typeof taskQueue!=='string'||!taskQueue||taskQueue.length>256||typeof lifecycle!=='boolean'||typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)fail('TEMPORAL_CONFIGURATION');
 /** Temporal 1.24 Connection scopes reach the actual gRPC deadline/call.cancel.
  * An outer promise timeout alone cannot cancel a workflow RPC. Never retry or
  * roll back after an RPC whose acknowledgement may have been lost. */
 async function dispatch({signal,deadlineMs},operation){
  nativeSignal(signal);signal?.throwIfAborted();const began=now();
  if(!Number.isSafeInteger(began)||deadlineMs!==undefined&&(!Number.isSafeInteger(deadlineMs)||deadlineMs<=began))fail('TEMPORAL_DISPATCH_REFUSED');
  let withDeadline,withAbortSignal;try{withDeadline=storageMethod(client.connection,'withDeadline');withAbortSignal=storageMethod(client.connection,'withAbortSignal');}catch{fail('TEMPORAL_TRANSPORT_UNAVAILABLE');}
  const cutoff=Math.min(deadlineMs??began+maxRequestMs,began+maxRequestMs),unknown=()=>Object.assign(Error('TEMPORAL_DISPATCH_UNKNOWN'),{code:'TEMPORAL_DISPATCH_UNKNOWN'}),life=createOperationLifetime({now,signal,deadlineMs:cutoff,errorFactory:unknown});
  try{
   life.check();await life.run(rpcSignal=>withDeadline(cutoff,()=>withAbortSignal(rpcSignal,async()=>{life.check();signal?.throwIfAborted();await operation();life.check();signal?.throwIfAborted();})));life.check();signal?.throwIfAborted();
  }catch{throw unknown();}finally{life.close();}
 }
 const basic={
  async start({binding,signal,deadlineMs}){
   validateShape('RunBinding',binding);nativeSignal(signal);signal?.throwIfAborted();
   await dispatch({signal,deadlineMs},()=>client.workflow.start(lifecycle?'meriConversationLifecycleWorkflow':'meriConversationWorkflow',{workflowId:workflowId(binding),taskQueue,args:[{binding}],workflowIdReusePolicy:WorkflowIdReusePolicy.REJECT_DUPLICATE,workflowIdConflictPolicy:WorkflowIdConflictPolicy.USE_EXISTING}));signal?.throwIfAborted();
  },
  /** Temporal NOT_FOUND is a definitive answer, not a lost acknowledgement: no open workflow carries this run's ID (never started, or
   * already closed). Callers commit the run's terminal state before cancelling, so a start that lands later is fenced by that state.
   * Every other failure, including a deadline, stays TEMPORAL_DISPATCH_UNKNOWN. */
  async cancel({binding,signal,deadlineMs}){validateShape('RunBinding',binding);nativeSignal(signal);signal?.throwIfAborted();let workflow='CANCEL_REQUESTED';
   await dispatch({signal,deadlineMs},async()=>{try{await client.workflow.getHandle(workflowId(binding)).cancel();}catch(error){if(!(error instanceof WorkflowNotFoundError))throw error;workflow='NOT_FOUND';}});signal?.throwIfAborted();return {workflow};}
 };
 if(!lifecycle)return Object.freeze(basic);
 return Object.freeze({...basic,
  async signal({binding,command,signal,deadlineMs}){
   validateShape('RunBinding',binding);nativeSignal(signal);const c=assertWorkerControl(command);if(!same(c.binding,binding))fail('TEMPORAL_CONTROL_REFUSED');signal?.throwIfAborted();
   await dispatch({signal,deadlineMs},()=>client.workflow.getHandle(workflowId(binding)).signal('meriControlsAvailable',{controlId:c.controlId}));signal?.throwIfAborted();
  },
  async continued({binding,input,signal,deadlineMs}){
   validateShape('RunBinding',binding);nativeSignal(signal);own(input,['controlId','sourceRunId','targetRunId','admissionReceiptId','retirementReceiptId']);Object.values(input).forEach(uuid);
   if(input.sourceRunId!==binding.runId||input.targetRunId===binding.runId)fail('TEMPORAL_CONTROL_REFUSED');signal?.throwIfAborted();
   await dispatch({signal,deadlineMs},()=>client.workflow.getHandle(workflowId(binding)).signal('meriLifecycleContinued',input));signal?.throwIfAborted();
  }
 });
}
