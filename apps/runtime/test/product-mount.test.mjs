import test from 'node:test';import assert from 'node:assert/strict';
import {captureRuntimePorts,createRuntimeProductApplications} from '../product-applications.mjs';
import {assembleConversationRunner} from '../conversation-runner.mjs';
import {applicationFixture,binding,versions} from '../../control/conversations/test/application-fixture.mjs';
const configuration={sourceEnabled:false,limits:{requestMs:100,requestBytes:131072,startupMs:1000,shutdownMs:1000},native:{maxResponseBytes:131072}};
const request=(path,body={})=>new Request('https://synthetic.invalid'+path,{method:'POST',headers:{authorization:'Bearer opaque-synthetic-task','content-type':'application/json'},body:JSON.stringify(body)});

test('trusted transition authority is captured with its original receiver and refuses accessor injection',async()=>{
 let calls=0,getters=0;const owner={marker:'original',async readCurrent(input){assert.equal(this.marker,'original');calls++;return input;}};
 assert.throws(()=>captureRuntimePorts({get transitionAuthority(){getters++;return owner;}}));
 assert.throws(()=>captureRuntimePorts({transitionAuthority:{get readCurrent(){getters++;return ()=>{};}}}));assert.equal(getters,0);
 const identity={async verifyIdentity(){},async resolveContext(){}};Object.setPrototypeOf(identity,new Proxy({}, {has(){getters++;throw Error('prototype trap');}}));assert.throws(()=>captureRuntimePorts({identityContext:identity}));assert.equal(getters,0);
 assert.throws(()=>captureRuntimePorts({identityContext:{async verifyIdentity(){},async resolveContext(){},get resolveTransitionContext(){getters++;return ()=>{};}}}));assert.equal(getters,0);
 const ports=captureRuntimePorts({transitionAuthority:owner});owner.readCurrent=()=>{throw Error('caller replacement');};
 const input={binding:'synthetic-boundary-only'};assert.equal(await ports.transitionAuthority.readCurrent(input),input);assert.equal(calls,1);assert.ok(Object.isFrozen(ports.transitionAuthority));assert.equal(captureRuntimePorts().transitionAuthority,undefined);
});
test('runtime missing current owners refuses fixed product routes without remote effects',async()=>{
 const ports=captureRuntimePorts(),app=createRuntimeProductApplications({configuration,sessions:{},ports,now:Date.now});
 await assert.rejects(ports.identityContext.verifyIdentity({}),{code:'NATIVE_AUTHORITY_UNAVAILABLE'});
 for(const path of ['/api/documents/create','/internal/conversations/selected/prepare','/v1/runner/session/load'])assert.equal((await app.handle(request(path))).status,503);
 assert.equal((await app.handle(request('/internal/conversations/selected/other'))).status,404);assert.equal((await app.handle(request('/v1/runner/session/other'))).status,404);
 assert.equal((await app.handle(request('/api/conversations/list'))).status,503);
});
test('saved history requires a captured read-only conversation currentness owner',async()=>{
 let called=0,getters=0;
 const owner={marker:'original',async assertCurrent(input){assert.equal(this.marker,'original');called++;return input;}};
 assert.throws(()=>captureRuntimePorts({conversationCurrentness:{get assertCurrent(){getters++;return ()=>{};}}}));assert.equal(getters,0);
 const ports=captureRuntimePorts({conversationCurrentness:owner});owner.assertCurrent=()=>{throw Error('caller replacement');};
 assert.deepEqual(await ports.conversationCurrentness.assertCurrent({conversationId:'synthetic'}),{conversationId:'synthetic'});
 assert.equal(called,1);assert.ok(Object.isFrozen(ports.conversationCurrentness));
 const membership={async admit(){throw Error('unexpected admission');},async recheck(){throw Error('unexpected recheck');}};
 const closed=createRuntimeProductApplications({configuration,sessions:{},ports:captureRuntimePorts({conversationMembership:membership}),conversationStore:{},now:Date.now});
 assert.equal((await closed.handle(request('/api/conversations/list'))).status,503);
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
 const f=await applicationFixture({initialInput:true});await f.service.allocateInput({credential:f.credential,input:f.input});await f.service.submit({credential:f.credential,input:f.input});const runtime={binding,versions,proxyUrl:'https://proxy.synthetic.invalid',proxyCredential:'scripted-task',model:'scripted-no-provider',deadlineMs:Date.now()+3000,maxTurns:1,maxCostMicroUSD:1,maxOutputBytes:1024,...(key===undefined?{}:{sdkSessionKey:key})};
 let calls=0,closes=0,factory=0;
 const execute=assembleConversationRunner({configuration:{binding,versions,workspace:'/workspace/'+binding.conversationId,proxyOrigin:'https://proxy.synthetic.invalid',sourceEnabled:false},native:{async call(path,input){if(path==='runner/load')return f.service.loadForExecution({credential:f.credential,binding});if(path==='runner/publish')return f.service.publish({credential:f.credential,binding,event:input.event});if(path==='runner/runtime')return runtime;throw Error(path);}},sessionFactory:async input=>{factory++;assert.deepEqual(input.sessionKey,key);return {store:{async load(){return null;},async append(){}},async settle(){if(failClose)throw Error('SESSION_UNKNOWN');},async close(){closes++;}};},query({options}){calls++;assert.equal(Object.hasOwn(options,'sdkSessionKey'),false);return {async *[Symbol.asyncIterator](){yield {type:'result',subtype:'success',is_error:false};},close(){}};}});
 return {f,execute,counts:()=>({calls,closes,factory})};
}
// The activity publishes its `starting` claim as soon as it has verified the queued run (worker/conversation/activity.mjs, 812e236b);
// a refusal during runtime preparation then settles through the claimant's own terminal attempt, so the run ends `failed`
// instead of showing `queued` with no outcome. It never reaches `running`, and no SDK query or session factory runs.
test('runner refuses missing observed registration before the single SDK query',async()=>{const x=await runnerFixture();try{await assert.rejects(x.execute({binding}),/EXECUTION_FAILED/u);assert.deepEqual(x.counts(),{calls:0,closes:0,factory:0});const saved=await x.f.service.history({credential:x.f.credential});assert.equal(saved.run.state,'failed');assert.deepEqual(saved.events.filter(e=>e.type==='run.status').map(e=>e.data.state),['queued','starting','failed']);}finally{x.f.close();}});
test('runner preserves exact observed key, strips private selector and closes owned mirror',async()=>{const key={projectKey:'observed / punctuation remains opaque',sessionId:'11111111-1111-4111-8111-111111111111'},x=await runnerFixture({key});try{assert.deepEqual(await x.execute({binding}),{state:'completed'});assert.deepEqual(x.counts(),{calls:1,closes:1,factory:1});}finally{x.f.close();}});
test('uncertain observed SDK mirror prevents durable completed status and releases no success',async()=>{const x=await runnerFixture({key:{projectKey:'observed',sessionId:'11111111-1111-4111-8111-111111111111'},failClose:true});try{await assert.rejects(x.execute({binding}),/EXECUTION_FAILED/u);assert.deepEqual(x.counts(),{calls:1,closes:1,factory:1});assert.equal((await x.f.service.history({credential:x.f.credential})).run.state,'failed');}finally{x.f.close();}});

// Current capability policy is resolved after the real service's model/lineage and final session checks.
import {createRunCapabilityPolicy,PROPOSED_PREVIEW_CAPABILITY_PLATFORM} from '../product-ports/capability-policy.mjs';
test('load resolves current tenant/role at final release and preserves the canonical SDK budget limits',async t=>{
 let tenant={},role='user_admin',roleCalls=0,settingsCalls=0;
 const platform=structuredClone(PROPOSED_PREVIEW_CAPABILITY_PLATFORM);platform.roleCeilings.standard_user.bash=false;
 const capabilityPolicy=createRunCapabilityPolicy({platform,readTenantSettings:async()=>{settingsCalls++;return tenant;}});
 const f=await applicationFixture({initialInput:true,serviceOptions:{capabilityPolicy,readCapabilityRole:async({binding:b})=>{
  assert.deepEqual(b,binding);roleCalls++;return {actorRole:role,checkedAtMs:Date.now(),expiresAtMs:Date.now()+2000};}}});t.after(f.close);
 await f.service.allocateInput({credential:f.credential,input:f.input});await f.service.submit({credential:f.credential,input:f.input});
 const first=await f.service.loadForExecution({credential:f.credential,binding});assert.equal(first.capabilities.bash,true);
 assert.equal(first.model.maxTurns,20);assert.equal(first.model.maxCostMicroUSD,2000000);assert.equal(roleCalls,1);assert.equal(settingsCalls,1);
 tenant={capabilities:{generalReads:false}};role='standard_user';
 const next=await f.service.loadForExecution({credential:f.credential,binding});assert.equal(next.capabilities.generalReads,false);assert.equal(next.capabilities.bash,false);
 assert.equal(roleCalls,2);assert.equal(settingsCalls,2);
 // A change during the service's final local recheck must precede the capability decision.
 let checks=0;f.state.checkCurrentBinding=async()=>{if(++checks===2)tenant={capabilities:{generalReads:true}};};
 const latest=await f.service.loadForExecution({credential:f.credential,binding});assert.equal(latest.capabilities.generalReads,true);assert.equal(roleCalls,3);
});
test('load fails closed without a role owner and when role authority expires during the tenant read',async t=>{
 for(const missing of [true,false]){
  const capabilityPolicy=createRunCapabilityPolicy({platform:PROPOSED_PREVIEW_CAPABILITY_PLATFORM,readTenantSettings:async()=>{await new Promise(resolve=>setTimeout(resolve,30));return {};}});
  const f=await applicationFixture({initialInput:true,serviceOptions:{capabilityPolicy,...(missing?{}:{readCapabilityRole:async()=>({actorRole:'standard_user',checkedAtMs:Date.now(),expiresAtMs:Date.now()+10})})}});t.after(f.close);
  await f.service.allocateInput({credential:f.credential,input:f.input});await f.service.submit({credential:f.credential,input:f.input});
  await assert.rejects(f.service.loadForExecution({credential:f.credential,binding}),missing?/CAPABILITY_ROLE_UNKNOWN/:/DEADLINE/);
 }
});
