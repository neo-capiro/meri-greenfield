/** Backend adapter to the accepted shared history owner; frozen run-local APIs remain separate. */
import {assertConversationHistoryRequest} from '../../../../packages/contracts/conversation-history/validate.mjs';
import {refuse} from '../../product-access/errors.mjs';
export {HISTORY_SCHEMA,DISCOVERY_SCHEMA,TURN_SCHEMA,HISTORY_PATHS} from '../../../../packages/contracts/conversation-history/protocol.mjs';
const parser=route=>value=>{try{return assertConversationHistoryRequest(route,value);}catch(error){refuse(['CONVERSATION_REQUEST_INVALID','CONVERSATION_CURSOR_INVALID'].includes(error?.code)?error.code:'CONVERSATION_REQUEST_INVALID');}};
export const listRequest=parser('list'),transcriptRequest=parser('transcript'),turnRequest=parser('nextTurn');
