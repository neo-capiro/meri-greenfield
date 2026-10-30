/** CAP-owned root bootstrap: finite no-egress placement + the ONE fixed image-pinned UID1000 inspection child.
 *
 * Root privilege lives here only. Given the exact allocation/binding/host identity produced by Parent's canonical custody
 * validator (still an unbound dependency), this module opens the compartment and the finite placement and launches ONLY
 * the fixed absolute child executable with fixed arguments. The child receives one closed, nonsecret host-owned settings
 * document plus the validated request on stdin; it never sees TLS material, a program choice, argv, cwd or environment.
 */
import {createProcessingPlacement} from '../../worker/conversation/host/cgroup/processing-placement.mjs';
import {prepareProcessingCompartment} from '../../worker/conversation/host/network/confinement.mjs';
import {UPLOAD_INSPECTION_WIRE_BYTES,UPLOAD_INSPECTION_RESULT_BYTES} from '../uploads/agentcore-contract.mjs';

const fault=code=>{throw Object.assign(new Error(code),{code});};

/** Fixed child program/argv, validated BEFORE any privileged setup. */
export function childInvocation(config){
 const child=config?.paths?.childPath;
 if(typeof child!=='string'||!child.startsWith('/')||child.includes('..')||config?.paths?.nodePath?.startsWith('/')!==true)
  fault('NATIVE_PROCESSING_CONFIGURATION');
 if(config.paths.runtimeUid!==1000||config.paths.runtimeGid!==1000)fault('NATIVE_PROCESSING_CONFIGURATION');
 if(config.paths.childSettings?.runtimeUid!==1000)fault('NATIVE_PROCESSING_CONFIGURATION');
 return Object.freeze({command:config.paths.nodePath,args:Object.freeze([child]),
  settings:Object.freeze({...config.paths.childSettings})});
}

/** A verified peer cannot choose a different processing host or image: the authorized allocation/binding/identity must be
 * THIS host's bootstrap identity, with a live lease and the pinned image digest. */
export function assertHostMatch({config,allocation,binding,hostIdentity,request,now=Date.now}){
 const fixed=config?.allocation;
 const refuse=()=>{throw Object.assign(Error('NATIVE_PROCESSING_ALLOCATION_REFUSED'),{code:'NATIVE_PROCESSING_ALLOCATION_REFUSED'});};
 if(!fixed||!allocation||!binding||!hostIdentity)refuse();
 const same=(a,b)=>a!==undefined&&b!==undefined&&String(a)===String(b);
 // Exact purpose, generation, lease, tenant/conversation and this host's real instance/boot identity.
 if(fixed.hostMode!=='native-processing'||allocation.hostMode!=='native-processing')refuse();
 if(!same(allocation.hostId,fixed.hostId)||!same(allocation.generation,fixed.generation)||
  !same(allocation.conversationId,fixed.conversationId)||!same(allocation.tenantId,fixed.tenantId)||
  !same(binding.tenantId,fixed.tenantId)||!same(binding.conversationId,fixed.conversationId))refuse();
 if(!same(hostIdentity.hostId,fixed.hostId)||!same(hostIdentity.conversationId,fixed.conversationId)||
  !same(hostIdentity.instanceId,fixed.instanceId)||!same(hostIdentity.bootId,fixed.bootId))refuse();
 if(allocation.imageDigest!==config.image.digest)refuse();
 if(request!==undefined&&request.imageDigest!==config.image.digest)refuse();
 if(!Number.isSafeInteger(allocation.leaseDeadlineMs)||allocation.leaseDeadlineMs<=now())refuse();
 if(!Number.isSafeInteger(fixed.leaseDeadlineMs)||fixed.leaseDeadlineMs<=now())refuse();
 // The configuration pins THIS host's lease; an authorized allocation may not silently extend or shorten it.
 if(allocation.leaseDeadlineMs!==fixed.leaseDeadlineMs)refuse();
 return true;
}

