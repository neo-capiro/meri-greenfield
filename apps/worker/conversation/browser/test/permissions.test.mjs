import test from 'node:test';import assert from 'node:assert/strict';
import {DEFAULT_BROWSER_POLICY,INTERACTION_TOOLS} from '../policy.mjs';
import {binding,enabledPolicy,recorders,openFragment,APPROVED} from './fixtures.mjs';
const cwd=`/workspace/${binding.conversationId}`,T=t=>`mcp__meri_browser__${t}`;
const pre=(tool,input={},id='toolu_01')=>({hook_event_name:'PreToolUse',session_id:'00000000-0000-4000-8000-0000000000aa',transcript_path:'/x',cwd:'/x',tool_name:T(tool),tool_input:input,tool_use_id:id});
const decisionOf=out=>out?.hookSpecificOutput?.permissionDecision??'none';
/** Scripted model of the SDK's documented permission order (sdk.d.ts 0.3.295): disallowed tools are unavailable;
 * PreToolUse hooks run first and a `deny` ends the call; an `ask`, or a tool that no `allowedTools` entry pre-approves,
 * goes to `canUseTool`, whose `deny` ends the call; only then does the tool execute. It is evidence about this
 * fragment's decisions under that order, not live SDK delivery. */
function scriptedSdk(cap,{extraAllowed=[]}={}){
 const executed=[];
 async function call(tool,input,id='toolu_01'){
  const name=T(tool);
  if(cap.disallowedTools.includes(name))return 'unavailable';
  let askRequired=false;
  for(const m of cap.hooks.PreToolUse)for(const hook of m.hooks){const d=decisionOf(await hook(pre(tool,input,id),id,{signal:new AbortController().signal}));if(d==='deny')return 'denied-by-hook';if(d==='ask')askRequired=true;}
  if(askRequired||![...cap.allowedTools,...extraAllowed].includes(name)){const r=await cap.canUseTool(name,input,{signal:new AbortController().signal,toolUseID:id,requestId:'req-1'});if(r?.behavior!=='allow')return 'denied-by-permission';}
  executed.push({tool,input});return 'executed';
 }
 return {call,executed};
}
test('a denied interaction never executes; an approved one executes once, after the approval request',async()=>{
 const denying=recorders(),{cap:denyCap}=openFragment({cwd,policy:DEFAULT_BROWSER_POLICY,r:denying,approvals:denying.approvals('deny')}),sdk=scriptedSdk(denyCap,{extraAllowed:INTERACTION_TOOLS.map(T)});
 for(const tool of INTERACTION_TOOLS)assert.equal(await sdk.call(tool,{element:'Submit',target:'e1',text:'x'}),'denied-by-permission',tool);
 assert.deepEqual(sdk.executed,[],'no interaction ran even though another rule pre-approved it: the PreToolUse ask forced the decision');
 assert.equal(denying.approvalRequests.length,INTERACTION_TOOLS.length);
 const noPort=scriptedSdk(openFragment({cwd,policy:DEFAULT_BROWSER_POLICY}).cap);
 assert.equal(await noPort.call('browser_click',{element:'Buy',target:'e2'}),'denied-by-permission');assert.deepEqual(noPort.executed,[]);
 const approving=recorders(),ok=scriptedSdk(openFragment({cwd,policy:DEFAULT_BROWSER_POLICY,r:approving,approvals:approving.approvals('approve')}).cap);
 assert.equal(await ok.call('browser_click',{element:'Next page',target:'e3'},'toolu_09'),'executed');assert.equal(ok.executed.length,1);
 assert.deepEqual(approving.approvalRequests,[{schema:'meri-browser-approval-request/1',binding,toolUseId:'toolu_09',action:'browser_click',input:{element:'Next page',target:'e3'}}]);
});
test('navigations outside the allowlist or the platform limits are denied before execution; the default allowlist opens nothing external',async()=>{
 const sdk=scriptedSdk(openFragment({cwd,policy:enabledPolicy({tools:['browser_navigate','browser_tabs','browser_snapshot']})}).cap);
 for(const url of ['http://169.254.169.254/latest/meta-data/','http://localhost:8080/','http://[::1]/','http://10.0.0.1/','file:///etc/passwd','javascript:alert(1)','data:text/html,x','https://u:p@records.example/','https://archive.example/','https://unlisted.example/'])
  assert.equal(await sdk.call('browser_navigate',{url}),'denied-by-hook',url);
 assert.equal(await sdk.call('browser_tabs',{action:'new',url:'http://127.0.0.1/'}),'denied-by-hook');
 assert.equal(await sdk.call('browser_navigate',{url:`${APPROVED[0]}/notice/1`}),'executed');assert.equal(await sdk.call('browser_tabs',{action:'new'}),'executed');assert.equal(await sdk.call('browser_navigate',{url:'about:blank'}),'executed');
 assert.equal(sdk.executed.length,3);
 const empty=scriptedSdk(openFragment({cwd,policy:DEFAULT_BROWSER_POLICY}).cap);
 assert.equal(await empty.call('browser_navigate',{url:`${APPROVED[0]}/`}),'denied-by-hook');assert.equal(await empty.call('browser_snapshot',{}),'executed');
});
test('unadmitted and excluded tools are unavailable or denied before execution',async()=>{
 const {cap}=openFragment({cwd}),sdk=scriptedSdk(cap);
 for(const tool of ['browser_evaluate','browser_run_code_unsafe','browser_file_upload','browser_type'])assert.equal(await sdk.call(tool,{}),'unavailable',tool);
 const hook=cap.hooks.PreToolUse[0].hooks[0];
 assert.equal(decisionOf(await hook(pre('browser_evaluate'),'toolu_01',{})),'deny');assert.equal(decisionOf(await hook(pre('browser_set_storage_state'),'toolu_01',{})),'deny');
 assert.equal((await cap.canUseTool(T('browser_evaluate'),{},{toolUseID:'toolu_01'})).behavior,'deny');
 assert.deepEqual(sdk.executed,[]);
});
test('the PreToolUse gate fails closed on malformed input and the canUseTool gate only answers for this server',async()=>{
 const r=recorders(),{cap}=openFragment({cwd,policy:DEFAULT_BROWSER_POLICY,r,approvals:r.approvals('approve')}),hook=cap.hooks.PreToolUse[0].hooks[0];
 const aborted=new AbortController();aborted.abort();
 for(const [input,id,opts] of [[{...pre('browser_snapshot'),hook_event_name:'PostToolUse'},'toolu_01',{}],[pre('browser_snapshot'),'toolu_other',{}],[{...pre('browser_snapshot'),tool_name:'mcp__other__browser_snapshot'},'toolu_01',{}],[pre('browser_snapshot'),'toolu_01',{signal:aborted.signal}],[null,'toolu_01',{}],[pre('browser_navigate',{url:42}),'toolu_01',{}]])
  assert.equal(decisionOf(await hook(input,id,opts)),'deny');
 assert.equal(decisionOf(await hook(pre('browser_click',{element:'x',target:'e1'}),'toolu_01',{})),'ask');assert.deepEqual(await hook(pre('browser_snapshot'),'toolu_01',{}),{});
 assert.equal(await cap.canUseTool('Read',{file_path:'/x'},{toolUseID:'toolu_01'}),undefined,'not this server: defers to the chain (default deny)');
 const ask=(over={})=>cap.canUseTool(T('browser_click'),{element:'x',target:'e1'},{toolUseID:'toolu_05',signal:new AbortController().signal,...over});
 assert.equal((await ask()).behavior,'allow');assert.equal((await ask({mcpServer:{name:'other',source:'user'}})).message,'BROWSER_SERVER_MISMATCH');
 assert.equal((await ask({toolUseID:undefined})).message,'BROWSER_APPROVAL_UNAVAILABLE');assert.equal((await ask({signal:aborted.signal})).message,'BROWSER_APPROVAL_UNAVAILABLE');
 const mismatched=openFragment({cwd,policy:DEFAULT_BROWSER_POLICY,approvals:{async decide(){return {decision:'approve',toolUseId:'toolu_other'};}}}).cap;
 assert.equal((await mismatched.canUseTool(T('browser_click'),{},{toolUseID:'toolu_05'})).message,'BROWSER_APPROVAL_DENIED');
 const throwing=openFragment({cwd,policy:DEFAULT_BROWSER_POLICY,approvals:{async decide(){throw new Error('ui down');}}}).cap;
 assert.equal((await throwing.canUseTool(T('browser_click'),{},{toolUseID:'toolu_05'})).message,'BROWSER_APPROVAL_UNAVAILABLE');
 assert.equal((await cap.canUseTool(T('browser_type'),{text:'x'.repeat(20000)},{toolUseID:'toolu_06'})).message,'BROWSER_APPROVAL_INPUT_LIMIT');
 assert.equal((await openFragment({cwd,policy:enabledPolicy({tools:['browser_navigate']})}).cap.canUseTool(T('browser_navigate'),{url:'https://unlisted.example/'},{toolUseID:'toolu_07'})).message,'BROWSER_ORIGIN_NOT_ALLOWED');
});
