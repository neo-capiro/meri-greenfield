# Fable lane s3-l4-recovery — 15 October 2026

Branch `fable/s3-l4-recovery-20261015`, base `866110f8` (package two, `fable/repair-package-2-20261015`). Closes audit finding **L4** (lifecycle-report.md, "Production workflow has no crash-recovery path; stopped/failed conversations also have no safe next-prompt path"; README matrix row "Crash recovery and Stop → next prompt; L4"). It also closes the **L1 terminal-settlement residual** that dot re-held in `PACKAGE2-LIFECYCLE-REVIEW.md` (a5dccb19). No deployment, cloud, credential, model/provider, migration or lockfile action. No contract file, migration or schema change.

## Priority item: L1 terminal settlement (dot's HOLD)

**Defect.** Each terminal append in `apps/worker/conversation/activity.mjs` had a 30 ms budget. A 45 ms recording aborted both attempts and left the run `running` with its hold `UNKNOWN` (native capture refusal after the pause claim) or `PENDING` (pause committed during completed publication), with zero checkpoints after the SDK closed.

**Fix (commits `f83ef51a`, `0f46de02`, `18caf6d3`).**
- **Acknowledged.** Each terminal attempt waits `TERMINAL_ATTEMPT_MS` = 3000 ms for the durable owner's acknowledgement. That is the control service's default per-request bound (`maxRequestMs`). It is configurable from 1 to 30000 ms.
- **Idempotent.** The two candidate events each get one event ID: the ordinary failure or cancellation, and the verified `HOLD_CHECKPOINT_FAILED` exit, ordered by the local hold view. Settlement makes at most two rounds. So when a write commits but its acknowledgement is lost, the exact replay reads that write back (the store returns the stored event for a replayed event ID). It never creates a second terminal event.
- **Finite.** At most four attempts, 12 s by default. No retry loop runs beyond that.
- **Durably reconcilable.** When nothing is acknowledged, the run stays nonterminal. The broker's independent stop (`execution/kickoff/stop`, every exit, L5) now composes the new run reconciler. The reconciler asks the native stop owner to retire the original. It then trusts only the allocation journal: `RETIRED` with `physicalStopProven`, which the allocator records only after revoking the grants and proving the stop. Only then does it record the single terminal outcome the store admits for that exact binding:
  - `failed/ATTEMPT_LOST`, or
  - for an unapplied hold, the existing verified `failed/HOLD_CHECKPOINT_FAILED` with its `UNKNOWN` barrier.
- **Not an asserted physical stop.** The reconciler never treats a port's answer as the physical stop: an unproven stop writes nothing. Only the bound writer settles: a stale attempt or fence is refused by the store as `STALE_WRITER`, and a closed range as `RUN_RANGE_CLOSED`. A replayed reconciliation answers `settled`.
- **Preserved.** The hold fence, the transactional hold-failure escape, applied-checkpoint protection and the UNKNOWN barrier are unchanged. Output is never reopened.

**Regressions.** All synthetic, over the real worker activity and the control service, journal, store and reconciler.

`terminal-settlement-composition.test.mjs`: 11 scenarios, 11/11 pass. With the base 30 ms activity restored, 4 fail:
- dot's capture-refusal case: actual `running` with the hold `UNKNOWN`;
- dot's completion-window case: actual `running` with the hold `PENDING`;
- a 250 ms ordinary failure;
- the lost-acknowledgement replay (actual one acknowledgement, expected two).

The other 7 exercise the reconciler:
- never acknowledged, then reconciled to `HOLD_CHECKPOINT_FAILED` in both of dot's cases, and to `ATTEMPT_LOST` for an ordinary failure;
- a replayed reconciliation is idempotent;
- an unproven stop is a barrier (silent and throwing ports);
- a stale attempt or fence is refused;
- a queued run with no allocation claim is failed and a later claim is refused;
- success still converges.

