import {parseBytes} from '../document-application/boundary.mjs';
import {validateExpected} from '../session-receipt/generated-validator.mjs';
import {validSessionReceipt} from '../session-receipt/validate.mjs';
export const conversationSessionVersion='1.1.0';
export const conversationSessionMetadata=Object.freeze({packageVersion:'0.1.43',sessionVersion:conversationSessionVersion,responseBytes:4096,scopeSource:'Core explicit immutable capture; Research is disjoint from General and null grants neither',authority:'validation grants no authority'});
export class ConversationSessionResponseError extends Error{constructor(){super('CONVERSATION_SESSION_REFUSED');this.name='ConversationSessionResponseError';this.code='CONVERSATION_SESSION_REFUSED';}}
const refuse=()=>{throw new ConversationSessionResponseError();};
/** Admit independent selection bytes before dispatch; this supplies no current authority. */
export function receiveConversationSessionExpectedContext(utf8Bytes){try{
 const expected=parseBytes(utf8Bytes,4096);if(!validateExpected(expected))refuse();
 if(expected.scopeKind!=='research_portfolio')parseBytes(utf8Bytes,2048);
 return expected;
 }catch{refuse();}}
/** Expected bytes come from the caller's independently admitted bootstrap selection. Require an explicit kind;
 * a legacy nullable client, absent kind, or v1 bootstrap object cannot silently opt into General. */
export function receiveConversationSessionReceipt(utf8Bytes,expectedContextBytes,at){try{
 const receipt=parseBytes(utf8Bytes,4096),expected=receiveConversationSessionExpectedContext(expectedContextBytes);
 if(!validSessionReceipt(receipt,at,{general:true,research:true}))refuse();
 const research=expected.scopeKind==='research_portfolio';
 if(research!==(receipt.context.scopeKind==='research_portfolio'))refuse();
 if(research){if(Object.keys(expected.scope).some(key=>expected.scope[key]!==receipt.context.scope[key]))refuse();}
 const keys=['tenantId','actorId','conversationId','runId','selectedClientId'],rebind=receipt.initialRunRebind;
 if(rebind){
  // The authenticated response binds this exact requested source to this exact admitted target.
  // No missing source selector, other principal/scope, or ordinary mismatch can use this exception.
  if(keys.some(key=>!Object.hasOwn(expected,key))
   ||keys.filter(key=>key!=='runId').some(key=>expected[key]!==receipt.context[key])
   ||expected.runId!==rebind.sourceRunId||receipt.context.runId!==rebind.targetRunId
   ||rebind.sourceRunId===rebind.targetRunId)refuse();
 }else for(const key of keys)if(Object.hasOwn(expected,key)&&receipt.context[key]!==expected[key])refuse();
 return receipt;
 }catch{refuse();}}
