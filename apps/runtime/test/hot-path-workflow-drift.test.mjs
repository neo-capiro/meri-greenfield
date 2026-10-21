import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {renderWorkflowBudgets,workflowBudgetsPath} from '../../../packages/runtime/generate-workflow-budgets.mjs';
test('generated workflow budgets exactly match the canonical projection',async()=>{
 assert.equal(await readFile(workflowBudgetsPath,'utf8'),renderWorkflowBudgets());
});
