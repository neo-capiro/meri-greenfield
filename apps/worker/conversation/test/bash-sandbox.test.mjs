/** Bash only inside the SDK sandbox: admission, exact SDK settings, fragment invariants and option merging. No SDK process. */
import test from 'node:test';import assert from 'node:assert/strict';
import {assertCapabilityPolicy} from '../capabilities/policy.mjs';
import {admitBash,assertBashSandboxAttestation,buildBashSandboxSettings,buildBashSandboxLocks,createBashSandbox,SANDBOX_DENIED_ENV,assertSandboxSettings,assertSandboxLocks} from '../capabilities/bash-sandbox.mjs';
import {assertCapabilityFragment} from '../capabilities/fragment.mjs';
import {createSdkCapabilities} from '../capabilities/index.mjs';
import {buildConversationOptions} from '../options.mjs';
import {binding,versions,id} from '../../../control/conversations/test/application-fixture.mjs';
const cwd=`/workspace/conversations/${binding.conversationId}`,signal=new AbortController().signal;
const attested=Object.freeze({available:true,sdk:'0.3.295',cli:'2.1.295',weakerNestedSandbox:false,outerIsolationBoundary:true});
const facts=(extra={})=>({runOwner:{append:async()=>{}},binding,cwd,now:Date.now,newId:()=>id(1),...extra});
const runtime=(extra={})=>({binding,versions,cwd,proxyUrl:'https://trusted-proxy.invalid',proxyCredential:'synthetic-task-capability',model:'qualified-model-pin',sessionStore:{async load(){return null;},async append(){}},deadlineMs:Date.now()+1000,maxTurns:2,maxCostMicroUSD:1000,maxOutputBytes:1024,...extra});
const clone=v=>JSON.parse(JSON.stringify(v));

test('the attestation is a closed trusted fact; weaker nested sandboxing needs the outer disposable worker as the boundary',()=>{
 assert.deepEqual(assertBashSandboxAttestation(attested),attested);assert.ok(Object.isFrozen(assertBashSandboxAttestation({...attested,readinessSha256:'a'.repeat(64)})));
 assert.equal(assertBashSandboxAttestation({...attested,weakerNestedSandbox:true}).weakerNestedSandbox,true);
 for(const bad of [{...attested,weakerNestedSandbox:true,outerIsolationBoundary:false},{...attested,sdk:'0.3.294'},{...attested,cli:'2.1.296'},{...attested,available:'yes'},{...attested,extra:1},{...attested,readinessSha256:'x'},{available:true},null])
  assert.throws(()=>assertBashSandboxAttestation(bad),/BASH_SANDBOX_ATTESTATION_REFUSED|INVALID_COMMAND/,JSON.stringify(bad));
});

test('Bash is admitted only with explicit policy eligibility AND an available attestation; workspaceTools alone never admits it',()=>{
 const cases=[[{workspaceTools:true},attested,false],[{workspaceTools:true,workspaceToolNames:['Read','Write','Edit','Glob','Grep']},attested,false],[{bash:true},undefined,false],[{bash:true},{...attested,available:false},false],[{bash:true},attested,true],[{bash:true,workspaceTools:false},attested,true]];
 for(const [policy,attestation,expected] of cases){
  assert.equal(admitBash(assertCapabilityPolicy(policy),attestation),expected,JSON.stringify([policy,attestation]));
  const c=createSdkCapabilities(policy,facts(attestation===undefined?{}:{bashSandbox:attestation}));
  assert.equal(c.bashAdmitted,expected);assert.equal(c.policy.bash,expected,'the returned policy is the one applied');
  assert.equal((c.options.tools??[]).includes('Bash'),expected);if(c.options.tools)assert.equal(c.options.disallowedTools.includes('Bash'),!expected,'not admitted means listed in disallowedTools');
  assert.equal(c.options.sandbox!==undefined,expected);assert.equal(c.options.env!==undefined,expected);
 }
 assert.throws(()=>createSdkCapabilities({bash:true},facts({bashSandbox:{...attested,weakerNestedSandbox:true,outerIsolationBoundary:false}})),/BASH_SANDBOX_ATTESTATION_REFUSED/);
});

