/** Local L3 proposal mounted through the existing bounded membership/effect HTTP owner. No new auth or streaming loop. */
import {createProductApplication} from '../../product-access/http.mjs';
import {ProductError} from '../../product-access/errors.mjs';
import {HISTORY_PATHS,listRequest,transcriptRequest,turnRequest,summariesRequest,manageRequest} from './protocol.mjs';
import {conversationHistoryMetadata,historyDomainErrorStatuses} from '../../../../packages/contracts/conversation-history/protocol.mjs';
export const HISTORY_ERRORS=historyDomainErrorStatuses;
export function createConversationHistoryApplication({service,gate,now,limits,currentness,management}){
 if(typeof currentness?.assertCurrent!=='function')throw new ProductError('PRODUCT_CONFIGURATION');
 const route=(method,parse,effect=false)=>({errors:HISTORY_ERRORS,effect,
  handle:({body,...call})=>service[method]({...call,request:parse(body)}),
  ...(typeof service.recheckRelease==='function'?{release:({body,...call})=>service.recheckRelease({...call,request:parse(body),operation:method})}:{})});
 const boundedLimits={...limits,maxRequestBytes:Math.min(limits?.maxRequestBytes,conversationHistoryMetadata.limits.requestBytes),maxResponseBytes:Math.min(limits?.maxResponseBytes,conversationHistoryMetadata.limits.responseBytes)};
 return createProductApplication({gate,now,limits:boundedLimits,conversationCurrentness:currentness,conversationManagement:management,routes:{[HISTORY_PATHS.list]:route('list',listRequest),[HISTORY_PATHS.transcript]:route('transcript',transcriptRequest),[HISTORY_PATHS.nextTurn]:route('nextTurn',turnRequest,true),[HISTORY_PATHS.summaries]:route('summaries',summariesRequest),[HISTORY_PATHS.manage]:route('manage',manageRequest,true)}});
}
