/** Transparent counters at existing I/O ports. No new requests, deadlines, retries or changed errors.
 * AWS facades are ordinary objects; pool and pooled-client identities remain unchanged.
 * Product boundary validators reject JavaScript Proxy values.
 */
import {AsyncLocalStorage} from 'node:async_hooks';
const caches=new WeakMap(),originals=new WeakMap(),poolQueries=new AsyncLocalStorage();
function cache(telemetry,kind){let group=caches.get(telemetry);if(!group)caches.set(telemetry,group={fetch:new WeakMap(),aws:new WeakMap(),pool:new WeakMap(),client:new WeakMap()});return group[kind];}
const safe=fn=>{try{return fn();}catch{return undefined;}};
const clock=telemetry=>safe(()=>telemetry.now())??Date.now();
const elapsed=(telemetry,started)=>Math.max(0,clock(telemetry)-started);
const record=(telemetry,fn)=>safe(()=>typeof telemetry.capture==='function'?telemetry.capture(fn):fn)??fn;
export function classifyStatus(status,error){
 if(status>=200&&status<300)return '2xx';
 if([401,403,409,503].includes(status))return String(status);
 if(status>=400&&status<500)return '4xx';if(status>=500&&status<600)return '5xx';
 const code=safe(()=>error?.code),name=safe(()=>error?.name);
 return ['DEADLINE','ETIMEDOUT','UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT','PINNED_NATIVE_TIMEOUT'].includes(code)||['AbortError','TimeoutError'].includes(name)?'timeout':'unanswered';
}
export function coreRoute(input){try{
 const url=typeof input==='string'||input instanceof URL?new URL(input):new URL(input.url);
 return /\/application-authority\/(identity|context|membership|current)$/u.exec(url.pathname)?.[1]??'other';
 }catch{return 'other';}}
function observeCall(fn,receiver,args,onDone,{callback=false,mapResult=value=>value}={}){
 let ended=false;
 const finish=error=>{if(!ended){ended=true;safe(()=>onDone(error));}};
 const copied=[...args],last=copied.length-1,hasCallback=callback&&typeof copied[last]==='function';
 if(hasCallback){const original=copied[last];copied[last]=function(error,...values){finish(error);if(!error&&values.length)values[0]=mapResult(values[0]);return Reflect.apply(original,this,[error,...values]);};}
 let result;try{result=Reflect.apply(fn,receiver,copied);}catch(error){finish(error);throw error;}
 if(result&&typeof result.then==='function')return result.then(value=>{finish();return mapResult(value);},error=>{finish(error);throw error;});
 if(!hasCallback){finish();return mapResult(result);}return result;
}
function stored(telemetry,kind,port,build){
 if(!telemetry||!port)return port;
 const memo=cache(telemetry,kind);if(memo.has(port))return memo.get(port);
 const original=originals.get(port)??port,wrapper=build(original);memo.set(original,wrapper);memo.set(port,wrapper);memo.set(wrapper,wrapper);originals.set(wrapper,original);return wrapper;
}

export function countingFetch(fetchImpl,telemetry,{origin}={}){return stored(telemetry,'fetch',fetchImpl,original=>function(...args){
 if(origin!==undefined){const requestOrigin=safe(()=>new URL(typeof args[0]==='string'||args[0] instanceof URL?args[0]:args[0].url).origin);
  if(requestOrigin!==origin)return Reflect.apply(original,this,args);}
 const started=clock(telemetry),route=coreRoute(args[0]);let status;
 const done=record(telemetry,error=>telemetry.recordCore(route,classifyStatus(status,error),elapsed(telemetry,started)));
 // Read only the status. Never consume or clone a response body.
 let result;try{result=Reflect.apply(original,this,args);}catch(error){safe(()=>done(error));throw error;}
 if(result&&typeof result.then==='function')return result.then(value=>{status=safe(()=>value?.status);safe(()=>done());return value;},error=>{safe(()=>done(error));throw error;});
 status=safe(()=>result?.status);safe(()=>done());return result;
});}

export function countingAwsClient(client,telemetry){return stored(telemetry,'aws',client,original=>{
 const facade={...original};for(const name of ['destroy'])if(typeof original[name]==='function')facade[name]=original[name].bind(original);
 facade.send=function(...args){
  const started=clock(telemetry),operation=safe(()=>args[0]?.constructor?.name?.replace(/Command$/u,''))??'other';
  const done=record(telemetry,error=>telemetry.recordAws(operation,error?(classifyStatus(undefined,error)==='timeout'?'timeout':'error'):'success',elapsed(telemetry,started)));
  return observeCall(original.send,original,args,done,{callback:true});
 };return Object.freeze(facade);
});}

export function countingPool(pool,telemetry){return stored(telemetry,'pool',pool,original=>{
 const writable=(object,key)=>{const own=Object.getOwnPropertyDescriptor(object,key);
  if(own)return Object.hasOwn(own,'value')&&own.writable===true;
  return Object.isExtensible(object);};
 const missed=()=>safe(()=>telemetry.recordDropped?.());
 const wrapQuery=(query,receiver,isPool=false)=>function(...args){
  if(poolQueries.getStore()===telemetry)return Reflect.apply(query,receiver,args);
  const started=clock(telemetry),done=record(telemetry,()=>telemetry.recordDb(elapsed(telemetry,started))),parent=poolQueries.getStore();
  const copied=[...args],last=copied.length-1;
  if(typeof copied[last]==='function'){const callback=copied[last];copied[last]=function(...values){return poolQueries.run(parent,()=>Reflect.apply(callback,this,values));};}
  const invoke=()=>observeCall(query,receiver,copied,done,{callback:true});
  return isPool?poolQueries.run(telemetry,invoke):invoke();};
 const wrapClient=client=>{
  if(!client||typeof client.query!=='function')return client;
  // Preserve pg's client identity and release function (including callback connect's third argument).
  const memo=cache(telemetry,'client');if(memo.has(client))return client;
  if(!writable(client,'query')){missed();memo.set(client,client);return client;}
  const query=originals.get(client.query)??client.query,wrapped=wrapQuery(query,client);originals.set(wrapped,query);client.query=wrapped;memo.set(client,client);return client;
 };
 // Canonical startup owners retain and compare the original pool reference. pg Pool
 // methods are writable; preserve that reference instead of substituting a facade.
 // Immutable injected ports are kept untouched: telemetry must not make them fail.
 const methods=['query','connect'].filter(name=>typeof original[name]==='function');
 if(methods.some(name=>!writable(original,name))){missed();return original;}
 const query=original.query,connect=original.connect;
 if(typeof query==='function'){const wrapped=wrapQuery(originals.get(query)??query,original,true);originals.set(wrapped,originals.get(query)??query);original.query=wrapped;}
 if(typeof connect==='function'){
  const unwrapped=originals.get(connect)??connect;
  const wrapped=function(...args){return observeCall(unwrapped,original,args,()=>{},{callback:true,mapResult:wrapClient});};
  originals.set(wrapped,unwrapped);original.connect=wrapped;
 }
 return original;
});}
