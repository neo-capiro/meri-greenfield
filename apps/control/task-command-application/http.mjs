/** Task-command route admission. Shared bounded JSON/error responses stay with the canonical action HTTP transport. */
import {types} from 'node:util';
import {fail} from '../action-application/http.mjs';
const getters=Object.fromEntries(['url','method','headers','signal','body'].map(k=>[k,Object.getOwnPropertyDescriptor(Request.prototype,k).get]));
export function taskRequest(request){
 if(!request||types.isProxy(request)||!(request instanceof Request))fail('INVALID_REQUEST');
 const info=Object.fromEntries(Object.entries(getters).map(([k,g])=>[k,g.call(request)])),url=new URL(info.url);
 const match=/^\/api\/task-commands\/(prepare|execute)$/u.exec(url.pathname);
 if(!match||url.search||url.hash)fail('NOT_FOUND',404);if(info.method!=='POST')fail('METHOD_NOT_ALLOWED',405);
 const header=k=>Headers.prototype.get.call(info.headers,k);
 if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(header('content-type')??'')||header('content-encoding')!==null)fail('UNSUPPORTED_MEDIA_TYPE',415);
 const auth=header('authorization');if(typeof auth!=='string'||!/^Bearer [A-Za-z0-9._~+/-]{1,4096}={0,2}$/u.test(auth))fail('UNAUTHENTICATED',401);
 const length=header('content-length');if(length!==null&&!/^(0|[1-9][0-9]*)$/u.test(length))fail('INVALID_CONTENT_LENGTH');
 return {...info,intent:match[1],credential:auth.slice(7),length:length===null?null:Number(length)};
}
