/** Existing operation caps for one direct SDK run. All work stays inside the
 * original expiry; startup does not reserve hypothetical later operations. */
export const RUNNER_LOAD_MAX_MS=23000;
export const RUNNER_LOAD_CONTROL_MARGIN_MS=2000;
// runner/load and runner/publish are sent again after an answer reporting a dependency that did not answer (a Clerk timeout
// answered 503), after these pauses and only inside the caller's absolute deadline (native-client.mjs).
export const RUNNER_REPLAY_DELAYS_MS=Object.freeze([500,1500]);
// The load stage fits one replay: a full attempt, the first pause and a second full attempt. Each attempt keeps
// RUNNER_LOAD_MAX_MS. At the tail Core profile one load takes about 15.7 s, so a single 23 s window could never hold a replay.
export const RUNNER_LOAD_STAGE_MAX_MS=2*RUNNER_LOAD_MAX_MS+RUNNER_REPLAY_DELAYS_MS[0];
// A native prepare/start exchange crosses runner client -> control task router
// -> runner receiver, and the receiver's preparation authority calls return to
// control inside it. Each enclosing hop keeps one control margin above the hop it
// encloses, so the innermost owner refuses first and the outer ones still answer.
export const RUNNER_NATIVE_STARTUP_ROUTER_MS=RUNNER_LOAD_MAX_MS-RUNNER_LOAD_CONTROL_MARGIN_MS;

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

// Governed-intent availability: worker `intents/runtime.mjs` -> runner `intents-client.mjs` -> control `intents-http.mjs`. Control's
// resolver authenticates the execution, reads current transition authority (conversation lock, native access, Core readCurrent,
// access verify), composes the preparers and verifies the retention fence; at the live Core round trip (about 290 ms a call) that
// chain outran the earlier 3 s snapshot bound, so every offer failed and every governed write answered UNAVAILABLE. Each enclosing
// hop keeps one control margin above the hop it encloses, so control refuses first and the outer layers still answer.
export const INTENT_AVAILABILITY_CONTROL_MS=8000;
export const INTENT_AVAILABILITY_RUNNER_MS=INTENT_AVAILABILITY_CONTROL_MS+RUNNER_LOAD_CONTROL_MARGIN_MS;
export const INTENT_AVAILABILITY_WORKER_MS=INTENT_AVAILABILITY_RUNNER_MS+RUNNER_LOAD_CONTROL_MARGIN_MS;

// Governed-intent preparation: worker `intents/server.mjs` (the SDK tool's 60 s cap) -> runner `intents-client.mjs` -> control
// `intents-http.mjs` -> the owner. The slowest owner is a document preparation that renders PDF: generation, a renderer session on
// a new AgentCore microVM (about 30 s cold, 1 s warm) and LibreOffice's first start on a fresh profile, plus the current-authority
// checks before and after. It keeps DOCUMENT_PREPARATION_MS. The conversation intent mount (`apps/control/intents/mount.mjs`)
// encloses it with one control margin for its journal claim and release, and settles a refused or uncertain delivery on its own
// INTENT_SETTLE_MS allowance afterwards, so an expired preparation never leaves its journal row PENDING. Control's route encloses
// the mount and its settlement, and the runner encloses control by one margin. With both hops at 30 s the runner gave up exactly
// when control did, and the document owner and the mount were bounded by control's 25 s request budget, below a cold renderer.
export const DOCUMENT_PREPARATION_MS=46000;
export const INTENT_MOUNT_PREPARE_MS=DOCUMENT_PREPARATION_MS+RUNNER_LOAD_CONTROL_MARGIN_MS;
export const INTENT_SETTLE_MS=2000;
export const INTENT_PREPARE_CONTROL_MS=INTENT_MOUNT_PREPARE_MS+INTENT_SETTLE_MS+RUNNER_LOAD_CONTROL_MARGIN_MS;
export const INTENT_PREPARE_RUNNER_MS=INTENT_PREPARE_CONTROL_MS+RUNNER_LOAD_CONTROL_MARGIN_MS;

