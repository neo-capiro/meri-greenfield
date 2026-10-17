import test from 'node:test';
import assert from 'node:assert/strict';
import {createTemporalRuntimeFence,assertTemporalRuntimeCleanup,temporalCleanupUnknown} from './temporal-runtime-fence.mjs';
import {createPreparedKickoffApplication} from './native-authority/prepared-kickoff-http.mjs';
import {capabilityDigest} from './native-authority/task-verifier.mjs';
import {canonicalSha256} from '../../packages/contracts/validate.mjs';
import {createTemporalIssuerDelivery} from './temporal-issuer/client.mjs';

const origin='https://control.synthetic.invalid';
const stopPath='/v1/execution/kickoff/stop';
const unknown='TEMPORAL_PRODUCT_CLEANUP_UNKNOWN';
const fulfilled=value=>({status:'fulfilled',value});
const rejected=reason=>({status:'rejected',reason});

test('loss synchronously and permanently rejects effect admission and wrapped HTTP without leaking its cause',async()=>{
 const fence=createTemporalRuntimeFence(),seen=[],application={handle(request){seen.push(request);return Response.json({original:true});}};
 const mounted=fence.wrap(application),first=new Request(origin+'/api/conversations',{method:'POST'});
 assert.equal(fence.healthy(),true);fence.check();assert.equal((await mounted.handle(first)).status,200);assert.ok(seen[0] instanceof Request);assert.equal(seen[0].url,first.url);assert.equal(seen[0].method,first.method);
 const cause=Error('private issuer observation');assert.equal(fence.lose(cause),true);
 assert.equal(fence.healthy(),false);assert.throws(()=>fence.check(),error=>error.code==='TEMPORAL_AUTHORIZATION_UNAVAILABLE'&&error.cause===cause);
 assert.equal(fence.lose(Error('later cause')),false);assert.throws(()=>fence.check(),error=>error.cause===cause);
 const denied=mounted.handle(new Request(origin+'/v1/execution/kickoff',{method:'POST'}));
 assert.ok(denied instanceof Response,'the loss branch does not wait for any asynchronous owner');
 assert.equal(denied.status,503);assert.equal(denied.headers.get('cache-control'),'no-store');
 assert.deepEqual(await denied.json(),{error:{code:'TEMPORAL_AUTHORIZATION_UNAVAILABLE'}});assert.equal(seen.length,1);
});

test('the shared signal aborts an already awaited admission synchronously while exact stop retains its independent signal',async()=>{
 const fence=createTemporalRuntimeFence(),requestAbort=new AbortController(),stopAbort=new AbortController();let ordinarySignal,stopSignal,resolveOrdinary,resolveStop;
 const ordinaryPending=new Promise(resolve=>{resolveOrdinary=resolve;}),stopPending=new Promise(resolve=>{resolveStop=resolve;});
 const application={async handle(request){
  if(new URL(request.url).pathname===stopPath){stopSignal=request.signal;return stopPending;}
  ordinarySignal=request.signal;ordinarySignal.addEventListener('abort',()=>resolveOrdinary(new Response(null,{status:503})),{once:true});return ordinaryPending;
 }},mounted=fence.wrap(application),stop=new Request(origin+stopPath,{method:'POST',signal:stopAbort.signal});
 const running=mounted.handle(new Request(origin+'/api/conversations',{method:'POST',signal:requestAbort.signal})),stopping=mounted.handle(stop);
 assert.equal(ordinarySignal.aborted,false);assert.equal(stopSignal,stop.signal);assert.equal(fence.signal.aborted,false);
 const cause=Error('synthetic authorization lost');fence.lose(cause);
 assert.equal(fence.signal.aborted,true);assert.equal(ordinarySignal.aborted,true);assert.equal(ordinarySignal.reason,cause);assert.equal(stopSignal.aborted,false);
 assert.equal((await running).status,503);resolveStop(new Response(null,{status:204}));assert.equal((await stopping).status,204);
 assert.equal((await mounted.handle(new Request(origin+stopPath,{method:'POST'}))).status,204);
});

