import test from 'node:test';import assert from 'node:assert/strict';
import {validateBrowserContextInstallation,validateBrowserInstallation} from '../server.mjs';
import {buildOpenBrowserFragment} from '../fragment.mjs';
import {validateBrowserPolicy} from '../policy.mjs';
import {binding,installation,sourceScopes,enabledPolicy,recorders,clock} from './fixtures.mjs';
test('browser context facts exclude SDK launch descriptors while the existing stdio validator retains them',()=>{
 const {launch,...context}=installation;assert.deepEqual(validateBrowserContextInstallation(context),context);assert.deepEqual(validateBrowserInstallation(installation,binding),installation);
 assert.throws(()=>validateBrowserContextInstallation(installation));assert.throws(()=>validateBrowserInstallation(context,binding));
 assert.throws(()=>validateBrowserContextInstallation({...context,egressProxy:'http://remote.example:3128'}));assert.throws(()=>validateBrowserContextInstallation({...context,providerCredential:'not permitted'}));
});
test('host-owned fragment retains the real permission/receipt/download owners without an SDK shim',async()=>{
 const {launch,...context}=installation,r=recorders(),fragment=buildOpenBrowserFragment({binding,cwd:'/workspace/'+binding.conversationId,policy:validateBrowserPolicy(enabledPolicy()),installation:context,sourceScopes,artifacts:r.artifactPort,receipts:r.receiptPort,approvals:r.approvals('deny'),now:clock,modelTransport:'host-owned'});
 assert.deepEqual(fragment.mcpServers,{});assert.equal(typeof fragment.downloads.accept,'function');assert.equal(typeof fragment.dispose,'function');
 assert.ok(!fragment.allowedTools.includes('mcp__meri_browser__browser_click'));assert.equal(typeof fragment.hooks.PostToolUse[0].hooks[0],'function');
 const result=await fragment.hooks.PreToolUse[0].hooks[0]({hook_event_name:'PreToolUse',tool_name:'mcp__meri_browser__browser_navigate',tool_use_id:'tool_1',tool_input:{url:'https://not-approved.example'}},'tool_1',{signal:new AbortController().signal});assert.equal(result.hookSpecificOutput.permissionDecision,'deny');
});
