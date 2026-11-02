/** Platform ceiling for one run's SDK `maxTurns`. A run is one submitted user message: the runtime hands this value to the SDK
 * query for that message (apps/runtime/conversation-runner.mjs, apps/worker/conversation/options.mjs), so long research jobs need
 * room here while spend stays bounded by the per-run budget and the tenant monthly cap. Tenant settings, run admission, the
 * runtime options, the usage overview schema and migration 0032 all read this one constant; no literal copy may remain. */
export const MAX_RUN_TURNS=1000;
/** Wall-clock ceiling for one run's execution record (`apps/runtime/agentcore-candidate.mjs` admit). The Temporal activity lease
 * (`temporal-worker.mjs` currentLease), the AgentCore invocation lifetime (`agentcore-client.mjs`), every runtime admission check on
 * `execution.expiresAtMs` and the worker's own deadline (`activity.mjs`) all follow that record, so this one number is the run's
 * end-to-end bound. Four hours fits inside the AgentCore runtime session maxLifetime of eight hours
 * (infra/product-preview/agentcore-runtime.mjs). Routines, prepared facts and continuation receipts keep the deployment's reviewed
 * `runWindowMs`; a skill-selected run keeps its manifest's maxRuntimeSeconds. */
export const MAX_RUN_WALL_CLOCK_MS=4*60*60*1000;
/** Temporal `startToCloseTimeout` of the run activity: the execution window plus kickoff, settlement and native-cleanup grace, so the
 * lease expiry (a clean failure that still runs cleanup) always fires before Temporal abandons the activity. Liveness is separate:
 * the activity heartbeats on every status poll (at most once a second), so `heartbeatTimeout` stays short and unchanged. */
export const RUN_ACTIVITY_START_TO_CLOSE_MS=MAX_RUN_WALL_CLOCK_MS+10*60*1000;
