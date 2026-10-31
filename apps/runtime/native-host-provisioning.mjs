/** Canonical native host provisioning coordinator. One durable reservation row, one absolute lease/deadline and
 * one acknowledged first claim authorize a single provider launch. Existing/unknown/restarted rows reconcile only.
 * Protected deployment configuration supplies account/region/placement/launch/image/source/bootstrap; model or
 * tool arguments never do. No credential, issuer or SSM transport is implemented here. */
import {randomUUID,X509Certificate} from 'node:crypto';
import {RunInstancesCommand,DescribeInstancesCommand} from '@aws-sdk/client-ec2';
import {canonicalSha256 as hash} from '../../packages/contracts/validate.mjs';
import {own,nativeSignal} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {storageMethod} from '../artifacts/storage/boundary.mjs';
import {createOperationLifetime} from '../../packages/runtime/operation-lifetime.mjs';
import {NATIVE_PHYSICAL_OPERATION_MS} from '../../packages/contracts/native-physical-absence.mjs';
import {assertNativeLaunch,compileNativeDeployment} from './native-deployment-configuration.mjs';
import {NATIVE_DECLARATION_V2,nativeObserverLaunchRequest,nativeObserverLaunchTags,nativeObserverDeadline} from '../../packages/contracts/native-observer.mjs';
export {assertNativeLaunch};

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const HEX=/^[0-9a-f]{64}$/u;
const UNKNOWN='NATIVE_HOST_PROVISION_UNKNOWN',EFFECT_UNKNOWN='NATIVE_HOST_EFFECT_UNKNOWN';
const fault=(code,cause)=>{const e=Object.assign(new Error(code),{code});if(cause!==undefined)e.cause=cause;return e;};
const requiredLaunch=['ImageId','InstanceType','SubnetId','SecurityGroupIds','IamInstanceProfile'];
const optionalLaunch=['UserData','MetadataOptions','BlockDeviceMappings','EbsOptimized'];
const allowedLaunch=new Set([...requiredLaunch,...optionalLaunch]);

export function nativeHostId({binding,generation}){
 const h=hash({schema:'meri-native-host-provision/1',binding,generation});
 return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;
}
/** Acyclic: token hashes only the protected pre-token intent (never token, tags or declaration digest). */
export function nativeHostProvisionToken(intent){return hash({schema:'meri-native-host-provision-token/2',...intent});}

function tagsFor({token,hostId,generation,placementSha256,allocationSha256,declarationSha256,allocation,declaration}){
 if(declaration!==undefined){
  if(declaration.schema!==NATIVE_DECLARATION_V2||hash(declaration)!==declarationSha256||
   declaration.token!==token||allocation.hostId!==hostId||allocation.generation!==generation||
   hash(allocation)!==allocationSha256||hash(declaration.placement)!==placementSha256)throw fault(UNKNOWN);
  return nativeObserverLaunchTags({allocation,declaration});
 }
 return Object.freeze({MeriProvisionToken:token,MeriHostId:hostId,MeriGeneration:String(generation),
  MeriPlacementSha256:placementSha256,MeriAllocationSha256:allocationSha256,
  ...(declarationSha256?{MeriDeclarationSha256:declarationSha256}:{})});
}
function matchInstance(instance,tags){
 if(instance===null||typeof instance!=='object'||typeof instance.instanceId!=='string')throw fault(UNKNOWN);
 if(!['pending','running'].includes(instance.state))throw fault('NATIVE_HOST_PROVISION_REFUSED');
 for(const [k,v] of Object.entries(tags))if(instance.tags?.[k]!==v)throw fault('NATIVE_HOST_PROVISION_REFUSED');
 return Object.freeze({instanceId:instance.instanceId,privateIp:instance.privateIp??null});
}

