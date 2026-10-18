import test from 'node:test';
import assert from 'node:assert/strict';
import {request} from 'node:http';
import {connect} from 'node:net';
import {once} from 'node:events';
import {performance} from 'node:perf_hooks';
import {createEgressGrant} from '../../browser/egress-control.mjs';
import {enabledPolicy,binding} from '../../browser/test/fixtures.mjs';
import {HOST_ALLOCATION_SCHEMA,assertHostAllocation,assertBrowserHostCurrent} from '../binding.mjs';
import {startBrowserHostEgressService} from '../browser-egress-service.mjs';

const allocation=(deadline=Date.now()+10000)=>({schema:HOST_ALLOCATION_SCHEMA,tenantId:binding.tenantId,conversationId:binding.conversationId,generation:1,
 hostId:'00000020-b0a1-4000-8000-000000000000',imageDigest:`sha256:${'a'.repeat(64)}`,leaseDeadlineMs:deadline});
const receipt=(a,grant,until,overrides={})=>({allocation:a,binding,policySha256:grant.policySha256,phase:'active',checkedAtMs:Date.now(),currentUntilMs:until,...overrides});
const httpStatus=(endpoint,target)=>new Promise((resolve,reject)=>{const u=new URL(endpoint),r=request({hostname:u.hostname,port:u.port,method:'GET',path:target,headers:{host:new URL(target).host}},res=>{res.resume();res.on('end',()=>resolve({status:res.statusCode,code:res.headers['x-meri-egress-refusal']}));});r.on('error',reject);r.end();});

test('allocation and currentness bind exact host, image, generation, run and effective policy digest',()=>{
 const a=allocation(),grant=createEgressGrant({binding,policy:enabledPolicy(),expiresAtMs:Date.now()+5000}),until=Date.now()+1000;
 assert.deepEqual(assertHostAllocation(a),a);
 assert.equal(assertBrowserHostCurrent({allocation:a,binding,policySha256:grant.policySha256,current:receipt(a,grant,until),nowMs:Date.now(),maxFreshMs:3000}).currentUntilMs,until);
 const bad=[{allocation:{...a,generation:2}},{binding:{...binding,writerFence:2}},{policySha256:'b'.repeat(64)},{phase:'draining'},{currentUntilMs:Date.now()+5000}];
 for(const change of bad)assert.throws(()=>assertBrowserHostCurrent({allocation:a,binding,policySha256:grant.policySha256,current:receipt(a,grant,until,change),nowMs:Date.now(),maxFreshMs:3000}),/HOST_(?:CURRENTNESS|BINDING)_REFUSED/);
 assert.throws(()=>assertHostAllocation({...a,imageDigest:'latest'}),/HOST_BINDING_REFUSED/);
 assert.throws(()=>assertHostAllocation({...a,hostId:[a.hostId]}),/HOST_BINDING_REFUSED/);
 assert.throws(()=>assertHostAllocation({...a,imageDigest:[a.imageDigest]}),/HOST_BINDING_REFUSED/);
});

test('proxy starts denied; only a trusted current run grants it, and failed refresh closes its listener',async()=>{
 const a=allocation(),grant=createEgressGrant({binding,policy:enabledPolicy(),expiresAtMs:Date.now()+5000});let current=true;
 const service=await startBrowserHostEgressService({allocation:a,binding,maxFreshMs:2000,refreshEveryMs:500,resolve:async()=>['93.184.215.14'],
  readCurrent:async()=>receipt(a,grant,Date.now()+1500,{phase:current?'active':'draining'})});
 try{
  assert.deepEqual(await httpStatus(service.endpoint,'http://unlisted.example/'),{status:403,code:'BROWSER_EGRESS_REVOKED'});
  assert.deepEqual(await service.grant(grant),{granted:true,policySha256:grant.policySha256});
  assert.deepEqual(await httpStatus(service.endpoint,'http://unlisted.example/'),{status:403,code:'BROWSER_ORIGIN_NOT_ALLOWED'});
  current=false;await assert.rejects(service.refresh(),/HOST_CURRENTNESS_REFUSED/);
  await assert.rejects(httpStatus(service.endpoint,'http://unlisted.example/'),{code:'ECONNREFUSED'});
 }finally{await service.close();}
});

test('mismatched grant never opens egress and a lost currentness lease destroys idle proxy sockets',async()=>{
 const a=allocation(),grant=createEgressGrant({binding,policy:enabledPolicy(),expiresAtMs:Date.now()+1000});
 const bad=await startBrowserHostEgressService({allocation:a,binding,maxFreshMs:200,refreshEveryMs:50,resolve:async()=>[],readCurrent:async()=>receipt(a,grant,Date.now()+100)});
 try{await assert.rejects(bad.grant({...grant,binding:{...binding,attemptId:'00000088-b0a1-4000-8000-000000000000'}}),/HOST_GRANT_REFUSED/);}finally{await bad.close();}
 const until=Date.now()+75;
 const service=await startBrowserHostEgressService({allocation:a,binding,maxFreshMs:200,refreshEveryMs:20,resolve:async()=>[],readCurrent:async()=>receipt(a,grant,until)});
 try{
  await service.grant(grant);
  const u=new URL(service.endpoint),socket=connect({host:u.hostname,port:Number(u.port)});await once(socket,'connect');
  await once(socket,'close',{signal:AbortSignal.timeout(500)});
  await assert.rejects(httpStatus(service.endpoint,'http://unlisted.example/'),{code:'ECONNREFUSED'});
 }finally{await service.close();}
});

