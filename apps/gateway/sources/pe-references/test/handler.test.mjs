/** Actual bounded HTTP JSON receiving with synthetic source evidence. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {deny} from '../../../dispatch/operation-result.mjs';
import {createPeReferenceHandlers} from '../handler.mjs';
import {createHandlers,id as family} from '../../../general-reads/families/pe-references.mjs';
import {storedCase,ids,note} from './fixture.mjs';

for(const id of ids){
 test(`${id}: fixed flat original POST, proof-bound credentials and private result carrier`,async()=>{
  const f=storedCase(id),call=f.call(),out=JSON.parse(await f.handler()(call)),[wire]=f.wire,[proof]=f.credentialCalls;
  assert.deepEqual(out,{binding:f.authority.binding,subject:f.authority.subject,operation:f.operation,argumentsSha256:call.argumentsSha256,result:f.page});
  assert.equal(wire.url,`https://native-core.example.invalid/api/clio/tools/${id}`);
  assert.equal(wire.options.method,'POST');assert.deepEqual(wire.body,f.arguments);assert.equal(Object.hasOwn(wire.body,'input'),false);
  assert.equal(wire.options.headers.authorization,'Bearer SYNTHETIC_NATIVE_USER');
  assert.equal(wire.options.headers['x-internal-service-secret'],'SYNTHETIC_INTERNAL_SERVICE');
  assert.equal(wire.options.redirect,'error');assert.equal(wire.options.credentials,'omit');assert.equal(wire.options.cache,'no-store');
  assert.equal(proof.requestSha256,hash(f.arguments));assert.equal(proof.argumentsSha256,call.argumentsSha256);
  assert.deepEqual(proof.operation,f.operation);assert.deepEqual(proof.normalizationContext,{});
 });
 test(`${id}: original selector survives trim/cap and retains case at the native boundary`,async()=>{
  const request={peCode:' '+('a'.repeat(31))+' Z '},f=storedCase(id,{request}),call=f.call();
  assert.equal(call.input.peCode,'a'.repeat(31)+' ');
  const out=JSON.parse(await f.handler()(call));assert.deepEqual(f.wire[0].body,request);
  assert.equal(f.credentialCalls[0].requestSha256,hash(request));
  if(id==='get_pe_report_language')assert.equal(out.result.peCode,call.input.peCode);
 });
 test(`${id}: denied, foreign and incoherent authority reaches no credential or HTTP IO`,async()=>{
  for(const mutate of [a=>a.claims.audience='other',a=>a.claims.actions=[],a=>a.decision.decision='denied',
   a=>a.decision.operation='other@0.2.0',a=>a.decision.actor.actorId='other',a=>a.decision.scopes=[],
   a=>a.sourceIds=['other'],a=>a.claims.binding.tenantId='other',a=>a.claims.issuedAt=new Date(a.deadlineMs).toISOString()]){
   const f=storedCase(id),call=structuredClone(f.call());mutate(call.authority);
   await assert.rejects(f.handler()(call));assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
  }
 });
 test(`${id}: closed arguments/context and normalized digest substitutions fail before credentials`,async()=>{
  const f=storedCase(id);
  for(const request of [{},{peCode:' '},{peCode:null},{peCode:3},{...f.arguments,tenantId:'other'},
   {...f.arguments,actorRole:'capiro_admin'},{...f.arguments,limit:1},{input:f.arguments}]){
   await assert.rejects(f.handler()({...f.call(),request}),{message:'INVALID_ARGUMENTS'});
  }
  await assert.rejects(f.handler()({...f.call(),normalizationContext:{tenantId:'other'}}),{message:'INVALID_ARGUMENTS'});
  await assert.rejects(f.handler()({...f.call(),input:{peCode:'other'}}),{message:'INVALID_ARGUMENTS'});
  await assert.rejects(f.handler()({...f.call(),argumentsSha256:'0'.repeat(64)}),{message:'INVALID_ARGUMENTS'});
  assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
 });
 test(`${id}: credential operation/user correlation and both native credentials are required`,async()=>{
  for(const key of ['binding','subject','operation','policyRevision','sourceIds','requestSha256','argumentsSha256','normalizationContext','origin','bearerToken','serviceSecret','expiresAtMs']){
   const f=storedCase(id);f.state.credentialMutator=receipt=>receipt[key]=key==='expiresAtMs'?f.now():null;
   await assert.rejects(f.handler()(f.call()),{message:'ACCESS_DENIED'});assert.equal(f.wire.length,0);
  }
  const f=storedCase(id);await assert.rejects(f.handler({getCredentials:undefined})(f.call()),{message:'UNAVAILABLE'});
  assert.equal(f.wire.length,0);
 });
 test(`${id}: revoked credential owner, bounded response, cancellation and expiry withhold source bytes`,async()=>{
  const f=storedCase(id);await assert.rejects(f.handler({maxResponseBytes:16})(f.call()),{message:'RESOURCE_LIMIT'});
  const g=storedCase(id),controller=new AbortController();g.state.afterSource=()=>controller.abort();
  await assert.rejects(g.handler()({...g.call(),signal:controller.signal}),{message:'CANCELLED'});
  const h=storedCase(id);h.state.now=h.authority.deadlineMs;
  await assert.rejects(h.handler()(h.call()),{message:'DEADLINE'});assert.equal(h.credentialCalls.length,0);
  const k=storedCase(id);await assert.rejects(k.handler({getCredentials:async()=>deny('ACCESS_DENIED')})(k.call()),{message:'ACCESS_DENIED'});
  assert.equal(k.wire.length,0);
 });
 test(`${id}: domain HTTP errors and invented source completeness cannot become accepted pages`,async()=>{
  for(const response of [()=>Response.json({error:'PRIVATE'}),()=>Response.json({},{status:404}),
   page=>Response.json({...page,tool:'other'}),page=>Response.json({...page,complete:true}),page=>Response.json({output:page})]){
   const f=storedCase(id);f.state.responseFactory=response;
   await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
  }
 });
 test(`${id}: per-call native credential composition receives the exact original call`,async()=>{
  const f=storedCase(id),call=f.call(),{getCredentials,...configuration}=f.transport;let captured;
  const handler=createPeReferenceHandlers({...configuration,now:f.now,credentialsForCall:(operation,original)=>{
   captured={operation,original};return getCredentials;
  }},[f.operation])[0];
  await handler.execute(call);assert.equal(captured.original,call);assert.deepEqual(captured.operation,f.operation);
  assert.throws(()=>f.handler({credentialsForCall:()=>getCredentials}),{message:'GATEWAY_CONFIGURATION'});
 });
}

test('family composition derives the exact three canonical PE operations',()=>{
 const f=storedCase(),handlers=createHandlers({...f.transport,now:f.now});assert.equal(family,'pe-references');
 assert.deepEqual(handlers.map(value=>value.operation.id).sort(),[...ids].sort());
});

test('handler construction refuses foreign, duplicate and wrong-version operations without effects',()=>{
 const f=storedCase();
 for(const operations of [[],[f.operation,f.operation],[{id:'get_program_element',version:'0.2.0'}],[{id:ids[0],version:'0.1.0'}]]){
  assert.throws(()=>createPeReferenceHandlers({...f.transport,now:f.now},operations),{message:'GATEWAY_CONFIGURATION'});
 }
 let effects=0;assert.throws(()=>createPeReferenceHandlers({...f.transport,now:f.now},[{get id(){effects++;return ids[0];},version:'0.2.0'}]));
 assert.equal(effects,0);assert.equal(f.wire.length,0);
});

test('bills preserve legacy nullable links and non-rejected candidate evidence without funding claims',async()=>{
 const f=storedCase('get_pe_bills');f.state.page={...f.page,bills:[
  {...f.page.bills[0],link:null},
  {...f.page.bills[0],id:'119-hr-2',peCodeCount:700,link:{type:'legacy',confidence:0.2,evidence:'Synthetic candidate evidence',status:'candidate'}},
 ]};
 const out=JSON.parse(await f.handler()(f.call()));assert.deepEqual(out.result,f.state.page);
 assert.equal(Object.hasOwn(out.result,'peCode'),false);assert.equal(Object.hasOwn(out.result,'total'),false);
 for(const mutate of [page=>page.bills[0].link={...f.page.bills[0].link,status:'rejected'},
  page=>page.bills.reverse(),page=>page.bills.push({...page.bills[0]})]){
  f.state.resultMutator=mutate;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
});

test('contractors retain missing storage as explicit todo rather than a no-contractors certification',async()=>{
 const f=storedCase('get_pe_contractors');f.state.page={tool:f.operation.id,generatedAt:f.page.generatedAt,data:[],todo:'federal_award table not yet created (Step 28)'};
 const out=JSON.parse(await f.handler()(f.call()));assert.deepEqual(out.result,f.state.page);
 for(const mutate of [page=>page.namedPrimes=[],page=>page.todo=null,page=>page.evidence=f.page.evidence]){
  f.state.resultMutator=mutate;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
});

test('contractor exhibit amounts, rolling awards and candidate association remain separate',async()=>{
 const f=storedCase('get_pe_contractors'),out=JSON.parse(await f.handler()(f.call()));
 assert.equal(out.result.evidence.governmentExhibit.amountM,7);assert.equal(out.result.evidence.federalAwards.amountM,5);
 assert.equal(out.result.evidence.governmentExhibit.provenance.kind,'legacy_compatibility');
 assert.equal(out.result.evidence.federalAwards.provenance.windowMonths,24);
 assert.equal(out.result.data[1].source,'program');assert.match(out.result.data[1].attribution,/Linked via DoD Acquisition Program/);
 for(const mutate of [page=>page.evidence.federalAwards.amountM=12,page=>page.evidence.federalAwards.buckets[0].amountM=10,
  page=>page.evidence.federalAwards.buckets[2].amountM=1,page=>page.data[1].attribution=page.data[0].attribution,
  page=>page.evidence.governmentExhibit.provenance.kind='canonical_snapshot',page=>page.evidenceNote='All awards matched']){
  f.state.resultMutator=mutate;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
});

test('report language preserves program-level candidate attribution and loaded-source warnings',async()=>{
 const f=storedCase('get_pe_report_language');
 f.state.page={...f.page,provisions:[{...f.page.provisions[0],matchBasis:'program_alias',reviewStatus:'candidate',
  matchScope:'program_level',attributionCaveat:note('PeProgramAttributionCaveat')}],
  note:'1 of 1 linked provision(s) are PROGRAM-LEVEL matches (matched via a program alias, because FY committee reports name programs, not PE codes). They may apply to sibling PEs in the same program \u2014 attribute such language at the program level, not exclusively to this budget line. Each carries matchScope:"program_level" and an attributionCaveat.'};
 assert.deepEqual(JSON.parse(await f.handler()(f.call())).result,f.state.page);
 for(const mutate of [page=>page.provisions[0].attributionCaveat=null,page=>page.provisions[0].matchScope='pe_specific',
  page=>page.provisions[0].reviewStatus='rejected',page=>delete page.note,page=>page.peCode='other']){
  f.state.resultMutator=mutate;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
 f.state.resultMutator=undefined;f.state.page={...f.page,provisions:[],note:note('PeNoReportNote')};
 const empty=JSON.parse(await f.handler()(f.call())).result;assert.match(empty.note,/not proof that no language exists/);
 f.state.resultMutator=page=>page.note='No committee language exists';await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
});

test('source row caps refuse overbroad pages instead of silently truncating or claiming completeness',async()=>{
 for(const [id,key,size] of [['get_pe_bills','bills',101],['get_pe_report_language','provisions',51],['get_pe_contractors','data',11],['get_pe_contractors','namedPrimes',26]]){
  const f=storedCase(id);f.state.resultMutator=page=>{
   page[key]=Array.from({length:size},(_,index)=>({...page[key][0],
    ...(id==='get_pe_contractors'?{contractorName:`synthetic-${index}`}:{id:`synthetic-${index}`}),
   }));
   if(key==='data'){
    page.evidence.federalAwards.amountM=33;page.evidence.federalAwards.count=22;
    Object.assign(page.evidence.federalAwards.buckets[0],{amountM:33,count:22});
    Object.assign(page.evidence.federalAwards.buckets[1],{amountM:0,count:0});
   }
   if(key==='namedPrimes')Object.assign(page.evidence.governmentExhibit,{amountM:182,count:26});
  };
  await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
});
