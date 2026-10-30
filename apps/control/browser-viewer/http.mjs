/** Fixed, bounded authenticated HTTP entry point. Viewer responses never enter
 * the chat stream, request logs, model channel or application caches. */
import {types} from 'node:util';
import {BROWSER_VIEWER_SCHEMA as schema,BROWSER_VIEWER_ROUTES,BROWSER_VIEWER_ERRORS,BROWSER_VIEWER_LIMITS,
 receiveBrowserViewerRequest} from '../../../packages/contracts/browser-viewer/receive.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {jsonBody} from '../action-application/http.mjs';
const get=name=>Object.getOwnPropertyDescriptor(Request.prototype,name).get;
const fail=code=>{throw Object.assign(Error(code),{code});};
function info(request){
 if(!request||types.isProxy(request))fail('INVALID_REQUEST');
 let value;try{value=Object.fromEntries(['url','method','headers','body','signal'].map(k=>[k,get(k).call(request)]));}catch{fail('INVALID_REQUEST');}
 const url=new URL(value.url),route=url.pathname.slice('/api/meri/browser/'.length);
 if(!url.pathname.startsWith('/api/meri/browser/')||!BROWSER_VIEWER_ROUTES.includes(route)||url.search||url.hash)fail('NOT_FOUND');
 if(value.method!=='POST')fail('METHOD_NOT_ALLOWED');
 const header=name=>Headers.prototype.get.call(value.headers,name),auth=header('authorization');
 if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(header('content-type')??'')||header('content-encoding'))fail('UNSUPPORTED_MEDIA_TYPE');
 if(!/^Bearer action_session_[A-Za-z0-9_-]{43}$/u.test(auth??''))fail('UNAUTHENTICATED');
 const length=header('content-length');
 if(length!==null&&(!/^(0|[1-9][0-9]*)$/u.test(length)||!Number.isSafeInteger(Number(length))))fail('INVALID_REQUEST');
 if(length!==null&&Number(length)>BROWSER_VIEWER_LIMITS.requestBytes)fail('TOO_LARGE');
 return {...value,route,credential:auth.slice(7),length:length===null?null:Number(length)};
}
const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff'};
const response=(value,status=200)=>new Response(JSON.stringify(value),{status,headers});
const aliases=new Map([['SESSION_REFUSED','ACCESS_DENIED'],['RETENTION_SUPPRESSED','NOT_FOUND'],
 ['BROWSER_VIEWER_AUTHORITY_REFUSED','ACCESS_DENIED'],['BROWSER_VIEWER_BUSY','CONFLICT'],
 ['BROWSER_VIEWER_STALE_LEASE','CONFLICT'],['BROWSER_VIEWER_NOT_HELD','CONFLICT'],
 ['BROWSER_VIEWER_TICKET_REFUSED','EXPIRED'],['BROWSER_VIEWER_PAGE_REFUSED','CONFLICT']]);
export function createBrowserViewerHttp({application,now=Date.now,maxRequestMs=30000}){
 if(typeof application?.execute!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)fail('BROWSER_VIEWER_CONFIGURATION');
 return Object.freeze({async handle(request){let life,started=false,writing=false;
  try{
   const q=info(request);writing=!['read','frame'].includes(q.route);
   life=createOperationLifetime({now,signal:q.signal,deadlineMs:now()+maxRequestMs,errorFactory:code=>Object.assign(Error(code),{code})});
   let input;try{input=receiveBrowserViewerRequest(q.route,new TextEncoder().encode(JSON.stringify(await jsonBody(q,BROWSER_VIEWER_LIMITS.requestBytes,life,life.check))));}
   catch{life.check();fail('INVALID_REQUEST');}
   started=true;const result=await life.run(signal=>application.execute(q.route,input,{credential:q.credential,signal}));
   life.check();if(Buffer.byteLength(JSON.stringify(result))>BROWSER_VIEWER_LIMITS.responseBytes)fail('TOO_LARGE');
   return response(result);
  }catch(error){
   const descriptors=error&&typeof error==='object'&&!types.isProxy(error)?Object.getOwnPropertyDescriptors(error):{};
   const named=descriptors.code?.value,code=typeof named==='string'&&Object.hasOwn(BROWSER_VIEWER_ERRORS,named)?named:aliases.get(named)??'REFUSED';
   return response({schema,error:{code,outcome:started?writing?'UNKNOWN':'READ_UNAVAILABLE':'NOT_DISPATCHED'}},BROWSER_VIEWER_ERRORS[code]);
  }finally{life?.close();try{const body=get('body').call(request);if(body&&!body.locked)void body.cancel().catch(()=>{});}catch{}}
 }});
}
