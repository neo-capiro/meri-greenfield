# Fable lane l1-pause-checkpoint — 15 October 2026

Branch `fable/a1-pause-checkpoint-20261015`, base `ff52b9ea` (corrected P1a pin containing shared candidate `ba40647`). Closes audit finding **L1** (lifecycle-report.md, "Pause can close the SDK without capturing a checkpoint, leaving the run held and running"), including the same `approval.wait` hold mechanism. No deployment, cloud, credential, model/provider, migration or lockfile action. No contract file changed.

## Implementation outline (recorded before the change)
- **Responsibilities and owners.** The control store/lifecycle journal keeps the durable publication fence and arbitrates what a held run may record. The worker lifecycle reader (`continuation/activity-lifecycle.mjs`) owns the worker's hold transition. The activity (`activity.mjs`) only routes refused publications to that owner and publishes the terminal event. The Claude Agent SDK loop, Temporal and the native capture owners are unchanged.
- **Interfaces.** No new port and no `runtime-0.2` operation, since that contract is frozen. The remote runner maps every native refusal to `NATIVE_UNAVAILABLE`, so the worker cannot trust a `RUN_HELD` code. Instead it confirms the hold through the existing `nextControls`/`claimControl` reads. The only explicit-failure channel is the existing `publish` port, carrying `run.status failed` with reasonCode `HOLD_CHECKPOINT_FAILED`. The frozen UIEvent contract already allows any non-empty reasonCode.
- **State and failure ownership.** The store admits that event only for this running run's unapplied (`PENDING`/`DISPATCHING`/`UNKNOWN`, no proof) pause/approval.wait hold. In the same locked transaction it turns the control into the `UNKNOWN` barrier. It refuses the reason code when the run holds no control. A checkpointed (`paused`/`waiting-for-approval`) or terminal run refuses it through the existing state machine.
- **Reuse.** Existing claim, checkpoint and record path; existing `ackControl` UNKNOWN barrier; existing scripted SQL fixture and lifecycle fixture, now accepting an optional pool and binding.
- **Verification.** Actual service/store/activity composition over the scripted SQL fixture and over the owned, already-migrated PostgreSQL 16 schema. Reverted-fix proof for each new or changed test.

## What changed
- `apps/control/conversations/lifecycle/journal.mjs`: `HOLD_CHECKPOINT_FAILED` and `failUncheckpointedHold(c,b,r,check)`. This is an in-transaction verifier that sets the control to UNKNOWN; it never opens a nested transaction.
- `apps/control/conversations/postgres-store.mjs`: the publication fence is unchanged for all output. Its single worker exit is the verified hold failure. The journal is now constructed before the store object, with identical arguments.
- `apps/worker/conversation/continuation/activity-lifecycle.mjs`: `fence()`. After a refused publication it suppresses output and triggers an immediate control read without the idle wait. A pending hold is claimed once and finished through the existing verified checkpoint. A read that starts after the refusal and finds no hold fails with `HOLD_CONTROL_MISSING`, so a non-hold refusal remains an execution failure. A fence that is still open when the reader stops rejects the held result. `isHeld()` now includes the fenced state, and completion capture refuses while fenced.
- `apps/worker/conversation/activity.mjs`: a refused display publication goes to `fence()`, and remaining parts and frames are suppressed. The failure path publishes up to two terminal attempts, ordered by the local hold view: the ordinary failed/cancelled event and the `HOLD_CHECKPOINT_FAILED` failure. The durable owner admits exactly the one that is true. Before this change the activity skipped the terminal event whenever it was locally held, which caused the silent held-running row.
- `apps/control/conversations/lifecycle/README.md`: documents the hold exit.

## Interleavings and results
Acceptance invariants are asserted in every scenario (`assertHoldSettled`): no output after the hold, at most one claim, no control input sent to the SDK, the row never left `running`, and either a verified checkpoint (`checkpoint.verified` followed by paused or waiting-for-approval, control `APPLIED`) or an explicit `HOLD_CHECKPOINT_FAILED` failure (control `UNKNOWN`, no checkpoint row).

| Scenario | Outcome |
|---|---|
| Pause before the poll response: the read is in flight, the hold commits, the next SDK text is refused | paused through checkpoint; 1 claim, 1 refused delta, later text suppressed |
| approval.wait, same race | waiting-for-approval through checkpoint |
| Between claim and append: claim is durable, worker not yet told, text refused | paused; 1 claim |
| Between claim and append: an append in flight when the local hold transition starts | refusal absorbed; paused; no failure event |
| During completion: pause commits between the result and the `completed` publication | explicit `HOLD_CHECKPOINT_FAILED`; 0 claims |
| During completion capture (synthetic capture refusal standing in for `COMPLETION_STATE_REFUSED`) | explicit `HOLD_CHECKPOINT_FAILED` |
| During checkpoint failure: native capture refuses after the claimed pause | explicit `HOLD_CHECKPOINT_FAILED`; control UNKNOWN; 1 claim |
| Control case: refused publication with no hold | ordinary `EXECUTION_FAILED`; no hold |

