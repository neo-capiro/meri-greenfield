import test from 'node:test';import assert from 'node:assert/strict';
import {captureRuntimePorts,createRuntimeProductApplications} from '../product-applications.mjs';
import {assembleConversationRunner} from '../conversation-runner.mjs';
import {applicationFixture,binding,versions} from '../../control/conversations/test/application-fixture.mjs';
const configuration={sourceEnabled:false,limits:{requestMs:100,requestBytes:131072,startupMs:1000,shutdownMs:1000},native:{maxResponseBytes:131072}};
const request=(path,body={})=>new Request('https://synthetic.invalid'+path,{method:'POST',headers:{authorization:'Bearer opaque-synthetic-task','content-type':'application/json'},body:JSON.stringify(body)});
test('runtime missing current owners refuses fixed product routes without remote effects',async()=>{
 const ports=captureRuntimePorts(),app=createRuntimeProductApplications({configuration,sessions:{},ports,now:Date.now});
 await assert.rejects(ports.identityContext.verifyIdentity({}),{code:'NATIVE_AUTHORITY_UNAVAILABLE'});
 for(const path of ['/api/documents/create','/internal/conversations/selected/prepare','/v1/runner/session/load'])assert.equal((await app.handle(request(path))).status,503);
 assert.equal((await app.handle(request('/internal/conversations/selected/other'))).status,404);assert.equal((await app.handle(request('/v1/runner/session/other'))).status,404);
 assert.equal(app.handle(request('/api/conversations/history')),null);
});
test('compiled ports are captured inertly with original receiver and sources remain disabled',async()=>{
 let getters=0,selected=0,sessions=0;const owner={marker:1,async load(){assert.equal(this.marker,1);sessions++;return {entries:null};},async register(){},async append(){},async listSubkeys(){}};
 assert.throws(()=>captureRuntimePorts({get artifactOptionsOwner(){getters++;return {};}}));assert.equal(getters,0);
 assert.throws(()=>captureRuntimePorts({artifactOptionsOwner:{get resolve(){getters++;return ()=>{};}}}));assert.equal(getters,0);
 const ports=captureRuntimePorts({sdkSessionOwner:owner,selectedController:{async handle(){selected++;}}});owner.load=()=>{throw Error('replacement');};
 const app=createRuntimeProductApplications({configuration,sessions:{},ports,now:Date.now});assert.equal((await app.handle(request('/v1/runner/session/load'))).status,200);assert.equal(sessions,1);
 assert.equal((await app.handle(request('/internal/conversations/selected/prepare'))).status,503);assert.equal(selected,0);
});
async function runnerFixture({key,failClose=false}={}){
 const f=await applicationFixture();await f.service.submit({credential:f.credential,input:f.input});const runtime={binding,versions,proxyUrl:'https://proxy.synthetic.invalid',proxyCredential:'scripted-task',model:'scripted-no-provider',deadlineMs:Date.now()+3000,maxTurns:1,maxCostMicroUSD:1,maxOutputBytes:1024,...(key===undefined?{}:{sdkSessionKey:key})};
 let calls=0,closes=0,factory=0;
 const execute=assembleConversationRunner({configuration:{binding,versions,workspace:'/workspace/'+binding.conversationId,proxyOrigin:'https://proxy.synthetic.invalid',sourceEnabled:false},native:{async call(path,input){if(path==='runner/load')return f.service.loadForExecution({credential:f.credential,binding});if(path==='runner/publish')return f.service.publish({credential:f.credential,binding,event:input.event});if(path==='runner/runtime')return runtime;throw Error(path);}},sessionFactory:async input=>{factory++;assert.deepEqual(input.sessionKey,key);return {store:{async load(){return null;},async append(){}},async settle(){if(failClose)throw Error('SESSION_UNKNOWN');},async close(){closes++;}};},query({options}){calls++;assert.equal(Object.hasOwn(options,'sdkSessionKey'),false);return {async *[Symbol.asyncIterator](){yield {type:'result',subtype:'success',is_error:false};},close(){}};}});
 return {f,execute,counts:()=>({calls,closes,factory})};
}
test('runner refuses missing observed registration before the single SDK query',async()=>{const x=await runnerFixture();try{await assert.rejects(x.execute({binding}),/EXECUTION_FAILED/u);assert.deepEqual(x.counts(),{calls:0,closes:0,factory:0});assert.equal((await x.f.service.history({credential:x.f.credential})).run.state,'queued');}finally{x.f.close();}});
test('runner preserves exact observed key, strips private selector and closes owned mirror',async()=>{const key={projectKey:'observed / punctuation remains opaque',sessionId:'11111111-1111-4111-8111-111111111111'},x=await runnerFixture({key});try{assert.deepEqual(await x.execute({binding}),{state:'completed'});assert.deepEqual(x.counts(),{calls:1,closes:1,factory:1});}finally{x.f.close();}});
test('uncertain observed SDK mirror prevents durable completed status and releases no success',async()=>{const x=await runnerFixture({key:{projectKey:'observed',sessionId:'11111111-1111-4111-8111-111111111111'},failClose:true});try{await assert.rejects(x.execute({binding}),/EXECUTION_FAILED/u);assert.deepEqual(x.counts(),{calls:1,closes:1,factory:1});assert.equal((await x.f.service.history({credential:x.f.credential})).run.state,'failed');}finally{x.f.close();}});
