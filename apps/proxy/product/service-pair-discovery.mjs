/** Fresh approved service tasks, never original runner placement authority.
 * Revision/certificate pins are reviewed configuration, not AWS attestation. */
import {createRequire} from 'node:module';
import {isIP} from 'node:net';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
const fail=()=>{throw Error('PRODUCT_SERVICE_TASK_LEASE_UNAVAILABLE');};
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
function serviceObservation(reply,p){
 if(!Array.isArray(reply?.services)||reply.services.length!==2||reply.failures!==undefined&&(!Array.isArray(reply.failures)||reply.failures.length))fail();
 const matches=reply.services.filter(s=>s?.serviceArn===p.serviceArn);if(matches.length!==1)fail();const s=matches[0];
 if(s.clusterArn!==p.clusterArn||s.serviceName!==p.serviceArn.split('/').at(-1)||s.status!=='ACTIVE'||s.taskDefinition!==p.taskDefinitionArn||
    s.desiredCount!==1||s.runningCount!==1||s.pendingCount!==0||s.launchType!=='FARGATE'||s.platformVersion!=='1.4.0'||
    s.enableExecuteCommand!==false||!Array.isArray(s.deployments)||s.deployments.length<1||s.deployments.length>8)fail();
 const primary=s.deployments.filter(d=>d?.status==='PRIMARY');if(primary.length!==1)fail();const d=primary[0];
 if(typeof d.id!=='string'||!/^ecs-svc\/[0-9]{1,32}$/u.test(d.id)||d.taskDefinition!==p.taskDefinitionArn||d.desiredCount!==1||d.runningCount!==1||d.pendingCount!==0||
    !(d.rolloutState==='COMPLETED'||p.allowPrimaryInProgress&&d.rolloutState==='IN_PROGRESS')||
    s.deployments.some(other=>other!==d&&(other?.desiredCount!==0||other?.runningCount!==0||other?.pendingCount!==0)))fail();
 const network=s.networkConfiguration?.awsvpcConfiguration;
 if(!network||network.assignPublicIp!=='DISABLED'||!sameSet(network.subnets,p.subnetIds)||!sameSet(network.securityGroups,p.securityGroupIds))fail();
 return {deploymentId:d.id};
}
function definitionObservation(reply,p){
 const d=reply?.taskDefinition;
 if(!d||d.taskDefinitionArn!==p.taskDefinitionArn||d.status!=='ACTIVE'||d.networkMode!=='awsvpc'||
    !Array.isArray(d.requiresCompatibilities)||!d.requiresCompatibilities.includes('FARGATE')||
    d.taskRoleArn!==p.taskRoleArn||d.executionRoleArn!==p.executionRoleArn||
    !Array.isArray(d.containerDefinitions)||d.containerDefinitions.length<1||d.containerDefinitions.length>10)fail();
 const containers=d.containerDefinitions.filter(v=>v?.name===p.containerName);
 if(containers.length!==1||containers[0].image!==p.imageUri||containers[0].essential!==true)fail();
}
function taskObservation(task,p,id,deploymentId,started){
 if(!task||task.taskArn!==id||task.clusterArn!==p.clusterArn||task.taskDefinitionArn!==p.taskDefinitionArn||
    task.group!=='service:'+p.serviceArn.split('/').at(-1)||task.startedBy!==deploymentId||
    !(task.createdAt instanceof Date)||!instant(task.createdAt.getTime())||task.createdAt.getTime()>started||
    task.launchType!=='FARGATE'||task.platformFamily!=='Linux'||task.platformVersion!=='1.4.0'||task.enableExecuteCommand!==false||
    task.lastStatus!=='RUNNING'||task.desiredStatus!=='RUNNING'||!Array.isArray(task.containers))fail();
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
     })))fail();
 }
 const names=task.containers.map(v=>v?.name),matched=task.containers.filter(v=>v?.name===p.containerName);
 if(names.some(v=>!name(v))||new Set(names).size!==names.length||matched.length!==1)fail();
 const c=matched[0],containerPrefix=p.clusterArn.replace('cluster/','container/')+'/'+id.split('/').at(-1)+'/';
 if(c.lastStatus!=='RUNNING'||c.image!==p.imageUri||c.imageDigest!==p.imageUri.split('@')[1]||
    c.taskArn!==undefined&&c.taskArn!==id||typeof c.containerArn!=='string'||!c.containerArn.startsWith(containerPrefix)||
    !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(c.containerArn.slice(containerPrefix.length)))fail();
 const a=task.attachments?.filter(v=>v?.type==='ElasticNetworkInterface');
 if(a?.length!==1||a[0].status!=='ATTACHED'||!Array.isArray(a[0].details))fail();
 const details=new Map();for(const r of a[0].details){if(!r||typeof r.name!=='string'||typeof r.value!=='string'||details.has(r.name))fail();details.set(r.name,r.value);}
 const eni=details.get('networkInterfaceId'),ip=privateIPv4(details.get('privateIPv4Address')),subnet=details.get('subnetId');
 if(!awsId('eni',eni)||!p.subnetIds.includes(subnet)||c.networkInterfaces!==undefined&&
    (!Array.isArray(c.networkInterfaces)||c.networkInterfaces.length!==1||c.networkInterfaces[0]?.privateIpv4Address!==ip))fail();
 return {taskArn:id,createdAtMs:task.createdAt.getTime(),privateIpv4Address:ip,networkInterfaceId:eni,subnetId:subnet};
}
function networkObservation(n,v,p){
 if(!n||n.NetworkInterfaceId!==v.networkInterfaceId||n.SubnetId!==v.subnetId||n.VpcId!==p.vpcId||n.PrivateIpAddress!==v.privateIpv4Address||
    n.OwnerId!=='967807252336'||n.Status!=='in-use'||n.Attachment?.Status!=='attached'||n.Association?.PublicIp!==undefined||
    n.Association?.CarrierIp!==undefined||!sameSet(n.Groups?.map(g=>g?.GroupId),p.securityGroupIds)||
    !Array.isArray(n.PrivateIpAddresses)||n.PrivateIpAddresses.length<1||n.Ipv6Addresses!==undefined&&(!Array.isArray(n.Ipv6Addresses)||n.Ipv6Addresses.length))fail();
 const ips=n.PrivateIpAddresses.map(r=>{if(r?.Association?.PublicIp!==undefined||r?.Association?.CarrierIp!==undefined)fail();return privateIPv4(r?.PrivateIpAddress);});
 if(new Set(ips).size!==ips.length||!ips.includes(v.privateIpv4Address))fail();
}
/** Borrowed pinned task-role clients; unknown work permanently quarantines. */
export async function createProductServicePairDiscovery(raw){
 let c,pins,limits,ecs,ec2;
 try{
  c=own(raw,['ecsClient','ec2Client','configuration','now','limits'],['enabled']);pins=parseProductServicePairConfiguration(c.configuration);
  limits=data(own(c.limits,['maxRequestMs','maxLeaseMs']));
  if(typeof c.now!=='function'||typeof(c.enabled??false)!=='boolean'||!instant(limits.maxRequestMs)||limits.maxRequestMs>3000||
     !instant(limits.maxLeaseMs)||limits.maxLeaseMs>30000)fail();
  ecs=storageMethod(c.ecsClient,'send');ec2=storageMethod(c.ec2Client,'send');
 }catch{fail();}
 const runtimeRequire=createRequire(new URL('../../runtime/package.json',import.meta.url));
 const {DescribeServicesCommand,ListTasksCommand,DescribeTaskDefinitionCommand,DescribeTasksCommand}=runtimeRequire('@aws-sdk/client-ecs');
 const {DescribeNetworkInterfacesCommand}=runtimeRequire('@aws-sdk/client-ec2');
 const enabled=c.enabled??false,now=c.now;
 let quarantined=false;
 return Object.freeze({get available(){return enabled&&!quarantined;},async read(raw){
  let life;
  try{
   const r=own(raw,['deadlineMs'],['signal']);nativeSignal(r.signal);const started=now();
   if(!enabled||quarantined||!instant(started)||!instant(r.deadlineMs)||r.deadlineMs<=started||pins.expiresAtMs<=started)fail();
   const deadline=Math.min(r.deadlineMs,pins.expiresAtMs,started+limits.maxRequestMs);
   life=createOperationLifetime({deadlineMs:deadline,now,signal:r.signal,errorFactory:()=>Error('PRODUCT_SERVICE_TASK_LEASE_UNAVAILABLE')});
   const check=()=>{life.check();if(quarantined||now()<started)fail();};
   const send=async(C,input,client=ecs)=>{check();const result=await life.run(signal=>client(new C(input),{abortSignal:signal}));check();return result;};
   const services=async()=>{
    const reply=await send(DescribeServicesCommand,{cluster:pins.owner.clusterArn,services:[pins.owner.serviceArn,pins.proxy.serviceArn]});
    return {owner:serviceObservation(reply,pins.owner),proxy:serviceObservation(reply,pins.proxy)};
   };
   const member=async p=>{
    const ids=new Set(),tokens=new Set();let nextToken;
    for(let page=0;page<4;page++){
     const reply=await send(ListTasksCommand,{cluster:p.clusterArn,serviceName:p.serviceArn.split('/').at(-1),desiredStatus:'RUNNING',maxResults:100,...(nextToken?{nextToken}:{})});
     if(!Array.isArray(reply?.taskArns)||reply.taskArns.length>100)fail();
     for(const id of reply.taskArns){if(!taskArn(id,p)||ids.has(id))fail();ids.add(id);if(ids.size>1)fail();}
     if(reply.nextToken===undefined||reply.nextToken===null){if(ids.size!==1)fail();return [...ids][0];}
     if(typeof reply.nextToken!=='string'||!reply.nextToken||reply.nextToken.length>1024||tokens.has(reply.nextToken))fail();tokens.add(reply.nextToken);nextToken=reply.nextToken;
    }fail();
   };
   const first=await services(),ownerId=await member(pins.owner),proxyId=await member(pins.proxy);if(ownerId===proxyId)fail();
   for(const p of [pins.owner,pins.proxy])definitionObservation(await send(DescribeTaskDefinitionCommand,{taskDefinition:p.taskDefinitionArn}),p);
   const reply=await send(DescribeTasksCommand,{cluster:pins.owner.clusterArn,tasks:[ownerId,proxyId],include:['TAGS']});
   if(!Array.isArray(reply?.tasks)||reply.tasks.length!==2||reply.failures!==undefined&&(!Array.isArray(reply.failures)||reply.failures.length))fail();
   const tasks=new Map(reply.tasks.map(t=>[t?.taskArn,t]));if(tasks.size!==2)fail();
   const owner=taskObservation(tasks.get(ownerId),pins.owner,ownerId,first.owner.deploymentId,started),proxy=taskObservation(tasks.get(proxyId),pins.proxy,proxyId,first.proxy.deploymentId,started);
   if(owner.networkInterfaceId===proxy.networkInterfaceId||owner.privateIpv4Address===proxy.privateIpv4Address)fail();
   const networks=await send(DescribeNetworkInterfacesCommand,{NetworkInterfaceIds:[owner.networkInterfaceId,proxy.networkInterfaceId]},ec2);
   if(!Array.isArray(networks?.NetworkInterfaces)||networks.NetworkInterfaces.length!==2)fail();
   const byId=new Map(networks.NetworkInterfaces.map(n=>[n?.NetworkInterfaceId,n]));if(byId.size!==2)fail();
   networkObservation(byId.get(owner.networkInterfaceId),owner,pins.owner);networkObservation(byId.get(proxy.networkInterfaceId),proxy,pins.proxy);
   const last=await services();
   if(last.owner.deploymentId!==first.owner.deploymentId||last.proxy.deploymentId!==first.proxy.deploymentId||
      await member(pins.owner)!==ownerId||await member(pins.proxy)!==proxyId)fail();
   check();const checkedAtMs=now(),expiresAtMs=Math.min(pins.expiresAtMs,r.deadlineMs,checkedAtMs+limits.maxLeaseMs);
   if(!instant(checkedAtMs)||checkedAtMs<started||checkedAtMs>=deadline||expiresAtMs<=checkedAtMs)fail();
   const project=v=>({taskArn:v.taskArn,createdAtMs:v.createdAtMs,privateIpv4Address:v.privateIpv4Address});
   return data({owner:project(owner),proxy:project(proxy),checkedAtMs,expiresAtMs});
  }catch{fail();}finally{if(life?.close().unsettledOperations>0)quarantined=true;}
 }});
}
