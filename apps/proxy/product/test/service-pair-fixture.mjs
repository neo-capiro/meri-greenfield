/** Scripted SDK data only: no client factory, task, network or credentials. */
export const PAIR_NOW=1900000000000,PAIR_PREFIX='arn:aws:ecs:us-east-1:967807252336:';
export function servicePairFixture({now=PAIR_NOW}={}){
 let at=now;const calls=[],changes=new Map(),ids={owner:'1',proxy:'2'};
 const clusterArn=PAIR_PREFIX+'cluster/capiro-dev';
 const pin=(role,digit)=>({clusterArn,serviceArn:PAIR_PREFIX+'service/capiro-dev/meri-'+role,
  taskDefinitionArn:PAIR_PREFIX+'task-definition/meri-'+role+':4',containerName:role,
  imageUri:'967807252336.dkr.ecr.us-east-1.amazonaws.com/meri-'+role+'@sha256:'+digit.repeat(64),
  taskRoleArn:'arn:aws:iam::967807252336:role/meri-'+role,executionRoleArn:'arn:aws:iam::967807252336:role/meri-execution',
  vpcId:'vpc-12345678',subnetIds:['subnet-12345678'],securityGroupIds:['sg-'+digit.repeat(8)]});
 const owner=pin('owner','1'),proxy=pin('proxy','2');
 const id=role=>PAIR_PREFIX+'task/capiro-dev/'+ids[role].repeat(32);
 const service=role=>{const p=pins[role];return {serviceArn:p.serviceArn,serviceName:'meri-'+role,clusterArn,status:'ACTIVE',
  taskDefinition:p.taskDefinitionArn,desiredCount:1,runningCount:1,pendingCount:0,launchType:'FARGATE',platformVersion:'1.4.0',enableExecuteCommand:false,
  deployments:[{id:'ecs-svc/'+(role==='owner'?'1':'2'),status:'PRIMARY',taskDefinition:p.taskDefinitionArn,desiredCount:1,runningCount:1,pendingCount:0,rolloutState:'COMPLETED'}],
  networkConfiguration:{awsvpcConfiguration:{assignPublicIp:'DISABLED',subnets:p.subnetIds,securityGroups:p.securityGroupIds}}};};
 const definition=role=>{const p=pins[role];return {taskDefinitionArn:p.taskDefinitionArn,status:'ACTIVE',networkMode:'awsvpc',requiresCompatibilities:['FARGATE'],
  taskRoleArn:p.taskRoleArn,executionRoleArn:p.executionRoleArn,containerDefinitions:[{name:p.containerName,image:p.imageUri,essential:true}]};};
 const task=role=>{const p=pins[role],index=role==='owner'?1:2;return {taskArn:id(role),clusterArn,taskDefinitionArn:p.taskDefinitionArn,
  group:'service:meri-'+role,startedBy:'ecs-svc/'+index,createdAt:new Date(now-10000),launchType:'FARGATE',platformFamily:'Linux',platformVersion:'1.4.0',
  enableExecuteCommand:false,lastStatus:'RUNNING',desiredStatus:'RUNNING',overrides:{containerOverrides:[{name:role}]},
  containers:[{name:role,taskArn:id(role),lastStatus:'RUNNING',image:p.imageUri,imageDigest:p.imageUri.split('@')[1],
   containerArn:PAIR_PREFIX+'container/capiro-dev/'+ids[role].repeat(32)+'/11111111-1111-4111-8111-111111111111',networkInterfaces:[{privateIpv4Address:'10.40.4.'+index}]}],
  attachments:[{type:'ElasticNetworkInterface',status:'ATTACHED',details:[{name:'networkInterfaceId',value:'eni-'+String(index).repeat(8)},
   {name:'subnetId',value:p.subnetIds[0]},{name:'privateIPv4Address',value:'10.40.4.'+index}]}]};};
 const network=role=>{const p=pins[role],index=role==='owner'?1:2;return {NetworkInterfaceId:'eni-'+String(index).repeat(8),VpcId:p.vpcId,SubnetId:p.subnetIds[0],
  PrivateIpAddress:'10.40.4.'+index,OwnerId:'967807252336',Status:'in-use',Attachment:{Status:'attached'},Groups:p.securityGroupIds.map(GroupId=>({GroupId})),
  PrivateIpAddresses:[{PrivateIpAddress:'10.40.4.'+index,Primary:true}],Ipv6Addresses:[]};};
 const pins={schemaVersion:2,deploymentRevision:'reviewed-deployment-v4',expiresAtMs:now+60000,ownerCertSha256:'a'.repeat(64),proxyCertSha256:'b'.repeat(64),owner,proxy};
 async function send(command,options){
  const kind=command.constructor.name,input=command.input;calls.push({kind,input,options});let result;
  if(kind==='DescribeServicesCommand')result={services:[service('proxy'),service('owner')],failures:[]};
  else if(kind==='ListTasksCommand')result={taskArns:[id(input.serviceName==='meri-owner'?'owner':'proxy')]};
  else if(kind==='DescribeTaskDefinitionCommand')result={taskDefinition:definition(input.taskDefinition===owner.taskDefinitionArn?'owner':'proxy')};
  else if(kind==='DescribeTasksCommand')result={tasks:[task('proxy'),task('owner')],failures:[]};
  else if(kind==='DescribeNetworkInterfacesCommand')result={NetworkInterfaces:[network('proxy'),network('owner')]};
  else throw Error('unknown synthetic command');
  return changes.has(kind)?changes.get(kind)(structuredClone(result),input):structuredClone(result);
 }
 const configuration={ecsClient:{send},ec2Client:{send},configuration:pins,now:()=>at,limits:{maxRequestMs:1000,maxLeaseMs:30000},enabled:true};
 return {configuration,pins,calls,id,advance:ms=>{at+=ms;},replace:(role,digit)=>{ids[role]=digit;},change:(kind,fn)=>changes.set(kind,fn)};
}
