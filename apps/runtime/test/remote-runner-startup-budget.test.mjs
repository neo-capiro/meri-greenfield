// Startup-budget refusal for the remote runner. Kept outside LINUX_ONLY_TESTS: the product image reporter admits a fixed Linux case set (B01-B06).
import test from 'node:test';import assert from 'node:assert/strict';
import {loadRemoteTaskBinding} from '../task-bootstrap.mjs';
import {candidateFixture} from './prepared-candidate-fixture.mjs';
import {compileNativeBrokerPlan} from '../native-authority/broker-stack.mjs';
function fixture(){const f=candidateFixture(),c=f.configuration.nativeCandidate,compiled=compileNativeBrokerPlan({runtime:{...c.runtime,deadlineMs:Date.now()+900000,proxyCredential:f.secret.proxy},plan:c.plan,preparationIntent:c.preparationIntent});return {...f,runner:{version:1,runWindowMs:900000,profile:'isolated-preview',sourceEnabled:false,limits:{...f.configuration.limits,requestMs:25000},native:{...f.configuration.native,capabilityFile:c.taskCapabilityFile},binding:f.binding,versions:f.configuration.versions,workspace:c.preparationIntent.workspace,proxyOrigin:new URL(c.runtime.proxyUrl).origin,captureOwnsClose:true,bootstrap:{expiresAtMs:compiled.original.expiresAtMs,remote:true}},remote:{original:compiled.original,preparationIntent:c.preparationIntent,taskArn:'arn:aws:ecs:us-east-1:967807252336:task/meri-greenfield-qualification/'+'a'.repeat(32),controlCapabilitySha256:'a'.repeat(64),processOrigin:c.taskOrigin,http:c.taskHttp,preparedKickoff:true}};}
function stageOrRun(stage,run,name){return Promise.race([stage.promise,run.then(()=>{throw Error(name+' not reached before runner completed');})]);}
async function retireForTeardown(listener,original,control,abort){abort.abort();if(!listener)return;try{await fetch('http://127.0.0.1:'+listener.address.port+'/v1/native-task/stop',{method:'POST',headers:{authorization:'Bearer '+control,'content-type':'application/json'},body:JSON.stringify({original}),signal:AbortSignal.timeout(2000)});}catch{}}

test('startup budget refusal rejects the listener wait before any listener starts',{timeout:5000},async()=>{
 const {runRemoteConversation}=await import('../remote-conversation-runner.mjs'),f=fixture(),listened=Promise.withResolvers();let listenerCalls=0;
 const configuration={...f.runner,limits:{...f.runner.limits,requestMs:2000},remoteTask:f.remote};delete configuration.bootstrap;
 const run=runRemoteConversation(configuration,{listen(){listenerCalls++;listened.resolve();throw Error('unexpected listener');}});
 await assert.rejects(stageOrRun(listened,run,'listener'),{code:'HOT_PATH_BUDGET_CONFIGURATION'});
 await assert.rejects(run,{code:'HOT_PATH_BUDGET_CONFIGURATION'});assert.equal(listenerCalls,0);
});
