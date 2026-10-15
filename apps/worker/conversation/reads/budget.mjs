// @ts-check
/** Per-run ceilings for general reads and the run-scoped ledger that enforces them in the worker.
 *
 * PROPOSAL P3 (local shape, pending dot): the ceilings mirror the original skill assets and are UNQUALIFIED UPPER
 * BOUNDS, never spending authority. The durable gateway allocation still reserves and settles every call; this ledger
 * only refuses earlier. A selected skill can only narrow them (minimum of each bound). No call is ever retried
 * (`maxRecoveryAttempts` is 0): an UNKNOWN or failed outcome never licenses another dispatch. */
export const GENERAL_READ_CEILINGS=Object.freeze({maxToolCalls:24,maxOutputBytes:1048576,maxReadBytes:2097152,maxRecoveryAttempts:0});
/** Per-call timeout bounds for the SDK server (`createSdkMcpServer` `timeout`) and each call's own deadline. */
export const READ_TIMEOUT_MS=Object.freeze({min:1000,max:60000});
const fault=(/** @type {string} */code)=>Object.assign(Error(code),{code});
/** @typedef {{maxToolCalls:number,maxOutputBytes:number,maxReadBytes:number,maxRecoveryAttempts:0}} ReadBudgets */
/** @param {{maxToolCalls:number,maxOutputBytes:number}|undefined} skillBudgets @returns {ReadBudgets} */
export function effectiveReadBudgets(skillBudgets){
 if(skillBudgets===undefined)return GENERAL_READ_CEILINGS;
 const calls=Math.min(GENERAL_READ_CEILINGS.maxToolCalls,skillBudgets.maxToolCalls),output=Math.min(GENERAL_READ_CEILINGS.maxOutputBytes,skillBudgets.maxOutputBytes);
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
