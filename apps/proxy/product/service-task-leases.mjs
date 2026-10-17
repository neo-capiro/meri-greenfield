/** Fresh service-task/ENI evidence for the product owner's two mTLS peers.
 *
 * Trusted bootstrap pins this configuration from the reviewed deployment
 * inventory, including task creation times and certificate fingerprints. No
 * request/header or ECS observation can choose those pins. Certificate pins
 * are configuration custody, not a claim that AWS attests TLS certificates.
 * These service tasks are not original execution tasks: this reader invents
 * no RunBinding, execution tags, grant or native-credential authority.
 */
import {createRequire} from 'node:module';
import {isIP} from 'node:net';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';

const unavailable=()=>Error('PRODUCT_SERVICE_TASK_LEASE_UNAVAILABLE');
const fail=()=>{throw unavailable();};
const prefix='arn:aws:ecs:us-east-1:967807252336:';
const slot=/^[A-Za-z0-9_-]{1,128}$/u;
const digest=/^sha256:[a-f0-9]{64}$/u;
const sha=/^[a-f0-9]{64}$/u;
const awsId=(kind,value)=>typeof value==='string'&&new RegExp(`^${kind}-[a-f0-9]{8,17}$`,'u').test(value);
const name=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,255}$/u.test(value);
const instant=value=>Number.isSafeInteger(value)&&value>0;
function privateIPv4(value){
 if(typeof value!=='string'||isIP(value)!==4||value.split('.').some(part=>String(Number(part))!==part))fail();
 const [a,b]=value.split('.').map(Number);
 if(!(a===10||a===172&&b>=16&&b<=31||a===192&&b===168))fail();
 return value;
}
function servicePin(value,expiresAtMs){
 const pin=data(own(value,['clusterArn','taskArn','taskDefinitionArn','serviceName','containerName',
  'imageDigest','createdAtMs','vpcId','subnetId','securityGroupIds']));
 if(typeof pin.clusterArn!=='string'||!pin.clusterArn.startsWith(prefix+'cluster/'))fail();
 const cluster=pin.clusterArn.slice((prefix+'cluster/').length);
 if(!name(cluster)||typeof pin.taskArn!=='string'||
    !new RegExp(`^${prefix}task/${cluster}/[a-f0-9]{32}$`,'u').test(pin.taskArn)||
    typeof pin.taskDefinitionArn!=='string'||!pin.taskDefinitionArn.startsWith(prefix)||
    !/^task-definition\/[A-Za-z0-9_-]+:[1-9][0-9]*$/u.test(pin.taskDefinitionArn.slice(prefix.length))||
    !name(pin.serviceName)||!name(pin.containerName)||typeof pin.imageDigest!=='string'||!digest.test(pin.imageDigest)||
    !instant(pin.createdAtMs)||pin.createdAtMs>=expiresAtMs||!awsId('vpc',pin.vpcId)||!awsId('subnet',pin.subnetId)||
    !Array.isArray(pin.securityGroupIds)||pin.securityGroupIds.length<1||pin.securityGroupIds.length>5||
    pin.securityGroupIds.some(group=>!awsId('sg',group))||new Set(pin.securityGroupIds).size!==pin.securityGroupIds.length)fail();
 return pin;
}
function taskObservation(task,pin){
 if(!task||task.taskArn!==pin.taskArn||task.clusterArn!==pin.clusterArn||task.taskDefinitionArn!==pin.taskDefinitionArn||
    task.group!=='service:'+pin.serviceName||!(task.createdAt instanceof Date)||task.createdAt.getTime()!==pin.createdAtMs||
    task.launchType!=='FARGATE'||task.platformFamily!=='Linux'||task.platformVersion!=='1.4.0'||
    task.enableExecuteCommand!==false||task.lastStatus!=='RUNNING'||task.desiredStatus!=='RUNNING'||!Array.isArray(task.containers))fail();
 const names=task.containers.map(container=>container?.name),matches=task.containers.filter(container=>container?.name===pin.containerName);
 if(names.some(value=>!name(value))||new Set(names).size!==names.length||matches.length!==1)fail();
 const container=matches[0],containerPrefix=pin.clusterArn.replace('cluster/','container/')+'/'+pin.taskArn.split('/').at(-1)+'/';
 if(container.lastStatus!=='RUNNING'||container.imageDigest!==pin.imageDigest||typeof container.image!=='string'||
    !container.image.endsWith('@'+pin.imageDigest)||container.taskArn!==undefined&&container.taskArn!==pin.taskArn||
    typeof container.containerArn!=='string'||!container.containerArn.startsWith(containerPrefix)||
    !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(container.containerArn.slice(containerPrefix.length)))fail();
 const attachments=task.attachments?.filter(attachment=>attachment?.type==='ElasticNetworkInterface');
 if(attachments?.length!==1||attachments[0].status!=='ATTACHED'||!Array.isArray(attachments[0].details))fail();
 const details=new Map();
 for(const row of attachments[0].details){
  if(!row||typeof row.name!=='string'||typeof row.value!=='string'||details.has(row.name))fail();
  details.set(row.name,row.value);
 }
 const networkInterfaceId=details.get('networkInterfaceId'),privateIpv4Address=privateIPv4(details.get('privateIPv4Address'));
 if(!awsId('eni',networkInterfaceId)||details.get('subnetId')!==pin.subnetId)fail();
 if(container.networkInterfaces!==undefined&&(!Array.isArray(container.networkInterfaces)||container.networkInterfaces.length!==1||
    container.networkInterfaces[0]?.privateIpv4Address!==privateIpv4Address))fail();
 return {networkInterfaceId,privateIpv4Address};
}
function networkObservation(network,observation,pin){
 if(!network||network.NetworkInterfaceId!==observation.networkInterfaceId||network.SubnetId!==pin.subnetId||
    network.VpcId!==pin.vpcId||network.PrivateIpAddress!==observation.privateIpv4Address||network.OwnerId!=='967807252336'||
    network.Status!=='in-use'||network.Attachment?.Status!=='attached'||network.Association?.PublicIp!==undefined||
    network.Association?.CarrierIp!==undefined||!Array.isArray(network.Groups)||!Array.isArray(network.PrivateIpAddresses)||
    network.PrivateIpAddresses.length<1||network.Ipv6Addresses!==undefined&&(!Array.isArray(network.Ipv6Addresses)||network.Ipv6Addresses.length))fail();
 const groups=network.Groups.map(group=>group?.GroupId);
 if(groups.length!==pin.securityGroupIds.length||new Set(groups).size!==groups.length||groups.some(group=>!pin.securityGroupIds.includes(group)))fail();
 const addresses=network.PrivateIpAddresses.map(row=>{
  if(row?.Association?.PublicIp!==undefined||row?.Association?.CarrierIp!==undefined)fail();
  return privateIPv4(row?.PrivateIpAddress);
 });
 if(new Set(addresses).size!==addresses.length||!addresses.includes(observation.privateIpv4Address))fail();
}

