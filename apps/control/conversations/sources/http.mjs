/** Source content is released through the same currentness/retention fence as history. */
import {createProductApplication,PRODUCT_ERROR_STATUSES} from '../../product-access/http.mjs';
import {ProductError,asProductError} from '../../product-access/errors.mjs';
import {assertSourceReadRequest,assertSourceReadResponse} from '../../../../packages/contracts/conversation-sources/validate.mjs';
import {BILL_TEXT_SOURCE_PATH,BILL_TEXT_SOURCE_READ_SCHEMA,billTextSourceErrors,billTextSourceMetadata} from '../../../../packages/contracts/conversation-sources/protocol.mjs';
export function createBillTextSourceApplication({store,history,gate,currentness,management,reader,retention,now,limits}){
 if(typeof store?.history?.source!=='function'||typeof history?.recheckRelease!=='function'||typeof currentness?.assertCurrent!=='function'||typeof reader?.forRequest!=='function')throw new ProductError('PRODUCT_CONFIGURATION');
 const parse=body=>{try{return assertSourceReadRequest(body);}catch{throw new ProductError('SOURCE_REQUEST_INVALID');}};
 const errors=Object.fromEntries(Object.entries(billTextSourceErrors).filter(([code])=>!Object.hasOwn(PRODUCT_ERROR_STATUSES,code)).map(([code,statuses])=>[code,statuses[0]]));
 return createProductApplication({gate,now,conversationCurrentness:currentness,conversationManagement:management,conversationSourceReader:reader,
  limits:{...limits,maxRequestBytes:Math.min(limits.maxRequestBytes,billTextSourceMetadata.requestBytes),maxResponseBytes:Math.min(limits.maxResponseBytes,billTextSourceMetadata.responseBytes)},
  routes:{[BILL_TEXT_SOURCE_PATH]:{errors,async handle({body,principal,signal,recheckConversation,sourceReader}){
   const request=parse(body),check=()=>signal?.throwIfAborted();
   try{const saved=await store.history.source({principal,...request},check);check();
    if(retention)await retention.assertServable({tenantId:principal.tenantId,kind:'conversation',subjectId:request.conversationId});
    await recheckConversation(saved.conversation);check();
    const current=await sourceReader.read(saved.event);check();
    const response=assertSourceReadResponse({schemaVersion:BILL_TEXT_SOURCE_READ_SCHEMA,event:saved.event,current},request);
    return {conversation:saved.conversation,response};
   }catch(error){throw asProductError(error,'SOURCE_REFERENCE_UNAVAILABLE');}
  },release({body,result,publish,...call}){return history.recheckRelease({...call,request:parse(body),result,operation:'sourceRead',publish:value=>publish(value.response)});}}}});
}
