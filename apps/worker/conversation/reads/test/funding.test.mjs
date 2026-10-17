/** Actual MCP/CONTROL/gateway owners with scripted SQL and synthetic native bridge consumption; no deployed Core qualification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {decodeNativeReadObservation,NATIVE_READ_OBSERVATION_HEADER as HEADER} from '../../../../../packages/contracts/native-read-observation-0.2/validate.mjs';
import {storedCase,storedPage,ids,clientId,requests} from '../../../../gateway/sources/funding-opportunities/test/fixture.mjs';
import {createGeneralReadFamilyHandlers} from '../../../../gateway/general-reads/integration.mjs';
import {createControlGeneralReadRuntime} from '../../../../runtime/general-read-runtime.mjs';
import {ownerFixture,uuid} from '../../../../runtime/native-authority/native-read-credentials/test/fixture.mjs';
import {familyReads,resolveAvailableReads} from '../availability.mjs';
import {READ_FAMILIES,READ_FAMILY_IDS} from '../families.mjs';
import {advertisedArguments} from '../schema.mjs';
import {mountReads,SESSION} from './fixture.mjs';

const family='funding-opportunities',foreign=uuid('e'),operations=ids.map(id=>({id,version:'0.2.0'}));
async function mounted(id,{scene=storedCase(id)}={}){
 const sourceFetch=scene.transport.fetchImpl;
 // Offline stand-in constructs its source page from the admitted carrier before HTTP receiving; it never edits returned bytes.
 scene.transport={...scene.transport,async fetchImpl(url,options){
  const request=JSON.parse(options.body),observation=decodeNativeReadObservation(options.headers[HEADER],{operation:scene.operation,request});
  assert.deepEqual(request,scene.arguments);(scene.state.observations??=[]).push(observation);
  const normalized=scene.contract.normalizeInput(request,observation.context);
  scene.state.page=storedPage(id,normalized.input,observation.context.asOf,new Date(scene.now()-60000).toISOString());
  return sourceFetch(url,options);
 }};
 const f=await ownerFixture(id,{scene}),{getCredentials,credentialsForCall,...transport}=f.transport;
 const handlers=await createGeneralReadFamilyHandlers({families:{[family]:{...transport,credentialsForCall:f.owner.credentialsForCall}},now:f.now,newId:randomUUID});
 const {installationOwner,...gateway}=f.gatewayConfiguration;
 const nativePort=createControlGeneralReadRuntime({...gateway,handlers,scopes:f.scopes,readCurrentInstallation:({signal})=>installationOwner.readCurrent({signal}),nativeReadContextPorts:f.owner.nativeReadContextPorts});
 const calls=[],port={readAvailability:options=>nativePort.readAvailability(options),execute(call){calls.push({operation:call.operation,arguments:call.arguments,deliveryId:call.deliveryId});return nativePort.execute(call);}};
 return {...f,port,calls};
}
function noSource(f){assert.equal(f.wire.length,0);assert.equal(f.stateOwner.secrets,0);assert.equal(f.state.reservations.size,0);assert.equal(f.state.budget.consumed_micro_usd,0);}
function unknown(f){const [r]=f.state.reservations.values();assert.equal(r.state,'UNKNOWN');assert.equal(r.hold_micro_usd,1);assert.equal(r.output_bytes,null);assert.equal(r.charged_micro_usd,null);assert.equal(f.state.budget.consumed_micro_usd,0);assert.equal([...f.state.produced.values()][0].completion,null);}

test('funding SDK: the complete five-operation family requires a task client scope despite forged inventories',()=>{
 assert.equal(familyReads().length,65);assert.equal(READ_FAMILY_IDS.length,37);assert.equal(READ_FAMILIES[family].clientScope,'required');
 assert.deepEqual(familyReads().filter(row=>row.family===family).map(row=>row.operation),operations);
 const overclaimed=[...operations,{id:'get_business_development_evidence',version:'0.2.0'},{id:'search_federal_grants',version:'0.2.0'}];
 const select=scopes=>resolveAvailableReads({policy:{generalReads:true,readFamilies:[family]},installation:{operations:overclaimed},discovery:{operations:overclaimed},scopes});
 assert.deepEqual(select([{kind:'client'}]).available.map(row=>row.operation),operations);
 for(const scopes of [[],[{kind:'tenant'}],[{kind:'private-user'}]])assert.deepEqual(select(scopes).available,[]);
});

for(const id of ids){
 test(`funding SDK ${id}: canonical literal arguments admit no model context, authority or header`,()=>{
  const f=storedCase(id),schema=advertisedArguments(f.contract.descriptor.inputSchema);assert.equal(schema.mode,'canonical');assert.deepEqual(schema.arguments.parse(f.arguments),f.arguments);
  for(const extra of [{asOf:f.normalizationContext.asOf},{normalizationContext:f.normalizationContext},{tenantId:f.authority.binding.tenantId},{subject:f.authority.subject},{[HEADER]:'forged'},{input:f.arguments}])assert.equal(schema.arguments.safeParse({...f.arguments,...extra}).success,false);
  const {clientId:ignored,...noClient}=f.arguments;assert.equal(schema.arguments.safeParse(noClient).success,false);assert.equal(schema.arguments.safeParse({...f.arguments,clientId:'named client'}).success,false);
 });
 test(`funding SDK ${id}: normal hook/source execution retains raw arguments, captured anchor, delivery hashes and settled receipts`,async()=>{
  const f=await mounted(id),m=await mountReads(f,{port:f.port});assert.notEqual(m,null);
  try{
   const toolUseId=`funding_${ids.indexOf(id)}`,deliveryId='sdk:'+hash({binding:f.binding,sessionId:SESSION,toolUseId});
   assert.deepEqual((await m.client.listTools()).tools.map(tool=>tool.name),[id]);
   f.core.state.beforeResponse=()=>f.state.now++;
   const result=await m.call(id,f.request,{toolUseId});assert.equal(result.isError,undefined);assert.equal(result.denied,undefined);
   const raw=result.content[0].text,out=JSON.parse(raw),[observation]=f.state.observations;
   assert.deepEqual(f.calls,[{operation:f.operation,arguments:f.request,deliveryId}]);assert.deepEqual(f.wire[0].body,f.request);assert.deepEqual(f.request,requests[id]);assert.equal(f.wire.length,1);
   assert.equal(f.wire[0].url,`https://native-core.example.invalid/api/clio/tools/${id}`);assert.equal(observation.requestSha256,hash(f.request));assert.deepEqual(observation.operation,f.operation);
   assert.equal(out.result.asOf,observation.context.asOf);assert.deepEqual(out.result,f.state.nativeValue);assert.deepEqual(f.stateOwner.secretProof.normalizationContext,observation.context);
   assert.equal(out.argumentsSha256,f.contract.normalizeInput(f.request,observation.context).argumentsSha256);assert.deepEqual(out.binding,f.binding);assert.deepEqual(out.subject,f.authority.subject);assert.deepEqual(out.operation,f.operation);
   const [receipt]=m.runtime.receipts();assert.equal(m.runtime.receipts().length,1);assert.equal(receipt.deliveryId,deliveryId);assert.deepEqual(receipt.operation,f.operation);assert.equal(receipt.argumentsSha256,hash(f.request));assert.equal(receipt.resultSha256,hash(out));
   assert.equal(receipt.decisionId,out.subject.authorizationDecisionId);assert.equal(receipt.policyRevision,f.policyRevision);
   const [reservation]=f.state.reservations.values(),[produced]=f.state.produced.values();assert.equal(reservation.state,'SETTLED');assert.equal(reservation.charged_micro_usd,1);assert.equal(reservation.output_bytes,Buffer.byteLength(raw));assert.equal(produced.completion.resultSha256,hash(out));
  }finally{await m.close();f.scope.abort();}
 });
 test(`funding SDK ${id}: personal task authority cannot become a client grant through installed or discovered operations`,async()=>{
  const scene=storedCase(id),a=scene.authority,scope={tenantId:a.binding.tenantId,kind:'private-user',resourceId:a.binding.actorId,policyRevision:a.policyRevision};
  Object.assign(a.subject,{kind:'personal',entityType:'user',entityIds:[a.binding.actorId],scopes:[scope]});a.claims.scopes=[scope];a.decision.scopes=[scope];scene.visibleClientIds=[];
  const f=await mounted(id,{scene});try{assert.equal(await mountReads(f,{port:f.port}),null);assert.equal(f.calls.length,0);noSource(f);}finally{f.scope.abort();}
 });
 test(`funding SDK ${id}: a foreign literal client or revoked native client visibility releases no source credential`,async()=>{
  for(const mode of ['foreign-client','invisible']){
   const f=await mounted(id),m=await mountReads(f,{port:f.port});assert.notEqual(m,null);
   try{
    if(mode==='invisible')f.core.state.clientIds=[];
    const result=await m.call(id,mode==='foreign-client'?{...f.request,clientId:foreign}:f.request);
    assert.equal(result.isError,true);assert.match(result.content[0].text,/^ACCESS_DENIED:/);assert.deepEqual(m.runtime.receipts(),[]);noSource(f);
    if(mode==='foreign-client')assert.equal(f.stateOwner.nativeCredentials,0);
   }finally{await m.close();f.scope.abort();}
  }
 });
 test(`funding SDK ${id}: missing installation, discovery, source, policy or exact handler measurement cannot mount a tool`,async()=>{
  const f=await mounted(id);
  try{
   f.state.installRevoked=true;assert.equal(await mountReads(f,{port:f.port}),null);f.state.installRevoked=false;
   f.state.discoveryMutator=row=>row.operations=[];assert.equal(await mountReads(f,{port:f.port}),null);f.state.discoveryMutator=undefined;
   f.state.installationMutator=row=>row.operations[0].handlerSourceSha256='e'.repeat(64);assert.equal(await mountReads(f,{port:f.port}),null);f.state.installationMutator=undefined;
   assert.equal(await mountReads(f,{port:f.port,policy:{generalReads:false}}),null);assert.equal(await mountReads(f,{port:f.port,policy:{generalReads:true,readFamilies:['mail']}}),null);
   assert.equal(await mountReads(f,{port:f.mount({sourceEnabled:false})}),null);assert.equal(f.calls.length,0);noSource(f);
  }finally{f.scope.abort();}
 });
 test(`funding SDK ${id}: current availability revocation after listing refuses before gateway execution`,async()=>{
  for(const mode of ['installation','discovery']){
   const f=await mounted(id),m=await mountReads(f,{port:f.port});assert.notEqual(m,null);
   try{
    if(mode==='installation')f.state.installRevoked=true;else f.state.discoveryMutator=row=>row.operations=[];
    const result=await m.call(id,f.request);assert.equal(result.isError,true);assert.match(result.content[0].text,/^UNAVAILABLE:/);assert.deepEqual(m.runtime.receipts(),[]);assert.equal(f.calls.length,0);noSource(f);
   }finally{await m.close();f.scope.abort();}
  }
 });
 test(`funding SDK ${id}: current membership drift after source withholds result bytes and keeps UNKNOWN`,async()=>{
  const f=await mounted(id),m=await mountReads(f,{port:f.port});assert.notEqual(m,null);
  try{
   f.state.afterSource=()=>f.core.state.membershipRevision='e'.repeat(64);
   const result=await m.call(id,f.request);assert.equal(result.isError,true);assert.match(result.content[0].text,/^ACCESS_DENIED:/);assert.deepEqual(m.runtime.receipts(),[]);assert.equal(f.wire.length,1);unknown(f);
  }finally{await m.close();f.scope.abort();}
 });
}

test('funding SDK: invocation token and original arguments remain required before a source call',async()=>{
 const f=await mounted(ids[0]),m=await mountReads(f,{port:f.port});assert.notEqual(m,null);
 try{
  const direct=await m.client.callTool({name:ids[0],arguments:{arguments:f.request}});assert.equal(direct.isError,true);assert.match(direct.content[0].text,/^ACCESS_DENIED:/);
  const decision=await m.hook({hook_event_name:'PreToolUse',session_id:SESSION,tool_name:`mcp__meri_reads__${ids[0]}`,tool_use_id:'funding_substitution',tool_input:{arguments:f.request}},undefined,{signal:new AbortController().signal});
  const result=await m.client.callTool({name:ids[0],arguments:{...decision.hookSpecificOutput.updatedInput,arguments:{...f.request,clientId:foreign}}});
  assert.equal(result.isError,true);assert.match(result.content[0].text,/^ACCESS_DENIED:/);assert.deepEqual(m.runtime.receipts(),[]);assert.equal(f.calls.length,0);noSource(f);
 }finally{await m.close();f.scope.abort();}
});

test('funding SDK: an admitted one-call budget settles once and refuses another source dispatch',async()=>{
 const f=await mounted(ids[0]),m=await mountReads(f,{port:f.port,skill:{allowedOperations:[f.operation],budgets:{maxToolCalls:1,maxOutputBytes:1048576}}});assert.notEqual(m,null);
 try{
  const first=await m.call(ids[0],f.request);assert.equal(first.isError,undefined);assert.equal(m.runtime.receipts().length,1);
  const second=await m.call(ids[0],f.request);assert.match(second.denied,/RESOURCE_LIMIT/);assert.equal(f.wire.length,1);assert.equal(f.state.reservations.size,1);assert.equal([...f.state.reservations.values()][0].state,'SETTLED');
 }finally{await m.close();f.scope.abort();}
});
