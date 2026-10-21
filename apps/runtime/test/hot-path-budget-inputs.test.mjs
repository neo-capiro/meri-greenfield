import test from 'node:test';
import assert from 'node:assert/strict';
import {runtimeHotPathBudgets} from '../hot-path-budget-inputs.mjs';
import {productionBudgetInputs} from '../../../packages/runtime/test/budget-fixture.mjs';

test('composition uses the rendered turn root, then the admitted candidate window and allocation cap',()=>{
 const {limits}=productionBudgetInputs;
 const explicit=runtimeHotPathBudgets({limits,runWindowMs:900000,nativeCandidate:{multiRun:{runWindowMs:800000}}});
 assert.equal(explicit.roots.turn.ms,900000);
 assert.equal(runtimeHotPathBudgets({limits,nativeCandidate:{multiRun:{runWindowMs:800000}}}).roots.turn.ms,800000);
 assert.equal(runtimeHotPathBudgets({limits,nativeCandidate:{allocationJson:JSON.stringify({budgets:{maxRuntimeSeconds:900}})}}).roots.turn.ms,900000);
 assert.equal(runtimeHotPathBudgets({limits,nativeCandidate:{allocationJson:JSON.stringify({budgets:{maxRuntimeSeconds:100000}})}}).roots.turn.ms,86400000);
 const originalExpiresAtMs=1800000900000;
 assert.equal(runtimeHotPathBudgets({limits,runWindowMs:900000,bootstrap:{expiresAtMs:originalExpiresAtMs}}).roots.original.expiresAtMs,originalExpiresAtMs);
 assert.throws(()=>runtimeHotPathBudgets({limits}),{code:'HOT_PATH_BUDGET_CONFIGURATION'});
 assert.throws(()=>runtimeHotPathBudgets({limits,nativeCandidate:{allocationJson:'invalid'}}),{code:'HOT_PATH_BUDGET_CONFIGURATION'});
});
