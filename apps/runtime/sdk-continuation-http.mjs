/** One authenticated native runtime preparation route; snapshot uses the existing SessionStore application. */
import {types} from 'node:util';
import {own} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {storageMethod} from '../artifacts/storage/boundary.mjs';
import {jsonBody,response} from '../control/action-application/http.mjs';
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
const get=Object.fromEntries(['url','method','headers','body','signal'].map(k=>[k,Object.getOwnPropertyDescriptor(Request.prototype,k).get]));
export function createNativeSessionContinuationApplication(configuration){
 const {owner,now=Date.now,maxRequestMs=3000}=own(configuration,['owner'],['now','maxRequestMs']),prepare=storageMethod(owner,'prepareRuntime');
 if(typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)throw Error('CONTINUATION_CONFIGURATION');
 return Object.freeze({async handle(request){let life;try{
  if(!request||types.isProxy(request)||!(request instanceof Request))return response({error:{code:'CONTINUATION_INPUT_REFUSED'}},400);
  const info=Object.fromEntries(Object.entries(get).map(([k,g])=>[k,g.call(request)])),url=new URL(info.url);
  if(url.pathname!=='/v1/runner/runtime'||url.search||url.hash)return response({error:{code:'NOT_FOUND'}},404);
  if(info.method!=='POST')return response({error:{code:'METHOD_NOT_ALLOWED'}},405);
  const header=k=>Headers.prototype.get.call(info.headers,k),credential=header('authorization');
  if(!/^Bearer [\x21-\x2b\x2d-\x7e]{1,8192}$/u.test(credential??''))return response({error:{code:'CONTINUATION_REFUSED'}},401);
  if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(header('content-type')??'')||![null,'identity'].includes(header('content-encoding')))return response({error:{code:'CONTINUATION_INPUT_REFUSED'}},400);
  const maxBytes=2097152,length=header('content-length');if(length!==null&&(!/^(0|[1-9][0-9]*)$/u.test(length)||!Number.isSafeInteger(Number(length))||Number(length)>maxBytes))return response({error:{code:'CONTINUATION_INPUT_LIMIT'}},413);
  const deadlineMs=now()+maxRequestMs;life=createOperationLifetime({now,deadlineMs,signal:info.signal,errorFactory:()=>Error('CONTINUATION_UNAVAILABLE')});
  const input=await jsonBody({...info,length:length===null?null:Number(length)},maxBytes,life,life.check);
  const result=await life.run(signal=>prepare({credential:credential.slice(7),request:input,signal,deadlineMs}));life.check();return response(result);
 }catch{return response({error:{code:'CONTINUATION_UNAVAILABLE'}},503);}finally{life?.close();}}});
}
