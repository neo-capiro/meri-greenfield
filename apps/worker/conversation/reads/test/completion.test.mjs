/** Actual MCP/CONTROL/gateway/task owners; scripted SQL, native check-ref HTTP and source DTOs only. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {storedCase as stateCase,ids as stateIds} from '../../../../gateway/sources/state-status-votes/test/fixture.mjs';
import {storedCase as trackedCase,id as trackedId,clientId as trackedClient} from '../../../../gateway/sources/tracked-bills/test/fixture.mjs';
import {storedCase as hearingCase,id as hearingId,clientId as hearingClient} from '../../../../gateway/sources/public-domain-hearings/test/fixture.mjs';
import {createGeneralReadFamilyHandlers} from '../../../../gateway/general-reads/integration.mjs';
import {createControlGeneralReadRuntime} from '../../../../runtime/general-read-runtime.mjs';
import {ownerFixture,uuid} from '../../../../runtime/native-authority/native-read-credentials/test/fixture.mjs';
import {familyReads,resolveAvailableReads} from '../availability.mjs';
import {READ_FAMILIES,READ_FAMILY_IDS} from '../families.mjs';
import {advertisedArguments} from '../schema.mjs';
import {mountReads,SESSION} from './fixture.mjs';

const ids=[...stateIds,trackedId,hearingId],foreign=uuid('e'),referencePath='/api/clio/clients/check-ref';
const families={'state-status-votes':stateIds,'tracked-bills':[trackedId],'public-domain-hearings':[hearingId]};
const absent=['get_business_development_evidence','get_certification_status','search_research_sources','get_state_rule_status','search_sam_opportunities'];
const reference='Synthetic Client';
function personal(scene){const a=scene.authority,scope={tenantId:a.binding.tenantId,kind:'private-user',resourceId:a.binding.actorId,policyRevision:a.policyRevision};Object.assign(a.subject,{kind:'personal',entityType:'user',entityIds:[a.binding.actorId],scopes:[scope]});a.claims.scopes=[scope];a.decision.scopes=[scope];return scene;}
function sceneFor(id,options={}){
 if(stateIds.includes(id))return stateCase(id,options);
 if(id===trackedId)return trackedCase(id,options);
 return hearingCase(id,options);
}
function namedScene(id,{asPersonal=false}={}){
 const request={clientId:`  ${reference}  `};
 const scene=id===trackedId?trackedCase(id,{request}):hearingCase(id,{request,context:{tenantId:uuid('b'),clientResolution:{reference,clientId:hearingClient}}});
 return asPersonal?personal(scene):scene;
}
async function mounted(id,{scene=sceneFor(id),park=false}={}){
 if(park)scene.transport={...scene.transport,async fetchImpl(url,options){
  scene.wire.push({url,options,body:JSON.parse(options.body)});scene.state.atSource?.();
  return new Promise((_,reject)=>options.signal.addEventListener('abort',()=>{scene.state.sourceAborted=true;reject(options.signal.reason);},{once:true}));
 }};
 const f=await ownerFixture(id,{scene}),{getCredentials,credentialsForCall,authorizeResultForCall,...transport}=f.transport;
 f.state.referenceResult={ok:true,clientId:id===trackedId?trackedClient:hearingClient};
 f.core.state.response=(value,path)=>Response.json(path===referencePath?f.state.referenceResult:value,{status:path===referencePath?201:200});
 const handlers=await createGeneralReadFamilyHandlers({families:{[f.family]:{...transport,credentialsForCall:f.owner.credentialsForCall}},now:f.now,newId:randomUUID});
 const {installationOwner,...gateway}=f.gatewayConfiguration,original=gateway.authority;
 const fixtureAuthority={...original,check(call){
  // The borrowed fixture's raw business selector guard knows UUIDs only. Delegate the complete
  // original authority check with the already-bound task UUID for this exact tracked-name input.
  // CONTROL separately resolves/rechecks that original name against native identity, visibility and task scope.
  if(id===trackedId&&call.descriptor.operation.id===trackedId&&call.descriptor.operation.version==='0.2.0'&&
   f.request.clientId.trim()===reference&&call.input?.clientId===f.request.clientId){
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
const expectedResult=f=>f.operation.id===trackedId?{binding:f.binding,subject:f.authority.subject,data:f.state.nativeValue}:f.state.nativeValue;

test('completion SDK76/42: the first four completed reads retain the frozen tracked client requirement',()=>{
 assert.equal(familyReads().length,76);assert.equal(READ_FAMILY_IDS.length,42);
 for(const [family,operations] of Object.entries(families)){
  const rows=familyReads().filter(row=>row.family===family);assert.deepEqual(rows.map(row=>row.operation.id),operations);assert.equal(READ_FAMILIES[family].operationIds,undefined);
  assert.equal(READ_FAMILIES[family].clientScope,family==='tracked-bills'?'required':'optional');
  const refs=rows.map(row=>row.operation),select=scopes=>resolveAvailableReads({policy:{generalReads:true,readFamilies:[family]},installation:{operations:refs},discovery:{operations:refs},scopes});
  assert.deepEqual(select([{kind:'client'}]).available.map(row=>row.operation),refs);
  assert.deepEqual(select([{kind:'private-user'}]).available.map(row=>row.operation),family==='tracked-bills'?[]:refs);
 }
 const operations=absent.map(id=>({id,version:'0.2.0'}));assert.equal(absent.length,5);
 assert.deepEqual(resolveAvailableReads({policy:{generalReads:true,readFamilies:READ_FAMILY_IDS},installation:{operations},discovery:{operations},scopes:[{kind:'client'}]}).available,[]);
 for(const id of absent)assert.equal(familyReads().some(row=>row.operation.id===id),false,id);
});

for(const id of ids){
 test(`completion SDK ${id}: canonical literal schema rejects model authority or normalization context`,()=>{
  const f=sceneFor(id),schema=advertisedArguments(f.contract.descriptor.inputSchema);assert.equal(schema.mode,'canonical');assert.deepEqual(schema.arguments.parse(f.arguments),f.arguments);
  for(const extra of [{normalizationContext:f.normalizationContext},{tenantId:f.authority.binding.tenantId},{subject:f.authority.subject},{input:f.arguments}])assert.equal(schema.arguments.safeParse({...f.arguments,...extra}).success,false);
 });
 test(`completion SDK ${id}: actual hook, source bytes, delivery hashes and durable receipts settle once`,async()=>{
  const f=await mounted(id),m=await mountReads(f,{port:f.port});assert.notEqual(m,null);
  try{
   const toolUseId=`completion_${ids.indexOf(id)}`,deliveryId='sdk:'+hash({binding:f.binding,sessionId:SESSION,toolUseId});assert.deepEqual((await m.client.listTools()).tools.map(tool=>tool.name),[id]);
   const result=await m.call(id,f.request,{toolUseId});assert.equal(result.isError,undefined);assert.equal(result.denied,undefined);
   const raw=result.content[0].text,out=JSON.parse(raw),context=f.stateOwner.secretProof.normalizationContext;
   assert.deepEqual(out.result,expectedResult(f));assert.deepEqual(out.binding,f.binding);assert.deepEqual(out.subject,f.authority.subject);assert.deepEqual(out.operation,f.operation);
   assert.equal(out.argumentsSha256,f.contract.normalizeInput(f.request,context).argumentsSha256);assert.equal(f.stateOwner.secretProof.requestSha256,hash(f.request));
   assert.deepEqual(f.calls,[{operation:f.operation,arguments:f.request,deliveryId}]);assert.deepEqual(f.wire[0].body,f.request);assert.equal(f.wire.length,1);assert.equal(f.wire[0].url,`https://native-core.example.invalid/api/clio/tools/${id}`);assert.equal(f.referenceCalls().length,0);
   if(id===trackedId){assert.deepEqual(Object.keys(context).sort(),['binding','clientReference','subject']);assert.deepEqual(context.binding,out.binding);assert.deepEqual(context.subject,out.subject);}
   else assert.deepEqual(context,id===hearingId?{tenantId:f.binding.tenantId,clientResolution:null}:{});
   const [receipt]=m.runtime.receipts(),[reservation]=f.state.reservations.values(),[produced]=f.state.produced.values();assert.equal(m.runtime.receipts().length,1);assert.equal(receipt.deliveryId,deliveryId);assert.equal(receipt.argumentsSha256,hash(f.request));assert.equal(receipt.resultSha256,hash(out));assert.equal(receipt.decisionId,out.subject.authorizationDecisionId);assert.equal(receipt.policyRevision,f.policyRevision);
   assert.equal(reservation.state,'SETTLED');assert.equal(reservation.output_bytes,Buffer.byteLength(raw));assert.equal(reservation.charged_micro_usd,1);assert.equal(produced.completion.resultSha256,hash(out));
  }finally{await m.close();f.scope.abort();}
 });
 test(`completion SDK ${id}: current installation, discovery, source and policy remain required`,async()=>{
  const f=await mounted(id);try{
   f.state.installRevoked=true;assert.equal(await mountReads(f,{port:f.port}),null);f.state.installRevoked=false;
   f.state.discoveryMutator=row=>row.operations=[];assert.equal(await mountReads(f,{port:f.port}),null);f.state.discoveryMutator=undefined;
   f.state.installationMutator=row=>row.operations[0].handlerSourceSha256='e'.repeat(64);assert.equal(await mountReads(f,{port:f.port}),null);f.state.installationMutator=undefined;
   assert.equal(await mountReads(f,{port:f.port,policy:{generalReads:false}}),null);assert.equal(await mountReads(f,{port:f.port,policy:{generalReads:true,readFamilies:['mail']}}),null);
   assert.equal(await mountReads(f,{port:f.mount({sourceEnabled:false})}),null);assert.equal(f.calls.length,0);noSource(f);
  }finally{f.scope.abort();}
 });
 test(`completion SDK ${id}: current task, capability and native principal are required before source credentials`,async()=>{
  for(const denial of ['task','capability','principal']){
   const f=await mounted(id),m=await mountReads(f,{port:f.port});assert.notEqual(m,null);try{
    if(denial==='task')f.state.grant.state='REVOKED';if(denial==='capability')f.state.revoked=true;if(denial==='principal')f.core.state.principal={...f.core.principal,actorId:foreign};
    const result=await m.call(id,f.request);assert.equal(result.isError,true);assert.match(result.content[0].text,denial==='task'?/^INTERNAL_ERROR:/u:/^ACCESS_DENIED:/u);assert.deepEqual(m.runtime.receipts(),[]);noSource(f);
    if(denial!=='principal')assert.equal(f.stateOwner.nativeCredentials,0);
   }finally{await m.close();f.scope.abort();}
  }
 });
 test(`completion SDK ${id}: current availability removal after listing prevents gateway execution`,async()=>{
  for(const gate of ['installation','discovery']){
   const f=await mounted(id),m=await mountReads(f,{port:f.port});assert.notEqual(m,null);try{
    if(gate==='installation')f.state.installRevoked=true;else f.state.discoveryMutator=row=>row.operations=[];
    const result=await m.call(id,f.request);assert.equal(result.isError,true);assert.match(result.content[0].text,/^UNAVAILABLE:/u);assert.deepEqual(m.runtime.receipts(),[]);assert.equal(f.calls.length,0);noSource(f);
   }finally{await m.close();f.scope.abort();}
  }
 });
 test(`completion SDK ${id}: native revision drift after source preserves UNKNOWN and withholds bytes and receipts`,async()=>{
  const f=await mounted(id),m=await mountReads(f,{port:f.port});assert.notEqual(m,null);try{
   f.state.afterSource=()=>f.core.state.membershipRevision='e'.repeat(64);
   const result=await m.call(id,f.request);assert.equal(result.isError,true);assert.match(result.content[0].text,/^ACCESS_DENIED:/u);assert.deepEqual(m.runtime.receipts(),[]);assert.equal(f.wire.length,1);assert.equal(f.calls.length,1);unknown(f);
  }finally{await m.close();f.scope.abort();}
 });
 test(`completion SDK ${id}: uncertain source response cannot settle, retry or fall back`,async()=>{
  const f=await mounted(id),m=await mountReads(f,{port:f.port});assert.notEqual(m,null);try{
   f.state.responseFactory=()=>{throw Error('SYNTHETIC_NATIVE_CONNECTION_UNCERTAIN');};
   const result=await m.call(id,f.request);assert.equal(result.isError,true);assert.match(result.content[0].text,/^INVALID_RESULT:/u);assert.deepEqual(m.runtime.receipts(),[]);assert.equal(f.wire.length,1);assert.equal(f.calls.length,1);unknown(f);
  }finally{await m.close();f.scope.abort();}
 });
}

for(const id of stateIds)for(const nativeOutcome of ['not-configured','quota','provider-error'])test(`completion SDK ${id}: native designation ${nativeOutcome} remains an honest received result`,async()=>{
 const scene=stateCase(id,{request:{billId:'TX HB 1234',...(id==='search_state_floor_votes'?{limit:2}:{})},nativeOutcome}),f=await mounted(id,{scene}),m=await mountReads(f,{port:f.port});assert.notEqual(m,null);
 try{const result=await m.call(id,f.request);assert.equal(result.isError,undefined);const out=JSON.parse(result.content[0].text);assert.deepEqual(out.result,f.page);assert.deepEqual(f.wire[0].body,f.request);assert.equal(f.referenceCalls().length,0);assert.equal(m.runtime.receipts().length,1);assert.equal([...f.state.reservations.values()][0].state,'SETTLED');}
 finally{await m.close();f.scope.abort();}
});

test('completion SDK tracked: a personal task never gains a tracked client grant from operation inventories',async()=>{
 const f=await mounted(trackedId,{scene:personal(trackedCase())});try{assert.equal(await mountReads(f,{port:f.port}),null);assert.equal(f.calls.length,0);noSource(f);}finally{f.scope.abort();}
});

for(const id of [trackedId,hearingId])test(`completion SDK ${id}: a selected UUID needs the matching current task and native client visibility`,async()=>{
 for(const mode of ['foreign','invisible']){
  const scene=id===trackedId?trackedCase():hearingCase(id,{request:{clientId:hearingClient}}),f=await mounted(id,{scene}),m=await mountReads(f,{port:f.port});assert.notEqual(m,null);
  try{if(mode==='invisible')f.core.state.clientIds=[];const result=await m.call(id,mode==='foreign'?{...f.request,clientId:foreign}:f.request);assert.equal(result.isError,true);assert.match(result.content[0].text,/^ACCESS_DENIED:/u);assert.deepEqual(m.runtime.receipts(),[]);noSource(f);}
  finally{await m.close();f.scope.abort();}
 }
});

for(const id of [trackedId,hearingId])test(`completion SDK ${id}: native name observation preserves original raw hashes and dispatches only the admitted UUID`,async()=>{
 const f=await mounted(id,{scene:namedScene(id,{asPersonal:id===hearingId})}),m=await mountReads(f,{port:f.port});assert.notEqual(m,null);
 try{
  const result=await m.call(id,f.request);assert.equal(result.isError,undefined);assert.equal(result.denied,undefined);const out=JSON.parse(result.content[0].text),context=f.stateOwner.secretProof.normalizationContext,selected=id===trackedId?trackedClient:hearingClient;
  assert.deepEqual(out.result,expectedResult(f));assert.deepEqual(f.wire[0].body,{...f.request,clientId:selected});assert.equal(f.wire.length,1);assert.ok(f.referenceCalls().length>=3);
  for(const call of f.referenceCalls()){assert.deepEqual(call.body,{ref:reference});assert.equal(call.init.method,'POST');assert.equal(call.init.redirect,'error');}
  assert.deepEqual(f.calls[0].arguments,f.request);assert.equal(f.stateOwner.secretProof.requestSha256,hash(f.request));assert.equal(out.argumentsSha256,f.contract.normalizeInput(f.request,context).argumentsSha256);assert.equal(m.runtime.receipts()[0].argumentsSha256,hash(f.request));assert.equal(m.runtime.receipts()[0].resultSha256,hash(out));
  if(id===trackedId){assert.ok(f.state.fixtureNameCompatibilityCalls>0);assert.deepEqual(Object.keys(context).sort(),['binding','clientReference','subject']);assert.equal(context.clientReference,reference);assert.deepEqual(out.result.subject,context.subject);}
  else{assert.equal(f.scopes.some(scope=>scope.kind==='client'),false);assert.deepEqual(context,{tenantId:f.binding.tenantId,clientResolution:{reference,clientId:selected}});assert.equal(f.state.fixtureNameCompatibilityCalls??0,0);}
  assert.equal([...f.state.reservations.values()][0].state,'SETTLED');
 }finally{await m.close();f.scope.abort();}
});

for(const id of [trackedId,hearingId])for(const denial of ['ambiguous','hidden','foreign-resolution'])test(`completion SDK ${id}: ${denial} name resolution is denied before credentials or domain reads`,async()=>{
 const f=await mounted(id,{scene:namedScene(id,{asPersonal:id===hearingId})}),m=await mountReads(f,{port:f.port});assert.notEqual(m,null);
 try{
  f.state.referenceResult=denial==='foreign-resolution'?{ok:true,clientId:foreign}:{ok:false,reason:`SYNTHETIC_${denial}`};
  const result=await m.call(id,f.request);assert.equal(result.isError,true);assert.match(result.content[0].text,denial==='foreign-resolution'?/^ACCESS_DENIED:/u:/^UNAVAILABLE:/u);assert.equal(result.content[0].text.includes('SYNTHETIC_'),false);assert.deepEqual(m.runtime.receipts(),[]);assert.ok(f.referenceCalls().length>=1);noSource(f);
 }finally{await m.close();f.scope.abort();}
});

for(const id of [trackedId,hearingId])test(`completion SDK ${id}: a native name change after source withholds all bytes and keeps UNKNOWN`,async()=>{
 const f=await mounted(id,{scene:namedScene(id,{asPersonal:id===hearingId})}),m=await mountReads(f,{port:f.port});assert.notEqual(m,null);
 try{f.state.afterSource=()=>f.state.referenceResult={ok:true,clientId:foreign};const result=await m.call(id,f.request);assert.equal(result.isError,true);assert.match(result.content[0].text,/^ACCESS_DENIED:/u);assert.deepEqual(m.runtime.receipts(),[]);assert.equal(f.wire.length,1);assert.equal(f.calls.length,1);unknown(f);}
 finally{await m.close();f.scope.abort();}
});

test('completion SDK cancellation reaches the native source and leaves UNKNOWN without an accepted receipt',async()=>{
 const f=await mounted(stateIds[0],{park:true}),m=await mountReads(f,{port:f.port}),controller=new AbortController();assert.notEqual(m,null);
 try{
  const reached=new Promise(resolve=>f.state.atSource=resolve),pending=m.call(stateIds[0],f.request,{signal:controller.signal});await reached;controller.abort();await assert.rejects(pending,/AbortError/u);
  for(let n=0;n<100&&(!f.state.sourceAborted||[...f.state.reservations.values()][0]?.state!=='UNKNOWN');n++)await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(f.state.sourceAborted,true);assert.deepEqual(m.runtime.receipts(),[]);assert.equal(f.wire.length,1);assert.equal(f.calls.length,1);unknown(f);
 }finally{await m.close();f.scope.abort();}
});
