/** Synthetic adapter checks. No listener, browser, SDK query, process observer, cloud call or authority proof. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createBrowserHostRuntimePort} from '../browser-runtime-port.mjs';
import {createEgressGrant} from '../../browser/egress-control.mjs';
import {validateBrowserPolicy} from '../../browser/policy.mjs';
import {binding,installation,sourceScopes,enabledPolicy,clock} from '../../browser/test/fixtures.mjs';

const cwd='/workspace/conversations/'+binding.conversationId;
function fixture(overrides={}){
 const calls=[],config={binding:structuredClone(binding),cwd,installation:structuredClone(installation),sourceScopes:structuredClone(sourceScopes),
  async policy(request){calls.push(['policy',request]);return enabledPolicy();},
  egress:{endpoint:installation.egressProxy,async grant(value,options){calls.push(['grant',value,options]);return {granted:true,policySha256:value.policySha256};},async revoke(value,options){calls.push(['revoke',value,options]);return {revoked:false};},close(){throw Error('borrowed service closed');}},
  processes:{async waitForExit(value,options){calls.push(['exit',value,options]);return {exited:false};}},
  approvals:{async decide(...args){calls.push(['approval',...args]);return {decision:'synthetic-denied'};}},
  artifacts:{async ingest(...args){calls.push(['ingest',...args]);return {stored:false};}},
  receipts:{async record(...args){calls.push(['record',...args]);return {recorded:false};}},...overrides};
 return {calls,config,port:createBrowserHostRuntimePort(config)};
}
const grant=()=>createEgressGrant({binding,policy:validateBrowserPolicy(enabledPolicy()),expiresAtMs:clock()+60000});
const refused=code=>error=>error.code===code;

test('adapter construction is inert and snapshots installation, binding and source scope facts',async()=>{
 const f=fixture();assert.deepEqual(f.calls,[]);
 f.config.binding.writerFence++;f.config.installation.egressProxy='http://127.0.0.1:9999';f.config.sourceScopes[0].tenantId='another-tenant';
 assert.equal(f.port.installation.egressProxy,installation.egressProxy);assert.equal(f.port.sourceScopes[0].tenantId,binding.tenantId);
 assert.equal(Object.isFrozen(f.port.sourceScopes[0]),true);
 const policy=await f.port.policy({binding});assert.equal(policy.enabled,true);assert.equal(f.calls[0][1].binding.writerFence,binding.writerFence);
 assert.equal(Object.hasOwn(f.port,'close'),false,'the caller owns the borrowed services');
});

test('policy comes from the trusted reader on every call, with cancellation preserved and no default on a missing response',async()=>{
 let current=enabledPolicy(),calls=0,seen;
 const f=fixture({async policy(request){calls++;seen=request;return current;}}),controller=new AbortController();
 assert.equal((await f.port.policy({binding,signal:controller.signal})).enabled,true);
 assert.equal(seen.signal,controller.signal);current={enabled:false};assert.deepEqual(await f.port.policy({binding}),{enabled:false});assert.equal(calls,2);
 current=undefined;await assert.rejects(f.port.policy({binding}),refused('BROWSER_HOST_POLICY_UNAVAILABLE'));
 current={enabled:true,allowedOrigins:['http://169.254.169.254']};await assert.rejects(f.port.policy({binding}),refused('BROWSER_PLATFORM_LIMIT'));
 controller.abort();await assert.rejects(f.port.policy({binding,signal:controller.signal}),refused('BROWSER_HOST_CANCELLED'));assert.equal(calls,4);
});

test('grant, revoke and process checks preserve signals and actual owner answers',async()=>{
 const f=fixture(),signal=new AbortController().signal,g=grant();
 assert.deepEqual(await f.port.egress.grant(g,{signal}),{granted:true,policySha256:g.policySha256});
 assert.deepEqual(await f.port.egress.revoke({binding,policySha256:g.policySha256},{signal}),{revoked:false});
 assert.deepEqual(await f.port.processes.waitForExit({binding,profile:cwd+'/.browser/profile'},{signal}),{exited:false});
 for(const call of f.calls)assert.equal(call[2].signal,signal);
 assert.notEqual(f.calls[0][1],g,'the delegated grant is an inert snapshot');
 const unavailable=Error('observer unavailable'),failed=fixture({processes:{async waitForExit(){throw unavailable;}}});
 await assert.rejects(failed.port.processes.waitForExit({binding,profile:cwd+'/.browser/profile'}),error=>error===unavailable);
});

test('every bound operation refuses any changed RunBinding field before reaching its owner',async()=>{
 for(const key of Object.keys(binding)){
  const f=fixture(),other={...binding,[key]:key==='writerFence'?2:key.endsWith('Id')&&key!=='tenantId'&&key!=='actorId'?'00000099-b0a1-4000-8000-000000000000':'other'};
  for(const operation of [()=>f.port.policy({binding:other}),()=>f.port.egress.grant({...grant(),binding:other}),
   ()=>f.port.egress.revoke({binding:other,policySha256:grant().policySha256}),()=>f.port.processes.waitForExit({binding:other,profile:cwd+'/.browser/profile'})])
   await assert.rejects(operation(),refused('BROWSER_HOST_BINDING_REFUSED'),key);
  assert.deepEqual(f.calls,[]);
 }
 const f=fixture();await assert.rejects(f.port.processes.waitForExit({binding,profile:'/unrelated/profile'}),refused('BROWSER_HOST_PROCESS_PROFILE_REFUSED'));assert.deepEqual(f.calls,[]);
});

test('canonical approval, artifact and receipt ports retain their receiver and exact request data',async()=>{
 const received=[],owner={async decide(request,options){assert.equal(this,owner);received.push([request,options]);return {approved:false};}};
 const f=fixture({approvals:owner}),request={subject:{binding}},options={signal:new AbortController().signal};
 assert.deepEqual(await f.port.approvals.decide(request,options),{approved:false});assert.equal(received[0][0],request);assert.equal(received[0][1],options);
 const download={binding,bytes:Buffer.from('synthetic')};await f.port.artifacts.ingest(download,options);await f.port.receipts.record({binding},options);
 assert.equal(f.calls[0][1],download);assert.equal(f.calls[0][1].bytes,download.bytes);
});

test('missing trusted dependencies, mismatched endpoint, cross-tenant scopes and invalid installation refuse at construction',()=>{
 const {config}=fixture();
 for(const key of ['binding','cwd','installation','policy','egress','processes','approvals','artifacts','receipts','sourceScopes']){
  const missing={...config};delete missing[key];assert.throws(()=>createBrowserHostRuntimePort(missing),refused('BROWSER_HOST_RUNTIME_CONFIGURATION'),key);
 }
 for(const changes of [{policy:enabledPolicy()},{egress:{...config.egress,endpoint:'http://127.0.0.1:4567'}},{processes:{}},{approvals:{}},{artifacts:{}},{receipts:{}},
  {sourceScopes:[{...sourceScopes[0],tenantId:'other'}]},{cwd:cwd+'/..'},{installation:{...installation,egressProxy:'http://remote.example:3128'}},{approvalDeadlineMs:0}])
  assert.throws(()=>createBrowserHostRuntimePort({...config,...changes}),refused('BROWSER_HOST_RUNTIME_CONFIGURATION'));
 let getterCalls=0;const approvals={get decide(){getterCalls++;return ()=>{};}};
 assert.throws(()=>createBrowserHostRuntimePort({...config,approvals}),refused('BROWSER_HOST_RUNTIME_CONFIGURATION'));assert.equal(getterCalls,0);
 let proxyCalls=0;const egress=new Proxy(config.egress,{getOwnPropertyDescriptor(){proxyCalls++;throw Error('unexpected proxy trap');}});
 assert.throws(()=>createBrowserHostRuntimePort({...config,egress}),refused('BROWSER_HOST_RUNTIME_CONFIGURATION'));assert.equal(proxyCalls,0);
 assert.throws(()=>createBrowserHostRuntimePort({...config,policy:new Proxy(config.policy,{})}),refused('BROWSER_HOST_RUNTIME_CONFIGURATION'));
});
