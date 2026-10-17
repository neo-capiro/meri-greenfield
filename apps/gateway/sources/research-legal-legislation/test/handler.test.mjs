/** Synthetic legal DTOs through actual bounded JSON and canonical receiving; no legal/source/rights qualification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {createResearchLegalLegislationHandlers} from '../handler.mjs';
import {assertUnscopedLegalRequest,legalLegislationContext} from '../request-context.mjs';
import {storedCase,ids,version,authorityNote,searchMessage} from './fixture.mjs';

for(const id of ids){
 test(`${id}: fixed flat native POST preserves null context, source result and private carrier`,async()=>{
  const f=storedCase(id),call=f.call(),out=JSON.parse(await f.handler()(call)),[wire]=f.wire,[proof]=f.credentialCalls;
  assert.deepEqual(out,{binding:f.authority.binding,subject:f.authority.subject,operation:f.operation,argumentsSha256:call.argumentsSha256,result:f.page});
  assert.equal(wire.url,`https://native-core.example.invalid/api/clio/tools/${id}`);assert.equal(wire.options.method,'POST');assert.deepEqual(wire.body,f.arguments);
  assert.equal(wire.options.headers.authorization,'Bearer SYNTHETIC_NATIVE_USER');assert.equal(wire.options.headers['x-internal-service-secret'],'SYNTHETIC_INTERNAL_SERVICE');
  assert.equal(wire.options.redirect,'error');assert.equal(wire.options.credentials,'omit');assert.equal(wire.options.cache,'no-store');
  assert.equal(proof.requestSha256,hash(f.arguments));assert.equal(proof.argumentsSha256,call.argumentsSha256);assert.deepEqual(proof.normalizationContext,legalLegislationContext);
  assert.equal(out.result.authority,authorityNote);assert.equal(Object.hasOwn(out.result,'complete'),false);
  for(const value of Object.values(f.contract.normalizeInput(f.arguments,legalLegislationContext).metadata))assert.equal(value,false);
 });
 test(`${id}: names need a coherent trusted context; folders are delegated to the native ResearchService gate`,async()=>{
  const f=storedCase(id);
  for(const extra of [{clientId:'Client name'},{clientId:' Client name '},
   {folderId:'private-folder'},{folderId:' '}]){
   const request={...f.arguments,...extra};assert.throws(()=>assertUnscopedLegalRequest(f.operation,request),{message:'UNAVAILABLE'});
   if(extra.folderId){const selected=storedCase(id,{request});
    assert.deepEqual(JSON.parse(await selected.handler()(selected.call())).result,selected.page);assert.deepEqual(selected.wire[0].body,request);
   }else await assert.rejects(f.handler()({...f.call(),request}),{message:'INVALID_ARGUMENTS'});
  }
  assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
 });
 test(`${id}: explicit null/blank absent scope remains unscoped and raw selectors survive`,async()=>{
  const request={...storedCase(id).arguments,clientId:'   ',folderId:'',jurisdiction:null},f=storedCase(id,{request});
  const out=JSON.parse(await f.handler()(f.call()));assert.deepEqual(f.wire[0].body,request);
  assert.deepEqual(out.result.result.scope,{jurisdiction:'FL',sessionKey:request.sessionKey??'',folderId:null,clientId:null});
 });
 test(`${id}: current tenant, actor, exact operation and source grants are required before credentials`,async()=>{
  for(const mutate of [a=>a.claims.audience='other',a=>a.claims.actions=[],a=>a.binding.tenantId='other',
   a=>a.decision.actor.actorId='other',a=>a.decision.operation='other@0.2.0',a=>a.decision.decision='denied',
   a=>a.decision.scopes=[],a=>a.sourceIds=[]]){
   const f=storedCase(id),call=structuredClone(f.call());mutate(call.authority);await assert.rejects(f.handler()(call));
   assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
  }
 });
 test(`${id}: caller authority, fake observations, invalid context and digest substitution cannot fetch`,async()=>{
  const f=storedCase(id);
  for(const extra of [{tenantId:'other'},{actor:'other'},{clientResolution:null},{citationResolution:null},{sourceFingerprint:'fake'}])
   await assert.rejects(f.handler()({...f.call(),request:{...f.arguments,...extra}}),{message:'INVALID_ARGUMENTS'});
  await assert.rejects(f.handler()({...f.call(),normalizationContext:{}}),{message:'INVALID_ARGUMENTS'});
  await assert.rejects(f.handler()({...f.call(),argumentsSha256:'0'.repeat(64)}),{message:'INVALID_ARGUMENTS'});
  assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
 });
 test(`${id}: every native credential proof correlation and both native secrets are mandatory`,async()=>{
  for(const key of ['binding','subject','operation','policyRevision','sourceIds','requestSha256','argumentsSha256',
   'normalizationContext','origin','bearerToken','serviceSecret','expiresAtMs']){
   const f=storedCase(id);f.state.credentialMutator=proof=>proof[key]=key==='expiresAtMs'?f.now():null;
   await assert.rejects(f.handler()(f.call()),{message:'ACCESS_DENIED'});assert.equal(f.wire.length,0);
  }
 });
 test(`${id}: feature/member/source/cursor failures cannot become successful empty source results`,async()=>{
  for(const message of ['FEATURE_DISABLED','CURRENT_MEMBER_REQUIRED','RESEARCH_CLIENT_UNAVAILABLE','SEARCH_CHANGED_RESTART','QUERY_REQUIRES_REVIEW']){
   const f=storedCase(id);f.state.responseFactory=()=>Response.json({message},{status:400});
   await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});assert.equal(f.wire.length,1);
  }
 });
 test(`${id}: raw DTO scope and source authority cannot be substituted on receipt`,async()=>{
  for(const mutate of [page=>page.result.scope.clientId='71000000-0000-4000-8000-000000000091',page=>page.result.scope.folderId='private',
   page=>page.result.scope.jurisdiction='GA',page=>page.result.scope.sessionKey='2025',page=>page.authority='Current law verified',
   page=>page.complete=true,page=>page.tool='other']){
   const f=storedCase(id);f.state.resultMutator=mutate;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
  }
 });
}

test('parser-dependent reference citations remain UNAVAILABLE with implicit identity or an effective edition',async()=>{
 for(const view of ['statutes','references','unknown-view',null])for(const citation of ['1.10','Article I',' '])for(const selection of [{},{referenceId:'explicit',edition:'2026'}]){
  const f=storedCase('get_legal_reference'),request={view,sessionKey:'2026',billId:'bill',citation,...selection};
  assert.throws(()=>assertUnscopedLegalRequest(f.operation,request),{message:'UNAVAILABLE'});
  await assert.rejects(f.handler()({...f.call(),request}),{message:'UNAVAILABLE'});assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
 }
});

test('reference empty/null/absent citation uses explicit reference identity without fabricated parsing context',async()=>{
 for(const citation of [undefined,null,'']){
  const request={sessionKey:'2026',referenceId:'FL:statute:section:1:1.10',edition:'2026',...(citation===undefined?{}:{citation})};
  const f=storedCase('get_legal_reference',{request}),out=JSON.parse(await f.handler()(f.call()));
  assert.equal(out.result.result.referenceId,request.referenceId);assert.equal(out.result.result.edition,'2026');
  assert.equal(out.result.result.rows[0].section,'1.10');assert.equal(out.result.result.rows[0].revision_id,null);
  assert.deepEqual(f.wire[0].body,request);assert.deepEqual(f.credentialCalls[0].normalizationContext,legalLegislationContext);
 }
});

test('fabricated empty-citation resolution cannot introduce a reference while bypassing the unscoped preflight',async()=>{
 const f=storedCase('get_legal_reference',{request:{view:'statutes'}}),context={clientResolution:null,
  citationResolution:{citation:'',referenceId:'invented-reference',code:'statute'}};
 await assert.rejects(f.handler()(f.call(f.arguments,f.authority,context)),{message:'ACCESS_DENIED'});
 assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
});

test('search keeps selected bill ordering, filters, source inventory caveat and no implicit completeness',async()=>{
 const request={sessionKey:'2026',billIds:['bill-b','bill-a','bill-a'],kind:'text',versionPolicy:'current_extractions',
  versionStage:'enrolled',chamber:'lower',title:'Stored',sponsor:'Sponsor',action:'Action'},f=storedCase(ids[0],{request});
 const out=JSON.parse(await f.handler()(f.call()));assert.deepEqual(f.wire[0].body,request);
 assert.deepEqual(out.result.result.coverage.billIds,['bill-a','bill-b']);assert.equal(out.result.result.items[0].billId,'bill-a');
 assert.equal(out.result.result.coverage.complete,false);assert.equal(out.result.result.message,searchMessage(false));
 f.state.resultMutator=page=>page.result.coverage.complete=true;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
});

test('search query interpretation and first excerpt preserve exact evidence offsets without a second parser',async()=>{
 const f=storedCase(ids[0],{request:{sessionKey:'2026',query:'water'}}),out=JSON.parse(await f.handler()(f.call()));
 assert.equal(out.result.result.interpretedQuery.raw,'water');assert.deepEqual(out.result.result.items[0].excerpt,
  {start:0,end:5,quote:'water',expression:'water'});
 for(const mutate of [page=>page.result.interpretedQuery.raw='other',page=>page.result.items[0].evaluation.evidence[0].end=6,
  page=>page.result.items[0].excerpt={...page.result.items[0].excerpt,quote:'other'},page=>page.result.items[0].evaluation.complete=true]){
  f.state.resultMutator=mutate;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
});

test('search opaque continuation is forwarded unchanged with a fresh request proof and no adapter page loop',async()=>{
 const f=storedCase(ids[0],{request:{sessionKey:'2026',query:'water'}}),execute=f.handler(),cursor='SYNTHETIC_OPAQUE_CURSOR';
 f.state.resultMutator=page=>{page.result.scanned=25;page.result.cursor=cursor;};
 const first=JSON.parse(await execute(f.call()));assert.equal(first.result.result.cursor,cursor);assert.equal(f.wire.length,1);
 const request={...f.arguments,cursor};await execute(f.call(request));assert.equal(f.wire[1].body.cursor,cursor);
 assert.equal(f.credentialCalls[1].requestSha256,hash(request));assert.notEqual(f.credentialCalls[1].requestSha256,f.credentialCalls[0].requestSha256);
 assert.equal(f.wire.length,2);f.state.responseFactory=()=>Response.json({message:'SEARCH_CHANGED_RESTART'},{status:400});
 await assert.rejects(execute(f.call(request)),{message:'INVALID_RESULT'});assert.equal(f.wire.length,3);
});

test('search filtered empty page with scanned25 and cursor stays incomplete, not evidence of absence',async()=>{
 const f=storedCase(ids[0],{request:{sessionKey:'2026',query:'water'}});f.state.resultMutator=page=>{
  page.result.items=[];page.result.scanned=25;page.result.cursor='SYNTHETIC_NEXT';
 };
 const out=JSON.parse(await f.handler()(f.call()));assert.equal(out.result.result.items.length,0);
 assert.equal(out.result.result.coverage.complete,false);assert.equal(out.result.result.cursor,'SYNTHETIC_NEXT');
 assert.equal(Object.hasOwn(out.result,'absenceEvidence'),false);
});

test('reference versions preserve source-identity order and the selected bill without claiming legislative chronology',async()=>{
 const request={view:'versions',billId:'bill-a',sessionKey:'2026'},f=storedCase('get_legal_reference',{request});
 f.state.page={...f.page,result:{...f.page.result,versions:[version(f.call().input,f.now(),'a'),version(f.call().input,f.now()-1000,'b')]}};
 const out=JSON.parse(await f.handler()(f.call()));assert.equal(out.result.result.order,'source_identity_not_legislative_sequence');
 assert.deepEqual(out.result.result.versions.map(row=>row.id),['a','b']);
 f.state.resultMutator=page=>page.result.versions[0].billId='other';await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
});

test('rules preserve opaque notice/adopted payload and selected-notice history coverage',async()=>{
 const f=storedCase('get_legal_reference',{request:{view:'rules',ruleNumber:'1.10',noticeId:'notice'}});
 f.state.resultMutator=page=>page.result.adopted.push({id:'adopted',title:'Stored adopted text',source_url:'opaque locator',
  content_hash:'source hash',extraction_hash:'extract hash',sections:{opaque:[null,true]},complete:false,
  coverage:{retained:true},observed_at:f.page.generatedAt});
 const out=JSON.parse(await f.handler()(f.call()));assert.deepEqual(out.result.result.adopted[0].sections,{opaque:[null,true]});
 assert.deepEqual(out.result.result.coverage,{complete:false,reason:'SELECTED_NOTICES_AND_HISTORY_ONLY'});
 f.state.resultMutator=page=>page.result.rows[0].notice_id='other';await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
});

test('all other reference view values use existing references branch and constitution keeps edition suppressed',async()=>{
 for(const view of ['statutes','unknown-view',null]){
  const f=storedCase('get_legal_reference',{request:{view,code:'constitution',edition:'not-a-year'}});
  const out=JSON.parse(await f.handler()(f.call()));assert.equal(out.result.result.edition,null);
  assert.equal(out.result.result.coverage.reason,'SELECTED_INGESTED_REFERENCES_ONLY');assert.equal(f.wire[0].body.view,view);
 }
});

test('actual JSON date bytes survive while missing joined revision columns cannot acquire invented metadata',async()=>{
 const f=storedCase('get_legal_reference',{request:{referenceId:'explicit'}});f.state.resultMutator=page=>{
  page.generatedAt=new Date(f.now());page.result.rows[0].created_at=new Date(f.now());
 };
 const out=JSON.parse(await f.handler()(f.call()));assert.ok(f.state.nativeValue.generatedAt instanceof Date);
 assert.equal(out.result.result.rows[0].created_at,new Date(f.now()).toISOString());
 f.state.resultMutator=page=>page.result.rows[0].title='Orphan revision title';await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
});

test('early preflight admits inert request shapes only and cannot execute hostile hooks or widen its operation family',()=>{
 const f=storedCase();let effects=0;const hostile={sessionKey:'2026',get clientId(){effects++;return 'Client';}};
 assert.throws(()=>assertUnscopedLegalRequest(f.operation,hostile),{message:'INVALID_ARGUMENTS'});
 assert.throws(()=>assertUnscopedLegalRequest(f.operation,new Proxy({sessionKey:'2026'},{get(){effects++;throw Error('hook');}})),{message:'INVALID_ARGUMENTS'});
 assert.throws(()=>assertUnscopedLegalRequest({id:'search_state_bills',version:'0.2.0'},{}),{message:'GATEWAY_CONFIGURATION'});
 assert.equal(effects,0);
});

test('cancellation, deadline, missing credential owner and bounded response stop or withhold source bytes',async()=>{
 const f=storedCase();await assert.rejects(f.handler()({...f.call(),signal:AbortSignal.abort()}),{message:'CANCELLED'});assert.equal(f.wire.length,0);
 const g=storedCase();g.state.now=g.authority.deadlineMs;await assert.rejects(g.handler()(g.call()),{message:'DEADLINE'});assert.equal(g.wire.length,0);
 const h=storedCase();await assert.rejects(h.handler({getCredentials:undefined})(h.call()),{message:'UNAVAILABLE'});assert.equal(h.wire.length,0);
 await assert.rejects(f.handler({maxResponseBytes:16})(f.call()),{message:'RESOURCE_LIMIT'});
 const k=storedCase(),controller=new AbortController();k.state.afterSource=()=>controller.abort();
 await assert.rejects(k.handler()({...k.call(),signal:controller.signal}),{message:'CANCELLED'});
});

test('per-call credential factory cannot run for a name with an unrelated retained null context',async()=>{
 const f=storedCase(),{getCredentials,...configuration}=f.transport;let factories=0;
 const [handler]=createResearchLegalLegislationHandlers({...configuration,now:f.now,credentialsForCall:()=>{factories++;return getCredentials;}},[f.operation]);
 await assert.rejects(handler.execute({...f.call(),request:{...f.arguments,clientId:'Client name'}}),{message:'INVALID_ARGUMENTS'});
 assert.equal(factories,0);assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
 await handler.execute(f.call());assert.equal(factories,1);assert.equal(f.wire.length,1);
});

test('constructor admits exactly the two fixed native legal reads and no caller-selected bridge endpoint',()=>{
 const f=storedCase(),configuration={...f.transport,now:f.now};
 for(const operations of [[],[f.operation,f.operation],[{id:'save_legislative_research',version:'0.2.0'}],
  [{id:'get_legal_reference',version:'0.1.0'}]])assert.throws(()=>createResearchLegalLegislationHandlers(configuration,operations),{message:'GATEWAY_CONFIGURATION'});
 assert.throws(()=>createResearchLegalLegislationHandlers({...configuration,origin:'https://native-core.example.invalid/other'},[f.operation]),{message:'GATEWAY_CONFIGURATION'});
 assert.throws(()=>createResearchLegalLegislationHandlers({...configuration,endpoint:'/intel-api/internal/legiwatch/meri/apply'},[f.operation]));
 assert.equal(f.wire.length,0);
});
