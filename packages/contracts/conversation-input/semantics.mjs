/** Canonical submit/history receivers own immutable request, window, scope and view provenance checks. */
import {receiveConversationRequest,receiveConversationResponse,ConversationResponseError} from '../dist/conversation-application.mjs';
export {ConversationResponseError as ConversationInputResponseError};
export const fail=code=>{throw new ConversationResponseError(code);};
const bytes=value=>new TextEncoder().encode(JSON.stringify(value));
const contextKeys=['tenantId','actorId','conversationId','runId','clientId'];
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
/** The independent context is supplied by trusted application code, never read from the receipt or request body. */
export function expectedContext(value){
 try{
  if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))fail('INPUT_CONTEXT_INVALID');
  const descriptors=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(descriptors);
  if(keys.length!==contextKeys.length||keys.some(key=>typeof key!=='string'||!contextKeys.includes(key)))fail('INPUT_CONTEXT_INVALID');
  const context={};for(const key of contextKeys){const d=descriptors[key];if(!d||!Object.hasOwn(d,'value')||!d.enumerable||typeof d.value!=='string')fail('INPUT_CONTEXT_INVALID');context[key]=d.value;}
  if(['tenantId','actorId'].some(key=>!context[key]||context[key].length>128)||['conversationId','runId','clientId'].some(key=>!uuid.test(context[key])))fail('INPUT_CONTEXT_INVALID');
  return Object.freeze(context);
 }catch(error){if(error instanceof ConversationResponseError)throw error;fail('INPUT_CONTEXT_INVALID');}
}
export function assertInputContext(receipt,context){
 const b=receipt.run.binding;
 if(['tenantId','actorId','conversationId','runId'].some(key=>b[key]!==context[key])||!receipt.run.scopes.some(scope=>scope.kind==='client'&&scope.tenantId===context.tenantId&&scope.resourceId===context.clientId))fail('INPUT_CONTEXT_MISMATCH');
}
/** Returns a genuine old public history view; the tail is synthetic only for semantic validation, never persistence or absence evidence. */
export async function correlateInputReceipt(receipt,request,currentView){
 const submitted=await receiveConversationResponse('submit',200,bytes({run:receipt.run,requestId:receipt.request.requestId,lastSequence:receipt.lastSequence,replayed:receipt.replayed}),request,currentView);
 const cursor=receiveConversationRequest('history',bytes({after:receipt.lastSequence,limit:1}));
 return receiveConversationResponse('history',200,bytes({run:receipt.run,request:receipt.request,events:[],nextSequence:receipt.lastSequence,lastSequence:receipt.lastSequence,hasMore:false}),cursor,submitted);
}
