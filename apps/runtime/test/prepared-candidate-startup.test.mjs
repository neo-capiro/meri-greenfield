/** Real startControl path for multi-run mode: the durable issuance store and the file-backed capability authority are composed by
 * trusted startup from the control database pool and the configured owner-only directory, and handed to the prepared candidate;
 * a declared multi-run mode without the material directory composes no authority and startup fails with ordered cleanup. */
import test,{mock} from 'node:test';import assert from 'node:assert/strict';
import * as configurationModule from '../config.mjs';
import {WorkflowIdReusePolicy,WorkflowIdConflictPolicy} from '@temporalio/client';
import {candidateFixture} from './prepared-candidate-fixture.mjs';
import {capabilityDigest} from '../native-authority/task-verifier.mjs';
const f=candidateFixture(),order=[],received=[];
f.configuration.http={...f.configuration.http,hostname:'127.0.0.1',port:0};
mock.module('pg',{namedExports:{Pool:class{async query(){return {rows:[{runs:'runs',events:'events',controls:'controls',selected_outputs:'selected_outputs'}]};}connect(){throw Error('No SQL effects');}async end(){order.push('pool-close');}}}});
mock.module('@temporalio/client',{namedExports:{WorkflowIdReusePolicy,WorkflowIdConflictPolicy,Connection:{async connect(){return {withDeadline(_at,method){return method();},withAbortSignal(_signal,method){return method();},workflowService:{async getSystemInfo(){}},async close(){order.push('temporal-close');}};}},Client:class{workflow={start:async()=>{},getHandle:()=>({})};}}});
mock.module('../config.mjs',{namedExports:{...configurationModule,async readSecret(path){return Buffer.from(path===f.configuration.database.connectionFile?'postgres://synthetic.invalid/meri?sslmode=verify-full':f.secret.control);}}});
mock.module('../prepared-candidate.mjs',{namedExports:{async startPreparedCandidate(options){received.push(options);const {createPreparedRunBindings}=await import('../prepared-run-bindings.mjs');
 // The real bindings composition decides readiness from the supplied owners exactly as startPreparedCandidate does.
 createPreparedRunBindings({configuration:options.configuration,pool:options.pool,store:{allocations:{async read(){return null;}},async readOptional(){return null;}},credentials:{proxy:'synthetic-proxy',control:f.secret.control},issuanceStore:options.issuanceStore,capabilityAuthority:options.capabilityAuthority,limits:{maxRequestMs:1000,maxFactBytes:131072}});
 return {controlCapabilitySha256:capabilityDigest(f.secret.control),native:{async readiness(){},async call(){throw Error('No authority effects');}},identityContext:{async verifyIdentity(){throw Error('No user issuance');},async resolveContext(){throw Error('No user issuance');}},application:{async handle(){return null;}},bindApplication(){},async close(){order.push('candidate-close');}};}}});
const {startControl,multiRunOwners}=await import('../control.mjs');
test('a declared multi-run mode with the material directory reaches the candidate with the durable store over the pool and the file authority; without the directory the bindings refuse and startup fails after ordered cleanup',async()=>{
 const configured=structuredClone(f.configuration);configured.nativeCandidate.multiRun={runWindowMs:600000,materialDirectory:'/run/meri/material'};
 const runtime=await startControl(configured,{});try{assert.equal(received.length,1);assert.equal(typeof received[0].issuanceStore?.claim,'function');assert.equal(typeof received[0].capabilityAuthority?.generate,'function');assert.equal(received[0].capabilityAuthority.directory,'/run/meri/material');}finally{await runtime.close();}
 assert.deepEqual(order,['candidate-close','temporal-close','pool-close']);order.length=0;received.length=0;
 const partial=structuredClone(f.configuration);partial.nativeCandidate.multiRun={runWindowMs:600000};
 await assert.rejects(startControl(partial,{}),/CONTROL_STARTUP_FAILED/,'a multi-run declaration without a material directory has no capability authority');assert.equal(received.length,1);assert.equal(received[0].capabilityAuthority,undefined);assert.equal(typeof received[0].issuanceStore?.claim,'function');
 assert.deepEqual(order,['temporal-close','pool-close'],'the failed startup still closes what it opened, in order');
 assert.deepEqual(multiRunOwners(f.configuration,{query(){}}),{},'no multi-run declaration composes no owners');
});
