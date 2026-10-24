import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

// Match the load fixture's opt-in import stubs when this local checkout has
// no AWS/Temporal/SDK dependencies. They cannot execute runtime operations.
const repo=fileURLToPath(new URL('../../../',import.meta.url));
const localStubs=process.env.MERI_DIAGNOSTIC_IMPORT_STUBS==='1';
const packageParent=process.env.MERI_DIAGNOSTIC_DEPS_ROOT?pathToFileURL(resolve(process.env.MERI_DIAGNOSTIC_DEPS_ROOT,'package.json')).href:null;
const localZodParent=pathToFileURL(resolve(repo,'../fe/package.json')).href;
registerHooks({resolve(specifier,context,nextResolve){
 if(localStubs&&specifier==='@js-temporal/polyfill')return {url:new URL('../../control/conversations/test/load-only-temporal-stub.mjs',import.meta.url).href,shortCircuit:true};
 if(localStubs&&specifier==='@anthropic-ai/claude-agent-sdk')return {url:new URL('../../control/conversations/test/load-only-sdk-stub.mjs',import.meta.url).href,shortCircuit:true};
 if(localStubs&&specifier==='@aws-sdk/client-ecs')return {url:new URL('../../control/conversations/test/load-only-ecs-stub.mjs',import.meta.url).href,shortCircuit:true};
 if(localStubs&&specifier==='@temporalio/client')return {url:new URL('../../control/conversations/test/load-only-temporal-client-stub.mjs',import.meta.url).href,shortCircuit:true};
 if(localStubs&&specifier==='@capiro/meri-contracts/node')return {url:pathToFileURL(resolve(repo,'packages/contracts/validate.mjs')).href,shortCircuit:true};
 if(localStubs&&specifier==='zod')return nextResolve(specifier,{...context,parentURL:localZodParent});
 if(localStubs&&specifier==='./config.mjs'&&context.parentURL?.includes('/apps/runtime/'))return {url:new URL('../../control/conversations/test/load-only-runtime-config-stub.mjs',import.meta.url).href,shortCircuit:true};
 try{return nextResolve(specifier,context);}catch(error){
  if(packageParent&&!specifier.startsWith('.')&&!specifier.startsWith('/')&&!specifier.startsWith('node:'))return nextResolve(specifier,{...context,parentURL:packageParent});
  throw error;
 }
}});
const [{createNativeCapabilityClient},{binding},{isAuthorityUnavailable}]=await Promise.all([
 '../native-client.mjs','../../control/conversations/test/store-fixture.mjs',
 '../../../packages/runtime/authority-availability.mjs',
].map(path=>import(new URL(path,import.meta.url))));

const credential='synthetic-control-capability';

test('native client keeps its 3s default and refuses invalid factory timeout bounds',async()=>{
 let at=Date.now();const configuration={origin:'https://native.synthetic.invalid',maxResponseBytes:131072};
 const fetchImpl=async()=>{at+=3500;return Response.json({ok:true});};
 const client=createNativeCapabilityClient({configuration,credential,fetch:fetchImpl,now:()=>at});
 await assert.rejects(client.call('readiness',{}),/DEADLINE/);
 for(const maxRequestMs of [0,-1,10001,1.5,NaN])assert.throws(()=>createNativeCapabilityClient({configuration,credential,maxRequestMs}),/NATIVE_CONFIGURATION/);
});

