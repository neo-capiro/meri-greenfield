import test from 'node:test';
import assert from 'node:assert/strict';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {createBrowserOperationHost,dispatchPreparedBrowserOperation} from '../browser-operation-host.mjs';
import {buildOpenBrowserFragment} from '../../browser/fragment.mjs';
import {validateBrowserPolicy} from '../../browser/policy.mjs';
import {binding,installation,sourceScopes,enabledPolicy,clock,recorders,pageResponse} from '../../browser/test/fixtures.mjs';

const {launch,...contextInstallation}=installation;
const cwd=tmpdir().replaceAll('\\','/')+'/meri-browser-operations-'+randomUUID()+'/'+binding.conversationId;
const hook=(event,tool,id,input,extra={})=>({binding,event,toolUseId:id,input:{hook_event_name:event,session_id:'00000000-0000-4000-8000-000000000099',tool_name:'mcp__meri_browser__'+tool,tool_input:input,tool_use_id:id,...extra}});
function prepared(){
 const r=recorders(),fragment=buildOpenBrowserFragment({binding,cwd,policy:validateBrowserPolicy(enabledPolicy()),installation:contextInstallation,modelTransport:'host-owned',sourceScopes,artifacts:r.artifactPort,receipts:r.receiptPort,approvals:r.approvals('approve'),now:clock});
 const run={fragment},dispatch=(operation,request)=>dispatchPreparedBrowserOperation({binding,run,sessions:{},operation,request});
 return {r,fragment,dispatch};
}

test('remote hooks preserve original page tracking, canonical per-effect approval and receipt filtering',async()=>{
 const f=prepared(),navigate={url:'https://records.example/page'};
 assert.deepEqual(await f.dispatch('browser-hook',hook('PreToolUse','browser_navigate','nav1',navigate)),{});
 await f.dispatch('browser-hook',hook('PostToolUse','browser_navigate','nav1',navigate,{tool_response:pageResponse('https://records.example/page?secret=hidden')}));
 const click={element:'Submit',ref:'e1'};
 const gate=await f.dispatch('browser-hook',hook('PreToolUse','browser_click','click1',click));
 assert.equal(gate.hookSpecificOutput.permissionDecision,'ask');
 const approved=await f.dispatch('browser-approve',{binding,tool:'browser_click',toolUseId:'click1',input:click});
 assert.equal(approved.behavior,'allow');assert.deepEqual(approved.updatedInput,click);
 assert.equal(f.r.approvalRequests.length,1);assert.equal(f.r.approvalRequests[0].subject.pageOrigin,'https://records.example');
 assert.doesNotMatch(JSON.stringify(f.r.receipts),/secret|hidden/);
 const duplicate=await f.dispatch('browser-hook',hook('PreToolUse','browser_click','click1',click));
 assert.equal(duplicate.hookSpecificOutput.permissionDecision,'deny');
});

test('unknown page, nonadmitted navigation and private extra hook fields cannot bypass original gates',async()=>{
 const f=prepared(),click={element:'Submit',ref:'e1'};
 await f.dispatch('browser-hook',hook('PreToolUse','browser_click','unknown',click));
 assert.equal((await f.dispatch('browser-approve',{binding,tool:'browser_click',toolUseId:'unknown',input:click})).behavior,'deny');
 assert.equal(f.r.approvalRequests.length,0);
 const outside=await f.dispatch('browser-hook',hook('PreToolUse','browser_navigate','outside',{url:'http://169.254.169.254'}));
 assert.equal(outside.hookSpecificOutput.permissionDecision,'deny');
 await assert.rejects(f.dispatch('browser-hook',hook('PreToolUse','browser_snapshot','private',{}, {transcript_path:'/private/transcript'})));
 await assert.rejects(f.dispatch('browser-hook',{...hook('PreToolUse','browser_snapshot','foreign',{}),binding:{...binding,writerFence:2}}));
});

test('receipt failure survives hook aggregation and cannot become successful continuation',async()=>{
 const f=prepared();f.r.receiptPort.record=async()=>{throw Error('PRIVATE STORAGE ERROR');};
 await f.dispatch('browser-hook',hook('PreToolUse','browser_snapshot','snap1',{}));
 const result=await f.dispatch('browser-hook',hook('PostToolUse','browser_snapshot','snap1',{}, {tool_response:pageResponse('https://records.example/page')}));
 assert.equal(result.continue,false);assert.doesNotMatch(JSON.stringify(result),/PRIVATE STORAGE/);
});

