/** Private HTTP boundary over a borrowed readback owner; no Core/database call is fabricated. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createObjectiveFamily,createObjectiveReaderApplication,OBJECTIVE_READER_PREFIX} from '../objective.mjs';
import {createProductPortsFactory} from '../index.mjs';
import {runStartFixture} from '../../objective-source/test/run-start-fixture.mjs';
const origin='https://control.synthetic.invalid',serviceSecret='synthetic-service-secret-0123456789';
function fixture(){const f=runStartFixture(),state={reads:[],secrets:0,secret:serviceSecret,blocked:false};
 const reader=Object.fromEntries(['acceptance','completion'].map(method=>[method,async value=>{state.reads.push({method,value});if(state.blocked)return new Promise(()=>{});return {schemaVersion:1,method};}]));
 const app=createObjectiveReaderApplication({reader,getServiceSecret:async()=>{state.secrets++;return state.secret;},maxRequestMs:50});
 const body=method=>({schemaVersion:1,generationJobId:f.generationJobId,sourceAdmissionSha256:f.record.sourceAdmissionSha256,...(method==='completion'?{binding:f.binding}:{})});
 const request=(method='acceptance',options={})=>new Request(origin+OBJECTIVE_READER_PREFIX+method+'/read',{method:'POST',headers:{'content-type':'application/json','x-internal-service-secret':serviceSecret,...options.headers},body:options.body??JSON.stringify(body(method)),...(options.signal?{signal:options.signal}:{})});
 return {f,state,app,reader,body,request};
}
test('no public port; disabled private paths refuse before body consumption and unrelated paths remain absent',async()=>{
 assert.deepEqual(createObjectiveFamily({}),{ports:{}});assert.deepEqual(createProductPortsFactory({families:[['objective',createObjectiveFamily]]})({}),{});
 const app=createObjectiveReaderApplication();for(const method of ['acceptance','completion']){let pulls=0;const body=new ReadableStream({pull(){pulls++;}},{highWaterMark:0});
 const r=await app.handle(new Request(origin+OBJECTIVE_READER_PREFIX+method+'/read',{method:'POST',headers:{'content-type':'application/json'},body,duplex:'half'}));assert.equal(r.status,503);assert.equal(pulls,0);await body.cancel();}
 assert.equal(await app.handle(new Request(origin+'/v2/internal/objective-generation/accepted-source/read')),null);
 assert.equal(await app.handle(new Request(origin+'/api/documents/download')),null);
 assert.throws(()=>createObjectiveReaderApplication({reader:{}}));assert.throws(()=>createObjectiveReaderApplication({getServiceSecret:async()=>serviceSecret}));
});
for(const method of ['acceptance','completion'])test('fixed '+method+' route passes only the saved-job selector and returns bounded no-store JSON',async()=>{
 const x=fixture(),response=await x.app.handle(x.request(method));assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
 assert.deepEqual(await response.json(),{schemaVersion:1,method});assert.equal(x.state.reads.length,1);
 const {signal,...input}=x.state.reads[0].value;assert.deepEqual(input,x.body(method));assert.equal(signal.aborted,true);assert.equal(x.state.secrets,1);
});
for(const name of ['missing','wrong','bearer','rotated'])test('service '+name+' authentication refuses before any body or readback work',async()=>{
 const x=fixture();let pulls=0;const body=new ReadableStream({pull(){pulls++;}},{highWaterMark:0}),headers={'content-type':'application/json'};
 if(name==='wrong')headers['x-internal-service-secret']='synthetic-incorrect-secret';if(name==='bearer')headers.authorization='Bearer '+serviceSecret;
 if(name==='rotated'){headers['x-internal-service-secret']=serviceSecret;x.state.secret='synthetic-service-rotated-secret';}
 const r=await x.app.handle(new Request(origin+OBJECTIVE_READER_PREFIX+'acceptance/read',{method:'POST',headers,body,duplex:'half'}));
 assert.equal(r.status,503);assert.equal(pulls,0);assert.equal(x.state.reads.length,0);await body.cancel();
});
for(const name of ['extra-actor','extra-path','invalid-json','oversize','compressed','wrong-content','query','method'])test('closed private transport refuses '+name,async()=>{
 const x=fixture(),body=x.body('acceptance'),options={};
 if(name==='extra-actor')body.actorId='caller';if(name==='extra-path')body.objectPath='/other';options.body=JSON.stringify(body);
 if(name==='invalid-json')options.body='{';if(name==='oversize')options.body=JSON.stringify({padding:'x'.repeat(16385)});
 if(name==='compressed')options.headers={'content-encoding':'gzip'};if(name==='wrong-content')options.headers={'content-type':'text/plain'};
 let request=x.request('acceptance',options);if(name==='query')request=new Request(request.url+'?x=1',request);if(name==='method')request=new Request(request,{method:'PUT'});
 const r=await x.app.handle(request);assert.equal(r.status,503);assert.equal(x.state.reads.length,0);assert.deepEqual(await r.json(),{error:{code:'OBJECTIVE_READBACK_UNAVAILABLE'}});
});
test('cancellation, a stalled owner and oversized response cannot release a result',async()=>{
 const x=fixture(),a=new AbortController();a.abort();assert.equal((await x.app.handle(x.request('acceptance',{signal:a.signal}))).status,503);assert.equal(x.state.reads.length,0);
 x.state.blocked=true;assert.equal((await x.app.handle(x.request())).status,503);
 const app=createObjectiveReaderApplication({reader:{acceptance:async()=>({bytes:'x'.repeat(8*1024*1024)}),completion:async()=>({})},getServiceSecret:async()=>serviceSecret});
 assert.equal((await app.handle(x.request())).status,503);
});