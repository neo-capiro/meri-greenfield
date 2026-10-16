/** SYNTHETIC owner/SQL transport; real READS verifier, admission, gateway and response receiver. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createPreparedNativeReads,captureReadRuntimeOptions} from '../prepared-reads.mjs';
import {createNativeReadsClient} from '../reads-client.mjs';
import {readsFixture} from './reads-fixture.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
const client=(f,p)=>createNativeReadsClient({...f.clientConfiguration,fetchImpl:(url,init)=>p.application.handle(new Request(url,init))});
test('per-entry factory receives canonical READS verifier, same task capability and immutable config',async()=>{
 const f=await readsFixture();let seen,calls=0;const p=createPreparedNativeReads({...f.verifierConfiguration,binding:f.binding,taskCapability:f.credential,createReadsRuntime(tuple){calls++;seen=tuple;return f.mount();}}),c=client(f,p);
 assert.equal(calls,1);assert.deepEqual(Object.keys(seen).sort(),['approvedReads','taskCapability','taskVerifier']);assert.equal(seen.taskCapability,f.credential);assert.deepEqual(seen.approvedReads,f.config);assert.ok(Object.isFrozen(seen));assert.ok(Object.isFrozen(seen.approvedReads));
 const a=await seen.taskVerifier.verify({capability:seen.taskCapability,binding:f.binding,operation:'runner/reads/availability',inputSha256:hash(f.request),deadlineMs:f.deadlineMs});assert.equal('identityCredential'in a,false);assert.equal(a.taskArn,f.entry.taskArn);
 const available=await c.readAvailability();assert.ok(available.installation.operations.length);assert.equal(typeof await c.execute({operation:f.operation,arguments:f.arguments,deliveryId:'factory:synthetic:1'}),'string');assert.equal(calls,1);assert.ok(f.commands.length>0);assert.ok(f.commands.every(s=>!s.includes('FOR UPDATE')));
});
test('source disabled, omitted config or missing entry/task cap never invokes factory',async()=>{
 const f=await readsFixture();for(const patch of [{enabled:false},{approvedReads:undefined},{approvedReads:{...f.config,enabled:false}},{readCurrentEntry:undefined},{taskCapability:undefined}]){
  let calls=0;const p=createPreparedNativeReads({...f.verifierConfiguration,binding:f.binding,taskCapability:f.credential,createReadsRuntime(){calls++;return f.mount();},...patch});await assert.rejects(client(f,p).readAvailability());assert.equal(calls,0);
 }
});
test('missing genuine business gateway returns unavailable without making task or source reads',async()=>{
 const f=await readsFixture();let calls=0;const before=f.commands.length,p=createPreparedNativeReads({...f.verifierConfiguration,binding:f.binding,taskCapability:f.credential,createReadsRuntime(){calls++;return undefined;}});assert.equal(calls,1);await assert.rejects(client(f,p).readAvailability());assert.equal(f.commands.length,before);
});
test('ambiguous prebuilt/factory and asynchronous factories are rejected',async()=>{
 const f=await readsFixture();let calls=0;assert.throws(()=>createPreparedNativeReads({...f.verifierConfiguration,binding:f.binding,gateway:f.mount(),taskCapability:f.credential,createReadsRuntime(){calls++;return f.mount();}}),/CONFIGURATION/);assert.equal(calls,0);
 assert.throws(()=>createPreparedNativeReads({...f.verifierConfiguration,binding:f.binding,taskCapability:f.credential,createReadsRuntime:()=>Promise.resolve(f.mount())}),/CONFIGURATION/);
});
test('invalid/proxy factory and accessor gateway reject without evaluating getters',()=>{
 assert.throws(()=>captureReadRuntimeOptions({createReadsRuntime:'module-name'}));assert.throws(()=>captureReadRuntimeOptions({createReadsRuntime:async()=>undefined}));assert.throws(()=>captureReadRuntimeOptions({createReadsRuntime:new Proxy(()=>{}, {})}));let getters=0;const gateway={execute(){}};Object.defineProperty(gateway,'readAvailability',{get(){getters++;return ()=>{};}});assert.throws(()=>captureReadRuntimeOptions({generalReads:gateway}));assert.equal(getters,0);assert.deepEqual(captureReadRuntimeOptions(),{});
});
