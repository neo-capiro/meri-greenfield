/** Real startControl path for multi-run mode: the durable issuance store and the file-backed capability authority are composed by
 * trusted startup from the control database pool and the configured owner-only directory, and handed to the prepared candidate;
 * a declared multi-run mode without the material directory composes no authority and startup fails with ordered cleanup. */
import test,{mock} from 'node:test';import assert from 'node:assert/strict';
import * as configurationModule from '../config.mjs';
import {WorkflowIdReusePolicy,WorkflowIdConflictPolicy} from '@temporalio/client';
import {candidateFixture} from './prepared-candidate-fixture.mjs';
import {capabilityDigest} from '../native-authority/task-verifier.mjs';
const f=candidateFixture(),order=[],received=[],schema={missing:false,queried:[]};
f.configuration.http={...f.configuration.http,hostname:'127.0.0.1',port:0};
mock.module('pg',{namedExports:{Pool:class{async query(sql,args){schema.queried.push(sql);if(sql.includes('unnest'))return {rows:args[0].map(name=>({name,relation:schema.missing&&name.endsWith('retention_purge_targets')?null:name}))};return {rows:[{runs:'runs',events:'events',controls:'controls',selected_outputs:'selected_outputs'}]};}connect(){throw Error('No SQL effects');}async end(){order.push('pool-close');}}}});
mock.module('@temporalio/client',{namedExports:{WorkflowIdReusePolicy,WorkflowIdConflictPolicy,Connection:{async connect(){return {withDeadline(_at,method){return method();},withAbortSignal(_signal,method){return method();},workflowService:{async getSystemInfo(){}},async close(){order.push('temporal-close');}};}},Client:class{workflow={start:async()=>{},getHandle:()=>({})};}}});
mock.module('../config.mjs',{namedExports:{...configurationModule,async readSecret(path){return Buffer.from(path===f.configuration.database.connectionFile?'postgres://synthetic.invalid/meri?sslmode=verify-full':f.secret.control);}}});
mock.module('../prepared-candidate.mjs',{namedExports:{async startPreparedCandidate(options){received.push(options);const {createPreparedRunBindings}=await import('../prepared-run-bindings.mjs');
 // The real bindings composition decides readiness from the supplied owners exactly as startPreparedCandidate does.
 if(options.configuration.nativeCandidate.multiRun!==undefined)createPreparedRunBindings({configuration:options.configuration,pool:options.pool,store:{allocations:{async read(){return null;}},async readOptional(){return null;}},credentials:{proxy:'synthetic-proxy',control:f.secret.control},issuanceStore:options.issuanceStore,capabilityAuthority:options.capabilityAuthority,modelGrants:options.modelGrants,limits:{maxRequestMs:1000,maxFactBytes:131072}});
 return {controlCapabilitySha256:capabilityDigest(f.secret.control),native:{async readiness(){},async call(){throw Error('No authority effects');}},identityContext:{async verifyIdentity(){throw Error('No user issuance');},async resolveContext(){throw Error('No user issuance');}},application:{async handle(){return null;}},bindApplication(){},async close(){order.push('candidate-close');}};}}});
