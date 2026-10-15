# Fable lane report: durable schedules (audit L6)

- Branch `fable/s3-l6-schedules-20261015`, base `866110f8` (package two).
- Audit: `origin/dot/meri-comprehensive-audit-20261015` @ `aac91640`, lifecycle-report.md §L6 and README matrix row "Durable schedules; L6".
- Synthetic evidence only: no PostgreSQL, Temporal server, schedule firing or deployment was used.

## Implementation outline (recorded before the changes)

1. Leave Temporal's schedule as the only scheduler. Product dispatch runs inside the workflow that the schedule action already starts
   (`args:[{projection,generation,task}]`), not in a background loop.
2. Derive one immutable identity per firing from server-set facts: `TemporalScheduledById`, `TemporalScheduledStartTime`, the
   scheduled workflow ID, the schedule ID, the generation and the owner. Every run ID derives from it, so a replay or a concurrent
   claimer cannot mint a replacement. Use the canonical owners unchanged: conversation store `accept`/`readOptional` for admission
   and the claim, the conversation Temporal dispatcher for the exact-ID start.
3. Fence each effect: the schedule owner's current generation, state and unresolved intent; the catch-up window; the approved
   instruction digest; the original owner's current authority before admission and again before start.
4. Reconcile an UNKNOWN firing only on evidence: the store's locked exact read, then Temporal's exact-ID describe with the typed
   not-found. Anything else stays UNKNOWN, and the open workflow keeps blocking.
5. Add exact provider reconciliation for schedule intents left DISPATCHING/UNKNOWN. A "never applied" outcome needs a schema
   state, so it goes to a proposal. Placement and missing product owners also go to proposals.

## Finding closed: L6 (P2 source completeness, P1 release gate)

| Repair acceptance | Status in this branch |
|---|---|
| Register a scheduled dispatch workflow and compose the actual command path | **Composed, not registered.** `meriScheduledDispatchWorkflow` plus activities compose the real schedule owner, conversation store and dispatcher. Registration is a placement decision (P-L6-2). |
| Reconcile exact intent/generation/provider IDs after dropped acknowledgements without repeating a possibly completed effect | **Done for positive evidence**: `createScheduleIntentReconciler` plus the owner's `acknowledgeReconciled`. Recording proven non-application needs DDL (P-L6-1). |
| Product dispatch/run issuance and exact UNKNOWN reconciliation (matrix) | **Done (synthetic)**: `createScheduledDispatch().dispatch/reconcile`. |
| Current authorization at firing | **Done**: original owner only, before admission and before start. The production authority adapter does not exist yet (P-L6-3). |
| Claim/generation/expiry/cancel/recovery and duplicate-effect controls; no second scheduler, no blind redispatch | **Done (synthetic)**: see the tests below. Real PostgreSQL/Temporal: UNRUN. |
| Restart, time zones/DST, overlap/misfire, cancellation of original runs, physical stop receipts | Misfire (catch-up window plus jitter) is enforced at admission. Overlap is Temporal's (the firing stays open while UNKNOWN). DST/time zones stay Temporal's spec evaluation. Physical stop belongs to the conversation run owners and is unchanged. All live checks: UNRUN. |

## Files

New:
- `apps/control/schedules/scheduled-occurrence.mjs`
- `apps/control/schedules/scheduled-dispatch.mjs`
- `apps/control/schedules/scheduled-activities.mjs`
- `apps/control/schedules/intent-reconciliation.mjs`
- `apps/control/conversations/temporal-run-evidence.mjs`
- `apps/control/conversations/scheduled-dispatch-workflow.ts`

Tests:
- `apps/control/schedules/test/scheduled-dispatch-composition.test.mjs` (14)
- `apps/control/schedules/test/intent-reconciliation.test.mjs` (6)
- `apps/control/conversations/test/scheduled-dispatch-workflow.test.mjs` (4)
- Fixtures: `schedule-owner-fixture.mjs`, `scheduled-dispatch-harness.mjs`

Changed:
- `apps/control/schedules/postgres-schedule-owner.mjs`: adds `readFiring`, `readIntent` and `acknowledgeReconciled`.
  `commitKnown` now shares the unchanged fenced projection update.
- `apps/control/conversations/tsconfig.json`: one include line so the new workflow is typechecked.

The two new files under `apps/control/conversations/` sit there only because that package owns the `@temporalio/*` dependencies. No
lifecycle or next-run file was touched.

No source-proof-hashed file changed; `source-proof.test.mjs` passes 5/5. No contract, migration, lockfile or runtime startup file changed.

## Tests (synthetic)

All runs used Node v24.21.0. `MERI_REVIEW_SOURCE_ROOT` was set where the review harness loads.

| Suite | Base `866110f8` | This branch |
|---|---|---|
| `apps/control/schedules/test/*.test.mjs` | 134/134 | 154/154 (+20) |
| `apps/control/test/*.test.mjs` | 260/260 | 260/260 |
| `apps/control/conversations` `npm run check` (tsc + tests) | tsc ok; 195 tests, 15 fail | tsc ok; 199 tests (+4), 14 fail |
| `scripts/qualification/assembled-image/source-proof.test.mjs` | — | 5/5 |

The conversations failures on both base and branch are the `*-pg` tests (no PostgreSQL cluster) plus two timing-sensitive
`parked … RPC receives the shorter … deadline` lifecycle tests. Those two fail on base and branch alike and vary between runs under
machine load; the last branch run passed them. One existing schedules test,
`temporal-inspection-independent: authority expiresAtMs substitution refuses`, flaked once in 8 isolated runs. It compares a frozen
harness clock with `Date.now()-1` and imports none of the changed modules.