Reconciler mutation proofs:
- Dropping the hold-failure branch fails 2 scenarios.
- Treating any stop as proven fails 3.

Worker `terminal-settlement.test.mjs` (code-independent `NATIVE_UNAVAILABLE` refusals): 4/4 pass. With a 30 ms single round, 4/4 fail.

`prepared-kickoff-reconcile.test.mjs`: 6/6 pass. Without the reconciliation in `stop`, 4 fail.

## Implementation outline (recorded before the change)
- **Owners.**
  - The store's locked transition stays the only writer of terminal states (exact binding, scope and fence; the hold escape).
  - The allocation journal and the allocator (`stop()` = revoke, ECS containment, then `RETIRED`) are the native stop owner.
  - The prepared kickoff's `stop` is the broker's independent exit.
  - The next-run owner and journal own new-prompt admission.
  - The Temporal workflow owns orchestration.
  - No second path, scheduler or lifecycle.
- **New modules and interfaces.**
  - `apps/control/conversations/run-reconciler.mjs`: `createRunReconciler({store,retirement}).reconcile({binding,signal})` returns `settled | reconciled | checkpointed | unknown`.
  - `apps/control/conversations/recovery-workflow.ts`: `reconcileAfterFailure`.
  - `createReconcileActivity` in `apps/runtime/temporal-worker.mjs`.
  - Dependency direction: runtime → control, as before. No cycles.
- **State and failure.** UNKNOWN never licenses a write, redispatch or reuse. A next run after a failed or cancelled source needs the same retirement and revocation proofs as after a completed source. It carries no checkpoint.
- **Verification.** Synthetic composition through the real lifecycle service, journals and store, plus reverted-fix proofs. Real PostgreSQL only if a running cluster was present (it was not).

## Terminal states and next-prompt admission

| Latest run state | Next prompt? | Required proof (all under the conversation lock / canonical journals) | Seed of the next run |
|---|---|---|---|
| `completed` | Yes (existing) | Published completion checkpoint; allocation `RETIRED` + `physicalStopProven`; revocation receipt whose grant IDs equal the allocation's grant intents | Verified completion checkpoint (SDK resume, `nextTurn` lineage) |
| `failed`: `EXECUTION_FAILED`, `ATTEMPT_LOST`, or `HOLD_CHECKPOINT_FAILED` | **Yes (new)** | Allocation `RETIRED` + `physicalStopProven`; revocation receipt as above. Reservation facts must carry `checkpoint: null`. A `HOLD_CHECKPOINT_FAILED` source keeps its hold `UNKNOWN`; it cannot be claimed or delivered | Conversation history only: fresh SDK session, no lineage |
| `cancelled`: Stop, either running or queued | **Yes (new)** | Same as failed | Conversation history only |
| `failed`/`cancelled` with allocation `UNKNOWN`, `ADMITTED`/`ALLOCATED`, or no allocation row | **No** (`NEXT_RUN_RETIREMENT_REQUIRED`) | The journal checks the allocation itself, so a forged port answer is refused | — |
| `failed`/`cancelled` with retirement but no revocation receipt | **No** (`NEXT_RUN_REVOCATION_REQUIRED`) | — | — |
| `queued` / `starting` / `running` (live, or crashed and not yet reconciled) | No new run. The live binding is returned, and the journal refuses a reservation (`NEXT_RUN_SOURCE_NOT_TERMINAL`) | The run reconciler first settles a crashed run after a proven stop. The workflow triggers it after the single attempt fails or is lost, and the broker's stop triggers it on every exit | — |
| `paused` / `waiting-for-approval` | No next run; continuation (resume/fork) owners | Unchanged | Pause checkpoint via continuation |
| Reconciler outcome `unknown` (stop not proven) | No | The run stays nonterminal and the allocation unretired: barrier | — |

