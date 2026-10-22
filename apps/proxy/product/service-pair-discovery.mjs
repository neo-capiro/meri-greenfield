/** Fresh approved service tasks, never original runner placement authority.
 * Revision/certificate pins are reviewed configuration, not AWS attestation. */
import {currentTurnTelemetry} from '../../runtime/telemetry/turn-context.mjs';
import {health} from './owner-diagnostics.mjs';
import {createRequire} from 'node:module';
import {isIP} from 'node:net';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {PAIR_LEASE_TTL_MS,pairFailure} from './owner-pair-lease.mjs';
const fail=()=>{throw Error('PRODUCT_SERVICE_TASK_LEASE_UNAVAILABLE');};
const unavailable=()=>{throw pairFailure();};
const drift=()=>{throw pairFailure('PAIR_DRIFT');};
const observe=fn=>{try{return fn();}catch(error){if(error?.code==='PAIR_UNAVAILABLE')throw error;drift();}};
/** Existing construction-time request bound. P2 discovery uses it for startup,
 * scheduled renewals and the exceptional expired-lease/new-socket proofs. */
export const OWNER_MAX_REQUEST_MS=15000;
const prefix='arn:aws:ecs:us-east-1:967807252336:',iam='arn:aws:iam::967807252336:role/';
const name=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,255}$/u.test(v);
const instant=v=>Number.isSafeInteger(v)&&v>0;
const awsId=(kind,v)=>typeof v==='string'&&new RegExp(`^${kind}-[a-f0-9]{8,17}$`,'u').test(v);
const sameSet=(a,b)=>Array.isArray(a)&&a.length===b.length&&new Set(a).size===a.length&&a.every(v=>b.includes(v));
const taskArn=(v,p)=>typeof v==='string'&&new RegExp(`^${prefix}task/${p.clusterArn.slice((prefix+'cluster/').length)}/[a-f0-9]{32}$`,'u').test(v);
function privateIPv4(v){
 if(typeof v!=='string'||isIP(v)!==4||v.split('.').some(n=>String(Number(n))!==n))fail();
 const [a,b]=v.split('.').map(Number);if(!(a===10||a===172&&b>=16&&b<=31||a===192&&b===168))fail();return v;
}
function rolePin(v){
 const p=own(v,['clusterArn','serviceArn','taskDefinitionArn','containerName','imageUri','taskRoleArn','executionRoleArn',
  'vpcId','subnetIds','securityGroupIds'],['allowPrimaryInProgress']);
 const cluster=typeof p.clusterArn==='string'?p.clusterArn.slice((prefix+'cluster/').length):'';
 const service=typeof p.serviceArn==='string'?p.serviceArn.slice((prefix+'service/'+cluster+'/').length):'';
 if(p.clusterArn!==prefix+'cluster/'+cluster||!name(cluster)||p.serviceArn!==prefix+'service/'+cluster+'/'+service||!name(service)||
    typeof p.taskDefinitionArn!=='string'||!p.taskDefinitionArn.startsWith(prefix)||
    !/^task-definition\/[A-Za-z0-9_-]+:[1-9][0-9]*$/u.test(p.taskDefinitionArn.slice(prefix.length))||!name(p.containerName)||
    typeof p.imageUri!=='string'||!/^967807252336\.dkr\.ecr\.us-east-1\.amazonaws\.com\/[a-z0-9]+(?:[._/-][a-z0-9]+)*@sha256:[a-f0-9]{64}$/u.test(p.imageUri)||
    ![p.taskRoleArn,p.executionRoleArn].every(n=>typeof n==='string'&&n.startsWith(iam)&&/^[A-Za-z0-9_+=,.@/-]{1,512}$/u.test(n.slice(iam.length)))||
    !awsId('vpc',p.vpcId)||!Array.isArray(p.subnetIds)||p.subnetIds.length<1||p.subnetIds.length>16||
    p.subnetIds.some(n=>!awsId('subnet',n))||new Set(p.subnetIds).size!==p.subnetIds.length||
    !Array.isArray(p.securityGroupIds)||p.securityGroupIds.length<1||p.securityGroupIds.length>5||
    p.securityGroupIds.some(n=>!awsId('sg',n))||new Set(p.securityGroupIds).size!==p.securityGroupIds.length||
    typeof(p.allowPrimaryInProgress??false)!=='boolean')fail();
 return {...p,allowPrimaryInProgress:p.allowPrimaryInProgress??false};
}
export function parseProductServicePairConfiguration(raw){
 try{
  const c=data(own(raw,['schemaVersion','deploymentRevision','expiresAtMs','ownerCertSha256','proxyCertSha256','owner','proxy']));
  if(c.schemaVersion!==2||typeof c.deploymentRevision!=='string'||!/^[A-Za-z0-9_-]{1,128}$/u.test(c.deploymentRevision)||!instant(c.expiresAtMs)||
     ![c.ownerCertSha256,c.proxyCertSha256].every(n=>typeof n==='string'&&/^[a-f0-9]{64}$/u.test(n))||c.ownerCertSha256===c.proxyCertSha256)fail();
  const owner=rolePin(c.owner),proxy=rolePin(c.proxy);
  if(owner.serviceArn===proxy.serviceArn||owner.clusterArn!==proxy.clusterArn||owner.vpcId!==proxy.vpcId)fail();
  return data({...c,owner,proxy});
 }catch{fail();}
}
// Incomplete replies are no answer only after every recognized row has been
// checked. A missing partner or failure entry must not hide observed drift.
function observePairRows(rows,idKey,ids,inspect,failures){
 if(!Array.isArray(rows))unavailable();
 let missing=false,unanswered=false;
 const observations=ids.map((id,index)=>{
  const matches=rows.filter(row=>row?.[idKey]===id);
  if(matches.length>1)drift();
  if(matches.length===0){missing=true;return undefined;}
  try{return observe(()=>inspect(matches[0],index));}
  catch(error){if(error?.code!=='PAIR_UNAVAILABLE')throw error;unanswered=true;return undefined;}
 });
 if(rows.length>ids.length||rows.some(row=>!ids.includes(row?.[idKey]))||failures!==undefined&&!Array.isArray(failures))drift();
 if(missing||unanswered||failures?.length)unavailable();
 return observations;
}
function serviceObservation(s,p,partner=false){
 if(s.clusterArn!==p.clusterArn||s.serviceName!==p.serviceArn.split('/').at(-1)||s.status!=='ACTIVE'||s.taskDefinition!==p.taskDefinitionArn||
    s.desiredCount!==1||s.launchType!=='FARGATE'||s.platformVersion!=='1.4.0'||
    s.enableExecuteCommand!==false||!Array.isArray(s.deployments)||s.deployments.length<1||s.deployments.length>8)drift();
 const primary=s.deployments.filter(d=>d?.status==='PRIMARY');if(primary.length!==1)drift();const d=primary[0];
 const count=(v,max)=>Number.isSafeInteger(v)&&v>=0&&v<=max;
 // Even an inactive/draining deployment is an observed revision, not a reason
 // to hide another task definition behind a temporary count mismatch.
 if(s.deployments.some(v=>!v||typeof v.id!=='string'||!/^ecs-svc\/[0-9]{1,32}$/u.test(v.id)||
    v.taskDefinition!==p.taskDefinitionArn||!['PRIMARY','ACTIVE','INACTIVE'].includes(v.status)||
    !count(v.desiredCount,1)||!count(v.runningCount,1)||!count(v.pendingCount,1))||
    new Set(s.deployments.map(v=>v.id)).size!==s.deployments.length||d.desiredCount!==1||
    !(d.rolloutState==='COMPLETED'||(partner||p.allowPrimaryInProgress)&&d.rolloutState==='IN_PROGRESS'))drift();
 const other=s.deployments.filter(v=>v!==d);
 const quiet=other.every(v=>v.desiredCount===0&&v.runningCount===0&&v.pendingCount===0);
 const drained=other.every(v=>v.runningCount===0&&v.pendingCount===0&&
  (v.desiredCount===0||partner&&d.rolloutState==='IN_PROGRESS'&&v.status==='ACTIVE'));
 const stable=s.runningCount===1&&s.pendingCount===0&&d.runningCount===1&&d.pendingCount===0&&drained;
 const rolling=partner&&d.rolloutState==='IN_PROGRESS'&&other.some(v=>v.status==='ACTIVE')&&
  other.every(v=>v.pendingCount===0&&(v.runningCount===0||v.status==='ACTIVE'))&&
  other.reduce((sum,v)=>sum+v.runningCount,0)<=1;
 if(!partner){
  if(!stable||!quiet)drift();
 }else if(!count(s.runningCount,2)||!count(s.pendingCount,1)||!quiet&&!rolling||
    s.runningCount===2&&!rolling||s.runningCount===1&&s.pendingCount===1&&!rolling)drift();
 // Aggregate counts can lag deployment counts during the same pinned rollout.
 // Such disagreement with a nonempty drainer cannot issue a proof.
 const network=s.networkConfiguration?.awsvpcConfiguration;
 if(!network||network.assignPublicIp!=='DISABLED'||!sameSet(network.subnets,p.subnetIds)||!sameSet(network.securityGroups,p.securityGroupIds))drift();
 return {deploymentId:d.id,deploymentIds:rolling?s.deployments.map(v=>v.id):[d.id],rolling,transitional:!stable};
}
function definitionObservation(reply,p){
 const d=reply?.taskDefinition;if(!d)unavailable();
 if(!d||d.taskDefinitionArn!==p.taskDefinitionArn||d.status!=='ACTIVE'||d.networkMode!=='awsvpc'||
    !Array.isArray(d.requiresCompatibilities)||!d.requiresCompatibilities.includes('FARGATE')||
    d.taskRoleArn!==p.taskRoleArn||d.executionRoleArn!==p.executionRoleArn||
    !Array.isArray(d.containerDefinitions)||d.containerDefinitions.length<1||d.containerDefinitions.length>10)drift();
 const containers=d.containerDefinitions.filter(v=>v?.name===p.containerName);
 if(containers.length!==1||containers[0].image!==p.imageUri||containers[0].essential!==true)drift();
}
function taskObservation(task,p,id,service,started,partner=false){
 const pending=partner&&['PROVISIONING','PENDING','ACTIVATING'].includes(task?.lastStatus);
 const matches=(actual,expected)=>pending&&actual===undefined||actual===expected;
 if(!task||task.taskArn!==id||task.clusterArn!==p.clusterArn||task.taskDefinitionArn!==p.taskDefinitionArn||
    task.group!=='service:'+p.serviceArn.split('/').at(-1)||!service.deploymentIds.includes(task.startedBy)||
    !(pending&&task.createdAt===undefined)&&(!(task.createdAt instanceof Date)||!instant(task.createdAt.getTime())||task.createdAt.getTime()>started)||
    !matches(task.launchType,'FARGATE')||!matches(task.platformFamily,'Linux')||!matches(task.platformVersion,'1.4.0')||!matches(task.enableExecuteCommand,false)||
    !pending&&task.lastStatus!=='RUNNING'||task.desiredStatus!=='RUNNING'||
    !(pending&&task.containers===undefined)&&!Array.isArray(task.containers))drift();
 const containers=task.containers??[];
 // Name-only init-container overrides and empty accelerator lists change no pin.
 const o=task.overrides,ownNames=new Set(containers.map(v=>v?.name));
 if(o!==undefined){
  own(o,[],['taskRoleArn','executionRoleArn','containerOverrides','inferenceAcceleratorOverrides']);
  if(o.taskRoleArn!==undefined&&o.taskRoleArn!==p.taskRoleArn||o.executionRoleArn!==undefined&&o.executionRoleArn!==p.executionRoleArn||
     o.inferenceAcceleratorOverrides!==undefined&&(!Array.isArray(o.inferenceAcceleratorOverrides)||o.inferenceAcceleratorOverrides.length!==0)||
     o.containerOverrides!==undefined&&(!Array.isArray(o.containerOverrides)||o.containerOverrides.some(v=>{
      try{return !(pending&&containers.length===0)&&!ownNames.has(own(v,['name']).name)||!name(own(v,['name']).name);}catch{return true;}
     })))drift();
 }
 const names=containers.map(v=>v?.name),matched=containers.filter(v=>v?.name===p.containerName);
 if(names.some(v=>!name(v))||new Set(names).size!==names.length||matched.length>1||!pending&&matched.length!==1)drift();
 const c=matched[0],containerPrefix=p.clusterArn.replace('cluster/','container/')+'/'+id.split('/').at(-1)+'/';
 if(c&&(!pending&&c.lastStatus!=='RUNNING'||!matches(c.image,p.imageUri)||!matches(c.imageDigest,p.imageUri.split('@')[1])||
    c.taskArn!==undefined&&c.taskArn!==id||!(pending&&c.containerArn===undefined)&&
    (typeof c.containerArn!=='string'||!c.containerArn.startsWith(containerPrefix)||
     !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(c.containerArn.slice(containerPrefix.length)))))drift();
 const a=task.attachments?.filter(v=>v?.type==='ElasticNetworkInterface')??[];
 if(a.length>1||!pending&&a.length!==1||a.length&&(!['ATTACHED',...(pending?['PRECREATED','ATTACHING']:[])].includes(a[0].status)||
    !(pending&&a[0].details===undefined)&&!Array.isArray(a[0].details)))drift();
 const details=new Map();for(const r of a[0]?.details??[]){if(!r||typeof r.name!=='string'||typeof r.value!=='string'||details.has(r.name))drift();details.set(r.name,r.value);}
 if(['publicIPv4Address','publicIpAddress'].some(key=>details.has(key)))drift();
 const eni=details.get('networkInterfaceId'),rawIp=details.get('privateIPv4Address'),subnet=details.get('subnetId');
 if(!(pending&&eni===undefined)&&!awsId('eni',eni)||!(pending&&subnet===undefined)&&!p.subnetIds.includes(subnet))drift();
 const ip=pending&&rawIp===undefined?undefined:privateIPv4(rawIp);
 if(c?.networkInterfaces!==undefined&&(!Array.isArray(c.networkInterfaces)||c.networkInterfaces.length>1||
    !pending&&c.networkInterfaces.length!==1||c.networkInterfaces.some(v=>
     ['publicIpv4Address','publicIPv4Address','publicIpAddress'].some(key=>v?.[key]!==undefined)||
     typeof v?.privateIpv4Address!=='string'||privateIPv4(v.privateIpv4Address)!==(ip??v.privateIpv4Address))))drift();
 return {taskArn:id,createdAtMs:task.createdAt?.getTime(),privateIpv4Address:ip,networkInterfaceId:eni,subnetId:subnet,pending,primary:task.startedBy===service.deploymentId};
}
function networkObservation(n,v,p){
 const matches=(actual,expected)=>v.pending&&actual===undefined||actual===expected;
 if(!n||n.NetworkInterfaceId!==v.networkInterfaceId||
    !matches(n.SubnetId,v.subnetId??n.SubnetId)||n.SubnetId!==undefined&&!p.subnetIds.includes(n.SubnetId)||
    !matches(n.VpcId,p.vpcId)||!matches(n.PrivateIpAddress,v.privateIpv4Address??n.PrivateIpAddress)||
    !matches(n.OwnerId,'967807252336')||!(v.pending?['in-use','available',undefined].includes(n.Status):n.Status==='in-use')||
    !(v.pending?['attached','attaching',undefined].includes(n.Attachment?.Status):n.Attachment?.Status==='attached')||
    n.Association?.PublicIp!==undefined||n.Association?.CarrierIp!==undefined||
    !(v.pending&&n.Groups===undefined)&&!sameSet(n.Groups?.map(g=>g?.GroupId),p.securityGroupIds)||
    !(v.pending&&n.PrivateIpAddresses===undefined)&&(!Array.isArray(n.PrivateIpAddresses)||n.PrivateIpAddresses.length<1)||
    n.Ipv6Addresses!==undefined&&(!Array.isArray(n.Ipv6Addresses)||n.Ipv6Addresses.length))drift();
 if(n.PrivateIpAddress!==undefined)privateIPv4(n.PrivateIpAddress);
 const ips=(n.PrivateIpAddresses??[]).map(r=>{if(r?.Association?.PublicIp!==undefined||r?.Association?.CarrierIp!==undefined)drift();return privateIPv4(r?.PrivateIpAddress);});
 if(new Set(ips).size!==ips.length||!(v.pending&&v.privateIpv4Address===undefined)&&!ips.includes(v.privateIpv4Address))drift();
}
/** Borrowed pinned task-role clients; unknown work quarantines this discovery instance. */
export async function createProductServicePairDiscovery(raw){
 let c,pins,limits,ecs,ec2;
 try{
  c=own(raw,['ecsClient','ec2Client','configuration','now','limits'],['enabled']);pins=parseProductServicePairConfiguration(c.configuration);
  limits=data(own(c.limits,['maxRequestMs','maxLeaseMs']));
  if(typeof c.now!=='function'||typeof(c.enabled??false)!=='boolean'||!instant(limits.maxRequestMs)||limits.maxRequestMs>OWNER_MAX_REQUEST_MS||
     !instant(limits.maxLeaseMs)||limits.maxLeaseMs>PAIR_LEASE_TTL_MS)fail();
  ecs=storageMethod(c.ecsClient,'send');ec2=storageMethod(c.ec2Client,'send');
 }catch{fail();}
 const runtimeRequire=createRequire(new URL('../../runtime/package.json',import.meta.url));
 const {DescribeServicesCommand,ListTasksCommand,DescribeTaskDefinitionCommand,DescribeTasksCommand}=runtimeRequire('@aws-sdk/client-ecs');
 const {DescribeNetworkInterfacesCommand}=runtimeRequire('@aws-sdk/client-ec2');
 const enabled=c.enabled??false,now=c.now;
 const telemetry=currentTurnTelemetry();
 let quarantined=false;
 return Object.freeze({get available(){return enabled&&!quarantined;},async read(raw){
  let life;
  try{
   const r=own(raw,['deadlineMs'],['signal']);nativeSignal(r.signal);const started=now();
   if(!enabled||quarantined||!instant(started)||!instant(r.deadlineMs)||r.deadlineMs<=started||pins.expiresAtMs<=started)unavailable();
   const deadline=Math.min(r.deadlineMs,pins.expiresAtMs,started+limits.maxRequestMs);
   life=createOperationLifetime({deadlineMs:deadline,now,signal:r.signal,errorFactory:()=>pairFailure()});
   const check=()=>{life.check();if(quarantined||now()<started)unavailable();};
   const send=async(C,input,client=ecs)=>{check();try{const result=await life.run(signal=>client(new C(input),{abortSignal:signal}));check();return result;}catch{unavailable();}};
   // Independent reads run together. A phase settles every read it started before refusing, so a refusal never leaves work
   // behind for the lifetime to count (unsettled work quarantines the reader).
   const together=async reads=>{const settled=await Promise.allSettled(reads.map(read=>read()));const refused=settled.find(r=>r.status==='rejected'&&r.reason?.code==='PAIR_DRIFT')??settled.find(r=>r.status==='rejected');if(refused)throw refused.reason;return settled.map(r=>r.value);};
   const definition=async p=>{const reply=await send(DescribeTaskDefinitionCommand,{taskDefinition:p.taskDefinitionArn});return observe(()=>definitionObservation(reply,p));};
   const services=async()=>{
    const reply=await send(DescribeServicesCommand,{cluster:pins.owner.clusterArn,services:[pins.owner.serviceArn,pins.proxy.serviceArn]});
    const [owner,proxy]=observePairRows(reply?.services,'serviceArn',[pins.owner.serviceArn,pins.proxy.serviceArn],
     (row,index)=>serviceObservation(row,index===0?pins.owner:pins.proxy,index===1),reply?.failures);
    return {owner,proxy};
   };
   const member=async(p,partner=false)=>{
    const ids=new Set(),tokens=new Set();let nextToken;
    for(let page=0;page<4;page++){
     const reply=await send(ListTasksCommand,{cluster:p.clusterArn,serviceName:p.serviceArn.split('/').at(-1),desiredStatus:'RUNNING',maxResults:100,...(nextToken?{nextToken}:{})});
     if(!Array.isArray(reply?.taskArns))unavailable();if(reply.taskArns.length>100)drift();
     for(const id of reply.taskArns){if(!taskArn(id,p)||ids.has(id))drift();ids.add(id);if(ids.size>(partner?2:1))drift();}
     if(reply.nextToken===undefined||reply.nextToken===null){if(!partner&&ids.size!==1)drift();return [...ids];}
     if(typeof reply.nextToken!=='string'||!reply.nextToken||reply.nextToken.length>1024||tokens.has(reply.nextToken))unavailable();tokens.add(reply.nextToken);nextToken=reply.nextToken;
    }unavailable();
   };
   // The partner's empty/pending/rolling inventory is not a proof. Still inspect
   // every listed task and ENI before refusing so a transition cannot mask drift.
   const [first,ownerIds,proxyIds]=await together([services,()=>member(pins.owner),()=>member(pins.proxy,true),()=>definition(pins.owner),()=>definition(pins.proxy)]);
   if(proxyIds.length===2&&!first.proxy.rolling)drift();
   const ids=[...ownerIds,...proxyIds];if(new Set(ids).size!==ids.length)drift();
   const reply=await send(DescribeTasksCommand,{cluster:pins.owner.clusterArn,tasks:ids,include:['TAGS']});
   const observed=observePairRows(reply?.tasks,'taskArn',ids,(row,index)=>index===0?
    taskObservation(row,pins.owner,ids[index],first.owner,started):
    taskObservation(row,pins.proxy,ids[index],first.proxy,started,true),reply?.failures);
   const connected=observed.filter(v=>v.networkInterfaceId!==undefined);
   if(new Set(connected.map(v=>v.networkInterfaceId)).size!==connected.length||
      new Set(observed.filter(v=>v.privateIpv4Address!==undefined).map(v=>v.privateIpv4Address)).size!==observed.filter(v=>v.privateIpv4Address!==undefined).length)drift();
   if(connected.length){
    const networks=await send(DescribeNetworkInterfacesCommand,{NetworkInterfaceIds:connected.map(v=>v.networkInterfaceId)},ec2);
    observePairRows(networks?.NetworkInterfaces,'NetworkInterfaceId',connected.map(v=>v.networkInterfaceId),
     (row,index)=>networkObservation(row,connected[index],connected[index]===observed[0]?pins.owner:pins.proxy));
   }
   const [last,ownerAgain,proxyAgain]=await together([services,()=>member(pins.owner),()=>member(pins.proxy,true)]);
   if(last.owner.deploymentId!==first.owner.deploymentId||!sameSet(ownerAgain,ownerIds))drift();
   if(last.proxy.deploymentId!==first.proxy.deploymentId||!sameSet(proxyAgain,proxyIds)){
    // A stop/drain can finish during this proof. Only a subset of tasks already
    // fully inspected above can be unavailable; a new final ARN stays drift.
    if(last.proxy.deploymentId===first.proxy.deploymentId&&proxyAgain.every(id=>proxyIds.includes(id))&&
       (first.proxy.transitional||last.proxy.transitional||proxyAgain.length<proxyIds.length))unavailable();
    drift();
   }
   if(first.proxy.transitional||last.proxy.transitional||proxyIds.length!==1||observed.some(v=>v.pending)||!observed[1]?.primary)unavailable();
   const [owner,proxy]=observed;
   check();const checkedAtMs=now(),expiresAtMs=Math.min(pins.expiresAtMs,checkedAtMs+limits.maxLeaseMs);
   if(!instant(checkedAtMs)||checkedAtMs<started||checkedAtMs>=deadline||expiresAtMs<=checkedAtMs)unavailable();
   const project=v=>({taskArn:v.taskArn,createdAtMs:v.createdAtMs,privateIpv4Address:v.privateIpv4Address,networkInterfaceId:v.networkInterfaceId});
   return data({owner:project(owner),proxy:project(proxy),checkedAtMs,expiresAtMs});
  }catch(error){if(['PAIR_DRIFT','PAIR_UNAVAILABLE'].includes(error?.code))throw error;unavailable();}finally{if(life?.close().unsettledOperations>0&&!quarantined){quarantined=true;health('pair','quarantined','PAIR_UNAVAILABLE',telemetry);}}
 }});
}
