/** G3: one measured SDK-options pin for capability-bearing runs. The in-image measurement (first-chat-launch-measurement.mjs) projects a
 * capability profile's options exactly as the activity builds them; a run's template is a function of (profile, verified run facts) only,
 * so per-run availability never changes it; the runner gate (runner-query.mjs) admits the measured pin for that profile and refuses any
 * other profile. Scripted SDK query, synthetic ports; no provider, network or database. The full proposed profile through a real activity
 * needs real POSIX directories (workspace root, skill plugin copy) and runs on Linux; every other case runs on any host. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,realpathSync,readFileSync,writeFileSync,chmodSync,readdirSync,lstatSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import receipt from '../../../infra/product-preview/first-chat/launch-measurement-receipt.json' with {type:'json'};
import catalog from '../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {probeRun,probeTemplateSha256,measureFirstChatLaunch,main,PROBES} from '../build/first-chat-launch-measurement.mjs';
import {createPreparedRunnerQuery} from '../native-authority/runner-query.mjs';
import {projectNativeSdkOptions} from '../native-authority/sdk-option-projection.mjs';
import {sdkOptionsTemplateSha256,projectSdkOptionsTemplate,sdkOptionsRun,sdkConfigDirectory,sdkSkillPluginDirectory,authorityDigest,TEMPLATE_PLACEHOLDERS} from '../native-authority/sdk-option-template.mjs';
import {RUNNER_SDK_CA_FILE,LAUNCH_WORKSPACE_PLACEHOLDER,launchTemplateArgs,runLaunchArgs,compileNativePreparationIntent,matchPreparedDescriptor,matchPreparedDescriptorShape} from '../native-authority/preparation-intent.mjs';
import {continuationLaunchArgs} from '../native-authority/continuation-pin.mjs';
import {workspaceRule} from '../../worker/conversation/capabilities/workspace-tools.mjs';
import {query as sdkQuery} from '../../worker/conversation/agent-sdk.mjs';
import runtimeValues from '../../../infra/product-preview/first-chat/runtime-values.json' with {type:'json'};
import {PROPOSED_PREVIEW_CAPABILITY_PLATFORM,createConfiguredRunCapabilityPolicy} from '../product-ports/capability-policy.mjs';
import {createConversationActivity} from '../../worker/conversation/activity.mjs';
import {assertCapabilityPolicy} from '../../worker/conversation/capabilities/policy.mjs';
import {profileReads} from '../../worker/conversation/reads/availability.mjs';
import {prepareRunSkillPlugin,verifySkillPluginTree,SKILL_PLUGIN_TREE_SCHEMA} from '../../worker/conversation/capabilities/skill-plugin.mjs';
import {describeSkillPlugin,materializeSkillPlugin} from '../../../packages/skills/plugin.mjs';
import {createSdkMcpServer} from '../../worker/conversation/agent-sdk.mjs';
import {binding,versions,scopes,id} from '../../control/conversations/test/store-fixture.mjs';

const root=resolve(fileURLToPath(new URL('../../../',import.meta.url)));
const {capabilityProfileSha256:measuredProfile,...inputs}=receipt.inputs;
const PROFILE=createConfiguredRunCapabilityPolicy({capabilityPlatform:PROPOSED_PREVIEW_CAPABILITY_PLATFORM}).profile;
/** The proposed profile without the two capabilities whose run facts are real directories (the workspace root and the plugin copy). */
const PORTABLE={...PROFILE,skillPlugin:false,skillNames:null,workspaceTools:false};
const POSIX=process.platform!=='win32';
const quiet=()=>{const original=process.emitWarning;process.emitWarning=(warning,...rest)=>{if(String(rest[0]?.code??rest[0]??'').includes('SHADOWED')||String(warning).includes('canUseTool will not be invoked'))return;return original.call(process,warning,...rest);};return ()=>{process.emitWarning=original;};};
const gate=(sdkOptionsSha256,run)=>createPreparedRunnerQuery({sdkOptions:{sdkOptionsSha256,run},processClientFactory:()=>({}),prepare:()=>{throw Error('not reached');}});
const admitted=(pin,run,options)=>typeof gate(pin,run)({prompt:'p',options})[Symbol.asyncIterator]==='function';
const measured=async profile=>probeTemplateSha256({...inputs,...(profile===undefined?{}:{capabilityProfile:profile})},{root});

