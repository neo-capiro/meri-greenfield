/** Synthetic native bridge consumption over real CONTROL/task/gateway owners. Not live Core/provider/SQL qualification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import schema from '../../../packages/contracts/retrieval-0.2/client-knowledge-search.schema.json' with {type:'json'};
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {resolveOperationContract} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {decodeNativeReadObservation,NATIVE_READ_OBSERVATION_HEADER as HEADER} from '../../../packages/contracts/native-read-observation-0.2/validate.mjs';
import {storedCase,storedSearchPage,searchId,clientId} from '../../gateway/sources/client-knowledge-search/test/fixture.mjs';
import {createGeneralReadFamilyHandlers} from '../../gateway/general-reads/integration.mjs';
import {ownerFixture,uuid} from '../native-authority/native-read-credentials/test/fixture.mjs';
import {createControlGeneralReadRuntime} from '../general-read-runtime.mjs';

const unavailableNote=schema.$defs.ClientKnowledgeSearchOutput.oneOf[1].properties.note.const;
function subject(scene,kind){const a=scene.authority,scope={tenantId:a.binding.tenantId,kind:kind==='client'?'client':'tenant',resourceId:kind==='client'?clientId:a.binding.tenantId,policyRevision:a.policyRevision};Object.assign(a.subject,{kind,entityType:kind==='client'?'client':'user',entityIds:[kind==='client'?clientId:a.binding.actorId],scopes:[scope]});a.claims.scopes=[scope];a.decision.scopes=[scope];}
async function wired({request,personal=false,client=false,staticCredentials=false,missingContext=false}={}){
 const scene=storedCase(searchId,request===undefined?{}:{request}),nativeFetch=scene.transport.fetchImpl;if(personal)subject(scene,'personal');if(client)subject(scene,'client');
 // Explicit offline native stand-in: consume the private carrier BEFORE producing the DTO. The adapter never rewrites results.
 scene.transport={...scene.transport,async fetchImpl(url,options){
  scene.state.bridgeCalls=(scene.state.bridgeCalls??0)+1;const raw=JSON.parse(options.body),observation=decodeNativeReadObservation(options.headers[HEADER],{operation:scene.operation,request:raw});
  assert.deepEqual(raw,scene.arguments);(scene.state.observations??=[]).push(observation);
  scene.state.page=storedSearchPage(scene.contract.normalizeInput(raw,observation.context).input,observation.context.asOf);return nativeFetch(url,options);
 }};
 const f=await ownerFixture(searchId,{scene}),{getCredentials,credentialsForCall,...transport}=f.transport;
 const credentials=staticCredentials?{getCredentials:()=>{f.state.staticFallbackCalls=(f.state.staticFallbackCalls??0)+1;throw Error('STATIC_FALLBACK_USED');}}:{credentialsForCall:f.owner.credentialsForCall};
 const handlers=await createGeneralReadFamilyHandlers({families:{[f.family]:{...transport,...credentials}},now:f.now,newId:randomUUID}),{installationOwner,...gateway}=f.gatewayConfiguration;
 // Fixture-port compatibility only: its generic raw-selector guard treats '' as a foreign client.
 // Delegate every current authority check to the ORIGINAL owner; this models no production policy.
 const original=gateway.authority,fixtureAuthority={...original,check(call){
  if(call.descriptor.operation.id===searchId&&call.descriptor.operation.version==='0.2.0'&&call.input?.clientId===''){
   f.state.fixtureEmptySelectorCompatibilityCalls=(f.state.fixtureEmptySelectorCompatibilityCalls??0)+1;
   return original.check({...call,input:{...call.input,clientId:null}});
  }
  return original.check(call);
 }};
 const configuration={...gateway,authority:fixtureAuthority,handlers,scopes:f.scopes,readCurrentInstallation:({signal})=>installationOwner.readCurrent({signal}),nativeReadContextPorts:missingContext?undefined:f.owner.nativeReadContextPorts},port=createControlGeneralReadRuntime(configuration);
 return {...f,port,handlers,fixtureAuthority,disabledPort:()=>createControlGeneralReadRuntime({...configuration,sourceEnabled:false}),invoke:(extra={})=>port.execute({operation:f.operation,arguments:f.request,deliveryId:'kb-synthetic-source',...extra})};
}
function beforeSource(f){assert.equal(f.wire.length,0);assert.equal(f.stateOwner.secrets,0);assert.equal(f.state.reservations.size,0);assert.equal(f.state.budget.consumed_micro_usd,0);}
function unknown(f){const [r]=f.state.reservations.values();assert.equal(r.state,'UNKNOWN');assert.equal(r.hold_micro_usd,1);assert.equal(r.output_bytes,null);assert.equal(r.charged_micro_usd,null);assert.equal(f.state.budget.consumed_micro_usd,0);assert.equal([...f.state.produced.values()][0].completion,null);}

for(const mode of ['success','ordinary-empty','caught-unavailable'])test(`semantic KB ${mode} consumes one retained observation and settles unchanged native result bytes`,async()=>{
 const f=await wired();f.core.state.beforeResponse=()=>f.state.now++;f.state.afterSource=()=>f.state.now+=5;
 if(mode!=='success')f.state.resultMutator=page=>{page.results=[];if(mode==='caught-unavailable')page.note=unavailableNote;};
 try{
  const raw=await f.invoke(),out=JSON.parse(raw),[observation]=f.state.observations;
  assert.deepEqual(Object.keys(out).sort(),['binding','subject','operation','argumentsSha256','result'].sort());assert.deepEqual(out.binding,f.binding);assert.deepEqual(out.subject,f.authority.subject);assert.deepEqual(out.operation,f.operation);
  assert.equal(out.result.generatedAt,observation.context.asOf);assert.deepEqual(out.result,f.state.nativeValue);assert.equal(observation.requestSha256,hash(f.request));assert.deepEqual(Object.keys(observation).sort(),['schemaVersion','operation','requestSha256','context'].sort());
  assert.deepEqual(f.stateOwner.secretProof.normalizationContext,observation.context);assert.equal(f.stateOwner.secretProof.requestSha256,hash(f.request));assert.equal(out.argumentsSha256,f.contract.normalizeInput(f.request,observation.context).argumentsSha256);
  assert.equal(f.wire.length,1);assert.equal(f.state.bridgeCalls,1);assert.equal(f.wire[0].url,`https://native-core.example.invalid/api/clio/tools/${searchId}`);assert.deepEqual(f.wire[0].body,f.request);
  assert.equal(f.state.fixtureEmptySelectorCompatibilityCalls??0,0,'truthy client never uses fixture compatibility');
  const [reservation]=f.state.reservations.values(),[receipt]=f.state.produced.values();assert.equal(reservation.state,'SETTLED');assert.equal(reservation.output_bytes,Buffer.byteLength(raw));assert.equal(receipt.completion.resultSha256,hash(out));
  if(mode==='caught-unavailable')assert.equal(out.result.note,unavailableNote);if(mode!=='success')assert.deepEqual(out.result.results,[]);
 }finally{f.scope.abort();}
});

for(const kind of ['personal','client'])for(const selector of ['omitted','null','empty'])test(`semantic KB ${selector} client selector preserves native no-client note under current ${kind} authority`,async()=>{
 const request={query:' policy '};if(selector!=='omitted')request.clientId=selector==='null'?null:'';const f=await wired({request,[kind]:true});f.core.state.clientIds=[];
 try{
  const raw=await f.invoke(),out=JSON.parse(raw),[observation]=f.state.observations;assert.equal(out.result.generatedAt,observation.context.asOf);assert.equal(Object.hasOwn(out.result,'clientId'),false);
  assert.deepEqual(out.result.results,[]);assert.equal(out.result.note,schema.$defs.ClientKnowledgeSearchOutput.oneOf[0].properties.note.const);assert.deepEqual(f.wire[0].body,request);
  assert.equal(f.stateOwner.secretProof.requestSha256,hash(request));assert.equal(observation.requestSha256,hash(request));
  if(selector==='empty'){assert.equal(f.request.clientId,'');assert.equal(f.wire[0].body.clientId,'');assert.ok(f.state.fixtureEmptySelectorCompatibilityCalls>0);}else assert.equal(f.state.fixtureEmptySelectorCompatibilityCalls??0,0);
  assert.equal(f.wire.length,1);assert.equal([...f.state.reservations.values()][0].state,'SETTLED');assert.equal([...f.state.produced.values()][0].completion.resultSha256,hash(out));
 }finally{f.scope.abort();}
});

test('semantic empty-selector fixture compatibility cannot rewrite graph or foreign truthy client authority checks',async()=>{
 const f=await wired();
 try{
  for(const [operation,input] of [[{id:'query_knowledge_graph',version:'0.2.0'},{clientId:''}],[f.operation,{...f.request,clientId:uuid('e')}]] ){
   await assert.rejects(f.fixtureAuthority.check({credential:f.gatewayConfiguration.credential,descriptor:resolveOperationContract(operation).descriptor,input,signal:f.scope.signal,limitDeadline:()=>{}}),{message:'ACCESS_DENIED'});
  }
  assert.equal(f.state.fixtureEmptySelectorCompatibilityCalls??0,0);beforeSource(f);
 }finally{f.scope.abort();}
});

test('semantic KB missing installation, source, trusted context or model-injected clock refuses before source',async()=>{
 const f=await wired();
 try{
  f.state.installRevoked=true;await assert.rejects(f.invoke(),{message:'UNAVAILABLE'});f.state.installRevoked=false;
  await assert.rejects(f.disabledPort().execute({operation:f.operation,arguments:f.request,deliveryId:'kb-disabled'}),{message:'UNAVAILABLE'});
  await assert.rejects(f.invoke({arguments:{...f.request,asOf:f.normalizationContext.asOf}}));beforeSource(f);
 }finally{f.scope.abort();}
 const missing=await wired({missingContext:true});try{await assert.rejects(missing.invoke(),{message:'UNAVAILABLE'});beforeSource(missing);}finally{missing.scope.abort();}
});

test('semantic KB static credentials cannot bypass the retained per-call observation',async()=>{
 const f=await wired({staticCredentials:true});try{await assert.rejects(f.invoke(),{message:'UNAVAILABLE'});assert.equal(f.state.staticFallbackCalls??0,0);assert.equal(f.wire.length,0);assert.equal(f.stateOwner.secrets,0);unknown(f);}finally{f.scope.abort();}
});

test('semantic KB malformed/foreign selectors, personal selected-client and current native revocation cannot dispatch source',async()=>{
 for(const mode of ['malformed','foreign','personal','visibility','task','principal']){
  const f=await wired({personal:mode==='personal'});if(mode==='visibility')f.core.state.clientIds=[];if(mode==='task')f.state.grant.state='REVOKED';if(mode==='principal')f.core.state.principal={...f.core.principal,actorId:uuid('e')};
  const args=mode==='malformed'?{...f.request,clientId:'client name'}:mode==='foreign'?{...f.request,clientId:uuid('e')}:f.request;
  try{await assert.rejects(f.invoke({arguments:args}));beforeSource(f);}finally{f.scope.abort();}
 }
});

test('semantic KB native generatedAt/client/query substitution and uncertain response withhold the whole result without retry',async()=>{
 for(const mode of ['clock','client','query','uncertain']){
  const f=await wired();if(mode==='uncertain')f.state.responseFactory=()=>{throw Error('SYNTHETIC_CONNECTION_UNCERTAIN');};else f.state.resultMutator=page=>{if(mode==='clock')page.generatedAt=new Date(Date.parse(page.generatedAt)+1).toISOString();if(mode==='client')page.clientId=uuid('e');if(mode==='query')page.query='substituted';};
  try{await assert.rejects(f.invoke(),{message:'INVALID_RESULT'});assert.equal(f.wire.length,1);assert.equal(f.state.bridgeCalls,1);unknown(f);}finally{f.scope.abort();}
 }
});

test('semantic KB thrown source validation/not-found failures remain one failure and UNKNOWN, never unavailable success',async()=>{
 for(const reason of ['INVALID_CLIENT','CLIENT_NOT_FOUND']){const f=await wired();f.state.responseFactory=()=>Response.json({message:reason},{status:400});
  try{await assert.rejects(f.invoke(),{message:'INVALID_RESULT'});assert.equal(f.wire.length,1);assert.equal(f.state.bridgeCalls,1);unknown(f);}finally{f.scope.abort();}
 }
});

test('semantic KB authority drift after source or across credential await retains UNKNOWN without output completion',async()=>{
 for(const mode of ['membership','visibility','task','credential']){
  const f=await wired();if(mode==='credential')f.stateOwner.beforeSecret=()=>f.core.state.membershipRevision='e'.repeat(64);else f.state.afterSource=()=>{if(mode==='membership')f.core.state.membershipRevision='e'.repeat(64);if(mode==='visibility')f.core.state.clientIds=[];if(mode==='task')f.state.grant.state='REVOKED';};
  try{await assert.rejects(f.invoke());assert.equal(f.wire.length,mode==='credential'?0:1);unknown(f);}finally{f.scope.abort();}
 }
});

test('semantic KB pre-aborted lifetime and in-flight cancel/expiry preserve canonical errors and UNKNOWN',async()=>{
 const before=await wired(),aborted=new AbortController();aborted.abort();try{await assert.rejects(before.invoke({signal:aborted.signal}),{message:'DEADLINE'});beforeSource(before);}finally{before.scope.abort();}
 for(const mode of ['cancel','expiry']){const f=await wired(),controller=new AbortController();f.state.afterSource=()=>{if(mode==='cancel')controller.abort();else f.state.now=f.deadlineMs;};
  try{await assert.rejects(f.invoke({signal:controller.signal}),{message:mode==='cancel'?'CANCELLED':'DEADLINE'});assert.equal(f.wire.length,1);unknown(f);}finally{f.scope.abort();}
 }
});
