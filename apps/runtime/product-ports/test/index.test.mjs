import test from 'node:test';
import assert from 'node:assert/strict';
import {createProductPortsFactory,PRODUCT_FAMILIES} from '../index.mjs';
const code=c=>e=>e?.code===c;
test('the production factory is an ordinary function whose empty family list composes no ports',()=>{
 assert.ok(Array.isArray(PRODUCT_FAMILIES)&&Object.isFrozen(PRODUCT_FAMILIES));
 const factory=createProductPortsFactory();assert.equal(typeof factory,'function');assert.deepEqual(factory({}),{});assert.ok(Object.isFrozen(factory({})));
});
test('family ports are joined, undefined entries skipped, and the trusted context reaches every family',()=>{
 const seen=[],context=Object.freeze({configuration:{}});
 const factory=createProductPortsFactory({families:[['a',c=>{seen.push(c);return {ports:{intentApplication:{handle(){}},unused:undefined}};}],['b',c=>{seen.push(c);return {ports:{settingsApplication:{handle(){}}}};}],['c',()=>({})]]});
 const ports=factory(context);assert.deepEqual(Object.keys(ports),['intentApplication','settingsApplication']);assert.deepEqual(seen,[context,context]);
});
test('duplicate keys, async or Promise-returning families and malformed results are refused',()=>{
 assert.throws(()=>createProductPortsFactory({families:[['a',async()=>({})]]}),code('PRODUCT_PORTS_CONFIGURATION'));
 assert.throws(()=>createProductPortsFactory({families:[['a']]}),code('PRODUCT_PORTS_CONFIGURATION'));
 assert.throws(()=>createProductPortsFactory({families:[['a',()=>({ports:{x:1}})],['b',()=>({ports:{x:2}})]]})({}),code('PRODUCT_PORTS_CONFIGURATION'));
 assert.throws(()=>createProductPortsFactory({families:[['a',()=>Promise.resolve({})]]})({}),code('PRODUCT_PORTS_CONFIGURATION'));
 assert.throws(()=>createProductPortsFactory({families:[['a',()=>null]]})({}),code('PRODUCT_PORTS_CONFIGURATION'));
});
