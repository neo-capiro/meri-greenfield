/** Fixed original-input allocation mount. Current authority and persistence belong to the assembled conversation service. */
import {types} from 'node:util';
import {jsonBody,response} from '../../action-application/http.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {receiveConversationRequest} from '../../../../packages/contracts/dist/conversation-application.mjs';
import {conversationInitialInputPath,initialInputErrorStatuses,initialInputErrorOutcomes} from '../../../../packages/contracts/conversation-initial-input/protocol.mjs';
import {assertInitialInputShape} from '../../../../packages/contracts/conversation-initial-input/shape.mjs';
import {fail} from '../boundary.mjs';
import {productFailure} from '../../product-access/errors.mjs';
const rejected=(code,status=initialInputErrorStatuses[code].at(-1))=>response({error:{code,outcome:initialInputErrorOutcomes[code]}},status);
export function createConversationInitialInputApplication({service,now=Date.now,maxRequestBytes=131072,maxResponseBytes=131072,maxRequestMs=3000}){
 if(typeof service?.allocateInput!=='function'||!Number.isSafeInteger(maxRequestBytes)||maxRequestBytes<1||maxRequestBytes>131072||!Number.isSafeInteger(maxResponseBytes)||maxResponseBytes<1||maxResponseBytes>131072||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)fail('HTTP_CONFIGURATION');
 return Object.freeze({async handle(request){let life;try{
  if(!request||types.isProxy(request))fail('INVALID_REQUEST');let info;
  try{info=Object.fromEntries(['url','method','headers','body','signal'].map(k=>[k,Object.getOwnPropertyDescriptor(Request.prototype,k).get.call(request)]));}catch{fail('INVALID_REQUEST');}
  const url=new URL(info.url),header=k=>Headers.prototype.get.call(info.headers,k);
  if(url.pathname!==conversationInitialInputPath||url.search||url.hash)return rejected('NOT_FOUND');
  if(info.method!=='POST')return rejected('METHOD_NOT_ALLOWED');
  if(header('last-event-id')!==null||header('x-meri-resume-sequence')!==null)fail('INVALID_REQUEST');
  const auth=header('authorization');if(!/^Bearer [A-Za-z0-9._~+\/-]{1,8192}={0,2}$/u.test(auth??''))return rejected('SESSION_REFUSED',401);
  if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(header('content-type')??'')||header('content-encoding')!==null)return rejected('UNSUPPORTED_MEDIA_TYPE');
  const length=header('content-length');if(length!==null&&(!/^(0|[1-9][0-9]*)$/u.test(length)||!Number.isSafeInteger(Number(length))))fail('INVALID_REQUEST');
  life=createOperationLifetime({deadlineMs:now()+maxRequestMs,now,signal:info.signal,errorFactory:code=>Object.assign(Error(code),{code})});
  const body=await jsonBody({body:info.body,length:length===null?null:Number(length)},maxRequestBytes,life,life.check);let input;
  try{input=receiveConversationRequest('submit',new TextEncoder().encode(JSON.stringify(body)));}catch{fail('INVALID_REQUEST');}
  const saved=await life.run(signal=>service.allocateInput({credential:auth.slice(7),input,signal}));
  assertInitialInputShape('ConversationInitialInputAllocatedResponse',saved);const encoded=JSON.stringify(saved);if(Buffer.byteLength(encoded)>maxResponseBytes)fail('INITIAL_INPUT_UNAVAILABLE');life.check();
  return new Response(encoded,{status:200,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
 }catch(error){const owned=productFailure(error),observed=owned?.code??error?.code??error?.message,code=['INVALID_JSON','INVALID_UTF8','INVALID_BODY','INVALID_CONTENT_LENGTH'].includes(observed)?'INVALID_REQUEST':Object.hasOwn(initialInputErrorStatuses,observed)?observed:'INITIAL_INPUT_UNAVAILABLE';return rejected(code);}finally{life?.close();}}});
}
