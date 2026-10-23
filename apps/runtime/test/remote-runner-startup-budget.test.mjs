import {normalize} from 'node:path';
// Startup-budget refusal for the remote runner. Kept outside LINUX_ONLY_TESTS: the product image reporter admits a fixed Linux case set (B01-B06).
import test from 'node:test';import assert from 'node:assert/strict';
import {candidateFixture} from './prepared-candidate-fixture.mjs';
import {compileNativeTaskPlan} from '../native-authority/task-allocator.mjs';
function fixture(){const f=candidateFixture(),c=f.configuration.nativeCandidate;for(const key of ['workspace','configParentDirectory','secureStorageDirectory'])c.preparationIntent[key]=normalize(c.preparationIntent[key]);const compiled=compileNativeTaskPlan({runtime:{...c.runtime,deadlineMs:Date.now()+900000},plan:c.plan,preparationIntent:c.preparationIntent});return {...f,runner:{version:1,profile:'isolated-preview',sourceEnabled:false,limits:{...f.configuration.limits,requestMs:25000},native:{...f.configuration.native,capabilityFile:c.taskCapabilityFile},binding:f.binding,versions:f.configuration.versions,workspace:c.preparationIntent.workspace,bootstrap:{expiresAtMs:compiled.original.expiresAtMs,remote:true}},remote:{original:compiled.original,preparationIntent:c.preparationIntent,taskArn:'arn:aws:ecs:us-east-1:967807252336:task/meri-greenfield-qualification/'+'a'.repeat(32),controlCapabilitySha256:'a'.repeat(64),processOrigin:c.taskOrigin,http:c.taskHttp,preparedKickoff:true}};}
test('startup budget refusal rejects the listener wait before any listener starts',{timeout:5000},async()=>{
 const {runRemoteConversation}=await import('../remote-conversation-runner.mjs'),f=fixture(),listened=Promise.withResolvers();let listenerCalls=0;
 const configuration={...f.runner,limits:{...f.runner.limits,requestMs:2000},remoteTask:f.remote};delete configuration.bootstrap;
 const run=runRemoteConversation(configuration,{listen(){listenerCalls++;listened.resolve();throw Error('unexpected listener');}});
 await assert.rejects(run,/RUNNER_STARTUP_BUDGET_REFUSED/);assert.equal(listenerCalls,0);
});
