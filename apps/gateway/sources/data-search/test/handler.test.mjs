/** Actual JSON receiving and authority/credential controls; synthetic governed results only. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {createDataSearchHandlers} from '../handler.mjs';
import {storedCase,id,continuation} from './fixture.mjs';

test('fixed authenticated Core POST preserves the original flat request and exact private result envelope',async()=>{
 const f=storedCase(),call=f.call(),result=JSON.parse(await f.handler()(call)),[wire]=f.wire,[proof]=f.credentialCalls;
 assert.deepEqual(result,{binding:f.authority.binding,subject:f.authority.subject,operation:f.operation,argumentsSha256:call.argumentsSha256,result:f.page});
 assert.equal(wire.url,'https://native-core.example.invalid/api/clio/tools/search_capiro_data');assert.equal(wire.options.method,'POST');
 assert.deepEqual(wire.body,f.arguments);assert.equal(Object.hasOwn(wire.body,'input'),false);assert.equal(Object.hasOwn(wire.body,'caller'),false);
 assert.equal(wire.options.headers.authorization,'Bearer SYNTHETIC_NATIVE_USER');assert.equal(wire.options.headers['x-internal-service-secret'],'SYNTHETIC_INTERNAL_SERVICE');
 assert.equal(wire.options.redirect,'error');assert.equal(wire.options.credentials,'omit');assert.equal(wire.options.cache,'no-store');
 assert.equal(proof.requestSha256,hash(f.arguments));assert.equal(proof.argumentsSha256,call.argumentsSha256);assert.deepEqual(proof.normalizationContext,{});
});

test('raw duplicates, blank queries and nullish defaults are normalized once by native Core',async()=>{
 const request={query:'   ',domains:['mail','mail'],queryClass:null,pageSize:null},f=storedCase(id,{request});
 const out=JSON.parse(await f.handler()(f.call()));assert.deepEqual(f.wire[0].body,request);
 assert.equal(f.call().input.query,'');assert.equal(f.call().input.pageSize,50);assert.equal(f.call().input.queryClass,'lookup');
 assert.deepEqual(f.call().input.domains,['mail']);assert.equal(f.call().input.clientId,null);
 assert.equal(Object.hasOwn(f.wire[0].body,'clientId'),false);assert.equal(Object.hasOwn(f.wire[0].body,'window'),false);
 assert.deepEqual(out.result,f.page);assert.equal(out.result.coverage.complete,false);
});

test('bounded explicit window and memory selectors stay raw selectors, never an authority envelope',async()=>{
 const clientId='71000000-0000-4000-8000-000000000091',memoryItemId='71000000-0000-4000-8000-000000000092';
 const request={query:' Read approved memory ',domains:['institutional_knowledge'],queryClass:'semantic_recall',clientId,memoryItemId,
  windowStart:'2026-10-01T00:00:00+02:00',windowEnd:'2026-10-02T00:00:00Z'};
 const f=storedCase(id,{request}),out=JSON.parse(await f.handler()(f.call()));assert.deepEqual(f.wire[0].body,request);
 assert.equal(f.call().input.clientId,clientId);assert.equal(f.call().input.memoryItemId,memoryItemId);
 assert.deepEqual(f.call().input.window,{startInclusive:request.windowStart,endExclusive:request.windowEnd});
 assert.equal(Object.hasOwn(out.result,'subject'),false);assert.equal(Object.hasOwn(out.result,'authorizedClientIds'),false);
 assert.equal(f.contract.normalizeInput(request,{}).metadata.clientScope.authoritative,false);
});

test('coverage, opaque provenance and continuation survive without adapter pagination or prompt truncation',async()=>{
 const f=storedCase();f.state.resultMutator=page=>page.records[0].payload.text='x'.repeat(30000);
 const out=JSON.parse(await f.handler()(f.call()));assert.deepEqual(out.result.coverage,f.page.coverage);
 assert.deepEqual(out.result.observability,f.page.observability);assert.deepEqual(out.result.records[0].provenance,f.page.records[0].provenance);
 assert.equal(out.result.records[0].payload.text.length,30000);assert.equal(out.result.coverage.sources[0].nextCursor,continuation);
 assert.equal(out.result.coverage.sources[1].stopReason,'mailbox_not_connected');assert.equal(f.wire.length,1);
});

test('follow-up cursor is sent unchanged with a new request proof and current decision',async()=>{
 const f=storedCase(),execute=f.handler();await execute(f.call());
 const request={...f.arguments,cursors:{strategies_work:continuation}};
 f.state.resultMutator=page=>page.records[0].recordId='synthetic-record-2';
 const out=JSON.parse(await execute(f.call(request)));assert.deepEqual(f.wire[1].body,request);
 assert.equal(f.credentialCalls[1].requestSha256,hash(request));assert.notEqual(f.credentialCalls[1].requestSha256,f.credentialCalls[0].requestSha256);
 assert.equal(out.result.records[0].recordId,'synthetic-record-2');assert.equal(f.wire.length,2);
 f.authority.decision.decision='denied';await assert.rejects(execute(f.call(request)),{message:'ACCESS_DENIED'});
 assert.equal(f.credentialCalls.length,2);assert.equal(f.wire.length,2);
});

test('source failure coverage stays explicit rather than turning empty records into complete absence',async()=>{
 for(const [status,reason] of [['unavailable','adapter_not_registered:synthetic'],['unauthorized','mailbox_not_authorized'],
  ['unsupported','query_class_unsupported'],['error','adapter_execution_failed'],['degraded','source_snapshot_stale']]){
  const f=storedCase();f.state.page=structuredClone(f.page);const page=f.state.page;page.records=[];
  page.coverage.recordsReturned=0;page.coverage.sources[0]={...page.coverage.sources[0],sourceStatus:status,returned:0,
   hasMore:false,stopReason:reason};delete page.coverage.sources[0].nextCursor;
  page.observability.sourceHealth.strategies_work=status;page.coverage.stopReason=reason;page.observability.stopReason=reason;
  const out=JSON.parse(await f.handler()(f.call()));assert.deepEqual(out.result,page);assert.equal(out.result.coverage.complete,false);
  assert.equal(Object.hasOwn(out.result,'absenceEvidence'),false);assert.equal(f.wire.length,1);
 }
});

test('native pagination failure reasons and opaque cursors are not repaired or retried by the adapter',async()=>{
 for(const reason of ['retrieval_deadline_reached','source_has_more_without_cursor','source_cursor_cycle','exhaustive_page_safety_cap_reached']){
  const f=storedCase(id,{request:{query:'',domains:['strategies_work'],queryClass:'exhaustive_search'}});
  f.state.resultMutator=page=>{page.coverage.sources[0].stopReason=reason;page.coverage.sources[0].truncated=true;page.coverage.stopReason=reason;};
  const out=JSON.parse(await f.handler()(f.call()));assert.equal(out.result.coverage.sources[0].stopReason,reason);
  assert.equal(out.result.coverage.sources[0].nextCursor,continuation);assert.equal(out.result.coverage.complete,false);assert.equal(f.wire.length,1);
 }
});

test('adapter does not invent count, observability or completeness relations left unproven by the frozen contract',async()=>{
 const f=storedCase();f.state.resultMutator=page=>{page.records=[];page.coverage.recordsReturned=17;
  page.observability.queryClass='portfolio_scan';page.observability.coverageComplete=true;};
 const out=JSON.parse(await f.handler()(f.call()));assert.equal(out.result.records.length,0);assert.equal(out.result.coverage.recordsReturned,17);
 assert.equal(out.result.coverage.complete,false);assert.equal(out.result.observability.coverageComplete,true);
 assert.equal(out.result.observability.queryClass,'portfolio_scan');
});

test('native Date-valued evidence and freshness cross actual JSON bytes without a result projection',async()=>{
 const f=storedCase();f.state.resultMutator=page=>{
  page.records[0].occurredAt=new Date(f.now());page.records[0].updatedAt=new Date(f.now());
  page.coverage.sources[0].lastSyncAt=new Date(f.now());page.observability.freshnessByDomain.strategies_work=new Date(f.now());
 };
 const out=JSON.parse(await f.handler()(f.call())),stamp=new Date(f.now()).toISOString();
 assert.ok(f.state.nativeValue.records[0].occurredAt instanceof Date);assert.equal(out.result.records[0].occurredAt,stamp);
 assert.equal(out.result.records[0].updatedAt,stamp);assert.equal(out.result.coverage.sources[0].lastSyncAt,stamp);
 assert.equal(out.result.observability.freshnessByDomain.strategies_work,stamp);
});

test('unsupported selectors and model-supplied authority are rejected before credentials or native reads',async()=>{
 const f=storedCase();
 for(const extra of [{caller:{tenantId:'other'}},{authorizedClientIds:[]},{authorizedMailboxConnectionIds:[]},
  {sourceId:'mail'},{tenantId:'other'},{domains:[]},{domains:['invented']},{query:'x'.repeat(4001)},{pageSize:'2'},
  {cursors:{hearings:'not-requested'}},{queryClass:'portfolio_scan'},{clientId:null},{memoryItemId:'invalid'},
  {windowStart:'2026-10-01T00:00:00Z'}]){
  await assert.rejects(f.handler()({...f.call(),request:{...f.arguments,...extra}}),{message:'INVALID_ARGUMENTS'});
 }
 await assert.rejects(f.handler()({...f.call(),normalizationContext:{tenantId:'other'}}),{message:'INVALID_ARGUMENTS'});
 await assert.rejects(f.handler()({...f.call(),argumentsSha256:'0'.repeat(64)}),{message:'INVALID_ARGUMENTS'});
 assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
});

test('current tenant, actor, operation, grants and declared source set must match before credential IO',async()=>{
 for(const mutate of [a=>a.claims.audience='other',a=>a.claims.actions=[],a=>a.binding.tenantId='other',
  a=>a.decision.actor.actorId='other',a=>a.decision.operation='other@0.2.0',a=>a.decision.decision='denied',
  a=>a.decision.scopes=[],a=>a.sourceIds=['mail'],a=>a.claims.issuedAt=new Date(a.deadlineMs).toISOString()]){
  const f=storedCase(),call=structuredClone(f.call());mutate(call.authority);await assert.rejects(f.handler()(call));
  assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
 }
});

test('native credentials bind the exact current proof and expire without a static fallback',async()=>{
 for(const key of ['binding','subject','operation','policyRevision','sourceIds','requestSha256','argumentsSha256',
  'normalizationContext','origin','bearerToken','serviceSecret','expiresAtMs']){
  const f=storedCase();f.state.credentialMutator=proof=>proof[key]=key==='expiresAtMs'?f.now():null;
  await assert.rejects(f.handler()(f.call()),{message:'ACCESS_DENIED'});assert.equal(f.wire.length,0);
 }
 const f=storedCase();await assert.rejects(f.handler({getCredentials:undefined})(f.call()),{message:'UNAVAILABLE'});assert.equal(f.wire.length,0);
});

test('source authorization and governed-service failures cannot become successful empty results',async()=>{
 for(const [status,message] of [[404,'Client not found'],[503,'Governed retrieval did not run; no data was searched'],
  [503,'Shared retrieval is unavailable; no data was searched'],[500,'Security scope unavailable']]){
  const f=storedCase();f.state.responseFactory=()=>Response.json({statusCode:status,message},{status});
  await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});assert.equal(f.wire.length,1);
 }
});

test('closed result envelope refuses incompatible DTOs, new authority fields and malformed record/provenance shapes',async()=>{
 for(const mutate of [page=>page.authoritative=true,page=>page.complete=true,page=>page.tool='query_global_data',
  page=>delete page.coverage,page=>page.coverage.sources[0].sourceStatus='complete',page=>page.records[0].provenance='not-an-object',
  page=>page.records[0].grant='invented',page=>page.observability.freshnessByDomain.strategies_work='not-a-date']){
  const f=storedCase();f.state.resultMutator=mutate;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
});

test('response bytes, media and redirects remain bounded and fail closed',async()=>{
 const f=storedCase();await assert.rejects(f.handler({maxResponseBytes:16})(f.call()),{message:'RESOURCE_LIMIT'});
 for(const response of [()=>new Response('{}',{headers:{'content-type':'text/html'}}),
  ()=>new Response('{}',{status:302,headers:{location:'https://other.example.invalid'}}),
  ()=>new Response('{}',{headers:{'content-type':'application/json','content-length':'99999999'}})]){
  const f=storedCase();f.state.responseFactory=response;await assert.rejects(f.handler()(f.call()));
 }
});

test('original deadline and abort prevent work or withhold a fetched response',async()=>{
 const f=storedCase();await assert.rejects(f.handler()({...f.call(),signal:AbortSignal.abort()}),{message:'CANCELLED'});assert.equal(f.wire.length,0);
 const g=storedCase(),controller=new AbortController();g.state.afterSource=()=>controller.abort();
 await assert.rejects(g.handler()({...g.call(),signal:controller.signal}),{message:'CANCELLED'});
 const h=storedCase();h.state.now=h.authority.deadlineMs;await assert.rejects(h.handler()(h.call()),{message:'DEADLINE'});assert.equal(h.wire.length,0);
});

test('per-call credential composition has one current owner and no static fallback',async()=>{
 const f=storedCase(),call=f.call(),{getCredentials,...configuration}=f.transport;let captured;
 const [handler]=createDataSearchHandlers({...configuration,now:f.now,credentialsForCall:(operation,original)=>{
  captured={operation,original};return getCredentials;
 }},[f.operation]);
 await handler.execute(call);assert.deepEqual(captured.operation,f.operation);assert.equal(captured.original,call);
 assert.throws(()=>f.handler({credentialsForCall:()=>getCredentials}),{message:'GATEWAY_CONFIGURATION'});
});

test('only the exact governed native read route is constructible, without Explorer or arbitrary endpoint escape',()=>{
 const f=storedCase(),configuration={...f.transport,now:f.now};
 for(const operations of [[],[f.operation,f.operation],[{id:'query_global_data',version:'0.2.0'}],
  [{id:'search_capiro_data',version:'0.1.0'}]])assert.throws(()=>createDataSearchHandlers(configuration,operations),{message:'GATEWAY_CONFIGURATION'});
 assert.throws(()=>createDataSearchHandlers({...configuration,origin:'https://native-core.example.invalid/explorer'},[f.operation]),{message:'GATEWAY_CONFIGURATION'});
 assert.throws(()=>createDataSearchHandlers({...configuration,endpoint:'/explorer/query'},[f.operation]));
 assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
});
