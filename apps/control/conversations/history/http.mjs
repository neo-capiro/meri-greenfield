/** Local L3 proposal mounted through the existing bounded membership/effect HTTP owner. No new auth or streaming loop. */
import {createProductApplication} from '../../product-access/http.mjs';
import {HISTORY_PATHS,listRequest,transcriptRequest,turnRequest} from './protocol.mjs';
import {conversationHistoryMetadata,historyDomainErrorStatuses} from '../../../../packages/contracts/conversation-history/protocol.mjs';
export const HISTORY_ERRORS=historyDomainErrorStatuses;
export function createConversationHistoryApplication({service,gate,now,limits}){
 const route=(method,parse,effect=false)=>({errors:HISTORY_ERRORS,effect,handle:({principal,body,signal,deadlineMs,recheckMembership})=>service[method]({principal,request:parse(body),signal,deadlineMs,recheckMembership})});
 const boundedLimits={...limits,maxRequestBytes:Math.min(limits?.maxRequestBytes,conversationHistoryMetadata.limits.requestBytes),maxResponseBytes:Math.min(limits?.maxResponseBytes,conversationHistoryMetadata.limits.responseBytes)};
 return createProductApplication({gate,now,limits:boundedLimits,routes:{[HISTORY_PATHS.list]:route('list',listRequest),[HISTORY_PATHS.transcript]:route('transcript',transcriptRequest),[HISTORY_PATHS.nextTurn]:route('nextTurn',turnRequest,true)}});
}
