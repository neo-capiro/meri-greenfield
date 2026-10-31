// @ts-check
/** One-use, source-only EC2 teardown adapter. AWS credentials and the managed watchdog belong to control. */
import {setTimeout as sleep} from 'node:timers/promises';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {own,data} from '../../../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertHostAllocation,assertHostRunBinding,assertD005HostIdentity} from '../binding.mjs';
import {HOST_PHYSICAL_ABSENCE_SCHEMA} from '../teardown.mjs';
import {validateNativePhysicalEvidence,NATIVE_PHYSICAL_OPERATION_MS} from '../../../../../packages/contracts/native-physical-absence.mjs';
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
export function createEc2PhysicalTeardownPort({allocation,binding,hostIdentity,expected,ec2,caller,now=Date.now,
 pause=(ms,signal)=>sleep(ms,undefined,{signal}),operationMs=NATIVE_PHYSICAL_OPERATION_MS,pollMs=500,maxRounds=3}={}){
 let a,b,i,e,scope;
 try{
  a=assertHostAllocation(allocation);b=assertHostRunBinding(a,binding);
  i=assertD005HostIdentity(hostIdentity,b,a);
  e=exact(expected,['accountId','region','amiId','vpcId','subnetId','securityGroupId','rootDeviceName']);
  scope=exact(ec2?.scope,['accountId','region']);
 }catch{fail('HOST_PHYSICAL_CONFIGURATION');}
 if(e.accountId!==ACCOUNT||e.region!==REGION||scope.accountId!==ACCOUNT||scope.region!==REGION||
  caller!==undefined&&(caller.accountId!==e.accountId||caller.region!==e.region)||
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
 const bounded=async(fn,deadline,externalSignal,notFoundCode)=>{
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
  }catch(error){
   if(notFoundCode!==undefined&&(error?.name===notFoundCode||error?.code===notFoundCode))
    return Object.freeze({resourceNotFound:true,errorCode:notFoundCode,observedAtMs:now(),
     requestId:error?.$metadata?.requestId,httpStatusCode:error?.$metadata?.httpStatusCode});
   unknown();
  }
  finally{clearTimeout(timer);life.signal.removeEventListener('abort',listener);
   externalSignal?.removeEventListener('abort',onAbort);}
 };
 let destroyPromise,absencePromise,resources,preObservation,originalDeadline,stickyUnknown=false;
 async function destroyOnce(signal){
  const deadline=now()+operationMs;
  originalDeadline=deadline;
  try{
   const rawInstance=await bounded(s=>describeInstances({InstanceIds:[i.instanceId]},{signal:s}),deadline,signal);
   const identified=decodeOwnedInstance(rawInstance,{allocation:a,hostIdentity:i,expected:e});
   const rawVolume=await bounded(s=>describeVolumes({VolumeIds:[identified.rootVolumeId]},{signal:s}),deadline,signal);
   decodeAttachedRoot(rawVolume,identified,{allocation:a,hostIdentity:i,expected:e});
   const volumePre={volumeId:identified.rootVolumeId,state:'in-use',requestId:rawVolume?.$metadata?.requestId,
    httpStatusCode:rawVolume?.$metadata?.httpStatusCode,attachmentInstanceId:i.instanceId,deleteOnTermination:true};
   const enisPre=[];
   for(const eniId of identified.networkInterfaceIds){
    const rawEni=await bounded(s=>describeNetworkInterfaces({NetworkInterfaceIds:[eniId]},{signal:s}),deadline,signal);
    decodeAttachedEni(rawEni,eniId,identified,{expected:e});
    enisPre.push({id:eniId,attachmentInstanceId:i.instanceId,deleteOnTermination:true,
     requestId:rawEni?.$metadata?.requestId,httpStatusCode:rawEni?.$metadata?.httpStatusCode});
   }
   if(signal?.aborted||now()>=deadline)unknown();
   // Record the one attempt before dispatch. An unknown ACK never causes a retry.
   preObservation=Object.freeze({...identified.preObservation,atMs:now(),volume:Object.freeze(volumePre),
    networkInterfaces:Object.freeze(enisPre.map(x=>Object.freeze(x)))});
   resources=Object.freeze({instanceId:identified.instanceId,rootVolumeId:identified.rootVolumeId,
    networkInterfaceIds:identified.networkInterfaceIds});
   const ack=await bounded(s=>terminateInstances({InstanceIds:[i.instanceId]},{signal:s}),deadline,signal);
   decodeTerminationAck(ack,i.instanceId);
   return Object.freeze({requested:true,instanceId:identified.instanceId,rootVolumeId:identified.rootVolumeId,
    networkInterfaceIds:[...identified.networkInterfaceIds]});
  }catch{stickyUnknown=true;unknown();}
 }
 async function observeOnce(signal){
  if(stickyUnknown||!resources)unknown();
  const deadline=originalDeadline??(now()+operationMs);
  const evidence={schema:'meri-native-correlated-absence/1',protocolVersion:1,
   accountId:e.accountId,region:e.region,
   ...(caller===undefined?{}:{caller:Object.freeze({...caller})}),
   instanceId:resources.instanceId,rootVolumeId:resources.rootVolumeId,
   networkInterfaceIds:Object.freeze([...resources.networkInterfaceIds]),
   preObservation:preObservation??null,operationDeadlineMs:deadline,terminalObservation:null,resources:Object.freeze([])};
  const volumes=[],enis=new Map(resources.networkInterfaceIds.map(id=>[id,[]]));
  let terminal=null,rootAbsent=false,enisAbsent=false;
  try{
   for(let round=0;round<maxRounds;round++){
    const rawInstance=await bounded(s=>describeInstances({InstanceIds:[i.instanceId]},{signal:s}),deadline,signal);
    const terminated=decodeTerminatedInstance(rawInstance,i.instanceId,e.accountId);
    if(terminated&&terminal===null){
     terminal={atMs:now(),instanceId:resources.instanceId,state:'terminated',
      requestId:rawInstance?.$metadata?.requestId,httpStatusCode:rawInstance?.$metadata?.httpStatusCode};
     // The first absence read must be causally later than the positive terminal observation.
     await bounded(s=>pause(Math.max(pollMs,1),s),deadline,signal);
    }
    if(terminal===null){
     if(round+1<maxRounds){const backoff=Math.min(operationMs,Math.max(pollMs,1)*2**round);
      await bounded(s=>pause(backoff,s),deadline,signal);}
     continue;
    }
    const rawVolume=await bounded(s=>describeVolumes({VolumeIds:[resources.rootVolumeId]},{signal:s}),deadline,signal,
     'InvalidVolume.NotFound');
    const volumeAbsent=rawVolume?.resourceNotFound===true||decodeDeletedRoot(rawVolume,resources.rootVolumeId)===true;
    const volumeAt=now();
    if(volumeAbsent){if(volumes.length===0||volumeAt>volumes.at(-1).atMs)
      volumes.push(Object.freeze({atMs:volumeAt,absent:true,resourceId:resources.rootVolumeId,
       ...(rawVolume?.resourceNotFound===true?{errorCode:rawVolume.errorCode,
        requestId:rawVolume.requestId,httpStatusCode:rawVolume.httpStatusCode}:
        {volumeState:'deleted',requestId:rawVolume?.$metadata?.requestId,
         httpStatusCode:rawVolume?.$metadata?.httpStatusCode})}));}
    else volumes.length=0;
    let allEniAbsent=true;
    for(const eniId of resources.networkInterfaceIds){
     const rawEni=await bounded(s=>describeNetworkInterfaces({NetworkInterfaceIds:[eniId]},{signal:s}),deadline,signal,
      'InvalidNetworkInterfaceID.NotFound');
     const absent=rawEni?.resourceNotFound===true;
     const list=enis.get(eniId),at=now();
     if(absent){if(list.length===0||at>list.at(-1).atMs)
      list.push(Object.freeze({atMs:at,absent:true,resourceId:eniId,
       ...(rawEni?.resourceNotFound===true?{errorCode:rawEni.errorCode,
        requestId:rawEni.requestId,httpStatusCode:rawEni.httpStatusCode}:
        {requestId:rawEni?.$metadata?.requestId,httpStatusCode:rawEni?.$metadata?.httpStatusCode})}));}
     else list.length=0;
     if(list.length<2)allEniAbsent=false;
    }
    rootAbsent=volumes.length>=2;
    enisAbsent=allEniAbsent;
    if(terminal!==null&&rootAbsent&&enisAbsent)break;
    if(round+1<maxRounds){
     const backoff=Math.min(operationMs,Math.max(pollMs,1)*2**round);
     await bounded(s=>pause(backoff,s),deadline,signal);
    }
   }
  }catch{stickyUnknown=true;unknown();}
  const observedAtMs=now();
  if(!Number.isSafeInteger(observedAtMs)||observedAtMs>deadline){stickyUnknown=true;unknown();}
  evidence.terminalObservation=terminal===null?null:Object.freeze(terminal);
  evidence.resources=Object.freeze([
   Object.freeze({kind:'volume',id:resources.rootVolumeId,observations:Object.freeze([...volumes])}),
   ...resources.networkInterfaceIds.map(id=>Object.freeze({kind:'network-interface',id,
    observations:Object.freeze([...(enis.get(id)??[])])})),
  ]);
  if(terminal===null||!rootAbsent||!enisAbsent){stickyUnknown=true;unknown();}
  try{validateNativePhysicalEvidence(evidence,{nowMs:observedAtMs,instanceId:resources.instanceId,
   rootVolumeId:resources.rootVolumeId,networkInterfaceIds:resources.networkInterfaceIds,deadlineMs:deadline,
   accountId:e.accountId,region:e.region});}catch{stickyUnknown=true;unknown();}
  return Object.freeze({schema:HOST_PHYSICAL_ABSENCE_SCHEMA,...hashes,
   instanceId:resources.instanceId,rootVolumeId:resources.rootVolumeId,
   networkInterfaceIds:[...resources.networkInterfaceIds],observedAtMs,
   instanceState:'terminated',rootVolumeAbsent:true,networkInterfacesAbsent:true,
   evidence:Object.freeze(evidence)});
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
