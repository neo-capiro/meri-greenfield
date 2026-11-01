/** Fetch mount; current authenticated session remains the sole run/scope authority. */
import {jsonBody,response} from '../action-application/http.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {meriLiveEventStreamResponse} from '../../../packages/ui-stream/dist/producer.js';
import {receiveConversationRequest} from '../../../packages/contracts/dist/conversation-application.mjs';
import {conversationErrorStatuses} from '../../../packages/contracts/conversation-application/protocol.mjs';
import {assertFeedbackShape} from '../../../packages/contracts/conversation-application/feedback-validate.mjs';
import {createConversationEventSource} from './events.mjs';
import {own,fail} from './boundary.mjs';
import {types} from 'node:util';
import {randomUUID} from 'node:crypto';
import {beginHistoryDiagnostic,historyTraceHeader} from './history-diagnostics.mjs';
const streamPath=/^\/api\/conversations\/events\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\/stream$/u;
function cursor(value){if(value===null)return 0;if(!/^(0|[1-9][0-9]*)$/u.test(value)||!Number.isSafeInteger(Number(value)))fail('INVALID_CURSOR');return Number(value);}
function closedBody(body,required,optional=[]){try{return own(body,required,optional);}catch{fail('INVALID_REQUEST');}}
function publicRequest(route,body){try{return receiveConversationRequest(route,new TextEncoder().encode(JSON.stringify(body)));}catch{fail('INVALID_REQUEST');}}
export function createConversationApplication({service,now=Date.now,maxRequestBytes=131072,maxRequestMs=3000,historyDiagnostics=beginHistoryDiagnostic}){
 if(['submit','history','cancel'].some(k=>typeof service?.[k]!=='function')||!Number.isSafeInteger(maxRequestBytes)||maxRequestBytes<1||maxRequestBytes>131072||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)fail('HTTP_CONFIGURATION');
 return Object.freeze({async handle(request){let life,diagnostic;const finish=result=>{diagnostic?.finish(result.status);return result;};try{
   if(!request||types.isProxy(request))fail('INVALID_REQUEST');
   let info;try{info=Object.fromEntries(['url','method','headers','body','signal'].map(k=>[k,Object.getOwnPropertyDescriptor(Request.prototype,k).get.call(request)]));}catch{fail('INVALID_REQUEST');}
   const header=k=>Headers.prototype.get.call(info.headers,k),url=new URL(info.url);
   const route=/^\/api\/conversations\/(submit|history|cancel|events|feedback|feedback-read)$/u.exec(url.pathname),reconnect=streamPath.exec(url.pathname);
   if((!route&&!reconnect)||url.search||url.hash)return response({error:{code:'NOT_FOUND'}},404);
   if(info.method!==(reconnect?'GET':'POST'))return response({error:{code:'METHOD_NOT_ALLOWED'}},405);
   if(route?.[1]==='history')diagnostic=historyDiagnostics(header(historyTraceHeader));
   if(header('last-event-id')!==null||!reconnect&&header('x-meri-resume-sequence')!==null)fail('INVALID_CURSOR');
   const auth=header('authorization');if(!/^Bearer [A-Za-z0-9._~+\/-]{1,8192}={0,2}$/u.test(auth??''))return finish(response({error:{code:'SESSION_REFUSED'}},401));
   const length=header('content-length');if(length!==null&&(!/^(0|[1-9][0-9]*)$/u.test(length)||!Number.isSafeInteger(Number(length))))fail('INVALID_REQUEST');
   life=createOperationLifetime({deadlineMs:now()+maxRequestMs,now,signal:info.signal,errorFactory:code=>Object.assign(new Error(code),{code})});
   let after,selector;
   if(reconnect){
     if(info.body!==null||length!==null&&length!=='0'||header('content-encoding')!==null||header('content-type')!==null)fail('INVALID_REQUEST');
     after=cursor(header('x-meri-resume-sequence'));selector=reconnect[1];
   }else{
     if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(header('content-type')??'')||header('content-encoding'))return finish(response({error:{code:'UNSUPPORTED_MEDIA_TYPE'}},415));
     const body=await jsonBody({body:info.body,length:length===null?null:Number(length)},maxRequestBytes,life,life.check);
     if(route[1]==='submit')return response(await life.run(signal=>service.submit({credential:auth.slice(7),input:publicRequest('submit',body),signal})),200);
     if(route[1]==='cancel'){publicRequest('cancel',body);return response(await life.run(signal=>service.cancel({credential:auth.slice(7),signal})),200);}
     if(route[1]==='feedback'||route[1]==='feedback-read'){
      const input=assertFeedbackShape(route[1]==='feedback'?'ConversationFeedbackRequest':'ConversationFeedbackReadRequest',body),method=route[1]==='feedback'?'feedback':'feedbackRead';
      return response(await life.run(signal=>service[method]({credential:auth.slice(7),input,signal})),200);
     }
     if(route[1]==='history'){const input=publicRequest('history',body);diagnostic?.stage('session');const result=await life.run(signal=>service.history({credential:auth.slice(7),after:input.after??0,limit:input.limit??100,signal,historyStage:diagnostic?.stage}));diagnostic?.stage('response');return finish(response(result,200));}
     if(body&&Object.hasOwn(body,'command')){const input=publicRequest('events',body);after=0;selector=input.command.conversationId;}
     else{closedBody(body,[],['after','limit']);after=body.after??0;const limit=body.limit??100;if(!Number.isSafeInteger(limit)||limit<1||limit>100)fail('INVALID_CURSOR');}
   }
   const credential=auth.slice(7);
   // The window's own opening session pass and first page read authenticate and validate the cursor and selector before any header
   // or event is exposed; a refusal before that point is answered here with its own status, as a separate history read was.
   const opening=Promise.withResolvers();opening.promise.catch(()=>{});
   const events=createConversationEventSource({service,credential,after,signal:info.signal,now,refused:opening.reject,
    opened(run){if(selector!==undefined&&selector!==run.binding.conversationId)fail('CONVERSATION_SELECTOR_REFUSED');opening.resolve();}});
   // Cancelling an already errored window rejects with its own scrubbed error; the refusal to answer is the original one.
   try{await life.run(()=>opening.promise);life.check();}catch(error){await events.cancel().catch(()=>{});throw error;}
   const result=meriLiveEventStreamResponse({messageId:randomUUID(),events});
   result.headers.set('cache-control','no-store');result.headers.set('x-content-type-options','nosniff');return result;
  }catch(error){const observed=error?.code??error?.message,code=['INVALID_JSON','INVALID_UTF8','INVALID_BODY','INVALID_CONTENT_LENGTH'].includes(observed)?'INVALID_REQUEST':observed,status=Object.hasOwn(conversationErrorStatuses,code)?conversationErrorStatuses[code].at(-1):502;return finish(response({error:{code:status===502?'CONVERSATION_UNAVAILABLE':code}},status));}finally{life?.close();}}});
}
