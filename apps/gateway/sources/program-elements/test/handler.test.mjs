/** Actual bounded native JSON, synthetic stored rows and exact private evidence mode. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {decodeNativeReadObservation,NATIVE_READ_OBSERVATION_HEADER} from '../../../../../packages/contracts/native-read-observation-0.2/validate.mjs';
import {createRetainedHttpTransport} from '../../retained-reads/http-transport.mjs';
import {retainedCall} from '../../retained-reads/call-context.mjs';
import {createProgramElementHandlers} from '../handler.mjs';
import {assertProgramElementRequest} from '../request-context.mjs';
import {storedCase,storedPage,ids} from './fixture.mjs';

for(const id of ids){
 for(const evidenceAccuracyMode of ['off','shadow','enforce'])test(`${id}/${evidenceAccuracyMode}: exact mode, raw body, proof and full native DTO survive JSON transport`,async()=>{
  const f=storedCase(id,{evidenceAccuracyMode}),call=f.call(),out=JSON.parse(await f.handler()(call)),[wire]=f.wire,[proof]=f.credentialCalls;
  assert.deepEqual(out,{binding:f.authority.binding,subject:f.authority.subject,operation:f.operation,argumentsSha256:call.argumentsSha256,result:f.page});
  assert.equal(wire.url,`https://native-core.example.invalid/api/clio/tools/${id}`);assert.equal(wire.options.method,'POST');assert.deepEqual(wire.body,f.arguments);
  assert.equal(Object.hasOwn(wire.body,'evidenceAccuracyMode'),false);assert.equal(wire.options.redirect,'error');assert.equal(wire.options.credentials,'omit');assert.equal(wire.options.cache,'no-store');
  const observation=decodeNativeReadObservation(wire.options.headers[NATIVE_READ_OBSERVATION_HEADER],{operation:f.operation,request:wire.body});
  assert.deepEqual(observation.context,{evidenceAccuracyMode});assert.equal(observation.requestSha256,hash(f.arguments));
  assert.deepEqual(proof.operation,f.operation);assert.deepEqual(proof.normalizationContext,{evidenceAccuracyMode});assert.equal(proof.requestSha256,hash(f.arguments));assert.equal(proof.argumentsSha256,call.argumentsSha256);
  assert.deepEqual(f.state.credentialOwnerCalls[0].operation,f.operation);assert.equal(f.state.credentialOwnerCalls[0].call,call);
  assert.equal(wire.options.headers.authorization,'Bearer SYNTHETIC_NATIVE_USER');assert.equal(wire.options.headers['x-internal-service-secret'],'SYNTHETIC_INTERNAL_SERVICE');
  const model=id===ids[0]?out.result.data[0].currentFundingClaim:out.result.currentFundingClaim;
  assert.equal(Object.hasOwn(model,'semantics'),evidenceAccuracyMode==='enforce');
  if(id!==ids[0])assert.equal(Object.hasOwn(out.result,'lineage'),evidenceAccuracyMode==='enforce');assert.equal(f.wire.length,1);
 });
 test(`${id}: mode context is closed and cannot arrive through model selectors or static credentials`,async()=>{
  const f=storedCase(id),call=f.call();
  for(const request of [{...f.arguments,evidenceAccuracyMode:'enforce'},{...f.arguments,tenantId:'other'},{input:f.arguments}])await assert.rejects(f.handler()({...call,request}),{message:'INVALID_ARGUMENTS'});
  for(const normalizationContext of [{},{evidenceAccuracyMode:'auto'},{evidenceAccuracyMode:'off',source:'forged'}])await assert.rejects(f.handler()({...call,normalizationContext}),{message:'INVALID_ARGUMENTS'});
  const {credentialsForCall,...passive}=f.transport;let calls=0;
  const [handler]=createProgramElementHandlers({...passive,now:f.now,getCredentials:async()=>{calls++;throw Error('UNEXPECTED');}},[f.operation]);
  await assert.rejects(handler.execute(call),{message:'UNAVAILABLE'});assert.equal(calls,0);assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
 });
 test(`${id}: receiving a different mode cannot establish or change trusted mode`,async()=>{
  for(const evidenceAccuracyMode of ['off','enforce']){
   const f=storedCase(id,{evidenceAccuracyMode});f.state.page=storedPage(id,f.call().input,evidenceAccuracyMode==='off'?'enforce':'off',f.now());
   await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});assert.equal(f.wire.length,1);
  }
 });
 test(`${id}: credential substitutions and denied current family grants reach no tool HTTP`,async()=>{
  for(const key of ['binding','subject','operation','policyRevision','sourceIds','requestSha256','argumentsSha256','normalizationContext','origin','bearerToken','serviceSecret','expiresAtMs']){
   const f=storedCase(id);f.state.credentialMutator=receipt=>receipt[key]=key==='expiresAtMs'?f.now():null;
   await assert.rejects(f.handler()(f.call()),{message:'ACCESS_DENIED'});assert.equal(f.wire.length,0);
  }
  for(const mutate of [a=>a.sourceIds=['foreign'],a=>a.claims.actions=[],a=>a.decision.decision='denied',a=>a.decision.actor.actorId='foreign']){
   const f=storedCase(id),call=structuredClone(f.call());mutate(call.authority);await assert.rejects(f.handler()(call));assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
  }
  const f=storedCase(id);f.state.resourceDenied=true;await assert.rejects(f.handler()(f.call()),{message:'ACCESS_DENIED'});assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
 });
 test(`${id}: errors, oversize, expired and cancelled requests cannot release source bytes`,async()=>{
  for(const responseFactory of [page=>Response.json({output:page}),page=>Response.json({...page,tool:'query_economic_data'}),()=>Response.json({error:'PRIVATE'},{status:503})]){
   const f=storedCase(id);f.state.responseFactory=responseFactory;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
  }
  const f=storedCase(id);await assert.rejects(f.handler({maxResponseBytes:16})(f.call()),{message:'RESOURCE_LIMIT'});
  const g=storedCase(id),controller=new AbortController();g.state.afterSource=()=>controller.abort();await assert.rejects(g.handler()({...g.call(),signal:controller.signal}),{message:'CANCELLED'});
  const h=storedCase(id);await assert.rejects(h.handler()({...h.call(),signal:AbortSignal.abort()}),{message:'CANCELLED'});assert.equal(h.credentialCalls.length,0);
  const expired=storedCase(id);expired.state.now=expired.authority.deadlineMs;await assert.rejects(expired.handler()(expired.call()),{message:'DEADLINE'});assert.equal(expired.wire.length,0);
 });
 test(`${id}: fixed observation transport rejects delegated/static mode and operation/body substitution`,async()=>{
  const f=storedCase(id),current=retainedCall(f.operation,f.call(),f.now);let effects=0;
  const transport=createRetainedHttpTransport({origin:f.transport.origin,now:f.now,delegatedTransport:{async read(){effects++;}}});
  await assert.rejects(transport.read(current,{path:`/api/clio/tools/${id}`,method:'POST',body:f.arguments,serviceSecret:true,observation:'evidence-mode'}),{message:'UNAVAILABLE'});
  for(const spec of [{path:`/api/clio/tools/${id}`,method:'POST',body:f.arguments,serviceSecret:true},
   {path:`/api/clio/tools/${ids.find(other=>other!==id)}`,method:'POST',body:f.arguments,serviceSecret:true,observation:'evidence-mode'},
   {path:`/api/clio/tools/${id}`,method:'POST',body:{...f.arguments,foreign:true},serviceSecret:true,observation:'evidence-mode'},
   {path:`/api/clio/tools/${id}`,method:'GET',body:f.arguments,serviceSecret:true,observation:'evidence-mode'}])await assert.rejects(transport.read(current,spec),{message:'GATEWAY_CONFIGURATION'});
  assert.equal(effects,0);assert.equal(f.wire.length,0);
 });
}

test('program-element constructor is finite, side-effect free and preserves requested order',()=>{
 const f=storedCase(),operations=[...ids].reverse().map(id=>({id,version:'0.2.0'}));
 assert.deepEqual(createProgramElementHandlers({...f.transport,now:f.now},operations).map(h=>h.operation),operations);
 for(const selected of [[],[f.operation,f.operation],[{id:ids[0],version:'0.1.0'}],[{id:'get_pe_bills',version:'0.2.0'}],[{id:'search_federal_grants',version:'0.2.0'}]])assert.throws(()=>createProgramElementHandlers({...f.transport,now:f.now},selected),{message:'GATEWAY_CONFIGURATION'});
 let effects=0;assert.throws(()=>createProgramElementHandlers({...f.transport,now:f.now},[{get id(){effects++;return ids[0];},version:'0.2.0'}]));
 assert.equal(effects,0);assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
});

test('program-element preflight admits canonical scalar raw values without getters or authority insertion',()=>{
 let effects=0;const f=storedCase();
 for(const raw of [{get query(){effects++;return 'x';}},new Proxy({},{get(){effects++;}}),{clientId:'other'},{evidenceAccuracyMode:'off'}])assert.throws(()=>assertProgramElementRequest(f.operation,raw),{message:'INVALID_ARGUMENTS'});
 assert.equal(effects,0);assert.throws(()=>assertProgramElementRequest({id:'query_economic_data',version:'0.2.0'},{}),{message:'INVALID_ARGUMENTS'});
 const raw={query:7,service:false,hasData:'true',limit:true},snapshot=assertProgramElementRequest(f.operation,raw);assert.deepEqual(snapshot,raw);assert.equal(Object.isFrozen(snapshot),true);
 const admitted=f.contract.normalizeInput(raw,f.normalizationContext).input;assert.equal(admitted.query,null);assert.equal(admitted.hasData,null);assert.equal(admitted.limit,20);
});

test('finder receiving preserves selected bounds, labeled funding and distinct fiscal-year claims',async()=>{
 for(const mutate of [page=>page.page=1,page=>page.limit=50,page=>page.data.push(...Array(3).fill(page.data[0])),
  page=>page.data[0].spark=[12],page=>page.data[0].currentClaim.value=99,page=>page.data[0].funding.currentVsRequest='invented',
  page=>page.data[0].currentFundingClaim.semantics='enacted',page=>page.data[0].identifierKind='procurement_line_item']){
  const f=storedCase(ids[0],{evidenceAccuracyMode:'enforce'});f.state.resultMutator=mutate;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
});

test('detail/timeline selectors, exact stored decimals, lineage and provenance cannot be upgraded',async()=>{
 for(const id of ids.slice(1))for(const mutate of [page=>{(page.programElement??page).peCode='OTHER';},
  page=>{(page.programElement?.years??page.years)[0].request=12;},page=>page.lineage.note='verified',
  page=>page.currentFundingClaim.value=99,page=>{(page.programElement?.years??page.years)[0].fundingClaim.enactmentStatus='enacted';}]){
  const f=storedCase(id,{evidenceAccuracyMode:'enforce'});f.state.resultMutator=mutate;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
 const f=storedCase(ids[2],{evidenceAccuracyMode:'enforce'});f.state.resultMutator=page=>delete page.years[0].fundingClaim.source;await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 for(const id of ids.slice(1)){
  const g=storedCase(id);for(const request of [{},{peCode:7},{peCode:' '},{peCode:'0601000A',fy:2026}])await assert.rejects(g.handler()({...g.call(),request}),{message:'INVALID_ARGUMENTS'});
  assert.equal(g.credentialCalls.length,0);assert.equal(g.wire.length,0);
 }
});
