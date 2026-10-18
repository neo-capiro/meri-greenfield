// Product Temporal workflow: deterministic durable dispatch, never a model/tool loop.
import {proxyActivities} from '@temporalio/workflow';
import {reconcileAfterFailure} from './recovery-workflow.ts';
interface Binding {tenantId:string;actorId:string;conversationId:string;runId:string;attemptId:string;workerId:string;writerFence:number}
interface ConversationActivities {executeConversation(input:{binding:Binding}):Promise<{state:'completed'|'failed'|'cancelled'}>}
const {executeConversation}=proxyActivities<ConversationActivities>({startToCloseTimeout:'30 minutes',heartbeatTimeout:'30 seconds',retry:{maximumAttempts:1}});
export async function meriConversationWorkflow(input:{binding:Binding}):Promise<{state:'completed'|'failed'|'cancelled'}>{return reconcileAfterFailure(input,()=>executeConversation(input));}

// Separate opt-in definition preserves legacy in-flight workflow history.
export {meriConversationLifecycleWorkflow} from './lifecycle/workflow.ts';

// Separate opt-in server-owned Objective generation lifecycle (lane 7); activities are composed only with genuine ports.
export {meriObjectiveGenerationWorkflow} from './objective-generation-workflow.ts';
