/** Independent synthetic SQL-protocol composition; no DB, HTTP listener or provider calls. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {applicationFixture} from '../../control/conversations/test/application-fixture.mjs';
import {createPostgresRunOwner} from '../../control/qualified-application/run-owner.mjs';
import {runOwnerFixture} from '../../control/qualified-application/run-owner.fixture.mjs';
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
  const q = runOwnerFixture({at:Date.now(),leaseMs:60000});
  const scopes = q.state.runs[0].projection.scopes;
  const f = await applicationFixture({scopes,binding:q.binding,...(options.retention?{retention:options.retention}:{})});
  t.after(() => f.close());
  const key = [q.binding.tenantId,q.binding.conversationId,q.binding.runId].join(':');
  f.state.conversations.set([q.binding.tenantId,q.binding.conversationId].join(':'),structuredClone(q.state.conversation));
  f.state.runs.set(key,structuredClone(q.state.runs[0]));
  f.state.events.set(key,[]);
  const owner = createPostgresRunOwner(q.configuration);
  let checks = 0;
  const native = {async call(operation,input) {
    assert.equal(operation,'worker/authorize');
    checks++;
    if(options.denyAt===checks)throw Error('Synthetic task refusal');
    q.state.now = Date.now();
    q.state.runs = [structuredClone(f.state.runs.get(key))];
    await owner.currentTaskRun(input.binding);
    const at = Date.now();
    return {binding:q.binding,operation:input.operation,inputSha256:input.inputSha256,
      identityCredential:'synthetic-current',scopes,selectedClientId:scopes[0].resourceId,
      policyRevision:scopes[0].policyRevision,authorizationDecisionId:'synthetic-current',
      checkedAtMs:at,expiresAtMs:q.expiresAtMs};
  }};
  let clockOffset=0;
  const service={...f.service,async publish(input){const receipt=await f.service.publish(input);
    options.afterPublish?.({expire:()=>{clockOffset=60001;}});
    return options.receipt?options.receipt(structuredClone(receipt)):receipt;}};
  const app = createWorkerRunApplication({service,sessions:f.sessions,native,now:()=>Date.now()+clockOffset,
    configuration:{limits:{requestMs:3000,requestBytes:131072}}});
  const request = event => new Request('https://control.synthetic.invalid/internal/conversations/publish',{
    method:'POST',headers:{authorization:'Bearer synthetic-task','content-type':'application/json'},
    body:JSON.stringify({binding:q.binding,event}),signal:options.signal});
  return {f,q,key,request,app,checks:()=>checks};
}

for (const state of ['completed','failed','cancelled']) {
  test(`terminal publication acknowledges the committed ${state} event`,async t => {
    const f = await fixture(t);
    const event = {eventId:'00000800-0000-4000-8000-000000000000',createdAt:new Date().toISOString(),
      type:'run.status',data:{state,reasonCode:state==='completed'?null:'EXECUTION_FAILED'}};
    const response = await f.app.handle(f.request(event));
    assert.equal(response.status,200);
    assert.equal(f.checks(),2,'terminal receipt follows the two pre-effect task checks');
    const row = f.f.state.runs.get(f.key);
    assert.equal(row.projection.state,state);
    assert.equal(row.projection_sha256,hash(row.projection));
    const events = f.f.state.events.get(f.key);
    assert.equal(events.length,1);
    assert.equal(events[0].event.eventId,event.eventId);
    assert.deepEqual(events[0].event.data,event.data);
    assert.ok(f.f.state.calls.includes('COMMIT'),'canonical append transaction committed');
    assert.deepEqual(await response.json(),events[0].event);
    const again = await f.app.handle(f.request({...event,eventId:'00000801-0000-4000-8000-000000000000'}));
    assert.equal(again.status,403,'new work remains refused once terminal');
    assert.equal(f.f.state.events.get(f.key).length,1);
  });
}

test('nonterminal delta keeps final current-run verification and returns the canonical receipt',async t => {
  const f = await fixture(t);
  const event = {eventId:'00000800-0000-4000-8000-000000000000',createdAt:new Date().toISOString(),
    type:'message.delta',data:{messageId:'00000801-0000-4000-8000-000000000000',text:'Synthetic output'}};
  const response = await f.app.handle(f.request(event));
  assert.equal(response.status,200);
  assert.equal(f.checks(),3);
  const receipt = await response.json();
  assert.deepEqual(receipt,f.f.state.events.get(f.key)[0].event);
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
  assert.equal(f.f.state.events.get(f.key).length,1,'receipt refusal never republishes');
});
for(const denyAt of [1,2])test(`terminal publication still requires pre-effect task check ${denyAt}`,async t=>{
  const f=await fixture(t,{denyAt});
  assert.equal((await f.app.handle(f.request(completion()))).status,403);
  assert.equal(f.f.state.events.get(f.key).length,0);
});
test('unknown append acknowledgement is never reported as successful',async t=>{
  const f=await fixture(t);f.f.state.commitUnknown=true;
  assert.notEqual((await f.app.handle(f.request(completion()))).status,200);
});
test('terminal acknowledgement retains the original authority expiry',async t=>{
  const f=await fixture(t,{afterPublish:({expire})=>expire()});
  assert.equal((await f.app.handle(f.request(completion()))).status,408);
  assert.equal(f.f.state.events.get(f.key).length,1);
});
test('cancellation after commit withholds the acknowledgement',async t=>{
  const controller=new AbortController();
  const f=await fixture(t,{signal:controller.signal,afterPublish:()=>controller.abort()});
  assert.notEqual((await f.app.handle(f.request(completion()))).status,200);
  assert.equal(f.f.state.events.get(f.key).length,1);
});
test('canonical service still rechecks retention after terminal commit',async t=>{
  let observations=0;
  const f=await fixture(t,{retention:{assertServable(){if(++observations===2)throw Error('Synthetic suppression');}}});
  assert.equal((await f.app.handle(f.request(completion()))).status,403);
  assert.equal(observations,2);
  assert.equal(f.f.state.events.get(f.key).length,1);
});
test('canonical service still rechecks identity after terminal commit',async t=>{
  const f=await fixture(t),connect=f.f.pool.connect.bind(f.f.pool);
  f.f.pool.connect=async()=>{const client=await connect(),query=client.query.bind(client);
    client.query=async(sql,...args)=>{const result=await query(sql,...args);if(sql==='COMMIT')f.f.state.revoked=true;return result;};return client;};
  assert.equal((await f.app.handle(f.request(completion()))).status,403);
  assert.equal(f.f.state.events.get(f.key).length,1);
});
