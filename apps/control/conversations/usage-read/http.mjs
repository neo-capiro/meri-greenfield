/** Authenticated read over the accounting owner, released by the existing history serving fence. */
import {createProductApplication,PRODUCT_ERROR_STATUSES} from '../../product-access/http.mjs';
import {ProductError,asProductError} from '../../product-access/errors.mjs';
import {assertConversationUsageRequest} from '../../../../packages/contracts/conversation-usage/validate.mjs';
import {CONVERSATION_USAGE_PATH,conversationUsageErrors,conversationUsageMetadata} from '../../../../packages/contracts/conversation-usage/protocol.mjs';
import {projectRecordedUsage} from './projection.mjs';
export function createConversationUsageApplication({store,history,gate,currentness,management,retention,now,limits}){
 if(typeof store?.history?.usageContext!=='function'||typeof store?.readUsage!=='function'||typeof history?.recheckRelease!=='function'||typeof currentness?.assertCurrent!=='function')throw new ProductError('PRODUCT_CONFIGURATION');
 const parse=body=>{try{return assertConversationUsageRequest(body);}catch{throw new ProductError('USAGE_REQUEST_INVALID');}};
 const errors=Object.fromEntries(Object.entries(conversationUsageErrors).filter(([code])=>!Object.hasOwn(PRODUCT_ERROR_STATUSES,code)).map(([code,statuses])=>[code,statuses[0]]));
 return createProductApplication({gate,now,conversationCurrentness:currentness,conversationManagement:management,
  limits:{...limits,maxRequestBytes:Math.min(limits.maxRequestBytes,conversationUsageMetadata.requestBytes),maxResponseBytes:Math.min(limits.maxResponseBytes,conversationUsageMetadata.responseBytes)},
  routes:{[CONVERSATION_USAGE_PATH]:{errors,async handle({body,principal,signal,recheckConversation}){
   const request=parse(body),check=()=>signal?.throwIfAborted();
   try{
    const saved=await store.history.usageContext({principal,...request},check);check();
    if(retention)await retention.assertServable({tenantId:principal.tenantId,kind:'conversation',subjectId:request.conversationId});
    await recheckConversation(saved.conversation);check();
    const recorded=await store.readUsage(saved.binding,check);check();
    return {conversation:saved.conversation,response:projectRecordedUsage(recorded,request)};
   }catch(error){throw asProductError(error,'USAGE_UNAVAILABLE');}
  },release({body,result,publish,...call}){
   return history.recheckRelease({...call,request:parse(body),result,operation:'usageRead',publish:value=>publish(value.response)});
  }}}});
}
