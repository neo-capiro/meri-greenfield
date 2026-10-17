import test from 'node:test';
import assert from 'node:assert/strict';
import {startControl} from '../control.mjs';
import {productControlFixture} from '../../proxy/product/test/control-fixture.mjs';
import {createPreparedKickoffApplication} from '../native-authority/prepared-kickoff-http.mjs';
import {capabilityDigest} from '../native-authority/task-verifier.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {temporalCleanupUnknown} from '../temporal-runtime-fence.mjs';

const credential='synthetic-control-startup-only';
const cleanupCode='TEMPORAL_PRODUCT_CLEANUP_UNKNOWN';
const stopPath='/v1/execution/kickoff/stop';

/** Actual startup composition, fence and listener boundary; synthetic owned
 * resources only. Every side-effecting default has a trusted factory override. */
function fixture({authorizationError,initialLoss=false,onListen,cleanup={}}={}){
 const configuration=structuredClone(productControlFixture().configuration);delete configuration.taskRouter;
 const binding=configuration.nativeCandidate.runtime.binding,executionId=canonicalSha256(binding),events=[],closed=[],watchers=new Set();
 const state={lost:false,authorizationOptions:null,assemblyOptions:null,privateApplication:null,publicApplication:null,readiness:null,stopRequests:[],nativeCalls:[]};
 const close=name=>async()=>{events.push('close:'+name);closed.push(name);const value=cleanup[name];if(value instanceof Error)throw value;return value;};
 const authorization={healthy:()=>!state.lost,apiKey(){assert.equal(state.lost,false);return 'synthetic-temporal-startup-token';},
  watch(listener){watchers.add(listener);return ()=>watchers.delete(listener);},close:close('authorization')};
 function lose(){state.lost=true;state.authorizationOptions.onUnavailable(Error('synthetic authorization loss'));for(const watcher of [...watchers])watcher('TEMPORAL_AUTHORIZATION_UNAVAILABLE');}
 const native={async readiness({signal}={}){signal?.throwIfAborted();events.push('native-readiness');},async call(operation,input,{signal}={}){
  state.nativeCalls.push({operation,input,signal});return {operation};
 }};
 const kickoff=createPreparedKickoffApplication({owner:{
  async kickoff(){assert.fail('fenced kickoff reached native admission');},async status(){assert.fail('fenced status reached native admission');},
  async stop(value){assert.deepEqual(value.binding,binding);assert.equal(value.executionId,executionId);assert.equal(value.signal.aborted,false);state.stopRequests.push(value);return {binding,executionId,expiresAtMs:1_800_000_010_000};}
 },enabled:true,controlCapabilitySha256:capabilityDigest(credential)});
 const candidate={controlCapabilitySha256:capabilityDigest(credential),native,productPorts:Object.freeze({}),application:kickoff,
  bindApplication(application){events.push('candidate-bind');state.boundAssembly=application;},close:close('candidate')};
 const pool={async connect(){assert.fail('no transaction or native PostgreSQL client is allocated');},async query(sql){events.push('schema');assert.ok(sql.startsWith("SELECT to_regclass('meri_conversations.runs')"));return {rows:[{
  runs:'meri_conversations.runs',events:'meri_conversations.events',controls:'meri_conversations.controls',selected_outputs:'meri_conversations.selected_outputs',initial_inputs:'meri_conversations.initial_inputs'}]};},end:close('pool')};
 const connection={async withDeadline(_at,operation){return operation();},async withAbortSignal(signal,operation){signal.throwIfAborted();return operation();},
  workflowService:{async getSystemInfo(){events.push('temporal-health');return {};}},close:close('connection')};
 const assembly={application:{async handle(request){request.signal.throwIfAborted();return Response.json({synthetic:true});}},
  downloads:{async open({signal}){signal.throwIfAborted();events.push('downloads');return {reason:'synthetic-only'};}},
  retention:null,productReadiness:()=>({ready:true}),close:close('assembly')};
 const owners={
  async authorization(c,options){events.push('authorization');assert.equal(c,configuration);state.authorizationOptions=options;if(authorizationError)throw authorizationError;if(initialLoss)lose();return authorization;},
  async readMaterial(path){events.push('material');if(path===configuration.database.connectionFile)return Buffer.from('postgresql://database.synthetic.invalid/meri?sslmode=verify-full');
   assert.equal(path,configuration.native.capabilityFile);return Buffer.from(credential);},
  async tls(c){events.push('tls');assert.equal(c,configuration.temporal.tls);return {synthetic:true};},
  createPool(options){events.push('pool');assert.equal(options.max,10);assert.ok(options.connectionString.endsWith('?sslmode=verify-full'));return pool;},
  async connect(options){events.push('connect');assert.equal(options.address,configuration.temporal.address);assert.equal(options.apiKey(),'synthetic-temporal-startup-token');return connection;},
  createClient(options){events.push('client');assert.equal(options.connection,connection);assert.equal(options.namespace,configuration.temporal.namespace);return {synthetic:true};},
  async startCandidate(options){events.push('candidate');assert.equal(options.configuration,configuration);assert.equal(options.pool,pool);assert.equal(options.signal.aborted,false);return candidate;},
  assemble(options){events.push('assembly');assert.equal(options.pool,pool);state.assemblyOptions=options;return assembly;},
  async listen(options){
   const role=options.configuration.http.port===configuration.privateHttp.port?'private':'public';events.push('listen:'+role);
   state[role+'Application']=options.application;state.readiness=options.readiness;
   await onListen?.({role,options,lose,state,events,configuration,binding,executionId});
   return {address:{address:'127.0.0.1',port:options.configuration.http.port},close:close(role+'-listener')};
  },
 };
 return {configuration,binding,executionId,events,closed,state,lose,owners,start:()=>startControl(configuration,{testOwners:owners})};
}

