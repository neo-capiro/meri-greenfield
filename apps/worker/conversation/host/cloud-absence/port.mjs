// @ts-check
/** One-use, source-only EC2 teardown adapter. AWS credentials and the managed watchdog belong to control. */
import {setTimeout as sleep} from 'node:timers/promises';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {own,data} from '../../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertHostAllocation,assertHostRunBinding,assertD005HostIdentity} from '../binding.mjs';
import {HOST_PHYSICAL_ABSENCE_SCHEMA} from '../teardown.mjs';
import {assertResources,decodeOwnedInstance,decodeAttachedRoot,decodeAttachedEni,
 decodeTerminationAck,decodeTerminatedInstance,decodeDeletedRoot,decodeEniReadback} from './wire.mjs';

const ACCOUNT='967807252336',REGION='us-east-1';
const AWS_ID=/^(?:ami|vpc|subnet|sg)-(?:[0-9a-f]{8}|[0-9a-f]{17})$/u;
const fail=code=>{throw Object.assign(new Error(code),{code});};
const unknown=()=>fail('HOST_PHYSICAL_UNKNOWN');
const required=(port,name)=>{if(typeof port?.[name]!=='function')fail('HOST_PHYSICAL_CONFIGURATION');return port[name].bind(port);};
const exact=(value,keys)=>{try{return own(value,keys);}catch{fail('HOST_PHYSICAL_CONFIGURATION');}};

/** The returned object is the trusted `host` port for `createConversationHostTeardown`.
 * `ec2` consists of injected AWS SDK v3 request methods. It must not be supplied by the guest or model. */
