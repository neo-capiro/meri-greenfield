import test from 'node:test';
import assert from 'node:assert/strict';
import {createExecutionBinding} from '../../apps/control/conversations/execution-boundary.mjs';
import {binding,versions} from '../../apps/control/conversations/test/store-fixture.mjs';
import {observeOriginalTaskNetworkCandidate} from './task-route.mjs';
import {createTaskRouterNetworkReader} from '../../apps/runtime/native-authority/task-router-network-reader.mjs';

const prefix='arn:aws:ecs:us-east-1:967807252336:',clusterArn=prefix+'cluster/capiro-dev',
 taskArn=prefix+'task/capiro-dev/'+'1'.repeat(32),taskDefinitionArn=prefix+'task-definition/meri-product-preview-runner:1';
function fixture(){
 const now=100000,original=createExecutionBinding({binding,versions,plan:{test:'task-route'},expiresAtMs:now+10000});
 const resource={taskArn,clusterArn,taskDefinitionArn,containerName:'worker',createdAtMs:now-100};
 const task={taskArn,clusterArn,taskDefinitionArn,startedBy:original.executionKey,group:'meri:'+original.executionId,
  launchType:'FARGATE',platformFamily:'Linux',platformVersion:'1.4.0',enableExecuteCommand:false,
  createdAt:new Date(resource.createdAtMs),lastStatus:'RUNNING',desiredStatus:'RUNNING',
  containers:[{name:'worker',taskArn,containerArn:prefix+'container/capiro-dev/'+'1'.repeat(32)+'/11111111-1111-4111-8111-111111111111',image:'repository@'+versions.imageDigest,imageDigest:versions.imageDigest,lastStatus:'RUNNING'}],
  tags:[{key:'meri:execution-id',value:original.executionId},{key:'meri:binding-sha256',value:original.executionKey},
   {key:'meri:plan-sha256',value:original.planSha256},{key:'meri:expires-at-ms',value:String(original.expiresAtMs)}],
  attachments:[{type:'ElasticNetworkInterface',status:'ATTACHED',details:[{name:'networkInterfaceId',value:'eni-abcdef01'},
   {name:'subnetId',value:'subnet-0920665f91c905f01'},{name:'privateIPv4Address',value:'10.40.1.42'}]}]};
 const networkInterface={NetworkInterfaceId:'eni-abcdef01',SubnetId:'subnet-0920665f91c905f01',VpcId:'vpc-0ac26cfac7ed972be',
  PrivateIpAddress:'10.40.1.42',Status:'in-use',Attachment:{Status:'attached'},Groups:[{GroupId:'sg-abcd1234'}]};
 const network={clusterArn,taskDefinitionArn,vpcId:'vpc-0ac26cfac7ed972be',subnetId:'subnet-0920665f91c905f01',securityGroupIds:['sg-abcd1234']};
 return {original,resource,task,networkInterface,network,now:()=>now};
}
test('offline observation joins one running original task to exact private ENI and approved peers',()=>{
 const f=fixture(),candidate=observeOriginalTaskNetworkCandidate(f);
 assert.deepEqual({taskArn:candidate.taskArn,networkInterfaceId:candidate.networkInterfaceId,privateIPv4Address:candidate.privateIPv4Address,port:candidate.port},
  {taskArn,networkInterfaceId:'eni-abcdef01',privateIPv4Address:'10.40.1.42',port:8080});
 assert(Object.isFrozen(candidate));assert(Object.isFrozen(candidate.securityGroupIds));
 assert.equal(candidate.origin,undefined,'an AWS ENI readback does not establish an HTTPS origin');
});
test('foreign, public, stopped and inconsistent task/ENI readbacks refuse',()=>{
 const variants=[
  f=>{f.task.startedBy='foreign';},f=>{f.task.containers[0].imageDigest='sha256:'+'0'.repeat(64);},
  f=>{f.task.lastStatus='STOPPED';},f=>{f.task.attachments.push(structuredClone(f.task.attachments[0]));},
  f=>{f.task.attachments[0].details[0].value='eni-00000000';},
  f=>{f.task.attachments[0].details.push({name:'subnetId',value:f.network.subnetId});},
  f=>{f.task.attachments[0].details[2].value='10.40.1.43';},
  f=>{f.networkInterface.VpcId='vpc-00000000';},f=>{f.networkInterface.Association={PublicIp:'1.2.3.4'};},
  f=>{f.networkInterface.Groups=[{GroupId:'sg-00000000'}];},
  f=>{f.networkInterface.PrivateIpAddress='8.8.8.8';f.task.attachments[0].details[2].value='8.8.8.8';},
  f=>{f.network.securityGroupIds=['sg-abcd1234','sg-12345678'];},f=>{f.now=()=>f.original.expiresAtMs;},
  f=>{f.now=()=>NaN;}
 ];
 for(const change of variants){const f=fixture();change(f);assert.throws(()=>observeOriginalTaskNetworkCandidate(f),/TASK_ROUTE_REFUSED/);}
});
test('network reader asks both adopted SDKs for the admitted task and only its observed ENI',async()=>{
 const f=fixture(),calls=[];
 const ecsClient={async send(command,{abortSignal}){assert.equal(abortSignal.aborted,false);calls.push(['ecs',command.constructor.name,command.input]);return {tasks:[f.task]};}};
 const ec2Client={async send(command,{abortSignal}){assert.equal(abortSignal.aborted,false);calls.push(['ec2',command.constructor.name,command.input]);return {NetworkInterfaces:[f.networkInterface]};}};
 const reader=await createTaskRouterNetworkReader({ecsClient,ec2Client,network:f.network,now:f.now});
 const observed=await reader.observe({original:f.original,resource:f.resource,signal:new AbortController().signal,check:()=>{}});
 assert.equal(observed.networkInterfaceId,'eni-abcdef01');
 assert.deepEqual(calls,[['ecs','DescribeTasksCommand',{cluster:clusterArn,tasks:[taskArn],include:['TAGS']}],['ec2','DescribeNetworkInterfacesCommand',{NetworkInterfaceIds:['eni-abcdef01']}]]);
});
