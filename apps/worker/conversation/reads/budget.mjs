// @ts-check
/** Per-run ceilings for general reads and the run-scoped ledger that enforces them in the worker.
 *
 * P3: never spending authority. The durable gateway allocation (apps/gateway/budget/general-read-allocation.mjs) reserves
 * and settles every call; this ledger only refuses earlier. The tool-call bound is the run's configured `maxToolCalls`
 * (`runBudgets`), defaulting to the D016 integration profile's 20; byte bounds match the allocation's fixed ceilings. A selected
 * skill can only narrow them (minimum of each bound). No call is ever retried (`maxRecoveryAttempts` is 0): an UNKNOWN or
 * failed outcome never licenses another dispatch. */
export const GENERAL_READ_CEILINGS=Object.freeze({maxToolCalls:20,maxOutputBytes:1048576,maxReadBytes:2097152,maxRecoveryAttempts:0});
/** Per-call timeout bounds for the SDK server (`createSdkMcpServer` `timeout`) and each call's own deadline. */
export const READ_TIMEOUT_MS=Object.freeze({min:1000,max:60000});
const fault=(/** @type {string} */code)=>Object.assign(Error(code),{code});
/** @typedef {{maxToolCalls:number,maxOutputBytes:number,maxReadBytes:number,maxRecoveryAttempts:0}} ReadBudgets */
/** @param {{maxToolCalls:number,maxOutputBytes:number}|undefined} skillBudgets
 * @param {{maxToolCalls:number}} [runBudgets] the run's configured caps (its allocation budgets); default D016's 20 calls
 * @returns {ReadBudgets} */
export function effectiveReadBudgets(skillBudgets,runBudgets){
 const runCalls=runBudgets===undefined?GENERAL_READ_CEILINGS.maxToolCalls:runBudgets.maxToolCalls;
 if(!Number.isSafeInteger(runCalls)||runCalls<1)throw fault('READ_CONFIGURATION');
 if(skillBudgets===undefined)return runBudgets===undefined?GENERAL_READ_CEILINGS:Object.freeze({...GENERAL_READ_CEILINGS,maxToolCalls:runCalls});
 const calls=Math.min(runCalls,skillBudgets.maxToolCalls),output=Math.min(GENERAL_READ_CEILINGS.maxOutputBytes,skillBudgets.maxOutputBytes);
 if(!Number.isSafeInteger(calls)||calls<1||!Number.isSafeInteger(output)||output<1)throw fault('READ_CONFIGURATION');
 return Object.freeze({maxToolCalls:calls,maxOutputBytes:output,maxReadBytes:Math.min(GENERAL_READ_CEILINGS.maxReadBytes,2*output),maxRecoveryAttempts:0});
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
/** The run's admitted allocation budgets as loaded for execution (`saved.runBudgets`, control's read-only allocation reader), for
 * this ledger only. Absent means the defaults; anything malformed refuses the run rather than guessing a bound.
 * @param {unknown} saved @returns {{maxToolCalls:number,maxOutputBytes:number,maxAggregateOutputBytes?:number}|undefined} */
export function readRunBudgets(saved){
 if(!saved||typeof saved!=='object'||!Object.hasOwn(saved,'runBudgets'))return undefined;
 const value=/** @type {{runBudgets:any}} */(saved).runBudgets,keys=value&&typeof value==='object'&&!Array.isArray(value)?Object.keys(value):[];
 const positive=(/** @type {unknown} */v)=>Number.isSafeInteger(v)&&/** @type {number} */(v)>=1;
 if(!keys.length||keys.some(k=>!['maxToolCalls','maxOutputBytes','maxAggregateOutputBytes'].includes(k))||!positive(value.maxToolCalls)||!positive(value.maxOutputBytes)||
  Object.hasOwn(value,'maxAggregateOutputBytes')&&(!positive(value.maxAggregateOutputBytes)||value.maxAggregateOutputBytes<value.maxOutputBytes))throw fault('READ_CONFIGURATION');
 return Object.freeze({maxToolCalls:value.maxToolCalls,maxOutputBytes:value.maxOutputBytes,...(Object.hasOwn(value,'maxAggregateOutputBytes')?{maxAggregateOutputBytes:value.maxAggregateOutputBytes}:{})});
}