/** Actual EC2 boundary with SEPARATE reconcile and launch operations. reconcileOnly NEVER calls RunInstances. */
export function createEc2NativeHostLaunchPort({ec2,launch}){
 const send=storageMethod(ec2,'send'),spec=assertNativeLaunch(launch);
 async function reconcileOnly({identity,signal}){
  nativeSignal(signal);signal?.throwIfAborted();
  if(!HEX.test(identity?.token))throw fault('NATIVE_HOST_PROVISION_REFUSED');
  const tags=tagsFor(identity);let next,pages=0;const found=[];
  do{
   if(++pages>16)throw fault(UNKNOWN);
   const r=await send(new DescribeInstancesCommand({Filters:[{Name:'tag:MeriProvisionToken',Values:[identity.token]}],
    MaxResults:100,...(next?{NextToken:next}:{})}),{abortSignal:signal});
   signal?.throwIfAborted();
   for(const rv of r?.Reservations??[])for(const i of rv?.Instances??[]){
    const it=Object.fromEntries((i?.Tags??[]).map(t=>[t.Key,t.Value]));
    if(it.MeriProvisionToken!==identity.token)continue;
    found.push({instanceId:i.InstanceId,state:i.State?.Name,privateIp:i.PrivateIpAddress??null,tags:it});
   }
   if(found.length>1)throw fault(UNKNOWN);
   next=r?.NextToken;
  }while(next);
  if(!found.length)return Object.freeze({state:'absent'});
  return Object.freeze({state:'existing',...matchInstance(found[0],tags)});
 }
 return Object.freeze({
  reconcileOnly,
  async launchOnce({identity,signal}){
   if(identity?.declaration?.schema!==NATIVE_DECLARATION_V2)throw fault('NATIVE_HOST_PROVISION_REFUSED');
   if(hash(identity.declaration.launch)!==hash(spec))throw fault('NATIVE_HOST_PROVISION_REFUSED');
   const request=nativeObserverLaunchRequest(identity);
   const before=await reconcileOnly({identity,signal});
   if(before.state==='existing')return before;
   let out;
   try{
    out=await send(new RunInstancesCommand(request),
     {abortSignal:signal});
   }catch(error){
    signal?.throwIfAborted();
    const after=await reconcileOnly({identity,signal}).catch(()=>{throw fault(EFFECT_UNKNOWN,error);});
    if(after.state==='existing')return after;
    throw fault(EFFECT_UNKNOWN,error);
   }
   signal?.throwIfAborted();
   const list=out?.Instances??[];
   if(list.length!==1||typeof list[0].InstanceId!=='string'||!list[0].InstanceId)throw fault(EFFECT_UNKNOWN);
   return Object.freeze({state:'created',instanceId:list[0].InstanceId,privateIp:list[0].PrivateIpAddress??null});
  },
 });
}

