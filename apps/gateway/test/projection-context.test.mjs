import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareProjectionReadContext,assertProjectionConfiguration} from '../dispatch/projection-read-context.mjs';
import {resolveOperationContract} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import catalog from '../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
const id=n=>`${n.repeat(8)}-${n.repeat(4)}-4${n.repeat(3)}-8${n.repeat(3)}-${n.repeat(12)}`;
const authority={binding:{tenantId:id('1'),actorId:id('2')},policyRevision:'p1',subject:{kind:'client',entityType:'client',entityIds:[id('3')]}};
const now=Date.parse('2026-10-13T12:00:00Z');
function context(operation,request={},changes={}) {
 const contract=resolveOperationContract({id:operation,version:'0.2.0'});
 return prepareProjectionReadContext({entry:{contract},request,authority,defaultCongress:119,observedAtMs:now,...changes});
}
test('six canonical private binding profiles compose existing context keys without activating catalog',()=>{
 for(const op of ['search_memory','read_monday_client_boards','get_client_context','find_contacts','resolve_entity','read_client_documents']) {
  const c=resolveOperationContract({id:op,version:'0.2.0'});
  assert.equal(c.binding.dispatchProfile,op==='read_client_documents'?'client-documents/1':'bound-projection/1');
  assert.equal(c.descriptor.handler,null);assert.equal(c.descriptor.qualification,'pending');assert.equal(c.descriptor.availability,'unimplemented');
 }
});
test('memory actor and tenant are current binding, Monday/contact contexts empty',()=>{
 assert.deepEqual(context('search_memory').options(),{tenantId:id('1'),userId:id('2')});
 assert.deepEqual(context('read_monday_client_boards').options(),{});assert.deepEqual(context('find_contacts').options(),{});
});
test('profile observation is immutable while decision lineage can refresh',()=>{
 const c=context('get_client_context',{clientId:' Acme '});
 assert.deepEqual(c.options(),{asOf:new Date(now).toISOString(),clientResolution:{selector:'Acme',clientId:id('3')}});
 const current=structuredClone(authority);current.subject.authorizationDecisionId=id('4');
 assert.deepEqual(c.options(current),c.options());c.observeAuthority(current);
});
test('document lineage uses current authority, never the prior decision',()=>{
 const c=context('read_client_documents',{clientId:id('3')});const current=structuredClone(authority);current.subject.authorizationDecisionId=id('4');
 assert.deepEqual(c.options(current),{binding:current.binding,subject:current.subject});
});
test('Congress requires explicit trusted configuration',()=>{
 assert.deepEqual(context('resolve_entity').options(),{defaultCongress:119});
 assert.throws(()=>context('resolve_entity',{}, {defaultCongress:undefined}),/UNAVAILABLE/);
 for(const value of [null,0,1.5,'119',2147483648])assert.throws(()=>assertProjectionConfiguration(value),/GATEWAY_CONFIGURATION/);
 assertProjectionConfiguration(undefined);assertProjectionConfiguration(119);
});
for(const op of ['search_memory','read_monday_client_boards','find_contacts','read_client_documents'])test(`${op}: another client selector cannot expand selected scope`,()=>{
 assert.throws(()=>context(op,{clientId:id('4')}),/ACCESS_DENIED/);
 const personal=structuredClone(authority);personal.subject.kind='personal';
 assert.throws(()=>context(op,{clientId:id('3')},{authority:personal}),/ACCESS_DENIED/);
});
for(const key of ['tenantId','actorId'])test(`${key}: current authority substitution is refused`,()=>{
 const c=context('search_memory'),current=structuredClone(authority);current.binding[key]=id('4');
 assert.throws(()=>c.options(current),/ACCESS_DENIED/);
});
test('changed policy revision and unsupported canonical context are refused',()=>{
 assert.throws(()=>context('get_client_context',{clientId:id('3')}).options({...authority,policyRevision:'p2'}),/ACCESS_DENIED/);
 assert.throws(()=>context('query_intelligence'),/GATEWAY_CONFIGURATION/);
});
