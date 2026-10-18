/** Typed retained JSON through fixed native transport and frozen receiving; no live publisher/personnel qualification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {createResearchLegalNewsHandlers} from '../handler.mjs';
import {assertUnscopedNewsRequest,newsSliceContext} from '../request-context.mjs';
import {storedCase,person,authorityNote,personnelNotice} from './fixture.mjs';

const id='search_legiwatch_news',sourceKinds=['news','budget','personnel','research'];
const selections=[...sourceKinds.map(kind=>({view:'source',kind,id:'synthetic-source',sessionKey:'2026'})),
 {view:'personnel',year:'2026',kind:'registration',branch:'executive',offset:'2.9',q:' '+ 'x'.repeat(205),sessionKey:'2026'}];
for(const request of selections){
 test(`${request.view}/${request.kind}: fixed flat POST preserves five request-determined context fields and private result`,async()=>{
  const f=storedCase(id,{request}),call=f.call(),out=JSON.parse(await f.handler()(call)),[wire]=f.wire,[proof]=f.credentialCalls;
  assert.deepEqual(out,{binding:f.authority.binding,subject:f.authority.subject,operation:f.operation,argumentsSha256:call.argumentsSha256,result:f.page});
  assert.equal(wire.url,'https://native-core.example.invalid/api/clio/tools/search_legiwatch_news');assert.equal(wire.options.method,'POST');
  assert.deepEqual(wire.body,request);assert.equal(wire.options.headers.authorization,'Bearer SYNTHETIC_NATIVE_USER');
  assert.equal(wire.options.headers['x-internal-service-secret'],'SYNTHETIC_INTERNAL_SERVICE');assert.equal(wire.options.redirect,'error');
  assert.equal(wire.options.credentials,'omit');assert.equal(wire.options.cache,'no-store');
  assert.equal(proof.requestSha256,hash(request));assert.equal(proof.argumentsSha256,call.argumentsSha256);
  assert.deepEqual(proof.normalizationContext,{clientResolution:null,effectiveScope:{jurisdiction:'FL',sessionKey:'2026',folderId:null,clientId:null},
   windowAsOf:null,defaultYear:null,owner:null});
  assert.equal(out.result.authority,authorityNote);assert.equal(Object.hasOwn(out.result,'absenceEvidence'),false);
  for(const value of Object.values(f.contract.normalizeInput(request,f.normalizationContext).metadata))assert.equal(value,false);
 });
 test(`${request.view}/${request.kind}: names need a trusted resolution and a folder alone is withheld before any native credential or HTTP`,async()=>{
  const f=storedCase(id,{request});
  for(const extra of [{clientId:'Client name'},{clientId:' Client name '}]){
   const raw={...request,...extra};assert.throws(()=>assertUnscopedNewsRequest(f.operation,raw),{message:'UNAVAILABLE'});
   await assert.rejects(f.handler()({...f.call(),request:raw}),{message:'INVALID_ARGUMENTS'});
  }
  // A folder without an explicit client takes the folder's unobserved private client natively.
  for(const extra of [{folderId:'private-folder'},{folderId:' '}]){
   const raw={...request,...extra};assert.throws(()=>assertUnscopedNewsRequest(f.operation,raw),{message:'UNAVAILABLE'});
   await assert.rejects(f.handler()({...f.call(),request:raw}),{message:'UNAVAILABLE'});
  }
  assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
 });
 test(`${request.view}/${request.kind}: a folder with an explicit current client keeps the request-determined effective scope`,async()=>{
  const client='a1234567-b123-4c12-8d12-e123456789ab';
  for(const folderId of ['private-folder',' ']){
   const raw={...request,clientId:client,folderId},f=storedCase(id,{request:raw}),out=JSON.parse(await f.handler()(f.call()));
   assert.deepEqual(f.wire[0].body,raw);assert.deepEqual(f.normalizationContext.effectiveScope,{jurisdiction:'FL',sessionKey:raw.sessionKey??'',folderId,clientId:client});
   assert.deepEqual(out.result,JSON.parse(JSON.stringify(f.page)));
  }
 });
}

test('ordinary news, unknown/default view, monitors and default-year personnel are UNAVAILABLE even with fabricated context',async()=>{
 const f=storedCase();
 for(const request of [{},{view:'news'},{view:'unknown'},{view:null},{view:'monitors'},{view:'personnel'},{view:'personnel',year:null}]){
  assert.throws(()=>assertUnscopedNewsRequest(f.operation,request),{message:'UNAVAILABLE'});
  await assert.rejects(f.handler()({...f.call(),request,normalizationContext:{...f.normalizationContext,windowAsOf:f.page.generatedAt,defaultYear:2026,
   owner:{tenantId:f.authority.binding.tenantId,clerkUserId:f.authority.binding.actorId}}}),{message:'UNAVAILABLE'});
 }
 assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
});

test('malformed exact source and explicit-year selectors fail canonical admission before even a credential factory',async()=>{
 const f=storedCase(),{getCredentials,...configuration}=f.transport;let factories=0;
 const [handler]=createResearchLegalNewsHandlers({...configuration,now:f.now,credentialsForCall:()=>{factories++;return getCredentials;}},[f.operation]);
 for(const request of [{view:'source',kind:'other',id:'source'},{view:'source',kind:'news'},{view:'source',kind:'news',id:''},
  {view:'source',kind:'news',id:'x'.repeat(201)},{view:'source',kind:'news',id:12},
  {view:'personnel',year:'not a year'},{view:'personnel',year:2026.1},{view:'personnel',year:2147483648},
  {view:'personnel',year:2026,kind:'other'},{view:'personnel',year:2026,branch:'other'},{view:'personnel',year:2026,offset:10001}]){
  assert.throws(()=>assertUnscopedNewsRequest(f.operation,request),{message:'INVALID_ARGUMENTS'});
  await assert.rejects(handler.execute({...f.call(),request}),{message:'INVALID_ARGUMENTS'});
 }
 assert.equal(factories,0);assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
});

test('unsupported branch and selected scope preflight precede per-call credential factory',async()=>{
 const f=storedCase(),{getCredentials,...configuration}=f.transport;let factories=0;
 const [handler]=createResearchLegalNewsHandlers({...configuration,now:f.now,credentialsForCall:()=>{factories++;return getCredentials;}},[f.operation]);
 for(const request of [{view:'news'},{view:'monitors'},{view:'personnel'},{...f.arguments,folderId:'private-folder'}])
  await assert.rejects(handler.execute({...f.call(),request}),{message:'UNAVAILABLE'});
 // An unresolved name cannot normalize without the owner's native resolution.
 await assert.rejects(handler.execute({...f.call(),request:{...f.arguments,clientId:'Client'}}),{message:'INVALID_ARGUMENTS'});
 assert.equal(factories,0);assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
 await handler.execute(f.call());assert.equal(factories,1);assert.equal(f.wire.length,1);
});

test('absent, null and blank scope use exact FL context while uninterpreted raw values stay unchanged',async()=>{
 for(const extra of [{},{clientId:null,folderId:null,sessionKey:null},{clientId:'   ',folderId:'',sessionKey:'source-session'}]){
  const request={view:'source',kind:'research',id:'source',...extra},f=storedCase(id,{request});
  const out=JSON.parse(await f.handler()(f.call()));assert.deepEqual(f.wire[0].body,request);
  assert.deepEqual(f.credentialCalls[0].normalizationContext.effectiveScope,{jurisdiction:'FL',sessionKey:request.sessionKey??'',folderId:null,clientId:null});
  assert.equal(out.result.result.authority,'Published legislative record');assert.ok(Object.isFrozen(newsSliceContext(f.operation,request).effectiveScope));
 }
});

test('caller observations, authority fields, missing context and digest substitution cannot fetch',async()=>{
 const f=storedCase();
 for(const extra of [{tenantId:'other'},{actor:'other'},{clientResolution:null},{windowAsOf:f.page.generatedAt},{defaultYear:2026},
  {owner:null},{effectiveScope:f.normalizationContext.effectiveScope},{jurisdiction:'FL'}])
  await assert.rejects(f.handler()({...f.call(),request:{...f.arguments,...extra}}),{message:'INVALID_ARGUMENTS'});
 for(const context of [{},{...f.normalizationContext,defaultYear:2026},{...f.normalizationContext,windowAsOf:f.page.generatedAt},
  {...f.normalizationContext,owner:{tenantId:'tenant',clerkUserId:'actor'}},
  {...f.normalizationContext,effectiveScope:{...f.normalizationContext.effectiveScope,sessionKey:'other'}},
  {...f.normalizationContext,effectiveScope:{...f.normalizationContext.effectiveScope,clientId:'71000000-0000-4000-8000-000000000091'}}])
  await assert.rejects(f.handler()({...f.call(),normalizationContext:context}),{message:'INVALID_ARGUMENTS'});
 await assert.rejects(f.handler()({...f.call(),argumentsSha256:'0'.repeat(64)}),{message:'INVALID_ARGUMENTS'});
 assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
});

test('current tenant, actor, exact operation, source and grant decision remain mandatory',async()=>{
 for(const mutate of [a=>a.claims.audience='other',a=>a.claims.actions=[],a=>a.binding.tenantId='other',a=>a.decision.actor.actorId='other',
  a=>a.decision.operation='other@0.2.0',a=>a.decision.decision='denied',a=>a.decision.scopes=[],a=>a.sourceIds=[]]){
  const f=storedCase(),call=structuredClone(f.call());mutate(call.authority);await assert.rejects(f.handler()(call));
  assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
 }
});

test('every credential proof correlation plus native user and service identities is required',async()=>{
 for(const key of ['binding','subject','operation','policyRevision','sourceIds','requestSha256','argumentsSha256','normalizationContext','origin',
  'bearerToken','serviceSecret','expiresAtMs']){
  const f=storedCase();f.state.credentialMutator=proof=>proof[key]=key==='expiresAtMs'?f.now():null;
  await assert.rejects(f.handler()(f.call()),{message:'ACCESS_DENIED'});assert.equal(f.wire.length,0);
 }
});

test('actual native source/feature/current-member failures cannot become empty success or trigger another branch',async()=>{
 for(const message of ['FEATURE_DISABLED','CURRENT_MEMBER_REQUIRED','NEWS_SOURCE_NOT_FOUND','BUDGET_SOURCE_NOT_FOUND','RESEARCH_CLIENT_UNAVAILABLE']){
  const f=storedCase();f.state.responseFactory=()=>Response.json({message},{status:400});
  await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});assert.equal(f.wire.length,1);
 }
});

test('typed source identity, authority, rights and projection stay under unchanged receiving',async()=>{
 for(const kind of sourceKinds)for(const mutate of [page=>page.tool='other',page=>page.authority='Verified current facts',
  page=>page.result.id='other-source',page=>page.result.sourceUrl=12,page=>page.result.rights='licensed_by_adapter',
  page=>page.result.text='invented text',page=>page.complete=true]){
  const f=storedCase(id,{request:{view:'source',kind,id:'source'}});f.state.resultMutator=mutate;
  await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
});

test('news, budget and personnel exact-source URL aliases must equal their retained raw locator',async()=>{
 for(const kind of ['news','budget','personnel']){
  const f=storedCase(id,{request:{view:'source',kind,id:'source'}});f.state.resultMutator=page=>page.result.sourceUrl='different-source';
  await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
});

test('source headlines do not acquire bodies, completeness, full-text rights or verified publisher intake',async()=>{
 const f=storedCase(),out=JSON.parse(await f.handler()(f.call())),row=out.result.result;
 assert.equal(row.body,null);assert.equal(row.complete,false);assert.equal(row.rights,'headline_link');assert.equal(row.authority,'Attributed publisher reporting');
 assert.equal(Object.hasOwn(out.result,'publisherIntakeQualified'),false);assert.equal(Object.hasOwn(row,'coverage'),false);
 for(const mutate of [page=>page.result.complete=true,page=>page.result.body_complete=true,page=>page.result.authority='Confirmed fact']){
  f.state.resultMutator=mutate;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
});

test('budget proposal stage, source sections and retained completeness stay distinct from enactment',async()=>{
 const f=storedCase(id,{request:{view:'source',kind:'budget',id:'source'}}),out=JSON.parse(await f.handler()(f.call()));
 assert.equal(out.result.result.stage,'proposal');assert.equal(out.result.result.authority,'Florida fiscal source: proposal');assert.equal(out.result.result.complete,false);
 for(const mutate of [page=>page.result.revision='different-hash',page=>page.result.authority='Florida fiscal source: enacted',
  page=>page.result.sections=[{text:'other'}]]){
  f.state.resultMutator=mutate;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
});

test('exact personnel keeps raw confirmation, payload text and unresolved identity without employment inference',async()=>{
 const f=storedCase(id,{request:{view:'source',kind:'personnel',id:'source'}});f.state.resultMutator=page=>{
  page.result.payload={sourceText:'Literal withdrawal wording',opaque:[null,true]};page.result.text='Literal withdrawal wording';
 };
 const out=JSON.parse(await f.handler()(f.call()));assert.equal(out.result.result.authority,'Unconfirmed source wording');
 assert.equal(out.result.result.canonical_person_id,null);assert.equal(out.result.result.withdrawal_date,'Withdrawal wording only');
 assert.deepEqual(out.result.result.payload,{sourceText:'Literal withdrawal wording',opaque:[null,true]});
 for(const mutate of [page=>page.result.title='Resolved employer',page=>page.result.authority='Employment ended',page=>page.result.complete=false]){
  f.state.resultMutator=mutate;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
});

test('raw SQL dates cross actual JSON bytes; exact source aliases keep Date/String whole-second precision',async()=>{
 for(const kind of ['news','budget','personnel'])for(const [raw,alias] of [['2026-10-12T12:00:00.987Z','2026-10-12T12:00:00.000Z'],
  ['1969-12-31T23:59:59.999Z','1969-12-31T23:59:59.000Z']]){
  const f=storedCase(id,{request:{view:'source',kind,id:'source'}});f.state.resultMutator=page=>{
   page.generatedAt=new Date(f.now());page.result.observed_at=new Date(raw);page.result.observedAt=alias;
  };
  const out=JSON.parse(await f.handler()(f.call()));assert.ok(f.state.nativeValue.result.observed_at instanceof Date);
  assert.equal(out.result.result.observed_at,raw);assert.equal(out.result.result.observedAt,alias);
  f.state.resultMutator=page=>{page.result.observed_at=raw;page.result.observedAt=raw;};
  await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
});

test('research exact source keeps direct ISO precision and section text instead of a generic evidence payload',async()=>{
 const f=storedCase(id,{request:{view:'source',kind:'research',id:'source'}});f.state.resultMutator=page=>page.result.observedAt='2026-10-12T12:00:00.987Z';
 const out=JSON.parse(await f.handler()(f.call()));assert.equal(out.result.result.observedAt,'2026-10-12T12:00:00.987Z');assert.equal(out.result.result.title,null);
 f.state.resultMutator=page=>page.result.sections[0].text='other';await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
});

test('explicit personnel year follows native Number conversion and never asks for a default year',async()=>{
 for(const year of [2025,'2025','',0,-1,' 2026 ']){
  const f=storedCase(id,{request:{view:'personnel',year}}),out=JSON.parse(await f.handler()(f.call()));
  assert.equal(out.result.result.year,Number(year));assert.equal(f.credentialCalls[0].normalizationContext.defaultYear,null);
  assert.deepEqual(f.wire[0].body,{view:'personnel',year});assert.equal(out.result.result.notice,personnelNotice);
 }
});

test('personnel selected year, kind, branch, current source identities and saved tracking consistency are checked',async()=>{
 for(const mutate of [page=>page.result.year=2025,page=>page.result.items[0].registration_year=2025,page=>page.result.items[0].kind='change',
  page=>page.result.items[0].branch='legislative',page=>page.result.items[0].saved=true,page=>page.result.notice='Employment ended',
  page=>page.result.items.push({...page.result.items[0],id:'other'})]){
  const f=storedCase(id,{request:{view:'personnel',year:2026,kind:'registration',branch:'executive'}});f.state.resultMutator=mutate;
  await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
});

test('personnel exact 100-row offset continuation is preserved without inferred counts or automatic pagination',async()=>{
 const request={view:'personnel',year:'2026',offset:'2.9'},f=storedCase(id,{request}),execute=f.handler();
 f.state.page={...f.page,result:{...f.page.result,items:Array.from({length:100},(_,n)=>person(f.call().input,f.now(),`person-${n}`)),nextOffset:102}};
 const first=JSON.parse(await execute(f.call()));assert.equal(first.result.result.nextOffset,102);assert.equal(first.result.result.items.length,100);
 assert.equal(Object.hasOwn(first.result.result,'total'),false);assert.equal(f.wire.length,1);assert.equal(f.wire[0].body.offset,'2.9');
 const next={view:'personnel',year:'2026',offset:102};f.state.page={...f.page,result:{...f.page.result,items:[],nextOffset:null}};
 const second=JSON.parse(await execute(f.call(next)));assert.equal(second.result.result.items.length,0);assert.equal(f.wire.length,2);
 assert.equal(f.credentialCalls[1].requestSha256,hash(next));assert.notEqual(f.credentialCalls[0].requestSha256,f.credentialCalls[1].requestSha256);
 assert.equal(Object.hasOwn(second.result,'absenceEvidence'),false);
 for(const [length,offset] of [[99,102],[100,103]]){
  f.state.page={...f.page,result:{...f.page.result,items:Array.from({length},(_,n)=>person(f.call().input,f.now(),`person-${n}`)),nextOffset:offset}};
  await assert.rejects(execute(f.call()),{message:'INVALID_RESULT'});
 }
});

test('pure preflight is inert, never observes ambient time and cannot select a sibling family',()=>{
 const f=storedCase();let effects=0;const hostile={view:'source',kind:'news',id:'source',get clientId(){effects++;return 'Client';}};
 assert.throws(()=>assertUnscopedNewsRequest(f.operation,hostile),{message:'INVALID_ARGUMENTS'});
 assert.throws(()=>assertUnscopedNewsRequest(f.operation,new Proxy(f.arguments,{get(){effects++;throw Error('hook');}})),{message:'INVALID_ARGUMENTS'});
 assert.throws(()=>newsSliceContext({id:'search_state_bills',version:'0.2.0'},{}),{message:'GATEWAY_CONFIGURATION'});
 const saved=Date.now;Date.now=()=>{effects++;throw Error('ambient clock');};
 try{assert.equal(newsSliceContext(f.operation,{view:'personnel',year:2026}).defaultYear,null);}finally{Date.now=saved;}
 assert.equal(effects,0);
});

test('cancellation, deadline, missing credential owner and bounded bytes stop or withhold source results',async()=>{
 const f=storedCase();await assert.rejects(f.handler()({...f.call(),signal:AbortSignal.abort()}),{message:'CANCELLED'});assert.equal(f.wire.length,0);
 const g=storedCase();g.state.now=g.authority.deadlineMs;await assert.rejects(g.handler()(g.call()),{message:'DEADLINE'});assert.equal(g.wire.length,0);
 const h=storedCase();await assert.rejects(h.handler({getCredentials:undefined})(h.call()),{message:'UNAVAILABLE'});assert.equal(h.wire.length,0);
 await assert.rejects(f.handler({maxResponseBytes:16})(f.call()),{message:'RESOURCE_LIMIT'});
 const k=storedCase(),controller=new AbortController();k.state.afterSource=()=>controller.abort();
 await assert.rejects(k.handler()({...k.call(),signal:controller.signal}),{message:'CANCELLED'});
});

test('the current capability output budget bounds source bytes without truncation or a fallback request',async()=>{
 const f=storedCase();f.authority.claims.budgets.maxOutputBytes=256;
 await assert.rejects(f.handler()(f.call()),{message:'RESOURCE_LIMIT'});
 assert.equal(f.wire.length,1);assert.equal(f.credentialCalls.length,1);
});

test('constructor permits only fixed versioned native news reads and no configurable read/apply bridge',()=>{
 const f=storedCase(),configuration={...f.transport,now:f.now};
 for(const operations of [[],[f.operation,f.operation],[{id:'prepare_legiwatch_briefing',version:'0.2.0'}],[{id,version:'0.1.0'}]])
  assert.throws(()=>createResearchLegalNewsHandlers(configuration,operations),{message:'GATEWAY_CONFIGURATION'});
 assert.throws(()=>createResearchLegalNewsHandlers({...configuration,origin:'https://native-core.example.invalid/other'},[f.operation]),{message:'GATEWAY_CONFIGURATION'});
 assert.throws(()=>createResearchLegalNewsHandlers({...configuration,endpoint:'/internal/legiwatch/meri/apply'},[f.operation]));
 assert.equal(f.wire.length,0);
});