**Seed decision: conversation history only, never a checkpoint, for a failed or cancelled source.**
- The source has no verified completion checkpoint. Its SDK session may hold an unverified partial turn.
- The last verified completed checkpoint (an older run) cannot be used without weakening the next-turn lineage fence. `assertNextTurnLineage` requires the checkpoint's writer fence to be exactly the target's minus one, and `contextSha256` binds the immediate source request. Both are enforced by the worker and the runtime restorers.
- So `nextRuns.execution` returns `null` for such a successor, and the runtime and worker run it as a fresh session.
- The durable conversation history continues: the source's sequence range is sealed and the successor's base continues it.
- Consequence: the model does not see earlier turns' SDK context after a failure or a Stop. A proposal below covers this.

## What changed (files)
- `apps/worker/conversation/activity.mjs`: terminal settlement (see the priority item).
- `apps/control/conversations/run-reconciler.mjs` (new): original-attempt reconciliation.
- `apps/runtime/native-authority/prepared-kickoff.mjs`: optional `reconcile:true`. `stop()` closes, then reconciles, and rejects when the stop is unproven.
- `apps/runtime/prepared-candidate.mjs` and `apps/runtime/prepared-run-registry.mjs`: opt in.
- The registry now rebuilds an accepted target's entry for `execution/kickoff/stop` after a restart. It uses the control capability only, replays the issuance exactly, and never kicks off or allocates.
- `apps/control/conversations/recovery-workflow.ts` (new), `workflow.ts`, `lifecycle/workflow.ts`:
  - After the single `executeConversation` attempt fails, times out (a crashed poller's heartbeat timeout) or is cancelled, the workflow runs `reconcileConversation` in a non-cancellable scope, then fails as before.
  - It never schedules a second execution.
  - The retry policy is bounded by a schedule-to-close of 85 s: 20 s per attempt, backoff from 1 s to 10 s.
- `apps/runtime/temporal-worker.mjs`:
  - `stopOriginal` is now shared by the broker cleanup and the new `createReconcileActivity`, which repeats only `execution/kickoff/stop`.
  - The new activity is registered.
- `apps/control/conversations/next-run.mjs` and `next-run-journal.mjs`: admit failed and cancelled sources as in the table. `admitsNextRun` is exported. The checkpoint/null pairing is checked in `reserve`, `current`, `accept` and `execution`.
- `apps/control/conversations/README.md`: one recovery paragraph.
- Tests:
  - new: `terminal-settlement-harness.mjs`, `terminal-settlement-composition.test.mjs`, `next-run-recovery.test.mjs`, `recovery-workflow.test.mjs`, runtime `reconcile-activity.test.mjs`, `native-authority/test/prepared-kickoff-reconcile.test.mjs`, worker `terminal-settlement.test.mjs`;
  - adjusted: `lifecycle-hold-harness.mjs` (signal, after-append and after-submit hooks, `terminalAttemptMs`); `prepared-run-registry.test.mjs` (fake store `append` that fails if used, a scripted target record, one new case); `prepared-temporal.test.mjs` and `runtime.test.mjs` (two activities); `next-run-pg.test.mjs` (failed/cancelled now expect `NEXT_RUN_RETIREMENT_REQUIRED`).

## Required cases (synthetic unless stated)
| Case | Test | Revert proof |
|---|---|---|
| failed → next prompt after retirement | next-run-recovery "failed (EXECUTION_FAILED) → …" | fails on base owner and journal |
| failed with retirement UNKNOWN → refused (and forged facts refused by the journal; missing revocation refused) | next-run-recovery "failed with retirement UNKNOWN …" | fails on base, which refuses earlier with `SOURCE_NOT_COMPLETED`; this is a characterization of the new order, not a safety gap at base |
| cancelled → next prompt (Stop while running, and while queued) | next-run-recovery, two cases | fail on base |
| HOLD_CHECKPOINT_FAILED → next prompt; the UNKNOWN hold stays a barrier | next-run-recovery | fails on base |
| crash mid-run → reconciled terminal → next prompt | next-run-recovery "crash mid-run …"; workflow side in recovery-workflow; broker stop side in prepared-kickoff-reconcile | fail on base / earlier workflows / kickoff without reconcile |
| duplicate or replayed next-prompt submission → one run; two prompts race → one winner | next-run-recovery "duplicate and replayed …" | fails on base |
| stale checkpoint never resumed | next-run-recovery "a stale checkpoint is never resumed …" | fails on base |
| worker/poller crash → reconciliation scheduled, never redispatched; Stop still reconciles | recovery-workflow (9) | 7 fail with the earlier workflows |
| restarted control can stop and settle an accepted target | prepared-run-registry, new case | fails without the change |
| healthy-infrastructure recovery within two minutes | recovery-workflow "modeled …": 30 s heartbeat detection + 85 s reconcile budget < 120 s, read from the actual scheduled commands | **Model only, unqualified live** |

## Checks run (Node v24.21.0, shared 4-core host)
- `apps/control/conversations`: `tsc --noEmit` clean.
  - Full suite: 218 tests, 209 pass, 9 fail. At base: 190 tests, 181 pass, 9 fail.
  - The 9 failures are the same environmental set at base and on the branch: the PostgreSQL files without a database, `native-preparation` (PostgreSQL socket), and one `retention-serving-pg` test.
- `apps/worker/conversation`: 125/125 (base 121); `continuation/test`: 43/43.
- `apps/runtime`: `test/` and `telemetry/test/` without `process.test.mjs`: 193 tests, 187 pass. The 6 failures are environmental and identical at base:
  - `image-closure` (docker);
  - `prepared-run-issuance-postgres-pg` ×2 (PostgreSQL);
  - `runner-bootstrap-files` (environment, as reported by L1);
  - `prepared-candidate`, `prepared-candidate-config`: `@aws-sdk/client-s3` is not resolvable from the shared runtime `node_modules`.
- The `prepared-candidate*` suites, run with a temporary untracked `apps/node_modules/@aws-sdk/client-s3` symlink to the storage package's copy (removed afterwards): 38/38.
- `process.test.mjs`, run as uid 65534 with AWS and extra-CA variables removed (these tests refuse root): 7/7. As root it did not finish within 10 minutes and was stopped; the L1 lane reports these tests refuse root.
- `apps/runtime/native-authority/test` non-`-pg` files: 318 tests, 308 pass. Of the 10 failures, 7 need the PostgreSQL broker socket. The other 3 (`deferred-process-independent`, `runner-query`, `sdk-continuation-bootstrap`) fail identically at base.
- `scripts/qualification/assembled-image/source-proof.test.mjs` fails only on the hashed rows below. A full row scan shows exactly these 4 of 45 differ.
- `temporal-bundle.test.mjs` fails identically at base ("Temporal package binding differs" with the shared `node_modules`).

### Source-proof rows changed (no candidate manifest created)
| Path | Old SHA-256 | New SHA-256 | Reason |
|---|---|---|---|
| apps/runtime/native-authority/prepared-kickoff.mjs | b8623c6b9c78b92a81a858756073dace0fd47a4646c12eadb9f403a80dfcf875 | 3650e3af495e5a096a108c0071703012dfbaaf0e27d61e8469bd7eaf22a2d0e7 | stop composes the run reconciler (`reconcile:true`) |
| apps/runtime/prepared-candidate.mjs | b69fb73c10302cab199278b2318479f3f27074bd487d8bd8110195f1b7b7e8bb | ea0d464392a451160ea886896e6285f30509a9340882014e966d6c6bf9445f18 | first-run kickoff opts into reconciliation |
| apps/runtime/temporal-worker.mjs | 1261353767a00898a27ec368f1914f3a67cacfc6113faf284f6a58d537b1f5d8 | 4a0a145c2014bf08006e7623cce9e9f325c1c4c03ee8ef436377189b00c9ca3e | shared `stopOriginal`; `reconcileConversation` activity registered |
| apps/runtime/test/prepared-temporal.test.mjs | 268de545811af6b2e89b04e6f1ae76f4e6493cc7e7d3dbb3b7f8b912052453cc | 67a68c78fd3942e0d66678b8bbebff9e45cccac510d68a7dda7446860f550b50 | registration expects the two activities |

## Unrun checks and why
- **Real PostgreSQL.** No cluster was running: the `/tmp/meri-prepared-kickoff-pg-20261014/socket` directory exists but no server process. So the new scenarios were not run against PostgreSQL, and `next-run-pg` (updated expectation) and the other PostgreSQL files stay **UNRUN**.
- **Temporal server, worker-kill and replay.** Covered with the upstream Activator only. Killing control, poller and SDK across preclaim, postlaunch, stream, capture and commit boundaries on real infrastructure is **UNRUN**.
- **Live ECS stop, revocation and the two-minute recovery target.** Modeled from the configured timeouts; **unqualified live**.
- **Live SDK and native capture.** Scripted.

## Intentional behaviour changes
1. Terminal publication waits up to 3000 ms per attempt (was 30 ms). It replays the same event IDs once and stops after at most 4 attempts.
2. Kickoff `stop` (candidate and registry) now settles a run the original left nonterminal, as `failed/ATTEMPT_LOST` or `failed/HOLD_CHECKPOINT_FAILED`, after a proven retirement. An unproven retirement now rejects the stop receipt; the broker already treats that as cleanup unknown.
3. Both workflows run `reconcileConversation` after their single attempt fails, times out or is cancelled. The workflow still fails as before. Old histories replay unchanged up to the failure, and the new command follows the last recorded event.
4. A failed or cancelled latest run admits one explicit next prompt after retirement and revocation, from a fresh SDK session. The old refusal code `NEXT_RUN_SOURCE_NOT_COMPLETED` is gone; the journal uses `NEXT_RUN_SOURCE_NOT_TERMINAL`, `NEXT_RUN_CHECKPOINT_REFUSED` and `NEXT_RUN_CHECKPOINT_REQUIRED`.

## Proposals for dot (contracts frozen; not edited)
- Add `ATTEMPT_LOST` to the conversation-lifecycle contract as a named `run.status` reasonCode, next to `HOLD_CHECKPOINT_FAILED` (L1 proposal). The UIEvent contract already admits any non-empty reasonCode.
- **Control-process hard crash** (no graceful close). The allocation stays un-`RETIRED`, and a restarted control process has no controller, so `stop` answers UNKNOWN and the run stays nonterminal. That is safe (a barrier; next run refused) but not live.
  - Proposal: a stop-only original retirement built from the same facts. Extract the allocator, admission and authority construction in `remote-composition.mjs` (hashed) as `createOriginalRetirement`. Then `lazy.close()` in candidate and registry calls `allocator.stop()` when this process holds no controller and the journal shows an un-retired claim.
  - Not done here because it changes more hashed composition and needs ECS/admission fakes or live checks.
- **Operator entry point.** When the workflow's 85 s reconcile budget is exhausted, nothing re-triggers reconciliation. Propose a bounded control CLI that calls `createRunReconciler(...).reconcile` with the same stop owner. It must integrate with smoke discovery.
- **Optional product improvement.** Seed a post-failure next run from the last verified completed checkpoint with an explicit skipped-turn record. This needs a reviewed change to the next-turn lineage (fence and context) in the worker and runtime restorers.

## Residual risks
- When the worker cannot reach control for the whole settlement, recovery depends on the broker's stop or the workflow's reconcile activity reaching control within 85 s.
- The broker's stop deadline is still 3 s. A slow ECS stop makes the broker report cleanup unknown; the workflow's reconcile activity then repeats the same memoized close.
- A queued run whose Temporal start acknowledgement was lost, and whose request is never replayed, is unchanged (outside L4).
- No real PostgreSQL, Temporal, ECS or SDK evidence in this lane.
