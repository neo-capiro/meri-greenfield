import test from 'node:test';
import assert from 'node:assert/strict';
import {createProductPortsFactory,PRODUCT_FAMILIES} from '../index.mjs';
import {captureRuntimePorts} from '../../product-applications.mjs';
const code=c=>e=>e?.code===c;
test('the production factory is an ordinary function; with a production-shaped context and no opt-ins only inert features are composed',()=>{
 assert.ok(Array.isArray(PRODUCT_FAMILIES)&&Object.isFrozen(PRODUCT_FAMILIES));
 assert.deepEqual(PRODUCT_FAMILIES.map(([name])=>name),['settings','intents','tasks','lifecycle','routines','memory','documents','objective']);
 const touched=[],borrowed=name=>new Proxy({},{get(){touched.push(name);throw Error('touched '+name);}});
 const configuration={version:1,profile:'isolated-preview',sourceEnabled:false,limits:{startupMs:1000,shutdownMs:1000,requestMs:5000,requestBytes:65536},
  native:{origin:'https://native.invalid',capabilityFile:'/run/native',loopback:false,maxResponseBytes:262144}};
 const context=Object.freeze({configuration,pool:borrowed('pool'),client:borrowed('client'),native:{call:async()=>{touched.push('native');throw Error('no');}},now:Date.now,canonicalProductPorts:captureRuntimePorts({})});
 const factory=createProductPortsFactory();assert.equal(typeof factory,'function');const ports=factory(context);
 assert.deepEqual(Object.keys(ports).sort(),['routinesApplicationFactory','taskCommandApplicationFactory']);
 assert.equal(ports.routinesApplicationFactory.state(),'disabled');assert.equal(ports.taskCommandApplicationFactory.state(),'disabled');
 assert.ok(Object.isFrozen(ports));assert.deepEqual(touched,[]);
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
