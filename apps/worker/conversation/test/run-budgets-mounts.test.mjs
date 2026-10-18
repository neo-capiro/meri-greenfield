/** The run's admitted budgets reach the early read ledger through the real profile mounts (activity → createProfileMounts →
 * createGeneralReadRuntime): below and above the D016 default of 20, and the default when the run carries none. Synthetic port. */
import test from 'node:test';
import assert from 'node:assert/strict';
import catalog from '../../../../packages/contracts/retrieval-0.2/catalog.json' with {type:'json'};
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {PROPOSED_PREVIEW_CAPABILITY_PLATFORM,createConfiguredRunCapabilityPolicy} from '../../../runtime/product-ports/capability-policy.mjs';
import {createProfileMounts} from '../capabilities/mounts.mjs';
import {assertCapabilityPolicy} from '../capabilities/policy.mjs';
import {profileReads} from '../reads/availability.mjs';
import {readRunBudgets} from '../reads/budget.mjs';
import {binding,scopes,id} from '../../../control/conversations/test/store-fixture.mjs';
const PROFILE=createConfiguredRunCapabilityPolicy({capabilityPlatform:PROPOSED_PREVIEW_CAPABILITY_PLATFORM}).profile;
const policy=assertCapabilityPolicy({...PROFILE,skillPlugin:false,skillNames:null,workspaceTools:false});
const operations=profileReads({policy}).slice(0,1).map(r=>r.operation);
const port={async readAvailability(){const at=Date.now();
 return {installation:{installationId:id(80),baseCatalogSha256:canonicalSha256(catalog),executionCatalogSha256:'e'.repeat(64),operations,checkedAtMs:at-1000,expiresAtMs:at+600000},
  discovery:{binding,policyRevision:scopes[0].policyRevision,operations,checkedAtMs:at-1000,expiresAtMs:at+600000}};},async execute(){throw Error('not called');}};
const quiet=()=>{const original=process.emitWarning;process.emitWarning=(warning,...rest)=>{if(String(warning).includes('canUseTool will not be invoked'))return;return original.call(process,warning,...rest);};return ()=>{process.emitWarning=original;};};
/** How many read calls the run's ledger admits before its typed RESOURCE_LIMIT refusal (counted at the PreToolUse hook). */
async function admitted(saved,attempts){
 const runBudgets=readRunBudgets(saved);
 const {reads}=await createProfileMounts({policy,binding,scopes,now:Date.now,deadlineMs:Date.now()+60000,generalReads:port,...(runBudgets===undefined?{}:{runBudgets})});
 try{const hook=reads.sdkOptions.hooks.PreToolUse[0].hooks[0],name=reads.sdkOptions.allowedTools[0],signal=new AbortController().signal;
  for(let i=0;i<attempts;i++){const d=await hook({hook_event_name:'PreToolUse',session_id:'71000000-0000-4000-8000-000000000091',tool_name:name,tool_use_id:`toolu_budget_${i}`,tool_input:{arguments:{}}},undefined,{signal});
   if(d.hookSpecificOutput.permissionDecision==='deny'){assert.match(d.hookSpecificOutput.permissionDecisionReason,/^RESOURCE_LIMIT: /u);return i;}}
  return attempts;}finally{await reads.close();}
}

test('the early read ledger follows the run\'s admitted maxToolCalls below and above the default, and keeps 20 without one',async()=>{
 const restore=quiet();try{
  assert.equal(await admitted({run:{}},30),20,'no runBudgets: the D016 default');
  assert.equal(await admitted({runBudgets:{maxToolCalls:3,maxOutputBytes:1048576}},30),3,'below the default');
  assert.equal(await admitted({runBudgets:{maxToolCalls:25,maxOutputBytes:1048576,maxAggregateOutputBytes:2097152}},30),25,'above the default');
 }finally{restore();}
});

test('a malformed runBudgets record refuses the run rather than guessing a bound',()=>{
 for(const runBudgets of [{},{maxToolCalls:0,maxOutputBytes:1},{maxToolCalls:2},{maxToolCalls:2,maxOutputBytes:1,extra:true},{maxToolCalls:2,maxOutputBytes:2048,maxAggregateOutputBytes:1024},null,[]])
  assert.throws(()=>readRunBudgets({runBudgets}),/READ_CONFIGURATION/,JSON.stringify(runBudgets));
 assert.equal(readRunBudgets({run:{}}),undefined);assert.equal(readRunBudgets(undefined),undefined);
});
