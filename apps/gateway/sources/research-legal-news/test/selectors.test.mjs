/** Delta: UUID selection adds no lookup/parser and does not widen the admitted news views. Synthetic JSON only. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {createResearchLegalNewsHandlers} from '../handler.mjs';
import {assertNewsSliceRequest,assertUnscopedNewsRequest,newsSliceContext} from '../request-context.mjs';
import {storedCase} from './fixture.mjs';

const clientId='a1234567-b123-4c12-8d12-e123456789ab',foreign='d1234567-b123-4c12-8d12-e123456789ab';
const selections=[...['news','budget','personnel','research'].map(kind=>({view:'source',kind,id:'synthetic-source'})),{view:'personnel',year:'2026',kind:'registration'}];
for(const request of selections)test(`delta ${request.view}/${request.kind}: UUID client preserves raw selectors, native context and unchanged typed source`,async()=>{
 const raw={...request,clientId:` ${clientId.toUpperCase()} `,folderId:'',sessionKey:'2026'},f=storedCase(undefined,{request:raw});
 const call=f.call(),out=JSON.parse(await f.handler()(call));
 assert.deepEqual(out.result,JSON.parse(JSON.stringify(f.page)));assert.deepEqual(f.wire[0].body,raw);
 assert.deepEqual(f.credentialCalls[0].normalizationContext,{clientResolution:{reference:clientId.toUpperCase(),clientId},
  effectiveScope:{jurisdiction:'FL',sessionKey:'2026',folderId:null,clientId},windowAsOf:null,defaultYear:null,owner:null});
 assert.equal(f.credentialCalls[0].requestSha256,hash(raw));assert.equal(f.credentialCalls[0].argumentsSha256,call.argumentsSha256);
 assert.deepEqual(f.visibleClientIds,[clientId]);assert.equal(f.authority.subject.entityIds[0],clientId);
 assert.equal(out.result.authority,f.page.authority);assert.equal(Object.hasOwn(out.result,'absenceEvidence'),false);
});

test('delta news UUID clipping matches the Core bridge without clipping or rewriting the transport request',async()=>{
 const request={...storedCase().arguments,clientId:clientId+' '.repeat(44)+'ignored suffix'},f=storedCase(undefined,{request});
 await f.handler()(f.call());assert.deepEqual(f.credentialCalls[0].normalizationContext.clientResolution,{reference:clientId,clientId});assert.deepEqual(f.wire[0].body,request);
});

test('delta news names, folders, clocks and monitor branches remain unavailable before credential factories',async()=>{
 const f=storedCase(),{getCredentials,...transport}=f.transport;let factories=0;
 const [handler]=createResearchLegalNewsHandlers({...transport,now:f.now,credentialsForCall:()=>{factories++;return getCredentials;}},[f.operation]);
 for(const request of [{...f.arguments,clientId:'Client name'},{...f.arguments,clientId:'malformed-uuid'},
  {...f.arguments,clientId,folderId:'private-folder'},{...f.arguments,clientId,folderId:' '},
  {clientId},{view:'news',clientId},{view:'monitors',clientId},{view:'personnel',clientId},{view:'personnel',clientId,year:null}]){
  assert.throws(()=>assertNewsSliceRequest(f.operation,request),{message:'UNAVAILABLE'});
  await assert.rejects(handler.execute({...f.call(),request}),{message:'UNAVAILABLE'});
 }
 assert.equal(factories,0);assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
});

test('delta news current client subject and matching resource remain mandatory, including on exact-source branches',async()=>{
 for(const mode of ['foreign-client','wrong-resource','personal','unscoped-client']){
  const f=storedCase(undefined,{request:{...storedCase().arguments,clientId}}),call=structuredClone(f.call()),a=call.authority;
  if(mode==='foreign-client')a.subject.entityIds=[foreign];
  if(mode==='wrong-resource'){const scope={...a.subject.scopes[0],resourceId:foreign};a.subject.scopes=[scope];a.claims.scopes=[scope];a.decision.scopes=[scope];}
  if(mode==='personal')Object.assign(a.subject,{kind:'personal',entityType:'user',entityIds:[a.binding.actorId]});
  if(mode==='unscoped-client'){delete call.request.clientId;const context=newsSliceContext(f.operation,call.request),n=f.contract.normalizeInput(call.request,context);Object.assign(call,{input:n.input,argumentsSha256:n.argumentsSha256,normalizationContext:context});}
  await assert.rejects(f.handler()(call),{message:'ACCESS_DENIED'});assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
 }
});

test('delta news no fabricated client resolution, folder result, clock or owner can replace request-determined context',async()=>{
 const f=storedCase(undefined,{request:{...storedCase().arguments,clientId}}),base=f.normalizationContext;
 for(const context of [{...base,clientResolution:null},{...base,clientResolution:{reference:clientId,clientId:foreign}},
  {...base,effectiveScope:{...base.effectiveScope,clientId:foreign}},
  {...base,effectiveScope:{...base.effectiveScope,folderId:'invented-folder'}},
  {...base,windowAsOf:f.page.generatedAt},{...base,owner:{tenantId:f.binding.tenantId,clerkUserId:'invented'}}]){
  await assert.rejects(f.handler()({...f.call(),normalizationContext:context}));
 }
 assert.equal(f.credentialCalls.length,0);assert.equal(f.wire.length,0);
});

test('delta news strict old API stays unscoped and native wall/feature failures remain failures',async()=>{
 const f=storedCase(undefined,{request:{...storedCase().arguments,clientId}});
 assert.throws(()=>assertUnscopedNewsRequest(f.operation,f.arguments),{message:'UNAVAILABLE'});
 assert.ok(Object.isFrozen(newsSliceContext(f.operation,f.arguments).clientResolution));
 for(const message of ['RESEARCH_CLIENT_UNAVAILABLE','FEATURE_DISABLED','CURRENT_MEMBER_REQUIRED']){
  f.state.responseFactory=()=>Response.json({message},{status:404});await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
 assert.equal(f.wire.length,3);
});
