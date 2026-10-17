/** Actual task/current-native/CONTROL/gateway owners; scripted SQL and synthetic fixed HTTP only. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {storedCase,ids,clientId} from '../../../gateway/sources/business-development/test/fixture.mjs';
import {createGeneralReadFamilyHandlers} from '../../../gateway/general-reads/integration.mjs';
import {createControlGeneralReadRuntime} from '../../general-read-runtime.mjs';
import {createNativeReadCredentialOwner} from '../native-read-credentials/owner.mjs';
import {ownerFixture,uuid} from '../native-read-credentials/test/fixture.mjs';
import {createNativeReadsOwner} from '../reads-owner.mjs';
import {readsFixture} from './reads-fixture.mjs';

const foreign=uuid('e');
async function wired(id,{scene=storedCase(id,{personal:true}),withoutConversation=true,staticCredentials=false}={}){
 const f=await ownerFixture(id,{scene}),{readConversation,...currentAuthority}=f.configuration.coreAuthority;
 const owner=createNativeReadCredentialOwner({...f.configuration,coreAuthority:withoutConversation?currentAuthority:f.configuration.coreAuthority});
 const {getCredentials,credentialsForCall,authorizeResultForCall,...transport}=f.transport;
 const credentials=staticCredentials?{getCredentials:()=>{f.state.staticFallbackCalls=(f.state.staticFallbackCalls??0)+1;throw Error('STATIC_FALLBACK_USED');}}:{credentialsForCall:owner.credentialsForCall};
 const handlers=await createGeneralReadFamilyHandlers({families:{[f.family]:{...transport,...credentials}},now:f.now,newId:randomUUID});
 const {installationOwner,...gateway}=f.gatewayConfiguration;
 const port=createControlGeneralReadRuntime({...gateway,handlers,scopes:f.scopes,readCurrentInstallation:({signal})=>installationOwner.readCurrent({signal}),nativeReadContextPorts:owner.nativeReadContextPorts});
 return {...f,owner,credentialCoreAuthority:withoutConversation?currentAuthority:f.configuration.coreAuthority,invoke:(extra={})=>port.execute({operation:f.operation,arguments:f.request,deliveryId:'bd-personal',...extra})};
}

test('BD native runtime: overclaimed inventories admit only context/recent and correlate exact request/delivery/result hashes',async()=>{
 const evidence={id:'get_business_development_evidence',version:'0.2.0'},operations=[...ids.map(id=>({id,version:'0.2.0'})),evidence];
 const x=await readsFixture({config:{operations}}),gateway=x.ownerConfiguration.gateway,dispatches=[];
 const owner=createNativeReadsOwner({...x.ownerConfiguration,gateway:{
  async readAvailability(options){const current=await gateway.readAvailability(options);return {...current,installation:{...current.installation,operations},discovery:{...current.discovery,operations}};},
  async execute(call){
   assert.deepEqual(Object.keys(call).sort(),['operation','arguments','deliveryId','signal'].sort());assert.equal(call.signal.aborted,false);
   const value={synthetic:'native eligibility only',operation:call.operation,arguments:call.arguments,deliveryId:call.deliveryId};
   dispatches.push(value);return JSON.stringify(value);
  },
 }});
 const snapshot=await owner.handle('availability',x.request,x.credential),allowed=operations.filter(op=>op.id!==evidence.id);
 assert.deepEqual(snapshot.installation.operations,allowed);assert.deepEqual(snapshot.discovery.operations,allowed);assert.equal(snapshot.inputSha256,hash(x.request));
 for(const operation of allowed){
  const request={...x.executeRequest,operation,arguments:{...storedCase(operation.id).arguments,...(operation.id===ids[1]?{limit:25}:{})},deliveryId:`bd:native:${operation.id}`};
  const entryReads=x.stateNative.entryReads,result=await owner.handle('execute',request,x.credential),expected={synthetic:'native eligibility only',operation,arguments:request.arguments,deliveryId:request.deliveryId};
  assert.ok(x.stateNative.entryReads>entryReads,'each dispatch retains real task-verifier current-entry checks');
  assert.deepEqual(dispatches.at(-1),expected);assert.deepEqual(result.operation,operation);assert.equal(result.deliveryId,request.deliveryId);assert.equal(result.inputSha256,hash(request));
  assert.deepEqual(JSON.parse(result.resultJson),expected);assert.equal(result.resultSha256,hash(expected));assert.equal(result.outputBytes,Buffer.byteLength(result.resultJson));
 }
 await assert.rejects(owner.handle('execute',{...x.executeRequest,operation:evidence,arguments:storedCase(ids[0]).arguments,deliveryId:'bd:native:withheld-evidence'},x.credential),{message:'UNAVAILABLE'});
 assert.equal(dispatches.length,2);assert.ok(x.commands.some(sql=>sql==='BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'));
 assert.equal(x.wire.length,0);assert.equal(x.state.reservations.size,0,'this eligibility-only synthetic gateway is not source or settlement proof');
});
const contexts=f=>f.core.state.calls.filter(call=>call.path.endsWith('/context'));
function beforeSource(f){
 assert.equal(f.wire.length,0);assert.equal(f.stateOwner.secrets,0);assert.equal(f.state.reservations.size,0);assert.equal(f.state.budget.consumed_micro_usd,0);
 for(const row of f.state.produced.values()){assert.equal(row.reservation_id,null);assert.equal(row.arguments_sha256,null);assert.equal(row.completion,null);}
}
function unknown(f){
 const [reservation]=f.state.reservations.values();assert.equal(reservation.state,'UNKNOWN');assert.equal(reservation.hold_micro_usd,1);
 assert.equal(reservation.output_bytes,null);assert.equal(reservation.charged_micro_usd,null);assert.equal(f.state.budget.consumed_micro_usd,0);
 assert.equal([...f.state.produced.values()][0].completion,null);
}
function scopes(scene,rows){scene.authority.subject.scopes=rows;scene.authority.claims.scopes=rows;scene.authority.decision.scopes=rows;}

for(const id of ids){
 test(`BD personal ${id}: absent conversation reader still uses current native identity/membership and settles original bytes`,async()=>{
  const f=await wired(id);
  try{
   assert.equal(Object.hasOwn(f.credentialCoreAuthority,'readConversation'),false);assert.equal(Object.hasOwn(f,'nativeConversation'),false);
   const raw=await f.invoke(),out=JSON.parse(raw);
   assert.equal(out.subject.kind,'personal');assert.equal(out.subject.entityType,'user');assert.deepEqual(out.subject.entityIds,[f.binding.actorId]);
   assert.deepEqual(out.result,JSON.parse(JSON.stringify(f.page)));assert.deepEqual(out.binding,f.binding);assert.deepEqual(out.operation,f.operation);
   assert.deepEqual(f.wire[0].body,f.request);assert.equal(f.wire[0].url,`https://native-core.example.invalid/api/clio/tools/${id}`);
   assert.deepEqual(f.stateOwner.secretProof.normalizationContext,{});assert.equal(f.stateOwner.secretProof.requestSha256,hash(f.request));
   assert.equal(out.argumentsSha256,f.contract.normalizeInput(f.request,{}).argumentsSha256);assert.equal(f.stateOwner.secrets,1);
   assert.equal(contexts(f).length,0);assert.ok(f.core.state.calls.filter(call=>call.path.endsWith('/membership')).length>=3);
   assert.ok(f.core.state.calls.every(call=>call.init.method==='POST'&&['/api/clio/application-authority/identity','/api/clio/application-authority/membership'].includes(call.path)));
   const [reservation]=f.state.reservations.values(),[receipt]=f.state.produced.values();assert.equal(reservation.state,'SETTLED');assert.equal(reservation.charged_micro_usd,1);
   assert.equal(reservation.output_bytes,Buffer.byteLength(raw));assert.equal(receipt.completion.resultSha256,hash(out));
  }finally{f.scope.abort();}
 });
 test(`BD personal ${id}: exact actor private-user scope and combined tenant/private-user scopes remain usable`,async()=>{
  for(const combined of [false,true]){
   const scene=storedCase(id,{personal:true}),a=scene.authority,privateScope={tenantId:a.binding.tenantId,kind:'private-user',resourceId:a.binding.actorId,policyRevision:a.policyRevision};
   scopes(scene,[...(combined?a.subject.scopes:[]),privateScope]);const f=await wired(id,{scene});
   try{await f.invoke();assert.equal([...f.state.reservations.values()][0].state,'SETTLED');assert.equal(contexts(f).length,0);}
   finally{f.scope.abort();}
  }
 });
 test(`BD personal ${id}: a client relationship in native context is not rewritten into a task client grant`,async()=>{
  const f=await wired(id);if(id===ids[0])f.state.resultMutator=page=>page.prospect.linkedClientId=clientId;
  try{const out=JSON.parse(await f.invoke());assert.equal(out.subject.kind,'personal');assert.deepEqual(f.core.state.clientIds,[]);assert.equal(contexts(f).length,0);
   if(id===ids[0])assert.equal(out.result.prospect.linkedClientId,clientId);assert.equal([...f.state.reservations.values()][0].state,'SETTLED');}
  finally{f.scope.abort();}
 });
 test(`BD personal ${id}: client, mixed, foreign actor and foreign personal resources refuse before any native credential`,async()=>{
  for(const mode of ['client-scope','mixed-client','foreign-actor','foreign-tenant-scope','foreign-user-scope','mailbox']){
   const scene=storedCase(id,{personal:true}),a=scene.authority;
   if(mode==='foreign-actor')a.subject.entityIds=[foreign];
   else{
    const bad={...a.subject.scopes[0],kind:mode==='foreign-user-scope'?'private-user':mode==='mailbox'?'mailbox':mode.includes('client')?'client':'tenant',resourceId:mode.includes('client')?clientId:foreign};
    scopes(scene,mode==='mixed-client'?[...a.subject.scopes,bad]:[bad]);
   }
   const f=await wired(id,{scene});
   try{await assert.rejects(f.invoke());beforeSource(f);assert.equal(f.stateOwner.nativeCredentials,0);assert.equal(f.core.state.calls.length,0);}
   finally{f.scope.abort();}
  }
 });
 test(`BD client ${id}: missing resource reader cannot downgrade a client-bound task to personal`,async()=>{
  const f=await wired(id,{scene:storedCase(id)});
  try{await assert.rejects(f.invoke(),{message:'UNAVAILABLE'});beforeSource(f);assert.equal(f.stateOwner.nativeCredentials,0);assert.equal(contexts(f).length,0);}
  finally{f.scope.abort();}
 });
 test(`BD personal ${id}: revoked durable task prevents native credentials and source reservations`,async()=>{
  const f=await wired(id);f.state.grant.state='REVOKED';
  try{await assert.rejects(f.invoke());beforeSource(f);assert.equal(f.stateOwner.nativeCredentials,0);assert.equal(f.core.state.calls.length,0);}
  finally{f.scope.abort();}
 });
 test(`BD personal ${id}: foreign native principal and insufficient current membership refuse before service credentials`,async()=>{
  for(const mode of ['principal','membership']){
   const f=await wired(id);if(mode==='principal')f.core.state.principal={...f.core.principal,actorId:foreign};else f.core.state.role='client_portal_user';
   try{await assert.rejects(f.invoke());beforeSource(f);assert.ok(f.core.state.calls.length>0);assert.equal(contexts(f).length,0);}
   finally{f.scope.abort();}
  }
 });
 test(`BD personal ${id}: native revision drift across the secret await releases no source HTTP and keeps UNKNOWN`,async()=>{
  const f=await wired(id);f.stateOwner.beforeSecret=()=>f.core.state.membershipRevision='e'.repeat(64);
  try{await assert.rejects(f.invoke(),{message:'INVALID_RESULT'});assert.equal(f.stateOwner.secrets,1);assert.equal(f.wire.length,0);assert.equal(contexts(f).length,0);unknown(f);}
  finally{f.scope.abort();}
 });
 test(`BD personal ${id}: task/native revocation after source releases no result or completion`,async()=>{
  for(const mode of ['task','identity','membership']){
   const f=await wired(id);f.state.afterSource=()=>{if(mode==='task')f.state.grant.state='REVOKED';else if(mode==='identity')f.core.state.identityRevision='e'.repeat(64);else f.core.state.membershipRevision='e'.repeat(64);};
   try{await assert.rejects(f.invoke());assert.equal(f.wire.length,1);assert.equal(contexts(f).length,0);unknown(f);}
   finally{f.scope.abort();}
  }
 });
 test(`BD personal ${id}: uncertain native source response holds UNKNOWN without fallback or a private context request`,async()=>{
  const f=await wired(id);f.state.responseFactory=()=>{throw Error('SYNTHETIC_SOURCE_CONNECTION_UNCERTAIN');};
  try{await assert.rejects(f.invoke(),{message:'INVALID_RESULT'});assert.equal(f.wire.length,1);assert.equal(f.stateOwner.secrets,1);assert.equal(contexts(f).length,0);unknown(f);}
  finally{f.scope.abort();}
 });
 test(`BD personal ${id}: static source credentials cannot replace the current invocation credential owner`,async()=>{
  const f=await wired(id,{staticCredentials:true});
  try{await assert.rejects(f.invoke(),{message:'UNAVAILABLE'});assert.equal(f.state.staticFallbackCalls??0,0);assert.equal(f.stateOwner.secrets,0);assert.equal(f.wire.length,0);assert.equal(contexts(f).length,0);unknown(f);}
  finally{f.scope.abort();}
 });
}
