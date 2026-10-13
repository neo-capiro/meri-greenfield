// Product Temporal workflow: deterministic durable dispatch, never a model/tool loop.
import {proxyActivities} from '@temporalio/workflow';
interface Binding {tenantId:string;actorId:string;conversationId:string;runId:string;attemptId:string;workerId:string;writerFence:number}
interface ConversationActivities {executeConversation(input:{binding:Binding}):Promise<{state:'completed'|'failed'|'cancelled'}>}
const {executeConversation}=proxyActivities<ConversationActivities>({startToCloseTimeout:'30 minutes',heartbeatTimeout:'30 seconds',retry:{maximumAttempts:1}});
export async function meriConversationWorkflow(input:{binding:Binding}):Promise<{state:'completed'|'failed'|'cancelled'}>{return executeConversation(input);}