test('without a capability profile the measured template is unchanged: the committed receipt hash',async()=>{
 assert.ok(measuredProfile===undefined||measuredProfile===null,'no profile measured');
 assert.equal(await measured(),receipt.sdkOptions.sha256);
 assert.equal(receipt.sdkOptions.sha256,'af7f07b8f784884eae32e14e0b697d434d1668b0d68f55d203bf873c7af5431b');
});

test('the projection admits exactly the capability keys in canonical form and refuses any other key, server or hook event',()=>{
 const hook=async()=>({}),server=name=>createSdkMcpServer({name,version:'1.0.0',tools:[],timeout:60000});
 const options={disallowedTools:['Bash'],agentProgressSummaries:true,agents:{research:{description:'d',prompt:'p',tools:[],disallowedTools:['Agent'],model:'inherit',maxTurns:8,omitClaudeMd:true}},
  plugins:[{type:'local',path:'/run/meri/meri-skill-plugin',skipMcpDiscovery:true}],managedSettings:{permissions:{blockReadsOutsideWorkingDirectories:true,disableBypassPermissionsMode:'disable'}},
  mcpServers:{meri_reads:server('meri_reads'),meri_intents:server('meri_intents')},
  hooks:{PreToolUse:[{matcher:'mcp__meri_reads__.*',hooks:[hook]},{hooks:[hook,hook]}],SubagentStart:[{hooks:[hook]}],PreCompact:[{hooks:[hook]}]}};
 const p=projectNativeSdkOptions(options);
 assert.deepEqual(p.hooks,{PreToolUse:[{matcher:'mcp__meri_reads__.*',hooks:['approved-runner-callback']},{hooks:['approved-runner-callback','approved-runner-callback']}],SubagentStart:[{hooks:['approved-runner-callback']}],PreCompact:[{hooks:['approved-runner-callback']}]});
 assert.deepEqual(p.mcpServers,{meri_reads:{type:'sdk',name:'meri_reads',instance:'approved-runner-server',timeout:60000},meri_intents:{type:'sdk',name:'meri_intents',instance:'approved-runner-server',timeout:60000}});
 assert.deepEqual(p.agents,options.agents);assert.deepEqual(p.plugins,options.plugins);
 const bad=[{sandbox:{enabled:true}},{unknownOption:true},{mcpServers:{meri_browser:server('meri_browser')}},{mcpServers:{meri_reads:server('meri_intents')}},{hooks:{Stop:[{hooks:[hook]}]}},
  {hooks:{PreToolUse:[{matcher:'',hooks:[hook]}]}},{hooks:{PreToolUse:[]}},{managedSettings:{permissions:{},sandbox:{}}},{agents:{other:{}}},{agentProgressSummaries:false},
  {plugins:[options.plugins[0],options.plugins[0]]},{plugins:[{type:'local',path:'relative',skipMcpDiscovery:true}]},{disallowedTools:['Bash','Bash']}];
 for(const value of bad)assert.throws(()=>projectNativeSdkOptions(value),undefined,JSON.stringify(Object.keys(value)));
});

test('a capability profile with an unknown key refuses the measurement; a malformed flag value is a usage error',async()=>{
 // assertCapabilityPolicy: a closed key set (own() refuses an unknown key) and typed values.
 await assert.rejects(measured({...PORTABLE,unknownCapability:true}),/INVALID_COMMAND/u);
 await assert.rejects(measured({...PORTABLE,subagents:'yes'}),{code:'CAPABILITY_POLICY_REFUSED'});
 await assert.rejects(measured('not-a-profile'),/INVALID_COMMAND/u);
 const write=process.stderr.write;process.stderr.write=()=>true;
 try{assert.equal(await main(['--proxy-url','https://p.invalid','--capability-profile','%%%']),2);}finally{process.stderr.write=write;}
});

