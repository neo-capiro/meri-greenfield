/** Actual task/native/delegation/gateway owners with synthetic Core/SQL only.
 * The live Core operation allowlist remains a separate qualification gate. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createGeneralReadFamilyHandlers} from '../../../../gateway/general-reads/integration.mjs';
import {storedCase,clientId} from '../../../../gateway/sources/research-legal-candidates/test/fixture.mjs';
import {createControlGeneralReadRuntime} from '../../../general-read-runtime.mjs';
import {createNativeReadCredentialOwner} from '../owner.mjs';
import {ownerFixture,origin} from './fixture.mjs';
import {createReadDelegationCoreClient} from '../../read-delegation/core-client.mjs';
import {createRunReadDelegation} from '../../read-delegation/delegation.mjs';
import {composeDelegatedNativeCredentials} from '../../read-delegation/native-credentials.mjs';
import {delegationCoreFixture} from '../../read-delegation/test/fixture.mjs';

async function wired(mode){
 const scene=storedCase({request:{query:'priority',clientId}}),f=await ownerFixture('search_research_sources',{scene});
 let core,delegation,owner=f.owner,fetchImpl=f.transport.fetchImpl;
 if(mode!=='attended'){
  const liveCredential=async()=>({credential:'SYNTHETIC_LIVE',expiresAtMs:f.deadlineMs});
  core=delegationCoreFixture({now:f.now,binding:f.binding,clientId,runDeadlineMs:f.deadlineMs,
   principal:f.core.principal,reservations:f.state.reservations,liveBearers:new Set(['SYNTHETIC_LIVE']),
   authority:f.core.fetchImpl,tools:f.transport.fetchImpl});
  core.state.unavailable=mode==='unavailable-attended-fallback';
  const client=createReadDelegationCoreClient({origin,now:f.now,fetchImpl:core.fetchImpl,enabled:true,
   getServiceSecret:async()=>'SYNTHETIC_SERVICE'});
  delegation=createRunReadDelegation({binding:f.binding,scopes:f.scopes,allocationJson:f.allocationJson,
   runDeadlineMs:f.deadlineMs,client,now:f.now,liveCredentialFor:liveCredential});
  const credentials=composeDelegatedNativeCredentials({delegation,client,now:f.now,
   fallback:{coreAuthority:f.configuration.coreAuthority,getNativeCredential:liveCredential}});
  owner=createNativeReadCredentialOwner({...f.configuration,coreAuthority:credentials.coreAuthority,
   getNativeCredential:credentials.getNativeCredential,toolCredential:credentials.toolCredential});
  fetchImpl=core.fetchImpl;
 }
 const {getCredentials,credentialsForCall,authorizeResultForCall,...transport}=f.transport;
 const handlers=await createGeneralReadFamilyHandlers({families:{[f.family]:{...transport,fetchImpl,
  credentialsForCall:owner.credentialsForCall}},now:f.now,newId:randomUUID});
 const {installationOwner,...gateway}=f.gatewayConfiguration;
 const runtime=createControlGeneralReadRuntime({...gateway,handlers,scopes:f.scopes,
  readCurrentInstallation:({signal})=>installationOwner.readCurrent({signal}),nativeReadContextPorts:owner.nativeReadContextPorts});
 return {...f,delegatedCore:core,delegation,invoke:()=>runtime.execute({operation:f.operation,arguments:f.request,
  deliveryId:`research-signed-admission-${mode}`})};
}

for(const mode of ['attended','unavailable-attended-fallback'])test(`research sources: actual ${mode} authority cannot dispatch the signed-only source`,async()=>{
 const f=await wired(mode);let failure;
 try{
  try{await f.invoke();}catch(error){failure=error;}
  assert.equal(f.wire.length,0,'an actual ordinary native/fallback credential must be refused before source HTTP');
  assert.equal(failure?.message,'UNAVAILABLE');
  assert.ok(f.core.state.calls.length>0,'current native authority still runs');
  if(mode==='unavailable-attended-fallback'){
   assert.equal(f.delegation.mode,'attended');
   assert.ok(f.delegatedCore.state.calls.some(call=>call.path==='/api/clio/application-authority/read-delegations'));
   assert.equal([...f.delegatedCore.state.tokens.values()].filter(token=>token.kind==='tool').length,0);
  }
  assert.equal(f.state.budget.consumed_micro_usd,0);
  for(const produced of f.state.produced.values())assert.equal(produced.completion,null);
  const [reservation]=f.state.reservations.values();assert.equal(reservation.state,'UNKNOWN');
 }finally{f.scope.abort();}
});

test('research sources: actual admitted delegated authority dispatches one exact signed source request',async()=>{
 const f=await wired('delegated');
 try{
  const result=JSON.parse(await f.invoke());assert.deepEqual(result.result,f.page);assert.equal(f.wire.length,1);
  assert.match(f.wire[0].options.headers.authorization,/^CapiroMeriRead synthetic-read-token-/u);
  assert.deepEqual(f.wire[0].body,f.request);assert.equal(f.state.budget.consumed_micro_usd,1);
  assert.equal([...f.state.reservations.values()][0].state,'SETTLED');
 }finally{f.scope.abort();}
});