const {startControl,multiRunOwners}=await import('../control.mjs');
test('a declared multi-run mode with the material directory reaches the candidate with the durable store over the pool and the file authority; without the directory the bindings refuse and startup fails after ordered cleanup',async()=>{
 const configured=structuredClone(f.configuration);configured.nativeCandidate.multiRun={runWindowMs:600000,materialDirectory:'/run/meri/material'};
 const runtime=await startControl(configured,{});try{assert.equal(received.length,1);assert.equal(typeof received[0].issuanceStore?.claim,'function');assert.equal(typeof received[0].capabilityAuthority?.generate,'function');assert.equal(received[0].capabilityAuthority.directory,'/run/meri/material');assert.equal(typeof received[0].modelGrants?.issue,'function');}finally{await runtime.close();}
 assert.deepEqual(order,['candidate-close','temporal-close','pool-close']);order.length=0;received.length=0;
 const partial=structuredClone(f.configuration);partial.nativeCandidate.multiRun={runWindowMs:600000};
 await assert.rejects(startControl(partial,{}),/CONTROL_STARTUP_FAILED/,'a multi-run declaration without a material directory has no capability authority');assert.equal(received.length,1);assert.equal(received[0].capabilityAuthority,undefined);assert.equal(received[0].modelGrants,undefined);assert.equal(typeof received[0].issuanceStore?.claim,'function');
 assert.deepEqual(order,['temporal-close','pool-close'],'the failed startup still closes what it opened, in order');
 assert.deepEqual(multiRunOwners(f.configuration,{query(){}}),{},'no multi-run declaration composes no owners');
});
test('declared retention serving composes the retention startup owner over the control database, fenced until a reconciliation over the authoritative ledger; without the ledger sink readiness fails closed after checking the projections; the declaration is control-only, explicit, and purge can only be declared off',async()=>{
 const {retentionGate}=await import('../control.mjs');const {validateConfiguration}=await import('../config.mjs');
 const declared=structuredClone(f.configuration);declared.retention={enabled:true};assert.doesNotThrow(()=>validateConfiguration(declared,'control'));
 assert.throws(()=>validateConfiguration({...declared,retention:{enabled:false}},'control'),/RETENTION_CONFIGURATION/);assert.throws(()=>validateConfiguration({...declared,retention:{enabled:true,extra:1}},'control'),/INVALID_COMMAND/);
 assert.doesNotThrow(()=>validateConfiguration({...declared,retention:{enabled:true,purge:{enabled:false}}},'control'),'the explicit off switch is accepted');
 assert.throws(()=>validateConfiguration({...declared,retention:{enabled:true,purge:{enabled:true}}},'control'),/RETENTION_CONFIGURATION/,'purge cannot be activated by configuration');assert.throws(()=>validateConfiguration({...declared,retention:{enabled:true,purge:{enabled:false,extra:1}}},'control'),/INVALID_COMMAND/);
 const composed=retentionGate(declared,{query(){},connect(){}});assert.equal(typeof composed.gate.assertServable,'function');assert.deepEqual(composed.tables,['meri_conversations.retention_subjects','meri_conversations.retention_purges','meri_conversations.retention_purge_targets','meri_artifacts.retention_subjects','meri_artifacts.retention_purges','meri_conversations.retention_recovery_watermark']);assert.equal(retentionGate(f.configuration,{}),null);
 assert.equal(composed.serving.isEnabled(),false,'fenced from composition');assert.equal(composed.startup.state().purgeEnabled,false);assert.equal(composed.startup.state().unavailable,'RETENTION_LEDGER_UNAVAILABLE');await assert.rejects(composed.gate.assertServable({tenantId:'t',kind:'conversation',subjectId:'00000000-0000-4000-8000-000000000001'}),/RETENTION_RECOVERY_BARRIER/);
 // The prepared candidate admits no product ports, so no ledger sink reaches it: declared retention cannot serve and startup fails closed.
 // A startup that unexpectedly succeeds is closed before the assertion fails, so a regression fails instead of leaking a listener.
 const refusedStart=config=>startControl(config,{}).then(async runtime=>{await runtime.close();throw Error('startup unexpectedly served');});
 order.length=0;schema.missing=false;schema.queried.length=0;await assert.rejects(refusedStart(declared),e=>e.message==='CONTROL_STARTUP_FAILED'&&e.cause?.code==='RETENTION_LEDGER_UNAVAILABLE');assert.ok(schema.queried.some(q=>q.includes('unnest')),'readiness asked for the retention projections first');
 schema.missing=true;await assert.rejects(refusedStart(declared),e=>e.message==='CONTROL_STARTUP_FAILED'&&e.cause?.code==='RETENTION_SCHEMA_UNAVAILABLE','a missing retention projection fails readiness instead of serving ungated');schema.missing=false;
});
