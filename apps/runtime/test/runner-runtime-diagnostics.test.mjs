import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {withRunnerDiagnostics,atRunnerStage,markRunnerStage,captureRunnerFailure,firstFailureMessageHash} from '../runner-runtime-diagnostics.mjs';
import {assembleConversationRunner} from '../conversation-runner.mjs';
import {main} from '../cli.mjs';
import {binding,versions,scopes} from '../../control/conversations/test/store-fixture.mjs';
import {withoutDetail} from './runner-diagnostic-lines.mjs';

const runner={version:1,profile:'isolated-preview',sourceEnabled:false,
 native:{origin:'https://native.example.invalid',capabilityFile:'/run/secrets/task-capability',loopback:false,maxResponseBytes:131072},
 limits:{startupMs:3000,shutdownMs:1000,requestMs:1000,requestBytes:131072},binding,versions,
 workspace:'/workspace/'+binding.conversationId,proxyOrigin:'https://proxy.example.invalid'};

test('runtime preparation retains its stage and allowed code through generic activity failure, before any Query',async()=>{
 const lines=[],operations=[],states=[],saved={run:{binding,versions,scopes,state:'queued',createdAt:'2026-10-18T00:00:00.000Z',policyRevision:'policy1'}};let queries=0;
  const execute=assembleConversationRunner({configuration:runner,native:{async call(operation,input){
   operations.push(operation);if(operation==='runner/load')return saved;
   // The starting claim follows the load check (activity.mjs), so runtime preparation fails after it and settles as failed.
   if(operation==='runner/publish'){states.push(input.event.data.state);return {};}
   if(operation==='runner/runtime')throw Object.assign(Error('synthetic secret: bearer-private-canary'),{code:'NATIVE_UNAVAILABLE'});
   throw Error('unexpected operation');
  }},query(){queries++;throw Error('No SDK Query allowed');}});
  await assert.rejects(withRunnerDiagnostics(()=>execute({binding}),{write:line=>lines.push(withoutDetail(line))}),{code:'EXECUTION_FAILED'});
  assert.deepEqual(lines,['RUNNER_FIRST_FAILURE origin=runtime stage=runtime-admission code=NATIVE_UNAVAILABLE class=ERROR exit=none signal=none\n','RUNNER_RUNTIME_FAILED stage=runtime-admission code=NATIVE_UNAVAILABLE\n']);
  assert.equal(queries,0);assert.deepEqual(states,['starting','failed']);assert.deepEqual(operations,['runner/load','runner/publish','runner/runtime','runner/publish']);
});

test('first failure survives cleanup replacement without emitting error text, dynamic codes, getters or stacks',async()=>{
 const lines=[],initial=Object.assign(Error('bearer-private-canary'),{code:'SECRET_BEARER_CANARY'}),cleanup=Error('private cleanup detail');
 Object.defineProperty(initial,'message',{get(){throw Error('message must not be read');}});
 await assert.rejects(withRunnerDiagnostics(async()=>{
  try{await atRunnerStage('remote-listen',async()=>{throw initial;});}
  finally{markRunnerStage('remote-cleanup');throw cleanup;}
 },{write:line=>lines.push(withoutDetail(line))}),error=>error===cleanup);
 assert.deepEqual(lines,['RUNNER_FIRST_FAILURE origin=runtime stage=remote-listen code=ERROR class=ERROR exit=none signal=none\n','RUNNER_RUNTIME_FAILED stage=remote-listen code=ERROR\n']);
 const accessor=Object.defineProperty({},'code',{get(){throw Error('code getter must not run');}});
 await assert.rejects(withRunnerDiagnostics(()=>atRunnerStage('remote-tls',async()=>{throw accessor;}),{write:line=>lines.push(withoutDetail(line))}),error=>error===accessor);
 assert.equal(lines.at(-1),'RUNNER_RUNTIME_FAILED stage=remote-tls code=NON_ERROR\n');
});

test('concurrent task contexts remain independent and successful completion emits nothing',async()=>{
 const lines=[],ready=Promise.withResolvers(),resume=Promise.withResolvers();
 const first=withRunnerDiagnostics(()=>atRunnerStage('remote-listen',async()=>{ready.resolve();await resume.promise;throw Object.assign(Error('first'),{code:'EADDRINUSE'});}),{write:line=>lines.push(withoutDetail(line))});
 const firstCheck=assert.rejects(first,{code:'EADDRINUSE'});
 await ready.promise;
 await assert.rejects(withRunnerDiagnostics(()=>atRunnerStage('binding-bootstrap',async()=>{throw Object.assign(Error('second'),{code:'TASK_BOOTSTRAP_REFUSED'});}),{write:line=>lines.push(withoutDetail(line))}),{code:'TASK_BOOTSTRAP_REFUSED'});
 resume.resolve();await firstCheck;
 assert.deepEqual(lines,['RUNNER_FIRST_FAILURE origin=runtime stage=binding-bootstrap code=TASK_BOOTSTRAP_REFUSED class=ERROR exit=none signal=none\n','RUNNER_RUNTIME_FAILED stage=binding-bootstrap code=TASK_BOOTSTRAP_REFUSED\n','RUNNER_FIRST_FAILURE origin=runtime stage=remote-listen code=EADDRINUSE class=ERROR exit=none signal=none\n','RUNNER_RUNTIME_FAILED stage=remote-listen code=EADDRINUSE\n']);
 assert.equal(await withRunnerDiagnostics(async()=>{markRunnerStage('remote-cleanup');return 'completed';},{write:()=>assert.fail('success must not report')}),'completed');
});

