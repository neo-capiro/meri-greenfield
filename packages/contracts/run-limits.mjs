/** Platform ceiling for one run's SDK `maxTurns`. A run is one submitted user message: the runtime hands this value to the SDK
 * query for that message (apps/runtime/conversation-runner.mjs, apps/worker/conversation/options.mjs), so long research jobs need
 * room here while spend stays bounded by the per-run budget and the tenant monthly cap. Tenant settings, run admission, the
 * runtime options, the usage overview schema and migration 0032 all read this one constant; no literal copy may remain. */
export const MAX_RUN_TURNS=1000;
