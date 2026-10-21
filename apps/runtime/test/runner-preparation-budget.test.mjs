import {testBudgetTable as runnerTestBudgets} from '../../../packages/runtime/test/budget-fixture.mjs';
// The runner hands the activity runtime preparation (the runner/runtime call, then the local stage) on the real stage table. The
// two stages in sequence exceed the activity's preparation bound, so the runner caps their sum at the shared limit.
import test from 'node:test';
import assert from 'node:assert/strict';
import {assembleConversationRunner} from '../conversation-runner.mjs';
import {createConversationActivity} from '../../worker/conversation/activity.mjs';
import {continuationFixture} from '../../worker/conversation/continuation/test/fixtures.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {ACTIVITY_PREPARATION_MAX_MS,runnerStartupBudget} from '../../../packages/runtime/hot-path-budgets.mjs';

const runOwner={async load(){},async append(){}},prepareRuntime=async()=>({});

test('the activity accepts exactly the shared preparation limit',()=>{
 assert.doesNotThrow(()=>createConversationActivity({...{terminalAttemptMs:3000,cleanupAttemptMs:3000,loadMaxMs:3000,runtimeMaxMs:3000,},runOwner,prepareRuntime,runtimeMaxMs:ACTIVITY_PREPARATION_MAX_MS}));
 assert.throws(()=>createConversationActivity({...{terminalAttemptMs:3000,cleanupAttemptMs:3000,loadMaxMs:3000,runtimeMaxMs:3000,},runOwner,prepareRuntime,runtimeMaxMs:ACTIVITY_PREPARATION_MAX_MS+1}),{code:'ACTIVITY_CONFIGURATION'});
});

test('a remote runner assembles on the real stage table although runtime and local stages exceed the limit in sequence',()=>{
 const {binding,target}=continuationFixture(),executionKey=hash(binding),expiresAtMs=Date.now()+900000;
 const stages=runnerStartupBudget({requestMs:25000,shutdownMs:10000,originalExpiresAtMs:expiresAtMs}).stages;
 assert.ok(stages.runtime.maxMs+stages.local.maxMs>ACTIVITY_PREPARATION_MAX_MS,'the cap is what makes preparation fit');
 const configuration={binding,versions:target.versions,sourceEnabled:false,limits:{requestMs:25000,shutdownMs:10000},
  remoteTask:{original:{binding,versions:target.versions,executionKey,executionId:executionKey,planSha256:'0'.repeat(64),expiresAtMs}}};
 assert.doesNotThrow(()=>assembleConversationRunner({budgets:runnerTestBudgets,configuration,native:{async call(){throw Error('NOT_CALLED');}},query:()=>{throw Error('NOT_CALLED');}}));
});