function request(configuration,path,auth,body){return new Request(configuration.native.origin+path,{method:'POST',headers:{'content-type':'application/json',...(auth===undefined?{}:{authorization:auth})},body:JSON.stringify(body)});}

test('authorization loss during private bind fences real applications, preserves authenticated original stop and prevents public bind',async()=>{
 let checked=false;
 const f=fixture({async onListen({role,options,lose,state,configuration,binding,executionId}){
  assert.equal(role,'private');assert.equal(options.signal,undefined,'candidate stop ingress is not closed by the authorization-loss signal');
  lose();
  const kickoff=await options.application.handle(request(configuration,'/v1/execution/kickoff','Bearer '+credential,{binding,executionKey:executionId}));
  assert.equal(kickoff.status,503);assert.deepEqual(await kickoff.json(),{error:{code:'TEMPORAL_AUTHORIZATION_UNAVAILABLE'}});
  assert.equal((await options.application.handle(request(configuration,stopPath,undefined,{binding,executionId}))).status,503);assert.equal(state.stopRequests.length,0);
  assert.equal((await options.application.handle(request(configuration,stopPath+'?all=true','Bearer '+credential,{binding,executionId}))).status,503);
  const stop=await options.application.handle(request(configuration,stopPath,'Bearer '+credential,{binding,executionId}));assert.equal(stop.status,200);assert.deepEqual(await stop.json(),{binding,executionId,expiresAtMs:1_800_000_010_000});
  await assert.rejects(options.readiness({signal:new AbortController().signal}),/TEMPORAL_AUTHORIZATION_UNAVAILABLE/u);checked=true;
 }});
 await assert.rejects(f.start(),error=>error.code==='CONTROL_STARTUP_FAILED'&&error.cause.code==='TEMPORAL_AUTHORIZATION_UNAVAILABLE');
 assert.equal(checked,true);assert.deepEqual(f.events.filter(event=>event.startsWith('listen:')),['listen:private']);
 assert.equal(f.state.stopRequests.length,1);assert.equal(f.state.nativeCalls.length,0);
 assert.deepEqual(f.closed.sort(),['assembly','authorization','candidate','connection','pool','private-listener'].sort());
});

test('initial authorization refusal or synchronous loss occurs before material, pool or listener allocation',async()=>{
 const original=Error('synthetic issuer refused');
 for(const options of [{authorizationError:original},{initialLoss:true}]){
  const f=fixture(options);await assert.rejects(f.start(),error=>error.code==='CONTROL_STARTUP_FAILED'&&
   (options.authorizationError?error.cause===original:error.cause.code==='TEMPORAL_AUTHORIZATION_UNAVAILABLE'));
  assert.equal(f.events.includes('material'),false);assert.equal(f.events.includes('tls'),false);assert.equal(f.events.includes('pool'),false);
  assert.equal(f.events.some(event=>event.startsWith('listen:')),false);
  assert.deepEqual(f.closed,options.initialLoss?['authorization']:[]);
 }
});

