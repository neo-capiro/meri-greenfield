/** Actual meri_reads MCP/CONTROL/gateway over scripted SQL and synthetic native HTTP. No model or live calls. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {storedCase,ids,conversationId,clientId} from '../../../../gateway/sources/business-development/test/fixture.mjs';
import {createGeneralReadFamilyHandlers} from '../../../../gateway/general-reads/integration.mjs';
import {createControlGeneralReadRuntime} from '../../../../runtime/general-read-runtime.mjs';
import {createNativeReadCredentialOwner} from '../../../../runtime/native-authority/native-read-credentials/owner.mjs';
import {ownerFixture} from '../../../../runtime/native-authority/native-read-credentials/test/fixture.mjs';
import {familyReads,resolveAvailableReads} from '../availability.mjs';
import {READ_FAMILIES,READ_FAMILY_IDS} from '../families.mjs';
import {advertisedArguments} from '../schema.mjs';
import {mountReads} from './fixture.mjs';

const evidence={id:'get_business_development_evidence',version:'0.2.0'},operations=[...ids.map(id=>({id,version:'0.2.0'})),evidence];
async function mounted(id,{personal=true,request}={}){
 const f=await ownerFixture(id,{scene:storedCase(id,{personal,...(request?{request}:{})})}),{readConversation,...currentAuthority}=f.configuration.coreAuthority;
 const owner=createNativeReadCredentialOwner({...f.configuration,coreAuthority:personal?currentAuthority:f.configuration.coreAuthority});
 const {getCredentials,credentialsForCall,authorizeResultForCall,...transport}=f.transport;
 const handlers=await createGeneralReadFamilyHandlers({families:{[f.family]:{...transport,credentialsForCall:owner.credentialsForCall}},now:f.now,newId:randomUUID});
 const {installationOwner,...gateway}=f.gatewayConfiguration;
 const port=createControlGeneralReadRuntime({...gateway,handlers,scopes:f.scopes,readCurrentInstallation:({signal})=>installationOwner.readCurrent({signal}),nativeReadContextPorts:owner.nativeReadContextPorts});
 return {...f,owner,port};
}
const contexts=f=>f.core.state.calls.filter(call=>call.path.endsWith('/context'));
function unknown(f){const [r]=f.state.reservations.values();assert.equal(r.state,'UNKNOWN');assert.equal(r.output_bytes,null);assert.equal(r.charged_micro_usd,null);assert.equal(f.state.budget.consumed_micro_usd,0);assert.equal([...f.state.produced.values()][0].completion,null);}

test('BD SDK exposes exactly the two complete operations to personal/client scope and withholds evidence despite forged inventories',()=>{
 assert.equal(familyReads().length,76);assert.equal(READ_FAMILY_IDS.length,42);
 assert.deepEqual(READ_FAMILIES['business-development'],{clientScope:'optional',operationIds:ids});
 assert.deepEqual(familyReads().filter(row=>row.family==='business-development').map(row=>row.operation.id),ids);
 for(const kind of ['tenant','private-user','client']){
  const result=resolveAvailableReads({policy:{generalReads:true,readFamilies:['business-development']},installation:{operations},discovery:{operations},scopes:[{kind}]});
  assert.deepEqual(result.available.map(row=>row.operation.id),ids);assert.equal(result.available.some(row=>row.operation.id===evidence.id),false);
 }
 assert.equal(familyReads().some(row=>row.operation.id===evidence.id),false);
});

for(const id of ids){
 test(`BD SDK ${id}: canonical full arguments accept explicit Core selectors and reject model authority/context`,()=>{
  const f=storedCase(id,{personal:true}),schema=advertisedArguments(f.contract.descriptor.inputSchema);
  assert.equal(schema.mode,'canonical');assert.deepEqual(schema.arguments.parse(f.arguments),f.arguments);
  const request={conversationId:conversationId.toUpperCase()};assert.deepEqual(schema.arguments.parse(request),request);
  for(const extra of [{clientId},{subject:f.authority.subject},{normalizationContext:{}},{asOf:new Date(f.now()).toISOString()},{tenantId:f.authority.binding.tenantId}])assert.equal(schema.arguments.safeParse({...f.arguments,...extra}).success,false);
  assert.equal(schema.arguments.safeParse({conversationId:'named conversation'}).success,false);assert.equal(schema.arguments.safeParse({}).success,false);
  if(id===ids[1])for(const limit of [1,25])assert.equal(schema.arguments.safeParse({...request,limit}).success,true);
  if(id===ids[1])for(const limit of [0,26,'2',null])assert.equal(schema.arguments.safeParse({...request,limit}).success,false);
 });
 test(`BD SDK ${id}: personal fixed native read settles exact MCP bytes without a conversation authority port`,async()=>{
  const request={conversationId:conversationId.toUpperCase(),...(id===ids[1]?{limit:1}:{})},f=await mounted(id,{request}),m=await mountReads(f,{port:f.port});assert.notEqual(m,null);
  try{
   assert.deepEqual((await m.client.listTools()).tools.map(tool=>tool.name),[id]);
   const result=await m.call(id,request);assert.equal(result.isError,undefined);assert.equal(result.denied,undefined);
   const raw=result.content[0].text,out=JSON.parse(raw);assert.deepEqual(out.result,JSON.parse(JSON.stringify(f.page)));assert.deepEqual(out.subject,f.authority.subject);
   assert.equal(out.subject.kind,'personal');assert.deepEqual(out.subject.entityIds,[f.binding.actorId]);assert.deepEqual(out.binding,f.binding);assert.deepEqual(out.operation,f.operation);
   assert.notEqual(request.conversationId.toLowerCase(),f.binding.conversationId);assert.deepEqual(f.wire[0].body,request);assert.equal(f.wire.length,1);
   assert.deepEqual(f.stateOwner.secretProof.normalizationContext,{});assert.equal(f.stateOwner.secretProof.requestSha256,hash(request));assert.equal(contexts(f).length,0);
   assert.equal(out.argumentsSha256,f.contract.normalizeInput(request,{}).argumentsSha256);assert.equal(m.runtime.receipts().length,1);assert.equal(m.runtime.receipts()[0].resultSha256,hash(out));
   const [reservation]=f.state.reservations.values();assert.equal(reservation.state,'SETTLED');assert.equal(reservation.charged_micro_usd,1);assert.equal(reservation.output_bytes,Buffer.byteLength(raw));
  }finally{await m.close();f.scope.abort();}
 });
 test(`BD SDK ${id}: client-bound reads retain the exact Core conversation/client proof`,async()=>{
  const f=await mounted(id,{personal:false}),m=await mountReads(f,{port:f.port});assert.notEqual(m,null);
  try{
   const result=await m.call(id,f.request);assert.equal(result.isError,undefined);assert.equal(result.denied,undefined);
   assert.equal(JSON.parse(result.content[0].text).subject.kind,'client');assert.ok(contexts(f).length>=3);
   assert.ok(contexts(f).every(call=>call.body.conversationId===conversationId&&call.body.clientId===clientId));
   assert.equal(m.runtime.receipts().length,1);assert.equal([...f.state.reservations.values()][0].state,'SETTLED');
  }finally{await m.close();f.scope.abort();}
 });
 test(`BD SDK ${id}: source/install/discovery/family policy gates remain required for personal availability`,async()=>{
  const f=await mounted(id);
  try{
   f.state.installRevoked=true;assert.equal(await mountReads(f,{port:f.port}),null);f.state.installRevoked=false;
   f.state.discoveryMutator=row=>row.operations=[];assert.equal(await mountReads(f,{port:f.port}),null);f.state.discoveryMutator=undefined;
   assert.equal(await mountReads(f,{port:f.port,policy:{generalReads:false}}),null);
   assert.equal(await mountReads(f,{port:f.port,policy:{generalReads:true,readFamilies:['mail']}}),null);
   assert.equal(await mountReads(f,{port:f.mount({sourceEnabled:false})}),null);assert.equal(f.wire.length,0);assert.equal(f.stateOwner.secrets,0);assert.equal(f.state.reservations.size,0);
  }finally{f.scope.abort();}
 });
 test(`BD SDK ${id}: current native revocation after source withholds all model bytes and receipts`,async()=>{
  const f=await mounted(id),m=await mountReads(f,{port:f.port});assert.notEqual(m,null);
  try{
   f.state.afterSource=()=>f.core.state.membershipRevision='e'.repeat(64);
   const result=await m.call(id,f.request);assert.equal(result.isError,true);assert.match(result.content[0].text,/^ACCESS_DENIED:/);assert.deepEqual(m.runtime.receipts(),[]);
   assert.equal(f.wire.length,1);assert.equal(contexts(f).length,0);unknown(f);
  }finally{await m.close();f.scope.abort();}
 });
 test(`BD SDK ${id}: native inline refusal is one failed attempt with UNKNOWN and no fallback or receipt`,async()=>{
  const f=await mounted(id),m=await mountReads(f,{port:f.port});assert.notEqual(m,null);
  try{
   f.state.responseFactory=()=>Response.json({message:'Synthetic inline scope denied'},{status:403});
   const result=await m.call(id,f.request);assert.equal(result.isError,true);assert.match(result.content[0].text,/^INVALID_RESULT:/);assert.deepEqual(m.runtime.receipts(),[]);
   assert.equal(f.wire.length,1);assert.equal(f.stateOwner.secrets,1);assert.equal(contexts(f).length,0);unknown(f);
  }finally{await m.close();f.scope.abort();}
 });
 test(`BD SDK ${id}: an explicit one-call budget settles once then refuses another source dispatch`,async()=>{
  const f=await mounted(id),m=await mountReads(f,{port:f.port,skill:{allowedOperations:[f.operation],budgets:{maxToolCalls:1,maxOutputBytes:1048576}}});assert.notEqual(m,null);
  try{
   const first=await m.call(id,f.request);assert.equal(first.isError,undefined);assert.equal(m.runtime.receipts().length,1);
   const second=await m.call(id,f.request);assert.match(second.denied,/RESOURCE_LIMIT/);assert.equal(f.wire.length,1);assert.equal(f.state.reservations.size,1);assert.equal([...f.state.reservations.values()][0].state,'SETTLED');
  }finally{await m.close();f.scope.abort();}
 });
}
