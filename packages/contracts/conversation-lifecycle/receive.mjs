import canonicalize from 'canonicalize';
import {parseBytes,digest} from '../document-application/boundary.mjs';
import {createConversationCursor} from '../dist/conversation-application.mjs';
import {validateControlRequest,validateControlReceipt,validateInspectionRequest,validateInspectionReceipt,validateError} from './generated-validator.mjs';
import {conversationLifecycleMetadata,lifecycleErrorStatuses} from './protocol.mjs';
export {conversationLifecycleMetadata} from './protocol.mjs';
export class ConversationLifecycleResponseError extends Error{constructor(code){super(code);this.name='ConversationLifecycleResponseError';this.code=code;}}
const fail=code=>{throw new ConversationLifecycleResponseError(code);},same=(a,b)=>canonicalize(a)===canonicalize(b),requests=new WeakMap();
const validators={control:validateControlRequest,inspect:validateInspectionRequest};
function routeValidator(route){if(typeof route!=='string'||!Object.hasOwn(validators,route))fail('INVALID_ROUTE');return validators[route];}
const parse=(bytes,cap)=>{try{return parseBytes(bytes,cap);}catch(e){fail(e.code??'INVALID_BYTES');}};
export function receiveConversationLifecycleRequest(route,bytes){const request=parse(bytes,conversationLifecycleMetadata.limits.requestBytes);if(!routeValidator(route)(request))fail('INVALID_REQUEST');requests.set(request,route);return request;}
export async function receiveConversationLifecycleResponse(route,httpStatus,bytes,request,currentView){
 routeValidator(route);if(requests.get(request)!==route)fail('UNADMITTED_REQUEST');
 try{createConversationCursor(currentView);}catch{fail('UNADMITTED_VIEW');}
 if(!Number.isInteger(httpStatus)||httpStatus<100||httpStatus>599)fail('INVALID_STATUS');const result=parse(bytes,conversationLifecycleMetadata.limits.responseBytes);
 if(httpStatus!==200){if(!validateError(result)||!lifecycleErrorStatuses[result.error.code].includes(httpStatus)||result.error.outcome!==(httpStatus===502?'UNKNOWN':'NOT_DISPATCHED'))fail('INVALID_ERROR_RESPONSE');return result;}
 if(!(route==='control'?validateControlReceipt:validateInspectionReceipt)(result))fail('INVALID_RESPONSE');
 if(!same(result.sourceBinding,currentView.run.binding))fail('VIEW_MISMATCH');
 if(route==='inspect'){if(result.checkpointId!==request.checkpointId||result.lastEventSequence>currentView.lastSequence)fail('CHECKPOINT_MISMATCH');return result;}
 if(result.controlId!==request.controlId||result.intent!==request.intent||result.inputSha256!==await digest(new TextEncoder().encode(canonicalize(request))))fail('REQUEST_MISMATCH');
 if(['resume','fork'].includes(request.intent)&&result.checkpointId!==null&&result.checkpointId!==request.checkpointId)fail('CHECKPOINT_MISMATCH');
 const source=result.sourceBinding,target=result.targetBinding;
 if(target!==null){if(!['resume','fork'].includes(request.intent)||target.tenantId!==source.tenantId||target.actorId!==source.actorId||['runId','attemptId','workerId'].some(k=>target[k]===source[k])||result.admissionReceiptId===null)fail('TARGET_MISMATCH');
  if(request.intent==='resume'&&(target.conversationId!==source.conversationId||target.writerFence<=source.writerFence||result.retirementReceiptId===null)||request.intent==='fork'&&(target.conversationId===source.conversationId||result.retirementReceiptId!==null))fail('TARGET_MISMATCH');
 }
 if(['resume','fork'].includes(request.intent)&&result.state==='APPLIED'&&(target===null||result.checkpointId===null||result.admissionReceiptId===null||request.intent==='resume'&&result.retirementReceiptId===null))fail('TARGET_MISMATCH');
 if(!['resume','fork'].includes(request.intent)&&(target!==null||result.admissionReceiptId!==null||result.retirementReceiptId!==null))fail('TARGET_MISMATCH');
 return result;
}
