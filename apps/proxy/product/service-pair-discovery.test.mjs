import test from 'node:test';
import assert from 'node:assert/strict';
import {createProductServicePairDiscovery,parseProductServicePairConfiguration} from './service-pair-discovery.mjs';
import {createProductServiceTaskLeaseReader} from './service-task-leases.mjs';
import {servicePairFixture,PAIR_NOW as NOW,PAIR_PREFIX as prefix} from './test/service-pair-fixture.mjs';
const refused=/PRODUCT_SERVICE_TASK_LEASE_UNAVAILABLE/;
const drift={code:'PAIR_DRIFT'},unavailable={code:'PAIR_UNAVAILABLE'};
const make=f=>createProductServicePairDiscovery(f.configuration),read=r=>r.read({deadlineMs:NOW+50000});
// A refusal before task selection: no task was described and no network read, after the one services read of the first phase.
const noTaskSelected=f=>{const kinds=f.calls.map(c=>c.kind);assert.ok(!kinds.includes('DescribeTasksCommand')&&!kinds.includes('DescribeNetworkInterfacesCommand'),kinds.join());
 assert.ok(kinds.filter(k=>k==='DescribeServicesCommand').length<=1,kinds.join());};
test('default disabled is inert, schema2 is closed and old task/IP pins are refused',async()=>{
 const f=servicePairFixture();delete f.configuration.enabled;const reader=await make(f);assert.equal(reader.available,false);await assert.rejects(read(reader),unavailable);assert.equal(f.calls.length,0);
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
 assert.deepEqual(value,{owner:{taskArn:f.id('owner'),createdAtMs:NOW-10000,privateIpv4Address:'10.40.4.1',networkInterfaceId:'eni-11111111'},
  proxy:{taskArn:f.id('proxy'),createdAtMs:NOW-10000,privateIpv4Address:'10.40.4.2',networkInterfaceId:'eni-22222222'},checkedAtMs:NOW,expiresAtMs:NOW+30000});
 assert.equal(f.calls.length,10);assert.equal(f.calls.filter(c=>c.kind==='DescribeServicesCommand').length,2);assert.equal(f.calls.filter(c=>c.kind==='ListTasksCommand').length,4);
 assert.ok(f.calls.every(c=>c.options.abortSignal instanceof AbortSignal));
 assert.deepEqual(f.calls[1].input,{cluster:f.pins.owner.clusterArn,serviceName:'meri-owner',desiredStatus:'RUNNING',maxResults:100});
 assert.equal((await r.read({deadlineMs:NOW+200})).expiresAtMs,NOW+30000,'proof deadline bounds work, not the renewed lease');
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
 const f=servicePairFixture();f.change('DescribeServicesCommand',v=>{mutate(v.services[1]);return v;});await assert.rejects(read(await make(f)),drift);noTaskSelected(f);
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
 ['image digest mismatch','DescribeTasksCommand',v=>v.tasks[1].containers[1].imageDigest='sha256:'+'f'.repeat(64)],
 ['duplicate container','DescribeTasksCommand',v=>v.tasks[1].containers.push({...v.tasks[1].containers[1]})],
 ['foreign role override','DescribeTasksCommand',v=>v.tasks[1].overrides.taskRoleArn='arn:aws:iam::967807252336:role/foreign'],
 ['command override','DescribeTasksCommand',v=>v.tasks[1].overrides.containerOverrides[1].command=['unsafe']],
 ['init environment override','DescribeTasksCommand',v=>v.tasks[1].overrides.containerOverrides[0].environment=[{name:'X',value:'1'}]],
 ['foreign container override','DescribeTasksCommand',v=>v.tasks[1].overrides.containerOverrides.push({name:'foreign'})],
 ['accelerator override','DescribeTasksCommand',v=>v.tasks[1].overrides.inferenceAcceleratorOverrides=[{deviceName:'x',deviceType:'eia2.medium'}]],
 ['task cpu override','DescribeTasksCommand',v=>v.tasks[1].overrides.cpu='4096'],
 ['detached task ENI','DescribeTasksCommand',v=>v.tasks[1].attachments[0].status='DETACHED'],
 ['duplicate ENI detail','DescribeTasksCommand',v=>v.tasks[1].attachments[0].details.push({...v.tasks[1].attachments[0].details[0]})],
 ['container IP mismatch','DescribeTasksCommand',v=>v.tasks[1].containers[1].networkInterfaces[0].privateIpv4Address='10.40.4.9'],
 ['foreign VPC','DescribeNetworkInterfacesCommand',v=>v.NetworkInterfaces[1].VpcId='vpc-99999999'],
 ['foreign subnet','DescribeNetworkInterfacesCommand',v=>v.NetworkInterfaces[1].SubnetId='subnet-99999999'],
 ['foreign account','DescribeNetworkInterfacesCommand',v=>v.NetworkInterfaces[1].OwnerId='111111111111'],
 ['public address','DescribeNetworkInterfacesCommand',v=>v.NetworkInterfaces[1].Association={PublicIp:'203.0.113.1'}],
 ['public secondary address','DescribeNetworkInterfacesCommand',v=>v.NetworkInterfaces[1].PrivateIpAddresses[0].Association={PublicIp:'203.0.113.1'}],
 ['wrong group','DescribeNetworkInterfacesCommand',v=>v.NetworkInterfaces[1].Groups=[{GroupId:'sg-99999999'}]],
 ['detached ENI','DescribeNetworkInterfacesCommand',v=>v.NetworkInterfaces[1].Attachment.Status='detached'],
 ['IPv6','DescribeNetworkInterfacesCommand',v=>v.NetworkInterfaces[1].Ipv6Addresses=[{Ipv6Address:'2001:db8::1'}]],
])test(label+' cannot produce service proof',async()=>{
 const f=servicePairFixture();f.change(kind,v=>{mutate(v);return v;});await assert.rejects(read(await make(f)),drift);
});
test('service-scoped inventory proves uniqueness across all bounded pages',async()=>{
 for(const mode of ['duplicate','foreign','empty','repeated token','too many pages']){
  const f=servicePairFixture();f.change('ListTasksCommand',v=>mode==='duplicate'?{taskArns:[v.taskArns[0],v.taskArns[0]]}:
   mode==='foreign'?{taskArns:[prefix+'task/foreign/'+'1'.repeat(32)]}:mode==='empty'?{taskArns:[]}:
   {taskArns:[],nextToken:mode==='repeated token'?'same':String(f.calls.length)});
  await assert.rejects(read(await make(f)),mode==='repeated token'||mode==='too many pages'?unavailable:drift);noTaskSelected(f);
 }
 const f=servicePairFixture();f.change('ListTasksCommand',(v,input)=>input.nextToken?v:{taskArns:[],nextToken:'page2'});await read(await make(f));
});
test('membership or PRIMARY drift during proof refuses, without selecting a posted task/IP',async()=>{
 for(const mode of ['task','deployment']){
  const f=servicePairFixture();let count=0;
  if(mode==='task')f.change('ListTasksCommand',(v,input)=>{if(input.serviceName==='meri-owner'&&++count===2)v.taskArns=[f.id('proxy')];return v;});
  else f.change('DescribeServicesCommand',v=>{if(++count===2)v.services[1].deployments[0].id='ecs-svc/99';return v;});
  await assert.rejects(read(await make(f)),drift);
 }
 const f=servicePairFixture(),r=await make(f);await assert.rejects(r.read({deadlineMs:NOW+1000,taskArn:f.id('owner')}),unavailable);assert.equal(f.calls.length,0);
});
test('expiry/cancellation/clock rollback refuse; unresolved SDK quarantines its discovery instance even after late return',async()=>{
 const f=servicePairFixture(),r=await make(f),controller=new AbortController();controller.abort();await assert.rejects(r.read({deadlineMs:NOW+1000,signal:controller.signal}),unavailable);assert.equal(f.calls.length,0);
 f.change('DescribeServicesCommand',v=>{f.advance(-1);return v;});await assert.rejects(read(r),unavailable);
 for(const kind of ['DescribeServicesCommand','DescribeNetworkInterfacesCommand']){
  const g=servicePairFixture();g.configuration.limits.maxRequestMs=20;let complete;g.change(kind,()=>new Promise(resolve=>{complete=resolve;}));const q=await make(g);
  await assert.rejects(read(q),unavailable);assert.equal(q.available,false);complete({});await new Promise(resolve=>setImmediate(resolve));
  const count=g.calls.length;await assert.rejects(read(q),unavailable);assert.equal(g.calls.length,count);assert.equal(q.available,false);
 }
});

