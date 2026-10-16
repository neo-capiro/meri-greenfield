import {parseBytes} from '../document-application/boundary.mjs';
import {validateAllocatedResponse,validateError} from './generated-validator.mjs';
import {admitInitialInputResponse,fail} from './semantics.mjs';
import {conversationInitialInputMetadata} from './protocol.mjs';
export {conversationInitialInputMetadata,conversationInitialInputVersion,conversationInitialInputPath} from './protocol.mjs';
export {receiveConversationInitialInputRequest,receiveAllocatedConversationInputResponse,ConversationInitialInputResponseError} from './semantics.mjs';
export async function receiveConversationInitialInputResponse(status,utf8Bytes,request,expectedContext){
 let receipt;try{receipt=parseBytes(utf8Bytes,conversationInitialInputMetadata.limits.responseBytes);}catch(error){fail(error.code??'INVALID_BYTES');}
 if(!(status===200?validateAllocatedResponse:validateError)(receipt))fail('INVALID_INITIAL_INPUT_RESPONSE');
 return admitInitialInputResponse(status,receipt,request,expectedContext);
}