export function createEc2PhysicalTeardownPort({allocation,binding,hostIdentity,expected,ec2,now=Date.now,
 pause=(ms,signal)=>sleep(ms,undefined,{signal}),operationMs=25000,pollMs=500,maxRounds=3}={}){
 let a,b,i,e,scope;
 try{
  a=assertHostAllocation(allocation);b=assertHostRunBinding(a,binding);
  i=assertD005HostIdentity(hostIdentity,b,a);
  e=exact(expected,['accountId','region','amiId','vpcId','subnetId','securityGroupId','rootDeviceName']);
  scope=exact(ec2?.scope,['accountId','region']);
 }catch{fail('HOST_PHYSICAL_CONFIGURATION');}
 if(e.accountId!==ACCOUNT||e.region!==REGION||scope.accountId!==ACCOUNT||scope.region!==REGION||
  !['amiId','vpcId','subnetId','securityGroupId'].every(key=>typeof e[key]==='string'&&AWS_ID.test(e[key]))||
  !e.amiId.startsWith('ami-')||!e.vpcId.startsWith('vpc-')||!e.subnetId.startsWith('subnet-')||
  !e.securityGroupId.startsWith('sg-')||e.rootDeviceName!=='/dev/xvda'||
  typeof now!=='function'||typeof pause!=='function'||!Number.isSafeInteger(operationMs)||operationMs<100||operationMs>120000||
  !Number.isSafeInteger(pollMs)||pollMs<1||pollMs>operationMs||
  !Number.isSafeInteger(maxRounds)||maxRounds<1||maxRounds>8)fail('HOST_PHYSICAL_CONFIGURATION');
 const describeInstances=required(ec2,'describeInstances');
 const describeVolumes=required(ec2,'describeVolumes');
 const describeNetworkInterfaces=required(ec2,'describeNetworkInterfaces');
 const terminateInstances=required(ec2,'terminateInstances');
 const hashes=Object.freeze({allocationSha256:canonicalSha256(a),bindingSha256:canonicalSha256(b),
  hostIdentitySha256:canonicalSha256(i)});
 const validRequest=request=>{
  let r;
  try{r=own(request,['allocation','binding','hostIdentity']);
   if(canonicalSha256(data(r.allocation))!==hashes.allocationSha256||
    canonicalSha256(data(r.binding))!==hashes.bindingSha256||
    canonicalSha256(data(r.hostIdentity))!==hashes.hostIdentitySha256)unknown();
  }catch{unknown();}
 };
 const validAbsenceRequest=request=>{
  let r;try{r=own(request,['allocation','binding','hostIdentity','resources']);}catch{unknown();}
  validRequest({allocation:r.allocation,binding:r.binding,hostIdentity:r.hostIdentity});
  return assertResources(r.resources,i);
 };
 /** An abandoned AWS request may finish remotely; no subsequent mutation is dispatched after its deadline. */
 const bounded=async(fn,deadline,externalSignal)=>{
  if(externalSignal?.aborted||!Number.isSafeInteger(now())||now()>=deadline)unknown();
  const life=new AbortController();
  let listener;
  const cancelled=new Promise((_,reject)=>{listener=()=>reject(Object.assign(new Error('HOST_PHYSICAL_UNKNOWN'),{code:'HOST_PHYSICAL_UNKNOWN'}));
   life.signal.addEventListener('abort',listener,{once:true});});
  const onAbort=()=>life.abort();
  externalSignal?.addEventListener('abort',onAbort,{once:true});
  if(externalSignal?.aborted)life.abort();
  const remaining=Math.max(1,Math.min(operationMs,deadline-now()));
  const timer=setTimeout(()=>life.abort(),remaining);
  try{
   const value=await Promise.race([Promise.resolve().then(()=>fn(life.signal)),cancelled]);
   if(life.signal.aborted||now()>deadline)unknown();
   return value;
  }catch{unknown();}
  finally{clearTimeout(timer);life.signal.removeEventListener('abort',listener);
   externalSignal?.removeEventListener('abort',onAbort);}
 };
 let destroyPromise,absencePromise,resources,stickyUnknown=false;
 async function destroyOnce(signal){
  const deadline=now()+operationMs;
  try{
   const rawInstance=await bounded(s=>describeInstances({InstanceIds:[i.instanceId]},{signal:s}),deadline,signal);
   const identified=decodeOwnedInstance(rawInstance,{allocation:a,hostIdentity:i,expected:e});
   const rawVolume=await bounded(s=>describeVolumes({VolumeIds:[identified.rootVolumeId]},{signal:s}),deadline,signal);
   decodeAttachedRoot(rawVolume,identified,{allocation:a,hostIdentity:i,expected:e});
   for(const eniId of identified.networkInterfaceIds){
    const rawEni=await bounded(s=>describeNetworkInterfaces({NetworkInterfaceIds:[eniId]},{signal:s}),deadline,signal);
    decodeAttachedEni(rawEni,eniId,identified,{expected:e});
   }
   if(signal?.aborted||now()>=deadline)unknown();
   // Record the one attempt before dispatch. An unknown ACK never causes a retry.
   resources=identified;
   const ack=await bounded(s=>terminateInstances({InstanceIds:[i.instanceId]},{signal:s}),deadline,signal);
   decodeTerminationAck(ack,i.instanceId);
   return Object.freeze({requested:true,instanceId:identified.instanceId,rootVolumeId:identified.rootVolumeId,
    networkInterfaceIds:[...identified.networkInterfaceIds]});
  }catch{stickyUnknown=true;unknown();}
 }
 async function observeOnce(signal){
  if(stickyUnknown||!resources)unknown();
  const deadline=now()+operationMs;
  let state='unknown',rootAbsent=false,enisAbsent=false;
  try{
   for(let round=0;round<maxRounds;round++){
    const rawInstance=await bounded(s=>describeInstances({InstanceIds:[i.instanceId]},{signal:s}),deadline,signal);
    state=decodeTerminatedInstance(rawInstance,i.instanceId,e.accountId)?'terminated':'unknown';
    const rawVolume=await bounded(s=>describeVolumes({VolumeIds:[resources.rootVolumeId]},{signal:s}),deadline,signal);
    rootAbsent=decodeDeletedRoot(rawVolume,resources.rootVolumeId);
    const eniStates=[];
    for(const eniId of resources.networkInterfaceIds){
     const rawEni=await bounded(s=>describeNetworkInterfaces({NetworkInterfaceIds:[eniId]},{signal:s}),deadline,signal);
     eniStates.push(decodeEniReadback(rawEni,eniId));
    }
    enisAbsent=eniStates.every(Boolean);
    if(state==='terminated'&&rootAbsent&&enisAbsent)break;
    if(round+1<maxRounds)await bounded(s=>pause(pollMs,s),deadline,signal);
   }
  }catch{stickyUnknown=true;unknown();}
  const observedAtMs=now();
  if(!Number.isSafeInteger(observedAtMs)||observedAtMs>deadline){stickyUnknown=true;unknown();}
  return Object.freeze({schema:HOST_PHYSICAL_ABSENCE_SCHEMA,...hashes,
   instanceId:resources.instanceId,rootVolumeId:resources.rootVolumeId,
   networkInterfaceIds:[...resources.networkInterfaceIds],observedAtMs,
   instanceState:state,rootVolumeAbsent:rootAbsent,networkInterfacesAbsent:enisAbsent});
 }
 return Object.freeze({
  destroy(request,{signal}={}){
   validRequest(request);if(stickyUnknown) return Promise.reject(Object.assign(new Error('HOST_PHYSICAL_UNKNOWN'),{code:'HOST_PHYSICAL_UNKNOWN'}));
   destroyPromise??=destroyOnce(signal);return destroyPromise;
  },
  observeAbsent(request,{signal}={}){
   const supplied=validAbsenceRequest(request);
   if(!destroyPromise||!resources||stickyUnknown||canonicalSha256(supplied)!==canonicalSha256(resources))
    return Promise.reject(Object.assign(new Error('HOST_PHYSICAL_UNKNOWN'),{code:'HOST_PHYSICAL_UNKNOWN'}));
   absencePromise??=destroyPromise.then(()=>observeOnce(signal));return absencePromise;
  },
 });
}
