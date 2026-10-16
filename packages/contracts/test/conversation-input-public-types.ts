import {receiveConversationInputRequest,receiveConversationInputResponse,conversationInputView,type ConversationInputExpectedContext,type ConversationInputAdmittedResponse} from '@capiro/meri-contracts/conversation-input';
import {receiveConversationResponse,type AdmittedConversationRequest,type AdmittedConversationView,type ConversationSubmitRequest} from '@capiro/meri-contracts/conversation-application';
const bytes=new TextEncoder().encode('{}'),request=receiveConversationInputRequest(bytes),oldRequest:AdmittedConversationRequest<'submit'>=request;
const expected:ConversationInputExpectedContext={tenantId:'tenant',actorId:'actor',conversationId:'id',runId:'id',clientId:'id'};
const result=await receiveConversationInputResponse(200,bytes,request,expected);
if(!('error'in result)){const canonical:AdmittedConversationView=conversationInputView(result),body:ConversationInputAdmittedResponse=result,prompt:string=body.request.prompt;await receiveConversationResponse('submit',200,bytes,oldRequest,canonical);await receiveConversationInputResponse(200,bytes,request,expected,result);void prompt;}
const dto:ConversationSubmitRequest={requestId:'id',prompt:'Hello'};void dto;
// @ts-expect-error independently authenticated context is mandatory
await receiveConversationInputResponse(200,bytes,request);
// @ts-expect-error shape-only requests do not have canonical byte-admission provenance
await receiveConversationInputResponse(200,bytes,{requestId:'id',prompt:'Hello'},expected);
// @ts-expect-error shape-only receipts are not canonical admitted views
conversationInputView({run:{},request:{},lastSequence:1,replayed:false});