test('ordinary wrapping preserves native request data and caller cancellation before any loss',async()=>{
 const fence=createTemporalRuntimeFence(),controller=new AbortController();let observed;
 const mounted=fence.wrap({async handle(request){observed=request;assert.equal(request.url,origin+'/api/conversations?cursor=3');assert.equal(request.method,'POST');
  assert.equal(request.headers.get('x-synthetic'),'original');assert.equal(request.credentials,'omit');assert.equal(request.redirect,'error');assert.equal(request.cache,'no-store');
  assert.equal(await request.text(),'synthetic-original-body');return new Response(null,{status:202});
 }});
 const request=new Request(origin+'/api/conversations?cursor=3',{method:'POST',headers:{'x-synthetic':'original'},body:'synthetic-original-body',credentials:'omit',redirect:'error',cache:'no-store',signal:controller.signal});
 assert.equal((await mounted.handle(request)).status,202);assert.notEqual(observed,request);assert.equal(observed.signal.aborted,false);
 controller.abort();assert.equal(observed.signal.aborted,true);assert.equal(fence.signal.aborted,false);assert.equal(fence.healthy(),true);
});

test('after loss only the exact stop method/path with no query can reach the original handler',async t=>{
 const cases=[
  ['GET',stopPath],['HEAD',stopPath],['DELETE',stopPath],['OPTIONS',stopPath],['PUT',stopPath],
  ['POST',stopPath+'/'],['POST',stopPath+'/status'],['POST',stopPath+'-all'],['POST',stopPath+'?'],
  ['POST',stopPath+'?x=1'],['POST',stopPath+'?='],['POST',stopPath+'?&'],['POST',stopPath+'#other'],
  ['POST','/v1/execution/kickoff'],['POST','/v1/execution/kickoff/status'],['POST','/v1/execution/poll'],
  ['POST','/v1/readiness'],['POST','/v1/runner/native/start'],['POST','/api/conversations'],
  ['GET','/api/conversations/history'],['GET','/health/ready'],['POST','/V1/execution/kickoff/stop'],
  ['POST','/v1/execution/kickoff%2fstop'],['POST','//v1/execution/kickoff/stop'],
 ];
 for(const [method,path] of cases)await t.test(method+' '+path,async()=>{
  let calls=0;const fence=createTemporalRuntimeFence(),mounted=fence.wrap({handle(){calls++;assert.fail('closed route delegated');}});fence.lose();
  assert.equal((await mounted.handle(new Request(origin+path,{method}))).status,503);assert.equal(calls,0);
 });
});

test('the canonical stop handler still owns control authentication, body validation and original binding',async()=>{
 const credential='synthetic-control-fence-only',binding={tenantId:'synthetic-tenant',actorId:'synthetic-actor',
  conversationId:'11111111-1111-4111-8111-000000000001',runId:'11111111-1111-4111-8111-000000000002',
  attemptId:'11111111-1111-4111-8111-000000000003',workerId:'11111111-1111-4111-8111-000000000004',writerFence:1};
 const body={binding,executionId:canonicalSha256(binding)},calls=[];
 const owner={kickoff(){assert.fail('kickoff delegated');},status(){assert.fail('generic read delegated');},async stop(value){
  assert.deepEqual(value.binding,binding);assert.equal(value.executionId,body.executionId);assert.ok(value.signal instanceof AbortSignal);
  calls.push(value);return {...body,expiresAtMs:1_800_000_010_000};
 }};
 const original=createPreparedKickoffApplication({owner,controlCapabilitySha256:capabilityDigest(credential),enabled:true}),fence=createTemporalRuntimeFence();
 const mounted=fence.wrap(original);fence.lose();
 const request=(auth,input=body)=>new Request(origin+stopPath,{method:'POST',headers:{'content-type':'application/json',...(auth===undefined?{}:{authorization:auth})},body:JSON.stringify(input)});
 for(const auth of [undefined,'Bearer foreign-synthetic-control','Basic '+credential])assert.equal((await mounted.handle(request(auth))).status,503);
 assert.equal((await mounted.handle(request('Bearer '+credential,{...body,repair:true}))).status,503);assert.equal(calls.length,0);
 const response=await mounted.handle(request('Bearer '+credential));assert.equal(response.status,200);assert.deepEqual(await response.json(),{...body,expiresAtMs:1_800_000_010_000});assert.equal(calls.length,1);
});

