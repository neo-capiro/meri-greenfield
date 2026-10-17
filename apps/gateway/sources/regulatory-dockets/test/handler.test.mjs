/** Ordinary lists and bounded upcoming windows retain their distinct native semantics. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRegulatoryDocketsHandlers} from '../handler.mjs';
import {storedCase,id} from './fixture.mjs';

test('ordinary docket uses fixed native flat POST and receiving keeps every raw nullable field',async()=>{
 const request={agencyId:' Synthetic ',documentType:' Notice ',limit:1},f=storedCase(id,{request}),call=f.call(),out=JSON.parse(await f.handler()(call)),[wire]=f.wire;
 assert.equal(wire.url,'https://native-core.example.invalid/api/clio/tools/query_regulatory_dockets');assert.equal(wire.options.method,'POST');assert.deepEqual(wire.body,request);
 assert.deepEqual(out,{binding:f.authority.binding,subject:f.authority.subject,operation:f.operation,argumentsSha256:call.argumentsSha256,result:f.page});
 assert.equal(out.result.results[0].docketId,null);assert.equal(out.result.results[0].title,' Stored raw\n docket title ');assert.equal(Object.hasOwn(out.result,'windowDays'),false);
 assert.equal(wire.options.headers.authorization,'Bearer SYNTHETIC_NATIVE_USER');assert.equal(wire.options.headers['x-internal-service-secret'],'SYNTHETIC_INTERNAL_SERVICE');
});
test('native docket dates serialize through actual JSON without manufacturing a service as-of',async()=>{
 const f=storedCase(id,{request:{upcomingOnly:true,days:45,limit:1}});f.state.resultMutator=p=>{p.generatedAt=new Date(f.now());for(const k of ['postedDate','commentEndDate','syncedAt'])p.results[0][k]=new Date(f.now());};
 const out=JSON.parse(await f.handler()(f.call()));for(const k of ['postedDate','commentEndDate','syncedAt'])assert.equal(out.result.results[0][k],new Date(f.now()).toISOString());
 assert.equal(out.result.windowDays,45);assert.equal(Object.hasOwn(out.result,'asOf'),false);assert.equal(f.contract.normalizeInput(f.arguments,{}).metadata.currentWindowQualified,false);
});
test('upcoming branch ignores supplied ordinary selectors while binding its fetched count before wrapper limit',async()=>{
 const request={upcomingOnly:true,days:2,limit:1,agencyId:'Other',documentType:'Rule'},f=storedCase(id,{request});f.state.page={...f.page,total:3};
 const out=JSON.parse(await f.handler()(f.call()));assert.equal(out.result.results[0].agencyId,'Synthetic');assert.equal(out.result.results[0].documentType,'Notice');assert.equal(out.result.total,3);assert.equal(out.result.results.length,1);assert.deepEqual(f.wire[0].body,request);
});
test('ordinary separate count races and null dates do not create completeness or absence evidence',async()=>{
 const f=storedCase();f.state.resultMutator=p=>{p.total=0;p.results[0].postedDate=null;};let out=JSON.parse(await f.handler()(f.call()));assert.equal(out.result.total,0);assert.equal(out.result.results.length,1);
 f.state.page={...f.page,total:9,results:[]};f.state.resultMutator=undefined;out=JSON.parse(await f.handler()(f.call()));assert.deepEqual(out.result.results,[]);assert.equal(out.result.total,9);assert.equal(Object.hasOwn(out.result,'complete'),false);
 assert.equal(f.contract.normalizeInput(f.arguments,{}).metadata.absenceEvidence,false);
});
test('ordinary exact filters, clipping boundary and wrong-branch receiving are enforced',async()=>{
 const agencyId='A'.repeat(39)+' B',f=storedCase(id,{request:{agencyId}});await f.handler()(f.call());assert.equal(f.wire[0].body.agencyId,agencyId);assert.equal(f.page.results[0].agencyId,'A'.repeat(39)+' ');
 for(const mutate of [p=>p.results[0].agencyId='Other',p=>p.windowDays=30]){f.state.resultMutator=mutate;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});}
 const g=storedCase();g.state.resultMutator=p=>p.results[0].documentType='Rule';await assert.rejects(g.handler()(g.call()),{message:'INVALID_RESULT'});
});
test('upcoming receiving rejects window, count, withdrawn and missing-end-date substitution',async()=>{
 for(const mutate of [p=>p.windowDays=31,p=>delete p.windowDays,p=>p.total=51,p=>p.total=0,p=>p.results[0].withdrawn=true,p=>p.results[0].commentEndDate=null]){
  const f=storedCase(id,{request:{upcomingOnly:true}});f.state.resultMutator=mutate;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
});
test('ordinary descending and upcoming ascending date order reject foreign source sequencing',async()=>{
 for(const upcomingOnly of [false,true]){
  const f=storedCase(id,{request:{upcomingOnly,limit:2}});f.state.resultMutator=p=>{p.total=2;p.results.push({...p.results[0],id:'other',documentId:'other-doc',...(upcomingOnly?{commentEndDate:new Date(f.now())}:{postedDate:new Date(f.now()+1)})});};
  await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
});
test('docket duplicate identities, missing stored fields and invented coverage refuse',async()=>{
 for(const mutate of [p=>p.results.push({...p.results[0]}),p=>delete p.results[0].syncedAt,p=>p.results[0].syncedAt='2026-02-30T00:00:00.000Z',p=>p.complete=true,p=>p.results[0].tenantId='other']){
  const f=storedCase(id,{request:{limit:2}});f.state.resultMutator=mutate;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
});
test('docket selectors cannot inject authority or coerce branch and numeric limits',async()=>{
 const f=storedCase(),call=f.call();for(const request of [{actorId:'other'},{query:'term'},{page:2},{upcomingOnly:'true'},{limit:'1'},{days:0}])await assert.rejects(f.handler()({...call,request}),{message:'INVALID_ARGUMENTS'});
 await assert.rejects(f.handler()({...call,normalizationContext:{asOf:f.page.generatedAt}}),{message:'INVALID_ARGUMENTS'});assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
});
test('docket current operation and scope decisions precede credentials and expired bytes are withheld',async()=>{
 const f=storedCase(),call=structuredClone(f.call());call.authority.decision.operation='search_intel_articles@0.2.0';await assert.rejects(f.handler()(call),{message:'ACCESS_DENIED'});assert.equal(f.credentialCalls.length,0);
 const g=storedCase();g.state.afterSource=()=>g.state.now=g.authority.deadlineMs;await assert.rejects(g.handler()(g.call()),{message:'DEADLINE'});
});
test('docket constructor refuses arbitrary native tools, duplicates and old contracts',()=>{
 const f=storedCase();for(const operations of [[],[f.operation,f.operation],[{id:'get_state_rule_status',version:'0.2.0'}],[{id,version:'0.1.0'}]])assert.throws(()=>createRegulatoryDocketsHandlers({...f.transport,now:f.now},operations));assert.equal(f.wire.length,0);
});