export async function openNativeProcessingHost({config,allocation,binding,hostIdentity,authority,signal,definitionsOwner,
 openCompartment=prepareProcessingCompartment,openPlacement=createProcessingPlacement}={}){
 if(!allocation||!binding||!hostIdentity||typeof authority?.readCurrent!=='function')
  fault('NATIVE_PROCESSING_AUTHORITY_UNBOUND');
 assertHostMatch({config,allocation,binding,hostIdentity});
 if(config?.allocation?.leaseDeadlineMs<Date.now())fault('NATIVE_PROCESSING_ALLOCATION_REFUSED');
 const {command,args,settings}=childInvocation(config);
 let compartment=null,placement=null;
 const checkLive=()=>{if(signal?.aborted)throw Object.assign(Error('NATIVE_PROCESSING_CANCELLED'),{code:'NATIVE_PROCESSING_CANCELLED'});};
 try{
  checkLive();
  compartment=await openCompartment({allocation,binding,signal});
  checkLive();
  placement=await openPlacement({allocation,binding,hostIdentity,authority,limits:config.limits,network:compartment,
   helperPath:config.paths.helperPath,home:config.paths.home,browsersPath:config.paths.home,
   uid:config.paths.runtimeUid,gid:config.paths.runtimeGid,signal});
 }catch(error){
  // Partial setup unwind: a compartment opened by this call is closed; anything unproven stays unknown on the error.
  let cleanup='not-created';
  if(placement!==null){try{await placement.close();cleanup='removed';}catch{cleanup='unknown';}}
  else if(compartment!==null){try{const c=await compartment.close();cleanup=c?.closed===true?'removed':'unknown';}
   catch{cleanup='unknown';}}
  error.partialCleanup=cleanup;
  throw error;
 }
 let closing=null;
 const closeController=new AbortController();
 const entries=[];           // EVERY call entry, registered BEFORE its acquisition is awaited
 return Object.freeze({placement,compartment,
  async runRequest({requestDocument,deadlineMs,signal:callSignal}){
   if(closing!==null)fault('NATIVE_PROCESSING_CLOSED');
   let settleEntry=null;
   const entry={pin:null,dispatched:false,finished:false,settled:false,releaseFailed:false,
    settledPromise:new Promise(resolve=>{settleEntry=resolve;}),settle:()=>settleEntry()};
   entries.push(entry);
   // The acquisition belongs to THIS operation: host close and the caller's cancellation both end it.
   const lifetime=closeController.signal;
   const combined=callSignal===undefined?lifetime:AbortSignal.any([callSignal,lifetime]);
   let pinnedSettings=settings;
   try{
    if(definitionsOwner!==undefined&&definitionsOwner!==null){
     entry.pin=await definitionsOwner.pin({deadlineMs,signal:combined});
     if(closing!==null){                                     // settled AFTER close: never dispatched, so no future child
      // A late definitive settlement may release the tracked activity, but a refused/unknown release keeps the entry so a
      // later close can never claim proven closure for it.
      try{const released=entry.pin.release({completed:true});
       if(released===false||released?.released===false)entry.releaseFailed=true;
       else {const at=entries.indexOf(entry);if(at>=0)entries.splice(at,1);}}
      catch{entry.releaseFailed=true;}
      finally{entry.settled=true;entry.settle();}
      fault('NATIVE_PROCESSING_CLOSED');
     }
     pinnedSettings=Object.freeze({...settings,snapshot:Object.freeze({databaseDirectory:entry.pin.databaseDirectory,
      sha256:entry.pin.sha256,publishedAtMs:entry.pin.publishedAtMs,files:entry.pin.files})});
    }
    if(closing!==null)fault('NATIVE_PROCESSING_CLOSED');     // no dispatch after close began, even if the pin arrived late
    const input=Buffer.from(JSON.stringify({settings:pinnedSettings,request:requestDocument,deadlineMs}));
    if(input.length>UPLOAD_INSPECTION_WIRE_BYTES+65536)fault('UPLOAD_INSPECTION_REQUEST_REFUSED');
    entry.dispatched=true;
    const out=await placement.run(command,args,{cwd:config.paths.home,input,signal:combined,deadlineMs,
     maxOutput:UPLOAD_INSPECTION_RESULT_BYTES});
    // `completed` means NO FUTURE CHILD for this pin, never "the child exited 0": a failed child that is proven done is
    // still a finished reader; only an unproven/unknown child keeps the pin.
    entry.finished=true;
    return out;
   }catch(error){
    if(entry.dispatched)entry.finished=true;                 // the child ran and its run settled (failed or not)
    throw error;
   }finally{entry.settled=true;entry.settle();}
  },
  close(){
   // ONE physical teardown, and one promise that resolves only when every acquisition and release is DEFINITIVE. A caller
   // that bounds its wait may see an intermediate unknown, but the same promise can still resolve closed:true later, which
   // is how a late definitive pin release releases the owning activity without any caller retry. Pending acquisitions are
   // aborted here and awaited (their settlement is what makes this promise definitive).
   if(closing===null)closing=(async()=>{
    closeController.abort();
    let code=null,placementClosed=false;
    try{const p=await placement.close();placementClosed=p?.closed===true;
     if(!placementClosed)code=p?.code??'NATIVE_PROCESSING_CLEANUP_UNKNOWN';}
    catch(error){code=error?.code??'NATIVE_PROCESSING_CLEANUP_UNKNOWN';}
    try{const c=await compartment.close();if(c?.closed!==true)code??=c?.code??'HOST_NETWORK_CLEANUP_UNKNOWN';}
    catch{code??='HOST_NETWORK_CLEANUP_UNKNOWN';}
    // Wait for in-flight acquisitions BEFORE evaluating tokens: their continuation releases or retains them itself.
    await Promise.all(entries.map(entry=>entry.settledPromise));
    const retained=[];
    for(const entry of entries.splice(0)){
     if(entry.pin===null)continue;                             // nothing was acquired
     if(entry.releaseFailed){retained.push(entry);code??='NATIVE_PROCESSING_CLEANUP_UNKNOWN';continue;}
     if(!placementClosed){retained.push(entry);continue;}       // unknown closure retains the token
     const complete=entry.finished===true||entry.dispatched===false;
     try{const released=entry.pin.release({completed:complete});
      if(released===false||released?.released===false){entry.releaseFailed=true;retained.push(entry);
       code??='NATIVE_PROCESSING_CLEANUP_UNKNOWN';}}
     catch{entry.releaseFailed=true;retained.push(entry);code??='NATIVE_PROCESSING_CLEANUP_UNKNOWN';}
    }
    entries.push(...retained);
    if(code!==null)return Object.freeze({closed:false,code});
    if(entries.length>0)return Object.freeze({closed:false,code:'NATIVE_PROCESSING_CLEANUP_UNKNOWN'});
    return Object.freeze({closed:true});
   })();
   return closing;
  }});
}