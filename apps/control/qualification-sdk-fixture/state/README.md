# Qualification SDK fixture state registry

This is a source-only, trusted control-layer component for the partial `sdk-interruption-fixture-v1` experiment. It stores one current run/grant/fence/policy binding and one immutable original receipt identity in a dedicated PostgreSQL schema. It is not the product `Checkpoint` or a completed `SessionStore`.

## Ownership and call boundary

- `FixtureRegistry` is the transaction-level API. `admitRun({context, peer})` and `replaceRun({context, peer})` take canonical contexts issued by the trusted control plane after real actor and peer resolution. `authorize({presented, peer})` treats `presented` as a claim and compares it to the current row and the authenticated peer. Its `DENIED_STALE_BINDING` result is available only when the exact recorded old grant and old peer match; `current` identifies the fresh replacement, and the ingress must obtain its full canonical context from its own authority. Other authorization failures throw.
- `publishCommit({context, peer, receipt, readback})` atomically records a previously validated A receipt under the current A fence. The `readback` argument must be produced by a separate trusted object-store capability that actually reread the exact immutable bundle version and workspace bytes. Its `verified: true` field is not proof by itself. This module has no S3 access or object-key selector. It refuses a late A publication after B admission. A same-identity repeat reports `ALREADY_COMMITTED`; a different identity refuses.
- `readPublication({runUuid})` is a **trusted internal** reconciliation read for an uncertain COMMIT acknowledgement. It must not be exposed directly to workers. `loadCheckpoint` and `verifyCheckpoint` require the current B grant and exact committed A receipt reference; they return/compare identity and digests, not object bytes.
- `PostgresStore` owns one connection per transaction and uses PostgreSQL time after row locks. It never retries an ambiguous COMMIT. A `CommitUncertain` caller must reconcile by `readPublication`, compare the expected receipt identity, and refuse an unknown or foreign result. Database errors are content-free and do not authorize fallback state.

The future private TLS ingress must authenticate the actual task/credential and audience, resolve canonical tenant/actor/run context independently of request fields, enforce live-stream byte limits and deadlines, and translate registry decisions to the fixed private wire. The future object-store integration must establish the actual immutable reread and byte digests, tenant/policy scope, evidence and quiescence. Neither capability is implemented here. Workers must receive no database credentials or storage privilege.

## Initialization and tests

The owner explicitly applies `migrations/0001_qualification_sdk_fixture_state.sql` once to a **new, dedicated qualification database** through `PostgresStore.migrateNewDatabase()`. There is no automatic migration, reset or destructive helper. The connection configuration requires a `meri_qualification_sdk_fixture...` database and verified TLS away from loopback. `pg` is pinned to 8.23.1 in this directory. The canonical private validator is imported from the repository's existing `packages/contracts` source.

Tests require a newly migrated isolated database and `MERI_FIXTURE_TEST_PORT`, `MERI_FIXTURE_TEST_DATABASE`, and `MERI_FIXTURE_TEST_USER`. Run with Node 24: `node --test apps/control/qualification-sdk-fixture/state/test/*.test.mjs`. Tests use unique synthetic run identities and never clear database state. The caller owns database creation and physical shutdown. Importing any module neither connects nor starts a process.

This partial source does not prove a real authenticated channel, S3 durability, native SDK interruption and resume, two Fargate tasks, physical revocation, or G1 acceptance.