test('request brand access cannot be overridden to select the stop exception and the handler is captured',()=>{
 let calls=0;const source={handle(){calls++;return new Response(null,{status:204});}},fence=createTemporalRuntimeFence(),mounted=fence.wrap(source);
 source.handle=()=>assert.fail('mutable handler substituted');fence.lose();
 class Spoof extends Request{get url(){return origin+stopPath;}get method(){return 'POST';}}
 assert.equal(mounted.handle(new Spoof(origin+'/v1/execution/kickoff',{method:'POST'})).status,503);
 let getters=0;const falseRequest={get url(){getters++;return origin+stopPath;},get method(){getters++;return 'POST';}};
 assert.equal(mounted.handle(falseRequest).status,503);assert.equal(getters,0);
 assert.equal(mounted.handle(new Proxy(new Request(origin+stopPath,{method:'POST'}),{})).status,503);
 assert.equal(mounted.handle(new Request(origin+stopPath,{method:'POST'})).status,204);assert.equal(calls,1);
});

test('void closes and explicit settled receipts remain distinct from physical task stop proof',()=>{
 assert.equal(assertTemporalRuntimeCleanup([fulfilled(undefined),fulfilled(null),fulfilled({closed:true,physicalStopProven:false}),
  fulfilled({unsettledOperations:0,physicalStopProven:true}),fulfilled({listenerStopped:true,pendingRequests:0,physicalStopProven:false}),
  fulfilled({pendingOperations:0,pendingInitializations:0,pendingReads:0,pendingWrites:0,pending:false,initializing:false,failures:[],failure:null})],{workerState:'STOPPED'}),undefined);
 assert.equal(assertTemporalRuntimeCleanup([]),undefined,'an owner not constructed needs no fabricated cleanup');
});

test('fulfilled but unfinished or unsuccessful cleanup is unknown, including malformed pending counts',()=>{
 for(const value of [{unsettledOperations:1},{unsettledOperations:-1},{unsettledOperations:'0'},{pendingRequests:2},
  {pendingOperations:1},{pendingInitializations:1},{pendingReads:1},{pendingWrites:1},{pending:true},
  {initializing:true},{closed:false},{listenerStopped:false},{failures:['owned-work-pending']},{failure:'OWNED_IO_UNKNOWN'}]){
  assert.throws(()=>assertTemporalRuntimeCleanup([fulfilled(value)]),error=>error.code===unknown&&assert.deepEqual(error.cause,value)===undefined);
 }
});

test('rejected cleanup retains its original cause and propagates an existing marker through nested owners',()=>{
 const cause=Error('synthetic cleanup failure'),marked=temporalCleanupUnknown(cause);
 assert.equal(marked.code,unknown);assert.equal(marked.cause,cause);assert.equal(temporalCleanupUnknown(marked),marked);
 assert.throws(()=>assertTemporalRuntimeCleanup([rejected(cause)]),error=>error.code===unknown&&error.cause===cause);
 assert.throws(()=>assertTemporalRuntimeCleanup([rejected(marked)]),error=>error===marked&&error.cause===cause);
 assert.throws(()=>assertTemporalRuntimeCleanup([fulfilled(marked)]),error=>error===marked&&error.cause===cause);
 const second=Error('other owned cleanup');assert.throws(()=>assertTemporalRuntimeCleanup([rejected(marked),rejected(second)]),error=>
  error.code===unknown&&error.cause instanceof AggregateError&&error.cause.errors[0]===marked&&error.cause.errors[0].cause===cause&&error.cause.errors[1]===second);
});

