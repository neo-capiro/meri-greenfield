import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import canonicalize from 'canonicalize';
import {spawnSync} from 'node:child_process';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {createIdentityContactsHttpAdapter} from '../http-adapter.mjs';
import {createIdentityContactsReadHandler} from '../handler.mjs';
import {readContext} from '../request-context.mjs';
import {createIdentityContactsFixture,member,committee,bill,contact,NOW,id,endpoints} from './fixtures.mjs';
const handler=(f,adapter=createIdentityContactsHttpAdapter(f.config))=>createIdentityContactsReadHandler({operation:f.operation,adapter,now:f.config.now});
const withRaw=(f,raw)=>createIdentityContactsHttpAdapter({...f.config,fetchImpl:async()=>new Response(JSON.stringify({...f.page(),result:raw}),{headers:{'content-type':'application/json'}})});
const assertCode=code=>error=>error.message===code;

for(const operation of['resolve_entity','find_contacts'])test(`${operation}: real Fetch bytes and canonical handler preserve exact passive result`,async()=>{const f=createIdentityContactsFixture(operation),result=JSON.parse(await handler(f)(f.call()));assert.deepEqual(result,f.page());assert.deepEqual(Object.keys(result),['binding','subject','operation','argumentsSha256','result']);assert.equal(f.wire[0].request.method,'POST');assert.equal(f.wire[0].options.credentials,'omit');assert.equal(f.wire[0].options.cache,'no-store');assert.equal(f.wire[0].options.redirect,'error');assert.equal(f.wire[0].request.headers.get('authorization'),'Bearer SYNTHETIC_IDENTITY_TOKEN');assert.equal(f.wire[0].request.headers.get('x-meri-read-correlation'),null);const body=JSON.parse(await f.wire[0].request.text());assert.deepEqual(body,{input:f.input(),metadata:f.normalize().metadata});assert.equal(JSON.stringify(body).includes('SYNTHETIC_IDENTITY_TOKEN'),false);assert.equal(JSON.stringify(result).includes('SYNTHETIC_SERVICE_SECRET'),false);assert.deepEqual(f.credentialCalls[0].normalizationContext,f.normalizationContext);assert.equal(f.credentialCalls[0].requestSha256,canonicalSha256(body));assert.equal(f.wire[0].options.body,JSON.stringify(body));assert.deepEqual(f.credentialCalls[0].target,{method:'POST',path:`/api/clio/tools/${operation}`,bodySha256:createHash('sha256').update(f.wire[0].options.body,'utf8').digest('hex')});assert.equal(f.wire[0].request.headers.get('x-meri-deadline-at'),String(NOW+1000));});

