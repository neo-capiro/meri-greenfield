/** Finite native-handler mechanics over frozen directory DTOs, synthetic HTTP and credentials. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {directoryCase} from '../legislative-directory/test/fixture.mjs';
import {createStoredNativeReadHandlers} from './native-handler.mjs';
const specification={family:'legislative-directory',routes:{get_committee_roster:'/api/clio/tools/get_committee_roster',list_members:'/api/clio/tools/list_members'}};
const handler=(f,changes={},spec=specification)=>createStoredNativeReadHandlers({...f.transport,now:f.now,...changes},[f.operation],spec)[0].execute;
test('finite mechanics preserve native request, frozen result and exact private carrier',async()=>{
 const f=directoryCase(),call=f.call(),out=JSON.parse(await handler(f)(call));assert.deepEqual(out.result,f.page);assert.deepEqual(f.wire[0].body,f.arguments);assert.equal(out.argumentsSha256,call.argumentsSha256);assert.deepEqual(out.binding,f.authority.binding);assert.deepEqual(out.operation,f.operation);
});
test('fixed route, family, side-effect and operation mismatch refuse at construction',()=>{
 const f=directoryCase();for(const spec of [{...specification,routes:{get_committee_roster:'https://foreign.invalid'}},{...specification,routes:{get_committee_roster:'/api/clio/tools/list_members'}},{...specification,family:'disclosures'},{family:'command-tools',routes:{'memory.propose':'/api/clio/tools/memory.propose'}},{...specification,routes:{}}])assert.throws(()=>handler(f,{},spec));assert.equal(f.wire.length,0);assert.equal(f.credentialCalls.length,0);
});
test('foreign, duplicate, wrong-version, getter and proxy operations cannot cause effects',()=>{
 const f=directoryCase(),config={...f.transport,now:f.now};let effects=0;
 for(const operations of [[],[f.operation,f.operation],[{...f.operation,version:'0.1.0'}],[{id:'get_bill_status',version:'0.2.0'}],[{get id(){effects++;return 'get_committee_roster';},version:'0.2.0'}],new Proxy([f.operation],{get(){effects++;throw Error('PRIVATE');}})])assert.throws(()=>createStoredNativeReadHandlers(config,operations,specification));assert.equal(effects,0);
});
test('current decision, actor, policy, source and action coherence precede credentials',async()=>{
 for(const mutate of [a=>a.decision.decision='denied',a=>a.decision.actor.actorId='other',a=>a.decision.policyRevision='0'.repeat(64),a=>a.decision.scopes=[],a=>a.claims.actions=[],a=>a.claims.audience='other',a=>a.sourceIds=[],a=>a.claims.binding.tenantId='other']){
  const f=directoryCase(),call=structuredClone(f.call());mutate(call.authority);await assert.rejects(handler(f)(call));assert.equal(f.wire.length,0);assert.equal(f.credentialCalls.length,0);
 }
});
test('model authority, normalization context, digest and input substitutions refuse',async()=>{
 const f=directoryCase();for(const changes of [{request:{...f.arguments,actorRole:'capiro_admin'}},{normalizationContext:{tenantId:'other'}},{argumentsSha256:'0'.repeat(64)},{input:{}}])await assert.rejects(handler(f)({...f.call(),...changes}),{message:'INVALID_ARGUMENTS'});assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
});
test('missing broker and malformed credential correlation never fall back to source',async()=>{
 const f=directoryCase();await assert.rejects(handler(f,{getCredentials:undefined})(f.call()),{message:'UNAVAILABLE'});assert.equal(f.wire.length,0);
 for(const key of ['subject','binding','operation','origin','requestSha256','argumentsSha256','normalizationContext','bearerToken','serviceSecret','expiresAtMs']){const g=directoryCase();g.state.credentialMutator=r=>r[key]=null;await assert.rejects(handler(g)(g.call()),{message:'ACCESS_DENIED'});assert.equal(g.wire.length,0);}
});
test('request bridges change only native body while credential proof and result digest retain original selection',async()=>{
 const f=directoryCase();let observed;await handler(f,{}, {...specification,requestBody:current=>{observed=current;return {...current.request};}})(f.call());assert.equal(observed.request.committee,'SYN');assert.deepEqual(f.credentialCalls[0].normalizationContext,{});assert.deepEqual(f.wire[0].body,f.arguments);
});
test('per-call credentials retain exact call and forbid static or proxy fallback',async()=>{
 const f=directoryCase(),call=f.call(),{getCredentials,...rest}=f.transport;let original;
 await createStoredNativeReadHandlers({...rest,now:f.now,credentialsForCall:(operation,c)=>{original=c;return getCredentials;}},[f.operation],specification)[0].execute(call);assert.equal(original,call);
 assert.throws(()=>handler(f,{credentialsForCall:()=>getCredentials}),{message:'GATEWAY_CONFIGURATION'});assert.throws(()=>handler(f,{getCredentials:undefined,credentialsForCall:new Proxy(()=>getCredentials,{})}),{message:'GATEWAY_CONFIGURATION'});
});
test('bounded response and native HTTP error cannot release invented or raw provider payloads',async()=>{
 const f=directoryCase();await assert.rejects(handler(f,{maxResponseBytes:16})(f.call()),{message:'RESOURCE_LIMIT'});for(const factory of [()=>Response.json({error:'PRIVATE'}),()=>Response.json({},{status:403}),p=>Response.json({...p,complete:true})]){const g=directoryCase();g.state.responseFactory=factory;await assert.rejects(handler(g)(g.call()),{message:'INVALID_RESULT'});}
});
test('pre-abort, expired authority and cancellation after source withhold effects or bytes',async()=>{
 const f=directoryCase();await assert.rejects(handler(f)({...f.call(),signal:AbortSignal.abort()}),{message:'CANCELLED'});assert.equal(f.credentialCalls.length,0);f.state.now=f.authority.deadlineMs;await assert.rejects(handler(f)(f.call()),{message:'DEADLINE'});assert.equal(f.wire.length,0);
 const g=directoryCase(),controller=new AbortController();g.state.afterSource=()=>controller.abort();await assert.rejects(handler(g)({...g.call(),signal:controller.signal}),{message:'CANCELLED'});
});
