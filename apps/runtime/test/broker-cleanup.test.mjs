/**
 * Audit L5: every Temporal broker exit after dispatch closes the original through its stop owner.
 * Synthetic: the native owner's controller.close stands in for the admitted supervisor's physical task stop and grant
 * revocation, which its own suites and real ECS/PostgreSQL qualification own. No Temporal server, ECS, database or model.
 */
import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {createExecutionBinding} from '../../control/conversations/execution-boundary.mjs';
import {binding,versions} from '../../control/conversations/test/store-fixture.mjs';
import {createBrokerActivity} from '../temporal-worker.mjs';
import {validateConfiguration} from '../config.mjs';
import {createNativeCapabilityClient} from '../native-client.mjs';
import {createPreparedTaskKickoff} from '../native-authority/prepared-kickoff.mjs';
import {createPreparedKickoffApplication} from '../native-authority/prepared-kickoff-http.mjs';
import {createNativeExecutionApplication} from '../native-authority/execution-http.mjs';
import {listenFetch} from '../native-authority/test/task-verifier-fixture.mjs';
import {candidateFixture} from './prepared-candidate-fixture.mjs';

const control='synthetic-existing-control',task='synthetic-existing-task',sha=v=>createHash('sha256').update(v).digest('hex');
const taskArn='arn:aws:ecs:us-east-1:967807252336:task/meri/'+'a'.repeat(32);
// The activity's own cleanup lifetime: an original stop that does not settle inside it is BROKER_KICKOFF_CLEANUP_UNKNOWN.
const CLEANUP_BOUND_MS=3000;

test('audit probe: a default-constructed broker never uses execution/start and stops the original when cancelled after launch and poll',async()=>{
 const executionId=hash(binding),expiresAtMs=Date.now()+30000,calls=[],abort=new AbortController();let polls=0,stopLive=null;
 const run=createBrokerActivity({pollMs:10,context:()=>({cancellationSignal:abort.signal,heartbeat(){if(polls===1)abort.abort(Error('synthetic-heartbeat-cancel'));}}),native:{async call(op,input,{signal}){calls.push(op);
  if(op==='execution/start')throw Error('legacy start must not be called');
  if(op==='execution/kickoff/stop'){stopLive=!signal.aborted;return {binding,executionId,expiresAtMs};}
  if(op==='execution/kickoff')return {binding,executionId,expiresAtMs};
  if(op==='execution/kickoff/status')return {binding,executionId,expiresAtMs,state:'executing'};
  assert.equal(op,'execution/poll');polls++;return {binding,executionId,state:'executing'};}}});
 await assert.rejects(run({binding}),/synthetic-heartbeat-cancel/u);
 assert.deepEqual(calls,['execution/kickoff','execution/kickoff/status','execution/poll','execution/kickoff/stop']);
 assert.equal(stopLive,true,'the original stop runs on an independent live signal');
});

test('temporal-worker startup refuses the unsupported non-prepared mode',()=>{
 const {configuration}=candidateFixture(),{native,http,temporal,version,profile,sourceEnabled,limits}=configuration,base={http,temporal,version,profile,sourceEnabled,limits};
 assert.doesNotThrow(()=>validateConfiguration({...base,native:{...native,preparedKickoff:true}},'temporal-worker'));
 for(const value of [undefined,false,'true',1]){const n={...native};if(value!==undefined)n.preparedKickoff=value;assert.throws(()=>validateConfiguration({...base,native:n},'temporal-worker'),/PREPARED_KICKOFF_CONFIGURATION/u,String(value));}
});

