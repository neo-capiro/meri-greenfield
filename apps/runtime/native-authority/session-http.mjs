/** Fixed private session Fetch receiving. Existing task authority is checked by the owner. */
import {types} from 'node:util';
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {sdkSessionOperations} from '../../../packages/contracts/runtime-0.2/session.mjs';
import {jsonBody,response} from '../../control/action-application/http.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {captureSessionMethods} from '../../worker/qualification/checkpoint/session-store-data.mjs';
const get=Object.fromEntries(['url','method','headers','body','signal'].map(k=>[k,Object.getOwnPropertyDescriptor(Request.prototype,k).get]));
export function createNativeSdkSessionApplication(configuration){
 const {owner,snapshot,now=Date.now,maxRequestMs=3000,maxRequestBytes=9437184}=own(configuration,['owner'],['snapshot','now','maxRequestMs','maxRequestBytes']);
 const methods=captureSessionMethods(owner,['register','load','append','listSubkeys'],'SDK_SESSION_CONFIGURATION');
 const snapshotRead=snapshot?captureSessionMethods(snapshot,['readSnapshot'],'SDK_SESSION_CONFIGURATION').readSnapshot:null;
 if(typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000||!Number.isSafeInteger(maxRequestBytes)||maxRequestBytes<1||maxRequestBytes>9437184)throw Error('SDK_SESSION_CONFIGURATION');
 return Object.freeze({async handle(request){let life;try{
  if(!request||types.isProxy(request)||!(request instanceof Request))return response({error:{code:'INVALID_SDK_SESSION_REQUEST'}},400);
  const info=Object.fromEntries(Object.entries(get).map(([k,g])=>[k,g.call(request)])),url=new URL(info.url),route=/^\/v1\/runner\/session\/([a-z-]+)$/u.exec(url.pathname);
  if(!route||!(sdkSessionOperations.includes(route[1])||route[1]==='snapshot'&&snapshotRead)||url.search||url.hash)return response({error:{code:'NOT_FOUND'}},404);
  if(info.method!=='POST')return response({error:{code:'METHOD_NOT_ALLOWED'}},405);const header=k=>Headers.prototype.get.call(info.headers,k),credential=header('authorization');
  if(!/^Bearer [\x21-\x2b\x2d-\x7e]{1,8192}$/u.test(credential??''))return response({error:{code:'SDK_SESSION_REFUSED'}},401);
  if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(header('content-type')??'')||![null,'identity'].includes(header('content-encoding')))return response({error:{code:'INVALID_SDK_SESSION_REQUEST'}},400);
  const length=header('content-length');if(length!==null&&(!/^(0|[1-9][0-9]*)$/u.test(length)||!Number.isSafeInteger(Number(length))||Number(length)>maxRequestBytes))return response({error:{code:'SDK_SESSION_REQUEST_LIMIT'}},413);
  const deadlineMs=now()+maxRequestMs;life=createOperationLifetime({now,deadlineMs,signal:info.signal,errorFactory:code=>Object.assign(Error(code),{code})});
  const input=await jsonBody({...info,length:length===null?null:Number(length)},maxRequestBytes,life,life.check),method=route[1]==='list-subkeys'?'listSubkeys':route[1];
  const result=await life.run(signal=>(route[1]==='snapshot'?snapshotRead:methods[method])({credential:credential.slice(7),request:input,signal,deadlineMs}));life.check();return response(result);
 }catch(error){
  const d=error&&!types.isProxy(error)&&Object.getOwnPropertyDescriptor(error,'code'),code=d&&Object.hasOwn(d,'value')?d.value:undefined;
  const m=error&&!types.isProxy(error)&&Object.getOwnPropertyDescriptor(error,'message'),message=m&&Object.hasOwn(m,'value')?m.value:undefined;
  const known=['INVALID_SDK_SESSION_REQUEST','SDK_SESSION_UNAVAILABLE','SDK_SESSION_REFUSED','SDK_SESSION_NOT_REGISTERED','SDK_SESSION_STALE_OFFSET','SDK_SESSION_APPEND_CONFLICT','SDK_SESSION_ENTRY_CONFLICT','SDK_SESSION_COMMIT_UNKNOWN'];
  if(['INVALID_JSON','INVALID_UTF8','INVALID_BODY','INVALID_CONTENT_LENGTH'].includes(message))return response({error:{code:'INVALID_SDK_SESSION_REQUEST'}},400);
  if(message==='REQUEST_TOO_LARGE')return response({error:{code:'SDK_SESSION_REQUEST_LIMIT'}},413);
  const safe=known.includes(code)?code:'SDK_SESSION_UNAVAILABLE',status=safe==='INVALID_SDK_SESSION_REQUEST'?400:safe.includes('CONFLICT')||safe==='SDK_SESSION_STALE_OFFSET'?409:safe==='SDK_SESSION_REFUSED'?403:503;
  return response({error:{code:safe,...(safe==='SDK_SESSION_COMMIT_UNKNOWN'?{outcome:'UNKNOWN'}:{})}},status);
 }finally{life?.close();}}});
}
