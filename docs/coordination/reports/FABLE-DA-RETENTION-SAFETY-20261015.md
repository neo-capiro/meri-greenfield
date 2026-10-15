# Fable lane `da-retention-safety`: audit DA-1 and DA-4 (15 October 2026)

- Branch `fable/a3-retention-safety-20261015`, base `ba40647c5b6f1f81773869e41ce82c099d64d505` (the audited shared candidate).
- Audit: `docs/coordination/audits/meri-comprehensive-20261015/data-artifacts-report.md` DA-1 and DA-4, and the README matrix row "Retention, deletion and restore".
- Scope: source safety only. Live purge stays disabled (`createPurgeExecutor` still defaults to `enabled:false`, and runtime composes only the read gate). No activation, migration, credential, cloud, bucket or provider action.

## Implementation outline

| Responsibility | Canonical owner | Change |
|---|---|---|
| Which subject kind a row class belongs to | `inventory.mjs` (`rowClassSubjectKind`, next to `rowClasses`) | New table. The planner and both row owners read it. |
| Eligibility of a plan | `purge.mjs` `planPurge` | Adds block `ROW_TARGET_SUBJECT_MISMATCH`. The foreign target stays in the plan. |
| Effects and their durable record | `purge.mjs` `createPurgeExecutor` | Preflights every target before any record or effect. Marks steps UNKNOWN before each effect and records the outcome after it. On an exception, records UNKNOWN and rethrows. |
| SQL row routing | `postgres-journal.mjs` | Adds `rows.preflight` (no database access). `purge` preflights before opening its transaction. Validates exact target shapes. |
| Lease lifetime | `postgres-journal.mjs` `tx` / `exclusive`, using the shared `packages/runtime/operation-lifetime.mjs` | Follows the canonical pattern in `apps/artifacts/storage/postgres-versions.mjs`. A lease is reused only when its state is known. |

- Dependency direction: `postgres-journal.mjs → inventory.mjs → boundary.mjs`, plus `packages/runtime`. No cycles and no new package.
- Ledger vocabulary is unchanged. "Effects started" is a `PURGE_UNKNOWN` entry with reason `EFFECTS_STARTED`, and per-step states use the existing `UNKNOWN` and `PENDING` values. Recovery already re-verifies every step of a `PURGE_UNKNOWN` entry. Database state constraints are unchanged.

## Findings closed

### DA-1: mixed subject deleted bytes before its database target was refused

- **Subject-aware plans.** A conversation inventory that carries an artifact-version row target is now `BLOCKED` with `ROW_TARGET_SUBJECT_MISMATCH`. The block detail names the class, target, subject kind and required kind. It is recorded through `recordBlocked`, recovery keeps it, and it clears only after the artifact is purged under its own artifact subject and leaves the conversation's authoritative inventory. Nothing is silently dropped.
- **Preflight before any effect.** Before anything is recorded or deleted, the executor checks:
  - the storage delete permission;
  - every object key, resolved up front instead of one per step;
  - every row target, through a now-required `rows.preflight` port.

  One invalid target refuses the whole plan, with zero deletes and no `PURGE_PLANNED` entry.
- **Durable per-step state.** The sequence is now:
  1. Re-authorize, then append a `PURGE_UNKNOWN`/`EFFECTS_STARTED` ledger entry before the first effect.
  2. Project each step as UNKNOWN before its effect.
  3. Record each step's outcome after the effect.
  4. On an exception, append `PURGE_UNKNOWN` with the known per-step states (reason = the closed error code) and project it, then rethrow the original error.

  A resumed UNKNOWN purge re-runs its UNKNOWN steps. Recovery re-verifies a lost process instead of reading it back as only planned or as done.
- **Reproduction of the audit counterexample.** I ran a scratch probe with the planner, preflight and per-step fixes all reverted. It deleted 6 of 6 objects, then threw `RETENTION_INVALID_REQUEST`; the ledger held `SUPPRESSED, PURGE_PLANNED` and the journal was PLANNED with 0 steps, matching the audit. With the fix the plan is `BLOCKED`, 0 objects are deleted, the error is `RETENTION_PURGE_BLOCKED` and the ledger holds only `SUPPRESSED`.

### DA-4: uncertain leases were returned to the pool as reusable

- **Bounded client-side waits.** Lease acquisition and every statement have a client-side bound (`maxRequestMs`, default 10 s, injectable `now`).
- **Lost COMMIT acknowledgement.** Reported as `RETENTION_COMMIT_UNKNOWN`. No ROLLBACK is sent over it.
- **Rollback.** A body failure is rolled back within `min(maxRequestMs, 1 s)`.
- **Deadline.** After a client-side deadline nothing is sent behind the stalled statement.
- **Reuse rule.** Only a confirmed COMMIT, ROLLBACK or unlock (`pg_advisory_unlock` returning `true`) returns a lease to the pool. Every other lease is retired with `release(error)`. A late lease is retired when it arrives. A lock acquisition with an unknown outcome discards the recovery session.

