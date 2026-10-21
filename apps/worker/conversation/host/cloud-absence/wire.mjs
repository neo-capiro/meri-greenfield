// @ts-check
/** Strict, successful AWS SDK v3 EC2 response decoding. No error or missing response proves absence. */
import {types} from 'node:util';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';

const SUFFIX='(?:[0-9a-f]{8}|[0-9a-f]{17})';
const ID={instance:new RegExp(`^i-${SUFFIX}$`,'u'),volume:new RegExp(`^vol-${SUFFIX}$`,'u'),
 eni:new RegExp(`^eni-${SUFFIX}$`,'u')};
const UNKNOWN='HOST_PHYSICAL_UNKNOWN';
const fail=()=>{throw Object.assign(new Error(UNKNOWN),{code:UNKNOWN});};
const object=value=>{
 if(!value||typeof value!=='object'||Array.isArray(value)||types.isProxy(value)||
  ![Object.prototype,null].includes(Object.getPrototypeOf(value)))fail();
 return value;
};
const field=(value,name)=>{
 const descriptor=Object.getOwnPropertyDescriptor(object(value),name);
 if(!descriptor||!Object.hasOwn(descriptor,'value')||!descriptor.enumerable)fail();
 return descriptor.value;
};
const optional=(value,name)=>Object.hasOwn(object(value),name)?field(value,name):undefined;
const array=value=>{
 if(!Array.isArray(value)||types.isProxy(value)||Object.getPrototypeOf(value)!==Array.prototype||value.length>1000)fail();
 const descriptors=Object.getOwnPropertyDescriptors(value);
 if(Reflect.ownKeys(descriptors).length!==value.length+1)fail();
 for(let index=0;index<value.length;index++){
  const descriptor=descriptors[String(index)];
  if(!descriptor||!Object.hasOwn(descriptor,'value')||!descriptor.enumerable)fail();
 }
 return value;
};
const one=value=>{const items=array(value);if(items.length!==1)fail();return items[0];};
const id=(value,kind)=>{if(typeof value!=='string'||!ID[kind].test(value))fail();return value;};
const same=(a,b)=>{if(a!==b)fail();};
const done=response=>{
 const meta=field(response,'$metadata');
 if(field(meta,'httpStatusCode')!==200||typeof field(meta,'requestId')!=='string'||
  !/^[A-Za-z0-9-]{8,128}$/u.test(field(meta,'requestId')))fail();
 const token=optional(response,'NextToken');if(token!==undefined&&token!==null&&token!=='')fail();
 return response;
};
const tagged=(tags,expected)=>{
 const seen=new Map();
 for(const item of array(tags)){
  const key=field(item,'Key'),value=field(item,'Value');
  if(typeof key!=='string'||typeof value!=='string'||seen.has(key))fail();seen.set(key,value);
 }
 for(const [key,value] of Object.entries(expected))same(seen.get(key),value);
};
const ownerTags=({allocation,allocationSha256})=>({Project:'meri-greenfield',MeriHostId:allocation.hostId,
 MeriGeneration:String(allocation.generation),MeriAllocationSha256:allocationSha256});

/** Pin the exact instance and its complete root/ENI identity before termination. */
export function decodeOwnedInstance(raw,{allocation,hostIdentity,expected}){
 done(raw);
 const reservation=one(field(raw,'Reservations'));
 same(field(reservation,'OwnerId'),expected.accountId);
 const instance=one(field(reservation,'Instances'));
 same(id(field(instance,'InstanceId'),'instance'),hostIdentity.instanceId);
 same(field(instance,'ImageId'),expected.amiId);
 same(field(instance,'VpcId'),expected.vpcId);
 same(field(instance,'SubnetId'),expected.subnetId);
 tagged(field(instance,'Tags'),ownerTags({allocation,allocationSha256:canonicalSha256(allocation)}));
 if(optional(instance,'PublicIpAddress')!==undefined||optional(instance,'PublicDnsName')!==undefined)fail();
 const state=field(instance,'State');
 const states=new Map([['pending',0],['running',16],['shutting-down',32],['terminated',48],['stopping',64],['stopped',80]]);
 if(states.get(field(state,'Name'))!==field(state,'Code'))fail();
 const rootName=field(instance,'RootDeviceName');
 same(rootName,expected.rootDeviceName);
 same(field(instance,'RootDeviceType'),'ebs');
 const mapping=one(field(instance,'BlockDeviceMappings'));
 same(field(mapping,'DeviceName'),rootName);
 const ebs=field(mapping,'Ebs');
 const rootVolumeId=id(field(ebs,'VolumeId'),'volume');
 same(field(ebs,'DeleteOnTermination'),true);
 const networkInterfaces=array(field(instance,'NetworkInterfaces'));
 if(networkInterfaces.length<1||networkInterfaces.length>16)fail();
 const networkInterfaceIds=[];
 for(const nic of networkInterfaces){
  const eniId=id(field(nic,'NetworkInterfaceId'),'eni');
  if(networkInterfaceIds.includes(eniId))fail();
  same(field(nic,'OwnerId'),expected.accountId);
  same(field(nic,'VpcId'),expected.vpcId);
  same(field(nic,'SubnetId'),expected.subnetId);
  const groups=array(field(nic,'Groups'));
  if(groups.length!==1||field(groups[0],'GroupId')!==expected.securityGroupId)fail();
  if(optional(nic,'Association')!==undefined&&optional(nic,'Association')!==null)fail();
  const attachment=field(nic,'Attachment');
  same(field(attachment,'InstanceId'),hostIdentity.instanceId);
  same(field(attachment,'DeleteOnTermination'),true);
  if(networkInterfaces.length===1)same(field(attachment,'DeviceIndex'),0);
  networkInterfaceIds.push(eniId);
 }
 return Object.freeze({instanceId:hostIdentity.instanceId,rootVolumeId,
  networkInterfaceIds:Object.freeze(networkInterfaceIds)});
}

