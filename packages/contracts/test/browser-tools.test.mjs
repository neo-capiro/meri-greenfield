import test from 'node:test';import assert from 'node:assert/strict';
import {assertBrowserOperationRequest,assertBrowserOperationResponse,browserOperationBudgetMs,browserOperationCeilingMs} from '../runtime-0.2/browser-tools.mjs';
const binding={tenantId:'synthetic',actorId:'actor',conversationId:'00000001-0000-4000-8000-000000000000',runId:'00000002-0000-4000-8000-000000000000',attemptId:'00000003-0000-4000-8000-000000000000',workerId:'00000004-0000-4000-8000-000000000000',writerFence:1};
test('browser prepare cannot carry caller policy, workflow, host destination or credentials',()=>{
 assert.deepEqual(assertBrowserOperationRequest('runner/browser-prepare',{binding}),{binding});
 for(const fields of [{policy:{}},{workflow:{}},{endpoint:'https://synthetic.invalid'},{credential:'synthetic'}])assert.throws(()=>assertBrowserOperationRequest('browser-prepare',{binding,...fields}));
});
test('browser calls retain exact delivery and binding; changed reply binding and extra result envelopes refuse',()=>{
 const call={binding,requestId:'a'.repeat(64),tool:'browser_snapshot',args:{}};assert.deepEqual(assertBrowserOperationRequest('browser-call',call),call);
 assert.throws(()=>assertBrowserOperationRequest('browser-call',{...call,requestId:'another'}));assert.throws(()=>assertBrowserOperationRequest('browser-call',{...call,args:{},provider:'bedrock'}));
 assert.deepEqual(assertBrowserOperationResponse({binding,result:{content:[]}},binding),{content:[]});
 assert.throws(()=>assertBrowserOperationResponse({binding:{...binding,writerFence:2},result:{}},binding));assert.throws(()=>assertBrowserOperationResponse({binding,result:{},hostSecret:'not allowed'},binding));
});
test('only named browser operations get selected policy bounds; approval is a separate allowance',()=>{
 const policy={timeouts:{actionMs:5000,navigationMs:60000}};assert.equal(browserOperationBudgetMs('browser-call',{policy}),65000);assert.equal(browserOperationBudgetMs('browser-tools',{policy}),65000);
 assert.equal(browserOperationBudgetMs('browser-call',{policy:{timeouts:{actionMs:60000,navigationMs:120000}}}),130000);
 assert.equal(browserOperationBudgetMs('browser-approve',{policy}),120000);assert.equal(browserOperationBudgetMs('browser-hook',{policy}),10000);assert.equal(browserOperationCeilingMs('runner/load'),null);
 assert.throws(()=>browserOperationBudgetMs('browser-call',{policy:{timeouts:{actionMs:1,navigationMs:999999}}}));assert.throws(()=>browserOperationBudgetMs('browser-approve',{approvalDeadlineMs:900001}));
});
test('SDK hook identity/event is closed and cannot be substituted between permission and receipt',()=>{
 const request={binding,event:'PreToolUse',toolUseId:'tool_1',input:{hook_event_name:'PreToolUse',session_id:binding.runId,tool_name:'mcp__meri_browser__browser_snapshot',tool_input:{},tool_use_id:'tool_1'}};
 assert.deepEqual(assertBrowserOperationRequest('browser-hook',request),request);
 assert.throws(()=>assertBrowserOperationRequest('browser-hook',{...request,toolUseId:'tool_2'}));assert.throws(()=>assertBrowserOperationRequest('browser-hook',{...request,input:{...request.input,tool_response:'forged'}}));
});
