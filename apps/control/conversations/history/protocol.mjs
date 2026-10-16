/** LOCAL PROPOSAL L3/1. Not a frozen/public contracts-package export; frontend adoption requires coordinator acceptance. */
import {closed,intIn,UUID} from '../../product-access/shape.mjs';
import {refuse} from '../../product-access/errors.mjs';
export const HISTORY_SCHEMA='meri.conversation-transcript/1';
export const DISCOVERY_SCHEMA='meri.conversation-list/1';
export const TURN_SCHEMA='meri.conversation-turn/1';
export const HISTORY_PATHS=Object.freeze({list:'/api/conversations/list',transcript:'/api/conversations/transcript',nextTurn:'/api/conversations/next-turn'});
const uuid=value=>{if(typeof value!=='string'||!UUID.test(value))refuse('CONVERSATION_REQUEST_INVALID');return value;};
const page=value=>{const n=value===undefined?50:value;if(!intIn(n,1,100))refuse('CONVERSATION_CURSOR_INVALID');return n;};
export function listRequest(value){const v=closed(value,[],['before','limit'],'CONVERSATION_REQUEST_INVALID');let before=null;
 if(v.before!==undefined&&v.before!==null){before=closed(v.before,['createdAt','conversationId'],[],'CONVERSATION_CURSOR_INVALID');uuid(before.conversationId);
  if(typeof before.createdAt!=='string'||!Number.isFinite(Date.parse(before.createdAt))||new Date(before.createdAt).toISOString()!==before.createdAt)refuse('CONVERSATION_CURSOR_INVALID');}
 return {before,limit:page(v.limit)};
}
export function transcriptRequest(value){const v=closed(value,['conversationId'],['after','limit'],'CONVERSATION_REQUEST_INVALID');uuid(v.conversationId);
 const after=v.after===undefined?0:v.after;if(!intIn(after,0,Number.MAX_SAFE_INTEGER))refuse('CONVERSATION_CURSOR_INVALID');return {conversationId:v.conversationId,after,limit:page(v.limit)};
}
export function turnRequest(value){const v=closed(value,['conversationId','sourceRunId'],[],'CONVERSATION_REQUEST_INVALID');uuid(v.conversationId);uuid(v.sourceRunId);return v;}
