/** Runner/load is a serial authority read. Leave room below the control HTTP
 * deadline and before the original execution lease ends. No other native
 * operation uses this allowance. */
export const RUNNER_LOAD_MAX_MS=23000;
export const RUNNER_LOAD_CONTROL_MARGIN_MS=2000;
// After load: three seconds for runtime admission, three for the first
// publication, then two seconds of local margin before shutdown begins.
export const RUNNER_LOAD_LEASE_MARGIN_MS=8000;
export function runnerLoadBudget({requestMs,shutdownMs,originalExpiresAtMs}){
 if(![requestMs,shutdownMs,originalExpiresAtMs].every(Number.isSafeInteger)||requestMs<1||shutdownMs<1||originalExpiresAtMs<1)throw new TypeError('RUNNER_LOAD_BUDGET_REFUSED');
 return Object.freeze({maxMs:Math.max(1,Math.min(RUNNER_LOAD_MAX_MS,requestMs-RUNNER_LOAD_CONTROL_MARGIN_MS)),
  expiresAtMs:originalExpiresAtMs-shutdownMs-RUNNER_LOAD_LEASE_MARGIN_MS});
}
