/** Fixed issuance Fetch boundary; no native auth decoder, listener or ambient configuration. */
import {types} from 'node:util';
import {own} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {markAuthorityUnavailable,isAuthorityUnavailable} from '../../../../packages/runtime/authority-availability.mjs';
import {jsonBody,response as canonicalResponse,errorResponse as canonicalErrorResponse} from '../../action-application/http.mjs';
import {assertActionSessionReceipt} from './owner.mjs';
const getters=Object.fromEntries(['url','method','headers','signal','body'].map(k=>[k,Object.getOwnPropertyDescriptor(Request.prototype,k).get]));
const path='/api/action-followthrough/session';
const response=(status,value)=>canonicalResponse(value,status);
export function createActionSessionApplication(options){
 const {owner,maxRequestBytes=4096,maxRequestMs=3000,now=Date.now,sessionPath=path}=own(options,['owner'],['maxRequestBytes','maxRequestMs','now','sessionPath']);
 if(![path,'/api/action-followthrough/browser-session'].includes(sessionPath))throw Error('SESSION_CONFIGURATION');
 const {issue}=own(owner,['issue'],['issueDerived','authenticateSession','readCurrentState','verifyTransition','nativeCredentialFor','revoke','close','status']);
 if(typeof issue!=='function'||typeof now!=='function'||!Number.isSafeInteger(maxRequestBytes)||maxRequestBytes<1||maxRequestBytes>65536||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)throw Error('SESSION_CONFIGURATION');
 return Object.freeze({async handle(request){
  let life,aborted=()=>false;const fail=(status,code)=>response(status,{error:{code}});
  try{
   if(!request||types.isProxy(request)||!(request instanceof Request))return fail(400,'SESSION_REQUEST_INVALID');
   const info=Object.fromEntries(Object.entries(getters).map(([k,g])=>[k,g.call(request)]));aborted=()=>info.signal.aborted;const header=k=>Headers.prototype.get.call(info.headers,k);
   const url=new URL(info.url);if(url.pathname!==sessionPath||url.search||url.hash)return fail(404,'SESSION_ROUTE_NOT_FOUND');if(info.method!=='POST')return fail(405,'SESSION_METHOD_REFUSED');
   if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(header('content-type')??'')||![null,'identity'].includes(header('content-encoding')))return fail(400,'SESSION_REQUEST_INVALID');
   const auth=header('authorization');if(typeof auth!=='string'||!/^Bearer [\x21-\x2b\x2d-\x7e]{1,8192}$/u.test(auth))return fail(401,'SESSION_REFUSED');
   const length=header('content-length');if(length!==null&&(!/^\d+$/u.test(length)||!Number.isSafeInteger(Number(length))||Number(length)>maxRequestBytes))return fail(413,'SESSION_REQUEST_TOO_LARGE');
   // Running out of this route's own budget without a caller cancellation means the authority owner did not answer, as the
   // owner's own lifetime already decides (owner.mjs); it is never a refusal of the credential or the membership.
   const deadlineMs=now()+maxRequestMs;life=createOperationLifetime({deadlineMs,now,signal:info.signal,errorFactory:code=>code==='DEADLINE'&&!info.signal.aborted?markAuthorityUnavailable(new Error('SESSION_AUTHORITY_UNAVAILABLE')):new Error('SESSION_REFUSED')});
   let hints;try{hints=await jsonBody({...info,length:length===null?null:Number(length)},maxRequestBytes,life,()=>life.check());}catch(error){const status=canonicalErrorResponse(error,{}).status;if(status===413)return fail(413,'SESSION_REQUEST_TOO_LARGE');if(status===400)return fail(400,'SESSION_REQUEST_INVALID');return aborted()?fail(503,'SESSION_UNAVAILABLE'):fail(401,'SESSION_REFUSED');}
   try{own(hints,[],['conversationId','runId','clientId','scopeKind']);}catch{return fail(400,'SESSION_REQUEST_INVALID');}
   const issued=await life.run(signal=>issue({identityCredential:auth.slice(7),hints,signal,deadlineMs}));life.check();const admitted=assertActionSessionReceipt(issued,now(),{research:hints.scopeKind==='research_portfolio'});life.check();if(info.signal.aborted)throw Error('SESSION_REFUSED');return response(200,admitted);
  // Core (identity, membership or current context) did not answer: 503, so the client keeps its conversation and asks again.
  // A full session table or a request its caller abandoned refuses nothing either: 503, so a client may read every 401 as a
  // definitive refusal. Every refusal, mismatch, expiry and malformed receipt stays 401, content-free, as before.
  }catch(error){return isAuthorityUnavailable(error)?fail(503,'SESSION_AUTHORITY_UNAVAILABLE'):error?.code==='SESSION_CAPACITY'||aborted()?fail(503,'SESSION_UNAVAILABLE'):fail(401,'SESSION_REFUSED');}finally{life?.close();}
 }});
}
export {path as actionSessionPath};
