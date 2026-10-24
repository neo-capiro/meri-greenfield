/** Fixed service-authenticated job transport; no live Core or secret is used. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createCoreObjectiveGenerationTransport} from '../core-http.mjs';
import {runStartFixture,NOW} from '../../../runtime/objective-source/test/run-start-fixture.mjs';
const secret='synthetic-core-service-secret-0123456789',origin='https://core.synthetic.invalid';
function fixture(overrides={}){const f=runStartFixture(),state={calls:[],secrets:0},source={generationJobId:f.generationJobId,binding:f.binding};
 const configuration={source,origin,now:()=>NOW,maxRequestMs:50,getServiceSecret:async()=>{state.secrets++;return secret;},fetchImpl:async(url,options)=>{state.calls.push({url,options});return Response.json({opaque:'transport-only'},{status:options.method==='POST'?201:200});},...overrides};
 return {state,source,configuration,client:createCoreObjectiveGenerationTransport(configuration),call:{deadlineMs:NOW+1000}};
}
for(const [method,path,verb] of [['admit','generation-admissions','POST'],['publish','generation-requests','POST'],['accept','generation-acceptances','POST'],['complete','generation-completions','POST'],['readAdmission','generation-admissions','GET'],['readRequest','generation-requests','GET'],['readCompletion','generation-completions','GET']])test(method+' uses the fixed job-only route and one service credential read',async()=>{
 const x=fixture(),r=await x.client[method](x.call),sent=x.state.calls[0];assert.equal(r.kind,'unqualified-response');assert.equal(x.state.calls.length,1);assert.equal(x.state.secrets,1);
 assert.equal(sent.url,origin+'/strategy-api/internal/objective-canonical/'+path+(verb==='GET'?'/'+x.source.generationJobId:''));assert.equal(sent.options.method,verb);
 assert.equal(sent.options.headers['x-internal-service-secret'],secret);assert.equal(sent.options.headers.authorization,undefined);
 assert.deepEqual(verb==='GET'?sent.options.body:JSON.parse(sent.options.body),verb==='GET'?undefined:{schemaVersion:1,generationJobId:x.source.generationJobId});
 for(const [key,value] of Object.entries({redirect:'error',credentials:'omit',cache:'no-store'}))assert.equal(sent.options[key],value);
 assert.equal(sent.options.signal.aborted,true);
});
test('construction accepts no caller-selected route or authority mechanism',()=>{
 for(const change of [{origin:'http://core.synthetic.invalid'},{origin:origin+'/path'},{origin:'https://user@core.synthetic.invalid'},{authorization:{}},{getServiceSecret:null},{source:{generationJobId:'not-job'}},{maxRequestMs:0},{maxFactBytes:1048577}])assert.throws(()=>fixture(change));
});
for(const name of ['secret-unavailable','blank-secret','multiline-secret','wrong-status','redirected','wrong-content','compressed','oversize-header','oversize-body','invalid-json','network'])test('transport refuses '+name+' without retry or credential renewal',async()=>{
 let calls=0,secrets=0;const x=fixture({getServiceSecret:async()=>{secrets++;if(name==='secret-unavailable')throw Error('unavailable');return name==='blank-secret'?'':name==='multiline-secret'?'unsafe\nvalue':secret;},
  fetchImpl:async()=>{calls++;if(name==='network')throw Error('lost');if(name==='redirected'){const r=Response.json({});Object.defineProperty(r,'redirected',{value:true});return r;}
   const headers={'content-type':'application/json'};if(name==='wrong-content')headers['content-type']='text/plain';if(name==='compressed')headers['content-encoding']='gzip';if(name==='oversize-header')headers['content-length']='1048577';
   return new Response(name==='invalid-json'?'{':name==='oversize-body'?JSON.stringify({x:'a'.repeat(1048577)}):'{}',{status:name==='wrong-status'?403:201,headers});}});
 assert.deepEqual(await x.client.admit(x.call),{kind:'unavailable'});assert.ok(calls<=1);assert.equal(secrets,1);
});
test('cancelled and timed-out operations do not return late success',async()=>{
 const a=new AbortController();a.abort();const x=fixture();assert.deepEqual(await x.client.admit({...x.call,signal:a.signal}),{kind:'unavailable'});assert.equal(x.state.calls.length,0);assert.equal(x.state.secrets,0);
 const waiting=fixture({fetchImpl:async()=>new Promise(()=>{})});assert.deepEqual(await waiting.client.admit(waiting.call),{kind:'unavailable'});
});