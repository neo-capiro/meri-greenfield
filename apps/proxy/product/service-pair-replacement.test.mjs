import test from 'node:test';
import assert from 'node:assert/strict';
import {createProductServicePairDiscovery} from './service-pair-discovery.mjs';
import {createProductServiceTaskLeaseReader} from './service-task-leases.mjs';
import {servicePairFixture,PAIR_NOW as NOW} from './test/service-pair-fixture.mjs';

// Every observation is an SDK fixture. Production discovery and generation
// ownership run unchanged; no AWS call or task stop is performed.
function replacementFixture({rolling=false,missingPending=false,sparsePending=false}={}){
 const f=servicePairFixture();let state='stable';const changes=new Map();
 const nextId=f.id('proxy').replace(/2{32}$/u,'3'.repeat(32));
 const deployment=rolling?'ecs-svc/3':'ecs-svc/2';
 const nextTask=task=>{
  const row=structuredClone(task);row.taskArn=nextId;row.createdAt=new Date(NOW-9999);row.startedBy=deployment;
  for(const c of row.containers){c.taskArn=nextId;if(c.containerArn)c.containerArn=c.containerArn.replace('2'.repeat(32),'3'.repeat(32));
   if(c.networkInterfaces)c.networkInterfaces[0].privateIpv4Address='10.40.4.3';}
  for(const d of row.attachments[0].details){if(d.name==='networkInterfaceId')d.value='eni-33333333';if(d.name==='privateIPv4Address')d.value='10.40.4.3';}
  return row;
 };
 const transform=(kind,fn)=>f.change(kind,(reply,input)=>{
  const changed=fn(reply,input);return changes.has(kind)?changes.get(kind)(changed,input):changed;
 });
 transform('DescribeTaskDefinitionCommand',reply=>reply);
 transform('DescribeServicesCommand',reply=>{
  for(const s of reply.services){s.deploymentController={type:'ECS'};s.deploymentConfiguration={strategy:'ROLLING',maximumPercent:200,minimumHealthyPercent:100};}
  const s=reply.services.find(v=>v.serviceArn===f.pins.proxy.serviceArn),d=s.deployments[0];
  if(state==='gap'||['PROVISIONING','PENDING','ACTIVATING'].includes(state)){
   s.runningCount=d.runningCount=0;s.pendingCount=d.pendingCount=state==='gap'?0:1;
   if(rolling){d.id=deployment;d.rolloutState='IN_PROGRESS';}
  }
  if(state==='rolling'){
   s.runningCount=2;d.id=deployment;d.rolloutState='IN_PROGRESS';
   s.deployments.push({...d,id:'ecs-svc/2',status:'ACTIVE',desiredCount:0,rolloutState:'COMPLETED'});
  }
  if(state==='replaced'){d.id=deployment;d.rolloutState='IN_PROGRESS';}
  return reply;
 });
 transform('ListTasksCommand',(reply,input)=>{
  if(input.serviceName!=='meri-proxy')return reply;
  return {taskArns:state==='gap'?[]:state==='stable'?[f.id('proxy')]:state==='rolling'?[f.id('proxy'),nextId]:[nextId]};
 });
 transform('DescribeTasksCommand',(reply,input)=>{
  const old=reply.tasks.find(v=>v.taskArn===f.id('proxy')),next=nextTask(old);
  if(['PROVISIONING','PENDING','ACTIVATING'].includes(state)){
   next.lastStatus=state;next.containers[1].lastStatus=state;
   if(missingPending){delete next.containers[1].imageDigest;delete next.containers[1].containerArn;
    delete next.containers[1].networkInterfaces;next.attachments=[];}
   if(sparsePending){for(const key of ['createdAt','launchType','platformFamily','platformVersion','enableExecuteCommand','containers','attachments','overrides'])delete next[key];}
  }
  return {...reply,tasks:[...reply.tasks,next].filter(v=>input.tasks.includes(v.taskArn))};
 });
 transform('DescribeNetworkInterfacesCommand',(reply,input)=>{
  const next=structuredClone(reply.NetworkInterfaces.find(v=>v.NetworkInterfaceId==='eni-22222222'));
  next.NetworkInterfaceId='eni-33333333';next.PrivateIpAddress=next.PrivateIpAddresses[0].PrivateIpAddress='10.40.4.3';
  return {NetworkInterfaces:[...reply.NetworkInterfaces,next].filter(v=>input.NetworkInterfaceIds.includes(v.NetworkInterfaceId))};
 });
 return {...f,nextId,setState:value=>{state=value;},change:(kind,fn)=>changes.set(kind,fn)};
}

