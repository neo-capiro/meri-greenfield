import test from 'node:test';
import assert from 'node:assert/strict';
import {createProductServiceTaskLeaseReader} from './service-task-leases.mjs';
import {assertProductServiceTaskLease} from './owner-https.mjs';
import {servicePairFixture,PAIR_NOW as NOW} from './test/service-pair-fixture.mjs';
const refused=/PRODUCT_SERVICE_TASK_LEASE_UNAVAILABLE/;
test('canonical lease discovers at startup, snapshots source and never caches a read',async()=>{
 const f=servicePairFixture(),reader=await createProductServiceTaskLeaseReader(f.configuration),a=await reader.read({deadlineMs:NOW+50000});
 assert.deepEqual(a,{schemaVersion:1,deploymentRevision:f.pins.deploymentRevision,ownerTaskArn:f.id('owner'),proxyTaskArn:f.id('proxy'),
  ownerPrivateIpv4Address:'10.40.4.1',proxyPrivateIpv4Address:'10.40.4.2',ownerCertSha256:'a'.repeat(64),proxyCertSha256:'b'.repeat(64),checkedAtMs:NOW,expiresAtMs:NOW+30000});
 const count=f.calls.length;f.advance(10);assert.equal((await reader.read({deadlineMs:NOW+50000})).checkedAtMs,NOW+10);assert.equal(f.calls.length,2*count);
 assert.equal(Object.isFrozen(a),true);assert.equal(JSON.stringify(a).includes('taskRole'),false);
});
test('valid replacement and same-ARN creation-time mutation cannot reenable the old pair',async()=>{
 for(const change of [f=>f.replace('proxy','3'),f=>f.change('DescribeTasksCommand',r=>{r.tasks[0].createdAt=new Date(NOW-9999);return r;})]){
  const f=servicePairFixture(),reader=await createProductServiceTaskLeaseReader(f.configuration);await reader.read({deadlineMs:NOW+1000});change(f);
  await assert.rejects(reader.read({deadlineMs:NOW+1000}),refused);assert.equal(reader.available,false);
  f.replace('proxy','2');const count=f.calls.length;await assert.rejects(reader.read({deadlineMs:NOW+1000}),refused);assert.equal(f.calls.length,count);
 }
});
test('fresh canonical lease must match actual TLS socket endpoints and compiled policy',async()=>{
 const f=servicePairFixture(),reader=await createProductServiceTaskLeaseReader(f.configuration),lease=await reader.read({deadlineMs:NOW+1000});
 const args={policy:{deploymentRevision:f.pins.deploymentRevision,ownerTaskArn:f.id('owner'),proxyTaskArn:f.id('proxy'),clientCertSha256:f.pins.proxyCertSha256},
  tls:{certSha256:f.pins.ownerCertSha256},localAddress:'10.40.4.1',remoteAddress:'10.40.4.2',started:NOW,at:NOW,deadline:NOW+1000};
 assert.equal(assertProductServiceTaskLease(lease,args),NOW+1000);
 for(const change of [v=>v.remoteAddress='10.40.4.9',v=>v.localAddress='10.40.4.9',v=>v.policy.proxyTaskArn=f.id('owner'),v=>v.policy.deploymentRevision='foreign']){
  const v=structuredClone(args);change(v);assert.throws(()=>assertProductServiceTaskLease(lease,v),/PRODUCT_OWNER_HTTPS_UNAVAILABLE/);
 }
});
