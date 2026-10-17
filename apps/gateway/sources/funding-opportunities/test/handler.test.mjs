/** Source behavior over synthetic native HTTP JSON. Passing tests does not qualify the pending Core observation bridge. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {captureFundingClientSelection,assertFundingClientSubject} from '../request-context.mjs';
import {createFundingOpportunitiesHandlers} from '../handler.mjs';
import {createStoredNativeReadHandlers} from '../../retained-reads/native-handler.mjs';
import {createRetainedHttpTransport} from '../../retained-reads/http-transport.mjs';
import {storedCase,ids,clientId,recordId,brief} from './fixture.mjs';
const otherClient='c1234567-b123-4c12-8d12-e123456789ab';
const result=async f=>JSON.parse(await f.handler()(f.call())).result;

for(const id of ids)test(`${id}: fixed native POST preserves source JSON, original request and the exact trusted observation`,async()=>{
 const f=storedCase(id),call=f.call(),out=JSON.parse(await f.handler()(call)),[wire]=f.wire,[proof]=f.credentialCalls;
 assert.equal(wire.url,`https://native-core.example.invalid/api/clio/tools/${id}`);assert.equal(wire.options.method,'POST');assert.deepEqual(wire.body,f.arguments);
 assert.equal(Object.hasOwn(wire.body,'asOf'),false);assert.equal(Object.hasOwn(wire.body,'normalizationContext'),false);
 const observation=JSON.parse(Buffer.from(wire.options.headers['x-meri-read-observation'],'base64url').toString('utf8'));
 assert.deepEqual(observation,{schemaVersion:'meri-native-read-observation/1',operation:f.operation,requestSha256:canonicalSha256(f.arguments),context:f.normalizationContext});
 assert.equal(proof.requestSha256,observation.requestSha256);assert.deepEqual(proof.normalizationContext,f.normalizationContext);
 assert.equal(f.state.credentialOwnerCalls[0].call,call);assert.deepEqual(f.state.credentialOwnerCalls[0].operation,f.operation);
 assert.equal(wire.options.headers.authorization,'Bearer SYNTHETIC_NATIVE_USER');assert.equal(wire.options.headers['x-internal-service-secret'],'SYNTHETIC_INTERNAL_SERVICE');
 assert.equal(wire.options.redirect,'error');assert.equal(wire.options.credentials,'omit');assert.equal(wire.options.cache,'no-store');
 assert.deepEqual(out,{binding:f.authority.binding,subject:f.authority.subject,operation:f.operation,argumentsSha256:call.argumentsSha256,result:f.page});
 assert.equal(out.result.asOf,f.normalizationContext.asOf);assert.notEqual(out.result.asOf,new Date(f.now()).toISOString());
});

for(const id of ids)test(`${id}: a legacy or substituted result clock is rejected without rewriting or retry`,async()=>{
 const f=storedCase(id);f.state.resultMutator=p=>p.asOf=new Date(f.now()).toISOString();
 await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});assert.equal(f.wire.length,1);assert.equal(f.credentialCalls.length,1);
 assert.equal(f.state.nativeValue.asOf,new Date(f.now()).toISOString());
});

test('all five require the frozen explicit client UUID; model clocks, unknown fields and coercion fail before native credentials',async()=>{
 for(const id of ids){const f=storedCase(id),base=f.call();
  for(const request of [{...f.arguments,clientId:undefined},{...f.arguments,clientId:null},{...f.arguments,clientId:' '+clientId},
   {...f.arguments,clientId:'not-uuid'},{...f.arguments,asOf:f.normalizationContext.asOf},{...f.arguments,tenantId:'other'}]){
   await assert.rejects(f.handler()({...base,request}),{message:'INVALID_ARGUMENTS'});
  }
  const omitted={...f.arguments};delete omitted.clientId;assert.throws(()=>captureFundingClientSelection(f.operation,omitted),{message:'INVALID_ARGUMENTS'});
  assert.equal(f.wire.length,0);assert.equal(f.credentialCalls.length,0);
 }
});

test('capture is inert and case-equivalent identity does not rewrite the native request',async()=>{
 const f=storedCase(ids[0],{request:{clientId:clientId.toUpperCase()}}),selection=captureFundingClientSelection(f.operation,f.arguments);
 assert.deepEqual(selection,{clientId});assert.ok(Object.isFrozen(selection));await result(f);assert.equal(f.wire[0].body.clientId,clientId.toUpperCase());
 let effects=0;const getter={};Object.defineProperty(getter,'clientId',{enumerable:true,get(){effects++;return clientId;}});
 const proxy=new Proxy({clientId},{ownKeys(){effects++;return ['clientId'];}});
 for(const request of [getter,proxy])assert.throws(()=>captureFundingClientSelection(f.operation,request),{message:'INVALID_ARGUMENTS'});
 const subject={};Object.defineProperty(subject,'kind',{enumerable:true,get(){effects++;return 'client';}});
 assert.throws(()=>assertFundingClientSubject(subject,selection),{message:'ACCESS_DENIED'});assert.equal(effects,0);
 const opaque=structuredClone(f.authority.subject);opaque.entityIds=['not-a-uuid'];opaque.scopes[0].resourceId='not-a-uuid';
 assert.throws(()=>assertFundingClientSubject(opaque,{clientId:'not-a-uuid'}),{message:'ACCESS_DENIED'});
});

test('one exact client subject/resource is required and shared tenant scope remains admissible',async()=>{
 for(const change of ['personal','multiple','foreign-client','foreign-resource','extra-client','missing-resource']){
  const f=storedCase(),call=structuredClone(f.call()),s=call.authority.subject;
  if(change==='personal')Object.assign(s,{kind:'personal',entityType:'user',entityIds:[call.authority.binding.actorId]});
  if(change==='multiple')s.entityIds.push(otherClient);if(change==='foreign-client')s.entityIds=[otherClient];
  if(change==='foreign-resource')s.scopes[0].resourceId=otherClient;
  if(change==='extra-client')s.scopes.push({...s.scopes[0],resourceId:otherClient});
  if(change==='missing-resource')s.scopes[0]={...s.scopes[0],kind:'tenant',resourceId:call.authority.binding.tenantId};
  await assert.rejects(f.handler()(call),{message:'ACCESS_DENIED'});assert.equal(f.wire.length,0);assert.equal(f.state.credentialOwnerCalls,undefined);
 }
 const f=storedCase(),a=f.authority,tenantScope={...a.subject.scopes[0],kind:'tenant',resourceId:a.binding.tenantId};
 for(const scopes of [a.subject.scopes,a.claims.scopes,a.decision.scopes])scopes.push(tenantScope);
 assertFundingClientSubject(a.subject,{clientId});await result(f);
});

test('missing or revoked current owner cannot fall back to static credentials',async()=>{
 for(const id of ids){const f=storedCase(id),{credentialsForCall,...passive}=f.transport;
  const handler=createFundingOpportunitiesHandlers({...passive,now:f.now,getCredentials:()=>{throw Error('STATIC_FALLBACK');}},[f.operation])[0];
  await assert.rejects(handler.execute(f.call()),{message:'UNAVAILABLE'});assert.equal(f.wire.length,0);assert.equal(f.credentialCalls.length,0);
  f.state.resourceDenied=true;await assert.rejects(f.handler()(f.call()),{message:'ACCESS_DENIED'});assert.equal(f.wire.length,0);
 }
});

test('trusted context is exact, pinned and never inferred from an output or ambient clock',async()=>{
 const f=storedCase(),call=f.call();
 for(const context of [{},{asOf:'2026-10-17T00:00:00Z'},{asOf:0},{asOf:f.normalizationContext.asOf,mode:'enforce'}])
  await assert.rejects(f.handler()({...call,normalizationContext:context}),{message:'INVALID_ARGUMENTS'});
 await assert.rejects(f.handler()({...call,argumentsSha256:'a'.repeat(64)}),{message:'INVALID_ARGUMENTS'});assert.equal(f.wire.length,0);
 const g=storedCase();g.state.credentialMutator=proof=>proof.normalizationContext={asOf:new Date(g.now()).toISOString()};
 await assert.rejects(g.handler()(g.call()),{message:'ACCESS_DENIED'});assert.equal(g.wire.length,0);
});

test('search retains raw defaults, effective page clamp and independent source-generated clock',async()=>{
 const f=storedCase(ids[0],{request:{clientId,query:'  rocket  ',page:100000,activeState:'all'}}),out=await result(f);
 assert.deepEqual(f.wire[0].body,f.arguments);assert.equal(f.wire[0].body.page,100000);assert.equal(f.wire[0].body.query,'  rocket  ');
 assert.equal(out.data.page,10000);assert.equal(out.data.criteria.query,'rocket');assert.deepEqual(out.data.criteria.lifecycle,['active','closed','post_award']);
 assert.equal(out.data.pageSize,5);assert.notEqual(out.data.generatedAt,out.asOf);assert.equal(out.data.coverage.pageCoversMatchedResults,false);
 assert.equal(out.data.coverage.procurementForecasts.tool,'search_procurement_forecasts');assert.equal(out.data.opportunities[0].eligibility.state,'unknown');
 for(const mutation of [p=>p.data.criteria.query='wrong',p=>p.data.criteria.sources=['grants_gov'],p=>p.data.hasMore=true,p=>p.data.coverage.pageCoversMatchedResults=true]){
  const g=storedCase(ids[0],{request:f.arguments});g.state.resultMutator=mutation;await assert.rejects(g.handler()(g.call()),{message:'INVALID_RESULT'});
 }
});

test('detail preserves UTF-16 continuation and unknown money without mixing grant and contract channels',async()=>{
 const f=storedCase(ids[2],{request:{clientId,source:'sam_gov',sourceRecordId:recordId,summaryOffset:7,summaryLimit:2}}),out=await result(f);
 assert.equal(out.data.summary,'\u{1f680}');assert.deepEqual(out.data.summaryRead,{state:'available',offset:7,totalCharacters:16,returnedCharacters:2,truncated:true,nextOffset:9,sourceUpdatedAt:null});
 assert.deepEqual(out.data.contractValue,{estimatedValue:null,basis:'not_stated_by_source'});assert.equal(out.data.grantFunding,null);assert.equal(out.data.evidence.requirements.tool,ids[1]);
 const grant=storedCase(ids[2],{request:{clientId,source:'grants_gov',sourceRecordId:'stored-grant-id'}}),grantOut=await result(grant);
 assert.equal(grantOut.data.contractValue,null);assert.equal(grantOut.data.grantFunding.awardCeiling,null);assert.equal(grantOut.data.evidence.requirements.tool,ids[2]);
 for(const mutate of [p=>p.data.summaryRead.nextOffset=8,p=>p.data.contractValue.estimatedValue=0,p=>p.data.evidence.recordRef='sam_gov:other',p=>p.data.clientId=otherClient]){
  const g=storedCase(ids[2]);g.state.resultMutator=mutate;await assert.rejects(g.handler()(g.call()),{message:'INVALID_RESULT'});
 }
});

test('requirements retain pending/rejected/superseded extraction facts and UTF-16 quote spans',async()=>{
 const f=storedCase(ids[1],{request:{clientId,source:'sam_gov',sourceRecordId:recordId,offset:20,limit:1}});
 f.state.resultMutator=p=>{p.data.requirements[0].reviewStatus='rejected';p.data.requirements[0].supersededAt=p.asOf;};const out=await result(f);
 assert.equal(out.data.requirements[0].sourceExcerpt.length,4);assert.equal(out.data.requirements[0].reviewStatus,'rejected');
 assert.equal(out.data.requirements[0].supersededAt,out.asOf);assert.equal(out.data.generatedAt,out.asOf);assert.equal(out.data.pagination.offset,20);
 for(const mutate of [p=>p.data.generatedAt=new Date(f.now()).toISOString(),p=>p.data.requirements[0].excerptEnd=13,
  p=>p.data.requirements[0].verified=true,p=>{p.data.pagination.hasMore=true;p.data.pagination.nextOffset=0;}]){
  const g=storedCase(ids[1]);g.state.resultMutator=mutate;await assert.rejects(g.handler()(g.call()),{message:'INVALID_RESULT'});
 }
});

test('requirement exhausted pages preserve available coverage and no-documents stays distinct from no conditions',async()=>{
 const f=storedCase(ids[1],{request:{clientId,source:'sam_gov',sourceRecordId:recordId,offset:20}});
 f.state.resultMutator=p=>{p.data.requirements=[];p.data.pagination.total=12;};assert.equal((await result(f)).data.coverage,'available');
 for(const coverage of ['no_documents','no_text','read_none_found']){
  const g=storedCase(ids[1]);g.state.resultMutator=p=>{p.data.requirements=[];p.data.pagination.total=0;p.data.coverage=coverage;};assert.equal((await result(g)).data.coverage,coverage);
 }
});

test('client context distinguishes broad match counts from sampled deadline counts and the sampled next deadline',async()=>{
 const f=storedCase(ids[3]),asOf=f.normalizationContext.asOf,at=new Date(Date.parse(asOf)+86400000).toISOString(),deadline={at,dateOnly:at.slice(0,10),timeZone:null,basis:'explicit_datetime',daysRemaining:1,status:'open'};
 f.state.resultMutator=p=>{p.data.counts.activeContracts=200;p.data.counts.deadlinesIn30Days=1;p.data.topContracts[0].deadline=deadline;p.data.nextDeadline=deadline;};
 const out=await result(f);assert.equal(out.data.counts.activeContracts,200);assert.equal(out.data.topContracts.length,1);assert.deepEqual(out.data.nextDeadline,deadline);
 for(const mutate of [p=>p.data.nextDeadline={...deadline,at:new Date(Date.parse(at)+1000).toISOString()},p=>p.data.counts.deadlinesIn30Days=2,p=>p.data.clientId=otherClient,p=>p.data.topGrants=[brief()]]){
  const g=storedCase(ids[3]);g.state.resultMutator=mutate;await assert.rejects(g.handler()(g.call()),{message:'INVALID_RESULT'});
 }
});

test('landscape preserves inferred basis, full fingerprint, exact source coverage and original truncation counts',async()=>{
 const f=storedCase(ids[4]);f.state.resultMutator=p=>{const first=p.data.items[0];p.data.items=Array.from({length:40},(_,i)=>({...first,sourceId:`synthetic-${i}`}));p.data.sources[0].itemCount=45;p.truncated=[{collection:'items',kept:40,total:45}];};
 const out=await result(f);assert.equal(out.data.fingerprint,'a'.repeat(64));assert.equal(out.data.items.length,40);assert.equal(out.data.items[0].basis,'inferred');assert.equal(out.data.sources[0].itemCount,45);
 assert.deepEqual(out.truncated,[{collection:'items',kept:40,total:45}]);
 for(const mutate of [p=>p.data.sources.pop(),p=>p.data.coverage.available=0,p=>p.data.items[0].source='legislation',p=>p.data.items[0].authorized=true,p=>p.truncated=[]]){
  const g=storedCase(ids[4]);g.state.resultMutator=mutate;await assert.rejects(g.handler()(g.call()),{message:'INVALID_RESULT'});
 }
});

test('native feature, wall, unsupported-source and not-found refusals retain exact null data and no absence claim',async()=>{
 for(const id of ids)for(const state of ['disabled','denied','not_found','unsupported_source','invalid_request']){
  const f=storedCase(id);f.state.page={tool:id,state,asOf:f.normalizationContext.asOf,explanation:state==='denied'?'Not available for this client.':'Synthetic native refusal; no absence evidence.',data:null};
  assert.deepEqual(await result(f),f.state.page);assert.equal(f.wire.length,1);
 }
 const f=storedCase(ids[4],{request:{clientId,source:'grants_gov',sourceRecordId:recordId}});f.state.page={tool:ids[4],state:'unsupported_source',asOf:f.normalizationContext.asOf,explanation:'Only SAM composition is wired.',data:null};assert.equal((await result(f)).state,'unsupported_source');
 const g=storedCase();g.state.page={tool:ids[0],state:'denied',asOf:g.normalizationContext.asOf,explanation:'The hidden client exists.',data:null};await assert.rejects(g.handler()(g.call()),{message:'INVALID_RESULT'});
});

test('whole DTO admission refuses unknown private fields, oversize envelopes and source identity changes',async()=>{
 for(const id of ids)for(const mutate of [p=>p.sql='PRIVATE',p=>p.complete=true,p=>p.tool='review_funding_opportunity',p=>p.explanation='x'.repeat(24001)]){
  const f=storedCase(id);f.state.resultMutator=mutate;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
 const f=storedCase(ids[2]);f.state.resultMutator=p=>p.data.ref.sourceRecordId=otherClient;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 const g=storedCase(ids[0]);await assert.rejects(g.handler({maxResponseBytes:16})(g.call()),{message:'RESOURCE_LIMIT'});
});

test('failed native HTTP never retries legacy mode and current credential proof remains tenant/request bound',async()=>{
 for(const status of [400,401,403,404,500]){const f=storedCase();f.state.responseFactory=()=>Response.json({error:'PRIVATE'},{status});await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});assert.equal(f.wire.length,1);}
 for(const mutate of [p=>p.requestSha256='a'.repeat(64),p=>p.binding.tenantId='other',p=>p.sourceIds=[]]){
  const f=storedCase();f.state.credentialMutator=mutate;await assert.rejects(f.handler()(f.call()),{message:'ACCESS_DENIED'});assert.equal(f.wire.length,0);
 }
});

test('revoked decisions, cancellation and expiry cannot release a stored reply',async()=>{
 const f=storedCase(),call=structuredClone(f.call());call.authority.decision.decision='denied';await assert.rejects(f.handler()(call),{message:'ACCESS_DENIED'});assert.equal(f.wire.length,0);
 const g=storedCase(),controller=new AbortController();controller.abort();await assert.rejects(g.handler()({...g.call(),signal:controller.signal}),{message:'CANCELLED'});assert.equal(g.credentialCalls.length,0);
 const h=storedCase(),late=new AbortController();h.state.afterSource=()=>late.abort();await assert.rejects(h.handler()({...h.call(),signal:late.signal}),{message:'CANCELLED'});
 const j=storedCase();j.state.afterSource=()=>j.state.now=j.authority.deadlineMs;await assert.rejects(j.handler()(j.call()),{message:'DEADLINE'});
});

test('factory refuses nonread, foreign, duplicate, empty and wrong-version operation declarations',()=>{
 const f=storedCase();for(const operations of [[],[f.operation,f.operation],[{id:ids[0],version:'0.1.0'}],[{id:'explain_opportunity_match',version:'0.2.0'}],[{id:'query_outreach',version:'0.2.0'}]])
  assert.throws(()=>createFundingOpportunitiesHandlers({...f.transport,now:f.now},operations));
 assert.equal(f.wire.length,0);
});

test('observation construction forbids request/result bridges, foreign families and missing or invented observation modes',()=>{
 const f=storedCase(),configuration={...f.transport,now:f.now},specification={family:f.family,routes:{[f.operation.id]:`/api/clio/tools/${f.operation.id}`},observation:'funding-asof'};
 for(const changes of [{requestBody:current=>current.request},{resultBody:(_current,native)=>native},{family:'federal-market'},
  {observation:'funding-asof-v2'},{observation:undefined}])
  assert.throws(()=>createStoredNativeReadHandlers(configuration,[f.operation],{...specification,...changes}),{message:'GATEWAY_CONFIGURATION'});
 assert.equal(createStoredNativeReadHandlers(configuration,[f.operation],specification).length,1);assert.equal(f.wire.length,0);
});

test('unqualified delegated transport cannot silently discard a funding observation',async()=>{
 const f=storedCase();let delegatedCalls=0;
 const transport=createRetainedHttpTransport({origin:f.transport.origin,now:f.now,delegatedTransport:{read(){delegatedCalls++;throw Error('LEGACY_FALLBACK');}}});
 const call={...f.call(),contract:f.contract,operation:f.operation,deadlineMs:f.authority.deadlineMs};
 await assert.rejects(transport.read(call,{path:`/api/clio/tools/${f.operation.id}`,method:'POST',body:f.arguments,serviceSecret:true,observation:'funding-asof'}),{message:'UNAVAILABLE'});
 assert.equal(delegatedCalls,0);assert.equal(f.wire.length,0);assert.equal(f.credentialCalls.length,0);
});
