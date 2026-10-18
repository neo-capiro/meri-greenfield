// @ts-check
/** Per-run ceilings for general reads and the run-scoped ledger that enforces them in the worker.
 *
 * P3: never spending authority. The durable gateway allocation (apps/gateway/budget/general-read-allocation.mjs) reserves
 * and settles every call; this ledger only refuses earlier. Its bounds are the run's configured allocation budgets
 * (`runBudgets`: maxToolCalls, maxOutputBytes, maxAggregateOutputBytes), defaulting to the D016 integration profile (20 calls,
 * 1 MiB per result, 2 MiB per run). A selected skill can only narrow them (minimum of each bound). No call is ever retried
 * (`maxRecoveryAttempts` is 0): an UNKNOWN or failed outcome never licenses another dispatch. */
export const GENERAL_READ_CEILINGS=Object.freeze({maxToolCalls:20,maxOutputBytes:1048576,maxReadBytes:2097152,maxRecoveryAttempts:0});
/** Per-call timeout bounds for the SDK server (`createSdkMcpServer` `timeout`) and each call's own deadline. */
export const READ_TIMEOUT_MS=Object.freeze({min:1000,max:60000});
const fault=(/** @type {string} */code)=>Object.assign(Error(code),{code});
const positive=(/** @type {unknown} */v)=>Number.isSafeInteger(v)&&/** @type {number} */(v)>=1;
/** @typedef {{maxToolCalls:number,maxOutputBytes:number,maxReadBytes:number,maxRecoveryAttempts:0}} ReadBudgets */
/** @param {{maxToolCalls:number,maxOutputBytes:number}|undefined} skillBudgets
 * @param {{maxToolCalls:number,maxOutputBytes?:number,maxAggregateOutputBytes?:number}} [runBudgets] the run's allocation budgets
 * @returns {ReadBudgets} */
export function effectiveReadBudgets(skillBudgets,runBudgets){
 const run={maxToolCalls:runBudgets?.maxToolCalls??GENERAL_READ_CEILINGS.maxToolCalls,maxOutputBytes:runBudgets?.maxOutputBytes??GENERAL_READ_CEILINGS.maxOutputBytes,
  maxReadBytes:runBudgets?.maxAggregateOutputBytes??GENERAL_READ_CEILINGS.maxReadBytes};
 if(!positive(run.maxToolCalls)||!positive(run.maxOutputBytes)||!positive(run.maxReadBytes)||run.maxReadBytes<run.maxOutputBytes)throw fault('READ_CONFIGURATION');
 if(skillBudgets===undefined)return runBudgets===undefined?GENERAL_READ_CEILINGS:Object.freeze({...run,maxRecoveryAttempts:0});
 const calls=Math.min(run.maxToolCalls,skillBudgets.maxToolCalls),output=Math.min(run.maxOutputBytes,skillBudgets.maxOutputBytes);
 if(!positive(calls)||!positive(output))throw fault('READ_CONFIGURATION');
 return Object.freeze({maxToolCalls:calls,maxOutputBytes:output,maxReadBytes:Math.min(run.maxReadBytes,2*output),maxRecoveryAttempts:0});
}
/** Calls are counted when admitted (before any gateway effect), so a refused or failed call still spends its slot.
 * @param {ReadBudgets} budgets */
export function createReadLedger(budgets){
 let correlated=0,readBytes=0;
 return Object.freeze({
  /** A hook may correlate one more call only while slots remain. */
  admit(){if(correlated>=budgets.maxToolCalls)throw fault('RESOURCE_LIMIT');correlated++;},
  /** @param {string} result */
  account(result){const bytes=Buffer.byteLength(result);if(bytes>budgets.maxOutputBytes||readBytes+bytes>budgets.maxReadBytes)throw fault('RESOURCE_LIMIT');readBytes+=bytes;},
  get calls(){return correlated;},get readBytes(){return readBytes;},
 });
}
