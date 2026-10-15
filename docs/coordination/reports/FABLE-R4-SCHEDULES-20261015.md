# Fable lane report: schedule correctness follow-up (package-three review)

- Branch `fable/r4-schedules-20261015`, base `81e20025` (package three, the pin dot reviewed).
- Review: `f8d1816e`, `docs/coordination/audits/meri-comprehensive-20261015/PACKAGE3-PRODUCT-REVIEW.md` §2–§4 and the summary's
  "Schedules", "Schedule correctness" and frozen-clock bullets.
- Synthetic evidence only: no PostgreSQL, Temporal server, schedule firing, worker registration or deployment was used.
- Out of scope by instruction: registering the scheduled workflow/activities in startup (needs placement approval, P-L6-2), and
  actual-job overlap/cancellation/physical stop/cost/delivery and the authority/instruction owners beyond proposals.

## Implementation outline (recorded before the changes)

1. Frozen clock: make the inspection fixture derive every receipt and deadline from the harness's one injected clock; add
   past/equal/future boundary tests; keep production clock policy unchanged.
2. Complete effect: one small module that turns the exact SDK options the mutation adapter sends, and a `describe()` result, into
   the same provider-normalized form, and compare all of it. Anything describe cannot return faithfully is NOT_COMPARABLE and stays
   unresolved. Test with the real SDK `ScheduleClient` over a protobuf-encoded synthetic service, applying schedules with the
   production adapter, and mutate one field at a time.
3. Durable UNKNOWN barrier: a schedule-owner occurrence row written before the first effect, binding the occurrence to its run
   binding and native workflow ID; one OPEN row per schedule blocks later occurrences; rows settle only on evidence. The table is a
   migration request (no ID is allocated to this lane), so the SQL runs against the scripted fixture only.

## Findings closed