for(const [label,states,options]of [
 ['StopTask',['gap','PROVISIONING','PENDING','ACTIVATING'],{}],
 ['StopTask with pending metadata not yet returned',['gap','PENDING'],{missingPending:true}],
 ['StopTask with sparse provisioning metadata',['gap','PROVISIONING','PENDING'],{sparsePending:true}],
 ['force-new-deployment',['rolling'],{rolling:true}],
])test(label+' re-proves the pinned partner exactly once under ROLLING 200/100 without retirement',async()=>{
 const f=replacementFixture(options),health=[],closures=[];let mono=0;
 const reader=await createProductServiceTaskLeaseReader(f.configuration,{monotonicNow:()=>mono,
  telemetry:{health:(...row)=>health.push(row)},writeDiagnostic:()=>{}});
 reader.subscribe(reason=>closures.push(reason));
 try{
  const initial=await reader.read({deadlineMs:NOW+1000});
  for(const state of states){
   f.setState(state);mono+=1000;
   await assert.rejects(reader.read({deadlineMs:NOW+1000}),{code:'PAIR_UNAVAILABLE'});
   assert.equal(reader.generation,1,'a transient observation issues no new generation');
   assert.equal(reader.current(),initial,'a transient observation issues no new lease');
   assert.equal(reader.available,true);assert.equal(reader.retired,false);
  }
  f.setState('replaced');mono+=1000;
  const next=await reader.read({deadlineMs:NOW+1000});assert.equal(next.generation,2);assert.equal(next.proxyTaskArn,f.nextId);
  assert.equal(reader.reproving,true);assert.deepEqual(closures,['replacement']);
  const bind=()=>reader.proveConnection({generation:2,localAddress:next.ownerPrivateIpv4Address,
   remoteAddress:next.proxyPrivateIpv4Address,handshakeAtMonoMs:mono,deadlineMs:NOW+1000});
  const bound=await bind();assert.equal(reader.assertConnection(bound).generation,2);await bind();
  assert.deepEqual(health,[['pair','reproven','PAIR_REPROVEN']]);assert.equal(reader.retired,false);
  assert.equal(reader.available,true);assert.equal(closures.filter(v=>v==='retired').length,0);
 }finally{await reader.close();}
});

test('O104 one RUNNING pinned partner under PRIMARY IN_PROGRESS passes with the pin flag false',async()=>{
 const f=replacementFixture();f.setState('replaced');assert.equal(f.pins.proxy.allowPrimaryInProgress,undefined);
 const reader=await createProductServicePairDiscovery(f.configuration);
 assert.equal((await reader.read({deadlineMs:NOW+1000})).proxy.taskArn,f.nextId);
});

for(const [label,kind,mutate]of [
 ['task definition','DescribeTasksCommand',v=>{v.tasks.find(t=>t.group==='service:meri-proxy').taskDefinitionArn='foreign';}],
 ['image digest','DescribeTasksCommand',v=>{v.tasks.find(t=>t.group==='service:meri-proxy').containers[1].imageDigest='sha256:'+'f'.repeat(64);}],
 ['image URI','DescribeTasksCommand',v=>{v.tasks.find(t=>t.group==='service:meri-proxy').containers[1].image='unapproved:latest';}],
 ['task role','DescribeTasksCommand',v=>{v.tasks.find(t=>t.group==='service:meri-proxy').overrides.taskRoleArn='foreign';}],
 ['execution role','DescribeTaskDefinitionCommand',v=>{v.taskDefinition.executionRoleArn='foreign';}],
 ['service membership','DescribeTasksCommand',v=>{v.tasks.find(t=>t.group==='service:meri-proxy').group='service:foreign';}],
 ['subnet','DescribeTasksCommand',v=>{v.tasks.find(t=>t.group==='service:meri-proxy').attachments[0].details.find(d=>d.name==='subnetId').value='subnet-99999999';}],
 ['security group','DescribeNetworkInterfacesCommand',v=>{v.NetworkInterfaces.find(n=>n.NetworkInterfaceId!=='eni-11111111').Groups=[{GroupId:'sg-99999999'}];}],
 ['public IP','DescribeNetworkInterfacesCommand',v=>{v.NetworkInterfaces.find(n=>n.NetworkInterfaceId!=='eni-11111111').Association={PublicIp:'203.0.113.1'};}],
 ['draining deployment revision','DescribeServicesCommand',v=>{const s=v.services.find(s=>s.serviceName==='meri-proxy');s.deployments.push({...s.deployments[0],id:'ecs-svc/99',status:'INACTIVE',desiredCount:0,runningCount:0,pendingCount:0,taskDefinition:'foreign'});}],
 ['own service gap','DescribeServicesCommand',v=>{const s=v.services.find(s=>s.serviceName==='meri-owner');s.runningCount=s.deployments[0].runningCount=0;}],
])for(const state of ['PENDING','rolling'])test('partner '+state+' cannot hide '+label+' drift',async()=>{
 const f=replacementFixture({rolling:true});f.setState(state);f.change(kind,v=>{mutate(v);return v;});
 const reader=await createProductServicePairDiscovery(f.configuration);
 await assert.rejects(reader.read({deadlineMs:NOW+1000}),{code:'PAIR_DRIFT'});
});