test('one discovery runs its independent reads together: 10 calls in four phases, same checks and order of proof',async()=>{
 const f=servicePairFixture(),events=[];let inFlight=0,peak=0;
 for(const kind of ['DescribeServicesCommand','ListTasksCommand','DescribeTaskDefinitionCommand','DescribeTasksCommand','DescribeNetworkInterfacesCommand'])
  f.change(kind,async v=>{events.push('start:'+kind);inFlight++;peak=Math.max(peak,inFlight);await new Promise(resolve=>setTimeout(resolve,5));inFlight--;events.push('end:'+kind);return v;});
 await read(await make(f));
 assert.equal(f.calls.length,10);assert.equal(peak,5,'services, both members and both task definitions at once');
 // A phase is a run of starts before the next end: 5 (services, members, definitions), tasks, network, 3 (services, members).
 const phases=[];let run=0;for(const e of events){if(e.startsWith('start:'))run++;else if(run){phases.push(run);run=0;}}
 assert.deepEqual(phases,[5,1,1,3]);
 const order=events.filter(e=>e.startsWith('start:')).map(e=>e.slice(6));
 assert.deepEqual(order.slice(5,7),['DescribeTasksCommand','DescribeNetworkInterfacesCommand'],'tasks are described after both services and members, the network after the tasks');
});
test('a refusal while other reads of its phase are in flight settles them all first and does not quarantine the reader',async()=>{
 const f=servicePairFixture();let inFlight=0,refuseServices=true;
 f.change('ListTasksCommand',async v=>{inFlight++;await new Promise(resolve=>setTimeout(resolve,20));inFlight--;return v;});
 f.change('DescribeServicesCommand',v=>{if(refuseServices)v.services[1].desiredCount=2;return v;});
 const r=await make(f);await assert.rejects(read(r),drift);
 assert.equal(inFlight,0,'no read of the phase outlives its refusal');assert.equal(r.available,true,'an ordinary refusal is not unknown work');
 refuseServices=false;assert.equal((await read(r)).owner.taskArn,f.id('owner'));
});