The composition tests cover:
- a due occurrence produces one run (owner actor, approved prompt, exact workflow ID);
- replay produces no second run;
- four concurrent claimers produce one run and one workflow;
- an expired attempt whose acceptance commit was lost is recovered with no duplicate;
- an admitted run whose start never reached Temporal is completed once;
- UNKNOWN with the run present resolves to DISPATCHED;
- UNKNOWN with proof of absence resolves to NOT_DISPATCHED and the occurrence is dispatched once more;
- UNKNOWN without evidence stays UNKNOWN (store down, Temporal error);
- cancel or pause before dispatch is refused with no run;
- cancel after dispatch leaves the one run, and an admitted but unstarted run is not started;
- a revoked owner is refused; unavailable, impersonating or widened authority is UNKNOWN;
- a stale generation, an unresolved intent, a missed catch-up window and a changed instruction are each refused;
- a malformed or foreign firing is refused;
- activity cancellation propagates.

The workflow tests run the upstream Activator: one activity when DISPATCHED; UNKNOWN goes through a 120 s timer, reconcile, ADMITTED
and dispatch; repeated UNKNOWN stays open with no redispatch; missing server attributes are refused; cancellation ends the wait.

### Reverted-fix proof

Each fix was temporarily reverted, the named tests were run, and the source was restored. All files are restored, with 20/20 and 4/4
passing again.

| Reverted fix | Result |
|---|---|
| Derived identity replaced with a random one | 10 composition tests fail (replay, concurrency, recovery, cancel-after) |
| Any describe error counted as workflow absence | "UNKNOWN without evidence stays UNKNOWN" fails |
| Generation/state fence removed | 5 tests fail (cancel before/after, stale/unresolved, both reconciliation-gated dispatches) |
| Explicit owner denial treated as allowed | the revoked-authority test fails |
| Reconciler ignores the evidence generation | "mismatched … evidence never acknowledges" fails |
| Reconciler acknowledges CLAIMED | the CLAIMED/unreadable test fails |
| Workflow redispatches on UNKNOWN instead of reconciling | 2 workflow tests fail |
| Activity failure ends the firing | 1 workflow test fails |

Before this lane none of these modules or owner methods existed, so every new test fails at import on base.

## Unrun checks and why

- **Real PostgreSQL.** The socket `/tmp/meri-prepared-kickoff-pg-20261014/socket` exists, but the server refuses connections, and
  the brief forbids starting or migrating a cluster. The `readFiring` join and `acknowledgeReconciled` SQL are exercised only against
  the scripted fixture.
- **Real Temporal.** Schedule firing, server-set `TemporalScheduledById`/`TemporalScheduledStartTime` typed search attributes, describe
  shapes after dropped acknowledgements, timer durability, overlap behaviour while a firing is open, and DST/time-zone evaluation all
  need a live server. The workflow fails closed (REFUSED) if those attributes are absent.
- **End-to-end product path.** The authenticated product startup that would host this does not exist yet (P-L6-2, P-L6-3). The
  current authority adapter and instruction store do not exist either. Execution of the issued run, native issuance and physical stop
  belong to the existing conversation owners and are not re-tested here.

## Proposals for dot

All four are in [FABLE-L6-SCHEDULES-PROPOSALS-20261015.md](../proposals/FABLE-L6-SCHEDULES-PROPOSALS-20261015.md):
- **P-L6-1:** migration request for a recorded `NOT_APPLIED` intent outcome, with DDL and transition rules.
- **P-L6-2:** placement of the schedule worker (owner approval required; recommendation: control-hosted worker on a dedicated queue).
- **P-L6-3:** the two missing product owners (current schedule authority; approved task-instruction store).
- **P-L6-4:** keeping an occurrence's UNKNOWN beyond its workflow lifetime.

## Residual risks

- **Not live.** Until P-L6-2/P-L6-3 land, no schedule fires a product run. This is fail-closed: no worker polls the workflow type, so
  nothing is dispatched, and missing ports yield UNKNOWN.
- **Refused firings are dropped.** While a schedule intent is unresolved, firings are refused (`SCHEDULE_FIRING_UNRESOLVED`) and not
  queued for later. A never-applied intent keeps blocking until P-L6-1.
- **Unstarted runs can linger.** A run admitted but then refused at start (owner revoked, schedule changed) stays `queued` and
  unstarted. It is visible in history and never executes unless the same occurrence is dispatched again with valid fences. No
  cancellation event is written for it.
- **Overlap covers dispatch only.** The dispatch workflow ends at DISPATCHED, so the schedule's overlap policy governs dispatch, not
  the issued conversation run's lifetime.
- **UNKNOWN can outlive its workflow.** An occurrence can stay UNKNOWN past the dispatch workflow's run timeout and retries (P-L6-4).
  Identity stays fixed, so no duplicate is possible, but later firings are no longer overlap-blocked.
- **Settle period is unproven.** The 2-minute settle exceeds the 1-minute activity bound plus store/Temporal request bounds. A zombie
  attempt that commits later is still harmless, because accept replays the same identity and the start uses the same workflow ID.
  The worst case is a queued run with no workflow, which the next reconcile reports as ADMITTED. A zombie that commits after the
  workflow has ended leaves an unstarted queued run.
