/** Fixed native HTTP with typed global rows; no SQL execution, database grants or audit persistence qualification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {publicDomainDatasetRegistry} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createPublicDomainQueryHandlers} from '../handler.mjs';
import {storedCase,id,nativeSql} from './fixture.mjs';

test('typed query uses fixed native POST and SQL-free receiving with original private correlation',async()=>{
 const f=storedCase(),call=f.call(),raw=await f.handler()(call),out=JSON.parse(raw),[wire]=f.wire,[proof]=f.credentialCalls;
 assert.equal(wire.url,'https://native-core.example.invalid/api/clio/tools/query_global_data');assert.equal(wire.options.method,'POST');assert.deepEqual(wire.body,f.arguments);
 assert.deepEqual(out,{binding:f.authority.binding,subject:f.authority.subject,operation:f.operation,argumentsSha256:call.argumentsSha256,result:f.page});
 assert.equal(wire.options.headers.authorization,'Bearer SYNTHETIC_NATIVE_USER');assert.equal(wire.options.headers['x-internal-service-secret'],'SYNTHETIC_INTERNAL_SERVICE');
 assert.equal(wire.options.redirect,'error');assert.equal(wire.options.credentials,'omit');assert.equal(wire.options.cache,'no-store');
 assert.equal(proof.requestSha256,canonicalSha256(f.arguments));assert.equal(proof.argumentsSha256,call.argumentsSha256);assert.deepEqual(proof.normalizationContext,{defaultAsOf:null});
 assert.equal(f.state.nativeValue.sql,nativeSql);assert.equal(Object.hasOwn(out.result,'sql'),false);assert.equal(raw.includes(nativeSql),false);assert.equal(Object.hasOwn(wire.body,'snapshotSha256'),false);
});
test('all twelve canonical datasets and eighty-eight typed fields cross fixed native JSON receiving',async()=>{
 let fieldCount=0;const datasets=publicDomainDatasetRegistry.listDatasetMetadata();assert.equal(datasets.length,12);
 for(const dataset of datasets){
  for(let offset=0;offset<dataset.fields.length;offset+=12){
   const fields=dataset.fields.slice(offset,offset+12);fieldCount+=fields.length;
   const f=storedCase(id,{request:{dataset:dataset.key,select:fields.map(field=>({field:field.name}))}}),out=JSON.parse(await f.handler()(f.call()));
   assert.deepEqual(out.result,f.page);assert.equal(Object.hasOwn(f.wire[0].body,'asOfDate'),dataset.supportsAsOf);assert.equal(Object.hasOwn(out.result,'sql'),false);
  }
 }
 assert.equal(fieldCount,88);
});
test('omitted supported as-of is fixed to the captured context while original request and hashes remain unchanged',async()=>{
 const request={dataset:'lda_registrations',select:[{agg:'count'}]},defaultAsOf='2026-10-11T12:34:56.789Z',f=storedCase(id,{request,defaultAsOf}),call=f.call(),saved=structuredClone(request);
 f.state.now+=50;const out=JSON.parse(await f.handler()(call)),[wire]=f.wire,[proof]=f.credentialCalls;
 assert.deepEqual(wire.body,{...request,asOfDate:defaultAsOf});assert.deepEqual(request,saved);assert.equal(call.input.asOfDate,defaultAsOf);
 assert.equal(proof.requestSha256,canonicalSha256(request));assert.notEqual(proof.requestSha256,canonicalSha256(wire.body));assert.deepEqual(proof.normalizationContext,{defaultAsOf});assert.equal(out.argumentsSha256,call.argumentsSha256);
});
test('explicit supported as-of preserves raw selector and does not capture or substitute a default',async()=>{
 const request={dataset:'lda_registrations',select:[{agg:'count'}],asOfDate:'January 1, 2020'},f=storedCase(id,{request});
 await f.handler()(f.call());assert.deepEqual(f.wire[0].body,request);assert.equal(f.call().input.asOfDate,'2020-01-01T00:00:00.000Z');assert.deepEqual(f.normalizationContext,{defaultAsOf:null});
});
test('unsupported datasets neither receive a null as-of nor accept an invented trusted default',async()=>{
 const f=storedCase();await f.handler()(f.call());assert.equal(Object.hasOwn(f.wire[0].body,'asOfDate'),false);
 const g=storedCase(),call=g.call();for(const normalizationContext of [{defaultAsOf:g.page.generatedAt},{}, {defaultAsOf:null,actorId:'other'}])await assert.rejects(g.handler()({...call,normalizationContext}),{message:'INVALID_ARGUMENTS'});
 await assert.rejects(g.handler()({...call,request:{...g.arguments,asOfDate:g.page.generatedAt}}),{message:'INVALID_ARGUMENTS'});assert.equal(g.credentialCalls.length,0);assert.equal(g.wire.length,0);
});
test('supported default observations are mandatory, canonical and argument-hash bound before native credentials',async()=>{
 const f=storedCase(id,{request:{dataset:'lda_registrations',select:[{agg:'count'}]}}),call=f.call();
 for(const normalizationContext of [{defaultAsOf:null},{defaultAsOf:'2026-10-12T01:00:00Z'},{defaultAsOf:'2026-02-30T00:00:00.000Z'},{defaultAsOf:'2026-10-11T00:00:00.000Z'}])await assert.rejects(f.handler()({...call,normalizationContext}),{message:'INVALID_ARGUMENTS'});
 assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
});
test('query limit, aggregate aliases, grouping and original filter selectors reach only the existing compiler',async()=>{
 const request={dataset:'federal_grants',select:[{field:'agency'},{agg:'count'}],groupBy:['agency'],filters:[{field:'open_date',op:'gte',value:'2026-01-01'}],orderBy:[{field:'count_all',direction:'DESC'}],limit:'5.9'},f=storedCase(id,{request});
 const out=JSON.parse(await f.handler()(f.call()));assert.deepEqual(f.wire[0].body,request);assert.equal(f.call().input.limit,5);assert.equal(f.call().input.orderBy[0].direction,'asc');assert.equal(f.call().input.filters[0].value,'2026-01-01T00:00:00.000Z');assert.deepEqual(Object.keys(out.result.rows[0]),['agency','count_all']);
});
test('typed query forbids model SQL, physical names, authority and unknown dataset or field selections',async()=>{
 const f=storedCase(),call=f.call();for(const request of [{...f.arguments,sql:'SELECT private'},{...f.arguments,table:'tenant_client'},{...f.arguments,tenantId:'other'},{...f.arguments,defaultAsOf:f.page.generatedAt},{dataset:'tenant_clients',select:[{agg:'count'}]},{...f.arguments,select:[{field:'agency;DROP TABLE x'}]},{...f.arguments,select:[{field:'agency',alias:'sql'}]}])await assert.rejects(f.handler()({...call,request}),{message:'INVALID_ARGUMENTS'});
 assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
});
test('native numeric strings, unsafe count integers and nullable aggregate values preserve precision',async()=>{
 for(const [select,row] of [[[{agg:'count'}],{count_all:'9007199254740992'}],[[{field:'award_ceiling'}],{award_ceiling:'9007199254740993'}],[[{field:'award_ceiling',agg:'sum'}],{sum_award_ceiling:null}]]){
  const f=storedCase(id,{request:{dataset:'federal_grants',select}});f.state.resultMutator=p=>p.rows=[row];const out=JSON.parse(await f.handler()(f.call()));assert.deepEqual(out.result.rows,[row]);
 }
});
test('native dates, booleans and nullable text arrays cross actual JSON without inferred completeness',async()=>{
 const f=storedCase(id,{request:{dataset:'news_articles',select:[{field:'published_at'},{field:'topics'}]}});f.state.resultMutator=p=>{p.generatedAt=new Date(f.now());p.rows=[{published_at:new Date(f.now()),topics:['same',null,'same']}];};
 let out=JSON.parse(await f.handler()(f.call()));assert.deepEqual(out.result.rows,[{published_at:new Date(f.now()).toISOString(),topics:['same',null,'same']}]);assert.equal(Object.hasOwn(out.result,'complete'),false);
 const g=storedCase(id,{request:{dataset:'sam_opportunities',select:[{field:'active'}]}});out=JSON.parse(await g.handler()(g.call()));assert.equal(out.result.rows[0].active,false);
});
test('whole-row truncation keeps pre-truncation row count and exact native disclosure',async()=>{
 for(const rows of [[],[{agency:'Synthetic'}]]){
  const f=storedCase();f.state.page={...f.nativePage,rowCount:2,rows,truncated:true,note:`Only the first ${rows.length} of 2 rows are shown; add filters, group, or lower limit to see the rest.`};
  const out=JSON.parse(await f.handler()(f.call()));assert.equal(out.result.rowCount,2);assert.deepEqual(out.result.rows,rows);assert.equal(out.result.truncated,true);assert.equal(Object.hasOwn(out.result,'sql'),false);
 }
});
test('native query errors remain explicit errors without claims about source health or persisted audits',async()=>{
 const f=storedCase();f.state.page={tool:id,generatedAt:f.page.generatedAt,ok:false,error:'The query could not be run.'};const out=JSON.parse(await f.handler()(f.call()));assert.deepEqual(out.result,f.state.page);
 const {metadata}=f.contract.normalizeInput(f.arguments,f.normalizationContext);for(const key of ['sourceConnected','queryAuthorized','producerQualified','absenceEvidence','auditWriteQualified','sqlExposed'])assert.equal(metadata[key],false);
 assert.equal(Object.hasOwn(out.result,'rows'),false);assert.equal(Object.hasOwn(out.result,'rowCount'),false);
});
test('native success must contain a string SQL field and precisely the known source keys before projection',async()=>{
 for(const mutate of [p=>delete p.sql,p=>p.sql=null,p=>p.sql=1,p=>p.sql='',p=>p.params=['PRIVATE'],p=>p.sourceConnected=true,p=>p.extra='value']){
  const f=storedCase();f.state.resultMutator=mutate;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
});
test('SQL projection cannot hide malformed frozen rows, aliases, counts, truncation or foreign envelopes',async()=>{
 for(const mutate of [p=>p.rows=[{agency:1}],p=>p.rows=[{other:'Synthetic'}],p=>p.dataset='sec_filings',p=>p.rowCount=3,p=>p.rows=[],p=>p.truncated=true,p=>p.tool='list_global_datasets',p=>p.generatedAt='2026-02-30T00:00:00.000Z']){
  const f=storedCase();f.state.resultMutator=mutate;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
 const f=storedCase();f.state.page={tool:id,generatedAt:f.page.generatedAt,ok:false,error:'failed',sql:nativeSql};await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
});
test('query current operation, tenant, source and scopes precede native credential acquisition',async()=>{
 for(const mutate of [a=>a.decision.operation='list_global_datasets@0.2.0',a=>a.decision.decision='denied',a=>a.decision.scopes=[],a=>a.claims.binding.tenantId='other',a=>a.claims.actions=[],a=>a.sourceIds=['other']]){
  const f=storedCase(),call=structuredClone(f.call());mutate(call.authority);await assert.rejects(f.handler()(call));assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
 }
});
test('query credential context substitution, bounded raw response and post-source cancellation withhold results',async()=>{
 const f=storedCase();f.state.credentialMutator=p=>p.normalizationContext={defaultAsOf:f.page.generatedAt};await assert.rejects(f.handler()(f.call()),{message:'ACCESS_DENIED'});assert.equal(f.wire.length,0);
 const g=storedCase();g.state.resultMutator=p=>p.sql='x'.repeat(4096);await assert.rejects(g.handler({maxResponseBytes:1024})(g.call()),{message:'RESOURCE_LIMIT'});
 const h=storedCase(),controller=new AbortController();h.state.afterSource=()=>controller.abort();await assert.rejects(h.handler()({...h.call(),signal:controller.signal}),{message:'CANCELLED'});
 const j=storedCase();j.state.afterSource=()=>j.state.now=j.authority.deadlineMs;await assert.rejects(j.handler()(j.call()),{message:'DEADLINE'});
});
test('query constructor refuses foreign operations, duplicates and wrong versions without effects',()=>{
 const f=storedCase();for(const operations of [[],[f.operation,f.operation],[{id:'query_intelligence',version:'0.2.0'}],[{id,version:'0.1.0'}]])assert.throws(()=>createPublicDomainQueryHandlers({...f.transport,now:f.now},operations));assert.equal(f.wire.length,0);
});
