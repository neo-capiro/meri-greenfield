import test from 'node:test';
import assert from 'node:assert/strict';
import {buyerCase,operation} from './fixture.mjs';
import {familyOperations} from '../../../general-reads/registration.mjs';
import {advertisedArguments} from '../../../../worker/conversation/reads/schema.mjs';
import {READ_FAMILIES} from '../../../../worker/conversation/reads/families.mjs';
import {fixture,uuid} from '../../../../runtime/test/reads-native-fixture.mjs';
import {connect} from '../../../../worker/conversation/reads/test/native-mcp-fixture.mjs';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {generalReadTariff} from '../../../budget/general-read-allocation.mjs';

for(const index of [0,1])test(`native reader vector ${index} keeps exact bytes and fixed route`,async()=>{
 const f=buyerCase(index),out=JSON.parse(await f.handler()(f.call()));
 assert.deepEqual(out.result,f.page);assert.equal(f.wire.length,1);
 const wire=f.wire[0];assert.equal(new URL(wire.url).pathname,'/api/clio/tools/get_pe_buyer_workspace');
 assert.deepEqual(wire.body,f.arguments);assert.equal(wire.options.redirect,'error');assert.equal(wire.options.credentials,'omit');
 assert.equal(out.argumentsSha256,f.contract.normalizeInput(f.arguments).argumentsSha256);
});
test('advertised input is canonical and has four independent exact cursor selectors',()=>{
 const f=buyerCase(),schema=advertisedArguments(f.contract.descriptor.inputSchema);
 const input={...f.arguments,acquisitionCursor:'acq',fundingCursor:'fund',mentionsCursor:'mentions',lifecycleCursor:'lifecycle'};
 assert.deepEqual(schema.arguments.parse(input),input);
 assert.deepEqual(f.contract.normalizeInput(input).input,{...input,peCode:'0601234A',knownAt:'2026-09-24T00:00:00.000Z'});
 for(const field of ['tenantId','actorId','clientId','policy','approval','normalizationContext'])
  assert.equal(schema.arguments.safeParse({...input,[field]:'forged'}).success,false);
 assert.deepEqual(familyOperations('buyer-workspace'),[operation]);assert.equal(READ_FAMILIES['buyer-workspace'].clientScope,'optional');
});
for(const client of [false,true])test(`SDK MCP read under ${client?'client':'General'} current authority preserves result and revocation`,async t=>{
 const scene=buyerCase();
 if(client){scene.authority.subject.kind='client';scene.authority.subject.entityType='client';scene.authority.subject.entityIds=[uuid('a')];
  scene.authority.subject.scopes=[{tenantId:scene.binding.tenantId,kind:'client',resourceId:uuid('a'),policyRevision:scene.authority.policyRevision}];}
 const f=await fixture('buyer-workspace',operation.id,{scene}),m=await connect(t,f);
 assert.ok(m);const output=await m.call();assert.equal(output.isError,undefined,JSON.stringify(output));
 const value=JSON.parse(output.content[0].text);assert.deepEqual(value.result,scene.page);
 assert.equal(m.runtime.receipts().length,1);assert.equal(m.runtime.receipts()[0].resultSha256,canonicalSha256(value));
 f.revoke();const refused=await m.call();assert.equal(refused.isError,true);
 assert.equal(scene.wire.length,1);assert.equal(m.runtime.receipts().length,1);
});
test('SDK refuses changed native results and current Core access loss without releasing receipts',async t=>{
 const scene=buyerCase(),f=await fixture('buyer-workspace',operation.id,{scene}),m=await connect(t,f);
 scene.state.resultMutator=value=>{value.acquisition.data.knownAt='2026-09-25T00:00:00.000Z';};
 assert.equal((await m.call()).isError,true);assert.deepEqual(m.runtime.receipts(),[]);
 scene.state.resultMutator=undefined;f.deny();assert.equal((await m.call()).isError,true);
 assert.equal(scene.wire.length,1);assert.deepEqual(m.runtime.receipts(),[]);
});
test('SDK drops a source result if execution authority is revoked while the read is in flight',async t=>{
 const scene=buyerCase(),f=await fixture('buyer-workspace',operation.id,{scene}),m=await connect(t,f);
 scene.state.afterSource=()=>f.revoke();assert.equal((await m.call()).isError,true);
 assert.equal(scene.wire.length,1);assert.deepEqual(m.runtime.receipts(),[]);
});
test('all four exact cursors reach Core unchanged',async()=>{
 const f=buyerCase(),input={...f.arguments,acquisitionCursor:'opaque-a',fundingCursor:'opaque-f',mentionsCursor:'opaque-m',lifecycleCursor:'opaque-l'};
 await f.handler()(f.call(input));assert.deepEqual(f.wire[0].body,input);
});
test('canonical stored-data read uses the database tariff without a paid-source assumption',()=>{
 assert.equal(generalReadTariff(operation,[]),1);
});
