import {receiveConversationInitialInputRequest,receiveConversationInitialInputResponse,receiveAllocatedConversationInputResponse,conversationInitialInputMetadata,type ConversationInitialInputExpectedContext,type ConversationInitialInputAllocatedResponse,type ConversationInitialInputErrorResponse,type AdmittedConversationInitialInputReceipt} from '@capiro/meri-contracts/conversation-initial-input';
import {type AdmittedConversationInputRequest,type AdmittedConversationInputReceipt,type ConversationInputErrorResponse} from '@capiro/meri-contracts/conversation-input';
const bytes=new TextEncoder().encode('{}'),request=receiveConversationInitialInputRequest(bytes),inputRequest:AdmittedConversationInputRequest=request;void inputRequest;
const expected:ConversationInitialInputExpectedContext={tenantId:'tenant',actorId:'actor',conversationId:'id',runId:'id',clientId:'id'};
const result=await receiveConversationInitialInputResponse(200,bytes,request,expected);
const responseContract:ConversationInitialInputAllocatedResponse|ConversationInitialInputErrorResponse=result;void responseContract;
const limit:number=conversationInitialInputMetadata.limits.maxRequestMs,path:'/api/conversations/input/allocate'=conversationInitialInputMetadata.routes.allocate.path;void limit;void path;
if(!('error'in result)){const proof:AdmittedConversationInitialInputReceipt=result,state:'RESERVED'|'ACCEPTED'=proof.state,fence:number=proof.allocation.binding.writerFence;void state;void fence;
 const admitted:AdmittedConversationInputReceipt|ConversationInputErrorResponse=await receiveAllocatedConversationInputResponse(200,bytes,request,expected,proof);void admitted;}
// @ts-expect-error independently authenticated context is mandatory
await receiveConversationInitialInputResponse(200,bytes,request);
// @ts-expect-error shape-only requests do not carry canonical byte-admission provenance
await receiveConversationInitialInputResponse(200,bytes,{requestId:'id',prompt:'Hello'},expected);
// @ts-expect-error a plain allocation object is not an admitted allocation proof
await receiveAllocatedConversationInputResponse(200,bytes,request,expected,{allocation:{},state:'RESERVED',created:true});
// @ts-expect-error allocation errors keep the closed initial-input code set
const invalidError:ConversationInitialInputErrorResponse={error:{code:'NOT_A_CODE',outcome:'NOT_DISPATCHED'}};void invalidError;