/** A trusted general-read port whose snapshot installs and grants exactly `operations` (synthetic availability facts). */
const readPort=(operations,{fail=false}={})=>({async readAvailability(){if(fail)throw Error('down');const at=Date.now();
 return {installation:{installationId:id(80),baseCatalogSha256:canonicalSha256(catalog),executionCatalogSha256:'e'.repeat(64),operations,checkedAtMs:at-1000,expiresAtMs:at+600000},
  discovery:{binding,policyRevision:scopes[0].policyRevision,operations,checkedAtMs:at-1000,expiresAtMs:at+600000}};},async execute(){throw Error('not called');}});
const intentPort=operations=>({async readAvailability(){const at=Date.now();return {binding,operations,checkedAtMs:at-1000,expiresAtMs:at+600000};},async prepare(){throw Error('not called');}});

/** One run through the actual activity (scripted SDK query), with the measurement's runtime inputs; returns the options and run facts. */
async function activityRun({profile,generalReads,governedIntents,cwd=`/workspace/${binding.conversationId}`,configParent='/run/meri',skillPluginDirectory}){
 let seen;const restore=quiet();
 try{
  const run={binding,versions,scopes,state:'queued',policyRevision:scopes[0].policyRevision,createdAt:new Date().toISOString()},request={requestId:id(500),prompt:'Synthetic prompt',window:null};
  const runtime={binding,versions,cwd,proxyUrl:inputs.proxyUrl,proxyCredential:'synthetic-task-capability',model:inputs.model,sessionStore:{async load(){},async append(){},async listSubkeys(){}},
   deadlineMs:Date.now()+60000,maxTurns:inputs.maxTurns,maxCostMicroUSD:inputs.maxCostMicroUSD,maxOutputBytes:inputs.maxOutputBytes,
   sdkConfigDirectory:sdkConfigDirectory(configParent,binding.runId),sdkSecureStorageDirectory:inputs.secureStorageDirectory,sdkCaFile:RUNNER_SDK_CA_FILE,...(skillPluginDirectory?{skillPluginDirectory}:{})};
  let n=700;const activity=createConversationActivity({runOwner:{async load(){return {run,request,capabilities:profile};},async append(){}},prepareRuntime:async()=>runtime,
   ...(generalReads?{generalReads}:{}),...(governedIntents?{governedIntents}:{}),newId:()=>id(n++),
   query:({options})=>{seen=options;return {async *[Symbol.asyncIterator](){yield {type:'result',subtype:'success',is_error:false};},close(){}};}});
  assert.deepEqual(await activity({binding}),{state:'completed'});
  const facts=sdkOptionsRun({workspace:cwd,configParentDirectory:configParent,authoritySha256:authorityDigest({scopes,selectedClientId:scopes[0].resourceId,policyRevision:scopes[0].policyRevision})},binding);
  return {options:seen,run:facts};
 }finally{restore();}
}

test('a capability-bearing run hashes to the one measured pin whatever its availability; the gate refuses another profile',async()=>{
 const pin=await measured(PORTABLE),without=await measured({...PORTABLE,subagents:false,subagentProgress:false});
 assert.notEqual(pin,receipt.sdkOptions.sha256);assert.notEqual(pin,without);
 const policy=assertCapabilityPolicy(PORTABLE),some=profileReads({policy}).slice(0,2).map(r=>r.operation);
 const a=await activityRun({profile:PORTABLE,generalReads:readPort(some),governedIntents:intentPort([{id:'create_task',version:'0.2.0'}])});
 const b=await activityRun({profile:PORTABLE});
 const c=await activityRun({profile:PORTABLE,generalReads:readPort([],{fail:true}),governedIntents:intentPort([])});
 for(const r of [a,b,c])assert.equal(sdkOptionsTemplateSha256(r.options,r.run),pin);
 for(const r of [a,b,c])assert.equal(admitted(pin,r.run,r.options),true);
 assert.throws(()=>gate(without,a.run)({prompt:'p',options:a.options}),/SDK_OPTIONS_REFUSED/u,'a different profile is never admitted');
 assert.throws(()=>gate(receipt.sdkOptions.sha256,a.run)({prompt:'p',options:a.options}),/SDK_OPTIONS_REFUSED/u,'nor the first-chat pin');
 const first=await activityRun({});assert.equal(sdkOptionsTemplateSha256(first.options,first.run),receipt.sdkOptions.sha256,'no policy: the unchanged first-chat pin');
 assert.throws(()=>gate(pin,first.run)({prompt:'p',options:first.options}),/SDK_OPTIONS_REFUSED/u);
 // The measured probe itself passes the same gate.
 const probe=await probeRun({...inputs,capabilityProfile:PORTABLE},{root});try{assert.equal(admitted(pin,probe.run,probe.options),true);}finally{await probe.close();}
});

