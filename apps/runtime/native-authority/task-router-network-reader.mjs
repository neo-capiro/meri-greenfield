/** Fresh read-only AWS adapter. Construct only after its pinned SDK dependencies are installed. */
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {storageMethod} from '../../artifacts/storage/boundary.mjs';
import {observeOriginalTaskNetworkCandidate} from './task-router-network.mjs';
import {compileEcsTaskBinding,assertEcsOwnedTask,assertEcsRunningTask} from './ecs-task-binding.mjs';
import {taskRouterFault} from './task-router-boundary.mjs';
export async function createTaskRouterNetworkReader(configuration){
 const c=own(configuration,['ecsClient','ec2Client','network'],['now']),network=data(c.network),now=c.now??Date.now;
 own(network,['clusterArn','taskDefinitionArn','vpcId','subnetId','securityGroupIds']);
 const ecs=storageMethod(c.ecsClient,'send'),ec2=storageMethod(c.ec2Client,'send');if(typeof now!=='function')throw taskRouterFault();
 const [{DescribeTasksCommand},{DescribeNetworkInterfacesCommand}]=await Promise.all([import('@aws-sdk/client-ecs'),import('@aws-sdk/client-ec2')]);
 return Object.freeze({async observe(value){
  const v=own(value,['original','resource','signal','check']);nativeSignal(v.signal);if(typeof v.check!=='function')throw taskRouterFault();
  const check=()=>{v.check();v.signal?.throwIfAborted();};check();
  const tasks=await ecs(new DescribeTasksCommand({cluster:network.clusterArn,tasks:[v.resource.taskArn],include:['TAGS']}),{abortSignal:v.signal});check();
  if(!Array.isArray(tasks.tasks)||tasks.tasks.length!==1||tasks.failures?.length)throw taskRouterFault();
  const task=tasks.tasks[0],binding=compileEcsTaskBinding({original:v.original,...v.resource,enabled:true,now});assertEcsOwnedTask(task,binding);assertEcsRunningTask(task,binding);
  const attachments=task.attachments?.filter(a=>a?.type==='ElasticNetworkInterface');
  if(attachments?.length!==1||attachments[0].status!=='ATTACHED'||!Array.isArray(attachments[0].details))throw taskRouterFault();
  const ids=attachments[0].details.filter(d=>d?.name==='networkInterfaceId');if(ids.length!==1||typeof ids[0].value!=='string'||!/^eni-[a-f0-9]+$/u.test(ids[0].value))throw taskRouterFault();
  const interfaces=await ec2(new DescribeNetworkInterfacesCommand({NetworkInterfaceIds:[ids[0].value]}),{abortSignal:v.signal});check();
  if(!Array.isArray(interfaces.NetworkInterfaces)||interfaces.NetworkInterfaces.length!==1)throw taskRouterFault();
  return observeOriginalTaskNetworkCandidate({original:v.original,resource:v.resource,task,networkInterface:interfaces.NetworkInterfaces[0],network,now});
 }});
}
