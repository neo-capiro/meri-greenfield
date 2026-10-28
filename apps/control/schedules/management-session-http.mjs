/** Scope-only cold-page issuance. The existing session owner owns every authority/lifetime decision. */
import {types} from 'node:util';
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {receiveRoutineManagementSessionRequest,receiveRoutineManagementSessionReceipt,routineManagementSessionPath} from '../../../packages/contracts/dist/intents-application.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {isAuthorityUnavailable} from '../../../packages/runtime/authority-availability.mjs';
import {jsonBody,response,errorResponse} from '../action-application/http.mjs';
import {routineManagementSessions} from '../action-host/session/owner.mjs';
const getters=Object.fromEntries(['url','method','headers','signal','body'].map(name=>[name,Object.getOwnPropertyDescriptor(Request.prototype,name).get]));
export function createRoutineManagementSessionApplication(configuration){
 const c=own(configuration,['sessions','now','maxRequestMs']);const management=routineManagementSessions(c.sessions);
 if(typeof c.now!=='function'||!Number.isSafeInteger(c.maxRequestMs)||c.maxRequestMs<1||c.maxRequestMs>30000)throw Error('ROUTINES_CONFIGURATION');
 return Object.freeze({async handle(request){let life;const fail=(status,code)=>response({error:{code,outcome:'NOT_DISPATCHED'}},status);
  try{
   if(!request||types.isProxy(request)||!(request instanceof Request))return fail(400,'INVALID_REQUEST');
   const info=Object.fromEntries(Object.entries(getters).map(([k,g])=>[k,g.call(request)])),url=new URL(info.url),header=k=>Headers.prototype.get.call(info.headers,k);
   if(url.pathname!==routineManagementSessionPath)return null;if(url.search||url.hash)return fail(404,'NOT_FOUND');if(info.method!=='POST')return fail(405,'METHOD_NOT_ALLOWED');
   if(!management)return fail(503,'ROUTINES_UNAVAILABLE');
   if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(header('content-type')??'')||header('content-encoding')!==null)return fail(415,'UNSUPPORTED_MEDIA_TYPE');
   const authorization=header('authorization');if(typeof authorization!=='string'||!/^Bearer [\x21-\x2b\x2d-\x7e]{1,8192}$/u.test(authorization))return fail(401,'UNAUTHENTICATED');
   const length=header('content-length');if(length!==null&&(!/^(0|[1-9][0-9]*)$/u.test(length)||!Number.isSafeInteger(Number(length))||Number(length)>4096))return fail(413,'REQUEST_TOO_LARGE');
   const deadlineMs=c.now()+c.maxRequestMs;life=createOperationLifetime({deadlineMs,now:c.now,signal:info.signal,errorFactory:()=>Error('SESSION_REFUSED')});
   let selected;try{const raw=await jsonBody({...info,length:length===null?null:Number(length)},4096,life,life.check);selected=receiveRoutineManagementSessionRequest(JSON.stringify(raw));}
   catch(error){return fail(errorResponse(error,{}).status===413?413:400,'INVALID_REQUEST');}
   const issued=await life.run(signal=>management.issue({identityCredential:authorization.slice(7),clientId:selected.clientId,signal,deadlineMs}));life.check();
   const admitted=receiveRoutineManagementSessionReceipt(JSON.stringify(issued),{...issued.context,selectedClientId:selected.clientId},c.now());life.check();return response(admitted,200);
  }catch(error){return fail(isAuthorityUnavailable(error)?503:403,isAuthorityUnavailable(error)?'ROUTINES_UNAVAILABLE':'ROUTINES_ACCESS_DENIED');}finally{life?.close();}
 }});
}
