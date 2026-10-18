/** SYNTHETIC actual control assembly: borrowed SQL/Core/Temporal/session boundaries. No network or secret read. */
import test from 'node:test';import assert from 'node:assert/strict';
import {assembleControl} from '../../control.mjs';
import {productReadiness} from '../../product-readiness.mjs';
import {createMemoryFamilyWith,memoryComposition,bindMemoryRetention} from '../memory.mjs';
import {createProductPortsFactory} from '../index.mjs';
import {versions,binding} from '../../../control/conversations/test/store-fixture.mjs';
const unused=()=>{throw Error('Unexpected external effect');};
const configuration={sourceEnabled:false,http:{hostname:'127.0.0.1',port:0,frontendOrigin:'http://127.0.0.1'},limits:{requestMs:1000,requestBytes:131072,shutdownMs:1000},native:{maxResponseBytes:131072},temporal:{taskQueue:'synthetic'},sessions:{maxSessions:10,maxTtlMs:3000},versions,
 memory:{enabled:true,origin:'https://core.invalid',serviceSecretFile:'/run/meri/memory-service'},retention:{enabled:true}};
test('actual control binds memory to its canonical retention gate without opening the unrecovered fence',async()=>{
 let context;
 const factory=createProductPortsFactory({families:[['memory',createMemoryFamilyWith({readSecret:unused,fetchImpl:unused})]]});
 const assembly=assembleControl({configuration,pool:{query:unused,connect:unused},client:{workflow:{start:unused,getHandle:unused}},native:{call:unused},
  canonicalProductPorts:{conversationMembership:{admit:unused,recheck:unused}},
  productPortsFactory(c){context=c;const ports=factory(c);assert.equal(memoryComposition(c).retentionBound(),false);return ports;}});
 try{
  assert.equal(memoryComposition(context).retentionBound(),true);
  assert.equal(bindMemoryRetention(context,assembly.retention.gate),true,'exact gate identity is shared');
  assert.equal(assembly.productReadiness().owners.find(o=>o.name==='memory.producer').state,'composed');
  assert.ok(assembly.productReadiness().missingOwners.includes('retention.ledgerSink'));
  await assert.rejects(assembly.retention.gate.assertServable({tenantId:binding.tenantId,kind:'conversation',subjectId:binding.conversationId}));
  await assert.rejects(assembly.retention.startup.ensureServing(),{code:'RETENTION_LEDGER_UNAVAILABLE'});
  assert.equal(assembly.retention.startup.purge.enabled,false);
 }finally{assembly.close();}
});
test('memory readiness requires both a captured route and the successful canonical bind',()=>{
 for(const [configuredOwners,memoryRetentionBound,state] of [[['memoryApplication'],false,'unavailable'],[['memoryApplication'],undefined,'unavailable'],[[],true,'unavailable'],[['memoryApplication'],true,'composed']]){
  const result=productReadiness({ports:{configuredOwners},retention:{},sourceEnabled:false,memoryRetentionBound});
  assert.equal(result.owners.find(o=>o.name==='memory.producer').state,state);assert.equal(result.ready,false);
 }
});
