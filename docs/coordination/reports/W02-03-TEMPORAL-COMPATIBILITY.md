# W02-03 Temporal design and offline compatibility — implementation report (repair B)

Status: **READY FOR REVIEW**. Not an acceptance. Compilation and local fixtures only; every live gate below stays NOT RUN. Codex and a separate real Hermes session own acceptance.

## Authority and bounds

- Task brief: `docs/coordination/tasks/W02-03-TEMPORAL-COMPATIBILITY.md`; repository rules: `AGENTS.md`.
- Repair base: `e67f17e2df35b2d35e3bcb0899a95d57833fda63` (first W02-03 commit, **rejected**). Original base `7af0a53a38cc8663441487e339cbc3c720c8ebf3`. Branch `hermes/w02-temporal`, worktree `C:\dev\main\meri-greenfield-worktrees\w02-temporal`.
- Implementation session: `20261009_171204_d65a88` (bounded repair continuation). No amend, no push, no recursive delegation, no self-resume, no dependency reinstall, no native core/server/cloud/model/browser/Office execution.
- Implementation commit: the HEAD this report is committed in, on `hermes/w02-temporal` (exact SHA recorded in the launcher handoff; a report cannot embed its own commit SHA without amend).

## What was rejected at e67f17e and how it is repaired

Independent review reproduced the validator returning `ok:true` for accepted bad fixtures. Repairs:

| Rejected defect | Repair |
| --- | --- |
| `trustedApplicationWorkers.namespaceRole:"worker"` alone accepted | R6 now requires exactly `"write"` (RoleWriter4) and documents the broader-than-tenant-wall authority |
| empty `frontend.authorizer` accepted | R13 requires an explicit nonempty claimMapper **and** authorizer on every role; frontend must be exactly `default`/`default` |
| `frontend`/`internal-frontend` `mtls.requireClientAuth:false` accepted | R10 requires `mtls.enabled:true` **and** `mtls.requireClientAuth:true` on all five roles; baseline frontend fixed to `true` |
| prohibited `publicClient` override accepted | R11 rejects any `publicClientOverride` other than `false` |
| `database.multiAz:false` accepted | R14 requires new independent + encrypted + Multi-AZ database |
| top-level server digest not checked against pins | R12 compares `server.{version,sourceCommit,imageIndexDigest,imageAmd64Digest}` byte-for-byte to `component-pins.json`; a dedicated test also asserts fixture/pins equality; component-pins tests use exact string equality, not regex |
| test used invalid role `"default"` instead of the real worker-only false positive | prohibited case `worker_role_namespace_worker` now uses `namespaceRole:"worker"` |
| internode `NativeConnectionOptions` presented as app-worker auth | `client-options.ts` adds `buildApplicationWorkerConnectionOptions` (TLS **and** bearer against the external frontend); internode helper is documented server-only, not app-worker auth |
| workflow Continue-as-New unreachable (init 0, one increment, `>=3`) | `workflow.ts` runs a finite three-stage loop with a checkpoint+increment per stage and a bounded continuation counter: 0 -> one Continue-as-New, 1 -> complete, other/negative/unsafe rejected |
| signal could confer approval authority | approval authority now comes only from the trusted `collectApproval` activity; the note signal records an observation only |
| cancellation after the first condition not observed | `cancelRequested` is re-checked at every stage boundary (>=4 references) |

Prohibited coverage grew from 20 to **43** cases, each asserted to be rejected with its expected rule; a regression assertion requires cases for R6/R10/R11/R12/R13/R14. `internal-worker` now declares `temporalRole:"worker"` (R15), documenting the Fargate service -> real Temporal role mapping.

## Owned paths delivered (14)

```
apps/control/qualification-temporal/{package.json, package-lock.json, .gitignore, tsconfig.json,
  client-options.ts, workflow.ts, activities.ts, negative-types.ts, deployment.fixture.json,
  compatibility.test.mjs, component-pins.json, README.md}
docs/qualification/PROXY-TEMPORAL-DECISIONS.md            (temporary exclusive documentation ownership)
docs/coordination/reports/W02-03-TEMPORAL-COMPATIBILITY.md (this report)
```

