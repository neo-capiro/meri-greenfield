/** SYNTHETIC: the intents family over a trusted execution owner. Inert composition only: no SQL, native call or Core. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createProductPortsFactory} from '../index.mjs';
import {createIntentsFamily,createIntentsFamilyWith,intentsComposition} from '../intents.mjs';
import {createLifecycleFamily} from '../lifecycle.mjs';
import {createTasksFamily} from '../tasks.mjs';
import {captureRuntimePorts} from '../../product-applications.mjs';
const NOW=Date.parse('2026-10-18T12:00:00.000Z');
const code=c=>e=>e?.code===c;
const gate={async admit(){throw Error('not used');},async recheck(){throw Error('not used');}};
function context({intents={enabled:true},calls=[]}={}){
 return Object.freeze({configuration:{sourceEnabled:false,limits:{requestMs:5000,requestBytes:65536},native:{maxResponseBytes:262144},...(intents?{intents}:{})},
  pool:{connect(){calls.push('connect');throw Error('no SQL');}},client:{},native:{call:async op=>{calls.push(op);throw Error('no native');}},now:()=>NOW,
  canonicalProductPorts:captureRuntimePorts({conversationMembership:gate})});
}
function executionOwner({composed=true}={}){
 const s={bound:[],calls:[]};let bound=false;
 return {s,owner:Object.freeze({state:()=>composed&&bound?'composed':'unavailable',bindApprovals(v){s.bound.push(Object.keys(v));bound=true;},
  async contextFor(p){s.calls.push('contextFor');return {binding:p.command.binding,clientResolution:null};},async commandOptionsFor(){s.calls.push('commandOptionsFor');throw Error('synthetic');},async issueExecution(){s.calls.push('issueExecution');throw Error('synthetic');}})};
}
test('the intents family binds the shared decision ports into the execution owner once, inertly, and uses its ports only when composed',async()=>{
 const calls=[],ctx=context({calls}),{s,owner}=executionOwner();
 const ports=createProductPortsFactory({families:[['intents',createIntentsFamilyWith({execution:owner})],['tasks',createTasksFamily],['lifecycle',createLifecycleFamily]]})(ctx);
 assert.deepEqual(Object.keys(ports),['intentApplication','taskCommandApplicationFactory','approvals']);assert.deepEqual(calls,[]);
 assert.deepEqual(s.bound,[['approvalStore','readDecision']]);assert.equal(owner.state(),'composed');
 const shared=intentsComposition(ctx);assert.equal(shared.executionState(),'composed');
 // Same context, another owner: refused rather than silently ignored.
 assert.throws(()=>createIntentsFamilyWith({execution:executionOwner().owner})(ctx),code('PRODUCT_PORTS_CONFIGURATION'));
 assert.doesNotThrow(()=>createIntentsFamilyWith({execution:owner})(ctx));
});
test('disabled intents never bind an execution owner; the default family has none; a malformed owner is refused',()=>{
 for(const intents of [null,{enabled:false}]){
  const {s,owner}=executionOwner(),ports=createProductPortsFactory({families:[['intents',createIntentsFamilyWith({execution:owner})]]})(context({intents}));
  assert.deepEqual(ports,{});assert.deepEqual(s.bound,[]);assert.equal(owner.state(),'unavailable');
 }
 const ctx=context();createProductPortsFactory({families:[['intents',createIntentsFamily]]})(ctx);assert.equal(intentsComposition(ctx).executionState(),'unavailable');
 for(const execution of [null,{},{state(){},bindApprovals(){},contextFor(){},commandOptionsFor(){}},new Proxy({},{})])assert.throws(()=>createIntentsFamilyWith({execution}),code('PRODUCT_PORTS_CONFIGURATION'));
});
test('intents configuration: an optional execution trust block, only when enabled, pure and closed',async()=>{
 const {compileIntentsConfiguration}=await import('../intents.mjs');
 const {productionTrust}=await import('../../native-authority/test/execution-capability-fixture.mjs');
 const t=productionTrust(),execution={coreOrigin:'https://core.example.test',issuer:t.issuer,keys:t.keys,serviceSecretFile:'/run/meri/core-service-secret'};
 assert.deepEqual(compileIntentsConfiguration({intents:{enabled:true,execution}}),{enabled:true,execution});
 assert.deepEqual(compileIntentsConfiguration({intents:{enabled:true}}),{enabled:true});
 for(const bad of [{enabled:false,execution},{enabled:true,execution:{...execution,coreOrigin:'http://core.example.test'}},{enabled:true,execution:{...execution,keys:[{...t.keys[0],crv:'X25519'}]}},
  {enabled:true,execution:{...execution,serviceSecretFile:'relative'}},{enabled:true,execution:{...execution,extra:1}}])
  assert.throws(()=>compileIntentsConfiguration({intents:bad}),code('INTENTS_CONFIGURATION'));
});
