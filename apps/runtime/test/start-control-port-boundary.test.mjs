/** SYNTHETIC actual startControl, with borrowed SQL/Temporal/native/listener doubles. No real services, secrets or sockets. */
import {test,mock} from 'node:test';import assert from 'node:assert/strict';
import * as configModule from '../config.mjs';
import {WorkflowIdReusePolicy,WorkflowIdConflictPolicy} from '@temporalio/client';
import {candidateFixture} from './prepared-candidate-fixture.mjs';
import {capabilityDigest} from '../native-authority/task-verifier.mjs';
const sample=candidateFixture();let calls;
// Preparation path qualification is covered separately on the Linux runtime. This boundary control
// borrows its compiler so the Windows host can exercise the real startControl composition path.
mock.module('../prepared-candidate-config.mjs',{namedExports:{compilePreparedCandidateConfiguration(){return {};}}});
mock.module('pg',{namedExports:{Pool:class{constructor(){calls.pool++;}async query(){return {rows:[{runs:'runs',events:'events',controls:'controls',selected_outputs:'outputs'}]};}connect(){throw Error('No SQL effects');}async end(){calls.poolClosed++;}}}});
mock.module('@temporalio/client',{namedExports:{WorkflowIdReusePolicy,WorkflowIdConflictPolicy,Connection:{async connect(){calls.connection++;return {async withDeadline(_at,fn){return fn();},workflowService:{async getSystemInfo(){}},async close(){calls.connectionClosed++;}};}},Client:class{workflow={start(){throw Error('No dispatch');},getHandle(){return {};}};}}});
mock.module('../config.mjs',{namedExports:{...configModule,async readSecret(path){calls.secrets++;return Buffer.from(path===sample.configuration.database.connectionFile?'postgres://synthetic.invalid/meri?sslmode=verify-full':sample.secret.control);}}});
mock.module('../native-client.mjs',{namedExports:{createNativeCapabilityClient(){return {async readiness(){calls.nativeReady++;},async call(){throw Error('No native effect');}};}}});
mock.module('../http-server.mjs',{namedExports:{async listenRuntime({application,readiness}){calls.listeners++;calls.application=application;calls.readiness=readiness;return {address:{port:12345},async close(){calls.listenerClosed++;}};}}});
mock.module('../prepared-candidate.mjs',{namedExports:{async startPreparedCandidate(){calls.prepared++;const identityContext={async verifyIdentity(){throw Error('Unavailable');},async resolveContext(){throw Error('Unavailable');}};return {controlCapabilitySha256:capabilityDigest(sample.secret.control),
 identityContext,productPorts:{identityContext},native:{async readiness(){},async call(){throw Error('No native effect');}},
 application:{async handle(){return null;}},bindApplication(){calls.bound++;},async close(){calls.preparedClosed++;}};}}});
const {startControl}=await import('../control.mjs');
const {captureRuntimePorts}=await import('../product-applications.mjs');
const reset=()=>calls={pool:0,poolClosed:0,connection:0,connectionClosed:0,secrets:0,listeners:0,listenerClosed:0,nativeReady:0,prepared:0,preparedClosed:0,bound:0};
for(const mode of ['default','direct','factory','prepared'])test(`actual startControl ${mode} path reaches listener and closes only its own resources`,async()=>{
 reset();const configuration=structuredClone(sample.configuration);if(mode!=='prepared')delete configuration.nativeCandidate;
 let factories=0;const options=mode==='direct'?{productPorts:{}}:mode==='factory'?{productPortsFactory(){factories++;return {};}}:{};
 const runtime=await startControl(configuration,options);
 try{assert.equal(calls.listeners,1);assert.equal(factories,mode==='factory'?1:0);
  const r=await calls.application.handle(new Request('https://meri.invalid/api/conversations/transcript',{method:'POST',headers:{authorization:'Bearer synthetic','content-type':'application/json'},body:'{}'}));assert.equal(r.status,503);
  const ready=await calls.readiness({});assert.equal(ready.product.ready,false);assert.ok(ready.product.missingOwners.includes('history.membership'));
  assert.equal(calls.prepared,mode==='prepared'?1:0);assert.equal(calls.bound,mode==='prepared'?1:0);
 }finally{await runtime.close();}
 assert.equal(calls.listenerClosed,1);assert.equal(calls.poolClosed,1);assert.equal(calls.connectionClosed,1);assert.equal(calls.preparedClosed,mode==='prepared'?1:0);
});

for(const mode of ['direct','factory'])test(`prepared startup composes supplemental ${mode} membership without replacing canonical identity`,async()=>{
 reset();const configuration=structuredClone(sample.configuration);let invoked=0;
 const conversationMembership={async admit(){invoked++;throw Object.assign(Error('synthetic-denial'),{code:'not trusted'});},async recheck(){throw Error('No release');}};
 const runtime=await startControl(configuration,mode==='direct'?{productPorts:{conversationMembership}}:{productPortsFactory(context){assert.ok(context.canonicalProductPorts.configuredOwners.includes('identityContext'));return {conversationMembership};}});
 try{const ready=await calls.readiness({});assert.equal(ready.product.owners.find(o=>o.name==='history.membership').state,'composed');
  await calls.application.handle(new Request('https://meri.invalid/api/conversations/list',{method:'POST',headers:{authorization:'Bearer synthetic','content-type':'application/json'},body:'{}'}));assert.equal(invoked,1);
 }finally{await runtime.close();}assert.equal(calls.preparedClosed,1);assert.equal(calls.poolClosed,1);assert.equal(calls.connectionClosed,1);
});

test('prepared identity override refuses before listener and closes all startup-owned resources',async()=>{
 reset();await assert.rejects(startControl(structuredClone(sample.configuration),{productPorts:{identityContext:{async verifyIdentity(){},async resolveContext(){}}}}),{code:'CONTROL_STARTUP_FAILED'});
 assert.equal(calls.listeners,0);assert.equal(calls.preparedClosed,1);assert.equal(calls.poolClosed,1);assert.equal(calls.connectionClosed,1);
});
test('only the exact privately captured object is idempotent; copying configuredOwners is rejected before effects',async()=>{
 const captured=captureRuntimePorts();assert.equal(captureRuntimePorts(captured),captured);
 assert.throws(()=>captureRuntimePorts({...captured}));assert.throws(()=>captureRuntimePorts({configuredOwners:['transitionAuthority']}));
 reset();const configuration=structuredClone(sample.configuration);delete configuration.nativeCandidate;
 await assert.rejects(startControl(configuration,{productPorts:{configuredOwners:['identityContext']}}));assert.equal(calls.secrets,0);assert.equal(calls.listeners,0);
});
