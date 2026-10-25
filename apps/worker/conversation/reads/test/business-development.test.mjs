/** Current Core and real worker MCP composition; no task grants or reservations. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../../packages/contracts/validate.mjs';
import {storedCase,ids,conversationId,clientId} from '../../../../gateway/sources/business-development/test/fixture.mjs';
import {fixture} from '../../../../runtime/test/reads-native-fixture.mjs';
import {familyReads,resolveAvailableReads} from '../availability.mjs';
import {READ_FAMILIES,READ_FAMILY_IDS} from '../families.mjs';
import {advertisedArguments} from '../schema.mjs';
import {connect} from './native-mcp-fixture.mjs';
const evidence={id:'get_business_development_evidence',version:'0.2.0'},operations=[...ids.map(id=>({id,version:'0.2.0'})),evidence];
test('BD SDK retains personal context/change reads and requires client scope for evidence',()=>{
 assert.equal(familyReads().length,84);assert.equal(READ_FAMILY_IDS.length,48);
 const expected=[ids[0],evidence.id,ids[1]];
 assert.deepEqual(READ_FAMILIES['business-development'],{clientScope:'optional',requiredClientOperations:[evidence.id],operationIds:[...ids,evidence.id]});
 assert.deepEqual(familyReads().filter(row=>row.family==='business-development').map(row=>row.operation.id),expected);
 for(const kind of ['tenant','private-user','client']){
  const result=resolveAvailableReads({policy:{generalReads:true,readFamilies:['business-development']},installation:{operations},discovery:{operations},scopes:[{kind}]});
  assert.deepEqual(result.available.map(row=>row.operation.id),kind==='client'?expected:ids);
  assert.equal(result.available.some(row=>row.operation.id===evidence.id),kind==='client');
 }
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
 test(`BD SDK ${id}: General personal scope retains explicit resource selector and exact result`,async t=>{
  const request={conversationId:conversationId.toUpperCase(),...(id===ids[1]?{limit:1}:{})};
  const f=await fixture('business-development',id,{scene:storedCase(id,{personal:true,request}),privateUser:true}),m=await connect(t,f);assert.ok(m);
  const result=await m.call(request);assert.equal(result.isError,undefined,JSON.stringify(result));
  const out=JSON.parse(result.content[0].text);assert.deepEqual(out.result,JSON.parse(JSON.stringify(f.scene.page)));
  assert.equal(out.subject.kind,'personal');assert.deepEqual(out.subject.entityIds,[f.binding.actorId]);
  assert.deepEqual(f.scene.wire[0].body,request);assert.notEqual(request.conversationId.toLowerCase(),f.binding.conversationId);
  assert.equal(f.calls.filter(p=>p.endsWith('/application-authority/current')).length,1);
  assert.equal(out.argumentsSha256,f.scene.contract.normalizeInput(request,{}).argumentsSha256);
  assert.equal(m.runtime.receipts()[0].resultSha256,hash(out));
 });
 test(`BD SDK ${id}: revocation during the source call withholds every model byte and receipt`,async t=>{
  const f=await fixture('business-development',id,{scene:storedCase(id,{personal:true}),privateUser:true}),m=await connect(t,f);assert.ok(m);
  f.scene.state.afterSource=f.revoke;
  const result=await m.call();assert.equal(result.isError,true);assert.deepEqual(m.runtime.receipts(),[]);assert.equal(f.scene.wire.length,1);
  assert.doesNotMatch(JSON.stringify(result),/Stored prospect activity|Stored hypothesis|Synthetic stored change/u);
 });
}
