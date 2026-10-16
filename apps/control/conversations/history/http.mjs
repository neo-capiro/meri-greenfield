/** Local L3 proposal mounted through the existing bounded membership/effect HTTP owner. No new auth or streaming loop. */
import {createProductApplication} from '../../product-access/http.mjs';
import {HISTORY_PATHS,listRequest,transcriptRequest,turnRequest} from './protocol.mjs';
export const HISTORY_ERRORS=Object.freeze({CONVERSATION_REQUEST_INVALID:400,CONVERSATION_CURSOR_INVALID:400,CONVERSATION_NOT_FOUND:404,
 CONVERSATION_TURN_CONFLICT:409,CONVERSATION_STORE_CORRUPT:500,CONVERSATION_TURN_UNAVAILABLE:503,CONVERSATION_UNAVAILABLE:503});
export function createConversationHistoryApplication({service,gate,now,limits}){
 const route=(method,parse,effect=false)=>({errors:HISTORY_ERRORS,effect,handle:({principal,body,signal,deadlineMs,recheckMembership})=>service[method]({principal,request:parse(body),signal,deadlineMs,recheckMembership})});
 return createProductApplication({gate,now,limits,routes:{[HISTORY_PATHS.list]:route('list',listRequest),[HISTORY_PATHS.transcript]:route('transcript',transcriptRequest),[HISTORY_PATHS.nextTurn]:route('nextTurn',turnRequest,true)}});
}