for(const operation of['resolve_entity','find_contacts'])test(`${operation}: Option B token binds Core path and exact body bytes before Fetch`,async()=>{
 const f=createIdentityContactsFixture(operation),path=`/api/clio/tools/${operation}`,endpoint=`https://identity-projection.example.invalid${path}`;
 const invocationId='synthetic_invocation_1',signedCall=fixture=>({...fixture.call(),invocationId});
 const signedReceipt=(fixture,pins)=>({...fixture.credentials(pins),invocationId:pins.invocationId,
  target:pins.target,correlationSha256:pins.correlationSha256});
 const config={...f.config,endpoints:{[operation]:endpoint},getCredentials:async pins=>{
  f.credentialCalls.push(pins);return {...signedReceipt(f,pins),authorizationScheme:'CapiroMeriRead',expiresAtMs:NOW+100};
 }};
 await handler(f,createIdentityContactsHttpAdapter(config))(signedCall(f));
 assert.equal(f.wire[0].url,endpoint);assert.equal(f.wire[0].request.headers.get('authorization'),'CapiroMeriRead SYNTHETIC_IDENTITY_TOKEN');
 assert.equal(f.wire[0].request.headers.get('x-meri-deadline-at'),String(NOW+100));
 const correlationBytes=Buffer.from(f.wire[0].request.headers.get('x-meri-read-correlation'),'base64url').toString('utf8');
 assert.equal(f.wire[0].request.headers.get('x-meri-read-correlation'),Buffer.from(correlationBytes,'utf8').toString('base64url'));
 assert.equal(correlationBytes,canonicalize({binding:f.authority.binding,subject:f.authority.subject,
  policyRevision:f.authority.policyRevision,normalizationContext:operation==='find_contacts'?null:f.normalizationContext}));
 assert.deepEqual(Object.keys(JSON.parse(correlationBytes)).sort(),['binding','subject','policyRevision','normalizationContext'].sort());
 assert.equal(f.credentialCalls[0].correlationSha256,createHash('sha256').update(correlationBytes,'utf8').digest('hex'));
 assert.equal(f.credentialCalls[0].invocationId,invocationId);
 assert.equal(f.credentialCalls[0].target.bodySha256,createHash('sha256').update(f.wire[0].options.body,'utf8').digest('hex'));
 const wrongPath=createIdentityContactsFixture(operation);
 await assert.rejects(handler(wrongPath,createIdentityContactsHttpAdapter({...wrongPath.config,getCredentials:async pins=>({
  ...signedReceipt(wrongPath,pins),authorizationScheme:'CapiroMeriRead'})}))(signedCall(wrongPath)),assertCode('ACCESS_DENIED'));
 assert.equal(wrongPath.wire.length,0);
 for(const change of [target=>({...target,path:'/api/clio/tools/other'}),
  target=>({...target,bodySha256:'0'.repeat(64)})]){
  const rejected=createIdentityContactsFixture(operation);
  await assert.rejects(handler(rejected,createIdentityContactsHttpAdapter({...rejected.config,
   endpoints:{[operation]:endpoint},getCredentials:async pins=>({...signedReceipt(rejected,pins),authorizationScheme:'CapiroMeriRead',target:change(pins.target)})}))(signedCall(rejected)),assertCode('ACCESS_DENIED'));
  assert.equal(rejected.wire.length,0);
 }
 for(const echoed of [undefined,'0'.repeat(64)]){
  const rejected=createIdentityContactsFixture(operation);
  await assert.rejects(handler(rejected,createIdentityContactsHttpAdapter({...rejected.config,
   endpoints:{[operation]:endpoint},getCredentials:async pins=>{
    const {correlationSha256:unused,...receipt}=signedReceipt(rejected,pins);
    return {...receipt,authorizationScheme:'CapiroMeriRead',...(echoed===undefined?{}:{correlationSha256:echoed})};
   }}))(signedCall(rejected)),assertCode('ACCESS_DENIED'));
  assert.equal(rejected.wire.length,0);
 }
 const missingTarget=createIdentityContactsFixture(operation);
 await assert.rejects(handler(missingTarget,createIdentityContactsHttpAdapter({...missingTarget.config,
  endpoints:{[operation]:endpoint},getCredentials:async pins=>{
   const {target:unused,...receipt}=signedReceipt(missingTarget,pins);
   return {...receipt,authorizationScheme:'CapiroMeriRead'};
  }}))(signedCall(missingTarget)),assertCode('ACCESS_DENIED'));
 assert.equal(missingTarget.wire.length,0);
 const missingInvocation=createIdentityContactsFixture(operation);
 await assert.rejects(handler(missingInvocation,createIdentityContactsHttpAdapter({...missingInvocation.config,
  endpoints:{[operation]:endpoint},getCredentials:async pins=>({...missingInvocation.credentials(pins),
   authorizationScheme:'CapiroMeriRead',target:pins.target,correlationSha256:pins.correlationSha256})}))(missingInvocation.call()),assertCode('ACCESS_DENIED'));
 assert.equal(missingInvocation.wire.length,0);
 const bearerOnCoreRoute=createIdentityContactsFixture(operation);
 await assert.rejects(handler(bearerOnCoreRoute,createIdentityContactsHttpAdapter({...bearerOnCoreRoute.config,
  endpoints:{[operation]:endpoint},getCredentials:async pins=>({...bearerOnCoreRoute.credentials(pins),authorizationScheme:'Bearer'})}))(bearerOnCoreRoute.call()),assertCode('ACCESS_DENIED'));
 assert.equal(bearerOnCoreRoute.wire.length,0);
 const bearerOnReservedCall=createIdentityContactsFixture(operation);
 await assert.rejects(handler(bearerOnReservedCall,createIdentityContactsHttpAdapter({...bearerOnReservedCall.config,
  getCredentials:async pins=>({...bearerOnReservedCall.credentials(pins),invocationId:pins.invocationId,
   authorizationScheme:'Bearer'})}))(signedCall(bearerOnReservedCall)),assertCode('ACCESS_DENIED'));
 assert.equal(bearerOnReservedCall.wire.length,0);
});