test('numeric cleanup counters never accept boolean false as evidence of zero pending work',()=>{
 for(const key of ['unsettledOperations','pendingOperations','pendingRequests','pendingInitializations','pendingReads','pendingWrites']){
  const receipt={[key]:false};assert.throws(()=>assertTemporalRuntimeCleanup([fulfilled(receipt)]),error=>error.code===unknown&&error.cause[key]===false);
 }
 assert.equal(assertTemporalRuntimeCleanup([fulfilled({pending:false})]),undefined,'the separately declared boolean pending flag keeps its meaning');
});

test('concrete issuer cleanup receipts cannot hide outstanding native or database work behind a fulfilled close',()=>{
 for(const key of ['pendingStartup','pendingMaterial','pendingExternalOperations','pendingServiceOperations','pendingTransactions','pendingQueries','pendingBorrows','pendingConnections']){
  for(const value of [1,false])assert.throws(()=>assertTemporalRuntimeCleanup([fulfilled({[key]:value})]),{code:unknown});
 }
 for(const receipt of [{state:'CLEANUP_UNKNOWN'},{state:'UNKNOWN'},{uncertain:true},{cleanupErrors:['synthetic refused close']}])assert.throws(()=>assertTemporalRuntimeCleanup([fulfilled(receipt)]),{code:unknown});
 assertTemporalRuntimeCleanup([fulfilled({state:'CLEAN',pendingStartup:0,pendingTransactions:0,uncertain:false,cleanupErrors:[]})]);
});

test('INITIALIZED worker cleanup is unknown; no run or private SDK disposal is invented',()=>{
 for(const workerState of ['INITIALIZED','RUNNING','STOPPING','DRAINING','DRAINED','FAILED',null]){
  assert.throws(()=>assertTemporalRuntimeCleanup([fulfilled(undefined)],{workerState}),error=>error.code===unknown&&error.cause.workerState===workerState);
 }
 assert.equal(assertTemporalRuntimeCleanup([fulfilled(undefined)],{workerState:'STOPPED'}),undefined);
});

test('actual issuer delivery close receipt with active work cannot masquerade as successful cleanup',async()=>{
 let release,materialEntered;const held=new Promise(resolve=>{release=resolve;}),entered=new Promise(resolve=>{materialEntered=resolve;});
 const configuration={schemaVersion:1,issuerOrigin:'https://issuer.synthetic.invalid',audience:'meri-temporal',namespace:'meri',
  identity:{role:'control',subject:'meri-temporal-control:v1',workloadPrincipal:'meri-workload-control:v1'},
  publicKey:{kid:'synthetic-public-pin',alg:'RS256',jwkSha256:'a'.repeat(64),manifestFile:'/run/meri/issuer-jwks.json'},
  tls:{serverName:'issuer.synthetic.invalid',issuerCaFile:'/run/meri/issuer-ca.pem',clientCertFile:'/run/meri/issuer-client.crt',clientKeyFile:'/run/meri/issuer-client.key'},requestTimeoutMs:1000,maxReplyBytes:4096};
 const client=createTemporalIssuerDelivery({configuration,readMaterial:async(_file,{kind})=>{assert.equal(kind,'manifest');materialEntered();return held;},request(){assert.fail('no network');}});
 const pending=client.read({schemaVersion:1,...configuration.identity,namespace:'meri',audience:'meri-temporal',issuer:configuration.issuerOrigin+'/',signal:undefined});
 const denied=assert.rejects(pending,/TEMPORAL_ISSUER_DELIVERY_REFUSED/u);await entered;
 const receipt=client.close();assert.equal(receipt.unsettledOperations,1);assert.equal(receipt.physicalStopProven,false);
 assert.throws(()=>assertTemporalRuntimeCleanup([fulfilled(receipt)]),error=>error.code===unknown&&error.cause.unsettledOperations===1);
 await denied;release(Buffer.from('not a key or manifest'));await new Promise(resolve=>setImmediate(resolve));
 const settled=client.close();assert.equal(settled.unsettledOperations,0);assertTemporalRuntimeCleanup([fulfilled(settled)]);
});
