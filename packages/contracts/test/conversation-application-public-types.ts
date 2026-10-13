import {receiveConversationRequest,receiveConversationResponse,createConversationCursor,receiveConversationEvent,conversationReconnect,type ConversationSubmitRequest,type ConversationEventsRequest,type ConversationCursor} from '@capiro/meri-contracts/conversation-application';
const dto:ConversationSubmitRequest={requestId:'00000000-0000-4000-8000-000000000001',prompt:'Hello',windowRequest:{basis:'unbounded'}};
const request=receiveConversationRequest('submit',new TextEncoder().encode(JSON.stringify(dto)));
const response=await receiveConversationResponse('submit',200,new Uint8Array(),request);
if(!('error' in response)){let cursor:ConversationCursor=createConversationCursor(response,0);cursor=receiveConversationEvent(new Uint8Array(),cursor).cursor;const reconnect=conversationReconnect(cursor);const method:'GET'=reconnect.method;void method;}
// @ts-expect-error shape-only views do not bypass response admission
createConversationCursor({run:{},lastSequence:1});
// @ts-expect-error a raw sequence is not a provenance-bound cursor
conversationReconnect({conversationId:'x',after:0});
// @ts-expect-error current authority is outside the public submit DTO
const bad:ConversationSubmitRequest={...dto,tenantId:'other'};
// @ts-expect-error cursor fields do not coexist with the public subscribe command
const conflicting:ConversationEventsRequest={command:{conversationId:'x',intent:'view.subscribe'},after:1};
void bad;void conflicting;
