# W02-03 Temporal design & offline compatibility — independent review

Reviewer: separate real Hermes review session `20261009_175809_821a18`.
Reviewed base: exact commit `d96168bd1a05511533dc0b63e622d0dd56f30526`
(`fix: verify actual Temporal boundary and late cancellation fixtures`) on
`hermes/w02-temporal-review`,
worktree `C:\dev\main\meri-greenfield-worktrees\w02-temporal-review`.
Scope: production DESIGN and offline exact-version compatibility acceptance
only. This is **not** runtime HA / proxy / G1 acceptance. No implementation
edits, install, native Temporal core, server, connect, cloud, model, browser,
Office, source or credential calls; no push/amend/delegation/global settings.

Owner-written file (mine): this report only. Reviewed branches' `d96168b` is the
frozen reviewed base; my single report commit is the branch HEAD this report is
committed in (recorded by the launcher, since a report cannot embed its own SHA
without amend).

## Verdict

**DESIGN / PREPARATION-ONLY ACCEPT — recommended for Codex integration-owner
acceptance.** No concrete offline or design blocker was found. Nothing here
advances a live gate; the many NOT RUN live checks remain the correct and
sufficient disclosure for a design/compile task.

## Owned-path and protection check

`git diff --name-status 7af0a53..d96168b` changes **exactly the 14 owned paths**
(12 in `apps/control/qualification-temporal/`, `docs/qualification/PROXY-TEMPORAL-DECISIONS.md`,
`docs/coordination/reports/W02-03-TEMPORAL-COMPATIBILITY.md`) and nothing else.
No root/shared lockfile, contract, infra, launcher, task-brief or other-worker
path was touched. `git status --porcelain` is clean at `d96168b`. `git diff
--check` is clean (exit 0). No migration ID was allocated.

The `d96168b` thin fix (`git diff --stat 0f38128..d96168b`) touches 6 owned files
only (README, compatibility.test.mjs, deployment.fixture.json, workflow.ts, the
compat report, the design doc). It is correctly attributed in three places to
the **Codex owner** after the 0f38128 writer closed — not to the Hermes 0f38128
implementation output.

## Checks I ran (exact, this session)

| Check | Command | Result |
| --- | --- | --- |
| Root suite | `npm run check` | 15 tests, 15 pass, 0 fail (exit 0) |
| Nested typecheck | `npm --prefix apps/control/qualification-temporal run typecheck` | exit 0 |
| Nested offline tests | `npm --prefix apps/control/qualification-temporal test` (`node --test`) | 22 tests, 22 pass, 0 fail (exit 0) |
| Whitespace | `git diff --check` | clean (exit 0) |

Counts match the brief: **22 nested tests, 43 prohibited cases, 15 root tests.**
`prohibitedCases.length` read directly = 43.

## Independent reproduction of the rejected defects (I did not trust the tests alone)

I extracted the **shipped** `validateDeployment` function verbatim from
`compatibility.test.mjs` into a reviewer-only harness (in an ignored `.runtime`,
since removed) and re-applied the exact mutations named in the brief:

- `baseline.ok = true`, `reasons = []` (clean fixture validates).
- worker-only `namespaceRole:"worker"` → **R6** rejected; `workerOnlyRoleAllowedByDefaultAuthorizer:true` → **R6** rejected.
- empty `frontend.authorizer` → **R13** rejected.
- `frontend` and `internal-frontend` `mtls.requireClientAuth:false` → **R10** rejected.
- **actual `publicClient:{hostPort:...}` object** → **R11** rejected (via `Object.hasOwn(cfg,'publicClient')`, not the synthetic flag — the specific 0f38128 leak is genuinely closed); synthetic `publicClientOverride:true` → also R11.
- `database.multiAz:false`, `encrypted:false`, `newResources:false` → **R14** rejected.
- stores missing visibility, `schemaPrimaryVersion:"1.18"`, `plugin:"mysql"` → **R2** rejected.
- `server.imageAmd64Digest`, `server.configDigest`, `server.imageIndexDigest`, `server.sourceCommit`, `server.version` mismatches → **R12** rejected (all five pin keys).
- `internal-worker.temporalRole` wrong → **R15**; `history.ingress:"external"` → **R5**.

Result: **20/20 named mutations rejected with the expected rule** (exit 0).

## Design facts independently confirmed against the fixture source

- Exactly five private Fargate server roles frontend/history/matching/internal-worker/internal-frontend (R1); `internal-worker.temporalRole:"worker"` maps the Fargate service to the real Temporal role (R15).
- Only `frontend` is external ingress; the other four internode-only (R5). Every role: TLS+hostname verification (R2), mTLS enabled + `requireClientAuth:true` (R10).
- `frontend` uses explicit `claimMapper:"default"` / `authorizer:"default"` with nonempty `audience` and dedicated HTTPS JWKS + positive `keyRefreshSeconds` (R3/R13).
- `internal-frontend`: internode-only, no external audience, `claimMapper:"internal"`, `stockInternalMapperGrantsSystemAdmin:true`, `acceptsConversationIngress:false` (R4).
- No `publicClient` override; `publicClientOverride:false` (R11).
- Trusted app workers require `namespaceRole:"write"` (RoleWriter4); fixture + all three docs disclose that this grants **broader namespace write authority than a tenant/client wall** and that business authorization stays gateway-controlled, and that `RoleWorker1` cannot poll/complete/heartbeat with the default authorizer.
- New encrypted Multi-AZ independent DB, `postgres12` plugin, primary schema 1.19 / visibility 1.14, two stores, separate roles, distinct migration identity, TLS hostname verification (R2/R9/R14).
- 128 history shards (immutable post-boot), two replicas per role, two trusted app-worker replicas, explicit **provisional** per-role CPU/memory/DB-connection ceilings (not measured capacity).

