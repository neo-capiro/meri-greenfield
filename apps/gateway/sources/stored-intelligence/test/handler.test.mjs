/** Real Response JSON receiving over synthetic native stored records; no live source qualification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {createStoredIntelligenceHandlers} from '../handler.mjs';
import {storedCase,id} from './fixture.mjs';

test('fixed article POST sends original flat request with exact private correlation and native credentials',async()=>{
 const request={query:' Stored ',source:' synthetic-source ',limit:1},f=storedCase(id,{request}),call=f.call(),out=JSON.parse(await f.handler()(call)),[wire]=f.wire,[proof]=f.credentialCalls;
 assert.deepEqual(out,{binding:f.authority.binding,subject:f.authority.subject,operation:f.operation,argumentsSha256:call.argumentsSha256,result:f.page});
 assert.equal(wire.url,'https://native-core.example.invalid/api/clio/tools/search_intel_articles');assert.equal(wire.options.method,'POST');assert.deepEqual(wire.body,request);
 assert.equal(wire.options.headers.authorization,'Bearer SYNTHETIC_NATIVE_USER');assert.equal(wire.options.headers['x-internal-service-secret'],'SYNTHETIC_INTERNAL_SERVICE');
 assert.equal(wire.options.redirect,'error');assert.equal(wire.options.credentials,'omit');assert.equal(wire.options.cache,'no-store');
 assert.equal(proof.requestSha256,canonicalSha256(request));assert.equal(proof.argumentsSha256,call.argumentsSha256);assert.deepEqual(proof.normalizationContext,{});
 assert.equal(Object.hasOwn(out.result,'complete'),false);assert.equal(Object.hasOwn(out,'bearerToken'),false);
});
test('native article Date values cross JSON while nullable and opaque stored projections are preserved',async()=>{
 const f=storedCase();f.state.resultMutator=p=>{p.generatedAt=new Date(f.now());p.data[0].publishedAt=new Date(f.now());p.data[0].url='not a validated URL';p.data[0].categories=['','same','same'];};
 const {result}=JSON.parse(await f.handler()(f.call()));assert.equal(result.generatedAt,new Date(f.now()).toISOString());assert.equal(result.data[0].publishedAt,result.generatedAt);
 assert.equal(result.data[0].author,null);assert.equal(result.data[0].url,'not a validated URL');assert.deepEqual(result.data[0].categories,['','same','same']);
});
test('raw source clipping occurs once and exact stored-source receiving rejects substitution',async()=>{
 const source='S'.repeat(59)+' x',f=storedCase(id,{request:{source}});assert.equal(f.call().input.source,'S'.repeat(59)+' ');
 await f.handler()(f.call());assert.equal(f.wire[0].body.source,source);
 f.state.resultMutator=p=>p.data[0].source='S'.repeat(59);await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
});
test('separate native count may race below rows or above an empty page without proving absence',async()=>{
 const f=storedCase();f.state.resultMutator=p=>p.total=0;let out=JSON.parse(await f.handler()(f.call()));assert.equal(out.result.data.length,1);assert.equal(out.result.total,0);
 f.state.page={...f.page,total:40,data:[]};f.state.resultMutator=undefined;out=JSON.parse(await f.handler()(f.call()));assert.deepEqual(out.result.data,[]);assert.equal(out.result.total,40);
 const {metadata}=f.contract.normalizeInput(f.arguments,{});for(const key of ['absenceEvidence','sourceConnected','producerQualified'])assert.equal(metadata[key],false);
});
test('article receiving rejects duplicate identities, ordering, over-limit rows and unprojected authority',async()=>{
 for(const mutate of [p=>p.data.push({...p.data[0]}),p=>p.data.push({...p.data[0],id:'other'}),p=>p.data[0].summary='x'.repeat(401),p=>p.data[0].title=' leading',p=>p.data[0].fullText='private',p=>p.complete=true,p=>p.tool='query_intelligence']){
  const f=storedCase();f.state.resultMutator=mutate;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
 const f=storedCase(id,{request:{limit:2}});f.state.resultMutator=p=>p.data.push({...p.data[0],id:'newer',publishedAt:new Date(f.now()+1)});await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
});
test('article request and context authority injection fail before native credentials',async()=>{
 const f=storedCase(),call=f.call();
 for(const request of [{...f.arguments,tenantId:'other'},{limit:'1'},{limit:0},{page:2},{query:3}])await assert.rejects(f.handler()({...call,request}),{message:'INVALID_ARGUMENTS'});
 await assert.rejects(f.handler()({...call,normalizationContext:{actorId:'other'}}),{message:'INVALID_ARGUMENTS'});
 await assert.rejects(f.handler()({...call,argumentsSha256:'0'.repeat(64)}),{message:'INVALID_ARGUMENTS'});assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
});
test('article operation decision, tenant and source authority cannot be substituted',async()=>{
 for(const change of [a=>a.decision.operation='query_intelligence@0.2.0',a=>a.decision.decision='denied',a=>a.decision.actor.actorId='other',a=>a.claims.binding.tenantId='other',a=>a.sourceIds=['other'],a=>a.claims.actions=[]]){
  const f=storedCase(),call=structuredClone(f.call());change(call.authority);await assert.rejects(f.handler()(call));assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
 }
});
test('article credential revocation, transport ceilings and post-source cancellation withhold results',async()=>{
 const f=storedCase();f.state.credentialMutator=r=>r.serviceSecret=null;await assert.rejects(f.handler()(f.call()),{message:'ACCESS_DENIED'});assert.equal(f.wire.length,0);
 const g=storedCase();await assert.rejects(g.handler({maxResponseBytes:16})(g.call()),{message:'RESOURCE_LIMIT'});
 const h=storedCase(),controller=new AbortController();h.state.afterSource=()=>controller.abort();await assert.rejects(h.handler()({...h.call(),signal:controller.signal}),{message:'CANCELLED'});
});
test('article native failures and noncanonical dates fail closed',async()=>{
 for(const response of [()=>Response.json({error:'PRIVATE'}),()=>Response.json({},{status:403}),p=>Response.json({...p,generatedAt:'2026-02-30T00:00:00.000Z'})]){
  const f=storedCase();f.state.responseFactory=response;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
});
test('article constructor refuses foreign, duplicate and wrong-version operation mappings',()=>{
 const f=storedCase();for(const operations of [[],[f.operation,f.operation],[{id:'query_intelligence',version:'0.2.0'}],[{id,version:'0.1.0'}]])assert.throws(()=>createStoredIntelligenceHandlers({...f.transport,now:f.now},operations));assert.equal(f.wire.length,0);
});