No root/shared lock, contract, infra, launcher, task-brief or other-worker path was touched. No migration ID allocated.

## Check results (actual, this session)

| Check | Command | Result |
| --- | --- | --- |
| Root suite | `npm run check` | 15 tests, 15 pass, 0 fail (exit 0) |
| Nested typecheck | `npm --prefix apps/control/qualification-temporal run typecheck` (`tsc --noEmit`) | exit 0 |
| Nested offline tests | `npm --prefix apps/control/qualification-temporal test` (`node --test`) | 22 tests, 22 pass, 0 fail (exit 0) |
| Whitespace | `git diff --check` | clean (exit 0) |

Nested tests include: exact pin/lock/component-pins agreement; a byte-exact
fixture-vs-pins server comparison; the installed 1.24.0 `.d.ts` member
assertions; source-fixture symbol/determinism checks; the base five-role fixture
validating cleanly; all 43 prohibited boundary cases rejected with the expected
rule (covering every previously-accepted false positive); the fixture compiling
cleanly (all `@ts-expect-error` used); a real expected-diagnostic run; and an
in-memory transpiled actual-workflow tests with deterministic SDK/activity stubs: the bounded continuation table and cancellation at final sleep/checkpoint/publication. No real Temporal module/native core/server is loaded by that harness.

## Source and pin observations (recorded, not run)

- Temporal server 1.32.1 (2026-10-08, `release/v1.32.x`), source commit `af08a5e5…87001e`; image index `sha256:acecbab5…029049`, linux/amd64 `sha256:2695f256…21b2de0e`, config `sha256:40cc19ca…3307b10`; license MIT. Admin-tools 1.32.1, CLI 1.9.1. Not signature-verified or scan-dispositioned.
- TypeScript SDK 1.24.0, source commit `1fd1c81a…1ffdc867`; all `@temporalio/*` at 1.24.0 (MIT, sha512 in the nested lock); Node floor >= 20.3.0. Compiler `typescript 5.9.3`, types `@types/node 24.19.2`.
- Server postgres12 schema v1.19 / visibility v1.14; RDS PostgreSQL 16.15 owner candidate (read-only observation 9 Oct 2026). No database created; no migration executed.

## NOT RUN live gates (none claimed)

Server/admin-tools image pull, signature verification, scan disposition; any
Temporal connection (client or native); `Worker.create`/`run`; workflow/activity/
signal/timer/cancel/Continue-as-New execution; history replay; sequential minor
upgrade drill; PostgreSQL/RDS provisioning, schema migration, restore/PITR/
failover; namespace registration; live default JWT authorizer/issuer/audience/
JWKS enforcement; internode mTLS and service discovery; replay/cancel/replacement/
approval/schedule fixtures; measured startup/memory/disk/timings/cost; Fargate
placement; model/provider calls (Bedrock spend remains $0); proxy acceptance;
non-root browser sandbox; any Capiro source access or cutover. Local compilation
and the isolated pure-decision test cannot pass these gates.

## Process / worktree state

Clean process tree (only `tsc`/`node --test` children, exited within their
checks; the pure-decision test's `tsc --outDir .runtime/out` output is removed
after the run). Ignored `node_modules/` and `.runtime/` only under the owned
package. No servers, containers, native core, AWS, model, browser or Office
execution. G1 remains IN PROGRESS; W03 remains queued; no gate promoted; no
production, durability or proxy-acceptance claim.

## Owner thin-fix disclosure after rejected repair0f38128

Independent review found0f38128 still accepted the actual publicClient object despite checking a synthetic flag, and allowed late custom cancellation to reach publication/continuation. After its writer closed, Codex owner corrected the actual-object/configDigest boundaries, renamed the worker-only authorizer fact, checked cancellation after awaits/before publication/continuation, and added actual fixture control-flow regressions with deterministic SDK/activity stubs. Final owner typecheck plus22tests/43prohibited cases pass. These thin fixes and disclosure are Codex changes, not Hermes0f38128 implementation output. A cancel signal during an already-dispatched activity cannot undo that effect; the fixture observes it before further steps. Real Temporal cancellation/replay/durability/current-authority behavior remains unrun. Separate actual Hermes review and integration-owner acceptance are still required; no G1 or deployment promotion.
