import test from 'node:test';
import assert from 'node:assert/strict';
import {createProductServiceTaskLeaseReader} from './service-task-leases.mjs';

const NOW=1900000000000,prefix='arn:aws:ecs:us-east-1:967807252336:',clusterArn=prefix+'cluster/capiro-dev';
const refused=/PRODUCT_SERVICE_TASK_LEASE_UNAVAILABLE/;
function fixture(){
 let at=NOW,taskChange=value=>value,networkChange=value=>value;
 const calls=[];
 const makePin=(role,digit)=>({clusterArn,taskArn:prefix+'task/capiro-dev/'+digit.repeat(32),
  taskDefinitionArn:prefix+'task-definition/meri-'+role+':4',serviceName:'meri-'+role,containerName:role,
  imageDigest:'sha256:'+digit.repeat(64),createdAtMs:NOW-10000,vpcId:'vpc-123456789abcdef01',
  subnetId:'subnet-123456789abcdef01',securityGroupIds:['sg-'+digit.repeat(17)]});
 const owner=makePin('owner','1'),proxy=makePin('proxy','2');
 const task=(pin,index)=>({taskArn:pin.taskArn,clusterArn,taskDefinitionArn:pin.taskDefinitionArn,
  group:'service:'+pin.serviceName,createdAt:new Date(pin.createdAtMs),launchType:'FARGATE',platformFamily:'Linux',
  platformVersion:'1.4.0',enableExecuteCommand:false,lastStatus:'RUNNING',desiredStatus:'RUNNING',
  containers:[{name:pin.containerName,taskArn:pin.taskArn,lastStatus:'RUNNING',imageDigest:pin.imageDigest,
   image:'synthetic.invalid/meri@'+pin.imageDigest,
   containerArn:prefix+'container/capiro-dev/'+pin.taskArn.split('/').at(-1)+'/11111111-1111-4111-8111-111111111111',
   networkInterfaces:[{privateIpv4Address:'10.40.4.'+index}]}],
  attachments:[{type:'ElasticNetworkInterface',status:'ATTACHED',details:[
   {name:'networkInterfaceId',value:'eni-'+String(index).repeat(17)},
   {name:'subnetId',value:pin.subnetId},{name:'privateIPv4Address',value:'10.40.4.'+index}]}]});
 const network=(pin,index)=>({NetworkInterfaceId:'eni-'+String(index).repeat(17),VpcId:pin.vpcId,SubnetId:pin.subnetId,
  PrivateIpAddress:'10.40.4.'+index,OwnerId:'967807252336',Status:'in-use',Attachment:{Status:'attached'},
  Groups:pin.securityGroupIds.map(GroupId=>({GroupId})),PrivateIpAddresses:[{PrivateIpAddress:'10.40.4.'+index,Primary:true}],Ipv6Addresses:[]});
 const configuration={ecsClient:{async send(command,options){calls.push({service:'ecs',command,options});
   return taskChange({tasks:[task(proxy,2),task(owner,1)],failures:[]});}},
  ec2Client:{async send(command,options){calls.push({service:'ec2',command,options});
   return networkChange({NetworkInterfaces:[network(proxy,2),network(owner,1)]});}},
  configuration:{schemaVersion:1,deploymentRevision:'reviewed-deployment-v4',expiresAtMs:NOW+60000,
   ownerCertSha256:'a'.repeat(64),proxyCertSha256:'b'.repeat(64),owner,proxy},
  now:()=>at,limits:{maxRequestMs:1000,maxLeaseMs:30000},enabled:true};
 return {configuration,calls,make:()=>createProductServiceTaskLeaseReader(configuration),
  read:()=>({deadlineMs:NOW+45000}),advance:ms=>{at+=ms;},setTasks:fn=>{taskChange=fn;},setNetworks:fn=>{networkChange=fn;}};
}

test('disabled default has no AWS calls and does not accept caller task/IP claims',async()=>{
 const f=fixture();delete f.configuration.enabled;const reader=await f.make();
 assert.equal(reader.available,false);await assert.rejects(reader.read(f.read()),refused);assert.equal(f.calls.length,0);
 const g=fixture(),enabled=await g.make();
 await assert.rejects(enabled.read({...g.read(),proxyTaskArn:g.configuration.configuration.proxy.taskArn}),refused);
 await assert.rejects(enabled.read({...g.read(),ownerPrivateIpv4Address:'10.40.4.1'}),refused);
 assert.equal(g.calls.length,0);
});

