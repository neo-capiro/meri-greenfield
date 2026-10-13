/** Fetch-only transport; no listener, ambient configuration or credentials. */
import {types} from 'node:util';
import {CommandError} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
export class ApplicationError extends Error {constructor(code,status=400){super(code);this.code=code;this.status=status;}}
export const fail=(code,status)=>{throw new ApplicationError(code,status);};
const get=name=>Object.getOwnPropertyDescriptor(Request.prototype,name).get;
const getters=Object.fromEntries(['url','method','headers','signal','body'].map(name=>[name,get(name)]));
export function requestInfo(request){
 if(types.isProxy(request)||!(request instanceof Request))fail('INVALID_REQUEST');
 let values;try{values=Object.fromEntries(Object.entries(getters).map(([k,g])=>[k,g.call(request)]));}catch{fail('INVALID_REQUEST');}
 const url=new URL(values.url),match=/^\/api\/action-followthrough\/(query|draft|prepare|execute)$/u.exec(url.pathname);
 if(!match||url.search||url.hash)fail('NOT_FOUND',404);if(values.method!=='POST')fail('METHOD_NOT_ALLOWED',405);
 const header=name=>Headers.prototype.get.call(values.headers,name);
 if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(header('content-type')??''))fail('UNSUPPORTED_MEDIA_TYPE',415);
 if(header('content-encoding')!==null)fail('UNSUPPORTED_CONTENT_ENCODING',415);
 const auth=header('authorization');if(typeof auth!=='string'||!/^Bearer [A-Za-z0-9._~+\/-]{1,4096}={0,2}$/u.test(auth))fail('UNAUTHENTICATED',401);
 const length=header('content-length');if(length!==null&&!/^(0|[1-9][0-9]*)$/u.test(length))fail('INVALID_CONTENT_LENGTH');
 return {...values,intent:match[1],credential:auth.slice(7),length:length===null?null:Number(length)};
}
export async function jsonBody(info,limit,lifetime,check){
 if(info.length!==null&&(!Number.isSafeInteger(info.length)||info.length>limit))fail('REQUEST_TOO_LARGE',413);
 if(info.body===null)fail('INVALID_JSON');const reader=info.body.getReader();const chunks=[];let bytes=0,complete=false;
 try{while(true){const part=await lifetime.run(()=>reader.read());check();if(part.done){complete=true;break;}
   if(!(part.value instanceof Uint8Array))fail('INVALID_BODY');bytes+=part.value.byteLength;if(bytes>limit)fail('REQUEST_TOO_LARGE',413);chunks.push(part.value);
  }
  if(info.length!==null&&bytes!==info.length)fail('INVALID_CONTENT_LENGTH');
  let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks));}catch{fail('INVALID_UTF8');}
  try{return JSON.parse(text);}catch{fail('INVALID_JSON');}
 }finally{if(!complete){try{Promise.resolve(reader.cancel()).catch(()=>{});}catch{}}try{reader.releaseLock();}catch{}}
}
export function response(value,status=200){return new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});}
const codes=new Set(['ACCESS_DENIED','DEADLINE','CANCELLED','LOOKUP_REPLAY','LOOKUP_UNAVAILABLE','COMMAND_APPROVAL_REFUSED','COMMAND_AUTHORITY_REFUSED','COMMAND_PREPARATION_REFUSED','COMMAND_REFUSED','COMMAND_OUTCOME_UNKNOWN','COMMAND_COMMIT_UNCERTAIN','UNAVAILABLE']);
const outcomes=new Set(['NOT_DISPATCHED','UNKNOWN','RESULT_NOT_RELEASED','STORED_NOT_RELEASED']);
export function errorResponse(error,state){
 let code='REQUEST_FAILED',status=502,outcome;
 if(error instanceof ApplicationError){code=error.code;status=error.status;}
 else if(error instanceof CommandError&&codes.has(error.message))code=error.message;
 else if(error&&typeof error==='object'&&!types.isProxy(error)){
  const c=Object.getOwnPropertyDescriptor(error,'code'),o=Object.getOwnPropertyDescriptor(error,'outcome');
  if(c&&Object.hasOwn(c,'value')&&codes.has(c.value))code=c.value;
  if(o&&Object.hasOwn(o,'value')&&outcomes.has(o.value))outcome=o.value;
 }
 if(!outcome)outcome=state.knownResult||state.queryStored?'RESULT_NOT_RELEASED':state.executionStarted||state.prepareStarted||state.queryStarted?'UNKNOWN':'NOT_DISPATCHED';
 if(['COMMAND_APPROVAL_REFUSED','COMMAND_AUTHORITY_REFUSED','COMMAND_PREPARATION_REFUSED'].includes(code)&&!state.knownResult)outcome='NOT_DISPATCHED';
 if(['COMMAND_OUTCOME_UNKNOWN','COMMAND_COMMIT_UNCERTAIN'].includes(code))outcome='UNKNOWN';
 if(code==='ACCESS_DENIED')status=403;else if(code==='COMMAND_APPROVAL_REFUSED')status=409;else if(code==='DEADLINE')status=408;else if(code==='CANCELLED')status=499;else if(code==='LOOKUP_REPLAY')status=409;
 return response({error:{code,outcome}},status);
}
