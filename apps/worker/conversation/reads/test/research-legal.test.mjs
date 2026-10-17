/** Actual MCP/CONTROL/gateway/task owners with synthetic fixed native HTTP and legal source DTOs. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {storedCase} from '../../../../gateway/sources/research-legal-legislation/test/fixture.mjs';
import {createGeneralReadFamilyHandlers} from '../../../../gateway/general-reads/integration.mjs';
import {createControlGeneralReadRuntime} from '../../../../runtime/general-read-runtime.mjs';
import {ownerFixture,uuid} from '../../../../runtime/native-authority/native-read-credentials/test/fixture.mjs';
import {familyReads,resolveAvailableReads} from '../availability.mjs';
import {READ_FAMILIES,READ_FAMILY_IDS} from '../families.mjs';
import {advertisedArguments} from '../schema.mjs';
import {mountReads,SESSION} from './fixture.mjs';

const family='research-legal-legislation',id='search_legislative_research',held='get_legal_reference',clientId=uuid('d'),foreign=uuid('e');
const operation={id,version:'0.2.0'},sibling={id:held,version:'0.2.0'},name='Synthetic Research Client',referencePath='/api/clio/clients/check-ref';
const requests={global:{sessionKey:'2026',query:'water'},client:{sessionKey:'2026',query:'water',clientId,folderId:'synthetic-folder'},
 named:{sessionKey:'2026',query:'water',clientId:`  ${name}  `,folderId:'synthetic-folder'}};
function sceneFor(branch='global'){
 const request=requests[branch];return storedCase(id,{request,...(branch==='named'?{context:{clientResolution:{reference:name,clientId},citationResolution:null}}:{})});
}
async function mounted({branch='global',scene=sceneFor(branch)}={}){
 const f=await ownerFixture(id,{scene}),{getCredentials,credentialsForCall,authorizeResultForCall,...transport}=f.transport;
 f.state.referenceResult={ok:true,clientId};f.core.state.response=(value,path)=>Response.json(path===referencePath?f.state.referenceResult:value,{status:path===referencePath?201:200});
 const handlers=await createGeneralReadFamilyHandlers({families:{[family]:{...transport,credentialsForCall:f.owner.credentialsForCall}},now:f.now,newId:randomUUID});
 const {installationOwner,...gateway}=f.gatewayConfiguration,original=gateway.authority;
 const fixtureAuthority={...original,check(call){
  // Compatibility for the borrowed fixture's UUID-only business selector, not a production resolver.
  // Delegate its full current owner using the already-bound task UUID for this exact raw legal name.
  if(call.descriptor.operation.id===id&&call.descriptor.operation.version==='0.2.0'&&f.request.clientId===requests.named.clientId&&call.input?.clientId===f.request.clientId){
   f.state.fixtureNameCompatibilityCalls=(f.state.fixtureNameCompatibilityCalls??0)+1;
   return original.check({...call,input:{...call.input,clientId:f.authority.subject.entityIds[0]}});
  }
  return original.check(call);
 }};
 const nativePort=createControlGeneralReadRuntime({...gateway,authority:fixtureAuthority,handlers,scopes:f.scopes,readCurrentInstallation:({signal})=>installationOwner.readCurrent({signal}),nativeReadContextPorts:f.owner.nativeReadContextPorts});
 const calls=[],port={readAvailability:options=>nativePort.readAvailability(options),execute(call){calls.push({operation:call.operation,arguments:call.arguments,deliveryId:call.deliveryId});return nativePort.execute(call);}};
 return {...f,port,calls,referenceCalls:()=>f.core.state.calls.filter(call=>call.path===referencePath)};
}
function noSource(f){assert.equal(f.wire.length,0);assert.equal(f.stateOwner.secrets,0);assert.equal(f.state.reservations.size,0);assert.equal(f.state.budget.consumed_micro_usd,0);}
function unknown(f){const [r]=f.state.reservations.values();assert.equal(r.state,'UNKNOWN');assert.equal(r.hold_micro_usd,1);assert.equal(r.output_bytes,null);assert.equal(r.charged_micro_usd,null);assert.equal(f.state.budget.consumed_micro_usd,0);assert.equal([...f.state.produced.values()][0].completion,null);}

test('legal SDK76/42: optional public search is the only exposed family operation despite forged sibling inventories',()=>{
 assert.equal(familyReads().length,76);assert.equal(READ_FAMILY_IDS.length,42);assert.equal(READ_FAMILIES[family].clientScope,'optional');assert.deepEqual(READ_FAMILIES[family].operationIds,[id]);
 assert.deepEqual(familyReads().filter(row=>row.family===family).map(row=>row.operation),[operation]);
 for(const scopes of [[{kind:'private-user'}],[{kind:'client'}]]){
  const result=resolveAvailableReads({policy:{generalReads:true,readFamilies:[family]},installation:{operations:[operation,sibling]},discovery:{operations:[sibling,operation]},scopes});
  assert.deepEqual(result.available.map(row=>row.operation),[operation]);
 }
 assert.equal(familyReads().some(row=>row.operation.id===held),false);
});

test('legal SDK: literal search schema admits no model resolution, current authority or nested request',()=>{
 const f=sceneFor(),schema=advertisedArguments(f.contract.descriptor.inputSchema);assert.equal(schema.mode,'canonical');assert.deepEqual(schema.arguments.parse(f.arguments),f.arguments);
 for(const extra of [{normalizationContext:f.normalizationContext},{clientResolution:{reference:name,clientId}},{citationResolution:null},{tenantId:f.authority.binding.tenantId},{input:f.arguments}])assert.equal(schema.arguments.safeParse({...f.arguments,...extra}).success,false);
});

for(const branch of ['global','client','named'])test(`legal SDK ${branch}: actual hook preserves raw selectors, admitted context, source results and durable receipts`,async()=>{
 const f=await mounted({branch}),m=await mountReads(f,{port:f.port});assert.notEqual(m,null);
 try{
  assert.deepEqual((await m.client.listTools()).tools.map(tool=>tool.name),[id]);assert.equal(f.scopes.some(scope=>scope.kind==='client'),branch!=='global');
  const toolUseId=`legal_${branch}`,deliveryId='sdk:'+hash({binding:f.binding,sessionId:SESSION,toolUseId}),result=await m.call(id,f.request,{toolUseId});assert.equal(result.isError,undefined);assert.equal(result.denied,undefined);
  const raw=result.content[0].text,out=JSON.parse(raw),context=f.stateOwner.secretProof.normalizationContext;
  assert.deepEqual(out.result,f.state.nativeValue);assert.deepEqual(out.result,f.page);assert.deepEqual(out.binding,f.binding);assert.deepEqual(out.subject,f.authority.subject);assert.deepEqual(out.operation,operation);
  assert.deepEqual(f.calls,[{operation,arguments:f.request,deliveryId}]);assert.equal(f.wire.length,1);assert.equal(f.wire[0].url,`https://native-core.example.invalid/api/clio/tools/${id}`);
  assert.deepEqual(f.wire[0].body,branch==='named'?{...f.request,clientId}:f.request);assert.equal(f.stateOwner.secretProof.requestSha256,hash(f.request));assert.equal(out.argumentsSha256,f.contract.normalizeInput(f.request,context).argumentsSha256);
  assert.deepEqual(context,{clientResolution:branch==='global'?null:{reference:branch==='named'?name:clientId,clientId},citationResolution:null});
  if(branch==='named'){assert.ok(f.referenceCalls().length>=3);for(const call of f.referenceCalls())assert.deepEqual(call.body,{ref:name});assert.ok(f.state.fixtureNameCompatibilityCalls>0);}
  else{assert.equal(f.referenceCalls().length,0);assert.equal(f.state.fixtureNameCompatibilityCalls??0,0);}
  const [receipt]=m.runtime.receipts(),[reservation]=f.state.reservations.values(),[produced]=f.state.produced.values();assert.equal(m.runtime.receipts().length,1);assert.equal(receipt.deliveryId,deliveryId);assert.equal(receipt.argumentsSha256,hash(f.request));assert.equal(receipt.resultSha256,hash(out));assert.equal(receipt.decisionId,out.subject.authorizationDecisionId);assert.equal(receipt.policyRevision,f.policyRevision);
  assert.equal(reservation.state,'SETTLED');assert.equal(reservation.output_bytes,Buffer.byteLength(raw));assert.equal(reservation.charged_micro_usd,1);assert.equal(produced.completion.resultSha256,hash(out));
 }finally{await m.close();f.scope.abort();}
});

test('legal SDK: a constructor may hold both private handlers while overclaimed snapshots still mount search alone',async()=>{
 const f=await mounted(),port={execute:call=>f.port.execute(call),async readAvailability(options){const snapshot=await f.port.readAvailability(options);return {...snapshot,installation:{...snapshot.installation,operations:[operation,sibling]},discovery:{...snapshot.discovery,operations:[operation,sibling]}};}},m=await mountReads(f,{port});assert.notEqual(m,null);
 try{assert.deepEqual([...f.handlers.keys()].sort(),[`${held}@0.2.0`,`${id}@0.2.0`].sort());assert.deepEqual((await m.client.listTools()).tools.map(tool=>tool.name),[id]);assert.equal(m.runtime.available.some(row=>row.id===held),false);noSource(f);}
 finally{await m.close();f.scope.abort();}
});

for(const denial of ['ambiguous','hidden','foreign'])test(`legal SDK named ${denial}: actual native reference cannot widen the current client grant`,async()=>{
 const f=await mounted({branch:'named'}),m=await mountReads(f,{port:f.port});assert.notEqual(m,null);
 try{
  f.state.referenceResult=denial==='foreign'?{ok:true,clientId:foreign}:{ok:false,reason:`SYNTHETIC_${denial}`};
  const result=await m.call(id,f.request);assert.equal(result.isError,true);assert.match(result.content[0].text,denial==='foreign'?/^ACCESS_DENIED:/u:/^UNAVAILABLE:/u);assert.equal(result.content[0].text.includes('SYNTHETIC_'),false);assert.deepEqual(m.runtime.receipts(),[]);assert.ok(f.referenceCalls().length>0);noSource(f);
 }finally{await m.close();f.scope.abort();}
});

test('legal SDK: UUID selection and native visibility remain bounded by the actual current task client',async()=>{
 for(const denial of ['foreign-request','invisible']){
  const f=await mounted({branch:'client'}),m=await mountReads(f,{port:f.port});assert.notEqual(m,null);
  try{if(denial==='invisible')f.core.state.clientIds=[];const result=await m.call(id,denial==='foreign-request'?{...f.request,clientId:foreign}:f.request);assert.equal(result.isError,true);assert.match(result.content[0].text,/^ACCESS_DENIED:/u);assert.deepEqual(m.runtime.receipts(),[]);noSource(f);}
  finally{await m.close();f.scope.abort();}
 }
});

test('legal SDK: native folder/client refusal remains a failed call with UNKNOWN and no fabricated legal result',async()=>{
 const f=await mounted({branch:'named'}),m=await mountReads(f,{port:f.port});assert.notEqual(m,null);
 try{
  // Source-owned folder admission is delegated. This tests error receiving, not a replacement folder policy.
  f.state.responseFactory=()=>Response.json({message:'RESEARCH_FOLDER_CLIENT_MISMATCH'},{status:404});
  const result=await m.call(id,f.request);assert.equal(result.isError,true);assert.match(result.content[0].text,/^INVALID_RESULT:/u);assert.equal(result.content[0].text.includes('RESEARCH_FOLDER_CLIENT_MISMATCH'),false);assert.deepEqual(m.runtime.receipts(),[]);assert.deepEqual(f.wire[0].body,{...f.request,clientId});assert.equal(f.wire.length,1);assert.equal(f.calls.length,1);unknown(f);
 }finally{await m.close();f.scope.abort();}
});

test('legal SDK: source scope substitution cannot settle or release whole-result bytes',async()=>{
 const f=await mounted({branch:'client'}),m=await mountReads(f,{port:f.port});assert.notEqual(m,null);
 try{f.state.resultMutator=page=>page.result.scope.clientId=foreign;const result=await m.call(id,f.request);assert.equal(result.isError,true);assert.match(result.content[0].text,/^INVALID_RESULT:/u);assert.deepEqual(m.runtime.receipts(),[]);assert.equal(f.wire.length,1);unknown(f);}
 finally{await m.close();f.scope.abort();}
});

test('legal SDK: current installation, discovery, measured source and family policy remain separate gates',async()=>{
 const f=await mounted();try{
  f.state.installRevoked=true;assert.equal(await mountReads(f,{port:f.port}),null);f.state.installRevoked=false;
  f.state.discoveryMutator=row=>row.operations=[];assert.equal(await mountReads(f,{port:f.port}),null);f.state.discoveryMutator=undefined;
  f.state.installationMutator=row=>row.operations[0].handlerSourceSha256='e'.repeat(64);assert.equal(await mountReads(f,{port:f.port}),null);f.state.installationMutator=undefined;
  assert.equal(await mountReads(f,{port:f.port,policy:{generalReads:false}}),null);assert.equal(await mountReads(f,{port:f.port,policy:{generalReads:true,readFamilies:['mail']}}),null);assert.equal(await mountReads(f,{port:f.mount({sourceEnabled:false})}),null);assert.equal(f.calls.length,0);noSource(f);
 }finally{f.scope.abort();}
});

test('legal SDK: current task, capability and native principal are checked before source credentials',async()=>{
 for(const denial of ['task','capability','principal']){
  const f=await mounted(),m=await mountReads(f,{port:f.port});assert.notEqual(m,null);
  try{if(denial==='task')f.state.grant.state='REVOKED';if(denial==='capability')f.state.revoked=true;if(denial==='principal')f.core.state.principal={...f.core.principal,actorId:foreign};
   const result=await m.call(id,f.request);assert.equal(result.isError,true);assert.match(result.content[0].text,denial==='task'?/^INTERNAL_ERROR:/u:/^ACCESS_DENIED:/u);assert.deepEqual(m.runtime.receipts(),[]);noSource(f);
  }finally{await m.close();f.scope.abort();}
 }
});

for(const denial of ['membership','task','reference'])test(`legal SDK named ${denial} change after source releases no bytes and keeps UNKNOWN`,async()=>{
 const f=await mounted({branch:'named'}),m=await mountReads(f,{port:f.port});assert.notEqual(m,null);
 try{f.state.afterSource=()=>{if(denial==='membership')f.core.state.membershipRevision='e'.repeat(64);else if(denial==='task')f.state.grant.state='REVOKED';else f.state.referenceResult={ok:true,clientId:foreign};};
  const result=await m.call(id,f.request);assert.equal(result.isError,true);assert.deepEqual(m.runtime.receipts(),[]);assert.equal(f.wire.length,1);assert.equal(f.calls.length,1);unknown(f);
 }finally{await m.close();f.scope.abort();}
});

test('legal SDK: invocation proof binds the original query and folder before a source call',async()=>{
 const f=await mounted({branch:'client'}),m=await mountReads(f,{port:f.port});assert.notEqual(m,null);
 try{
  const decision=await m.hook({hook_event_name:'PreToolUse',session_id:SESSION,tool_name:`mcp__meri_reads__${id}`,tool_use_id:'legal_substitution',tool_input:{arguments:f.request}},undefined,{signal:new AbortController().signal});
  const result=await m.client.callTool({name:id,arguments:{...decision.hookSpecificOutput.updatedInput,arguments:{...f.request,folderId:'foreign-folder'}}});
  assert.equal(result.isError,true);assert.match(result.content[0].text,/^ACCESS_DENIED:/u);assert.deepEqual(m.runtime.receipts(),[]);assert.equal(f.calls.length,0);noSource(f);
 }finally{await m.close();f.scope.abort();}
});
