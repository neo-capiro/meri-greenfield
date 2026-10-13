import test from 'node:test';
import assert from 'node:assert/strict';
import {fixturePins} from '../../scripts/test-native-enforcement.mjs';
import {buildNativeEnforcementAdmission} from './app.mjs';
import {SDK_WIRE_PROFILE} from './lib/ecs-wire.mjs';
import {createQualificationWorkerObserver,consumeQualificationWorkerObservation,assertQualificationWorkerObserver} from './worker-observer.mjs';
import {createHash} from 'node:crypto';
import {observationFixture} from './worker-observer.fixture.mjs';
test('actual owner expressions admit exact synthetic running task and private ENI; observation is one use',async()=>{
 const f=observationFixture(),owner=f.make();const result=await owner.observe(f.request,{deadlineMs:f.deadlineMs});
 assert.equal(result.receipt.evidenceKind,'trusted-read-port-observation');assert.equal(result.receipt.runtimeQualified,false);assert.equal(result.receipt.predicatesPassed,true);assert.equal(f.admission.runtimeEnabled,false);
 assert.deepEqual(f.calls.map(x=>x.kind),['tasks','eni']);assert.deepEqual(f.calls[0].args,{Cluster:f.p.clusterArn,Tasks:[f.request.qualificationBinding.workerArn],Include:['TAGS']});
 const r=consumeQualificationWorkerObservation(owner,result,f.request,{now:f.now});assert.equal(r.qualificationBinding.workerArn,f.task.TaskArn);
 assert.throws(()=>consumeQualificationWorkerObservation(owner,result,f.request,{now:f.now}));
});
for(const [name,mutate] of [
 ['foreign task',f=>f.task.TaskArn+='0'],['foreign run',f=>f.task.StartedBy='other'],['image',f=>f.task.Containers[0].ImageDigest='sha256:'+'0'.repeat(64)],
 ['stopped',f=>f.task.LastStatus='STOPPED'],['worker stopped',f=>f.task.Containers[0].LastStatus='STOPPED'],['override',f=>f.task.Overrides.ContainerOverrides[0].Command=['bad']],
 ['pending ENI',f=>f.task.Attachments[0].Status='ATTACHING'],['public IP',f=>f.eni.NetworkInterfaces[0].Association={PublicIp:'1.2.3.4'}],['foreign ENI',f=>f.eni.NetworkInterfaces[0].OwnerId='111111111111'],
 ['extra container',f=>f.task.Containers.push({...f.task.Containers[0],Name:'other'})],['missing tag',f=>f.task.Tags.pop()]
])test('refuses '+name,async()=>{const f=observationFixture();mutate(f);await assert.rejects(f.make().observe(f.request,{deadlineMs:f.deadlineMs}));});
test('caller Boolean/lookalike observation cannot grant activation',()=>{assert.throws(()=>assertQualificationWorkerObserver({observe(){}}));const f=observationFixture(),o=f.make();assert.throws(()=>consumeQualificationWorkerObservation(o,{receipt:{verified:true}},f.request,{now:f.now}));});
test('parked read ends at caller original cutoff',async()=>{const f=observationFixture();f.reads.describeTasks=()=>new Promise(()=>{});const start=Date.now();await assert.rejects(f.make({now:Date.now}).observe(f.request,{deadlineMs:Date.now()+30}));assert(Date.now()-start<500);});
test('late observation and cross-owner token refuse',async()=>{const f=observationFixture(),o=f.make();const a=await o.observe(f.request,{deadlineMs:f.deadlineMs});assert.throws(()=>consumeQualificationWorkerObservation(f.make(),a,f.request,{now:f.now}));const b=await o.observe(f.request,{deadlineMs:f.deadlineMs});f.setNow(f.now()+6000);assert.throws(()=>consumeQualificationWorkerObservation(o,b,f.request,{now:f.now}));});
test('raw getters/proxies are never inspected by observer',async()=>{const f=observationFixture();let n=0;f.reads.describeTasks=()=>({get Tasks(){n++;return [];}});await assert.rejects(f.make().observe(f.request,{deadlineMs:f.deadlineMs}));assert.equal(n,0);});
test('runtime hash and unbranded compilation refuse before reads',()=>{const f=observationFixture();assert.throws(()=>f.make({compiledAdmission:{...f.admission}}));assert.throws(()=>f.make({jsonataRuntimePath:new URL('./worker-observer.mjs',import.meta.url).pathname}));assert.equal(f.calls.length,0);});
test('forbidden historical worker image is refused even with structurally compiled pins',()=>{
 const f=observationFixture(),p=fixturePins();p.wireProfile=SDK_WIRE_PROFILE;
 const w=JSON.stringify({profile:SDK_WIRE_PROFILE,timestampEncoding:'iso8601',listResult:{TaskArns:[]},describeResult:{Tasks:[],Failures:[]},eniResult:{NetworkInterfaces:[]},identityResult:{Account:p.account}});
 p.wireEvidence={origin:'SYNTHETIC_TEST_ONLY',reference:'synthetic:blocked-image',version:'1',body:w,sha256:createHash('sha256').update(w).digest('hex')};
 p.image=p.image.replace(/sha256:[0-9a-f]{64}/,'sha256:8d1ec09aa78f47a11019089dacde93289fc66a39f55bd4357e59eeb25d9b52ac');for(const td of Object.values(p.taskDefinitionPins))td.containerDefinitions[0].image=p.image;
 const compiledAdmission=buildNativeEnforcementAdmission({staticPins:p});assert.throws(()=>f.make({compiledAdmission}));assert.equal(f.calls.length,0);
});