| Review finding | Status in this branch |
|---|---|
| §3 / "Schedule correctness": create/update reconciliation compares only an action tuple yet may clear the barrier | **Closed in source.** `schedule-effect.mjs` defines the approved effect from `scheduleSdkOptions(intent)` (every field the request asks Temporal to apply) and reads the same normal form from `describe()`: schedule ID, spec (calendars, intervals, skip, start/end, jitter, time zone), action (type, workflow type/ID, task queue, argument, run/execution/task timeouts, retry policy, and the memo/search attributes/static metadata/priority it leaves unset), policies (overlap, catch-up window, pause on failure) and state (paused, note, remaining actions). Equal canonical digests are required. |
| Keep non-comparable or partially readable evidence unresolved | **Closed.** Cron expressions (server-compiled into calendars), a create's trigger-immediately request and any unknown options key yield `UNRESOLVED`/`SCHEDULE_INTENT_EFFECT_NOT_COMPARABLE` with no provider read. Accessors, proxies or missing describe sections are refused unread (`SCHEDULE_RECONCILE_FAILED`, `UNRESOLVED`). |
| Real describe-shape mismatch regressions | **Closed (synthetic provider, real SDK).** 29 single-field mismatches (cadence, offset, calendar, skip, time zone, start/end, jitter, overlap, catch-up, pause on failure, paused, note, remaining actions, retry limit/backoff, three timeouts, memo, summary, priority, queue, type, ID, argument generation/task/projection, extra argument), plus server-side drift after an exact create **and** update (pause-on-failure, overlap, catch-up, limit, jitter). |
| CLAIMED/unknown effects without proof remain blocked | **Preserved.** CLAIMED is never read or acknowledged (asserted: zero describes, still CLAIMED); absent schedules stay `SCHEDULE_INTENT_EFFECT_NOT_OBSERVED`. |
| §2 / "Schedules": preserve an UNKNOWN barrier beyond wrapper timeout (P-L6-4) | **Closed in source, unwired until migration P-R4-1.** Each occurrence opens a schedule-owner row before acceptance. While any row of a schedule is `OPEN`, no other occurrence opens (`REFUSED`/`SCHEDULE_OCCURRENCE_UNRESOLVED`), independent of workflow lifetime. Rows settle only on evidence (`DISPATCHED` when the run's start is observed; `REFUSED` on this occurrence's fenced refusal); failed writes/settlements are UNKNOWN and keep it. |
| Bind each occurrence to its actual conversation/native effect | **Closed in source.** The row stores `{binding, requestId, eventId, workflowId}` (conversation run binding and the dispatcher's `meri:<tenant>:<conversation>:<run>`) with its digest. A later firing reconciles a blocking predecessor through that row: the store's locked read of that exact binding/request and Temporal's exact-ID describe; only a started run settles it. A row whose association differs from the occurrence's derived identity is `SCHEDULE_OCCURRENCE_CONFLICT` (UNKNOWN). |
| §4 frozen-clock fixture | **Closed (test only).** The harness clock starts at a fixed instant; every authority callback receives that clock and derives its receipt from it; new past/equal/future boundary tests. A second load-sensitive group in the same file (three expiry tests that injected `Date.now` with an 80 ms budget) failed once in a 4-way parallel run and now uses the frozen clock as well. Production clock policy unchanged. |

## Files

New:
- `apps/control/schedules/schedule-effect.mjs` (approved/described effect normal form)
- `apps/control/schedules/test/temporal-schedule-wire-fixture.mjs` (real SDK `ScheduleClient` + `WorkflowService` over a protobuf
  wire fake)
- `apps/control/schedules/test/scheduled-occurrence-barrier.test.mjs` (7)
- `docs/coordination/proposals/FABLE-R4-SCHEDULES-PROPOSALS-20261015.md`

Changed:
- `apps/control/schedules/intent-reconciliation.mjs`: compares the complete effect; NOT_COMPARABLE outcome.
- `apps/control/schedules/postgres-schedule-owner.mjs`: `openOccurrence`, `settleOccurrence` (SQL for the proposed table).
- `apps/control/schedules/scheduled-dispatch.mjs`: opens the barrier before acceptance, settles on evidence, reconciles a
  blocking predecessor through its row.
- Tests: `intent-reconciliation.test.mjs` (6 → 39), `schedule-owner-fixture.mjs` (scripted occurrence SQL, mirrors the FK and the
  one-OPEN unique index), `scheduled-dispatch-harness.mjs` (re-exports `ScheduleClient`/`WorkflowService` through the same anchored
  require, so the reviewed dependency-guard row is unchanged), `temporal-inspection-independent.test.mjs` (50 → 53).

No contract, migration directory, lockfile, manifest, startup file or source-proof-hashed file changed (`source-proof.test.mjs` 5/5).
P2b, candidate f bytes, L1, PDF and cleanup files are untouched.

## Checks

Node v24.21.0, UID 0, `MERI_REVIEW_SOURCE_ROOT=/home/user/meri-r4-sched`, run from the worktree root unless noted.

| Command | Base `81e20025` | Final branch |
|---|---|---|
| `node --test apps/control/schedules/test/*.test.mjs` | 154/154 (this machine); package-three receipt 153/154 kept, see below | 197/197 (+43) on 6 sequential runs and 8 runs four-way parallel; one earlier 4-way run 196/197 before the second fixture commit (kept, below) |
| `node --test apps/control/test/*.test.mjs` | — | 260/260 |
| `apps/control/conversations`: `npm run check` | tsc fails, 3 errors in `apps/worker/conversation/reads/{schema,tools}.mjs` | identical 3 tsc errors (no file of this lane involved) |
| `apps/control/conversations`: `npm test` | 213/227 | 212/227: the same 14 (`pg` not installed; PostgreSQL socket ECONNREFUSED) plus `parked start RPC receives the shorter target deadline` (`LIFECYCLE_EFFECT_UNKNOWN`), which passed 3/3 targeted reruns; this lane changes no conversations file |
| `scripts/qualification/local-baseline/dependency-ownership.test.mjs` | — | 1/1 |
| `scripts/qualification/assembled-image/source-proof.test.mjs` | — | 5/5 |

### Retained failed receipts

- Package three, schedules 153/154 (sha256 `273419ea…1d92`): `✖ independent: authority expiresAtMs substitution refuses` —
  `AssertionError [ERR_ASSERTION]: Missing expected rejection.` at `temporal-inspection-independent.test.mjs:31`.
- Deterministic reproduction on base with a test-only preload that advances ambient `Date.now()` 5 ms per call
  (`node --import advance-ambient-clock.mjs --test --test-name-pattern='authority .* substitution refuses' …`): the same test fails
  with the same message; after the fix all 5 substitution and 3 boundary tests pass under the same preload.
- This branch, first 4-way parallel run after the first fixture commit, 196/197: `✖ independent: receipt expiry constrains actual
  connection deadline and parked describe` — `AssertionError: 0 !== 1` (describe never reached within the 80 ms wall-clock budget).
  Reproduced deterministically with the preload at 30 ms per call (`TypeError: Cannot read properties of undefined (reading '1')`,
  the deadline call never happened); passes under the same preload after the second fixture commit.

### Reverted-fix proof

Each fix was temporarily reverted with the new tests in place, the named tests were run, and the source was restored (byte-compared).

| Reverted fix | Result |
|---|---|
| `intent-reconciliation.mjs` restored to base (action-tuple comparison) | 26 of 39 fail: all 22 non-tuple single-field mismatches, the drift test, the non-default-policy test, NOT_COMPARABLE and partial-evidence tests. The 7 tuple mismatches, the five retained behaviours and the wire-encoding equivalence test pass on both, as expected. |
| `scheduled-dispatch.mjs` restored to base (no durable barrier) | 7 of 7 barrier tests fail |
| Barrier treats `BLOCKED` as open | 4 fail, including "keeps blocking later firings after its dispatch workflow has ended" and "UNKNOWN with no run at all" |
| A predecessor counts as settled when merely admitted | "keeps blocking … until its own run is observed started" fails |
| Fixture clock (two commits) | base fixture fails under the advancing-clock preload, fixed fixture passes (receipts above) |

## Unrun checks and why

- **Real Temporal describe after a real server write.** The synthetic service stores the request's Schedule message verbatim. The
  real server canonicalizes specs (cron compilation, possibly defaults such as an empty time zone or catch-up minimums); any such
  difference can only keep an intent UNRESOLVED (fail-closed), but the false-blocked rate is unmeasured.
- **Real PostgreSQL.** `openOccurrence`/`settleOccurrence` SQL, the FK and the partial unique index exist only as proposal DDL and
  scripted fixture behaviour; no cluster may be started or migrated by this lane.
- **Worker registration, restart durability, real wrapper timeout, overlap/cancellation of actual jobs, DST.** Need placement
  approval and a live Temporal server.

## Proposals for dot

In [FABLE-R4-SCHEDULES-PROPOSALS-20261015.md](../proposals/FABLE-R4-SCHEDULES-PROPOSALS-20261015.md):
- **P-R4-1** migration request: `meri_schedules.occurrences` DDL and the owner transitions already written against it (resolves
  P-L6-4 by its option 2).
- **P-R4-2** recording proven non-effect for an OPEN occurrence after quiescence (mirrors P-L6-1; not implemented).
- **P-R4-3** actual-job lifecycle owner: overlap on the conversation run, cancellation/physical stop of the runs named by
  occurrence rows, and a frozen-contract text for propagating cost/runtime/retry limits and destination into run admission.
- **P-R4-4** current schedule authority and approved-instruction store (refines P-L6-3).

## Residual risks

- **Unwired.** Until P-R4-1 is allocated the table does not exist and every well-formed dispatch fails closed as UNKNOWN; until
  P-L6-2/P-L6-3 the workflow is unregistered and its authority/instruction ports are absent. No schedule fires a product run.
- **Blocked is not recovered.** An OPEN occurrence whose workflow ended with an absent or admitted-but-unstarted run blocks its
  schedule until P-R4-2 is decided, the same stance as unresolved intents (P-L6-1).
- **Firings during another occurrence's dispatch are refused.** The barrier cannot tell "in flight" from "UNKNOWN after a crash", so a
  firing that arrives while another occurrence of the schedule is mid-dispatch is refused and dropped, including under `ALLOW_ALL`
  or `BUFFER_*` overlap; unresolved-intent firings are likewise dropped, not queued.
- **Refusal settlement assumes one attempt at a time.** A fenced refusal settles the row REFUSED; a concurrent attempt of the same
  occurrence (not produced by the workflow, which runs one single-attempt activity at a time with a 2-minute settle) could still
  start afterwards, which then settles REFUSED → DISPATCHED.
- **Comparison may be stricter than Temporal.** Server-side drift that Temporal considers harmless (for example a system-written
  note after pause-on-failure, or remaining actions consumed by firings before reconciliation) keeps the intent unresolved.
- **Scope unchanged.** Overlap/cancellation/limits/delivery of the issued run, current authority and retained instructions remain
  proposals (P-R4-3, P-R4-4).
