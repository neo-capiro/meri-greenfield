/** Complete native DTO receiving with synthetic HTTP only; no provider, SQL or installed-Core qualification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {decodeNativeReadObservation} from '../../../../../packages/contracts/native-read-observation-0.2/validate.mjs';
import {captureClientKnowledgeSearchSelection as capture,assertClientKnowledgeSearchSubject as assertSubject} from '../request-context.mjs';
import {createClientKnowledgeSearchHandlers,createKnowledgeGraphHandlers} from '../handler.mjs';
import {createStoredNativeReadHandlers} from '../../retained-reads/native-handler.mjs';
import {createRetainedHttpTransport} from '../../retained-reads/http-transport.mjs';
import {storedCase,searchId,id as graphId,clientId,storedSearchPage} from './fixture.mjs';
const other='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const result=async f=>JSON.parse(await f.handler()(f.call())).result;

test('semantic fixed POST preserves Unicode/raw selectors, both hashes and authenticated private observation',async()=>{
 const request={query:'  Civic & energía 🌱  ',clientId:clientId.toUpperCase(),kind:'client_doc_chunk',limit:5},f=storedCase(searchId,{request}),call=f.call();
 const out=JSON.parse(await f.handler()(call)),[wire]=f.wire,[proof]=f.credentialCalls;
 assert.equal(wire.url,`https://native-core.example.invalid/api/clio/tools/${searchId}`);assert.equal(wire.options.method,'POST');assert.deepEqual(wire.body,request);
 const observation=decodeNativeReadObservation(wire.options.headers['x-meri-read-observation'],{operation:f.operation,request});
 assert.deepEqual(observation,{schemaVersion:'meri-native-read-observation/1',operation:f.operation,requestSha256:hash(request),context:f.normalizationContext});
 assert.equal(proof.requestSha256,hash(request));assert.equal(proof.argumentsSha256,call.argumentsSha256);assert.notEqual(proof.requestSha256,proof.argumentsSha256);
 assert.deepEqual(proof.normalizationContext,f.normalizationContext);assert.equal(f.state.credentialOwnerCalls[0].call,call);
 assert.equal(wire.options.headers.authorization,'Bearer SYNTHETIC_NATIVE_USER');assert.equal(wire.options.headers['x-internal-service-secret'],'SYNTHETIC_INTERNAL_SERVICE');
 assert.equal(wire.options.redirect,'error');assert.equal(wire.options.credentials,'omit');assert.equal(wire.options.cache,'no-store');
 assert.deepEqual(out,{binding:f.binding,subject:f.authority.subject,operation:f.operation,argumentsSha256:call.argumentsSha256,result:f.page});
 assert.equal(out.result.generatedAt,f.normalizationContext.asOf);assert.notEqual(out.result.generatedAt,new Date(f.now()).toISOString());
 assert.equal(out.result.query,'Civic & energía 🌱');assert.equal(out.result.clientId,request.clientId);
});

test('all omitted/null/empty client forms retain the native no-client note under personal and current client tasks',async()=>{
 for(const request of [{query:' policy '},{query:' policy ',clientId:null},{query:' policy ',clientId:''}])for(const task of ['personal','client']){
  const f=storedCase(searchId,{request});
  if(task==='client'){
   const authority=storedCase(searchId).authority;
   f.authority.subject=authority.subject;f.authority.claims.scopes=authority.claims.scopes;f.authority.decision.scopes=authority.decision.scopes;
  }
  const out=await result(f);assert.equal(out.note,'No client is linked to this conversation. Ask the user which client, or pass clientId.');
  assert.deepEqual(out.results,[]);assert.equal(out.generatedAt,f.normalizationContext.asOf);assert.equal(Object.hasOwn(out,'clientId'),false);assert.deepEqual(f.wire[0].body,request);
  assert.deepEqual(capture(f.operation,request),{clientId:null});
 }
});

test('native kinds, unknown/null kind defaults, string/null limits and numeric fractional clamps remain unchanged',async()=>{
 for(const kind of ['client_profile','client_person','client_facility','client_doc_chunk','unknown',null])for(const limit of [undefined,null,'2.5',0,1.5,20,99]){
  const request={query:' \t policy\n ',clientId,kind,...(limit===undefined?{}:{limit})},f=storedCase(searchId,{request}),call=f.call();
  const out=await result(f);assert.equal(call.input.kind,['client_profile','client_person','client_facility','client_doc_chunk'].includes(kind)?kind:null);
  assert.equal(call.input.limit,typeof limit==='number'?Math.min(20,Math.max(1,limit)):8);
  assert.equal(out.results[0].kind,call.input.kind??'client_doc_chunk');assert.deepEqual(f.wire[0].body,request);
 }
});

test('successful, ordinary empty and caught-unavailable rails retain exactly their native fields and asOf',async()=>{
 for(const options of [{},{empty:true},{unavailable:true}]){
  const f=storedCase(searchId),page=storedSearchPage(f.call().input,f.normalizationContext.asOf,options);f.state.page=page;
  assert.deepEqual(await result(f),page);assert.equal(f.wire.length,1);
  assert.equal(Object.hasOwn(page,'complete'),false);assert.equal(Object.hasOwn(page,'authoritative'),false);
 }
});

test('one current UUID client subject/resource is required before credential ownership for selected search',async()=>{
 for(const change of ['personal','multiple','foreign-client','foreign-resource','missing-resource','extra-client']){
  const f=storedCase(searchId),call=structuredClone(f.call()),s=call.authority.subject;
  if(change==='personal')Object.assign(s,{kind:'personal',entityType:'user',entityIds:[call.authority.binding.actorId]});
  if(change==='multiple')s.entityIds.push(other);if(change==='foreign-client')s.entityIds=[other];
  if(change==='foreign-resource')s.scopes[0].resourceId=other;
  if(change==='missing-resource')s.scopes[0]={...s.scopes[0],kind:'tenant',resourceId:call.authority.binding.tenantId};
  if(change==='extra-client')s.scopes.push({...s.scopes[0],resourceId:other});
  await assert.rejects(f.handler()(call),{message:'ACCESS_DENIED'});assert.equal(f.state.credentialOwnerCalls,undefined);assert.equal(f.wire.length,0);
 }
 const f=storedCase(searchId),a=f.authority,tenant={...a.subject.scopes[0],kind:'tenant',resourceId:a.binding.tenantId};
 for(const scopes of [a.subject.scopes,a.claims.scopes,a.decision.scopes])scopes.push(tenant);
 assertSubject(a.subject,{clientId});await result(f);
});

test('null selection refuses other task kinds and malformed client-task bindings without reaching credentials',async()=>{
 const personal=storedCase(searchId,{request:{query:'policy'}});assertSubject(personal.authority.subject,{clientId:null});
 for(const change of ['named','portfolio','bad-client-id','foreign-resource','missing-resource']){
  const f=storedCase(searchId),s=structuredClone(f.authority.subject);
  if(change==='named'){s.kind='named';s.entityType='named';}
  if(change==='portfolio'){s.kind='portfolio';s.rosterVersion='synthetic-roster';}
  if(change==='bad-client-id')s.entityIds=['not-a-uuid'];
  if(change==='foreign-resource')s.scopes[0].resourceId=other;
  if(change==='missing-resource')s.scopes[0]={...s.scopes[0],kind:'tenant',resourceId:f.binding.tenantId};
  assert.throws(()=>assertSubject(s,{clientId:null}),{message:'ACCESS_DENIED'});
 }
});

test('malformed truthy selectors, model contexts and non-raw grammar fail before native credentials',async()=>{
 const f=storedCase(searchId),base=f.call();
 for(const request of [{query:' '},{query:4},{query:'policy',clientId:'Client Name'},{query:'policy',clientId:` ${clientId}`},
  {query:'policy',clientId:' '},{query:'policy',clientId:4},{query:'policy',kind:1},{query:'policy',limit:true},
  {query:'policy',asOf:f.normalizationContext.asOf},{query:'policy',tenantId:'foreign'}])
  await assert.rejects(f.handler()({...base,request}),{message:'INVALID_ARGUMENTS'});
 for(const context of [{},{asOf:'2026-10-17T00:00:00Z'},{asOf:null},{asOf:f.normalizationContext.asOf,clientId}])
  await assert.rejects(f.handler()({...base,normalizationContext:context}),{message:'INVALID_ARGUMENTS'});
 assert.equal(f.wire.length,0);assert.equal(f.state.credentialOwnerCalls,undefined);
});

test('selection capture is inert, immutable and exact, including raw case without spelling rewrites',()=>{
 const f=storedCase(searchId),selection=capture(f.operation,{query:'policy',clientId:clientId.toUpperCase()});
 assert.deepEqual(selection,{clientId});assert.ok(Object.isFrozen(selection));let effects=0;
 const accessor={query:'policy'};Object.defineProperty(accessor,'clientId',{enumerable:true,get(){effects++;return clientId;}});
 const proxy=new Proxy({query:'policy',clientId},{ownKeys(){effects++;return ['query','clientId'];}});
 for(const raw of [accessor,proxy])assert.throws(()=>capture(f.operation,raw),{message:'INVALID_ARGUMENTS'});
 for(const operation of [{id:graphId,version:'0.2.0'},{id:searchId,version:'0.1.0'},{...f.operation,origin:'private'}])
  assert.throws(()=>capture(operation,f.arguments),{message:'INVALID_ARGUMENTS'});
 assert.throws(()=>assertSubject(f.authority.subject,{clientId,extra:true}),{message:'ACCESS_DENIED'});assert.equal(effects,0);
});

test('missing or revoked current owner cannot use static credentials or send an observation',async()=>{
 const f=storedCase(searchId),{credentialsForCall,...passive}=f.transport;
 const [handler]=createClientKnowledgeSearchHandlers({...passive,now:f.now,getCredentials:()=>{throw Error('STATIC_FALLBACK');}},[f.operation]);
 await assert.rejects(handler.execute(f.call()),{message:'UNAVAILABLE'});assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
 f.state.resourceDenied=true;await assert.rejects(f.handler()(f.call()),{message:'ACCESS_DENIED'});assert.equal(f.wire.length,0);
});

test('raw request/context/tenant credential correlation is checked before authenticated HTTP',async()=>{
 for(const key of ['binding','subject','operation','requestSha256','argumentsSha256','normalizationContext','sourceIds','bearerToken','serviceSecret','expiresAtMs']){
  const f=storedCase(searchId);f.state.credentialMutator=p=>p[key]=key==='expiresAtMs'?f.now():null;
  await assert.rejects(f.handler()(f.call()),{message:'ACCESS_DENIED'});assert.equal(f.wire.length,0);
 }
 const f=storedCase(searchId),call=structuredClone(f.call());call.authority.decision.decision='denied';
 await assert.rejects(f.handler()(call),{message:'ACCESS_DENIED'});assert.equal(f.state.credentialOwnerCalls,undefined);
});

test('legacy clock, changed selectors, wrong branch and unknown private fields withhold the complete semantic DTO',async()=>{
 for(const mutate of [p=>p.generatedAt=new Date().toISOString(),p=>p.generatedAt='2026-10-17T12:34:56Z',p=>p.clientId=other,
  p=>p.query='other',p=>p.clientName=null,p=>p.tool=graphId,p=>p.sql='PRIVATE',p=>p.results[0].clientId=other,
  p=>p.results[0].score=0.2,p=>p.results[0].kind='other',p=>p.results[0].title='wrong',p=>p.results[0].snippet=' two  spaces',
  p=>{p.note='Knowledge-base search is temporarily unavailable; fall back to get_client_context.';}]){
  const f=storedCase(searchId);f.state.resultMutator=mutate;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});assert.equal(f.wire.length,1);
 }
 const missing=storedCase(searchId,{request:{query:'policy'}});missing.state.page=storedCase(searchId).page;
 await assert.rejects(missing.handler()(missing.call()),{message:'INVALID_RESULT'});
 const selected=storedCase(searchId);selected.state.page=storedSearchPage({clientId:null},selected.normalizationContext.asOf);
 await assert.rejects(selected.handler()(selected.call()),{message:'INVALID_RESULT'});
});

test('ordered opaque native IDs/scores and UTF-16 prefix excerpts are preserved without reparsing',async()=>{
 const f=storedCase(searchId,{request:{query:'policy',clientId,limit:2}}),snippet='x'.repeat(109)+'🌱'+'Z'.repeat(168),input=f.call().input;
 const rows=[{kind:'client_doc_chunk',id:'opaque/ref?<not-a-uuid>',score:3.25,snippet,title:snippet.slice(0,110)},
  {kind:'client_profile',id:'',score:0.200001,snippet:'',title:''}];
 f.state.page=storedSearchPage(input,f.normalizationContext.asOf,{results:rows});assert.deepEqual((await result(f)).results,rows);
 for(const mutation of [p=>p.results.push({...p.results[0]}),p=>{p.results[0].snippet='x'.repeat(281);p.results[0].title='x'.repeat(110);}]){
  const g=storedCase(searchId,{request:{query:'policy',clientId,limit:1}});g.state.resultMutator=mutation;
  await assert.rejects(g.handler()(g.call()),{message:'INVALID_RESULT'});
 }
});

test('native validation/client-not-found/failed HTTP are execution failures with no fallback or invented result',async()=>{
 for(const status of [400,401,403,404,429,500]){
  const f=storedCase(searchId);f.state.responseFactory=()=>Response.json({error:'PRIVATE'},{status});
  await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});assert.equal(f.wire.length,1);assert.equal(f.credentialCalls.length,1);
 }
});

test('cancel, expiry and response limits withhold semantic results after acquisition',async()=>{
 const a=storedCase(searchId);await assert.rejects(a.handler()({...a.call(),signal:AbortSignal.abort()}),{message:'CANCELLED'});assert.equal(a.credentialCalls.length,0);
 const b=storedCase(searchId),controller=new AbortController();b.state.afterSource=()=>controller.abort();
 await assert.rejects(b.handler()({...b.call(),signal:controller.signal}),{message:'CANCELLED'});
 const c=storedCase(searchId);c.state.afterSource=()=>c.state.now=c.authority.deadlineMs;await assert.rejects(c.handler()(c.call()),{message:'DEADLINE'});
 const d=storedCase(searchId);await assert.rejects(d.handler({maxResponseBytes:8})(d.call()),{message:'RESOURCE_LIMIT'});
});

test('complete factory preserves operation order and graph wire with no observation header',async()=>{
 const f=storedCase(searchId),graph=storedCase(),refs=[f.operation,graph.operation];
 const handlers=createClientKnowledgeSearchHandlers({...f.transport,now:f.now},refs);assert.deepEqual(handlers.map(h=>h.operation),refs);
 await handlers[0].execute(f.call());await graph.handler()(graph.call());assert.equal(Object.hasOwn(graph.wire[0].options.headers,'x-meri-read-observation'),false);
 assert.throws(()=>createKnowledgeGraphHandlers({...f.transport,now:f.now},[f.operation]),{message:'GATEWAY_CONFIGURATION'});
 for(const operations of [[],[f.operation,f.operation],[{id:searchId,version:'0.1.0'}],[{id:'query_outreach',version:'0.2.0'}]])
  assert.throws(()=>createClientKnowledgeSearchHandlers({...f.transport,now:f.now},operations),{message:'GATEWAY_CONFIGURATION'});
});

test('semantic observation is mandatory, finite and cannot use request/result rewrites or cover graph',()=>{
 const f=storedCase(searchId),config={...f.transport,now:f.now},spec={family:f.family,routes:{[searchId]:`/api/clio/tools/${searchId}`},observation:'client-knowledge-asof'};
 for(const changes of [{observation:undefined},{observation:'funding-asof'},{observation:'client-knowledge-asof-v2'},
  {requestBody:c=>c.request},{resultBody:(_c,r)=>r},{family:'funding-opportunities'},{routes:{[graphId]:`/api/clio/tools/${graphId}`}},
  {routes:{...spec.routes,[graphId]:`/api/clio/tools/${graphId}`}}])
  assert.throws(()=>createStoredNativeReadHandlers(config,[f.operation],{...spec,...changes}),{message:'GATEWAY_CONFIGURATION'});
});

test('transport refuses wrong route/version/body/mode and unqualified delegation before credentials',async()=>{
 const f=storedCase(searchId),call={...f.call(),contract:f.contract,operation:f.operation,deadlineMs:f.authority.deadlineMs};
 const spec={path:`/api/clio/tools/${searchId}`,method:'POST',body:f.arguments,serviceSecret:true,observation:'client-knowledge-asof'};
 const {credentialsForCall,...passive}=f.transport,transport=createRetainedHttpTransport({...passive,now:f.now,getCredentials:()=>{throw Error('SHOULD_NOT_ACQUIRE');}});
 for(const changes of [{path:`/api/clio/tools/${graphId}`},{method:'GET'},{body:{...f.arguments,query:'other'}},{serviceSecret:false},{observation:'funding-asof'}])
  await assert.rejects(transport.read(call,{...spec,...changes}),{message:'GATEWAY_CONFIGURATION'});
 await assert.rejects(transport.read({...call,operation:{...call.operation,version:'0.1.0'}},spec),{message:'GATEWAY_CONFIGURATION'});
 let calls=0;const delegated=createRetainedHttpTransport({origin:f.transport.origin,now:f.now,delegatedTransport:{read(){calls++;}}});
 await assert.rejects(delegated.read(call,spec),{message:'UNAVAILABLE'});assert.equal(calls,0);assert.equal(f.wire.length,0);
});
