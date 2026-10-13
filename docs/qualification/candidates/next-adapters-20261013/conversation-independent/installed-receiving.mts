import {receiveConversationRequest,receiveConversationResponse,createConversationCursor,receiveConversationEvent,conversationReconnect,conversationApplicationMetadata} from '@capiro/meri-contracts/conversation-application';
import type {ConversationCursor,AdmittedConversationView} from '@capiro/meri-contracts/conversation-application';
const input=new TextEncoder().encode('{"requestId":"70000000-0000-4000-8000-000000000001","prompt":"Independent receiving"}');
const selected=receiveConversationRequest('submit',input);
const result=await receiveConversationResponse('submit',200,input,selected);
if('run' in result){
 const view:AdmittedConversationView=result;
 const cursor:ConversationCursor=createConversationCursor(view);
 const reconnect=conversationReconnect(cursor);
 const method:'GET'=reconnect.method;
 const header:string=reconnect.headers['x-meri-resume-sequence'];
 const received=receiveConversationEvent(input,cursor);
 const eventId:string=received.event.eventId;
 void [method,header,eventId];
}
const packageVersion:'0.1.3'=conversationApplicationMetadata.packageVersion;
const wireVersion:'0.1.0'=conversationApplicationMetadata.wireContractVersion;
// @ts-expect-error Unsupported public route must not compile.
receiveConversationRequest('admin',input);
// @ts-expect-error A locally constructed cursor lacks receiving provenance.
conversationReconnect({conversationId:'synthetic',after:0});
// @ts-expect-error An arbitrary view lacks receiving provenance.
createConversationCursor({run:{},requestId:'synthetic',lastSequence:0,replayed:false});
// @ts-expect-error Raw JSON cannot replace an admitted request.
receiveConversationResponse('submit',200,input,{requestId:'synthetic',prompt:'raw'});
void [packageVersion,wireVersion];
