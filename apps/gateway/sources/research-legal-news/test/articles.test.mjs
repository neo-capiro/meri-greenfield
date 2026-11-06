/** Current articles path through the real consumer and private carrier; synthetic producer only. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {decodeNativeReadObservation,NATIVE_READ_OBSERVATION_HEADER} from '../../../../../packages/contracts/native-read-observation-0.2/validate.mjs';
import {createSourceReadContext} from '../../../../runtime/read-context/source-read-context.mjs';
import {assertNewsRawRequest,newsSliceContext} from '../request-context.mjs';
import {storedCase} from './fixture.mjs';
import {createStoredNativeReadHandlers} from '../../retained-reads/native-handler.mjs';
import {createRetainedHttpTransport} from '../../retained-reads/http-transport.mjs';
import {retainedCall} from '../../retained-reads/call-context.mjs';

const request={view:'articles',q:'drone procurement',days:7,limit:2};
const execute=f=>f.handler({getCredentials:undefined,credentialsForCall:()=>f.transport.getCredentials});

test('articles reaches the fixed owner with the exact cutoff consumed by the synthetic source',async()=>{
 const f=storedCase(undefined,{request}),call=f.call();f.state.now+=17;
 const out=JSON.parse(await execute(f)(call)),wire=f.wire[0];
 assert.equal(wire.url,'https://native-core.example.invalid/api/clio/tools/search_legiwatch_news');
 assert.deepEqual(wire.body,request);assert.equal(wire.options.redirect,'error');
 const observation=decodeNativeReadObservation(wire.options.headers[NATIVE_READ_OBSERVATION_HEADER],{operation:f.operation,request:wire.body});
 assert.deepEqual(observation.context,{asOf:call.normalizationContext.windowAsOf});
 assert.equal(f.state.consumedAsOf,call.normalizationContext.windowAsOf);
 assert.equal(out.result.result.window.since,new Date(Date.parse(f.state.consumedAsOf)-7*86400000).toISOString());
 assert.equal(out.result.result.items.length,1);assert.equal(out.result.result.items[0].body,null);
 assert.equal(f.wire.length,1);assert.equal(f.credentialCalls.length,1);
 assert.equal(Object.hasOwn(out.result,'absenceEvidence'),false);
});

test('named client and folder retain original authority proof while the carrier binds the exact resolved body',async()=>{
 const clientId='a1234567-b123-4c12-8d12-e123456789ab',raw={...request,clientId:' Synthetic client ',folderId:'synthetic-folder'};
 const context=newsSliceContext({id:'search_legiwatch_news',version:'0.2.0'},raw,{reference:'Synthetic client',clientId},'2026-10-12T01:00:00.000Z');
 const f=storedCase(undefined,{request:raw,context}),out=JSON.parse(await execute(f)(f.call())),wire=f.wire[0];
 assert.deepEqual(wire.body,{...raw,clientId});assert.equal(out.result.result.scope.clientId,clientId);
 assert.equal(out.result.result.scope.folderId,raw.folderId);
 assert.equal(f.credentialCalls[0].requestSha256,hash(raw));
 const carrier=wire.options.headers[NATIVE_READ_OBSERVATION_HEADER];
 assert.equal(decodeNativeReadObservation(carrier,{operation:f.operation,request:wire.body}).requestSha256,hash(wire.body));
 assert.throws(()=>decodeNativeReadObservation(carrier,{operation:f.operation,request:raw}),{message:'NATIVE_READ_OBSERVATION_REFUSED'});
});

test('runtime captures one cutoff and retains it across final release while current scope is checked again',()=>{
 const f=storedCase(undefined,{request}),proof={request,subject:f.authority.subject,binding:f.binding};
 const options={contract:f.contract,proof,native:{clientIds:[]},now:f.now};
 const first=createSourceReadContext(options);f.state.now+=500;
 assert.deepEqual(createSourceReadContext({...options,priorContext:first}),first);
 assert.equal(first.windowAsOf,f.normalizationContext.windowAsOf);
 const scoped=structuredClone(proof);scoped.subject.kind='client';scoped.subject.entityType='client';
 assert.throws(()=>createSourceReadContext({...options,proof:scoped,priorContext:first}));
});

test('articles requires the captured cutoff and per-call credential owner, never a fabricated default',async()=>{
 const f=storedCase(undefined,{request});
 assert.throws(()=>newsSliceContext(f.operation,request),{message:'UNAVAILABLE'});
 await assert.rejects(f.handler()(f.call()),{message:'UNAVAILABLE'});
 assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
});

test('generic native assembly and direct transport cannot omit the articles observation',async()=>{
 const f=storedCase(undefined,{request}),configuration={...f.transport,now:f.now};
 assert.throws(()=>createStoredNativeReadHandlers(configuration,[f.operation],{family:'research-legal-news',routes:{search_legiwatch_news:'/api/clio/tools/search_legiwatch_news'}}),{message:'GATEWAY_CONFIGURATION'});
 const call=retainedCall(f.operation,f.call(),f.now);
 await assert.rejects(createRetainedHttpTransport(configuration).read(call,{path:'/api/clio/tools/search_legiwatch_news',method:'POST',body:request,serviceSecret:true}),{message:'GATEWAY_CONFIGURATION'});
 assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
});

test('retired/default views, monitors and invalid article selectors stop before credential or HTTP work',async()=>{
 const f=storedCase(undefined,{request});let factories=0;
 const run=f.handler({getCredentials:undefined,credentialsForCall:()=>{factories++;return f.transport.getCredentials;}});
 for(const raw of [{},{view:'news'},{view:'monitors'},{...request,folderId:'private-folder'}]){
  assert.throws(()=>assertNewsRawRequest(f.operation,raw),{message:'UNAVAILABLE'});
  await assert.rejects(run({...f.call(),request:raw}),{message:'UNAVAILABLE'});
 }
 for(const extra of [{monitorId:null},{monitorId:'retired'},{days:2},{offset:1.5},{offset:10001},{folderId:'x'.repeat(101),clientId:'a1234567-b123-4c12-8d12-e123456789ab'}]){
  const raw={...request,...extra};assert.throws(()=>assertNewsRawRequest(f.operation,raw),{message:'INVALID_ARGUMENTS'});
  await assert.rejects(run({...f.call(),request:raw}),{message:'INVALID_ARGUMENTS'});
 }
 assert.equal(factories,0);assert.equal(f.wire.length,0);
});

test('the receiving contract rejects changed cutoff, scope, publisher, age and pagination',async()=>{
 for(const mutate of [p=>p.result.window.since=new Date(Date.parse(p.result.window.since)+1).toISOString(),
  p=>p.result.scope.clientId='a1234567-b123-4c12-8d12-e123456789ab',p=>p.result.items[0].publisher='other',
  p=>p.result.items[0].observed_at=new Date(Date.parse(p.result.window.since)-1).toISOString(),p=>p.result.nextOffset=2]){
  const f=storedCase(undefined,{request:{...request,publisher:'Selected publisher'}});f.state.resultMutator=mutate;
  await assert.rejects(execute(f)(f.call()),{message:'INVALID_RESULT'});assert.equal(f.wire.length,1);
 }
});

test('empty and paged articles remain bounded source results without automatic follow-up or completeness claims',async()=>{
 const f=storedCase(undefined,{request});f.state.page=structuredClone(f.page);f.state.page.result.items=[];
 const empty=JSON.parse(await execute(f)(f.call()));assert.equal(empty.result.result.items.length,0);assert.equal(f.wire.length,1);
 const g=storedCase(undefined,{request});g.state.page=structuredClone(g.page);
 g.state.page.result.items.push({...g.state.page.result.items[0],id:'synthetic-second'});g.state.page.result.nextOffset=2;
 const page=JSON.parse(await execute(g)(g.call()));assert.equal(page.result.result.nextOffset,2);assert.equal(g.wire.length,1);
 assert.equal(Object.hasOwn(page.result.result,'total'),false);
});

test('articles preserves credential refusal, cancellation and deadline enforcement',async()=>{
 const f=storedCase(undefined,{request});f.state.credentialMutator=receipt=>{receipt.bearerToken='';};
 await assert.rejects(execute(f)(f.call()),{message:'ACCESS_DENIED'});assert.equal(f.wire.length,0);
 const g=storedCase(undefined,{request});await assert.rejects(execute(g)({...g.call(),signal:AbortSignal.abort()}),{message:'CANCELLED'});assert.equal(g.wire.length,0);
 const h=storedCase(undefined,{request});h.state.now=h.authority.deadlineMs;
 await assert.rejects(execute(h)(h.call()),{message:'DEADLINE'});assert.equal(h.wire.length,0);
});
