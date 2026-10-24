/** Real SQL and gate HTTP receivers; ECS task/image and SDK query are synthetic. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {admittedController,control,sha} from './run-pg-fixture.mjs';
import {createPreparedTaskKickoff,createPreparedRunnerGate} from '../prepared-kickoff.mjs';
import {createPreparedRunnerGateApplication,createPreparedRunnerReleaseClient} from '../prepared-kickoff-http.mjs';
test('canonical run state survives controller reconstruction without another native gate release',async t=>{
 const f=await admittedController(t),{original,binding,resource}=f;let controller=f.controller,releases=0;
 await controller.allocate();
 const gate=createPreparedRunnerGate({original,taskArn:resource.taskArn,authorizer:controller.prepared.preparationAuthorizer,enabled:true,maxWaitMs:5000});t.after(()=>gate.close());
 const application=createPreparedRunnerGateApplication({gate,controlCapabilitySha256:sha(control),enabled:true});
 const client=createPreparedRunnerReleaseClient({original,taskArn:resource.taskArn,origin:'https://synthetic-task.invalid',credential:control,fetchImpl:(url,options)=>application.handle(new Request(url,options))});
 const runner={readiness:v=>client.readiness(v),release:v=>{releases++;return client.release(v);}};
 const makeOwner=()=>createPreparedTaskKickoff({original,controller:{...controller,observe:async()=>({taskArn:resource.taskArn,stopped:false})},store:f.store,runner,enabled:true,maxWaitMs:5000,pollMs:10});
 let owner=makeOwner();const worker=(async()=>{await gate.wait();await f.status('starting');await f.status('running');await f.status('completed');})();
 await owner.kickoff({binding,executionKey:original.executionKey});await worker;
 assert.equal((await owner.status({binding,executionId:original.executionId})).state,'completed');assert.equal(releases,1);
 controller=f.makeController();owner=makeOwner();await owner.kickoff({binding,executionKey:original.executionKey});
 assert.equal((await owner.status({binding,executionId:original.executionId})).state,'completed');
 await owner.stop({binding,executionId:original.executionId});assert.equal(releases,1);assert.equal(f.counts.retirements,1);
 assert.equal((await f.store.read(binding,{},()=>{})).run.state,'completed');
});
