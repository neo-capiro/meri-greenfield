/** SDK response boundary. Retain actual metadata; malformed/partial wire never becomes absence. */
import {types} from 'node:util';
import {canonicalSha256 as hash} from '../../packages/contracts/validate.mjs';
import {nativeObserverLaunchTags} from '../../packages/contracts/native-observer.mjs';
import {privateAddress} from '../../packages/contracts/native-tls-kernel.mjs';
import {decodeOwnedInstance,decodeAttachedRoot,decodeAttachedEni,decodeTerminationAck,
 decodeTerminatedInstance,decodeDeletedRoot} from '../worker/conversation/host/cloud-absence/wire.mjs';
import {assertPhysicalFacts} from '../control/browser-hosts/native-physical-evidence.mjs';
import {physicalBytes,COMPLETION_BYTES} from '../control/browser-hosts/native-physical-journal.mjs';
import {HISTORY_STATES,MANAGED_TERMINATE_RESOURCE} from '../control/browser-hosts/native-physical-history.mjs';
const fail=()=>{throw Error('NATIVE_OBSERVER_WIRE_UNKNOWN');};
function object(v){
 if(!v||typeof v!=='object'||types.isProxy(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v)))fail();
 const ds=Object.getOwnPropertyDescriptors(v);
 if(Reflect.ownKeys(ds).some(k=>typeof k!=='string'||!ds[k].enumerable||!Object.hasOwn(ds[k],'value')))fail();return v;
}
const get=(v,k)=>{const d=Object.getOwnPropertyDescriptor(object(v),k);if(!d)fail();return d.value;};
const opt=(v,k)=>Object.hasOwn(object(v),k)?get(v,k):undefined;
function list(v,max=1000){
 if(!Array.isArray(v)||types.isProxy(v)||Object.getPrototypeOf(v)!==Array.prototype||v.length>max)fail();
 const ds=Object.getOwnPropertyDescriptors(v);
 if(Reflect.ownKeys(ds).length!==v.length+1)fail();
 for(let i=0;i<v.length;i++)if(!ds[i]?.enumerable||!Object.hasOwn(ds[i],'value'))fail();return v;
}
const one=v=>{const a=list(v);if(a.length!==1)fail();return a[0];};
const token=v=>{if(v===undefined||v===null||v==='')return null;if(typeof v!=='string'||Buffer.byteLength(v)>2048)fail();return v;};
function metadata(raw){
 let m;try{m=get(raw,'$metadata');}catch{return {requestId:null,httpStatusCode:null};}
 let requestId=null,httpStatusCode=null;
 try{const v=get(m,'requestId');if(typeof v==='string'&&/^[A-Za-z0-9-]{8,128}$/u.test(v))requestId=v;}catch{}
 try{const v=get(m,'httpStatusCode');if(Number.isInteger(v)&&v>=100&&v<=599)httpStatusCode=v;}catch{}
 return {requestId,httpStatusCode};
}
function exactTags(raw,row){
 const seen=new Map();for(const t of list(raw)){const k=get(t,'Key'),v=get(t,'Value');
  if(typeof k!=='string'||typeof v!=='string'||seen.has(k))fail();seen.set(k,v);}
 const expected=nativeObserverLaunchTags({allocation:row.allocation_json,declaration:row.declaration_json});
 for(const [k,v] of Object.entries(expected))if(seen.get(k)!==v)fail();
 return Object.fromEntries(['Project','MeriHostId','MeriGeneration','MeriAllocationSha256'].map(k=>[k,seen.get(k)]));
}
const configuration=row=>({allocation:row.allocation_json,expected:{accountId:row.declaration_json.accountId,
 region:row.declaration_json.region,amiId:row.declaration_json.launch.ImageId,vpcId:row.declaration_json.placement.vpcId,
 subnetId:row.declaration_json.placement.subnetId,securityGroupId:row.declaration_json.placement.securityGroupIds[0],rootDeviceName:'/dev/xvda'}});
