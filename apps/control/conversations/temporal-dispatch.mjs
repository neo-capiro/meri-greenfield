/** Upstream Temporal client owns start/cancel and workflow ID deduplication. */
import {WorkflowIdReusePolicy,WorkflowIdConflictPolicy} from '@temporalio/client';
import {assertWorkerControl} from '../../../packages/contracts/conversation-lifecycle/validate.mjs';
import {validateShape,fail,same,own,uuid} from './boundary.mjs';
export const workflowId=b=>`meri:${b.tenantId}:${b.conversationId}:${b.runId}`;
export function createTemporalConversationDispatcher({client,taskQueue,lifecycle=false}){
 if(typeof client?.workflow?.start!=='function'||typeof client?.workflow?.getHandle!=='function'||typeof taskQueue!=='string'||!taskQueue||taskQueue.length>256||typeof lifecycle!=='boolean')fail('TEMPORAL_CONFIGURATION');
 const basic={
  async start({binding,signal}){
   validateShape('RunBinding',binding);signal?.throwIfAborted();
   await client.workflow.start(lifecycle?'meriConversationLifecycleWorkflow':'meriConversationWorkflow',{workflowId:workflowId(binding),taskQueue,args:[{binding}],workflowIdReusePolicy:WorkflowIdReusePolicy.REJECT_DUPLICATE,workflowIdConflictPolicy:WorkflowIdConflictPolicy.USE_EXISTING});signal?.throwIfAborted();
  },
  async cancel({binding,signal}){validateShape('RunBinding',binding);signal?.throwIfAborted();await client.workflow.getHandle(workflowId(binding)).cancel();signal?.throwIfAborted();}
 };
 if(!lifecycle)return Object.freeze(basic);
 return Object.freeze({...basic,
  async signal({binding,command,signal}){
   validateShape('RunBinding',binding);const c=assertWorkerControl(command);if(!same(c.binding,binding))fail('TEMPORAL_CONTROL_REFUSED');signal?.throwIfAborted();
   await client.workflow.getHandle(workflowId(binding)).signal('meriControlsAvailable',{controlId:c.controlId});signal?.throwIfAborted();
  },
  async continued({binding,input,signal}){
   validateShape('RunBinding',binding);own(input,['controlId','sourceRunId','targetRunId','admissionReceiptId','retirementReceiptId']);Object.values(input).forEach(uuid);
   if(input.sourceRunId!==binding.runId||input.targetRunId===binding.runId)fail('TEMPORAL_CONTROL_REFUSED');signal?.throwIfAborted();
   await client.workflow.getHandle(workflowId(binding)).signal('meriLifecycleContinued',input);signal?.throwIfAborted();
  }
 });
}
