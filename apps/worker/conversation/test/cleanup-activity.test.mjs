/** SYNTHETIC full activity: scripted SDK iterator and resource ports. No SDK query, browser process, network or database. */
import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
import {binding,versions,scopes,id} from '../../../control/conversations/test/store-fixture.mjs';
import {selectSkill} from '../../../../packages/skills/index.mjs';
let active;
const close=name=>()=>{active.calls.push(name);if(active.bad===name&&(name!=='finish'||active.calls.filter(n=>n==='finish').length>1)){if(active.mode==='hang')return new Promise(()=>{});throw Error('synthetic close refusal');}};
mock.module('../reads/runtime.mjs',{namedExports:{createGeneralReadRuntime:async()=>({close:close('read')}),continuationSessionId:()=>id(999)}});
mock.module('../intents/runtime.mjs',{namedExports:{createIntentRuntime:async()=>({close:close('intent')})}});
mock.module('../browser/runtime.mjs',{namedExports:{prepareBrowserRun:async({signal})=>{active.calls.push('browser-prepare');
 if(active.bad==='browser-prepare')throw Object.assign(Error('BROWSER_CLEANUP_UNKNOWN'),{code:'BROWSER_CLEANUP_UNKNOWN'});
 if(active.bad==='browser-known-failure')throw Object.assign(Error('BROWSER_POLICY'),{code:'BROWSER_POLICY'});
 if(active.bad==='browser-abort-cleanup')return new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Object.assign(Error('BROWSER_CLEANUP_UNKNOWN'),{code:'BROWSER_CLEANUP_UNKNOWN'})),{once:true}));
 if(active.bad==='browser-pending'||active.bad==='browser-late-failure')return new Promise((resolve,reject)=>{active.releaseBrowserPreparation=()=>active.bad==='browser-late-failure'
  ?reject(Object.assign(Error('BROWSER_CLEANUP_UNKNOWN'),{code:'BROWSER_CLEANUP_UNKNOWN'})):resolve({fragment:{enabled:false},settle:close('browser')});});
 return {fragment:{enabled:false},settle:close('browser')};}}});
// Capability path qualification is outside this cleanup test (the product workspace is Linux); keep the actual activity and options.
mock.module('../capabilities/index.mjs',{namedExports:{createSdkCapabilities:()=>({options:{},check(){}})}});
mock.module('../continuation/activity-lifecycle.mjs',{namedExports:{HOLD_CHECKPOINT_FAILED:'HOLD_CHECKPOINT_FAILED',assertLifecycleConfiguration(){},
 createActivityLifecycle:()=>({observe(){},isHeld:()=>false,canCaptureCompletion:()=>false,check(){},failure:new Promise(()=>{}),finish:close('finish'),close:close('controls')})}});
