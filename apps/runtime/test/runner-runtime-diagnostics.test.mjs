import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {withRunnerDiagnostics,atRunnerStage,markRunnerStage,captureRunnerFailure} from '../runner-runtime-diagnostics.mjs';
import {assembleConversationRunner} from '../conversation-runner.mjs';
import {main} from '../cli.mjs';
import {binding,versions,scopes} from '../../control/conversations/test/store-fixture.mjs';

const runner={version:1,profile:'isolated-preview',sourceEnabled:false,
 native:{origin:'https://native.example.invalid',capabilityFile:'/run/secrets/task-capability',loopback:false,maxResponseBytes:131072},
 limits:{startupMs:3000,shutdownMs:1000,requestMs:1000,requestBytes:131072},binding,versions,
 workspace:'/workspace/'+binding.conversationId,proxyOrigin:'https://proxy.example.invalid'};

test('runtime preparation retains its stage and allowed code through generic activity failure, before any claim or Query',async()=>{
 const lines=[],operations=[],saved={run:{binding,versions,scopes,state:'queued',createdAt:'2026-10-18T00:00:00.000Z',policyRevision:'policy1'}};let queries=0;
  const execute=assembleConversationRunner({configuration:runner,native:{async call(operation,input){
   operations.push(operation);if(operation==='runner/load')return saved;
   if(operation==='runner/runtime')throw Object.assign(Error('synthetic secret: bearer-private-canary'),{code:'NATIVE_UNAVAILABLE'});
   throw Error('unexpected publication');
  }},query(){queries++;throw Error('No SDK Query allowed');}});
  await assert.rejects(withRunnerDiagnostics(()=>execute({binding}),{write:line=>lines.push(line)}),{code:'EXECUTION_FAILED'});
  assert.deepEqual(lines,['RUNNER_FIRST_FAILURE origin=runtime code=NATIVE_UNAVAILABLE\n','RUNNER_RUNTIME_FAILED stage=runtime-admission code=NATIVE_UNAVAILABLE\n']);
  assert.equal(queries,0);assert.equal(saved.run.state,'queued');assert.deepEqual(operations,['runner/load','runner/runtime']);
});

test('first failure survives cleanup replacement without emitting error text, dynamic codes, getters or stacks',async()=>{
 const lines=[],initial=Object.assign(Error('bearer-private-canary'),{code:'SECRET_BEARER_CANARY'}),cleanup=Error('private cleanup detail');
 Object.defineProperty(initial,'message',{get(){throw Error('message must not be read');}});
 await assert.rejects(withRunnerDiagnostics(async()=>{
  try{await atRunnerStage('remote-listen',async()=>{throw initial;});}
  finally{markRunnerStage('remote-cleanup');throw cleanup;}
 },{write:line=>lines.push(line)}),error=>error===cleanup);
 assert.deepEqual(lines,['RUNNER_FIRST_FAILURE origin=runtime code=UNKNOWN\n','RUNNER_RUNTIME_FAILED stage=remote-listen code=UNKNOWN\n']);
 const accessor=Object.defineProperty({},'code',{get(){throw Error('code getter must not run');}});
 await assert.rejects(withRunnerDiagnostics(()=>atRunnerStage('remote-tls',async()=>{throw accessor;}),{write:line=>lines.push(line)}),error=>error===accessor);
 assert.equal(lines.at(-1),'RUNNER_RUNTIME_FAILED stage=remote-tls code=UNKNOWN\n');
});

test('concurrent task contexts remain independent and successful completion emits nothing',async()=>{
 const lines=[],ready=Promise.withResolvers(),resume=Promise.withResolvers();
 const first=withRunnerDiagnostics(()=>atRunnerStage('remote-listen',async()=>{ready.resolve();await resume.promise;throw Object.assign(Error('first'),{code:'EADDRINUSE'});}),{write:line=>lines.push(line)});
 const firstCheck=assert.rejects(first,{code:'EADDRINUSE'});
 await ready.promise;
 await assert.rejects(withRunnerDiagnostics(()=>atRunnerStage('binding-bootstrap',async()=>{throw Object.assign(Error('second'),{code:'TASK_BOOTSTRAP_REFUSED'});}),{write:line=>lines.push(line)}),{code:'TASK_BOOTSTRAP_REFUSED'});
 resume.resolve();await firstCheck;
 assert.deepEqual(lines,['RUNNER_FIRST_FAILURE origin=runtime code=TASK_BOOTSTRAP_REFUSED\n','RUNNER_RUNTIME_FAILED stage=binding-bootstrap code=TASK_BOOTSTRAP_REFUSED\n','RUNNER_FIRST_FAILURE origin=runtime code=EADDRINUSE\n','RUNNER_RUNTIME_FAILED stage=remote-listen code=EADDRINUSE\n']);
 assert.equal(await withRunnerDiagnostics(async()=>{markRunnerStage('remote-cleanup');return 'completed';},{write:()=>assert.fail('success must not report')}),'completed');
});

test('CLI retains exit 3 and RUNTIME_UNAVAILABLE while adding the preflight diagnostic',async t=>{
 const root=await mkdtemp(join(tmpdir(),'meri-runner-diagnostic-')),file=join(root,'config.json'),lines=[];
 t.after(()=>rm(root,{recursive:true,force:true}));await writeFile(file,JSON.stringify(runner));
 t.mock.method(process.stderr,'write',line=>{lines.push(String(line));return true;});
 assert.equal(await main(['conversation-runner','--config',file]),3);
 assert.deepEqual(lines,['RUNNER_FIRST_FAILURE origin=runtime code=ENOENT\n','RUNNER_RUNTIME_FAILED stage=runner-preflight code=ENOENT\n','RUNTIME_UNAVAILABLE\n']);
});

test('diagnostic write failure cannot change the original rejection',async()=>{
 const error=Object.assign(Error('private original'),{code:'RUNNER_SDK_CA_REFUSED'});
 await assert.rejects(withRunnerDiagnostics(async()=>{markRunnerStage('sdk-directories');captureRunnerFailure(error);throw error;},{write(){throw Error('stderr unavailable');}}),value=>value===error);
});
