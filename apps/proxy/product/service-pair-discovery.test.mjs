import test from 'node:test';
import assert from 'node:assert/strict';
import {createProductServicePairDiscovery,parseProductServicePairConfiguration} from './service-pair-discovery.mjs';
import {servicePairFixture,PAIR_NOW as NOW,PAIR_PREFIX as prefix} from './test/service-pair-fixture.mjs';
const refused=/PRODUCT_SERVICE_TASK_LEASE_UNAVAILABLE/;
const make=f=>createProductServicePairDiscovery(f.configuration),read=r=>r.read({deadlineMs:NOW+50000});
test('default disabled is inert, schema2 is closed and old task/IP pins are refused',async()=>{
 const f=servicePairFixture();delete f.configuration.enabled;const reader=await make(f);assert.equal(reader.available,false);await assert.rejects(read(reader),refused);assert.equal(f.calls.length,0);
 for(const mutate of [c=>c.schemaVersion=1,c=>c.owner.taskArn=prefix+'task/capiro-dev/'+'1'.repeat(32),c=>c.owner.createdAtMs=NOW-1,
  c=>c.owner.subnetId='subnet-12345678',c=>c.owner.serviceArn=c.proxy.serviceArn,c=>c.owner.imageUri='synthetic.invalid:latest',
  c=>c.owner.taskRoleArn='arn:aws:iam::111111111111:role/foreign',c=>c.owner.allowPrimaryInProgress='true',c=>c.proxy.vpcId='vpc-99999999',
  c=>c.proxyCertSha256=c.ownerCertSha256,c=>c.owner.securityGroupIds.push(c.owner.securityGroupIds[0])]){
  const g=servicePairFixture();mutate(g.pins);await assert.rejects(make(g),refused);assert.equal(g.calls.length,0);
 }
 const p=parseProductServicePairConfiguration(servicePairFixture().pins);assert.equal(p.owner.allowPrimaryInProgress,false);assert.equal(Object.isFrozen(p.owner.subnetIds),true);
});
test('fresh unique service/taskdef/roles/image/membership/ENI proof is closed and bounded',async()=>{
 const f=servicePairFixture(),r=await make(f),value=await read(r);
 assert.deepEqual(value,{owner:{taskArn:f.id('owner'),createdAtMs:NOW-10000,privateIpv4Address:'10.40.4.1'},
  proxy:{taskArn:f.id('proxy'),createdAtMs:NOW-10000,privateIpv4Address:'10.40.4.2'},checkedAtMs:NOW,expiresAtMs:NOW+30000});
 assert.equal(f.calls.length,10);assert.equal(f.calls.filter(c=>c.kind==='DescribeServicesCommand').length,2);assert.equal(f.calls.filter(c=>c.kind==='ListTasksCommand').length,4);
 assert.ok(f.calls.every(c=>c.options.abortSignal instanceof AbortSignal));
 assert.deepEqual(f.calls[1].input,{cluster:f.pins.owner.clusterArn,serviceName:'meri-owner',desiredStatus:'RUNNING',maxResults:100});
 assert.equal((await r.read({deadlineMs:NOW+200})).expiresAtMs,NOW+200);
 f.pins.expiresAtMs=NOW+1;assert.equal((await read(r)).expiresAtMs,NOW+30000,'caller mutation cannot change captured expiry');
});
for(const [label,mutate]of [
 ['foreign service',s=>s.serviceArn=prefix+'service/capiro-dev/foreign'],['foreign cluster',s=>s.clusterArn=prefix+'cluster/foreign'],
 ['wrong service taskdef',s=>s.taskDefinition=prefix+'task-definition/foreign:1'],['service draining',s=>s.status='DRAINING'],
 ['service scale',s=>s.desiredCount=2],['service pending',s=>s.pendingCount=1],['no running service task',s=>s.runningCount=0],
 ['exec service',s=>s.enableExecuteCommand=true],['unapproved rollout',s=>s.deployments[0].rolloutState='IN_PROGRESS'],
 ['failed rollout',s=>s.deployments[0].rolloutState='FAILED'],['ambiguous primary',s=>s.deployments.push({...s.deployments[0]})],
 ['foreign primary taskdef',s=>s.deployments[0].taskDefinition=prefix+'task-definition/foreign:1'],
 ['active old deployment',s=>s.deployments.push({...s.deployments[0],status:'ACTIVE',id:'ecs-svc/9'})],
 ['public service',s=>s.networkConfiguration.awsvpcConfiguration.assignPublicIp='ENABLED'],
 ['foreign subnet set',s=>s.networkConfiguration.awsvpcConfiguration.subnets=['subnet-99999999']],
])test(label+' refuses before task selection',async()=>{
 const f=servicePairFixture();f.change('DescribeServicesCommand',v=>{mutate(v.services[1]);return v;});await assert.rejects(read(await make(f)),refused);assert.equal(f.calls.length,1);
});
test('in-progress PRIMARY requires explicit false-by-default reviewed pin',async()=>{
 const f=servicePairFixture();f.pins.owner.allowPrimaryInProgress=true;f.change('DescribeServicesCommand',v=>{v.services[1].deployments[0].rolloutState='IN_PROGRESS';return v;});await read(await make(f));
});
for(const [label,kind,mutate]of [
 ['foreign task role','DescribeTaskDefinitionCommand',v=>v.taskDefinition.taskRoleArn='arn:aws:iam::967807252336:role/foreign'],
 ['foreign execution role','DescribeTaskDefinitionCommand',v=>v.taskDefinition.executionRoleArn='arn:aws:iam::967807252336:role/foreign'],
 ['wrong definition image','DescribeTaskDefinitionCommand',v=>v.taskDefinition.containerDefinitions[0].image='unbound:latest'],
 ['wrong network mode','DescribeTaskDefinitionCommand',v=>v.taskDefinition.networkMode='bridge'],
 ['future creation','DescribeTasksCommand',v=>v.tasks[1].createdAt=new Date(NOW+1)],
 ['non-primary task','DescribeTasksCommand',v=>v.tasks[1].startedBy='ecs-svc/99'],
 ['spoofed group','DescribeTasksCommand',v=>v.tasks[1].group='service:foreign'],
 ['pending task','DescribeTasksCommand',v=>v.tasks[1].lastStatus='PENDING'],
 ['desired stop','DescribeTasksCommand',v=>v.tasks[1].desiredStatus='STOPPED'],
 ['exec task','DescribeTasksCommand',v=>v.tasks[1].enableExecuteCommand=true],
 ['foreign task ARN','DescribeTasksCommand',v=>v.tasks[1].taskArn=prefix+'task/capiro-dev/'+'9'.repeat(32)],
 ['image digest mismatch','DescribeTasksCommand',v=>v.tasks[1].containers[0].imageDigest='sha256:'+'f'.repeat(64)],
 ['duplicate container','DescribeTasksCommand',v=>v.tasks[1].containers.push({...v.tasks[1].containers[0]})],
 ['foreign role override','DescribeTasksCommand',v=>v.tasks[1].overrides.taskRoleArn='arn:aws:iam::967807252336:role/foreign'],
 ['command override','DescribeTasksCommand',v=>v.tasks[1].overrides.containerOverrides[0].command=['unsafe']],
 ['detached task ENI','DescribeTasksCommand',v=>v.tasks[1].attachments[0].status='DETACHED'],
 ['duplicate ENI detail','DescribeTasksCommand',v=>v.tasks[1].attachments[0].details.push({...v.tasks[1].attachments[0].details[0]})],
 ['container IP mismatch','DescribeTasksCommand',v=>v.tasks[1].containers[0].networkInterfaces[0].privateIpv4Address='10.40.4.9'],
 ['foreign VPC','DescribeNetworkInterfacesCommand',v=>v.NetworkInterfaces[1].VpcId='vpc-99999999'],
 ['foreign subnet','DescribeNetworkInterfacesCommand',v=>v.NetworkInterfaces[1].SubnetId='subnet-99999999'],
 ['foreign account','DescribeNetworkInterfacesCommand',v=>v.NetworkInterfaces[1].OwnerId='111111111111'],
 ['public address','DescribeNetworkInterfacesCommand',v=>v.NetworkInterfaces[1].Association={PublicIp:'203.0.113.1'}],
 ['public secondary address','DescribeNetworkInterfacesCommand',v=>v.NetworkInterfaces[1].PrivateIpAddresses[0].Association={PublicIp:'203.0.113.1'}],
 ['wrong group','DescribeNetworkInterfacesCommand',v=>v.NetworkInterfaces[1].Groups=[{GroupId:'sg-99999999'}]],
 ['detached ENI','DescribeNetworkInterfacesCommand',v=>v.NetworkInterfaces[1].Attachment.Status='detached'],
 ['IPv6','DescribeNetworkInterfacesCommand',v=>v.NetworkInterfaces[1].Ipv6Addresses=[{Ipv6Address:'2001:db8::1'}]],
])test(label+' cannot produce service proof',async()=>{
 const f=servicePairFixture();f.change(kind,v=>{mutate(v);return v;});await assert.rejects(read(await make(f)),refused);
});
test('service-scoped inventory proves uniqueness across all bounded pages',async()=>{
 for(const mode of ['duplicate','foreign','empty','repeated token','too many pages']){
  const f=servicePairFixture();f.change('ListTasksCommand',v=>mode==='duplicate'?{taskArns:[v.taskArns[0],v.taskArns[0]]}:
   mode==='foreign'?{taskArns:[prefix+'task/foreign/'+'1'.repeat(32)]}:mode==='empty'?{taskArns:[]}:
   {taskArns:[],nextToken:mode==='repeated token'?'same':String(f.calls.length)});
  await assert.rejects(read(await make(f)),refused);assert.ok(f.calls.length<=5);
 }
 const f=servicePairFixture();f.change('ListTasksCommand',(v,input)=>input.nextToken?v:{taskArns:[],nextToken:'page2'});await read(await make(f));
});
test('membership or PRIMARY drift during proof refuses, without selecting a posted task/IP',async()=>{
 for(const mode of ['task','deployment']){
  const f=servicePairFixture();let count=0;
  if(mode==='task')f.change('ListTasksCommand',(v,input)=>{if(input.serviceName==='meri-owner'&&++count===2)v.taskArns=[f.id('proxy')];return v;});
  else f.change('DescribeServicesCommand',v=>{if(++count===2)v.services[1].deployments[0].id='ecs-svc/99';return v;});
  await assert.rejects(read(await make(f)),refused);
 }
 const f=servicePairFixture(),r=await make(f);await assert.rejects(r.read({deadlineMs:NOW+1000,taskArn:f.id('owner')}),refused);assert.equal(f.calls.length,0);
});
test('expiry/cancellation/clock rollback refuse; unresolved SDK permanently quarantines even after late return',async()=>{
 const f=servicePairFixture(),r=await make(f),controller=new AbortController();controller.abort();await assert.rejects(r.read({deadlineMs:NOW+1000,signal:controller.signal}),refused);assert.equal(f.calls.length,0);
 f.change('DescribeServicesCommand',v=>{f.advance(-1);return v;});await assert.rejects(read(r),refused);
 for(const kind of ['DescribeServicesCommand','DescribeNetworkInterfacesCommand']){
  const g=servicePairFixture();g.configuration.limits.maxRequestMs=20;let complete;g.change(kind,()=>new Promise(resolve=>{complete=resolve;}));const q=await make(g);
  await assert.rejects(read(q),refused);assert.equal(q.available,false);complete({});await new Promise(resolve=>setImmediate(resolve));
  const count=g.calls.length;await assert.rejects(read(q),refused);assert.equal(g.calls.length,count);assert.equal(q.available,false);
 }
});
