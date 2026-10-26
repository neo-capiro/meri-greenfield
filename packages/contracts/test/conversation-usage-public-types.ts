import {receiveConversationUsageRequest,receiveConversationUsageResponse,conversationUsageMetadata,type ConversationUsageRequest,type ConversationUsageResponse} from '@capiro/meri-contracts/conversation-usage';
const bytes=new Uint8Array(),request=receiveConversationUsageRequest(bytes);
const input:ConversationUsageRequest=request;
const value=receiveConversationUsageResponse(200,bytes,request);
if(!('error' in value)){
 const response:ConversationUsageResponse=value;
 const currency:'USD'|undefined=response.usage?.currency;
 const billed:null|undefined=response.usage?.providerBilledUsd;
 const duration:number|null|undefined=response.toolAudit?.tools[0]?.durationMs;
 void currency;void billed;void duration;
 // @ts-expect-error No private SDK session identity is public.
 void response.usage?.cumulative?.sessionId;
 // @ts-expect-error Native audit cannot be joined to a UI tool call or source reference.
 void response.toolAudit?.tools[0]?.requestId;
}
// @ts-expect-error Plain caller objects are not admitted requests.
void receiveConversationUsageResponse(200,bytes,input);
const unit:'USD'=conversationUsageMetadata.currency;void unit;
