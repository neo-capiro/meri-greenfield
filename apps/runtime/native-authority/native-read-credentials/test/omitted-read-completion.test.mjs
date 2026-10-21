/** Real dispatch/native authority/delegation/transport owners; synthetic Core/SQL/source bytes only. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {nativeFamilyCase} from '../../../../gateway/general-reads/test/native-family-cases.mjs';
import {createGeneralReadFamilyHandlers} from '../../../../gateway/general-reads/integration.mjs';
import {createControlGeneralReadRuntime} from '../../../general-read-runtime.mjs';
import {createNativeReadCredentialOwner} from '../owner.mjs';
import {ownerFixture,origin} from './fixture.mjs';
import {createReadDelegationCoreClient} from '../../read-delegation/core-client.mjs';
import {createRunReadDelegation} from '../../read-delegation/delegation.mjs';
import {composeDelegatedNativeCredentials} from '../../read-delegation/native-credentials.mjs';
import {delegationCoreFixture} from '../../read-delegation/test/fixture.mjs';

const CLIENT='a1234567-b123-4c12-8d12-e123456789ab';
const cases=[
 ['research-legal-legislation','search_legislative_research'],['research-legal-legislation','get_legal_reference'],
 ['research-legal-news','search_legiwatch_news'],['outreach-query','query_outreach'],
 ['business-development','get_business_development_context'],['business-development','get_business_development_recent_changes'],
];
function selectedScene(family,id){
 const base=nativeFamilyCase(family,id),request=family==='business-development'?
  {...base.arguments,conversationId:base.authority.binding.conversationId}:{...base.arguments,clientId:CLIENT};
 return nativeFamilyCase(family,id,{request});
}
async function wired(family,id){
 const f=await ownerFixture(id,{scene:selectedScene(family,id)}),clientId=f.scopes[0].resourceId;
 const core=delegationCoreFixture({now:f.now,binding:f.binding,clientId,runDeadlineMs:f.deadlineMs,
  principal:f.core.principal,reservations:f.state.reservations,liveBearers:new Set(['SYNTHETIC_LIVE']),
  authority:f.core.fetchImpl,tools:f.transport.fetchImpl});
 const client=createReadDelegationCoreClient({origin,now:f.now,fetchImpl:core.fetchImpl,enabled:true,
  getServiceSecret:async()=>'SYNTHETIC_SERVICE'});
 const delegation=createRunReadDelegation({binding:f.binding,scopes:f.scopes,allocationJson:f.allocationJson,
  runDeadlineMs:f.deadlineMs,client,now:f.now,
  liveCredentialFor:async()=>({credential:'SYNTHETIC_LIVE',expiresAtMs:f.deadlineMs})});
 const credentials=composeDelegatedNativeCredentials({delegation,client,now:f.now});
 const owner=createNativeReadCredentialOwner({...f.configuration,coreAuthority:credentials.coreAuthority,
  getNativeCredential:credentials.getNativeCredential,toolCredential:credentials.toolCredential});
 const {getCredentials,credentialsForCall,authorizeResultForCall,...transport}=f.transport;
 const handlers=await createGeneralReadFamilyHandlers({families:{[family]:{...transport,fetchImpl:core.fetchImpl,
  credentialsForCall:owner.credentialsForCall}},now:f.now,newId:randomUUID});
 const {installationOwner,...gateway}=f.gatewayConfiguration;
 const runtime=createControlGeneralReadRuntime({...gateway,handlers,scopes:f.scopes,
  readCurrentInstallation:({signal})=>installationOwner.readCurrent({signal}),nativeReadContextPorts:owner.nativeReadContextPorts});
 return {...f,nativeCore:f.core,core,delegation,credentials,execute:()=>runtime.execute({operation:f.operation,arguments:f.request,deliveryId:'omitted-read-completion'})};
}
for(const [family,id] of cases){
 test(`${id}: current client authority, one-use exact source token and validated stored result complete the gateway chain`,async()=>{
  const f=await wired(family,id);
  try{
   const out=JSON.parse(await f.execute()),wire=f.wire[0];
   assert.deepEqual(out.result,JSON.parse(JSON.stringify(f.page)));assert.deepEqual(out.binding,f.binding);
   assert.deepEqual(out.subject.scopes,f.scopes);assert.equal(f.scopes[0].resourceId,CLIENT);
   assert.equal(wire.url,`${origin}/api/clio/tools/${id}`);assert.equal(wire.options.method,'POST');
   assert.deepEqual(wire.body,f.request);assert.match(wire.options.headers.authorization,/^CapiroMeriRead synthetic-read-token-/u);
   assert.equal(f.nativeCore.state.calls.length,0,'delegated reads do not send opaque handles to ordinary native authority routes');
   const tool=[...f.core.state.tokens.values()].filter(token=>token.kind==='tool');
   assert.equal(tool.length,1);assert.equal(tool[0].consumed,true);assert.equal(tool[0].path,`/api/clio/tools/${id}`);
   assert.equal(tool[0].bodySha256,createHash('sha256').update(wire.options.body,'utf8').digest('hex'));
   assert.ok(f.core.state.calls.every(call=>!String(call.headers.authorization).includes('mrd.')));
   const [reservation]=f.state.reservations.values();assert.equal(reservation.state,'SETTLED');
   assert.equal(reservation.arguments_sha256,out.argumentsSha256);assert.equal(f.state.budget.consumed_micro_usd,1);
   assert.equal([...f.state.produced.values()][0].completion.resultSha256,canonicalSha256(out));
  }finally{f.scope.abort();}
 });
 test(`${id}: revoked tool issuance cannot fall back to a Bearer or settle a result`,async()=>{
  const f=await wired(family,id);f.core.state.rejectTool=true;
  try{
   await assert.rejects(f.execute());assert.equal(f.wire.length,0);
   const [reservation]=f.state.reservations.values();assert.equal(reservation.state,'UNKNOWN');
   assert.equal(f.state.budget.consumed_micro_usd,0);assert.equal([...f.state.produced.values()][0].completion,null);
   assert.ok(f.core.state.calls.every(call=>!String(call.headers.authorization).includes('mrd.')));
  }finally{f.scope.abort();}
 });
 test(`${id}: release revocation withholds source bytes and leaves the reservation unsettled`,async()=>{
  const f=await wired(family,id);f.core.state.withholdAtRelease=true;
  try{
   await assert.rejects(f.execute());assert.equal(f.wire.length,1);
   assert.equal([...f.state.reservations.values()][0].state,'UNKNOWN');
   assert.equal([...f.state.produced.values()][0].completion,null);
  }finally{f.scope.abort();}
 });
}

test('BD evidence: native stored producer adapter is ready but missing Core Option B admission releases nothing',async()=>{
 const f=await wired('business-development','get_business_development_evidence');f.core.state.rejectTool=true;
 try{
  await assert.rejects(f.execute());assert.equal(f.wire.length,0);
  assert.equal([...f.state.reservations.values()][0].state,'UNKNOWN');
  assert.equal([...f.state.produced.values()][0].completion,null);
 }finally{f.scope.abort();}
});
