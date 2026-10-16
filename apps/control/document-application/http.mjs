/** Document route admission; shared bounded JSON reader and response headers. */
import {types} from 'node:util';
import {jsonBody,response} from '../action-application/http.mjs';
export {jsonBody,response};
const faults=new WeakMap();
export function fail(code,status=400){const error=new Error(code);faults.set(error,{code,status});throw error;}
const getter=name=>Object.getOwnPropertyDescriptor(Request.prototype,name).get;
export function requestInfo(request){
 if(!request||types.isProxy(request))fail('INVALID_REQUEST');
 let info;try{info=Object.fromEntries(['url','method','headers','signal','body'].map(k=>[k,getter(k).call(request)]));}catch{fail('INVALID_REQUEST');}
 const url=new URL(info.url),match=/^\/api\/documents\/(create|revise|inspect|download|preview|preview-publish)$/u.exec(url.pathname);
 if(!match||url.search||url.hash)fail('NOT_FOUND',404);
 if(info.method!=='POST')fail('METHOD_NOT_ALLOWED',405);
 const content=Headers.prototype.get.call(info.headers,'content-type');
 if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(content??'')||Headers.prototype.get.call(info.headers,'content-encoding'))fail('UNSUPPORTED_MEDIA_TYPE',415);
 const auth=Headers.prototype.get.call(info.headers,'authorization');
 if(!/^Bearer [A-Za-z0-9._~+\/-]{1,4096}={0,2}$/u.test(auth??''))fail('UNAUTHENTICATED',401);
 const length=Headers.prototype.get.call(info.headers,'content-length');
 if(length!==null&&!/^(0|[1-9][0-9]*)$/u.test(length))fail('INVALID_REQUEST');
 return {...info,intent:match[1],credential:auth.slice(7),length:length===null?null:Number(length)};
}
const codes=new Map([['ARTIFACT_PREVIEW_PENDING',409],['ARTIFACT_PREVIEW_UNSUPPORTED',422],['ARTIFACT_RENDERER_UNAVAILABLE',503],['PREVIEW_UNAVAILABLE',503],['SESSION_REFUSED',403],['ACCESS_DENIED',403],['UNAVAILABLE',503],['DEADLINE',408],['CANCELLED',499],['ARTIFACT_DEADLINE',408],['ARTIFACT_CANCELLED',499],['ARTIFACT_EFFECT_UNKNOWN',502],['ARTIFACT_BUDGET_RESERVATION_UNKNOWN',502],['ARTIFACT_BUDGET_SETTLEMENT_UNKNOWN',502]]);
export function errorResponse(error,state){
 let admitted=error&&typeof error==='object'&&!types.isProxy(error)?faults.get(error):null;
 if(!admitted&&error&&typeof error==='object'&&!types.isProxy(error)){
  const d=Object.getOwnPropertyDescriptors(error),code=d.code?.value??d.message?.value;
  if(codes.has(code))admitted={code,status:codes.get(code)};
 }
 admitted??={code:'DOCUMENT_REFUSED',status:502};
 const outcome=state.completed?'RESULT_NOT_RELEASED':state.writeStarted?'UNKNOWN':state.readStarted?'READ_UNAVAILABLE':'NOT_DISPATCHED';
 return response({error:{code:admitted.code,outcome}},admitted.status);
}
