import test from 'node:test';
import assert from 'node:assert/strict';
import {createProductPortsFactory,PRODUCT_FAMILIES} from '../index.mjs';
import {captureRuntimePorts} from '../../product-applications.mjs';
const code=c=>e=>e?.code===c;
test('the production factory is an ordinary function; with a production-shaped context and no opt-ins only inert features are composed',()=>{
 assert.ok(Array.isArray(PRODUCT_FAMILIES)&&Object.isFrozen(PRODUCT_FAMILIES));
 assert.deepEqual(PRODUCT_FAMILIES.map(([name])=>name),['settings','intents','tasks','lifecycle','routines','memory','documents','objective','uploads']);
 const touched=[],borrowed=name=>new Proxy({},{get(){touched.push(name);throw Error('touched '+name);}});
 const configuration={version:1,profile:'isolated-preview',sourceEnabled:false,limits:{startupMs:1000,shutdownMs:1000,requestMs:5000,requestBytes:65536},
  native:{origin:'https://native.invalid',capabilityFile:'/run/native',loopback:false,maxResponseBytes:262144}};
 const context=Object.freeze({configuration,pool:borrowed('pool'),client:borrowed('client'),native:{call:async()=>{touched.push('native');throw Error('no');}},now:Date.now,canonicalProductPorts:captureRuntimePorts({})});
 const factory=createProductPortsFactory();assert.equal(typeof factory,'function');const ports=factory(context);
 assert.deepEqual(Object.keys(ports).sort(),['actionApplicationFactory','routinesApplicationFactory','taskCommandApplicationFactory']);
 assert.equal(ports.actionApplicationFactory.state(),'disabled');assert.equal(ports.routinesApplicationFactory.state(),'disabled');assert.equal(ports.taskCommandApplicationFactory.state(),'disabled');
 assert.ok(Object.isFrozen(ports));assert.deepEqual(touched,[]);
});
test('family ports are joined, undefined entries skipped, and the trusted context reaches every family',()=>{
 const seen=[],context=Object.freeze({configuration:{}});
 const factory=createProductPortsFactory({families:[['a',c=>{seen.push(c);return {ports:{intentApplication:{handle(){}},unused:undefined}};}],['b',c=>{seen.push(c);return {ports:{settingsApplication:{handle(){}}}};}],['c',()=>({})]]});
 const ports=factory(context);assert.deepEqual(Object.keys(ports),['intentApplication','settingsApplication']);assert.deepEqual(seen,[context,context]);
});
test('a per-family context extension reaches only the named family and leaves the shared context identity intact',()=>{
 // The shared context is closed by the memory and intents families and is identity-keyed by the retention/session
 // binders, so CONTROL must never widen it: it declares the extra key for one family only.
 const closed=context=>{for(const key of Object.keys(context))if(!['configuration','pool'].includes(key))throw Object.assign(Error('PRODUCT_PORTS_CONFIGURATION'),{code:'PRODUCT_PORTS_CONFIGURATION'});return {ports:{}};};
 assert.throws(()=>closed(Object.freeze({configuration:{},pool:{},uploadsInspection:{}})),code('PRODUCT_PORTS_CONFIGURATION'),'the closure above is why the shared context cannot carry the mount');
 const context=Object.freeze({configuration:{},pool:{}});
 const seen=new Map(),uploads=extended=>{seen.set('uploads',extended);return {ports:{uploadApplicationFactory:{state:()=> 'composed'}}};};
 const identity=[],record=extended=>{identity.push(extended);return {ports:{}};};
 const mounted={inspect:async()=>({status:'unavailable'})};
 const ports=createProductPortsFactory({families:[['memory',record],['uploads',uploads]]})(context,{uploads:{uploadsInspection:mounted}});
 assert.equal(identity[0],context,'an unnamed family still receives the shared context object itself');
 assert.equal(seen.get('uploads').uploadsInspection,mounted,'only the named family sees the extra key');
 assert.equal(seen.get('uploads').configuration,context.configuration);
 assert.equal(ports.uploadApplicationFactory.state(),'composed');
 assert.deepEqual(createProductPortsFactory({families:[['a',record]]})(context),{},'no extras means no extension at all');
});
test('duplicate keys, async or Promise-returning families and malformed results are refused',()=>{
 assert.throws(()=>createProductPortsFactory({families:[['a',async()=>({})]]}),code('PRODUCT_PORTS_CONFIGURATION'));
 assert.throws(()=>createProductPortsFactory({families:[['a']]}),code('PRODUCT_PORTS_CONFIGURATION'));
 assert.throws(()=>createProductPortsFactory({families:[['a',()=>({ports:{x:1}})],['b',()=>({ports:{x:2}})]]})({}),code('PRODUCT_PORTS_CONFIGURATION'));
 assert.throws(()=>createProductPortsFactory({families:[['a',()=>Promise.resolve({})]]})({}),code('PRODUCT_PORTS_CONFIGURATION'));
 assert.throws(()=>createProductPortsFactory({families:[['a',()=>null]]})({}),code('PRODUCT_PORTS_CONFIGURATION'));
});
