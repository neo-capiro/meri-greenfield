import test from 'node:test';import assert from 'node:assert/strict';
import {taskRouterFixture} from './task-router-fixture.mjs';
import {taskRouterClientIPv4,createTaskRouterIngress,taskRouterFields} from '../task-router-boundary.mjs';
test('route authority joins issued task credential, exact original and current canonical admission',async()=>{
 const f=taskRouterFixture(),control=await f.verify(),task=await f.verify('stdout',f.taskCredential);assert.deepEqual(control,task);assert.equal(control.resource.taskArn,f.resource.taskArn);assert.equal(f.counts.admission,2);
 for(const [operation,credential]of [['prepare',f.controlCredential],['start',f.controlCredential],['stdin',f.controlCredential],['stdout',f.controlCredential],['inspect',f.taskCredential],['launch',f.taskCredential]])await assert.rejects(f.verify(operation,credential),/TASK_ROUTER_REFUSED/);
 assert.equal(f.counts.admission,2);assert.ok(Object.hasOwn(taskRouterFields,'binding-read'));
});
test('missing, changed, unbound or revoked issuance/allocation facts refuse before network authority',async()=>{
 const changes=[f=>{f.issued.state='CLAIMED';},f=>{delete f.issued.factsSha256;},f=>{f.issued.capabilitySha256='0'.repeat(64);},f=>{f.issued.factsSha256='0'.repeat(64);},f=>{f.issued.expiresAtMs++;},f=>{f.record.state='UNKNOWN';},f=>{f.record.original={...f.record.original,planSha256:'0'.repeat(64)};},f=>{f.saved.run.state='cancelled';},f=>{f.record.grantIntents[0].capabilitySha256='0'.repeat(64);},f=>{f.record.qualification.policyRevision='0'.repeat(64);},f=>{f.admission.read=async()=>({state:'REVOKED'});},f=>{f.admission.read=async()=>{throw Error('read-uncertain');};}];
 for(const change of changes){const f=taskRouterFixture();change(f);await assert.rejects(f.verify());}
});
test('stop retains only cleanup authority after current execution state ends',async()=>{
 const f=taskRouterFixture();f.saved.run.state='cancelled';f.record.state='UNKNOWN';f.admission.read=async()=>{throw Error('no-new-execution');};
 await f.verify('stop',f.taskCredential);await f.verify('stop',f.controlCredential);await assert.rejects(f.verify('inspect'));assert.equal(f.counts.admission,0);
});
test('private ingress marker cannot come from a caller header or another marker owner',()=>{
 const ingress=createTaskRouterIngress(),foreign=createTaskRouterIngress();assert.doesNotThrow(()=>ingress.assert(ingress.issue()));for(const value of [undefined,{},'private',foreign.issue()])assert.throws(()=>ingress.assert(value),/TASK_ROUTER_REFUSED/);
 assert.equal(taskRouterClientIPv4('198.51.100.1, 10.40.1.42'),'10.40.1.42');
 for(const value of ['10.40.1.42:1234','10.040.1.42','10.40.1.999','10.40.1.42, 8.8.8.8','10.40.1.42\r\n','::ffff:10.40.1.42',''])assert.throws(()=>taskRouterClientIPv4(value),/TASK_ROUTER_REFUSED/);
});
