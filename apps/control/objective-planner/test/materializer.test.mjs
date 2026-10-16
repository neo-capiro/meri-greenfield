// Synthetic trusted transport; no Core authorization, HTTP request, model or application is performed.
import test from 'node:test';import assert from 'node:assert/strict';
import {createCorePlannerMaterializer} from '../materializer.mjs';
import {materializationInput} from '../identity.mjs';
import {productFailure} from '../../product-access/errors.mjs';
import {fixture,now} from './fixtures.mjs';
test('inert construction creates no effects or credential; fixed routes retain the same request identity',async()=>{
 const f=fixture(),calls=[],client=createCorePlannerMaterializer({now:()=>now,transport:{async request(call){calls.push(call);return {status:200,body:JSON.stringify(f.observation)};}}});assert.equal(calls.length,0);
 const call={work:f.work,deadlineMs:now+5000},out=await client.apply(call);await client.read(call);
 assert.equal(out.state,'observed');assert.deepEqual(JSON.parse(calls[0].body),materializationInput(f.work));assert.equal(calls[0].path,'/planner/strategy-materializations');assert.equal(calls[1].path,'/planner/strategy-materializations/'+f.work.plannerRequestId);assert.equal(calls[1].body,null);assert.equal(calls.length,2);assert.equal(calls[0].signal.aborted,true,'owned lifetime closed after request');
});
for(const status of [404,409,503])test('missing, stale or unavailable current observation never proves no effect: '+status,async()=>{
 const f=fixture(),calls=[],client=createCorePlannerMaterializer({now:()=>now,transport:{async request(call){calls.push(call);return{status,body:'{}'};}}});assert.deepEqual(await client.read({work:f.work,deadlineMs:now+1000}),{state:'unconfirmed'});assert.equal(calls.length,1);assert.equal(calls[0].method,'GET');
});
test('lost POST acknowledgement retains UNKNOWN and performs no automatic retry',async()=>{
 const f=fixture();let calls=0;const client=createCorePlannerMaterializer({now:()=>now,transport:{async request(){calls++;throw Error('synthetic lost ACK');}}});
 await assert.rejects(client.apply({work:f.work,deadlineMs:now+1000}),e=>productFailure(e)?.outcome==='UNKNOWN');assert.equal(calls,1);
});
test('invalid or oversized post-effect observation cannot be released as an application receipt',async()=>{
 const f=fixture();for(const body of ['{',JSON.stringify({...f.observation,providerData:{}}),'x'.repeat(4097)]){let calls=0;const client=createCorePlannerMaterializer({now:()=>now,maxFactBytes:4096,transport:{async request(){calls++;return{status:200,body};}}});await assert.rejects(client.apply({work:f.work,deadlineMs:now+1000}),e=>productFailure(e)?.outcome==='UNKNOWN');assert.equal(calls,1);}
});
test('revoked read authority withholds current data',async()=>{
 const f=fixture(),client=createCorePlannerMaterializer({now:()=>now,transport:{async request(){return{status:403,body:JSON.stringify(f.observation)};}}});await assert.rejects(client.read({work:f.work,deadlineMs:now+1000}),/ACCESS_DENIED/);
});
test('deadline aborts a parked transport and closes owned lifecycle without retry',async()=>{
 const f=fixture();let signal,calls=0;const client=createCorePlannerMaterializer({maxRequestMs:10,transport:{request(call){signal=call.signal;calls++;return new Promise(()=>{});}}});await assert.rejects(client.apply({work:f.work,deadlineMs:Date.now()+100}),e=>productFailure(e)?.outcome==='UNKNOWN');assert.equal(signal.aborted,true);assert.equal(calls,1);
});
test('cancelled caller or invalid source never reaches transport',async()=>{
 const f=fixture();let calls=0;const client=createCorePlannerMaterializer({transport:{request(){calls++;}}}),controller=new AbortController();controller.abort();await assert.rejects(client.apply({work:f.work,deadlineMs:Date.now()+100,signal:controller.signal}));f.work.strategyVersionId='invalid';await assert.rejects(client.apply({work:f.work,deadlineMs:Date.now()+100}));assert.equal(calls,0);
});
