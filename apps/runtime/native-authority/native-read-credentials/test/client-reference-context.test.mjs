/** Real current authority, task verifier and native HTTP adapters; scripted SQL/JSON only. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {createGeneralReadFamilyHandlers} from '../../../../gateway/general-reads/integration.mjs';
import {nativeFamilyCase} from '../../../../gateway/general-reads/test/native-family-cases.mjs';
import {createControlGeneralReadRuntime} from '../../../general-read-runtime.mjs';
import {createNativeReadCredentialOwner} from '../owner.mjs';
import {ownerFixture,uuid} from './fixture.mjs';

const clientId='a1234567-b123-4c12-8d12-e123456789ab',foreign=uuid('e');
const cases=[['tracked-bills','search_tracked_bills'],['public-domain-hearings','search_committee_hearings'],['research-legal-legislation','search_legislative_research']];
function scene(family,id,reference=' Synthetic named client '){
 const request={...(family==='research-legal-legislation'?nativeFamilyCase(family,id).arguments:{}),clientId:reference};
 const resolution={reference:reference.trim().slice(0,80).trim(),clientId};
 return nativeFamilyCase(family,id,{request,...(family==='public-domain-hearings'?{context:{tenantId:uuid('b'),clientResolution:resolution}}:{}),...(family==='research-legal-legislation'?{context:{clientResolution:resolution,citationResolution:null}}:{})});
}
async function setup(family,id,{reference,personal=false,configuration}={}){
 const selected=scene(family,id,reference);
 if(personal){
  const a=selected.authority,scope={tenantId:a.binding.tenantId,kind:'private-user',resourceId:a.binding.actorId,policyRevision:a.policyRevision};
  Object.assign(a.subject,{kind:'personal',entityType:'user',entityIds:[a.binding.actorId],scopes:[scope]});a.claims.scopes=[scope];a.decision.scopes=[scope];
 }
 const f=await ownerFixture(id,{scene:selected});
 f.core.state.resolvedClientId=clientId;
 f.core.state.response=(value,path)=>path.endsWith('/clients/check-ref')?Response.json(f.core.state.referenceFailure??{ok:true,clientId:f.core.state.resolvedClientId},{status:201}):Response.json(value);
 const owner=configuration?createNativeReadCredentialOwner(configuration(f)):f.owner;
 const {getCredentials,credentialsForCall,authorizeResultForCall,...transport}=f.transport;
 const handlers=await createGeneralReadFamilyHandlers({families:{[family]:{...transport,credentialsForCall:owner.credentialsForCall}},now:f.now,newId:randomUUID});
 const {installationOwner,...gateway}=f.gatewayConfiguration;
 const mount=createControlGeneralReadRuntime({...gateway,handlers,scopes:f.scopes,readCurrentInstallation:({signal})=>installationOwner.readCurrent({signal}),nativeReadContextPorts:owner.nativeReadContextPorts});
 return {...f,owner,handlers,mount,invoke:()=>mount.execute({operation:f.operation,arguments:f.request,deliveryId:'named-reference'})};
}
const references=f=>f.core.state.calls.filter(row=>row.path.endsWith('/clients/check-ref'));
const read=async f=>JSON.parse(await f.owner.nativeReadContextPorts.readCurrent(f.proof()));
function untouched(f){assert.equal(f.wire.length,0);assert.equal(f.stateOwner.secrets,0);assert.equal(f.state.reservations.size,0);assert.equal(f.state.budget.consumed_micro_usd,0);}

for(const [family,id] of cases){
 test(`${id}: current native reference joins exact context and original proof before UUID execution`,async()=>{
  const f=await setup(family,id);
  try{
   const current=await read(f),context=current.context,expected=f.request.clientId.trim().slice(0,80);
   if(family==='tracked-bills'){assert.equal(context.clientReference,expected);assert.equal(context.subject.entityIds[0],clientId);}
   else if(family==='public-domain-hearings')assert.deepEqual(context,{tenantId:f.binding.tenantId,clientResolution:{reference:expected.trim(),clientId}});
   else assert.deepEqual(context,{clientResolution:{reference:expected.trim(),clientId},citationResolution:null});
   const normalized=f.contract.normalizeInput(f.request,context),call={request:f.request,input:normalized.input,argumentsSha256:normalized.argumentsSha256,normalizationContext:context,authority:f.authority,signal:f.scope.signal};
   const out=JSON.parse(await f.handlers.get(`${id}@0.2.0`).execute(call));
   assert.deepEqual(out.result,family==='tracked-bills'?{binding:f.binding,subject:f.authority.subject,data:f.page}:f.page);
   assert.deepEqual(f.wire[0].body,{...f.request,clientId});assert.equal(f.stateOwner.secretProof.requestSha256,hash(f.request));
   assert.deepEqual(f.stateOwner.secretProof.normalizationContext,context);assert.ok(references(f).length>=3);
   for(const row of references(f)){assert.deepEqual(row.body,{ref:expected.trim()});assert.equal(row.init.credentials,'omit');assert.equal(row.init.headers.authorization,'Bearer SYNTHETIC_NATIVE');}
   assert.equal(Object.hasOwn(out,'identityRevision'),false);assert.equal(Object.hasOwn(out,'clientReferenceObservation'),false);
  }finally{f.scope.abort();}
 });
 test(`${id}: missing resolver refuses before any credential, native HTTP or source`,async()=>{
  const f=await setup(family,id,{configuration:f=>{const {readClientReference,...coreAuthority}=f.configuration.coreAuthority;return {...f.configuration,coreAuthority};}});
  try{await assert.rejects(read(f),{message:'UNAVAILABLE'});untouched(f);assert.equal(f.stateOwner.nativeCredentials,0);assert.equal(f.core.state.calls.length,0);}finally{f.scope.abort();}
 });
 for(const mode of ['hidden','foreign','ambiguous','missing','identity','task-revoked'])test(`${id}: ${mode} reference never grants access or releases credentials`,async()=>{
  const f=await setup(family,id);
  if(mode==='hidden')f.core.state.clientIds=[];
  if(mode==='foreign'){f.core.state.clientIds=[clientId,foreign];f.core.state.resolvedClientId=foreign;}
  if(mode==='ambiguous'||mode==='missing')f.core.state.referenceFailure={ok:false,reason:`PRIVATE ${mode}`};
  if(mode==='identity')f.core.state.mutate=(value,path)=>{if(path.endsWith('/identity')&&references(f).length)value.identityRevision='f'.repeat(64);};
  if(mode==='task-revoked')f.state.grant.state='REVOKED';
  try{await assert.rejects(read(f));untouched(f);if(['hidden','task-revoked'].includes(mode))assert.equal(references(f).length,0);}finally{f.scope.abort();}
 });
 test(`${id}: native resolution and membership are rechecked across secret acquisition`,async()=>{
  const f=await setup(family,id);
  try{const first=await read(f);f.stateOwner.beforeSecret=()=>{f.core.state.resolvedClientId=foreign;};await assert.rejects(f.owner.getCredentials(f.credentials(first.context)),{message:'ACCESS_DENIED'});assert.equal(f.stateOwner.secrets,1);assert.equal(f.wire.length,0);}finally{f.scope.abort();}
 });
 test(`${id}: membership revoked during native reference lookup refuses before a service secret`,async()=>{
  const f=await setup(family,id);f.core.state.beforeResponse=path=>{if(path.endsWith('/clients/check-ref'))f.core.state.clientIds=[];};
  try{await assert.rejects(read(f),{message:'ACCESS_DENIED'});untouched(f);assert.equal(references(f).length,1);}finally{f.scope.abort();}
 });
 test(`${id}: context cannot be renewed past the first reference observation`,async()=>{
  const f=await setup(family,id);
  try{const first=await read(f);assert.equal(first.expiresAtMs,f.now()+3000);f.state.now+=20;const next=await read(f);assert.equal(next.expiresAtMs,first.expiresAtMs);f.state.now=first.expiresAtMs;await assert.rejects(read(f));assert.equal(f.stateOwner.secrets,0);}finally{f.scope.abort();}
 });
}

test('tracked reference keeps trailing whitespace introduced by 80-unit clipping',async()=>{
 const reference='Synthetic named client'+' '.repeat(65)+'discarded',f=await setup(...cases[0],{reference});
 try{const current=await read(f);assert.equal(current.context.clientReference,reference.trim().slice(0,80));assert.equal(current.context.clientReference.length,80);assert.ok(current.context.clientReference.endsWith(' '));assert.deepEqual(references(f)[0].body,{ref:current.context.clientReference});}finally{f.scope.abort();}
});

test('personal hearing name follows the existing personal UUID/native-client wall without inferring a client task',async()=>{
 const f=await setup(...cases[1],{personal:true});
 try{const out=JSON.parse(await f.invoke());assert.deepEqual(out.result,f.page);assert.deepEqual(f.wire[0].body,{clientId});assert.ok(references(f).length>=3);assert.equal(f.authority.subject.kind,'personal');assert.equal([...f.state.reservations.values()][0].state,'SETTLED');}finally{f.scope.abort();}
});

test('hearing post-source reference drift withholds completion and leaves the reservation UNKNOWN',async()=>{
 const f=await setup(...cases[1],{personal:true});f.state.afterSource=()=>{f.core.state.resolvedClientId=foreign;};
 try{await assert.rejects(f.invoke());assert.equal(f.wire.length,1);assert.equal([...f.state.reservations.values()][0].state,'UNKNOWN');assert.equal(f.state.budget.consumed_micro_usd,0);for(const row of f.state.produced.values())assert.equal(row.completion,null);}finally{f.scope.abort();}
});
