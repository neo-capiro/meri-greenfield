import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {storedCase,clientId,facility} from './fixture.mjs';

test('facility native flat DTO is wrapped with current Meri lineage and original request proof',async()=>{
 const f=storedCase(),call=f.call(),out=JSON.parse(await f.handler()(call)),[wire]=f.wire;
 assert.deepEqual(out.result,{binding:f.authority.binding,subject:f.authority.subject,data:f.page});
 assert.equal(wire.url,'https://native-core.example.invalid/api/clio/tools/get_representation');assert.equal(wire.options.method,'POST');assert.deepEqual(wire.body,f.arguments);
 assert.equal(f.credentialCalls[0].requestSha256,hash(f.arguments));assert.equal(out.argumentsSha256,call.argumentsSha256);
 assert.deepEqual(f.credentialCalls[0].normalizationContext,{binding:f.authority.binding,subject:f.authority.subject});
 assert.equal(wire.options.headers['x-internal-service-secret'],'SYNTHETIC_INTERNAL_SERVICE');assert.equal(wire.options.redirect,'error');assert.equal(wire.options.credentials,'omit');
});
test('facility current client, context, actor decision and source substitutions stop before credentials',async()=>{
 for(const mutate of [c=>c.request.clientId='88888888-8888-4888-8888-888888888888',c=>c.normalizationContext={...c.normalizationContext,binding:{...c.normalizationContext.binding,writerFence:2}},c=>c.authority.decision.operation='list_members@0.2.0',c=>c.authority.decision.actor.actorId='other',c=>c.authority.sourceIds=[],c=>c.authority.claims.actions=[]]){
  const f=storedCase(),call=structuredClone(f.call());mutate(call);await assert.rejects(f.handler()(call));assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
 }
 const f=storedCase();await assert.rejects(f.handler()({...f.call(),request:{clientId,authorized:true}}),{message:'INVALID_ARGUMENTS'});assert.equal(f.wire.length,0);
});
test('facility raw clipping is performed by Core once and exact stored state remains required',async()=>{
 const request={clientId:` ${clientId} `,state:' ca-extra '},f=storedCase(undefined,{request});
 const out=JSON.parse(await f.handler()(f.call()));assert.equal(out.result.data.facilities[0].state,'CA');assert.deepEqual(f.wire[0].body,request);
 f.state.resultMutator=p=>p.facilities[0].state='ca';await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
});
test('missing client and empty facilities remain distinct precise native refusals',async()=>{
 const missing=storedCase(undefined,{request:{state:'CA'}});const out=JSON.parse(await missing.handler()(missing.call()));assert.equal(out.result.data.note,'Provide a client UUID.');assert.deepEqual(missing.wire[0].body,{state:'CA'});
 const empty=storedCase(undefined,{request:{clientId,state:'CA'}});empty.state.page={...empty.page,facilities:[],note:'No facilities found for this client in CA — say so explicitly, do not guess a representative.'};
 assert.deepEqual(JSON.parse(await empty.handler()(empty.call())).result.data,empty.state.page);
 empty.state.resultMutator=p=>p.note='No representatives exist';await assert.rejects(empty.handler()(empty.call()),{message:'INVALID_RESULT'});
});
test('facility no_state no_geocode and nullable representation slots preserve distinct source outcomes',async()=>{
 for(const [state,reason] of [[null,'no_state'],['','no_state'],['CA','no_geocode']]){
  const f=storedCase();f.state.page={...f.page,facilities:[{...facility(),state,representation:{unresolved:true,reason}}]};
  const out=JSON.parse(await f.handler()(f.call()));assert.deepEqual(out.result.data.facilities[0].representation,{unresolved:true,reason});
  f.state.resultMutator=p=>p.facilities[0].representation.reason=reason==='no_state'?'no_geocode':'no_state';await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
});
test('facility rejects forged native lineage, duplicated identities and chamber/state substitution',async()=>{
 const federal={bioguideId:'A000001',fullName:'Synthetic senator',party:null,state:'California',district:null,chamber:'senate'};
 for(const mutate of [p=>p.binding={foreign:true},p=>p.subject={foreign:true},p=>p.facilities.push({...p.facilities[0]}),p=>p.facilities[0].representation.federal.house=federal,p=>p.facilities[0].representation.state.lower={id:'one',name:'Synthetic',state:'NY',chamber:'lower',district:null,party:null,url:null},p=>p.complete=true]){
  const f=storedCase();f.state.resultMutator=mutate;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
});
test('facility source failures, oversized output and post-source cancellation release nothing',async()=>{
 const f=storedCase();f.state.responseFactory=()=>Response.json({error:'PRIVATE'},{status:403});await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 const large=storedCase();await assert.rejects(large.handler({maxResponseBytes:16})(large.call()),{message:'RESOURCE_LIMIT'});
 const late=storedCase(),abort=new AbortController();late.state.afterSource=()=>abort.abort();await assert.rejects(late.handler()({...late.call(),signal:abort.signal}),{message:'CANCELLED'});
});