/** The AWS clients belong to the assembled runtime's pinned dependency and
 * task-role owner. Bootstrap must supply fixed regional clients with retries
 * disabled. This adapter sends only DescribeTasks/DescribeNetworkInterfaces,
 * under an owned hard deadline; unresolved work permanently closes it.
 *
 * configuration: {schemaVersion:1,deploymentRevision,expiresAtMs,
 *  ownerCertSha256,proxyCertSha256,owner:ServicePin,proxy:ServicePin}.
 * read never takes an expected identity or IP from its caller. It returns only
 * the closed nonsecret lease documented below, freshly observed each time.
 */
export async function createProductServiceTaskLeaseReader(configuration){
 let c,pins,limits,ecs,ec2;
 try{
  c=own(configuration,['ecsClient','ec2Client','configuration','now','limits'],['enabled']);
  pins=data(own(c.configuration,['schemaVersion','deploymentRevision','expiresAtMs','ownerCertSha256','proxyCertSha256','owner','proxy']));
  limits=data(own(c.limits,['maxRequestMs','maxLeaseMs']));
  if(pins.schemaVersion!==1||typeof pins.deploymentRevision!=='string'||!slot.test(pins.deploymentRevision)||!instant(pins.expiresAtMs)||
     typeof pins.ownerCertSha256!=='string'||!sha.test(pins.ownerCertSha256)||typeof pins.proxyCertSha256!=='string'||!sha.test(pins.proxyCertSha256)||
     pins.ownerCertSha256===pins.proxyCertSha256||typeof c.now!=='function'||typeof (c.enabled??false)!=='boolean'||
     !instant(limits.maxRequestMs)||limits.maxRequestMs>3000||!instant(limits.maxLeaseMs)||limits.maxLeaseMs>30000)fail();
  servicePin(pins.owner,pins.expiresAtMs);servicePin(pins.proxy,pins.expiresAtMs);
  if(pins.owner.taskArn===pins.proxy.taskArn||pins.owner.serviceName===pins.proxy.serviceName||
     pins.owner.clusterArn!==pins.proxy.clusterArn||pins.owner.vpcId!==pins.proxy.vpcId)fail();
  ecs=storageMethod(c.ecsClient,'send');ec2=storageMethod(c.ec2Client,'send');
 }catch{fail();}
 // Reuse the existing runtime's exact AWS SDK dependencies; the proxy has no
 // second dependency tree, client factory, credential source or SDK version.
 const runtimeRequire=createRequire(new URL('../../runtime/package.json',import.meta.url));
 const {DescribeTasksCommand}=runtimeRequire('@aws-sdk/client-ecs');
 const {DescribeNetworkInterfacesCommand}=runtimeRequire('@aws-sdk/client-ec2');
 const enabled=c.enabled??false;
 let quarantined=false;
 return Object.freeze({get available(){return enabled&&!quarantined;},async read(value){
  let life;
  try{
   const v=own(value,['deadlineMs'],['signal']);nativeSignal(v.signal);
   const started=c.now();
   if(!enabled||quarantined||!instant(started)||!instant(v.deadlineMs)||v.deadlineMs<=started||pins.expiresAtMs<=started)fail();
   life=createOperationLifetime({deadlineMs:Math.min(v.deadlineMs,pins.expiresAtMs,started+limits.maxRequestMs),
    now:c.now,signal:v.signal,errorFactory:unavailable});
   const check=()=>{life.check();if(quarantined||c.now()<started)fail();};
   check();
   const result=await life.run(signal=>ecs(new DescribeTasksCommand({cluster:pins.owner.clusterArn,
    tasks:[pins.owner.taskArn,pins.proxy.taskArn],include:['TAGS']}),{abortSignal:signal}));
   check();
   if(!result||!Array.isArray(result.tasks)||result.tasks.length!==2||result.failures!==undefined&&(!Array.isArray(result.failures)||result.failures.length))fail();
   const tasks=new Map(result.tasks.map(task=>[task?.taskArn,task]));
   if(tasks.size!==2)fail();
   const owner=taskObservation(tasks.get(pins.owner.taskArn),pins.owner),proxy=taskObservation(tasks.get(pins.proxy.taskArn),pins.proxy);
   if(owner.networkInterfaceId===proxy.networkInterfaceId||owner.privateIpv4Address===proxy.privateIpv4Address)fail();
   const interfaces=await life.run(signal=>ec2(new DescribeNetworkInterfacesCommand({
    NetworkInterfaceIds:[owner.networkInterfaceId,proxy.networkInterfaceId]}),{abortSignal:signal}));
   check();
   if(!interfaces||!Array.isArray(interfaces.NetworkInterfaces)||interfaces.NetworkInterfaces.length!==2)fail();
   const networks=new Map(interfaces.NetworkInterfaces.map(network=>[network?.NetworkInterfaceId,network]));
   if(networks.size!==2)fail();
   networkObservation(networks.get(owner.networkInterfaceId),owner,pins.owner);
   networkObservation(networks.get(proxy.networkInterfaceId),proxy,pins.proxy);
   check();const checkedAtMs=c.now(),expiresAtMs=Math.min(pins.expiresAtMs,v.deadlineMs,checkedAtMs+limits.maxLeaseMs);
   if(!instant(checkedAtMs)||checkedAtMs<started||expiresAtMs<=checkedAtMs)fail();
   return data({schemaVersion:1,deploymentRevision:pins.deploymentRevision,ownerTaskArn:pins.owner.taskArn,proxyTaskArn:pins.proxy.taskArn,
    ownerPrivateIpv4Address:owner.privateIpv4Address,proxyPrivateIpv4Address:proxy.privateIpv4Address,
    ownerCertSha256:pins.ownerCertSha256,proxyCertSha256:pins.proxyCertSha256,checkedAtMs,expiresAtMs});
  }catch{fail();}finally{
   if(life?.close().unsettledOperations>0)quarantined=true;
  }
 }});
}
