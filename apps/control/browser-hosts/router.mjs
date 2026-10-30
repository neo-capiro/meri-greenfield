/** Private routing over the canonical physical allocation; no caller destination or cached authority. */
import {createBrowserViewerHostClient} from '../../worker/conversation/host/browser-viewer-transport.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {assertRequestedBinding,fail,same} from './allocation.mjs';
import {own,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';

export function createBrowserHostRouter({allocations,tls,now=Date.now,requestMs=10000,connect=createBrowserViewerHostClient}){
 const resolve=storageMethod(allocations,'resolve');
 if(typeof now!=='function'||typeof connect!=='function'||!Number.isSafeInteger(requestMs)||requestMs<1||requestMs>30000)fail();
 // Trusted runtime configuration supplies this control identity. The allocator stores only peer public pins.
 const privateTls=Object.freeze({...own(tls,['clientName','cert','key','ca']),cert:Buffer.from(tls.cert),key:Buffer.from(tls.key),ca:Buffer.from(tls.ca)});
 const lifetime=new AbortController();
 async function call(binding,custody,signal,operation){
  nativeSignal(signal);const source=assertRequestedBinding(binding);
  const life=createOperationLifetime({now,deadlineMs:now()+requestMs,signal:AbortSignal.any([lifetime.signal,...(signal?[signal]:[])]),errorFactory:()=>Object.assign(Error('BROWSER_HOST_ROUTE_UNAVAILABLE'),{code:'BROWSER_HOST_ROUTE_UNAVAILABLE'})});
  let client;
  try{
   const before=await life.run(signal=>resolve({binding:source,custody,signal}));life.check();
   if(!same(before.binding,source)||before.expiresAtMs<=now())fail();life.limitDeadline(before.expiresAtMs);
   client=connect({binding:source,ownerInstanceId:before.ownerInstanceId,hostId:before.allocation.hostId,
    generation:before.allocation.generation,endpoint:before.endpoint,tls:privateTls,now,requestMs});
   const result=await life.run(signal=>operation(client,signal));life.check();
   const after=await life.run(signal=>resolve({binding:source,custody,signal}));life.check();
   if(after.expiresAtMs<=now()||before.recordSha256!==after.recordSha256||before.ownerInstanceId!==after.ownerInstanceId||!same(after.binding,source))fail();
   return result;
  }finally{try{client?.close();}finally{life.close();}}
 }
 return Object.freeze({
  read({binding,custody=null,signal}){return call(binding,custody,signal,(client,signal)=>client.read({binding,custody,signal}));},
  prepareResume({binding,custody,signal}){return call(binding,custody,signal,(client,signal)=>client.prepareResume({binding,custody,signal}));},
  execute({route,request,grant,signal}){
   // Binding comes from the already authenticated canonical custody, not request.ownerId or pageId.
   const binding=grant.custody.binding;
   return call(binding,grant.custody,signal,(client,signal)=>client.execute({route,request,grant,signal}));
  },
  close(){lifetime.abort();privateTls.key.fill(0);privateTls.cert.fill(0);privateTls.ca.fill(0);},
 });
}
