import test from 'node:test';import assert from 'node:assert/strict';import {performance} from 'node:perf_hooks';
import {assembleConversationRunner} from '../../../../../apps/runtime/conversation-runner.mjs';
import {createRuntimeSdkSessionFactory} from '../../../../../apps/runtime/sdk-session-runtime.mjs';
import {applicationFixture,binding,versions} from '../../../../../apps/control/conversations/test/application-fixture.mjs';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
const key={projectKey:'native observed / opaque project !',sessionId:'11111111-1111-4111-8111-111111111111'};
async function setup(factory,query){const f=await applicationFixture();await f.service.submit({credential:f.credential,input:f.input});const events=[];
 const runtime={binding,versions,proxyUrl:'https://proxy.synthetic.invalid',proxyCredential:'synthetic-task',model:'synthetic-no-provider',deadlineMs:Date.now()+3000,maxTurns:1,maxCostMicroUSD:1,maxOutputBytes:1024,sdkSessionKey:key};
 const execute=assembleConversationRunner({configuration:{binding,versions,workspace:'/workspace/'+binding.conversationId,proxyOrigin:'https://proxy.synthetic.invalid',sourceEnabled:false,limits:{shutdownMs:100}},native:{async call(path,input){if(path==='runner/load')return f.service.loadForExecution({credential:f.credential,binding});if(path==='runner/runtime')return runtime;if(path==='runner/publish'){events.push(input.event.data.state??input.event.type);return f.service.publish({credential:f.credential,binding,event:input.event});}throw Error(path);}},sessionFactory:factory,query});
 return {f,events,execute};}

test('assembled runner cancellation uses configured100ms bound for a parked owned close',async()=>{
 const ready=Promise.withResolvers(),closing=Promise.withResolvers(),release=Promise.withResolvers(),controller=new AbortController();let queryCloses=0;
 const x=await setup(async()=>({store:{async load(){return null;},async append(){}},async settle(){},async close(){closing.resolve();await release.promise;}}),()=>({async *[Symbol.asyncIterator](){ready.resolve();await release.promise;yield {type:'result',subtype:'success',is_error:false};},close(){queryCloses++;}}));let execution;
 try{execution=x.execute({binding,signal:controller.signal});await ready.promise;controller.abort();await closing.promise;const started=performance.now();await assert.rejects(execution,/RUNNER_CLEANUP_UNKNOWN/);const elapsed=performance.now()-started;assert.ok(elapsed>=60&&elapsed<450,`configured cleanup elapsed ${elapsed}`);assert.equal(queryCloses,1);assert.ok(!x.events.includes('completed'));assert.equal((await x.f.service.history({credential:x.f.credential})).run.state,'cancelled');assert.deepEqual(x.execute.cleanupStatus().failures,['RUNNER_CLEANUP_UNKNOWN']);assert.equal(x.execute.cleanupStatus().physicalStopProven,false);}
 finally{release.resolve();await execution?.catch(()=>{});x.f.close();}
});

test('actual bounded native mirror append acknowledgement precedes durable completed status',async()=>{
 const appendEntered=Promise.withResolvers(),ack=Promise.withResolvers();let acknowledged=false,queryCalls=0,mirror;
 const factory=createRuntimeSdkSessionFactory({origin:'https://native.synthetic.invalid',credential:'opaque-synthetic-only',binding,fetchImpl:async(url,options)=>{const body=JSON.parse(options.body),common={binding:body.binding,key:body.key,requestSha256:hash(body)};
 if(url.endsWith('/register'))return Response.json({...common,registered:true});
 if(url.endsWith('/load'))return Response.json({...common,entries:null,offset:0});
 if(url.endsWith('/append')){appendEntered.resolve();await ack.promise;acknowledged=true;return Response.json({...common,committed:true,appendId:body.appendId,entriesSha256:body.entriesSha256,offset:body.expectedOffset+body.entries.length,added:body.entries.length});}throw Error('unexpected transport');}});
 const x=await setup(factory,({options})=>{queryCalls++;mirror=options.sessionStore.append(key,[{type:'user',uuid:'22222222-2222-4222-8222-222222222222',message:'synthetic only'}]);return {async *[Symbol.asyncIterator](){yield {type:'result',subtype:'success',is_error:false};},close(){}};});let execution;
 try{execution=x.execute({binding});await appendEntered.promise;assert.equal(acknowledged,false);assert.ok(!x.events.includes('completed'));ack.resolve();assert.deepEqual(await execution,{state:'completed'});await mirror;assert.equal(acknowledged,true);assert.equal(queryCalls,1);assert.equal(x.events.at(-1),'completed');assert.equal((await x.f.service.history({credential:x.f.credential})).run.state,'completed');assert.equal(x.execute.cleanupStatus().physicalStopProven,false);}
 finally{ack.resolve();await execution?.catch(()=>{});await mirror?.catch(()=>{});x.f.close();}
});