test('the SDK sandbox settings lock every escape hatch, scrub every worker credential and confine writes to the task workspace',async()=>{
 const p=createBashSandbox(assertCapabilityPolicy({bash:true,sandboxNetworkDomains:['pypi.org','*.github.com']}),{cwd,attestation:attested,protectedPaths:{sdkConfigDirectory:'/run/meri/sdk/config',sdkSecureStorageDirectory:'/run/meri/sdk/secure'}});
 assert.deepEqual(p.tools,['Bash']);assert.deepEqual(p.allowedTools,[],'sandboxed Bash is auto-allowed by the SDK, never by name');assert.equal((await p.canUseTool('Bash',{command:'ls'},{signal})).behavior,'deny','a Bash call reaching the callback was not auto-allowed as sandboxed');
 assert.deepEqual(p.sandbox,{enabled:true,failIfUnavailable:true,autoAllowBashIfSandboxed:true,allowUnsandboxedCommands:false,
  network:{allowedDomains:['pypi.org','*.github.com'],strictAllowlist:true,allowAllUnixSockets:false,allowLocalBinding:false},
  filesystem:{allowWrite:[cwd],denyRead:['/run/meri/sdk/secure'],disabled:false},
  credentials:{envVars:SANDBOX_DENIED_ENV.map(name=>({name,mode:'deny'})),files:[{path:'/run/meri/sdk/config/.credentials.json',mode:'deny'}]},enableWeakerNestedSandbox:false});
 for(const name of ['ANTHROPIC_AUTH_TOKEN','ANTHROPIC_API_KEY','CLAUDE_CODE_OAUTH_TOKEN','AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY','AWS_SESSION_TOKEN','AWS_CONTAINER_CREDENTIALS_RELATIVE_URI','AWS_CONTAINER_CREDENTIALS_FULL_URI'])assert.ok(SANDBOX_DENIED_ENV.includes(name),name);
 assert.deepEqual(p.env,{CLAUDE_CODE_SUBPROCESS_ENV_SCRUB:'1'});
 assert.deepEqual(p.managedSettings,{sandbox:buildBashSandboxLocks(false)});assert.equal(p.managedSettings.sandbox.enableWeakerNestedSandbox,false);
 for(const key of ['allowUnixSockets','httpProxyPort','socksProxyPort','tlsTerminate','allowMachLookup','deniedDomains'])assert.equal(Object.hasOwn(p.sandbox.network,key),false,key);
 for(const key of ['excludedCommands','ignoreViolations','bwrapPath','socatPath','ripgrep','enableWeakerNetworkIsolation','allowAppleEvents'])assert.equal(Object.hasOwn(p.sandbox,key),false,key);
 const weaker=createBashSandbox(assertCapabilityPolicy({bash:true}),{cwd,attestation:{...attested,weakerNestedSandbox:true}});assert.equal(weaker.sandbox.enableWeakerNestedSandbox,true);assert.equal(Object.hasOwn(weaker.managedSettings.sandbox,'enableWeakerNestedSandbox'),false,'the policy tier must not lock off what the attestation requires');
 assert.deepEqual(weaker.sandbox.credentials.files,[{path:'~/.claude/.credentials.json',mode:'deny'}]);assert.deepEqual(weaker.sandbox.filesystem.denyRead,[]);
 assert.deepEqual(buildBashSandboxSettings({cwd,domains:[],weakerNestedSandbox:false,protectedPaths:{sdkConfigDirectory:'/c',sdkSecureStorageDirectory:'/c'}}).filesystem.denyRead,[],'one shared directory is protected through the credentials file entry');
 for(const bad of [{cwd:'relative',domains:[],weakerNestedSandbox:false},{cwd,domains:[],weakerNestedSandbox:false,protectedPaths:{sdkConfigDirectory:'rel'}}])assert.throws(()=>buildBashSandboxSettings(bad),/BASH_SANDBOX_CONFIGURATION/);
});

