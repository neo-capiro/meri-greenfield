/** Local L3 proposal mounted through the existing bounded membership/effect HTTP owner. No new auth or streaming loop. */
import {createProductApplication} from '../../product-access/http.mjs';
import {ProductError} from '../../product-access/errors.mjs';
import {HISTORY_PATHS,exportRequest,listRequest,transcriptRequest,turnRequest,summariesRequest,manageRequest} from './protocol.mjs';
import {conversationHistoryMetadata,historyDomainErrorStatuses} from '../../../../packages/contracts/conversation-history/protocol.mjs';
export const HISTORY_ERRORS=historyDomainErrorStatuses;
export function createConversationHistoryApplication({service,gate,now,limits,currentness,turnCurrentness=currentness,management}){
 if(typeof currentness?.assertCurrent!=='function'||typeof turnCurrentness?.assertCurrent!=='function')throw new ProductError('PRODUCT_CONFIGURATION');
 const route=(method,parse,effect=false)=>({errors:HISTORY_ERRORS,effect,
  handle:({body,...call})=>service[method]({...call,request:parse(body)}),
  ...(typeof service.recheckRelease==='function'?{release:({body,...call})=>service.recheckRelease({...call,request:parse(body),operation:method})}:{})});
 const boundedLimits={...limits,maxRequestBytes:Math.min(limits?.maxRequestBytes,conversationHistoryMetadata.limits.requestBytes),maxResponseBytes:Math.min(limits?.maxResponseBytes,conversationHistoryMetadata.limits.responseBytes)};
 const history=createProductApplication({gate,now,limits:boundedLimits,conversationCurrentness:currentness,conversationManagement:management,routes:{[HISTORY_PATHS.export]:route('export',exportRequest),[HISTORY_PATHS.list]:route('list',listRequest),[HISTORY_PATHS.transcript]:route('transcript',transcriptRequest),[HISTORY_PATHS.summaries]:route('summaries',summariesRequest),[HISTORY_PATHS.manage]:route('manage',manageRequest,true)}});
 // Read-only occurrence custody must never become the assertActive callback that authorizes a new ordinary turn.
 const turns=createProductApplication({gate,now,limits:boundedLimits,conversationCurrentness:turnCurrentness,conversationManagement:management,routes:{[HISTORY_PATHS.nextTurn]:route('nextTurn',turnRequest,true)}});
 return Object.freeze({paths:Object.freeze([...history.paths,...turns.paths]),handle(request){
  let nextTurn=false;try{nextTurn=new URL(request.url).pathname===HISTORY_PATHS.nextTurn;}catch{}
  return (nextTurn?turns:history).handle(request);
 }});
}
