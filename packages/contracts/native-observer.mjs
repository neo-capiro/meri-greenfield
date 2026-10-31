/** Native /2 producer contract. Pure validation grants no authority or effect. */
import {own,data} from './commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash} from './validate.mjs';

export const NATIVE_OBSERVER_PROTOCOL='native-observer-around-managed/1';
export const NATIVE_OBSERVER_ROUTE='/v1/execution/native/physical-observer';
export const NATIVE_OBSERVER_TAG_POLICY='instance-and-root-volume-owner-tags/1';
export const NATIVE_DECLARATION_V2='meri-native-provisioning-declaration/2';
const id=(kind,value)=>typeof value==='string'&&new RegExp(`^${kind}-(?:[0-9a-f]{8}|[0-9a-f]{17})$`,'u').test(value);
const fail=()=>{throw Object.assign(Error('NATIVE_OBSERVER_REFUSED'),{code:'NATIVE_OBSERVER_REFUSED'});};
export function nativeObserverDeadline(start,duration=25000){
 if(!Number.isSafeInteger(start)||start<1||!Number.isSafeInteger(duration)||duration<1||
  !Number.isSafeInteger(start+duration))fail();
 return start+duration;
}
export function assertNativeObserver(raw,{accountId,region}={}){
 const o=own(data(raw),['schema','protocol','bridgeFunctionVersionArn','route','authenticationPrincipal']);
 const match=/^arn:aws:lambda:(us-east-1):([0-9]{12}):function:([A-Za-z0-9_-]{1,64}):([1-9][0-9]*)$/u.exec(o.bridgeFunctionVersionArn??'');
 if(o.schema!=='meri-native-managed-observer/1'||o.protocol!==NATIVE_OBSERVER_PROTOCOL||
  o.route!==NATIVE_OBSERVER_ROUTE||o.authenticationPrincipal!=='native-watchdog-observer-v1'||!match||
  (accountId!==undefined&&match[2]!==accountId)||(region!==undefined&&match[1]!==region))fail();
 return Object.freeze({...o});
}
export function assertNativeObserverPlacement(placement,launch){
 const p=own(data(placement),['availabilityZone','vpcId','subnetId','securityGroupIds','iamInstanceProfile']);
 const l=own(data(launch),['ImageId','InstanceType','SubnetId','SecurityGroupIds','IamInstanceProfile']);
 const profile=own(data(l.IamInstanceProfile),['Name']);
 if(!/^us-east-1[a-z]$/u.test(p.availabilityZone)||!id('vpc',p.vpcId)||!id('subnet',p.subnetId)||
  !Array.isArray(p.securityGroupIds)||p.securityGroupIds.length!==1||!id('sg',p.securityGroupIds[0])||
  !id('ami',l.ImageId)||typeof l.InstanceType!=='string'||! /^[a-z0-9-]+\.[a-z0-9]+$/u.test(l.InstanceType)||
  typeof p.iamInstanceProfile!=='string'||!p.iamInstanceProfile||p.iamInstanceProfile.length>128||
  profile.Name!==p.iamInstanceProfile||l.SubnetId!==p.subnetId||hash(l.SecurityGroupIds)!==hash(p.securityGroupIds))fail();
 return Object.freeze({placement:Object.freeze({...p,securityGroupIds:Object.freeze([...p.securityGroupIds])}),
  launch:Object.freeze({...l,SecurityGroupIds:Object.freeze([...l.SecurityGroupIds]),IamInstanceProfile:Object.freeze({...profile})})});
}
export function nativeObserverLaunchTags({allocation,declaration}){
 if(declaration.schema!==NATIVE_DECLARATION_V2||declaration.launchTagPolicy!==NATIVE_OBSERVER_TAG_POLICY||
  declaration.leaseDeadlineMs!==allocation.leaseDeadlineMs||allocation.hostMode!=='native-processing')fail();
 assertNativeObserver(declaration.physicalObserver,declaration);
 assertNativeObserverPlacement(declaration.placement,declaration.launch);
 if(!/^[0-9a-f]{64}$/u.test(declaration.token))fail();
 return Object.freeze({Project:'meri-greenfield',MeriProvisionToken:declaration.token,
  MeriHostId:allocation.hostId,MeriGeneration:String(allocation.generation),
  MeriPlacementSha256:hash(declaration.placement),MeriAllocationSha256:hash(allocation),
  MeriDeclarationSha256:hash(declaration)});
}
export function nativeObserverLaunchRequest({allocation,declaration}){
 const tags=nativeObserverLaunchTags({allocation,declaration});
 const sorted=Object.keys(tags).sort().map(Key=>Object.freeze({Key,Value:tags[Key]}));
 return Object.freeze({...declaration.launch,MinCount:1,MaxCount:1,ClientToken:declaration.token,
  TagSpecifications:Object.freeze(['instance','volume'].map(ResourceType=>Object.freeze({ResourceType,Tags:Object.freeze([...sorted])})))});
}
export function assertNativeObserverInput(raw){
 const i=own(data(raw),['schema','hostId','generation','accountId','region','allocationSha256','sourceCommit',
  'imageDigest','bootstrapSha256','placementSha256','launchSha256','controlPolicySha256','provisionToken',
  'originalT0Ms','deadlineMs','leaseDeadlineMs','cleanupCeilingMs','executionName','physicalObserver','placement','launch'],['nativeHelperSha256']);
 if(i.schema!=='meri-native-watchdog-input/2'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(i.hostId)||
  !Number.isSafeInteger(i.generation)||i.generation<1||i.generation>999999||!/^[0-9]{12}$/u.test(i.accountId)||
  i.region!=='us-east-1'||i.executionName!==`${i.hostId}-g${i.generation}`||
  !Number.isSafeInteger(i.originalT0Ms)||i.originalT0Ms<1||i.leaseDeadlineMs<=i.originalT0Ms||
  i.cleanupCeilingMs!==nativeObserverDeadline(i.leaseDeadlineMs)||i.deadlineMs!==i.cleanupCeilingMs||
  !/^[0-9a-f]{40}$/u.test(i.sourceCommit)||!/^sha256:[0-9a-f]{64}$/u.test(i.imageDigest)||
  !['allocationSha256','bootstrapSha256','placementSha256','launchSha256','controlPolicySha256','provisionToken',
   ...(i.nativeHelperSha256===undefined?[]:['nativeHelperSha256'])].every(k=>/^[0-9a-f]{64}$/u.test(i[k])))fail();
 assertNativeObserver(i.physicalObserver,i);assertNativeObserverPlacement(i.placement,i.launch);
 if(hash(i.placement)!==i.placementSha256||hash(i.launch)!==i.launchSha256)fail();
 return Object.freeze({...i});
}
/** Authenticated Control outcome references, not a portable replacement for the retained journal. */
export function assertNativeRetainedPhysical(raw,{allocation,binding,declaration,nowMs}){
 const p=own(data(raw),['schema','allocationSha256','bindingSha256','declarationSha256','ordinary','managed']);
 if(p.schema!=='meri-native-retained-physical/2'||p.allocationSha256!==hash(allocation)||p.bindingSha256!==hash(binding)||
  p.declarationSha256!==hash(declaration)||declaration.schema!==NATIVE_DECLARATION_V2||!Number.isSafeInteger(nowMs))fail();
 for(const phase of ['ordinary','managed']){
  if(p[phase]===null){if(phase==='managed')fail();continue;}
  const v=own(p[phase],['disposition','deadlineMs','contextSha256','resourcesSha256','resultSha256','reason']);
  if(!['verified-absent','unknown','pending'].includes(v.disposition)||!Number.isSafeInteger(v.deadlineMs)||v.deadlineMs<1||
   (phase==='managed'&&v.deadlineMs!==declaration.watchdog.cleanupCeilingMs)||
   !/^[0-9a-f]{64}$/u.test(v.contextSha256)||[v.resourcesSha256,v.resultSha256].some(x=>x!==null&&!/^[0-9a-f]{64}$/u.test(x))||
   (v.disposition==='verified-absent'&&(v.resourcesSha256===null||v.resultSha256===null||v.reason!==null))||
   (v.disposition==='pending'&&(v.resultSha256!==null||v.reason!==null||nowMs>=v.deadlineMs))||
   (v.disposition==='unknown'&&!['deadline','discovery-incomplete','no-owned-instance','multiple-owned-instances','custody-conflict',
    'preobservation-missing','metadata-missing','operation-unknown','budget-exhausted','superseded-by-full-teardown'].includes(v.reason)))fail();
 }
 return p;
}
