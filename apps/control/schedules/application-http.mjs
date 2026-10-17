/** Inert Fetch transport. Supplied routine services retain every domain and authority decision. */
import {types} from 'node:util';
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {ApplicationError,jsonBody,response,errorResponse} from '../action-application/http.mjs';

export const ROUTINE_PATHS=Object.freeze({
 prepare:'/api/routines/prepare',approve:'/api/routines/approve',
 list:'/api/routines/list',reconcile:'/api/routines/reconcile',
});
export const routinesUnavailable=()=>response({error:{code:'ROUTINES_UNAVAILABLE',outcome:'NOT_DISPATCHED'}},503);
const routes=new Map(Object.entries(ROUTINE_PATHS).map(([method,path])=>[path,method]));
const getters=Object.fromEntries(['url','method','headers','signal','body'].map(name=>[name,Object.getOwnPropertyDescriptor(Request.prototype,name).get]));
const transportErrors=new WeakMap();
const outcomes=new Set(['NOT_DISPATCHED','UNKNOWN','ACKNOWLEDGED_NOT_RELEASED','UNRESOLVED']);
const codes=new Set(['ACCESS_DENIED','UNAUTHENTICATED','UNAVAILABLE','UNKNOWN','STALE','DEADLINE','CANCELLED']);
const nativeCode=/^(?:ROUTINES|SCHEDULE|SESSION|ACTION_SESSION|NATIVE|CORE)_[A-Z0-9_]+$/u;
function fault(code,status=400){
 const error=new ApplicationError(code,status);transportErrors.set(error,{code,status});return error;
}
const fail=(code,status)=>{throw fault(code,status);};
function requestInfo(request){
 if(!request||types.isProxy(request)||!(request instanceof Request))fail('INVALID_REQUEST');
 let info;try{info=Object.fromEntries(Object.entries(getters).map(([key,get])=>[key,get.call(request)]));}catch{fail('INVALID_REQUEST');}
 const url=new URL(info.url),method=routes.get(url.pathname);
 return method?{...info,url,operation:method}:null;
}
function admit(info){
 if(info.method!=='POST')fail('METHOD_NOT_ALLOWED',405);
 const header=name=>Headers.prototype.get.call(info.headers,name);
 if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(header('content-type')??''))fail('UNSUPPORTED_MEDIA_TYPE',415);
 if(header('content-encoding')!==null)fail('UNSUPPORTED_CONTENT_ENCODING',415);
 const authorization=header('authorization');
 if(typeof authorization!=='string'||!/^Bearer [A-Za-z0-9._~+/-]{1,4096}={0,2}$/u.test(authorization))fail('UNAUTHENTICATED',401);
 const length=header('content-length');
 if(length!==null&&!/^(0|[1-9][0-9]*)$/u.test(length))fail('INVALID_CONTENT_LENGTH');
 return {credential:authorization.slice(7),length:length===null?null:Number(length)};
}
function serviceError(error){
 const local=transportErrors.get(error);if(local)return local;
 if(!error||typeof error!=='object'||types.isProxy(error))return {};
 const field=name=>{const entry=Object.getOwnPropertyDescriptor(error,name);return entry&&Object.hasOwn(entry,'value')?entry.value:undefined;};
 const code=field('code'),outcome=field('outcome');
 return {
  code:typeof code==='string'&&code.length<=64&&(codes.has(code)||nativeCode.test(code))?code:undefined,
  outcome:outcomes.has(outcome)?outcome:undefined,
 };
}
function returnedState(value,operation){
 if(!value||typeof value!=='object'||types.isProxy(value))return {};
 const field=name=>{const entry=Object.getOwnPropertyDescriptor(value,name);return entry&&Object.hasOwn(entry,'value')?entry.value:undefined;};
 return {
  knownAcknowledged:operation==='approve'&&field('status')==='acknowledged'||operation==='reconcile'&&field('outcome')==='ACKNOWLEDGED',
  unresolved:operation==='reconcile'&&field('outcome')==='UNRESOLVED',
 };
}
function failure(error,state){
 const admitted=serviceError(error),code=admitted.code??'REQUEST_FAILED';
 const status=admitted.status??(
  /(?:^|_)UNAUTHENTICATED$/u.test(code)?401:/(?:^|_)ACCESS_DENIED$/u.test(code)?403:
  /(?:^|_)(?:STALE|APPROVAL_REFUSED)$/u.test(code)?409:code==='DEADLINE'?408:code==='CANCELLED'?499:
  /(?:^|_)INVALID_REQUEST$/u.test(code)?400:/(?:^|_)UNAVAILABLE$/u.test(code)?503:502);
 const outcome=state.knownAcknowledged?'ACKNOWLEDGED_NOT_RELEASED':state.unresolved?'UNRESOLVED':
  admitted.outcome??(state.started?'UNKNOWN':'NOT_DISPATCHED');
 return response({error:{code,outcome}},status);
}
async function handleRequest(request,configuration){
 let info,life;const state={started:false};
 try{
  info=requestInfo(request);if(info===null)return null;
  if(info.url.search||info.url.hash)fail('NOT_FOUND',404);
  if(!configuration.enabled)return routinesUnavailable();
  const admitted=admit(info),at=configuration.now(),bounds=configuration.limits;
  if(!Number.isSafeInteger(at)||at<0||!Number.isSafeInteger(at+bounds.maxRequestMs))fail('APPLICATION_CLOCK',500);
  const deadlineMs=at+bounds.maxRequestMs;
  life=createOperationLifetime({deadlineMs,now:configuration.now,signal:info.signal,errorFactory:code=>fault(code,code==='DEADLINE'?408:499)});
  const body=await jsonBody({...info,length:admitted.length},bounds.maxRequestBytes,life,life.check);
  state.operation=info.operation;
  const result=await life.run(async signal=>{
   state.started=true;
   const value=await Reflect.apply(configuration.methods[info.operation],configuration.service,[{credential:admitted.credential,request:body,deadlineMs,signal}]);
   Object.assign(state,returnedState(value,info.operation));return value;
  });
  const inert=data(result),text=JSON.stringify(inert);
  if(Buffer.byteLength(text)>bounds.maxResponseBytes)fail('RESPONSE_TOO_LARGE',413);
  life.check();return response(inert);
 }catch(error){
  return state.started?failure(error,state):errorResponse(error,{});
 }finally{
  life?.close();
  if(info?.body){try{Promise.resolve(info.body.cancel()).catch(()=>{});}catch{}}
 }
}
export function createRoutinesApplication(configuration){
 let c,limits,methods;
 try{
  c=own(configuration,[],['now','limits','service','enabled']);
  if(c.enabled!==undefined&&typeof c.enabled!=='boolean')throw Error();
  if(c.limits!==undefined){
   limits=data(own(c.limits,['maxRequestMs','maxRequestBytes','maxResponseBytes']));
   if(Object.values(limits).some(value=>!Number.isSafeInteger(value)||value<1)||
    limits.maxRequestMs>60000||limits.maxRequestBytes>16777216||limits.maxResponseBytes>16777216)throw Error();
  }
  if(c.now!==undefined&&typeof c.now!=='function')throw Error();
  if(c.enabled!==false){
   if(typeof c.now!=='function'||limits===undefined)throw Error();
   methods=own(c.service,Object.keys(ROUTINE_PATHS));
   if(Object.values(methods).some(method=>typeof method!=='function'))throw Error();
  }
 }catch{throw TypeError('ROUTINES_APPLICATION_CONFIGURATION');}
 const captured={service:c.service,methods,limits,now:c.now,enabled:c.enabled!==false};
 return Object.freeze({paths:Object.freeze(Object.values(ROUTINE_PATHS)),handle:request=>handleRequest(request,captured)});
}