// General-read availability: worker `reads/runtime.mjs` -> runner `reads-client.mjs` -> control `reads-http.mjs`/`reads-owner.mjs`.
// Control's owner authenticates the execution, composes the gateway and takes the snapshot twice (before and after), and each
// snapshot reads the current Core capability role (`agentcore-candidate.mjs` readCapabilityRole, a live Core round trip) and the
// run's capability policy: about six execution authentications and two Core calls. At a slow Core or execution store that chain
// outran the earlier 3 s bound at every layer, the worker mounted the run with no read available, and every read of that turn
// answered UNAVAILABLE while the next turn's snapshot succeeded (the 1 November bill-read flap). Each enclosing hop keeps one
// control margin above the hop it encloses. The worker bound stays inside the setup stage next to the intent offer
// (10 s + 12 s < SETUP_STAGE_MS), so two unanswered offers still leave the run its own setup allowance.
export const READ_AVAILABILITY_CONTROL_MS=6000;
export const READ_AVAILABILITY_RUNNER_MS=READ_AVAILABILITY_CONTROL_MS+RUNNER_LOAD_CONTROL_MARGIN_MS;
export const READ_AVAILABILITY_WORKER_MS=READ_AVAILABILITY_RUNNER_MS+RUNNER_LOAD_CONTROL_MARGIN_MS;

// SDK session preparation; a continuation reads its checkpoint snapshot from control here.
const LOCAL_STAGE_MS=RUNNER_SESSION_RPC_MS.snapshot+RUNNER_LOAD_CONTROL_MARGIN_MS;
// The activity's bound on runtime preparation: the runner/runtime call, then the local stage. It is the one place where an
// enclosing bound is smaller than its inner allowances in sequence (runtime 23 s + local 10 s = 33 s against 30 s). Each stage
// keeps its own allowance and absolute cutoff, so the 30 s only shortens the local stage after a runtime call past 20 s; the
// local stage's work is about 3.3 s at the tail profile (adj-e D2), so that takes a runtime call past 26.7 s, beyond its own 23 s.
export const ACTIVITY_PREPARATION_MAX_MS=30000;
// Objective and selected-skill preparation share this stage. Remote browser
// preparation keeps its own allowance inside this same absolute cutoff.
const SETUP_STAGE_MS=23000;

export function runnerStartupBudget({requestMs,shutdownMs,originalExpiresAtMs}){
 if(![requestMs,shutdownMs,originalExpiresAtMs].every(Number.isSafeInteger)||
    requestMs<=RUNNER_LOAD_CONTROL_MARGIN_MS||shutdownMs<1||originalExpiresAtMs<1)
  throw new TypeError('RUNNER_STARTUP_BUDGET_REFUSED');
 const networkMs=Math.min(RUNNER_LOAD_MAX_MS,requestMs-RUNNER_LOAD_CONTROL_MARGIN_MS);
 // Retain the existing client cap and the control response margin.
 if(networkMs<RUNNER_LOAD_MAX_MS)throw new TypeError('RUNNER_STARTUP_BUDGET_REFUSED');
 const loadStageMs=2*networkMs+RUNNER_REPLAY_DELAYS_MS[0];
 // Leave one existing terminal-publication allowance after the model stops.
 // Actual local cleanup keeps its own bounds and never extends task authority.
 // Do not subtract every possible later request/cleanup maximum: the original
 // may have been issued while the user was still composing the first message.
 const cutoff=originalExpiresAtMs-networkMs;
 const stages={};
 for(const [stage,maxMs]of Object.entries({bootstrap:networkMs,admittedBefore:networkMs,admittedAfter:networkMs,
  load:loadStageMs,runtime:networkMs,local:LOCAL_STAGE_MS,starting:networkMs,setup:SETUP_STAGE_MS,running:networkMs,session:networkMs})){
  stages[stage]=Object.freeze(stage==='load'?{maxMs,attemptMs:networkMs,expiresAtMs:cutoff}:{maxMs,expiresAtMs:cutoff});
 }
 return Object.freeze({originalExpiresAtMs,stages:Object.freeze(stages)});
}
