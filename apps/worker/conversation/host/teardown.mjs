/** Source-only D005 teardown coordinator. The trusted host owner supplies the proxy, process-observer and
 * destruction ports. This module does not launch a host or turn a termination request into proof of absence.
 * In particular, observeAbsent must read the exact instance, its network interfaces and its root volume after
 * destruction. A failed local step never prevents the final host-destruction attempt, but leaves UNKNOWN.
 * The product must persist a verified receipt before allowing another host generation for this conversation. */
import {posix} from 'node:path';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {own,data} from '../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../../packages/runtime/operation-lifetime.mjs';
import {browserPaths,disposeBrowserState} from '../browser/workspace.mjs';
import {assertHostAllocation,assertHostRunBinding,assertD005HostIdentity} from './binding.mjs';
import {nativeAbsenceRecord} from '../../../runtime/native-processing-host/lifecycle-contract.mjs';

export const HOST_TEARDOWN_SCHEMA='meri-d005-host-teardown/1';
export const HOST_PROCESS_ABSENCE_SCHEMA='meri-d005-process-absence/1';
export const HOST_PHYSICAL_ABSENCE_SCHEMA='meri-d005-physical-absence/1';
const HEX=/^[0-9a-f]{64}$/u;
const VOLUME=/^vol-[0-9a-f]{8,17}$/u;
const INTERFACE=/^eni-[0-9a-f]{8,17}$/u;
const MAX_PHASE_MS=130000;
const fault=(code,receipt)=>Object.assign(new Error(code),{code,...(receipt?{receipt}:{})});
const fail=code=>{throw fault(code);};
const method=(port,name)=>{if(typeof port?.[name]!=='function')fail('HOST_TEARDOWN_CONFIGURATION');return port[name].bind(port);};

/** Only an authenticated host-control process observer may produce this record. Shape checks detect stale or
 * cross-run answers; they cannot authenticate the port or establish that its OS observation is sound. */
function processAbsent(value,{allocation,binding,identity,afterMs,nowMs,processScope}){
 let r;try{r=own(data(value),['schema','allocationSha256','bindingSha256','hostIdentitySha256','observedAtMs','scope','exited','remainingPids']);}
 catch{return false;}
 return r.schema===HOST_PROCESS_ABSENCE_SCHEMA&&r.allocationSha256===canonicalSha256(allocation)&&
  r.bindingSha256===canonicalSha256(binding)&&r.hostIdentitySha256===canonicalSha256(identity)&&
  Number.isSafeInteger(r.observedAtMs)&&r.observedAtMs>=afterMs&&r.observedAtMs<=nowMs&&
  r.scope===processScope&&r.exited===true&&Array.isArray(r.remainingPids)&&r.remainingPids.length===0;
}

/** The trusted destroy owner identifies the exact instance's root volume and ENIs. Request acceptance alone is
 * never physical absence; these identifiers are carried into a separate readback. */
function requestedResources(value,identity){
 let r;try{r=own(data(value),['requested','instanceId','rootVolumeId','networkInterfaceIds']);}catch{return null;}
 if(r.requested!==true||r.instanceId!==identity.instanceId||typeof r.rootVolumeId!=='string'||!VOLUME.test(r.rootVolumeId)||
  !Array.isArray(r.networkInterfaceIds)||r.networkInterfaceIds.length<1||r.networkInterfaceIds.length>16||
  new Set(r.networkInterfaceIds).size!==r.networkInterfaceIds.length||r.networkInterfaceIds.some(id=>typeof id!=='string'||!INTERFACE.test(id)))return null;
 return Object.freeze({instanceId:r.instanceId,rootVolumeId:r.rootVolumeId,networkInterfaceIds:Object.freeze([...r.networkInterfaceIds])});
}
/** An EC2 termination acknowledgement is insufficient. The trusted observer must independently read back the
 * exact instance as terminated and its identified root volume and network interfaces as absent. */
function physicallyAbsent(value,{allocation,binding,identity,resources,afterMs,nowMs}){
 if(!resources)return false;
 let r;try{r=own(data(value),['schema','allocationSha256','bindingSha256','hostIdentitySha256','instanceId','rootVolumeId','networkInterfaceIds','observedAtMs','instanceState','rootVolumeAbsent','networkInterfacesAbsent'],['evidence']);}
 catch{return false;}
 return r.schema===HOST_PHYSICAL_ABSENCE_SCHEMA&&r.allocationSha256===canonicalSha256(allocation)&&
  r.bindingSha256===canonicalSha256(binding)&&r.hostIdentitySha256===canonicalSha256(identity)&&
  r.instanceId===resources.instanceId&&r.rootVolumeId===resources.rootVolumeId&&
  Array.isArray(r.networkInterfaceIds)&&canonicalSha256(r.networkInterfaceIds)===canonicalSha256(resources.networkInterfaceIds)&&
  Number.isSafeInteger(r.observedAtMs)&&
  r.observedAtMs>=afterMs&&r.observedAtMs<=nowMs&&r.instanceState==='terminated'&&
  r.rootVolumeAbsent===true&&r.networkInterfacesAbsent===true;
}

