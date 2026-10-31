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
import {assertNativeHostCurrent} from '../../worker/conversation/host/binding.mjs';
import {prepareRunParent,releaseOwnedHierarchy,realHierarchyPort} from './hierarchy.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';

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

export async function openNativeProcessingHost({config,allocation,binding,hostIdentity,authority,signal,definitionsOwner,hierarchyPort=realHierarchyPort,deadlineMs,
 openCompartment=prepareProcessingCompartment,openPlacement=createProcessingPlacement}={}){
 if(!allocation||!binding||!hostIdentity||typeof authority?.readCurrent!=='function'||
  typeof authority?.policySha256!=='string'||!Number.isSafeInteger(authority?.maxFreshMs))
  fault('NATIVE_PROCESSING_AUTHORITY_UNBOUND');
 assertHostMatch({config,allocation,binding,hostIdentity});
 if(config?.allocation?.leaseDeadlineMs<Date.now())fault('NATIVE_PROCESSING_ALLOCATION_REFUSED');
 const {command,args,settings}=childInvocation(config);
 let closeStageDirect=null;
 let compartment=null,placement=null,runHierarchy=null,compartmentStage=false,placementStage=false,hierarchyStage=false,timedOut=false,setupLife=null;
 const settledStage={compartment:false,placement:false};
 let hierarchyDisposition=null;
 const checkLive=()=>{if(signal?.aborted)throw Object.assign(Error('NATIVE_PROCESSING_CANCELLED'),{code:'NATIVE_PROCESSING_CANCELLED'});};
 try{
  checkLive();
  // Authenticated CURRENT-RUN setup: fresh currentness BEFORE any privileged hierarchy write. Only when the caller supplies
  // the cgroup port (the real entrypoint does); injected-placement tests stay inert by omitting it.
  {
   // ONE absolute setup deadline and ONE lifetime signal govern every stage. Raw acquisitions are retained with a cached,
   // exactly-once close OUTCOME (never an "attempted" flag); the run parent is released only after every actually invoked
   // lower stage is PROVEN gone. A public timeout is always unknown; it is tracked separately from an ordinary settled error.
   const until=Number.isSafeInteger(deadlineMs)?deadlineMs:Date.now()+(config?.limits?.deadlineMaxMs??30000);
   const life=createOperationLifetime({deadlineMs:until,now:Date.now,signal,
    errorFactory:()=>Object.assign(Error('HOST_CURRENTNESS_REFUSED'),{code:'HOST_CURRENTNESS_REFUSED'})});
   const late={hierarchy:null,compartment:null,placement:null};
   const closeOutcome={compartment:null,placement:null};
   let hierarchyActivated=false,parentOutcome=null;
   const expired=()=>life.signal.aborted===true||Date.now()>=until;
   const closeStage=async(name,handle)=>{
    if(closeOutcome[name]!==null)return closeOutcome[name];
    if(handle===null||handle===undefined||typeof handle.close!=='function')return {closed:false};
    closeOutcome[name]=(async()=>{try{const result=await handle.close();return {closed:result?.closed===true};}
     catch{return {closed:false};}})();
    return closeOutcome[name];
   };
   closeStageDirect=closeStage;
   const releaseParent=async()=>{
    if(runHierarchy===null)return true;
    if(parentOutcome!==null)return parentOutcome;
    parentOutcome=(async()=>{try{const released=await releaseOwnedHierarchy({record:runHierarchy,port:hierarchyPort});
     return released.unknown.length===0;}catch{return false;}})();
    return parentOutcome;
   };
   const lowerAllProvenGone=async()=>{
    for(const name of ['compartment','placement']){
     if(closeOutcome[name]===null)continue;
     const outcome=await closeOutcome[name];
     if(outcome.closed!==true)return false;
    }
    return true;
   };
   const lateSettle=async name=>{
    const handle=late[name]??(name==='compartment'?compartment:placement);
    const outcome=await closeStage(name,handle);
    if(outcome.closed!==true)return;                 // failed/unknown late close retains parent and enclosing owners
    if(name==='placement'){
     const upper=await closeStage('compartment',compartment);
     if(upper.closed!==true)return;
    }
    if(await lowerAllProvenGone()!==true)return;
    await releaseParent();
   };
   const settleLateHierarchy=async()=>{
    if(late.hierarchy===null)return;
    try{const released=await releaseOwnedHierarchy({record:late.hierarchy,port:hierarchyPort});
     if(released.unknown.length>0)return;}catch{return;}
    late.hierarchy=null;
   };
   const invoke=(name,fn)=>{
    const raw=Promise.resolve().then(()=>fn(life.signal));
    raw.then(handle=>{
     if(name==='compartment')settledStage.compartment=true;
     if(name==='placement')settledStage.placement=true;
     if(name==='hierarchy'){
      if(expired()===true&&hierarchyActivated===false){late.hierarchy=handle;void settleLateHierarchy();return;}
      runHierarchy=handle;hierarchyActivated=true;return;
     }
     if(expired()===true){late[name]=handle;void lateSettle(name);return;}
     if(name==='compartment')compartment=handle;else placement=handle;
    },()=>{if(name==='compartment')settledStage.compartment=true;
     if(name==='placement')settledStage.placement=true;});
    return raw;
   };
   try{
    const current=await life.run(()=>authority.readCurrent({allocation,binding,hostIdentity,
     signal:life.signal,deadlineMs:until}));
    life.check();
    assertNativeHostCurrent({allocation,binding,policySha256:authority.policySha256,current,
     nowMs:Date.now(),maxFreshMs:authority.maxFreshMs});
    life.check();
    hierarchyStage=true;
    life.check();
    runHierarchy=await life.run(()=>invoke('hierarchy',sig=>prepareRunParent({config,binding,port:hierarchyPort,
     signal:sig,deadlineMs:until,now:Date.now})));
    hierarchyActivated=true;
    life.check();
    compartmentStage=true;
    compartment=await life.run(()=>invoke('compartment',sig=>openCompartment({allocation,binding,signal:sig})));
    life.check();
    placementStage=true;
    placement=await life.run(()=>invoke('placement',sig=>openPlacement({allocation,binding,hostIdentity,authority,
     limits:config.limits,network:compartment,helperPath:config.paths.helperPath,home:config.paths.home,
     browsersPath:config.paths.home,uid:config.paths.runtimeUid,gid:config.paths.runtimeGid,signal:sig})));
    life.check();
    setupLife=life;                        // success: the returned owner keeps the actual cancellation/deadline authority
   }catch(error){
    // Distinguish an actual public timeout (unknown, owners retained for the late continuation) from an ordinary settled
    // failure (unwind exactly the owned, proven resources and report the aggregate disposition).
    if(expired()===true||life.signal.aborted===true){
     timedOut=true;
     if(compartment!==null||placement!==null){
      // A handle already resolved but not delivered is still owned: schedule the SAME cached cleanup path. A pending
      // PLACEMENT acquisition owns its enclosing namespace until it settles, so never schedule an early compartment close.
      if(placement!==null)void lateSettle('placement');
      else if(placementStage!==true&&compartment!==null)void lateSettle('compartment');
     }
     throw error;
    }
    throw error;
   }finally{if(setupLife===null)life.close();}
  }
 }catch(error){
  // Reason about the stage that FAILED separately from resources this call already owns. A stage that was invoked and
  // rejected without returning a handle can be proven clean ONLY by its own explicit removed/not-created disposition;
  // missing/occupied/unknown/any other value stays unknown. Closing an acquired namespace proves that namespace only.
  const normalize=value=>value==='removed'||value==='not-created'?value:'unknown';
  let failing;
  if(hierarchyStage===true&&runHierarchy===null)failing=normalize(error?.partialCleanup);
  else if(placementStage===true&&placement===null)failing=normalize(error?.partialCleanup);
  else if(compartmentStage===true&&compartment===null)failing=normalize(error?.partialCleanup);
  else failing='not-created';            // cancellation/refusal BETWEEN stages: no failing stage was invoked
  let owned='not-created';
  if(placement!==null){
   if(timedOut===true||settledStage.placement!==true)owned='unknown';
   else{const outcome=await closeStageDirect('placement',placement);owned=outcome.closed===true?'removed':'unknown';}
  }
  else if(compartment!==null){
   // Never bypass the cached cleanup owner: a pending/late acquisition, or a public timeout, leaves the enclosing handles and
   // the run parent to the late continuation instead of closing an ancestor here.
   if(timedOut===true||(placementStage===true&&settledStage.placement!==true))owned='unknown';
   else{
    const outcome=await closeStageDirect('compartment',compartment);
    owned=outcome.closed===true?'removed':'unknown';
   }
  }
  let cleanup;
  if(runHierarchy!==null){
   // A timed-out acquisition still owns its parent: only the late-settlement continuation may release it.
   if(timedOut!==true){
    try{const released=await releaseOwnedHierarchy({record:runHierarchy,port:hierarchyPort});
     if(released.unknown.length>0)owned='unknown';
     else if(released.removed.length>0&&owned!=='unknown')owned='removed';}catch{owned='unknown';}
   }
  } else if(hierarchyStage===true){hierarchyDisposition=failing;}
  if(hierarchyDisposition==='unknown')owned='unknown';
  if(failing==='unknown'||owned==='unknown')cleanup='unknown';
  else if(failing==='removed'||owned==='removed')cleanup='removed';
  else cleanup='not-created';
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
    let code=null,placementClosed=false,networkClosed=false;
    try{const p=await placement.close();placementClosed=p?.closed===true;
     if(!placementClosed)code=p?.code??'NATIVE_PROCESSING_CLEANUP_UNKNOWN';}
    catch(error){code=error?.code??'NATIVE_PROCESSING_CLEANUP_UNKNOWN';}
    try{const c=await compartment.close();networkClosed=c?.closed===true;
     if(!networkClosed)code??=c?.code??'HOST_NETWORK_CLEANUP_UNKNOWN';}
    catch{code??='HOST_NETWORK_CLEANUP_UNKNOWN';}
    // The run parent is released ONLY after BOTH the placement and the namespace are proven settled; otherwise the lower
    // unknown is preserved and the borrowed/owned state is left for the outer owner.
    if(runHierarchy!==null&&placementClosed===true&&networkClosed===true){
     try{const released=await releaseOwnedHierarchy({record:runHierarchy,port:hierarchyPort});
      if(released.unknown.length>0)code??='NATIVE_PROCESSING_CLEANUP_UNKNOWN';}
     catch{code??='NATIVE_PROCESSING_CLEANUP_UNKNOWN';}
    }
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
    try{setupLife?.close?.();}catch{}
    if(code!==null)return Object.freeze({closed:false,code});
    if(entries.length>0)return Object.freeze({closed:false,code:'NATIVE_PROCESSING_CLEANUP_UNKNOWN'});
    return Object.freeze({closed:true});
   })();
   return closing;
  }});
}