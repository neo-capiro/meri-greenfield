/** SYNTHETIC full activity: scripted SDK iterator and resource ports. No SDK query, browser process, network or database. */
import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
import {binding,versions,scopes,id} from '../../../control/conversations/test/store-fixture.mjs';
import {selectSkill} from '../../../../packages/skills/index.mjs';
let active;
const close=name=>()=>{active.calls.push(name);if(active.bad===name&&(name!=='finish'||active.calls.filter(n=>n==='finish').length>1)){if(active.mode==='hang')return new Promise(()=>{});throw Error('synthetic close refusal');}};
mock.module('../reads/runtime.mjs',{namedExports:{createGeneralReadRuntime:async()=>({close:close('read')}),continuationSessionId:()=>id(999)}});
mock.module('../intents/runtime.mjs',{namedExports:{createIntentRuntime:async()=>({close:close('intent')})}});
mock.module('../browser/runtime.mjs',{namedExports:{prepareBrowserRun:async()=>({fragment:{enabled:false},settle:close('browser')})}});
// Capability path qualification is outside this cleanup test (the product workspace is Linux); keep the actual activity and options.
mock.module('../capabilities/index.mjs',{namedExports:{createSdkCapabilities:()=>({options:{},check(){}})}});
mock.module('../continuation/activity-lifecycle.mjs',{namedExports:{HOLD_CHECKPOINT_FAILED:'HOLD_CHECKPOINT_FAILED',assertLifecycleConfiguration(){},
 createActivityLifecycle:()=>({observe(){},isHeld:()=>false,canCaptureCompletion:()=>false,check(){},failure:new Promise(()=>{}),finish:close('finish'),close:close('controls')})}});
const {createConversationActivity}=await import('../activity.mjs');
const selected=selectSkill('quick_skill.client_changes','1.0.0');
function execute({bad,mode,failed=false}){
 active={calls:[],bad,mode};let n=600;
 const run={binding,versions,scopes,state:'queued',policyRevision:scopes[0].policyRevision,createdAt:new Date().toISOString()};
 const request={requestId:id(500),prompt:'Synthetic prompt',skill:selected.pin,window:null};
 const activity=createConversationActivity({cleanupAttemptMs:15,terminalAttemptMs:15,lifecycle:{},
  runOwner:{async load(){return {run,request,capabilities:{generalReads:true,governedIntents:true}};},async append(){}},
  prepareRuntime:async()=>({binding,versions,cwd:`/workspace/${binding.conversationId}`,proxyUrl:'https://synthetic.invalid',proxyCredential:'synthetic',model:'qualified-model-pin',
   sessionStore:{load(){},append(){}},deadlineMs:Date.now()+5000,maxTurns:2,maxCostMicroUSD:1000,maxOutputBytes:1024}),
  selectedSkills:{async prepare(){return {selected,async finish(){return {};},close:close('skill')};},async publish(){}},
  generalReads:{readAvailability(){},execute(){}},governedIntents:{readAvailability(){},prepare(){}},browser:{policy(){}},newId:()=>id(n++),
  query:()=>({async *[Symbol.asyncIterator](){yield {type:'result',subtype:failed?'error_during_execution':'success',is_error:failed};},close:close('query')})});
 return {pending:activity({binding}),calls:active.calls};
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
