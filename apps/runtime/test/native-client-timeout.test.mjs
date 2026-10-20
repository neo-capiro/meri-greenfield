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
const [{createNativeCapabilityClient},{createPreparedRunnerReleaseClient},{createExecutionBinding},{binding,versions}]=await Promise.all([
 '../native-client.mjs','../native-authority/prepared-kickoff-http.mjs','../../control/conversations/execution-boundary.mjs','../../control/conversations/test/store-fixture.mjs',
].map(path=>import(new URL(path,import.meta.url))));

const credential='synthetic-control-capability';
const taskArn='arn:aws:ecs:us-east-1:967807252336:task/meri/'+'a'.repeat(32);
const original=expiresAtMs=>createExecutionBinding({binding,versions,plan:{synthetic:'release-timeout'},expiresAtMs});

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

test('only the release client tolerates a task-bound 3.5s exchange; original expiry still wins',async()=>{
 let at=Date.now();const start=at,o=original(at+30000),paths=[];
 const fetchImpl=async(url,input)=>{paths.push(new URL(url).pathname);assert.equal(input.headers.authorization,'Bearer '+credential);assert.deepEqual(JSON.parse(input.body),{original:o,taskArn});at=start+3500;return Response.json({original:o,taskArn,checkedAtMs:at,expiresAtMs:o.expiresAtMs,released:true});};
 const client=createPreparedRunnerReleaseClient({original:o,taskArn,origin:'https://native.synthetic.invalid',credential,fetchImpl,now:()=>at});
 assert.equal((await client.release({original:o,taskArn})).released,true);
 assert.deepEqual(paths,['/v1/native-task/release']);

 at=Date.now();const short=original(at+2000),shortStart=at;
 const shortClient=createPreparedRunnerReleaseClient({original:short,taskArn,origin:'https://native.synthetic.invalid',credential,
  fetchImpl:async()=>{at=shortStart+3500;return Response.json({original:short,taskArn,checkedAtMs:at,expiresAtMs:short.expiresAtMs,released:true});},now:()=>at});
 await assert.rejects(shortClient.release({original:short,taskArn}),/DEADLINE/);
});
