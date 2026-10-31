/** Pure native deployment configuration owner shared by worker config validation and the provisioning
 * coordinator. No SDK client, credential, clock or provider effect is constructed here. */
import {own} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {assertNativeBootstrapSpec} from '../../packages/contracts/native-bootstrap.mjs';
import {assertNativeObserver,assertNativeObserverPlacement,NATIVE_OBSERVER_TAG_POLICY} from '../../packages/contracts/native-observer.mjs';
const fault=()=>Object.assign(Error('NATIVE_PROVISIONING_CONFIGURATION'),{code:'NATIVE_PROVISIONING_CONFIGURATION'});
const refuse=()=>{throw fault();};
const hostRefuse=()=>{throw Object.assign(Error('NATIVE_HOST_PROVISION_CONFIGURATION'),{code:'NATIVE_HOST_PROVISION_CONFIGURATION'});};
const requiredLaunch=['ImageId','InstanceType','SubnetId','SecurityGroupIds','IamInstanceProfile'];
const optionalLaunch=['UserData','MetadataOptions','BlockDeviceMappings','EbsOptimized'];
const allowedLaunch=new Set([...requiredLaunch,...optionalLaunch]);
const integer=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;

export function assertNativeLaunch(launch){
 if(launch===null||typeof launch!=='object'||Array.isArray(launch))hostRefuse();
 if(Object.keys(launch).some(k=>!allowedLaunch.has(k)))hostRefuse();
 for(const k of requiredLaunch)if(!(k in launch))hostRefuse();
 if(!/^ami-[0-9a-f]{8,17}$/u.test(launch.ImageId))hostRefuse();
 if(!/^[a-z0-9-]+\.[a-z0-9]+$/u.test(launch.InstanceType))hostRefuse();
 if(!/^subnet-[0-9a-f]{8,17}$/u.test(launch.SubnetId))hostRefuse();
 if(!Array.isArray(launch.SecurityGroupIds)||!launch.SecurityGroupIds.length||
  launch.SecurityGroupIds.some(id=>!/^sg-[0-9a-f]{8,17}$/u.test(id)))hostRefuse();
 let profile=launch.IamInstanceProfile;
 if(typeof profile==='string'&&profile)profile={Name:profile};
 if(profile===null||typeof profile!=='object'||Array.isArray(profile))hostRefuse();
 const keys=Object.keys(profile);
 if(keys.length!==1||!['Name','Arn'].includes(keys[0])||typeof profile[keys[0]]!=='string'||!profile[keys[0]])hostRefuse();
 if(launch.UserData!==undefined&&(typeof launch.UserData!=='string'||!launch.UserData))hostRefuse();
 if(launch.MetadataOptions!==undefined){
  const m=own(launch.MetadataOptions,['HttpTokens'],['HttpEndpoint','HttpPutResponseHopLimit']);
  if(m.HttpTokens!=='required'||(m.HttpEndpoint!==undefined&&m.HttpEndpoint!=='disabled')||
   (m.HttpPutResponseHopLimit!==undefined&&m.HttpPutResponseHopLimit!==1))hostRefuse();
 }
 if(launch.EbsOptimized!==undefined&&typeof launch.EbsOptimized!=='boolean')hostRefuse();
 return Object.freeze({...launch,SecurityGroupIds:Object.freeze([...launch.SecurityGroupIds]),
  IamInstanceProfile:Object.freeze({...profile}),
  ...(launch.MetadataOptions?{MetadataOptions:Object.freeze({...launch.MetadataOptions})}:{})});
}

/** Compile the protected deployment facts into the exact persisted reservation declaration boundary. */
export function compileNativeDeployment(raw){
 let d;try{d=own(raw,['accountId','region','placement','launch','imageDigest','sourceCommit','bootstrapSha256','bootstrapSpec'],
  ['nativeHelperSha256','maxLifetimeMs','physicalObserver','launchTagPolicy']);}catch{refuse();}
 if(typeof d.accountId!=='string'||!/^[0-9]{12}$/u.test(d.accountId))refuse();
 if(d.region!=='us-east-1')refuse();
 if(!/^sha256:[0-9a-f]{64}$/u.test(d.imageDigest)||!/^[0-9a-f]{40}$/u.test(d.sourceCommit)||
  !/^[0-9a-f]{64}$/u.test(d.bootstrapSha256)||
  (d.nativeHelperSha256!==undefined&&!/^[0-9a-f]{64}$/u.test(d.nativeHelperSha256)))refuse();
 const maxLifetimeMs=d.maxLifetimeMs??600000;
 if(!integer(maxLifetimeMs,60000,900000))refuse();
 if(Object.keys(d.launch).some(k=>!requiredLaunch.includes(k)))refuse();
 let launch;try{launch=assertNativeLaunch(d.launch);}catch{throw fault();}
 if(launch.IamInstanceProfile.Arn!==undefined||!launch.IamInstanceProfile.Name)refuse();
 const v2=d.physicalObserver!==undefined;
 // New effects require the protected observer protocol; retained declarations are read by their own validator.
 if(!v2)refuse();
 if(v2?d.launchTagPolicy!==NATIVE_OBSERVER_TAG_POLICY:d.launchTagPolicy!==undefined)refuse();
 let observer;
 if(v2){observer=assertNativeObserver(d.physicalObserver,d);assertNativeObserverPlacement(d.placement,launch);}
 let p;try{p=own(d.placement,['availabilityZone','subnetId','securityGroupIds','iamInstanceProfile',...(v2?['vpcId']:[])]);}catch{refuse();}
 if(typeof p.availabilityZone!=='string'||!/^us-east-1[a-z]$/u.test(p.availabilityZone)||
  !/^subnet-[0-9a-f]{8,17}$/u.test(p.subnetId)||!Array.isArray(p.securityGroupIds)||!p.securityGroupIds.length||
  p.securityGroupIds.some(id=>!/^sg-[0-9a-f]{8,17}$/u.test(id))||
  typeof p.iamInstanceProfile!=='string'||!p.iamInstanceProfile||
  p.subnetId!==launch.SubnetId||
  JSON.stringify([...p.securityGroupIds].sort())!==JSON.stringify([...launch.SecurityGroupIds].sort())||
  p.iamInstanceProfile!==launch.IamInstanceProfile.Name)refuse();
 let spec;try{spec=assertNativeBootstrapSpec(d.bootstrapSpec);}catch{refuse();}
 return Object.freeze({accountId:d.accountId,region:d.region,
  ...(v2?{physicalObserver:observer,launchTagPolicy:d.launchTagPolicy}:{}),
  placement:Object.freeze({availabilityZone:p.availabilityZone,...(v2?{vpcId:p.vpcId}:{}),subnetId:p.subnetId,
   securityGroupIds:Object.freeze([...p.securityGroupIds]),iamInstanceProfile:p.iamInstanceProfile}),
  launch,imageDigest:d.imageDigest,sourceCommit:d.sourceCommit,bootstrapSha256:d.bootstrapSha256,
  ...(d.nativeHelperSha256!==undefined?{nativeHelperSha256:d.nativeHelperSha256}:{}),maxLifetimeMs,
  bootstrapSpec:spec});
}