test('trusted invocation ID is pinned in the signed broker receipt before Fetch',async()=>{
 const f=createIdentityContactsFixture(),call={...f.call(),invocationId:'synthetic_invocation_1'};
 const endpoint=`https://identity-projection.example.invalid/api/clio/tools/${f.operation.id}`;
 const adapter=createIdentityContactsHttpAdapter({...f.config,endpoints:{[f.operation.id]:endpoint},getCredentials:async pins=>{
  f.credentialCalls.push(pins);return {...f.credentials(pins),invocationId:pins.invocationId,
   target:pins.target,correlationSha256:pins.correlationSha256,authorizationScheme:'CapiroMeriRead'};
 }});
 await handler(f,adapter)(call);
 assert.equal(f.credentialCalls[0].invocationId,call.invocationId);
 const denied=createIdentityContactsFixture();
 await assert.rejects(handler(denied,createIdentityContactsHttpAdapter({...denied.config,endpoints:{[denied.operation.id]:endpoint},
  getCredentials:async pins=>({...denied.credentials(pins),invocationId:'different_invocation',
   target:pins.target,correlationSha256:pins.correlationSha256,authorizationScheme:'CapiroMeriRead'})}))({...denied.call(),invocationId:call.invocationId}),assertCode('ACCESS_DENIED'));
 assert.equal(denied.wire.length,0);
});
test('correlation decoded JSON over 8192 UTF-8 bytes refuses before credentials',async()=>{
 const f=createIdentityContactsFixture(),call=structuredClone(f.call());
 call.authority.claims.scopes=[...call.authority.claims.scopes];
 call.authority.decision.scopes=[...call.authority.decision.scopes];
 for(let index=0;index<90;index++){
  const scope={...call.authority.subject.scopes[0],resourceId:`synthetic-scope-${index}`};
  call.authority.subject.scopes.push(scope);call.authority.claims.scopes.push({...scope});call.authority.decision.scopes.push({...scope});
 }
 assert.ok(Buffer.byteLength(canonicalize({binding:call.authority.binding,subject:call.authority.subject,
  policyRevision:call.authority.policyRevision,normalizationContext:call.normalizationContext}),'utf8')>8192);
 await assert.rejects(handler(f)(call),assertCode('RESOURCE_LIMIT'));
 assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
});

for(const operation of['resolve_entity','find_contacts'])test(`${operation}: one configured endpoint remains task bound`,async()=>{
 const f=createIdentityContactsFixture(operation),adapter=createIdentityContactsHttpAdapter({...f.config,endpoints:{[operation]:endpoints[operation]}});
 assert.deepEqual(JSON.parse(await handler(f,adapter)(f.call())),f.page());assert.equal(f.wire[0].url,endpoints[operation]);
 const other=Object.keys(endpoints).find(id=>id!==operation),missing=createIdentityContactsFixture(operation);
 const unavailable=createIdentityContactsHttpAdapter({...missing.config,endpoints:{[other]:endpoints[other]}});
 await assert.rejects(handler(missing,unavailable)(missing.call()),assertCode('UNAVAILABLE'));
 assert.equal(missing.credentialCalls.length,0);assert.equal(missing.wire.length,0);
});

test('trusted Congress controls implicit bill ID; explicit Congress and stored fields remain unchanged',async()=>{const f=createIdentityContactsFixture('resolve_entity',{defaultCongress:118}),call=f.call({query:'H.R. 1'}),result=JSON.parse(await handler(f)(call));assert.equal(result.result.matches[0].canonicalId,'118-hr-1');assert.equal(f.credentialCalls[0].metadata.defaultCongress,118);assert.equal(f.credentialCalls[0].metadata.billId,'118-hr-1');assert.deepEqual(JSON.parse(f.wire[0].options.body),{input:call.input,metadata:f.normalize(call.request).metadata});const explicit=f.call({query:'119-HR-00001'});assert.equal(JSON.parse(await handler(f)(explicit)).result.matches[0].canonicalId,'119-hr-00001');});

