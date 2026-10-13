/** Fixed issuance Fetch boundary; no native auth decoder, listener or ambient configuration. */
import {types} from 'node:util';
import {own} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
const path='/api/action-followthrough/session';
const response=(status,value)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
export function createActionSessionApplication(options){
 const {owner,maxRequestBytes=4096,maxRequestMs=3000,now=Date.now}=own(options,['owner'],['maxRequestBytes','maxRequestMs','now']);
 if(typeof owner?.issue!=='function'||typeof now!=='function'||!Number.isSafeInteger(maxRequestBytes)||maxRequestBytes<1||maxRequestBytes>65536||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)throw Error('SESSION_CONFIGURATION');
 return Object.freeze({async handle(request){
  let life,reader;const fail=(status,code)=>response(status,{error:{code}});
  try{
   if(!request||types.isProxy(request)||!(request instanceof Request))return fail(400,'SESSION_REQUEST_INVALID');
   const url=new URL(request.url);if(url.pathname!==path||url.search)return fail(404,'SESSION_ROUTE_NOT_FOUND');if(request.method!=='POST')return fail(405,'SESSION_METHOD_REFUSED');
   if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get('content-type')??'')||![null,'identity'].includes(request.headers.get('content-encoding')))return fail(400,'SESSION_REQUEST_INVALID');
   const auth=request.headers.get('authorization');if(typeof auth!=='string'||!/^Bearer [\x21-\x2b\x2d-\x7e]{1,8192}$/u.test(auth))return fail(401,'SESSION_REFUSED');
   const length=request.headers.get('content-length');if(length!==null&&(!/^\d+$/u.test(length)||!Number.isSafeInteger(Number(length))||Number(length)>maxRequestBytes))return fail(413,'SESSION_REQUEST_TOO_LARGE');
   life=createOperationLifetime({deadlineMs:now()+maxRequestMs,now,signal:request.signal,errorFactory:()=>new Error('SESSION_REFUSED')});
   if(!request.body)return fail(400,'SESSION_REQUEST_INVALID');reader=request.body.getReader();let bytes=0,text='';const decoder=new TextDecoder('utf-8',{fatal:true});
   for(;;){const chunk=await life.run(()=>reader.read());if(chunk.done)break;bytes+=chunk.value.byteLength;if(bytes>maxRequestBytes)return fail(413,'SESSION_REQUEST_TOO_LARGE');text+=decoder.decode(chunk.value,{stream:true});}text+=decoder.decode();if(length!==null&&bytes!==Number(length))return fail(400,'SESSION_REQUEST_INVALID');
   let hints;try{hints=JSON.parse(text);own(hints,[],['conversationId','runId','clientId']);}catch{return fail(400,'SESSION_REQUEST_INVALID');}
   const issued=await life.run(signal=>owner.issue({identityCredential:auth.slice(7),hints,signal}));life.check();if(request.signal.aborted)throw Error('SESSION_REFUSED');return response(200,issued);
  }catch{return fail(401,'SESSION_REFUSED');}finally{if(reader){try{Promise.resolve(reader.cancel()).catch(()=>{});}catch{}try{reader.releaseLock();}catch{}}life?.close();}
 }});
}
export {path as actionSessionPath};
