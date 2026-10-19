import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {deny} from '../../../dispatch/operation-result.mjs';
import {createResearchLegalCandidatesHandlers} from '../handler.mjs';
import {researchCandidatesContext} from '../request-context.mjs';
import {operation,storedCase,clientId,otherClientId} from './fixture.mjs';

test('fixed Core route preserves raw request, candidate DTO and current per-call proof',async()=>{
 const f=storedCase({request:{query:' priority ',limit:'2.8'}}),call=f.call(),out=JSON.parse(await f.handler()(call));
 assert.deepEqual(out,{binding:f.authority.binding,subject:f.authority.subject,operation,argumentsSha256:call.argumentsSha256,result:f.page});
 assert.equal(f.wire[0].url,'https://native-core.example.invalid/api/clio/tools/search_research_sources');
 assert.equal(f.wire[0].options.method,'POST');assert.deepEqual(f.wire[0].body,f.arguments);
 assert.equal(f.wire[0].options.headers['x-internal-service-secret'],'SYNTHETIC_INTERNAL_SERVICE');
 assert.equal(f.wire[0].options.redirect,'error');assert.equal(f.wire[0].options.cache,'no-store');
 assert.equal(f.credentialCalls[0].requestSha256,hash(f.arguments));
 assert.deepEqual(f.credentialCalls[0].normalizationContext,{clientResolution:null});
 assert.equal(out.result.results[1].clientId,null);
});

test('client selection remains bounded by the actual selected-client subject before credential factories',async()=>{
 const f=storedCase({request:{query:'priority',clientId}}),execute=f.handler();
 const raw={...f.arguments,clientId:otherClientId},context=researchCandidatesContext(operation,raw);
 await assert.rejects(execute(f.call(raw,f.authority,context)),{message:'ACCESS_DENIED'});
 await assert.rejects(execute(f.call({query:'priority'},f.authority,{clientResolution:null})),{message:'ACCESS_DENIED'});
 assert.equal(f.state.factories??0,0);assert.equal(f.wire.length,0);
 const result=JSON.parse(await execute(f.call()));assert.equal(result.result.results[0].clientId,clientId);
});

test('a model UUID cannot create selected-client authority in a personal run',async()=>{
 const f=storedCase(),request={query:'priority',clientId},context=researchCandidatesContext(operation,request);
 await assert.rejects(f.handler()(f.call(request,f.authority,context)),{message:'ACCESS_DENIED'});
 assert.equal(f.state.factories??0,0);assert.equal(f.wire.length,0);
});

test('names require trusted resolution, then send only its authorized UUID to Core',async()=>{
 const request={query:'priority',clientId:' Client Alpha '},resolution={reference:'Client Alpha',clientId};
 assert.throws(()=>researchCandidatesContext(operation,request),{message:'UNAVAILABLE'});
 const f=storedCase({request,resolution}),out=JSON.parse(await f.handler()(f.call()));
 assert.deepEqual(f.wire[0].body,{query:'priority',clientId});
 assert.equal(f.credentialCalls[0].requestSha256,hash(request));
 assert.equal(out.result.results[0].clientId,clientId);
 const forged={clientResolution:{reference:'Different client',clientId}};
 await assert.rejects(f.handler()({...f.call(),normalizationContext:forged}),{message:'ACCESS_DENIED'});
 assert.equal(f.wire.length,1);
});

test('raw caller authority and context keys are rejected before credentials or source reads',async()=>{
 const f=storedCase();
 for(const extra of [{tenantId:'other'},{userId:'other'},{currentTurn:{}},{clientResolution:null},{sourceIds:[]},{cursor:'fabricated'}])
  await assert.rejects(f.handler()({...f.call(),request:{...f.arguments,...extra}}),{message:'INVALID_ARGUMENTS'});
 await assert.rejects(f.handler()({...f.call(),normalizationContext:{clientResolution:null,comparisonLocale:'en'}}),{message:'ACCESS_DENIED'});
 await assert.rejects(f.handler()({...f.call(),argumentsSha256:'0'.repeat(64)}),{message:'INVALID_ARGUMENTS'});
 assert.equal(f.state.factories??0,0);
 assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
});

test('no ambient credential fallback is permitted for private candidate search',async()=>{
 const f=storedCase(),{credentialsForCall,...transport}=f.transport;
 const [handler]=createResearchLegalCandidatesHandlers({...transport,now:f.now,getCredentials:()=>{throw Error('must not run');}},[operation]);
 await assert.rejects(handler.execute(f.call()),{message:'UNAVAILABLE'});assert.equal(f.wire.length,0);
});

test('expired or revoked credentials and wrong tenant/actor/current decision cannot read Core',async()=>{
 for(const mutate of [a=>a.binding.tenantId='other',a=>a.decision.actor.actorId='other',a=>a.decision.decision='denied',
  a=>a.decision.operation='other@0.2.0',a=>a.claims.actions=[],a=>a.sourceIds=[],a=>a.deadlineMs=0]){
  const f=storedCase(),call=structuredClone(f.call());mutate(call.authority);
  await assert.rejects(f.handler()(call));assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
 }
 const f=storedCase();f.state.credentialMutator=proof=>proof.expiresAtMs=f.now();
 await assert.rejects(f.handler()(f.call()),{message:'ACCESS_DENIED'});assert.equal(f.wire.length,0);
 const revoked=storedCase();revoked.transport.credentialsForCall=()=>async()=>deny('ACCESS_DENIED');
 await assert.rejects(revoked.handler()(revoked.call()),{message:'ACCESS_DENIED'});assert.equal(revoked.wire.length,0);
});

test('source unavailability and malformed result cannot become empty successful candidates',async()=>{
 for(const status of [401,403,404,429,503]){
  const f=storedCase();f.state.responseFactory=()=>Response.json({private:'source failure'},{status});
  await assert.rejects(f.handler()(f.call()));assert.equal(f.wire.length,1);
 }
 for(const mutate of [p=>p.tool='other',p=>p.query='other',p=>p.complete=true,p=>p.results[0].clientId=otherClientId,
  p=>p.results.push(p.results[0]),p=>p.results[0].occurredAt='not a time']){
  const f=storedCase({request:{query:'priority',clientId}});f.state.resultMutator=mutate;
  await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
});

test('candidate window is validated; no synthetic pagination, total or freshness is added',async()=>{
 const f=storedCase({request:{query:'priority',limit:1}});
 f.state.resultMutator=p=>p.results=[1,2].map((_,i)=>({...p.results[0],id:`${i}0000000-0000-4000-8000-000000000001`}));
 await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 f.state.resultMutator=p=>p.results=[];
 const page=JSON.parse(await f.handler()(f.call())).result;
 assert.deepEqual(page,{tool:operation.id,query:'priority',generatedAt:f.page.generatedAt,results:[]});
 const metadata=f.contract.normalizeInput(f.arguments,f.normalizationContext).metadata;
 assert.equal(metadata.complete,false);assert.equal(metadata.absenceEvidence,false);
});

test('late cancellation and grant deadline do not release source content',async()=>{
 const f=storedCase(),controller=new AbortController();f.state.afterSource=()=>controller.abort();
 await assert.rejects(f.handler()({...f.call(),signal:controller.signal}),{message:'CANCELLED'});
 const expired=storedCase();expired.state.afterSource=()=>{expired.state.now+=10001;};
 await assert.rejects(expired.handler()(expired.call()),{message:'DEADLINE'});
});
