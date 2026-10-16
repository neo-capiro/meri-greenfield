import {parseBytes} from '../document-application/boundary.mjs';
import {receiveConversationRequest,receiveConversationResponse} from '../dist/conversation-application.mjs';
import {validateAdmittedResponse} from './generated-validator.mjs';
import {expectedContext,assertInputContext,correlateInputReceipt,fail} from './semantics.mjs';
import {conversationInputMetadata} from './protocol.mjs';
export {conversationInputMetadata,conversationInputVersion,conversationInputPath} from './protocol.mjs';
export {ConversationInputResponseError} from './semantics.mjs';
const views=new WeakMap();
const parse=bytes=>{try{return parseBytes(bytes,conversationInputMetadata.limits.responseBytes);}catch(error){fail(error.code??'INVALID_BYTES');}};
export const receiveConversationInputRequest=utf8Bytes=>receiveConversationRequest('submit',utf8Bytes);
export async function receiveConversationInputResponse(httpStatus,utf8Bytes,request,context,currentView){
 const admittedContext=expectedContext(context),prior=views.get(currentView)??currentView;
 if(httpStatus!==200)return receiveConversationResponse('submit',httpStatus,utf8Bytes,request,prior);
 const receipt=parse(utf8Bytes);if(!validateAdmittedResponse(receipt))fail('INVALID_RESPONSE');
 const view=await correlateInputReceipt(receipt,request,prior);assertInputContext(receipt,admittedContext);views.set(receipt,view);return receipt;
}
/** Exposes only a genuine canonical receiver view, allowing ordinary submit/history to retain their existing provenance checks. */
export function conversationInputView(receipt){const view=views.get(receipt);if(!view)fail('UNADMITTED_VIEW');return view;}
