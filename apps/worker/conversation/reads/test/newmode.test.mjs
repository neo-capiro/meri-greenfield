/** Actual SDK/MCP and CONTROL/native owners over synthetic mode/source HTTP; no production Core qualification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {MODE_READ_OPERATIONS,decodeNativeReadObservation,NATIVE_READ_OBSERVATION_HEADER as HEADER} from '../../../../../packages/contracts/native-read-observation-0.2/validate.mjs';
import {storedCase as publicCase} from '../../../../gateway/sources/public-data/test/fixture.mjs';
import {storedCase as programCase} from '../../../../gateway/sources/program-elements/test/fixture.mjs';
import {createGeneralReadFamilyHandlers} from '../../../../gateway/general-reads/integration.mjs';
import {createControlGeneralReadRuntime} from '../../../../runtime/general-read-runtime.mjs';
import {ownerFixture} from '../../../../runtime/native-authority/native-read-credentials/test/fixture.mjs';
import {familyReads,resolveAvailableReads} from '../availability.mjs';
import {READ_FAMILIES,READ_FAMILY_IDS} from '../families.mjs';
import {advertisedArguments} from '../schema.mjs';
import {mountReads,SESSION} from './fixture.mjs';

const families={'public-data':['query_economic_data','search_federal_grants','search_federal_awards'],'program-elements':['search_program_elements','get_program_element','get_pe_budget_timeline']};
const familyOf=id=>resolveOperationContract({id,version:'0.2.0'}).binding.group;
const sceneFor=(id,mode='off')=>(familyOf(id)==='public-data'?publicCase:programCase)(id,{evidenceAccuracyMode:mode});
function personal(scene){const a=scene.authority,scope={tenantId:a.binding.tenantId,kind:'private-user',resourceId:a.binding.actorId,policyRevision:a.policyRevision};Object.assign(a.subject,{kind:'personal',entityType:'user',entityIds:[a.binding.actorId],scopes:[scope]});a.claims.scopes=[scope];a.decision.scopes=[scope];return scene;}
async function mounted(id,{mode='off',scene=sceneFor(id,mode)}={}){
 const family=familyOf(id),f=await ownerFixture(id,{scene});f.core.state.mode=mode;
 const {getCredentials,credentialsForCall,authorizeResultForCall,...transport}=f.transport,handlers=await createGeneralReadFamilyHandlers({families:{[family]:{...transport,credentialsForCall:f.owner.credentialsForCall}},now:f.now,newId:randomUUID});
 const {installationOwner,...gateway}=f.gatewayConfiguration,build=configuration=>createControlGeneralReadRuntime({...gateway,handlers,scopes:f.scopes,readCurrentInstallation:({signal})=>installationOwner.readCurrent({signal}),nativeReadContextPorts:f.owner.nativeReadContextPorts,...configuration});
 const nativePort=build(),calls=[],port={readAvailability:options=>nativePort.readAvailability(options),execute(call){calls.push({operation:call.operation,arguments:call.arguments,deliveryId:call.deliveryId});return nativePort.execute(call);}};
 return {...f,family,port,calls,build};
}
function noSource(f){assert.equal(f.wire.length,0);assert.equal(f.stateOwner.secrets,0);assert.equal(f.state.reservations.size,0);assert.equal(f.state.budget.consumed_micro_usd,0);}
function unknown(f){const [r]=f.state.reservations.values();assert.equal(r.state,'UNKNOWN');assert.equal(r.hold_micro_usd,1);assert.equal(r.output_bytes,null);assert.equal(r.charged_micro_usd,null);assert.equal(f.state.budget.consumed_micro_usd,0);assert.equal([...f.state.produced.values()][0].completion,null);}

test('mode SDK source policy derives76/42 and keeps public/program families optional with exact canonical operations',()=>{
 assert.equal(familyReads().length,76);assert.equal(READ_FAMILY_IDS.length,42);
 for(const [family,ids] of Object.entries(families)){
  assert.equal(READ_FAMILIES[family].clientScope,'optional');assert.deepEqual(familyReads().filter(row=>row.family===family).map(row=>row.operation.id).sort(),[...ids].sort());
  const operations=[...MODE_READ_OPERATIONS,'get_legal_reference','get_business_development_evidence'].map(id=>({id,version:'0.2.0'}));
  for(const scopes of [[],[{kind:'private-user'}],[{kind:'client'}]])assert.deepEqual(resolveAvailableReads({policy:{generalReads:true,readFamilies:[family]},installation:{operations},discovery:{operations},scopes}).available.map(row=>row.operation.id).sort(),ids.filter(id=>MODE_READ_OPERATIONS.includes(id)).sort());
 }
 for(const id of ['get_legal_reference','get_business_development_evidence'])assert.equal(familyReads().some(row=>row.operation.id===id),false);
 assert.throws(()=>familyReads({'public-data':{clientScope:'optional',operationIds:['search_program_elements']}}),/READ_FAMILY_CONFIGURATION/u);
 assert.throws(()=>familyReads({'program-elements':{clientScope:'optional',operationIds:['search_federal_grants']}}),/READ_FAMILY_CONFIGURATION/u);
});

for(const id of MODE_READ_OPERATIONS){
 test(`mode SDK ${id}: literal schema excludes caller mode, context, private carrier and authority`,()=>{
  const f=sceneFor(id),schema=advertisedArguments(f.contract.descriptor.inputSchema);assert.equal(schema.mode,'canonical');assert.deepEqual(schema.arguments.parse(f.arguments),f.arguments);
  for(const extra of [{evidenceAccuracyMode:'enforce'},{surface:'chat'},{normalizationContext:f.normalizationContext},{tenantId:f.authority.binding.tenantId},{[HEADER]:'forged'},{input:f.arguments}])assert.equal(schema.arguments.safeParse({...f.arguments,...extra}).success,false);
 });
 for(const mode of ['off','shadow','enforce'])test(`mode SDK ${id}/${mode}: actual hook/MCP preserves raw body, private mode and settled receipts`,async()=>{
  const f=await mounted(id,{mode}),m=await mountReads(f,{port:f.port});assert.notEqual(m,null);
  try{
   assert.deepEqual((await m.client.listTools()).tools.map(tool=>tool.name),[id]);const toolUseId=`mode_${id}_${mode}`,deliveryId='sdk:'+hash({binding:f.binding,sessionId:SESSION,toolUseId}),result=await m.call(id,f.request,{toolUseId});
   assert.equal(result.isError,undefined);assert.equal(result.denied,undefined);const raw=result.content[0].text,out=JSON.parse(raw),context={evidenceAccuracyMode:mode};
   assert.deepEqual(out.result,JSON.parse(JSON.stringify(f.page)));assert.deepEqual(out.result,f.state.nativeValue);assert.deepEqual(out.operation,f.operation);assert.deepEqual(out.binding,f.binding);assert.deepEqual(out.subject,f.authority.subject);
   assert.deepEqual(f.calls,[{operation:f.operation,arguments:f.request,deliveryId}]);assert.equal(f.wire.length,1);assert.deepEqual(f.wire[0].body,f.request);assert.equal(f.wire[0].url,`https://native-core.example.invalid/api/clio/tools/${id}`);
   const carrier=decodeNativeReadObservation(f.wire[0].options.headers[HEADER],{operation:f.operation,request:f.request});assert.deepEqual(carrier.context,context);assert.equal(carrier.requestSha256,hash(f.request));
   assert.deepEqual(f.stateOwner.secretProof.normalizationContext,context);assert.equal(f.stateOwner.secretProof.requestSha256,hash(f.request));assert.equal(out.argumentsSha256,f.contract.normalizeInput(f.request,context).argumentsSha256);assert.ok(f.stateOwner.modeSecrets>=3);
   for(const observation of f.core.state.calls.filter(row=>row.path.endsWith('/read-mode-observation'))){assert.deepEqual(observation.body,{operation:f.operation,requestSha256:hash(f.request)});assert.equal(observation.init.headers['x-internal-service-secret'],'SYNTHETIC_SERVICE');}
   const [receipt]=m.runtime.receipts(),[reservation]=f.state.reservations.values();assert.equal(m.runtime.receipts().length,1);assert.equal(receipt.deliveryId,deliveryId);assert.equal(receipt.argumentsSha256,hash(f.request));assert.equal(receipt.resultSha256,hash(out));assert.equal(receipt.policyRevision,f.policyRevision);assert.equal(receipt.decisionId,out.subject.authorizationDecisionId);
   assert.equal(reservation.state,'SETTLED');assert.equal(reservation.charged_micro_usd,1);assert.equal(reservation.output_bytes,Buffer.byteLength(raw));assert.equal([...f.state.produced.values()][0].completion.resultSha256,hash(out));
  }finally{await m.close();f.scope.abort();}
 });
 test(`mode SDK ${id}: an actual personal task retains native mode authority without an invented client grant`,async()=>{
  const f=await mounted(id,{scene:personal(sceneFor(id))}),m=await mountReads(f,{port:f.port});assert.notEqual(m,null);
  try{assert.equal(f.scopes.some(s=>s.kind==='client'),false);const result=await m.call(id,f.request);assert.equal(result.isError,undefined);assert.equal(f.wire.length,1);assert.equal(m.runtime.receipts().length,1);assert.equal([...f.state.reservations.values()][0].state,'SETTLED');}finally{await m.close();f.scope.abort();}
 });
 test(`mode SDK ${id}: missing current installation, discovery, source or family policy prevents mounting`,async()=>{
  const f=await mounted(id);try{
   f.state.installRevoked=true;assert.equal(await mountReads(f,{port:f.port}),null);f.state.installRevoked=false;
   f.state.discoveryMutator=row=>row.operations=[];assert.equal(await mountReads(f,{port:f.port}),null);f.state.discoveryMutator=undefined;
   f.state.installationMutator=row=>row.operations[0].handlerSourceSha256='e'.repeat(64);assert.equal(await mountReads(f,{port:f.port}),null);f.state.installationMutator=undefined;
   assert.equal(await mountReads(f,{port:f.build({sourceEnabled:false})}),null);assert.equal(await mountReads(f,{port:f.port,policy:{generalReads:false}}),null);
   assert.equal(await mountReads(f,{port:f.port,policy:{generalReads:true,readFamilies:[f.family==='public-data'?'program-elements':'public-data']}}),null);assert.equal(f.calls.length,0);noSource(f);
  }finally{f.scope.abort();}
 });
 test(`mode SDK ${id}: current availability revocation after listing denies before dispatch`,async()=>{
  for(const kind of ['installation','discovery']){const f=await mounted(id),m=await mountReads(f,{port:f.port});assert.notEqual(m,null);
   try{if(kind==='installation')f.state.installRevoked=true;else f.state.discoveryMutator=row=>row.operations=[];const out=await m.call(id,f.request);assert.equal(out.isError,true);assert.match(out.content[0].text,/^UNAVAILABLE:/u);assert.deepEqual(m.runtime.receipts(),[]);assert.equal(f.calls.length,0);noSource(f);}finally{await m.close();f.scope.abort();}
  }
 });
 test(`mode SDK ${id}: a mode change during source-secret acquisition prevents tool HTTP`,async()=>{
  const f=await mounted(id),m=await mountReads(f,{port:f.port});assert.notEqual(m,null);
  try{f.stateOwner.beforeSecret=()=>{f.core.state.mode='enforce';};const result=await m.call(id,f.request);assert.equal(result.isError,true);assert.match(result.content[0].text,/^INVALID_RESULT:/u);assert.equal(f.wire.length,0);assert.deepEqual(m.runtime.receipts(),[]);}finally{await m.close();f.scope.abort();}
 });
 test(`mode SDK ${id}: post-source mode drift withholds the whole output and retains UNKNOWN`,async()=>{
  const f=await mounted(id),m=await mountReads(f,{port:f.port});assert.notEqual(m,null);
  try{f.state.afterSource=()=>{f.core.state.mode='shadow';};const result=await m.call(id,f.request);assert.equal(result.isError,true);assert.match(result.content[0].text,/^ACCESS_DENIED:/u);assert.equal(f.wire.length,1);assert.deepEqual(m.runtime.receipts(),[]);unknown(f);}finally{await m.close();f.scope.abort();}
 });
}

test('mode SDK: invocation token and exact original argument hash reject direct or substituted calls before source',async()=>{
 const id=MODE_READ_OPERATIONS[0],f=await mounted(id),m=await mountReads(f,{port:f.port});assert.notEqual(m,null);
 try{
  const direct=await m.client.callTool({name:id,arguments:{arguments:f.request}});assert.equal(direct.isError,true);assert.match(direct.content[0].text,/^ACCESS_DENIED:/u);
  const decision=await m.hook({hook_event_name:'PreToolUse',session_id:SESSION,tool_name:`mcp__meri_reads__${id}`,tool_use_id:'mode_substitution',tool_input:{arguments:f.request}},undefined,{signal:new AbortController().signal});
  const changed=await m.client.callTool({name:id,arguments:{...decision.hookSpecificOutput.updatedInput,arguments:{...f.request,query:'different original query'}}});assert.equal(changed.isError,true);assert.match(changed.content[0].text,/^ACCESS_DENIED:/u);assert.deepEqual(m.runtime.receipts(),[]);assert.equal(f.calls.length,0);noSource(f);
 }finally{await m.close();f.scope.abort();}
});

test('mode SDK: canonical receiving does not let an off-mode source page masquerade as enforce',async()=>{
 const id=MODE_READ_OPERATIONS[0],f=await mounted(id,{mode:'enforce'}),m=await mountReads(f,{port:f.port});assert.notEqual(m,null);
 try{f.state.resultMutator=value=>{delete value.data[0].deadline;};const result=await m.call(id,f.request);assert.equal(result.isError,true);assert.match(result.content[0].text,/^INVALID_RESULT:/u);assert.deepEqual(m.runtime.receipts(),[]);assert.equal(f.wire.length,1);unknown(f);}finally{await m.close();f.scope.abort();}
});

test('mode SDK: the existing economic operation keeps its empty context and omits mode observation and carrier',async()=>{
 const id='query_economic_data',f=await mounted(id),m=await mountReads(f,{port:f.port});assert.notEqual(m,null);
 try{const result=await m.call(id,f.request);assert.equal(result.isError,undefined);assert.deepEqual(JSON.parse(result.content[0].text).result,JSON.parse(JSON.stringify(f.page)));assert.equal(f.stateOwner.modeSecrets,0);assert.equal(f.core.state.calls.some(row=>row.path.endsWith('/read-mode-observation')),false);assert.deepEqual(f.stateOwner.secretProof.normalizationContext,{});assert.equal(f.wire[0].options.headers[HEADER],undefined);assert.equal(m.runtime.receipts().length,1);assert.equal([...f.state.reservations.values()][0].state,'SETTLED');}finally{await m.close();f.scope.abort();}
});