function hostFixture(){
 let now=Date.now();const state={reads:0,policies:0,opens:0,policy:enabledPolicy(),deadlineMs:now+60000};
 const port={modelTransport:'host-owned',installation:contextInstallation,sourceScopes,
  policy:async()=>{state.policies++;return state.policy;},sessions:{open:async()=>{state.opens++;throw Error('activation bypass');}}};
 const sessions={readModelTools:async()=>{throw Error('not prepared');},callModelTool:async()=>{throw Error('not prepared');}};
 const readRun=async()=>{state.reads++;if(state.refused)throw Error('PRIVATE CANONICAL ERROR');return {binding,cwd,deadlineMs:state.deadlineMs,port};};
 const host=createBrowserOperationHost({binding,readRun,sessions,now:()=>now});
 return {host,state,expire:()=>{now=state.deadlineMs+1;},call:(name,fields={})=>host.executeBrowserOperation(name,{binding,...fields})};
}

test('production preparation keeps the source gate held, replays no launch and returns no private path',async()=>{
 const f=hostFixture(),first=await f.call('runner/browser-prepare');
 assert.equal(first.result.activation,'held');assert.equal(f.state.opens,0);
 assert.doesNotMatch(JSON.stringify(first),/cliPath|browsersPath|workspace|shimPath|nonce/);
 assert.deepEqual(await f.call('browser-prepare'),first);assert.equal(f.state.reads,2);assert.equal(f.state.policies,2);
 await assert.rejects(f.call('browser-tools'),/BROWSER_OPERATION_REFUSED/);
 const result=await f.call('browser-settle',{outcome:'ended'});assert.equal(result.result.profile,'done');
 await assert.rejects(f.call('browser-prepare'),/BROWSER_OPERATION_REFUSED/);
});

test('immutable binding and closed requests refuse before consulting canonical facts',async()=>{
 const f=hostFixture();
 for(const request of [{binding:{...binding,writerFence:2}},{binding,deadlineMs:Date.now()+60000},{binding,siteWorkflow:{siteId:'caller-selected'}}])
  await assert.rejects(f.host.executeBrowserOperation('browser-prepare',request),/BROWSER_OPERATION_REFUSED/);
 assert.equal(f.state.reads,0);assert.equal(f.state.opens,0);
});

test('fresh policy change and unavailable canonical authority refuse after preparation',async()=>{
 const f=hostFixture();await f.call('browser-prepare');f.state.policy={enabled:false};
 await assert.rejects(f.call('browser-prepare'),/BROWSER_OPERATION_REFUSED/);
 f.state.refused=true;await assert.rejects(f.call('browser-settle',{outcome:'failed'}),/BROWSER_CLEANUP_UNKNOWN/);
 assert.equal(f.state.opens,0);
});

test('expired run refuses work but authenticated exact-owner cleanup uses its independent budget',async()=>{
 const f=hostFixture();await f.call('browser-prepare');f.expire();
 await assert.rejects(f.call('browser-prepare'),/BROWSER_OPERATION_REFUSED/);
 assert.equal((await f.call('browser-settle',{outcome:'cancelled'})).result.profile,'done');
});

test('cancelled canonical read cannot return late preparation metadata or launch a context',async()=>{
 let entered,release,observed,opens=0;const started=new Promise(resolve=>{entered=resolve;});
 const port={modelTransport:'host-owned',policy:async()=>enabledPolicy(),sessions:{open:async()=>{opens++;}}};
 const host=createBrowserOperationHost({binding,sessions:{readModelTools:async()=>{},callModelTool:async()=>{}},
  readRun:({signal})=>{observed=signal;entered();return new Promise(resolve=>{release=()=>resolve({binding,cwd,deadlineMs:Date.now()+60000,port});});}});
 const controller=new AbortController();
 const pending=assert.rejects(host.executeBrowserOperation('browser-prepare',{binding},{signal:controller.signal,deadlineMs:Date.now()+2000}),/BROWSER_OPERATION_REFUSED/);
 await started;controller.abort();await pending;assert.equal(observed.aborted,true);release();
 await new Promise(resolve=>setImmediate(resolve));assert.equal(opens,0);
});
