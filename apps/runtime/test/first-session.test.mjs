import test from 'node:test';
import assert from 'node:assert/strict';
import {createRuntimeSdkSessionFactory} from '../sdk-session-runtime.mjs';
import {createNativeSdkSessionApplication} from '../native-authority/session-http.mjs';
import {fixture,id,NOW} from '../native-authority/test/fixture.mjs';
import {assembleConversationRunner} from '../conversation-runner.mjs';
import {applicationFixture,binding,versions} from '../../control/conversations/test/application-fixture.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';

async function mirrorFixture(){
 const f=fixture(),app=createNativeSdkSessionApplication({owner:f.owner,now:()=>NOW}),calls=[];
 const factory=createRuntimeSdkSessionFactory({origin:'https://native.synthetic.invalid',credential:'opaque-native-task',binding:f.binding,now:()=>NOW,
  fetchImpl:async(url,options)=>{calls.push(new URL(url).pathname);return app.handle(new Request(url,options));}});
 return {...f,calls,factory,mirror:await factory({binding:f.binding,sessionKey:null})};
}

test('fresh mirror is inert until actual main key and preserves ordered canonical native writes',async()=>{
 const f=await mirrorFixture();assert.deepEqual(f.calls,[]);assert.equal(f.state().owner,null);
 await Promise.all([f.mirror.store.append(f.key,[{type:'user',uuid:id(30),message:'first'}]),f.mirror.store.append(f.key,[{type:'assistant',uuid:id(31),message:'second'}])]);
 await f.mirror.store.append({...f.key,subpath:'subagents/opaque:child'},[{type:'system',marker:'subagent'}]);await f.mirror.settle();
 assert.equal(f.calls.filter(path=>path.endsWith('/register')).length,1);assert.ok(f.calls[0].endsWith('/register'));
 assert.deepEqual(f.state().entries.map(e=>e.entry.message??e.entry.marker),['first','second','subagent']);
 assert.deepEqual(f.state().owner.owner.key,f.key);await f.mirror.close();
});

test('fresh mirror cannot load old state or report completion without observed registration',async()=>{
 const f=await mirrorFixture();await assert.rejects(f.mirror.store.load(f.key),{code:'RUNNER_SDK_FIRST_LOAD_REFUSED'});
 await assert.rejects(f.mirror.store.listSubkeys(f.key),{code:'RUNNER_SDK_FIRST_LOAD_REFUSED'});
 await assert.rejects(f.mirror.settle(),{code:'RUNNER_SDK_REGISTRATION_UNAVAILABLE'});await f.mirror.close();assert.deepEqual(f.calls,[]);
});

test('invalid entries, first subkey and accessor keys refuse before registration and poison later dispatch',async()=>{
 for(const mode of ['entries','subkey','accessor']){
  const f=await mirrorFixture();let getters=0;const key=mode==='subkey'?{...f.key,subpath:'subagents/first'}:mode==='accessor'?{...f.key,get projectKey(){getters++;return f.key.projectKey;}}:f.key;
  await assert.rejects(f.mirror.store.append(key,mode==='entries'?[{withoutType:true}]:[{type:'system'}]));
  await assert.rejects(f.mirror.store.append(f.key,[{type:'system'}]),{code:'RUNNER_SDK_SESSION_UNKNOWN'});
  await assert.rejects(f.mirror.settle());await f.mirror.close();assert.deepEqual(f.calls,[]);assert.equal(getters,0);
 }
});

test('first callback key must match independently observed native key; rejection is never registered again',async()=>{
 const f=await mirrorFixture(),foreign={...f.key,projectKey:'caller guess'};
 await assert.rejects(f.mirror.store.append(foreign,[{type:'system'}]));const count=f.calls.length;
 for(let retry=0;retry<3;retry++)await assert.rejects(f.mirror.store.append(foreign,[{type:'system'}]));
 assert.equal(f.calls.length,count);assert.equal(f.calls.filter(path=>path.endsWith('/register')).length,1);
 assert.equal(f.state().owner,null);await assert.rejects(f.mirror.settle());await assert.rejects(f.mirror.close());
});

test('registered fresh mirror refuses another project/session and cannot settle it as success',async()=>{
 const f=await mirrorFixture();await f.mirror.store.append(f.key,[{type:'system'}]);const count=f.calls.length;
 await assert.rejects(f.mirror.store.append({...f.key,sessionId:id(99)},[{type:'system'}]));assert.equal(f.calls.length,count);
 await assert.rejects(f.mirror.settle(),{code:'RUNNER_SDK_SESSION_UNKNOWN'});await assert.rejects(f.mirror.close());
});

test('native revocation and uncertain registration remain terminal barriers across SDK retries',async()=>{
 for(const mode of ['revoked','unknown']){
  const f=await mirrorFixture();if(mode==='revoked')f.revoke();else f.unknown(true);
  await assert.rejects(f.mirror.store.append(f.key,[{type:'system'}]));const count=f.calls.length;
  await assert.rejects(f.mirror.store.append(f.key,[{type:'system'}]));assert.equal(f.calls.length,count);
  assert.equal(f.state().entries.length,0);await assert.rejects(f.mirror.settle());await assert.rejects(f.mirror.close());
  if(mode==='unknown')assert.ok(f.state().owner,'uncertain registered state is retained, never reset');
 }
});

