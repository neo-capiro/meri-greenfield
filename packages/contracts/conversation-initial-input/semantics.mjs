/** Allocation-specific facts and private provenance. The accepted input module alone owns genuine input requests/receipts/views. */
import canonicalize from 'canonicalize';
import {digest} from '../document-application/boundary.mjs';
import {receiveConversationInputRequest,receiveConversationInputResponse} from '../dist/conversation-input.mjs';
import {initialInputErrorStatuses,initialInputUnknownCodes} from './protocol.mjs';
export class ConversationInitialInputResponseError extends Error{constructor(code){super(code);this.name='ConversationInitialInputResponseError';this.code=code;}}
export const fail=code=>{throw new ConversationInitialInputResponseError(code);};
const requests=new WeakMap(),proofs=new WeakMap(),bytes=value=>new TextEncoder().encode(value);
const same=(left,right)=>canonicalize(left)===canonicalize(right);
const contextKeys=['tenantId','actorId','conversationId','runId','clientId'],uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
async function hash(value){const encoded=canonicalize(value);if(typeof encoded!=='string')fail('INVALID_CANONICAL_INPUT');return digest(bytes(encoded));}
/** Snapshot the independent authenticated context without executing accessors or accepting receipt-authored fields. */
export function initialInputContext(value){
 try{
  if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))fail('INITIAL_INPUT_CONTEXT_INVALID');
  const descriptors=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(descriptors),context={};
  if(keys.length!==contextKeys.length||keys.some(key=>typeof key!=='string'||!contextKeys.includes(key)))fail('INITIAL_INPUT_CONTEXT_INVALID');
  for(const key of contextKeys){const d=descriptors[key];if(!d||!d.enumerable||!Object.hasOwn(d,'value')||typeof d.value!=='string')fail('INITIAL_INPUT_CONTEXT_INVALID');context[key]=d.value;}
  if(['tenantId','actorId'].some(key=>!context[key]||context[key].length>128)||['conversationId','runId','clientId'].some(key=>!uuid.test(context[key])))fail('INITIAL_INPUT_CONTEXT_INVALID');
  return Object.freeze(context);
 }catch(error){if(error instanceof ConversationInitialInputResponseError)throw error;fail('INITIAL_INPUT_CONTEXT_INVALID');}
}
function active(allocation,now){const at=now();if(!Number.isSafeInteger(at)||at<allocation.allocatedAtMs||at>=allocation.expiresAtMs)fail('INITIAL_INPUT_EXPIRED');}
function facts(allocation){
 const {binding,scopes,selectedClientId,allocatedAtMs,expiresAtMs}=allocation;
 if(binding.writerFence!==1||!Number.isSafeInteger(allocatedAtMs)||allocatedAtMs<0||!Number.isSafeInteger(expiresAtMs)||expiresAtMs<=allocatedAtMs||
  scopes.some(scope=>scope.tenantId!==binding.tenantId||scope.policyRevision!==scopes[0].policyRevision)||new Set(scopes.map(scope=>canonicalize(scope))).size!==scopes.length||!scopes.some(scope=>scope.kind==='client'&&scope.resourceId===selectedClientId))fail('INITIAL_INPUT_FACTS_MISMATCH');
}
function contextMatches(allocation,context){const binding=allocation.binding;if(['tenantId','actorId','conversationId','runId'].some(key=>binding[key]!==context[key])||allocation.selectedClientId!==context.clientId)fail('INITIAL_INPUT_CONTEXT_MISMATCH');}
/** Shape validation precedes this kernel. It checks immutable input/facts but does not mint public proof or authority. */
export async function correlateInitialInputReceipt(receipt,request,{now=Date.now}={}){
 const allocation=receipt.allocation;facts(allocation);if(receipt.created&&receipt.state!=='RESERVED')fail('INITIAL_INPUT_STATE_MISMATCH');
 if(allocation.requestId!==request.requestId||allocation.inputSha256!==await hash(request))fail('INITIAL_INPUT_REQUEST_MISMATCH');active(allocation,now);return receipt;
}
export function receiveConversationInitialInputRequest(utf8Bytes){const request=receiveConversationInputRequest(utf8Bytes);requests.set(request,{allocation:null,state:null,context:null});return request;}
/** Parsed immutable response + validated shape only. Shared by the byte receiver and focused Node source controls. */
export async function admitInitialInputResponse(status,receipt,request,expectedContext,{now=Date.now}={}){
 const record=requests.get(request);if(!record)fail('UNADMITTED_INITIAL_INPUT_REQUEST');
 const context=initialInputContext(expectedContext);if(record.context&&!same(record.context,context))fail('INITIAL_INPUT_CONTEXT_MISMATCH');
 if(!Number.isInteger(status)||status<100||status>599)fail('INVALID_STATUS');
 if(status!==200){const {code,outcome}=receipt.error;if(!Object.hasOwn(initialInputErrorStatuses,code)||!initialInputErrorStatuses[code].includes(status)||outcome==='UNKNOWN'&&!initialInputUnknownCodes.includes(code))fail('INVALID_INITIAL_INPUT_ERROR');return receipt;}
 await correlateInitialInputReceipt(receipt,request,{now});contextMatches(receipt.allocation,context);
 // Re-check after the asynchronous hash: the first immutable facts win even when duplicate responses resolve concurrently.
 if(record.context&&!same(record.context,context)||record.allocation&&!same(record.allocation,receipt.allocation))fail('INITIAL_INPUT_RECEIPT_DRIFT');
 if(record.allocation&&(receipt.created||record.state==='ACCEPTED'&&receipt.state!=='ACCEPTED'))fail('INITIAL_INPUT_STATE_MISMATCH');
 active(receipt.allocation,now);record.allocation??=receipt.allocation;record.context??=context;record.state=receipt.state;
 proofs.set(receipt,{request,context,allocation:record.allocation});return receipt;
}
/** Allocation errors are handled above. These bytes belong exclusively to the accepted input/admit receiver and its 2 MiB cap. */
export async function receiveAllocatedConversationInputResponse(status,utf8Bytes,request,expectedContext,allocationReceipt){
 const proof=proofs.get(allocationReceipt),record=requests.get(request),context=initialInputContext(expectedContext);
 if(!proof||!record||proof.request!==request||!same(proof.context,context)||!same(record.allocation,proof.allocation))fail('UNADMITTED_INITIAL_INPUT_PROOF');
 active(proof.allocation,Date.now);
 const receipt=await receiveConversationInputResponse(status,utf8Bytes,request,expectedContext);
 if(Object.hasOwn(receipt,'error'))return receipt;
 const allocation=proof.allocation;
 if(!same(receipt.run.binding,allocation.binding)||!same(receipt.run.scopes,allocation.scopes)||!same(receipt.run.versions,allocation.versions)||receipt.request.requestId!==allocation.requestId||await hash(receipt.request)!==allocation.requestSha256)fail('INITIAL_INPUT_ADMISSION_MISMATCH');
 active(allocation,Date.now);return receipt;
}
