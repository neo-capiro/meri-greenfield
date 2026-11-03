import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import * as config from '../config.mjs';
import {agentcoreControlFixture} from './agentcore-fixture.mjs';
import {PROPOSED_PREVIEW_CAPABILITY_PLATFORM} from '../product-ports/capability-policy.mjs';
let started,secretReads=0,ports=0,closed=0,revoked=0,admissions=0;
const c=agentcoreControlFixture().configuration,sourceCommit='c'.repeat(40),capability={revoke(){revoked++;}};
c.agentcore.runtimeArn='arn:aws:bedrock-agentcore:us-east-1:967807252336:runtime/meri_case_a123456789ab-synthetic';c.agentcore.qualifier='case';
c.temporal.taskQueue='meri-case-a123456789ab-conversations';c.reads={enabled:true,serviceSecretFile:'/run/meri/core-service-secret'};
c.capabilityPlatform=PROPOSED_PREVIEW_CAPABILITY_PLATFORM;
mock.module('../config.mjs',{namedExports:{...config,loadConfiguration:async()=>config.validateConfiguration(c,'control'),readSecret:async()=>{secretReads++;return Buffer.from('synthetic-protected-control-capability');}}});
mock.module('../material-receipt.mjs',{namedExports:{readMaterialReceipt:async()=>({sourceCommit})}});
mock.module('../operator-control-configuration.mjs',{namedExports:{createOperatorControlAdmission:(raw,actual,bytes,source)=>{admissions++;assert.equal(source,sourceCommit);assert.equal(actual.agentcore.runtimeArn,c.agentcore.runtimeArn);assert.equal(bytes.toString(),'synthetic-protected-control-capability');return capability;}}});
mock.module('../reads-composer.mjs',{namedExports:{createControlReadsComposer:async()=>{ports++;return {createReadsRuntime:()=>{},readAvailability:{},missing:[]};}}});
mock.module('../control.mjs',{namedExports:{startControl:()=>assert.fail('ordinary control must not start a case'),startOperatorBrowserControl:async(actual,options,received)=>{
 assert.equal(received,capability);started=options;return {address:'synthetic',completion:Promise.resolve(),close:async()=>{closed++;}};
}}});
const {main,mainOperatorBrowserControl}=await import('../cli.mjs');
test('ordinary CLI refuses case runtime before credential reads or product composition',async()=>{
 assert.equal(await main(['control','--config','/run/meri/control.json']),2);assert.equal(secretReads,0);assert.equal(ports,0);assert.equal(admissions,0);
});
test('explicit Control startup keeps original CLI product ports, signal, source and close owner',async()=>{
 assert.equal(await mainOperatorBrowserControl({protected:'fixture'},['control','--config','/run/meri/control.json']),0);
 assert.equal(secretReads,1);assert.equal(admissions,1);assert.equal(ports,1);assert.equal(closed,1);assert.equal(revoked,1);
 assert.equal(started.sourceCommit,sourceCommit);assert(started.signal instanceof AbortSignal);assert.equal(started.testOwners,undefined);
 assert.equal(typeof started.productPortsFactory,'function');assert.equal(typeof started.createReadsRuntime,'function');assert(started.readCredentialRelay);
 assert.equal(await mainOperatorBrowserControl({},['temporal-worker','--config','/run/meri/worker.json']),2);assert.equal(admissions,1);
});
