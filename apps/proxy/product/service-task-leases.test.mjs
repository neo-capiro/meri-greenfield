import test from 'node:test';
import assert from 'node:assert/strict';
import {createProductServiceTaskLeaseReader} from './service-task-leases.mjs';
import {assertProductServiceTaskLease} from './owner-https.mjs';
import {servicePairFixture,PAIR_NOW as NOW} from './test/service-pair-fixture.mjs';

test('canonical lease discovers at startup, snapshots source and reuses a valid held-connection lease',async()=>{
 const f=servicePairFixture(),reader=await createProductServiceTaskLeaseReader(f.configuration,{monotonicNow:()=>0});
 const a=await reader.read({deadlineMs:NOW+1000});
 assert.equal(a.ownerTaskArn,f.id('owner'));assert.equal(a.proxyTaskArn,f.id('proxy'));
 assert.equal(a.owner.networkInterfaceId,'eni-11111111');assert.equal(a.proxy.networkInterfaceId,'eni-22222222');
 assert.equal(a.generation,1);assert.equal(a.checkedAtMonoMs,0);assert.equal(a.expiresAtMonoMs,30000);
 assert.equal(a.expiresAtMs,NOW+30000);
 const count=f.calls.length;f.advance(10);assert.equal(await reader.ensure({deadlineMs:NOW+1000}),a);
 assert.equal(reader.assertConnection(a),a);assert.equal(f.calls.length,count,'a held valid connection does not rediscover');
 assert.equal(Object.isFrozen(a),true);assert.equal(Object.isFrozen(a.proxy),true);assert.equal(JSON.stringify(a).includes('taskRole'),false);
 await reader.close();
});
test('valid replacement closes the old generation; same-ARN creation-time mutation retires',async()=>{
 const f=servicePairFixture(),reader=await createProductServiceTaskLeaseReader(f.configuration,{monotonicNow:()=>0});
 const old=await reader.read({deadlineMs:NOW+1000});let closed=false;
 reader.subscribe((reason,value)=>{assert.equal(reason,'replacement');assert.equal(value,old);assert.throws(()=>reader.current());closed=true;});
 f.replace('proxy','3');const next=await reader.read({deadlineMs:NOW+1000});
 assert.equal(closed,true);assert.equal(reader.available,true);assert.equal(next.generation,2);assert.equal(reader.reproving,true);
 assert.throws(()=>reader.assertConnection(old));
 f.change('DescribeTasksCommand',r=>{r.tasks[0].createdAt=new Date(NOW-9999);return r;});
 await assert.rejects(reader.read({deadlineMs:NOW+1000}),{code:'PAIR_DRIFT'});assert.equal(reader.available,false);
 await reader.close();
});
test('fresh canonical lease must match actual TLS socket endpoints and compiled policy',async()=>{
 const f=servicePairFixture(),reader=await createProductServiceTaskLeaseReader(f.configuration,{monotonicNow:()=>0}),lease=await reader.read({deadlineMs:NOW+1000});
 const args={policy:{deploymentRevision:f.pins.deploymentRevision,ownerTaskArn:f.id('owner'),proxyTaskArn:f.id('proxy'),clientCertSha256:f.pins.proxyCertSha256},
  tls:{certSha256:f.pins.ownerCertSha256},localAddress:'10.40.4.1',remoteAddress:'10.40.4.2',at:NOW,monotonicNow:0};
 assert.equal(assertProductServiceTaskLease(lease,args),NOW+30000);
 for(const change of [v=>v.remoteAddress='10.40.4.9',v=>v.localAddress='10.40.4.9',v=>v.policy.proxyTaskArn=f.id('owner'),v=>v.policy.deploymentRevision='foreign']){
  const v=structuredClone(args);change(v);assert.throws(()=>assertProductServiceTaskLease(lease,v),/PRODUCT_OWNER_HTTPS_UNAVAILABLE/);
 }
 await reader.close();
});

for(const [label,change]of [
 ['reused IP and ENI on a task outside the pinned service',f=>f.change('DescribeTasksCommand',reply=>{reply.tasks[0].group='service:foreign';return reply;})],
 ['reused IP and ENI on a task outside the service membership',f=>f.change('DescribeTasksCommand',reply=>{
  reply.tasks[0].taskArn=f.id('proxy').replace(/2{32}$/u,'3'.repeat(32));return reply;
 })],
 ['two distinct RUNNING proxy tasks',f=>f.change('ListTasksCommand',(reply,input)=>{
  if(input.serviceName==='meri-proxy')reply.taskArns.push(f.id('proxy').replace(/2{32}$/u,'3'.repeat(32)));return reply;
 })],
 ['changed partner task definition',f=>f.change('DescribeTasksCommand',reply=>{reply.tasks[0].taskDefinitionArn=f.pins.owner.taskDefinitionArn;return reply;})],
 ['changed partner image digest',f=>f.change('DescribeTasksCommand',reply=>{reply.tasks[0].containers[1].imageDigest='sha256:'+'f'.repeat(64);return reply;})],
 ['service count drift',f=>f.change('DescribeServicesCommand',reply=>{reply.services[0].desiredCount=2;return reply;})],
 ['a public IP',f=>f.change('DescribeNetworkInterfacesCommand',reply=>{reply.NetworkInterfaces[0].Association={PublicIp:'203.0.113.1'};return reply;})],
 ['changed security groups',f=>f.change('DescribeNetworkInterfacesCommand',reply=>{reply.NetworkInterfaces[0].Groups=[{GroupId:'sg-99999999'}];return reply;})],
 ['changed subnet',f=>f.change('DescribeNetworkInterfacesCommand',reply=>{reply.NetworkInterfaces[0].SubnetId='subnet-99999999';return reply;})],
 ['deployment drift in the final service read',f=>{let calls=0;f.change('DescribeServicesCommand',reply=>{
  if(++calls===2)reply.services[0].deployments[0].id='ecs-svc/99';return reply;
 });}],
 ['membership drift in the final service inventory',f=>{let calls=0;f.change('ListTasksCommand',(reply,input)=>{
  if(input.serviceName==='meri-proxy'&&++calls===2)reply.taskArns=[f.id('proxy').replace(/2{32}$/u,'3'.repeat(32))];return reply;
 });}],
 ['own task replacement',f=>f.replace('owner','4')],
])test('post-handshake canonical proof retires for '+label+' before admitting an exchange',async()=>{
 const f=servicePairFixture();let mono=0,exchanges=0;
 const reader=await createProductServiceTaskLeaseReader(f.configuration,{monotonicNow:()=>mono});
 try{
  const lease=await reader.read({deadlineMs:NOW+1000});change(f);mono=10;
  await assert.rejects(reader.proveConnection({generation:lease.generation,localAddress:lease.ownerPrivateIpv4Address,
   remoteAddress:lease.proxyPrivateIpv4Address,handshakeAtMonoMs:mono,deadlineMs:NOW+1000}).then(()=>{exchanges++;}),{code:'PAIR_DRIFT'});
  assert.equal(exchanges,0);assert.equal(reader.available,false);assert.equal(reader.ready,false);
  assert.throws(()=>reader.assertConnection(lease),{code:'PAIR_DRIFT'});
 }finally{await reader.close();}
});
