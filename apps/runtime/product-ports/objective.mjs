/** Private service-authenticated Core readback. The actual saved job selects all data; there are no signed-reader leases. */
import {timingSafeEqual} from 'node:crypto';
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {jsonBody} from '../../control/action-application/http.mjs';
import {MAX_OBJECTIVE_READBACK_BYTES} from '../objective-generation/retained-result.mjs';

export const OBJECTIVE_READER_PREFIX='/v1/internal/objective-generation/';
const routes=new Map(['acceptance','completion'].map(method=>[OBJECTIVE_READER_PREFIX+method+'/read',method]));
const headers=Object.freeze({'cache-control':'no-store','x-content-type-options':'nosniff'});
const fault=()=>Error('OBJECTIVE_READBACK_UNAVAILABLE');
const secret=value=>typeof value==='string'&&value.length>=16&&value.length<=8192&&!/[\s\x00-\x1f\x7f]/u.test(value);
export function createObjectiveFamily(_context){return {ports:{}};}

export function createObjectiveReaderApplication(options={}){
 const c=own(options,[],['reader','getServiceSecret','now','maxRequestMs']),now=c.now??Date.now,maxRequestMs=c.maxRequestMs??3000;
 if(typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000||
  (c.reader===undefined)!==(c.getServiceSecret===undefined)||c.getServiceSecret!==undefined&&typeof c.getServiceSecret!=='function')throw fault();
 const methods=c.reader?Object.fromEntries(['acceptance','completion'].map(k=>[k,storageMethod(c.reader,k)])):null;
 async function handle(request){
  let life;
  try{
   const url=new URL(request.url),method=routes.get(url.pathname);if(!method)return null;
   if(!methods||request.method!=='POST'||url.search||!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(request.headers.get('content-type')??'')||request.headers.has('content-encoding'))throw fault();
   life=createOperationLifetime({now,signal:request.signal,deadlineMs:now()+maxRequestMs,errorFactory:fault});
   const supplied=request.headers.get('x-internal-service-secret');if(!secret(supplied))throw fault();
   const expected=await life.run(signal=>c.getServiceSecret({signal}));life.check();
   if(!secret(expected))throw fault();const a=Buffer.from(supplied),b=Buffer.from(expected);if(a.length!==b.length||!timingSafeEqual(a,b))throw fault();
   const length=request.headers.get('content-length');if(length!==null&&(!/^[1-9][0-9]*$/u.test(length)||Number(length)>16384))throw fault();
   const body=await jsonBody({body:request.body,length:length===null?null:Number(length)},16384,life,life.check);
   own(body,['schemaVersion','generationJobId','sourceAdmissionSha256',...(method==='completion'?['binding']:[])]);
   const value=await life.run(signal=>methods[method]({...body,signal}));life.check();
   const encoded=JSON.stringify(value);if(Buffer.byteLength(encoded)>MAX_OBJECTIVE_READBACK_BYTES)throw fault();
   return new Response(encoded,{headers:{...headers,'content-type':'application/json; charset=utf-8'}});
  }catch{return Response.json({error:{code:'OBJECTIVE_READBACK_UNAVAILABLE'}},{status:503,headers});}finally{life?.close();}
 }
 return Object.freeze({handle,state:()=>methods?'composed':'disabled'});
}