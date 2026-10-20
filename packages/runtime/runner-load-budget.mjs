/** Absolute pre-execution cutoffs for one original runner lease. Each stage
 * keeps its own allowance plus every later allowance, so slow authority reads
 * cannot borrow time reserved for startup, shutdown, or failure settlement. */
export const RUNNER_LOAD_MAX_MS=23000;
export const RUNNER_LOAD_CONTROL_MARGIN_MS=2000;
// runner/load and runner/publish are sent again after an answer reporting a dependency that did not answer (a Clerk timeout
// answered 503), after these pauses and only inside the caller's absolute deadline (native-client.mjs).
export const RUNNER_REPLAY_DELAYS_MS=Object.freeze([500,1500]);
// The load stage fits one replay: a full attempt, the first pause and a second full attempt. Each attempt keeps
// RUNNER_LOAD_MAX_MS. At the tail Core profile one load takes about 15.7 s, so a single 23 s window could never hold a replay.
export const RUNNER_LOAD_STAGE_MAX_MS=2*RUNNER_LOAD_MAX_MS+RUNNER_REPLAY_DELAYS_MS[0];
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

// SDK session mirror RPCs (runner -> control /v1/runner/session/*). Control's session owner verifies task authority, two Core
// calls each, twice for a read, three times for an append and four times for a registration plus its observation hop; the
// continuation snapshot verifies three times and reads its checkpoint object. Control bounds each operation one control margin
// inside the runner's allowance, so control answers before the runner gives up.
export const RUNNER_SESSION_RPC_MS=Object.freeze({register:12000,append:7000,load:6000,'list-subkeys':6000,snapshot:8000});
export const controlSessionRpcMs=operation=>RUNNER_SESSION_RPC_MS[operation]-RUNNER_LOAD_CONTROL_MARGIN_MS;
// One bound-store call: the first load of a subpath, then its append.
export const RUNNER_SESSION_STORE_CALL_MS=RUNNER_SESSION_RPC_MS.load+RUNNER_SESSION_RPC_MS.append+RUNNER_LOAD_CONTROL_MARGIN_MS;

// A runner checkpoint call (`checkpoint/complete` at the end of a turn, `checkpoint/capture` for a pause) has one network
// allowance. It encloses control's checkpoint capture, which encloses control's capture channel to the runner, the task
// router's forwarding of it and the runner's capture with its session reads.
export const CONTROL_CHECKPOINT_CAPTURE_MS=RUNNER_LOAD_MAX_MS-RUNNER_LOAD_CONTROL_MARGIN_MS;
export const CONTROL_CAPTURE_CHANNEL_MS=CONTROL_CHECKPOINT_CAPTURE_MS-RUNNER_LOAD_CONTROL_MARGIN_MS;
export const TASK_ROUTER_CAPTURE_MS=CONTROL_CAPTURE_CHANNEL_MS-RUNNER_LOAD_CONTROL_MARGIN_MS;
export const RUNNER_CAPTURE_MS=TASK_ROUTER_CAPTURE_MS-RUNNER_LOAD_CONTROL_MARGIN_MS;

export const RUNNER_STARTUP_STAGE_ORDER=Object.freeze([
 'bootstrap','admittedBefore','admittedAfter','load','runtime','local',
 'starting','setup','running','nativePrepare','nativeStart','session',
]);

// SDK session preparation; a continuation reads its checkpoint snapshot from control here.
const LOCAL_STAGE_MS=RUNNER_SESSION_RPC_MS.snapshot+RUNNER_LOAD_CONTROL_MARGIN_MS;
// The activity's bound on runtime preparation: the runner/runtime call, then the local stage. It is the one place where an
// enclosing bound is smaller than its inner allowances in sequence (runtime 23 s + local 10 s = 33 s against 30 s). Each stage
// keeps its own allowance and absolute cutoff, so the 30 s only shortens the local stage after a runtime call past 20 s; the
// local stage's work is about 3.3 s at the tail profile (adj-e D2), so that takes a runtime call past 26.7 s, beyond its own 23 s.
export const ACTIVITY_PREPARATION_MAX_MS=30000;
// Optional Browser host, objective, and selected-skill preparation share this
// stage before the first running publication.
const SETUP_STAGE_MS=23000;

export function runnerStartupBudget({requestMs,shutdownMs,originalExpiresAtMs}){
 if(![requestMs,shutdownMs,originalExpiresAtMs].every(Number.isSafeInteger)||
    requestMs<=RUNNER_LOAD_CONTROL_MARGIN_MS||shutdownMs<1||originalExpiresAtMs<1)
  throw new TypeError('RUNNER_STARTUP_BUDGET_REFUSED');
 const networkMs=Math.min(RUNNER_LOAD_MAX_MS,requestMs-RUNNER_LOAD_CONTROL_MARGIN_MS);
 // The runner client's native start allowance must keep one control margin above the router's startup allowance.
 if(networkMs<RUNNER_NATIVE_STARTUP_ROUTER_MS+RUNNER_LOAD_CONTROL_MARGIN_MS)throw new TypeError('RUNNER_STARTUP_BUDGET_REFUSED');
 const reserveMs=RUNNER_STARTUP_SHUTDOWN_STEPS*Math.max(shutdownMs,RUNNER_STARTUP_MIN_SHUTDOWN_MS)+
  RUNNER_STARTUP_CATCH_CLEANUP_MS+RUNNER_STARTUP_SETTLEMENT_MS+
  RUNNER_STARTUP_CLEANUP_MS+RUNNER_STARTUP_MARGIN_MS;
 const loadStageMs=2*networkMs+RUNNER_REPLAY_DELAYS_MS[0];
 const capFor=stage=>stage==='local'?LOCAL_STAGE_MS:stage==='setup'?SETUP_STAGE_MS:stage==='load'?loadStageMs:networkMs;
 let cutoff=originalExpiresAtMs-reserveMs;
 const stages={};
 for(const stage of [...RUNNER_STARTUP_STAGE_ORDER].reverse()){
  const maxMs=capFor(stage);
  // The load stage also names its per-attempt allowance, the native client's runner/load request bound.
  stages[stage]=Object.freeze(stage==='load'?{maxMs,attemptMs:networkMs,expiresAtMs:cutoff}:{maxMs,expiresAtMs:cutoff});
  cutoff-=maxMs;
 }
 return Object.freeze({originalExpiresAtMs,reserveMs,stages:Object.freeze(stages)});
}

/** Compatibility for callers moving from the prior load-only allowance. */
export function runnerLoadBudget(input){
 try{return runnerStartupBudget(input).stages.load;}
 catch(error){if(error?.message==='RUNNER_STARTUP_BUDGET_REFUSED')throw new TypeError('RUNNER_LOAD_BUDGET_REFUSED');throw error;}
}
