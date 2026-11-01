import test from 'node:test';
import assert from 'node:assert/strict';
import {hash} from 'node:crypto';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {capiroDataCase} from './fixture.mjs';
import {withSqlContract} from './sql-contract-fixture.mjs';
const original=['congress_bills','congress_bill_subjects','congress_bill_cosponsors','congress_members','program_elements','program_element_projects','program_element_budget_positions','program_element_project_budget_positions'];
function scene(request={}){
 const f=capiroDataCase('describe_capiro_data',{request});
 const page=f.page;page.relations=original.map(name=>({...structuredClone(page.relations[0]),name}));
 f.state.page=withSqlContract(page);return f;
}
test('retained default selects eight at Core before digesting, binding wire credentials but preserving original evidence',async()=>{
 for(const request of [{},{source:'public'}]){
  const f=scene(request),call=f.call(),before=structuredClone(call),result=JSON.parse(await f.handler()(call));
  assert.deepEqual(f.wire[0].body,{...request,relations:original});
  assert.deepEqual(f.credentialCalls[0].input,request);
  assert.equal(f.credentialCalls[0].target.bodySha256,hash('sha256',JSON.stringify(f.wire[0].body)));
  assert.equal(result.argumentsSha256,canonicalSha256(request));assert.deepEqual(call,before);
  assert.deepEqual(result.result,f.state.page);assert.equal(result.argumentsSha256,call.argumentsSha256);
 }
});
test('retained descriptor never filters or silently accepts a missing, extra or substituted relation',async()=>{
 for(const mutate of [p=>p.relations.pop(),p=>p.relations.push({...p.relations[0],name:'state_bills'}),p=>p.relations[0].name='state_bills',p=>p.relations[0].description+='tampered']){
  const f=scene();mutate(f.state.page);
  await assert.rejects(f.handler()(f.call()),{message:'INVALID_RESULT'});
 }
});
test('credential target cannot bind the original body instead of the actual explicit wire selection',async()=>{
 const f=scene();f.state.credentialMutator=receipt=>{receipt.target.bodySha256=hash('sha256','{}');};
 await assert.rejects(f.handler()(f.call()),{message:'ACCESS_DENIED'});assert.equal(f.wire.length,0);
});
test('private describe preserves exact request, current correlation and descriptor through per-call credentials',async()=>{
 const request={source:'client_records',relations:['client_objectives']},f=capiroDataCase('describe_capiro_data',{request});
 f.state.page=withSqlContract(f.page);
 const result=JSON.parse(await f.handler({credentialsForCall:()=>f.transport.getCredentials})(f.call()));
 assert.deepEqual(f.wire[0].body,request);assert.deepEqual(result.result,f.state.page);
 const context=JSON.parse(Buffer.from(f.wire[0].options.headers['x-meri-read-correlation'],'base64url'));
 assert.deepEqual(context.normalizationContext,f.normalizationContext);
});
