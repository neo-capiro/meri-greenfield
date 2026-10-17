/** Actual JSON request/response receiving with synthetic stored economic rows only. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {deny} from '../../../dispatch/operation-result.mjs';
import {createPublicDataHandlers} from '../handler.mjs';
import {storedCase,id} from './fixture.mjs';

for(const source of ['census','bls','bea']){
 test(`${source}: fixed original flat native POST preserves its full source-discriminated result`,async()=>{
  const f=storedCase(id,{request:{source}}),call=f.call(),out=JSON.parse(await f.handler()(call)),[wire]=f.wire,[proof]=f.credentialCalls;
  assert.deepEqual(out,{binding:f.authority.binding,subject:f.authority.subject,operation:f.operation,argumentsSha256:call.argumentsSha256,result:f.page});
  assert.equal(wire.url,'https://native-core.example.invalid/api/clio/tools/query_economic_data');assert.equal(wire.options.method,'POST');
  assert.deepEqual(wire.body,{source});assert.equal(Object.hasOwn(wire.body,'input'),false);assert.equal(f.wire.length,1);
  assert.equal(wire.options.headers.authorization,'Bearer SYNTHETIC_NATIVE_USER');
  assert.equal(wire.options.headers['x-internal-service-secret'],'SYNTHETIC_INTERNAL_SERVICE');
  assert.equal(wire.options.redirect,'error');assert.equal(wire.options.credentials,'omit');assert.equal(wire.options.cache,'no-store');
  assert.deepEqual(proof.operation,f.operation);assert.deepEqual(proof.sourceIds,['stored_public_data']);
  assert.equal(proof.requestSha256,hash(f.arguments));assert.equal(proof.argumentsSha256,call.argumentsSha256);assert.deepEqual(proof.normalizationContext,{});
 });
 test(`${source}: requested window and source substitution cannot become accepted stored rows`,async()=>{
  for(const mutate of [page=>page.data.push({...page.data[0]}),page=>page.source=source==='census'?'bls':'census',
   page=>page.complete=true,page=>page.sourceEnabled=true,page=>page.generatedAt='2026-02-30T00:00:00.000Z']){
   const f=storedCase(id,{request:{source,limit:1}});f.state.resultMutator=mutate;
   await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
  }
 });
}

test('constructor admits only the economic operation and never constructs policy-dependent siblings',()=>{
 const f=storedCase();
 for(const operations of [[],[f.operation,f.operation],[{id:'search_federal_grants',version:'0.2.0'}],
  [{id:'search_federal_awards',version:'0.2.0'}],[{id,version:'0.1.0'}],[{id:'query_global_data',version:'0.2.0'}]]){
  assert.throws(()=>createPublicDataHandlers({...f.transport,now:f.now},operations),{message:'GATEWAY_CONFIGURATION'});
 }
 let effects=0;assert.throws(()=>createPublicDataHandlers({...f.transport,now:f.now},[{get id(){effects++;return id;},version:'0.2.0'}]));
 assert.equal(effects,0);assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
});

test('empty economic request reaches Core unchanged and defaults only through the canonical owner',async()=>{
 const f=storedCase(),call=f.call(),out=JSON.parse(await f.handler()(call));
 assert.deepEqual(call.input,{limit:20,source:'census'});assert.deepEqual(f.wire[0].body,{});assert.equal(out.result.source,'census');
 assert.equal(Object.hasOwn(out.result,'total'),false);assert.equal(Object.hasOwn(out.result,'complete'),false);
});

test('source and selectors retain exactly one native trim/clip pass and the original request proof',async()=>{
 for(const [request,key,expected] of [
  [{source:' CENSUS ',state:' ca ',district:'A'.repeat(9)+' B',limit:'1.9'},'district','A'.repeat(9)+' '],
  [{source:' BLS ',seriesId:'A'.repeat(59)+' B',query:'q'.repeat(239)+' x',limit:'1.9'},'seriesId','A'.repeat(59)+' '],
  [{source:' BEA ',datasetName:'A'.repeat(59)+' B',dataset:'ignored',year:'2026',limit:'1.9'},'datasetName','A'.repeat(59)+' '],
 ]){
  const f=storedCase(id,{request}),call=f.call();assert.equal(call.input[key],expected);assert.equal(call.input.limit,1);
  const out=JSON.parse(await f.handler()(call));assert.deepEqual(f.wire[0].body,request);assert.equal(f.credentialCalls[0].requestSha256,hash(request));
  if(call.input.source==='bls')assert.equal(out.result.data[0].seriesId,expected);
  if(call.input.source==='bea')assert.equal(out.result.data[0].datasetName,expected);
 }
});

test('economic context and model arguments cannot invent policy, tenant, geography authority or credentials',async()=>{
 const f=storedCase();
 for(const extra of [{tenantId:'other'},{actorRole:'capiro_admin'},{clientId:'other'},{evidenceAccuracyMode:'off'},
  {authorized:true},{sql:'SELECT synthetic'},{asOf:'2026-10-12T00:00:00.000Z'}]){
  await assert.rejects(f.handler()({...f.call(),request:extra}),{message:'INVALID_ARGUMENTS'});
 }
 for(const normalizationContext of [{evidenceAccuracyMode:'off'},{evidenceAccuracyMode:'shadow'},{evidenceAccuracyMode:'enforce'},{defaultCongress:119}]){
  await assert.rejects(f.handler()({...f.call(),normalizationContext}),{message:'INVALID_ARGUMENTS'});
 }
 await assert.rejects(f.handler()({...f.call(),argumentsSha256:'0'.repeat(64)}),{message:'INVALID_ARGUMENTS'});
 assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
});

test('malformed selectors refuse before source effects instead of being coerced into fabricated empty success',async()=>{
 const f=storedCase();
 for(const request of [{source:3},{limit:true},{year:true},{year:'bad'},{year:1.5},{year:2147483648},{state:'\u00dfx'},
  {query:[]},{dataset:{}},{input:{source:'census'}}]){
  await assert.rejects(f.handler()({...f.call(),request}),{message:'INVALID_ARGUMENTS'});
 }
 assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
});

test('denied or incoherent current actor, decision, allocation action or source reaches no credentials',async()=>{
 for(const mutate of [a=>a.claims.audience='other',a=>a.claims.actions=[],a=>a.decision.decision='denied',
  a=>a.decision.operation='search_federal_grants@0.2.0',a=>a.decision.actor.actorId='other',a=>a.decision.scopes=[],
  a=>a.sourceIds=['other'],a=>a.claims.binding.tenantId='other',a=>a.claims.issuedAt=new Date(a.deadlineMs).toISOString()]){
  const f=storedCase(),call=structuredClone(f.call());mutate(call.authority);
  await assert.rejects(f.handler()(call));assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
 }
});

test('every native credential correlation and both genuine credential ports remain mandatory',async()=>{
 for(const key of ['binding','subject','operation','policyRevision','sourceIds','requestSha256','argumentsSha256','normalizationContext','origin','bearerToken','serviceSecret','expiresAtMs']){
  const f=storedCase();f.state.credentialMutator=receipt=>receipt[key]=key==='expiresAtMs'?f.now():null;
  await assert.rejects(f.handler()(f.call()),{message:'ACCESS_DENIED'});assert.equal(f.wire.length,0);
 }
 const f=storedCase();await assert.rejects(f.handler({getCredentials:undefined})(f.call()),{message:'UNAVAILABLE'});assert.equal(f.wire.length,0);
 const g=storedCase();await assert.rejects(g.handler({getCredentials:async()=>deny('ACCESS_DENIED')})(g.call()),{message:'ACCESS_DENIED'});assert.equal(g.wire.length,0);
});

test('per-call credential selection binds the exact original economic call without a static fallback',async()=>{
 const f=storedCase(),call=f.call(),{getCredentials,...configuration}=f.transport;let captured;
 const [handler]=createPublicDataHandlers({...configuration,now:f.now,credentialsForCall:(operation,original)=>{
  captured={operation,original};return getCredentials;
 }},[f.operation]);
 await handler.execute(call);assert.equal(captured.original,call);assert.deepEqual(captured.operation,f.operation);
 assert.throws(()=>f.handler({credentialsForCall:()=>getCredentials}),{message:'GATEWAY_CONFIGURATION'});
});

test('cancelled, expired and oversized economic reads withhold source bytes',async()=>{
 const f=storedCase();await assert.rejects(f.handler()({...f.call(),signal:AbortSignal.abort()}),{message:'CANCELLED'});assert.equal(f.credentialCalls.length,0);
 await assert.rejects(f.handler({maxResponseBytes:16})(f.call()),{message:'RESOURCE_LIMIT'});
 const g=storedCase(),controller=new AbortController();g.state.afterSource=()=>controller.abort();
 await assert.rejects(g.handler()({...g.call(),signal:controller.signal}),{message:'CANCELLED'});
 const h=storedCase();h.state.now=h.authority.deadlineMs;await assert.rejects(h.handler()(h.call()),{message:'DEADLINE'});assert.equal(h.wire.length,0);
});

test('HTTP failures and wrapped/foreign output cannot replace a known stored-source result',async()=>{
 for(const response of [()=>Response.json({error:'PRIVATE_SOURCE_DETAIL'},{status:503}),()=>Response.json({tool:id,error:'PRIVATE_SOURCE_DETAIL'}),
  page=>Response.json({output:page}),page=>Response.json({...page,tool:'search_federal_awards'})]){
  const f=storedCase();f.state.responseFactory=response;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
});

test('unknown source retains the bounded native error branch without a timestamp or invented rows',async()=>{
 const f=storedCase(id,{request:{source:' Unregistered '}}),out=JSON.parse(await f.handler()(f.call()));
 assert.deepEqual(out.result,{tool:id,error:'Unknown source "Unregistered". Use "census", "bls", or "bea".'});
 assert.deepEqual(f.wire[0].body,{source:' Unregistered '});assert.equal(Object.hasOwn(out.result,'generatedAt'),false);
 for(const mutate of [page=>page.data=[],page=>page.generatedAt=new Date(f.now()).toISOString(),page=>delete page.error]){
  f.state.resultMutator=mutate;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
});

test('Census nullable storage values and opaque topIndustries stay unchanged without invented unit/range claims',async()=>{
 const f=storedCase(id,{request:{state:' ca ',district:'AL'}});
 f.state.page={...f.page,data:[{...f.page.data[0],totalPopulation:-12,percentBachelorPlus:125,percentPoverty:-1}]};
 const out=JSON.parse(await f.handler()(f.call())).result;assert.deepEqual(out,f.state.page);assert.equal(out.data[0].medianAge,null);
 assert.deepEqual(out.data[0].topIndustries,{reported:['Synthetic industry',null,3]});
 for(const mutate of [page=>page.data[0].state='NY',page=>page.data[0].district='01',page=>page.data[0].totalPopulation=1.5,
  page=>page.data[0].sourceUpdatedAt=page.generatedAt]){
  f.state.resultMutator=mutate;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
});

test('BLS preserves stored period/value tuples and the twelve-point per-series bound',async()=>{
 const f=storedCase(id,{request:{source:'bls',seriesId:'Synthetic Series'}}),out=JSON.parse(await f.handler()(f.call())).result;
 assert.equal(out.data[0].recentDataPoints[0].period,'M13');assert.equal(out.data[0].recentDataPoints[0].value,-2.5);assert.equal(out.data[0].surveyName,null);
 for(const mutate of [page=>page.data[0].seriesId='other',page=>page.data[0].units='invented',
  page=>page.data[0].recentDataPoints=Array(13).fill(page.data[0].recentDataPoints[0])]){
  f.state.resultMutator=mutate;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
});

test('BEA dataset alias, explicit dataset precedence, year and nullable units retain source semantics',async()=>{
 for(const request of [{source:'bea',dataset:' NIPA ',year:'2026'},
  {source:'bea',datasetName:' NIPA ',dataset:'ignored',year:2026}]){
  const f=storedCase(id,{request}),out=JSON.parse(await f.handler()(f.call())).result;
  assert.equal(out.data[0].datasetName,'NIPA');assert.equal(out.data[0].year,2026);assert.equal(out.data[0].units,null);assert.deepEqual(f.wire[0].body,request);
  for(const mutate of [page=>page.data[0].datasetName='other',page=>page.data[0].year=2025,page=>page.data[0].description='x'.repeat(241)]){
   f.state.resultMutator=mutate;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
  }
 }
});

test('empty bounded stored pages retain no assertion of exhaustive or authoritative absence',async()=>{
 for(const source of ['census','bls','bea']){
  const f=storedCase(id,{request:{source}});f.state.page={...f.page,data:[]};const out=JSON.parse(await f.handler()(f.call())).result;
  assert.deepEqual(out.data,[]);assert.equal(Object.hasOwn(out,'total'),false);assert.equal(Object.hasOwn(out,'complete'),false);
 }
});
