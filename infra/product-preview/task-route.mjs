/** Offline ECS task-to-ENI readback. This neither creates a route nor grants transport authority. */
import {isIP} from 'node:net';
import {canonicalSha256 as hash} from '../../packages/contracts/validate.mjs';
import {compileEcsTaskBinding,assertEcsOwnedTask,assertEcsRunningTask} from '../../apps/runtime/native-authority/ecs-task-binding.mjs';

const fail=()=>{throw Error('TASK_ROUTE_REFUSED');};
const id=(prefix,value)=>typeof value==='string'&&new RegExp(`^${prefix}-[a-f0-9]+$`,'u').test(value);
const privateIPv4=value=>{
 if(isIP(value)!==4||value.split('.').some(part=>String(Number(part))!==part))return false;
 const [a,b]=value.split('.').map(Number);
 return a===10||a===172&&b>=16&&b<=31||a===192&&b===168;
};
function oneDetail(details,name){
 const matches=details.filter(item=>item?.name===name);
 if(matches.length!==1||typeof matches[0].value!=='string')fail();
 return matches[0].value;
}

/**
 * Consume fresh trusted DescribeTasks and DescribeNetworkInterfaces results for an original task.
 * The caller must first prove its durable admission; these response-shaped values alone cannot do that.
 * The candidate can inform a later private router, but cannot prove DNS, TLS, delivery or reachability.
 */
export function observeOriginalTaskNetworkCandidate({original,resource,task,networkInterface,network,now=Date.now}){
 try{
  if(typeof now!=='function'||!resource||!task||!networkInterface||!network||
     !id('vpc',network.vpcId)||!id('subnet',network.subnetId)||
     !Array.isArray(network.securityGroupIds)||network.securityGroupIds.length<1||network.securityGroupIds.length>5||
     network.securityGroupIds.some(group=>!id('sg',group))||new Set(network.securityGroupIds).size!==network.securityGroupIds.length||
     resource.clusterArn!==network.clusterArn||resource.taskDefinitionArn!==network.taskDefinitionArn||
     typeof resource.taskArn!=='string'||!Number.isSafeInteger(resource.createdAtMs)||typeof resource.containerName!=='string')fail();
  const binding=compileEcsTaskBinding({original,clusterArn:resource.clusterArn,taskDefinitionArn:resource.taskDefinitionArn,
   taskArn:resource.taskArn,containerName:resource.containerName,createdAtMs:resource.createdAtMs,enabled:true,now});
  assertEcsOwnedTask(task,binding);assertEcsRunningTask(task,binding);
  const attachments=task.attachments?.filter(item=>item?.type==='ElasticNetworkInterface');
  if(attachments?.length!==1||attachments[0].status!=='ATTACHED'||!Array.isArray(attachments[0].details))fail();
  const details=attachments[0].details,eniId=oneDetail(details,'networkInterfaceId'),subnetId=oneDetail(details,'subnetId'),ip=oneDetail(details,'privateIPv4Address');
  if(!id('eni',eniId)||subnetId!==network.subnetId||!privateIPv4(ip)||
     networkInterface.NetworkInterfaceId!==eniId||networkInterface.SubnetId!==subnetId||
     networkInterface.VpcId!==network.vpcId||networkInterface.PrivateIpAddress!==ip||
     networkInterface.Status!=='in-use'||networkInterface.Attachment?.Status!=='attached'||
     networkInterface.Association?.PublicIp!==undefined||!Array.isArray(networkInterface.Groups))fail();
  const groups=networkInterface.Groups.map(group=>group?.GroupId);
  const checkedAtMs=now();
  if(groups.length!==network.securityGroupIds.length||new Set(groups).size!==groups.length||
     groups.some(group=>!network.securityGroupIds.includes(group))||!Number.isSafeInteger(checkedAtMs)||
     checkedAtMs<resource.createdAtMs||checkedAtMs>=original.expiresAtMs)fail();
  return Object.freeze({taskArn:resource.taskArn,clusterArn:resource.clusterArn,taskDefinitionArn:resource.taskDefinitionArn,
   bindingSha256:hash(original.binding),executionKey:original.executionKey,createdAtMs:resource.createdAtMs,checkedAtMs,
   networkInterfaceId:eniId,privateIPv4Address:ip,subnetId,vpcId:network.vpcId,
   securityGroupIds:Object.freeze([...groups].sort()),port:8080,expiresAtMs:original.expiresAtMs});
 }catch{fail();}
}
