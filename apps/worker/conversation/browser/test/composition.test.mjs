import test from 'node:test';import assert from 'node:assert/strict';
import {composeBrowserOptions,routeBrowserPermissions} from '../options.mjs';
import {createBrowserCapability} from '../index.mjs';
import {buildConversationOptions} from '../../options.mjs';
import {BROWSER_TOOLS} from '../policy.mjs';
import {binding,enabledPolicy,recorders,openFragment,installation,sourceScopes,clock,APPROVED,startFrom} from './fixtures.mjs';
const cwd=`/workspace/${binding.conversationId}`,T=t=>`mcp__meri_browser__${t}`;
const allowAll=async(name,input)=>({behavior:'allow',updatedInput:input});
const sdkServer=name=>({type:'sdk',name,instance:{close(){}}});
/** Fully built options as `../options.mjs` produces them before the browser step: the selected-skill server, general
 * reads and a concurrent-lane intents server, capability built-ins and disallowed tools, and other owners' hooks. The
 * existing chain here allows EVERYTHING, the most permissive decider possible. */
const builtOptions=(over={})=>({permissionMode:'default',tools:['Read','Glob'],
 mcpServers:{meri_original_reads:sdkServer('meri_original_reads'),meri_reads:sdkServer('meri_reads'),meri_intents:sdkServer('meri_intents')},
 allowedTools:['mcp__meri_original_reads__get_bill','mcp__meri_reads__search_bills','mcp__meri_intents__propose_task'],
 disallowedTools:['Bash','WebFetch'],
 hooks:{PreToolUse:[{matcher:'mcp__meri_reads__.*',hooks:[async()=>({})]}],PostToolUse:[{hooks:[async()=>({})]}]},
 canUseTool:allowAll,settings:{permissions:{allow:[`Read(/${cwd}/**)`]}},...over});
