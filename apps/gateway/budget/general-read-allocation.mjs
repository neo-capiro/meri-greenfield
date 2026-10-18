/** P3: the base general-read allocation, its per-operation tariff schedule, and the rule that a selected skill can only narrow
 * it. Composed DISABLED: nothing renders or installs this allocation until the owner pins it. Meri stays the sole spend owner:
 * `allocation()` (tool-budget-binding.mjs) parses it and `postgres-tool-budget.mjs` reserves/settles every call against its
 * `maxToolCalls`, per-result `maxOutputBytes`, `maxAggregateOutputBytes`, the run `maxCostMicroUSD` and the shared ledger cap,
 * so no tool call can exceed the run cap; model spend keeps its own reservation against the same ledger.
 *
 * Tariffs (`GENERAL_READ_TARIFFS`) charge what one call can cost Capiro beyond its own database. Evidence is per Core
 * implementation (PR #121, reads lane P3 note). An operation whose external cost is unknown has no tariff and therefore cannot be
 * allocated: it is excluded and reported, never charged a guess. */
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {validateShape as privateShape} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {GENERAL_READ_PROFILE,GENERAL_READ_PROFILE_VERSION,GENERAL_READ_CEILINGS,assertGeneralReadManifest} from './general-read-manifest.mjs';
import {allocation} from './tool-budget-binding.mjs';
import {refuse} from './postgres-budget-store.mjs';
import {GENERAL_READ_TARIFFS,GENERAL_READ_TARIFF_ASSUMPTIONS} from './general-read-tariffs.mjs';

const key=op=>`${op.id}@${op.version}`;
const min=(a,b)=>Math.min(a,b);

const assumptionSet=assumptions=>{const list=assumptions??[];if(!Array.isArray(list)||list.some(a=>!GENERAL_READ_TARIFF_ASSUMPTIONS.includes(a)))refuse('INVALID_TARIFF_ASSUMPTION');return new Set(list);};
/** The tariff for one operation, or null when its external cost is unknown or its Core-configuration assumptions are not
 * asserted (`assumptions`: the reviewed Core configuration the render pins, e.g. ['rerankDisabled','webSearchProviderDuckDuckGo']). */
export function generalReadTariff(operation,assumptions){
 privateShape('OperationRef',operation);const t=GENERAL_READ_TARIFFS[key(operation)],held=assumptionSet(assumptions);
 if(!t||t.chargeMicrousd===null||(t.assumptions??[]).some(a=>!held.has(a)))return null;return t.chargeMicrousd;
}

/** Base allocation for one ordinary run. `runBudgets` are the run's measured policy caps (policy.json / first-chat render):
 * {maxTurns, maxToolCalls, maxRuntimeSeconds, maxCostMicroUSD}. The base never exceeds GENERAL_READ_CEILINGS or the run caps.
 * Returns {allocation, excluded}: `excluded` lists requested operations without a usable tariff (unknown cost, or an
 * unasserted Core-configuration assumption). */
export function composeGeneralReadAllocation({run,operations,runBudgets,catalogSha256,scheduleRevision,expiresAt,assumptions}){
 const requested=[...new Map(operations.map(op=>{privateShape('OperationRef',op);return [key(op),{id:op.id,version:op.version}];})).values()].sort((a,b)=>key(a).localeCompare(key(b)));
 const priced=requested.filter(op=>generalReadTariff(op,assumptions)!==null),excluded=requested.filter(op=>generalReadTariff(op,assumptions)===null);
 if(!priced.length)refuse('INVALID_GENERAL_READ_MANIFEST');
 for(const k of ['maxTurns','maxToolCalls','maxRuntimeSeconds','maxCostMicroUSD'])if(!Number.isSafeInteger(runBudgets?.[k])||runBudgets[k]<1)refuse('INVALID_BUDGET_INTEGER');
 const budgets={maxTurns:runBudgets.maxTurns,maxToolCalls:min(GENERAL_READ_CEILINGS.maxToolCalls,runBudgets.maxToolCalls),maxRecoveryAttempts:0,
  maxRuntimeSeconds:runBudgets.maxRuntimeSeconds,maxCostMicroUSD:runBudgets.maxCostMicroUSD,maxOutputBytes:GENERAL_READ_CEILINGS.maxOutputBytes};
 const schedule=priced.map(op=>({operation:op,chargeMicrousd:generalReadTariff(op,assumptions)}));
 // Every admitted call fits the run cap even at the highest tariff: maxToolCalls × max(charge) ≤ maxCostMicroUSD.
 if(budgets.maxToolCalls*Math.max(...schedule.map(s=>s.chargeMicrousd))>budgets.maxCostMicroUSD)refuse('BUDGET_EXHAUSTED');
 const manifest=assertGeneralReadManifest({contractVersion:'0.2.0',profile:GENERAL_READ_PROFILE,profileVersion:GENERAL_READ_PROFILE_VERSION,allowedOperations:priced,budgets,
  maxAggregateOutputBytes:GENERAL_READ_CEILINGS.maxAggregateOutputBytes});
 const value={run,manifest,manifestSha256:canonicalSha256(manifest),catalogSha256,budgets,schedule:{revision:scheduleRevision,expiresAt,operations:schedule}};
 allocation(JSON.stringify(value));
 return Object.freeze({allocation:value,excluded});
}

/** A selected skill may only narrow the base: every operation in the base, every budget at most the base's. */
export function assertSkillNarrowsBase(skillManifest,baseManifest){
 privateShape('SkillManifest',skillManifest);assertGeneralReadManifest(baseManifest);
 const allowed=new Set(baseManifest.allowedOperations.map(key));
 if(skillManifest.allowedOperations.some(op=>!allowed.has(key(op))))refuse('SKILL_WIDENS_BASE');
 for(const [k,v] of Object.entries(skillManifest.budgets))if(v>baseManifest.budgets[k])refuse('SKILL_WIDENS_BASE');
 return skillManifest;
}

/** The effective budgets of a selected skill under the base: the field-wise minimum. */
export function narrowedSkillBudgets(skillBudgets,baseBudgets){
 privateShape('Budgets',skillBudgets);privateShape('Budgets',baseBudgets);
 return Object.fromEntries(Object.keys(baseBudgets).map(k=>[k,min(skillBudgets[k],baseBudgets[k])]));
}
