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

## Second source change: cancellation and final release

Revocation is frozen separately at `7831e5c0780ffaf233b81867b0e250bdbf02fbbd`. The next commit changes only the allocated handler/README plus new cancellation tests and owned evidence/docs.

Handlers check the abort signal and canonical current request-context lifetime at entry and around every awaited port. Final response validation uses the fresh injected clock after the last port. An expired original producer remains historical lineage for a valid current B load/verification. The canonical validator continues refusing expired stale-A authorization requests. No validator or original test is changed. Parked operations are not forcibly stopped by these checks: physical teardown and database cancellation remain owner obligations.

Author cancellation baseline:12 groups,3 PASS/9 FAIL, retained unchanged. Initial repair: new12 plus original6 handler groups18/18 PASS. Root review then identified loss of the unknown-commit marker if cancellation, expiry or a read failure occurred during parked reconciliation. Three added strict identity controls reproduced that defect (12 PASS/3 FAIL). The repair rethrows the original CommitUncertain on those failures without further calls. Foreign/invalid receipt readback yields typed CommitUncertain with the existing content-free FIXTURE_SERVICE_REFUSED code, preserving the original negative assertion and unknown-commit liability. No raw cause values are included; no automatic retry or inferred rollback is introduced.

Final focused checks56/56 PASS: revocation6, cancellation16, original handlers6, existing private fixture contract/wire28. Root check initially243 PASS/1 FAIL because the isolated checkout lacked contracts-package esbuild. Raw failure is preserved. Restoring prior owned contracts dependencies after exact package.json/package-lock equality resolved setup: root244/244 PASS. Public package generated-byte check, typecheck and7 public tests PASS. Those broad checks preceded only the narrow reconciliation repair; final56 includes the repaired source. PostgreSQL test syntax PASS; database tests and native/live effects remain UNRUN. Source/doc whitespace PASS.

Final evidence includes source hashes and the list of changed base-tracked files. All base files outside allocated state registry/README and service handlers/README remain byte-identical. Original tests, migrations, dependency locks, public/private schemas and capability registry remain unchanged. All owned commands were foreground, bounded and awaited; no service, database or background process was started. Independent review and integration acceptance belong to the parent. Source implementation does not close G1 runtime.
