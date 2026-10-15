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

test('dot P2a-R2: a missing workspace is refused, so an aliased existing parent cannot hide an overlap with the plugin',()=>{
 const root=join(scratch,'r2');mkdirSync(join(root,'plugin'),{recursive:true});const pluginDir=join(root,'plugin');
 // Reviewer's exact probe: the workspace's existing parent is a symlink to the plugin; the leaf does not exist yet.
 symlinkSync(pluginDir,join(root,'workspace-alias'));
 assert.throws(()=>assertSkillPluginDirectory(pluginDir,join(root,'workspace-alias','missing-conversation')),refused,'missing leaf beneath a parent aliasing into the plugin');
 // The leaf itself is a dangling symlink whose target would sit inside the plugin.
 symlinkSync(join(pluginDir,'later'),join(root,'dangling-workspace'));
 assert.throws(()=>assertSkillPluginDirectory(pluginDir,join(root,'dangling-workspace')),refused,'dangling workspace link into the plugin');
 // Reverse direction: the plugin sits beneath the directory an aliased workspace parent resolves to. An existing
 // workspace is resolved and compared; a missing one cannot be verified and is refused rather than compared lexically.
 const home=join(root,'home');mkdirSync(join(home,'conversation','skill-plugin'),{recursive:true});symlinkSync(home,join(root,'home-alias'));
 assert.throws(()=>assertSkillPluginDirectory(join(home,'conversation','skill-plugin'),join(root,'home-alias','conversation')),refused,'plugin inside an existing aliased workspace');
 const sibling=join(home,'skill-plugin');mkdirSync(sibling);
 assert.throws(()=>assertSkillPluginDirectory(sibling,join(root,'home-alias','missing-conversation')),refused,'missing workspace beneath an alias of the plugin parent');
 // Without any alias a missing workspace is refused as well, and a workspace that is a file is not a directory.
 assert.throws(()=>assertSkillPluginDirectory(plugin,join(workspaceRoot,'missing-conversation')),refused,'canonical but missing workspace');
 const fileWorkspace=join(root,'file-workspace');writeFileSync(fileWorkspace,'x');
 assert.throws(()=>assertSkillPluginDirectory(plugin,fileWorkspace),refused,'workspace is not a directory');
 // Controls: canonical disjoint directories are accepted; an existing alias into the plugin is refused.
 assert.equal(assertSkillPluginDirectory(plugin,cwd),plugin);assert.equal(assertSkillPluginDirectory(pluginDir,cwd),pluginDir);
 const existingAlias=join(root,'existing-alias');symlinkSync(pluginDir,existingAlias);
 assert.throws(()=>assertSkillPluginDirectory(pluginDir,existingAlias),refused,'existing workspace alias resolving to the plugin');
 assert.throws(()=>assertSkillPluginDirectory(`${root}/./plugin`,cwd),refused,'non-canonical plugin spelling');
});

test('dot P2a-R2: options built for a missing workspace refuse the plugin fact before any SDK option is produced',()=>{
 const missing=join(scratch,'r2-options',conversation);symlinkSync(plugin,join(scratch,'r2-options-link'));
 for(const target of [missing,join(scratch,'r2-options-link',conversation)])
  assert.throws(()=>buildConversationOptions({...runtime({skillPluginDirectory:plugin}),cwd:target},new AbortController()),refused,target);
 assert.deepEqual(buildConversationOptions(runtime({skillPluginDirectory:plugin}),new AbortController(),undefined,undefined,createSdkCapabilities({skillPlugin:true},facts(plugin)).options).plugins,[{type:'local',path:plugin,skipMcpDiscovery:true}],'the canonical trusted path still binds exactly');
});
