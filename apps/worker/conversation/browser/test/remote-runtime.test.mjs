/** Real pinned SDK MCP and original host hooks. The host answers `activation:'open'`
 * here as control's browser-admitted facts would; no provider loop exists. */
import test from 'node:test';import assert from 'node:assert/strict';
import {tmpdir} from 'node:os';import {randomUUID} from 'node:crypto';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {buildOpenBrowserFragment} from '../fragment.mjs';
import {validateBrowserPolicy} from '../policy.mjs';
import {composeBrowserOptions} from '../options.mjs';
import {dispatchPreparedBrowserOperation} from '../../host/browser-operation-host.mjs';
import {binding,installation,sourceScopes,enabledPolicy,clock,recorders,hookInput,pageResponse} from './fixtures.mjs';
import {prepareRemoteBrowserRun} from '../remote-runtime.mjs';
async function fixture(t,{browserHandoff}={}){
 const r=recorders(),{launch,...contextInstallation}=installation,policy=validateBrowserPolicy(enabledPolicy());
 const cwd=tmpdir().replaceAll('\\','/')+'/meri-remote-'+randomUUID()+'/'+binding.conversationId;
 const fragment=buildOpenBrowserFragment({binding,cwd,policy,installation:contextInstallation,modelTransport:'host-owned',sourceScopes,artifacts:r.artifactPort,receipts:r.receiptPort,approvals:r.approvals('approve'),now:clock});
 let closed=0,cleanupOverride,prepares=0,starts=0;const run={fragment,async settle({outcome}){closed++;return cleanupOverride??{schema:'meri-browser-cleanup/1',binding,outcome,activation:'open',egress:'done',process:'done',profile:'done'};}};
 const descriptor={name:'browser_snapshot',description:'Upstream snapshot',inputSchema:{type:'object',properties:{}}};
 const sessions={readModelTools:async()=>({tools:[descriptor]}),callModelTool:async()=>pageResponse('https://records.example/page')};
 const dispatch=(operation,fields={})=>{const {signal,...request}=fields;return dispatchPreparedBrowserOperation({binding,run,sessions,operation,request:{binding,...request},signal});};
 const port={prepare:async()=>{prepares++;return {binding,policy,activation:'open',approvalDeadlineMs:120000};},tools:async input=>(await dispatch('browser-tools',input)).tools,
  call:({binding:ignored,...input})=>dispatch('browser-call',input),hook:input=>dispatch('browser-hook',input),approve:input=>dispatch('browser-approve',input),settle:input=>dispatch('browser-settle',input)};
 const remote=await prepareRemoteBrowserRun({port,binding,deadlineMs:clock()+60000,now:clock,starting:()=>{starts++;},...(browserHandoff?{browserHandoff}:{})});
 const options=composeBrowserOptions({tools:{type:'preset',preset:'claude_code'},permissionMode:'default',canUseTool:async()=>({behavior:'allow',updatedInput:{}})},remote.fragment);
 const client=new Client({name:'synthetic-agentcore-sdk',version:'1'}),[a,b]=InMemoryTransport.createLinkedPair();await options.mcpServers.meri_browser.instance.connect(b);await client.connect(a);
 t.after(async()=>{await client.close();await remote.settle({outcome:'ended'}).catch(()=>{});});
 const hook=async(event,tool,input,id,extra={})=>options.hooks[event][0].hooks[0](hookInput(event,tool,input,id,extra),id,{signal:new AbortController().signal});
 return {r,remote,options,client,hook,closed:()=>closed,cleanup:value=>{cleanupOverride=value;},prepares:()=>prepares,starts:()=>starts};
}
test('AgentCore SDK server invokes the host dispatcher while original approvals and receipt hooks remain authoritative',async t=>{
 const f=await fixture(t);assert.deepEqual((await f.client.listTools()).tools.map(t=>t.name),['browser_navigate'],'before first use: one tool, no host');
 assert.equal(f.prepares(),0);
 const nav={url:'https://records.example/page'};
 assert.deepEqual(await f.hook('PreToolUse','browser_navigate',nav,'nav1'),{},'the first browser use prepares the host, then the host gate decides');
 assert.equal(f.prepares(),1);assert.equal(f.starts(),1);
 assert.deepEqual((await f.client.listTools()).tools.map(t=>t.name),['browser_snapshot']);
 assert.match(JSON.stringify(await f.client.callTool({name:'browser_snapshot'})),/Page state/);
 await f.hook('PostToolUse','browser_navigate',nav,'nav1',{tool_response:pageResponse(nav.url)});
 const click={element:'Submit',ref:'e1'};assert.equal((await f.hook('PreToolUse','browser_click',click,'click1')).hookSpecificOutput.permissionDecision,'ask');
 assert.equal(f.options.allowedTools.includes('mcp__meri_browser__browser_click'),false);
 const approval=await f.options.canUseTool('mcp__meri_browser__browser_click',click,{toolUseID:'click1',mcpServer:{name:'meri_browser'}});
 assert.equal(approval.behavior,'allow');assert.deepEqual(approval.updatedInput,click);assert.equal(f.r.approvalRequests.length,1);
 assert.equal((await f.hook('PreToolUse','browser_navigate',{url:'http://169.254.169.254'},'outside')).hookSpecificOutput.permissionDecision,'deny');
 assert.equal(f.options.permissionMode,'default');assert.deepEqual(f.options.tools,{type:'preset',preset:'claude_code'});
 await f.remote.settle({outcome:'ended'});await f.remote.settle({outcome:'ended'});assert.equal(f.closed(),1);
});
test('host receipt failures stop SDK continuation without leaking private errors',async t=>{
 const f=await fixture(t);f.r.receiptPort.record=async()=>{throw Error('PRIVATE_FAILURE');};
 await f.hook('PreToolUse','browser_snapshot',{},'snapshot1');
 const result=await f.hook('PostToolUse','browser_snapshot',{},'snapshot1',{tool_response:pageResponse('https://records.example')});
 assert.equal(result.continue,false);assert.doesNotMatch(JSON.stringify(result),/PRIVATE_FAILURE/);
});
test('partial or foreign cleanup acknowledgement stays unknown instead of claiming browser absence',async t=>{
 const f=await fixture(t);await f.hook('PreToolUse','browser_snapshot',{},'used');
 f.cleanup({schema:'meri-browser-cleanup/1',binding,outcome:'ended',activation:'open',egress:'done',process:'unknown',profile:'done'});
 await assert.rejects(f.remote.settle({outcome:'ended'}),{code:'BROWSER_CLEANUP_UNKNOWN'});assert.equal(f.closed(),1);
});