## Files

- `apps/control/retention/inventory.mjs`, `index.mjs`, `purge.mjs`, `postgres-journal.mjs`
- `apps/control/retention/test/fixture.mjs`: the in-process row port now routes classes the way the SQL owner does and has a preflight.
- `apps/control/retention/test/planning-execution-recovery.test.mjs`: intentional corrections, listed below.
- New: `apps/control/retention/test/purge-safety.test.mjs` (DA-1, 5 tests, synthetic).
- New: `apps/control/retention/test/postgres-journal-lease.test.mjs` (DA-4, 6 tests, synthetic injected pool).
- `apps/control/retention/test/postgres-journal-pg.test.mjs`: 2 real PostgreSQL controls added.

## Intentional behaviour changes

- Every executed purge has one extra ledger entry (`PURGE_UNKNOWN`/`EFFECTS_STARTED`). The existing execution test now asserts it, and its replay ledger count goes from 3 to 4.
- The first planning test asserted the defective shape: a conversation subject carrying artifact-version rows was expected to be PLANNED. It now plans artifact versions under an artifact subject.
- A row port must expose `preflight`, otherwise construction fails with `RETENTION_CONFIGURATION`.
- A lost COMMIT acknowledgement surfaces as `RETENTION_COMMIT_UNKNOWN` instead of `RETENTION_STORE_UNAVAILABLE`. All callers already fail closed on any error other than a stale write.

## Checks (Node v24.21.0)

| Check | Before | After |
|---|---|---|
| In-process retention suites (ledger-suppression, planning-execution-recovery, policy-inventory, storage) | 15/15 at base | 15/15 (2 assertions intentionally corrected) |
| New synthetic `purge-safety` and `postgres-journal-lease` | n/a | 11/11 |
| All non-PG retention files together | n/a | 26/26 |
| Dependents: `apps/runtime/test/prepared-candidate-startup.test.mjs`, `apps/control/conversations/test/retention-serving.test.mjs` | n/a | 7/7 |
| Real PostgreSQL 16, `postgres-journal-pg.test.mjs` (`--test-concurrency=1`) | 5/5 on the final code before the new controls | 7/7 |

**Real PostgreSQL conditions.** The cluster was already running, task-owned and socket-only (`listen_addresses` empty) on `/tmp/meri-broker-pg-socket-20261014`, with migrations already applied; I executed no migration. Before the runs it had no other client sessions. After the runs it had no other client sessions and no advisory locks.

**Reverted-fix proof.** Each fix was temporarily reverted and the tests rerun; the source was then restored from git.

| Reverted | Tests that fail |
|---|---|
| Planner block | DA-1 counterexample; on real PostgreSQL, DA-1 test 6 |
| Executor preflight | DA-1 preflight |
| Per-step marking and recording | Both DA-1 per-step tests, plus the updated execution test |
| Adapter row preflight | DA-1 adapter routing |
| Lease handling reverted to the DA-1-only adapter | 5 of 6 synthetic lease tests (the clean-reuse control still passes); real PostgreSQL tests 6 and 7 |

## Not run, and why

- **Real S3 deletion and version-absence semantics.** No bucket and no authorization. The in-memory bucket and an injected `send` port are synthetic.
- **Network- or driver-level faults.** The real-PostgreSQL fault controls inject lost replies with a client wrapper around real connections. They are not packet loss, server crash or failover tests.
- **Ledger durability.** The ledger sink is the in-memory test sink; there is no write-once ledger sink.
- **Restore of real backups, all retained data classes, startup fencing, and an authoritative ledger owner at startup.** These are separate items in the README matrix row and are outside this lane.

## Proposals for dot

1. Bound `rows.present` and `ownerOf` client-side as well. They use `pool.query`; pg-pool already destroys a failed client, but a stalled reply is not bounded on the client side.
2. Once the product composes the purge executor, give the per-step UNKNOWN projection a size review. Each step marker rewrites the subject's purge rows, which is quadratic in the number of steps. That is acceptable for the current per-subject target counts, but should be checked before plans can reach thousands of steps.

## Residual risks

- `recordUncertain` is best effort. If both its ledger append and its projection fail, the `EFFECTS_STARTED` entry and the per-step UNKNOWN markers already written still stand, but the specific failure reason is not recorded.
- When recovery handles a never-attempted `PENDING` step whose object is still present, it reports it as `REVIVED` and re-plans. The behaviour is correct, but the label is imprecise.
- The audit's remaining items in the "Retention, deletion and restore" row (a startup recovery owner, a serving fence with a recovered watermark, the complete data-class inventory, restored-backup tests) remain open. Live purge stays inactive.