test('CLI retains exit 3 and RUNTIME_UNAVAILABLE while adding the preflight diagnostic',async t=>{
 const root=await mkdtemp(join(tmpdir(),'meri-runner-diagnostic-')),file=join(root,'config.json'),lines=[];
 t.after(()=>rm(root,{recursive:true,force:true}));await writeFile(file,JSON.stringify(runner));
 t.mock.method(process.stderr,'write',line=>{lines.push(withoutDetail(String(line)));return true;});
 assert.equal(await main(['conversation-runner','--config',file]),3);
 assert.deepEqual(lines,['RUNNER_FIRST_FAILURE origin=runtime stage=runner-preflight code=ENOENT class=ERROR exit=none signal=none\n','RUNNER_RUNTIME_FAILED stage=runner-preflight code=ENOENT\n','RUNTIME_UNAVAILABLE\n']);
});

test('diagnostic write failure cannot change the original rejection',async()=>{
 const error=Object.assign(Error('private original'),{code:'RUNNER_SDK_CA_REFUSED'});
 await assert.rejects(withRunnerDiagnostics(async()=>{markRunnerStage('sdk-directories');captureRunnerFailure(error);throw error;},{write(){throw Error('stderr unavailable');}}),value=>value===error);
});

test('code-less failures are classified by fixed fields: SDK error class, exit code or signal, allowlisted constant message, error type',async()=>{
 const first=async error=>{const lines=[];await withRunnerDiagnostics(async()=>{markRunnerStage('activity-stream');throw error;},{write:line=>lines.push(withoutDetail(line))}).catch(()=>{});return lines[0];};
 const line=(code,kind,exit='none',signal='none')=>`RUNNER_FIRST_FAILURE origin=runtime stage=activity-stream code=${code} class=${kind} exit=${exit} signal=${signal}\n`;
 // The pinned SDK's own tagged errors carry own errorClass/exitCode/signal data; their message holds stderr text and is never read out.
 const sdk=(errorClass,fields={})=>Object.assign(Error('Claude Code process failed. stderr: private-canary /private/path'),{telemetryMessage:'private-canary',errorClass,...fields});
 assert.equal(await first(sdk('process_exited_nonzero',{exitCode:143})),line('SDK_PROCESS_EXITED_NONZERO','SDK_PROCESS_EXITED_NONZERO','143'));
 assert.equal(await first(sdk('process_killed_by_signal',{signal:'SIGKILL'})),line('SDK_PROCESS_KILLED_BY_SIGNAL','SDK_PROCESS_KILLED_BY_SIGNAL','none','SIGKILL'));
 assert.equal(await first(sdk('process_error',{code:'REMOTE_TASK_REFUSED'})),line('REMOTE_TASK_REFUSED','SDK_PROCESS_ERROR'));
 assert.equal(await first(sdk('initialize_timeout')),line('SDK_INITIALIZE_TIMEOUT','SDK_INITIALIZE_TIMEOUT'));
 // Unlisted SDK classes, out-of-range exit codes and unknown signal names stay bounded.
 assert.equal(await first(sdk('private_new_class',{exitCode:9000,signal:'SIGPRIVATE'})),line('SDK_OTHER','SDK_OTHER'));
 // A constant message counts only when it is itself an allowlisted code (code-less throws such as Error('SDK_TEXT_INCONSISTENT')).
 assert.equal(await first(Error('SDK_TEXT_INCONSISTENT')),line('SDK_TEXT_INCONSISTENT','ERROR'));
 assert.equal(await first(Error('private free text')),line('ERROR','ERROR'));
 assert.equal(await first(new TypeError('x')),line('TYPE_ERROR','TYPE_ERROR'));
 assert.equal(await first(new SyntaxError('x')),line('SYNTAX_ERROR','SYNTAX_ERROR'));
 assert.equal(await first(new AggregateError([Error('inner')],'x')),line('AGGREGATE_ERROR','AGGREGATE_ERROR'));
 assert.equal(await first(AbortSignal.abort().reason),line('DOM_EXCEPTION','DOM_EXCEPTION'));
 for(const value of ['private string',42,null,new Proxy(Error('x'),{}),Object.create(null)])assert.equal(await first(value),line('NON_ERROR','NON_ERROR'));
 // Accessors are never invoked.
 const hostile=Error('x');for(const key of ['code','message','errorClass','exitCode','signal'])Object.defineProperty(hostile,key,{get(){throw Error(key+' getter must not run');}});
 assert.equal(await first(hostile),line('ERROR','ERROR'));
});

