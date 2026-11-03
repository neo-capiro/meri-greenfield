import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createOperatorBrowserAdmission,assertOperatorBrowserAdmission,bindOperatorBrowserInvocation,operatorBrowserDeadline,operatorBrowserHostDeadline,assertOperatorBrowserControl,assertOperatorBrowserHostMaterial} from '../browser-operator-admission.mjs';
import {createBrowserExecutionPrerequisite,createOperatorBrowserExecutionPrerequisite} from '../browser-execution-prerequisite.mjs';
import {operatorCaseFixture,operatorAllocationFixture,cleanupOperatorFixture} from './browser-operator-fixture.mjs';
import {binding} from '../../control/conversations/test/application-fixture.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {EGRESS_REQUIREMENTS_SHA256,BROWSER_ACTIVATION_RENDER_VERIFICATION} from '../../worker/conversation/browser/activation.mjs';
const held={state:'held'};after(cleanupOperatorFixture);
test('capability cannot be deserialized; canonical bind is exact and revocation is terminal',async()=>{
 let time=Date.now();const c=await operatorCaseFixture({binding,now:()=>time,expiresAtMs:time+60000});
 for(const value of [{},{...c.capability},JSON.parse(JSON.stringify(c.capability)),{qualification:true}])assert.throws(()=>assertOperatorBrowserAdmission(value));
 assert.throws(()=>operatorBrowserDeadline(c.capability,{binding}),'unbound case cannot authorize a join');
 assert.throws(()=>bindOperatorBrowserInvocation(c.capability,{binding,run:{binding:{...binding,writerFence:2},state:'queued'},expiresAtMs:time+60000}));
 c.bind();assert.equal(operatorBrowserDeadline(c.capability,{binding,executionId:hash(binding),deadlineMs:time+50000}),time+50000);
 for(const field of ['tenantId','actorId','conversationId','runId','attemptId','workerId','writerFence']){
  const wrong={...binding,[field]:field==='writerFence'?binding[field]+1:binding[field]+'x'};
  assert.throws(()=>operatorBrowserDeadline(c.capability,{binding:wrong}));
 }
 assert.throws(()=>operatorBrowserDeadline(c.capability,{binding,executionId:'a'.repeat(64)}));
 c.capability.revoke();assert.throws(()=>operatorBrowserDeadline(c.capability,{binding}));
 assert.throws(()=>c.bind());
});
test('operator control rejects foreign source, open activation and different observer receiver before startup',async()=>{
 const c=await operatorCaseFixture({binding}),imageDigest=c.inputs.deployment.images.nodeRuntime.split('@')[1],configuration={browserActivation:held,versions:{imageDigest},
  uploads:{native:{enabled:true,agentcore:{imageDigest},host:c.material.native.control.host,policySha256:c.material.native.control.policySha256}}};
 assert.doesNotThrow(()=>assertOperatorBrowserControl(c.capability,{configuration,sourceCommit:c.sourceCommit}));
 assert.throws(()=>assertOperatorBrowserControl(c.capability,{configuration,sourceCommit:'0'.repeat(40)}));
 const wrong=structuredClone(configuration);wrong.uploads.native.host.observer.keyId='production';
 assert.throws(()=>assertOperatorBrowserControl(c.capability,{configuration:wrong,sourceCommit:c.sourceCommit}));
 const open=structuredClone(configuration);open.browserActivation={state:'open',evidence:'docs/qualification/browser-egress/EVIDENCE.md',evidenceSha256:'a'.repeat(64),requirementsSha256:EGRESS_REQUIREMENTS_SHA256,
  renderVerification:{schema:BROWSER_ACTIVATION_RENDER_VERIFICATION,sourceCommit:'0'.repeat(40),renderedAtMs:1,evidenceSha256:'a'.repeat(64),requirementsSha256:EGRESS_REQUIREMENTS_SHA256}};
 assert.throws(()=>assertOperatorBrowserControl(c.capability,{configuration:open,sourceCommit:c.sourceCommit}));
 assert.throws(()=>createOperatorBrowserAdmission({selection:c.selection,material:c.material,sourceCommit:'0'.repeat(40),expiresAtMs:c.expiresAtMs}));
 for(const mutate of [m=>delete m.callback,m=>m.callback.endpoint.address=m.native.worker.browserDeployment.bootstrapSpec.control.endpoint.address,
  m=>m.configuration.endpoint.address='10.0.0.9',m=>m.configuration.caSha256='0'.repeat(64),m=>m.callback.endpoint.serverFingerprintSha256='0'.repeat(64)]){
  const material=structuredClone(c.material);mutate(material);
  assert.throws(()=>createOperatorBrowserAdmission({selection:c.selection,material,sourceCommit:c.sourceCommit,expiresAtMs:c.expiresAtMs}),/OPERATOR_BROWSER_CASE_REFUSED/);
 }
});

