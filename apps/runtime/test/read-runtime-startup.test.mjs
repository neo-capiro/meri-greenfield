/** SYNTHETIC root startup boundary. No listener, SQL, secret read, native allocation or network. */
import test,{mock} from 'node:test';import assert from 'node:assert/strict';
import * as configurationModule from '../config.mjs';
import {WorkflowIdReusePolicy,WorkflowIdConflictPolicy} from '@temporalio/client';
import {candidateFixture} from './prepared-candidate-fixture.mjs';
import {capabilityDigest} from '../native-authority/task-verifier.mjs';
import {normalize} from 'node:path';
const f=candidateFixture(),stats={secrets:0,listen:0,candidate:0,factory:0,closed:0},received=[];
for(const k of ['workspace','configParentDirectory','secureStorageDirectory'])f.configuration.nativeCandidate.preparationIntent[k]=normalize(f.configuration.nativeCandidate.preparationIntent[k]);
f.configuration.nativeCandidate.preparationIntent.launchTemplate.command=normalize(f.configuration.nativeCandidate.preparationIntent.launchTemplate.command);f.configuration.nativeCandidate.preparationIntent.launchTemplate.env.CLAUDE_SECURESTORAGE_CONFIG_DIR=f.configuration.nativeCandidate.preparationIntent.secureStorageDirectory;
mock.module('pg',{namedExports:{Pool:class{async query(sql,args){if(sql.includes('unnest'))return {rows:args[0].map(name=>({name,relation:name}))};return {rows:[{runs:'runs',events:'events',controls:'controls',selected_outputs:'selected_outputs'}]};}connect(){assert.fail('No database');}async end(){}}}});
mock.module('@temporalio/client',{namedExports:{WorkflowIdReusePolicy,WorkflowIdConflictPolicy,Connection:{async connect(){return {withDeadline(_deadline,fn){return fn();},withAbortSignal(_signal,fn){return fn();},workflowService:{async getSystemInfo(){}},async close(){}};}},Client:class{workflow={start:async()=>assert.fail('No workflow'),getHandle:()=>({})};}}});
mock.module('../config.mjs',{namedExports:{...configurationModule,async readSecret(path){stats.secrets++;return Buffer.from(path===f.configuration.database.connectionFile?'postgres://synthetic.invalid/meri?sslmode=verify-full':f.secret.control);}}});
mock.module('../http-server.mjs',{namedExports:{async listenRuntime(){stats.listen++;return {address:{port:0},async close(){}};}}});
mock.module('../prepared-candidate.mjs',{namedExports:{async startPreparedCandidate(options){stats.candidate++;received.push(options);return {controlCapabilitySha256:capabilityDigest(f.secret.control),native:{async readiness(){},async call(){assert.fail('No native effects');}},application:{async handle(){return null;}},bindApplication(){},async close(){stats.closed++;}};}}});
const {startControl}=await import('../control.mjs');
test('actual root forwards optional borrowed factory to candidate without invoking or logging it',async()=>{
 const factory=()=>{stats.factory++;assert.fail('No per-entry admission');},runtime=await startControl(f.configuration,{createReadsRuntime:factory});try{assert.equal(received.at(-1).createReadsRuntime,factory);assert.equal(stats.factory,0);assert.equal(stats.listen,1);}finally{await runtime.close();}assert.equal(stats.closed,1);
});
test('root rejects invalid or competing composition before secret/resources',async()=>{
 const before=stats.secrets;await assert.rejects(startControl(f.configuration,{createReadsRuntime:'module'}),/CONFIGURATION/);await assert.rejects(startControl(f.configuration,{createReadsRuntime:async()=>undefined}),/CONFIGURATION/);await assert.rejects(startControl(f.configuration,{createReadsRuntime:()=>{},generalReads:{readAvailability(){},execute(){}}}),/CONFIGURATION/);assert.equal(stats.secrets,before);
});
test('root cannot silently ignore factory when there is no prepared candidate',async()=>{
 const {nativeCandidate,...configuration}=f.configuration,before=stats.secrets;await assert.rejects(startControl(configuration,{createReadsRuntime:()=>{}}),/PREPARED_CANDIDATE_CONFIGURATION/);assert.equal(stats.secrets,before);
});
