/** Synthetic fixed Core transport checks. No Core response is treated as generation authority. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {createCoreObjectiveGenerationTransport} from '../core-http.mjs';

const at=1760650000000,id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const sha256Utf8=value=>createHash('sha256').update(value,'utf8').digest('hex');
const binding=()=>({tenantId:id(1),actorId:'user_synthetic_clerk',conversationId:id(2),runId:id(3),attemptId:id(4),workerId:id(5),writerFence:1});
const source=()=>({generationJobId:id(6),binding:binding()});
function setup(changes={}){
 const state={calls:[],credentials:[]},original=source();
 const authorization={async readCredential(call){state.credentials.push(call);return {
  credential:'synthetic-delegated-core',actorId:original.binding.actorId,tenantId:original.binding.tenantId,
  generationJobId:original.generationJobId,operation:call.operation,method:call.method,route:call.route,phase:call.phase,
  sourceSha256:call.sourceSha256,requestSha256:call.requestSha256,bodySha256:call.bodySha256,checkedAtMs:at,expiresAtMs:at+1000,
 };}};
 const fetchImpl=async(url,options)=>{state.calls.push({url,options});return Response.json({opaque:'transport-only'},{status:options.method==='POST'?201:200});};
 const config={origin:'https://core.synthetic.invalid',source:original,fetchImpl,authorization,enabled:true,now:()=>at,maxRequestMs:100,...changes};
 return {original,state,authorization,client:createCoreObjectiveGenerationTransport(config),call:{deadlineMs:at+500}};
}

for(const [phase,path] of Object.entries({
 admit:'generation-admissions',publish:'generation-requests',accept:'generation-acceptances',complete:'generation-completions',
}))test(`initial ${phase} sends only the Core-owned job reference on a fixed POST route`,async()=>{
 const f=setup(),reply=await f.client[phase](f.call),sent=f.state.calls[0],body={schemaVersion:1,generationJobId:f.original.generationJobId};
 assert.deepEqual(reply,{kind:'unqualified-response',status:201,value:{opaque:'transport-only'}});
 assert.equal(f.state.calls.length,1);
 assert.equal(sent.url,`https://core.synthetic.invalid/strategy-api/internal/objective-canonical/${path}`);
 assert.equal(new URL(sent.url).search,'');
 assert.equal(sent.options.method,'POST');assert.deepEqual(JSON.parse(sent.options.body),body);
 assert.equal(sent.options.redirect,'error');assert.equal(sent.options.credentials,'omit');assert.equal(sent.options.cache,'no-store');
 assert.equal(sent.options.headers.authorization,'Bearer synthetic-delegated-core');assert.equal(sent.options.headers['accept-encoding'],'identity');
 assert.equal(Object.hasOwn(sent.options.headers,'x-meri-deadline-at'),false);
 assert.equal(sent.options.signal.aborted,true);
 assert.equal(f.state.credentials.length,2);
 for(const credential of f.state.credentials){
  assert.equal(credential.operation,'objective.strategy.draft');assert.equal(credential.phase,phase);assert.equal(credential.method,'POST');
  assert.equal(credential.route,`/strategy-api/internal/objective-canonical/${path}`);
  assert.equal(credential.route.includes('?'),false);
  assert.equal(credential.requestSha256,canonicalSha256(body));
  assert.equal(credential.bodySha256,sha256Utf8(sent.options.body));
  assert.notEqual(credential.bodySha256,credential.requestSha256);
  assert.equal(credential.sourceSha256,canonicalSha256(f.original));
  assert.deepEqual(credential.source,f.original);
 }
});

for(const [method,phase,path] of [
 ['readAdmission','admission-read','generation-admissions'],
 ['readRequest','request-read','generation-requests'],
 ['readCompletion','completion-read','generation-completions'],
])test(`${method} uses the fixed Core GET readback and a body-free job identity`,async()=>{
 const f=setup(),reply=await f.client[method](f.call),sent=f.state.calls[0],identity={schemaVersion:1,generationJobId:f.original.generationJobId};
 assert.deepEqual(reply,{kind:'unqualified-response',status:200,value:{opaque:'transport-only'}});
 assert.equal(f.state.calls.length,1);
 assert.equal(sent.url,`https://core.synthetic.invalid/strategy-api/internal/objective-canonical/${path}/${f.original.generationJobId}`);
 assert.equal(new URL(sent.url).search,'');
 assert.equal(sent.options.method,'GET');assert.equal(Object.hasOwn(sent.options,'body'),false);
 assert.equal(Object.hasOwn(sent.options.headers,'content-type'),false);
 assert.equal(sent.options.redirect,'error');assert.equal(sent.options.credentials,'omit');assert.equal(sent.options.cache,'no-store');
 assert.equal(Object.hasOwn(sent.options.headers,'x-meri-deadline-at'),false);
 assert.equal(f.state.credentials.length,2);
 for(const credential of f.state.credentials){
  assert.equal(credential.phase,phase);assert.equal(credential.method,'GET');
  assert.equal(credential.route,`/strategy-api/internal/objective-canonical/${path}/${f.original.generationJobId}`);
  assert.equal(credential.route.includes('?'),false);
  assert.equal(credential.requestSha256,canonicalSha256(identity));
  assert.equal(credential.bodySha256,sha256Utf8(''));
  assert.equal(credential.sourceSha256,canonicalSha256(f.original));
 }
});

test('only POST 201 and GET 200 are transport successes',async()=>{
 for(const method of ['admit','publish','accept'])for(const status of [200,202]){
  const f=setup({fetchImpl:async()=>Response.json({opaque:'wrong-status'},{status})});
  assert.deepEqual(await f.client[method](f.call),{kind:'unavailable'});
 }
 for(const method of ['readAdmission','readRequest'])for(const status of [201,202]){
  const f=setup({fetchImpl:async()=>Response.json({opaque:'wrong-status'},{status})});
  assert.deepEqual(await f.client[method](f.call),{kind:'unavailable'});
 }
});

test('the source is copied at construction; caller cannot select another job, route, body or phase',async()=>{
 const f=setup();f.original.generationJobId=id(99);f.original.binding.tenantId=id(98);
 for(const extra of [{generationJobId:id(99)},{route:'/other'},{body:{}},{phase:'accept'}])
  await assert.rejects(f.client.admit({...f.call,...extra}));
 await assert.rejects(f.client.readAdmission({...f.call,route:'/other'}));
 assert.equal(f.state.calls.length,0);assert.equal(f.state.credentials.length,0);
 const reply=await f.client.admit(f.call);assert.equal(reply.kind,'unavailable');
 assert.equal(f.state.calls.length,0);
 assert.equal(f.state.credentials[0].source.binding.tenantId,id(1));
 assert.equal(f.state.credentials[0].source.generationJobId,id(6));
});

test('disabled or missing delegated credential owner never calls Core',async()=>{
 for(const changes of [{enabled:false},{authorization:null}]){
  const f=setup(changes);assert.equal(f.client.available(),false);
  assert.deepEqual(await f.client.admit(f.call),{kind:'unavailable'});
  assert.equal(f.state.calls.length,0);assert.equal(f.state.credentials.length,0);
 }
});

test('credential echoes must bind original actor, tenant, job, method, route, phase, source, body and freshness',async()=>{
 const bad=[
  a=>a.actorId='user_other',a=>a.tenantId=id(88),a=>a.generationJobId=id(87),a=>a.method='GET',
  a=>a.operation='objective.plan.prepare',a=>a.route='/other',a=>a.phase='accept',a=>a.sourceSha256='0'.repeat(64),a=>a.requestSha256='0'.repeat(64),a=>a.bodySha256='0'.repeat(64),
  a=>a.checkedAtMs=at-1,a=>a.expiresAtMs=at,a=>a.credential='synthetic bearer with spaces',
 ];
 for(const edit of bad){
  const f=setup(),read=f.authorization.readCredential;let fetchCalls=0;
  f.authorization.readCredential=async call=>{const reply=await read(call);edit(reply);return reply;};
  // The method is captured at construction, so build against the mutated owner.
  const client=createCoreObjectiveGenerationTransport({origin:'https://core.synthetic.invalid',source:source(),fetchImpl:async()=>{fetchCalls++;throw Error('unreached');},authorization:f.authorization,enabled:true,now:()=>at,maxRequestMs:100});
  assert.deepEqual(await client.admit(f.call),{kind:'unavailable'});
  assert.equal(fetchCalls,0);
 }
});

test('revoked second delegated check withholds a received body without retry',async()=>{
 const f=setup(),read=f.authorization.readCredential;let count=0;
 const authorization={async readCredential(call){if(++count===2)throw Error('synthetic revoked');return read(call);}};
 const client=createCoreObjectiveGenerationTransport({origin:'https://core.synthetic.invalid',source:source(),fetchImpl:async(url,options)=>{f.state.calls.push({url,options});return Response.json({opaque:'not-released'},{status:201});},authorization,enabled:true,now:()=>at,maxRequestMs:100});
 assert.deepEqual(await client.publish(f.call),{kind:'unavailable'});assert.equal(f.state.calls.length,1);assert.equal(count,2);
});

test('changed exact-wire body digest on second credential check withholds the reply',async()=>{
 const f=setup(),read=f.authorization.readCredential;let count=0;
 const authorization={async readCredential(call){const value=await read(call);if(++count===2)value.bodySha256='0'.repeat(64);return value;}};
 const client=createCoreObjectiveGenerationTransport({origin:'https://core.synthetic.invalid',source:source(),
  fetchImpl:async(url,options)=>{f.state.calls.push({url,options});return Response.json({opaque:'not-released'},{status:201});},
  authorization,enabled:true,now:()=>at,maxRequestMs:100});
 assert.deepEqual(await client.admit(f.call),{kind:'unavailable'});
 assert.equal(f.state.calls.length,1);assert.equal(count,2);
});

test('second check cannot substitute a fresh credential with identical bound echoes',async()=>{
 const f=setup(),read=f.authorization.readCredential;let count=0;
 const authorization={async readCredential(call){const value=await read(call);if(++count===2)value.credential='synthetic-delegated-core-reminted';return value;}};
 const client=createCoreObjectiveGenerationTransport({origin:'https://core.synthetic.invalid',source:source(),
  fetchImpl:async(url,options)=>{f.state.calls.push({url,options});return Response.json({opaque:'not-released'},{status:201});},
  authorization,enabled:true,now:()=>at,maxRequestMs:100});
 assert.deepEqual(await client.publish(f.call),{kind:'unavailable'});
 assert.equal(f.state.calls.length,1);assert.equal(count,2);
});

test('non-success, malformed, encoded, oversized and stalled Core replies remain unavailable',async()=>{
 for(const response of [
  ()=>Response.json({error:'synthetic'},{status:409}),
  ()=>new Response('{',{status:201,headers:{'content-type':'application/json'}}),
  ()=>new Response('{}',{status:201,headers:{'content-type':'application/json','content-encoding':'gzip'}}),
  ()=>new Response('x'.repeat(128),{status:201,headers:{'content-type':'application/json'}}),
 ]){
  const f=setup({maxFactBytes:64,fetchImpl:async()=>response()});
  assert.deepEqual(await f.client.accept(f.call),{kind:'unavailable'});
 }
 let signal,calls=0;
 const f=setup();
 const authorization={async readCredential(call){const t=Date.now();return {credential:'synthetic',actorId:f.original.binding.actorId,tenantId:f.original.binding.tenantId,generationJobId:f.original.generationJobId,operation:call.operation,method:call.method,route:call.route,phase:call.phase,sourceSha256:call.sourceSha256,requestSha256:call.requestSha256,bodySha256:call.bodySha256,checkedAtMs:t,expiresAtMs:t+1000};}};
 const client=createCoreObjectiveGenerationTransport({origin:'https://core.synthetic.invalid',source:f.original,fetchImpl:async(_url,options)=>{calls++;signal=options.signal;return new Promise(()=>{});},authorization,enabled:true,now:Date.now,maxRequestMs:10});
 assert.deepEqual(await client.admit({deadlineMs:Date.now()+1000}),{kind:'unavailable'});
 assert.equal(calls,1);assert.equal(signal.aborted,true);
});

test('an unsafe Core origin fails before any credential or network access',()=>{
 for(const origin of ['http://core.synthetic.invalid','https://core.synthetic.invalid/strategy-api','https://core.synthetic.invalid/?route=other','https://core.synthetic.invalid/#other']){
  assert.throws(()=>setup({origin}),/OBJECTIVE_GENERATION_CORE_UNAVAILABLE/);
 }
});