## Tests (all labelled; counts as observed)
- `apps/control/conversations/test/lifecycle-hold-composition.test.mjs` (synthetic, scripted SQL protocol fixture): 8/8 pass. Revert proof: 0/8 pass.
- `apps/control/conversations/test/lifecycle-hold-composition-pg.test.mjs` (actual PostgreSQL 16 on the existing owned socket `meri_inspection_final`; unique tenant per test, no truncation, no migration run): 8/8 pass, 5 repeat runs together with the synthetic suite each 16/16. Revert proof: 0/8 pass. `store-pg.test.mjs` on the same database with the store change: 14/14 pass.
- `apps/control/conversations/test/lifecycle-hold-failure.test.mjs` (synthetic store rules: reason code refused without a hold; unclaimed and claimed hold produce UNKNOWN, idempotent replay, no redelivery, no later checkpoint; an applied hold refuses; a mismatched hold refuses): 5/5 pass. Revert proof: 3 fail; the 2 characterization cases (applied, mismatched) pass on both.
- `apps/worker/conversation`: 146 tests become 147, all pass. The new code-independent fence test uses `NATIVE_UNAVAILABLE` refusals. Eight native-capture substitution tests and the checkpoint-record refusal test previously asserted that no terminal event was written, which is the defect. They now assert the explicit hold failure, alongside their existing no-record and UNKNOWN assertions. Revert proof: 10 fail.
- `apps/runtime/test/process.test.mjs`: "actual runner native capture refusal…" previously asserted `history.run.state==='running'`, the L1 end state through the real remote runner and native forwarding. It now asserts `failed` with `HOLD_CHECKPOINT_FAILED`. It was run as uid `nobody` with the ambient AWS variables and the extra CA cert variable removed from the child environment, because these tests refuse root and ambient credentials: 7/7 pass. Revert proof: fails with actual `running`.
- Full control suite: 265 tests. Remaining failures are environmental: the PostgreSQL files without the database variables (including the new PG file), and `native-preparation.test.mjs` (needs an explicit source root; fails identically at base). `lifecycle-transition.test.mjs` "parked … shorter deadline" (220 ms windows) failed 1–2 times in several full-suite runs on the loaded 4-core host. It passes alone 3/3. Under six parallel copies it fails at base and with the fix alike, so it is a pre-existing timing sensitivity, not caused by this change. `tsc --noEmit` for control: clean.
- Runtime files that fail identically at base: `image-closure` (docker), `runner-bootstrap-files` (environment), `execution-broker` (explicit source root).

## Unrun checks and why
- Live SDK interrupt after a completed stream, and real native checkpoint/completion capture: not available. These are scripted here.
- The completion-capture scenario with the real completion journal: the refusal is synthetic, and the real journal's `COMPLETION_STATE_REFUSED` under a hold is unchanged and covered by existing tests.
- Temporal or worker-loss replay of a held run (G4): out of scope.
- Historical qualification suites under `docs/qualification/**`: immutable evidence, not rerun. Any assertion there of the old silent held-running state is superseded by this change.

## Intentional behaviour changes
1. A worker failure on a held run now ends in `failed` with `HOLD_CHECKPOINT_FAILED` instead of leaving the run `running` and held. The control becomes `UNKNOWN` even when it was never claimed (`PENDING`), so it is never delivered afterwards.
2. A publication refused while the control reader is live no longer kills the SDK. Output is suppressed and the hold is settled through the checkpoint.
3. A pause that commits after the control reader stopped (in the completion window) produces the explicit failure, not a checkpoint. The completed answer text published before the hold remains in history.

## Proposals for dot (not edited; contracts frozen)
- Add `HOLD_CHECKPOINT_FAILED` to the conversation-lifecycle contract as the named run.status reasonCode. Worker and store currently each define the literal with cross-references. The composition tests prove they agree.
- Optional: a dedicated `runner/fail-hold` runtime-0.2 operation in place of the reason-coded publish, if dot prefers a typed port.

## Residual risks
- The worker's terminal publication keeps the existing 30 ms budget per attempt (now up to two attempts). At base, in the composition, the ordinary failure event missed that budget while the control reader contended for the store, which left the row `running` (seen as `SESSION_REFUSED` from the operation deadline). With the fix the reader has finished first and all runs passed, but over real network latency a 30 ms terminal publication can still be lost. I recommend that dot review that budget separately (also relevant to L4 crash recovery). Not changed here.
- Recovery after `failed` (a next prompt or retry) is audit finding L4 and remains open.
- A later reconciler could still checkpoint an `UNKNOWN` hold only while the run is `running`. After the explicit failure it cannot.