test('operator host composition requires its actual bootstrap server, client and issuer certificates',async()=>{
 const c=await operatorCaseFixture({binding}),b=c.material.native.worker.browserDeployment.bootstrapSpec;
 const options={declaration:{tls:{hostServer:{serverName:b.control.endpoint.serverName}}},
  material:{hostServer:{cert:b.control.serverCertificate,clientCa:b.issuerCaCertificate},privateClient:{cert:b.control.clientCertificate,ca:b.issuerCaCertificate}}};
 assert.doesNotThrow(()=>assertOperatorBrowserHostMaterial(c.capability,options));
 for(const mutate of [o=>o.declaration.tls.hostServer.serverName='foreign.invalid',o=>o.material.hostServer.cert=b.control.clientCertificate,
  o=>o.material.hostServer.clientCa=b.control.serverCertificate,o=>o.material.privateClient.cert=b.control.serverCertificate,o=>o.material.privateClient.ca=b.control.serverCertificate]){
  const wrong=structuredClone(options);mutate(wrong);assert.throws(()=>assertOperatorBrowserHostMaterial(c.capability,wrong));
 }
});
test('demand rechecks policy and case lifetime before cached answers; ordinary held cannot acquire the capability',async()=>{
 let time=Date.now(),enabled=true,reads=0,demands=0,durable=false;
 const c=await operatorCaseFixture({binding,now:()=>time,expiresAtMs:time+60000});c.bind();
 const options={activation:held,now:()=>time,requestTimeoutMs:1000,effectTimeoutMs:2000,
  policy:{read:async()=>{reads++;return {enabled};}},demands:{read:async()=>durable,record:async input=>{assert.equal(input.expiresAtMs,c.expiresAtMs);demands++;durable=true;}},
  allocations:{ready:async()=>({status:'ready',generation:binding.writerFence,currentUntilMs:time+60000,leaseDeadlineMs:time+60000})}};
 const plain=createBrowserExecutionPrerequisite({...options,caseAdmission:c.capability,qualification:true});
 assert.deepEqual(await plain.need({binding}),{kind:'none'});assert.equal(reads,0);
 const p=createOperatorBrowserExecutionPrerequisite(options,c.capability),input={binding,deadlineMs:time+30000,executionDeadlineMs:time+900000};
 await assert.rejects(p.demand({binding,deadlineMs:time+30000}));assert.equal(demands,0);
 assert.deepEqual(await p.need(input),{kind:'deferred'});await p.demand(input);
 assert.deepEqual(await p.need(input),{kind:'browser-only',hostMode:'browser-only'});assert.equal(demands,1);
 enabled=false;assert.deepEqual(await p.need(input),{kind:'none'});assert.equal(reads,4,'operator never reuses a stale role/policy verdict');
 enabled=true;time=c.expiresAtMs;await assert.rejects(p.need({...input,deadlineMs:time+30000}));await assert.rejects(p.demand({...input,deadlineMs:time+30000}));assert.equal(demands,1);
});
test('a revoked case cannot return ready after an allocation await; original durable demand is retained',async()=>{
 const c=await operatorCaseFixture({binding});c.bind();let recorded=0;
 const p=createOperatorBrowserExecutionPrerequisite({activation:held,now:Date.now,requestTimeoutMs:1000,effectTimeoutMs:2000,
  policy:{read:async()=>({enabled:true})},demands:{read:async()=>false,record:async()=>{recorded++;}},
  allocations:{ready:async()=>{c.capability.revoke();return {status:'ready',generation:1,currentUntilMs:Date.now()+60000,leaseDeadlineMs:Date.now()+60000};}}},c.capability);
 await assert.rejects(p.demand({binding,deadlineMs:Date.now()+5000,executionDeadlineMs:Date.now()+60000}));assert.equal(recorded,1);
});

test('revocation during a durable demand read is not swallowed as a retryable deferred result',async()=>{
 const c=await operatorCaseFixture({binding});c.bind();
 const p=createOperatorBrowserExecutionPrerequisite({activation:held,now:Date.now,requestTimeoutMs:1000,effectTimeoutMs:2000,
  policy:{read:async()=>({enabled:true})},demands:{read:async()=>{c.capability.revoke();return true;},record:async()=>assert.fail('No demand write')},
  allocations:{ready:async()=>assert.fail('No allocation read')}},c.capability);
 await assert.rejects(p.need({binding,executionId:hash(binding),deadlineMs:Date.now()+5000}),/OPERATOR_BROWSER_CASE_REFUSED/u);
});
test('actual native declaration must match the case source/image/AMI/profile and original cleanup ceiling',async()=>{
 const time=Date.now(),c=await operatorCaseFixture({binding,now:()=>time});c.bind();
 const host=await operatorAllocationFixture({binding,material:c.material,nowMs:time});
 assert.ok(operatorBrowserHostDeadline(c.capability,{binding,...host})>time);
 for(const mutate of [d=>d.sourceCommit='a'.repeat(40),d=>d.imageDigest='sha256:'+'a'.repeat(64),d=>d.launch.ImageId='ami-0123456789abcdef0',
  d=>d.bootstrapSpec.profileSha256='a'.repeat(64),d=>d.placement.iamInstanceProfile='foreign']){
  const material=structuredClone(c.material);mutate(material.native.worker.browserDeployment);
  assert.throws(()=>{
   const other=createOperatorBrowserAdmission({selection:c.selection,material,sourceCommit:material.native.worker.browserDeployment.sourceCommit,expiresAtMs:time+60000,now:()=>time});
   bindOperatorBrowserInvocation(other,{binding,run:{binding,state:'queued'},request:{prompt:'Synthetic ordinary request'},expiresAtMs:time+900000});
   return operatorBrowserHostDeadline(other,{binding,...host});
  });
 }
 const short=structuredClone(c.material);short.retainUntilMs=time+70000;
 const small=createOperatorBrowserAdmission({selection:c.selection,material:short,sourceCommit:c.sourceCommit,expiresAtMs:time+40000,now:()=>time});
 bindOperatorBrowserInvocation(small,{binding,run:{binding,state:'queued'},request:{prompt:'Synthetic ordinary request'},expiresAtMs:time+900000});
 assert.throws(()=>operatorBrowserHostDeadline(small,{binding,...host}),'actual cleanup ceiling exceeds planned material retention');
 const restarted=createOperatorBrowserAdmission({selection:c.selection,material:c.material,sourceCommit:c.sourceCommit,expiresAtMs:time+60000,now:()=>time});
 assert.throws(()=>operatorBrowserHostDeadline(restarted,{binding,...host}),'restart never invents restored case authority or another launch allowance');
});