test('a run that never browses provisions nothing and settles with a local not-applicable receipt',async t=>{
 const f=await fixture(t);
 assert.deepEqual(await f.remote.settle({outcome:'ended'}),{schema:'meri-browser-cleanup/1',binding,outcome:'ended',activation:'not-applicable',egress:'not-applicable',process:'not-applicable',profile:'done'});
 assert.equal(f.prepares(),0);assert.equal(f.starts(),0);assert.equal(f.closed(),0,'the host is never contacted');
 await assert.rejects(f.remote.prepareTakeover({controlId:'00000000-0000-4000-8000-000000000001'}),{code:'BROWSER_CUSTODY_UNAVAILABLE'});
});
test('a failed first preparation leaves the browser unavailable for the run: every gate denies, the turn continues, settlement asks control',async()=>{
 const policy=validateBrowserPolicy(enabledPolicy());let fail=true,prepares=0,hooks=0;const settles=[];
 const port={prepare:async()=>{prepares++;if(fail)throw Error('PROVISIONING_TIMEOUT');return {binding,policy,activation:'open',approvalDeadlineMs:120000};},
  tools:async()=>[],call:async()=>({content:[]}),hook:async()=>{hooks++;return {};},approve:async()=>({behavior:'allow'}),
  // Control's answer for a run whose preparation never got a browser host allocated (browser-operations.mjs hostReached).
  settle:async({outcome})=>{settles.push(outcome);return {schema:'meri-browser-cleanup/1',binding,outcome,activation:'not-applicable',egress:'not-applicable',process:'not-applicable',profile:'done'};}};
 const remote=await prepareRemoteBrowserRun({port,binding,deadlineMs:clock()+60000,now:clock});
 const run=(event,id,extra)=>remote.fragment.hooks[event][0].hooks[0](hookInput(event,'browser_navigate',{url:'https://records.example/'},id,extra),id,{signal:new AbortController().signal});
 assert.ok(remote.fragment.hooks.PreToolUse[0].timeout>=220,'the first PreToolUse may wait for the host to start');
 for(const id of ['a','b']){
  assert.equal((await run('PreToolUse',id)).hookSpecificOutput.permissionDecision,'deny');
  // Whether or not the CLI reports the denied use as a failure, no browser effect exists: nothing stops the turn.
  assert.deepEqual(await run('PostToolUseFailure',id,{error:'denied'}),{});
  assert.deepEqual(await run('PostToolUse',id,{tool_response:{content:[]}}),{});
 }
 fail=false;assert.equal((await remote.fragment.canUseTool('mcp__meri_browser__browser_click',{},{toolUseID:'c'})).behavior,'deny');
 assert.equal(prepares,1);assert.equal(hooks,0,'the host is never asked to record a use that never reached it');
 assert.equal((await remote.settle({outcome:'failed'})).activation,'not-applicable');assert.deepEqual(settles,['failed'],'an attempted preparation settles through control');
});
test('a takeover resume prepares its existing browser quietly: no "Starting a browser" for a browser that already runs',async()=>{
 const policy=validateBrowserPolicy(enabledPolicy()),resumeSnapshot={content:[{type:'text',text:'Page state'}]};let starts=0;
 const port={prepare:async()=>({binding,policy,activation:'open',approvalDeadlineMs:120000,resumeSnapshot}),tools:async()=>[],call:async()=>({content:[]}),
  hook:async()=>({}),approve:async()=>({behavior:'allow'}),settle:async({outcome})=>({schema:'meri-browser-cleanup/1',binding,outcome,activation:'open',egress:'done',process:'done',profile:'done'})};
 const {canonicalSha256}=await import('../../../../../packages/contracts/validate.mjs');
 const remote=await prepareRemoteBrowserRun({port,binding,deadlineMs:clock()+60000,now:clock,starting:()=>{starts++;},
  browserHandoff:{returned:{snapshotSha256:canonicalSha256(resumeSnapshot)}}});
 assert.deepEqual(remote.fragment.resumeSnapshot,resumeSnapshot);assert.equal(starts,0);
 await remote.settle({outcome:'ended'});
});
