import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {storedCase,ids,clientId,at,change} from './fixture.mjs';

for(const id of ids){
 test(`${id}: exact raw native POST with current Meri lineage and unchanged proof`,async()=>{
  const f=storedCase(id),call=f.call(),out=JSON.parse(await f.handler()(call)),[wire]=f.wire;
  assert.deepEqual(out.result,{binding:f.authority.binding,subject:f.authority.subject,data:f.page});assert.equal(out.argumentsSha256,call.argumentsSha256);
  assert.equal(wire.url,`https://native-core.example.invalid/api/clio/tools/${id}`);assert.equal(wire.options.method,'POST');assert.deepEqual(wire.body,f.arguments);
  assert.equal(f.credentialCalls[0].requestSha256,hash(f.arguments));assert.deepEqual(f.credentialCalls[0].normalizationContext,f.normalizationContext);
 });
 test(`${id}: foreign subject/context grants and source mismatch cannot reach credentials`,async()=>{
  for(const mutate of [c=>c.request.clientId='foreign',c=>c.normalizationContext={...c.normalizationContext,binding:{...c.normalizationContext.binding,writerFence:2}},c=>c.authority.decision.decision='denied',c=>c.authority.decision.operation='list_members@0.2.0',c=>c.authority.decision.scopes=[],c=>c.authority.sourceIds=[]]){
   const f=storedCase(id),call=structuredClone(f.call());mutate(call);await assert.rejects(f.handler()(call));assert.equal(f.wire.length,0);assert.equal(f.credentialCalls.length,0);
  }
 });
 test(`${id}: feature-disabled native response remains closed and bound to selected client`,async()=>{
  const f=storedCase(id);f.state.page={available:false,reason:'feature_disabled'};
  const out=JSON.parse(await f.handler()(f.call()));assert.deepEqual(out.result.data,{available:false,reason:'feature_disabled'});assert.deepEqual(out.result.subject.entityIds,[clientId]);
  f.state.resultMutator=p=>p.available=true;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 });
 test(`${id}: selector changes native fake lineage and unsupported completeness are refused`,async()=>{
  for(const mutate of [p=>p.clientId='foreign',p=>p.state='CA',p=>p.district='09',p=>p.binding={foreign:true},p=>p.complete=true]){
   const f=storedCase(id);f.state.resultMutator=mutate;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
  }
 });
}
test('District context preserves requested zero dollars and uncertain coverage without inventing a client nexus',async()=>{
 const f=storedCase(ids[0],{request:{clientId:` ${clientId} `,state:' fl ',district:' 08 '}}),out=JSON.parse(await f.handler()(f.call()));
 assert.equal(out.result.data.facts[0].value,0);assert.equal(out.result.data.facts[0].amountStage,'requested');assert.equal(out.result.data.facts[0].basis,'public_context');assert.equal(out.result.data.facts[0].coverage,'unknown');
 assert.equal(out.result.data.facts[0].freshness.unavailable,true);assert.deepEqual(f.wire[0].body,f.arguments);
 for(const mutate of [p=>p.facts[0].geography.district='09',p=>p.facts[0].geography={...p.facts[0].geography,scope:'district',district:null},p=>p.facts[0].amountStage='spent']){
  f.state.resultMutator=mutate;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
});
test('District context 29 original gaps with truncated false remains source behavior',async()=>{
 const f=storedCase();f.state.page={...f.page,facts:[],gaps:Array.from({length:29},()=>({section:'footprint',reason:'Synthetic gap',source:null})),truncated:false};
 const out=JSON.parse(await f.handler()(f.call()));assert.equal(out.result.data.gaps.length,29);assert.equal(out.result.data.truncated,false);
 f.state.resultMutator=p=>p.gaps.push(p.gaps[0]);await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
});
test('District changes preserve inclusive since, descending observations and exact twenty-row truncation',async()=>{
 const request={clientId,state:'FL',district:'08',since:'2026-10-11T21:00:00-04:00'},f=storedCase(ids[1],{request});
 const out=JSON.parse(await f.handler()(f.call()));assert.equal(out.result.data.changes[0].observedAt,at);assert.equal(f.call().input.since,at);assert.deepEqual(f.wire[0].body,request);
 f.state.page={...f.page,changes:Array.from({length:20},change),truncated:true};assert.equal(JSON.parse(await f.handler()(f.call())).result.data.changes.length,20);
 for(const mutate of [p=>p.truncated=false,p=>p.changes[0].observedAt='2026-10-11T00:00:00.000Z',p=>p.changes[1].observedAt='2026-10-13T00:00:00.000Z',p=>p.changes[0].oldValue='PRIVATE']){
  f.state.resultMutator=mutate;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
});
test('District unavailable change ledger is an explicit gap and cannot supply history',async()=>{
 const f=storedCase(ids[1]);f.state.page={...f.page,changes:[],gaps:[{section:'changes',reason:'Change ledger unavailable',source:'district_nexus_change'}]};
 const out=JSON.parse(await f.handler()(f.call()));assert.deepEqual(out.result.data.changes,[]);assert.equal(out.result.data.gaps[0].reason,'Change ledger unavailable');
 f.state.resultMutator=p=>p.changes=[change()];await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
});
test('District cancellation and bounded source failure withhold complete native bytes',async()=>{
 const f=storedCase();await assert.rejects(f.handler()({...f.call(),signal:AbortSignal.abort()}),{message:'CANCELLED'});assert.equal(f.wire.length,0);
 const short=storedCase();await assert.rejects(short.handler({maxResponseBytes:16})(short.call()),{message:'RESOURCE_LIMIT'});
 const bad=storedCase();bad.state.responseFactory=()=>Response.json({error:'PRIVATE'},{status:403});await assert.rejects(bad.handler()(bad.call()),{message:'INVALID_RESULT'});
});
