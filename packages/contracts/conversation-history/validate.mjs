/** Server object boundary over the same accepted public schema/semantics. No authority is supplied by validation. */
import {data} from '../commands-0.2/execution-boundary.mjs';
import {assertHistoryShape} from './shape.mjs';import {normalizeHistoryRequest,assertHistoryResponseSemantics,fail} from './semantics.mjs';
const names={list:'List',transcript:'Transcript',nextTurn:'NextTurn'};
export function assertConversationHistoryRequest(route,raw){const request=data(raw),normalized=normalizeHistoryRequest(route,request);try{assertHistoryShape('ConversationHistory'+names[route]+'Request',request);}catch{fail('CONVERSATION_REQUEST_INVALID');}return data(normalized);}
export function assertConversationHistoryResponse(route,raw,request){if(!Object.hasOwn(names,route))fail('INVALID_ROUTE');const normalized=assertConversationHistoryRequest(route,request),response=data(raw);assertHistoryShape('ConversationHistory'+names[route]+'Response',response);return assertHistoryResponseSemantics(route,normalized,response);}
