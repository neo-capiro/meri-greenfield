import canonicalize from 'canonicalize';
import {parseBytes} from '../document-application/boundary.mjs';
import {validateSubmitRequest,validateHistoryRequest,validateCancelRequest,validateEventsRequest,validateSubmitted,validateHistory,validateCancelled,validateEvent,validateError} from './generated-validator.mjs';
import {conversationErrorStatuses,conversationApplicationMetadata} from './protocol.mjs';
export {conversationApplicationMetadata} from './protocol.mjs';
export class ConversationResponseError extends Error {constructor(code){super(code);this.name='ConversationResponseError';this.code=code;}}
const fail=code=>{throw new ConversationResponseError(code);};
const parse=(bytes,cap)=>{try{return parseBytes(bytes,cap);}catch(error){fail(error.code??'INVALID_BYTES');}};
const same=(a,b)=>canonicalize(a)===canonicalize(b);
const requests=new WeakMap(),views=new WeakMap(),cursors=new WeakMap();
const validators=Object.freeze({submit:validateSubmitRequest,history:validateHistoryRequest,cancel:validateCancelRequest,events:validateEventsRequest});
function routeValidator(route){if(typeof route!=='string'||!Object.hasOwn(validators,route))fail('INVALID_ROUTE');return validators[route];}
function viewFacts(view){const facts=views.get(view);if(!facts)fail('UNADMITTED_VIEW');return facts;}
function matches(run,facts){if(!same(run.binding,facts.binding)||!same(run.scopes,facts.scopes))fail('VIEW_MISMATCH');}
function assertRun(run){if(run.scopes.some(scope=>scope.tenantId!==run.binding.tenantId||scope.policyRevision!==run.policyRevision))fail('RUN_SCOPE_MISMATCH');}
function assertEvent(event,run){
 if(!same(event.binding,run.binding)||!same(event.scopes,run.scopes))fail('EVENT_VIEW_MISMATCH');
 if(event.type==='source.available'&&event.data.scopes.some(scope=>scope.tenantId!==run.binding.tenantId||!run.scopes.some(parent=>same(scope,parent))))fail('SOURCE_SCOPE_MISMATCH');
}
function assertWindowPair(request,window){
 if((request===null)!==(window===null))fail('WINDOW_MISMATCH');if(request===null)return;
 if(request.basis!==window.basis||request.timezone!==window.timezone)fail('WINDOW_MISMATCH');
 if(request.basis==='explicit'&&['startInclusive','endExclusive'].some(key=>request[key]!==window[key]))fail('WINDOW_MISMATCH');
 if(request.basis==='relative-duration'&&(window.endExclusive!==request.anchorAt||Date.parse(window.endExclusive)-Date.parse(window.startInclusive)!==request.days*86400000))fail('WINDOW_MISMATCH');
 if(request.basis==='fiscal-year'&&['year','calendarId','stage','revisionId'].some(key=>request[key]!==window[key]))fail('WINDOW_MISMATCH');
 if(request.basis==='calendar-week'&&request.weekStartsOn!==window.weekStartsOn)fail('WINDOW_MISMATCH');
 if('weekStartsOn' in window&&(request.basis==='calendar-week')!==(window.weekStartsOn!==null))fail('WINDOW_MISMATCH');
 if('startInclusive' in window&&!(Date.parse(window.startInclusive)<Date.parse(window.endExclusive)))fail('WINDOW_MISMATCH');
}
export function receiveConversationRequest(route,utf8Bytes){
 const validate=routeValidator(route),request=parse(utf8Bytes,conversationApplicationMetadata.limits.requestBytes);
 if(!validate(request))fail('INVALID_REQUEST');requests.set(request,route);return request;
}
export async function receiveConversationResponse(route,httpStatus,utf8Bytes,request,currentView){
 routeValidator(route);if(requests.get(request)!==route)fail('UNADMITTED_REQUEST');
 if(!Number.isInteger(httpStatus)||httpStatus<100||httpStatus>599)fail('INVALID_STATUS');
 const selected=currentView===undefined?null:viewFacts(currentView),result=parse(utf8Bytes,conversationApplicationMetadata.limits.responseBytes);
 if(httpStatus!==200){if(!validateError(result)||!conversationErrorStatuses[result.error.code].includes(httpStatus))fail('INVALID_ERROR_RESPONSE');return result;}
 if(route==='events')fail('STREAM_RESPONSE_REQUIRED');
 if(!(route==='submit'?validateSubmitted:route==='history'?validateHistory:validateCancelled)(result))fail('INVALID_RESPONSE');
 if(route==='cancel')return result;
 const run=result.run;assertRun(run);if(selected)matches(run,selected);
 if(selected&&result.lastSequence<selected.lastSequence)fail('CURSOR_MISMATCH');
 if(route==='submit'&&result.requestId!==request.requestId)fail('REQUEST_MISMATCH');
 if(route==='submit'&&selected&&(result.requestId!==selected.requestId||selected.input&&!same(selected.input,request)))fail('REQUEST_MISMATCH');
 if(route==='history'){
  const after=request.after??0,limit=request.limit??100;let sequence=after;const ids=new Set();
  if(after>result.lastSequence||result.events.length>limit)fail('CURSOR_MISMATCH');
  for(const event of result.events){assertEvent(event,run);if(event.sequence!==++sequence||event.sequence>result.lastSequence||ids.has(event.eventId))fail('EVENT_SEQUENCE_MISMATCH');ids.add(event.eventId);}
  if(result.nextSequence!==sequence||result.hasMore!==(sequence<result.lastSequence)||(!result.hasMore&&sequence!==result.lastSequence)||result.hasMore&&result.events.length!==limit)fail('CURSOR_MISMATCH');
  if(selected&&selected.requestId!==result.request.requestId)fail('REQUEST_MISMATCH');
  if(selected?.retained&&!same(result.request,selected.retained))fail('REQUEST_MISMATCH');
  if(selected?.input){const input=selected.input,saved=result.request;
   if(saved.prompt!==input.prompt||!same(saved.windowRequest,input.windowRequest??null)||!same(saved.skill&&{skillId:saved.skill.skillId,skillVersion:saved.skill.skillVersion},input.skill??null))fail('REQUEST_MISMATCH');
  }
  assertWindowPair(result.request.windowRequest,result.request.window);
 }
 views.set(result,{binding:run.binding,scopes:run.scopes,lastSequence:result.lastSequence,requestId:route==='submit'?result.requestId:result.request.requestId,events:result.events??[],baseSequence:route==='history'?(request.after??0):0,nextSequence:route==='history'?result.nextSequence:0,input:route==='submit'?request:selected?.input,retained:route==='history'?result.request:selected?.retained});return result;
}
export function createConversationCursor(view,after){
 const facts=viewFacts(view),sequence=after??facts.nextSequence;
 if(!Number.isSafeInteger(sequence)||sequence<facts.baseSequence||sequence>facts.nextSequence)fail('INVALID_CURSOR');
 const cursor=Object.freeze({conversationId:facts.binding.conversationId,after:sequence});
 cursors.set(cursor,{...facts,ids:new Set(facts.events.filter(event=>event.sequence<=sequence).map(event=>event.eventId)),advanced:false});return cursor;
}
function cursorFacts(cursor){const facts=cursors.get(cursor);if(!facts)fail('UNADMITTED_CURSOR');if(facts.advanced)fail('CURSOR_ALREADY_ADVANCED');return facts;}
export function receiveConversationEvent(utf8Bytes,cursor){
 const facts=cursorFacts(cursor),event=parse(utf8Bytes,conversationApplicationMetadata.limits.eventBytes);
 if(!validateEvent(event))fail('INVALID_EVENT');assertEvent(event,facts);
 if(event.sequence!==cursor.after+1||facts.ids.has(event.eventId))fail('EVENT_SEQUENCE_MISMATCH');
 if(facts.ids.size>=conversationApplicationMetadata.limits.cursorEventIds)fail('CURSOR_CHECKPOINT_REQUIRED');
 const next=Object.freeze({conversationId:cursor.conversationId,after:event.sequence});
 facts.ids.add(event.eventId);facts.advanced=true;cursors.set(next,{...facts,advanced:false});return Object.freeze({event,cursor:next});
}
export function conversationReconnect(cursor){
 cursorFacts(cursor);return Object.freeze({method:'GET',path:`/api/conversations/events/${cursor.conversationId}/stream`,headers:Object.freeze({'x-meri-resume-sequence':String(cursor.after)})});
}
