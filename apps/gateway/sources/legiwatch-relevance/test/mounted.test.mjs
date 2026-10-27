import test from 'node:test';import assert from 'node:assert/strict';
import {fixture} from '../../../../runtime/test/reads-native-fixture.mjs';
import {connect} from '../../../../worker/conversation/reads/test/native-mcp-fixture.mjs';
import {advertisedArguments} from '../../../../worker/conversation/reads/schema.mjs';
import {relevanceCase} from './fixture.mjs';
for(const verified of [false,true])test(`${verified?'verified preview':'source discovery'} preserves exact quote and source limits through mounted MCP`,async t=>{
 const scene=relevanceCase({verified}),f=await fixture(scene.family,scene.operation.id,{scene,privateUser:true}),m=await connect(t,f);assert.ok(m);
 const r=await m.call();assert.equal(r.isError,undefined,JSON.stringify(r));assert.deepEqual(JSON.parse(r.content[0].text).result,scene.page);assert.equal(m.runtime.receipts().length,1);
 assert.deepEqual(scene.wire[0].body,scene.arguments);assert.ok(scene.wire[0].url.endsWith('/preview_legiwatch_relevance'));
});
test('revoked current access after read withholds the verified preview',async t=>{
 const scene=relevanceCase({verified:true}),f=await fixture(scene.family,scene.operation.id,{scene,privateUser:true}),m=await connect(t,f);scene.state.afterSource=()=>f.revoke();assert.equal((await m.call()).isError,true);assert.equal(m.runtime.receipts().length,0);
});
test('stale source hash, assignment effect, wrong selection and multibyte overflow are refused',async t=>{
 for(const mutate of [p=>p.data.previewHash='0'.repeat(64),p=>p.data.effects[0].automaticAssignment=true,p=>p.selection.sessionKey='118',p=>p.coverage.limitations=['界'.repeat(90000)]]){
  const scene=relevanceCase({verified:true});scene.state.resultMutator=mutate;const f=await fixture(scene.family,scene.operation.id,{scene,privateUser:true}),m=await connect(t,f);assert.equal((await m.call()).isError,true);assert.equal(m.runtime.receipts().length,0);
 }
});
test('closed model schema retains exact UTF16 offsets and refuses authority or partial quote input',()=>{
 const scene=relevanceCase({verified:true}),schema=advertisedArguments(scene.contract.descriptor.inputSchema).arguments;
 assert.deepEqual(schema.parse(scene.arguments),scene.arguments);assert.equal(schema.safeParse({...scene.arguments,tenantId:'model'}).success,false);
 assert.throws(()=>scene.contract.normalizeInput({...scene.arguments,end:3},scene.normalizationContext));
 const partial={...scene.arguments};delete partial.quote;assert.throws(()=>scene.contract.normalizeInput(partial,scene.normalizationContext));
});
