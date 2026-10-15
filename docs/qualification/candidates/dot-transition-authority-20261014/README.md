# Bounded transition source candidate

Status: SOURCE REVIEW ONLY; Linux/PostgreSQL and complete two-turn acceptance remain on HOLD. This candidate follows public review head `454fb4020aa07c6d56cbabd02b78afe5ebdb9dcb`. The published Git commit and tree supplied by the source owner are the qualification pin; no image or deployment acceptance transfers.

The session owner now has an optional internal transition-verification port. It preserves original identity, native context lineage, scopes, source binding and expiry while authenticating one canonical source-to-target mapping. It does not expose a new HTTP route or renew the source session. The journal rechecks current target authority, admission and retirement under ordered source/target locks. Dispatch uses the minimum original/session/target/admission/retirement deadline; actual Temporal connection deadline and abort scopes contain every effectful RPC. APPLIED readback is bounded and effect free. Uncertain effects stay UNKNOWN and cannot redispatch. Missing trusted target authority or its dedicated context resolver refuses execution. The ordinary CLI supplies neither automatically. A fixed-conversation resolver refuses cross-conversation forks.

Migration 0009 remains unallocated source. Its amendment validates positive integral safe writer fences, complete retained event history, redundant canonical event identity, and safe sequence totals; it serializes event mutations and range closure. The explicit SQL isolation contract is READ COMMITTED. An empty draft with zero events and zero counter is retained, but the application still creates its initial queued event. New PG regressions use separately created random databases, exact ownership/OID cleanup, and require attested isolated PG16 with no TCP listener and an exact expected data directory. No migration or PostgreSQL test ran on this host. The next-run PG fixture now supplies a distinct capability digest per allocated grant.

## Local evidence

All tests used Windows Node 24.19.0 and existing dependencies. Linux qualification requires its separately pinned Node 24.21.0. Overlapping groups must not be summed as independent coverage.

| Gate | Result | Evidence |
| --- | --- | --- |
| Session/context/native authority | 170 passed | session-context.txt |
| Composed journal/session/actual Temporal adapter | 31 passed (20 composed, 11 transport) | composed-temporal.txt |
| Owner control regression group | 124 passed, then final 20 composed passed | source owner command below |
| Ordinary session HTTP and application adapters | 35 passed | source owner observation |
| Runtime composition | 12 passed, 3 failed | runtime-composition.txt |
| First-run mount | 9 passed after required source-root environment | first-run-mount-corrected.txt; initial failure retained |
| Committed-source proof | 5 passed before final publication; rechecked at publication | candidate manifest and source-proof.test.mjs |
| Conversations typecheck | host OOM; no successful result | owner observation |
| Migration/real PG | NOT RUN here | Linux validator required |

The runtime failures are Windows/POSIX boundaries: one SIGTERM exit expectation and two unavailable process.getuid calls. Linux UID enforcement remains unchanged. The Temporal tests exercise installed Connection prototype scope and generated RPC implementation with an in-memory unary transport; no Temporal server or provider call was made.

Focused commands (run from checkout; set MERI_REVIEW_SOURCE_ROOT to that checkout):

```sh
node --test --test-isolation=none --test-concurrency=1 apps/control/action-host/session/transition-owner.test.mjs apps/control/action-host/session/owner-independent.test.mjs apps/control/action-host/application-adapters/context-independent.test.mjs apps/runtime/native-authority/test/identity-context.test.mjs
node --test --test-isolation=none --test-concurrency=1 apps/control/conversations/test/temporal-dispatch.test.mjs apps/control/conversations/test/lifecycle-transition.test.mjs
node --test --test-isolation=none --test-concurrency=1 apps/control/conversations/test/lifecycle-transition.test.mjs apps/control/conversations/test/application.test.mjs apps/control/conversations/test/lifecycle.test.mjs apps/control/conversations/test/lifecycle-inspection.test.mjs apps/control/conversations/test/lifecycle-workflow.test.mjs apps/control/conversations/test/next-run-owner.test.mjs apps/control/conversations/test/store.test.mjs apps/control/conversations/test/completion.test.mjs apps/control/conversations/test/native-prepared-launch.test.mjs apps/control/conversations/test/stream.test.mjs
```

## Required Linux follow-up

Use the existing isolated Linux qualification plan, the new exact published HEAD/tree, fresh private PostgreSQL16, and unchanged locks. Run both typechecks and all previous validator groups again, plus the new transition/session/Temporal groups. Run sequence-range-migration-pg.test.mjs separately and serially against its attested private server. Set MERI_SEQUENCE_MIGRATION_TEST_ISOLATED=1 and MERI_SEQUENCE_MIGRATION_TEST_DATA_DIRECTORY to its exact private server data directory, in addition to the plan's exact private inspection socket/database. These values attest existing isolation; they do not authorize using a shared cluster. Preserve every failure and verify all owned processes stop.

The previous Linux result at 454fb40 was not acceptance: seven next-run PG failures exposed the now-corrected synthetic digest collision; independent SQL probes exposed the migration gaps addressed here. Both require rerun. The new SQL regression has not yet established its own correctness by execution. Independent source review and passing mocked tests do not substitute for it.

No AWS, model calls, new credentials, shared database migrations, builds or live resource writes were performed. No external source capability issuer has been selected or bound; the injected issuer remains a trusted composition dependency. Public cursor/listing and general historical session reconciliation remain deferred.