const {createConversationActivity}=await import('../activity.mjs');
const selected=selectSkill('quick_skill.client_changes','1.0.0');
function execute({bad,mode,failed=false,signal,deadlineOffsetMs=5000}){
 active={calls:[],bad,mode};let n=600;
 const run={binding,versions,scopes,state:'queued',policyRevision:scopes[0].policyRevision,createdAt:new Date().toISOString()};
 const request={requestId:id(500),prompt:'Synthetic prompt',skill:selected.pin,window:null};
 const activity=createConversationActivity({cleanupAttemptMs:15,terminalAttemptMs:15,lifecycle:{},
  runOwner:{async load(){return {run,request,capabilities:{generalReads:true,governedIntents:true}};},async append(){}},
  prepareRuntime:async()=>({binding,versions,cwd:`/workspace/${binding.conversationId}`,proxyUrl:'https://synthetic.invalid',proxyCredential:'synthetic',model:'qualified-model-pin',
   sessionStore:{load(){},append(){}},deadlineMs:Date.now()+deadlineOffsetMs,maxTurns:2,maxCostMicroUSD:1000,maxOutputBytes:1024}),
  selectedSkills:{async prepare(){return {selected,async finish(){return {};},close:close('skill')};},async publish(){}},
  generalReads:{readAvailability(){},execute(){}},governedIntents:{readAvailability(){},prepare(){}},browser:{policy(){}},newId:()=>id(n++),
  query:()=>({async *[Symbol.asyncIterator](){yield {type:'result',subtype:failed?'error_during_execution':'success',is_error:failed};},close:close('query')})});
 const state=active;return {pending:activity({binding,signal}),calls:state.calls,release:()=>state.releaseBrowserPreparation?.()};
}
for(const mode of ['throw','hang'])for(const bad of ['skill','read','intent','finish','controls'])test(`${bad} ${mode} cannot skip query close or browser settlement`,{timeout:1000},async()=>{
 const t=execute({bad,mode});await assert.rejects(t.pending,/SDK_CLEANUP_UNKNOWN/);
 for(const owner of ['skill','read','intent','finish','controls','query','browser'])assert.ok(t.calls.includes(owner),`attempt ${owner}`);
 assert.equal(t.calls.filter(n=>n==='query').length,1);
 assert.ok(t.calls.indexOf('query')<t.calls.indexOf('browser'));
});
for(const failed of [false,true])test(`never-settling query close cannot block browser settlement on ${failed?'failure':'completion'}`,{timeout:1000},async()=>{
 const t=execute({bad:'query',mode:'hang',failed});await assert.rejects(t.pending,/SDK_CLEANUP_UNKNOWN/);
 assert.equal(t.calls.filter(n=>n==='query').length,1,'idempotent query close attempted once');assert.ok(t.calls.includes('browser'));
});
test('unknown cleanup during browser preparation reaches the activity caller without a returned browser handle',async()=>{
 const t=execute({bad:'browser-prepare',mode:'throw'});
 await assert.rejects(t.pending,/SDK_CLEANUP_UNKNOWN/);
 assert.ok(t.calls.includes('browser-prepare'));
 assert.ok(!t.calls.includes('browser'),'the preparation owner already attempted cleanup; no run handle was returned');
});
test('a known browser preparation refusal remains an ordinary failed run',async()=>{
 const t=execute({bad:'browser-known-failure',mode:'throw'});
 await assert.rejects(t.pending,/EXECUTION_FAILED/);
 assert.ok(!t.calls.includes('browser'));
});
for(const bad of ['browser-pending','browser-late-failure'])test(`${bad}: cancellation reports unknown cleanup even when preparation settles later`,async()=>{
 const controller=new AbortController(),t=execute({bad,mode:'throw',signal:controller.signal});
 for(let i=0;i<20&&!t.calls.includes('browser-prepare');i++)await new Promise(resolve=>setImmediate(resolve));
 assert.ok(t.calls.includes('browser-prepare'));
 controller.abort();await assert.rejects(t.pending,/SDK_CLEANUP_UNKNOWN/);
 t.release();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(t.calls.includes('browser'),bad==='browser-pending','a late handle is settled after the activity returns');
});
test('a deadline while browser preparation is pending also reports unknown cleanup',async()=>{
 const t=execute({bad:'browser-pending',mode:'throw',deadlineOffsetMs:50});
 await assert.rejects(t.pending,/SDK_CLEANUP_UNKNOWN/);
 t.release();await new Promise(resolve=>setImmediate(resolve));
 assert.ok(t.calls.includes('browser'));
});
test('a browser cleanup failure on the same abort that wins the lifetime race remains unknown',async()=>{
 const controller=new AbortController(),t=execute({bad:'browser-abort-cleanup',mode:'throw',signal:controller.signal});
 for(let i=0;i<20&&!t.calls.includes('browser-prepare');i++)await new Promise(resolve=>setImmediate(resolve));
 assert.ok(t.calls.includes('browser-prepare'));controller.abort();
 await assert.rejects(t.pending,/SDK_CLEANUP_UNKNOWN/);
});