test('a caller cannot extend an admitted grant while the trusted currentness read is pending',async()=>{
 let time=Date.now();const a=allocation(time+10000),grant=structuredClone(createEgressGrant({binding,policy:enabledPolicy(),expiresAtMs:time+100}));
 const originalExpiry=grant.expiresAtMs;
 const service=await startBrowserHostEgressService({allocation:a,binding,now:()=>time,maxFreshMs:2000,refreshEveryMs:400,resolve:async()=>[],
  readCurrent:async()=>{grant.expiresAtMs=time+5000;return {allocation:a,binding,policySha256:grant.policySha256,phase:'active',checkedAtMs:time,currentUntilMs:time+1000};}});
 try{
  await service.grant(grant);assert.ok(grant.expiresAtMs>originalExpiry);
  time=originalExpiry+1;await assert.rejects(service.refresh(),/HOST_CURRENTNESS_REFUSED/);
 }finally{await service.close();}
});

test('a late currentness reply cannot renew a lease that already expired',async()=>{
 let time=Date.now(),reads=0,reply;
 const a=allocation(time+5000),grant=createEgressGrant({binding,policy:enabledPolicy(),expiresAtMs:time+1000});
 const currentReceipt=until=>({allocation:a,binding,policySha256:grant.policySha256,phase:'active',checkedAtMs:time,currentUntilMs:until});
 const service=await startBrowserHostEgressService({allocation:a,binding,now:()=>time,maxFreshMs:200,refreshEveryMs:20,resolve:async()=>[],
  readCurrent:async()=>++reads===1?currentReceipt(time+60):new Promise(resolve=>{reply=resolve;})});
 try{
  await service.grant(grant);const pending=service.refresh();
  time+=70;reply(currentReceipt(time+60));
  await assert.rejects(pending,/HOST_CURRENTNESS_REFUSED/);
  await assert.rejects(httpStatus(service.endpoint,'http://unlisted.example/'),{code:'ECONNREFUSED'});
 }finally{await service.close();}
});

test('a wall-clock rollback cannot extend the last authenticated lease',async()=>{
 let time=Date.now(),reads=0;const a=allocation(time+5000),grant=createEgressGrant({binding,policy:enabledPolicy(),expiresAtMs:time+1000});
 const service=await startBrowserHostEgressService({allocation:a,binding,now:()=>time,maxFreshMs:200,refreshEveryMs:30,resolve:async()=>[],
  readCurrent:async()=>++reads===1?{allocation:a,binding,policySha256:grant.policySha256,phase:'active',checkedAtMs:time,currentUntilMs:time+80}:new Promise(()=>{})});
 try{
  await service.grant(grant);const u=new URL(service.endpoint),socket=connect({host:u.hostname,port:Number(u.port)});await once(socket,'connect');
  time-=60000;
  await once(socket,'close',{signal:AbortSignal.timeout(500)});
  await assert.rejects(httpStatus(service.endpoint,'http://unlisted.example/'),{code:'ECONNREFUSED'});
 }finally{await service.close();}
});

test('a rollback between receipt validation and timer scheduling cannot lengthen the lease',async()=>{
 const baseline=Date.now(),a=allocation(baseline+10000);
 const grant=createEgressGrant({binding,policy:enabledPolicy(),expiresAtMs:baseline+5000});
 let afterReceipt=false,postReadClocks=0,reads=0;
 const service=await startBrowserHostEgressService({allocation:a,binding,
  now:()=>afterReceipt&&++postReadClocks>1?baseline-60000:baseline,
  maxFreshMs:1000,refreshEveryMs:100,resolve:async()=>[],
  readCurrent:async()=>{if(++reads>1)return new Promise(()=>{});afterReceipt=true;
   return {allocation:a,binding,policySha256:grant.policySha256,phase:'active',
    checkedAtMs:baseline,currentUntilMs:baseline+80};}});
 try{
  await service.grant(grant);const u=new URL(service.endpoint);
  const socket=connect({host:u.hostname,port:Number(u.port)});await once(socket,'connect');
  await once(socket,'close',{signal:AbortSignal.timeout(400)});
  await assert.rejects(httpStatus(service.endpoint,'http://unlisted.example/'),{code:'ECONNREFUSED'});
 }finally{await service.close();}
});

test('a late refresh cannot replace an elapsed lease before its timer callback runs',async()=>{
 let time=Date.now(),reads=0,reply;const a=allocation(time+5000),grant=createEgressGrant({binding,policy:enabledPolicy(),expiresAtMs:time+1000});
 const service=await startBrowserHostEgressService({allocation:a,binding,now:()=>time,maxFreshMs:200,refreshEveryMs:20,resolve:async()=>[],
  readCurrent:async()=>++reads===1?{allocation:a,binding,policySha256:grant.policySha256,phase:'active',checkedAtMs:time,currentUntilMs:time+50}:
   new Promise(resolve=>{reply=resolve;})});
 try{
  await service.grant(grant);const pending=service.refresh();time-=60000;
  const start=performance.now();while(performance.now()-start<85){} // Delay timers so the late receipt settles first.
  reply({allocation:a,binding,policySha256:grant.policySha256,phase:'active',checkedAtMs:time,currentUntilMs:time+100});
  await assert.rejects(pending,/HOST_CURRENTNESS_REFUSED/);
  await assert.rejects(httpStatus(service.endpoint,'http://unlisted.example/'),{code:'ECONNREFUSED'});
 }finally{await service.close();}
});