/** Pre-termination exact-ID reads prevent a stale instance mapping from authorizing a foreign resource. */
export function decodeAttachedRoot(raw,resources,{allocation,hostIdentity,expected}){
 done(raw);
 const volume=one(field(raw,'Volumes'));
 same(id(field(volume,'VolumeId'),'volume'),resources.rootVolumeId);
 same(field(volume,'State'),'in-use');
 same(field(volume,'OwnerId'),expected.accountId);
 same(field(volume,'Encrypted'),true);
 tagged(field(volume,'Tags'),ownerTags({allocation,allocationSha256:canonicalSha256(allocation)}));
 const attachment=one(field(volume,'Attachments'));
 same(field(attachment,'InstanceId'),hostIdentity.instanceId);
 same(field(attachment,'VolumeId'),resources.rootVolumeId);
 same(field(attachment,'Device'),expected.rootDeviceName);
 same(field(attachment,'DeleteOnTermination'),true);
}
export function decodeAttachedEni(raw,eniId,resources,{expected}){
 done(raw);
 const nic=one(field(raw,'NetworkInterfaces'));
 same(id(field(nic,'NetworkInterfaceId'),'eni'),eniId);
 same(field(nic,'OwnerId'),expected.accountId);
 same(field(nic,'VpcId'),expected.vpcId);
 same(field(nic,'SubnetId'),expected.subnetId);
 const groups=array(field(nic,'Groups'));
 if(groups.length!==1||field(groups[0],'GroupId')!==expected.securityGroupId)fail();
 if(optional(nic,'Association')!==undefined&&optional(nic,'Association')!==null)fail();
 same(field(field(nic,'Attachment'),'InstanceId'),resources.instanceId);
 same(field(field(nic,'Attachment'),'DeleteOnTermination'),true);
}

/** Acknowledge only one exact terminate response; this is not physical exit. */
export function decodeTerminationAck(raw,instanceId){
 done(raw);
 const item=one(field(raw,'TerminatingInstances'));
 same(id(field(item,'InstanceId'),'instance'),instanceId);
 const state=field(item,'CurrentState');
 const name=field(state,'Name'),code=field(state,'Code');
 if(!((name==='shutting-down'&&code===32)||(name==='terminated'&&code===48)))fail();
 return true;
}

/** Explicit terminated state must be read after the request from the same exact instance. */
export function decodeTerminatedInstance(raw,instanceId,ownerAccountId){
 done(raw);
 const reservation=one(field(raw,'Reservations'));
 same(field(reservation,'OwnerId'),ownerAccountId);
 const instance=one(field(reservation,'Instances'));
 same(id(field(instance,'InstanceId'),'instance'),instanceId);
 const state=field(instance,'State');
 return field(state,'Name')==='terminated'&&field(state,'Code')===48;
}

/** Empty lists and NotFound exceptions are UNKNOWN. `deleted` is an explicit terminal EBS state. */
export function decodeDeletedRoot(raw,rootVolumeId){
 done(raw);
 const volumes=array(field(raw,'Volumes'));
 if(volumes.length>1)fail();
 if(volumes.length===0)return false;
 const volume=volumes[0];
 same(id(field(volume,'VolumeId'),'volume'),rootVolumeId);
 return field(volume,'State')==='deleted';
}

/** EC2 DescribeNetworkInterfaces has no documented deleted status. Never infer ENI absence from an empty list. */
export function decodeEniReadback(raw,eniId){
 done(raw);
 const nics=array(field(raw,'NetworkInterfaces'));
 if(nics.length>1)fail();
 if(nics.length===0)return false;
 same(id(field(nics[0],'NetworkInterfaceId'),'eni'),eniId);
 return false;
}

export function assertResources(value,hostIdentity){
 const v=object(value);
 const instanceId=field(v,'instanceId'),rootVolumeId=field(v,'rootVolumeId');
 same(instanceId,hostIdentity.instanceId);
 id(rootVolumeId,'volume');
 const ids=array(field(v,'networkInterfaceIds'));
 if(ids.length<1||ids.length>16||new Set(ids).size!==ids.length)fail();
 for(const candidate of ids)id(candidate,'eni');
 return Object.freeze({instanceId,rootVolumeId,
  networkInterfaceIds:Object.freeze([...ids])});
}
