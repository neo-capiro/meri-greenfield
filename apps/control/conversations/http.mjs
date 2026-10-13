/** Fetch application mount; auth sessions and source policies keep their canonical owners. */
import {jsonBody,response} from '../action-application/http.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {meriLiveEventStreamResponse} from '../../../packages/ui-stream/dist/producer.js';
import {createConversationEventSource} from './events.mjs';
import {own,fail} from './boundary.mjs';
import {types} from 'node:util';
import {randomUUID} from 'node:crypto';
export function createConversationApplication({service,now=Date.now,maxRequestBytes=131072,maxRequestMs=3000}){
 if(['submit','history','cancel'].some(k=>typeof service?.[k]!=='function')||!Number.isSafeInteger(maxRequestBytes)||maxRequestBytes<1||maxRequestBytes>131072||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)fail('HTTP_CONFIGURATION');
 return Object.freeze({async handle(request){let life;try{
   if(!request||types.isProxy(request))fail('INVALID_REQUEST');const info=Object.fromEntries(['url','method','headers','body','signal'].map(k=>[k,Object.getOwnPropertyDescriptor(Request.prototype,k).get.call(request)]));const header=k=>Headers.prototype.get.call(info.headers,k);const url=new URL(info.url),route=/^\/api\/conversations\/(submit|history|cancel|events)$/u.exec(url.pathname);if(!route||url.search||url.hash)return response({error:{code:'NOT_FOUND'}},404);if(info.method!=='POST')return response({error:{code:'METHOD_NOT_ALLOWED'}},405);
   const auth=header('authorization');if(!/^Bearer [A-Za-z0-9._~+\/-]{1,8192}={0,2}$/u.test(auth??''))return response({error:{code:'SESSION_REFUSED'}},401);
   if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(header('content-type')??'')||header('content-encoding'))return response({error:{code:'UNSUPPORTED_MEDIA_TYPE'}},415);
   const length=header('content-length');if(length!==null&&(!/^(0|[1-9][0-9]*)$/u.test(length)||!Number.isSafeInteger(Number(length))))fail('INVALID_REQUEST');
   life=createOperationLifetime({deadlineMs:now()+maxRequestMs,now,signal:info.signal,errorFactory:code=>Object.assign(new Error(code),{code})});const body=await jsonBody({body:info.body,length:length===null?null:Number(length)},maxRequestBytes,life,life.check);const credential=auth.slice(7),signal=life.signal;
   if(route[1]==='submit')return response(await service.submit({credential,input:body,signal}),200);
   if(route[1]==='cancel'){own(body,[]);return response(await service.cancel({credential,signal}),200);}
   own(body,[],['after','limit']);const after=body.after??0,limit=body.limit??100;
   if(route[1]==='history')return response(await service.history({credential,after,limit,signal}),200);
   // Authenticate and validate the cursor before exposing a streaming response.
   await service.history({credential,after,limit:1,signal});life.check();return meriLiveEventStreamResponse({messageId:randomUUID(),events:createConversationEventSource({service,credential,after,signal:info.signal,now})});
  }catch(error){const code=error?.code??error?.message;const status=['SESSION_REFUSED','SCOPE_REFUSED','SESSION_CHANGED','STALE_WRITER'].includes(code)?403:['INVALID_REQUEST','INVALID_CURSOR','REQUEST_REPLAY_REFUSED'].includes(code)?400:['DEADLINE','CANCELLED'].includes(code)?408:code==='REQUEST_TOO_LARGE'?413:502;return response({error:{code:status===502?'CONVERSATION_UNAVAILABLE':code}},status);}finally{life?.close();}}});
}