const unseal=dir=>{try{chmodSync(dir,0o700);}catch{}for(const e of readdirSync(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory())unseal(p);else try{chmodSync(p,0o600);}catch{}}};
const scratch=()=>{const dir=realpathSync(mkdtempSync(join(tmpdir(),'meri-g3-')));return {dir,cleanup:()=>{unseal(dir);rmSync(dir,{recursive:true,force:true});}};};

test('the run skill plugin copy is materialized read-only with the exact pinned digest, verified when reused, refused when altered',async t=>{
 const s=scratch();t.after(s.cleanup);
 const directory=sdkSkillPluginDirectory(join(s.dir,'run')),reference=join(s.dir,'reference');mkdirSync(join(s.dir,'run'));
 const prepared=await prepareRunSkillPlugin(directory);assert.equal(prepared.directory,directory);
 // The exact digest: the manifest the skills package writes plus one SKILL.md per described skill at its catalog prose pin, nothing else.
 await materializeSkillPlugin({directory:reference});const plugin=describeSkillPlugin();
 const files=[{path:'.claude-plugin/plugin.json',sha256:createHash('sha256').update(readFileSync(join(reference,'.claude-plugin','plugin.json'))).digest('hex')},...plugin.skills.map(skill=>({path:`skills/${skill.name}/SKILL.md`,sha256:skill.proseSha256}))]
  .sort((x,y)=>x.path<y.path?-1:1);
 assert.equal(prepared.digest,canonicalSha256({schema:SKILL_PLUGIN_TREE_SCHEMA,files}));assert.equal(plugin.skills.length,14);
 const file=join(directory,'skills',plugin.skills[0].name,'SKILL.md');
 if(POSIX){assert.equal(lstatSync(file).mode&0o777,0o400);assert.equal(lstatSync(directory).mode&0o777,0o500);assert.equal(lstatSync(join(directory,'skills')).mode&0o777,0o500);}
 else assert.equal(lstatSync(file).mode&0o222,0,'read-only');
 assert.throws(()=>writeFileSync(file,'changed'),{code:POSIX?'EACCES':'EPERM'});
 assert.deepEqual(await prepareRunSkillPlugin(directory),prepared,'a reused copy verifies to the same digest and is never rewritten');
 if(POSIX)await assert.rejects(verifySkillPluginTree(directory,{uid:process.getuid()+1}),{code:'SKILL_PLUGIN_TREE_REFUSED'});
 chmodSync(file,0o600);writeFileSync(file,'altered');chmodSync(file,0o400);
 await assert.rejects(prepareRunSkillPlugin(directory),{code:'SKILL_PLUGIN_TREE_REFUSED'});
 for(const bad of ['relative',`${directory}/`,undefined])await assert.rejects(prepareRunSkillPlugin(bad),{code:'SKILL_PLUGIN_DIRECTORY_REFUSED'});
});

test('an extra entry in the plugin copy refuses',async t=>{
 const s=scratch();t.after(s.cleanup);const directory=join(s.dir,'meri-skill-plugin');await prepareRunSkillPlugin(directory);
 chmodSync(join(directory,'skills'),0o700);writeFileSync(join(directory,'skills','extra.md'),'x');chmodSync(join(directory,'skills','extra.md'),0o400);chmodSync(join(directory,'skills'),0o500);
 await assert.rejects(prepareRunSkillPlugin(directory),{code:'SKILL_PLUGIN_TREE_REFUSED'});
});

