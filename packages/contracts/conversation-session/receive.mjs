import {parseBytes} from '../document-application/boundary.mjs';
import {validateReceipt,validateExpected} from './generated-validator.mjs';
export const conversationSessionVersion='1.0.0';
export const conversationSessionMetadata=Object.freeze({packageVersion:'0.1.11',sessionVersion:conversationSessionVersion,responseBytes:4096,scopeSource:'Core explicit immutable bootstrap receipt; null alone is not General eligibility',authority:'validation grants no authority'});
export class ConversationSessionResponseError extends Error{constructor(){super('CONVERSATION_SESSION_REFUSED');this.name='ConversationSessionResponseError';this.code='CONVERSATION_SESSION_REFUSED';}}
const refuse=()=>{throw new ConversationSessionResponseError();};
/** Expected bytes come from the caller's independently admitted bootstrap selection. Require an explicit kind;
 * a legacy nullable client, absent kind, or v1 bootstrap object cannot silently opt into General. */
export function receiveConversationSessionReceipt(utf8Bytes,expectedContextBytes,at){try{
 const receipt=parseBytes(utf8Bytes,4096),expected=parseBytes(expectedContextBytes,2048);
 if(!validateReceipt(receipt)||!validateExpected(expected)||!Number.isSafeInteger(at)||at<0||receipt.expiresAtMs<=at)refuse();
 for(const key of ['tenantId','actorId','conversationId','runId','selectedClientId'])if(Object.hasOwn(expected,key)&&receipt.context[key]!==expected[key])refuse();
 return receipt;
 }catch{refuse();}}