test('null fresh selector cannot be used for continuation or changed binding',async()=>{
 const f=await mirrorFixture();await assert.rejects(f.factory({binding:f.binding,sessionKey:null,continuation:{}}),{code:'RUNNER_SDK_REGISTRATION_UNAVAILABLE'});
 await assert.rejects(f.factory({binding:{...f.binding,writerFence:2},sessionKey:null}),{code:'RUNNER_SDK_REGISTRATION_UNAVAILABLE'});
 assert.deepEqual(f.calls,[]);await f.mirror.close();
});

test('closing before registration acknowledgement retires queued effects without re-registering',async()=>{
 const f=fixture(),entered=Promise.withResolvers(),release=Promise.withResolvers(),calls=[];
 const factory=createRuntimeSdkSessionFactory({origin:'https://native.synthetic.invalid',credential:'opaque-native-task',binding:f.binding,
  fetchImpl:async(url,options)=>{calls.push(url);entered.resolve();await release.promise;const body=JSON.parse(options.body);return Response.json({binding:body.binding,key:body.key,requestSha256:hash(body),registered:true});}});
 const mirror=await factory({binding:f.binding,sessionKey:null}),write=mirror.store.append(f.key,[{type:'system'}]);
 const writeRejected=assert.rejects(write);await entered.promise;const closed=assert.rejects(mirror.close());release.resolve();await Promise.all([writeRejected,closed]);
 assert.equal(calls.length,1);await assert.rejects(mirror.store.append(f.key,[{type:'system'}]));assert.equal(calls.length,1);
});

async function runner(mirrors){
 const f=await applicationFixture();await f.service.submit({credential:f.credential,input:f.input});const key={projectKey:'actual callback / opaque key',sessionId:id(5)},calls=[],events=[];let queryCalls=0;
 const factory=createRuntimeSdkSessionFactory({origin:'https://native.synthetic.invalid',credential:'scripted-current-task',binding,
  fetchImpl:async(url,options)=>{const body=JSON.parse(options.body),common={binding:body.binding,key:body.key,requestSha256:hash(body)};calls.push(url);
   if(url.endsWith('/register'))return Response.json({...common,registered:true});if(url.endsWith('/load'))return Response.json({...common,entries:null,offset:0});
   if(url.endsWith('/append'))return Response.json({...common,committed:true,appendId:body.appendId,entriesSha256:body.entriesSha256,offset:body.expectedOffset+body.entries.length,added:body.entries.length});throw Error('unexpected synthetic route');}});
 const runtime={binding,versions,proxyUrl:'https://proxy.synthetic.invalid',proxyCredential:'scripted-task',model:'scripted-no-provider',deadlineMs:Date.now()+3000,maxTurns:1,maxCostMicroUSD:1,maxOutputBytes:1024,sdkSessionKey:null};
 const execute=assembleConversationRunner({configuration:{binding,versions,workspace:'/workspace/'+binding.conversationId,proxyOrigin:'https://proxy.synthetic.invalid',sourceEnabled:false},sessionFactory:factory,
  native:{async call(path,input){if(path==='runner/load')return f.service.loadForExecution({credential:f.credential,binding});if(path==='runner/runtime')return runtime;if(path==='runner/publish'){events.push(input.event.data.state??input.event.type);if(input.event.data.state==='completed')assert.ok(calls.at(-1).endsWith('/append'));return f.service.publish({credential:f.credential,binding,event:input.event});}throw Error(path);}},
  query({options}){queryCalls++;assert.equal(calls.length,0,'fresh key cannot be registered before query');assert.equal(Object.hasOwn(options,'sdkSessionKey'),false);return {async *[Symbol.asyncIterator](){yield {type:'system',subtype:'init',session_id:key.sessionId};if(mirrors)await options.sessionStore.append(key,[{type:'user',uuid:id(40),message:'synthetic'}]);yield {type:'result',subtype:'success',is_error:false};},close(){}};}});
 return {f,execute,calls,events,queryCalls:()=>queryCalls};
}

test('one scripted SDK query obtains its first mirror key and settles before durable completion',async()=>{
 const x=await runner(true);try{assert.deepEqual(await x.execute({binding}),{state:'completed'});assert.equal(x.queryCalls(),1);assert.equal(x.events.at(-1),'completed');assert.equal((await x.f.service.history({credential:x.f.credential})).run.state,'completed');assert.equal(x.execute.cleanupStatus().physicalStopProven,false);}finally{x.f.close();}
});

test('scripted success without first mirror cannot produce durable completed state',async()=>{
 const x=await runner(false);try{await assert.rejects(x.execute({binding}),/EXECUTION_FAILED/);assert.equal(x.queryCalls(),1);assert.equal(x.calls.length,0);assert.ok(!x.events.includes('completed'));assert.equal((await x.f.service.history({credential:x.f.credential})).run.state,'failed');}finally{x.f.close();}
});
