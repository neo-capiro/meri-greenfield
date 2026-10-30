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
 for(const lease of [allocation.leaseDeadlineMs,fixed.leaseDeadlineMs]){
  if(!Number.isSafeInteger(lease)||lease<=now())refuse();
 }
 return true;
}

export async function openNativeProcessingHost({config,allocation,binding,hostIdentity,authority,signal,
 openCompartment=prepareProcessingCompartment,openPlacement=createProcessingPlacement}={}){
 if(!allocation||!binding||!hostIdentity||typeof authority?.readCurrent!=='function')
  fault('NATIVE_PROCESSING_AUTHORITY_UNBOUND');
 assertHostMatch({config,allocation,binding,hostIdentity});
 if(config?.allocation?.leaseDeadlineMs<Date.now())fault('NATIVE_PROCESSING_ALLOCATION_REFUSED');
 const {command,args,settings}=childInvocation(config);
 let compartment=null,placement=null;
 try{
  compartment=await openCompartment({allocation,binding,signal});
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
 return Object.freeze({placement,compartment,
  async runRequest({requestDocument,deadlineMs,signal:callSignal}){
   if(closing!==null)fault('NATIVE_PROCESSING_CLOSED');
   const input=Buffer.from(JSON.stringify({settings,request:requestDocument,deadlineMs}));
   if(input.length>UPLOAD_INSPECTION_WIRE_BYTES+65536)fault('UPLOAD_INSPECTION_REQUEST_REFUSED');
   return placement.run(command,args,{cwd:config.paths.home,input,signal:callSignal,deadlineMs,
    maxOutput:UPLOAD_INSPECTION_RESULT_BYTES});
  },
  close(){
   if(closing===null)closing=(async()=>{
    let code=null;
    try{const p=await placement.close();if(p?.closed!==true)code=p?.code??'NATIVE_PROCESSING_CLEANUP_UNKNOWN';}
    catch(error){code=error?.code??'NATIVE_PROCESSING_CLEANUP_UNKNOWN';}
    try{const c=await compartment.close();if(c?.closed!==true)code??=c?.code??'HOST_NETWORK_CLEANUP_UNKNOWN';}
    catch{code??='HOST_NETWORK_CLEANUP_UNKNOWN';}
    if(code!==null)return Object.freeze({closed:false,code});
    return Object.freeze({closed:true});
   })();
   return closing;
  }});
}
