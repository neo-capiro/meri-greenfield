/** Actual CLI composition; only configuration I/O, reads construction and control resource allocation are synthetic. */
import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import * as config from '../config.mjs';
import {agentcoreControlFixture} from './agentcore-fixture.mjs';
import {PROPOSED_PREVIEW_CAPABILITY_PLATFORM} from '../product-ports/capability-policy.mjs';

let received,started,readFactoryCalls=0,closed=0;
const configuration=agentcoreControlFixture().configuration;
configuration.capabilityPlatform=PROPOSED_PREVIEW_CAPABILITY_PLATFORM;
configuration.reads={enabled:true,serviceSecretFile:'/run/meri/core-service-secret',defaultCongress:119};
mock.module('../config.mjs',{namedExports:{...config,async loadConfiguration(){return config.validateConfiguration(configuration,'control');}}});
const createReadsRuntime=()=>assert.fail('No execution or data read occurs during CLI startup');
mock.module('../reads-composer.mjs',{namedExports:{async createControlReadsComposer(options){
 readFactoryCalls++;received=options;return {createReadsRuntime,familyIds:[],missing:[]};
}}});
mock.module('../control.mjs',{namedExports:{async startControl(c,options){assert.deepEqual(c,configuration);started=options;
 return {address:{port:0},completion:Promise.resolve(),async close(){closed++;}};
}}});
const {main}=await import('../cli.mjs');

test('CLI passes one live credential relay and the actual memory-context relay to reads and control',async()=>{
 const stdout=process.stdout.write;process.stdout.write=()=>true;
 try{assert.equal(await main(['control','--config','/synthetic/config.json']),0);}finally{process.stdout.write=stdout;}
 assert.equal(readFactoryCalls,1);assert.equal(closed,1);
 assert.equal(received.coreOrigin,configuration.agentcore.identity.origin);
 assert.equal(received.nativeCredentials,started.readCredentialRelay.port);
 assert.equal(received.memoryContexts,started.memoryContextRelay);
 assert.equal(typeof received.memoryContexts.forTask,'function');
 assert.equal(received.memoryContexts.state(),'unbound');
 assert.equal(typeof received.capabilityPolicy.forRun,'function');
 assert.equal(received.serviceSecretFile,configuration.reads.serviceSecretFile);
 assert.equal(started.createReadsRuntime,createReadsRuntime);
 for(const obsolete of ['installation','measurement','discovery','gateway','retainedAuthority','retainedTaskPorts','delegation','credentialFile'])assert.equal(Object.hasOwn(received,obsolete),false);
 assert.equal(started.occurrenceRelay,undefined,'no unused old read-delegation relay is allocated');
});
