/** Synthetic bridge consumption and governed source integration only; the current Core bridge is not qualified. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {decodeNativeReadObservation,NATIVE_READ_OBSERVATION_HEADER as HEADER} from '../../../packages/contracts/native-read-observation-0.2/validate.mjs';
import {storedCase,storedPage,ids} from '../../gateway/sources/funding-opportunities/test/fixture.mjs';
import {createGeneralReadFamilyHandlers} from '../../gateway/general-reads/integration.mjs';
import {ownerFixture,uuid} from '../native-authority/native-read-credentials/test/fixture.mjs';
import {createControlGeneralReadRuntime} from '../general-read-runtime.mjs';
import {familyReads} from '../../worker/conversation/reads/availability.mjs';
import {READ_FAMILY_IDS} from '../../worker/conversation/reads/families.mjs';
import {mountReads} from '../../worker/conversation/reads/test/fixture.mjs';

async function wired(id,{staticCredentials=false,missingContext=false,scene=storedCase(id)}={}){
 const nativeFetch=scene.transport.fetchImpl;
 // This explicit offline stand-in consumes the verified carrier. It is not evidence that current Core consumes it.
 scene.transport={...scene.transport,async fetchImpl(url,options){
  scene.state.bridgeCalls=(scene.state.bridgeCalls??0)+1;
  const request=JSON.parse(options.body),observation=decodeNativeReadObservation(options.headers[HEADER],{operation:scene.operation,request});
  assert.deepEqual(request,scene.arguments);(scene.state.observations??=[]).push(observation);
  const normalized=scene.contract.normalizeInput(request,observation.context);
  scene.state.page=storedPage(id,normalized.input,observation.context.asOf,new Date(scene.now()-60000).toISOString());
  return nativeFetch(url,options);
 }};
 const f=await ownerFixture(id,{scene}),{getCredentials,credentialsForCall,...transport}=f.transport;
 const credentialConfiguration=staticCredentials?{getCredentials:()=>{f.state.staticFallbackCalls=(f.state.staticFallbackCalls??0)+1;throw Error('STATIC_FALLBACK_USED');}}:{credentialsForCall:f.owner.credentialsForCall};
 const handlers=await createGeneralReadFamilyHandlers({families:{[f.family]:{...transport,...credentialConfiguration}},now:f.now,newId:randomUUID});
 const {installationOwner,...gateway}=f.gatewayConfiguration;
 const configuration={...gateway,handlers,scopes:f.scopes,readCurrentInstallation:({signal})=>installationOwner.readCurrent({signal}),nativeReadContextPorts:missingContext?undefined:f.owner.nativeReadContextPorts};
 const port=createControlGeneralReadRuntime(configuration);
 return {...f,port,handlers,disabledPort:()=>createControlGeneralReadRuntime({...configuration,sourceEnabled:false}),invoke:(extra={})=>port.execute({operation:f.operation,arguments:f.request,deliveryId:'funding-synthetic-source',...extra})};
}
function unknown(f){
 const [r]=f.state.reservations.values();assert.equal(r.state,'UNKNOWN');assert.equal(r.hold_micro_usd,1);assert.equal(r.output_bytes,null);assert.equal(r.charged_micro_usd,null);
 assert.equal(f.state.budget.consumed_micro_usd,0);assert.equal([...f.state.produced.values()][0].completion,null);
}
function beforeSource(f){assert.equal(f.wire.length,0);assert.equal(f.stateOwner.secrets,0);assert.equal(f.state.reservations.size,0);assert.equal(f.state.budget.consumed_micro_usd,0);}

for(const id of ids){
 test(`${id}: synthetic governed source consumes the private observation and settles exact original request/result bytes`,async()=>{
  const f=await wired(id);f.core.state.beforeResponse=()=>f.state.now++;f.state.afterSource=()=>f.state.now+=5;
  try{
   const raw=await f.invoke(),out=JSON.parse(raw),[observation]=f.state.observations;
   assert.deepEqual(Object.keys(out).sort(),['binding','subject','operation','argumentsSha256','result'].sort());
   assert.deepEqual(out.binding,f.binding);assert.deepEqual(out.subject,f.authority.subject);assert.deepEqual(out.operation,f.operation);
   assert.equal(out.result.asOf,observation.context.asOf);assert.deepEqual(f.stateOwner.secretProof.normalizationContext,observation.context);
   assert.deepEqual(Object.keys(observation).sort(),['schemaVersion','operation','requestSha256','context'].sort());assert.equal(observation.requestSha256,hash(f.request));assert.deepEqual(observation.operation,f.operation);
   assert.equal(f.wire.length,1);assert.equal(f.state.bridgeCalls,1);assert.equal(f.wire[0].url,`https://native-core.example.invalid/api/clio/tools/${id}`);assert.deepEqual(f.wire[0].body,f.request);
   assert.equal(f.wire[0].options.headers.authorization,'Bearer SYNTHETIC_NATIVE');assert.equal(f.wire[0].options.headers['x-internal-service-secret'],'SYNTHETIC_SERVICE');
   assert.equal(f.stateOwner.secretProof.requestSha256,hash(f.request));assert.equal(out.argumentsSha256,f.contract.normalizeInput(f.request,observation.context).argumentsSha256);
   const [reservation]=f.state.reservations.values(),[receipt]=f.state.produced.values();assert.equal(reservation.state,'SETTLED');assert.equal(reservation.output_bytes,Buffer.byteLength(raw));assert.equal(receipt.completion.resultSha256,hash(out));
   if(id===ids[0])assert.notEqual(out.result.data.generatedAt,out.result.asOf,'source generation time remains distinct from the trusted observation');
   for(const suffix of ['native-read-observation-0.2/schema.json','native-read-observation-0.2/validate.mjs','funding-opportunities/request-context.mjs'])assert.ok(f.handlers.get(`${id}@0.2.0`).sourceFiles.some(row=>row.label.endsWith(suffix)));
  }finally{f.scope.abort();}
 });
 test(`${id}: synthetic bridge read succeeds through actual MCP with current client authority and durable settlement`,async()=>{
  const f=await wired(id),m=await mountReads(f,{port:f.port});assert.notEqual(m,null);
  try{
   assert.deepEqual((await m.client.listTools()).tools.map(tool=>tool.name),[id]);
   const result=await m.call(id,f.request);assert.equal(result.isError,undefined);assert.equal(result.denied,undefined);
   const raw=result.content[0].text,out=JSON.parse(raw),[observation]=f.state.observations;
   assert.deepEqual(out.subject,f.authority.subject);assert.equal(out.subject.kind,'client');assert.deepEqual(out.binding,f.binding);assert.deepEqual(out.operation,f.operation);
   assert.equal(out.result.asOf,observation.context.asOf);assert.equal(observation.requestSha256,hash(f.request));assert.equal(f.wire.length,1);assert.deepEqual(f.wire[0].body,f.request);
   assert.equal(m.runtime.receipts().length,1);assert.equal(m.runtime.receipts()[0].resultSha256,hash(out));
   const [reservation]=f.state.reservations.values(),[receipt]=f.state.produced.values();assert.equal(reservation.state,'SETTLED');assert.equal(reservation.output_bytes,Buffer.byteLength(raw));assert.equal(receipt.completion.resultSha256,hash(out));
  }finally{await m.close();f.scope.abort();}
 });
 test(`${id}: missing governed installation, disabled source or missing current context cannot reach the bridge`,async()=>{
  const f=await wired(id);
  try{
   f.state.installRevoked=true;await assert.rejects(f.invoke(),{message:'UNAVAILABLE'});assert.equal(await mountReads(f,{port:f.port}),null);f.state.installRevoked=false;
   // Discovery is a worker/native RPC availability gate; raw CONTROL execute owns a different current-authority boundary.
   f.state.discoveryMutator=row=>row.operations=[];assert.equal(await mountReads(f,{port:f.port}),null);f.state.discoveryMutator=undefined;
   await assert.rejects(f.disabledPort().execute({operation:f.operation,arguments:f.request,deliveryId:'funding-disabled'}),{message:'UNAVAILABLE'});
   assert.equal(await mountReads(f,{port:f.disabledPort()}),null);
   await assert.rejects(f.invoke({arguments:{...f.request,asOf:f.normalizationContext.asOf}}));
   beforeSource(f);
  }finally{f.scope.abort();}
  const missing=await wired(id,{missingContext:true});
  try{await assert.rejects(missing.invoke(),{message:'UNAVAILABLE'});assert.equal(missing.wire.length,0);assert.equal(missing.state.reservations.size,0);}
  finally{missing.scope.abort();}
 });
 test(`${id}: personal, foreign-client and absent native grant cannot acquire funding source credentials`,async()=>{
  for(const mode of ['personal','foreign-subject','foreign-resource','invisible','foreign-request']){
   const scene=storedCase(id),a=scene.authority,foreign=uuid('e');
   if(mode==='personal'){
    const scope={tenantId:a.binding.tenantId,kind:'tenant',resourceId:a.binding.tenantId,policyRevision:a.policyRevision};
    Object.assign(a.subject,{kind:'personal',entityType:'user',entityIds:[a.binding.actorId],scopes:[scope]});a.claims.scopes=[scope];a.decision.scopes=[scope];
   }
   if(mode==='foreign-subject')a.subject.entityIds=[foreign];
   if(mode==='foreign-resource'){const scope={...a.subject.scopes[0],resourceId:foreign};a.subject.scopes=[scope];a.claims.scopes=[scope];a.decision.scopes=[scope];}
   const f=await wired(id,{scene});if(mode==='invisible')f.core.state.clientIds=[];
   try{
    await assert.rejects(f.invoke(mode==='foreign-request'?{arguments:{...f.request,clientId:foreign}}:{}));beforeSource(f);
    if(mode==='personal')assert.equal(await mountReads(f,{port:f.port}),null);
    if(!['invisible','foreign-request'].includes(mode))assert.equal(f.stateOwner.nativeCredentials,0);
   }finally{f.scope.abort();}
  }
 });
}

test('funding observation never falls back to static native credentials or an unobserved legacy call',async()=>{
 const f=await wired(ids[0],{staticCredentials:true});
 try{await assert.rejects(f.invoke(),{message:'UNAVAILABLE'});assert.equal(f.state.staticFallbackCalls??0,0);assert.equal(f.wire.length,0);assert.equal(f.stateOwner.secrets,0);unknown(f);}
 finally{f.scope.abort();}
});

test('a bridge HTTP refusal remains a single failed source attempt with UNKNOWN hold and no legacy retry',async()=>{
 const f=await wired(ids[0]);f.state.responseFactory=()=>Response.json({message:'READ_OBSERVATION_NOT_INSTALLED'},{status:400});
 try{await assert.rejects(f.invoke(),{message:'INVALID_RESULT'});assert.equal(f.wire.length,1);assert.equal(f.state.bridgeCalls,1);unknown(f);}
 finally{f.scope.abort();}
});

test('funding native output cannot substitute its own asOf for the captured observation',async()=>{
 const f=await wired(ids[0]);f.state.resultMutator=page=>page.asOf=new Date(Date.parse(page.asOf)+1).toISOString();
 try{await assert.rejects(f.invoke(),{message:'INVALID_RESULT'});assert.equal(f.wire.length,1);unknown(f);}
 finally{f.scope.abort();}
});

test('funding current native membership revocation after source withholds result bytes and completion',async()=>{
 const f=await wired(ids[0]);f.state.afterSource=()=>f.core.state.membershipRevision='e'.repeat(64);
 try{await assert.rejects(f.invoke(),{message:'ACCESS_DENIED'});assert.equal(f.wire.length,1);unknown(f);}
 finally{f.scope.abort();}
});

test('funding SDK66/37 contains all five source operations while every current installation gate stays separate',()=>{
 assert.equal(familyReads().length,66);assert.equal(READ_FAMILY_IDS.length,37);assert.equal(READ_FAMILY_IDS.includes('funding-opportunities'),true);
 assert.deepEqual(familyReads().filter(row=>row.family==='funding-opportunities').map(row=>row.operation.id),ids);
});

test('funding durable grant and current native principal/role revocation refuse before source reservation',async()=>{
 for(const mode of ['task','principal','role']){
  const f=await wired(ids[0]);if(mode==='task')f.state.grant.state='REVOKED';if(mode==='principal')f.core.state.principal={...f.core.principal,actorId:uuid('e')};if(mode==='role')f.core.state.role='client_portal_user';
  try{await assert.rejects(f.invoke());beforeSource(f);if(mode==='task')assert.equal(f.stateOwner.nativeCredentials,0);}
  finally{f.scope.abort();}
 }
});

test('funding native identity, task or client visibility changes after source withhold bytes and keep UNKNOWN',async()=>{
 for(const mode of ['identity','task','client']){
  const f=await wired(ids[0]);f.state.afterSource=()=>{if(mode==='identity')f.core.state.identityRevision='e'.repeat(64);if(mode==='task')f.state.grant.state='REVOKED';if(mode==='client')f.core.state.clientIds=[];};
  try{await assert.rejects(f.invoke());assert.equal(f.wire.length,1);unknown(f);}
  finally{f.scope.abort();}
 }
});

test('funding credential-time membership or original expiry drift cannot dispatch source and preserves UNKNOWN',async()=>{
 for(const mode of ['membership','expiry']){
  const f=await wired(ids[0]);if(mode==='expiry')f.core.state.nativeExpiry=f.now()+1;
  f.stateOwner.beforeSecret=()=>{if(mode==='membership')f.core.state.membershipRevision='e'.repeat(64);else f.state.now+=2;};
  try{await assert.rejects(f.invoke());assert.equal(f.wire.length,0);assert.equal(f.stateOwner.secrets,1);unknown(f);}
  finally{f.scope.abort();}
 }
});

test('funding native DTO client substitution and response uncertainty withhold the whole result without retry',async()=>{
 for(const mode of ['client','uncertain']){
  const f=await wired(ids[0]);if(mode==='client')f.state.resultMutator=page=>page.data.clientId=uuid('e');else f.state.responseFactory=()=>{throw Error('SYNTHETIC_SOURCE_CONNECTION_UNCERTAIN');};
  try{await assert.rejects(f.invoke(),{message:'INVALID_RESULT'});assert.equal(f.wire.length,1);assert.equal(f.state.bridgeCalls,1);unknown(f);}
  finally{f.scope.abort();}
 }
});

test('funding pre-cancelled lifetime refuses as DEADLINE while in-flight cancellation/expiry retain UNKNOWN',async()=>{
 const before=await wired(ids[0]),aborted=new AbortController();aborted.abort();
 try{await assert.rejects(before.invoke({signal:aborted.signal}),{message:'DEADLINE'});beforeSource(before);}
 finally{before.scope.abort();}
 for(const mode of ['cancel','expiry']){
  const f=await wired(ids[0]),controller=new AbortController();f.state.afterSource=()=>{if(mode==='cancel')controller.abort();else f.state.now=f.deadlineMs;};
  try{await assert.rejects(f.invoke({signal:controller.signal}),{message:mode==='cancel'?'CANCELLED':'DEADLINE'});assert.equal(f.wire.length,1);unknown(f);}
  finally{f.scope.abort();}
 }
});