test('startup-only request limit is bounded by its absolute stage deadline',async()=>{
 const configuration={origin:'https://native.synthetic.invalid',maxResponseBytes:131072};
 let at=Date.now();const start=at;
 const fetchImpl=async()=>{at=start+3500;return Response.json({ok:true});};
 const client=createNativeCapabilityClient({configuration,credential,fetch:fetchImpl,now:()=>at});
 assert.deepEqual(await client.call('runner/native/bootstrap',{}, {maxRequestMs:5000,deadlineMs:start+6000}),{ok:true});
 // Lifecycle control calls cross three task-authority verifies on control (worker-http.mjs); live they outlived 3 s.
 for(const operation of ['runner/next-controls','runner/claim-control','runner/ack-control','runner/record-checkpoint']){
  at=start;assert.deepEqual(await client.call(operation,{}, {maxRequestMs:5000,deadlineMs:start+6000}),{ok:true});
 }
 at=start;
 await assert.rejects(client.call('runner/runtime',{}, {maxRequestMs:5000,deadlineMs:start+3000}),/DEADLINE/);
 for(const [operation,options] of [
  ['runner/load',{maxRequestMs:5000,deadlineMs:start+6000}],
  ['identity/verify',{maxRequestMs:5000,deadlineMs:start+6000}],
  ['runner/next-controls',{maxRequestMs:5000}],
  ['runner/publish',{maxRequestMs:5000}],
  ['runner/publish',{maxRequestMs:23001,deadlineMs:start+6000}],
  ['runner/publish',{maxRequestMs:0,deadlineMs:start+6000}],
 ])await assert.rejects(client.call(operation,{},options),/NATIVE_CONFIGURATION/);
});

test('startup request cancellation aborts transport and refuses a late response',async()=>{
 const configuration={origin:'https://native.synthetic.invalid',maxResponseBytes:131072};
 const at=Date.now(),controller=new AbortController(),pending=Promise.withResolvers();let transportSignal;
 const client=createNativeCapabilityClient({configuration,credential,fetch:async(_url,input)=>{transportSignal=input.signal;return pending.promise;},now:()=>at});
 const result=client.call('runner/publish',{}, {signal:controller.signal,maxRequestMs:5000,deadlineMs:at+5000});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(transportSignal.aborted,false);
 controller.abort();
 await assert.rejects(result,/CANCELLED/);
 assert.equal(transportSignal.aborted,true);
 pending.resolve(Response.json({ok:true}));
});


const unanswered=()=>Response.json({error:{code:'WORKER_AUTHORITY_UNAVAILABLE'}},{status:503});
const replayOptions=operation=>({deadlineMs:Date.now()+10000,...(operation==='runner/load'?{}:{maxRequestMs:5000})});
test('an unanswered load or publish is sent again unchanged and the next answer is returned',async()=>{
 const configuration={origin:'https://native.synthetic.invalid',maxResponseBytes:131072};
 const firsts=[unanswered,()=>Response.json({error:{code:'NATIVE_GATEWAY_UNAVAILABLE',outcome:'UNKNOWN'}},{status:503}),()=>{throw new TypeError('fetch failed');}];
 for(const operation of ['runner/load','runner/publish'])for(const first of firsts){
  const bodies=[],client=createNativeCapabilityClient({configuration,credential,fetch:async(_url,init)=>{bodies.push(init.body);return bodies.length===1?first():Response.json({ok:true});}});
  assert.deepEqual(await client.call(operation,{binding,event:{eventId:'synthetic-event'}},replayOptions(operation)),{ok:true});
  assert.equal(bodies.length,2,operation);assert.equal(bodies[1],bodies[0],'the replay is the same request');
 }
});

test('a refusal, a control deadline or a configured 503 is never sent again and stays definitive',async()=>{
 const configuration={origin:'https://native.synthetic.invalid',maxResponseBytes:131072};
 for(const reply of [()=>Response.json({error:{code:'WORKER_REQUEST_REFUSED'}},{status:403}),()=>Response.json({error:{code:'DEADLINE'}},{status:408}),
  ()=>Response.json({error:{code:'NATIVE_GATEWAY_UNAVAILABLE',outcome:'NOT_DISPATCHED'}},{status:503}),()=>Response.json({error:{code:'NATIVE_EXECUTION_UNAVAILABLE'}},{status:503}),
  ()=>new Response('WORKER_AUTHORITY_UNAVAILABLE',{status:503,headers:{'content-type':'text/plain'}})]){
  let calls=0;const client=createNativeCapabilityClient({configuration,credential,fetch:async()=>{calls++;return reply();}});
  await assert.rejects(client.call('runner/publish',{binding},replayOptions('runner/publish')),e=>e.code==='NATIVE_UNAVAILABLE'&&!isAuthorityUnavailable(e));
  assert.equal(calls,1);
 }
});