test('an absent partner member cannot hide own task or network drift',async()=>{
 for(const [kind,mutate]of [
  ['DescribeTasksCommand',v=>{v.tasks[0].taskDefinitionArn='foreign';}],
  ['DescribeNetworkInterfacesCommand',v=>{v.NetworkInterfaces[0].Association={PublicIp:'203.0.113.1'};}],
 ]){
  const f=replacementFixture();f.setState('gap');f.change(kind,v=>{mutate(v);return v;});
  await assert.rejects((await createProductServicePairDiscovery(f.configuration)).read({deadlineMs:NOW+1000}),{code:'PAIR_DRIFT'});
 }
});

test('a partner with no RUNNING listed member remains unavailable even before service counts catch up',async()=>{
 const f=replacementFixture();f.change('ListTasksCommand',(v,input)=>input.serviceName==='meri-proxy'?{taskArns:[]}:v);
 const reader=await createProductServicePairDiscovery(f.configuration);
 await assert.rejects(reader.read({deadlineMs:NOW+1000}),{code:'PAIR_UNAVAILABLE'});
});

for(const desired of [0,1])test('pinned rolling overlap with stale aggregate counts and drainer desired '+desired+' is unavailable',async()=>{
 const f=replacementFixture({rolling:true});f.setState('rolling');
 f.change('DescribeServicesCommand',reply=>{const s=reply.services.find(v=>v.serviceName==='meri-proxy');
  s.runningCount=1;s.deployments[1].desiredCount=desired;return reply;});
 await assert.rejects((await createProductServicePairDiscovery(f.configuration)).read({deadlineMs:NOW+1000}),{code:'PAIR_UNAVAILABLE'});
});

test('O104 a quiet same-revision ACTIVE deployment does not delay the sole RUNNING PRIMARY proof',async()=>{
 const f=replacementFixture({rolling:true});f.setState('replaced');
 f.change('DescribeServicesCommand',reply=>{const s=reply.services.find(v=>v.serviceName==='meri-proxy');
  s.deployments.push({...s.deployments[0],id:'ecs-svc/2',status:'ACTIVE',desiredCount:1,runningCount:0,rolloutState:'COMPLETED'});return reply;});
 assert.equal((await (await createProductServicePairDiscovery(f.configuration)).read({deadlineMs:NOW+1000})).proxy.taskArn,f.nextId);
});

for(const [label,mutate]of [
 ['public container address without an ENI',row=>{row.attachments=[];row.containers[1].networkInterfaces=[{privateIpv4Address:'203.0.113.8'}];}],
 ['explicit public container address',row=>{row.attachments=[];row.containers[1].networkInterfaces=[{privateIpv4Address:'10.40.4.3',publicIpv4Address:'203.0.113.8'}];}],
 ['public attachment detail',row=>{row.attachments[0].details.push({name:'publicIPv4Address',value:'203.0.113.8'});}],
])test('pending partner cannot hide '+label,async()=>{
 const f=replacementFixture();f.setState('PENDING');f.change('DescribeTasksCommand',reply=>{
  mutate(reply.tasks.find(v=>v.group==='service:meri-proxy'));return reply;});
 await assert.rejects((await createProductServicePairDiscovery(f.configuration)).read({deadlineMs:NOW+1000}),{code:'PAIR_DRIFT'});
});

for(const [label,before,after,options]of [
 ['StopTask gap','stable','gap',{}],
 ['rolling drain','rolling','replaced',{rolling:true}],
])test(label+' during the final proof phase is unavailable without retiring the survivor',async()=>{
 const f=replacementFixture(options),health=[];
 const reader=await createProductServiceTaskLeaseReader(f.configuration,{monotonicNow:()=>0,
  telemetry:{health:(...row)=>health.push(row)},writeDiagnostic:()=>{}});
 try{
  const initial=await reader.read({deadlineMs:NOW+1000});f.setState(before);
  f.change('DescribeNetworkInterfacesCommand',reply=>{f.setState(after);return reply;});
  await assert.rejects(reader.read({deadlineMs:NOW+1000}),{code:'PAIR_UNAVAILABLE'});
  assert.equal(reader.current(),initial);assert.equal(reader.generation,1);assert.equal(reader.retired,false);
  assert.deepEqual(health,[]);
 }finally{await reader.close();}
});