/** Each port is borrowed. `browser`/`bash`: revoke -> {revoked:true}, close -> {closed:true};
 * `processes.waitForExit` returns HOST_PROCESS_ABSENCE_SCHEMA after observing all browser, Bash and SDK descendants;
 * `host.destroy` returns {requested:true,instanceId,rootVolumeId,networkInterfaceIds} and `host.observeAbsent`
 * returns HOST_PHYSICAL_ABSENCE_SCHEMA for those exact resources from fresh
 * cloud readbacks. The ports must bind every request to the control-owned allocation and host identity, not accept
 * these values as authority from the caller. Cleanup uses independent deadlines, never the cancelled run signal. */
/** Explicit trusted hostMode:'browser-only' accepts only browser/process/host ports and requires the distinct
 * browser-host-descendants observation. It reports Bash as not applicable, never as remotely closed. All local
 * process, profile and exact physical resource proofs remain mandatory; legacy receipts keep their old shape. */

/* An EXPLICIT allocation-owned native-processing teardown. It performs no browser/Bash cleanup,
 * reports those concerns honestly as not-applicable, and verifies the native process scope plus the owned cgroup and
 * network-namespace absence observed by the trusted native OS port. The legacy/browser code path below is untouched. */
async function nativeTeardown({a,b,i,raw,now,localCleanupMs,hostCleanupMs,reason}){
 const quiesce=method(raw.native,'close'),waitForExit=method(raw.processes,'waitForExit'),destroy=method(raw.host,'destroy'),
  observeAbsent=method(raw.host,'observeAbsent'),observeNative=method(raw.native,'observe');
 const startedAtMs=now();
 const receipt={schema:HOST_TEARDOWN_SCHEMA,allocationSha256:canonicalSha256(a),bindingSha256:canonicalSha256(b),
  hostIdentitySha256:canonicalSha256(i),reason,startedAtMs,browserEgress:'not-applicable',bashEgress:'not-applicable',
  processScope:'native-processing-descendants',processes:'unknown',browserState:'not-applicable',
  cgroup:'unknown',networkNamespace:'unknown',hostDestroy:'unknown',hostAbsence:'unknown',status:'UNKNOWN'};
 const request=()=>({allocation:structuredClone(a),binding:structuredClone(b),hostIdentity:structuredClone(i)});
 async function bounded(operation,accept,deadlineMs){
  if(!Number.isSafeInteger(now())||now()>=deadlineMs)return false;
  let life;try{life=createOperationLifetime({deadlineMs,now,errorFactory:code=>fault(code)});
   return accept(await life.run(signal=>operation(signal)),now())===true;
  }catch{return false;}finally{life?.close();}
 }
 const localDeadline=startedAtMs+localCleanupMs;
 // The native owner QUIESCES first (stop new work, cancel and settle owned operations) inside the ONE local deadline.
 const quiesced=await bounded(signal=>quiesce(request(),{signal}),r=>r?.closed===true,localDeadline);
 const afterProcessMs=now();
 // Recursive native descendants first; the cgroup/netns readback is only meaningful after the scope is empty.
 if(quiesced&&await bounded(signal=>waitForExit({...request(),scope:'native-processing-descendants'},{signal}),
  (r,checkedAt)=>processAbsent(r,{allocation:a,binding:b,identity:i,afterMs:afterProcessMs,
   nowMs:checkedAt,processScope:'native-processing-descendants'}),localDeadline))receipt.processes='exited';
 // Owned OS readback of the exact native compartment: absence of the cgroup and the network namespace, not a delete ACK.
 const observedAt=now();
 if(await bounded(signal=>observeNative(request(),{signal}),(r,checkedAt)=>{
   // The canonical PURE validator enforces schema:'meri-d005-native-absence/1', scope:'native-processing-descendants',
   // the exact closed shape (no extra fields) and removed/absent cgroup+namespace.
   const record=nativeAbsenceRecord(r);
   if(record===null)return false;
   return record.allocationSha256===canonicalSha256(a)&&record.bindingSha256===canonicalSha256(b)&&
    record.hostIdentitySha256===canonicalSha256(i)&&record.observedAtMs>=observedAt&&
    record.observedAtMs<=checkedAt;},localDeadline)){
  receipt.cgroup='removed';receipt.networkNamespace='removed';
 }

 const hostDeadline=now()+hostCleanupMs,hostRequestAtMs=now();
 let resources=null,absenceRaw=null;
 if(await bounded(signal=>destroy(request(),{signal}),r=>{resources=requestedResources(r,i);return resources!==null;},hostDeadline))
  receipt.hostDestroy='requested';
 if(await bounded(signal=>observeAbsent({...request(),...(resources?{resources:structuredClone(resources)}:{})},{signal}),
  (r,checkedAt)=>{const ok=physicallyAbsent(r,{allocation:a,binding:b,identity:i,resources,afterMs:hostRequestAtMs,nowMs:checkedAt});
   if(ok)absenceRaw=r;return ok;},
  hostDeadline))receipt.hostAbsence='confirmed';
 if(receipt.processes==='exited'&&receipt.cgroup==='removed'&&receipt.networkNamespace==='removed'&&
  receipt.hostDestroy==='requested'&&receipt.hostAbsence==='confirmed')receipt.status='VERIFIED';
 if(receipt.status==='VERIFIED'&&absenceRaw?.evidence?.protocolVersion===1){receipt.physicalEvidence=absenceRaw.evidence;
  receipt.physicalProtocolVersion=1;}
 const frozen=Object.freeze(receipt);
 if(frozen.status!=='VERIFIED')throw fault('HOST_TEARDOWN_UNKNOWN',frozen);
 return frozen;
}