test('SDK throttle and missing pages are unavailable; observed contradictions remain drift',async()=>{
 for(const change of [f=>f.change('DescribeServicesCommand',()=>{throw Object.assign(Error('private'),{name:'ThrottlingException'});}),
  f=>f.change('DescribeTasksCommand',()=>({tasks:[]})),f=>f.change('ListTasksCommand',()=>({})),
  f=>f.change('DescribeTaskDefinitionCommand',()=>({}))]){
  const f=servicePairFixture();change(f);await assert.rejects(read(await make(f)),unavailable);
 }
});

test('parallel unavailable reply cannot hide a definitive contradictory observation',async()=>{
 const f=servicePairFixture();
 f.change('DescribeServicesCommand',()=>{throw Error('synthetic throttle');});
 f.change('DescribeTaskDefinitionCommand',reply=>{reply.taskDefinition.containerDefinitions[0].image='unapproved:latest';return reply;});
 await assert.rejects(read(await make(f)),{code:'PAIR_DRIFT'});noTaskSelected(f);
});

const partialReplies=[
 ['services','DescribeServicesCommand','services','serviceArn',(f,role)=>f.pins[role].serviceArn,row=>{row.desiredCount=2;}],
 ['tasks','DescribeTasksCommand','tasks','taskArn',(f,role)=>f.id(role),row=>{row.desiredStatus='STOPPED';}],
 ['ENIs','DescribeNetworkInterfacesCommand','NetworkInterfaces','NetworkInterfaceId',(_f,role)=>role==='owner'?'eni-11111111':'eni-22222222',row=>{row.Association={PublicIp:'203.0.113.1'};}],
];
for(const [label,kind,key,idKey,id,contradict]of partialReplies)for(const role of ['owner','proxy'])
 test('partial '+label+' cannot hide observed '+role+' drift or keep its old lease usable',async()=>{
  for(const mode of label==='ENIs'?['missing']:['missing','failures','both']){
   const f=servicePairFixture(),reader=await createProductServiceTaskLeaseReader(f.configuration,{monotonicNow:()=>0});
   const old=await read(reader);let retired=0;reader.subscribe(reason=>{if(reason==='retired')retired++;});
   try{
    f.change(kind,reply=>{
     const row=reply[key].find(value=>value[idKey]===id(f,role));contradict(row);
     if(mode!=='failures')reply[key]=[row];
     if(mode!=='missing')reply.failures=[{arn:'synthetic-missing-partner',reason:'MISSING'}];
     return reply;
    });
    await assert.rejects(read(reader),drift);assert.equal(reader.available,false);assert.equal(retired,1);
    assert.throws(()=>reader.assertConnection(old),drift,'a definitive observation invalidates the still-fresh lease');
   }finally{await reader.close();}
  }
 });
test('valid partial services, tasks and ENIs remain unavailable and preserve the unexpired lease',async()=>{
 for(const [label,kind,key,idKey,id]of partialReplies)for(const role of ['owner','proxy'])
  for(const mode of label==='ENIs'?['missing']:['missing','failures','both']){
   const f=servicePairFixture(),reader=await createProductServiceTaskLeaseReader(f.configuration,{monotonicNow:()=>0});
   const old=await read(reader);
   try{
    f.change(kind,reply=>{
     if(mode!=='failures')reply[key]=reply[key].filter(row=>row[idKey]===id(f,role));
     if(mode!=='missing')reply.failures=[{arn:'synthetic-missing-partner',reason:'MISSING'}];
     return reply;
    });
    await assert.rejects(read(reader),unavailable);assert.equal(reader.available,true);assert.equal(reader.assertConnection(old),old);
   }finally{await reader.close();}
  }
});
