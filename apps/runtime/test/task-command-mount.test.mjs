/** Actual runtime capture/route -> real task API -> metadata/approval/executor/native serialization; synthetic boundaries. */
import test,{mock} from 'node:test';import assert from 'node:assert/strict';
import {createTaskCommandApplication} from '../../control/task-command-application/index.mjs';
import {commandComposition,id} from '../../control/intents/test/fixture.mjs';
import {productReadiness} from '../product-readiness.mjs';
// The unrelated startup compiler imports AWS clients. This route test borrows only its inert error constructor.
mock.module('../config.mjs',{namedExports:{fault:code=>Object.assign(Error(code),{code}),readSecret(){throw Error('No artifact secret access in task-command tests');}}});
mock.module('../artifacts/composition.mjs',{namedExports:{runtimeArtifactRecovery:()=>null}});
const {captureRuntimePorts,composeRuntimePorts,createRuntimeProductApplications}=await import('../product-applications.mjs');
const configuration={sourceEnabled:false,limits:{requestMs:1000,requestBytes:131072},native:{maxResponseBytes:131072}};
const request=(intent,body={})=>new Request('https://meri.invalid/api/task-commands/'+intent,{method:'POST',headers:{authorization:'Bearer synthetic-session','content-type':'application/json'},body:JSON.stringify(body)});
const runtime=(ports,enabled=false,now=Date.now)=>createRuntimeProductApplications({configuration:{...configuration,sourceEnabled:enabled},sessions:{},ports,now});
test('task-command runtime defaults off and missing owners stay unavailable without invoking a configured application',async()=>{
 let calls=0;const ports=captureRuntimePorts({taskCommandApplication:{async handle(){calls++;throw Error('must stay closed');}}});
 for(const [selected,enabled] of [[ports,false],[captureRuntimePorts(),true],[captureRuntimePorts(),false]])for(const intent of ['prepare','execute']){
  const response=await runtime(selected,enabled).handle(request(intent));assert.equal(response.status,503);
  assert.deepEqual(await response.json(),{error:{code:'TASK_COMMAND_UNAVAILABLE',outcome:'NOT_DISPATCHED'}});assert.equal(response.headers.get('cache-control'),'no-store');
 }
 assert.equal(calls,0);assert.equal(runtime(ports,true).handle(request('other')),null);
});
test('captured task application retains its receiver, cannot be replaced and rejects accessor/duplicate ownership',async()=>{
 let traps=0,calls=0;const owner={marker:1,async handle(){assert.equal(this.marker,1);calls++;return Response.json({synthetic:true});}};
 assert.throws(()=>captureRuntimePorts({get taskCommandApplication(){traps++;return owner;}}));
 assert.throws(()=>captureRuntimePorts({taskCommandApplication:{get handle(){traps++;return ()=>{};}}}));assert.equal(traps,0);
 const ports=captureRuntimePorts({taskCommandApplication:owner});owner.handle=()=>{throw Error('replacement');};
 assert.throws(()=>composeRuntimePorts(ports,ports));assert.equal((await runtime(ports,true).handle(request('prepare'))).status,200);assert.equal(calls,1);
});

test('late task factory receives actual assembly sessions only after explicit source opt-in and retains captured methods',async()=>{
 const sessions={},seen=[],application={marker:'application',handle(){assert.equal(this.marker,'application');return new Response('late');}};
 let state='pending';const factory={marker:'factory',create(input){assert.equal(this.marker,'factory');assert.equal(input.sessions,sessions);seen.push(input.sessions);state='composed';return application;},state(){assert.equal(this.marker,'factory');return state;}};
 const ports=captureRuntimePorts({taskCommandApplicationFactory:factory});factory.create=()=>assert.fail('replaced');factory.state=()=>assert.fail('replaced');
 const disabled=createRuntimeProductApplications({configuration,sessions,ports,now:Date.now});assert.equal((await disabled.handle(request('prepare'))).status,503);assert.equal(seen.length,0);
 assert.equal(productReadiness({ports,sourceEnabled:false}).owners.find(o=>o.name==='tasks.commands').state,'disabled');
 const enabled=createRuntimeProductApplications({configuration:{...configuration,sourceEnabled:true},sessions,ports,now:Date.now});application.handle=()=>assert.fail('replaced');
 assert.equal((await enabled.handle(request('prepare'))).status,200);assert.equal((await enabled.handle(request('execute'))).status,200);assert.deepEqual(seen,[sessions]);
 assert.equal(productReadiness({ports,sourceEnabled:true}).owners.find(o=>o.name==='tasks.commands').state,'composed');
});

test('static and late task owners cannot conflict; accessor and async factories do not become mounted authority',()=>{
 const application={handle(){}},factory={create(){return application;},state(){return 'pending';}};let traps=0;
 assert.throws(()=>captureRuntimePorts({taskCommandApplication:application,taskCommandApplicationFactory:factory}));
 assert.throws(()=>composeRuntimePorts({taskCommandApplication:application},{taskCommandApplicationFactory:factory}));
 assert.throws(()=>captureRuntimePorts({taskCommandApplicationFactory:{get create(){traps++;return ()=>application;},state(){return 'pending';}}}));assert.equal(traps,0);
 assert.throws(()=>runtime(captureRuntimePorts({taskCommandApplicationFactory:{create(){return Promise.reject(Error('synthetic'));},state(){return 'pending';}}}),true),e=>e.code==='PRODUCT_PORTS_CONFIGURATION');
});
test('runtime opt-in reaches the actual task-update API and existing separate approval gates before the fixed Core source',async()=>{
 const c=commandComposition({action:'task.update'}),api=createTaskCommandApplication({now:()=>c.f.state.now,limits:{maxRequestMs:1000,maxRequestBytes:65536,maxResponseBytes:65536},
  async resolveSession(){return {binding:c.binding,commandOptions:c.commandOptions,checkedAtMs:c.f.state.now,expiresAtMs:c.f.state.now+1000,
   async authorizeExecution({proposal}){return {credential:'synthetic',execution:{...c.f.execution,proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,idempotencyKey:proposal.command.idempotencyKey}};}};}});
 const app=runtime(captureRuntimePorts({taskCommandApplication:api}),true,()=>c.f.state.now);
 const prepared=await app.handle(request('prepare',{arguments:{taskId:id(21),title:'Updated',status:'open'}}));assert.equal(prepared.status,200);
 const {proposal}=await prepared.json();assert.equal(c.f.state.fetches,0);
 assert.notEqual((await app.handle(request('execute',{proposal}))).status,200);assert.equal(c.f.state.fetches,0);
 c.approve(proposal);const response=await app.handle(request('execute',{proposal}));assert.equal(response.status,200);assert.equal((await response.json()).status,'observed');
 assert.equal(c.f.state.http.url,'https://source.invalid/api/clio/tools/update_task');assert.deepEqual(JSON.parse(c.f.state.http.options.body),{taskId:id(21),title:'Updated',status:'todo'});
 assert.equal((await app.handle(request('execute',{proposal}))).status,200);assert.equal(c.f.state.fetches,1);
 assert.equal((await app.handle(request('prepare?unexpected=1',{arguments:{taskId:id(21),title:'Updated'}}))).status,404);
});