test('composition keeps every other server, tool, disallowed tool and hook, adds only the browser fragment, and keeps the default permission mode',()=>{
 const {cap}=openFragment({cwd,policy:enabledPolicy({tools:BROWSER_TOOLS})}),base=builtOptions(),o=composeBrowserOptions(base,cap);
 assert.deepEqual(Object.keys(o.mcpServers),['meri_original_reads','meri_reads','meri_intents','meri_browser']);
 assert.equal(o.mcpServers.meri_browser,cap.mcpServers.meri_browser);
 assert.deepEqual(o.allowedTools,[...base.allowedTools,...cap.allowedTools]);
 assert.deepEqual(o.disallowedTools,['Bash','WebFetch',...cap.disallowedTools],'union: nothing another owner disallowed is re-enabled');
 assert.deepEqual(o.hooks.PreToolUse,[...base.hooks.PreToolUse,...cap.hooks.PreToolUse]);assert.deepEqual(o.hooks.PostToolUse,[...base.hooks.PostToolUse,...cap.hooks.PostToolUse]);
 assert.deepEqual(o.hooks.PostToolUseFailure,cap.hooks.PostToolUseFailure);
 assert.equal(o.permissionMode,'default');assert.deepEqual(o.tools,base.tools);assert.deepEqual(o.settings,base.settings);
 for(const t of ['browser_click','browser_type','browser_fill_form'])assert.ok(!o.allowedTools.includes(T(t)),t);
});
test('a more permissive decider cannot short-circuit a browser decision, and the browser gate never decides other servers\' tools',async()=>{
 const r=recorders(),{cap}=openFragment({cwd,policy:enabledPolicy({tools:BROWSER_TOOLS}),r,approvals:r.approvals('deny')});
 const o=composeBrowserOptions(builtOptions(),cap);
 await startFrom(cap,`${APPROVED[0]}/form`,'browser_click',{element:'Buy',target:'e1'},'toolu_80');
 assert.equal((await o.canUseTool(T('browser_click'),{element:'Buy',target:'e1'},{toolUseID:'toolu_80',signal:new AbortController().signal})).message,'BROWSER_APPROVAL_DENIED','denied by the canonical owner despite an allow-everything chain');
 assert.equal((await o.canUseTool(T('browser_navigate'),{url:'https://unlisted.example/'},{toolUseID:'toolu_81'})).message,'BROWSER_ORIGIN_NOT_ALLOWED');
 assert.equal((await o.canUseTool(T('browser_evaluate'),{},{toolUseID:'toolu_82'})).message,'BROWSER_TOOL_NOT_ADMITTED');
 assert.equal(r.approvalRequests.length,1);
 for(const name of ['mcp__meri_reads__search_bills','mcp__meri_intents__propose_task','Read'])assert.equal((await o.canUseTool(name,{},{toolUseID:'toolu_83'})).behavior,'allow',`${name} stays with its own chain`);
 const routed=routeBrowserPermissions(async()=>undefined,allowAll);
 assert.deepEqual(await routed(T('browser_click'),{},{}),{behavior:'deny',message:'Tool unavailable'},'a browser gate that does not answer still denies');
});
test('composition refuses foreign ownership of browser names, another permission mode and a malformed fragment',()=>{
 const {cap}=openFragment({cwd});
 const refuse=(options,fragment=cap)=>assert.throws(()=>composeBrowserOptions(options,fragment),e=>e.code==='BROWSER_COMPOSITION_REFUSED');
 refuse(builtOptions({mcpServers:{meri_browser:sdkServer('meri_browser')}}));
 refuse(builtOptions({allowedTools:[T('browser_click')]}));refuse(builtOptions({allowedTools:['mcp__meri_browser']}));
 refuse(builtOptions({tools:[T('browser_type')]}));refuse(builtOptions({settings:{permissions:{allow:['mcp__meri_browser__browser_click']}}}));
 for(const permissionMode of ['acceptEdits','bypassPermissions','plan','dontAsk',undefined])refuse(builtOptions({permissionMode}));
 refuse(builtOptions({canUseTool:undefined}));
 refuse(builtOptions(),{...cap,allowedTools:[...cap.allowedTools,'mcp__meri_reads__search_bills']});
 refuse(builtOptions(),{...cap,mcpServers:{...cap.mcpServers,extra:{type:'stdio'}}});
 refuse(builtOptions(),{...cap,hooks:{...cap.hooks,PreToolUse:[{matcher:'.*',hooks:cap.hooks.PreToolUse[0].hooks}]}});
 refuse(builtOptions(),{...cap,hooks:{PostToolUse:cap.hooks.PostToolUse}});
 refuse(builtOptions(),{enabled:false,mcpServers:{meri_browser:{}},allowedTools:[],hooks:{}});
});
test('the shipped (held) capability composes to unchanged conversation options through options.mjs',()=>{
 const runtime={binding,versions:{sdk:'0.3.295',cli:'2.1.295'},cwd,proxyUrl:'https://trusted-proxy.invalid',proxyCredential:'synthetic-task-capability',model:'qualified-model-pin',sessionStore:{async load(){return null;},async append(){}},deadlineMs:clock()+1000,maxTurns:2,maxCostMicroUSD:1000,maxOutputBytes:1024};
 const held=createBrowserCapability({binding,cwd,policy:enabledPolicy(),installation,sourceScopes,artifacts:{ingest(){}},receipts:{record(){}},now:clock});
 assert.equal(held.activation,'held');
 const without=buildConversationOptions(runtime,new AbortController()),withHeld=buildConversationOptions(runtime,new AbortController(),undefined,undefined,undefined,undefined,held);
 for(const key of ['mcpServers','allowedTools','disallowedTools','hooks','permissionMode','tools'])assert.deepEqual(withHeld[key],without[key],key);
 assert.equal(withHeld.mcpServers,undefined,'no browser server while held');
 const disabled=createBrowserCapability({binding,cwd,policy:{enabled:false},now:clock});
 assert.deepEqual(Object.keys(buildConversationOptions(runtime,new AbortController(),undefined,undefined,undefined,undefined,disabled)).sort(),Object.keys(without).sort());
 // Through options.mjs, the open fragment is composed last and keeps the default deny for every other tool.
 const open=openFragment({cwd}).cap,o=buildConversationOptions(runtime,new AbortController(),undefined,undefined,undefined,undefined,open);
 assert.deepEqual(Object.keys(o.mcpServers),['meri_browser']);assert.equal(o.permissionMode,'default');
 return o.canUseTool('Read',{file_path:'/etc/passwd'},{toolUseID:'toolu_90'}).then(d=>assert.equal(d.behavior,'deny'));
});
