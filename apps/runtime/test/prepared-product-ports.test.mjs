/** SYNTHETIC composition controls. Linux plan/compiler, allocation and kickoff are borrowed;
 * actual prepared candidate and remote controller expose the same SDK owners. No native process/DB/provider. */
import {test,mock} from 'node:test';import assert from 'node:assert/strict';
import {candidateFixture} from './prepared-candidate-fixture.mjs';
import {createExecutionBinding} from '../../control/conversations/execution-boundary.mjs';
import {capabilityDigest} from '../native-authority/task-verifier.mjs';
const f=candidateFixture(),config=f.configuration.nativeCandidate,original=createExecutionBinding({binding:f.binding,versions:f.configuration.versions,plan:config.plan,expiresAtMs:config.runtime.deadlineMs});
let lazy,sessionCalls=0,controllerClosed=0,allocations=0,captured;
const sdkSessionOwner=Object.freeze(Object.fromEntries(['register','load','append','listSubkeys'].map(method=>[method,async function(value){sessionCalls++;return {method,request:value.request};}]))),continuation={async prepare(){},async readSnapshot(value){return value;}};
mock.module('../prepared-candidate-config.mjs',{namedExports:{compilePreparedCandidateConfiguration(value){return value;}}});
mock.module('../native-authority/broker-stack.mjs',{namedExports:{compileNativeBrokerPlan(){return {original,preparationIntent:config.preparationIntent};}}});
mock.module('../native-authority/prepared-kickoff.mjs',{namedExports:{createPreparedTaskKickoff({controller}){lazy=controller;return {async kickoff(){},async status(){},async stop(){},async close(){await controller.close();}};}}});
mock.module('../native-authority/prepared-runtime.mjs',{namedExports:{createPreparedNativeRuntime(){return {original,runtime:{taskCapabilitySha256:capabilityDigest(f.secret.task),async runtime(){}},preparationAuthorizer:{},async prepareAllocation(){throw Error('No allocation');},async close(){}};}}});
mock.module('../native-authority/session-owner.mjs',{namedExports:{createDurableSdkSessionOwner(options){captured=options;return sdkSessionOwner;}}});
const {assemblePreparedCandidate}=await import('../prepared-candidate.mjs');
const {createRemoteNativeController}=await import('../native-authority/remote-composition.mjs');
const pool={connect(){throw Error('No SQL');}},objects={async get(){throw Error('No object');}};

test('prepared SDK ports refuse before allocation, then borrow the same owner and refuse foreign bindings/after close',async()=>{
 const candidate=assemblePreparedCandidate({configuration:f.configuration,pool,ecs:{},objects,credentials:f.secret,
  allocate(){allocations++;return {resource:{taskArn:'synthetic'},productPorts:{sdkSessionOwner,sdkSessionSnapshot:continuation},async close(){controllerClosed++;}};}});
 const value={credential:'synthetic-task',request:{binding:f.binding}};
 assert.equal(allocations,0);assert.equal(candidate.productPorts.identityContext,candidate.identityContext);assert.equal(candidate.productPorts.conversationTurns,undefined);
 assert.throws(()=>candidate.productPorts.sdkSessionOwner.load(value),{code:'SDK_SESSION_UNAVAILABLE'});assert.equal(sessionCalls,0);
 await lazy.allocate();assert.equal(allocations,1);assert.deepEqual(await candidate.productPorts.sdkSessionOwner.load(value),{method:'load',request:value.request});
 assert.throws(()=>candidate.productPorts.sdkSessionOwner.load({...value,request:{binding:{...f.binding,actorId:'foreign'}}}),{code:'SDK_SESSION_UNAVAILABLE'});assert.equal(sessionCalls,1);
 await candidate.close();assert.equal(controllerClosed,1);assert.throws(()=>candidate.productPorts.sdkSessionOwner.load(value),{code:'SDK_SESSION_UNAVAILABLE'});
});

test('remote controller exposes exactly the durable session owner built with its canonical admission/verifier/registration',async()=>{
 const admission={},taskVerifier={async verify(){throw Error('No authority');}},supervisor={admission,taskVerifier},transport={original,origin:config.taskOrigin,credential:f.secret.control,async fetchImpl(){throw Error('No transport');}};
 const {capabilityDigest}=await import('../native-authority/task-verifier.mjs');
 const controller=createRemoteNativeController({runtimeConfiguration:{runtime:{...config.runtime,proxyCredential:f.secret.proxy},plan:config.plan,preparationIntent:config.preparationIntent,supervisor,store:{},taskCapability:f.secret.task,controlCapabilitySha256:capabilityDigest(f.secret.control),continuation,enabled:true},transport});
 assert.equal(controller.productPorts.sdkSessionOwner,sdkSessionOwner);assert.equal(controller.productPorts.sdkSessionSnapshot,continuation);
 assert.equal(captured.admission,admission);assert.equal(captured.authority,taskVerifier);assert.equal(typeof captured.registration.read,'function');
 assert.ok(Object.isFrozen(controller.productPorts));assert.equal(allocations,1);
});
