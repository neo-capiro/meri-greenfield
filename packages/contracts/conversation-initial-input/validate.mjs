/** Internal server assertion. The service remains the owner of current authorization and the fixed original deadline. */
import {data} from '../commands-0.2/execution-boundary.mjs';
import {receiveConversationInputRequest} from '../dist/conversation-input.mjs';
import {assertInitialInputShape} from './shape.mjs';import {correlateInitialInputReceipt} from './semantics.mjs';
export {assertInitialInputShape};
export async function assertConversationInitialInputReceipt(raw,input,{now=Date.now}={}){
 const receipt=data(raw),request=receiveConversationInputRequest(new TextEncoder().encode(JSON.stringify(data(input))));
 assertInitialInputShape('ConversationInitialInputAllocatedResponse',receipt);await correlateInitialInputReceipt(receipt,request,{now});return receipt;
}