/** Actual loopback HTTP: broker activity -> native capability client -> real kickoff and execution routes -> real prepared kickoff owner. */
async function composition(t,{loseKickoffAck=false,blockPoll=false,now}={}){
 const original=createExecutionBinding({binding,versions,plan:{synthetic:'broker-cleanup'},expiresAtMs:Date.now()+30000});
 const effects={terminated:false,revoked:false,closedAt:null,closes:0,stopRequests:0,kickoffs:0,polls:0,starts:0};
 const pollEntered=Promise.withResolvers(),teardown=Promise.withResolvers();teardown.promise.catch(()=>{});
 let record={state:'CLAIMED',original,resource:null};
 const proof=released=>({original,taskArn,checkedAtMs:Date.now(),expiresAtMs:original.expiresAtMs,released});
 const controller={
  allocate:async()=>{record={state:'ADMITTED',original,resource:{taskArn}};return {original,resource:{taskArn}};},
  close:async()=>{effects.closes++;effects.terminated=true;effects.revoked=true;effects.closedAt??=Date.now();},
  prepared:{stack:{broker:{poll:async()=>({binding,executionId:original.executionId,state:'executing'})}}}};
 const owner=createPreparedTaskKickoff({original,controller,store:{allocations:{read:async()=>({record,run:{binding,state:'queued'}})}},
  runner:{readiness:async()=>proof(false),release:async()=>{record.resource.launchBinding={state:'STARTED'};return proof(true);}},
  enabled:true,maxWaitMs:2000,pollMs:10,cleanupMs:2000});
 const observed={kickoff:owner.kickoff,status:owner.status,stop:value=>{effects.stopRequests++;return owner.stop(value);}};
 const kickoffApp=createPreparedKickoffApplication({owner:{...observed,kickoff:value=>{effects.kickoffs++;return owner.kickoff(value);}},controlCapabilitySha256:sha(control),enabled:true});
 const executionApp=createNativeExecutionApplication({broker:{start:async()=>{effects.starts++;throw Error('legacy start must not be called');},poll:async({signal})=>{effects.polls++;
   if(!blockPoll)return {binding,executionId:original.executionId,state:'executing'};
   pollEntered.resolve();await new Promise((resolve,reject)=>{signal.addEventListener('abort',()=>reject(Error('poll-aborted')),{once:true});teardown.promise.then(()=>reject(Error('poll-teardown')));});}},
  runtime:{taskCapabilitySha256:sha(task),runtime:async()=>{throw Error('unused');}},controlCapabilitySha256:sha(control),taskCapabilitySha256:sha(task),enabled:true,maxRequestMs:30000});
 const listener=await listenFetch({async handle(request){return await kickoffApp.handle(request)??await executionApp.handle(request);}});
 t.after(async()=>{teardown.resolve();await owner.close().catch(()=>{});await listener.close();});
 const transport=async(url,init)=>{const response=await fetch(url,init);if(loseKickoffAck&&url.endsWith('/v1/execution/kickoff')){await response.body?.cancel();throw new TypeError('synthetic lost kickoff acknowledgment');}return response;};
 const native=createNativeCapabilityClient({configuration:{origin:listener.origin,maxResponseBytes:131072},credential:control,fetch:transport});
 const abort=new AbortController();let beats=0;const beat=Promise.withResolvers();
 const run=createBrokerActivity({pollMs:10,...(now?{now}:{}),native,context:()=>({cancellationSignal:abort.signal,heartbeat(){beats++;beat.resolve();}})});
 return {run,abort,effects,pollEntered:pollEntered.promise,firstBeat:beat.promise,beats:()=>beats};
}
async function until(check){const deadline=Date.now()+5000;while(!check()){if(Date.now()>=deadline)throw Error('TEST_TIMEOUT');await new Promise(resolve=>setTimeout(resolve,5));}}
function assertClosedWithin(effects,from){assert.equal(effects.stopRequests,1);assert.equal(effects.closes,1);assert.equal(effects.terminated,true);assert.equal(effects.revoked,true);assert.equal(effects.starts,0);assert.ok(effects.closedAt-from<CLEANUP_BOUND_MS,`closed ${effects.closedAt-from}ms after the trigger`);}

test('cancellation after actual launch stops and revokes the original before the activity settles',async t=>{
 const f=await composition(t),pending=f.run({binding});pending.catch(()=>{});
 await until(()=>f.effects.polls>=2);const cancelledAt=Date.now();f.abort.abort(Error('synthetic-user-cancel'));
 await assert.rejects(pending,/synthetic-user-cancel|CANCELLED/u);assertClosedWithin(f.effects,cancelledAt);assert.equal(f.effects.kickoffs,1);
});

test('a lost kickoff acknowledgment still stops the dispatched original by its execution key',async t=>{
 const f=await composition(t,{loseKickoffAck:true}),startedAt=Date.now();
 await assert.rejects(f.run({binding}),/NATIVE_UNAVAILABLE/u);
 assert.equal(f.effects.kickoffs,1,'the native owner received the dispatch whose acknowledgment was lost');assert.equal(f.beats(),0);assertClosedWithin(f.effects,startedAt);
});

test('cancellation during a blocked poll stops and revokes the original within the cleanup bound',async t=>{
 const f=await composition(t,{blockPoll:true}),pending=f.run({binding});pending.catch(()=>{});
 await f.pollEntered;const cancelledAt=Date.now();f.abort.abort(Error('synthetic-cancel-during-poll'));
 await assert.rejects(pending,/synthetic-cancel-during-poll|CANCELLED/u);assertClosedWithin(f.effects,cancelledAt);
});

test('lease expiry while executing stops and revokes the original',async t=>{
 let skew=0;const f=await composition(t,{now:()=>Date.now()+skew}),pending=f.run({binding});pending.catch(()=>{});
 await until(()=>f.effects.polls>=1);const expiredAt=Date.now();skew=60000;
 await assert.rejects(pending,/BROKER_LEASE_EXPIRED/u);assertClosedWithin(f.effects,expiredAt);
});