const firstRaw=async error=>{const lines=[];await withRunnerDiagnostics(async()=>{markRunnerStage('activity-stream');throw error;},{write:line=>lines.push(line)}).catch(()=>{});return lines[0];};
const detail=line=>/ cause=(\S+) msg=(\S+) site=(\S+)\n$/u.exec(line)?.slice(1);
const siteShape=/^(?:[A-Za-z0-9_.@-]{1,80}\.(?:mjs|cjs|js)|node:[A-Za-z0-9_.-]{1,40}):\d{1,7}:\d{1,7}$/u;

test('a wrapped failure prints its own code, its classified cause, a message hash and its code sites',async()=>{
 // The lifecycle pump's shape (activity-lifecycle.mjs): LIFECYCLE_EXECUTION_UNKNOWN carrying the original failure as cause.
 const inner=Object.assign(Error('DEADLINE'),{code:'DEADLINE'}),outer=Object.assign(new Error('LIFECYCLE_EXECUTION_UNKNOWN',{cause:inner}),{code:'LIFECYCLE_EXECUTION_UNKNOWN'});
 const line=await firstRaw(outer);
 assert.match(line,/^RUNNER_FIRST_FAILURE origin=runtime stage=activity-stream code=LIFECYCLE_EXECUTION_UNKNOWN class=ERROR exit=none signal=none cause=DEADLINE msg=[0-9a-f]{12} site=\S+\n$/u);
 const [cause,msg,site]=detail(line);
 assert.equal(cause,'DEADLINE');assert.equal(msg,firstFailureMessageHash('LIFECYCLE_EXECUTION_UNKNOWN'));
 const sites=site.split(',');assert.ok(sites.length>=1&&sites.length<=3);
 for(const entry of sites)assert.match(entry,siteShape);
 assert.match(sites[0],/^runner-runtime-diagnostics\.test\.mjs:\d+:\d+$/u);
 // Causes are classified like failures; anything else is NON_ERROR.
 for(const [value,expected] of [[Error('SDK_TEXT_REFUSED'),'SDK_TEXT_REFUSED'],[Object.assign(Error('private'),{errorClass:'process_exited_nonzero',exitCode:1}),'SDK_PROCESS_EXITED_NONZERO'],
  ['private string','NON_ERROR'],[new Proxy({},{}),'NON_ERROR']])assert.equal(detail(await firstRaw(new Error('x',{cause:value})))[0],expected);
 assert.equal(detail(await firstRaw(Error('x')))[0],'none');
});

test('detail never runs getters, never prints message text and never reads frames out of the message',async()=>{
 let reads=0;
 const messageGetter=Error('x');Object.defineProperty(messageGetter,'message',{get(){reads++;return 'private';}});
 assert.deepEqual(detail(await firstRaw(messageGetter)),['none','none','none']);
 class Named extends Error{get name(){reads++;return 'private';}}
 assert.equal(detail(await firstRaw(new Named('x')))[2],'none');
 const causeGetter=Error('x');Object.defineProperty(causeGetter,'cause',{get(){reads++;return Error('private');}});
 assert.equal(detail(await firstRaw(causeGetter))[0],'none');
 assert.equal(reads,0);
 // A replaced prepareStackTrace is never invoked to format a site.
 const prepare=Error.prepareStackTrace;let prepared=0;
 try{Error.prepareStackTrace=()=>{prepared++;return 'private';};assert.equal(detail(await firstRaw(Error('x')))[2],'none');}finally{Error.prepareStackTrace=prepare;}
 assert.equal(prepared,0);
 // Frame-shaped text inside the message is skipped with the header; private text never becomes a site or a field.
 const shaped=await firstRaw(Error('private-canary\n    at leak (/opt/private-canary-secret.mjs:1:1)'));
 assert.doesNotMatch(shaped,/private-canary/u);for(const entry of detail(shaped)[2].split(','))assert.match(entry,siteShape);
 // A data stack is parsed without formatting, and only basenames are printed.
 const preset=Error('x');Object.defineProperty(preset,'stack',{value:'Error: x\n    at run (/srv/private/dir/module.mjs:12:34)\n    at file:///srv/private/other.js:5:6\n    at node:internal/process/task_queues:105:5'});
 assert.equal(detail(await firstRaw(preset))[2],'module.mjs:12:34,other.js:5:6,node:task_queues:105:5');
 assert.equal(detail(await firstRaw(Object.assign(Error('x'),{stack:'no frames here'})))[2],'none');
});

test('the committed message-hash table resolves runner hashes with the runtime hash function',async()=>{
 const table=JSON.parse(await readFile(new URL('../../../docs/integration/runner-first-failure-message-hashes.json',import.meta.url),'utf8'));
 assert.equal(table.sdkVersion,'0.3.295');
 for(const row of table.messages)assert.equal(row.msg,firstFailureMessageHash(row.message),row.message);
 const lookup=new Map(table.messages.map(row=>[row.msg,row.message]));
 for(const message of ['LIFECYCLE_EXECUTION_UNKNOWN','DEADLINE','NATIVE_UNAVAILABLE','REMOTE_TASK_REFUSED','SDK_SESSION_REFUSED'])assert.equal(lookup.get(firstFailureMessageHash(message)),message);
});
