/** Delta: request-derived UUID scope over actual JSON and frozen receiving, with synthetic current credentials. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {createResearchLegalLegislationHandlers} from '../handler.mjs';
import {assertLegalSliceRequest,assertUnscopedLegalRequest,legalSliceContext,captureResearchClientSelection} from '../request-context.mjs';
import {storedCase,ids} from './fixture.mjs';

const clientId='a1234567-b123-4c12-8d12-e123456789ab',foreign='d1234567-b123-4c12-8d12-e123456789ab';
for(const id of ids){
 test(`delta ${id}: explicit UUID retains raw reservation and projects exact Core client`,async()=>{
  for(const raw of [clientId,` ${clientId.toUpperCase()} `,clientId+' '.repeat(44)+'ignored suffix']){
   const request={...storedCase(id).arguments,clientId:raw,folderId:''},f=storedCase(id,{request}),call=f.call(),out=JSON.parse(await f.handler()(call));
   const expected={clientResolution:{reference:clientId===raw?clientId:raw.trim().slice(0,80).trim(),clientId},citationResolution:null};
   assert.deepEqual(out.result,JSON.parse(JSON.stringify(f.page)));assert.equal(out.result.result.scope.clientId,clientId);assert.equal(out.result.result.scope.folderId,null);
   assert.deepEqual(f.wire[0].body,{...request,clientId});assert.equal(f.wire[0].url,`https://native-core.example.invalid/api/clio/tools/${id}`);
   assert.deepEqual(f.credentialCalls[0].normalizationContext,expected);assert.equal(f.credentialCalls[0].requestSha256,hash(request));assert.equal(out.argumentsSha256,call.argumentsSha256);
   assert.deepEqual(f.visibleClientIds,[clientId]);assert.equal(f.authority.subject.entityIds[0],clientId);
  }
 });
 test(`delta ${id}: unresolved names stay closed, parser-dependent citations stay held and native folders are delegated`,async()=>{
  const f=storedCase(id),{getCredentials,...transport}=f.transport;let factories=0;
  const [handler]=createResearchLegalLegislationHandlers({...transport,now:f.now,credentialsForCall:()=>{factories++;return getCredentials;}},[f.operation]);
  for(const request of [{...f.arguments,clientId:'Client name'},{...f.arguments,clientId:'not-a-uuid'}]){
   assert.throws(()=>assertLegalSliceRequest(f.operation,request),{message:'UNAVAILABLE'});await assert.rejects(handler.execute({...f.call(),request}),{message:'INVALID_ARGUMENTS'});}
  if(id==='get_legal_reference')for(const request of [{...f.arguments,view:'references',clientId,citation:'Article I'},{...f.arguments,view:'references',clientId,citation:' '}]){
   assert.throws(()=>assertLegalSliceRequest(f.operation,request),{message:'UNAVAILABLE'});await assert.rejects(handler.execute({...f.call(),request}),{message:'UNAVAILABLE'});}
  assert.equal(factories,0);assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
  for(const folderId of ['private-folder',' ']){const selected=storedCase(id,{request:{...f.arguments,clientId,folderId}});
   assert.deepEqual(JSON.parse(await selected.handler()(selected.call())).result,selected.page);assert.equal(selected.wire[0].body.folderId,folderId);}
 });
 test(`delta ${id}: a UUID context cannot borrow a foreign client or a mismatched/nonclient resource subject`,async()=>{
  for(const mode of ['foreign-client','wrong-resource','personal','unscoped-client']){
   const f=storedCase(id,{request:{...storedCase(id).arguments,clientId}}),call=structuredClone(f.call()),a=call.authority;
   if(mode==='foreign-client')a.subject.entityIds=[foreign];
   if(mode==='wrong-resource'){const scope={...a.subject.scopes[0],resourceId:foreign};a.subject.scopes=[scope];a.claims.scopes=[scope];a.decision.scopes=[scope];}
   if(mode==='personal')Object.assign(a.subject,{kind:'personal',entityType:'user',entityIds:[a.binding.actorId]});
   if(mode==='unscoped-client'){delete call.request.clientId;const n=f.contract.normalizeInput(call.request,{clientResolution:null,citationResolution:null});Object.assign(call,{input:n.input,argumentsSha256:n.argumentsSha256,normalizationContext:{clientResolution:null,citationResolution:null}});}
   await assert.rejects(f.handler()(call),{message:'ACCESS_DENIED'});assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
  }
 });
 test(`delta ${id}: fabricated client resolution or extra context cannot acquire native credentials`,async()=>{
  const f=storedCase(id,{request:{...storedCase(id).arguments,clientId}});
  for(const context of [{clientResolution:null,citationResolution:null},{clientResolution:{reference:clientId,clientId:foreign},citationResolution:null},
   {...f.normalizationContext,authorized:true}]){
   await assert.rejects(f.handler()({...f.call(),normalizationContext:context}));
  }
  assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
 });
 test(`delta ${id}: native scope failure and foreign-client receiving never become successful results`,async()=>{
  const f=storedCase(id,{request:{...storedCase(id).arguments,clientId}});f.state.responseFactory=()=>Response.json({message:'RESEARCH_CLIENT_UNAVAILABLE'},{status:404});
  await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});assert.equal(f.wire.length,1);
  f.state.responseFactory=undefined;f.state.resultMutator=page=>page.result.scope.clientId=foreign;
  await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});assert.equal(f.wire.length,2);
 });
}

test('delta legal pure capture, strict legacy preflight and inactive branches retain their exact boundary',()=>{
 const f=storedCase(),request={...f.arguments,clientId};
 assert.deepEqual(legalSliceContext(f.operation,request),{clientResolution:{reference:clientId,clientId},citationResolution:null});
 assert.throws(()=>assertUnscopedLegalRequest(f.operation,request),{message:'UNAVAILABLE'});
 assert.deepEqual(legalSliceContext(f.operation,{...f.arguments,clientId:' ',folderId:null}),{clientResolution:null,citationResolution:null});
 let effects=0;const raw={get clientId(){effects++;return clientId;}};
 assert.throws(()=>captureResearchClientSelection(raw),{message:'INVALID_ARGUMENTS'});assert.equal(effects,0);
 for(const clientId of [null,'',undefined])assert.equal(captureResearchClientSelection({clientId:clientId??null}),null);
 assert.ok(Object.isFrozen(captureResearchClientSelection({clientId})));
});
