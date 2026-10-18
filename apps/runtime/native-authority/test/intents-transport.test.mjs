/** SYNTHETIC P-INT-9: the runner intents client -> the control intents application -> the actual control intent mount over the
 * actual task.create proposal owners (control intent fixture), and the actual worker `meri_intents` server using the client as its
 * port. The task-capability check is a synthetic `resolveRun`; no listener, TLS, registry, Core or database is involved. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRunnerIntentsApplication,RUNNER_INTENT_PATHS} from '../intents-http.mjs';
import {createRunnerIntentsClient,runnerIntentFault} from '../intents-client.mjs';
import {capabilityDigest} from '../task-verifier.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {intentFixture,mountIntents} from '../../../worker/conversation/intents/test/fixture.mjs';
import {delivery} from '../../../control/intents/test/fixture.mjs';
const ORIGIN='https://control.synthetic.invalid',TASK='task-capability-synthetic',CONTROL='control-capability-synthetic';
const CREATE={id:'create_task',version:'0.2.0'};
function setup({enabled=true,clientEnabled=true,mount,limits,fetchHook,responseHook}={}){
 const f=intentFixture({approverActorId:'actor'}),resolved=[],wire=[];
 // Synthetic stand-in for the registry entry: exactly this run's binding and its issued task capability.
 const resolveRun=async({binding,credential,operation})=>{resolved.push(operation);if(hash(binding)!==hash(f.binding)||credential!==TASK)throw runnerIntentFault('ACCESS_DENIED');return mount?mount(f):f.port;};
 const app=createRunnerIntentsApplication({resolveRun,enabled,now:f.now,controlCapabilitySha256:capabilityDigest(CONTROL),...(limits?{limits}:{})});
 const fetchImpl=async(url,init)=>{wire.push({url,init});await fetchHook?.(url,init);const response=await app.handle(new Request(url,init));return responseHook?responseHook(response):response;};
 const client=createRunnerIntentsClient({origin:ORIGIN,credential:TASK,binding:f.binding,fetchImpl,enabled:clientEnabled,now:f.now});
 const post=(path,body,{credential=TASK,headers={},method='POST'}={})=>app.handle(new Request(ORIGIN+path,{method,headers:{'content-type':'application/json',...(credential?{authorization:'Bearer '+credential}:{}),...headers},...(method==='POST'?{body:typeof body==='string'?body:JSON.stringify(body)}:{})}));
 return {f,app,client,resolved,wire,post};
}
const failed=c=>e=>e?.code===c;
test('client -> control -> actual mount: availability and one proposal; a repeated delivery replays without a second preparation',async()=>{
 const s=setup();
 const availability=await s.client.readAvailability();assert.deepEqual(availability.operations,[CREATE]);assert.equal(hash(availability.binding),hash(s.f.binding));
 const first=await s.client.prepare({operation:CREATE,arguments:{title:'Task'},deliveryId:delivery(1)});assert.equal(first.status,'approval_required');assert.equal(s.f.metadataCalls.prepare,1);
 const again=await s.client.prepare({operation:CREATE,arguments:{title:'Task'},deliveryId:delivery(1)});assert.deepEqual(again,first);assert.equal(s.f.metadataCalls.prepare,1,'the journal replayed');
 await assert.rejects(s.client.prepare({operation:CREATE,arguments:{title:'Other'},deliveryId:delivery(1)}),failed('CONFLICT'));
 assert.deepEqual(s.resolved,['runner/intents/availability','runner/intents/prepare','runner/intents/prepare','runner/intents/prepare']);
 assert.ok(s.wire.every(w=>w.init.headers.authorization==='Bearer '+TASK&&w.init.redirect==='error'&&JSON.parse(w.init.body).binding.runId===s.f.binding.runId));
 assert.equal(s.f.f.state.fetches,0,'preparation never executes');
});
test('the actual worker meri_intents server accepts the client as its governedIntents port',async()=>{
 const s=setup(),m=await mountIntents(s.f,{port:s.client});
 try{assert.deepEqual([...m.runtime.sdkOptions.allowedTools],['mcp__meri_intents__propose_task']);
  const r=await m.call('propose_task',{operation:'create_task',arguments:{title:'Task'}});assert.equal(r.isError,undefined);assert.equal(JSON.parse(r.content[0].text).status,'approval_required');
  assert.equal(s.f.metadataCalls.prepare,1);
 }finally{await m.close();}
});
test('only this run\'s task capability reaches the mount; the control capability is refused before resolveRun',async()=>{
 const s=setup();
 for(const credential of ['other-capability',CONTROL]){const r=await s.post(RUNNER_INTENT_PATHS.availability,{binding:s.f.binding},{credential});assert.equal(r.status,403);assert.deepEqual(await r.json(),{error:{code:'ACCESS_DENIED'}});}
 assert.deepEqual(s.resolved,['runner/intents/availability'],'the control credential never reached resolveRun');
 const foreign=await s.post(RUNNER_INTENT_PATHS.availability,{binding:{...s.f.binding,runId:'00000000-0000-4000-8000-000000000999'}});assert.equal(foreign.status,403);
 assert.equal(s.f.metadataCalls.prepare,0);
});
test('fixed routes: method, query, bearer, media, size and closed bodies refuse before resolveRun',async()=>{
 const s=setup({limits:{maxRequestBytes:2048,maxResponseBytes:262144,maxPrepareMs:5000}}),b={binding:{}};b.binding=s.f.binding;
 assert.equal((await s.post(RUNNER_INTENT_PATHS.availability,null,{method:'GET'})).status,405);
 assert.equal((await s.post(RUNNER_INTENT_PATHS.availability+'?x=1',b)).status,404);
 assert.equal((await s.post('/v1/runner/intents/other',b)).status,404);
 assert.equal((await s.post(RUNNER_INTENT_PATHS.availability,b,{credential:null})).status,401);
 assert.equal((await s.post(RUNNER_INTENT_PATHS.availability,b,{headers:{'content-type':'text/plain'}})).status,400);
 assert.equal((await s.post(RUNNER_INTENT_PATHS.prepare,{...b,operation:CREATE,arguments:{title:'x'.repeat(4096)},deliveryId:delivery(1)})).status,413);
 for(const body of [{...b,extra:1},{binding:{...s.f.binding,tenantId:7}},{...b,operation:CREATE,arguments:[],deliveryId:delivery(1)},{...b,operation:{id:'create_task',version:'0.1.0'},arguments:{},deliveryId:delivery(1)},{...b,operation:CREATE,arguments:{},deliveryId:'sdk:x'}]){
  const route=Object.hasOwn(body,'operation')?RUNNER_INTENT_PATHS.prepare:RUNNER_INTENT_PATHS.availability,r=await s.post(route,body);assert.equal(r.status,400,JSON.stringify(body));assert.deepEqual(await r.json(),{error:{code:'INVALID_ARGUMENTS'}});
 }
 assert.equal((await s.post(RUNNER_INTENT_PATHS.prepare,'{"binding":')).status,400);
 assert.deepEqual(s.resolved,[]);assert.equal(s.f.metadataCalls.prepare,0);
});
test('disabled application and disabled client are UNAVAILABLE without dispatch',async()=>{
 const off=setup({enabled:false});const r=await off.post(RUNNER_INTENT_PATHS.availability,{binding:off.f.binding});assert.equal(r.status,503);assert.deepEqual(await r.json(),{error:{code:'UNAVAILABLE'}});assert.deepEqual(off.resolved,[]);
 await assert.rejects(off.client.readAvailability(),failed('UNAVAILABLE'));
 const quiet=setup({clientEnabled:false});await assert.rejects(quiet.client.readAvailability(),failed('UNAVAILABLE'));await assert.rejects(quiet.client.prepare({operation:CREATE,arguments:{},deliveryId:delivery(1)}),failed('UNAVAILABLE'));assert.equal(quiet.wire.length,0);
});
test('availability for another binding or with malformed facts is withheld as UNAVAILABLE',async()=>{
 for(const change of [a=>({...a,binding:{...a.binding,runId:'00000000-0000-4000-8000-000000000999'}}),a=>({...a,expiresAtMs:a.checkedAtMs}),a=>({...a,operations:[{id:'Create',version:'0.2.0'}]}),a=>({...a,extra:true})]){
  const s=setup({mount:f=>({readAvailability:async v=>change(await f.port.readAvailability(v)),prepare:v=>f.port.prepare(v)})});
  await assert.rejects(s.client.readAvailability(),failed('UNAVAILABLE'));
 }
});
test('client: transport loss is UNAVAILABLE before a prepare is sent and UNKNOWN after; malformed answers never become refusals',async()=>{
 const lost=setup({fetchHook:()=>{throw Error('synthetic connection reset');}});
 await assert.rejects(lost.client.readAvailability(),failed('UNAVAILABLE'));
 await assert.rejects(lost.client.prepare({operation:CREATE,arguments:{title:'Task'},deliveryId:delivery(1)}),failed('UNKNOWN'));
 const after=setup({responseHook:async response=>{await response.text();throw Error('synthetic reply lost');}});
 await assert.rejects(after.client.prepare({operation:CREATE,arguments:{title:'Task'},deliveryId:delivery(2)}),failed('UNKNOWN'));assert.equal(after.f.metadataCalls.prepare,1,'the proposal exists although the reply was lost');
 const mislabelled=setup({responseHook:async()=>Response.json({error:{code:'REFUSED'}},{status:503})});
 await assert.rejects(mislabelled.client.prepare({operation:CREATE,arguments:{title:'Task'},deliveryId:delivery(3)}),failed('UNKNOWN'));
 const huge=setup({responseHook:async()=>Response.json({status:'approval_required',pad:'x'.repeat(300000)})});
 await assert.rejects(huge.client.prepare({operation:CREATE,arguments:{title:'Task'},deliveryId:delivery(4)}),failed('UNKNOWN'));
 const local=setup();await assert.rejects(local.client.prepare({operation:CREATE,arguments:[],deliveryId:delivery(5)}),failed('INVALID_ARGUMENTS'));
 await assert.rejects(local.client.prepare({operation:CREATE,arguments:{},deliveryId:delivery(5),binding:local.f.binding}),failed('INVALID_ARGUMENTS'));assert.equal(local.wire.length,0);
 const refused=setup({mount:()=>({readAvailability:async()=>{throw runnerIntentFault('UNAVAILABLE');},prepare:async()=>{throw Object.assign(Error('REFUSED'),{code:'REFUSED'});}})});
 await assert.rejects(refused.client.prepare({operation:CREATE,arguments:{title:'Task'},deliveryId:delivery(6)}),failed('REFUSED'),'an owner-closed refusal passes through');
});
test('control: a prepare cancelled after it reached the mount answers UNKNOWN, never a retryable refusal',async()=>{
 let entered;const reached=new Promise(r=>{entered=r;});
 const s=setup({mount:f=>({readAvailability:v=>f.port.readAvailability(v),prepare:()=>{entered();return new Promise(()=>{});}})});
 const abort=new AbortController(),pending=s.app.handle(new Request(ORIGIN+RUNNER_INTENT_PATHS.prepare,{method:'POST',signal:abort.signal,headers:{'content-type':'application/json',authorization:'Bearer '+TASK},
  body:JSON.stringify({binding:s.f.binding,operation:CREATE,arguments:{title:'Task'},deliveryId:delivery(1)})}));
 await reached;abort.abort();const r=await pending;assert.equal(r.status,502);assert.deepEqual(await r.json(),{error:{code:'UNKNOWN'}});
 const thrown=setup({mount:()=>({readAvailability:async()=>null,prepare:async()=>{throw Error('private owner detail');}})});
 const t=await thrown.post(RUNNER_INTENT_PATHS.prepare,{binding:thrown.f.binding,operation:CREATE,arguments:{title:'Task'},deliveryId:delivery(1)});assert.equal(t.status,502);assert.deepEqual(await t.json(),{error:{code:'UNKNOWN'}});
});
test('construction is inert and closed',()=>{
 let calls=0;const resolveRun=async()=>{calls++;};
 createRunnerIntentsApplication({resolveRun});createRunnerIntentsClient({origin:ORIGIN,credential:TASK,binding:intentFixture().binding,fetchImpl:async()=>{calls++;}});assert.equal(calls,0);
 assert.throws(()=>createRunnerIntentsApplication({resolveRun,limits:{maxRequestBytes:0,maxResponseBytes:1,maxPrepareMs:1000}}));
 assert.throws(()=>createRunnerIntentsApplication({resolveRun,controlCapabilitySha256:'x'}));
 for(const origin of ['http://control.synthetic.invalid','https://control.synthetic.invalid/v1','https://u@control.synthetic.invalid','https://control.synthetic.invalid?x=1'])
  assert.throws(()=>createRunnerIntentsClient({origin,credential:TASK,binding:intentFixture().binding,fetchImpl:async()=>{}}),failed('UNAVAILABLE'),origin);
 assert.throws(()=>createRunnerIntentsClient({origin:ORIGIN,credential:'has space',binding:intentFixture().binding,fetchImpl:async()=>{}}),failed('UNAVAILABLE'));
});
