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
 let missing=false;
 const observations=ids.map((id,index)=>{
  const matches=rows.filter(row=>row?.[idKey]===id);
  if(matches.length>1)drift();
  if(matches.length===0){missing=true;return undefined;}
  return observe(()=>inspect(matches[0],index));
 });
 if(rows.length>2||rows.length===2&&missing||failures!==undefined&&!Array.isArray(failures))drift();
 if(missing||failures?.length)unavailable();
 return observations;
}
function serviceObservation(s,p){
 if(s.clusterArn!==p.clusterArn||s.serviceName!==p.serviceArn.split('/').at(-1)||s.status!=='ACTIVE'||s.taskDefinition!==p.taskDefinitionArn||
    s.desiredCount!==1||s.runningCount!==1||s.pendingCount!==0||s.launchType!=='FARGATE'||s.platformVersion!=='1.4.0'||
    s.enableExecuteCommand!==false||!Array.isArray(s.deployments)||s.deployments.length<1||s.deployments.length>8)drift();
 const primary=s.deployments.filter(d=>d?.status==='PRIMARY');if(primary.length!==1)drift();const d=primary[0];
 if(typeof d.id!=='string'||!/^ecs-svc\/[0-9]{1,32}$/u.test(d.id)||d.taskDefinition!==p.taskDefinitionArn||d.desiredCount!==1||d.runningCount!==1||d.pendingCount!==0||
    !(d.rolloutState==='COMPLETED'||p.allowPrimaryInProgress&&d.rolloutState==='IN_PROGRESS')||
    s.deployments.some(other=>other!==d&&(other?.desiredCount!==0||other?.runningCount!==0||other?.pendingCount!==0)))drift();
 const network=s.networkConfiguration?.awsvpcConfiguration;
 if(!network||network.assignPublicIp!=='DISABLED'||!sameSet(network.subnets,p.subnetIds)||!sameSet(network.securityGroups,p.securityGroupIds))drift();
 return {deploymentId:d.id};
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
function taskObservation(task,p,id,deploymentId,started){
 if(!task||task.taskArn!==id||task.clusterArn!==p.clusterArn||task.taskDefinitionArn!==p.taskDefinitionArn||
    task.group!=='service:'+p.serviceArn.split('/').at(-1)||task.startedBy!==deploymentId||
    !(task.createdAt instanceof Date)||!instant(task.createdAt.getTime())||task.createdAt.getTime()>started||
    task.launchType!=='FARGATE'||task.platformFamily!=='Linux'||task.platformVersion!=='1.4.0'||task.enableExecuteCommand!==false||
    task.lastStatus!=='RUNNING'||task.desiredStatus!=='RUNNING'||!Array.isArray(task.containers))drift();
 // Live DescribeTasks always reports `inferenceAcceleratorOverrides: []` and one name-only containerOverrides entry
 // per task container (material-init included). Those override nothing; any field beyond `name`, a foreign name or
 // an accelerator still fails.
 const o=task.overrides,ownNames=new Set(task.containers.map(v=>v?.name));
 if(o!==undefined){
  own(o,[],['taskRoleArn','executionRoleArn','containerOverrides','inferenceAcceleratorOverrides']);
  if(o.taskRoleArn!==undefined&&o.taskRoleArn!==p.taskRoleArn||o.executionRoleArn!==undefined&&o.executionRoleArn!==p.executionRoleArn||
     o.inferenceAcceleratorOverrides!==undefined&&(!Array.isArray(o.inferenceAcceleratorOverrides)||o.inferenceAcceleratorOverrides.length!==0)||
     o.containerOverrides!==undefined&&(!Array.isArray(o.containerOverrides)||o.containerOverrides.some(v=>{
      try{return !ownNames.has(own(v,['name']).name);}catch{return true;}
     })))drift();
 }
 const names=task.containers.map(v=>v?.name),matched=task.containers.filter(v=>v?.name===p.containerName);
 if(names.some(v=>!name(v))||new Set(names).size!==names.length||matched.length!==1)drift();
 const c=matched[0],containerPrefix=p.clusterArn.replace('cluster/','container/')+'/'+id.split('/').at(-1)+'/';
 if(c.lastStatus!=='RUNNING'||c.image!==p.imageUri||c.imageDigest!==p.imageUri.split('@')[1]||
    c.taskArn!==undefined&&c.taskArn!==id||typeof c.containerArn!=='string'||!c.containerArn.startsWith(containerPrefix)||
    !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(c.containerArn.slice(containerPrefix.length)))drift();
 const a=task.attachments?.filter(v=>v?.type==='ElasticNetworkInterface');
 if(a?.length!==1||a[0].status!=='ATTACHED'||!Array.isArray(a[0].details))drift();
 const details=new Map();for(const r of a[0].details){if(!r||typeof r.name!=='string'||typeof r.value!=='string'||details.has(r.name))drift();details.set(r.name,r.value);}
 const eni=details.get('networkInterfaceId'),ip=privateIPv4(details.get('privateIPv4Address')),subnet=details.get('subnetId');
 if(!awsId('eni',eni)||!p.subnetIds.includes(subnet)||c.networkInterfaces!==undefined&&
    (!Array.isArray(c.networkInterfaces)||c.networkInterfaces.length!==1||c.networkInterfaces[0]?.privateIpv4Address!==ip))drift();
 return {taskArn:id,createdAtMs:task.createdAt.getTime(),privateIpv4Address:ip,networkInterfaceId:eni,subnetId:subnet};
}
function networkObservation(n,v,p){
 if(!n||n.NetworkInterfaceId!==v.networkInterfaceId||n.SubnetId!==v.subnetId||n.VpcId!==p.vpcId||n.PrivateIpAddress!==v.privateIpv4Address||
    n.OwnerId!=='967807252336'||n.Status!=='in-use'||n.Attachment?.Status!=='attached'||n.Association?.PublicIp!==undefined||
    n.Association?.CarrierIp!==undefined||!sameSet(n.Groups?.map(g=>g?.GroupId),p.securityGroupIds)||
    !Array.isArray(n.PrivateIpAddresses)||n.PrivateIpAddresses.length<1||n.Ipv6Addresses!==undefined&&(!Array.isArray(n.Ipv6Addresses)||n.Ipv6Addresses.length))drift();
 const ips=n.PrivateIpAddresses.map(r=>{if(r?.Association?.PublicIp!==undefined||r?.Association?.CarrierIp!==undefined)drift();return privateIPv4(r?.PrivateIpAddress);});
 if(new Set(ips).size!==ips.length||!ips.includes(v.privateIpv4Address))drift();
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
     (row,index)=>serviceObservation(row,index===0?pins.owner:pins.proxy),reply?.failures);
    return {owner,proxy};
   };
   const member=async p=>{
    const ids=new Set(),tokens=new Set();let nextToken;
    for(let page=0;page<4;page++){
     const reply=await send(ListTasksCommand,{cluster:p.clusterArn,serviceName:p.serviceArn.split('/').at(-1),desiredStatus:'RUNNING',maxResults:100,...(nextToken?{nextToken}:{})});
     if(!Array.isArray(reply?.taskArns))unavailable();if(reply.taskArns.length>100)drift();
     for(const id of reply.taskArns){if(!taskArn(id,p)||ids.has(id))drift();ids.add(id);if(ids.size>1)drift();}
     if(reply.nextToken===undefined||reply.nextToken===null){if(ids.size!==1)drift();return [...ids][0];}
     if(typeof reply.nextToken!=='string'||!reply.nextToken||reply.nextToken.length>1024||tokens.has(reply.nextToken))unavailable();tokens.add(reply.nextToken);nextToken=reply.nextToken;
    }unavailable();
   };
   // Phase 1: both services, both members and both task definitions. The task observation below still needs each service's
   // primary deployment and member, read before it; the final services and members re-read still follows the network read.
   const [first,ownerId,proxyId]=await together([services,()=>member(pins.owner),()=>member(pins.proxy),()=>definition(pins.owner),()=>definition(pins.proxy)]);if(ownerId===proxyId)drift();
   const reply=await send(DescribeTasksCommand,{cluster:pins.owner.clusterArn,tasks:[ownerId,proxyId],include:['TAGS']});
   const [owner,proxy]=observePairRows(reply?.tasks,'taskArn',[ownerId,proxyId],(row,index)=>index===0?
    taskObservation(row,pins.owner,ownerId,first.owner.deploymentId,started):
    taskObservation(row,pins.proxy,proxyId,first.proxy.deploymentId,started),reply?.failures);
   if(owner.networkInterfaceId===proxy.networkInterfaceId||owner.privateIpv4Address===proxy.privateIpv4Address)drift();
   const networks=await send(DescribeNetworkInterfacesCommand,{NetworkInterfaceIds:[owner.networkInterfaceId,proxy.networkInterfaceId]},ec2);
   observePairRows(networks?.NetworkInterfaces,'NetworkInterfaceId',[owner.networkInterfaceId,proxy.networkInterfaceId],
    (row,index)=>index===0?networkObservation(row,owner,pins.owner):networkObservation(row,proxy,pins.proxy));
   const [last,ownerAgain,proxyAgain]=await together([services,()=>member(pins.owner),()=>member(pins.proxy)]);
   if(last.owner.deploymentId!==first.owner.deploymentId||last.proxy.deploymentId!==first.proxy.deploymentId||ownerAgain!==ownerId||proxyAgain!==proxyId)drift();
   check();const checkedAtMs=now(),expiresAtMs=Math.min(pins.expiresAtMs,checkedAtMs+limits.maxLeaseMs);
   if(!instant(checkedAtMs)||checkedAtMs<started||checkedAtMs>=deadline||expiresAtMs<=checkedAtMs)unavailable();
   const project=v=>({taskArn:v.taskArn,createdAtMs:v.createdAtMs,privateIpv4Address:v.privateIpv4Address,networkInterfaceId:v.networkInterfaceId});
   return data({owner:project(owner),proxy:project(proxy),checkedAtMs,expiresAtMs});
  }catch(error){if(['PAIR_DRIFT','PAIR_UNAVAILABLE'].includes(error?.code))throw error;unavailable();}finally{if(life?.close().unsettledOperations>0&&!quarantined){quarantined=true;health('pair','quarantined','PAIR_UNAVAILABLE',telemetry);}}
 }});
}
