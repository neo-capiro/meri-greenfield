/** Closed native host-local lifecycle contract + producer (finite72-75). NOT public authority: the trusted Control peer is
 * authenticated by the existing native TLS listener in the next pass. Proof comes from ACTUAL Linux cgroup/boot observation and
 * exact path readback; every wait is bounded by the existing operation lifetime. No sockets/TLS/cloud/child processes. */
import {lstatSync} from 'node:fs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {createLinuxHostCgroupPorts} from '../../worker/conversation/host/host-wide-process-observer.mjs';
import {assertNativeProcessingAllocation,assertHostRunBinding,assertD005HostIdentity} from '../../worker/conversation/host/binding.mjs';
import {createNetworkPlan} from '../../worker/conversation/host/network/plan.mjs';
import {parseCgroupEvents} from '../../worker/conversation/host/process-observer.mjs';
import {HOST_PROCESS_ABSENCE_SCHEMA} from '../../worker/conversation/host/teardown.mjs';

const DIGEST=/^sha256:[a-f0-9]{64}$/u;
const fault=code=>{throw Object.assign(new Error(code),{code});};
const refuse=fault;
const hostGroupPath=allocation=>`/sys/fs/cgroup/meri/hosts/${allocation.hostId}-${allocation.generation}`;
const deadlineFor=(requested,now,timeoutMs)=>Number.isSafeInteger(requested)
 ?Math.min(requested,now()+timeoutMs):now()+timeoutMs;
function lifeFor({signal,deadlineMs},now,timeoutMs,code='NATIVE_LIFECYCLE_CANCELLED'){
 try{
  // The factory must RETURN an Error (lifetime close() passes it to abort()); deny() is what throws.
  return createOperationLifetime({deadlineMs:deadlineFor(deadlineMs,now,timeoutMs),now,signal,
   errorFactory:()=>Object.assign(new Error(code),{code})});
 }catch{fault(code);}
}

export {NATIVE_LIFECYCLE_PATH,NATIVE_LIFECYCLE_SCHEMA,NATIVE_ABSENCE_SCHEMA,NATIVE_LIFECYCLE_ACTIONS,
 NATIVE_LIFECYCLE_MAX_MS,NATIVE_LIFECYCLE_BODY_BYTES,nativeLifecycleRequest,nativeAbsenceRecord} from './lifecycle-contract.mjs';
import {NATIVE_LIFECYCLE_PATH,NATIVE_LIFECYCLE_SCHEMA,NATIVE_ABSENCE_SCHEMA,NATIVE_LIFECYCLE_ACTIONS,
 NATIVE_LIFECYCLE_MAX_MS,nativeLifecycleRequest} from './lifecycle-contract.mjs';