export function createConversationHostTeardown({allocation,binding,hostIdentity,cwd,browserPolicySha256,ports,now=Date.now,localCleanupMs=30000,hostCleanupMs=30000,hostMode}={}){
 if(allocation?.hostMode==='native-processing'){
  if(hostMode!==undefined&&hostMode!=='native-processing')fail('HOST_TEARDOWN_CONFIGURATION');
  let na,nb,ni,nraw;
  try{na=assertHostAllocation(allocation);nb=assertHostRunBinding(na,binding);ni=assertD005HostIdentity(hostIdentity,nb,na);
   nraw=own(ports,['native','processes','host']);
   // Bind the required owners ONCE, at construction, exactly like the browser path: a later mutation of the caller's
   // object cannot retarget the native or physical owners used by the settle.
   nraw=Object.freeze({
    native:Object.freeze({close:method(nraw.native,'close'),observe:method(nraw.native,'observe')}),
    processes:Object.freeze({waitForExit:method(nraw.processes,'waitForExit')}),
    host:Object.freeze({destroy:method(nraw.host,'destroy'),observeAbsent:method(nraw.host,'observeAbsent')})});}
  catch{fail('HOST_TEARDOWN_CONFIGURATION');}
  if(typeof now!=='function'||![localCleanupMs,hostCleanupMs].every(n=>Number.isSafeInteger(n)&&n>=4&&n<=MAX_PHASE_MS))
   fail('HOST_TEARDOWN_CONFIGURATION');
  let settledNative;
  return Object.freeze({settle({reason}={}){
   if(!['conversation-end','cancelled','failed','revoked','lease-expired'].includes(reason))
    return Promise.reject(fault('HOST_TEARDOWN_CONFIGURATION'));
   settledNative??=nativeTeardown({a:na,b:nb,i:ni,raw:nraw,now,localCleanupMs,hostCleanupMs,reason});
   return settledNative;
  }});
 }
 let a,b,i,raw,browserOnly,processScope;
 try{a=assertHostAllocation(allocation);b=assertHostRunBinding(a,binding);i=assertD005HostIdentity(hostIdentity,b,a);
  const allocatedMode=a.hostMode??'conversation';if(hostMode!==undefined&&hostMode!==allocatedMode)fail('HOST_TEARDOWN_CONFIGURATION');
  browserOnly=allocatedMode==='browser-only';processScope=browserOnly?'browser-host-descendants':'browser-bash-sdk-descendants';
  raw=own(ports,browserOnly?['browser','processes','host']:['browser','bash','processes','host']);}
 catch{fail('HOST_TEARDOWN_CONFIGURATION');}
 if(typeof cwd!=='string'||!posix.isAbsolute(cwd)||posix.resolve(cwd)!==cwd||cwd.includes('\0')||!cwd.endsWith('/'+b.conversationId)||
  typeof browserPolicySha256!=='string'||!HEX.test(browserPolicySha256)||typeof now!=='function'||
  ![localCleanupMs,hostCleanupMs].every(n=>Number.isSafeInteger(n)&&n>=4&&n<=MAX_PHASE_MS))fail('HOST_TEARDOWN_CONFIGURATION');
 const browserRevoke=method(raw.browser,'revoke'),browserClose=method(raw.browser,'close');
 const bashRevoke=browserOnly?undefined:method(raw.bash,'revoke'),bashClose=browserOnly?undefined:method(raw.bash,'close');
 const waitForExit=method(raw.processes,'waitForExit'),destroy=method(raw.host,'destroy'),observeAbsent=method(raw.host,'observeAbsent');
 const paths=browserPaths(cwd),context=Object.freeze({allocation:a,binding:b,hostIdentity:i});
 let settled;
 async function bounded(operation,accept,deadlineMs){
  if(!Number.isSafeInteger(now())||now()>=deadlineMs)return false;
  let life;try{life=createOperationLifetime({deadlineMs,now,errorFactory:code=>fault(code)});
   return accept(await life.run(signal=>operation(signal)),now())===true;
  }catch{return false;}finally{life?.close();}
 }
 const request=()=>({allocation:structuredClone(a),binding:structuredClone(b),hostIdentity:structuredClone(i)});
 async function run(reason){
  const startedAtMs=now();
  const receipt={schema:HOST_TEARDOWN_SCHEMA,allocationSha256:canonicalSha256(a),bindingSha256:canonicalSha256(b),
   hostIdentitySha256:canonicalSha256(i),reason,startedAtMs,browserEgress:'unknown',bashEgress:browserOnly?'not-applicable':'unknown',
   ...(browserOnly?{processScope}:{}),
   processes:'unknown',browserState:'not-attempted',hostDestroy:'unknown',hostAbsence:'unknown',status:'UNKNOWN'};
  const localDeadline=startedAtMs+localCleanupMs,quarter=Math.floor(localCleanupMs/4);
  const revokeDeadline=Math.min(localDeadline,now()+quarter);
  const [browserRevokeOk,bashRevokeOk]=await Promise.all([
   bounded(signal=>browserRevoke({binding:structuredClone(b),policySha256:browserPolicySha256},{signal}),r=>r?.revoked===true,revokeDeadline),
   browserOnly?true:bounded(signal=>bashRevoke(request(),{signal}),r=>r?.revoked===true,revokeDeadline),
  ]);
  const closeDeadline=Math.min(localDeadline,now()+quarter);
  const [browserCloseOk,bashCloseOk]=await Promise.all([
   bounded(signal=>browserClose({signal}),r=>r?.closed===true,closeDeadline),
   browserOnly?true:bounded(signal=>bashClose({signal}),r=>r?.closed===true,closeDeadline),
  ]);
  if(browserRevokeOk&&browserCloseOk)receipt.browserEgress='closed';
  if(!browserOnly&&bashRevokeOk&&bashCloseOk)receipt.bashEgress='closed';
  const afterProcessMs=now();
  if(await bounded(signal=>waitForExit({...request(),profile:paths.profile,scope:processScope},{signal}),
   (r,checkedAt)=>processAbsent(r,{...context,identity:i,afterMs:afterProcessMs,nowMs:checkedAt,processScope}),localDeadline)){
   receipt.processes='exited';
   receipt.browserState=await bounded(signal=>disposeBrowserState(paths,{signal}),r=>r?.disposed===true,localDeadline)?'disposed':'unknown';
  }
  // A fresh deadline ensures a failed or hung local operation cannot prevent the managed-host backstop request.
  const hostDeadline=now()+hostCleanupMs;
  const hostRequestAtMs=now();
  let resources=null;
  if(await bounded(signal=>destroy(request(),{signal}),r=>{resources=requestedResources(r,i);return resources!==null;},hostDeadline))receipt.hostDestroy='requested';
  if(await bounded(signal=>observeAbsent({...request(),...(resources?{resources:structuredClone(resources)}:{})},{signal}),
   (r,checkedAt)=>physicallyAbsent(r,{...context,identity:i,resources,afterMs:hostRequestAtMs,nowMs:checkedAt}),hostDeadline))receipt.hostAbsence='confirmed';
  if(receipt.browserEgress==='closed'&&(browserOnly?receipt.bashEgress==='not-applicable':receipt.bashEgress==='closed')&&receipt.processes==='exited'&&
   receipt.browserState==='disposed'&&receipt.hostDestroy==='requested'&&receipt.hostAbsence==='confirmed')receipt.status='VERIFIED';
  const frozen=Object.freeze(receipt);
  if(frozen.status!=='VERIFIED')throw fault('HOST_TEARDOWN_UNKNOWN',frozen);
  return frozen;
 }
 return Object.freeze({settle({reason}={}){
  if(!['conversation-end','cancelled','failed','revoked','lease-expired'].includes(reason))return Promise.reject(fault('HOST_TEARDOWN_CONFIGURATION'));
  settled??=run(reason);return settled;
 }});
}
