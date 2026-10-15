# Package 3 lifecycle source review

## Result

- **L1 terminal-settlement repair: ACCEPT, scoped to source and the independent scripted probes below.** Both retained 45 ms counterexamples are corrected; a lost terminal acknowledgement replays the same event ID; an exhausted publication budget has a retirement-gated reconciliation path. This is not an unconditional availability or live-recovery qualification.
- **L4 crash recovery / Stop → next prompt: HOLD.** Two bounded lifecycle gaps remain: a restarted control process cannot reconstruct a stop-only retirement owner; and a failed/cancelled run that never acquired an allocation has no next-prompt admission path. Both fail closed, but prevent recovery.
- **Integration/live acceptance remains unverified.** No whole-package verdict is given here. Fable owns implementation. Owner proposals and reported decisions are not treated as user approval.

## Immutable scope and comparison

Reviewed `neo-capiro/meri-greenfield`, branch `fable/repair-package-3-20261015`, resolved via GitHub to **`81e20025b7a805ac28a44f2044df87b0ebab905b`**. [Pinned commit](https://github.com/neo-capiro/meri-greenfield/commit/81e20025b7a805ac28a44f2044df87b0ebab905b).

Compared against package 2 **`69040f9b4ab2d239bec1a057354d578d2bf24b1e`**: package 3 is 41 commits ahead, zero behind. [Immutable comparison](https://github.com/neo-capiro/meri-greenfield/compare/69040f9b4ab2d239bec1a057354d578d2bf24b1e...81e20025b7a805ac28a44f2044df87b0ebab905b). Scope is the previously retained L1 settlement defect and new L4 recovery, not a repeat of the full audit. Read the [integrated package report](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/docs/coordination/reports/FABLE-REPAIR-PACKAGE-3-20261015.md).

## L1: corrected and independently checked

1. The worker now defaults to **3,000 ms per terminal attempt**, with at most two rounds over the same two candidate events (at most 12 seconds at the default). Event IDs and creation time are allocated once, outside the retry loop. ACK ends settlement; a committed write with a lost ACK can be recognized by exact idempotent replay. This replaces the old 30 ms deadline without removing finite bounds. [activity.mjs L21–25](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/worker/conversation/activity.mjs#L21-L25), [L71–83](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/worker/conversation/activity.mjs#L71-L83).
2. Both original **45 ms** cases now end `failed` with an `UNKNOWN` hold and no checkpoint: capture failure after claiming the pause, and a pause arriving in the completion-publication window before claim. The first also closed the SDK once. The earlier package left these `running/UNKNOWN` and `running/PENDING`, respectively.
3. Lost ACK after committing hold failure produced **one durable terminal event**, and the retry reused its ID. In the separate bounded-exhaustion case (20 ms configured attempts, 60 ms synthetic latency), four unacknowledged attempts left `running/PENDING`; explicit reconciliation then retired the original before settling `failed/HOLD_CHECKPOINT_FAILED`.
4. For an existing allocation, reconciliation trusts journaled `RETIRED` plus `physicalStopProven`, not just the stop port's return. Throwing or unproven retirement wrote no terminal; an applied checkpoint remained paused; stale writers could not use the hold-failure escape. The reconciler rereads state after failed writes so a committed terminal/checkpoint wins. [run-reconciler.mjs L11–42](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/control/conversations/run-reconciler.mjs#L11-L42).

The source also deliberately handles an initially absent allocation by terminalizing, then rereading allocation to catch a concurrent earlier claim; later claims require `queued`. This is a distinct ordering path, not proof that an absent row always means physical safety. It is involved in L4-2 below.

## L4 remaining source gaps and smallest follow-ups

### L4-1: hard control restart has no stop-only recovery owner

**Observed:** with an existing `ALLOCATED` journal row and a fresh lazy controller with no in-memory controller, actual kickoff `stop()` returned `KICKOFF_UNKNOWN` twice. The close port ran once because close is memoized; allocation was never called; the run stayed `running` and the allocation stayed `ALLOCATED`.

This matches the source: candidate `lazy.close()` only closes `controller?`; registry `closeController()` succeeds without doing anything when controller is absent. The restart stop route reconstructs an entry without allocation, which preserves the no-redispatch rule but leaves no physical-stop owner. Kickoff reconciliation delegates retirement to that same memoized close. [candidate L48–51](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/runtime/prepared-candidate.mjs#L48-L51), [registry L42–50](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/runtime/prepared-run-registry.mjs#L42-L50), [registry L77–80](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/runtime/prepared-run-registry.mjs#L77-L80), [kickoff L28–38](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/runtime/native-authority/prepared-kickoff.mjs#L28-L38).

The author explicitly discloses this gap and a stop-only proposal. [L4 report L150–153](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/docs/coordination/reports/FABLE-L4-RECOVERY-20261015.md#L150-L153).

**Smallest necessary follow-up:** reconstruct a bounded, stop-only original retirement owner from durable exact-binding allocation/issuance facts when the process has no controller. It must never call allocation, dispatch, resume, or release; retain physical-stop and grant-revocation evidence, old-attempt fencing, idempotence, and UNKNOWN on uncertain cleanup. Add restart tests with a durable existing allocation, a fresh process/controller, failed/lost stop ACKs and repeated recovery. Also identify a durable retry/re-entry path if the workflow's finite reconciliation budget expires; its current catch discards reconciliation failure and rethrows the original failure. [recovery-workflow.ts L7–14](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/control/conversations/recovery-workflow.ts#L7-L14). Do not solve this by extending an arbitrary deadline or pretending cleanup succeeded.

### L4-2: failure or Stop before allocation cannot admit the next prompt

**Observed, two independent scenarios:**

- Queued run, no allocation row: reconciliation settled `failed/ATTEMPT_LOST` without invoking retirement. Next-prompt selection failed `NEXT_RUN_RETIREMENT_REQUIRED`; trying to claim an allocation afterward failed `NATIVE_PREPARATION_STATE_REFUSED`.
- Queued run, no allocation row, permitted Stop transition to `cancelled/USER_CANCELLED`: next-prompt selection and later claim failed with those same codes.

The current admission path requires exactly one `RETIRED` allocation with physical-stop evidence even for failed/cancelled sources. A terminal source cannot create the missing allocation, and allocation record updates require an existing record. Thus these cases are blocked through the current admission paths. [next-run.mjs L16–21](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/control/conversations/next-run.mjs#L16-L21), [next-run-journal.mjs L32–42](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/control/conversations/next-run-journal.mjs#L32-L42), [native-preparation-journal.mjs L84–99](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/control/conversations/native-preparation-journal.mjs#L84-L99).

The author's queued-cancel test does not cover no allocation: its `first()` helper allocates before cancellation. [next-run-recovery.test.mjs L24–36](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/control/conversations/test/next-run-recovery.test.mjs#L24-L36). The author report itself records missing allocation as a refusal case. [L4 report L61–67](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/docs/coordination/reports/FABLE-L4-RECOVERY-20261015.md#L61-L67).

**Smallest necessary follow-up:** introduce a trusted, explicit no-dispatch/absent-allocation evidence path for a terminal source that never acquired external authority, and allow next-prompt admission on that proof under the same conversation fence. Prove claim/terminal exclusion and disposition of any issued grants. If a claim or authority exists, continue requiring retirement plus revocation. **Never weaken admission to “missing allocation row means safe.”** Add both no-allocation scenarios plus a claim-versus-terminal race; retain the existing unknown-retirement refusal tests.

## L4 good behavior retained

For both failed and cancelled sources with an allocation, independent probes verified refusal before retirement and revocation, a single reservation across three concurrent selections, exact accepted-request replay, rejection of a different prompt, a sealed old sequence range, and `null` next-turn lineage. The runtime composition separately checks exact allocation/grant IDs and a proven revocation receipt. [prepared-next-run.mjs L9–13](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/runtime/prepared-next-run.mjs#L9-L13).

Fresh SDK session is verified; **previous model context is not restored**. Durable conversation sequence/history retention is a different claim from feeding past turns into the model. The source returns no lineage for these successors and the author states the context limitation. [next-run-journal.mjs L81–88](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/apps/control/conversations/next-run-journal.mjs#L81-L88), [L4 report L72–77](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/docs/coordination/reports/FABLE-L4-RECOVERY-20261015.md#L72-L77).

## Independent evidence and limits

Local evidence directory: `package3-lifecycle-review/` beside this report. No product edits were made.

- `node recovery-probe.mjs` completed successfully: **19 test scenarios**, comprising 16 good-behavior checks and **3 successful reproductions of the two L4 gaps**. Exact list/results: `recovery-probe-results.json`; transcript: `recovery-probe-output.jsonl`. The two 45 ms counterexamples and lost ACK case are included. The final 19-scenario suite ran once; earlier narrower runs also completed.
- `node --check` passed for all **24 materialized `.mjs` files**.
- Node **24.19.0**. Probes extract and execute pinned function bodies with dependency injection. Worker activity, lifecycle/journal, store, reconciler, native-preparation and next-run logic are exercised against the repository's **scripted SQL protocol fixture**, not PostgreSQL. SDK transport/capture, retirement/revocation ports, some schema assertions and unrelated capabilities are synthetic. Hash adapter uses SHA-256 of JSON serialization rather than production canonicalization. Hard-restart probe uses actual kickoff/reconciler with a synthetic no-controller close port matching the inspected lazy-close behavior; it is not a real process-kill test. The Stop-before-allocation probe directly appends the allowed cancelled transition, not the HTTP cancel route.
- These probes do not establish real SQL concurrency/rollback semantics, authentication transport, provider behavior, actual grant revocation, SDK cleanup, Temporal replay or ECS physical stop. No provider/cloud operations, migrations, installation, deployment, or blocked P2b probes were attempted.

**Author evidence, not independently rerun here:** integrated 41/41 focused control plus typecheck, 66/66 focused runtime and 266/266 worker. Full runtime is **221/228**; the author labels seven failures environmental, which this review has not established. [package report L31–42](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/docs/coordination/reports/FABLE-REPAIR-PACKAGE-3-20261015.md#L31-L42). The report explicitly leaves real PostgreSQL, Temporal worker-kill/replay, ECS stop/revocation, SDK/provider and image closure unrun. [L60](https://github.com/neo-capiro/meri-greenfield/blob/81e20025b7a805ac28a44f2044df87b0ebab905b/docs/coordination/reports/FABLE-REPAIR-PACKAGE-3-20261015.md#L60). The two-minute recovery target is a timeout-budget model, not measured recovery evidence.

## Acceptance boundary

Accept the specific L1 source correction at this immutable pin. Keep L4 end-to-end recovery on HOLD pending the two small owner repairs and their exact regression scenarios. Preserve finite timeouts and honest uncertain-cleanup states. Source checks and scripted probes do not remove integration/live gates, and do not authorize proposals or deployment.
