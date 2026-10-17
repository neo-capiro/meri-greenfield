/** Mode-bound fixed native receiving; every source and credential here is synthetic. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {decodeNativeReadObservation,NATIVE_READ_OBSERVATION_HEADER} from '../../../../../packages/contracts/native-read-observation-0.2/validate.mjs';
import {createPublicDataHandlers} from '../handler.mjs';
import {assertPublicDataModeRequest} from '../request-context.mjs';
import {storedCase,id as economic} from './fixture.mjs';
import {modeIds,storedModePage} from './mode-fixture.mjs';

for(const id of modeIds){
 for(const evidenceAccuracyMode of ['off','shadow','enforce'])test(`${id}/${evidenceAccuracyMode}: original request, current-mode carrier and exact native DTO cross JSON bytes`,async()=>{
  const f=storedCase(id,{evidenceAccuracyMode}),call=f.call(),out=JSON.parse(await f.handler()(call)),[wire]=f.wire;
  assert.deepEqual(out,{binding:f.authority.binding,subject:f.authority.subject,operation:f.operation,argumentsSha256:call.argumentsSha256,result:f.page});
  assert.equal(wire.url,`https://native-core.example.invalid/api/clio/tools/${id}`);assert.equal(wire.options.method,'POST');assert.deepEqual(wire.body,f.arguments);
  assert.equal(Object.hasOwn(wire.body,'evidenceAccuracyMode'),false);assert.equal(wire.options.redirect,'error');assert.equal(wire.options.credentials,'omit');assert.equal(wire.options.cache,'no-store');
  const observation=decodeNativeReadObservation(wire.options.headers[NATIVE_READ_OBSERVATION_HEADER],{operation:f.operation,request:f.arguments});
  assert.deepEqual(observation.context,{evidenceAccuracyMode});assert.equal(observation.requestSha256,hash(f.arguments));
  assert.deepEqual(f.credentialCalls[0].normalizationContext,{evidenceAccuracyMode});assert.equal(f.credentialCalls[0].argumentsSha256,call.argumentsSha256);
  assert.equal(f.credentialCalls[0].requestSha256,hash(f.arguments));assert.equal(f.state.credentialOwnerCalls[0].call,call);assert.deepEqual(f.state.credentialOwnerCalls[0].operation,f.operation);
  assert.equal(wire.options.headers.authorization,'Bearer SYNTHETIC_NATIVE_USER');assert.equal(wire.options.headers['x-internal-service-secret'],'SYNTHETIC_INTERNAL_SERVICE');
  assert.equal(Object.hasOwn(out.result.data[0],id==='search_federal_grants'?'deadline':'dates'),evidenceAccuracyMode==='enforce');assert.equal(f.wire.length,1);
 });
 test(`${id}: mode cannot come from raw arguments, an open context, or static credentials`,async()=>{
  const f=storedCase(id),call=f.call();
  for(const request of [{...f.arguments,evidenceAccuracyMode:'enforce'},{...f.arguments,tenantId:'other'},{input:f.arguments}])await assert.rejects(f.handler()({...call,request}),{message:'INVALID_ARGUMENTS'});
  for(const normalizationContext of [{},{evidenceAccuracyMode:'auto'},{evidenceAccuracyMode:'off',asOf:new Date(f.now()).toISOString()}])await assert.rejects(f.handler()({...call,normalizationContext}),{message:'INVALID_ARGUMENTS'});
  const legacy=storedCase(),{credentialsForCall,...passive}=f.transport;
  const [handler]=createPublicDataHandlers({...passive,now:f.now,getCredentials:legacy.transport.getCredentials},[f.operation]);
  await assert.rejects(handler.execute(call),{message:'UNAVAILABLE'});assert.equal(f.credentialCalls.length,0);assert.equal(legacy.credentialCalls.length,0);assert.equal(f.wire.length,0);
 });
 test(`${id}: a different output mode is rejected rather than inferred from fields`,async()=>{
  for(const evidenceAccuracyMode of ['off','enforce']){
   const f=storedCase(id,{evidenceAccuracyMode});f.state.page=storedModePage(id,f.call().input,evidenceAccuracyMode==='off'?'enforce':'off',f.now());
   await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});assert.equal(f.wire.length,1);
  }
 });
 test(`${id}: every credential proof and current source grant remains required before HTTP`,async()=>{
  for(const key of ['binding','subject','operation','policyRevision','sourceIds','requestSha256','argumentsSha256','normalizationContext','origin','bearerToken','serviceSecret','expiresAtMs']){
   const f=storedCase(id);f.state.credentialMutator=receipt=>receipt[key]=key==='expiresAtMs'?f.now():null;
   await assert.rejects(f.handler()(f.call()),{message:'ACCESS_DENIED'});assert.equal(f.wire.length,0);
  }
  for(const mutate of [a=>a.sourceIds=['foreign'],a=>a.claims.actions=[],a=>a.decision.decision='denied',a=>a.decision.actor.actorId='foreign']){
   const f=storedCase(id),call=structuredClone(f.call());mutate(call.authority);await assert.rejects(f.handler()(call));assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
  }
  const f=storedCase(id);f.state.resourceDenied=true;await assert.rejects(f.handler()(f.call()),{message:'ACCESS_DENIED'});assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
 });
 test(`${id}: foreign envelopes, result overflow, HTTP errors and cancellation withhold all result bytes`,async()=>{
  for(const responseFactory of [page=>Response.json({output:page}),page=>Response.json({...page,tool:'query_economic_data'}),()=>Response.json({error:'PRIVATE'},{status:503})]){
   const f=storedCase(id);f.state.responseFactory=responseFactory;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
  }
  const f=storedCase(id);await assert.rejects(f.handler({maxResponseBytes:16})(f.call()),{message:'RESOURCE_LIMIT'});
  const g=storedCase(id),controller=new AbortController();g.state.afterSource=()=>controller.abort();await assert.rejects(g.handler()({...g.call(),signal:controller.signal}),{message:'CANCELLED'});
  const h=storedCase(id);await assert.rejects(h.handler()({...h.call(),signal:AbortSignal.abort()}),{message:'CANCELLED'});assert.equal(h.credentialCalls.length,0);
 });
}

test('public-data composition preserves requested order and economic behavior without a mode header',async()=>{
 const f=storedCase(),operations=[{id:modeIds[1],version:'0.2.0'},f.operation,{id:modeIds[0],version:'0.2.0'}];
 const handlers=createPublicDataHandlers({...f.transport,now:f.now},operations);assert.deepEqual(handlers.map(h=>h.operation),operations);
 await handlers[1].execute(f.call());assert.deepEqual(f.wire[0].body,{});assert.equal(Object.hasOwn(f.wire[0].options.headers,NATIVE_READ_OBSERVATION_HEADER),false);
 for(const ops of [[operations[0],operations[0]],[operations[0],{id:'get_program_element',version:'0.2.0'}],[{id:modeIds[0],version:'0.1.0'}]])assert.throws(()=>createPublicDataHandlers({...f.transport,now:f.now},ops),{message:'GATEWAY_CONFIGURATION'});
});

test('public-data preflight uses canonical inert request shapes without invoking accessors',()=>{
 let effects=0;const f=storedCase(modeIds[0]);
 for(const raw of [{get query(){effects++;return 'x';}},new Proxy({},{get(){effects++;}}),{clientId:'foreign'},{evidenceAccuracyMode:'off'}])assert.throws(()=>assertPublicDataModeRequest(f.operation,raw),{message:'INVALID_ARGUMENTS'});
 assert.equal(effects,0);assert.throws(()=>assertPublicDataModeRequest({id:economic,version:'0.2.0'},{}),{message:'INVALID_ARGUMENTS'});
 const raw={query:' raw ',limit:'2.9'},captured=assertPublicDataModeRequest(f.operation,raw);assert.deepEqual(captured,raw);assert.equal(Object.isFrozen(captured),true);
});

test('public-data selectors, page lineage and mode-specific source labels remain canonical',async()=>{
 for(const id of modeIds){
  for(const mutate of [page=>page.data.push(...Array(3).fill(page.data[0])),page=>page.data[0].authorization=true,
   page=>{if(id==='search_federal_grants')page.data[0].syncedStatus='closed';else page.data[0].peCode='OTHER';},
   page=>{if(id==='search_federal_grants')page.asOf='2026-01-01T00:00:00.000Z';else page.nextPage=3;}]){
   const f=storedCase(id,{evidenceAccuracyMode:'enforce'});f.state.resultMutator=mutate;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
  }
 }
 const f=storedCase(modeIds[1]);for(const page of ['02','2.0',' 2',0,10001])await assert.rejects(f.handler()({...f.call(),request:{page}}),{message:'INVALID_ARGUMENTS'});assert.equal(f.credentialCalls.length,0);
});
