import test from 'node:test';
import assert from 'node:assert/strict';
import {createRuntimeSdkSessionFactory} from '../../../../../apps/runtime/sdk-session-runtime.mjs';
import {assembleConversationRunner} from '../../../../../apps/runtime/conversation-runner.mjs';
import {applicationFixture,binding,versions} from '../../../../../apps/control/conversations/test/application-fixture.mjs';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';

// SDK0.3.295 flushes pending mirror batches during cleanup; this scripted close
// tests the external lifecycle consequence without allocating an SDK/provider process.
test('SDK cleanup callback after run cancellation cannot newly register or retain a session',async()=>{
 const f=await applicationFixture(),controller=new AbortController(),calls=[];
 await f.service.submit({credential:f.credential,input:f.input});
 const key={projectKey:'actual callback key',sessionId:'11111111-1111-4111-8111-000000000005'};
 const factory=createRuntimeSdkSessionFactory({origin:'https://native.synthetic.invalid',credential:'scripted-current-task',binding,
  fetchImpl:async(url,options)=>{const body=JSON.parse(options.body),common={binding:body.binding,key:body.key,requestSha256:hash(body)};calls.push(new URL(url).pathname);
   if(url.endsWith('/register'))return Response.json({...common,registered:true});
   if(url.endsWith('/load'))return Response.json({...common,entries:null,offset:0});
   if(url.endsWith('/append'))return Response.json({...common,committed:true,appendId:body.appendId,entriesSha256:body.entriesSha256,offset:body.expectedOffset+body.entries.length,added:body.entries.length});throw Error('unexpected synthetic route');}});
 const runtime={binding,versions,proxyUrl:'https://proxy.synthetic.invalid',proxyCredential:'scripted',model:'no-provider',deadlineMs:Date.now()+3000,maxTurns:1,maxCostMicroUSD:1,maxOutputBytes:1024,sdkSessionKey:null};
 let lateWrite;
 const execute=assembleConversationRunner({configuration:{binding,versions,workspace:'/workspace/'+binding.conversationId,proxyOrigin:'https://proxy.synthetic.invalid',sourceEnabled:false},sessionFactory:factory,
  native:{async call(path,input){if(path==='runner/load')return f.service.loadForExecution({credential:f.credential,binding});if(path==='runner/runtime')return runtime;if(path==='runner/publish')return f.service.publish({credential:f.credential,binding,event:input.event});throw Error(path);}},
  query({options}){return {async *[Symbol.asyncIterator](){yield {type:'system',subtype:'init',session_id:key.sessionId};controller.abort();yield {type:'result',subtype:'success',is_error:false};},close(){lateWrite=options.sessionStore.append(key,[{type:'system',marker:'late cleanup mirror'}]);lateWrite.catch(()=>{});}};}});
 try{await assert.rejects(execute({binding,signal:controller.signal}));await lateWrite?.catch(()=>{});assert.deepEqual(calls,[],'cancelled run must refuse fresh registration before SDK cleanup flush');}
 finally{f.close();}
});

test('run abort cancels in-flight first registration and prevents subsequent retained effects and retries',async()=>{
 const controller=new AbortController(),entered=Promise.withResolvers(),calls=[];
 const factory=createRuntimeSdkSessionFactory({origin:'https://native.synthetic.invalid',credential:'scripted-current-task',binding,
  fetchImpl:async(url,options)=>{calls.push(new URL(url).pathname);entered.resolve(options.signal);return new Promise((_,reject)=>{const stopped=()=>reject(Error('synthetic transport observed abort'));if(options.signal.aborted)stopped();else options.signal.addEventListener('abort',stopped,{once:true});});}});
 const key={projectKey:'actual callback key',sessionId:'11111111-1111-4111-8111-000000000005'};
 const mirror=await factory({binding,sessionKey:null,runtimeSignal:controller.signal}),write=mirror.store.append(key,[{type:'system'}]);
 const denied=assert.rejects(write);const transportedSignal=await entered.promise;controller.abort();await denied;
 assert.equal(transportedSignal.aborted,true);assert.deepEqual(calls,['/v1/runner/session/register']);
 await assert.rejects(mirror.store.append(key,[{type:'system'}]));await assert.rejects(mirror.settle());await assert.rejects(mirror.close());
 assert.deepEqual(calls,['/v1/runner/session/register']);
});
