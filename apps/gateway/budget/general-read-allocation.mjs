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
import {GENERAL_READ_PROFILE,GENERAL_READ_PROFILE_VERSION,GENERAL_READ_CEILINGS,GENERAL_READ_DEFAULT_READ_BYTES,assertGeneralReadManifest,assertOneHoldFits,assertTariffAssumptionEvidence,GENERAL_READ_DEFAULT_RUN_BUDGETS,documentReadCharge,DOCUMENT_READ} from './general-read-manifest.mjs';
import {allocation} from './tool-budget-binding.mjs';
import {refuse} from './postgres-budget-store.mjs';
import {GENERAL_READ_TARIFFS,GENERAL_READ_TARIFF_ASSUMPTIONS,GENERAL_READ_TARIFF_ASSUMPTION_KEYS,GENERAL_READ_DOCUMENT_BOUNDS} from './general-read-tariffs.mjs';

const key=op=>`${op.id}@${op.version}`;
const min=(a,b)=>Math.min(a,b);

const assumptionSet=assumptions=>{const list=assumptions??[];if(!Array.isArray(list)||list.some(a=>!GENERAL_READ_TARIFF_ASSUMPTIONS.includes(a)))refuse('INVALID_TARIFF_ASSUMPTION');return new Set(list);};
/** The tariff for one operation, or null when its external cost is unknown or its Core-configuration assumptions are not held
 * (`assumptions`: assumption ids, e.g. ['rerankDisabled']; an allocation holds one only with its evidence, see below). */
export function generalReadTariff(operation,assumptions){
 privateShape('OperationRef',operation);const t=GENERAL_READ_TARIFFS[key(operation)],held=assumptionSet(assumptions);
 if(!t||t.chargeMicrousd===null||(t.assumptions??[]).some(a=>!held.has(a)))return null;return t.chargeMicrousd;
}

/** Base allocation for one ordinary run.
 * - `runBudgets`: the run's configured caps {maxTurns, maxToolCalls, maxRuntimeSeconds, maxCostMicroUSD}
 *   (GENERAL_READ_DEFAULT_RUN_BUDGETS is the default integration profile, D016 3 / D016-A 3). They are taken as configured:
 *   admission requires only that one worst-case hold fits `maxCostMicroUSD`; spend is then enforced per call by the
 *   reservation and the typed budget-exhausted stop.
 * - `readBytes`: the validated read-bytes profile {maxOutputBytes, maxAggregateOutputBytes}, default
 *   GENERAL_READ_DEFAULT_READ_BYTES, within the structural GENERAL_READ_CEILINGS.
 * - `assumptions`: evidence objects (assertTariffAssumptionEvidence) for the Core settings an assumption-gated tariff relies on.
 *   The evidence an allocated tariff needs is carried in the manifest, so it never disappears from the emitted allocation.
 * - `documentPricing`: evidence that prices read_client_documents (documentReadCharge); without it the document read is excluded.
 * Returns {allocation, excluded}: `excluded` lists requested operations without a usable tariff. */