export const NATIVE_PROVISIONING_EFFECT_TIMEOUT_MS=90000;
export function createNativeHostProvisioning({writer,launch,material,deployment,authority,watchdog,now=Date.now,
 effectTimeoutMs=NATIVE_PROVISIONING_EFFECT_TIMEOUT_MS,ownerId=randomUUID}){
 if(!writer||typeof writer.reserveNativeHost!=='function'||typeof writer.claimNativeHostDispatch!=='function'||
  typeof writer.recordNativeHostInstance!=='function'||typeof writer.readNativeReservation!=='function'||
  typeof writer.admit!=='function')throw fault('NATIVE_HOST_PROVISION_CONFIGURATION');
 if(!launch||typeof launch.launchOnce!=='function'||typeof launch.reconcileOnly!=='function')
  throw fault('NATIVE_HOST_PROVISION_CONFIGURATION');
 if(!material||typeof material.forHost!=='function')throw fault('NATIVE_HOST_PROVISION_CONFIGURATION');
 if(!authority||typeof authority.verify!=='function')throw fault('NATIVE_HOST_PROVISION_CONFIGURATION');
 if(!watchdog||typeof watchdog.verify!=='function'||typeof watchdog.makeIntent!=='function'||
  typeof watchdog.arm!=='function')throw fault('NATIVE_HOST_PROVISION_CONFIGURATION');
 if(!deployment||typeof deployment!=='object')throw fault('NATIVE_HOST_PROVISION_CONFIGURATION');
 if(!Number.isSafeInteger(effectTimeoutMs)||effectTimeoutMs<1000||effectTimeoutMs>600000)
  throw fault('NATIVE_HOST_PROVISION_CONFIGURATION');
 let d;try{d=compileNativeDeployment(deployment);}catch{throw fault('NATIVE_HOST_PROVISION_CONFIGURATION');}
 const launchSpec=d.launch,placement=d.placement,maxLifetimeMs=d.maxLifetimeMs;

 function verifyReservation(reservation,binding,generation,hostId){
  if(reservation.allocation.hostId!==hostId||reservation.allocation.generation!==generation||
   hash(reservation.originalBinding)!==hash(binding)||reservation.declaration.imageDigest!==d.imageDigest||
   reservation.declaration.bootstrapSha256!==d.bootstrapSha256||
   (reservation.declaration.nativeHelperSha256??undefined)!==(d.nativeHelperSha256??undefined)||
   (reservation.declaration.maxLifetimeMs??600000)!==maxLifetimeMs||
   reservation.declaration.sourceCommit!==d.sourceCommit||reservation.declaration.accountId!==d.accountId||
   reservation.declaration.region!==d.region||hash(reservation.declaration.bootstrapSpec)!==hash(d.bootstrapSpec)||
   hash(reservation.declaration.placement)!==hash(placement)||hash(reservation.declaration.launch)!==hash(launchSpec)||
   hash(reservation.declaration.physicalObserver??null)!==hash(d.physicalObserver??null)||
   reservation.declaration.launchTagPolicy!==d.launchTagPolicy)
   throw fault('NATIVE_HOST_PROVISION_REFUSED');
  return reservation;
 }
 async function finish(reservation,instanceId,privateIp,state,binding,life){
  life.check();
  const source={imageDigest:d.imageDigest,sourceCommit:d.sourceCommit,bootstrapSha256:d.bootstrapSha256,
   ...(d.nativeHelperSha256!==undefined?{nativeHelperSha256:d.nativeHelperSha256}:{}),maxLifetimeMs};
  const input={binding,generation:reservation.allocation.generation,hostId:reservation.allocation.hostId,
   declaration:Object.freeze(source),instanceId,state,privateIp,signal:life.signal};
  const mat=await life.run(()=>material.forHost(input));
  const m=own(mat,['hostIdentity','endpoint','hostCertificate','serverCertificate','ownerInstanceId','leaseDeadlineMs']);
  if(m.ownerInstanceId!==reservation.ownerInstanceId||m.leaseDeadlineMs!==reservation.allocation.leaseDeadlineMs)
   throw fault('NATIVE_HOST_PROVISION_REFUSED');
  const hi=own(m.hostIdentity,['schema','hostId','conversationId','instanceId','bootId']);
  if(hi.schema!=='meri-d005-host-identity/1'||hi.hostId!==reservation.allocation.hostId||
   hi.instanceId!==instanceId||hi.conversationId!==reservation.allocation.conversationId||!UUID.test(hi.bootId))
   throw fault('NATIVE_HOST_PROVISION_REFUSED');
  const endpoint=own(m.endpoint,['address','port','serverName']);
  if(privateIp!==null&&endpoint.address!==privateIp)throw fault('NATIVE_HOST_PROVISION_REFUSED');
  life.check();
  const rec={allocation:reservation.allocation,originalBinding:reservation.originalBinding,hostIdentity:hi,
   ownerInstanceId:reservation.ownerInstanceId,endpoint,hostCertificate:m.hostCertificate,
   serverCertificate:m.serverCertificate};
  let saved;
  try{saved=await life.run(()=>writer.admit({record:rec,signal:life.signal}));}
  catch(error){
   if(error?.code!=='BROWSER_HOST_ALLOCATION_UNKNOWN')throw error;
   const row=await life.run(()=>writer.readNativeReservation({hostId:reservation.allocation.hostId,
    generation:reservation.allocation.generation,signal:life.signal}));
   if(row?.state==='active'){
    try{saved=await life.run(()=>writer.admit({record:rec,signal:life.signal}));}
    catch{throw fault(EFFECT_UNKNOWN,error);}
   }else throw fault(EFFECT_UNKNOWN,error);
  }
  return Object.freeze({state, saved,hostId:reservation.allocation.hostId,
   generation:reservation.allocation.generation,instanceId,ownerInstanceId:reservation.ownerInstanceId,
   leaseDeadlineMs:reservation.allocation.leaseDeadlineMs,token:reservation.declaration.token});
 }

 return Object.freeze({
  async provision(raw){
   const {binding,generation,signal:callerSignal,deadlineMs:requestDeadline}=own(raw,['binding','generation'],['signal','deadlineMs']);nativeSignal(callerSignal);
   if(requestDeadline!==undefined&&(!Number.isSafeInteger(requestDeadline)||requestDeadline<=now()))throw fault('NATIVE_HOST_PROVISION_REFUSED');
   if(!binding||typeof binding!=='object'||typeof binding.tenantId!=='string'||!binding.tenantId||
    !UUID.test(binding.conversationId)||!UUID.test(binding.runId)||!Number.isSafeInteger(binding.writerFence)||
    binding.writerFence<1||!Number.isSafeInteger(generation)||generation<1)
    throw fault('NATIVE_HOST_PROVISION_REFUSED');
   const hostId=nativeHostId({binding,generation});
   const life=createOperationLifetime({deadlineMs:Math.min(now()+effectTimeoutMs,...(Number.isSafeInteger(requestDeadline)?[requestDeadline]:[])),now,signal:callerSignal,
    errorFactory:code=>fault(code==='CANCELLED'?'NATIVE_HOST_PROVISION_CANCELLED':
     code==='DEADLINE'?'NATIVE_HOST_PROVISION_DEADLINE':code)});
   try{
    const initialRead=writer.readNativeReservation({hostId,generation,signal:life.signal});
    let reservation=await life.run(()=>initialRead);
    if(reservation!==null){
     verifyReservation(reservation,binding,generation,hostId);
     const current=await life.run(s=>authority.verify({binding,generation,deadlineMs:life.deadline(),signal:s}));
     if(!current||!Number.isSafeInteger(current.currentUntilMs)||current.currentUntilMs<=now()||
      !Number.isSafeInteger(current.executionDeadlineMs)||current.executionDeadlineMs<=now())
      throw fault('NATIVE_HOST_PROVISION_REFUSED');
     life.limitDeadline(Math.min(reservation.allocation.leaseDeadlineMs,current.executionDeadlineMs));
     const intent=reservation.declaration.watchdog;
     if(!intent||intent.schema!=='meri-native-watchdog-intent/1'||intent.executionName!==`${hostId}-g${generation}`||
      intent.input?.hostId!==hostId||intent.input?.generation!==generation||
      intent.leaseDeadlineMs!==reservation.allocation.leaseDeadlineMs||
      intent.cleanupCeilingMs!==reservation.allocation.leaseDeadlineMs+NATIVE_PHYSICAL_OPERATION_MS||
      intent.input?.allocationSha256!==hash(reservation.allocation))
      throw fault('NATIVE_HOST_PROVISION_REFUSED');
     const pre=await life.run(s=>watchdog.arm({intent,signal:s}));
     if(!pre||pre.armed!==true||pre.executionArn!==intent.executionArn||pre.hostId!==hostId||
      pre.generation!==generation||(pre.cleanupCeilingMs??pre.deadlineMs)!==intent.cleanupCeilingMs)throw fault('NATIVE_HOST_PROVISION_REFUSED');
     const identity={token:reservation.declaration.token,hostId,generation,placementSha256:hash(placement),
      allocationSha256:hash(reservation.allocation),declarationSha256:reservation.declarationSha256,
      ...(d.physicalObserver?{allocation:reservation.allocation,declaration:reservation.declaration}:{})};
     if(reservation.state==='reserved'){
      const claim=await life.run(s=>writer.claimNativeHostDispatch({hostId,generation,
       declarationSha256:reservation.declarationSha256,signal:s}));
      if(claim.disposition==='send-once'){
       const launched=await life.run(s=>launch.launchOnce({identity,signal:s}));
       if(!['created','existing'].includes(launched.state))throw fault(EFFECT_UNKNOWN);
       const rec=await life.run(s=>writer.recordNativeHostInstance({hostId,generation,
        declarationSha256:reservation.declarationSha256,instanceId:launched.instanceId,
        privateIp:launched.privateIp??null,signal:s}));
       return await finish(rec,launched.instanceId,launched.privateIp??null,
        launched.state==='existing'?'existing':'created',binding,life);
      }
     }
     const found=await life.run(s=>launch.reconcileOnly({identity,signal:s}));
     if(found.state!=='existing')throw fault(EFFECT_UNKNOWN);
     if(reservation.observedInstance!==null&&reservation.observedInstance.instanceId!==found.instanceId)
      throw fault('NATIVE_HOST_PROVISION_REFUSED');
     const observed=reservation.observedInstance;
     if(observed===null||(observed.privateIp===null&&found.privateIp!==null))
      reservation=await life.run(s=>writer.recordNativeHostInstance({hostId,generation,
       declarationSha256:reservation.declarationSha256,instanceId:found.instanceId,
       privateIp:found.privateIp??null,signal:s}));
     return await finish(reservation,found.instanceId,found.privateIp??null,'existing',binding,life);
    }
    const current=await life.run(s=>authority.verify({binding,generation,deadlineMs:life.deadline(),signal:s}));
    if(!current||!Number.isSafeInteger(current.currentUntilMs)||current.currentUntilMs<=now()||
     !Number.isSafeInteger(current.executionDeadlineMs)||current.executionDeadlineMs<=now())
     throw fault('NATIVE_HOST_PROVISION_REFUSED');
    const ownerInstanceId=ownerId();
    if(!UUID.test(ownerInstanceId))throw fault('NATIVE_HOST_PROVISION_CONFIGURATION');
    // Reserve the existing cleanup window inside the unchanged 15-minute actual certificate limit.
    // The 2s margin covers the issuer's 1s backdate plus DER second rounding; no original lease is renewed.
    const credentialLeaseCap=d.physicalObserver===undefined?Infinity:Math.min(now()+900000-NATIVE_PHYSICAL_OPERATION_MS-2000,
     Date.parse(new X509Certificate(d.bootstrapSpec.control.clientCertificate).validTo)-NATIVE_PHYSICAL_OPERATION_MS);
    const leaseDeadlineMs=Math.min(now()+maxLifetimeMs,current.executionDeadlineMs,credentialLeaseCap);
    if(!Number.isSafeInteger(leaseDeadlineMs)||leaseDeadlineMs<=now()||leaseDeadlineMs>now()+900000)throw fault('NATIVE_HOST_PROVISION_REFUSED');
    life.limitDeadline(leaseDeadlineMs);
    const allocation=Object.freeze({schema:'meri-conversation-host-allocation/1',tenantId:binding.tenantId,
     conversationId:binding.conversationId,generation,hostId,hostMode:'native-processing',imageDigest:d.imageDigest,
     leaseDeadlineMs});
    const placementSha256=hash(placement),allocationSha256=hash(allocation);
    const intent=Object.freeze({binding,generation,hostId,ownerInstanceId,leaseDeadlineMs,accountId:d.accountId,
     region:d.region,placement,launch:launchSpec,imageDigest:d.imageDigest,sourceCommit:d.sourceCommit,
     bootstrapSha256:d.bootstrapSha256,...(d.nativeHelperSha256!==undefined?{nativeHelperSha256:d.nativeHelperSha256}:{}),
     maxLifetimeMs,bootstrapSpec:d.bootstrapSpec,
     ...(d.physicalObserver?{physicalObserver:d.physicalObserver,launchTagPolicy:d.launchTagPolicy}:{})});
    const token=nativeHostProvisionToken(intent);
    const tags0=tagsFor({token,hostId,generation,placementSha256,allocationSha256});
    const watchdogIntent=await watchdog.makeIntent({hostId,generation,
     t0Ms:now(),deadlineMs:leaseDeadlineMs,leaseDeadlineMs,cleanupCeilingMs:nativeObserverDeadline(leaseDeadlineMs),
     allocationSha256,sourceCommit:d.sourceCommit,imageDigest:d.imageDigest,
     bootstrapSha256:d.bootstrapSha256,...(d.nativeHelperSha256!==undefined?{nativeHelperSha256:d.nativeHelperSha256}:{}),
     placementSha256,launchSha256:hash(launchSpec),controlPolicySha256:d.bootstrapSpec.control.policySha256,
     provisionToken:token,...(d.physicalObserver?{physicalObserver:d.physicalObserver,placement,launch:launchSpec}:{})});
    const declaration=Object.freeze({schema:d.physicalObserver?NATIVE_DECLARATION_V2:'meri-native-provisioning-declaration/1',imageDigest:d.imageDigest,
     sourceCommit:d.sourceCommit,bootstrapSha256:d.bootstrapSha256,
     ...(d.nativeHelperSha256!==undefined?{nativeHelperSha256:d.nativeHelperSha256}:{}),
     accountId:d.accountId,region:d.region,placement,launch:launchSpec,token,tags:tags0,leaseDeadlineMs,
     maxLifetimeMs,bootstrapSpec:d.bootstrapSpec,watchdog:watchdogIntent,
     ...(d.physicalObserver?{physicalObserver:d.physicalObserver,launchTagPolicy:d.launchTagPolicy}:{})});
    let reserved;
    try{reserved=await life.run(s=>writer.reserveNativeHost({allocation,originalBinding:binding,ownerInstanceId,
     declaration,signal:s}));}
    catch(error){if(error?.code!=='BROWSER_HOST_ALLOCATION_UNKNOWN')throw error;throw fault(EFFECT_UNKNOWN,error);}
    const declarationSha256=hash(declaration);
    const identity={token,hostId,generation,placementSha256,allocationSha256,declarationSha256,
     ...(d.physicalObserver?{allocation,declaration}:{})};
    const armed=await life.run(s=>watchdog.arm({intent:reserved.declaration.watchdog,signal:s}));
    if(!armed||armed.armed!==true||armed.executionArn!==watchdogIntent.executionArn||armed.hostId!==hostId||
     armed.generation!==generation||(armed.cleanupCeilingMs??armed.deadlineMs)!==leaseDeadlineMs+NATIVE_PHYSICAL_OPERATION_MS)throw fault('NATIVE_HOST_PROVISION_REFUSED');
    const claim=await life.run(s=>writer.claimNativeHostDispatch({hostId,generation,
     declarationSha256:reserved.declarationSha256,signal:s}));
    if(claim.disposition!=='send-once'){
     const found=await life.run(s=>launch.reconcileOnly({identity,signal:s}));
     if(found.state!=='existing')throw fault(EFFECT_UNKNOWN);
     const rec=await life.run(s=>writer.recordNativeHostInstance({hostId,generation,
      declarationSha256:reserved.declarationSha256,instanceId:found.instanceId,
      privateIp:found.privateIp??null,signal:s}));
     return await finish(rec,found.instanceId,found.privateIp??null,'existing',binding,life);
    }
    const launched=await life.run(s=>launch.launchOnce({identity,signal:s}));
    if(!['created','existing'].includes(launched.state))throw fault(EFFECT_UNKNOWN);
    const rec=await life.run(s=>writer.recordNativeHostInstance({hostId,generation,
     declarationSha256:reserved.declarationSha256,instanceId:launched.instanceId,
     privateIp:launched.privateIp??null,signal:s}));
    return await finish(rec,launched.instanceId,launched.privateIp??null,
     launched.state==='existing'?'existing':'created',binding,life);
   }finally{life.close();}
  },
 });
}

