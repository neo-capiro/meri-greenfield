/** Keep the SDK's Query and materialized SessionStore directory through admission. */
import {types} from 'node:util';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {executionFault} from './execution-broker.mjs';
export async function prepareNativeSdkQuery(configuration){
 const c=own(configuration,['prompt','options','bindLaunch']);
 if(typeof c.bindLaunch!=='function'||types.isProxy(c.bindLaunch)||types.isAsyncFunction(c.bindLaunch)||!c.options||types.isProxy(c.options)||Object.getPrototypeOf(c.options)!==Object.prototype)throw executionFault('SDK_PREPARATION_CONFIGURATION');
 const descriptors=Object.getOwnPropertyDescriptors(c.options);
 if(Object.values(descriptors).some(d=>!Object.hasOwn(d,'value'))||Object.hasOwn(descriptors,'spawnClaudeCodeProcess'))throw executionFault('SDK_PREPARATION_CONFIGURATION');
 const options=Object.fromEntries(Object.entries(descriptors).map(([key,descriptor])=>[key,descriptor.value]));
 const {query}=await import('../../worker/conversation/agent-sdk.mjs'),captured=Promise.withResolvers();captured.promise.catch(()=>{});
 let bound,stream,iterator,first,closed=false,spawned=false,closing,lateBinding;
 function close(){
  if(closing)return closing;closed=true;
  closing=Promise.resolve().then(async()=>{
   if(lateBinding){
    const life=createOperationLifetime({now:Date.now,deadlineMs:Date.now()+3000,errorFactory:()=>executionFault('SDK_PREPARATION_CLEANUP_UNKNOWN')});
    try{await life.run(()=>lateBinding);}finally{life.close();}
    // An unsupported asynchronous factory never produces accepted ownership.
    throw executionFault('SDK_PREPARATION_BINDING_UNKNOWN');
   }
   if(bound)await bound.close();stream?.close();
  });closing.catch(()=>{});return closing;
 }
 function spawn(request){if(spawned||closed)throw executionFault('SDK_PREPARATION_REFUSED');spawned=true;
  try{const r=own(request,['command','args','cwd','env'],['signal']);nativeSignal(r.signal);
   // Capture the SDK's actual descriptor. A trusted owner must compile its exact
   // argv/env, claim/admit the original execution, restore, then attach once.
   const pins=data({command:r.command,args:r.args,cwd:r.cwd,env:r.env});
   const produced=c.bindLaunch({...pins,...(r.signal?{signal:r.signal}:{})});
   if(types.isPromise(produced)){lateBinding=Promise.prototype.then.call(produced,late=>storageMethod(late,'close')(),()=>undefined);lateBinding.catch(()=>{});throw executionFault('SDK_PREPARATION_BINDING_UNKNOWN');}
   bound=own(produced,['process','start','close']);
   if(typeof bound.start!=='function'||typeof bound.close!=='function')throw executionFault('SDK_PREPARATION_CONFIGURATION');
   captured.resolve(bound);return bound.process;
  }catch(error){captured.reject(error);throw error;}
 }
 try{
  stream=query({prompt:c.prompt,options:{...options,spawnClaudeCodeProcess:spawn}});iterator=stream[Symbol.asyncIterator]();first=iterator.next();first.catch(error=>captured.reject(error));
  const original=await Promise.race([captured.promise,first.then(value=>{if(!spawned)throw executionFault('SDK_PREPARATION_NO_LAUNCH');return captured.promise;})]);
  await original.start();
  let initial=true;const messages=Object.freeze({[Symbol.asyncIterator](){return this;},next(){if(initial){initial=false;return first;}return iterator.next();},async return(){await close();return {done:true,value:undefined};}});
  return Object.freeze({query:stream,messages,close});
 }catch(error){try{await close();}catch(cleanup){throw new AggregateError([error,cleanup],'SDK_PREPARATION_CLEANUP_UNKNOWN');}throw error;}
}
