# PostgreSQL custody safe-stop checkpoint

**INCOMPLETE / UNQUALIFIED / DO NOT MOUNT OR EXECUTE.** Neo and the primary Meri
owner requested source preservation and handoff to Fable during implementation.
This checkpoint preserves every current allocated file. It is not completed
PostgreSQL custody, runtime integration or acceptance of database durability.
Meri implementation edits stopped at this checkpoint; Fable owns continuation.

The source-only central reservation is
[93838193c46a13b2fdda9dee9c142d1af0e60cba](https://github.com/neo-capiro/meri-greenfield/blob/93838193c46a13b2fdda9dee9c142d1af0e60cba/docs/coordination/tasks/CODEX-PACKAGE4-CENTRAL-MIGRATION-ALLOCATIONS-20261016.md),
ledger blob `03ad26a0c11e0a34fcc577ed568a8c8b5990cd7d`.
Only `apps/runtime/objective-source/migrations/0001_objective_custody.sql`,
independent schema `meri_objective_source`, table `custody` were reserved.
Conversation `0018` and held gaps were not allocated or changed.

## Preserved state

- `migrations/0001_objective_custody.sql`: source written after allocation.
  Source review checked global job/issuance keys, canonical foreign keys,
  private record/scalar equality, claim-one/commit-two immutability and
  delete/truncate refusal. **Never applied or natively qualified.**
- `postgres-records.mjs` and `postgres-records.test.mjs`: pure canonical row,
  source equality, reverse comparator and column projection helpers. Author's
  focused Node24.19 result **13/13** covers corruption, expiry, exact source
  and CLAIMED-data suppression. These tests use synthetic rows and execute
  no SQL. They do not qualify the new adapter or migration.
- `postgres-custody.mjs`: **unfinished** default-off borrowed-pool adapter with
  parameterized tenant-qualified reads, canonical source comparisons, two
  write phases and reverse lookup. Preserved without import, syntax check or
  test execution. No production binding or mount was added.
- `test/postgres-custody-fixture.mjs`: unfinished synthetic pool fixture,
  preserved without execution. It is not a database or concurrency proof.
- `postgres-custody.test.mjs`: **not created** before safe-stop.

## Known unresolved defects and missing qualification

The adapter lacks sticky uncertainty protection against returning `ABSENT`
after an ambiguous claim commit. Durable CLAIMED rows must remain UNKNOWN;
an unresolved same-instance result cannot silently become absence. The adapter
also lacks a final operation cancellation/deadline check after transaction
cleanup, allowing a late-abort release race. These were source observations,
not passing or failing adapter test results. Fix and cover them before use.

The entire adapter needs focused review and tests for exact replay, global job
and issuance collisions, seven-field source mismatch, both commit phases,
lost acknowledgements, late connections/queries, reverse lookup, active expiry
and fresh historical authorization with the actual custody owner. Additional
defects may remain: implementation was interrupted before its first checks.

Native PostgreSQL syntax, triggers, nonowner privileges, races, isolation,
uncertain COMMIT, rollback and backup/restore are **UNRUN**. No native cluster,
credential, role, grant, migration execution, startup mount, build or cloud
change was authorized or performed for this increment.

## Existing qualified source remains separately pinned

[PR127](https://github.com/neo-capiro/meri-greenfield/pull/127)
`d1512708859f97b6aa7369dfcc8dd9f6448de911`, tree
`ca3bb8005b497e63e408d6e9de9b3ca856decdf0`, retains its original **130/130**
factory/source evidence and independent six-case rerun using ECS SDK3.1151.0.
Those tests use synthetic credentials, CAS and native replies. They do not
qualify this PostgreSQL increment. No old result is relabeled at this source.

Shared first-chat preparation/replay/reconstruction remains unreceived. The
portable [shared-splice proposal](SHARED-SPLICE-PROPOSAL.md) describes the
required receiving patch; do not infer owner acceptance from its publication.
Actual native authority, durable replay ownership, retained capture, retention
classification/suppression, credential bindings and HTTP mounts remain held.
