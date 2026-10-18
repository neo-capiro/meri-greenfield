/** Real native HTTP JSON receiving, synthetic client authority and stored manual tracking rows. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {deny} from '../../../dispatch/operation-result.mjs';
import {createTrackedBillsHandlers} from '../handler.mjs';
import {storedCase,trackedRow,id,clientId} from './fixture.mjs';

test('explicit UUID uses the exact selected-client POST, original proof and both frozen lineage envelopes',async()=>{
 const request={clientId:` ${clientId.toUpperCase()} `},f=storedCase(id,{request}),call=f.call();
 const out=JSON.parse(await f.handler()(call)),[wire]=f.wire,[proof]=f.credentialCalls;
 assert.deepEqual(out,{binding:f.authority.binding,subject:f.authority.subject,operation:f.operation,argumentsSha256:call.argumentsSha256,
  result:{binding:f.authority.binding,subject:f.authority.subject,data:f.page}});
 assert.equal(wire.url,'https://native-core.example.invalid/api/clio/tools/search_tracked_bills');assert.equal(wire.options.method,'POST');
 assert.deepEqual(wire.body,{clientId});assert.equal(Object.hasOwn(wire.body,'input'),false);assert.equal(f.wire.length,1);
 assert.equal(wire.options.headers.authorization,'Bearer SYNTHETIC_NATIVE_USER');assert.equal(wire.options.headers['x-internal-service-secret'],'SYNTHETIC_INTERNAL_SERVICE');
 assert.equal(wire.options.redirect,'error');assert.equal(wire.options.credentials,'omit');assert.equal(wire.options.cache,'no-store');
 assert.equal(proof.requestSha256,hash(request));assert.equal(proof.argumentsSha256,hash({clientId}));
 assert.deepEqual(proof.target,{method:'POST',path:'/api/clio/tools/search_tracked_bills',
  bodySha256:createHash('sha256').update(JSON.stringify({clientId}),'utf8').digest('hex')});
 assert.deepEqual(proof.sourceIds,['tracked_bills']);assert.deepEqual(proof.normalizationContext,{binding:f.authority.binding,subject:f.authority.subject,clientReference:clientId.toUpperCase()});
});

test('the 80-unit retained reference preserves clipping while Core receives the exact selected UUID',async()=>{
 const request={clientId:clientId+' '.repeat(50)+'suffix'},f=storedCase(id,{request}),call=f.call();
 assert.equal(call.normalizationContext.clientReference,clientId+' '.repeat(44));
 assert.deepEqual(call.input,{clientId});await f.handler()(call);
 assert.deepEqual(f.wire[0].body,{clientId});assert.equal(f.credentialCalls[0].requestSha256,hash(request));
 assert.equal(f.credentialCalls[0].normalizationContext.clientReference.length,80);
});

test('names and UUID-like prefixes require per-call native resolution rather than static credentials',async()=>{
 for(const reference of ['Synthetic named client',clientId+'suffix','https://client.example.invalid/']){
  // A selected UUID/context and static credential do not prove actual native name resolution.
  const f=storedCase(id,{request:{clientId:reference}});
  await assert.rejects(f.handler()(f.call()),{message:'UNAVAILABLE'});
  assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
 }
});

test('a per-call name context forwards only the resolved UUID while preserving original reference/proof',async()=>{
 const f=storedCase(id,{request:{clientId:'  Synthetic named client  '}}),{getCredentials,...configuration}=f.transport;
 const [handler]=createTrackedBillsHandlers({...configuration,now:f.now,credentialsForCall:()=>getCredentials},[f.operation]);
 await handler.execute(f.call());assert.deepEqual(f.wire[0].body,{clientId});
 assert.equal(f.credentialCalls[0].requestSha256,hash(f.arguments));
 assert.equal(f.credentialCalls[0].normalizationContext.clientReference,'Synthetic named client');
});

test('missing, blank, malformed and model-supplied authority selectors refuse before source effects',async()=>{
 const f=storedCase();
 for(const request of [{},{clientId:''},{clientId:' '},{clientId:null},{clientId:3},{clientId:[]},
  {clientId,limit:50},{clientId,cursor:'other'},{clientId,tenantId:'other'},{clientId,clientReference:clientId},
  {clientId,subject:f.authority.subject},{clientId,evidenceAccuracyMode:'off'}]){
  await assert.rejects(f.handler()({...f.call(),request}),{message:'INVALID_ARGUMENTS'});
 }
 assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
});

test('a different UUID cannot be rebound to the selected client subject',async()=>{
 const f=storedCase(),request={clientId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'};
 await assert.rejects(f.handler()({...f.call(),request,normalizationContext:{...f.normalizationContext,clientReference:request.clientId}}),{message:'INVALID_ARGUMENTS'});
 assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
});

test('retained reference correlation and full current binding/subject cannot be substituted',async()=>{
 for(const mutate of [call=>call.normalizationContext.binding.writerFence++,
  call=>call.normalizationContext.subject.authorizationDecisionId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb']){
  const f=storedCase(),call=structuredClone(f.call());
  call.normalizationContext=structuredClone(call.normalizationContext);mutate(call);
  await assert.rejects(f.handler()(call),{message:'ACCESS_DENIED'});assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
 }
 const f=storedCase();await assert.rejects(f.handler()({...f.call(),normalizationContext:{...f.normalizationContext,clientReference:clientId.toUpperCase()}}),{message:'INVALID_ARGUMENTS'});
 await assert.rejects(f.handler()({...f.call(),normalizationContext:{binding:f.authority.binding,subject:f.authority.subject}}),{message:'INVALID_ARGUMENTS'});
 assert.equal(f.wire.length,0);
});

test('current decision, user, tenant, source and capability mismatches prevent credential IO',async()=>{
 for(const mutate of [a=>a.claims.actions=[],a=>a.claims.audience='other',a=>a.decision.decision='denied',
  a=>a.decision.operation='get_representation@0.2.0',a=>a.decision.actor.actorId='other',a=>a.decision.scopes=[],
  a=>a.sourceIds=['other'],a=>a.claims.binding.tenantId='other']){
  const f=storedCase(),call=structuredClone(f.call());mutate(call.authority);
  await assert.rejects(f.handler()(call));assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
 }
});

test('every credential proof correlation and both native credentials remain mandatory',async()=>{
 for(const key of ['binding','subject','operation','policyRevision','sourceIds','requestSha256','argumentsSha256','normalizationContext','origin','bearerToken','serviceSecret','expiresAtMs']){
  const f=storedCase();f.state.credentialMutator=receipt=>receipt[key]=key==='expiresAtMs'?f.now():null;
  await assert.rejects(f.handler()(f.call()),{message:'ACCESS_DENIED'});assert.equal(f.wire.length,0);
 }
 const f=storedCase();await assert.rejects(f.handler({getCredentials:undefined})(f.call()),{message:'UNAVAILABLE'});assert.equal(f.wire.length,0);
 const g=storedCase();await assert.rejects(g.handler({getCredentials:async()=>deny('ACCESS_DENIED')})(g.call()),{message:'ACCESS_DENIED'});assert.equal(g.wire.length,0);
});

test('per-call credential selection receives the original UUID request and cannot fall back to static credentials',async()=>{
 const f=storedCase(),call=f.call(),{getCredentials,...configuration}=f.transport;let captured;
 const [handler]=createTrackedBillsHandlers({...configuration,now:f.now,credentialsForCall:(operation,original)=>{
  captured={operation,original};return getCredentials;
 }},[f.operation]);
 await handler.execute(call);assert.equal(captured.original,call);assert.deepEqual(captured.operation,f.operation);
 assert.throws(()=>f.handler({credentialsForCall:()=>getCredentials}),{message:'GATEWAY_CONFIGURATION'});
});

test('tracking rows preserve private notes and nullable global enrichment without inventing legislative facts',async()=>{
 const f=storedCase();f.state.page={...f.page,total:2,bills:[{...trackedRow(1),note:'Synthetic manual tracking note',bill:null},
  {...trackedRow(2),createdAt:'2026-10-11T00:00:00.000Z',bill:{...trackedRow(2).bill,status:'unrecognized source status',actionTexts:['B','A','B'],subjectNames:['Z','A','Z']}}]};
 const out=JSON.parse(await f.handler()(f.call())).result.data;assert.deepEqual(out,f.state.page);
 assert.equal(out.bills[0].bill,null);assert.equal(out.bills[0].note,'Synthetic manual tracking note');
 assert.equal(Object.hasOwn(out,'complete'),false);assert.equal(Object.hasOwn(out.bills[1].bill,'currentVisibility'),false);
});

test('manual tracking retains more than fifty rows and exact returned count without pagination or truncation',async()=>{
 const f=storedCase();f.state.page={...f.page,total:75,bills:Array.from({length:75},(_,i)=>trackedRow(i+1))};
 const out=JSON.parse(await f.handler()(f.call())).result.data;assert.equal(out.bills.length,75);assert.equal(out.total,75);
 assert.equal(Object.hasOwn(out,'nextCursor'),false);assert.equal(Object.hasOwn(out,'hasMore'),false);
 await assert.rejects(f.handler({maxResponseBytes:1024})(f.call()),{message:'RESOURCE_LIMIT'});
});

test('duplicate IDs, client/count substitution, creation order and mismatched global joins are rejected',async()=>{
 for(const mutate of [page=>page.clientId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',page=>page.total=0,
  page=>{page.bills.push({...page.bills[0]});page.total=2;},page=>page.bills[0].bill.identifier='other-bill',
  page=>page.bills[0].bill.latestActionDate='2026-10-12T01:00:00.000Z',
  page=>{page.bills=[{...trackedRow(1),createdAt:'2026-10-11T00:00:00.000Z'},trackedRow(2)];page.total=2;}]){
  const f=storedCase();f.state.resultMutator=mutate;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
});

test('empty manual tracking stays a returned-set count and cannot claim exhaustive absence',async()=>{
 const f=storedCase();f.state.page={...f.page,total:0,bills:[]};const out=JSON.parse(await f.handler()(f.call())).result.data;
 assert.deepEqual(out,f.state.page);f.state.resultMutator=page=>page.evidenceOfAbsence=true;
 await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
});

test('native missing-client errors and wrapped/private-column results never become accepted empty pages',async()=>{
 for(const response of [()=>Response.json({error:'PRIVATE_CLIENT_DETAIL'},{status:404}),page=>Response.json({output:page}),
  page=>Response.json({...page,tenantId:'private'}),page=>Response.json({...page,binding:{},subject:{}})]){
  const f=storedCase();f.state.responseFactory=response;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
});

test('pre-abort, post-source cancellation and expired authority withhold all result bytes',async()=>{
 const f=storedCase();await assert.rejects(f.handler()({...f.call(),signal:AbortSignal.abort()}),{message:'CANCELLED'});assert.equal(f.credentialCalls.length,0);
 const g=storedCase(),controller=new AbortController();g.state.afterSource=()=>controller.abort();
 await assert.rejects(g.handler()({...g.call(),signal:controller.signal}),{message:'CANCELLED'});
 const h=storedCase();h.state.now=h.authority.deadlineMs;await assert.rejects(h.handler()(h.call()),{message:'DEADLINE'});assert.equal(h.wire.length,0);
});

test('constructor refuses duplicate, wrong-version and discovery-family references without effects',()=>{
 const f=storedCase();
 for(const operations of [[],[f.operation,f.operation],[{id,version:'0.1.0'}],[{id:'get_bill_status',version:'0.2.0'}]]){
  assert.throws(()=>createTrackedBillsHandlers({...f.transport,now:f.now},operations),{message:'GATEWAY_CONFIGURATION'});
 }
 let effects=0;assert.throws(()=>createTrackedBillsHandlers({...f.transport,now:f.now},[{get id(){effects++;return id;},version:'0.2.0'}]));
 assert.equal(effects,0);assert.equal(f.wire.length,0);
});
