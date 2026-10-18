/** SYNTHETIC: lifecycle family composition over the shared intents decision adapter and a synthetic Core. No Core or database. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createProductPortsFactory} from '../index.mjs';
import {createLifecycleFamily,createLifecycleFamilyWith} from '../lifecycle.mjs';
import {createIntentsFamily} from '../intents.mjs';
import {captureRuntimePorts,composeRuntimePorts} from '../../product-applications.mjs';
import {productReadiness} from '../../product-readiness.mjs';
const NOW=Date.parse('2026-10-18T12:00:00.000Z');
const code=c=>e=>e?.code===c;
const gate={async admit(){throw Error('not used');},async recheck(){throw Error('not used');}};
function context({intents,withGate=true,calls=[]}={}){
 const call=async(operation,input)=>{calls.push(operation);if(operation!=='approval/decision')throw Error('unexpected');return {decision:null,checkedAtMs:NOW,revoked:false};};
 return Object.freeze({configuration:{sourceEnabled:false,limits:{requestMs:5000,requestBytes:65536},native:{maxResponseBytes:262144},...(intents?{intents}:{})},pool:{connect(){throw Error('no SQL');}},client:{},native:{call},now:()=>NOW,
  canonicalProductPorts:captureRuntimePorts(withGate?{conversationMembership:gate}:{})});
}
const states=(ctx,ports)=>Object.fromEntries(productReadiness({ports:composeRuntimePorts(ctx.canonicalProductPorts,captureRuntimePorts(ports)),sourceEnabled:false}).owners.filter(o=>o.name.startsWith('lifecycle.')).map(o=>[o.name,o.state]));
test('production lifecycle family supplies no transition, admission or approval owner, with intents disabled or enabled',()=>{
 for(const intents of [undefined,{enabled:false},{enabled:true}]){
  const calls=[],ctx=context({intents,calls}),ports=createProductPortsFactory({families:[['lifecycle',createLifecycleFamily]]})(ctx);
  assert.deepEqual(ports,{});assert.deepEqual(calls,[]);
  assert.deepEqual(states(ctx,ports),{'lifecycle.currentAuthority':'unavailable','lifecycle.admissionRetirement':'unavailable','lifecycle.approvals':'unavailable'});
 }
});
test('a proposal reader alone never composes approvals while intents are disabled or ungated',()=>{
 let reads=0;const family=createLifecycleFamilyWith({readProposal:async()=>{reads++;}});
 for(const ctx of [context(),context({intents:{enabled:false}}),context({intents:{enabled:true},withGate:false})])assert.deepEqual(family(ctx).ports,{});
 assert.equal(reads,0);
});
test('with intents composed and a proposal reader, approvals read the reader and the shared Core decision adapter',async()=>{
 const calls=[],seen=[],ctx=context({intents:{enabled:true},calls}),proposal={proposalId:'p'};
 const ports=createProductPortsFactory({families:[['intents',createIntentsFamily],['lifecycle',createLifecycleFamilyWith({readProposal:async v=>{seen.push(v);return proposal;}})]]})(ctx);
 assert.deepEqual(Object.keys(ports),['intentApplication','approvals']);assert.deepEqual(calls,[]);
 assert.equal(await ports.approvals.read({proposalId:'p'}),proposal);assert.deepEqual(seen,[{proposalId:'p'}]);
 assert.equal(await ports.approvals.readDecision({proposalId:'00000000-0000-4000-8000-000000000001',commandSha256:'a'.repeat(64),binding:{}}),null);assert.deepEqual(calls,['approval/decision']);
 assert.deepEqual(states(ctx,ports),{'lifecycle.currentAuthority':'unavailable','lifecycle.admissionRetirement':'unavailable','lifecycle.approvals':'composed'});
});
test('a malformed proposal reader is refused',()=>{
 for(const readProposal of [null,1,{},new Proxy(()=>{},{})])assert.throws(()=>createLifecycleFamilyWith({readProposal}),code('LIFECYCLE_CONFIGURATION'));
});
