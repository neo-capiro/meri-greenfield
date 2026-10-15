/** The optional capability fragment leaves the default options byte-identical and merges strictly with the mounted skill options. */
import test from 'node:test';import assert from 'node:assert/strict';
import {buildConversationOptions} from '../options.mjs';
import {createSdkCapabilities} from '../capabilities/index.mjs';
import {assertCapabilityFragment,mergeCapabilityFragment} from '../capabilities/fragment.mjs';
import {binding,versions,id} from '../../../control/conversations/test/application-fixture.mjs';
const cwd=`/workspace/conversations/${binding.conversationId}`,plugin='/opt/meri/image/skill-plugin';
const runtime=()=>({binding,versions,cwd,proxyUrl:'https://trusted-proxy.invalid',proxyCredential:'synthetic-task-capability',model:'qualified-model-pin',sessionStore:{async load(){return null;},async append(){}},deadlineMs:Date.now()+1000,maxTurns:2,maxCostMicroUSD:1000,maxOutputBytes:1024});
const serial=o=>JSON.stringify(o,(k,v)=>typeof v==='function'?`fn:${v.length}`:v instanceof AbortController?'abort':v);
const DEFAULT_KEYS=['cwd','abortController','settingSources','settings','skills','allowedTools','tools','permissionMode','canUseTool','includePartialMessages','systemPrompt','model','maxTurns','maxBudgetUsd','sessionStore','sessionStoreFlush','env'];
const hook=async()=>({});
const skillOptions=()=>({mcpServers:{meri_original_reads:{type:'sdk',name:'meri_original_reads',instance:{close(){}}}},allowedTools:['mcp__meri_original_reads__read_a'],canUseTool:async name=>name==='mcp__meri_original_reads__read_a'?{behavior:'allow',updatedInput:{}}:{behavior:'deny',message:'Tool unavailable'},hooks:{PreToolUse:[{matcher:'mcp__meri_original_reads__.*',hooks:[hook]}]}});
const facts=()=>({runOwner:{append:async()=>{}},binding,cwd,now:Date.now,newId:()=>id(1),skillPluginDirectory:plugin});

test('an absent or all-off capability fragment keeps the default options byte-identical in shape and order',()=>{
 const controller=new AbortController(),r=runtime(),reference=buildConversationOptions(r,controller);
 assert.deepEqual(Object.keys(reference),DEFAULT_KEYS);
 assert.equal(serial(buildConversationOptions(r,controller,undefined,undefined)),serial(reference));
 assert.equal(serial(buildConversationOptions(r,controller,undefined,undefined,undefined)),serial(reference));
 assert.equal(serial(buildConversationOptions(r,controller,undefined,undefined,createSdkCapabilities({},facts()).options)),serial(reference));
 assert.deepEqual(reference.tools,[]);assert.deepEqual(reference.allowedTools,[]);assert.deepEqual(reference.skills,[]);assert.equal(reference.agents,undefined);assert.equal(reference.plugins,undefined);assert.equal(reference.hooks,undefined);
 const withPlugin=buildConversationOptions({...r,skillPluginDirectory:plugin},controller);assert.equal(serial(withPlugin),serial(reference),'the plugin path is a runtime fact, not an SDK option by itself');
 for(const bad of [cwd,`${cwd}/plugin`,'relative',`${plugin}/`])assert.throws(()=>buildConversationOptions({...r,skillPluginDirectory:bad},controller),/SKILL_PLUGIN_DIRECTORY_REFUSED/);
});

