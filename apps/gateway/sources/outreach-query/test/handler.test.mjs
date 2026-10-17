/** Real bounded native JSON over synthetic campaign rows; no campaign/detail action or native grant qualification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {captureOutreachListClientSelection} from '../request-context.mjs';
import {createOutreachQueryHandlers} from '../handler.mjs';
import {storedCase,id,clientId} from './fixture.mjs';
const otherClient='b1234567-b123-4c12-8d12-e123456789ab';

test('explicit client list uses fixed original native POST and exact private receiving carrier',async()=>{
 const f=storedCase(),call=f.call(),out=JSON.parse(await f.handler()(call)),[wire]=f.wire,[proof]=f.credentialCalls;
 assert.equal(wire.url,'https://native-core.example.invalid/api/clio/tools/query_outreach');assert.equal(wire.options.method,'POST');assert.deepEqual(wire.body,f.arguments);
 assert.deepEqual(out,{binding:f.authority.binding,subject:f.authority.subject,operation:f.operation,argumentsSha256:call.argumentsSha256,result:f.page});
 assert.equal(wire.options.headers.authorization,'Bearer SYNTHETIC_NATIVE_USER');assert.equal(wire.options.headers['x-internal-service-secret'],'SYNTHETIC_INTERNAL_SERVICE');
 assert.equal(wire.options.redirect,'error');assert.equal(wire.options.credentials,'omit');assert.equal(wire.options.cache,'no-store');
 assert.equal(proof.requestSha256,canonicalSha256(f.arguments));assert.deepEqual(proof.normalizationContext,f.normalizationContext);assert.equal(Object.hasOwn(out.result,'record'),false);
});
test('client UUID capture preserves native trim/clip/trim and case while the raw request is sent unchanged',async()=>{
 const rawClient=clientId.toUpperCase()+' '.repeat(44)+'ignored-after-native-cap',status='s'.repeat(39)+' t',request={clientId:rawClient,status,limit:'2.9'},f=storedCase(id,{request});
 assert.deepEqual(captureOutreachListClientSelection(request),{reference:clientId.toUpperCase(),clientId});
 const out=JSON.parse(await f.handler()(f.call()));assert.deepEqual(f.wire[0].body,request);assert.equal(f.call().input.status,'s'.repeat(39));assert.equal(f.call().input.limit,2);assert.equal(out.result.campaigns[0].clientId,clientId);
});
test('any own outreachId property refuses detail and malformed/empty fallback before credentials',async()=>{
 for(const outreachId of [clientId,'not-a-uuid','', '   ',null]){
  const f=storedCase(),request={clientId,outreachId},context=typeof outreachId==='string'&&outreachId.trim()?{clientResolution:null}:f.normalizationContext;
  assert.throws(()=>captureOutreachListClientSelection(request),{message:'UNAVAILABLE'});
  await assert.rejects(f.handler()(f.call(request,f.authority,context)),{message:'UNAVAILABLE'});assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
 }
});
test('unscoped, blank and null client list selectors refuse before credentials',async()=>{
 for(const request of [{},{clientId:null},{clientId:''},{clientId:'  '}]){
  const f=storedCase(),reference=request.clientId?.trim()||null,context={clientResolution:reference===null?null:{reference,clientId}};
  assert.throws(()=>captureOutreachListClientSelection(request),{message:'UNAVAILABLE'});
  await assert.rejects(f.handler()(f.call(request,f.authority,context)),{message:'UNAVAILABLE'});assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
 }
});
test('malformed raw scalars, authority fields and hostile objects never execute coercion or credential IO',async()=>{
 const f=storedCase(),call=f.call();for(const request of [{clientId:3},{clientId,tenantId:'other'},{clientId,normalizationContext:{}},{clientId,outreachId:3}]){
  assert.throws(()=>captureOutreachListClientSelection(request),{message:'INVALID_ARGUMENTS'});
  await assert.rejects(f.handler()({...call,request}),{message:'INVALID_ARGUMENTS'});
 }
 let effects=0;const getter={};Object.defineProperty(getter,'clientId',{enumerable:true,get(){effects++;return clientId;}});
 const proxy=new Proxy({clientId},{ownKeys(){effects++;return ['clientId'];}});
 for(const raw of [getter,proxy])assert.throws(()=>captureOutreachListClientSelection(raw),{message:'INVALID_ARGUMENTS'});
 assert.equal(effects,0);assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
});
test('canonical resolution and normalized client cannot be substituted before source access',async()=>{
 const f=storedCase(),call=f.call();for(const context of [{clientResolution:null},{clientResolution:{reference:clientId,clientId:otherClient}},{clientResolution:{reference:'Other name',clientId}}]){
  await assert.rejects(f.handler()({...call,normalizationContext:context}),{message:'INVALID_ARGUMENTS'});
 }
 await assert.rejects(f.handler()({...call,input:{...call.input,clientId:otherClient}}),{message:'INVALID_ARGUMENTS'});
 assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
});
test('client subject and matching resource are mandatory even with an otherwise coherent operation decision',async()=>{
 for(const change of ['personal','foreign-client','no-client-resource','multiple-clients']){
  const f=storedCase(),call=structuredClone(f.call()),a=call.authority;
  if(change==='personal')Object.assign(a.subject,{kind:'personal',entityType:'user',entityIds:[a.binding.actorId]});
  if(change==='foreign-client'){a.subject.entityIds=[otherClient];for(const scopes of [a.subject.scopes,a.claims.scopes,a.decision.scopes])scopes[0].resourceId=otherClient;}
  if(change==='no-client-resource')for(const scopes of [a.subject.scopes,a.claims.scopes,a.decision.scopes])Object.assign(scopes[0],{kind:'tenant',resourceId:a.binding.tenantId});
  if(change==='multiple-clients')a.subject.entityIds.push(otherClient);
  await assert.rejects(f.handler()(call));assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
 }
});
test('native list serializes dates and preserves scalar campaign metadata without private nested rows',async()=>{
 const f=storedCase();f.state.resultMutator=p=>{p.generatedAt=new Date(f.now());p.campaigns[0].createdAt=new Date(f.now());p.campaigns[0].sentAt=new Date(f.now());};
 const out=JSON.parse(await f.handler()(f.call()));assert.equal(out.result.generatedAt,new Date(f.now()).toISOString());assert.equal(out.result.campaigns[0].createdAt,out.result.generatedAt);assert.equal(out.result.campaigns[0].sentAt,out.result.generatedAt);
 assert.equal(out.result.campaigns[0].recipientCount,3);assert.equal(Object.hasOwn(out.result.campaigns[0],'recipients'),false);assert.equal(Object.hasOwn(out.result,'complete'),false);
});
test('campaign total binds the fetched selected-client window, including empty and limited results',async()=>{
 const f=storedCase();f.state.page={...f.page,total:3,campaigns:[...f.page.campaigns,{...f.page.campaigns[0],id:'00000000-0000-4000-8000-000000000002'}]};
 let out=JSON.parse(await f.handler()(f.call()));assert.equal(out.result.total,3);assert.equal(out.result.campaigns.length,2);
 f.state.page={...f.page,total:0,campaigns:[]};out=JSON.parse(await f.handler()(f.call()));assert.deepEqual(out.result.campaigns,[]);assert.equal(out.result.total,0);assert.equal(Object.hasOwn(out.result,'absenceEvidence'),false);
});
test('receiving refuses cross-client/status rows, count substitution, duplicates and nested source details',async()=>{
 for(const mutate of [p=>p.campaigns[0].clientId=otherClient,p=>p.campaigns[0].clientId=null,p=>p.campaigns[0].status='sent',p=>p.total=2,
  p=>{p.total=2;p.campaigns.push({...p.campaigns[0]});},p=>p.campaigns[0].recipientCount=-1,p=>p.campaigns[0].recipients=[],p=>p.campaigns[0].client={id:clientId},p=>p.complete=true]){
  const f=storedCase();f.state.resultMutator=mutate;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
});
test('native detail/foreign errors cannot become an accepted list response',async()=>{
 for(const response of [()=>Response.json({tool:id,generatedAt:'2026-10-12T01:00:00.000Z',record:{id:clientId}}),()=>Response.json({error:'PRIVATE'}),()=>Response.json({},{status:403})]){
  const f=storedCase();f.state.responseFactory=response;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
});
test('source decision/credential revocation, response ceiling and cancelled authority withhold campaign bytes',async()=>{
 const f=storedCase(),call=structuredClone(f.call());call.authority.decision.operation='search_tracked_bills@0.2.0';await assert.rejects(f.handler()(call),{message:'ACCESS_DENIED'});assert.equal(f.credentialCalls.length,0);
 const g=storedCase();g.state.credentialMutator=p=>p.normalizationContext={clientResolution:null};await assert.rejects(g.handler()(g.call()),{message:'ACCESS_DENIED'});assert.equal(g.wire.length,0);
 const h=storedCase();await assert.rejects(h.handler({maxResponseBytes:16})(h.call()),{message:'RESOURCE_LIMIT'});
 const j=storedCase(),controller=new AbortController();j.state.afterSource=()=>controller.abort();await assert.rejects(j.handler()({...j.call(),signal:controller.signal}),{message:'CANCELLED'});
 const k=storedCase();k.state.afterSource=()=>k.state.now=k.authority.deadlineMs;await assert.rejects(k.handler()(k.call()),{message:'DEADLINE'});
});
test('list factory refuses foreign, duplicate and wrong-version operation mappings',()=>{
 const f=storedCase();for(const operations of [[],[f.operation,f.operation],[{id:'search_tracked_bills',version:'0.2.0'}],[{id,version:'0.1.0'}]])assert.throws(()=>createOutreachQueryHandlers({...f.transport,now:f.now},operations));assert.equal(f.wire.length,0);
});
