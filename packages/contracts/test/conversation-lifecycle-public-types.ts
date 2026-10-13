import {receiveConversationLifecycleRequest,receiveConversationLifecycleResponse,conversationLifecycleMetadata,type ConversationLifecycleControlRequest,type ConversationCheckpointInspectionReceipt} from '@capiro/meri-contracts/conversation-lifecycle';
import type {AdmittedConversationView} from '@capiro/meri-contracts/conversation-application';
declare const view:AdmittedConversationView;
const bytes=new TextEncoder().encode('{"checkpointId":"00000000-0000-4000-8000-000000000001"}');
const request=receiveConversationLifecycleRequest('inspect',bytes);
const reply=await receiveConversationLifecycleResponse('inspect',200,bytes,request,view);
if(!('error'in reply)){const hash:string=reply.checkpointSha256;const receipt:ConversationCheckpointInspectionReceipt=reply;void [hash,receipt];}
const control:ConversationLifecycleControlRequest={controlId:'00000000-0000-4000-8000-000000000001',intent:'pause'};void [control,conversationLifecycleMetadata.routes.inspect.path];
// @ts-expect-error lifecycle commands have closed, deliberate intents
const bad:ConversationLifecycleControlRequest={controlId:'id',intent:'approve',approved:true};void bad;
// @ts-expect-error raw view shape has no original public admission provenance
await receiveConversationLifecycleResponse('inspect',200,bytes,request,{});
