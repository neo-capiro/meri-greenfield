/** The skill plugin loads only from the canonical trusted prepared directory: aliases, symlinks into the writable
 * workspace and an injected fragment naming any other path are refused. Real temporary directories; no SDK process. */
import test from 'node:test';import assert from 'node:assert/strict';
import {mkdirSync,symlinkSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {assertSkillPluginDirectory,createSkillPlugin} from '../capabilities/skill-plugin.mjs';
import {assertCapabilityPolicy} from '../capabilities/policy.mjs';
import {createSdkCapabilities} from '../capabilities/index.mjs';
import {buildConversationOptions} from '../options.mjs';
import {materializeSkillPlugin} from '../../../../packages/skills/plugin.mjs';
import {binding,versions,id} from '../../../control/conversations/test/application-fixture.mjs';
import {plugin,scratch} from './capability-fixture.mjs';
const conversation=binding.conversationId,workspaceRoot=join(scratch,'workspaces'),cwd=join(workspaceRoot,conversation);
mkdirSync(cwd,{recursive:true});
const refused=/SKILL_PLUGIN_DIRECTORY_REFUSED/;
const runtime=(extra={})=>({binding,versions,cwd,proxyUrl:'https://trusted-proxy.invalid',proxyCredential:'synthetic-task-capability',model:'qualified-model-pin',sessionStore:{async load(){return null;},async append(){}},deadlineMs:Date.now()+1000,maxTurns:2,maxCostMicroUSD:1000,maxOutputBytes:1024,...extra});
const facts=(skillPluginDirectory,extra={})=>({runOwner:{append:async()=>{}},binding,cwd,now:Date.now,newId:()=>id(1),skillPluginDirectory,...extra});

test('the canonical prepared plugin directory is accepted and returned unchanged',()=>{
 assert.equal(assertSkillPluginDirectory(plugin,cwd),plugin);
 assert.deepEqual(createSkillPlugin(assertCapabilityPolicy({skillPlugin:true}),{skillPluginDirectory:plugin,cwd}).plugins,[{type:'local',path:plugin,skipMcpDiscovery:true}]);
});

test('aliases are refused: a symlink to the plugin, a symlinked parent, a missing path and a file',()=>{
 const alias=join(scratch,'plugin-alias');symlinkSync(plugin,alias);
 const parent=join(scratch,'parent-alias');symlinkSync(scratch,parent);
 const file=join(scratch,'not-a-directory');writeFileSync(file,'x');
 for(const path of [alias,join(parent,'skill-plugin'),join(scratch,'missing-plugin'),file])assert.throws(()=>assertSkillPluginDirectory(path,cwd),refused,path);
 assert.throws(()=>createSdkCapabilities({skillPlugin:true},facts(alias)),refused);
});

test('symlinks into the writable conversation workspace are refused wherever they appear',async()=>{
 const intoWorkspace=join(scratch,'into-workspace');symlinkSync(cwd,intoWorkspace);
 assert.throws(()=>assertSkillPluginDirectory(intoWorkspace,cwd),refused,'a symlink whose target is the workspace');
 const insideReal=join(cwd,'plugin');mkdirSync(insideReal);const workspaceAlias=join(scratch,'workspace-alias');symlinkSync(workspaceRoot,workspaceAlias);
 assert.throws(()=>assertSkillPluginDirectory(insideReal,join(workspaceAlias,conversation)),refused,'the workspace is compared after resolving its own aliases');
 const tainted=join(scratch,'tainted-plugin');await materializeSkillPlugin({directory:tainted});symlinkSync(join(cwd,'evil.md'),join(tainted,'skills','meri-meeting-prep','extra.md'));
 assert.throws(()=>assertSkillPluginDirectory(tainted,cwd),refused,'a symlink inside the plugin tree');
 const parentOfWorkspace=workspaceRoot;assert.throws(()=>assertSkillPluginDirectory(parentOfWorkspace,cwd),refused,'a parent of the workspace');
});

test('an options fragment whose plugin path differs from the trusted prepared path is refused',async()=>{
 const other=join(scratch,'other-plugin');await materializeSkillPlugin({directory:other});
 const trusted=createSdkCapabilities({skillPlugin:true},facts(plugin)).options,foreign=createSdkCapabilities({skillPlugin:true},facts(other)).options;
 assert.deepEqual(buildConversationOptions(runtime({skillPluginDirectory:plugin}),new AbortController(),undefined,undefined,trusted).plugins,[{type:'local',path:plugin,skipMcpDiscovery:true}]);
 assert.throws(()=>buildConversationOptions(runtime({skillPluginDirectory:plugin}),new AbortController(),undefined,undefined,foreign),/CAPABILITY_FRAGMENT_REFUSED/,'mismatch with the prepared path');
 assert.throws(()=>buildConversationOptions(runtime(),new AbortController(),undefined,undefined,trusted),/CAPABILITY_FRAGMENT_REFUSED/,'no prepared path at all');
 assert.throws(()=>buildConversationOptions(runtime({skillPluginDirectory:join(scratch,'plugin-alias')}),new AbortController()),refused,'an aliased runtime fact');
});
