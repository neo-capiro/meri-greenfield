import {hotPathBudgets} from '../hot-path-budgets.mjs';
export const productionBudgetInputs=Object.freeze({limits:Object.freeze({startupMs:30000,shutdownMs:10000,requestMs:25000}),runWindowMs:900000,nowMs:1800000000000,originalExpiresAtMs:1800000900000});
export const testBudgetTable=hotPathBudgets(productionBudgetInputs);
export const productionBudgetTable=testBudgetTable;
