# Qualification SDK fixture state registry

This is a source-only, trusted control-layer component for the partial `sdk-interruption-fixture-v1` experiment. It stores one current run/grant/fence/policy binding and one immutable original receipt identity in a dedicated PostgreSQL schema. It is not the product `Checkpoint` or a completed `SessionStore`.

## Ownership and call boundary

- `FixtureRegistry` is the transaction-level API. `admitRun({context, peer})` and `replaceRun({context, peer})` take canonical contexts issued by the trusted control plane after real actor and peer resolution. `authorize({presented, peer})` treats `presented` as a claim and compares it to the current row and the authenticated peer. Its `DENIED_STALE_BINDING` result is available only when the exact recorded old grant and old peer match; `current` identifies the fresh replacement, and the ingress must obtain its full canonical context from its own authority. Other authorization failures throw.
- `publishCommit({context, peer, receipt, readback})` atomically records a previously validated A receipt under the current A fence. The `readback` argument must be produced by a separate trusted object-store capability that actually reread the exact immutable bundle version and workspace bytes. Its `verified: true` field is not proof by itself. This module has no S3 access or object-key selector. It refuses a late A publication after B admission. A same-identity repeat reports `ALREADY_COMMITTED`; a different identity refuses.
- `readPublication({runUuid})` is a **trusted internal** reconciliation read for an uncertain COMMIT acknowledgement. It must not be exposed directly to workers. `loadCheckpoint` and `verifyCheckpoint` require the current B grant and exact committed A receipt reference; they return/compare identity and digests, not object bytes.
- `PostgresStore` owns one connection per transaction and uses PostgreSQL time after row locks. It never retries an ambiguous COMMIT. A `CommitUncertain` caller must reconcile by `readPublication`, compare the expected receipt identity, and refuse an unknown or foreign result. Database errors are content-free and do not authorize fallback state.

The private TLS ingress authenticates a socket certificate, bounds its wire and
uses this registry's fingerprint resolver for the admitted context/audience.
The source-level S3 adapter separately checks exact object versions and bytes.
Live task-bound credential issuance, native evidence/quiescence inspection,
deployed storage and actual two-task execution remain unproven. Workers must
receive no database credentials or storage privilege.

## Initialization and tests

The owner explicitly applies `migrations/0001_qualification_sdk_fixture_state.sql` once to a **new, dedicated qualification database** through `PostgresStore.migrateNewDatabase()`. There is no automatic migration, reset or destructive helper. The connection configuration requires a `meri_qualification_sdk_fixture...` database and verified TLS away from loopback. `pg` is pinned to 8.23.1 in this directory. The canonical private validator is imported from the repository's existing `packages/contracts` source.

Tests require a newly migrated isolated database and `MERI_FIXTURE_TEST_PORT`, `MERI_FIXTURE_TEST_DATABASE`, and `MERI_FIXTURE_TEST_USER`. Run with Node 24: `node --test apps/control/qualification-sdk-fixture/state/test/*.test.mjs`. Tests use unique synthetic run identities and never clear database state. The caller owns database creation and physical shutdown. Importing any module neither connects nor starts a process.

This partial source does not prove a live ECS-authenticated channel, S3
durability, native SDK interruption/resume, two Fargate tasks, physical
revocation or G1 acceptance.

`FixtureRegistry.resolveCertificate({fingerprintSha256, operation})` now reads
the verified mTLS socket fingerprint as an exact credential ID from the
existing grant history. It refuses unknown/duplicate fingerprints and
inconsistent run/grant rows, reconstructs the original A and current A/B
contexts under the run lock, and returns only that certificate's own audience.
An old A certificate may still reach the explicit stale-authorization path,
but it cannot present B's context. The subsequent operation transaction remains
the authority for current grant, fence, expiry and publication. An issuer must
still create unique short-lived certificates, bind their fingerprint to an
observed ECS task ARN during trusted admission, and deliver them safely; this
read-only resolver does not issue credentials or attest ECS possession.

## Trusted owner cancellation

`revokeRun({context, peer})` is an internal control-owner method, with no worker
HTTP route. The owner supplies the previously admitted canonical context and
resolved peer. Both are detached and frozen before the transaction. Historical
context validation at `admittedAtMs` checks integrity only; exact current expired
authority can be revoked, but the method never authorizes its use. Future
admission relative to database time refuses. Under run then current-grant locks,
every stored binding, pin, original clock, admission/expiry and peer must match.
A stale A input cannot revoke B. No committed checkpoint is required.

The existing one-way grant transition records PostgreSQL `clock_timestamp()`;
`REVOKED` changes no run, expiry, checkpoint or budget. An exact repeat reads
`ALREADY_REVOKED` without another UPDATE, preserving its original timestamp.
Ambiguous COMMIT propagates `CommitUncertain`: no automatic retry, refund or
success is inferred. A later explicit owner call with the same exact binding
can observe `ALREADY_REVOKED`; if the binding has advanced it refuses. Workers
remain subject to the existing current-grant resolver and authorization checks.
Live owner cancellation wiring and physical credential revocation are unimplemented.

Local source controls: `node --test apps/control/qualification-sdk-fixture/state/test/revocation.test.mjs`.
New real-engine controls additionally require explicit
`MERI_FIXTURE_REVOCATION_TEST_RUN=yes` and the existing isolated database settings;
run `node --test apps/control/qualification-sdk-fixture/state/test/revocation-postgres.test.mjs`.
They do not provision, migrate, reset or delete state. Their presence is not
proof of PostgreSQL concurrency, durability or native runtime qualification.