test('a fragment can never carry Bash without the locked sandbox, its policy-tier locks and the credential scrub',()=>{
 const good=createSdkCapabilities({bash:true,workspaceTools:true},facts({bashSandbox:attested})).options;assert.doesNotThrow(()=>assertCapabilityFragment(good));
 const {sandbox,env,managedSettings,...rest}=good;
 for(const bad of [{...rest},{...rest,sandbox,env},{...rest,sandbox,managedSettings},{...rest,env,managedSettings},{...rest,managedSettings:{permissions:managedSettings.permissions},sandbox,env},{tools:['Read'],disallowedTools:[]},{tools:['Read'],disallowedTools:['Agent']}])
  assert.throws(()=>assertCapabilityFragment(bad),/CAPABILITY_FRAGMENT_REFUSED/,Object.keys(bad).join());
 const withSandbox=(mutate)=>{const s=clone(sandbox);mutate(s);return s;};
 for(const mutate of [s=>{s.failIfUnavailable=false;},s=>{s.allowUnsandboxedCommands=true;},s=>{s.enabled=false;},s=>{s.autoAllowBashIfSandboxed=false;},s=>{s.network.strictAllowlist=false;},s=>{s.network.allowAllUnixSockets=true;},s=>{s.network.allowUnixSockets=['/var/run/docker.sock'];},s=>{s.network.allowLocalBinding=true;},s=>{s.network.httpProxyPort=8080;},s=>{s.network.allowedDomains=['169.254.169.254'];},s=>{s.filesystem.disabled=true;},s=>{s.filesystem.allowWrite=['/'];},s=>{s.filesystem.allowWrite=[cwd,'/tmp'];},s=>{s.excludedCommands=['curl'];},s=>{s.ignoreViolations={'*':['/']};},s=>{s.bwrapPath='/tmp/bwrap';},s=>{s.credentials.envVars=s.credentials.envVars.slice(1);},s=>{s.credentials.envVars[0].mode='mask';},s=>{s.credentials.files[0].mode='mask';},s=>{s.enableWeakerNestedSandbox='yes';}])
  assert.throws(()=>assertSandboxSettings(withSandbox(mutate)),/CAPABILITY_FRAGMENT_REFUSED|INVALID_COMMAND/,String(mutate));
 for(const mutate of [s=>{s.failIfUnavailable=false;},s=>{s.enableWeakerNestedSandbox=true;},s=>{s.network.allowAllUnixSockets=true;},s=>{s.autoAllowBashIfSandboxed=true;},s=>{s.network.allowedDomains=['example.com'];}]){const s=clone(managedSettings.sandbox);mutate(s);assert.throws(()=>assertSandboxLocks(s),/CAPABILITY_FRAGMENT_REFUSED|INVALID_COMMAND/,String(mutate));}
 for(const envValue of [{CLAUDE_CODE_SUBPROCESS_ENV_SCRUB:'0'},{CLAUDE_CODE_SUBPROCESS_ENV_SCRUB:'1',ANTHROPIC_BASE_URL:'https://evil.invalid'},{}])assert.throws(()=>assertCapabilityFragment({...good,env:envValue}),/CAPABILITY_FRAGMENT_REFUSED|INVALID_COMMAND/,JSON.stringify(envValue));
 for(const settings of [{permissions:{...good.settings.permissions,defaultMode:'bypassPermissions'}},{permissions:good.settings.permissions,env:{X:'1'}},{permissions:{...good.settings.permissions,allow:['Bash(*)']}}])assert.throws(()=>assertCapabilityFragment({...good,settings}),/CAPABILITY_FRAGMENT_REFUSED|INVALID_COMMAND/,JSON.stringify(settings));
});

test('conversation options keep the fixed base: settings and env are extended, never replaced, and every worker credential is scrubbed',()=>{
 const r=runtime({sdkConfigDirectory:'/run/meri/sdk/config',sdkSecureStorageDirectory:'/run/meri/sdk/secure',bashSandbox:attested});
 const c=createSdkCapabilities({bash:true,workspaceTools:true,workspaceToolNames:['Read']},facts({bashSandbox:attested,sdkConfigDirectory:r.sdkConfigDirectory,sdkSecureStorageDirectory:r.sdkSecureStorageDirectory}));
 const o=buildConversationOptions(r,new AbortController(),undefined,undefined,c.options);
 assert.deepEqual(o.settingSources,[]);assert.equal(o.permissionMode,'default');assert.equal(o.settings.autoMemoryEnabled,false);assert.equal(o.settings.permissions.blockReadsOutsideWorkingDirectories,true);
 assert.deepEqual(Object.keys(o.env),['ANTHROPIC_BASE_URL','ANTHROPIC_AUTH_TOKEN','CLAUDE_CONFIG_DIR','CLAUDE_SECURESTORAGE_CONFIG_DIR','CLAUDE_CODE_SUBPROCESS_ENV_SCRUB']);assert.equal(o.env.ANTHROPIC_AUTH_TOKEN,'synthetic-task-capability');
 for(const key of Object.keys(o.env).filter(k=>/TOKEN|KEY|SECRET|PASSWORD|CREDENTIAL/u.test(k)))assert.ok(SANDBOX_DENIED_ENV.includes(key),`credential ${key} is unset for sandboxed commands`);
 assert.deepEqual(o.sandbox.filesystem.denyRead,['/run/meri/sdk/secure']);assert.deepEqual(o.sandbox.credentials.files,[{path:'/run/meri/sdk/config/.credentials.json',mode:'deny'}]);
 assert.deepEqual(o.tools,['Read','Bash']);assert.equal(o.managedSettings.sandbox.allowUnsandboxedCommands,false);assert.equal(o.managedSettings.permissions.blockReadsOutsideWorkingDirectories,true,'policy-tier locks from both pieces merge');
 assert.throws(()=>buildConversationOptions(runtime({bashSandbox:{...attested,weakerNestedSandbox:true,outerIsolationBoundary:false}}),new AbortController()),/BASH_SANDBOX_ATTESTATION_REFUSED/);
});

