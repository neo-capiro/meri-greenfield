/** Internal server validation only. Current authorization and original effect deadline remain with the conversation service. */
import {data} from '../commands-0.2/execution-boundary.mjs';
import {receiveConversationRequest} from '../dist/conversation-application.mjs';
import {assertInputShape} from './shape.mjs';import {correlateInputReceipt} from './semantics.mjs';
export {assertInputShape};
export async function assertConversationInputReceipt(raw,input){
 const receipt=data(raw),request=receiveConversationRequest('submit',new TextEncoder().encode(JSON.stringify(data(input))));
 assertInputShape('ConversationInputAdmittedResponse',receipt);await correlateInputReceipt(receipt,request);return receipt;
}
