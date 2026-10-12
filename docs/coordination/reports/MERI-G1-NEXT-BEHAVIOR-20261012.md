# G1 next behavior author report — 12 October 2026

Base `690bac4cd44112b161d8e02818aeae7639ce237a`; branch `task/meri-g1-next-behavior-20261012`.

## First source change: exact-current owner revocation

`FixtureRegistry.revokeRun({context, peer})` now allows trusted control-owner cancellation before any checkpoint. It reuses the existing run/grant transaction, schema and one-way transition. `state/revocation.mjs` owns canonical inert snapshotting, historical admission integrity and full-current comparison; the registry remains the persistence owner. Existing migration/contract/lock bytes and original tests are unchanged. No worker HTTP route or live owner caller is wired.

Historical integrity is validated at the original admitted instant. This does not authorize operation use: an expired exact current context can revoke, while future admission relative to the database clock, stale binding, wrong peer, altered actor/tenant/policy/pins/clocks or inconsistent grant fail before mutation. Revocation changes only ACTIVE to REVOKED with PostgreSQL timestamp. Exact repeats read ALREADY_REVOKED without UPDATE. No resurrection, expiry extension, budget refund, checkpoint requirement or automatic uncertain-commit retry was added. An unknown acknowledgement propagates; later explicit owner readback through the same exact method can establish the revoked state.

Author checks: new local revocation6/6 PASS; original handler6/6 PASS; combined new revocation/original handler/private fixture contract+wire40/40 PASS; real-engine file syntax PASS; whitespace PASS. The first preserved handler command also named a nonexistent credential-resolution test path; Node ran only the6 handlers, and no credential test coverage is claimed. Local dependencies were copied from the previous owned, ignore-scripts installation after root package-lock byte equality, with no new package or lock changes.

`baseline-revocation.json` preserves the original method list showing no standalone revocation. Raw test stdout/stderr are in `docs/qualification/candidates/g1-next-behavior-20261012/author/`. Existing tests cover replacement revocation and mocked handler denial; they do not directly update REVOKED via raw SQL.

New explicitly gated PostgreSQL tests cover concurrent revocations, immutable repeat timestamp, authorization refusal, no checkpoint prerequisite, unknown acknowledgement/readback and wrong binding/peer rollback. These tests are UNRUN: no database was started, connected, migrated or changed. Concurrency, durability, physical revocation, native task identity and G1 runtime remain HOLD. Existing Aurora selection, Temporal ownership, SDK loop and disabled source connectivity remain unchanged.

## Next allocated change

Checkpoint handler cancellation/fresh release checks will be delivered as a separate commit. Reviewer frozen baseline controls show missing pre-abort/late-abort/late-expiry handling across several ports; this is source behavior evidence, not a claim of an observed production output leak. Existing service dependency and transaction owners remain unchanged.