test('fresh exact service task and ENI joins return only the closed pinned lease',async()=>{
 const f=fixture(),reader=await f.make(),first=await reader.read(f.read());
 assert.deepEqual(first,{schemaVersion:1,deploymentRevision:'reviewed-deployment-v4',
  ownerTaskArn:f.configuration.configuration.owner.taskArn,proxyTaskArn:f.configuration.configuration.proxy.taskArn,
  ownerPrivateIpv4Address:'10.40.4.1',proxyPrivateIpv4Address:'10.40.4.2',
  ownerCertSha256:'a'.repeat(64),proxyCertSha256:'b'.repeat(64),checkedAtMs:NOW,expiresAtMs:NOW+30000});
 assert.equal(Object.isFrozen(first),true);assert.equal(reader.available,true);
 assert.deepEqual(f.calls[0].command.input,{cluster:clusterArn,
  tasks:[f.configuration.configuration.owner.taskArn,f.configuration.configuration.proxy.taskArn],include:['TAGS']});
 assert.equal(f.calls[0].command.constructor.name,'DescribeTasksCommand');
 assert.deepEqual(f.calls[1].command.input,{NetworkInterfaceIds:['eni-'+'1'.repeat(17),'eni-'+'2'.repeat(17)]});
 assert.equal(f.calls[1].command.constructor.name,'DescribeNetworkInterfacesCommand');
 assert.ok(f.calls.every(call=>call.options.abortSignal instanceof AbortSignal));
 f.advance(10);const second=await reader.read(f.read());
 assert.equal(second.checkedAtMs,NOW+10);assert.equal(f.calls.length,4);
 assert.equal(JSON.stringify(first).includes('imageDigest'),false);assert.equal(JSON.stringify(first).includes('credential'),false);
});

test('constructor snapshots reviewed pins and original expiry; request deadline also caps lease',async()=>{
 const f=fixture();f.configuration.configuration.expiresAtMs=NOW+1500;
 const reader=await f.make();f.configuration.configuration.owner.taskArn=prefix+'task/capiro-dev/'+'9'.repeat(32);
 f.configuration.configuration.expiresAtMs=NOW+60000;
 // Response fixtures deliberately follow the mutable source; a changed task is refused.
 await assert.rejects(reader.read(f.read()),refused);
 const g=fixture();g.configuration.configuration.expiresAtMs=NOW+1500;const original=await g.make();
 assert.equal((await original.read(g.read())).expiresAtMs,NOW+1500);
 assert.equal((await original.read({deadlineMs:NOW+300})).expiresAtMs,NOW+300);
});

for(const [label,change] of [
 ['foreign task',task=>{task.taskArn=prefix+'task/capiro-dev/'+'9'.repeat(32);}],
 ['foreign cluster',task=>{task.clusterArn=prefix+'cluster/foreign';}],
 ['foreign task definition',task=>{task.taskDefinitionArn=prefix+'task-definition/meri-owner:5';}],
 ['wrong service group',task=>{task.group='meri:invented-execution';}],
 ['changed creation time',task=>{task.createdAt=new Date(NOW-9999);}],
 ['task pending',task=>{task.lastStatus='PENDING';}],
 ['desired stopped',task=>{task.desiredStatus='STOPPED';}],
 ['execute command enabled',task=>{task.enableExecuteCommand=true;}],
 ['wrong image',task=>{task.containers[0].imageDigest='sha256:'+'c'.repeat(64);}],
 ['unbound image URI',task=>{task.containers[0].image='synthetic.invalid/meri:latest';}],
 ['container stopped',task=>{task.containers[0].lastStatus='STOPPED';}],
 ['duplicate container',task=>{task.containers.push({...task.containers[0]});}],
 ['foreign container ARN',task=>{task.containers[0].containerArn=prefix+'container/foreign/1111';}],
 ['ambiguous ENI detail',task=>{task.attachments[0].details.push({name:'networkInterfaceId',value:'eni-'+'3'.repeat(17)});}],
 ['unattached ENI',task=>{task.attachments[0].status='DETACHED';}],
 ['container IP mismatch',task=>{task.containers[0].networkInterfaces[0].privateIpv4Address='10.40.4.9';}],
])test(`${label} is refused before ENI lookup`,async()=>{
 const f=fixture();f.setTasks(result=>{change(result.tasks[1]);return result;});const reader=await f.make();
 await assert.rejects(reader.read(f.read()),refused);assert.equal(f.calls.length,1);assert.equal(reader.available,true);
});