test('the template places the skill plugin path and workspace rules only for this run and refuses any other value',async()=>{
 const probe=await probeRun({...inputs,capabilityProfile:PROFILE},{root});
 try{
  const t=projectSdkOptionsTemplate(probe.options,probe.run).options,P=TEMPLATE_PLACEHOLDERS;
  assert.deepEqual(t.plugins,[{type:'local',path:P.skillPluginDirectory,skipMcpDiscovery:true}]);
  assert.deepEqual(t.settings.permissions.allow,[`Read(/${P.workspace}/**)`,`Edit(/${P.workspace}/**)`]);
  assert.deepEqual(Object.keys(t.mcpServers).sort(),['meri_intents','meri_reads']);
  for(const event of ['PreToolUse','PostToolUse','PostToolUseFailure','PreCompact','PostCompact','SubagentStart','SubagentStop'])assert.ok(t.hooks[event]?.length,event);
  const refuse=options=>assert.throws(()=>projectSdkOptionsTemplate(options,probe.run),/SDK_OPTIONS_REFUSED/u);
  refuse({...probe.options,plugins:[{...probe.options.plugins[0],path:join(probe.options.plugins[0].path,'..','elsewhere')}]});
  refuse({...probe.options,settings:{...probe.options.settings,permissions:{...probe.options.settings.permissions,allow:['Read(//workspace/other/**)']}}});
  refuse({...probe.options,settings:{...probe.options.settings,permissions:{...probe.options.settings.permissions,allow:[...probe.options.settings.permissions.allow,'Bash(*)']}}});
 }finally{await probe.close();}
});

test('the measurement reports one launch template for every run of the profile, the run workspace in --settings a placeholder',async()=>{
 const restore=quiet();try{
  const portable=await measureFirstChatLaunch({...inputs,capabilityProfile:PORTABLE},{root});
  assert.equal(portable.launchTemplateRunInvariant,true);assert.equal(portable.sdkOptions.runInvariant,true);assert.equal(portable.gates.runnerSdkOptions,'PASS');
  assert.equal(portable.inputs.capabilityProfileSha256,canonicalSha256(PORTABLE));assert.equal(portable.sdkOptions.sha256,await measured(PORTABLE));
  const full=await measureFirstChatLaunch({...inputs,capabilityProfile:PROFILE},{root});
  // The skill plugin copy's path is a launch argument, deliberately free of any per-run value.
  assert.ok(full.launchTemplate.args.includes(`--plugin-dir-no-mcp=${sdkSkillPluginDirectory(inputs.configParentDirectory)}`));
  assert.equal(full.sdkOptions.runInvariant,true);assert.equal(full.gates.runnerSdkOptions,'PASS');assert.equal(full.launchTemplateRunInvariant,true);
  const settings=full.launchTemplate.args[full.launchTemplate.args.indexOf('--settings')+1];
  assert.deepEqual(JSON.parse(settings).permissions.allow,[`Read(/${LAUNCH_WORKSPACE_PLACEHOLDER}/**)`,`Edit(/${LAUNCH_WORKSPACE_PLACEHOLDER}/**)`]);
  assert.equal(JSON.stringify(full.launchTemplate).includes('/workspace/'),false,'no probe workspace in the launch template');
  if(process.platform==='linux')assert.equal(full.gates.matchPreparedDescriptor,'PASS');
 }finally{restore();}
});

/** The pinned SDK's launch descriptor for one probe run's options (spawn hook interrupted; nothing is spawned). */
async function capturedLaunch(profile,probe){
 const p=await probeRun({...inputs,...(profile===undefined?{}:{capabilityProfile:profile})},{root,binding:probe});let d;
 try{try{sdkQuery({prompt:'p',options:{...p.options,spawnClaudeCodeProcess(r){d={command:r.command,args:[...r.args],cwd:r.cwd,env:{...r.env}};throw Error('captured');}}});}catch{}}finally{await p.close();}
 assert.ok(d);return d;
}