function attachment(raw,instanceId,network){
 if(network){const status=opt(raw,'Status');if(status!==undefined&&!['attaching','attached','detaching','detached'].includes(status))fail();
  return {instanceId,attachmentId:get(raw,'AttachmentId'),deviceIndex:get(raw,'DeviceIndex'),deleteOnTermination:get(raw,'DeleteOnTermination')};}
 return {instanceId:get(raw,'InstanceId'),volumeId:get(raw,'VolumeId'),device:get(raw,'Device'),deleteOnTermination:get(raw,'DeleteOnTermination')};
}
function nic(raw,instanceId,{nested=false}={}){
 const at=attachment(get(raw,'Attachment'),nested?instanceId:get(get(raw,'Attachment'),'InstanceId'),true);
 if(nested)delete at.instanceId;
 return {id:get(raw,'NetworkInterfaceId'),ownerAccountId:get(raw,'OwnerId'),vpcId:get(raw,'VpcId'),subnetId:get(raw,'SubnetId'),
  securityGroupIds:list(get(raw,'Groups')).map(g=>get(g,'GroupId')).sort(),
  publicAssociationPresent:opt(raw,'Association')!==undefined&&opt(raw,'Association')!==null,attachment:at};
}
function instanceFacts(raw,event,row){
 const r=one(get(raw,'Reservations')),i=one(get(r,'Instances')),instanceId=event.request.instanceId;
 decodeOwnedInstance(raw,{...configuration(row),hostIdentity:{instanceId}});
 const root=get(one(get(i,'BlockDeviceMappings')),'Ebs'),state=get(i,'State'),ip=opt(i,'PrivateIpAddress');
 return {instanceId,ownerAccountId:get(r,'OwnerId'),state:get(state,'Name'),stateCode:get(state,'Code'),amiId:get(i,'ImageId'),
  vpcId:get(i,'VpcId'),subnetId:get(i,'SubnetId'),rootDeviceName:get(i,'RootDeviceName'),rootDeviceType:get(i,'RootDeviceType'),
  publicIpPresent:false,publicDnsPresent:false,blockDeviceMappingCount:1,privateIp:ip===undefined||ip===null?null:privateAddress(ip),
  tags:exactTags(get(i,'Tags'),row),root:{volumeId:get(root,'VolumeId'),deleteOnTermination:get(root,'DeleteOnTermination')},
  networkInterfaces:list(get(i,'NetworkInterfaces'),16).map(n=>nic(n,instanceId,{nested:true}))};
}
function discoveryFacts(raw,event,row){
 const matches=[],conflicts=[];let observedCount=0,overflow=false;
 for(const reservation of list(get(raw,'Reservations'))){
  const owner=get(reservation,'OwnerId');
  for(const i of list(get(reservation,'Instances'))){
   observedCount++;if(observedCount>16){overflow=true;continue;}
   const instanceId=get(i,'InstanceId');if(typeof instanceId!=='string'||!/^i-(?:[0-9a-f]{8}|[0-9a-f]{17})$/u.test(instanceId))fail();
   if(owner!==row.declaration_json.accountId){conflicts.push({instanceId,reason:'foreign-owner'});continue;}
   try{
    // The same full exact decoder prevents discovery from dropping a conflicting mapping into a match.
    const f=instanceFacts({$metadata:get(raw,'$metadata'),Reservations:[{OwnerId:owner,Instances:[i]}]},
     {request:{instanceId}},row);
    matches.push({instanceId,ownerAccountId:owner,allocationSha256:row.allocation_sha256,
     provisionToken:row.declaration_json.token,placementSha256:hash(row.declaration_json.placement),
     rootVolumeId:f.root.volumeId,networkInterfaceIds:f.networkInterfaces.map(n=>n.id).sort()});
   }catch{conflicts.push({instanceId,reason:'invalid-shape'});}
  }
 }
 const nextToken=token(opt(raw,'NextToken'));
 return {scanId:event.request.scanId,pageIndex:event.request.pageIndex,nextToken,matches,conflicts,observedCount,overflow,
  complete:nextToken===null&&!overflow&&conflicts.length===0};
}
function timestamp(v){
 if(!v||typeof v!=='object'||types.isProxy(v)||Object.getPrototypeOf(v)!==Date.prototype)fail();
 const ms=Date.prototype.getTime.call(v);if(!Number.isSafeInteger(ms)||ms<0)fail();return ms;
}
function json(v){if(typeof v!=='string'||Buffer.byteLength(v)>262144)fail();return JSON.parse(v);}
function historyFacts(raw,event,row){
 const w=row.declaration_json.watchdog;
 if(event.request.api==='DescribeExecution'){
  if(get(get(raw,'inputDetails'),'included')!==true||opt(raw,'redriveCount')!==0||
   opt(raw,'stateMachineAliasArn')!==undefined||hash(json(get(raw,'input')))!==w.inputSha256)fail();
  return {executionArn:get(raw,'executionArn'),stateMachineArn:get(raw,'stateMachineArn'),
   stateMachineVersionArn:get(raw,'stateMachineVersionArn'),inputSha256:hash(json(get(raw,'input'))),
   status:get(raw,'status'),startAtMs:timestamp(get(raw,'startDate')),stopAtMs:opt(raw,'stopDate')===undefined?null:timestamp(get(raw,'stopDate'))};
 }
 const events=[];
 for(const rawEvent of list(get(raw,'events'),100)){
  const type=get(rawEvent,'type');if(type==='ExecutionRedriven'||type==='MapRunRedriven')fail();
  const e={historyEventId:get(rawEvent,'id'),previousEventId:get(rawEvent,'previousEventId'),atMs:timestamp(get(rawEvent,'timestamp')),
   kind:null,instanceId:null,attemptId:null,attemptedAtMs:null,taskStateName:null,taskResource:null,outcomeDigest:null};
  if(/^(?:Pass|Choice|Task)State(?:Entered|Exited)$/u.test(type)){
   const entered=type.endsWith('Entered'),detail=get(rawEvent,entered?'stateEnteredEventDetails':'stateExitedEventDetails'),name=get(detail,'name');
   if(!HISTORY_STATES.includes(name))continue;
   const field=entered?'input':'output';if(get(get(detail,`${field}Details`),'truncated')!==false)fail();
   const value=json(get(detail,field));e.kind=entered?'state-entered':'state-exited';e.taskStateName=name;e.outcomeDigest=hash(value);
   if(name==='MarkManagedAttempt'&&!entered){
    const keys=Object.keys(object(value));if(keys.length!==3||!['instanceId','attemptId','attemptedAtMs'].every(k=>keys.includes(k)))fail();
    e.instanceId=get(value,'instanceId');e.attemptId=get(value,'attemptId');e.attemptedAtMs=get(value,'attemptedAtMs');
   }
  }else if(['TaskScheduled','TaskStarted','TaskSucceeded','TaskFailed','TaskTimedOut'].includes(type)){
   const detail=get(rawEvent,`${type[0].toLowerCase()}${type.slice(1)}EventDetails`);
   // This exact SDK integration mapping remains subject to real provider qualification. Unknown variants never qualify.
   if(get(detail,'resourceType')!=='aws-sdk:ec2'||get(detail,'resource')!=='terminateInstances')continue;
   e.taskResource=MANAGED_TERMINATE_RESOURCE;
   e.kind={TaskScheduled:'task-scheduled',TaskStarted:'task-started',TaskSucceeded:'task-succeeded',TaskFailed:'task-failed',TaskTimedOut:'task-timed-out'}[type];
   if(type==='TaskScheduled'){
    if(get(detail,'region')!==row.declaration_json.region)fail();const request=json(get(detail,'parameters'));
    if(Object.keys(object(request)).length!==1||list(get(request,'InstanceIds')).length!==1)fail();
    e.instanceId=request.InstanceIds[0];e.attemptId=`${w.executionArn}:${e.instanceId}`;e.outcomeDigest=hash(request);
   }else if(type==='TaskSucceeded'){
    if(get(get(detail,'outputDetails'),'truncated')!==false)fail();e.outcomeDigest=hash(json(get(detail,'output')));
   }else if(type!=='TaskStarted')e.outcomeDigest=hash({error:opt(detail,'error')??null,cause:opt(detail,'cause')??null});
  }else continue;
  events.push(e);
 }
 return {executionArn:event.request.executionArn,nextToken:token(opt(raw,'nextToken')),events};
}
function facts(raw,event,row){
 const r=event.request,config=configuration(row);
 if(event.stage==='provenance')return historyFacts(raw,event,row);
 if(r.api==='GetCallerIdentity')return {accountId:get(raw,'Account'),arn:get(raw,'Arn'),userId:get(raw,'UserId')};
 if(r.api==='DescribeInstances'&&r.kind==='discovery')return discoveryFacts(raw,event,row);
 if(token(opt(raw,'NextToken'))!==null)fail();
 if(r.api==='DescribeInstances'){
  if(event.stage==='absence'){
   if(!decodeTerminatedInstance(raw,r.instanceId,config.expected.accountId))fail();
   return {instanceId:r.instanceId,ownerAccountId:config.expected.accountId,state:'terminated',stateCode:48};
  }return instanceFacts(raw,event,row);
 }
 if(r.api==='DescribeVolumes'){
  if(event.stage==='absence'){
   if(!decodeDeletedRoot(raw,r.volumeId))fail();return {volumeId:r.volumeId,state:'deleted'};
  }
  const v=one(get(raw,'Volumes')),at=one(get(v,'Attachments')),instanceId=get(at,'InstanceId');
  decodeAttachedRoot(raw,{rootVolumeId:r.volumeId},{...config,hostIdentity:{instanceId}});
  return {volumeId:r.volumeId,ownerAccountId:get(v,'OwnerId'),state:get(v,'State'),encrypted:get(v,'Encrypted'),
   tags:exactTags(get(v,'Tags'),row),attachment:attachment(at,instanceId,false)};
 }
 if(r.api==='DescribeNetworkInterfaces'){
  const n=one(get(raw,'NetworkInterfaces')),instanceId=get(get(n,'Attachment'),'InstanceId');
  decodeAttachedEni(raw,r.networkInterfaceId,{instanceId},config);return nic(n,instanceId);
 }
 if(r.api==='TerminateInstances'){
  decodeTerminationAck(raw,r.instanceId);const s=get(one(get(raw,'TerminatingInstances')),'CurrentState');
  return {instanceId:r.instanceId,currentState:get(s,'Name'),currentStateCode:get(s,'Code')};
 }
 fail();
}
/** Best-effort bounded custody of scalar IDs only; never execute an accessor or proxy trap. */
function knownIds(raw){
 const found={knownInstanceIds:new Set(),knownVolumeIds:new Set(),knownEniIds:new Set()};let scanned=0,observedCount=0,overflow=false;
 const pending=[raw],seen=new WeakSet();
 while(pending.length&&scanned++<4000){const v=pending.pop();
  if(!v||typeof v!=='object'||types.isProxy(v)||seen.has(v))continue;seen.add(v);
  const proto=Object.getPrototypeOf(v);if(![Object.prototype,null,Array.prototype].includes(proto))continue;
  for(const [k,d] of Object.entries(Object.getOwnPropertyDescriptors(v))){if(!d.enumerable||!Object.hasOwn(d,'value'))continue;
   const x=d.value,kind={InstanceId:'knownInstanceIds',VolumeId:'knownVolumeIds',NetworkInterfaceId:'knownEniIds'}[k];
   const prefix={InstanceId:'i',VolumeId:'vol',NetworkInterfaceId:'eni'}[k];
   if(kind&&typeof x==='string'&&new RegExp(`^${prefix}-(?:[0-9a-f]{8}|[0-9a-f]{17})$`,'u').test(x)){
    observedCount++;if(found[kind].size<16)found[kind].add(x);else overflow=true;
   }else if(x&&typeof x==='object'&&pending.length<4000)pending.push(x);
  }
 }
 if(pending.length)overflow=true;
 return {...Object.fromEntries(Object.entries(found).map(([k,v])=>[k,[...v].sort()])),observedCount,overflow};
}
export function normalizeNativeObserverResponse(raw,{event,row,completedAtMs,error=false}){
 const meta=metadata(raw),base={completedAtMs,...meta,errorCode:null};
 if(error){
  // SDK service exceptions have an Error prototype; inspect their own data descriptors only.
  let code=null,m=meta;
  if(raw&&typeof raw==='object'&&!types.isProxy(raw)){
   const d=Object.getOwnPropertyDescriptors(raw),name=d.name?.value;
   if(typeof name==='string'&&/^[A-Za-z][A-Za-z0-9_.-]{0,127}$/u.test(name))code=name;
   if(d.$metadata&&Object.hasOwn(d.$metadata,'value'))m=metadata({$metadata:d.$metadata.value});
  }
  return {...base,...m,outcome:code&&m.requestId&&m.httpStatusCode?'service-error':'transport-unknown',
   errorCode:code,facts:null};
 }
 let reason='malformed-wire';
 try{
  if(meta.requestId===null||meta.httpStatusCode!==200){reason='metadata-missing';fail();}
  const value={...base,outcome:'success',facts:facts(raw,event,row)};assertPhysicalFacts(event,value,row);
  if(completedAtMs>event.callDeadlineMs)fail();
  if(physicalBytes(value)>COMPLETION_BYTES){reason='bounds-exceeded';fail();}return value;
 }catch{
  return {...base,outcome:'invalid-response',facts:{reason,...knownIds(raw)}};
 }
}
