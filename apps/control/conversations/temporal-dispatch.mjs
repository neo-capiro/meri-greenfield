/** Upstream Temporal client owns start/cancel and the workflow ID deduplication. */
import {WorkflowIdReusePolicy,WorkflowIdConflictPolicy} from '@temporalio/client';
import {validateShape,fail} from './boundary.mjs';
export const workflowId=b=>`meri:${b.tenantId}:${b.conversationId}:${b.runId}`;
export function createTemporalConversationDispatcher({client,taskQueue}){
 if(typeof client?.workflow?.start!=='function'||typeof client?.workflow?.getHandle!=='function'||typeof taskQueue!=='string'||!taskQueue||taskQueue.length>256)fail('TEMPORAL_CONFIGURATION');
 return Object.freeze({async start({binding,signal}){validateShape('RunBinding',binding);signal?.throwIfAborted();await client.workflow.start('meriConversationWorkflow',{workflowId:workflowId(binding),taskQueue,args:[{binding}],workflowIdReusePolicy:WorkflowIdReusePolicy.REJECT_DUPLICATE,workflowIdConflictPolicy:WorkflowIdConflictPolicy.USE_EXISTING});signal?.throwIfAborted();},async cancel({binding,signal}){validateShape('RunBinding',binding);signal?.throwIfAborted();await client.workflow.getHandle(workflowId(binding)).cancel();signal?.throwIfAborted();}});
}
