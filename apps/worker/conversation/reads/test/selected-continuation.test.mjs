/** Ordinary, unselected-skill MCP calls through actual read/delegation/gateway owners.
 * Core eligibility, HTTP source bytes and SQL are explicit synthetic stand-ins;
 * these tests never qualify the live Core allowlist or native conversation custody. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {nativeFamilyCase} from '../../../../gateway/general-reads/test/native-family-cases.mjs';
import {createGeneralReadFamilyHandlers} from '../../../../gateway/general-reads/integration.mjs';
import {createControlGeneralReadRuntime} from '../../../../runtime/general-read-runtime.mjs';
import {createNativeReadCredentialOwner} from '../../../../runtime/native-authority/native-read-credentials/owner.mjs';
import {ownerFixture,origin} from '../../../../runtime/native-authority/native-read-credentials/test/fixture.mjs';
import {createReadDelegationCoreClient} from '../../../../runtime/native-authority/read-delegation/core-client.mjs';
import {createRunReadDelegation} from '../../../../runtime/native-authority/read-delegation/delegation.mjs';
import {composeDelegatedNativeCredentials} from '../../../../runtime/native-authority/read-delegation/native-credentials.mjs';
import {delegationCoreFixture} from '../../../../runtime/native-authority/read-delegation/test/fixture.mjs';
import {mountReads} from './fixture.mjs';

const CLIENT='a1234567-b123-4c12-8d12-e123456789ab';
const cases=[
 ['research-legal-legislation','get_legal_reference'],
 ['research-legal-news','search_legiwatch_news'],
 ['outreach-query','query_outreach'],
 ['research-legal-candidates','search_research_sources'],
 ['business-development','get_business_development_evidence'],
];

async function mounted(family,id){
 const base=nativeFamilyCase(family,id),request=family==='business-development'?
  {...base.arguments,conversationId:base.authority.binding.conversationId}:{...base.arguments,clientId:CLIENT};
 const f=await ownerFixture(id,{scene:nativeFamilyCase(family,id,{request})});
 const core=delegationCoreFixture({now:f.now,binding:f.binding,clientId:CLIENT,runDeadlineMs:f.deadlineMs,
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
 const build=configuration=>createControlGeneralReadRuntime({...gateway,handlers,scopes:f.scopes,
  readCurrentInstallation:({signal})=>installationOwner.readCurrent({signal}),
  nativeReadContextPorts:owner.nativeReadContextPorts,...configuration});
 return {...f,delegatedCore:core,port:build(),build};
}

function noRelease(f){
 assert.equal(f.state.budget.consumed_micro_usd,0);
 for(const produced of f.state.produced.values())assert.equal(produced.completion,null);
}

for(const [family,id] of cases){
 test(`ordinary ${id}: current synthetic gates discover and invoke the canonical signed read without a skill`,async()=>{
  const f=await mounted(family,id),policy={generalReads:true,readFamilies:[family],activeReadOperations:[f.operation]},
   m=await mountReads(f,{port:f.port,policy,mount:'profile'});assert.notEqual(m,null);
  try{
   assert.deepEqual((await m.client.listTools()).tools.map(tool=>tool.name),[id]);
   assert.equal(f.wire.length,0,'discovery does not execute the source');
   const result=await m.call(id,f.request);assert.equal(result.isError,undefined);assert.equal(result.denied,undefined);
   const raw=result.content[0].text,value=JSON.parse(raw),wire=f.wire[0];
   assert.deepEqual(value.result,JSON.parse(JSON.stringify(f.page)));assert.deepEqual(value.binding,f.binding);
   assert.deepEqual(value.subject.scopes,f.scopes);assert.equal(f.scopes[0].resourceId,CLIENT);
   assert.equal(wire.url,`${origin}/api/clio/tools/${id}`);assert.deepEqual(wire.body,f.request);
   assert.match(wire.options.headers.authorization,/^CapiroMeriRead synthetic-read-token-/u);
   const toolTokens=[...f.delegatedCore.state.tokens.values()].filter(token=>token.kind==='tool');
   assert.equal(toolTokens.length,1);assert.equal(toolTokens[0].consumed,true);
   assert.equal(toolTokens[0].bodySha256,createHash('sha256').update(wire.options.body,'utf8').digest('hex'));
   assert.ok(f.delegatedCore.state.calls.every(call=>!String(call.headers.authorization).includes('mrd.')));
   const [reservation]=f.state.reservations.values();assert.equal(reservation.state,'SETTLED');
   assert.equal(reservation.output_bytes,Buffer.byteLength(raw));assert.equal(reservation.charged_micro_usd,1);
   assert.equal(m.runtime.receipts().length,1);assert.equal(m.runtime.receipts()[0].resultSha256,hash(value));
  }finally{await m.close();f.scope.abort();}
 });

 test(`ordinary ${id}: an omitted profile pin cannot register a catalog read`,async()=>{
  const f=await mounted(family,id);
  try{
   assert.equal(await mountReads(f,{port:f.port,policy:{generalReads:true,readFamilies:[family]},mount:'profile'}),null);
   assert.equal(f.wire.length,0);assert.equal(f.state.reservations.size,0);noRelease(f);
  }finally{f.scope.abort();}
 });

 test(`ordinary ${id}: installation, discovery, source and family policy remain independent gates`,async()=>{
  const f=await mounted(family,id);
  try{
   f.state.installRevoked=true;assert.equal(await mountReads(f,{port:f.port}),null);f.state.installRevoked=false;
   f.state.discoveryMutator=row=>row.operations=[];assert.equal(await mountReads(f,{port:f.port}),null);f.state.discoveryMutator=undefined;
   assert.equal(await mountReads(f,{port:f.build({sourceEnabled:false})}),null);
   assert.equal(await mountReads(f,{port:f.port,policy:{generalReads:false}}),null);
   assert.equal(await mountReads(f,{port:f.port,policy:{generalReads:true,readFamilies:['mail']}}),null);
   assert.equal(f.wire.length,0);assert.equal(f.state.reservations.size,0);noRelease(f);
  }finally{f.scope.abort();}
 });

 test(`ordinary ${id}: revocation after discovery prevents dispatch and accepted receipts`,async()=>{
  for(const gate of ['installation','discovery']){
   const f=await mounted(family,id),m=await mountReads(f,{port:f.port});assert.notEqual(m,null);
   try{
    if(gate==='installation')f.state.installRevoked=true;else f.state.discoveryMutator=row=>row.operations=[];
    const result=await m.call(id,f.request);assert.equal(result.isError,true);assert.match(result.content[0].text,/^UNAVAILABLE:/u);
    assert.equal(f.wire.length,0);assert.equal(f.state.reservations.size,0);assert.deepEqual(m.runtime.receipts(),[]);noRelease(f);
   }finally{await m.close();f.scope.abort();}
  }
 });

 test(`ordinary ${id}: source-release revocation withholds bytes and preserves UNKNOWN`,async()=>{
  const f=await mounted(family,id),m=await mountReads(f,{port:f.port});assert.notEqual(m,null);
  try{
   f.delegatedCore.state.withholdAtRelease=true;
   const result=await m.call(id,f.request);assert.equal(result.isError,true);assert.deepEqual(m.runtime.receipts(),[]);
   assert.equal(f.wire.length,1);assert.equal([...f.state.reservations.values()][0].state,'UNKNOWN');noRelease(f);
  }finally{await m.close();f.scope.abort();}
 });
}