test('two conversations under the full profile share one launch template; each launch is it with exactly its own workspace',async()=>{
 const restore=quiet();try{
  const one=await capturedLaunch(PROFILE,PROBES[0]),two=await capturedLaunch(PROFILE,PROBES[1]);
  assert.notDeepEqual(one.args,two.args,'the SDK puts each run workspace into --settings');
  const template=launchTemplateArgs(one.args,one.cwd);
  assert.deepEqual(launchTemplateArgs(two.args,two.cwd),template,'one template');
  assert.deepEqual(runLaunchArgs(template,two.cwd),two.args,'byte-exact launch of run two');assert.deepEqual(runLaunchArgs(template,one.cwd),one.args);
  assert.notDeepEqual(runLaunchArgs(template,one.cwd),two.args,'run one workspace is not run two launch');
  // The workspace anywhere but the --settings allow rules, or a template placeholder outside them, refuses.
  assert.throws(()=>launchTemplateArgs([...one.args,'--add-dir',one.cwd],one.cwd),/PREPARATION_REFUSED/u);
  assert.throws(()=>runLaunchArgs([...template,LAUNCH_WORKSPACE_PLACEHOLDER],two.cwd),/PREPARATION_REFUSED/u);
  assert.throws(()=>launchTemplateArgs(template,one.cwd),/PREPARATION_REFUSED/u,'a template is never re-templated');
 }finally{restore();}
});

test('matchPreparedDescriptor holds one launch template across conversations and refuses a tampered --settings',async()=>{
 const restore=quiet();let full;try{full=await measureFirstChatLaunch({...inputs,capabilityProfile:PROFILE},{root});}finally{restore();}
 // Paths valid on this host; each descriptor's --settings is built independently from workspace-tools.mjs workspaceRule.
 const configParentDirectory=resolve('/g3/run'),secureStorageDirectory=join(configParentDirectory,'sdk-secure'),credential='synthetic-task-capability';
 const at=full.launchTemplate.args.indexOf('--settings')+1,base=JSON.parse(full.launchTemplate.args[at]);
 const launchTemplate={command:process.execPath,args:full.launchTemplate.args,env:{...full.launchTemplate.env,CLAUDE_SECURESTORAGE_CONFIG_DIR:secureStorageDirectory}};
 const workspace=probe=>resolve('/g3/workspace',probe.conversationId);
 const intent=probe=>({workspace:workspace(probe),configParentDirectory,secureStorageDirectory,launchTemplate,executableSha256:'a'.repeat(64),imageSha256:'b'.repeat(64),runnerSha256:'c'.repeat(64),sdkOptionsSha256:'d'.repeat(64),authoritySha256:'e'.repeat(64)});
 const settings=(rules,extra={})=>JSON.stringify({...base,...extra,permissions:{...base.permissions,allow:rules}});
 const descriptor=(probe,token)=>({command:process.execPath,args:launchTemplate.args.map((a,i)=>i===at?token:a),cwd:workspace(probe),env:{...launchTemplate.env,CLAUDE_CONFIG_DIR:join(configParentDirectory,'sdk-'+probe.runId),ANTHROPIC_AUTH_TOKEN:credential}});
 const own=probe=>settings([workspaceRule('Read',workspace(probe)),workspaceRule('Edit',workspace(probe))]);
 for(const probe of PROBES){
  assert.equal(matchPreparedDescriptor(descriptor(probe,own(probe)),intent(probe),credential).args[at],own(probe));
  assert.equal(matchPreparedDescriptorShape(descriptor(probe,own(probe)),intent(probe)).cwd,workspace(probe));}
 assert.deepEqual(intent(PROBES[0]).launchTemplate,intent(PROBES[1]).launchTemplate,'both runs are configured with the one template');
 // Continuation arguments still land exactly where the SDK emits them, around the run's own --settings.
 const continuation={resume:'00000000-0000-4000-8000-0000000000aa'},resumed=continuationLaunchArgs(runLaunchArgs(launchTemplate.args,workspace(PROBES[1])),continuation);
 assert.deepEqual(matchPreparedDescriptor({...descriptor(PROBES[1],own(PROBES[1])),args:resumed},intent(PROBES[1]),credential,continuation).args,resumed);
 const refused=d=>{assert.throws(()=>matchPreparedDescriptor(d,intent(PROBES[1]),credential),/PREPARATION_REFUSED/u);assert.throws(()=>matchPreparedDescriptorShape(d,intent(PROBES[1])),/PREPARATION_REFUSED/u);};
 const two=workspace(PROBES[1]);
 refused(descriptor(PROBES[1],own(PROBES[0])));                                                         // another conversation's workspace
 refused(descriptor(PROBES[1],settings([workspaceRule('Read',two),workspaceRule('Edit',resolve('/g3'))]))); // a widened rule
 refused(descriptor(PROBES[1],settings([workspaceRule('Read',two)])));                                  // a dropped rule
 refused(descriptor(PROBES[1],settings([workspaceRule('Read',two),workspaceRule('Edit',two),'Bash(*)']))); // an added rule
 refused(descriptor(PROBES[1],settings([workspaceRule('Read',two),workspaceRule('Edit',two)],{autoMemoryEnabled:true}))); // another byte
 refused(descriptor(PROBES[1],own(PROBES[1]).replace('{','{ ')));                                        // not the SDK's canonical bytes
 refused(descriptor(PROBES[1],settings([`Read(/${LAUNCH_WORKSPACE_PLACEHOLDER}/**)`,`Edit(/${LAUNCH_WORKSPACE_PLACEHOLDER}/**)`]))); // the placeholder itself
 // A configured template with the placeholder anywhere but exactly the --settings workspace rules never compiles.
 for(const args of [[...launchTemplate.args,LAUNCH_WORKSPACE_PLACEHOLDER],launchTemplate.args.map((a,i)=>i===at?settings([`Read(/${LAUNCH_WORKSPACE_PLACEHOLDER}/**)`,'Bash(*)']):a),
  launchTemplate.args.map((a,i)=>i===at?settings([`Read(/${LAUNCH_WORKSPACE_PLACEHOLDER}/**)`],{note:LAUNCH_WORKSPACE_PLACEHOLDER}):a)])
  assert.throws(()=>compileNativePreparationIntent({...intent(PROBES[0]),launchTemplate:{...launchTemplate,args}}),/PREPARATION_REFUSED/u);
});