test('every hook validation, projection or publication failure latches and check() refuses completion; no event follows a latch',async()=>{
 const events=[];const runOwner={append:async({event})=>{events.push(event.type);}};const o=()=>({signal});
 const base={session_id:id(40),transcript_path:'/tmp/t.jsonl',cwd};
 const fires=[
  ['PreToolUse audit',{auditHooks:true},c=>c.options.hooks.PreToolUse[0].hooks[0]({...base,hook_event_name:'PreToolUse',tool_name:'Read',tool_input:{},tool_use_id:''},'x',o())],
  ['PostToolUse audit',{auditHooks:true},c=>c.options.hooks.PostToolUse[0].hooks[0]({...base,hook_event_name:'PostToolUse'},'x',o())],
  ['PostToolUseFailure audit',{auditHooks:true},c=>c.options.hooks.PostToolUseFailure[0].hooks[0](null,'x',o())],
  ['PreCompact',{compactionHooks:true},c=>c.options.hooks.PreCompact[0].hooks[0]({...base,hook_event_name:'PreCompact',trigger:'x'},undefined,o())],
  ['PostCompact',{compactionHooks:true},c=>c.options.hooks.PostCompact[0].hooks[0]({...base,hook_event_name:'PostCompact'},undefined,o())],
  ['SubagentStart',{subagents:true},c=>c.options.hooks.SubagentStart[0].hooks[0]({...base,hook_event_name:'SubagentStart',agent_id:'a'},undefined,o())],
  ['SubagentStop',{subagents:true},c=>c.options.hooks.SubagentStop[0].hooks[0]({...base,hook_event_name:'SubagentStop',agent_type:'research'},undefined,o())],
  ['Agent admission input',{subagents:true},c=>c.options.hooks.PreToolUse[0].hooks[0]({...base,hook_event_name:'PreToolUse',tool_name:'Agent',tool_input:{description:'d',prompt:'p',subagent_type:'research',isolation:'remote'},tool_use_id:'t1'},'t1',o())],
  ['Agent admission hook input',{subagents:true},c=>c.options.hooks.PreToolUse[0].hooks[0]({...base,hook_event_name:'PostToolUse',tool_name:'Agent',tool_use_id:'t1'},'t1',o())],
  ['Agent release hook input',{subagents:true},c=>c.options.hooks.PostToolUseFailure[0].hooks[0]({...base,hook_event_name:'PostToolUseFailure',tool_name:'Agent'},undefined,o())]];
 for(const [name,policy,fire] of fires){
  events.length=0;const c=createSdkCapabilities(policy,facts({runOwner}));c.check();
  const result=await fire(c);assert.ok(result.continue===false||result.hookSpecificOutput?.permissionDecision==='deny',name);
  assert.throws(()=>c.check(),/CAPABILITY_HOOK_FAILED/,name);
  const before=events.length;
  if(policy.auditHooks)await c.options.hooks.PreToolUse[0].hooks[0]({...base,hook_event_name:'PreToolUse',tool_name:'Read',tool_input:{},tool_use_id:'ok'},'ok',o());
  if(policy.subagents)await c.options.hooks.SubagentStart[0].hooks[0]({...base,hook_event_name:'SubagentStart',agent_id:'a',agent_type:'research'},undefined,o());
  assert.equal(events.length,before,`${name}: no event is attempted after the latch`);
 }
});
