/** Closed ports only: real allocator/ownership, scripted ECS and SQL protocol store, real kickoff and reconciler. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {lifecycleFixture} from '../../../control/conversations/test/lifecycle-fixture.mjs';
import {originalFacts,fakeEcs,syntheticAdmission,processAllocator} from './original-retirement-fixture.mjs';
import {createPreparedTaskKickoff} from '../prepared-kickoff.mjs';
import {createBrokerActivity} from '../../temporal-worker.mjs';

const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check){const end=Date.now()+2500;while(!await check()){if(Date.now()>end)throw Error('TEST_TIMEOUT');await delay(5);}}
function stopped(ecs){Object.assign(ecs.state.task,{lastStatus:'STOPPED',desiredStatus:'STOPPED'});Object.assign(ecs.state.task.containers[0],{lastStatus:'STOPPED',exitCode:3});}
async function fixture(t,{pollMs=10,maxWaitMs=2000,readiness,observe}={}){
 const facts=originalFacts(),f=await lifecycleFixture();t.after(()=>f.close());
 await f.service.allocateInput({credential:f.credential,input:f.input});await f.service.submit({credential:f.credential,input:f.input});
 const ecs=fakeEcs(facts.original,facts.config.taskRequest),budget=syntheticAdmission(facts),calls={readiness:0,releases:0,closes:0,observations:0,reads:0};
 const store={...f.store,allocations:{...f.store.allocations,read(...args){calls.reads++;return f.store.allocations.read(...args);}}};
 const allocator=processAllocator({store,original:facts.original,config:facts.config,client:ecs.client,admission:budget.admission});
 const proof=()=>({original:facts.original,taskArn:ecs.state.task.taskArn,checkedAtMs:Date.now(),expiresAtMs:facts.original.expiresAtMs,released:calls.releases>0});
 const x={...facts,f,ecs,budget,calls,allocator,proof};
 const controller={allocate:allocator.allocate,async observe(value){calls.observations++;return observe?observe(x,value):allocator.observe(value);},async close(){calls.closes++;await allocator.stop();}};
 const owner=createPreparedTaskKickoff({original:facts.original,controller,store,runner:{async readiness(value){calls.readiness++;if(readiness)return readiness(x,value);throw Error('synthetic connection refusal');},async release(){calls.releases++;return proof();}},enabled:true,reconcile:true,maxWaitMs,cleanupMs:1000,...(pollMs===null?{}:{pollMs})});
 t.after(()=>owner.close().catch(()=>{}));
 const key={binding:facts.original.binding,allocationKey:facts.original.executionKey};
 return {...x,owner,start:()=>owner.kickoff({binding:key.binding,executionKey:key.allocationKey}),stop:()=>owner.stop({binding:key.binding,executionId:facts.original.executionId}),read:()=>f.store.allocations.read(key,()=>{}),history:()=>f.store.read(key.binding,{after:0,limit:100},()=>{})};
}

test('owned STOPPED before readiness ends polling and existing stop reconciles failed once',async t=>{
 const x=await fixture(t,{readiness(x){stopped(x.ecs);throw Error('runner exited before listener');}});await x.start();await until(()=>x.calls.closes===1);await x.stop();
 assert.equal(x.calls.readiness,1);assert.equal(x.calls.releases,0);assert.equal(x.ecs.state.runs,1);assert.equal(x.ecs.state.stops,0,'already STOPPED: no redundant StopTask');
 assert.equal((await x.read()).record.state,'RETIRED');const history=await x.history();assert.equal(history.run.state,'failed');assert.deepEqual(history.events.at(-1).data,{state:'failed',reasonCode:'ATTEMPT_LOST'});
 await x.stop();assert.equal((await x.history()).events.filter(e=>e.data?.state==='failed').length,1);
 const counts={...x.calls};await delay(40);assert.deepEqual(x.calls,counts,'no background polling after terminal observation');
});

test('the existing broker automatically stops and reconciles after startup observes STOPPED',async t=>{
 const x=await fixture(t,{readiness(x){stopped(x.ecs);throw Error('bootstrap exited');}}),operations=[];
 const native={async call(operation,input,{signal}={}){operations.push(operation);const method={'execution/kickoff':'kickoff','execution/kickoff/status':'status','execution/kickoff/stop':'stop'}[operation];assert.ok(method);return x.owner[method]({...input,signal});}};
 const execute=createBrokerActivity({native,pollMs:10,context:()=>({cancellationSignal:new AbortController().signal,heartbeat(){}})});
 await assert.rejects(execute({binding:x.original.binding}),/KICKOFF_UNKNOWN/);assert.equal(operations.filter(op=>op==='execution/kickoff/stop').length,1);
 assert.equal((await x.history()).run.state,'failed');assert.equal((await x.read()).record.state,'RETIRED');assert.equal(x.calls.releases,0);
});

test('canonical cancellation during failed readiness ends polling without another release or failed event',async t=>{
 const x=await fixture(t,{async readiness(x){await x.f.service.cancel({credential:x.f.credential});throw Error('readiness refused after cancellation');}});await x.start();await until(()=>x.calls.readiness===1);await delay(50);
 const count=x.calls.readiness;assert.equal((await x.history()).run.state,'cancelled');assert.equal((await x.owner.status({binding:x.original.binding,executionId:x.original.executionId})).state,'cancelled');
 await delay(30);assert.equal(x.calls.readiness,count);assert.equal(x.calls.releases,0);await x.stop();assert.equal((await x.history()).events.filter(e=>e.data?.state==='failed').length,0);
});

test('STOPPED races with a successful readiness proof: no release is sent',async t=>{
 const x=await fixture(t,{readiness(x){stopped(x.ecs);return x.proof();}});await x.start();await until(()=>x.calls.closes===1);await x.stop();assert.equal(x.calls.releases,0);assert.equal((await x.history()).run.state,'failed');
});

test('canonical cancellation races with successful readiness: no release is sent',async t=>{
 const x=await fixture(t,{async readiness(x){await x.f.service.cancel({credential:x.f.credential});return x.proof();}});await x.start();await until(()=>x.calls.readiness===1);await delay(40);assert.equal(x.calls.releases,0);assert.equal((await x.history()).run.state,'cancelled');
});

test('unknown task observation remains queued and later resumes without false terminal settlement',async t=>{
 let available=false;const x=await fixture(t,{observe(x,value){if(!available)throw Error('transient DescribeTasks failure');return x.allocator.observe(value);},readiness:x=>x.proof()});
 await x.start();await until(()=>x.calls.observations>=2);assert.equal((await x.history()).run.state,'queued');assert.equal(x.calls.readiness+x.calls.releases+x.calls.closes,0);assert.equal(x.budget.state.revokes,0);
 available=true;await until(()=>x.calls.releases===1);assert.equal((await x.history()).run.state,'queued');assert.equal(x.calls.closes,0);await x.stop();
});

for(const kind of ['wrong ARN','nonboolean stopped'])test(`malformed observation (${kind}) cannot become terminal proof or release`,async t=>{
 const x=await fixture(t,{observe:x=>kind==='wrong ARN'?{taskArn:x.ecs.state.task.taskArn.replace(/a$/u,'b'),stopped:true}:{taskArn:x.ecs.state.task.taskArn,stopped:'true'}});
 await x.start();await until(()=>x.calls.observations>=2);assert.equal(x.calls.readiness+x.calls.releases+x.calls.closes,0);assert.equal((await x.history()).run.state,'queued');await x.stop();
});

test('known STOPPED with uncertain revocation never fabricates a terminal write',async t=>{
 const x=await fixture(t,{readiness(x){x.budget.state.revokeWorks=false;stopped(x.ecs);throw Error('stopped');}});await x.start();await until(()=>x.calls.closes===1);await assert.rejects(x.stop(),/KICKOFF_UNKNOWN/);
 assert.equal((await x.history()).run.state,'queued');assert.equal((await x.read()).record.state,'ADMITTED');assert.equal(x.calls.releases,0);
});

test('request abort during task observation refuses without a late observation result',async t=>{
 const x=await fixture(t);await x.allocator.allocate();const abort=new AbortController();let entered=false;
 const originalSend=x.ecs.client.send;x.ecs.client.send=async(command,options)=>{entered=true;assert.equal(options.abortSignal.aborted,false);return new Promise((resolve,reject)=>options.abortSignal.addEventListener('abort',()=>reject(Error('observed cancellation')),{once:true}));};
 const allocator=processAllocator({store:x.f.store,original:x.original,config:x.config,client:x.ecs.client,admission:x.budget.admission});
 try{const pending=allocator.observe({signal:abort.signal});pending.catch(()=>{});await until(()=>entered);abort.abort();await assert.rejects(pending);}finally{x.ecs.client.send=originalSend;}
 assert.equal(x.budget.state.revokes,0);assert.equal((await x.read()).record.state,'ADMITTED');
});

test('default polling is one second and stop promptly aborts the idle pause',async t=>{
 const x=await fixture(t,{pollMs:null,maxWaitMs:3000});await x.start();await until(()=>x.calls.readiness===1);await delay(250);
 assert.equal(x.calls.readiness,1,'no 100 ms retry');assert.equal(x.calls.observations,1);const start=Date.now();await x.stop();assert.ok(Date.now()-start<500,'stop does not wait for the one-second timer');assert.equal(x.calls.readiness,1);
});

test('post-release task death while still queued is also observed and settled',async t=>{
 const x=await fixture(t,{readiness:x=>x.proof()});await x.start();await until(()=>x.calls.releases===1);stopped(x.ecs);await until(()=>x.calls.closes===1);await x.stop();assert.equal(x.calls.releases,1);assert.equal((await x.history()).run.state,'failed');
});

for(const kind of ['foreign tag','wrong task definition','missing worker exit','missing task','provider outage','wrong journal intent'])test(`allocator observation refuses ${kind} without mutation or terminal claim`,async t=>{
 const x=await fixture(t);await x.allocator.allocate();stopped(x.ecs);const before={runs:x.ecs.state.runs,stops:x.ecs.state.stops,admits:x.budget.state.admits,revokes:x.budget.state.revokes};
 if(kind==='foreign tag')x.ecs.state.task.tags[0].value='other';
 if(kind==='wrong task definition')x.ecs.state.task.taskDefinitionArn=x.ecs.state.task.taskDefinitionArn.replace(/:[0-9]+$/u,':999');
 if(kind==='missing worker exit')delete x.ecs.state.task.containers[0].exitCode;
 if(kind==='missing task')x.ecs.state.task=null;
 if(kind==='provider outage')x.ecs.state.outage=true;
 let allocator=x.allocator;if(kind==='wrong journal intent'){const config=structuredClone(x.config);config.taskRequest.networkConfiguration.awsvpcConfiguration.securityGroups=['sg-9999'];allocator=processAllocator({store:x.f.store,original:x.original,config,client:x.ecs.client,admission:x.budget.admission});}
 await assert.rejects(allocator.observe());assert.deepEqual({runs:x.ecs.state.runs,stops:x.ecs.state.stops,admits:x.budget.state.admits,revokes:x.budget.state.revokes},before);assert.equal((await x.read()).record.state,'ADMITTED');assert.equal((await x.history()).run.state,'queued');
});