test('without a capability profile the launch template, its run launch and every hash are unchanged',async()=>{
 const none=await measureFirstChatLaunch(inputs,{root});
 assert.deepEqual(none.launchTemplate.args,receipt.launchTemplate.args);assert.deepEqual(none.launchTemplate.env,receipt.launchTemplate.env);
 assert.equal(none.launchTemplateRunInvariant,true);assert.equal(none.sdkOptions.sha256,receipt.sdkOptions.sha256);assert.equal(none.sdkOptions.secondProbeSha256,receipt.sdkOptions.sha256);assert.equal(none.inputs.capabilityProfileSha256,null);
 assert.equal(JSON.stringify(receipt.launchTemplate).includes(LAUNCH_WORKSPACE_PLACEHOLDER),false);
 for(const args of [receipt.launchTemplate.args,runtimeValues.preparationIntent.launchTemplate.args]){
  assert.equal(canonicalSha256(launchTemplateArgs(args,'/workspace/00000000-0000-4000-8000-000000000001')),canonicalSha256(args));
  assert.equal(canonicalSha256(runLaunchArgs(args,'/workspace/00000000-0000-4000-8000-000000000011')),canonicalSha256(args));}
});

test('Linux: the full proposed profile through a real activity over real directories hashes to the measured pin',{skip:!POSIX&&'real POSIX workspace and plugin directories'},async t=>{
 const s=scratch();t.after(s.cleanup);
 const configParent=join(s.dir,'run'),cwd=join(s.dir,'workspace',binding.conversationId);mkdirSync(configParent,{recursive:true});mkdirSync(cwd,{recursive:true});
 const plugin=await prepareRunSkillPlugin(sdkSkillPluginDirectory(configParent)),pin=await measured(PROFILE);
 const policy=assertCapabilityPolicy(PROFILE),some=profileReads({policy}).slice(0,4).map(r=>r.operation);
 const a=await activityRun({profile:PROFILE,cwd,configParent,skillPluginDirectory:plugin.directory,generalReads:readPort(some),governedIntents:intentPort([{id:'create_word',version:'0.2.0'}])});
 const b=await activityRun({profile:PROFILE,cwd,configParent,skillPluginDirectory:plugin.directory});
 for(const r of [a,b]){assert.equal(sdkOptionsTemplateSha256(r.options,r.run),pin);assert.equal(admitted(pin,r.run,r.options),true);}
 const portable=await measured(PORTABLE);assert.throws(()=>gate(portable,a.run)({prompt:'p',options:a.options}),/SDK_OPTIONS_REFUSED/u);
});
