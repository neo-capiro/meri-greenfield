/** Synthetic service boundary, actual Fetch parsing/lifetime/transport. No listener, credentials or database. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoutinesApplication,ROUTINE_PATHS,routinesUnavailable} from '../application-http.mjs';

const NOW=1900000000000,limits={maxRequestMs:1000,maxRequestBytes:512,maxResponseBytes:512};
const headers={'content-type':'application/json',authorization:'Bearer synthetic-native'};
const request=(operation='prepare',body='{}',options={})=>new Request('https://routines.invalid'+ROUTINE_PATHS[operation],{
 method:'POST',headers,body,...options,
});
function fixture(overrides={},options={}){
 const calls=[],service=Object.fromEntries(Object.keys(ROUTINE_PATHS).map(operation=>[operation,async function(call){
  calls.push({operation,call,receiver:this});return {operation,ok:true};
 }]));
 Object.assign(service,overrides);
 return {calls,service,app:createRoutinesApplication({service,now:()=>NOW,limits,...options})};
}
const error=async response=>{const body=await response.json();assert.deepEqual(Object.keys(body),['error']);return body.error;};
test('all four exact routes forward only supplied credential/body/deadline/signal',async()=>{
 const f=fixture();
 for(const operation of Object.keys(ROUTINE_PATHS)){
  const body=operation==='list'?{afterScheduleId:null,limit:2,historyLimit:1}:{selected:'synthetic'};
  const response=await f.app.handle(request(operation,JSON.stringify(body),{headers:{...headers,'x-tenant-id':'not-authority','x-approval':'not-authority'}}));
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{operation,ok:true});
  assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('x-content-type-options'),'nosniff');
  const call=f.calls.at(-1);assert.equal(call.operation,operation);assert.equal(call.receiver,f.service);
  assert.deepEqual(Object.keys(call.call).sort(),['credential','deadlineMs','request','signal']);
  assert.equal(call.call.credential,'synthetic-native');assert.deepEqual(call.call.request,body);assert.equal(call.call.deadlineMs,NOW+1000);
  assert.ok(call.call.signal instanceof AbortSignal);assert.equal(call.call.signal.aborted,true);
 }
});
test('unknown paths return null without consuming body or invoking service',async()=>{
 const f=fixture(),r=new Request('https://routines.invalid/api/routines/prepare/extra',{method:'POST',body:'{}'});
 assert.equal(await f.app.handle(r),null);assert.equal(r.bodyUsed,false);assert.equal(await r.text(),'{}');assert.equal(f.calls.length,0);
 for(const path of ['/api/routines/%70repare','/api/routines/Prepare','/api/routines']){
  assert.equal(await f.app.handle(new Request('https://routines.invalid'+path)),null);
 }
});
test('known routes reject query/hash, wrong method/media/encoding and malformed bearer',async()=>{
 const f=fixture(),cases=[
  [new Request('https://routines.invalid/api/routines/prepare?q=1',{method:'POST',headers,body:'{}'}),404],
  [new Request('https://routines.invalid/api/routines/prepare#fragment',{method:'POST',headers,body:'{}'}),404],
  [request('prepare',undefined,{method:'GET',body:undefined}),405],
  [request('prepare','{}',{headers:{...headers,'content-type':'text/plain'}}),415],
  [request('prepare','{}',{headers:{...headers,'content-type':'application/json; charset=latin1'}}),415],
  [request('prepare','{}',{headers:{...headers,'content-encoding':'identity'}}),415],
  ...['','Bearer ','bearer synthetic','Bearer a, Bearer b','Bearer '+'a'.repeat(4097)].map(authorization=>[request('prepare','{}',{headers:{...headers,authorization}}),401]),
 ];
 for(const [r,status]of cases){const response=await f.app.handle(r);assert.equal(response.status,status);assert.equal((await error(response)).outcome,'NOT_DISPATCHED');}
 assert.equal(f.calls.length,0);
 assert.equal((await f.app.handle(request('prepare','{}',{headers:{...headers,'content-type':'Application/JSON; Charset=UTF-8'}}))).status,200);
});
test('real Request prototype getters bypass shadows and reject proxy/counterfeit Requests',async()=>{
 const f=fixture(),r=request();let touches=0;
 for(const name of ['url','method','headers','signal','body'])Object.defineProperty(r,name,{get(){touches++;throw Error('private getter');}});
 assert.equal((await f.app.handle(r)).status,200);assert.equal(touches,0);
 const proxy=new Proxy(request(),{get(){touches++;throw Error('private proxy');},getPrototypeOf(){touches++;throw Error('private prototype');}});
 assert.equal((await f.app.handle(proxy)).status,400);assert.equal(touches,0);
 assert.equal((await f.app.handle(Object.create(Request.prototype))).status,400);
});
test('constructor is closed and inert; disabled needs no owners and never inspects supplied service',async()=>{
 let touched=0;
 const service=new Proxy({}, {ownKeys(){touched++;throw Error('private service');},get(){touched++;throw Error('private service');},getPrototypeOf(){touched++;throw Error('private service');}});
 const app=createRoutinesApplication({service,now:()=>{touched++;return NOW;},limits,enabled:false});
 assert.equal(touched,0);assert.equal((await app.handle(request())).status,503);assert.equal(touched,0);
 assert.deepEqual(await error(await createRoutinesApplication({enabled:false}).handle(request())),{code:'ROUTINES_UNAVAILABLE',outcome:'NOT_DISPATCHED'});
 assert.deepEqual(await error(routinesUnavailable()),{code:'ROUTINES_UNAVAILABLE',outcome:'NOT_DISPATCHED'});
 assert.equal((await app.handle(new Request('https://routines.invalid/api/routines/list?extra=1'))).status,404);
 assert.equal(await app.handle(new Request('https://routines.invalid/elsewhere')),null);assert.equal(touched,0);
 assert.ok(Object.isFrozen(app));assert.ok(Object.isFrozen(app.paths));assert.ok(Object.isFrozen(ROUTINE_PATHS));
 for(const change of [{enabled:'true'},{limits:{...limits,extra:1}},{limits:{...limits,maxRequestMs:60001}},{limits:{...limits,maxRequestBytes:0}},
  {limits:{...limits,maxResponseBytes:16777217}},{now:null},{extra:1},{service}]){
  assert.throws(()=>fixture({},change),/ROUTINES_APPLICATION_CONFIGURATION/);
 }
 const services={prepare(){},approve(){},list(){},reconcile(){}};
 Object.defineProperty(services,'prepare',{enumerable:true,get(){throw Error('private accessor');}});
 assert.throws(()=>createRoutinesApplication({service:services,now:()=>NOW,limits}),/ROUTINES_APPLICATION_CONFIGURATION/);
 assert.throws(()=>createRoutinesApplication({enabled:false,limits:{...limits,maxRequestMs:0}}),/ROUTINES_APPLICATION_CONFIGURATION/);
 let clockCalls=0;
 fixture({}, {now:()=>{clockCalls++;return NOW;}});assert.equal(clockCalls,0);
});
test('JSON and declared length are checked before service invocation',async()=>{
 const f=fixture();
 for(const [body,extra,status,code]of [
  ['{',{},400,'INVALID_JSON'],['{}',{'content-length':'3'},400,'INVALID_CONTENT_LENGTH'],
  ['{}',{'content-length':'-1'},400,'INVALID_CONTENT_LENGTH'],['{}',{'content-length':'1e2'},400,'INVALID_CONTENT_LENGTH'],
  ['{}',{'content-length':'9007199254740992'},413,'REQUEST_TOO_LARGE'],
 ]){
  const response=await f.app.handle(request('prepare',body,{headers:{...headers,...extra}}));
  assert.equal(response.status,status);assert.equal((await error(response)).code,code);
 }
 const malformed=new Uint8Array([0xc3,0x28]);
 assert.equal((await error(await f.app.handle(request('prepare',malformed)))).code,'INVALID_UTF8');
 assert.equal(f.calls.length,0);
});
test('oversized streamed body and declared oversized body are canceled',async()=>{
 const f=fixture({}, {limits:{...limits,maxRequestBytes:4}});
 for(const declared of [false,true]){
  let canceled=0;
  const stream=new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('{"oversized":true}'));},cancel(){canceled++;}});
  const response=await f.app.handle(request('prepare',stream,{duplex:'half',headers:declared?{...headers,'content-length':'18'}:headers}));
  assert.equal(response.status,413);assert.equal((await error(response)).code,'REQUEST_TOO_LARGE');assert.equal(canceled,1);
 }
 assert.equal(f.calls.length,0);
});
test('body reading has deadline/cancellation and closes its stream without dispatch',async()=>{
 const f=fixture({}, {limits:{...limits,maxRequestMs:20}});let canceled=0;
 const stream=new ReadableStream({cancel(){canceled++;}});
 const response=await f.app.handle(request('prepare',stream,{duplex:'half'}));
 assert.equal(response.status,408);assert.equal((await error(response)).code,'DEADLINE');assert.equal(canceled,1);assert.equal(f.calls.length,0);
 const controller=new AbortController();controller.abort();
 const aborted=await f.app.handle(request('prepare','{}',{signal:controller.signal}));
 assert.equal(aborted.status,408);assert.equal(f.calls.length,0);
});
test('cancellation/deadline after approve starts stays UNKNOWN without retry',async()=>{
 let signal,entered;const ready=new Promise(resolve=>entered=resolve);
 const f=fixture({approve:async call=>{signal=call.signal;entered();return new Promise(()=>{});}});
 const controller=new AbortController(),work=f.app.handle(request('approve','{}',{signal:controller.signal}));await ready;controller.abort();
 const response=await work;assert.equal(response.status,499);assert.equal((await error(response)).outcome,'UNKNOWN');assert.equal(signal.aborted,true);
 const timed=fixture({approve:async()=>new Promise(()=>{})},{limits:{...limits,maxRequestMs:20}});
 const timeout=await timed.app.handle(request('approve'));assert.equal(timeout.status,408);assert.equal((await error(timeout)).outcome,'UNKNOWN');
});
test('own closed domain/native errors survive; messages/getters/proxies never become response data',async()=>{
 for(const [code,outcome,status]of [
  ['ROUTINES_INVALID_REQUEST','NOT_DISPATCHED',400],['ROUTINES_ACCESS_DENIED','NOT_DISPATCHED',403],
  ['ROUTINES_STALE','UNRESOLVED',409],['ROUTINES_UNAVAILABLE','UNKNOWN',503],
  ['SCHEDULE_CONTEXT_ACCESS_DENIED','NOT_DISPATCHED',403],['SCHEDULE_CONFLICT','ACKNOWLEDGED_NOT_RELEASED',502],
 ]){
  const f=fixture({approve:async()=>{throw Object.assign(Error('private-secret'),{code,outcome});}});
  const r=await f.app.handle(request('approve'));assert.equal(r.status,status);assert.deepEqual(await error(r),{code,outcome});
 }
 let touched=0;
 const accessor={get code(){touched++;return 'ACCESS_DENIED';},get outcome(){touched++;return 'NOT_DISPATCHED';}};
 const proxy=new Proxy({},{getOwnPropertyDescriptor(){touched++;throw Error('private-secret');},get(){touched++;throw Error('private-secret');}});
 for(const thrown of [Error('ACCESS_DENIED'),accessor,proxy,Object.assign(Error('private-secret'),{code:'private-secret',outcome:'private-secret'})]){
  const f=fixture({approve:async()=>{throw thrown;}}),r=await f.app.handle(request('approve'));
  assert.equal(r.status,502);assert.deepEqual(await error(r),{code:'REQUEST_FAILED',outcome:'UNKNOWN'});
 }
 assert.equal(touched,0);
});
test('canonical approve acknowledgement withheld after return survives; unproven results stay UNKNOWN',async()=>{
 let touches=0;
 const accessor={status:'acknowledged',get private(){touches++;throw Error('private-secret');}};
 for(const result of [{status:'acknowledged',text:'界'.repeat(1000)},accessor]){
  const f=fixture({approve:async()=>result}),r=await f.app.handle(request('approve'));
  assert.ok([413,502].includes(r.status));assert.equal((await error(r)).outcome,'ACKNOWLEDGED_NOT_RELEASED');
 }
 for(const result of [new Proxy({},{ownKeys(){touches++;throw Error('private-secret');}}),{text:'x'.repeat(1000)}]){
  const f=fixture({approve:async()=>result}),r=await f.app.handle(request('approve'));assert.equal((await error(r)).outcome,'UNKNOWN');
 }
 assert.equal(touches,0);
 const f=fixture({prepare:async()=>({text:'x'.repeat(1000)})}),r=await f.app.handle(request('prepare'));
 assert.equal(r.status,413);assert.equal((await error(r)).outcome,'UNKNOWN');
});
test('invalid live clock is a closed refusal without service execution',async()=>{
 for(const now of [()=>NaN,()=>-1,()=>Number.MAX_SAFE_INTEGER]){
  const f=fixture({}, {now}),r=await f.app.handle(request());assert.equal(r.status,500);assert.equal((await error(r)).code,'APPLICATION_CLOCK');assert.equal(f.calls.length,0);
 }
});
test('a returned approval receipt followed by deadline remains acknowledged but withheld',async()=>{
 let at=NOW;
 const f=fixture({approve:async()=>{at=NOW+1001;return {status:'acknowledged'};}},{now:()=>at});
 const response=await f.app.handle(request('approve'));
 assert.equal(response.status,408);assert.deepEqual(await error(response),{code:'DEADLINE',outcome:'ACKNOWLEDGED_NOT_RELEASED'});
});
test('reconcile ACKNOWLEDGED survives oversized delivery without retrying service',async()=>{
 let calls=0;
 const f=fixture({reconcile:async()=>{calls++;return {outcome:'ACKNOWLEDGED',detail:'界'.repeat(1000)};}});
 const response=await f.app.handle(request('reconcile'));
 assert.equal(response.status,413);assert.deepEqual(await error(response),{code:'RESPONSE_TOO_LARGE',outcome:'ACKNOWLEDGED_NOT_RELEASED'});assert.equal(calls,1);
});
test('reconcile ACKNOWLEDGED is captured before lifetime post-await deadline check',async()=>{
 let at=NOW,calls=0;
 const f=fixture({reconcile:async()=>{calls++;at=NOW+1001;return {outcome:'ACKNOWLEDGED'};}},{now:()=>at});
 const response=await f.app.handle(request('reconcile'));
 assert.equal(response.status,408);assert.deepEqual(await error(response),{code:'DEADLINE',outcome:'ACKNOWLEDGED_NOT_RELEASED'});assert.equal(calls,1);
});
test('reconcile UNRESOLVED remains unresolved on withheld size/deadline delivery',async()=>{
 for(const timed of [false,true]){
  let at=NOW;
  const f=fixture({reconcile:async()=>{if(timed)at=NOW+1001;return {outcome:'UNRESOLVED',detail:'x'.repeat(1000)};}},{now:()=>at});
  const response=await f.app.handle(request('reconcile'));
  assert.equal(response.status,timed?408:413);assert.equal((await error(response)).outcome,'UNRESOLVED');
 }
 let touches=0;
 const f=fixture({reconcile:async()=>({get outcome(){touches++;return 'ACKNOWLEDGED';}})});
 assert.equal((await error(await f.app.handle(request('reconcile')))).outcome,'UNKNOWN');assert.equal(touches,0);
});
