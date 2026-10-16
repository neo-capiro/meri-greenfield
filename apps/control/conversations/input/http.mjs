/** Fixed durable input mount. The assembled conversation service owns all persistence and current authority. */
import {types} from 'node:util';
import {jsonBody,response} from '../../action-application/http.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {receiveConversationRequest} from '../../../../packages/contracts/dist/conversation-application.mjs';
import {conversationErrorStatuses} from '../../../../packages/contracts/conversation-application/protocol.mjs';
import {assertInputShape} from '../../../../packages/contracts/conversation-input/shape.mjs';
import {fail} from '../boundary.mjs';
export function createConversationInputApplication({service,now=Date.now,maxRequestBytes=131072,maxResponseBytes=2097152,maxRequestMs=3000}){
 if(typeof service?.admitInput!=='function'||!Number.isSafeInteger(maxRequestBytes)||maxRequestBytes<1||maxRequestBytes>131072||!Number.isSafeInteger(maxResponseBytes)||maxResponseBytes<1||maxResponseBytes>2097152||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)fail('HTTP_CONFIGURATION');
 return Object.freeze({async handle(request){let life;try{
  if(!request||types.isProxy(request))fail('INVALID_REQUEST');let info;
  try{info=Object.fromEntries(['url','method','headers','body','signal'].map(k=>[k,Object.getOwnPropertyDescriptor(Request.prototype,k).get.call(request)]));}catch{fail('INVALID_REQUEST');}
  const url=new URL(info.url),header=k=>Headers.prototype.get.call(info.headers,k);
  if(url.pathname!=='/api/conversations/input/admit'||url.search||url.hash)return response({error:{code:'NOT_FOUND'}},404);
  if(info.method!=='POST')return response({error:{code:'METHOD_NOT_ALLOWED'}},405);
  if(header('last-event-id')!==null||header('x-meri-resume-sequence')!==null)fail('INVALID_CURSOR');
  const auth=header('authorization');if(!/^Bearer [A-Za-z0-9._~+\/-]{1,8192}={0,2}$/u.test(auth??''))return response({error:{code:'SESSION_REFUSED'}},401);
  if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(header('content-type')??'')||header('content-encoding')!==null)return response({error:{code:'UNSUPPORTED_MEDIA_TYPE'}},415);
  const length=header('content-length');if(length!==null&&(!/^(0|[1-9][0-9]*)$/u.test(length)||!Number.isSafeInteger(Number(length))))fail('INVALID_REQUEST');
  life=createOperationLifetime({deadlineMs:now()+maxRequestMs,now,signal:info.signal,errorFactory:code=>Object.assign(Error(code),{code})});
  const body=await jsonBody({body:info.body,length:length===null?null:Number(length)},maxRequestBytes,life,life.check);let input;
  try{input=receiveConversationRequest('submit',new TextEncoder().encode(JSON.stringify(body)));}catch{fail('INVALID_REQUEST');}
  const saved=await life.run(signal=>service.admitInput({credential:auth.slice(7),input,signal}));
  assertInputShape('ConversationInputAdmittedResponse',saved);const encoded=JSON.stringify(saved);if(Buffer.byteLength(encoded)>maxResponseBytes)fail('CONVERSATION_UNAVAILABLE');life.check();
  return new Response(encoded,{status:200,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
 }catch(error){const observed=error?.code??error?.message,code=['INVALID_JSON','INVALID_UTF8','INVALID_BODY','INVALID_CONTENT_LENGTH'].includes(observed)?'INVALID_REQUEST':observed==='INITIAL_INPUT_CONFLICT'?'REQUEST_REPLAY_REFUSED':observed,status=Object.hasOwn(conversationErrorStatuses,code)?conversationErrorStatuses[code].at(-1):502;return response({error:{code:status===502?'CONVERSATION_UNAVAILABLE':code}},status);}finally{life?.close();}}});
}