for(const [label,change] of [
 ['foreign VPC',network=>{network.VpcId='vpc-99999999999999999';}],
 ['foreign subnet',network=>{network.SubnetId='subnet-99999999999999999';}],
 ['foreign account',network=>{network.OwnerId='111111111111';}],
 ['foreign primary IP',network=>{network.PrivateIpAddress='10.40.4.9';}],
 ['extra security group',network=>{network.Groups.push({GroupId:'sg-99999999999999999'});}],
 ['duplicate security group',network=>{network.Groups.push({...network.Groups[0]});}],
 ['not attached',network=>{network.Attachment.Status='detached';}],
 ['public address',network=>{network.Association={PublicIp:'203.0.113.10'};}],
 ['secondary public address',network=>{network.PrivateIpAddresses[0].Association={PublicIp:'203.0.113.10'};}],
 ['public IPv6',network=>{network.Ipv6Addresses=[{Ipv6Address:'2001:db8::1'}];}],
])test(`ENI ${label} is refused`,async()=>{
 const f=fixture();f.setNetworks(result=>{change(result.NetworkInterfaces[1]);return result;});const reader=await f.make();
 await assert.rejects(reader.read(f.read()),refused);assert.equal(f.calls.length,2);
});

test('missing/ambiguous task or ENI responses never make a lease',async()=>{
 for(const kind of ['missing task','duplicate task','task failure','missing ENI','duplicate ENI']){
  const f=fixture();
  f.setTasks(result=>{
   if(kind==='missing task')result.tasks.pop();
   if(kind==='duplicate task')result.tasks[0]=result.tasks[1];
   if(kind==='task failure')result.failures=[{reason:'MISSING'}];return result;
  });
  f.setNetworks(result=>{
   if(kind==='missing ENI')result.NetworkInterfaces.pop();
   if(kind==='duplicate ENI')result.NetworkInterfaces[0]=result.NetworkInterfaces[1];return result;
  });
  await assert.rejects((await f.make()).read(f.read()),refused);
 }
});

test('complete AWS denial is content-free and a later fresh read can succeed',async()=>{
 const f=fixture();f.setTasks(()=>{throw Error('private provider detail must not escape');});const reader=await f.make();
 await assert.rejects(reader.read(f.read()),error=>error.message==='PRODUCT_SERVICE_TASK_LEASE_UNAVAILABLE'&&error.cause===undefined);
 assert.equal(reader.available,true);f.setTasks(value=>value);await reader.read(f.read());assert.equal(f.calls.length,3);
});

test('pre-cancellation/expiry and clock reversal refuse without reusable observation',async()=>{
 const f=fixture(),reader=await f.make(),controller=new AbortController();controller.abort();
 await assert.rejects(reader.read({...f.read(),signal:controller.signal}),refused);assert.equal(f.calls.length,0);
 f.setTasks(result=>{f.advance(-1);return result;});await assert.rejects(reader.read(f.read()),refused);assert.equal(f.calls.length,1);
 const g=fixture();g.configuration.configuration.expiresAtMs=NOW;const expired=await g.make();
 await assert.rejects(expired.read(g.read()),refused);assert.equal(g.calls.length,0);
});

test('unresolved AWS send quarantines reader even if its late result eventually arrives',async()=>{
 for(const service of ['ecs','ec2']){
  const f=fixture();f.configuration.limits.maxRequestMs=20;let resolve;
  f.configuration[service+'Client'].send=()=>new Promise(done=>{resolve=done;});
  const reader=await f.make();await assert.rejects(reader.read(f.read()),refused);
  assert.equal(reader.available,false);const count=f.calls.length;
  resolve(service==='ecs'?{tasks:[],failures:[]}:{NetworkInterfaces:[]});await new Promise(done=>setImmediate(done));
  await assert.rejects(reader.read(f.read()),refused);assert.equal(f.calls.length,count);assert.equal(reader.available,false);
 }
});

test('configuration refuses same peers, certs, public/ambiguous pins and unbounded lifetimes',async()=>{
 for(const change of [
  c=>{c.configuration.proxy.taskArn=c.configuration.owner.taskArn;},
  c=>{c.configuration.proxy.serviceName=c.configuration.owner.serviceName;},
  c=>{c.configuration.proxyCertSha256=c.configuration.ownerCertSha256;},
  c=>{c.configuration.proxy.vpcId='vpc-99999999999999999';},
  c=>{c.configuration.owner.securityGroupIds.push(c.configuration.owner.securityGroupIds[0]);},
  c=>{c.configuration.owner.taskArn='arn:aws:ecs:us-west-2:967807252336:task/capiro-dev/'+'1'.repeat(32);},
  c=>{c.configuration.extra='caller supplied';},c=>{c.limits.maxLeaseMs=30001;},c=>{c.limits.maxRequestMs=3001;},
 ]){const f=fixture();change(f.configuration);await assert.rejects(f.make(),refused);assert.equal(f.calls.length,0);}
});