test('trusted normalizationContext must be present and closed; model Congress cannot supply it',async()=>{const f=createIdentityContactsFixture();for(const context of[undefined,{},null,{defaultCongress:0},{defaultCongress:119,tenantId:'other'}]){const call=f.call();call.normalizationContext=context;await assert.rejects(handler(f)(call));}await assert.rejects(handler(f)({...f.call(),request:{...f.args,defaultCongress:119}}));assert.equal(f.calls.length,0);const c=createIdentityContactsFixture('find_contacts');await assert.rejects(handler(c)({...c.call(),normalizationContext:{defaultCongress:119}}));assert.equal(c.calls.length,0);});

for(const [name,mutate]of[
 ['tenant',a=>a.claims.binding.tenantId='foreign'],['actor',a=>a.subject.actorId='foreign'],['run',a=>a.claims.binding.runId=id(31)],['attempt',a=>a.claims.binding.attemptId=id(32)],['worker',a=>a.claims.binding.workerId=id(33)],['fence',a=>a.claims.binding.writerFence++],['conversation',a=>a.claims.binding.conversationId=id(34)],['audience',a=>a.claims.audience='other'],['action',a=>a.claims.actions=[]],['policy',a=>a.policyRevision='other'],['decision id',a=>a.decision.decisionId=id(35)],['decision actor',a=>a.decision.actor.actorId='foreign'],['decision scope',a=>a.decision.scopes=[]],['decision operation',a=>a.decision.operation='find_contacts@0.2.0'],['denied decision',a=>a.decision.decision='denied'],['source id',a=>a.sourceIds=['mail']],['claim scope',a=>a.claims.scopes[0].resourceId='foreign'],['foreign claim policy',a=>a.claims.scopes[0].policyRevision='other'],
])test(`full authority refuses ${name} before broker/Fetch`,async()=>{const f=createIdentityContactsFixture(),authority=structuredClone(f.authority);authority.claims.binding=structuredClone(authority.claims.binding);authority.claims.scopes=structuredClone(authority.claims.scopes);authority.decision.scopes=structuredClone(authority.decision.scopes);authority.subject.scopes=structuredClone(authority.subject.scopes);mutate(authority);await assert.rejects(handler(f)(f.call(f.args,authority)));assert.equal(f.calls.length,0);});

for(const [name,mutate]of[
 ['operation',c=>c.operation.id='find_contacts'],['argument hash',c=>c.argumentsSha256='a'.repeat(64)],['request hash',c=>c.requestSha256='b'.repeat(64)],['metadata Congress',c=>c.metadata.defaultCongress=118],['normalization Congress',c=>c.normalizationContext.defaultCongress=118],['tenant',c=>c.binding.tenantId='foreign'],['actor',c=>c.subject.actorId='foreign'],['client scope',c=>c.subject.scopes[0].resourceId='foreign'],['policy',c=>c.policyRevision='foreign'],['source IDs',c=>c.sourceIds=['other']],['expired',c=>c.expiresAtMs=NOW],['beyond admitted authority',c=>c.expiresAtMs=NOW+10001],['header injection',c=>c.bearerToken='token\r\nprivate'],['service secret',c=>c.serviceSecret=''],['authorization scheme',c=>c.authorizationScheme='Basic'],
])test(`broker credential refuses ${name} before Fetch`,async()=>{const f=createIdentityContactsFixture(),adapter=createIdentityContactsHttpAdapter({...f.config,getCredentials:async pins=>{const c=f.credentials(pins);mutate(c);return c;}});await assert.rejects(handler(f,adapter)(f.call()),assertCode('ACCESS_DENIED'));assert.equal(f.wire.length,0);});

test('normalized selection/original request hash mismatch never reaches the broker',async()=>{const f=createIdentityContactsFixture();for(const mutate of[c=>c.input.query='other',c=>c.argumentsSha256='a'.repeat(64),c=>c.request.query='other']){const call=structuredClone(f.call());mutate(call);await assert.rejects(handler(f)(call),assertCode('INVALID_ARGUMENTS'));}assert.equal(f.calls.length,0);});