export function composeGeneralReadAllocation({run,operations,runBudgets,readBytes=GENERAL_READ_DEFAULT_READ_BYTES,catalogSha256,scheduleRevision,expiresAt,assumptions=[],documentPricing}){
 if(!Array.isArray(assumptions))refuse('INVALID_TARIFF_ASSUMPTION');
 const evidence=new Map();for(const item of assumptions){assertTariffAssumptionEvidence(item);if(evidence.has(item.id))refuse('INVALID_TARIFF_ASSUMPTION');evidence.set(item.id,{...item});}
 const held=[...evidence.keys()];
 const requested=[...new Map(operations.map(op=>{privateShape('OperationRef',op);return [key(op),{id:op.id,version:op.version}];})).values()].sort((a,b)=>key(a).localeCompare(key(b)));
 const documentCharge=documentPricing===undefined?null:documentReadCharge(documentPricing);
 const charge=op=>key(op)===DOCUMENT_READ?documentCharge:generalReadTariff(op,held);
 const priced=requested.filter(op=>charge(op)!==null),excluded=requested.filter(op=>charge(op)===null);
 if(!priced.length)refuse('INVALID_GENERAL_READ_MANIFEST');
 for(const k of ['maxTurns','maxToolCalls','maxRuntimeSeconds','maxCostMicroUSD'])if(!Number.isSafeInteger(runBudgets?.[k])||runBudgets[k]<1)refuse('INVALID_BUDGET_INTEGER');
 const bytes={maxOutputBytes:readBytes?.maxOutputBytes,maxAggregateOutputBytes:readBytes?.maxAggregateOutputBytes};
 if(!Number.isSafeInteger(bytes.maxOutputBytes)||bytes.maxOutputBytes<1||bytes.maxOutputBytes>GENERAL_READ_CEILINGS.maxOutputBytes||
  !Number.isSafeInteger(bytes.maxAggregateOutputBytes)||bytes.maxAggregateOutputBytes<bytes.maxOutputBytes||bytes.maxAggregateOutputBytes>GENERAL_READ_CEILINGS.maxAggregateOutputBytes)refuse('INVALID_BUDGET_INTEGER');
 const budgets={maxTurns:runBudgets.maxTurns,maxToolCalls:runBudgets.maxToolCalls,maxRecoveryAttempts:0,
  maxRuntimeSeconds:runBudgets.maxRuntimeSeconds,maxCostMicroUSD:runBudgets.maxCostMicroUSD,maxOutputBytes:bytes.maxOutputBytes};
 const schedule=priced.map(op=>({operation:op,chargeMicrousd:charge(op)}));
 assertOneHoldFits(budgets,schedule.map(s=>s.chargeMicrousd));
 const needed=[...new Set(priced.flatMap(op=>GENERAL_READ_TARIFFS[key(op)].assumptions??[]))].sort();
 const manifest=assertGeneralReadManifest({contractVersion:'0.2.0',profile:GENERAL_READ_PROFILE,profileVersion:GENERAL_READ_PROFILE_VERSION,allowedOperations:priced,budgets,
  maxAggregateOutputBytes:bytes.maxAggregateOutputBytes,...(needed.length?{tariffAssumptions:needed.map(id=>evidence.get(id))}:{}),
  ...(priced.some(op=>key(op)===DOCUMENT_READ)?{documentPricing:structuredClone(documentPricing)}:{})});
 const value={run,manifest,manifestSha256:canonicalSha256(manifest),catalogSha256,budgets,schedule:{revision:scheduleRevision,expiresAt,operations:schedule}};
 allocation(JSON.stringify(value));
 return Object.freeze({allocation:value,excluded});
}

/** The allocation.json charge-schedule entries for the general reads, as a proposal for the coordinator's re-pin
 * (docs/coordination/proposals/general-reads/allocation-read-tariffs.proposal.json is exactly this, pinned by a test).
 * `operations` are priced unconditionally; `assumptionGated` join the schedule only when the render asserts the Core
 * configuration; `excluded` are never allocated. Entries use allocation.json's closed `{operation, chargeMicrousd}` shape. */
export function generalReadTariffProposal(){
 const rows=Object.entries(GENERAL_READ_TARIFFS).map(([k,t])=>{const at=k.lastIndexOf('@');return {operation:{id:k.slice(0,at),version:k.slice(at+1)},...t};}).sort((x,y)=>key(x.operation).localeCompare(key(y.operation)));
 return {schema:'meri.allocation-read-tariffs.proposal.v1',source:'apps/gateway/budget/general-read-tariffs.mjs',
  defaultRunBudgets:{...GENERAL_READ_DEFAULT_RUN_BUDGETS},defaultReadBytes:{...GENERAL_READ_DEFAULT_READ_BYTES},assumptions:[...GENERAL_READ_TARIFF_ASSUMPTIONS],
  documentPricingRequired:{bounds:structuredClone(GENERAL_READ_DOCUMENT_BOUNDS),vision:['model','inputMicrousdPerMillionTokens','outputMicrousdPerMillionTokens','maxInputTokens','coreSourceCommit','coreImageDigest','configurationSha256'],
   transcription:['model','microusdPerMinute','maxAudioSeconds','coreSourceCommit','coreImageDigest','configurationSha256'],coreWork:'Core must cap whisper-1 transcription duration (maxAudioSeconds) before read_client_documents can be allocated'},
  assumptionEvidenceRequired:Object.fromEntries(GENERAL_READ_TARIFF_ASSUMPTIONS.map(id=>[id,{...GENERAL_READ_TARIFF_ASSUMPTION_KEYS[id],evidence:['coreSourceCommit','coreImageDigest','configurationSha256']}])),
  operations:rows.filter(r=>r.chargeMicrousd!==null&&!r.assumptions?.length).map(r=>({operation:r.operation,chargeMicrousd:r.chargeMicrousd})),
  assumptionGated:rows.filter(r=>r.chargeMicrousd!==null&&r.assumptions?.length).map(r=>({operation:r.operation,chargeMicrousd:r.chargeMicrousd,assumptions:r.assumptions})),
  excluded:rows.filter(r=>r.chargeMicrousd===null).map(r=>({operation:r.operation,evidence:r.evidence}))};
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
