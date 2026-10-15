/** Fixed issuance Fetch boundary; no native auth decoder, listener or ambient configuration. */
import {types} from 'node:util';
import {own} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {jsonBody,response as canonicalResponse,errorResponse as canonicalErrorResponse} from '../../action-application/http.mjs';
import {assertActionSessionReceipt} from './owner.mjs';
const getters=Object.fromEntries(['url','method','headers','signal','body'].map(k=>[k,Object.getOwnPropertyDescriptor(Request.prototype,k).get]));
const path='/api/action-followthrough/session';
const response=(status,value)=>canonicalResponse(value,status);
export function createActionSessionApplication(options){
 const {owner,maxRequestBytes=4096,maxRequestMs=3000,now=Date.now}=own(options,['owner'],['maxRequestBytes','maxRequestMs','now']);
 const {issue}=own(owner,['issue'],['authenticateSession','readCurrentState','verifyTransition','revoke','close','status']);
 if(typeof issue!=='function'||typeof now!=='function'||!Number.isSafeInteger(maxRequestBytes)||maxRequestBytes<1||maxRequestBytes>65536||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)throw Error('SESSION_CONFIGURATION');
 return Object.freeze({async handle(request){
  let life;const fail=(status,code)=>response(status,{error:{code}});
  try{
   if(!request||types.isProxy(request)||!(request instanceof Request))return fail(400,'SESSION_REQUEST_INVALID');
   const info=Object.fromEntries(Object.entries(getters).map(([k,g])=>[k,g.call(request)]));const header=k=>Headers.prototype.get.call(info.headers,k);
   const url=new URL(info.url);if(url.pathname!==path||url.search||url.hash)return fail(404,'SESSION_ROUTE_NOT_FOUND');if(info.method!=='POST')return fail(405,'SESSION_METHOD_REFUSED');
   if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(header('content-type')??'')||![null,'identity'].includes(header('content-encoding')))return fail(400,'SESSION_REQUEST_INVALID');
   const auth=header('authorization');if(typeof auth!=='string'||!/^Bearer [\x21-\x2b\x2d-\x7e]{1,8192}$/u.test(auth))return fail(401,'SESSION_REFUSED');
   const length=header('content-length');if(length!==null&&(!/^\d+$/u.test(length)||!Number.isSafeInteger(Number(length))||Number(length)>maxRequestBytes))return fail(413,'SESSION_REQUEST_TOO_LARGE');
   const deadlineMs=now()+maxRequestMs;life=createOperationLifetime({deadlineMs,now,signal:info.signal,errorFactory:()=>new Error('SESSION_REFUSED')});
   let hints;try{hints=await jsonBody({...info,length:length===null?null:Number(length)},maxRequestBytes,life,()=>life.check());}catch(error){const status=canonicalErrorResponse(error,{}).status;if(status===413)return fail(413,'SESSION_REQUEST_TOO_LARGE');if(status===400)return fail(400,'SESSION_REQUEST_INVALID');throw error;}
   try{own(hints,[],['conversationId','runId','clientId']);}catch{return fail(400,'SESSION_REQUEST_INVALID');}
   const issued=await life.run(signal=>issue({identityCredential:auth.slice(7),hints,signal,deadlineMs}));life.check();const admitted=assertActionSessionReceipt(issued,now());life.check();if(info.signal.aborted)throw Error('SESSION_REFUSED');return response(200,admitted);
  }catch{return fail(401,'SESSION_REFUSED');}finally{life?.close();}
 }});
}
export {path as actionSessionPath};