test('real runtime close rejects fulfilled pending receipts and retains rejected nested markers after every owner cleanup',async t=>{
 const original=Error('synthetic owned close refused'),marked=temporalCleanupUnknown(original);
 for(const [name,cleanup,verify] of [
  ['pending issuer receipt',{authorization:{unsettledOperations:1,physicalStopProven:false}},error=>error.cause.unsettledOperations===1],
  ['pending listener receipt',{'private-listener':{listenerStopped:true,pendingRequests:1,physicalStopProven:false}},error=>error.cause.pendingRequests===1],
  ['rejected cleanup',{connection:original},error=>error.cause===original],
  ['nested existing marker',{assembly:marked},error=>error===marked&&error.cause===original],
 ])await t.test(name,async()=>{
  const f=fixture({cleanup}),runtime=await f.start();
  assert.deepEqual(f.events.filter(event=>event.startsWith('listen:')),['listen:private','listen:public']);
  await assert.rejects(runtime.close(),error=>error.code===cleanupCode&&verify(error));
  assert.deepEqual(f.closed.sort(),['assembly','authorization','candidate','connection','pool','private-listener','public-listener'].sort());
  await assert.rejects(runtime.close(),error=>error.code===cleanupCode&&verify(error));assert.equal(f.closed.length,7,'close remains idempotent after its unknown outcome');
 });
});

test('private bind cleanup uncertainty survives listener-boundary and startControl failure wrappers',async()=>{
 const f=fixture({cleanup:{'private-listener':{listenerStopped:true,pendingRequests:1,physicalStopProven:false}},onListen({role,lose}){assert.equal(role,'private');lose();}});
 await assert.rejects(f.start(),error=>error.code===cleanupCode&&error.cause instanceof AggregateError&&
  error.cause.errors[0].code==='TEMPORAL_AUTHORIZATION_UNAVAILABLE'&&error.cause.errors[1].code===cleanupCode&&error.cause.errors[1].cause.pendingRequests===1);
 assert.equal(f.events.includes('listen:public'),false);assert.equal(f.closed.filter(name=>name==='private-listener').length,1);
 assert.ok(f.closed.includes('authorization'));assert.ok(f.closed.includes('pool'));
});

test('actual startControl native facade rejects new kickoffs immediately after loss but retains exact independent stop',async()=>{
 const f=fixture(),runtime=await f.start(),native=f.state.assemblyOptions.native,signal=new AbortController().signal;
 try{
  f.lose();await assert.rejects(native.call('execution/kickoff',{binding:f.binding},{signal}),/TEMPORAL_AUTHORIZATION_UNAVAILABLE/u);
  assert.equal(f.state.nativeCalls.length,0);
  await native.call('execution/kickoff/stop',{binding:f.binding,executionId:f.executionId},{signal});
  assert.equal(f.state.nativeCalls.length,1);assert.equal(f.state.nativeCalls[0].operation,'execution/kickoff/stop');assert.equal(f.state.nativeCalls[0].signal,signal);
 }finally{await runtime.close();}
});

test('runtime close fences private admissions synchronously while public listener cleanup is still pending and preserves original stop',async()=>{
 let release;const pendingClose=new Promise(resolve=>{release=resolve;}),f=fixture({cleanup:{'public-listener':pendingClose}}),runtime=await f.start();
 const closing=runtime.close();let settled=false;closing.then(()=>{settled=true;},()=>{settled=true;});
 try{
  assert.deepEqual(f.closed,['public-listener'],'the first owned close has not settled yet');
  const denied=f.state.privateApplication.handle(request(f.configuration,'/v1/execution/kickoff','Bearer '+credential,{binding:f.binding,executionKey:f.executionId}));
  assert.ok(denied instanceof Response,'fencing is latched before waiting for public listener close');assert.equal(denied.status,503);
  await assert.rejects(f.state.assemblyOptions.native.call('execution/kickoff',{binding:f.binding}),/TEMPORAL_AUTHORIZATION_UNAVAILABLE/u);
  assert.equal(f.state.nativeCalls.length,0);
  assert.equal((await f.state.privateApplication.handle(request(f.configuration,stopPath,undefined,{binding:f.binding,executionId:f.executionId}))).status,503);
  const stopRequest=request(f.configuration,stopPath,'Bearer '+credential,{binding:f.binding,executionId:f.executionId}),stopped=await f.state.privateApplication.handle(stopRequest);
  assert.equal(stopped.status,200);assert.equal(f.state.stopRequests.length,1);assert.equal(stopRequest.signal.aborted,false);
  await assert.rejects(f.state.readiness({signal:new AbortController().signal}),/TEMPORAL_AUTHORIZATION_UNAVAILABLE/u);
  assert.equal(settled,false);assert.deepEqual(f.closed,['public-listener'],'stop does not await or bypass the retained close drain');
 }finally{
  release({listenerStopped:true,pendingRequests:0,physicalStopProven:false});await closing;
 }
 assert.equal(settled,true);assert.deepEqual(f.closed.sort(),['assembly','authorization','candidate','connection','pool','private-listener','public-listener'].sort());
});
