/** Independent synthetic SQL-protocol composition; no DB, HTTP listener or provider calls. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {applicationFixture} from '../../control/conversations/test/application-fixture.mjs';
import {createConversationService} from '../../control/conversations/service.mjs';
import {createExecutionSessions} from '../execution-sessions.mjs';
import {executionIdentity} from '../../control/conversations/execution-boundary.mjs';
import {createAgentCoreExecutionOwner} from '../agentcore-execution.mjs';
import {binding,scopes,versions,id} from '../../control/conversations/test/store-fixture.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';

// Import-only config stub already used by the repository's closed worker HTTP tests.
// Configuration/secret loading is outside this fixture and must not execute.
registerHooks({resolve(specifier, context, next) {
  if (specifier === './config.mjs' && context.parentURL?.endsWith('/apps/runtime/worker-http.mjs')) {
    return {url:new URL('../../control/conversations/test/load-only-runtime-config-stub.mjs',import.meta.url).href,shortCircuit:true};
  }
  return next(specifier, context);
}});
const {createWorkerRunApplication} = await import('../worker-http.mjs');

async function fixture(t,options={}) {
  const f=await applicationFixture({initialInput:true});t.after(()=>f.close());
  await f.service.allocateInput({credential:f.credential,input:f.input});await f.service.submit({credential:f.credential,input:f.input});
  let credential,checks=0,clockOffset=0;const now=()=>Date.now()+clockOffset,expiresAtMs=Date.now()+60000;
  const actual=createAgentCoreExecutionOwner({store:f.store,versions,plan:{synthetic:'http'},credentialSecret:'synthetic-only-credential-secret-32-bytes',now,
   admit:async()=>({run:(await f.store.read(binding,{after:0,limit:1},()=>{})).run,expiresAtMs}),contextFor:async()=>{if(f.state.revoked)throw Error('Synthetic revoked execution');return {selectedClientId:scopes[0].resourceId};},
   provider:{async invoke(input){credential=input.credential;throw Error('synthetic no-provider transport');},stop:()=>assert.fail('No Stop in HTTP fixture')}});
  await actual.kickoff({binding,executionKey:hash(binding)});await new Promise(resolve=>setImmediate(resolve));
  for(const state of ['starting','running'])await f.store.append(binding,{eventId:id(state==='starting'?790:791),createdAt:new Date().toISOString(),type:'run.status',data:{state,reasonCode:null}},()=>{});
  const key=[binding.tenantId,binding.conversationId,binding.runId].join(':'),base=f.state.events.get(key).length;
  const execution={async authenticate(input){checks++;if(options.denyAt===checks)throw Error('Synthetic execution refusal');return actual.authenticate(input);}};
  const createService=({credential,binding})=>{const sessions=createExecutionSessions({execution,credential,binding,now});
   const service=createConversationService({sessions,store:f.store,dispatcher:f.dispatcher,versions,now,...(options.retention?{retention:options.retention}:{})});
   return {...service,async publish(input){const receipt=await service.publish(input);options.afterPublish?.({expire:()=>{clockOffset=60001;}});return options.receipt?options.receipt(structuredClone(receipt)):receipt;}};
  };
  const app=createWorkerRunApplication({execution,createService,now,configuration:{limits:{requestMs:3000,requestBytes:131072}}});
  const request=event=>new Request('https://control.synthetic.invalid/internal/conversations/publish',{method:'POST',headers:{authorization:'Bearer '+credential,'content-type':'application/json'},body:JSON.stringify({binding,event}),signal:options.signal});
  const call=(route,body)=>app.handle(new Request('https://control.synthetic.invalid/internal/conversations/'+route,{method:'POST',headers:{authorization:'Bearer '+credential,'content-type':'application/json'},body:JSON.stringify({binding,...body})}));
  return {f,q:{binding,expiresAtMs},key,request,app,call,settle:state=>actual.settle({credential,execution:executionIdentity(f.state.executions.get(key).record),state}),checks:()=>checks,events:()=>f.state.events.get(key).slice(base)};
}

for (const state of ['completed','failed','cancelled']) {
  test(`terminal publication acknowledges the committed ${state} event`,async t => {
    const f = await fixture(t);
    const event = {eventId:'00000800-0000-4000-8000-000000000000',createdAt:new Date().toISOString(),
      type:'run.status',data:{state,reasonCode:state==='completed'?null:'EXECUTION_FAILED'}};
    const response = await f.app.handle(f.request(event));
    assert.equal(response.status,200);
    assert.equal(f.checks(),3,'boundary plus canonical service before/after execution checks');
    const row = f.f.state.runs.get(f.key);
    assert.equal(row.projection.state,state);
    assert.equal(row.projection_sha256,hash(row.projection));
    const events = f.events();
    assert.equal(events.length,1);
    assert.equal(events[0].event.eventId,event.eventId);
    assert.deepEqual(events[0].event.data,event.data);
    assert.ok(f.f.state.calls.includes('COMMIT'),'canonical append transaction committed');
    assert.deepEqual(await response.json(),events[0].event);
    const again = await f.app.handle(f.request({...event,eventId:'00000801-0000-4000-8000-000000000000'}));
    assert.equal(again.status,403,'new work remains refused once terminal');
    assert.equal(f.events().length,1);
  });
}

test('nonterminal delta keeps final current-run verification and returns the canonical receipt',async t => {
  const f = await fixture(t);
  const event = {eventId:'00000800-0000-4000-8000-000000000000',createdAt:new Date().toISOString(),
    type:'message.delta',data:{messageId:'00000801-0000-4000-8000-000000000000',text:'Synthetic output'}};
  const response = await f.app.handle(f.request(event));
  assert.equal(response.status,200);
  assert.equal(f.checks(),4);
  const receipt = await response.json();
  assert.deepEqual(receipt,f.events()[0].event);
  assert.equal(f.f.state.runs.get(f.key).projection.state,'running');
});

const completion=()=>({eventId:'00000800-0000-4000-8000-000000000000',createdAt:new Date().toISOString(),
  type:'run.status',data:{state:'completed',reasonCode:null}});
const alteredReceipts={
  missing:()=>null,
  sequence:r=>({...r,sequence:-1}),
  contract:r=>({...r,contractVersion:'invalid'}),
  binding:r=>({...r,binding:{...r.binding,writerFence:r.binding.writerFence+1}}),
  scopes:r=>({...r,scopes:[]}),
  event:r=>({...r,eventId:'00000802-0000-4000-8000-000000000000'}),
  time:r=>({...r,createdAt:'2026-01-01T00:00:00.000Z'}),
  state:r=>({...r,data:{state:'failed',reasonCode:'EXECUTION_FAILED'}}),
  type:r=>({...r,type:'message.delta',data:{messageId:'00000802-0000-4000-8000-000000000000',text:'foreign'}}),
};
for(const [name,receipt] of Object.entries(alteredReceipts))test(`terminal acknowledgement refuses a ${name} receipt`,async t=>{
  const f=await fixture(t,{receipt});
  const response=await f.app.handle(f.request(completion()));
  assert.equal(response.status,403);
  assert.equal(f.events().length,1,'receipt refusal never republishes');
});
for(const denyAt of [1,2])test(`terminal publication still requires pre-effect execution check ${denyAt}`,async t=>{
  const f=await fixture(t,{denyAt});
  assert.equal((await f.app.handle(f.request(completion()))).status,403);
  assert.equal(f.events().length,0);
});
test('unknown append acknowledgement is never reported as successful',async t=>{
  const f=await fixture(t);f.f.state.commitUnknown=true;
  assert.notEqual((await f.app.handle(f.request(completion()))).status,200);
});
test('terminal acknowledgement retains the original authority expiry',async t=>{
  const f=await fixture(t,{afterPublish:({expire})=>expire()});
  assert.equal((await f.app.handle(f.request(completion()))).status,408);
  assert.equal(f.events().length,1);
});
test('cancellation after commit withholds the acknowledgement',async t=>{
  const controller=new AbortController();
  const f=await fixture(t,{signal:controller.signal,afterPublish:()=>controller.abort()});
  assert.notEqual((await f.app.handle(f.request(completion()))).status,200);
  assert.equal(f.events().length,1);
});
test('canonical service still rechecks retention after terminal commit',async t=>{
  let observations=0;
  const f=await fixture(t,{retention:{assertServable(){if(++observations===2)throw Error('Synthetic suppression');}}});
  assert.equal((await f.app.handle(f.request(completion()))).status,403);
  assert.equal(observations,2);
  assert.equal(f.events().length,1);
});
test('canonical service still rechecks identity after terminal commit',async t=>{
  const f=await fixture(t),connect=f.f.pool.connect.bind(f.f.pool);
  f.f.pool.connect=async()=>{const client=await connect(),query=client.query.bind(client);
    let wrote=false;client.query=async(sql,...args)=>{const result=await query(sql,...args);if(sql.startsWith('INSERT INTO meri_conversations.events'))wrote=true;if(sql==='COMMIT'&&wrote)f.f.state.revoked=true;return result;};return client;};
  assert.equal((await f.app.handle(f.request(completion()))).status,403);
  assert.equal(f.events().length,1);
});

test('actual execution/store/local adapter composes load, publish, usage replay and terminal fencing without a user session',async t=>{
 const f=await fixture(t);const loaded=await f.call('load',{});assert.equal(loaded.status,200);assert.equal((await loaded.json()).run.state,'running');
 const delta={eventId:id(810),createdAt:new Date().toISOString(),type:'message.delta',data:{messageId:id(811),text:'synthetic composed output'}};
 assert.equal((await f.call('publish',{event:delta})).status,200);assert.equal((await f.call('publish',{event:completion()})).status,200);
 const input={usage:null,toolsUsed:{tools:[],omitted:0}},usage=await f.call('record-usage',{input});assert.equal(usage.status,200);const first=await usage.json();assert.equal(first.replayed,false);
 const replay=await f.call('record-usage',{input});assert.equal(replay.status,200);assert.equal((await replay.json()).replayed,true);assert.ok(f.f.state.runs.get(f.key).sdk_usage_sha256);
 assert.equal(f.events().length,2);await f.settle('completed');assert.equal((await f.call('load',{})).status,403);assert.equal((await f.call('record-usage',{input})).status,403);assert.equal(f.events().length,2);
});
