/** Source mechanics over synthetic HTTP bytes; no real conversation, current grant or producer qualification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {captureBusinessDevelopmentResource} from '../request-context.mjs';
import {createBusinessDevelopmentHandlers} from '../handler.mjs';
import {storedCase,ids,clientId,conversationId} from './fixture.mjs';
const otherClient='e1234567-b123-4c12-8d12-e123456789ab';

for(const id of ids)test(`${id}: exact native POST, complete receiving carrier and private credential proof`,async()=>{
 const f=storedCase(id),call=f.call(),out=JSON.parse(await f.handler()(call)),[wire]=f.wire,[proof]=f.credentialCalls;
 assert.equal(wire.url,`https://native-core.example.invalid/api/clio/tools/${id}`);assert.equal(wire.options.method,'POST');assert.deepEqual(wire.body,f.arguments);
 assert.notEqual(wire.body.conversationId,f.authority.binding.conversationId);assert.equal(wire.body.conversationId,conversationId);
 assert.deepEqual(out,{binding:f.authority.binding,subject:f.authority.subject,operation:f.operation,argumentsSha256:call.argumentsSha256,result:f.page});
 assert.equal(wire.options.headers.authorization,'Bearer SYNTHETIC_NATIVE_USER');assert.equal(wire.options.headers['x-internal-service-secret'],'SYNTHETIC_INTERNAL_SERVICE');
 assert.equal(wire.options.redirect,'error');assert.equal(wire.options.credentials,'omit');assert.equal(wire.options.cache,'no-store');
 assert.equal(proof.requestSha256,canonicalSha256(f.arguments));assert.deepEqual(proof.normalizationContext,{});
 assert.equal(f.state.credentialOwnerCalls[0].call,call);assert.deepEqual(f.state.credentialOwnerCalls[0].operation,f.operation);
 assert.equal(Object.hasOwn(proof,'nativeConversation'),false);assert.equal(Object.hasOwn(out.result,'complete'),false);
});

test('native UUID capture normalizes private identity only and never substitutes the run conversation',async()=>{
 for(const id of ids){const request={conversationId:conversationId.toUpperCase()},f=storedCase(id,{request});
  assert.deepEqual(captureBusinessDevelopmentResource(f.operation,request,f.authority.subject),{conversationId,clientId});
  assert.ok(Object.isFrozen(captureBusinessDevelopmentResource(f.operation,request,f.authority.subject)));
  await f.handler()(f.call());assert.deepEqual(f.wire[0].body,request);assert.equal(f.wire[0].body.conversationId,conversationId.toUpperCase());
 }
 const f=storedCase(),subject=structuredClone(f.authority.subject),nativeId='01234567-0123-0123-0123-0123456789ab';
 subject.entityIds=[nativeId];subject.scopes[0].resourceId=nativeId;
 assert.deepEqual(captureBusinessDevelopmentResource(f.operation,f.arguments,subject),{conversationId,clientId:nativeId});
});

test('canonical request is mandatory, closed and not trimmed or coerced before any credential access',async()=>{
 const f=storedCase(ids[1]),call=f.call();
 for(const request of [{},{conversationId:' '+conversationId},{conversationId:conversationId+' '},{conversationId:'not-uuid'},
  {conversationId,clientId},{conversationId,limit:'2'},{conversationId,limit:0},{conversationId,limit:26},{conversationId,limit:2.5},
  {conversationId,tenantId:'other'},{conversationId,normalizationContext:{}}]){
  assert.throws(()=>captureBusinessDevelopmentResource(f.operation,request,f.authority.subject),{message:'INVALID_ARGUMENTS'});
  await assert.rejects(f.handler()({...call,request}),{message:'INVALID_ARGUMENTS'});
 }
 assert.equal(f.credentialCalls.length,0);assert.equal(f.state.credentialOwnerCalls,undefined);assert.equal(f.wire.length,0);
});

test('hostile resource/subject objects cannot run getters or proxy traps',()=>{
 const f=storedCase();let effects=0;
 const raw={};Object.defineProperty(raw,'conversationId',{enumerable:true,get(){effects++;return conversationId;}});
 const proxy=new Proxy({conversationId},{ownKeys(){effects++;return ['conversationId'];}});
 for(const request of [raw,proxy])assert.throws(()=>captureBusinessDevelopmentResource(f.operation,request,f.authority.subject),{message:'INVALID_ARGUMENTS'});
 const subject={};Object.defineProperty(subject,'kind',{enumerable:true,get(){effects++;return 'client';}});
 assert.throws(()=>captureBusinessDevelopmentResource(f.operation,{conversationId},subject),{message:'ACCESS_DENIED'});assert.equal(effects,0);
});

test('only one coherent current client subject and its closed resource scope can reach the credential owner',async()=>{
 for(const change of ['personal','no-client-resource','multiple-clients','alternate-resource','broad-extra-resource','wrong-lineage','nonuuid']){
  const f=storedCase(),call=structuredClone(f.call()),a=call.authority;
  if(change==='personal')Object.assign(a.subject,{kind:'personal',entityType:'user',entityIds:[a.binding.actorId]});
  if(change==='no-client-resource')for(const scopes of [a.subject.scopes,a.claims.scopes,a.decision.scopes])Object.assign(scopes[0],{kind:'tenant',resourceId:a.binding.tenantId});
  if(change==='multiple-clients')a.subject.entityIds.push(otherClient);
  if(change==='alternate-resource')a.subject.scopes[0].resourceId=otherClient;
  if(change==='broad-extra-resource')a.subject.scopes.push({...a.subject.scopes[0],kind:'tenant',resourceId:a.binding.tenantId});
  if(change==='wrong-lineage')a.subject.scopes[0].tenantId='other';
  if(change==='nonuuid'){a.subject.entityIds=['client-string'];a.subject.scopes[0].resourceId='client-string';}
  await assert.rejects(f.handler()(call),{message:'ACCESS_DENIED'});assert.equal(f.state.credentialOwnerCalls,undefined);assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
 }
});

test('missing native resource owner never falls back to static credentials or source HTTP',async()=>{
 for(const id of ids){const f=storedCase(id),{credentialsForCall,...passive}=f.transport;
  const handlers=createBusinessDevelopmentHandlers({...passive,now:f.now,getCredentials:()=>{throw Error('STATIC_FALLBACK');}},[f.operation]);
  await assert.rejects(handlers[0].execute(f.call()),{message:'UNAVAILABLE'});assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
  f.state.resourceDenied=true;await assert.rejects(f.handler()(f.call()),{message:'ACCESS_DENIED'});assert.equal(f.wire.length,0);
 }
});

test('context retains stored prospect fields, preferences and newest-first history coverage',async()=>{
 const f=storedCase(),row=f.page.history.entries[0];
 f.state.page={...f.page,history:{entries:Array.from({length:20},(_,i)=>({...row,id:`${i.toString(16).padStart(8,'0')}-b123-4c12-8d12-e123456789ab`,at:new Date(f.now()-i*1000).toISOString()})),total:23,returned:20,truncated:true}};
 const out=JSON.parse(await f.handler()(f.call()));assert.equal(out.result.history.entries.length,20);assert.equal(out.result.history.total,23);assert.equal(out.result.history.truncated,true);
 assert.equal(out.result.prospect.linkedClientId,clientId);assert.deepEqual(out.result.firmPreferences,f.page.firmPreferences);
 assert.equal(Object.hasOwn(out.result,'evidence'),false);
 f.state.page={...f.page,history:{entries:[],total:0,returned:0,truncated:false}};assert.deepEqual(JSON.parse(await f.handler()(f.call())).result.history.entries,[]);
});

test('case-equivalent native linked client is preserved without granting a different resource',async()=>{
 const f=storedCase();f.state.resultMutator=p=>p.prospect.linkedClientId=clientId.toUpperCase();
 const out=JSON.parse(await f.handler()(f.call()));assert.equal(out.result.prospect.linkedClientId,clientId.toUpperCase());
 assert.equal(f.credentialCalls.length,1);assert.deepEqual(f.nativeConversation,{conversationId,clientId});
});

test('recent preserves inferred-change wording, exact JSON diffs and independent unread count without invented totals',async()=>{
 const f=storedCase(ids[1],{request:{conversationId,limit:2}}),out=JSON.parse(await f.handler()(f.call()));
 assert.equal(out.result.alerts.limit,2);assert.equal(out.result.alerts.unreadCount,3);assert.equal(out.result.alerts.returned,1);assert.equal(out.result.alerts.truncated,true);
 assert.equal(out.result.alerts.items[0].implication.inference,true);assert.deepEqual(out.result.alerts.items[0].changedFields,[{field:'status',before:null,after:{stored:'changed'}}]);
 assert.equal(out.result.alerts.items[0].dates.eventAt,'Source date wording');
 for(const key of ['total','nextCursor','complete','absenceEvidence','markRead'])assert.equal(Object.hasOwn(out.result.alerts,key),false);
});

test('complete DTO admission rejects unknown private nested fields and broken coverage instead of redacting',async()=>{
 for(const mutate of [p=>p.prospect.client={id:clientId},p=>p.prospect.linkedClientId=otherClient,p=>p.prospect.linkedClientId=null,p=>delete p.prospect.linkedClientId,p=>p.history.total=2,p=>p.history.returned=0,p=>p.history.truncated=true,
  p=>p.history.entries.push({...p.history.entries[0],at:new Date(Date.parse(p.generatedAt)+1000).toISOString()}),p=>p.complete=true]){
  const f=storedCase();f.state.resultMutator=mutate;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
 for(const mutate of [p=>p.alerts.limit=1,p=>p.alerts.returned=0,p=>p.alerts.items[0].implication.inference=false,
  p=>p.alerts.items[0].implication.note='Fact',p=>p.alerts.total=1,p=>p.alerts.items[0].changedFields[0].before=undefined]){
  const f=storedCase(ids[1]);f.state.resultMutator=mutate;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
});

test('foreign/failed native replies, mismatched credential proof and output limits withhold the whole result',async()=>{
 for(const response of [()=>Response.json({error:'PRIVATE'}),()=>Response.json({},{status:403}),()=>Response.json({},{status:404}),()=>Response.json({tool:'get_business_development_evidence'})]){
  const f=storedCase();f.state.responseFactory=response;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
 const g=storedCase();g.state.credentialMutator=p=>p.requestSha256='a'.repeat(64);await assert.rejects(g.handler()(g.call()),{message:'ACCESS_DENIED'});assert.equal(g.wire.length,0);
 const h=storedCase();await assert.rejects(h.handler({maxResponseBytes:16})(h.call()),{message:'RESOURCE_LIMIT'});
});

test('canonical hash/context substitution, revoked decisions, cancellation and expiry never return stored bytes',async()=>{
 const f=storedCase(),call=f.call();
 await assert.rejects(f.handler()({...call,argumentsSha256:'a'.repeat(64)}),{message:'INVALID_ARGUMENTS'});
 await assert.rejects(f.handler()({...call,normalizationContext:{conversationId}}),{message:'INVALID_ARGUMENTS'});
 const bad=structuredClone(call);bad.authority.decision.operation=`${ids[1]}@0.2.0`;await assert.rejects(f.handler()(bad),{message:'ACCESS_DENIED'});assert.equal(f.wire.length,0);
 const g=storedCase(),controller=new AbortController();controller.abort();await assert.rejects(g.handler()({...g.call(),signal:controller.signal}),{message:'CANCELLED'});assert.equal(g.credentialCalls.length,0);
 const h=storedCase(),aborted=new AbortController();h.state.afterSource=()=>aborted.abort();await assert.rejects(h.handler()({...h.call(),signal:aborted.signal}),{message:'CANCELLED'});
 const j=storedCase();j.state.afterSource=()=>j.state.now=j.authority.deadlineMs;await assert.rejects(j.handler()(j.call()),{message:'DEADLINE'});
});

test('factory and capture refuse evidence, foreign, duplicate and wrong-version operations',()=>{
 const f=storedCase();for(const operations of [[],[f.operation,f.operation],[{id:'get_business_development_evidence',version:'0.2.0'}],[{id:ids[0],version:'0.1.0'}],[{id:'query_outreach',version:'0.2.0'}]])
  assert.throws(()=>createBusinessDevelopmentHandlers({...f.transport,now:f.now},operations));
 assert.throws(()=>captureBusinessDevelopmentResource({id:'get_business_development_evidence',version:'0.2.0'},f.arguments,f.authority.subject),{message:'UNAVAILABLE'});assert.equal(f.wire.length,0);
});
