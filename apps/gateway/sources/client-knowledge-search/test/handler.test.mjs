/** Source-only graph receiving and current credential boundary; all HTTP is synthetic. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {createKnowledgeGraphHandlers} from '../handler.mjs';
import {storedCase,id,clientId,emptyGraph,graphErrors} from './fixture.mjs';

test('graph exact native route, unchanged flat selector and complete carrier preserve separate request/input hashes',async()=>{
 const request={clientId,seed:'  bill:synthetic-bill  ',depth:'2.9'},f=storedCase(id,{request}),call=f.call(),out=JSON.parse(await f.handler()(call)),[wire]=f.wire,[proof]=f.credentialCalls;
 assert.deepEqual(out,{binding:f.binding,subject:f.authority.subject,operation:f.operation,argumentsSha256:call.argumentsSha256,result:f.page});
 assert.equal(wire.url,'https://native-core.example.invalid/api/clio/tools/query_knowledge_graph');assert.equal(wire.options.method,'POST');assert.deepEqual(wire.body,request);
 assert.equal(wire.options.headers.authorization,'Bearer SYNTHETIC_NATIVE_USER');assert.equal(wire.options.headers['x-internal-service-secret'],'SYNTHETIC_INTERNAL_SERVICE');
 assert.equal(wire.options.redirect,'error');assert.equal(wire.options.credentials,'omit');assert.equal(wire.options.cache,'no-store');
 assert.equal(proof.requestSha256,hash(request));assert.equal(proof.argumentsSha256,call.argumentsSha256);assert.notEqual(proof.requestSha256,proof.argumentsSha256);assert.deepEqual(proof.normalizationContext,{});
 assert.equal(call.input.seed,'bill:synthetic-bill');assert.equal(call.input.depth,2);
});

test('unscoped graph retains native firm graph without manufacturing a client selector',async()=>{
 const f=storedCase(),out=JSON.parse(await f.handler()(f.call()));assert.deepEqual(f.wire[0].body,{});assert.deepEqual(out.result,f.page);
 assert.equal(Object.hasOwn(out.result,'tool'),false);assert.equal(Object.hasOwn(out.result,'generatedAt'),false);assert.equal(Object.hasOwn(out.result,'complete'),false);
});

test('empty graph retains edges rather than substituting connections or an absence claim',async()=>{
 const f=storedCase(id,{request:{seed:'bill:unknown',depth:4},page:emptyGraph()}),out=JSON.parse(await f.handler()(f.call()));
 assert.deepEqual(out.result,emptyGraph());assert.equal(Object.hasOwn(out.result,'connections'),false);
});

for(const [request,message] of [[{clientId:'arbitrary-name'},graphErrors[0]],[{clientId,seed:'client:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'},graphErrors[1]]])test('canonical native refusal form survives complete result validation without rewriting source text',async()=>{
 const f=storedCase(id,{request}),out=JSON.parse(await f.handler()(f.call()));assert.deepEqual(out.result,{error:message});assert.deepEqual(f.wire[0].body,request);
});

test('connection text is opaque and the 120-row native projection is retained without parsing',async()=>{
 const f=storedCase(),connections=Array.from({length:120},(_,i)=>`unparsed <label:${i}> --has -- arbitrary[mention]--> text`);
 f.state.page={...f.page,summary:'2 nodes, 121 connections. Edges tagged [fact]=from firm data, [mention]=from analyst notes.',connections};
 const out=JSON.parse(await f.handler()(f.call()));assert.deepEqual(out.result.connections,connections);
});

test('foreign client nodes, duplicate identities and malformed graph summaries withhold the entire DTO',async()=>{
 for(const mutate of [p=>p.nodes[0].id='client:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',p=>p.nodes.push({...p.nodes[0]}),p=>p.nodes[0].id='person:other',p=>p.summary=p.summary.replace('1 connections','0 connections'),p=>p.complete=true]){
  const f=storedCase(id,{request:{clientId}});f.state.resultMutator=mutate;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});assert.equal(f.wire.length,1);
 }
});

test('wrong native refusal and transformed empty/nonempty envelopes are invalid results',async()=>{
 for(const page of [{error:'private internal failure'},{...emptyGraph(),connections:[]},{summary:'2 nodes, 1 connections. Edges tagged [fact]=from firm data, [mention]=from analyst notes.',nodes:[],connections:['invented']}]){
  const f=storedCase(id,{page});await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
});

test('authority/selector substitution and malformed contexts cannot reach credentials or HTTP',async()=>{
 for(const change of [c=>c.authority.decision.decision='denied',c=>c.authority.sourceIds=['foreign'],c=>c.argumentsSha256='a'.repeat(64),c=>c.request={...c.request,tenantId:'foreign'},c=>c.normalizationContext={clientIds:[clientId]}]){
  const f=storedCase(),call=structuredClone(f.call());change(call);await assert.rejects(f.handler()(call));assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
 }
});

test('pre-read current credential denial prevents even a native graph request',async()=>{
 const f=storedCase(id,{request:{clientId}});await assert.rejects(f.handler({getCredentials:async()=>{throw Error('ACCESS_DENIED');}})(f.call()));assert.equal(f.wire.length,0);
 const missing=storedCase();await assert.rejects(missing.handler({getCredentials:undefined})(missing.call()),{message:'UNAVAILABLE'});assert.equal(missing.wire.length,0);
});

test('credential correlation, both secrets, abort, deadline and response bounds remain enforced',async()=>{
 for(const key of ['binding','subject','operation','policyRevision','sourceIds','requestSha256','argumentsSha256','normalizationContext','origin','bearerToken','serviceSecret','expiresAtMs']){
  const f=storedCase();f.state.credentialMutator=r=>r[key]=key==='expiresAtMs'?f.now():null;await assert.rejects(f.handler()(f.call()),{message:'ACCESS_DENIED'});assert.equal(f.wire.length,0);
 }
 const aborted=storedCase();await assert.rejects(aborted.handler()({...aborted.call(),signal:AbortSignal.abort()}),{message:'CANCELLED'});assert.equal(aborted.credentialCalls.length,0);
 const late=storedCase();late.state.now=late.authority.deadlineMs;await assert.rejects(late.handler()(late.call()),{message:'DEADLINE'});assert.equal(late.wire.length,0);
 const small=storedCase();await assert.rejects(small.handler({maxResponseBytes:8})(small.call()),{message:'RESOURCE_LIMIT'});
 const cancelled=storedCase(),controller=new AbortController();cancelled.state.afterSource=()=>controller.abort();await assert.rejects(cancelled.handler()({...cancelled.call(),signal:controller.signal}),{message:'CANCELLED'});
});

test('per-call credentials bind the exact original call and refuse a static fallback',async()=>{
 const f=storedCase(),call=f.call(),{getCredentials,...configuration}=f.transport;let captured;
 const [handler]=createKnowledgeGraphHandlers({...configuration,now:f.now,credentialsForCall:(operation,original)=>{captured={operation,original};return getCredentials;}},[f.operation]);
 await handler.execute(call);assert.equal(captured.original,call);assert.deepEqual(captured.operation,f.operation);
 assert.throws(()=>f.handler({credentialsForCall:()=>getCredentials}),{message:'GATEWAY_CONFIGURATION'});
});

test('embedding sibling, unknown route, duplicates and versions cannot be registered through the graph factory',()=>{
 const f=storedCase();for(const operations of [[],[f.operation,f.operation],[{id:'search_client_knowledge',version:'0.2.0'}],[{id:'query_economic_data',version:'0.2.0'}],[{id,version:'0.1.0'}]]){
  assert.throws(()=>createKnowledgeGraphHandlers({...f.transport,now:f.now},operations),{message:'GATEWAY_CONFIGURATION'});
 }
 assert.equal(f.wire.length,0);assert.equal(f.credentialCalls.length,0);
});