test('adapter method receives its original receiver and only the explicit operation/context',async()=>{const f=createIdentityContactsFixture(),adapter={async read(call){assert.equal(this,adapter);assert.deepEqual(call.operation,f.operation);assert.deepEqual(call.normalizationContext,f.normalizationContext);return f.page();}};assert.deepEqual(JSON.parse(await handler(f,adapter)(f.call())),f.page());});

for(const [name,mutate]of[
 ['foreign binding',p=>p.binding.tenantId='other'],['foreign subject',p=>p.subject.entityIds=['other']],['operation',p=>p.operation.id='find_contacts'],['hash',p=>p.argumentsSha256='a'.repeat(64)],['extra wrapper',p=>p.authorized=true],['raw promoted verified',p=>p.result.verified=true],['count',p=>p.result.matchesFound++],['mixed phases',p=>p.result.matches[0].matchedBy='legacy-crosswalk'],['current-first order',p=>p.result.matches.reverse()],['duplicate name identity',p=>p.result.matches[1].canonicalId=p.result.matches[0].canonicalId],
])test(`canonical result refuses ${name} without release`,async()=>{const f=createIdentityContactsFixture(),page=structuredClone(f.page());mutate(page);const adapter=createIdentityContactsHttpAdapter({...f.config,fetchImpl:async()=>new Response(JSON.stringify(page),{headers:{'content-type':'application/json'}})});await assert.rejects(handler(f,adapter)(f.call()),assertCode('INVALID_RESULT'));});

test('legitimate crosswalk duplicates survive unchanged without verified identity claims',async()=>{const f=createIdentityContactsFixture(),rows=[member({matchedBy:'opaque-crosswalk',isCurrent:false}),member({matchedBy:'opaque-crosswalk',isCurrent:false})],raw={tool:'resolve_entity',generatedAt:new Date(NOW).toISOString(),matchesFound:2,matches:rows};const result=JSON.parse(await handler(f,withRaw(f,raw))(f.call()));assert.deepEqual(result.result.matches,rows);assert.equal(Object.hasOwn(result.result,'verified'),false);assert.equal(Object.hasOwn(result.result,'coverage'),false);});

test('exact no-match/missing query remain source notes, never exhaustive absence',async()=>{const f=createIdentityContactsFixture();for(const request of[{}, {query:'Example',type:'company'}]){const result=JSON.parse(await handler(f)(f.call(request)));assert.equal(result.result.matchesFound,0);assert.equal(Object.hasOwn(result.result,'complete'),false);assert.equal(Object.hasOwn(result.result,'negativeAssertion'),false);assert.ok(result.result.note);}const raw={tool:'resolve_entity',generatedAt:new Date(NOW).toISOString(),matchesFound:0,matches:[],note:'Nobody exists'};await assert.rejects(handler(f,withRaw(f,raw))(f.call()),assertCode('INVALID_RESULT'));});

test('current/former flags and old generatedAt are observations with no invented freshness',async()=>{const f=createIdentityContactsFixture(),raw=f.rawResult();raw.generatedAt='2020-01-01T00:00:00.000Z';const result=JSON.parse(await handler(f,withRaw(f,raw))(f.call()));assert.equal(result.result.generatedAt,raw.generatedAt);assert.equal(result.result.matches[1].isCurrent,false);assert.equal(Object.hasOwn(result.result,'freshness'),false);});

test('contact query/domain canonicalization and profile guidance remain passive source text',async()=>{const f=createIdentityContactsFixture('find_contacts'),call=f.call({domain:' EXAMPLE.INVALID ',query:'  Example  ',limit:'1'}),result=JSON.parse(await handler(f)(call));assert.equal(result.result.matchedOn.domain,'example.invalid');assert.equal(result.result.matchedOn.query,'Example');assert.equal(f.wire.length,1);assert.equal(Object.hasOwn(result.result,'complete'),false);const linked=createIdentityContactsFixture('find_contacts',{linked:true}),page=JSON.parse(await handler(linked)(linked.call()));assert.equal(page.result.clientId,linked.clientId);assert.match(page.result.note,/Propose only/);assert.equal(linked.wire.length,1);assert.equal(linked.wire[0].options.method,'POST');});

