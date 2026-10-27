import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from '../../../../runtime/test/reads-native-fixture.mjs';
import {connect} from './native-mcp-fixture.mjs';
import {advertisedArguments} from '../schema.mjs';
import {savedReadCase,ids,clientId,recordId,uuid} from '../../../../gateway/sources/saved-records/test/fixture.mjs';
import {createRoutineReadContext} from '../../../../runtime/objective-generation/read-context.mjs';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {selectSkill} from '../../../../../packages/skills/index.mjs';

for(const id of ids){
 test(`${id}: actual SDK/control/native transport publishes one exact typed owner receipt`,async t=>{
  const scene=savedReadCase(id),f=await fixture(scene.family,id,{scene,privateUser:true}),m=await connect(t,f);
  assert.ok(m);assert.deepEqual((await m.client.listTools()).tools.map(t=>t.name),[id]);
  const result=await m.call();assert.equal(result.isError,undefined,JSON.stringify(result));
  assert.deepEqual(JSON.parse(result.content[0].text).result,scene.page);assert.equal(m.runtime.receipts().length,1);
  assert.equal(scene.wire.length,1);assert.deepEqual(scene.wire[0].body,scene.arguments);
  assert.equal(scene.wire[0].options.headers.authorization,'Bearer SYNTHETIC_NATIVE');
  if(id===ids[1]){const proof=JSON.parse(Buffer.from(scene.wire[0].options.headers['x-meri-read-correlation'],'base64url'));
   assert.equal(proof.normalizationContext.strategySavedScope.clientId,clientId);assert.equal(proof.subject.kind,'personal');}
 });
 test(`${id}: exposed schema rejects model authority and existing skill remains narrowed`,async t=>{
  const scene=savedReadCase(id),schema=advertisedArguments(scene.contract.descriptor.inputSchema).arguments;
  assert.deepEqual(schema.parse(scene.arguments),scene.arguments);
  for(const extra of [{url:'https://foreign.invalid'},{tenantId:uuid('a')},{normalizationContext:{}},{authorization:'foreign'}])assert.equal(schema.safeParse({...scene.arguments,...extra}).success,false);
  const f=await fixture(scene.family,id,{scene,privateUser:true});assert.equal(await connect(t,f,{skill:selectSkill('quick_skill.pe_deep_dive','1.0.0').manifest}),null);
 });
 test(`${id}: source refusal or current access lost after read withholds all evidence`,async t=>{
  for(const late of [false,true]){const scene=savedReadCase(id),f=await fixture(scene.family,id,{scene,privateUser:true}),m=await connect(t,f);
   if(late)scene.state.afterSource=()=>f.revoke();else f.deny();
   assert.equal((await m.call()).isError,true);assert.equal(m.runtime.receipts().length,0);assert.equal(scene.wire.length,late?1:0);}
 });
 test(`${id}: saved-job context cannot invent interactive identity revisions`,async()=>{
  const scene=savedReadCase(id),a=scene.authority,signal=new AbortController().signal;
  const owner=createRoutineReadContext({record:{binding:a.binding,selectedClientId:null,expiresAtMs:scene.now()+5000},current:{role:'standard_user',clientIds:[clientId]},readSource:async()=>assert.fail('no saved job read'),policyRevision:a.policyRevision,approvedReads:{operations:[scene.operation]},now:scene.now});
  await assert.rejects(owner.nativeReadContextPorts.readCurrent({binding:a.binding,subject:a.subject,operation:scene.operation,request:scene.arguments,requestSha256:canonicalSha256(scene.arguments),policyRevision:a.policyRevision,sourceIds:a.sourceIds,deadlineMs:scene.now()+5000,signal}));
 });
}
test('selected client permits its explicit library filter, but refuses General-only exact IDs and another client',async t=>{
 const scene=savedReadCase(ids[0],{selected:true,request:{source:'workspace',kind:'library',input:{query:{clientId}}}}),f=await fixture(scene.family,ids[0],{scene}),m=await connect(t,f);
 assert.equal((await m.call()).isError,undefined);assert.equal(scene.wire.length,1);
 for(const request of [{source:'workspace',kind:'saved_version',input:{draftId:recordId,versionId:recordId}},{source:'workspace',kind:'library',input:{query:{clientId:uuid('e')}}}]){
  const bad=savedReadCase(ids[0],{selected:true,request}),g=await fixture(bad.family,ids[0],{scene:bad}),n=await connect(t,g);
  assert.equal((await n.call()).isError,true);assert.equal(bad.wire.length,0);}
});
test('typed malformed shape, parent/hash mismatch and UTF8 overflow cannot become a receipt',async t=>{
 for(const [id,mutate] of [[ids[0],p=>p.data.versionId=uuid('a')],[ids[0],p=>p.data.snapshot={text:'界'.repeat(90000)}],[ids[1],p=>p.items[0].record.action=17],[ids[1],p=>p.items[0].source.contentSha256='0'.repeat(64)]]){
  const scene=savedReadCase(id);scene.state.resultMutator=mutate;const f=await fixture(scene.family,id,{scene,privateUser:true}),m=await connect(t,f);
  assert.equal((await m.call()).isError,true);assert.equal(m.runtime.receipts().length,0);}
});
test('strict per-kind selectors remain enforced behind the advisory SDK schema',()=>{
 const a=savedReadCase(ids[0]);assert.throws(()=>a.contract.normalizeInput({source:'workspace',kind:'saved_version',input:{draftId:recordId}},a.normalizationContext));
 assert.throws(()=>a.contract.normalizeInput({source:'core',kind:'billing_state',input:{documentId:recordId}},a.normalizationContext));
 const b=savedReadCase(ids[1]);assert.throws(()=>b.contract.normalizeInput({...b.arguments,archived:true},b.normalizationContext));
});
