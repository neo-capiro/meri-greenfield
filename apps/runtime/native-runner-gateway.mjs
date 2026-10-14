/** Fixed trusted-stack relay. Control retains task verification, observation and all effects. */
import {types} from 'node:util';
import {own} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {runOwnerOperations} from '../../packages/contracts/runtime-0.2/validate.mjs';
import {sdkSessionOperations} from '../../packages/contracts/runtime-0.2/session.mjs';
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
import {response} from '../control/action-application/http.mjs';

const requestGet=Object.fromEntries(['url','method','headers','body','signal'].map(k=>[k,Object.getOwnPropertyDescriptor(Request.prototype,k).get]));
const replyGet=Object.fromEntries(['status','headers','body','redirected'].map(k=>[k,Object.getOwnPropertyDescriptor(Response.prototype,k).get]));
const relayErrors=new WeakMap();
class RelayError extends Error{constructor(code,status=503){super(code);relayErrors.set(this,Object.freeze({code,status}));}}
const fail=(code,status)=>{throw new RelayError(code,status);};
function length(headers,limit){const value=Headers.prototype.get.call(headers,'content-length');if(value===null)return null;if(!/^(0|[1-9][0-9]*)$/u.test(value)||!Number.isSafeInteger(Number(value)))fail('NATIVE_GATEWAY_LENGTH',400);const n=Number(value);if(n>limit)fail('NATIVE_GATEWAY_LIMIT',413);return n;}
function cancelReply(value){try{if(value&&!types.isProxy(value)&&value instanceof Response){const body=replyGet.body.call(value);if(body)void ReadableStream.prototype.cancel.call(body).catch(()=>{});}}catch{}}
async function bytes(body,limit,expected,life){
 if(!body)fail('NATIVE_GATEWAY_BODY',400);let reader,complete=false,count=0;const chunks=[];
 try{reader=ReadableStream.prototype.getReader.call(body);for(;;){const part=await life.run(()=>reader.read());life.check();if(part.done){complete=true;break;}if(types.isProxy(part.value)||!(part.value instanceof Uint8Array))fail('NATIVE_GATEWAY_BODY',400);count+=part.value.byteLength;if(count>limit)fail('NATIVE_GATEWAY_LIMIT',413);chunks.push(Buffer.from(part.value));}if(expected!==null&&expected!==count)fail('NATIVE_GATEWAY_LENGTH',400);return Buffer.concat(chunks);}
 finally{if(reader){if(!complete){try{void reader.cancel().catch(()=>{});}catch{}}try{reader.releaseLock();}catch{}}}
}
export function createNativeRunnerGateway(configuration){
 const {controlOrigin,fetchImpl,limits,enabled=false,loopback=false,now=Date.now}=own(configuration,['controlOrigin','fetchImpl','limits'],['enabled','loopback','now']);
 const l=own(limits,['maxRequestMs','maxRequestBytes','maxResponseBytes']);let origin;
 if(typeof controlOrigin!=='string')fail('NATIVE_GATEWAY_CONFIGURATION');
 try{const url=new URL(controlOrigin);if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||!(url.protocol==='https:'||loopback&&url.protocol==='http:'&&['127.0.0.1','[::1]'].includes(url.hostname)))throw Error();origin=url.origin;}catch{fail('NATIVE_GATEWAY_CONFIGURATION');}
 if(typeof enabled!=='boolean'||typeof loopback!=='boolean'||typeof fetchImpl!=='function'||types.isProxy(fetchImpl)||typeof now!=='function'||!Number.isSafeInteger(l.maxRequestMs)||l.maxRequestMs<1||l.maxRequestMs>30000||!Number.isSafeInteger(l.maxRequestBytes)||l.maxRequestBytes<1||l.maxRequestBytes>9437184||!Number.isSafeInteger(l.maxResponseBytes)||l.maxResponseBytes<1||l.maxResponseBytes>35651584)fail('NATIVE_GATEWAY_CONFIGURATION');
 const routes=new Map([...Object.keys(runOwnerOperations).map(op=>['/v1/runner/'+op,{path:'/internal/conversations/'+op,session:false}]),...[...sdkSessionOperations,'snapshot'].map(op=>['/v1/runner/session/'+op,{path:'/v1/runner/session/'+op,session:true}])]);
 return Object.freeze({async handle(request){let life,upstream,dispatched=false;try{
  if(!request||types.isProxy(request)||!(request instanceof Request))fail('NATIVE_GATEWAY_REQUEST',400);
  const info=Object.fromEntries(Object.entries(requestGet).map(([k,get])=>[k,get.call(request)])),url=new URL(info.url),route=routes.get(url.pathname);
  if(!route)return null;if(url.search||url.hash)fail('NATIVE_GATEWAY_REQUEST',400);if(info.method!=='POST')fail('NATIVE_GATEWAY_METHOD',405);if(!enabled)fail('NATIVE_GATEWAY_UNAVAILABLE');
  const header=k=>Headers.prototype.get.call(info.headers,k),authorization=header('authorization');
  if(!/^Bearer [\x21-\x2b\x2d-\x7e]{1,8192}$/u.test(authorization??''))fail('NATIVE_GATEWAY_REFUSED',401);
  if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(header('content-type')??'')||![null,'identity'].includes(header('content-encoding')))fail('NATIVE_GATEWAY_MEDIA',415);
  const requestLimit=Math.min(l.maxRequestBytes,route.session?9437184:131072),expected=length(info.headers,requestLimit);
  const started=now();if(!Number.isSafeInteger(started)||started<0)fail('NATIVE_GATEWAY_CONFIGURATION');
  life=createOperationLifetime({now,deadlineMs:started+l.maxRequestMs,signal:info.signal,errorFactory:code=>new RelayError(code,['DEADLINE','CANCELLED'].includes(code)?408:503)});
  const body=await bytes(info.body,requestLimit,expected,life);life.check();
  const headers={authorization,'content-type':header('content-type'),accept:'application/json',...(header('content-encoding')===null?{}:{'content-encoding':header('content-encoding')})};
  upstream=await life.run(signal=>{dispatched=true;const pending=Promise.resolve(fetchImpl(origin+route.path,{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',headers,body,signal}));pending.then(value=>{upstream=value;if(life.signal.aborted)cancelReply(value);},()=>{});return pending;});
  if(!upstream||types.isProxy(upstream)||!(upstream instanceof Response)||replyGet.redirected.call(upstream))fail('NATIVE_GATEWAY_UNAVAILABLE');
  const status=replyGet.status.call(upstream),replyHeaders=replyGet.headers.call(upstream),replyHeader=k=>Headers.prototype.get.call(replyHeaders,k);
  if(!(status===200||status>=400&&status<=599)||!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(replyHeader('content-type')??'')||![null,'identity'].includes(replyHeader('content-encoding')))fail('NATIVE_GATEWAY_UNAVAILABLE');
  const replyLimit=Math.min(l.maxResponseBytes,route.session?35651584:2097152),reply=await bytes(replyGet.body.call(upstream),replyLimit,length(replyHeaders,replyLimit),life);life.check();
  return new Response(reply,{status,headers:{'content-type':replyHeader('content-type'),'cache-control':'no-store','x-content-type-options':'nosniff'}});
 }catch(error){const facts=error&&typeof error==='object'&&!types.isProxy(error)?relayErrors.get(error):undefined;return response({error:{code:facts?.code??'NATIVE_GATEWAY_UNAVAILABLE',outcome:dispatched?'UNKNOWN':'NOT_DISPATCHED'}},facts?.status??503);}
 finally{cancelReply(upstream);life?.close();}}});
}
