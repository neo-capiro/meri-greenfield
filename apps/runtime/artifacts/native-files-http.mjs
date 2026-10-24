/** Authenticate the existing execution credential before allocating the bounded native file body. */
import {types} from 'node:util';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {assertNativeFileBindingHeader,NATIVE_FILE_LIMITS} from '../../../packages/contracts/runtime-0.2/files.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {jsonBody,response} from '../../control/action-application/http.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
const getters=Object.fromEntries(['url','method','headers','body','signal'].map(k=>[k,Object.getOwnPropertyDescriptor(Request.prototype,k).get]));
export const NATIVE_FILE_PATHS=Object.freeze({'/v1/runner/checkpoint/capture':'capture','/v1/runner/checkpoint/complete':'complete','/v1/runner/files/restore':'restore'});
export function createNativeFileApplication({owner,now=Date.now,maxRequestMs=23000}){
 const authenticate=storageMethod(owner,'authenticate'),methods=Object.fromEntries(['capture','complete','restore'].map(k=>[k,storageMethod(owner,k)]));
 if(typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)throw Error('NATIVE_FILES_CONFIGURATION');
 return Object.freeze({async handle(request){let life;try{
  if(!request||types.isProxy(request)||!(request instanceof Request))return response({error:{code:'NATIVE_FILES_INPUT_REFUSED'}},400);
  const info=Object.fromEntries(Object.entries(getters).map(([k,g])=>[k,g.call(request)])),url=new URL(info.url),method=NATIVE_FILE_PATHS[url.pathname];
  if(!method||url.search||url.hash)return response({error:{code:'NOT_FOUND'}},404);if(info.method!=='POST')return response({error:{code:'METHOD_NOT_ALLOWED'}},405);
  const header=k=>Headers.prototype.get.call(info.headers,k),authorization=header('authorization');if(!/^Bearer [\x21-\x2b\x2d-\x7e]{1,8192}$/u.test(authorization??''))return response({error:{code:'NATIVE_FILES_REFUSED'}},401);
  let binding;try{binding=assertNativeFileBindingHeader(header('x-meri-run-binding'));}catch{return response({error:{code:'NATIVE_FILES_INPUT_REFUSED'}},400);}
  const credential=authorization.slice(7),deadlineMs=now()+maxRequestMs;life=createOperationLifetime({now,signal:info.signal,deadlineMs,errorFactory:()=>Error('NATIVE_FILES_UNAVAILABLE')});
  try{await life.run(signal=>authenticate({credential,binding,signal}));}catch{return response({error:{code:'NATIVE_FILES_REFUSED'}},401);}
  if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(header('content-type')??'')||header('content-encoding')!==null)return response({error:{code:'NATIVE_FILES_INPUT_REFUSED'}},400);
  const length=header('content-length'),limit=method==='restore'?2048:NATIVE_FILE_LIMITS.requestBytes;if(length!==null&&(!/^(0|[1-9][0-9]*)$/u.test(length)||!Number.isSafeInteger(Number(length))||Number(length)>limit))return response({error:{code:'NATIVE_FILES_INPUT_LIMIT'}},413);
  const input=await jsonBody({...info,length:length===null?null:Number(length)},limit,life,life.check);if(hash(input.binding)!==hash(binding))return response({error:{code:'NATIVE_FILES_REFUSED'}},403);
  const result=await life.run(signal=>methods[method]({credential,request:input,signal,deadlineMs}));life.check();return response(result);
 }catch{return response({error:{code:'NATIVE_FILES_UNAVAILABLE'}},503);}finally{life?.close();}}});
}
