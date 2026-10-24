/** Additive native SDK-session RPC; opaque data never crosses ordinary depth64 decoding. */
import {randomUUID} from 'node:crypto';import {types} from 'node:util';
import {own} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {assertSdkSessionRequestHeaders,assertSdkSessionResponseHeaders,assertNativeSessionReference} from '../../../packages/contracts/runtime-0.2/session.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {createRunBoundSessionStore,copySessionEntries,copySessionTranscript,scopedSessionKey} from '../../worker/qualification/checkpoint/bound-session-store.mjs';
import {copySessionJson} from '../../worker/qualification/checkpoint/session-store-data.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {pinnedStatusRefusal} from '../runner-runtime-diagnostics.mjs';
import {RUNNER_SESSION_RPC_MS,RUNNER_SESSION_STORE_CALL_MS} from '../../../packages/runtime/runner-load-budget.mjs';
const fail=code=>{throw Object.assign(Error(code),{code});},get=Object.fromEntries(['status','headers','body','redirected'].map(k=>[k,Object.getOwnPropertyDescriptor(Response.prototype,k).get]));
export function createNativeSdkSessionClient(configuration){
 const {origin,credential,binding,fetchImpl,now=Date.now,maxRequestMs,maxResponseBytes=35651584,startupMaxRequestMs,startupExpiresAtMs}=own(configuration,['origin','credential','binding','fetchImpl'],['now','maxRequestMs','maxResponseBytes','startupMaxRequestMs','startupExpiresAtMs']);
 let url;try{url=new URL(origin);}catch{fail('SDK_SESSION_CONFIGURATION');}if(url.protocol!=='https:'||url.pathname!=='/'||url.username||url.password||url.search||url.hash||typeof credential!=='string'||!credential||!/^\S{1,8192}$/u.test(credential)||typeof fetchImpl!=='function'||types.isProxy(fetchImpl)||typeof now!=='function'||maxRequestMs!==undefined&&(!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)||!Number.isSafeInteger(maxResponseBytes)||maxResponseBytes<1||maxResponseBytes>35651584||(startupMaxRequestMs===undefined)!==(startupExpiresAtMs===undefined)||startupMaxRequestMs!==undefined&&(!Number.isSafeInteger(startupMaxRequestMs)||startupMaxRequestMs<1||startupMaxRequestMs>23000||!Number.isSafeInteger(startupExpiresAtMs)||startupExpiresAtMs<1))fail('SDK_SESSION_CONFIGURATION');
 const ownedBinding=assertSdkSessionRequestHeaders('load',{binding,key:{projectKey:'validation-only',sessionId:'11111111-1111-4111-8111-111111111111'}}).binding;
 // Only the first real request for each pre-model mirror operation may use
 // the trusted startup window. Every later call keeps the ordinary cap.
 const startupPending=new Set(startupMaxRequestMs===undefined?[]:['register','load','append']);
 async function call(operation,value,{signal,deadlineMs}={}){
  const fields=own(value,operation==='snapshot'?[]:['key',...(operation==='append'?['appendId','expectedOffset','entriesSha256','entries']:[])]),headers=operation==='snapshot'?{binding:ownedBinding}:assertSdkSessionRequestHeaders(operation,{binding:ownedBinding,...fields}),entries=operation==='append'?copySessionEntries(fields.entries):undefined;
  if(entries!==undefined&&hash(entries)!==headers.entriesSha256)fail('INVALID_SDK_SESSION_REQUEST');const body=JSON.stringify({...headers,...(entries===undefined?{}:{entries})});if(Buffer.byteLength(body)>9437184)fail('SDK_SESSION_REQUEST_LIMIT');
  // Each operation takes its own allowance from the stage table; `maxRequestMs` only lowers it.
  const started=now(),startup=startupPending.delete(operation),requestMs=startup?startupMaxRequestMs:Math.min(maxRequestMs??Infinity,RUNNER_SESSION_RPC_MS[operation]);
  const life=createOperationLifetime({now,deadlineMs:Math.min(deadlineMs??started+requestMs,started+requestMs,...(startup?[startupExpiresAtMs]:[])),signal,errorFactory:code=>Object.assign(Error('SDK_SESSION_'+code),{code:'SDK_SESSION_'+code})});let reader,response;
  try{response=await life.run(signal=>{const pending=Promise.resolve(fetchImpl(url.origin+'/v1/runner/session/'+operation,{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',headers:{authorization:'Bearer '+credential,'content-type':'application/json'},body,signal}));pending.then(r=>{if(life.signal.aborted)try{get.body.call(r)?.cancel().catch(()=>{});}catch{}},()=>{});return pending;});
   if(types.isProxy(response)||!(response instanceof Response)||get.redirected.call(response))fail('SDK_SESSION_UNAVAILABLE');
   // A non-200 answer keeps its fixed status class as `cause` for RUNNER_FIRST_FAILURE; its body is never read.
   const status=get.status.call(response);if(status!==200)throw Object.defineProperty(Object.assign(Error('SDK_SESSION_UNAVAILABLE'),{code:'SDK_SESSION_UNAVAILABLE'}),'cause',{value:pinnedStatusRefusal(status),configurable:true,writable:true});const h=get.headers.call(response),header=k=>Headers.prototype.get.call(h,k),stream=get.body.call(response);
   if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(header('content-type')??'')||![null,'identity'].includes(header('content-encoding'))||!stream)fail('SDK_SESSION_UNAVAILABLE');
   const length=header('content-length');if(length!==null&&(!/^(0|[1-9][0-9]*)$/u.test(length)||!Number.isSafeInteger(Number(length))||Number(length)>maxResponseBytes))fail('SDK_SESSION_RESPONSE_LIMIT');reader=stream.getReader();let bytes=0;const chunks=[];
   while(true){const next=await life.run(()=>reader.read());if(next.done)break;bytes+=next.value.byteLength;if(bytes>maxResponseBytes)fail('SDK_SESSION_RESPONSE_LIMIT');chunks.push(next.value);}if(length!==null&&Number(length)!==bytes)fail('SDK_SESSION_UNAVAILABLE');
   const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));if(operation!=='snapshot')assertSdkSessionResponseHeaders(operation,value,hash({...headers,...(entries===undefined?{}:{entries})}),ownedBinding,headers.key);let result;
   if(operation==='snapshot'){
    const native=Object.hasOwn(value,'sdkSession'),fields=own(value,['binding','key','transcripts',...(native?['sdkSession']:['checkpointSha256','opaqueSessionSha256'])]);
    if(hash(fields.binding)!==hash(ownedBinding))fail('SDK_SESSION_UNAVAILABLE');
    if(native){const session=assertNativeSessionReference(fields.sdkSession);if(hash(session.key)!==hash(fields.key))fail('SDK_SESSION_UNAVAILABLE');}
    else if([fields.checkpointSha256,fields.opaqueSessionSha256].some(x=>typeof x!=='string'||! /^[a-f0-9]{64}$/u.test(x)))fail('SDK_SESSION_UNAVAILABLE');
    result=copySessionJson(fields,maxResponseBytes);
   }
   else if(operation==='load'){if(!Number.isSafeInteger(value.offset)||value.offset<0||value.offset>100000)fail('SDK_SESSION_UNAVAILABLE');result={entries:value.entries===null?null:copySessionTranscript(value.entries),offset:value.offset};if(result.entries===null?result.offset!==0:result.entries.length!==result.offset)fail('SDK_SESSION_UNAVAILABLE');}
   else if(operation==='list-subkeys'){if(!Array.isArray(value.subkeys)||value.subkeys.length>255||new Set(value.subkeys).size!==value.subkeys.length)fail('SDK_SESSION_UNAVAILABLE');for(const subpath of value.subkeys)scopedSessionKey({...headers.key,subpath},headers.key);result=copySessionJson(value,maxResponseBytes);}
   else if(operation==='register'){if(value.registered!==true||hash(value.key)!==hash(headers.key))fail('SDK_SESSION_UNAVAILABLE');result=copySessionJson(value,maxResponseBytes);}
   else{if(value.committed!==true||value.appendId!==headers.appendId||hash(value.key)!==hash(headers.key)||value.entriesSha256!==headers.entriesSha256||!Number.isSafeInteger(value.offset)||value.offset<headers.expectedOffset||value.offset>100000||!Number.isSafeInteger(value.added)||value.added<0||value.added>entries.length||value.offset!==headers.expectedOffset+value.added)fail('SDK_SESSION_UNAVAILABLE');result=copySessionJson(value,maxResponseBytes);}life.check();return result;
  }finally{try{if(reader){void reader.cancel().catch(()=>{});reader.releaseLock();}else if(response&&!types.isProxy(response)&&response instanceof Response)void get.body.call(response)?.cancel().catch(()=>{});}catch{}life.close();}
 }
 // Raw methods preserve caller-owned append identity. No automatic retry or SDK receipt promotion.
 return Object.freeze({snapshot:(input,options)=>call('snapshot',input,options),register:(input,options)=>call('register',input,options),load:(input,options)=>call('load',input,options),append:(input,options)=>call('append',input,options),listSubkeys:(input,options)=>call('list-subkeys',input,options)});
}

/** Existing run-bound SDK adapter supplies queue bounds and uncertainty barrier. */
export function createNativeBoundSdkSessionStore(configuration){
 const {client,binding,sessionKey,timeoutMs=RUNNER_SESSION_STORE_CALL_MS}=own(configuration,['client','binding','sessionKey'],['timeoutMs']);
 const admitted=Object.freeze(Object.fromEntries(['register','load','append','listSubkeys'].map(name=>[name,storageMethod(client,name)])));
 const key=scopedSessionKey(sessionKey,sessionKey,true),offsets=new Map();
 const name=k=>k.subpath??'';
 const transport={
  async load({key,signal}){const result=await admitted.load({key},{signal});offsets.set(name(key),result.offset);return result.entries;},
  async listSubkeys({key,signal}){return (await admitted.listSubkeys({key},{signal})).subkeys;},
  async append({key,entries,signal}){if(!offsets.has(name(key)))await transport.load({key,signal});const appendId=randomUUID(),expectedOffset=offsets.get(name(key));
   const result=await admitted.append({key,appendId,expectedOffset,entriesSha256:hash(entries),entries},{signal});offsets.set(name(key),result.offset);},
 };
 const bound=createRunBoundSessionStore({binding,sessionKey:key,transport,timeoutMs});
 return Object.freeze({...bound,register:options=>admitted.register({key},options)});
}
