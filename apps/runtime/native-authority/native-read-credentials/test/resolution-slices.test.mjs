/** Delta: real CONTROL, fixed native identity/context HTTP and durable gateway; synthetic JSON/scripted SQL only. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {nativeFamilyCase} from '../../../../gateway/general-reads/test/native-family-cases.mjs';
import {createGeneralReadFamilyHandlers} from '../../../../gateway/general-reads/integration.mjs';
import {createControlGeneralReadRuntime} from '../../../general-read-runtime.mjs';
import {createNativeReadCredentialOwner} from '../owner.mjs';
import {ownerFixture,uuid} from './fixture.mjs';

const clientId='a1234567-b123-4c12-8d12-e123456789ab',foreign=uuid('e');
const businessIds=['get_business_development_context','get_business_development_recent_changes'];
const research=[['research-legal-legislation','search_legislative_research'],['research-legal-legislation','get_legal_reference'],['research-legal-news','search_legiwatch_news']];
async function wired(scene,{configuration}={}){
 const f=await ownerFixture(scene.operation.id,{scene}),owner=configuration?createNativeReadCredentialOwner(configuration(f)):f.owner;
 const {getCredentials,credentialsForCall,authorizeResultForCall,...transport}=f.transport;
 const handlers=await createGeneralReadFamilyHandlers({families:{[f.family]:{...transport,credentialsForCall:owner.credentialsForCall}},now:f.now,newId:randomUUID});
 const {installationOwner,...gateway}=f.gatewayConfiguration;
 const port=createControlGeneralReadRuntime({...gateway,handlers,scopes:f.scopes,readCurrentInstallation:({signal})=>installationOwner.readCurrent({signal}),nativeReadContextPorts:owner.nativeReadContextPorts});
 return {...f,owner,invoke:(extra={})=>port.execute({operation:f.operation,arguments:f.request,deliveryId:'resolution-delta',...extra})};
}
function beforeSource(f){
 assert.equal(f.wire.length,0);assert.equal(f.stateOwner.secrets,0);assert.equal(f.state.reservations.size,0);assert.equal(f.state.budget.consumed_micro_usd,0);
 for(const row of f.state.produced.values()){assert.equal(row.reservation_id,null);assert.equal(row.arguments_sha256,null);assert.equal(row.completion,null);}
}
function unknown(f){
 const [r]=f.state.reservations.values();assert.equal(r.state,'UNKNOWN');assert.equal(r.hold_micro_usd,1);assert.equal(r.output_bytes,null);assert.equal(r.charged_micro_usd,null);
 assert.equal(f.state.budget.consumed_micro_usd,0);assert.equal([...f.state.produced.values()][0].completion,null);
}
const contextCalls=f=>f.core.state.calls.filter(call=>call.path.endsWith('/context'));
const read=async f=>JSON.parse(await f.owner.nativeReadContextPorts.readCurrent(f.proof()));

test('resolution delta state no-bill votes preserve absent/null/blank raw selectors and empty native context',async()=>{
 for(const request of [{},{billId:null},{billId:' ',state:null,query:null,chamber:''},{billId:null,state:' tx ',query:'pass',chamber:' LOWER ',limit:'1.9'}]){
  const f=await wired(nativeFamilyCase('state-status-votes','search_state_floor_votes',{request}));
  try{const out=JSON.parse(await f.invoke());assert.deepEqual(out.result,JSON.parse(JSON.stringify(f.page)));assert.deepEqual(f.wire[0].body,request);assert.deepEqual(f.stateOwner.secretProof.normalizationContext,{});assert.equal(f.stateOwner.secretProof.requestSha256,hash(request));assert.equal(f.contract.normalizeInput(request,{}).metadata.selector.kind,'missing');assert.equal([...f.state.reservations.values()][0].state,'SETTLED');}
  finally{f.scope.abort();}
 }
});

test('resolution delta state unfiltered stored votes preserve null/blank source metadata without an invented selector',async()=>{
 for(const metadata of [null,' ']){
  const scene=nativeFamilyCase('state-status-votes','search_state_floor_votes',{request:{}});
  scene.page.votes[0]={...scene.page.votes[0],billKey:metadata,chamber:metadata,motion:metadata,date:null};
  const f=await wired(scene);
  try{const out=JSON.parse(await f.invoke());assert.deepEqual(out.result.votes[0],scene.page.votes[0]);assert.deepEqual(f.wire[0].body,{});assert.equal(Object.hasOwn(out.result,'absenceEvidence'),false);}
  finally{f.scope.abort();}
 }
});

for(const [family,id] of research){
 test(`resolution delta ${id}: current UUID client context joins the exact native grant and settles raw request bytes`,async()=>{
  const base=nativeFamilyCase(family,id),request={...base.arguments,clientId:` ${clientId} `},f=await wired(nativeFamilyCase(family,id,{request}));
  try{
   const out=JSON.parse(await f.invoke());assert.deepEqual(out.result,JSON.parse(JSON.stringify(f.page)));assert.deepEqual(f.wire[0].body,request);assert.equal(f.stateOwner.secretProof.requestSha256,hash(request));
   assert.deepEqual(f.stateOwner.secretProof.normalizationContext,f.normalizationContext);assert.deepEqual(f.normalizationContext.clientResolution,{reference:clientId,clientId});assert.equal([...f.state.reservations.values()][0].state,'SETTLED');
   if(family==='research-legal-news')assert.equal(f.normalizationContext.effectiveScope.clientId,clientId);else assert.equal(out.result.result.scope.clientId,clientId);
  }finally{f.scope.abort();}
 });
 test(`resolution delta ${id}: visibility, client identity and client resource cannot be supplied by a UUID selector`,async()=>{
  for(const mode of ['visibility','foreign-subject','foreign-resource']){
   const base=nativeFamilyCase(family,id),scene=nativeFamilyCase(family,id,{request:{...base.arguments,clientId}});
   if(mode==='foreign-subject')scene.authority.subject.entityIds=[foreign];
   if(mode==='foreign-resource'){const a=scene.authority,scope={...a.subject.scopes[0],resourceId:foreign};a.subject.scopes=[scope];a.claims.scopes=[scope];a.decision.scopes=[scope];}
   scene.visibleClientIds=[clientId,foreign];const f=await wired(scene);if(mode==='visibility')f.core.state.clientIds=[];
   try{await assert.rejects(f.invoke(),{message:'ACCESS_DENIED'});beforeSource(f);}finally{f.scope.abort();}
  }
 });
 test(`resolution delta ${id}: selected-client visibility drift after source withholds the private result`,async()=>{
  const base=nativeFamilyCase(family,id),f=await wired(nativeFamilyCase(family,id,{request:{...base.arguments,clientId}}));f.state.afterSource=()=>f.core.state.clientIds=[];
  try{await assert.rejects(f.invoke(),{message:'ACCESS_DENIED'});assert.equal(f.wire.length,1);unknown(f);}finally{f.scope.abort();}
 });
}

for(const id of businessIds){
 test(`resolution delta ${id}: actual Core conversation proof uses the selected resource, not the Meri run conversation`,async()=>{
  const f=await wired(nativeFamilyCase('business-development',id));
  try{
   assert.notEqual(f.request.conversationId,f.binding.conversationId);const out=JSON.parse(await f.invoke());
   assert.deepEqual(out.result,JSON.parse(JSON.stringify(f.page)));assert.deepEqual(f.wire[0].body,f.request);assert.deepEqual(f.stateOwner.secretProof.normalizationContext,{});
   const contexts=contextCalls(f);assert.ok(contexts.length>=3);assert.ok(contexts.every(call=>call.path==='/api/clio/application-authority/context'&&call.body.conversationId===f.nativeConversation.conversationId&&call.body.clientId===clientId));
   assert.ok(contexts.every(call=>/^[a-f0-9]{64}$/.test(call.body.identitySha256)));assert.ok(f.core.state.calls.some(call=>call.path.endsWith('/membership')));
   assert.equal([...f.state.reservations.values()][0].state,'SETTLED');assert.equal(f.stateOwner.secretProof.requestSha256,hash(f.request));
   assert.equal(Object.hasOwn(out,'contextRevision'),false);assert.equal(Object.hasOwn(f.stateOwner.secretProof,'contextRevision'),false);
  }finally{f.scope.abort();}
 });
 test(`resolution delta ${id}: missing native resource reader is unavailable before credentials or reservation`,async()=>{
  const f=await wired(nativeFamilyCase('business-development',id),{configuration:f=>{const {readConversation,...coreAuthority}=f.configuration.coreAuthority;return {...f.configuration,coreAuthority};}});
  try{await assert.rejects(f.invoke(),{message:'UNAVAILABLE'});beforeSource(f);assert.equal(f.stateOwner.nativeCredentials,0);assert.equal(f.core.state.calls.length,0);}finally{f.scope.abort();}
 });
 test(`resolution delta ${id}: exact client-only subject and current native membership precede private conversation context`,async()=>{
  for(const mode of ['invisible','extra-tenant-scope','personal','foreign-selected-client']){
   const scene=nativeFamilyCase('business-development',id),a=scene.authority;
   if(mode==='extra-tenant-scope'){const scope={tenantId:a.binding.tenantId,kind:'tenant',resourceId:a.binding.tenantId,policyRevision:a.policyRevision};a.subject.scopes.push(scope);a.claims.scopes.push(scope);a.decision.scopes.push(scope);}
   if(mode==='personal')Object.assign(a.subject,{kind:'personal',entityType:'user',entityIds:[a.binding.actorId]});
   if(mode==='foreign-selected-client'){const scope={...a.subject.scopes[0],resourceId:foreign};a.subject.entityIds=[foreign];a.subject.scopes=[scope];a.claims.scopes=[scope];a.decision.scopes=[scope];scene.visibleClientIds=[clientId,foreign];}
   const f=await wired(scene);if(mode==='invisible')f.core.state.clientIds=[];
   try{await assert.rejects(f.invoke(),{message:'ACCESS_DENIED'});beforeSource(f);if(mode!=='foreign-selected-client')assert.equal(contextCalls(f).length,0);}finally{f.scope.abort();}
  }
 });
}

const mutations=[
 ['principal',f=>f.core.state.context.principal={...f.core.principal,actorId:foreign}],
 ['identity',f=>f.core.state.context.identityRevision='e'.repeat(64)],
 ['conversation selector',f=>f.core.state.context.conversationId=foreign],
 ['client selector',f=>f.core.state.context.selectedClientId=foreign],
 ['identity hash',f=>f.core.state.context.identitySha256='0'.repeat(64)],
 ['expired receipt',f=>f.core.state.context.expiresAtMs=f.now()],
];
for(const [label,mutate] of mutations)test(`resolution delta BD ${label}: changed native resource fact refuses before source credentials/reservation`,async()=>{
 const f=await wired(nativeFamilyCase('business-development',businessIds[0]));mutate(f);
 try{await assert.rejects(f.invoke());beforeSource(f);assert.ok(contextCalls(f).length>0);}finally{f.scope.abort();}
});

for(const [label,mutate] of [...mutations,['context revision',f=>f.core.state.contextRevision='changed-opaque-revision']])test(`resolution delta BD ${label}: post-source drift preserves UNKNOWN and releases no completion`,async()=>{
 const f=await wired(nativeFamilyCase('business-development',businessIds[1]));f.state.afterSource=()=>mutate(f);
 try{await assert.rejects(f.invoke());assert.equal(f.wire.length,1);unknown(f);}finally{f.scope.abort();}
});

test('resolution delta BD context revision changes across service-secret await withhold source HTTP and hold UNKNOWN',async()=>{
 const f=await wired(nativeFamilyCase('business-development',businessIds[0]));f.stateOwner.beforeSecret=()=>f.core.state.contextRevision='changed-before-source';
 try{await assert.rejects(f.invoke(),{message:'INVALID_RESULT'});assert.equal(f.stateOwner.secrets,1);assert.equal(f.wire.length,0);unknown(f);}finally{f.scope.abort();}
});

test('resolution delta BD first native context expiry cannot be renewed by later receipts or a longer caller deadline',async()=>{
 const f=await wired(nativeFamilyCase('business-development',businessIds[0]));f.core.state.context.expiresAtMs=f.now()+400;
 try{
  const first=await read(f);assert.equal(first.expiresAtMs,f.now()+400);
  f.core.state.context.expiresAtMs=f.now()+60000;f.state.now+=20;
  const next=await read(f);assert.equal(next.expiresAtMs,first.expiresAtMs);assert.deepEqual(next.context,{});
  const credentials=await f.owner.getCredentials(f.credentials(next.context));assert.equal(credentials.expiresAtMs,first.expiresAtMs);
  f.state.now=first.expiresAtMs;await assert.rejects(read(f));assert.equal(f.wire.length,0);
 }finally{f.scope.abort();}
});
