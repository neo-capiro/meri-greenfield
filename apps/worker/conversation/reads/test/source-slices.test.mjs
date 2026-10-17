/** Actual MCP, CONTROL and gateway owners; only synthetic source JSON/current membership and scripted SQL. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import catalog from '../../../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {familyReads,resolveAvailableReads} from '../availability.mjs';
import {READ_FAMILIES,READ_FAMILY_IDS} from '../families.mjs';
import {advertisedArguments} from '../schema.mjs';
import {assertCapabilityPolicy} from '../../capabilities/policy.mjs';
import {nativeFamilyCase,SOURCE_SLICE_CASES} from '../../../../gateway/general-reads/test/native-family-cases.mjs';
import {createGeneralReadFamilyHandlers} from '../../../../gateway/general-reads/integration.mjs';
import {createControlGeneralReadRuntime} from '../../../../runtime/general-read-runtime.mjs';
import {ownerFixture} from '../../../../runtime/native-authority/native-read-credentials/test/fixture.mjs';
import {mountReads} from './fixture.mjs';

const complete=[['public-data','query_economic_data'],['client-knowledge-search','query_knowledge_graph']];
const partial=SOURCE_SLICE_CASES.filter(([family])=>!complete.some(([selected])=>selected===family));
const familyOperations=family=>catalog.operations.filter(row=>resolveOperationContract(row.operation).binding.group===family).map(row=>row.operation);
async function mounted(id,options={}){
 const f=await ownerFixture(id,options),{getCredentials,authorizeResultForCall,...transport}=f.transport;
 const handlers=await createGeneralReadFamilyHandlers({families:{[f.family]:{...transport,credentialsForCall:f.owner.credentialsForCall}},now:f.now,newId:randomUUID});
 const {installationOwner,...gateway}=f.gatewayConfiguration;
 const port=createControlGeneralReadRuntime({...gateway,handlers,scopes:f.scopes,readCurrentInstallation:({signal})=>installationOwner.readCurrent({signal}),nativeReadContextPorts:f.owner.nativeReadContextPorts});
 return {...f,port};
}

for(const [family,id] of complete){
 test(`${id}: finite SDK family operation list excludes every canonical sibling even with forged installation/discovery`,()=>{
  const operations=familyOperations(family),siblings=operations.filter(row=>row.id!==id);
  assert.ok(siblings.length>0);assert.deepEqual(READ_FAMILIES[family].operationIds,[id]);
  assert.deepEqual(familyReads().filter(row=>row.family===family).map(row=>row.operation.id),[id]);
  const gates=resolveAvailableReads({policy:{generalReads:true,readFamilies:[family]},installation:{operations},discovery:{operations},scopes:[{kind:'client'}]});
  assert.deepEqual(gates.available.map(row=>row.operation.id),[id]);
  for(const sibling of siblings)assert.equal(familyReads().some(row=>row.operation.id===sibling.id),false);
 });
 test(`${id}: SDK arguments use the frozen raw contract and refuse model authority or normalization context`,()=>{
  const f=nativeFamilyCase(family,id),schema=advertisedArguments(f.contract.descriptor.inputSchema);
  assert.equal(schema.mode,'canonical');assert.deepEqual(schema.arguments.parse(f.arguments),f.arguments);
  for(const extra of [{tenantId:'foreign'},{normalizationContext:{}},{actorRole:'capiro_admin'},{input:f.arguments}])assert.equal(schema.arguments.safeParse({...f.arguments,...extra}).success,false);
 });
 test(`${id}: actual mounted owner and MCP tool preserve exact source bytes and durable receipt`,async()=>{
  const f=await mounted(id),m=await mountReads(f,{port:f.port});assert.notEqual(m,null);
  try{
   assert.deepEqual((await m.client.listTools()).tools.map(tool=>tool.name),[id]);
   const out=await m.call(id,f.request);assert.equal(out.isError,undefined);assert.equal(out.denied,undefined);
   const raw=out.content[0].text,value=JSON.parse(raw);
   assert.deepEqual(value.result,JSON.parse(JSON.stringify(f.page)));assert.deepEqual(value.binding,f.binding);assert.deepEqual(value.subject,f.authority.subject);assert.deepEqual(value.operation,f.operation);
   assert.equal(value.argumentsSha256,f.contract.normalizeInput(f.request,f.normalizationContext).argumentsSha256);
   assert.equal(m.runtime.receipts().length,1);assert.equal(m.runtime.receipts()[0].resultSha256,hash(value));
   const [reservation]=f.state.reservations.values();assert.equal(reservation.state,'SETTLED');assert.equal(reservation.output_bytes,Buffer.byteLength(raw));assert.equal(reservation.charged_micro_usd,1);
   assert.equal(f.wire.length,1);assert.deepEqual(f.wire[0].body,f.request);assert.equal(f.stateOwner.secretProof.requestSha256,hash(f.request));assert.deepEqual(f.stateOwner.secretProof.normalizationContext,{});
  }finally{await m.close();f.scope.abort();}
 });
 test(`${id}: current native revision revocation after source withholds SDK bytes and receipt`,async()=>{
  const f=await mounted(id),m=await mountReads(f,{port:f.port});assert.notEqual(m,null);
  try{
   f.state.afterSource=()=>f.core.state.membershipRevision='c'.repeat(64);
   const out=await m.call(id,f.request);assert.equal(out.isError,true);assert.match(out.content[0].text,/ACCESS_DENIED/);assert.deepEqual(m.runtime.receipts(),[]);
   assert.equal(f.wire.length,1);const [reservation]=f.state.reservations.values();assert.equal(reservation.state,'UNKNOWN');assert.equal(reservation.output_bytes,null);assert.equal(reservation.charged_micro_usd,null);assert.equal(f.state.budget.consumed_micro_usd,0);
  }finally{await m.close();f.scope.abort();}
 });
 test(`${id}: missing measured installation, discovery, source or family policy creates no MCP tool`,async()=>{
  const f=await mounted(id);
  try{
   f.state.installRevoked=true;assert.equal(await mountReads(f,{port:f.port}),null);f.state.installRevoked=false;
   f.state.discoveryMutator=row=>row.operations=[];assert.equal(await mountReads(f,{port:f.port}),null);f.state.discoveryMutator=undefined;
   assert.equal(await mountReads(f,{port:f.port,policy:{generalReads:false}}),null);
   assert.equal(await mountReads(f,{port:f.port,policy:{generalReads:true,readFamilies:['mail']}}),null);
   assert.equal(await mountReads(f,{port:f.mount({sourceEnabled:false})}),null);assert.equal(f.wire.length,0);assert.equal(f.state.reservations.size,0);
  }finally{f.scope.abort();}
 });
}

test('eight partial-input operations remain absent from SDK policy and cannot be advertised by installation/discovery',async()=>{
 assert.equal(partial.length,8);assert.equal(new Set(partial.map(([family])=>family)).size,6);
 const operations=partial.map(([,id])=>({id,version:'0.2.0'})),families=[...new Set(partial.map(([family])=>family))];
 const gates=resolveAvailableReads({policy:{generalReads:true,readFamilies:[...READ_FAMILY_IDS,...families]},installation:{operations},discovery:{operations},scopes:[{kind:'client'}]});
 assert.deepEqual(gates.available,[]);
 for(const [family,id] of partial){
  assert.equal(Object.hasOwn(READ_FAMILIES,family),false);assert.equal(familyReads().some(row=>row.operation.id===id),false);
  assert.throws(()=>assertCapabilityPolicy({generalReads:true,readFamilies:[family]}),{code:'CAPABILITY_POLICY_REFUSED'});
  const f=await mounted(id);try{assert.equal(await mountReads(f,{port:f.port}),null);assert.equal(f.wire.length,0);assert.equal(f.state.reservations.size,0);}finally{f.scope.abort();}
 }
});

test('operation filters cannot name duplicate, unknown, foreign or empty operation sets',()=>{
 for(const operationIds of [[],['query_economic_data','query_economic_data'],['missing'],['query_knowledge_graph'],['propose_task']]){
  assert.throws(()=>familyReads({'public-data':{clientScope:'optional',operationIds}}),{message:'READ_FAMILY_CONFIGURATION'});
 }
});
