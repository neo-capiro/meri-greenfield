import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {createFederalMarketHandlers} from '../handler.mjs';
import {storedCase,ids,clientId} from './fixture.mjs';

for(const id of ids){
 test(`${id}: fixed native POST preserves distinct raw DTO and original request proof`,async()=>{
  const f=storedCase(id),call=f.call(),out=JSON.parse(await f.handler()(call)),[wire]=f.wire;
  assert.deepEqual(out.result,f.page);assert.equal(out.argumentsSha256,call.argumentsSha256);assert.equal(wire.url,`https://native-core.example.invalid/api/clio/tools/${id}`);
  assert.equal(wire.options.method,'POST');assert.deepEqual(wire.body,f.arguments);assert.equal(f.credentialCalls[0].requestSha256,hash(f.arguments));assert.deepEqual(f.credentialCalls[0].normalizationContext,{});
  assert.equal(wire.options.headers.authorization,'Bearer SYNTHETIC_NATIVE_USER');assert.equal(wire.options.headers['x-internal-service-secret'],'SYNTHETIC_INTERNAL_SERVICE');assert.equal(wire.options.cache,'no-store');assert.equal(wire.options.redirect,'error');
 });
 test(`${id}: caller authority exact operation and source grants fail before credential IO`,async()=>{
  for(const mutate of [c=>c.request.tenantId='forged',c=>c.argumentsSha256='0'.repeat(64),c=>c.authority.decision.decision='denied',c=>c.authority.decision.operation='get_representation@0.2.0',c=>c.authority.decision.actor.actorId='other',c=>c.authority.decision.scopes=[],c=>c.authority.sourceIds=[]]){
   const f=storedCase(id),call=structuredClone(f.call());mutate(call);await assert.rejects(f.handler()(call));assert.equal(f.wire.length,0);assert.equal(f.credentialCalls.length,0);
  }
 });
}
test('federal market optional client selector is preserved for trusted owner checks, including global forecasts',async()=>{
 for(const id of ids){const request={clientId,...(id===ids[4]?{state:'ny',district:'al'}:{query:' source query ',agency:' agency '})},f=storedCase(id,{request});
  await f.handler()(f.call());assert.deepEqual(f.wire[0].body,request);assert.deepEqual(f.authority.subject.entityIds,[clientId]);assert.deepEqual(f.visibleClientIds,[clientId]);
 }
 // The producer ignores forecast clientId for query matching. The same public
 // row survives while CONTROL still checks any supplied client selector.
 const global=storedCase(ids[3]),scoped=storedCase(ids[3],{request:{clientId}});
 assert.deepEqual(JSON.parse(await global.handler()(global.call())).result.items,JSON.parse(await scoped.handler()(scoped.call())).result.items);
});
test('contract, subaward, vehicle and forecast rows retain exact nullable/scalar domains',async()=>{
 const contract=storedCase(ids[0]),out=JSON.parse(await contract.handler()(contract.call()));assert.equal(out.result.items[0].amount,100.0001);assert.equal(out.result.items[0].baseAwardSignedDate,null);
 const vehicle=storedCase(ids[2]);assert.equal(JSON.parse(await vehicle.handler()(vehicle.call())).result.items[0].relationship,'parent');
 const forecast=storedCase(ids[3]);assert.equal(JSON.parse(await forecast.handler()(forecast.call())).result.items[0].active,null);assert.equal(Object.hasOwn(forecast.page.items[0],'amount'),false);
 for(const [id,mutation] of [[ids[0],p=>p.items[0].source='tango'],[ids[1],p=>p.items[0].amount={raw:100}],[ids[2],p=>p.items[0].relationship='subsidiary'],[ids[3],p=>p.items[0].amount=500]]){
  const f=storedCase(id);f.state.resultMutator=mutation;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
});
test('federal pagination preserves source count claims while enforcing continuation and page ceiling',async()=>{
 const f=storedCase(ids[0],{request:{page:10000,limit:25}});f.state.page={...f.page,total:999999,hasMore:true,nextPage:null,paginationLimitReached:true};
 const out=JSON.parse(await f.handler()(f.call()));assert.equal(out.result.total,999999);assert.equal(out.result.items.length,1);assert.equal(out.result.nextPage,null);assert.equal(out.result.paginationLimitReached,true);
 for(const mutate of [p=>p.nextPage=10001,p=>p.paginationLimitReached=false,p=>p.page=1]){f.state.resultMutator=mutate;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});}
 const next=storedCase(ids[1],{request:{page:2}});next.state.page={...next.page,hasMore:true,nextPage:3,paginationLimitReached:false};assert.equal(JSON.parse(await next.handler()(next.call())).result.nextPage,3);
 next.state.resultMutator=p=>p.nextPage=4;await assert.rejects(next.handler()(next.call()),{message:'INVALID_RESULT'});
});
test('district market keeps state-only subawards separate and future opportunities out of awarded money',async()=>{
 const f=storedCase(ids[4]);f.state.page={...f.page,stateSubawards:[{state:'NY',subawardCount:1,subawardAmount:80,geographyBasis:'source_state_place_of_performance'}],futureSignalsAvailability:'available'};
 const out=JSON.parse(await f.handler()(f.call()));assert.equal(out.result.districts[0].contractAmount,100);assert.equal(out.result.stateSubawards[0].subawardAmount,80);assert.equal(out.result.futureSignals[0].geographyBasis,'state_text');assert.equal(out.result.awardedMoneyIncludesFutureOpportunities,false);
 for(const mutate of [p=>p.awardedMoneyIncludesFutureOpportunities=true,p=>p.districts[0].district='98',p=>p.stateSubawards[0].geographyBasis='district',p=>p.futureSignals[0].source='awarded']){
  f.state.resultMutator=mutate;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
});
test('district market optional rails distinguish absent available-empty and unavailable without invented defaults',async()=>{
 const f=storedCase(ids[4]);let out=JSON.parse(await f.handler()(f.call())).result;assert.equal(Object.hasOwn(out,'stateSubawards'),false);assert.equal(Object.hasOwn(out,'futureSignalsAvailability'),false);
 f.state.page={...f.page,futureSignals:[],futureSignalsAvailability:'available',stateSubawards:[]};out=JSON.parse(await f.handler()(f.call())).result;assert.equal(out.futureSignalsAvailability,'available');assert.deepEqual(out.stateSubawards,[]);
 f.state.page={...f.page,futureSignals:[],futureSignalsAvailability:'unavailable',warnings:['Synthetic future rail unavailable']};out=JSON.parse(await f.handler()(f.call())).result;assert.equal(out.futureSignalsAvailability,'unavailable');assert.equal(out.districts.length,1);
});
test('market receiving preserves declared opaque clock strings without freshness claims or date rewriting',async()=>{
 const f=storedCase(ids[0]);f.state.resultMutator=p=>{p.generatedAt='source-generated-label';p.asOf='source-as-of-label';p.items[0].actionDate='stored source date';};
 const out=JSON.parse(await f.handler()(f.call()));assert.equal(out.result.generatedAt,'source-generated-label');assert.equal(out.result.asOf,'source-as-of-label');assert.equal(out.result.items[0].actionDate,'stored source date');
 f.state.resultMutator=p=>p.sourceFresh=true;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
});
test('native evidence-accuracy dates extension is preserved by the declared open contract-award row',async()=>{
 const f=storedCase(ids[0]);f.state.resultMutator=p=>p.items[0].dates={latestActionDate:null,baseAwardSignedDate:null,sourceLastModifiedDate:null,popStartDate:null,popEndDate:null,capiroSyncedAt:null,semantics:'Source date semantics'};
 const out=JSON.parse(await f.handler()(f.call()));assert.deepEqual(out.result.items[0].dates,f.state.nativeValue.items[0].dates);assert.equal(Object.hasOwn(out.result,'sourceFresh'),false);
});
test('market integer geography and unsupported vehicle fiscal-year requests stay closed',async()=>{
 for(const [id,request] of [[ids[0],{page:'2'}],[ids[1],{limit:'2'}],[ids[2],{fiscalYear:2026}],[ids[3],{fiscalYear:2201}],[ids[4],{state:'NY',district:1}]]){
  const f=storedCase(id);await assert.rejects(f.handler()({...f.call(),request}),{message:'INVALID_ARGUMENTS'});assert.equal(f.wire.length,0);
 }
});
test('market oversized source HTTP errors and expired/aborted calls release no result',async()=>{
 const f=storedCase();await assert.rejects(f.handler({maxResponseBytes:16})(f.call()),{message:'RESOURCE_LIMIT'});
 const error=storedCase();error.state.responseFactory=()=>Response.json({error:'PRIVATE'},{status:403});await assert.rejects(error.handler()(error.call()),{message:'INVALID_RESULT'});
 const late=storedCase();late.state.now=late.authority.deadlineMs;await assert.rejects(late.handler()(late.call()),{message:'DEADLINE'});assert.equal(late.wire.length,0);
 const abort=storedCase();await assert.rejects(abort.handler()({...abort.call(),signal:AbortSignal.abort()}),{message:'CANCELLED'});assert.equal(abort.wire.length,0);
});
test('market construction rejects foreign duplicated and wrong-version references',()=>{
 const f=storedCase();for(const operations of [[],[f.operation,f.operation],[{id:'list_members',version:'0.2.0'}],[{id:ids[0],version:'0.1.0'}]])
  assert.throws(()=>createFederalMarketHandlers({...f.transport,now:f.now},operations),{message:'GATEWAY_CONFIGURATION'});
});