test('the capability fragment is merged additively: allowedTools union, hooks by event, permission callbacks chained',async()=>{
 const controller=new AbortController(),r=runtime(),capabilities=createSdkCapabilities({subagents:true,auditHooks:true,compactionHooks:true,skillPlugin:true,workspaceTools:true,workspaceToolNames:['Read','Grep'],subagentProgress:true},facts());
 const o=buildConversationOptions(r,controller,undefined,skillOptions(),capabilities.options);
 assert.deepEqual(Object.keys(o).slice(0,DEFAULT_KEYS.length),DEFAULT_KEYS);
 assert.deepEqual(o.settingSources,[]);assert.equal(o.permissionMode,'default');assert.equal(o.settings.autoMemoryEnabled,false);
 assert.deepEqual(o.tools,['Read','Grep','Agent','Skill']);assert.deepEqual(o.allowedTools,['mcp__meri_original_reads__read_a','Read','Grep','Agent']);assert.ok(o.disallowedTools.includes('Bash')&&o.disallowedTools.includes('WebFetch')&&!o.disallowedTools.includes('Read'));
 assert.deepEqual(Object.keys(o.hooks),['PreToolUse','PostToolUse','PostToolUseFailure','SubagentStart','SubagentStop','PreCompact','PostCompact']);
 assert.equal(o.hooks.PreToolUse[0].matcher,'mcp__meri_original_reads__.*');assert.equal(o.hooks.PreToolUse[0].hooks[0],hook);assert.equal(o.hooks.PreToolUse.length,4);
 assert.deepEqual(o.plugins,[{type:'local',path:plugin,skipMcpDiscovery:true}]);assert.equal(o.skills.length,13);assert.deepEqual(Object.keys(o.agents),['research','analysis','artifact_production','verification']);assert.equal(o.agentProgressSummaries,true);assert.equal(o.forwardSubagentText,undefined);
 assert.equal(o.mcpServers.meri_original_reads.name,'meri_original_reads');
 const signal=new AbortController().signal;
 assert.equal((await o.canUseTool('mcp__meri_original_reads__read_a',{},{signal})).behavior,'allow');assert.equal((await o.canUseTool('Read',{file_path:`${cwd}/a`},{signal})).behavior,'allow');assert.equal((await o.canUseTool('Read',{file_path:'/etc/hosts'},{signal})).behavior,'deny');assert.equal((await o.canUseTool('Bash',{command:'ls'},{signal})).behavior,'deny');assert.equal((await o.canUseTool('mcp__meri_original_reads__other',{},{signal})).behavior,'deny');
 const alone=buildConversationOptions(r,controller,undefined,undefined,capabilities.options);assert.deepEqual(alone.allowedTools,['Read','Grep','Agent']);assert.equal(alone.hooks.PreToolUse.length,3);assert.equal((await alone.canUseTool('Read',{file_path:`${cwd}/a`},{signal})).behavior,'allow');
});

test('fragment validation refuses unknown keys, undeclared hook events, foreign agent types and cwd plugin paths',()=>{
 const controller=new AbortController(),r=runtime();
 for(const bad of [{unknownOption:true},{tools:['Read','Read']},{hooks:{Stop:[{hooks:[hook]}]}},{hooks:{PreToolUse:[]}},{hooks:{PreToolUse:[{hooks:[hook],timeout:5}]}},{agents:{Explore:{description:'d',prompt:'p',tools:[],disallowedTools:[],model:'inherit',maxTurns:1,omitClaudeMd:true}}},{agents:{research:{description:'d',prompt:'p',tools:[],disallowedTools:[],model:'opus',maxTurns:1,omitClaudeMd:true}}},{plugins:[{type:'local',path:'relative',skipMcpDiscovery:true}]},{plugins:[{type:'local',path:plugin,skipMcpDiscovery:false}]},{plugins:[]},{skills:['Bad Name']},{agentProgressSummaries:false},{canUseTool:'x'},{permissionMode:'bypassPermissions'},{forwardSubagentText:true},{settingSources:['project']}])
  {assert.throws(()=>assertCapabilityFragment(bad),/CAPABILITY_FRAGMENT_REFUSED|INVALID_COMMAND/,JSON.stringify(bad));assert.throws(()=>buildConversationOptions(r,controller,undefined,undefined,bad),/CAPABILITY_FRAGMENT_REFUSED|INVALID_COMMAND/,JSON.stringify(bad));}
 assert.deepEqual(mergeCapabilityFragment({},{tools:['Read']}),{tools:['Read']});
 assert.deepEqual(mergeCapabilityFragment({allowedTools:['a'],hooks:{PreToolUse:[{hooks:[hook]}]}},{allowedTools:['a','b'],hooks:{PostToolUse:[{hooks:[hook]}]}}),{allowedTools:['a','b'],hooks:{PreToolUse:[{hooks:[hook]}],PostToolUse:[{hooks:[hook]}]}});
});
