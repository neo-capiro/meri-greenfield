/** Absolute pre-execution cutoffs for one original runner lease. Each stage
 * keeps its own allowance plus every later allowance, so slow authority reads
 * cannot borrow time reserved for startup, shutdown, or failure settlement. */
export const RUNNER_LOAD_MAX_MS=23000;
export const RUNNER_LOAD_CONTROL_MARGIN_MS=2000;
export const RUNNER_STARTUP_MIN_SHUTDOWN_MS=10000;
export const RUNNER_STARTUP_SHUTDOWN_STEPS=3;
// Successful completion gets one bounded publication (including session
// settlement). If that fails, catch may need four serial terminal attempts.
export const RUNNER_STARTUP_SETTLEMENT_MS=5*RUNNER_LOAD_MAX_MS;
// Catch closes an in-flight query before terminal publication; final cleanup
// remains separately reserved after the terminal attempt sequence.
export const RUNNER_STARTUP_CATCH_CLEANUP_MS=3000;
// Final cleanup can make seven serial three-second attempts and then spend
// 131 seconds settling a Browser host whose outcome remains uncertain.
export const RUNNER_STARTUP_CLEANUP_MS=7*3000+131000;
export const RUNNER_STARTUP_MARGIN_MS=2000;
// A native prepare/start exchange crosses runner client -> control task router
// -> runner receiver, and the receiver's preparation authority calls return to
// control inside it. Each enclosing hop keeps one control margin above the hop it
// encloses, so the innermost owner refuses first and the outer ones still answer.
export const RUNNER_NATIVE_STARTUP_ROUTER_MS=RUNNER_LOAD_MAX_MS-RUNNER_LOAD_CONTROL_MARGIN_MS;
export const RUNNER_NATIVE_STARTUP_RECEIVER_MS=RUNNER_NATIVE_STARTUP_ROUTER_MS-RUNNER_LOAD_CONTROL_MARGIN_MS;

export const RUNNER_STARTUP_STAGE_ORDER=Object.freeze([
 'bootstrap','admittedBefore','admittedAfter','load','runtime','local',
 'starting','setup','running','nativePrepare','nativeStart','session',
]);

const LOCAL_STAGE_MS=3000;
// Optional Browser host, objective, and selected-skill preparation share this
// stage before the first running publication.
const SETUP_STAGE_MS=23000;

export function runnerStartupBudget({requestMs,shutdownMs,originalExpiresAtMs}){
 if(![requestMs,shutdownMs,originalExpiresAtMs].every(Number.isSafeInteger)||
    requestMs<=RUNNER_LOAD_CONTROL_MARGIN_MS||shutdownMs<1||originalExpiresAtMs<1)
  throw new TypeError('RUNNER_STARTUP_BUDGET_REFUSED');
 const networkMs=Math.min(RUNNER_LOAD_MAX_MS,requestMs-RUNNER_LOAD_CONTROL_MARGIN_MS);
 const reserveMs=RUNNER_STARTUP_SHUTDOWN_STEPS*Math.max(shutdownMs,RUNNER_STARTUP_MIN_SHUTDOWN_MS)+
  RUNNER_STARTUP_CATCH_CLEANUP_MS+RUNNER_STARTUP_SETTLEMENT_MS+
  RUNNER_STARTUP_CLEANUP_MS+RUNNER_STARTUP_MARGIN_MS;
 const capFor=stage=>stage==='local'?LOCAL_STAGE_MS:stage==='setup'?SETUP_STAGE_MS:networkMs;
 let cutoff=originalExpiresAtMs-reserveMs;
 const stages={};
 for(const stage of [...RUNNER_STARTUP_STAGE_ORDER].reverse()){
  const maxMs=capFor(stage);
  stages[stage]=Object.freeze({maxMs,expiresAtMs:cutoff});
  cutoff-=maxMs;
 }
 return Object.freeze({originalExpiresAtMs,reserveMs,stages:Object.freeze(stages)});
}

/** Compatibility for callers moving from the prior load-only allowance. */
export function runnerLoadBudget(input){
 try{return runnerStartupBudget(input).stages.load;}
 catch(error){if(error?.message==='RUNNER_STARTUP_BUDGET_REFUSED')throw new TypeError('RUNNER_LOAD_BUDGET_REFUSED');throw error;}
}
