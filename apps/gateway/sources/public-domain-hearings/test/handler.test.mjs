/** Exact hearing native HTTP receiving with synthetic current credentials and complete source DTOs. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {createPublicDomainHearingsHandlers} from '../handler.mjs';
import {storedCase,id,clientId,at,payload,record,fragmentRecord,storedPage,jsonHash,continuation} from './fixture.mjs';

test('fixed governed native route preserves original selectors, exact context and complete carrier',async()=>{
 const request={query:' hearing ',committee:' Committee ',hearingId:'synthetic-hearing',cursor:continuation},f=storedCase(id,{request}),call=f.call(),out=JSON.parse(await f.handler()(call)),[wire]=f.wire,[proof]=f.credentialCalls;
 assert.deepEqual(out,{binding:f.binding,subject:f.authority.subject,operation:f.operation,argumentsSha256:call.argumentsSha256,result:f.page});
 assert.equal(wire.url,'https://native-core.example.invalid/api/clio/tools/search_committee_hearings');assert.equal(wire.options.method,'POST');assert.deepEqual(wire.body,request);
 assert.equal(wire.options.redirect,'error');assert.equal(wire.options.credentials,'omit');assert.equal(wire.options.cache,'no-store');
 assert.equal(wire.options.headers.authorization,'Bearer SYNTHETIC_NATIVE_USER');assert.equal(wire.options.headers['x-internal-service-secret'],'SYNTHETIC_INTERNAL_SERVICE');
 assert.equal(proof.requestSha256,hash(request));assert.equal(proof.argumentsSha256,call.argumentsSha256);assert.deepEqual(proof.normalizationContext,{tenantId:f.binding.tenantId,clientResolution:null});
 assert.equal(Object.hasOwn(out.result,'generatedAt'),false);assert.equal(out.result.coverage.complete,false);assert.match(out.result.note,/never imply a complete transcript/);
});

test('explicit UUID uses exact native identity capture while body retains original case/whitespace',async()=>{
 const canonical=clientId.replaceAll('9','a'),reference=canonical.toUpperCase(),request={clientId:` ${reference} `},f=storedCase(id,{request}),out=JSON.parse(await f.handler()(f.call()));
 assert.deepEqual(f.normalizationContext.clientResolution,{reference,clientId:canonical});assert.deepEqual(f.wire[0].body,request);assert.deepEqual(out.result,f.page);
});

test('named resolution is unavailable before credentials or HTTP even with a supplied candidate context',async()=>{
 const base=storedCase(),context={tenantId:base.binding.tenantId,clientResolution:{reference:'Synthetic client',clientId}},f=storedCase(id,{request:{clientId:'Synthetic client'},context});
 await assert.rejects(f.handler()(f.call()),{message:'UNAVAILABLE'});assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
});

test('foreign tenant context cannot borrow an otherwise coherent native credential call',async()=>{
 const f=storedCase();await assert.rejects(f.handler()(f.call(f.arguments,f.authority,{tenantId:clientId,clientResolution:null})),{message:'ACCESS_DENIED'});assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
});

for(const kind of ['hearing','official_transcript_chunk','machine_transcript_segment','hearing_intelligence','client_hearing_relevance'])test(`${kind}: complete source evidence and private/public provenance survive JSON`,async()=>{
 const f=storedCase(id,{request:{clientId}}),row=record(payload(kind),f.binding.tenantId);f.state.page=storedPage([row],{requestedEntityCount:1});
 const out=JSON.parse(await f.handler()(f.call()));assert.deepEqual(out.result,f.state.page);assert.equal(out.result.records[0].provenance.contentHash,jsonHash(row.payload));
 if(kind==='official_transcript_chunk'){assert.equal(out.result.records[0].payload.text.length,3);assert.equal(out.result.records[0].payload.characterEnd,2);}
});

test('opaque continuation remains native-owned with incomplete coverage and no cursor interpretation',async()=>{
 const f=storedCase(id,{request:{cursor:continuation}});f.state.page=storedPage([record()],{hasMore:true});
 const out=JSON.parse(await f.handler()(f.call()));assert.equal(out.result.coverage.sources[0].nextCursor,continuation);assert.equal(out.result.coverage.stopReason,'pagination_incomplete');assert.deepEqual(f.wire[0].body,{cursor:continuation});
});

test('fragment continuation preserves UTF16 bounds and a split surrogate without pretending to be whole JSON',async()=>{
 const row=fragmentRecord(),page=storedPage([row],{hasMore:true}),f=storedCase(id,{page}),out=JSON.parse(await f.handler()(f.call()));
 assert.deepEqual(out.result,page);assert.equal(out.result.records[0].payload.text.length,2000);assert.equal(out.result.records[0].payload.text.charCodeAt(1999),0xd83d);assert.equal(out.result.coverage.paginationComplete,false);
});

for(const sourceStatus of ['unavailable','unauthorized','unsupported','error'])test(`${sourceStatus}: preserve native source-refusal rail without fabricating successful absence`,async()=>{
 const f=storedCase(id,{page:storedPage([],{sourceStatus,stopReason:'native_source_refusal'})}),out=JSON.parse(await f.handler()(f.call()));
 assert.deepEqual(out.result,f.page);assert.equal(out.result.coverage.complete,false);assert.deepEqual(out.result.coverage.searchedDomains,[]);assert.deepEqual(out.result.coverage.unavailableSources,['hearings']);
});

test('exact published version and explicit historical cutoff retain current/source distinction',async()=>{
 const p={id:'synthetic-version',hash:'opaque-revision',evidence:{text:'Synthetic public record'},observed:at,date:'raw-date',billId:null,kind:'official_transcript',current:false,eventId:'synthetic-hearing',historical:true,authority:'Published source version; bill agenda membership alone does not establish hearing occurrence'},contentHash=jsonHash(p);
 const page=storedPage([{domain:'hearings',recordId:`published:synthetic-version:${contentHash}:0`,occurredAt:null,updatedAt:null,payload:p,provenance:{adapter:'hearings',sourceTable:'published_legislative_record',sourceRecordId:'synthetic-version',hearingId:'synthetic-hearing',contentHash,historical:true}}]);
 const request={recordsView:'published',recordId:'synthetic-version',hearingId:'synthetic-hearing',asOf:'2026-10-12T12:00:00Z'},f=storedCase(id,{request,page});
 assert.deepEqual(JSON.parse(await f.handler()(f.call())).result,page);assert.deepEqual(f.wire[0].body,request);assert.equal(f.call().input.asOf,at);
});

test('tenant substitution, invented complete coverage, payload mutation and cursor inconsistency withhold the whole DTO',async()=>{
 for(const mutate of [p=>p.records[0].provenance.tenantId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',p=>p.coverage.complete=true,p=>p.records[0].payload.rationale='changed',p=>p.coverage.sources[0].hasMore=true,p=>p.observability.sourceHealth.hearings='healthy']){
  const f=storedCase(id,{request:{clientId}});f.state.page=storedPage([record(payload('client_hearing_relevance'),f.binding.tenantId)],{requestedEntityCount:1});f.state.resultMutator=mutate;
  await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});assert.equal(f.wire.length,1);
 }
});

test('raw domain errors, foreign DTOs and HTTP failures cannot become successful hearing results',async()=>{
 for(const responseFactory of [()=>Response.json({error:'private backend failure'}),()=>Response.json({},{status:403}),()=>Response.json({tool:'explorer',hearings:[]})]){
  const f=storedCase();f.state.responseFactory=responseFactory;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
});

test('authority/model substitutions and absent current credentials prevent source access',async()=>{
 for(const mutate of [c=>c.authority.decision.decision='denied',c=>c.authority.sourceIds=['foreign'],c=>c.argumentsSha256='a'.repeat(64),c=>c.request={tenantId:'foreign'}]){
  const f=storedCase(),call=structuredClone(f.call());mutate(call);await assert.rejects(f.handler()(call));assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
 }
 const missing=storedCase();await assert.rejects(missing.handler({getCredentials:undefined})(missing.call()),{message:'UNAVAILABLE'});assert.equal(missing.wire.length,0);
 const denied=storedCase(id,{request:{clientId}});await assert.rejects(denied.handler({getCredentials:async()=>{throw Error('ACCESS_DENIED');}})(denied.call()));assert.equal(denied.wire.length,0);
});

test('credential correlations, cancellation, deadlines and bounded response bytes remain mandatory',async()=>{
 for(const key of ['binding','subject','operation','policyRevision','sourceIds','requestSha256','argumentsSha256','normalizationContext','origin','bearerToken','serviceSecret','expiresAtMs']){
  const f=storedCase();f.state.credentialMutator=r=>r[key]=key==='expiresAtMs'?f.now():null;await assert.rejects(f.handler()(f.call()),{message:'ACCESS_DENIED'});assert.equal(f.wire.length,0);
 }
 const aborted=storedCase();await assert.rejects(aborted.handler()({...aborted.call(),signal:AbortSignal.abort()}),{message:'CANCELLED'});assert.equal(aborted.credentialCalls.length,0);
 const expired=storedCase();expired.state.now=expired.authority.deadlineMs;await assert.rejects(expired.handler()(expired.call()),{message:'DEADLINE'});assert.equal(expired.wire.length,0);
 const small=storedCase();await assert.rejects(small.handler({maxResponseBytes:8})(small.call()),{message:'RESOURCE_LIMIT'});
 const cancelled=storedCase(),controller=new AbortController();cancelled.state.afterSource=()=>controller.abort();await assert.rejects(cancelled.handler()({...cancelled.call(),signal:controller.signal}),{message:'CANCELLED'});
});

test('per-call credential composition retains exact original call and rejects a static fallback',async()=>{
 const f=storedCase(),call=f.call(),{getCredentials,...configuration}=f.transport;let captured;
 const [handler]=createPublicDomainHearingsHandlers({...configuration,now:f.now,credentialsForCall:(operation,original)=>{captured={operation,original};return getCredentials;}},[f.operation]);
 await handler.execute(call);assert.equal(captured.original,call);assert.deepEqual(captured.operation,f.operation);assert.throws(()=>f.handler({credentialsForCall:()=>getCredentials}),{message:'GATEWAY_CONFIGURATION'});
});

test('other operations, duplicates and wrong versions cannot widen this finite source adapter',()=>{
 const f=storedCase();for(const operations of [[],[f.operation,f.operation],[{id:'query_knowledge_graph',version:'0.2.0'}],[{id,version:'0.1.0'}]])assert.throws(()=>createPublicDomainHearingsHandlers({...f.transport,now:f.now},operations),{message:'GATEWAY_CONFIGURATION'});
 assert.equal(f.wire.length,0);assert.equal(f.credentialCalls.length,0);
});