test('client selector needs the exact current resolved client and returned client cannot substitute',async()=>{const f=createIdentityContactsFixture('find_contacts',{linked:true});for(const selector of[id(99),'Unresolved client name'])await assert.rejects(handler(f)(f.call({clientId:selector})),assertCode('ACCESS_DENIED'));assert.equal(f.calls.length,0);const personal=createIdentityContactsFixture('find_contacts');await assert.rejects(handler(personal)(personal.call({clientId:f.clientId})),assertCode('ACCESS_DENIED'));const raw=f.rawResult();raw.clientId=id(99);await assert.rejects(handler(f,withRaw(f,raw))(f.call()),assertCode('INVALID_RESULT'));});

test('contact OR rows do not acquire invented client membership/profile completeness',async()=>{const f=createIdentityContactsFixture('find_contacts',{linked:true}),raw=f.rawResult();raw.contacts[0].email='unrelated@another.invalid';raw.matchedOn.domain='derived.example.invalid';const result=JSON.parse(await handler(f,withRaw(f,raw))(f.call()));assert.equal(result.result.contacts[0].email,'unrelated@another.invalid');assert.equal(Object.hasOwn(result.result.contacts[0],'clientId'),false);assert.equal(result.result.contacts[0].onProfile,false);assert.equal(Object.hasOwn(result.result,'verifiedMembership'),false);});

test('contact no-selector refusal cannot dump all rows or claim authoritative absence',async()=>{const f=createIdentityContactsFixture('find_contacts'),call=f.call({}),result=JSON.parse(await handler(f)(call));assert.equal(result.result.contacts.length,0);assert.match(result.result.note,/will not dump/);const adapter=createIdentityContactsHttpAdapter({...f.config,fetchImpl:async()=>new Response(JSON.stringify({...f.page(call.input),result:{...f.rawResult(call.input),contacts:[contact()]}}),{headers:{'content-type':'application/json'}})});await assert.rejects(handler(f,adapter)(call),assertCode('INVALID_RESULT'));});

test('contact timestamps descend with nulls last; missing email cannot report hidden history',async()=>{const f=createIdentityContactsFixture('find_contacts'),raw=f.rawResult();raw.contacts=[contact({lastContact:'2026-10-13T12:00:00.000Z'}),contact({lastContact:'2026-10-12T12:00:00.000Z'})];raw.note='2 correspondent(s) found from synced mail and calendar.';assert.equal(JSON.parse(await handler(f,withRaw(f,raw))(f.call())).result.contacts.length,2);raw.contacts.reverse();await assert.rejects(handler(f,withRaw(f,raw))(f.call()),assertCode('INVALID_RESULT'));const hidden=f.rawResult();hidden.contacts[0].email=null;hidden.contacts[0].messageCount=1;await assert.rejects(handler(f,withRaw(f,hidden))(f.call()),assertCode('INVALID_RESULT'));});

test('deadlines/expiry and native aborted signal stop before any credential or Fetch',async()=>{const f=createIdentityContactsFixture();f.state.now=NOW+10000;await assert.rejects(handler(f)(f.call()),assertCode('DEADLINE'));f.state.now=NOW-2000;await assert.rejects(handler(f)(f.call()),assertCode('DEADLINE'));f.state.now=NOW;const abort=new AbortController();abort.abort();await assert.rejects(handler(f)({...f.call(),signal:abort.signal}),assertCode('CANCELLED'));assert.equal(f.calls.length,0);});

test('deadline after acquired response cancels its unread body and suppresses private content',async()=>{const f=createIdentityContactsFixture();let cancelled=0;const adapter=createIdentityContactsHttpAdapter({...f.config,fetchImpl:async()=>{const response=new Response(new ReadableStream({cancel(){cancelled++;}}),{headers:{'content-type':'application/json'}});f.state.now=NOW+1000;return response;}});await assert.rejects(handler(f,adapter)(f.call()),assertCode('DEADLINE'));await new Promise(resolve=>setImmediate(resolve));assert.equal(cancelled,1);});

