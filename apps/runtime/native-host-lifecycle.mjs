/** Control-side native lifecycle coordinator: strict remote evidence -> EXISTING native teardown coordinator
 * (createConversationHostTeardown native branch) -> existing EC2 physical port -> canonical writer record.
 * It never invents local/browser claims, never persists UNKNOWN as verified, and performs at most one settle
 * (duplicate calls share the same promise/result), so a lost canonical receipt ACK replays the exact receipt
 * instead of destroying twice. */
import {assertNativeHostAllocation,assertHostRunBindingPin,assertD005HostIdentityShape} from
 '../../packages/contracts/native-lifecycle.mjs';
import {createConversationHostTeardown} from '../worker/conversation/host/teardown.mjs';
const fault=(code,receipt)=>{const e=Object.assign(new Error(code),{code});if(receipt!==undefined)e.receipt=receipt;return e;};
const method=(object,name)=>{if(typeof object?.[name]!=='function')throw fault('NATIVE_TEARDOWN_CONFIGURATION');
 return object[name].bind(object);};

export function createNativeHostLifecycle({client,physical,writer,allocation,binding,hostIdentity,now=Date.now,
 localCleanupMs=30000,hostCleanupMs=30000}){
 const a=assertNativeHostAllocation(allocation),b=assertHostRunBindingPin(a,binding),i=assertD005HostIdentityShape(hostIdentity,b,a);
 if(client===null||typeof client!=='object'||typeof client.close!=='function'||typeof client.processes!=='function'||
  typeof client.observe!=='function')throw fault('NATIVE_TEARDOWN_CONFIGURATION');
 // Capture the exact owner methods at construction: a later property mutation cannot retarget a settle.
 const clientClose=client.close.bind(client),clientProcesses=client.processes.bind(client),
  clientObserve=client.observe.bind(client);
 const full=physical!==null&&physical!==undefined;
 if(full&&(typeof physical!=='object'||typeof physical.destroy!=='function'||typeof physical.observeAbsent!=='function'))
  throw fault('NATIVE_TEARDOWN_CONFIGURATION');
 const record=full?method(writer,'recordTeardown'):null;
 const physicalDestroy=full?physical.destroy.bind(physical):null,
  physicalObserveAbsent=full?physical.observeAbsent.bind(physical):null;
 // The EXISTING coordinator owns ordering, deadlines, receipts and the UNKNOWN rule.
 const coordinator=full?createConversationHostTeardown({allocation:a,binding:b,hostIdentity:i,
  browserPolicySha256:'0'.repeat(64),now,localCleanupMs,hostCleanupMs,hostMode:'native-processing',
  ports:Object.freeze({
   native:Object.freeze({
    close:async(request,{signal}={})=>{
     const answer=await clientClose({signal});
     // Coordinator semantics: only the validated 'closed' status is a close proof; unknown is a failure.
     if(answer?.closed!==true||answer.status!=='closed')throw fault('NATIVE_LIFECYCLE_UNKNOWN');
     return Object.freeze({closed:true});
    },
    observe:async(request,{signal}={})=>clientObserve({signal}),
   }),
   processes:Object.freeze({waitForExit:async(request,{signal}={})=>clientProcesses({signal})}),
   host:Object.freeze({destroy:(request,{signal}={})=>physicalDestroy(request,{signal}),
    observeAbsent:(request,{signal}={})=>physicalObserveAbsent(request,{signal})}),
  })}):null;
 let settled=null,recorded=null,candidateReceipt=null;
 async function recordReceipt(receipt,signal){
  if(recorded!==null)return recorded;
  try{recorded=await record({hostId:a.hostId,generation:a.generation,receipt,signal});}
  catch(error){
   // Only an explicit uncertain canonical outcome is replayed; the SAME immutable receipt is used.
   if(error?.code!=='BROWSER_HOST_TEARDOWN_UNKNOWN')throw error;
   recorded=await record({hostId:a.hostId,generation:a.generation,receipt,signal});
  }
  return recorded;
 }
 async function settleOnce({reason='revoked',signal}={}){
  if(coordinator===null)throw fault('NATIVE_TEARDOWN_CONFIGURATION');
  let receipt;
  try{receipt=candidateReceipt??=await coordinator.settle({reason});}
  catch(error){
   // The coordinator throws a frozen receipt for UNKNOWN; never persist it as verified, keep custody.
   throw error;
  }
  await recordReceipt(receipt,signal);
  return Object.freeze({closed:true,verified:true,receipt});
 }
 return Object.freeze({
  /** Remote-only close proof (legacy external helper); no durable receipt and no physical destruction. */
  async close({signal}={}){
   const answer=await clientClose({signal});
   if(answer?.closed!==true||answer.status!=='closed')return Object.freeze({closed:false,status:'unknown'});
   return Object.freeze({closed:true,status:'closed',observedAtMs:answer.observedAtMs});
  },
  /** All close/duplicate settle calls share one result and one physical attempt. */
  settle(options={}){
   return settled??=settleOnce(options).catch(error=>{
    // Retry only persistence of the same genuine receipt. The coordinator keeps its original
    // cleanup result, so neither guest cleanup nor EC2 dispatch can repeat on this retry.
    if(candidateReceipt!==null)settled=null;
    throw error;
   });
  },
  processes({signal}={}){return clientProcesses({signal});},
  observe({signal}={}){return clientObserve({signal});},
 });
}
