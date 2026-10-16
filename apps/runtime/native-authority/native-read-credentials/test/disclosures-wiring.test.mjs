/** Synthetic fixed HTTP/SQL over the actual task, native context, gateway, budget and receipt owners. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {createGeneralReadFamilyHandlers} from '../../../../gateway/general-reads/integration.mjs';
import {createControlGeneralReadRuntime} from '../../../general-read-runtime.mjs';
import {createNativeReadCredentialOwner} from '../owner.mjs';
import {ownerFixture} from './fixture.mjs';
import {DISCLOSURE_FAMILY_CASES} from '../../../../gateway/general-reads/test/native-family-cases.mjs';
async function wired(id,options={}){
 const f=await ownerFixture(id,options),owner=options.owner?.(f)??f.owner,{getCredentials,...transport}=f.transport;
 const handlers=await createGeneralReadFamilyHandlers({families:{disclosures:{...transport,credentialsForCall:owner.credentialsForCall}},now:f.now,newId:randomUUID});
 const {installationOwner,...gateway}=f.gatewayConfiguration,mount=createControlGeneralReadRuntime({...gateway,sourceEnabled:options.disabled?false:gateway.sourceEnabled,handlers,scopes:f.scopes,readCurrentInstallation:({signal})=>installationOwner.readCurrent({signal}),nativeReadContextPorts:options.missingContext?undefined:owner.nativeReadContextPorts});
 return {...f,mount,invoke:extra=>mount.execute({operation:f.operation,arguments:f.request,deliveryId:'disclosures-native-read',...extra})};
}
function unknown(f){const [r]=f.state.reservations.values();assert.equal(r.state,'UNKNOWN');assert.equal(r.hold_micro_usd,1);assert.equal(r.charged_micro_usd,null);assert.equal(r.output_bytes,null);assert.equal(f.state.budget.consumed_micro_usd,0);assert.equal([...f.state.produced.values()][0].completion,null);}
for(const [,id] of DISCLOSURE_FAMILY_CASES){
 test(`${id}: canonical current-owner dispatch settles exact full carrier once`,async()=>{
  const f=await wired(id),raw=await f.invoke(),out=JSON.parse(raw),[r]=f.state.reservations.values();
  assert.equal(out.result.tool,id);assert.deepEqual(out.binding,f.binding);assert.deepEqual(out.subject,f.authority.subject);assert.deepEqual(out.operation,f.operation);
  assert.equal(out.argumentsSha256,f.contract.normalizeInput(f.request,{}).argumentsSha256);assert.deepEqual(f.stateOwner.secretProof.normalizationContext,{});assert.equal(f.stateOwner.secretProof.requestSha256,hash(f.request));
  assert.equal(f.wire[0].url,`https://native-core.example.invalid/api/clio/tools/${id}`);assert.deepEqual(f.wire[0].body,f.request);assert.equal(f.wire[0].options.headers.authorization,'Bearer SYNTHETIC_NATIVE');assert.equal(f.wire[0].options.headers['x-internal-service-secret'],'SYNTHETIC_SERVICE');
  assert.equal(r.state,'SETTLED');assert.equal(r.output_bytes,Buffer.byteLength(raw));assert.equal(r.charged_micro_usd,1);assert.equal(f.state.produced.size,1);assert.equal([...f.state.produced.values()][0].completion.resultSha256,hash(out));
  assert.equal(out.result.total,0);assert.equal(out.result.data.length,1,'count/rows remain independent observations');
  await assert.rejects(f.invoke(),{message:'BUDGET_UNCERTAIN'});assert.equal(f.wire.length,1);assert.equal(f.state.budget.consumed_micro_usd,1);
 });
 test(`${id}: missing context, genuine native credential or service producer denies before reserve`,async()=>{
  for(const options of [{missingContext:true},{owner:f=>createNativeReadCredentialOwner({...f.configuration,getNativeCredential:undefined})},{owner:f=>createNativeReadCredentialOwner({...f.configuration,getServiceSecret:undefined})}]){
   const f=await wired(id,options);await assert.rejects(f.invoke(),{message:'UNAVAILABLE'});assert.equal(f.state.reservations.size,0);assert.equal(f.core.state.calls.length,0);assert.equal(f.wire.length,0);
  }
 });
 test(`${id}: model authority, disabled source and revoked installation never call native producer`,async()=>{
  const f=await wired(id);await assert.rejects(f.invoke({arguments:{tenantId:'other'}}),{message:'INVALID_ARGUMENTS'});
  f.state.installRevoked=true;await assert.rejects(f.invoke(),{message:'UNAVAILABLE'});f.state.installRevoked=false;
  await assert.rejects(f.invoke({signal:AbortSignal.abort()}));assert.equal(f.state.reservations.size,0);assert.equal(f.wire.length,0);assert.equal(f.core.state.calls.length,0);
  const d=await wired(id,{disabled:true});await assert.rejects(d.invoke(),{message:'UNAVAILABLE'});assert.equal(d.core.state.calls.length,0);assert.equal(d.state.reservations.size,0);assert.equal(d.wire.length,0);
 });
 test(`${id}: native role floor and canonical principal mismatch cannot use public catalog`,async()=>{
  for(const mode of ['role','principal']){const f=await wired(id);if(mode==='role')f.core.state.role='client_portal_user';else f.core.state.principal={...f.core.principal,actorId:'dddddddd-dddd-4ddd-8ddd-dddddddddddd'};await assert.rejects(f.invoke());assert.equal(f.state.reservations.size,0);assert.equal(f.wire.length,0);}
 });
 test(`${id}: current membership drift after source withholds bytes and preserves UNKNOWN`,async()=>{
  const f=await wired(id);f.state.afterSource=()=>f.core.state.membershipRevision='c'.repeat(64);await assert.rejects(f.invoke(),{message:'ACCESS_DENIED'});assert.equal(f.wire.length,1);unknown(f);
 });
 test(`${id}: missing actual service secret has no fallback and holds UNKNOWN`,async()=>{
  const f=await wired(id);f.stateOwner.secret='';await assert.rejects(f.invoke(),{message:'UNAVAILABLE'});assert.equal(f.wire.length,0);unknown(f);
 });
}
test('disclosures original alias/clip request and measured native owner source remain bound',async()=>{
 const request={query:' ',companyName:' Issuer ',formType:'A'.repeat(19)+' B',limit:'2.9'},f=await wired('search_sec_filings',{request});
 const out=JSON.parse(await f.invoke());assert.deepEqual(f.wire[0].body,request);assert.equal(out.result.data[0].formType,'A'.repeat(19)+' ');
 for(const suffix of ['sources/disclosures/handler.mjs','native-read-credentials/owner.mjs','native-read-context.mjs'])assert.ok(f.handlers.get('search_sec_filings@0.2.0').sourceFiles.some(row=>row.label.endsWith(suffix)));
});
test('unallocated disclosure operation refuses at canonical task/config owner before native IO',async()=>{
 const f=await wired('search_lda_filings',{owner:f=>createNativeReadCredentialOwner({...f.configuration,approvedReads:{...f.configuration.approvedReads,operations:[{id:'read_bill_text',version:'0.2.0'}]}})});
 await assert.rejects(f.invoke(),{message:'ACCESS_DENIED'});assert.equal(f.core.state.calls.length,0);assert.equal(f.state.reservations.size,0);assert.equal(f.wire.length,0);
});
