/** WOPI HTTP syntax and bounded binary input. No authority or persistence. */
import {types} from 'node:util';
import {OFFICE_DRAFT_MAX_BYTES} from './core-draft-wire.mjs';
export const WOPI_FILE_ROUTE=/^\/api\/meri\/office\/wopi\/files\/([A-Za-z0-9_-]{1,128})(\/contents)?$/u;
const errors=new WeakMap();
export function refuse(status){const error=Error('WOPI_REFUSED');errors.set(error,status);throw error;}
export const refusalStatus=error=>errors.get(error);
const getters=Object.fromEntries(['url','method','headers','signal','body'].map(k=>[k,Object.getOwnPropertyDescriptor(Request.prototype,k).get]));
const lock=value=>typeof value==='string'&&/^[\x20-\x7e]{1,1024}$/u.test(value);
const operations=Object.freeze({LOCK:'lock',REFRESH_LOCK:'refresh',UNLOCK:'unlock',GET_LOCK:'get',PUT_RELATIVE:'relative'});
export function wopiRequest(request){
 if(!request||types.isProxy(request))refuse(400);
 let r;try{r=Object.fromEntries(Object.entries(getters).map(([k,get])=>[k,get.call(request)]));}catch{refuse(400);}
 const url=new URL(r.url),route=WOPI_FILE_ROUTE.exec(url.pathname),header=name=>Headers.prototype.get.call(r.headers,name);
 if(!route||url.hash)refuse(404);
 if([...url.searchParams.keys()].some(k=>k!=='access_token')||url.searchParams.getAll('access_token').length!==1)refuse(401);
 const token=url.searchParams.get('access_token');if(!token||token.length>2200)refuse(401);
 const override=header('x-wopi-override'),oldLock=header('x-wopi-oldlock'),newLock=header('x-wopi-lock');
 let operation;
 if(r.method==='GET'){if(override!==null||oldLock!==null||newLock!==null)refuse(400);operation=route[2]?'getFile':'checkFileInfo';}
 else if(r.method==='POST'){
  operation=route[2]?(override==='PUT'?'save':null):Object.hasOwn(operations,override)?operations[override]:null;
  if(!operation)refuse(501);
  if(operation==='lock'&&oldLock!==null)operation='relock';
  if(['lock','refresh','unlock','relock'].includes(operation)&&!lock(newLock))refuse(400);
  if(operation==='save'&&newLock!==null&&!lock(newLock))refuse(400);
  if(operation==='relock'?!lock(oldLock):oldLock!==null)refuse(400);
  if(['get','relative'].includes(operation)&&newLock!==null)refuse(400);
 }else refuse(405);
 if(header('content-encoding')!==null)refuse(415);
 const rawLength=header('content-length');if(rawLength!==null&&!/^(0|[1-9][0-9]*)$/u.test(rawLength))refuse(400);
 const length=rawLength===null?null:Number(rawLength);
 if(length!==null&&(!Number.isSafeInteger(length)||length>OFFICE_DRAFT_MAX_BYTES))refuse(413);
 let maxExpectedSize=2147483647;
 const max=header('x-wopi-maxexpectedsize');
 if(max!==null){if(operation!=='getFile'||!/^(0|[1-9][0-9]*)$/u.test(max)||!Number.isSafeInteger(Number(max))||Number(max)>2147483647)refuse(400);maxExpectedSize=Number(max);}
 return {...r,fileId:route[1],token,operation,lock:newLock,oldLock,length,maxExpectedSize};
}
export async function wopiBody(info,life,limit=OFFICE_DRAFT_MAX_BYTES){
 if(info.length!==null&&info.length>limit)refuse(413);
 if(info.body===null){if(info.length!==null&&info.length!==0)refuse(400);return Buffer.alloc(0);}
 const reader=ReadableStream.prototype.getReader.call(info.body),chunks=[];let size=0,complete=false;
 try{
  while(true){const part=await life.run(()=>reader.read());if(part.done){complete=true;break;}
   if(!(part.value instanceof Uint8Array))refuse(400);size+=part.value.byteLength;if(size>limit)refuse(413);
   chunks.push(Buffer.from(part.value));
  }
  if(info.length!==null&&info.length!==size)refuse(400);return Buffer.concat(chunks,size);
 }finally{if(!complete){try{Promise.resolve(reader.cancel()).catch(()=>{});}catch{}}try{reader.releaseLock();}catch{}}
}
export function cancelWopiBody(request){
 try{const body=getters.body.call(request);if(body)Promise.resolve(ReadableStream.prototype.cancel.call(body)).catch(()=>{});}catch{}
}
export function wopiResponse(status,body=null,headers={}){
 return new Response(body,{status,headers:{...headers,'cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff'}});
}