test('stalled body is bounded by deadline and cancels its owned reader',async()=>{const f=createIdentityContactsFixture();let cancelled=0;const adapter=createIdentityContactsHttpAdapter({...f.config,maxRequestMs:20,fetchImpl:async()=>new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('{'));},cancel(){cancelled++;}}),{headers:{'content-type':'application/json'}})});await assert.rejects(handler(f,adapter)(f.call()),assertCode('DEADLINE'));assert.equal(cancelled,1);});

test('parent cancellation while reading bytes reaches source body without profile side effects',async()=>{const f=createIdentityContactsFixture(),abort=new AbortController();let cancelled=0;const adapter=createIdentityContactsHttpAdapter({...f.config,fetchImpl:async()=>new Response(new ReadableStream({pull(){abort.abort();return new Promise(()=>{});},cancel(){cancelled++;}}),{headers:{'content-type':'application/json'}})});await assert.rejects(handler(f,adapter)({...f.call(),signal:abort.signal}),assertCode('CANCELLED'));assert.equal(cancelled,1);});

for(const [name,body,headers,status]of[
 ['malformed UTF8',new Uint8Array([0xc3,0x28]),{'content-type':'application/json'},200],['invalid JSON','{',{'content-type':'application/json'},200],['wrong type','{}',{'content-type':'text/html'},200],['compressed body','{}',{'content-type':'application/json','content-encoding':'gzip'},200],['failed status','{}',{'content-type':'application/json'},500],['false length','{}',{'content-type':'application/json','content-length':'1'},200],
])test(`bounded canonical JSON port refuses ${name}`,async()=>{const f=createIdentityContactsFixture(),adapter=createIdentityContactsHttpAdapter({...f.config,fetchImpl:async()=>new Response(body,{status,headers})});await assert.rejects(handler(f,adapter)(f.call()));});

test('overflow is refused and cancels source; hostile bytes cannot leak raw error data',async()=>{const f=createIdentityContactsFixture();let cancelled=0;const adapter=createIdentityContactsHttpAdapter({...f.config,maxResponseBytes:10,fetchImpl:async()=>new Response(new ReadableStream({start(controller){controller.enqueue(new Uint8Array(11));},cancel(){cancelled++;}}),{headers:{'content-type':'application/json'}})});await assert.rejects(handler(f,adapter)(f.call()),assertCode('RESOURCE_LIMIT'));assert.equal(cancelled,1);const failed=createIdentityContactsHttpAdapter({...f.config,fetchImpl:async()=>{throw Error('PRIVATE_TOKEN_IN_PROVIDER_ERROR');}});await assert.rejects(handler(f,failed)(f.call()),assertCode('INTERNAL_ERROR'));});

test('inert admission refuses getters/proxies and malformed context without executing caller hooks',async()=>{const f=createIdentityContactsFixture();let traps=0;const call={...f.call()};Object.defineProperty(call,'normalizationContext',{enumerable:true,get(){traps++;throw Error('private')}});await assert.rejects(handler(f)(call));const proxy=new Proxy({},{get(){traps++;throw Error('private')}});await assert.rejects(handler(f)(proxy));const signalProxy=new Proxy(new AbortController().signal,{get(){traps++;throw Error('private')}});await assert.rejects(handler(f)({...f.call(),signal:signalProxy}));assert.equal(traps,0);assert.equal(f.calls.length,0);});

test('explicit endpoint configuration and import safety never allocate ambient resources',()=>{const f=createIdentityContactsFixture();for(const endpoint of['http://example.invalid','https://user:private@example.invalid/a','https://example.invalid/a?token=private','https://example.invalid/a#x'])assert.throws(()=>createIdentityContactsHttpAdapter({...f.config,endpoints:{...f.config.endpoints,resolve_entity:endpoint}}));const script="void process.stdout;void process.stderr;const before=process.getActiveResourcesInfo();await import('./http-adapter.mjs');await import('./handler.mjs');await new Promise(resolve=>setImmediate(resolve));if(JSON.stringify(before)!==JSON.stringify(process.getActiveResourcesInfo()))throw Error('import resources');";const result=spawnSync(process.execPath,['--input-type=module','-e',script],{cwd:new URL('..',import.meta.url),timeout:10000,maxBuffer:65536});assert.equal(result.status,0,result.stderr.toString());assert.equal(result.stdout.length,0);});
