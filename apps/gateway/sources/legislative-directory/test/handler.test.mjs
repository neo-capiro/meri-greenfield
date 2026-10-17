/** Actual bounded JSON transport/receiving; synthetic stored rows, no native execution. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {createLegislativeDirectoryHandlers} from '../handler.mjs';
import {directoryCase,ids,note} from './fixture.mjs';
for(const id of ids){
 test(`${id}: fixed original flat native POST and exact private carrier`,async()=>{
  const f=directoryCase(id),call=f.call(),raw=await f.handler()(call),out=JSON.parse(raw),[wire]=f.wire,[proof]=f.credentialCalls;
  assert.deepEqual(out,{binding:f.authority.binding,subject:f.authority.subject,operation:f.operation,argumentsSha256:call.argumentsSha256,result:f.page});
  assert.equal(wire.url,`https://native-core.example.invalid/api/clio/tools/${id}`);assert.equal(wire.options.method,'POST');assert.deepEqual(wire.body,f.arguments);
  assert.equal(wire.options.headers.authorization,'Bearer SYNTHETIC_NATIVE_USER');assert.equal(wire.options.headers['x-internal-service-secret'],'SYNTHETIC_INTERNAL_SERVICE');
  assert.deepEqual(Object.keys(wire.options.headers).sort(),['authorization','accept','accept-encoding','x-meri-deadline-at','x-internal-service-secret','content-type'].sort());
  assert.equal(wire.options.redirect,'error');assert.equal(wire.options.credentials,'omit');assert.equal(wire.options.cache,'no-store');
  assert.equal(proof.requestSha256,hash(f.arguments));assert.equal(proof.argumentsSha256,call.argumentsSha256);assert.deepEqual(proof.normalizationContext,{});
 });
 test(`${id}: denied actor, source, decision and grant coherence prevents credential IO`,async()=>{
  for(const mutate of [a=>a.claims.audience='other',a=>a.claims.actions=[],a=>a.decision.decision='denied',a=>a.decision.operation='other@0.2.0',a=>a.decision.actor.actorId='other',a=>a.decision.scopes=[],a=>a.sourceIds=['other'],a=>a.claims.binding.tenantId='other',a=>a.claims.issuedAt=new Date(a.deadlineMs).toISOString()]){
   const f=directoryCase(id),call=structuredClone(f.call());mutate(call.authority);await assert.rejects(f.handler()(call));assert.equal(f.wire.length,0);assert.equal(f.credentialCalls.length,0);
  }
 });
 test(`${id}: model authority, context and digest substitution cannot reach credentials`,async()=>{
  const f=directoryCase(id);
  for(const extra of [{tenantId:'other'},{actorRole:'capiro_admin'},{clientId:'other'},{cursor:'opaque'}])await assert.rejects(f.handler()({...f.call(),request:{...f.arguments,...extra}}),{message:'INVALID_ARGUMENTS'});
  await assert.rejects(f.handler()({...f.call(),normalizationContext:{actorId:'other'}}),{message:'INVALID_ARGUMENTS'});
  await assert.rejects(f.handler()({...f.call(),argumentsSha256:'0'.repeat(64)}),{message:'INVALID_ARGUMENTS'});assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
 });
 test(`${id}: every credential correlation and both native credentials are required`,async()=>{
  for(const key of ['binding','subject','operation','policyRevision','sourceIds','requestSha256','argumentsSha256','normalizationContext','origin','bearerToken','serviceSecret','expiresAtMs']){
   const f=directoryCase(id);f.state.credentialMutator=r=>r[key]=key==='expiresAtMs'?f.now():null;await assert.rejects(f.handler()(f.call()),{message:'ACCESS_DENIED'});assert.equal(f.wire.length,0);
  }
  const f=directoryCase(id);await assert.rejects(f.handler({getCredentials:undefined})(f.call()),{message:'UNAVAILABLE'});assert.equal(f.wire.length,0);
 });
 test(`${id}: limits, abort and expired authority withhold bytes`,async()=>{
  const f=directoryCase(id);await assert.rejects(f.handler()({...f.call(),signal:AbortSignal.abort()}),{message:'CANCELLED'});assert.equal(f.credentialCalls.length,0);
  await assert.rejects(f.handler({maxResponseBytes:16})(f.call()),{message:'RESOURCE_LIMIT'});
  const g=directoryCase(id),controller=new AbortController();g.state.afterSource=()=>controller.abort();await assert.rejects(g.handler()({...g.call(),signal:controller.signal}),{message:'CANCELLED'});
  const h=directoryCase(id);h.state.now=h.authority.deadlineMs;await assert.rejects(h.handler()(h.call()),{message:'DEADLINE'});assert.equal(h.wire.length,0);
 });
 test(`${id}: raw domain errors, foreign DTOs and invented completeness are rejected`,async()=>{
  for(const response of [()=>Response.json({error:'PRIVATE'}),()=>Response.json({},{status:403}),p=>Response.json({...p,complete:true}),p=>Response.json({...p,tool:'other'})]){
   const f=directoryCase(id);f.state.responseFactory=response;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
  }
 });
 test(`${id}: per-call credential composition is exact and cannot use a static fallback`,async()=>{
  const f=directoryCase(id),call=f.call(),{getCredentials,...configuration}=f.transport;let captured;
  const handler=createLegislativeDirectoryHandlers({...configuration,now:f.now,credentialsForCall:(op,original)=>{captured={op,original};return getCredentials;}},[f.operation])[0];
  await handler.execute(call);assert.equal(captured.original,call);assert.deepEqual(captured.op,f.operation);
  assert.throws(()=>f.handler({credentialsForCall:()=>getCredentials}),{message:'GATEWAY_CONFIGURATION'});
 });
}

test('committee original trim/clip boundary is preserved for one native normalization pass',async()=>{
 const committee='A'.repeat(199)+' B',f=directoryCase('get_committee_roster',{request:{committee,jurisdiction:' FEDERAL '}});
 f.state.resultMutator=p=>p.committee.id='A'.repeat(199)+' ';
 const out=JSON.parse(await f.handler()(f.call()));assert.equal(out.result.committee.id,'A'.repeat(199)+' ');assert.equal(f.wire[0].body.committee,committee);
});
test('state roster stays separate, retains nullable district/chamber and no inferred ranking member',async()=>{
 const f=directoryCase('get_committee_roster',{request:{committee:'STATE-ID',jurisdiction:' STATE ',state:' fl '}}),person={id:'synthetic-state',name:'Synthetic state chair',party:null,chamber:null,district:null,role:'Chair'};
 f.state.page={tool:'get_committee_roster',generatedAt:f.page.generatedAt,committee:{id:'state-id',name:'Synthetic state committee',chamber:null,jurisdiction:'state',matchedBy:'id'},chair:person,viceChair:null,rankingMember:null,members:[person],note:null};
 const out=JSON.parse(await f.handler()(f.call()));assert.deepEqual(out.result,f.state.page);assert.equal(Object.hasOwn(out.result.committee,'isSubcommittee'),false);
 f.state.resultMutator=p=>p.rankingMember=person;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
});
test('missing committee jurisdiction and state remain explicit unresolved results',async()=>{
 for(const [request,constant] of [[{committee:'Rules'},'DirectorySelectionNote'],[{committee:'Rules',jurisdiction:'state'},'DirectoryStateNote']]){
  const f=directoryCase('get_committee_roster',{request});f.state.page={tool:'get_committee_roster',generatedAt:f.page.generatedAt,committee:null,chair:null,viceChair:null,rankingMember:null,members:[],note:note(constant)};
  const out=JSON.parse(await f.handler()(f.call()));assert.equal(out.result.committee,null);assert.equal(out.result.note,note(constant));assert.deepEqual(f.wire[0].body,request);
 }
});
test('federal roster refuses inferred district, wrong leadership, wrong code, duplicate IDs and rank disorder',async()=>{
 for(const mutate of [p=>p.members[0].district='1',p=>p.chair=null,p=>p.committee.id='syn',p=>p.members.push({...p.members[0]}),p=>p.members.push({...p.members[0],id:'other',rank:0})]){
  const f=directoryCase();f.state.resultMutator=mutate;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
});
test('roster retains complete stored response beyond list limit without inventing source completeness',async()=>{
 const f=directoryCase();f.state.page={...f.page,chair:null,members:Array.from({length:120},(_,i)=>({...f.page.members[0],id:`synthetic-${i}`,title:null,rank:i}))};
 const out=JSON.parse(await f.handler()(f.call()));assert.equal(out.result.members.length,120);assert.equal(Object.hasOwn(out.result,'complete'),false);assert.match(out.result.note,/does NOT carry congressional districts/);
});
test('one-senator response preserves incompleteness, limits and House-only district receiving',async()=>{
 const f=directoryCase('list_members',{request:{state:' va ',chamber:' SENATE ',limit:'1.9'}}),out=JSON.parse(await f.handler()(f.call()));
 assert.equal(out.result.members.length,1);assert.match(out.result.note,/roster is incomplete/);assert.deepEqual(f.wire[0].body,f.arguments);assert.equal(f.call().input.limit,1);
 for(const mutate of [p=>p.members[0].district='1',p=>p.filter.state='Florida',p=>p.matchesFound=2,p=>p.note='Complete senate roster']){
  f.state.resultMutator=mutate;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
});
test('member missing/invalid selector preserves explicit refusal instead of broadening the roster',async()=>{
 for(const [request,message] of [[{},note('DirectoryMemberSelectionNote')],[{state:'Neverland'},'"Neverland" is not a recognized US state or territory — say so explicitly, do not guess a roster.']]){
  const f=directoryCase('list_members',{request});f.state.page={tool:'list_members',generatedAt:f.page.generatedAt,matchesFound:0,members:[],note:message};
  const out=JSON.parse(await f.handler()(f.call()));assert.deepEqual(out.result,f.state.page);assert.equal(Object.hasOwn(out.result,'filter'),false);
 }
});
test('constructor refuses duplicate, foreign, malformed and wrong-version operations without effects',()=>{
 const f=directoryCase();for(const operations of [[],[f.operation,f.operation],[{id:'get_representation',version:'0.2.0'}],[{id:'list_members',version:'0.1.0'}]])assert.throws(()=>createLegislativeDirectoryHandlers({...f.transport,now:f.now},operations));
 let effects=0;assert.throws(()=>createLegislativeDirectoryHandlers({...f.transport,now:f.now},[{get id(){effects++;return 'list_members';},version:'0.2.0'}]));assert.equal(effects,0);assert.equal(f.wire.length,0);
});
