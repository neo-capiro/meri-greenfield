/** Real bounded HTTP JSON receiving with synthetic stored rows; no service or provider execution. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {createStateLegislationHandlers} from '../handler.mjs';
import {storedCase,ids,note} from './fixture.mjs';

for(const id of ids){
 test(`${id}: fixed original flat native POST, native credentials and exact private envelope`,async()=>{
  const f=storedCase(id),call=f.call(),result=JSON.parse(await f.handler()(call)),[wire]=f.wire,[proof]=f.credentialCalls;
  assert.deepEqual(result,{binding:f.authority.binding,subject:f.authority.subject,operation:f.operation,argumentsSha256:call.argumentsSha256,result:f.page});
  assert.equal(wire.url,`https://native-core.example.invalid/api/clio/tools/${id}`);assert.equal(wire.options.method,'POST');
  assert.deepEqual(wire.body,f.arguments);assert.equal(Object.hasOwn(wire.body,'input'),false);
  assert.equal(wire.options.headers.authorization,'Bearer SYNTHETIC_NATIVE_USER');
  assert.equal(wire.options.headers['x-internal-service-secret'],'SYNTHETIC_INTERNAL_SERVICE');
  assert.equal(wire.options.redirect,'error');assert.equal(wire.options.credentials,'omit');assert.equal(wire.options.cache,'no-store');
  assert.equal(proof.requestSha256,hash(f.arguments));assert.equal(proof.argumentsSha256,call.argumentsSha256);
  assert.deepEqual(proof.normalizationContext,{});assert.deepEqual(f.contract.normalizeInput(f.arguments,{}).metadata,{});
  assert.equal(Object.hasOwn(result.result,'complete'),false);assert.equal(Object.hasOwn(result.result,'authoritative'),false);
 });
 test(`${id}: current tenant, actor, operation decision and source authority are required before credential IO`,async()=>{
  for(const mutate of [a=>a.claims.audience='other',a=>a.claims.actions=[],a=>a.binding.tenantId='other',
   a=>a.decision.actor.actorId='other',a=>a.decision.operation='other@0.2.0',a=>a.decision.decision='denied',
   a=>a.decision.scopes=[],a=>a.sourceIds=[],a=>a.claims.issuedAt=new Date(a.deadlineMs).toISOString()]){
   const f=storedCase(id),call=structuredClone(f.call());mutate(call.authority);
   await assert.rejects(f.handler()(call));assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
  }
 });
 test(`${id}: model authority, nonempty normalization context and digest substitution cannot fetch`,async()=>{
  const f=storedCase(id);
  for(const extra of [{tenantId:'other'},{actorId:'other'},{sourceId:'other'},{endpoint:'https://other.example.invalid'}]){
   await assert.rejects(f.handler()({...f.call(),request:{...f.arguments,...extra}}),{message:'INVALID_ARGUMENTS'});
  }
  await assert.rejects(f.handler()({...f.call(),normalizationContext:{actorId:'other'}}),{message:'INVALID_ARGUMENTS'});
  await assert.rejects(f.handler()({...f.call(),argumentsSha256:'0'.repeat(64)}),{message:'INVALID_ARGUMENTS'});
  assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
 });
 test(`${id}: exact correlated credentials and original expiry are required`,async()=>{
  for(const key of ['binding','subject','operation','policyRevision','sourceIds','requestSha256','argumentsSha256',
   'normalizationContext','origin','bearerToken','serviceSecret','expiresAtMs']){
   const f=storedCase(id);f.state.credentialMutator=proof=>proof[key]=key==='expiresAtMs'?f.now():null;
   await assert.rejects(f.handler()(f.call()),{message:'ACCESS_DENIED'});assert.equal(f.wire.length,0);
  }
  const f=storedCase(id);await assert.rejects(f.handler({getCredentials:undefined})(f.call()),{message:'UNAVAILABLE'});assert.equal(f.wire.length,0);
 });
 test(`${id}: malformed native DTOs and domain errors cannot become results`,async()=>{
  for(const response of [()=>Response.json({error:'SYNTHETIC_PRIVATE'}),()=>Response.json({},{status:403}),
   page=>Response.json({...page,complete:true}),page=>Response.json({...page,tool:'other'})]){
   const f=storedCase(id);f.state.responseFactory=response;
   await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
  }
 });
 test(`${id}: native bytes obey response budgets and cancellation`,async()=>{
  const f=storedCase(id);await assert.rejects(f.handler({maxResponseBytes:16})(f.call()),{message:'RESOURCE_LIMIT'});
  const g=storedCase(id);await assert.rejects(g.handler()({...g.call(),signal:AbortSignal.abort()}),{message:'CANCELLED'});assert.equal(g.wire.length,0);
  const h=storedCase(id),controller=new AbortController();h.state.afterSource=()=>controller.abort();
  await assert.rejects(h.handler()({...h.call(),signal:controller.signal}),{message:'CANCELLED'});
  const expired=storedCase(id);expired.state.now=expired.authority.deadlineMs;
  await assert.rejects(expired.handler()(expired.call()),{message:'DEADLINE'});assert.equal(expired.wire.length,0);
 });
 test(`${id}: per-call credential owner is explicit and no static fallback is composed`,async()=>{
  const f=storedCase(id),call=f.call(),{getCredentials,...configuration}=f.transport;let captured;
  const [handler]=createStateLegislationHandlers({...configuration,now:f.now,credentialsForCall:(operation,original)=>{
   captured={operation,original};return getCredentials;
  }},[f.operation]);
  await handler.execute(call);assert.deepEqual(captured.operation,f.operation);assert.equal(captured.original,call);
  assert.throws(()=>f.handler({credentialsForCall:()=>getCredentials}),{message:'GATEWAY_CONFIGURATION'});
 });
}

test('bill original trim/clip/coercion input reaches native normalization exactly once',async()=>{
 const session='A'.repeat(59)+' B',request={query:'  housing  ',state:' fl ',session,status:' introduced ',limit:'1.9'};
 const f=storedCase('search_state_bills',{request}),result=JSON.parse(await f.handler()(f.call()));
 assert.deepEqual(f.wire[0].body,request);assert.equal(f.call().input.session,'A'.repeat(59)+' ');
 assert.equal(result.result.data[0].session,'A'.repeat(59)+' ');assert.equal(f.call().input.limit,1);assert.equal(result.result.data[0].state,'FL');
});

test('bill zero count note follows count even when a separately observed page contains rows',async()=>{
 for(const keepRows of [false,true]){
  const f=storedCase();f.state.page={...f.page,total:0,data:keepRows?f.page.data:[],note:note('StateBillEmptyNote')};
  const result=JSON.parse(await f.handler()(f.call()));assert.equal(result.result.total,0);assert.equal(result.result.data.length,keepRows?1:0);
  assert.equal(result.result.note,'No state bill on record matches that. Say so explicitly — do not describe a bill from memory.');
  assert.equal(Object.hasOwn(result.result,'absenceEvidence'),false);
  f.state.resultMutator=page=>delete page.note;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
});

test('bill native Date objects survive JSON transport as canonical SQL dates and generated instants',async()=>{
 const f=storedCase();f.state.page={...f.page,generatedAt:new Date(f.now()),data:[{...f.page.data[0],latestActionDate:new Date('2026-10-10T00:00:00.000Z')}]};
 const result=JSON.parse(await f.handler()(f.call()));assert.ok(f.state.nativeValue.generatedAt instanceof Date);
 assert.ok(f.state.nativeValue.data[0].latestActionDate instanceof Date);assert.equal(result.result.data[0].latestActionDate,'2026-10-10T00:00:00.000Z');
 f.state.resultMutator=page=>page.data[0].latestActionDate='2026-10-10T12:00:00.000Z';
 await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
});

test('bill null/free-form status labels stay inert and received exact selectors cannot drift',async()=>{
 for(const status of [null,'future-status','constructor','__proto__']){
  const f=storedCase('search_state_bills',{request:{query:'housing'}});
  f.state.page={...f.page,data:[{...f.page.data[0],status,statusLabel:status??'Unknown'}]};
  const result=JSON.parse(await f.handler()(f.call()));assert.equal(result.result.data[0].statusLabel,status??'Unknown');
  f.state.resultMutator=page=>page.data[0].statusLabel='Invented';await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
 for(const [field,value] of [['state','VA'],['session','2025'],['status','enacted']]){
  const f=storedCase();f.state.resultMutator=page=>page.data[0][field]=value;
  await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
});

test('bill response row limit and typed uppercase expansion are enforced without changing native requests',async()=>{
 const f=storedCase('search_state_bills',{request:{limit:1}});f.state.resultMutator=page=>page.data.push({...page.data[0],id:'other'});
 await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 const g=storedCase(),request={state:'ßß'};
 await assert.rejects(g.handler()({...g.call(),request}),{message:'INVALID_ARGUMENTS'});assert.equal(g.wire.length,0);
});

test('legislator missing and unmatched selectors preserve exact refusal notes',async()=>{
 const missing=storedCase('get_state_legislator',{request:{}}),absent=JSON.parse(await missing.handler()(missing.call()));
 assert.equal(absent.result.note,note('StateLegislatorMissingNote'));assert.deepEqual(absent.result.matches,[]);
 const f=storedCase('get_state_legislator',{request:{query:'Nobody',state:' fl '}});
 f.state.page={tool:f.operation.id,generatedAt:f.page.generatedAt,matchesFound:0,matches:[],
  note:'No state legislator matched "Nobody" in FL. Say so explicitly — do not fabricate a legislator.'};
 assert.deepEqual(JSON.parse(await f.handler()(f.call())).result,f.state.page);
 f.state.resultMutator=page=>page.note=page.note.replace(' — ',' - ');await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
});

test('legislator ambiguity returns candidates with exact clarification rather than selecting one',async()=>{
 const f=storedCase('get_state_legislator',{request:{query:'Smith',state:'FL',limit:2}});
 const candidates=[1,2].map(n=>({id:`synthetic-${n}`,name:`Smith ${n}`,state:'FL',chamber:null,district:null,party:null}));
 f.state.page={tool:f.operation.id,generatedAt:f.page.generatedAt,matchesFound:0,matches:[],ambiguousLegislator:candidates,
  note:'"Smith" matches 2 state legislators — ask the user which (by state/chamber/district) before attributing anything to them.'};
 const result=JSON.parse(await f.handler()(f.call()));assert.equal(result.result.matchesFound,0);assert.deepEqual(result.result.ambiguousLegislator,candidates);
 f.state.resultMutator=page=>page.ambiguousLegislator[1].state='VA';await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
});

test('legislator crosswalk path precedes state hint and keeps opaque committees without identity claims',async()=>{
 for(const namespace of ['openstates','synthetic','']){
  const f=storedCase('get_state_legislator',{request:{query:'external-id',state:'FL',limit:1}});
  f.state.resultMutator=page=>Object.assign(page.matches[0],{state:'VA',matchedBy:`${namespace}-crosswalk`,committees:[null,{opaque:true}]});
  const result=JSON.parse(await f.handler()(f.call()));assert.equal(result.result.matches[0].state,'VA');assert.deepEqual(result.result.matches[0].committees,[null,{opaque:true}]);
  assert.equal(Object.hasOwn(result.result,'uniqueIdentity'),false);assert.equal(Object.hasOwn(result.result,'authoritative'),false);
 }
 const f=storedCase('get_state_legislator');f.state.resultMutator=page=>page.matches[0].state='VA';
 await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
});

test('legislator source-only row cannot add contact, source completeness or refusal to a match',async()=>{
 for(const mutate of [page=>page.matches[0].email='synthetic@example.invalid',page=>page.matches[0].matchedBy='inferred',
  page=>page.note='Verified unique legislator',page=>page.matchesFound=0,page=>page.matches.push({...page.matches[0]})]){
  const f=storedCase('get_state_legislator');f.state.resultMutator=mutate;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
});

test('family cannot widen to status/votes/provider fallbacks, alternate versions or caller-selected routes',()=>{
 const f=storedCase(),configuration={...f.transport,now:f.now};
 for(const operations of [[],[f.operation,f.operation],[{id:'get_state_bill_status',version:'0.2.0'}],
  [{id:'search_state_floor_votes',version:'0.2.0'}],[{id:'search_state_bills',version:'0.1.0'}]]){
  assert.throws(()=>createStateLegislationHandlers(configuration,operations),{message:'GATEWAY_CONFIGURATION'});
 }
 assert.throws(()=>createStateLegislationHandlers({...configuration,origin:'https://native-core.example.invalid/alternate'},[f.operation]),{message:'GATEWAY_CONFIGURATION'});
 assert.throws(()=>createStateLegislationHandlers({...configuration,route:'/arbitrary'},[f.operation]));
 assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
});