export async function openNativeLifecycle({config,quiesce,ports,lstat=lstatSync,now=Date.now,timeoutMs=NATIVE_LIFECYCLE_MAX_MS,
 signal,deadlineMs}={}){
 if(typeof quiesce!=='function'||typeof now!=='function'||typeof lstat!=='function'||
  !Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>NATIVE_LIFECYCLE_MAX_MS)
  refuse('NATIVE_LIFECYCLE_CONFIGURATION');
 if(config===null||typeof config!=='object'||config.binding===undefined||
  typeof config?.image?.digest!=='string'||!DIGEST.test(config.image.digest))
  refuse('NATIVE_LIFECYCLE_CONFIGURATION');
 if(signal?.aborted===true||(Number.isSafeInteger(deadlineMs)&&deadlineMs<=now()))
  refuse('NATIVE_LIFECYCLE_CANCELLED');
 const c=config.allocation;
 if(c===null||typeof c!=='object')refuse('NATIVE_LIFECYCLE_CONFIGURATION');
 let allocation,binding,hostIdentity;
 try{
  allocation=assertNativeProcessingAllocation({schema:'meri-conversation-host-allocation/1',
   tenantId:c.tenantId,conversationId:c.conversationId,generation:c.generation,hostId:c.hostId,
   imageDigest:config.image.digest,leaseDeadlineMs:c.leaseDeadlineMs,hostMode:c.hostMode});
  binding=assertHostRunBinding(allocation,config.binding);
  hostIdentity=assertD005HostIdentity({schema:'meri-d005-host-identity/1',instanceId:c.instanceId,bootId:c.bootId,
   conversationId:c.conversationId,hostId:c.hostId},binding,allocation);
 }catch{refuse('NATIVE_LIFECYCLE_CONFIGURATION');}
 // Immutable validated copy; later caller mutation cannot retarget requests or paths.
 const trusted=Object.freeze({allocation:Object.freeze({...allocation}),binding:Object.freeze({...binding}),
  hostIdentity:Object.freeze({...hostIdentity}),imageDigest:config.image.digest});
 const groupPath=hostGroupPath(trusted.allocation);
 const privileged=ports===undefined?createLinuxHostCgroupPorts():ports;
 if(typeof privileged?.openGroup!=='function'||typeof privileged.readBootId!=='function')
  refuse('NATIVE_LIFECYCLE_CONFIGURATION');
 const stopping=new AbortController();
 const combined=caller=>caller===undefined?stopping.signal:AbortSignal.any([caller,stopping.signal]);
 const startupLife=lifeFor({signal:combined(signal),deadlineMs},now,timeoutMs);
 let group=null,disposed=false,closeState=null,quiescePromise=null,quiesceResult=null;
 let lateClosed=false;
 // ONE cached disposal per acquired handle: concurrent and later callers share the same raw close promise and the same
 // truthful outcome. A timeout/failure is sticky (unknown) and the raw promise is still observed so ownership is kept.
 let disposalPromise=null, disposalResult=null;
 function closeGroupOnce(){
  if(disposalResult!==null)return Promise.resolve(disposalResult);
  if(disposalPromise!==null)return disposalPromise;
  const handle=group;
  if(handle===null){disposalResult=true;return Promise.resolve(true);}
  let closing;try{closing=Promise.resolve(handle.close());}catch{closing=Promise.reject(Error('CLOSE_THROW'));}
  closing.catch(()=>{});
  disposalPromise=(async()=>{
   let timer;
   const timeout=new Promise(resolve=>{timer=setTimeout(()=>resolve('TIMEOUT'),5000);});
   try{
    const outcome=await Promise.race([closing.then(()=>true,()=>false),timeout]);
    if(outcome===true){group=null;disposalResult=true;return true;}
    if(outcome==='TIMEOUT'){
     // Late physical close is still observed; it never upgrades the reported outcome.
     // A late raw close is observed, and the handle is released, but it can never upgrade the cached outcome.
     closing.then(()=>{group=null;},()=>{});
     disposalResult=false;return false;
    }
    disposalResult=false;return false;
   }finally{clearTimeout(timer);}
  })();
  return disposalPromise;
 }
 try{
  const bootBefore=await startupLife.run(()=>privileged.readBootId());
  if(bootBefore!==trusted.hostIdentity.bootId)refuse('NATIVE_LIFECYCLE_REFUSED');
  // Raw late acquisition retained: a handle arriving after the startup timeout/abort is closed exactly once, never adopted.
  const opening=Promise.resolve().then(()=>privileged.openGroup(groupPath));
  opening.catch(()=>{});
  try{group=await startupLife.run(()=>opening);}
  catch(error){
   opening.then(late=>{
    if(late===null||typeof late!=='object'||typeof late.close!=='function')return;
    if(lateClosed)return;lateClosed=true;
    Promise.resolve().then(()=>late.close()).catch(()=>{});
   }).catch(()=>{});
   throw error;
  }
  if(group===null||typeof group!=='object'||typeof group.readEvents!=='function'||typeof group.close!=='function')
   refuse('NATIVE_LIFECYCLE_REFUSED');
  const bootAfter=await startupLife.run(()=>privileged.readBootId());
  if(bootAfter!==trusted.hostIdentity.bootId)refuse('NATIVE_LIFECYCLE_REFUSED');
 }catch(error){
  await closeGroupOnce();
  throw error;
 }finally{startupLife.close();}

 function startQuiesce(){
  if(quiescePromise!==null)return quiescePromise;
  // ONE host-owned cleanup lifetime with its own signal: independent of any requesting caller's disconnect.
  const cleanLife=createOperationLifetime({deadlineMs:now()+timeoutMs,now,
   errorFactory:()=>Object.assign(new Error('NATIVE_LIFECYCLE_UNKNOWN'),{code:'NATIVE_LIFECYCLE_UNKNOWN'})});
  quiescePromise=Promise.resolve()
   .then(()=>cleanLife.run(signal=>quiesce({signal,deadlineMs:cleanLife.deadline()})))
   .then(result=>{quiesceResult=result;
    closeState=Object.freeze({status:result?.closed===true?'closed':'unknown',quiescedAtMs:now()});return result;},
    ()=>{quiesceResult=Object.freeze({closed:false});
     closeState=Object.freeze({status:'unknown',quiescedAtMs:now()});return quiesceResult;})
   .finally(()=>cleanLife.close());
  return quiescePromise;
 }
 const digests=record=>({allocationSha256:canonicalSha256(record.allocation),
  bindingSha256:canonicalSha256(record.binding),hostIdentitySha256:canonicalSha256(record.hostIdentity)});
 const trustedConfig=Object.freeze({allocation:Object.freeze({hostId:trusted.allocation.hostId,
   generation:trusted.allocation.generation,tenantId:trusted.allocation.tenantId,
   conversationId:trusted.allocation.conversationId,hostMode:trusted.allocation.hostMode,
   leaseDeadlineMs:trusted.allocation.leaseDeadlineMs,instanceId:trusted.hostIdentity.instanceId,
   bootId:trusted.hostIdentity.bootId}),binding:trusted.binding,image:Object.freeze({digest:trusted.imageDigest})});
 async function targetFor(request,action,life){
  const parsed=nativeLifecycleRequest(request,{config:trustedConfig});
  if(parsed.action!==action)refuse('NATIVE_LIFECYCLE_REFUSED');
  if(disposed)fault('NATIVE_LIFECYCLE_UNKNOWN');
  try{life.check();}catch{fault('NATIVE_LIFECYCLE_CANCELLED');}
  return parsed;
 }
 const afterAwait=life=>{if(disposed)fault('NATIVE_LIFECYCLE_UNKNOWN');try{life.check();}catch{fault('NATIVE_LIFECYCLE_CANCELLED');}};
 async function proofInputs(life){
  if(closeState===null||closeState.status!=='closed')fault('NATIVE_LIFECYCLE_UNKNOWN');
  afterAwait(life);
  const boot=await life.run(()=>privileged.readBootId());afterAwait(life);
  if(boot!==trusted.hostIdentity.bootId)fault('NATIVE_LIFECYCLE_UNKNOWN');
  let events;try{events=await life.run(()=>group.readEvents());}catch{fault('NATIVE_LIFECYCLE_UNKNOWN');}
  afterAwait(life);
  let populated;try{populated=parseCgroupEvents(events);}catch{fault('NATIVE_LIFECYCLE_UNKNOWN');}
  if(populated!==0)fault('NATIVE_LIFECYCLE_UNKNOWN');
  return true;
 }
 const lifecycle=Object.freeze({
  path:NATIVE_LIFECYCLE_PATH,
  cgroupPath:groupPath,
  async close(request,options){
   if(disposed)fault('NATIVE_LIFECYCLE_UNKNOWN');
   const life=lifeFor({signal:combined(options?.signal),deadlineMs:options?.deadlineMs},now,timeoutMs);
   try{
    const record=await targetFor(request,'close',life);
    // Ownership transfer happens INSIDE the caller's lifetime pre-invocation check: an abort/expiry BEFORE this point
    // starts zero quiesce work. Once started, the shared cleanup is independent of this caller.
    let settlement;
    try{settlement=await life.run(()=>startQuiesce());}
    catch{if(disposed)fault('NATIVE_LIFECYCLE_UNKNOWN');fault('NATIVE_LIFECYCLE_CANCELLED');}
    try{await life.run(()=>settlement);}
    catch{if(disposed)fault('NATIVE_LIFECYCLE_UNKNOWN');fault('NATIVE_LIFECYCLE_CANCELLED');}
    afterAwait(life);
    if(closeState===null)fault('NATIVE_LIFECYCLE_UNKNOWN');
    return Object.freeze({schema:NATIVE_LIFECYCLE_SCHEMA,action:'close',...digests(record),
     status:closeState.status,quiescedAtMs:closeState.quiescedAtMs});
   }finally{life.close();}
  },
  async processes(request,options){
   if(disposed)fault('NATIVE_LIFECYCLE_UNKNOWN');
   const life=lifeFor({signal:combined(options?.signal),deadlineMs:options?.deadlineMs},now,timeoutMs);
   try{
    const record=await targetFor(request,'processes',life);
    await proofInputs(life);
    const bootAfter=await life.run(()=>privileged.readBootId());afterAwait(life);
    if(bootAfter!==trusted.hostIdentity.bootId)fault('NATIVE_LIFECYCLE_UNKNOWN');
    return Object.freeze({schema:HOST_PROCESS_ABSENCE_SCHEMA,...digests(record),observedAtMs:now(),
     scope:'native-processing-descendants',exited:true,remainingPids:Object.freeze([])});
   }finally{life.close();}
  },
  async observe(request,options){
   if(disposed)fault('NATIVE_LIFECYCLE_UNKNOWN');
   const life=lifeFor({signal:combined(options?.signal),deadlineMs:options?.deadlineMs},now,timeoutMs);
   try{
    const record=await targetFor(request,'observe',life);
    await proofInputs(life);
    const leafPath=`${groupPath}/${canonicalSha256(trusted.binding)}/processing`;
    const plan=createNetworkPlan({allocation:trusted.allocation,binding:trusted.binding,kind:'processing',routes:[]});
    if(!Array.isArray(plan.routes)||plan.routes.length!==0)fault('NATIVE_LIFECYCLE_UNKNOWN');
    const absent=path=>{
     afterAwait(life);
     try{lstat(path);return false;}
     catch(error){if(error?.code!=='ENOENT')fault('NATIVE_LIFECYCLE_UNKNOWN');return true;}
    };
    if(!absent(leafPath)||!absent(plan.namespacePath))fault('NATIVE_LIFECYCLE_UNKNOWN');
    const bootAfter=await life.run(()=>privileged.readBootId());afterAwait(life);
    if(bootAfter!==trusted.hostIdentity.bootId)fault('NATIVE_LIFECYCLE_UNKNOWN');
    return Object.freeze({schema:NATIVE_ABSENCE_SCHEMA,...digests(record),observedAtMs:now(),
     scope:'native-processing-descendants',cgroup:'removed',networkNamespace:'removed',status:'absent'});
   }finally{life.close();}
  },
  async dispose(){
   // disposed + stopping are set SYNCHRONOUSLY, before any await.
   stopping.abort();disposed=true;
   const outcome=disposalResult!==null?disposalResult:await closeGroupOnce();
   // The cached settled outcome is authoritative: a late raw close after an unknown timeout never upgrades it.
   return outcome===true?Object.freeze({closed:true})
    :Object.freeze({closed:false,code:'NATIVE_LIFECYCLE_UNKNOWN'});
  },
 });
 return lifecycle;
}
