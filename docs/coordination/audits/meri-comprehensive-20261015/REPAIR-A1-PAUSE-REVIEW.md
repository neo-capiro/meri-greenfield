# Independent review: A1 / L1 pause checkpoint repair

Reviewed 15 October 2026. Repository: neo-capiro/meri-greenfield. Scope: the targeted L1 repair, its output fence, checkpoint-versus-failure exit, and affected store/writer checks.

## Decision

**HOLD for complete L1 source closure.** The intended race repair is present and independently behaves correctly in immediate-response probes. However, the required explicit terminal-failure fallback still silently abandons a held-running row when its publication exceeds the inherited 30 ms per-attempt cutoff. This is an inherited defect exposed by the new fallback, not a claim that the branch introduced the cutoff.

**Integration/live acceptance remains HOLD and unverified separately.** No deployment or remote-machine work was performed. The positive source findings are worth retaining; this review does not request reverting the repair or redesigning the lifecycle.

- Exact reviewed commit: [3dceab531ed5cbc59289122f04eb1500064e8b38](https://github.com/neo-capiro/meri-greenfield/commit/3dceab531ed5cbc59289122f04eb1500064e8b38)
- Branch supplied: fable/a1-pause-checkpoint-20261015
- GitHub compare: three commits ahead, zero behind [base ff52b9ea0cfb5c0280ea95baea6396554a6eed7d](https://github.com/neo-capiro/meri-greenfield/compare/ff52b9ea0cfb5c0280ea95baea6396554a6eed7d...3dceab531ed5cbc59289122f04eb1500064e8b38); 14 changed files
- No GitHub Actions workflow runs were returned for this exact commit by the connector.
- Review baseline: [the comprehensive audit](https://github.com/neo-capiro/meri-greenfield/tree/82a015083f1965851ffddbc05d4f181bb90ecac2/docs/coordination/audits/meri-comprehensive-20261015). Other audit lanes were not repeated.

## Tested good corrections

1. **The refusal race now fences output and asks the lifecycle owner to settle the hold.** A failed display publication calls fence; remaining parts/frames are suppressed. The control reader does not depend on a RUN_HELD transport code. It wakes immediately, validates the command envelope, claims once, and uses the existing capture/record path. A fresh empty control read fails instead of inventing a pause. See [activity lines 47–60](https://github.com/neo-capiro/meri-greenfield/blob/3dceab531ed5cbc59289122f04eb1500064e8b38/apps/worker/conversation/activity.mjs#L47-L60), [reader lines 27–58](https://github.com/neo-capiro/meri-greenfield/blob/3dceab531ed5cbc59289122f04eb1500064e8b38/apps/worker/conversation/continuation/activity-lifecycle.mjs#L27-L58), and [fence/finish lines 76–100](https://github.com/neo-capiro/meri-greenfield/blob/3dceab531ed5cbc59289122f04eb1500064e8b38/apps/worker/conversation/continuation/activity-lifecycle.mjs#L76-L100).

   Independent pause and approval.wait probes each produced one claim, one capture, APPLIED control and one checkpoint. Only text published before the committed hold survived. Final states were paused and waiting-for-approval respectively.

2. **The store's failure escape is narrow and transaction-owned.** Ordinary output and generic terminal publication remain fenced. Only run.status/failed/HOLD_CHECKPOINT_FAILED takes the new escape, and the journal verifies the exact binding, pause/approval.wait intent, unapplied control state, absence of checkpoint proof and running state. It changes the control to UNKNOWN in the same locked transaction as the event/run update. See [append gate lines 35–49](https://github.com/neo-capiro/meri-greenfield/blob/3dceab531ed5cbc59289122f04eb1500064e8b38/apps/control/conversations/postgres-store.mjs#L35-L49) and [journal lines 42–48](https://github.com/neo-capiro/meri-greenfield/blob/3dceab531ed5cbc59289122f04eb1500064e8b38/apps/control/conversations/lifecycle/journal.mjs#L42-L48).

   Independent checks confirmed refusal without a hold, refusal for a stale writer fence, no overwrite of an applied paused checkpoint, exact replay of the same failure event, and refusal of a fresh second terminal event.

3. **Immediate capture failure and the completion-window race now have a real explicit failure path.** Without added latency, the captured-hold failure ended failed/UNKNOWN/no checkpoint, and a pause committed during completed publication ended failed/UNKNOWN/no checkpoint with zero claims. The worker orders ordinary-versus-hold failure attempts from local state but delegates admission to the durable store. See [activity lines 61–69](https://github.com/neo-capiro/meri-greenfield/blob/3dceab531ed5cbc59289122f04eb1500064e8b38/apps/worker/conversation/activity.mjs#L61-L69).

## Remaining blocking finding

### P1 / L1 residual: terminal fallback can still close the SDK and leave an unsettled held-running row

**Exact source:** [activity lines 66–69](https://github.com/neo-capiro/meri-greenfield/blob/3dceab531ed5cbc59289122f04eb1500064e8b38/apps/worker/conversation/activity.mjs#L66-L69).

Each terminal attempt gets only now()+30 ms. A failure or timeout is reduced to false; the activity tries the other semantic event once, then throws EXECUTION_FAILED/EXECUTION_STOPPED regardless of whether either terminal write was acknowledged. The lifetime races work against cancellation and checks after completion: [operation-lifetime lines 31–49](https://github.com/neo-capiro/meri-greenfield/blob/3dceab531ed5cbc59289122f04eb1500064e8b38/packages/runtime/operation-lifetime.mjs#L31-L49). The real service publish forwards that signal into its operation and locked append: [service line 57](https://github.com/neo-capiro/meri-greenfield/blob/3dceab531ed5cbc59289122f04eb1500064e8b38/apps/control/conversations/service.mjs#L57), [store transaction lines 11–16](https://github.com/neo-capiro/meri-greenfield/blob/3dceab531ed5cbc59289122f04eb1500064e8b38/apps/control/conversations/postgres-store.mjs#L11-L16).

**Independent reproduction:** add a 45 ms delay before each terminal append, leave reads/claims/normal publication unchanged, then honor the supplied abort signal before entering the actual store. This simulates bounded processing/transport latency, not a permanently unavailable database. Both attempts expire before reaching the durable transition.

| Scenario | Activity outcome | Durable run | Control | Checkpoints | SDK |
|---|---|---|---|---|---|
| Capture refusal after a claimed pause; 45 ms terminal delay | EXECUTION_FAILED | running | UNKNOWN | 0 | closed once |
| Pause commits in completed-publication window; 45 ms terminal delay | EXECUTION_FAILED | running | PENDING | 0 | closed |

First trace: starting → running → pre-hold message → RUN_HELD on racing message → HOLD_CHECKPOINT_FAILED append cancelled → ordinary EXECUTION_FAILED append cancelled.

Second trace: starting → running → completed append RUN_HELD → ordinary EXECUTION_FAILED append cancelled → HOLD_CHECKPOINT_FAILED append cancelled.

Both defects reproduced in two independent executions of the probe script. Waiting beyond both delayed calls did not change the durable state. No output crossed the hold, so the confidentiality/publication fence remained intact; the defect is failure settlement/liveness.

The 30 ms cutoff existed at [base activity lines 57–60](https://github.com/neo-capiro/meri-greenfield/blob/ff52b9ea0cfb5c0280ea95baea6396554a6eed7d/apps/worker/conversation/activity.mjs#L57-L60). Fable explicitly discloses it in [report line 58](https://github.com/neo-capiro/meri-greenfield/blob/3dceab531ed5cbc59289122f04eb1500064e8b38/docs/coordination/reports/FABLE-L1-PAUSE-CHECKPOINT-20261015.md#L58). That disclosure is accurate, but deferring this exit does not satisfy L1's “checkpoint or explicit terminal failure; no held-running row” acceptance condition. This is a confirmed reachable source residual, not an assertion about observed live latency or a new broad crash-recovery audit.

## Smallest necessary follow-up

1. Keep the current fence/store repair. Make the terminal failure exit acknowledged or durably reconcilable through the canonical owner. Replace the arbitrary 30 ms cutoff with a justified finite cleanup/publication bound; preserve uncertainty if commit/cleanup cannot be established. Merely increasing the timeout is not proof of settlement under lost acknowledgments. Do not add an unbounded wait or claim physical stop from an activity exception.
2. Add focused regression cases for terminal latency above 30 ms in both claimed checkpoint failure and unclaimed completion-window hold; also verify an ambiguous terminal acknowledgment can be read back/reconciled idempotently without reopening output, duplicating effects or overwriting an applied checkpoint. Keep the same exact-binding/writer checks.
3. Return one immutable corrective commit and rerun the affected composition/worker/runner checks. Recheck actual PostgreSQL composition when the authorized existing database is available. No new contract, migration, broad lifecycle redesign or deployment is required by this review.

Named reason-code centralization and a new runtime operation were author proposals; neither is demanded here. Existing full integration/native/Temporal and L4 recovery gates remain separate.

## Verification: independent versus author-reported

### Independently executed here

- Node v24.19.0.
- Syntax checks: 22 materialized .mjs files passed node --check.
- Ten targeted source-extracted synthetic probes: all ten assertions passed in two final executions. Eight assert intended protections/outcomes; **two assert the remaining held-running defects**, so this is not a product acceptance pass.
- Function bodies from the pinned worker activity, lifecycle reader, SDK command adapter, native receipt checks, operation lifetime, store and lifecycle journal were used unchanged. Import/export declarations were stripped for isolated execution. The pinned repository's scripted PostgreSQL protocol fixture supplied transactional rows.
- Contract/schema assertions, hashing adapter, unrelated skill/capability construction, SDK transport and native capture provenance were substitutes. This is control-flow/store-fencing evidence, not a full authentic-contract, service-authentication, PostgreSQL-server or live SDK qualification.
- No package installation, migration, PostgreSQL server, remote runtime, provider call, Temporal service, production write, repository edit/push or deployment was performed. Standard suite execution was not claimed; required dependencies including ajv, canonicalize, pg and the Claude Agent SDK were absent.
- The first local probe launch hit an extractor parameter-name collision before product code ran. The harness was corrected and the two final executions passed; this was not a repository failure.

Probe artifacts in the shared review workspace: a1-pause-review/probe.mjs, probe-results.json and probe-output.jsonl. The latter contains both exact defect traces.

### Author-reported, source inspected but not independently rerun here

The [committed author report lines 33–45](https://github.com/neo-capiro/meri-greenfield/blob/3dceab531ed5cbc59289122f04eb1500064e8b38/docs/coordination/reports/FABLE-L1-PAUSE-CHECKPOINT-20261015.md#L33-L45) records:

- 8/8 scripted hold-composition plus 5/5 scripted store-rule tests (the reported 13/13 hold total)
- 8/8 actual PostgreSQL 16 composition tests against the existing already-migrated database, unique tenants, no truncation/migration; repeated five times alongside the scripted suite; 14/14 store-PG tests
- 147/147 worker tests
- 7/7 runtime process tests
- Reverted-fix checks described for each new/changed test group
- Control typecheck clean; full control/runtime suites still include disclosed environment-dependent and timing-sensitive failures
- Live SDK interrupt/native capture and Temporal/worker-loss replay unrun

The author scenarios explicitly script SDK transport/native capture even in the PostgreSQL variant: [PG test lines 1–11](https://github.com/neo-capiro/meri-greenfield/blob/3dceab531ed5cbc59289122f04eb1500064e8b38/apps/control/conversations/test/lifecycle-hold-composition-pg.test.mjs#L1-L11), [shared harness lines 1–25](https://github.com/neo-capiro/meri-greenfield/blob/3dceab531ed5cbc59289122f04eb1500064e8b38/apps/control/conversations/test/lifecycle-hold-harness.mjs#L1-L25). Their baseline terminal outcomes are meaningful, but they do not test the delayed terminal publication reproduced above.

## Acceptance boundary

- Targeted source correction: positive independent evidence for race fencing and the narrow transactional failure escape.
- Complete L1 source acceptance: **HOLD**, for the single reproduced terminal-settlement residual.
- Authenticated integrated candidate, actual native/SDK checkpoint behavior, Temporal failure/recovery, deployment and live product acceptance: **unverified/HOLD independently**.

