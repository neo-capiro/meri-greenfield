/** Bounded Fetch adapter for the versioned Office control wire. No listener,
 * ambient credentials, retries or Save route. CODE saves only through WOPI. */
import {types} from 'node:util';
import {OFFICE_SCHEMA,OFFICE_ROUTES,OFFICE_ERROR_STATUSES,receiveOfficeRequest} from '../../packages/contracts/dist/office-application.mjs';
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
import {jsonBody} from './action-application/http.mjs';
const get=name=>Object.getOwnPropertyDescriptor(Request.prototype,name).get;
const faults=new WeakMap(),fail=code=>{const e=Error(code);faults.set(e,code);throw e;};
function requestInfo(request){
 if(!request||types.isProxy(request))fail('INVALID_REQUEST');
 let info;try{info=Object.fromEntries(['url','method','headers','body','signal'].map(k=>[k,get(k).call(request)]));}catch{fail('INVALID_REQUEST');}
 const url=new URL(info.url),name=url.pathname.slice('/api/meri/office/'.length);
 if(!url.pathname.startsWith('/api/meri/office/')||!OFFICE_ROUTES.includes(name)||url.search||url.hash)fail('NOT_FOUND');
 if(info.method!=='POST')fail('METHOD_NOT_ALLOWED');
 const header=name=>Headers.prototype.get.call(info.headers,name),auth=header('authorization');
 if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(header('content-type')??'')||header('content-encoding'))fail('UNSUPPORTED_MEDIA_TYPE');
 if(!/^Bearer action_session_[A-Za-z0-9_-]{43}$/u.test(auth??''))fail('UNAUTHENTICATED');
 const length=header('content-length');if(length!==null&&!/^(0|[1-9][0-9]*)$/u.test(length))fail('INVALID_REQUEST');
 return {...info,route:name,credential:auth.slice(7),length:length===null?null:Number(length)};
}
const mapped=new Map([
 ['OFFICE_IMPORT_UNRESOLVED','IMPORT_UNRESOLVED'],['OFFICE_IMPORT_UNAVAILABLE','UNAVAILABLE'],
 ['UPLOAD_ACCESS_DENIED','ACCESS_DENIED'],['UPLOAD_NOT_CLEAN','CONFLICT'],['UPLOAD_ORIGINAL_MISMATCH','CONFLICT'],['UPLOAD_NOT_FOUND','NOT_FOUND'],
 ['SESSION_REFUSED','ACCESS_DENIED'],['ARTIFACT_AUTHORITY','ACCESS_DENIED'],['RETENTION_SUPPRESSED','NOT_FOUND'],
 ['OFFICE_DRAFT_ACCESS_DENIED','ACCESS_DENIED'],['OFFICE_DRAFT_UNAVAILABLE','NOT_FOUND'],['OFFICE_DRAFT_EXPIRED','NOT_FOUND'],
 ['OFFICE_DRAFT_CONFLICT','CONFLICT'],['EDITOR_DRAFT_CHANGED','CONFLICT'],['EDITOR_SOURCE_MISMATCH','CONFLICT'],['ARTIFACT_STALE_PARENT','CONFLICT'],
 ['EDITOR_PUBLISH_UNRESOLVED','PUBLISH_UNRESOLVED'],['EDITOR_PUBLISH_TOO_LARGE','TOO_LARGE'],['EDITOR_CODE_ACTION_UNAVAILABLE','UNAVAILABLE'],
 ['ARTIFACT_CANCELLED','CANCELLED'],['ARTIFACT_DEADLINE','DEADLINE'],
]);
const response=(value,status=200)=>new Response(JSON.stringify({schema:OFFICE_SCHEMA,...value}),{status,
 headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff'}});
export function createOfficeControlApplication({application,now,maxRequestMs=30000}){
 if(typeof application?.execute!=='function'||typeof now!=='function'||!Number.isInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>60000)throw Error('OFFICE_CONFIGURATION');
 return Object.freeze({async handle(request){let life,started=false,completed=false,writing=false;
  try{
   const info=requestInfo(request);writing=!['read','inspect'].includes(info.route);
   if(info.signal.aborted)fail('CANCELLED');
   life=createOperationLifetime({now,signal:info.signal,deadlineMs:now()+maxRequestMs,errorFactory:code=>{const e=Error(code);faults.set(e,code);return e;}});
   if(info.length!==null&&(!Number.isSafeInteger(info.length)||info.length>8192))fail('TOO_LARGE');
   let received;
   try{const body=await jsonBody(info,8192,life,life.check);received=receiveOfficeRequest(info.route,Buffer.from(JSON.stringify(body)));}
   catch(error){life.check();if(faults.has(error))throw error;fail('INVALID_REQUEST');}
   const {schema,...value}=received;started=true;
   const result=await life.run(signal=>application.execute(info.route,value,{credential:info.credential,deadlineMs:life.deadline(),signal}));completed=true;
   life.check();if(Buffer.byteLength(JSON.stringify(result))>2*1024*1024)fail('TOO_LARGE');
   return response(result);
  }catch(error){
   const d=error&&typeof error==='object'&&!types.isProxy(error)?Object.getOwnPropertyDescriptors(error):{};
   const named=faults.get(error)??d.code?.value;
   const code=typeof named==='string'&&Object.hasOwn(OFFICE_ERROR_STATUSES,named)?named:mapped.get(named)??'REFUSED';
   // Once a write workflow is entered, a later error cannot prove none of its
   // earlier Core effects committed. Recovery always uses the same selection.
   const outcome=completed?'RESULT_NOT_RELEASED':started?writing?'UNKNOWN':'READ_UNAVAILABLE':'NOT_DISPATCHED';
   return response({error:{code,outcome}},OFFICE_ERROR_STATUSES[code]);
  }finally{
   life?.close();try{const body=get('body').call(request);if(body&&!body.locked)Promise.resolve(body.cancel()).catch(()=>{});}catch{}
  }
 }});
}