test('only a deadline-bound load or publish is replayed, at most twice and only with time for another attempt',async()=>{
 const configuration={origin:'https://native.synthetic.invalid',maxResponseBytes:131072};
 const attempts=async(operation,options)=>{let calls=0;const client=createNativeCapabilityClient({configuration,credential,fetch:async()=>{calls++;return unanswered();}});
  const input=operation==='runner/checkpoint/capture'?{binding,sessionId:'71000000-0000-4000-8000-000000000091',controlId:'71000000-0000-4000-8000-000000000092',files:[],taskFiles:[]}:{binding};
  await assert.rejects(client.call(operation,input,options),e=>e.code==='NATIVE_UNAVAILABLE'&&isAuthorityUnavailable(e));return calls;};
 const started=Date.now();assert.equal(await attempts('runner/load',replayOptions('runner/load')),3);assert.ok(Date.now()-started>=2000,'0.5 s then 1.5 s between attempts');
 assert.equal(await attempts('runner/publish',replayOptions('runner/publish')),3);
 for(const operation of ['runner/runtime','runner/next-controls','runner/claim-control','runner/checkpoint/capture'])assert.equal(await attempts(operation,replayOptions(operation)),1,operation);
 assert.equal(await attempts('runner/load',{}),1,'no absolute deadline');
 assert.equal(await attempts('runner/load',{deadlineMs:Date.now()+1400}),1,'under one second would be left after the pause');
});

test('cancellation during the pause between attempts ends the call without another request',async()=>{
 let calls=0;const controller=new AbortController();
 const client=createNativeCapabilityClient({configuration:{origin:'https://native.synthetic.invalid',maxResponseBytes:131072},credential,fetch:async()=>{calls++;setTimeout(()=>controller.abort(),200);return unanswered();}});
 await assert.rejects(client.call('runner/publish',{binding},{...replayOptions('runner/publish'),signal:controller.signal}),/CANCELLED/);
 assert.equal(calls,1);
});

test('only a rejection after which no answer arrived is replayed, and every failure keeps its fixed class as cause',async()=>{
 const configuration={origin:'https://native.synthetic.invalid',maxResponseBytes:131072};
 const pinned=code=>Object.assign(Error('PINNED_NATIVE_REFUSED'),{code});
 for(const [rejection,replayed] of [[pinned('PINNED_NATIVE_SOCKET'),true],[pinned('PINNED_NATIVE_CONNECT'),true],[pinned('PINNED_NATIVE_TLS'),true],[pinned('PINNED_NATIVE_RESPONSE'),true],
  [new TypeError('fetch failed'),true],[pinned('PINNED_NATIVE_TIMEOUT'),false],[pinned('PINNED_NATIVE_ABORTED'),false],[pinned('PINNED_NATIVE_TRANSPORT'),false],
  [pinned('PINNED_NATIVE_REFUSED'),false],[pinned('PINNED_NATIVE_STATUS_403'),false],[pinned('PINNED_NATIVE_STATUS_503'),false]]){
  let calls=0;const client=createNativeCapabilityClient({configuration,credential,fetch:async()=>{calls++;throw rejection;}});
  await assert.rejects(client.call('runner/publish',{binding},replayOptions('runner/publish')),e=>e.code==='NATIVE_UNAVAILABLE'&&e.cause===rejection&&isAuthorityUnavailable(e)===replayed);
  assert.equal(calls,replayed?3:1,rejection.code??rejection.name);
 }
 // A non-200 answer keeps its status class as cause; nothing from its body or headers.
 const client=createNativeCapabilityClient({configuration,credential,fetch:async()=>Response.json({error:{code:'WORKER_REQUEST_REFUSED',detail:'private'}},{status:403})});
 await assert.rejects(client.call('runner/load',{binding},replayOptions('runner/load')),e=>e.code==='NATIVE_UNAVAILABLE'&&e.cause.code==='PINNED_NATIVE_STATUS_403'&&e.cause.message==='PINNED_NATIVE_REFUSED');
});