## Type/compiler and workflow control-flow verification (not regex-only)

- `client-options.ts` builds real `ConnectionOptions` and **`NativeConnectionOptions`** with `tls: buildTlsConfig(...)` **and** `apiKey` bearer (`buildApplicationWorkerConnectionOptions`), and documents `buildInternodeNativeConnectionOptions` as server/internode-only, explicitly **not** app-worker auth. The external builder ignores/`apiKey` type surfaces are asserted against the installed 1.24.0 `.d.ts`.
- PINNED versioning enforced by real `tsc`: the fixture typechecks cleanly (a relaxed API would turn any `@ts-expect-error` into TS2578 and fail), plus a separate expected-diagnostic run that fails a missing `defaultVersioningBehavior` and compiles a correct one. `@types/node 24.19.2`, `typescript 5.9.3`.
- The offline harness `ts.transpileModule`s the **actual** `workflow.ts` and runs it under deterministic stubs; the `require` hook asserts the only runtime import is `@temporalio/workflow` and returns stubs — **no real Temporal/native-core/server module is initialized**. It exercises: 3-stage checkpoint loop; `planContinuation` 0→one Continue-as-New, 1→complete, negatives/non-integers/unsafe rejected; invalid continuation counter throws `UnsafeContinuation`; approval authority comes only from the trusted `collectApproval` activity (note signal records only; no `approvalSignal`); cancellation at `sleep3`/`checkpoint3` stops **before** publication and **before** Continue-as-New.
- Cancel injected inside an already-dispatched `publishArtifact` is observed **after** publication (publication count = 1) and still prevents Continue-as-New; the limitation that a signal arriving during an already-dispatched activity **cannot undo that effect** is disclosed in the README, compat report and design doc.

## Design-document updates

`PROXY-TEMPORAL-DECISIONS.md` (owned) adds/updates: the corrected five-role topology and internal-admin boundary; the corrected `RoleWriter4` namespace-write fact; the disclosed default-JWT-mapper limitation (`common/authorization/{roles.go,default_authorizer.go}`, `common/api/metadata.go`: no independent issuer-string match and no required `exp` presence — bounded expiry must be minted, live ingress must be fixture-verified, not assumed); the accepted Bedrock D004 row (US-only Sonnet 4.6, $10 aggregate cap); the still-**unaccepted** exact LiteLLM release/digest; exact component pins; provisional sizing; and an explicit "G1 scope: design acceptance now, runtime/HA/recovery later" section. All NOT RUN live gates are disclosed.

## NOT RUN (explicit; none claimed) and out of scope

Server/admin-tools image pull, signature verification, scan disposition; any
Temporal connection (client/native); `Worker.create`/`run`; workflow/activity/
signal/timer/cancel/Continue-as-New at runtime; history replay; sequential minor
upgrade drill; PostgreSQL/RDS provisioning, schema migration, restore/PITR/
failover; namespace registration; live default JWT authorizer/issuer/audience/
JWKS enforcement; internode mTLS/service discovery; measured startup/memory/
disk/timings/cost; Fargate placement; model/provider calls; proxy acceptance;
non-root browser sandbox; any Capiro source access or cutover. Runtime HA,
proxy and G1 acceptance are **not** part of this review and are **not** asserted
as design prerequisites — they remain later foundation/staging gates.

## Limitations / minor observations (non-blocking)

1. The brief references `docs/coordination/reports/W02-03-CODEX-REVIEW-FIRST.md`,
   but **that file does not exist** in the tree or any local branch (only
   W02-01 and W02-02 CODEX-REVIEW-FIRST are committed). The e67f17e/0f38128
   rejection content is instead recorded in the README, the compat report and
   the design-doc "Repair disclosure" sections, with no standalone preserved
   0f38128 review artifact. Documentation-reference gap only, not a design defect.
2. In `compatibility.test.mjs` the `@ts-expect-error` **count** floor (`>=15`) is
   met partly by a prose mention on `negative-types.ts` line 3; the file carries
   14 real directives. Actual enforcement is nonetheless genuine and fail-closed
   because the separate `tsc --noEmit` run fails (TS2578) if any directive is
   unused — so all 14 are required. Weak count assertion, real guarantee holds.
3. Minor wording imprecision in the compat report's process-state note (it
   describes a `tsc --outDir .runtime/out`; the tests actually write
   `.runtime/expect-{fail,pass}.ts` with `--noEmit` and `rmSync` them). No
   emitted artifact or leaked scratch remains.

## Attribution

`d96168b` thin fixes (actual `publicClient` object rejection, `configDigest`
binding, worker-only authorizer field rename, late-cancellation re-checks before
publication/continuation, and the stub-driven workflow control-flow tests) are
**Codex-owner** changes after the 0f38128 writer closed, exactly as disclosed —
not Hermes 0f38128 output. This review is a separate real Hermes session.
