/** Source-only profile controls. No adapter, database, model or network calls. */
import test from 'node:test';
import assert from 'node:assert/strict';
import catalog from '../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import * as contracts from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {prepareActionReadContext} from '../dispatch/action-read-context.mjs';
import {assertDispatchResult} from '../dispatch/read-result-envelope.mjs';
import {createRuntimeCatalog} from '../catalog/runtime-catalog.mjs';
import {fixture,uuid} from './fixtures.mjs';

const operation={id:'actions.query',version:'0.2.0'},clientId=uuid('a');
function selected(){
  const f=fixture(),scope={tenantId:f.binding.tenantId,kind:'client',resourceId:clientId,policyRevision:f.claims.policyRevision};
  return {binding:f.binding,policyRevision:f.claims.policyRevision,
    subject:{...f.subject,kind:'client',entityType:'client',entityIds:[clientId],scopes:[scope]}};
}
test('complete action profile resolves the currently selected UUID through actual canonical contract',()=>{
  const authority=selected(),request={clientId:` ${clientId.toUpperCase()} `,limit:7};
  const context=prepareActionReadContext({request,authority}),contract=contracts.resolveOperationContract(operation);
  assert.equal(contract.binding.dispatchProfile,'actions-complete/1');
  const normalized=contract.normalizeInput(request,context.options());
  assert.equal(normalized.input.mode,'client_scoped');
  assert.equal(normalized.input.selection.clientId,clientId);
  assert.equal(normalized.input.selection.limit,7);
  assert.equal(normalized.argumentsSha256,canonicalSha256(normalized.input));
  assert.equal(normalized.request.clientId,request.clientId);
});
for(const request of [{},{clientId:null},{clientId:'Client Name'}])test('unqualified action list/name resolution remains unavailable',()=>{
  assert.throws(()=>prepareActionReadContext({request,authority:selected()}),/UNAVAILABLE/);
});
for(const mutate of [a=>a.subject.entityIds=[uuid('b')],a=>a.subject.entityIds.push(uuid('b')),
  a=>a.subject.kind='personal',a=>a.subject.entityType='user'])test('current policy subject must select the exact requested single client',()=>{
  const authority=selected();mutate(authority);
  assert.throws(()=>prepareActionReadContext({request:{clientId},authority}),/ACCESS_DENIED/);
});
test('later context observations refuse changed binding/policy/client while allowing fresh decision IDs',()=>{
  const authority=selected(),context=prepareActionReadContext({request:{clientId},authority});
  for(const mutate of [a=>a.binding.writerFence++,a=>a.policyRevision='changed',a=>a.subject.entityIds=[uuid('b')]]){
    const current=structuredClone(authority);mutate(current);assert.throws(()=>context.observeAuthority(current),/ACCESS_DENIED/);
  }
  const current=structuredClone(authority);current.subject.authorizationDecisionId=uuid('c');
  assert.deepEqual(context.options(current),context.options());
});
test('complete action envelope rejects wrong operation/digest and extra fields before family validation',()=>{
  const authority=selected(),normalized={request:{clientId},argumentsSha256:'a'.repeat(64)};
  let validations=0;const entry={descriptor:{operation},contract:{binding:{dispatchProfile:'actions-complete/1'},assertOutput(){validations++;}}};
  const context={options:()=>({})},original={binding:authority.binding,subject:authority.subject,operation,argumentsSha256:normalized.argumentsSha256,result:{}};
  for(const mutate of [o=>o.operation={id:'query_action_items',version:'0.2.0'},o=>o.argumentsSha256='b'.repeat(64),o=>o.extra=true]){
    const output=structuredClone(original);mutate(output);assert.throws(()=>assertDispatchResult({entry,output,authority,normalized,context}),/INVALID_RESULT/);
  }
  assert.equal(validations,0);
});
test('all97 canonical entries and complete action handler remain unavailable',()=>{
  assert.equal(catalog.operations.length,97);
  assert.ok(catalog.operations.every(row=>row.availability!=='enabled'&&row.qualification==='pending'&&row.handler===null));
  const view=createRuntimeCatalog({catalogJson:JSON.stringify(catalog),contracts});
  assert.equal(view.entry(operation),null);assert.deepEqual(view.discoverable(),[]);
});
