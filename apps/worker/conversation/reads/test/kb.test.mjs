/** Actual MCP/CONTROL/gateway owners and scripted SQL; synthetic observation-consuming native JSON only. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {decodeNativeReadObservation,NATIVE_READ_OBSERVATION_HEADER as HEADER} from '../../../../../packages/contracts/native-read-observation-0.2/validate.mjs';
import {storedCase,storedSearchPage,searchId,id as graphId,clientId} from '../../../../gateway/sources/client-knowledge-search/test/fixture.mjs';
import {createGeneralReadFamilyHandlers} from '../../../../gateway/general-reads/integration.mjs';
import {createControlGeneralReadRuntime} from '../../../../runtime/general-read-runtime.mjs';
import {ownerFixture,uuid} from '../../../../runtime/native-authority/native-read-credentials/test/fixture.mjs';
import {familyReads,resolveAvailableReads} from '../availability.mjs';
import {READ_FAMILIES,READ_FAMILY_IDS} from '../families.mjs';
import {advertisedArguments} from '../schema.mjs';
import {mountReads,SESSION} from './fixture.mjs';

const family='client-knowledge-search',foreign=uuid('e'),operations=[searchId,graphId].map(id=>({id,version:'0.2.0'}));
async function mounted(id=searchId,{scene=storedCase(id),pageOptions={}}={}){
 const sourceFetch=scene.transport.fetchImpl;
 scene.transport={...scene.transport,async fetchImpl(url,options){
  const request=JSON.parse(options.body);assert.deepEqual(request,scene.arguments);
  if(id===searchId){
   const observation=decodeNativeReadObservation(options.headers[HEADER],{operation:scene.operation,request});
   (scene.state.observations??=[]).push(observation);
   const normalized=scene.contract.normalizeInput(request,observation.context);
   // This offline native stand-in consumes the admitted carrier before producing source bytes.
   scene.state.page=storedSearchPage(normalized.input,observation.context.asOf,pageOptions);
  }else assert.equal(options.headers[HEADER],undefined);
  return sourceFetch(url,options);
 }};
 const f=await ownerFixture(id,{scene}),{getCredentials,credentialsForCall,authorizeResultForCall,...transport}=f.transport;
 const handlers=await createGeneralReadFamilyHandlers({families:{[family]:{...transport,credentialsForCall:f.owner.credentialsForCall}},now:f.now,newId:randomUUID});
 const {installationOwner,...gateway}=f.gatewayConfiguration;
 const nativePort=createControlGeneralReadRuntime({...gateway,handlers,scopes:f.scopes,readCurrentInstallation:({signal})=>installationOwner.readCurrent({signal}),nativeReadContextPorts:f.owner.nativeReadContextPorts});
 const calls=[],port={readAvailability:options=>nativePort.readAvailability(options),execute(call){calls.push({operation:call.operation,arguments:call.arguments,deliveryId:call.deliveryId});return nativePort.execute(call);}};
 return {...f,port,calls,handlers};
}
function noSource(f){assert.equal(f.wire.length,0);assert.equal(f.stateOwner.secrets,0);assert.equal(f.state.reservations.size,0);assert.equal(f.state.budget.consumed_micro_usd,0);}
function unknown(f){const [r]=f.state.reservations.values();assert.equal(r.state,'UNKNOWN');assert.equal(r.hold_micro_usd,1);assert.equal(r.output_bytes,null);assert.equal(r.charged_micro_usd,null);assert.equal(f.state.budget.consumed_micro_usd,0);assert.equal([...f.state.produced.values()][0].completion,null);}

test('KB SDK: complete family keeps optional graph and requires a current task client scope only for semantic search',()=>{
 assert.equal(familyReads().length,76);assert.equal(READ_FAMILY_IDS.length,42);assert.equal(READ_FAMILIES[family].clientScope,'optional');
 assert.equal(READ_FAMILIES[family].operationIds,undefined);assert.deepEqual(READ_FAMILIES[family].requiredClientOperations,[searchId]);
 assert.deepEqual(familyReads().filter(row=>row.family===family).map(row=>row.operation),operations);
 const overclaimed=[...operations,{id:'get_business_development_evidence',version:'0.2.0'}];
 const select=scopes=>resolveAvailableReads({policy:{generalReads:true,readFamilies:[family]},installation:{operations:overclaimed},discovery:{operations:overclaimed},scopes});
 assert.deepEqual(select([{kind:'client'}]).available.map(row=>row.operation),operations);
 for(const scopes of [[],[{kind:'tenant'}],[{kind:'private-user'}]])assert.deepEqual(select(scopes).available.map(row=>row.operation),[operations[1]]);
});

test('KB SDK: both measured handlers include the semantic helper, family, private wire and current context exactly once',async()=>{
 const f=await mounted();try{
  assert.deepEqual([...f.handlers.keys()],[`${searchId}@0.2.0`,`${graphId}@0.2.0`]);
  for(const handler of f.handlers.values()){
   assert.equal(handler.sourceSha256,hash(handler.sourceFiles));
   for(const label of ['apps/gateway/general-reads/families/client-knowledge-search.mjs','apps/gateway/sources/client-knowledge-search/handler.mjs',
    'apps/gateway/sources/client-knowledge-search/request-context.mjs','packages/contracts/native-read-observation-0.2/schema.json',
    'packages/contracts/native-read-observation-0.2/validate.mjs','apps/runtime/native-authority/native-read-credentials/source-read-context.mjs']){
    const matches=handler.sourceFiles.filter(row=>row.label===label);assert.equal(matches.length,1,label);assert.match(matches[0].sha256,/^[a-f0-9]{64}$/u);
   }
  }
  noSource(f);
 }finally{f.scope.abort();}
});

test('KB SDK: semantic literal schema refuses model context, authority and carrier fields',()=>{
 const f=storedCase(searchId),schema=advertisedArguments(f.contract.descriptor.inputSchema);assert.equal(schema.mode,'canonical');assert.deepEqual(schema.arguments.parse(f.arguments),f.arguments);
 for(const extra of [{asOf:f.normalizationContext.asOf},{normalizationContext:f.normalizationContext},{tenantId:f.authority.binding.tenantId},
  {subject:f.authority.subject},{[HEADER]:'forged'},{input:f.arguments}])assert.equal(schema.arguments.safeParse({...f.arguments,...extra}).success,false);
});

for(const branch of ['available','empty','unavailable'])test(`KB SDK semantic ${branch}: actual hook preserves original request, once-captured context, delivery and durable receipts`,async()=>{
 const request={query:'  policy  ',clientId,kind:'client_doc_chunk',limit:2.5},f=await mounted(searchId,{scene:storedCase(searchId,{request}),pageOptions:{empty:branch==='empty',unavailable:branch==='unavailable'}}),m=await mountReads(f,{port:f.port});assert.notEqual(m,null);
 try{
  const toolUseId=`kb_${branch}`,deliveryId='sdk:'+hash({binding:f.binding,sessionId:SESSION,toolUseId});assert.deepEqual((await m.client.listTools()).tools.map(tool=>tool.name),[searchId]);
  f.core.state.beforeResponse=()=>f.state.now++;
  const result=await m.call(searchId,request,{toolUseId});assert.equal(result.isError,undefined);assert.equal(result.denied,undefined);
  const raw=result.content[0].text,out=JSON.parse(raw),[observation]=f.state.observations,normalized=f.contract.normalizeInput(request,observation.context);
  assert.deepEqual(f.calls,[{operation:f.operation,arguments:request,deliveryId}]);assert.deepEqual(f.wire[0].body,request);assert.equal(f.wire.length,1);
  assert.equal(f.wire[0].url,`https://native-core.example.invalid/api/clio/tools/${searchId}`);assert.equal(observation.requestSha256,hash(request));assert.deepEqual(observation.operation,f.operation);
  assert.equal(normalized.input.query,'policy');assert.equal(normalized.input.limit,2.5);assert.equal(normalized.input.clientId,request.clientId);
  assert.equal(out.result.generatedAt,observation.context.asOf);assert.ok(Date.parse(observation.context.asOf)<f.now(),'the retained anchor survives later current-authority clock observations');assert.deepEqual(out.result,f.state.nativeValue);assert.deepEqual(f.stateOwner.secretProof.normalizationContext,observation.context);
  assert.equal(out.result.query,'policy');assert.equal(out.result.clientId,request.clientId);assert.deepEqual(out.binding,f.binding);assert.deepEqual(out.subject,f.authority.subject);assert.deepEqual(out.operation,f.operation);assert.equal(out.argumentsSha256,normalized.argumentsSha256);
  if(branch==='available')assert.equal(out.result.results.length,1);else assert.deepEqual(out.result.results,[]);
  if(branch==='unavailable')assert.match(out.result.note,/temporarily unavailable/u);
  const [receipt]=m.runtime.receipts();assert.equal(m.runtime.receipts().length,1);assert.equal(receipt.deliveryId,deliveryId);assert.deepEqual(receipt.operation,f.operation);assert.equal(receipt.argumentsSha256,hash(request));assert.equal(receipt.resultSha256,hash(out));assert.equal(receipt.decisionId,out.subject.authorizationDecisionId);assert.equal(receipt.policyRevision,f.policyRevision);
  const [reservation]=f.state.reservations.values(),[produced]=f.state.produced.values();assert.equal(reservation.state,'SETTLED');assert.equal(reservation.charged_micro_usd,1);assert.equal(reservation.output_bytes,Buffer.byteLength(raw));assert.equal(produced.completion.resultSha256,hash(out));
 }finally{await m.close();f.scope.abort();}
});

test('KB SDK: personal graph remains available with empty context and no semantic carrier or client tool',async()=>{
 const f=await mounted(graphId),m=await mountReads(f,{port:f.port});assert.notEqual(m,null);
 try{
  assert.equal(f.scopes.some(scope=>scope.kind==='client'),false);assert.deepEqual((await m.client.listTools()).tools.map(tool=>tool.name),[graphId]);
  const result=await m.call(graphId,f.request);assert.equal(result.isError,undefined);const raw=result.content[0].text,out=JSON.parse(raw);
  assert.deepEqual(out.result,f.page);assert.deepEqual(f.stateOwner.secretProof.normalizationContext,{});assert.equal(f.wire[0].options.headers[HEADER],undefined);assert.equal(f.state.observations,undefined);
  assert.equal(m.runtime.receipts()[0].resultSha256,hash(out));assert.equal([...f.state.reservations.values()][0].output_bytes,Buffer.byteLength(raw));
 }finally{await m.close();f.scope.abort();}
});

test('KB SDK: personal task cannot acquire semantic client access from installed and discovered inventories',async()=>{
 const scene=storedCase(searchId),a=scene.authority,scope={tenantId:a.binding.tenantId,kind:'private-user',resourceId:a.binding.actorId,policyRevision:a.policyRevision};
 Object.assign(a.subject,{kind:'personal',entityType:'user',entityIds:[a.binding.actorId],scopes:[scope]});a.claims.scopes=[scope];a.decision.scopes=[scope];scene.visibleClientIds=[];
 const f=await mounted(searchId,{scene});try{assert.equal(await mountReads(f,{port:f.port}),null);assert.equal(f.calls.length,0);noSource(f);}finally{f.scope.abort();}
});

for(const mode of ['foreign-client','invisible-client','revoked-task','native-principal'])test(`KB SDK semantic ${mode}: current authority refuses before source credentials and reservation`,async()=>{
 const f=await mounted(),m=await mountReads(f,{port:f.port});assert.notEqual(m,null);
 try{
  if(mode==='invisible-client')f.core.state.clientIds=[];
  if(mode==='revoked-task')f.state.grant.state='REVOKED';
  if(mode==='native-principal')f.core.state.principal={...f.core.principal,actorId:foreign};
  const result=await m.call(searchId,mode==='foreign-client'?{...f.request,clientId:foreign}:f.request);assert.equal(result.isError,true);
  // The durable task verifier's thrown error is deliberately projected to a closed internal failure by MCP.
  assert.match(result.content[0].text,mode==='revoked-task'?/^INTERNAL_ERROR:/u:/^ACCESS_DENIED:/u);assert.deepEqual(m.runtime.receipts(),[]);noSource(f);
  if(['foreign-client','revoked-task'].includes(mode))assert.equal(f.stateOwner.nativeCredentials,0);
 }finally{await m.close();f.scope.abort();}
});

test('KB SDK semantic: missing current installation, discovery, exact measurement, source or policy creates no tool',async()=>{
 const f=await mounted();try{
  f.state.installRevoked=true;assert.equal(await mountReads(f,{port:f.port}),null);f.state.installRevoked=false;
  f.state.discoveryMutator=row=>row.operations=[];assert.equal(await mountReads(f,{port:f.port}),null);f.state.discoveryMutator=undefined;
  f.state.installationMutator=row=>row.operations[0].handlerSourceSha256='e'.repeat(64);assert.equal(await mountReads(f,{port:f.port}),null);f.state.installationMutator=undefined;
  assert.equal(await mountReads(f,{port:f.port,policy:{generalReads:false}}),null);assert.equal(await mountReads(f,{port:f.port,policy:{generalReads:true,readFamilies:['mail']}}),null);
  assert.equal(await mountReads(f,{port:f.mount({sourceEnabled:false})}),null);assert.equal(f.calls.length,0);noSource(f);
 }finally{f.scope.abort();}
});

for(const gate of ['installation','discovery'])test(`KB SDK semantic: current ${gate} removal after listing refuses before gateway execution`,async()=>{
 const f=await mounted(),m=await mountReads(f,{port:f.port});assert.notEqual(m,null);
 try{
  if(gate==='installation')f.state.installRevoked=true;else f.state.discoveryMutator=row=>row.operations=[];
  const result=await m.call(searchId,f.request);assert.equal(result.isError,true);assert.match(result.content[0].text,/^UNAVAILABLE:/u);assert.deepEqual(m.runtime.receipts(),[]);assert.equal(f.calls.length,0);noSource(f);
 }finally{await m.close();f.scope.abort();}
});

for(const phase of ['before-credential','after-source'])test(`KB SDK semantic: native membership revision changes ${phase} leave UNKNOWN without result or retry`,async()=>{
 const f=await mounted(),m=await mountReads(f,{port:f.port});assert.notEqual(m,null);
 try{
  const revoke=()=>f.core.state.membershipRevision='e'.repeat(64);
  if(phase==='before-credential')f.stateOwner.beforeSecret=revoke;else f.state.afterSource=revoke;
  const result=await m.call(searchId,f.request);assert.equal(result.isError,true);assert.match(result.content[0].text,phase==='before-credential'?/^INVALID_RESULT:/u:/^ACCESS_DENIED:/u);assert.deepEqual(m.runtime.receipts(),[]);
  assert.equal(f.calls.length,1);assert.equal(f.wire.length,phase==='before-credential'?0:1);unknown(f);
 }finally{await m.close();f.scope.abort();}
});

test('KB SDK semantic: a source timestamp substitution cannot settle or release model bytes',async()=>{
 const f=await mounted(),m=await mountReads(f,{port:f.port});assert.notEqual(m,null);
 try{
  f.state.resultMutator=value=>value.generatedAt=new Date(Date.parse(value.generatedAt)+1).toISOString();
  const result=await m.call(searchId,f.request);assert.equal(result.isError,true);assert.match(result.content[0].text,/^INVALID_RESULT:/u);assert.deepEqual(m.runtime.receipts(),[]);assert.equal(f.wire.length,1);unknown(f);
 }finally{await m.close();f.scope.abort();}
});

test('KB SDK semantic: invocation token and original raw arguments are required before source execution',async()=>{
 const f=await mounted(),m=await mountReads(f,{port:f.port});assert.notEqual(m,null);
 try{
  const direct=await m.client.callTool({name:searchId,arguments:{arguments:f.request}});assert.equal(direct.isError,true);assert.match(direct.content[0].text,/^ACCESS_DENIED:/u);
  const decision=await m.hook({hook_event_name:'PreToolUse',session_id:SESSION,tool_name:`mcp__meri_reads__${searchId}`,tool_use_id:'kb_substitution',tool_input:{arguments:f.request}},undefined,{signal:new AbortController().signal});
  const result=await m.client.callTool({name:searchId,arguments:{...decision.hookSpecificOutput.updatedInput,arguments:{...f.request,query:f.request.query.trim()}}});
  assert.equal(result.isError,true);assert.match(result.content[0].text,/^ACCESS_DENIED:/u);assert.deepEqual(m.runtime.receipts(),[]);assert.equal(f.calls.length,0);noSource(f);
 }finally{await m.close();f.scope.abort();}
});
