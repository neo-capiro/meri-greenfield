import {normalize} from 'node:path';
import test from 'node:test';import assert from 'node:assert/strict';
import {loadRemoteTaskBinding} from '../task-bootstrap.mjs';
import {candidateFixture} from './prepared-candidate-fixture.mjs';
import {compileNativeTaskPlan} from '../native-authority/task-allocator.mjs';
import {runnerStartupBudget} from '../../../packages/runtime/runner-load-budget.mjs';
function fixture(){const f=candidateFixture(),c=f.configuration.nativeCandidate;for(const key of ['workspace','configParentDirectory','secureStorageDirectory'])c.preparationIntent[key]=normalize(c.preparationIntent[key]);const compiled=compileNativeTaskPlan({runtime:{...c.runtime,deadlineMs:Date.now()+900000},plan:c.plan,preparationIntent:c.preparationIntent});return {...f,runner:{version:1,profile:'isolated-preview',sourceEnabled:false,limits:{...f.configuration.limits,requestMs:25000},native:{...f.configuration.native,capabilityFile:c.taskCapabilityFile},binding:f.binding,versions:f.configuration.versions,workspace:c.preparationIntent.workspace,bootstrap:{expiresAtMs:compiled.original.expiresAtMs,remote:true}},remote:{original:compiled.original,preparationIntent:c.preparationIntent,taskArn:'arn:aws:ecs:us-east-1:967807252336:task/meri-greenfield-qualification/'+'a'.repeat(32),controlCapabilitySha256:'a'.repeat(64),processOrigin:c.taskOrigin,http:c.taskHttp,preparedKickoff:true}};}
test('standard task bootstrap polls only existing capability route and returns validated original gated binding',async()=>{const f=fixture(),calls=[];const resolved=await loadRemoteTaskBinding({configuration:f.runner,native:{async call(op,input){calls.push({op,input});if(calls.length===1)throw Error('not admitted');return f.remote;}},pollMs:10});assert.equal(resolved.remoteTask.preparedKickoff,true);assert.equal(resolved.bootstrap,undefined);assert.equal(calls.length,2);assert.equal(calls[0].op,'runner/native/bootstrap');assert.deepEqual(calls[0].input,{binding:f.binding,versions:f.runner.versions});assert.equal(resolved.native.capabilityFile,f.runner.native.capabilityFile);});
test('foreign bootstrap proof refuses before returning executable configuration',async()=>{const f=fixture();f.remote.original={...f.remote.original,binding:{...f.binding,writerFence:2}};await assert.rejects(loadRemoteTaskBinding({configuration:f.runner,native:{async call(){return f.remote;}}}));});
test('poststart TLS files are joined only to the validated remote task and a remote TLS override refuses',async()=>{
 const f=fixture(),tls={zone:'runner.private.invalid',caFile:'/run/meri/poststart/tls/runner-ca.pem',certFile:'/run/meri/poststart/tls/runner-cert.pem',keyFile:'/run/meri/poststart/tls/runner-key.pem',candidateFile:'/run/meri/poststart/tls/candidate.json',metadataFile:'/run/meri/poststart/tls/metadata.json'};
 const native={async call(){return f.remote;}};
 await assert.rejects(loadRemoteTaskBinding({configuration:f.runner,native,poststartTls:tls}),/TASK_BOOTSTRAP_REFUSED/);
 const coherentRunner={...f.runner,native:{...f.runner.native,origin:f.remote.processOrigin}};
 const resolved=await loadRemoteTaskBinding({configuration:coherentRunner,native,poststartTls:tls});
 assert.deepEqual(resolved.remoteTask.tls,tls);
 await assert.rejects(loadRemoteTaskBinding({configuration:coherentRunner,native:{async call(){return {...f.remote,tls};}},poststartTls:tls}),/TASK_BOOTSTRAP_REFUSED/);
});
test('cancelled bootstrap invokes no transport or execution',async()=>{const f=fixture(),signal=AbortSignal.abort();let calls=0;await assert.rejects(loadRemoteTaskBinding({configuration:f.runner,signal,native:{call(){calls++;}}}));assert.equal(calls,0);});

for(const remainingMs of [900000,371351])test(`direct SDK bootstrap accepts a valid original with ${remainingMs}ms remaining without extending it`,async()=>{
 const f=fixture(),at=Date.now(),expiresAtMs=at+remainingMs;f.runner.bootstrap.expiresAtMs=expiresAtMs;f.remote.original={...f.remote.original,expiresAtMs};let calls=0;
 const budget=runnerStartupBudget({requestMs:25000,shutdownMs:1000,originalExpiresAtMs:expiresAtMs});
 const resolved=await loadRemoteTaskBinding({configuration:f.runner,startupBudget:budget.stages.bootstrap,now:()=>at,native:{async call(op,input,options){calls++;assert.equal(op,'runner/native/bootstrap');assert.ok(options.deadlineMs<=expiresAtMs);assert.equal(options.maxRequestMs,23000);return f.remote;}}});
 assert.equal(calls,1);assert.equal(resolved.remoteTask.original.expiresAtMs,expiresAtMs);assert.equal(resolved.bootstrap,undefined);
});
test('an original without the completion allowance refuses bootstrap before transport',async()=>{
 const f=fixture(),at=Date.now(),expiresAtMs=at+23000;f.runner.bootstrap.expiresAtMs=expiresAtMs;let calls=0;
 const budget=runnerStartupBudget({requestMs:25000,shutdownMs:1000,originalExpiresAtMs:expiresAtMs});
 await assert.rejects(loadRemoteTaskBinding({configuration:f.runner,startupBudget:budget.stages.bootstrap,now:()=>at,native:{async call(){calls++;}}}),{code:'TASK_BOOTSTRAP_REFUSED'});assert.equal(calls,0);
});
