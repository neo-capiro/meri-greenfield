# Package two lifecycle re-review

## Decision

**L1 terminal-settlement source acceptance remains HOLD at [69040f9b4ab2d239bec1a057354d578d2bf24b1e](https://github.com/neo-capiro/meri-greenfield/commit/69040f9b4ab2d239bec1a057354d578d2bf24b1e).** The integrated package contains the earlier pause/checkpoint repair unchanged; it does not repair the independently demonstrated 30 ms terminal-publication failure. Both delayed-publication cases reproduce on the integrated-pin files.

This is a focused delta review against 3dceab531ed5cbc59289122f04eb1500064e8b38. It does not re-audit other lanes or grant whole-package, deployment or live acceptance. Existing positive evidence for output fencing and the narrow hold-failure transaction remains valid.

## Exact pin and integration delta

- Repository/branch: neo-capiro/meri-greenfield, fable/repair-package-2-20261015.
- Resolved immutable head: **69040f9b4ab2d239bec1a057354d578d2bf24b1e**.
- [GitHub comparison to the reviewed L1 pin](https://github.com/neo-capiro/meri-greenfield/compare/3dceab531ed5cbc59289122f04eb1500064e8b38...69040f9b4ab2d239bec1a057354d578d2bf24b1e): ahead by 54 commits, behind by zero; 197 changed files returned.
- The package [composition table explicitly selects the same L1 lane pin](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/docs/coordination/reports/FABLE-REPAIR-PACKAGE-2-20261015.md#L7-L18).
- Fresh GitHub reads at the integrated SHA are byte-identical to the prior materialized L1 files for 13 relevant source/test/dependency files. These include activity.mjs, activity-lifecycle.mjs, postgres-store.mjs, lifecycle/journal.mjs, operation-lifetime.mjs, service.mjs, boundary.mjs, the command/input/receipt modules, store fixture and hold harness/failure tests. No L1 repair or delayed-terminal regression was added.
- The integration also changes the broker to prepared-only cleanup with an independent 3-second stop deadline: [temporal-worker lines 13–29](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/apps/runtime/temporal-worker.mjs#L13-L29). That concerns original native cleanup (L5); this worker's terminal-publication path and durable conversation state transition are unchanged. Physical cleanup and acknowledged conversation terminalization remain distinct.

## Blocking residual, independently reproduced again

At [activity.mjs lines 66–69](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/apps/worker/conversation/activity.mjs#L66-L69), each terminal append receives now()+30 ms. Any rejection/timeout becomes false. The worker tries the other terminal reason once, then exits with EXECUTION_FAILED/EXECUTION_STOPPED without proving either durable terminal transition.

The lifetime actually aborts work at its deadline: [operation-lifetime lines 31–49](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/packages/runtime/operation-lifetime.mjs#L31-L49). The service propagates that abort signal into append: [service line 57](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/apps/control/conversations/service.mjs#L57). The hold gate and journal verifier remain correctly restrictive: [store lines 35–49](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/apps/control/conversations/postgres-store.mjs#L35-L49), [journal lines 42–48](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/apps/control/conversations/lifecycle/journal.mjs#L42-L48).

A controlled 45 ms delay before terminal append, honoring the supplied abort signal, reproduces:

| Case | Activity result | Durable run | Control | Checkpoints |
|---|---|---|---|---|
| Native capture refuses after pause claim | EXECUTION_FAILED | running | UNKNOWN | 0 |
| Pause commits during completed publication, after the reader stops | EXECUTION_FAILED | running | PENDING | 0 |

The SDK closes, both terminal attempts abort, and waiting beyond the delayed calls leaves those durable states unchanged. This is bounded simulated processing/transport latency, not a measured live outage. No post-hold output crosses the fence.

The inherited cutoff is already disclosed in the unchanged [L1 report residual-risk paragraph](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/docs/coordination/reports/FABLE-L1-PAUSE-CHECKPOINT-20261015.md#L57-L60). Inclusion of that lane in the integrated package does not close the residual.

### Positive checks retained

- Pause and approval.wait read/append races checkpoint once, leave APPLIED controls and suppress subsequent output.
- Immediate capture failure and immediate completion-window hold failure settle failed/UNKNOWN.
- Hold-failure reason is refused without a hold.
- Applied paused checkpoint cannot be overwritten.
- Same failure event replays exactly; a fresh second terminal event is refused.
- Stale writer cannot take the special hold-failure escape.

## Smallest necessary follow-up

Retain the current race fence and transactional escape. Make the failure exit acknowledged or durably reconcilable through its existing canonical owner, with a justified finite cleanup/publication bound rather than the arbitrary 30 ms cutoff. Preserve uncertain cleanup/commit semantics, exact writer/binding fences, idempotency and applied-checkpoint protection. Do not substitute an unbounded wait or physical-stop assertion.

Add focused regression coverage for terminal latency above 30 ms in both cases above and for a lost/ambiguous terminal acknowledgment with safe readback/reconciliation. Return an immutable corrective pin and rerun the affected worker/composition/runner checks. No broad redesign, new migration, AWS work or deployment is requested by this finding.

## Checks and evidence boundaries

**Independent, executed against freshly fetched integrated-pin bodies:**

- Node v24.19.0.
- 14 materialized .mjs files passed node --check.
- Ten focused source-extracted scripted-SQL probes ran successfully. Eight assert intended protections; two assert the reproduced defects. Thus ten successful probe assertions are **not** product acceptance.
- Actual pinned activity/lifecycle/journal/store/lifetime function bodies were used after stripping import/export syntax. The repository's scripted PostgreSQL protocol fixture supplied rows; schema/hash adapters and unrelated capability/skill ports were substitutes. SDK transport and native capture were synthetic.
- Probe run and source-equality evidence are retained under package2-lifecycle-review: probe.mjs, probe-output.jsonl, probe-results.json and source-comparison.json.

**Author-reported integrated results, not independently rerun here:**

The [package report](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/docs/coordination/reports/FABLE-REPAIR-PACKAGE-2-20261015.md#L26-L48) records 236/236 worker, 13/13 synthetic control-hold tests, and other lane checks. It also explicitly reports full runtime 189/196 with seven environmental failures, and full control conversations 188/195 with seven PostgreSQL files requiring database variables. Those are qualified author reports, not a clean independently verified integrated-suite pass.

The earlier lane's 8/8 actual PostgreSQL tests remain author evidence; this re-review did not run PostgreSQL, migrations, native capture, live SDK, Temporal replay or ECS cleanup. The package itself labels those live gates unrun: [lines 61–63](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/docs/coordination/reports/FABLE-REPAIR-PACKAGE-2-20261015.md#L61-L63).

No product implementation, repository writes/pushes, remote-machine work, AWS action or deployment occurred.

## Scope/authorization handling

The owner-decisions report is treated as **a proposal/record needing owner verification, not authorization**. Its four advanced-feature deferrals are explicitly still awaiting confirmation, and its assertion that 96 capabilities plus 14 skills replaces legacy parity must not be adopted as a confirmed user scope change: [owner report lines 8–16](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/docs/coordination/reports/FABLE-OWNER-DECISIONS-20261015.md#L8-L16), [lines 25–31](https://github.com/neo-capiro/meri-greenfield/blob/69040f9b4ab2d239bec1a057354d578d2bf24b1e/docs/coordination/reports/FABLE-OWNER-DECISIONS-20261015.md#L25-L31).

Per the current user context, those four deferrals and the recommended replacement scope have not been confirmed. This review neither enters D015 nor interprets the document's “Decisions” heading as permission. No gate is lowered on that basis.

## Acceptance boundary

- Earlier targeted race/store correction: positive source evidence retained.
- **L1 complete terminal-settlement source closure: HOLD, unchanged.**
- Whole integrated package: outside this lane's acceptance authority.
- Authenticated/native/SDK/Temporal and live/deployment acceptance: unverified and separately HOLD.

