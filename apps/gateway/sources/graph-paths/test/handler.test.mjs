import test from 'node:test';
import assert from 'node:assert/strict';
import {graphCase,operation} from './fixture.mjs';
import {fixture} from '../../../../runtime/test/reads-native-fixture.mjs';
import {connect} from '../../../../worker/conversation/reads/test/native-mcp-fixture.mjs';
import {advertisedArguments} from '../../../../worker/conversation/reads/schema.mjs';
import {familyOperations} from '../../../general-reads/registration.mjs';
import {generalReadTariff} from '../../../budget/general-read-allocation.mjs';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
test('fixed native route preserves the independently expected PostgreSQL wire',async()=>{
 const f=graphCase(),output=JSON.parse(await f.handler()(f.call()));assert.deepEqual(output.result,f.state.page);
 assert.equal(new URL(f.wire[0].url).pathname,'/api/clio/tools/find_path_to');assert.deepEqual(f.wire[0].body,f.arguments);
 assert.equal(f.wire[0].options.redirect,'error');assert.equal(f.wire[0].options.credentials,'omit');
 assert.deepEqual(familyOperations('graph-paths'),[operation]);assert.equal(generalReadTariff(operation,[]),1);
 const schema=advertisedArguments(f.contract.descriptor.inputSchema);assert.deepEqual(schema.arguments.parse(f.arguments),f.arguments);
 for(const patch of [{tenantId:'forged'},{depth:6},{from:'client:other'}])assert.equal(schema.arguments.safeParse({...f.arguments,...patch}).success,false);
});
for(const options of [{client:false},{client:true},{client:false,explicitClient:true}])test(`SDK current native scope ${JSON.stringify(options)}`,async t=>{
 const scene=graphCase(options),f=await fixture('graph-paths',operation.id,{scene}),m=await connect(t,f);
 assert.ok(m);const out=await m.call();assert.equal(out.isError,undefined,JSON.stringify(out));
 const value=JSON.parse(out.content[0].text);assert.deepEqual(value.result,scene.state.page);
 assert.equal(m.runtime.receipts()[0].resultSha256,canonicalSha256(value));
 f.revoke();assert.equal((await m.call()).isError,true);assert.equal(scene.wire.length,1);assert.equal(m.runtime.receipts().length,1);
});
test('client-scoped SDK refuses an omitted or different client before Core data access',async t=>{
 const scene=graphCase({client:true}),f=await fixture('graph-paths',operation.id,{scene}),m=await connect(t,f);
 const {clientId,...omitted}=scene.arguments;
 for(const request of [omitted,{...scene.arguments,clientId:'ffffffff-ffff-4fff-8fff-ffffffffffff'}])assert.equal((await m.call(request)).isError,true);
 assert.equal(scene.wire.length,0);assert.deepEqual(m.runtime.receipts(),[]);
});
test('General explicit selection must still belong to the current Core visible roster',async t=>{
 const scene=graphCase({explicitClient:true}),f=await fixture('graph-paths',operation.id,{scene}),m=await connect(t,f);
 f.setClients([]);assert.equal((await m.call()).isError,true);assert.equal(scene.wire.length,0);assert.deepEqual(m.runtime.receipts(),[]);
});
test('current authority loss during a read withholds path evidence',async t=>{
 const scene=graphCase({client:true}),f=await fixture('graph-paths',operation.id,{scene}),m=await connect(t,f);
 scene.state.afterSource=()=>f.revoke();assert.equal((await m.call()).isError,true);assert.equal(scene.wire.length,1);assert.deepEqual(m.runtime.receipts(),[]);
});
test('General roster loss while a read is in flight withholds returned client paths',async t=>{
 const scene=graphCase(),f=await fixture('graph-paths',operation.id,{scene}),m=await connect(t,f);
 scene.state.afterSource=()=>f.setClients([]);assert.equal((await m.call()).isError,true);assert.deepEqual(m.runtime.receipts(),[]);
});
test('a changed native target or falsely complete source page never produces a receipt',async t=>{
 const scene=graphCase(),f=await fixture('graph-paths',operation.id,{scene}),m=await connect(t,f);
 for(const change of [value=>{value.target='person:wrong';},value=>{value.coverage.reasons.push('memory_edges_row_limit');}]){
  scene.state.resultMutator=change;assert.equal((await m.call()).isError,true);
 }
 assert.deepEqual(m.runtime.receipts(),[]);
});
