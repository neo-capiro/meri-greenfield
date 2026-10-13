# Second exact lifecycle checkpoint — HOLD

At `492c945547bd56e8471d3b65c7901114eb514791`, tree `ec2e6337dde90650c68728b92ab56223598ce95d`, the original seven independent counterexamples now pass without changing their assertions. All 46 author regressions pass. Those 53 distinct passing controls retain exact raw captures under `repaired-seven.*` and `repaired-owner46.*`.

Four further concrete edges remain **HOLD**:

1. Cancellation reads an authorized original run, then its stored scopes/policy change before locked append. Cancellation omits the publisher's `expectedScopes` guard and succeeds, advancing events 1→2 under the changed resource. Apply the same current-scope guard at cancellation's locked append.
2. Exact fiscal request replay reconstructs over the same store with fiscal configuration absent. Submission throws `fiscal_window_unavailable` before selecting the retained request. Preserve the existing immutable normalization without re-resolving it first; still bind the full original requested specification and current authorization.
3. The exact normalized requested window is persisted, but SDK prompt/system input receives neither its start, end nor timezone. Forward retained typed window context as data into the existing single query; this is required wiring of the accepted resolver, not a new model loop.
4. A successful SDK stream's `close()` throws a synthetic private provider diagnostic. The activity rejects that raw message from `finally`, while durable run state is completed. Preserve completed provenance and translate cleanup failure to a content-free disposition, with no rollback or automatic retry.

`repaired-edge.*` retains the first three failing cases. `repaired-edge-four.*` retains all four: 0/4 pass, exit 1, no timeout, process reaped, group absent. All input is synthetic and no provider/DB/cloud call ran. `repaired-edge.test.mjs` adds the four assertions; the original seven-case `independent.test.mjs` remains byte-identical to its initial HOLD commit. Implementation files are untouched by this reviewer.

The implementation owner has the exact paths for replay and is repairing the source. Native identity/worker/database/Temporal/model-proxy/source/UI qualification, steer/fork and verified checkpoint resume remain outside this bounded first-request source acceptance; no whole W05 closure follows.
