# Fable lane: clean-checkout dependency ownership and reproducible suite setup, 15 October 2026

Answers follow-up item 3 of dot's [package-two review](https://github.com/neo-capiro/meri-greenfield/blob/a5dccb19a28e1b68a7e831a97bccf858c0af12c2/docs/coordination/audits/meri-comprehensive-20261015/PACKAGE2-REVIEW-20261015.md) and the dependency/reproducibility sections of the [integration review](https://github.com/neo-capiro/meri-greenfield/blob/a5dccb19a28e1b68a7e831a97bccf858c0af12c2/docs/coordination/audits/meri-comprehensive-20261015/PACKAGE2-INTEGRATION-REVIEW.md): runtime dependency ownership, reproducible suite setup and the exact `MERI_REVIEW_SOURCE_ROOT`. Branch `fable/s4-clean-checkout-20261015`, base `28f76264` (package two). HOLD until dot reviews the exact pin; nothing is deployed, activated or migrated.

## Outline

- **Owner.** The image recipe (`apps/runtime/Dockerfile`, unchanged) installs the S3 SDK only with `apps/artifacts/storage` (3.1141.0) and the Agent SDK only with `apps/worker/conversation` (0.3.295), and links both into root `node_modules` so runtime code resolves those single copies. The canonical owners are therefore storage and the conversation worker, not `apps/runtime`.
- **Seam.** Each owner gets one small module that re-exports, from its own pinned install, exactly the upstream names its cross-package callers use: `apps/artifacts/storage/s3-sdk.mjs` (`S3Client` and the four commands the adapter sends) and `apps/worker/conversation/agent-sdk.mjs` (`query`, `createSdkMcpServer`, `InMemorySessionStore`). Runtime callers import those by relative path, as they already import `s3-objects.mjs`. Credential selection stays with the runtime CLI: storage still selects no default credential chain (its README contract).
- **Why not declare S3 in `apps/runtime`.** A second runtime-owned copy would split the image's single copy. `native-authority/test/checkpoint-capture.test.mjs` checks `instanceof` against the commands storage's adapter builds, which is false across two installs. An ESM re-export keeps one module instance; `createRequire(...).resolve` would pick the CommonJS build and also break identity. So no lockfile change was needed, and none was made.
- **Guard.** `scripts/qualification/local-baseline/dependency-ownership.test.mjs` fails on any first-party bare import that the nearest `package.json` or the root does not declare. It lists the remaining known cases per file with their owner decision and fails on stale entries. It skips `docs/` and `evidence/` directories, which hold immutable historical evidence.
- **Procedure.** `scripts/qualification/local-baseline/clean-checkout.sh` installs every package lock with the recipe's flags in dependency order, then runs the existing `run-suites.mjs`. That runner already sets `MERI_REVIEW_SOURCE_ROOT` exactly and scrubs ambient credentials. The durable-invocation review harness that asserts "explicit source root required" is listed with its hash in `docs/qualification/candidates/durable-invocation-20261012/review/evidence-manifest.json`, so it is historical evidence and stays unchanged.

## Changes

| Commit | What |
|---|---|
| `e9d5cd32` | `apps/artifacts/storage/s3-sdk.mjs` (new), storage README; `apps/runtime/prepared-candidate.mjs` and `native-authority/test/checkpoint-capture.test.mjs` import the S3 classes from it |
| `ccc650e3` | `apps/worker/conversation/agent-sdk.mjs` (new); `native-authority/sdk-query-preparation.mjs` (still a dynamic import), `test/runner-query.test.mjs` and `test/sdk-continuation-bootstrap.test.mjs` load it |
| `6722a7c9` | dependency-ownership guard test |
| `eafcb769` | `clean-checkout.sh` with its test, a "Clean checkout" section in `scripts/qualification/local-baseline/README.md`, and a one-line pointer in the root README |

**Lockfile diff: none.** `apps/runtime/package.json` and `apps/runtime/package-lock.json` are unchanged. The lane's lockfile exception was not used, for the reason above.

**Source-proof row changed (no candidate manifest created):** `apps/runtime/prepared-candidate.mjs`, old `b69fb73c10302cab199278b2318479f3f27074bd487d8bd8110195f1b7b7e8bb`, new `4b6e422cadfa8d8c47598b84e13ece487f9476b1cadda982f4654ed6e39db5df`. One line changed: the S3 import moved to the storage owner. `source-proof.test.mjs` fails 1/5, only on this row (the candidate-e row assertion). No other changed file is a proof row. The `Dockerfile` row is unchanged. The new modules sit outside every `.dockerignore` exclusion, so `COPY apps ./apps` includes them. The image-closure Docker control could not run here because there is no Docker daemon.

## Undeclared direct imports (scan of all first-party sources outside `docs/` and `evidence/`)

| Package | Import | Files | Clean checkout | Outcome |
|---|---|---|---|---|
| `apps/runtime` | `@aws-sdk/client-s3` | `prepared-candidate.mjs`, `native-authority/test/checkpoint-capture.test.mjs` | ERR_MODULE_NOT_FOUND | **fixed** (storage seam) |
| `apps/runtime` | `@anthropic-ai/claude-agent-sdk` | `native-authority/sdk-query-preparation.mjs`, `native-authority/test/runner-query.test.mjs`, `native-authority/test/sdk-continuation-bootstrap.test.mjs` | ERR_MODULE_NOT_FOUND | **fixed** (worker seam) |
| `apps/runtime` | `@anthropic-ai/claude-agent-sdk` (types) | `selected/test/sdk-types.ts` | not run by any suite | kept: type-only fixture of frozen evidence (`selected/evidence/frozen-sdk-types.json`); a `.mjs` seam carries no types under that ad hoc tsc command |
| `apps/control/conversations` | `pg` | six `test/*-pg.test.mjs` | ERR_MODULE_NOT_FOUND (also need a database) | proposal 1 |
| `apps/control/conversations` | `@temporalio/common` | `test/lifecycle-workflow.test.mjs` | resolves (transitive 1.24.0) | proposal 1 |
| `apps/worker/conversation` | `zod` | `skills/mcp.mjs` (product) | resolves (auto-installed SDK peer 4.6.7) | proposal 2 |
| `apps/worker/conversation` | `@modelcontextprotocol/sdk` | `skills/test/mcp.test.mjs`, `skills/test/selected-runtime.test.mjs` | resolves (auto-installed SDK peer 1.32.1) | proposal 2 |
| `apps/worker/qualification` | `zod` | `probes/sdk-capture.mjs`, `probes/sdk-discovery-tools.test.mjs` | resolves (transitive 4.6.5) | proposal 2 |
| root-owned (no nearer package) | `jszip` | `apps/artifacts/test/artifact-adapters-independent.test.mjs`, `apps/artifacts/test/artifact-execution.test.mjs` | `Cannot find module 'jszip'` | proposal 3 |
| root-owned | `pg` | `apps/gateway/test/postgres-budget-native-fixture.mjs`, `scripts/local-action/cli.mjs` | loaded only with a real database | proposal 3 |

Historical evidence under `docs/qualification/` also imports `pg`, `pg-connection-string`, `jszip`, `typescript`, `@aws-sdk/client-s3` and `@capiro/meri-contracts` without a declaring package. It is immutable and only reported here.

## Clean-checkout proof

The commit after `eafcb769` adds only this report. A pristine `git archive eafcb769` export was made in a fresh scratch directory with no symlinks (`find -type l` empty), then `clean-checkout.sh --out <receipts> --allow-root` was run there. Host: Node v24.21.0, npm 11.19.0, Linux, root user, no Docker daemon, no PostgreSQL clusters, three ambient `AWS_*` variables present on the host and scrubbed from every suite. All 13 package locks installed with `npm ci --ignore-scripts --no-audit --no-fund` through the registry proxy, with no credentials.

The before column is the same procedure from a pristine export of base `28f76264`, using the same runner and no root links. That run was stopped during `control-action-host` to free disk space (shared host at 100%), so its later suites have no before value.

Counts are pass/tests. A file that fails at import counts as one test, so the counts grow once such a file loads.

| Suite | Before (base) | After (`eafcb769`) | Notes |
|---|---|---|---|
| source-proof | 5/5 | 4/5 | the `prepared-candidate.mjs` row only (above) |
| contracts-package-check | exit 1 | exit 1 | pre-existing generated drift (below) |
| root-check | 4241/4241 | 4241/4241 | |
| sdk-evidence | exit 0 | exit 0 | |
| runtime-typecheck | exit 0 | exit 0 | |
| runtime-tests | 168/177, 9 fail | **198/205, 7 fail** | prepared-candidate files no longer fail with ERR_MODULE_NOT_FOUND; 7 environment |
| conversations-typecheck | exit 0 | exit 0 | |
| conversations-tests | 180/198, 18 fail | 181/198, 17 fail | `pg` undeclared plus no database |
| conversations-skills | 33/33 | 33/33 | |
| worker-conversation | 203/203 | 203/203 | |
| native-authority | 300/340, 40 fail | **314/349, 35 fail** | Agent SDK and S3 import failures gone; 35 real-PostgreSQL |
| runtime-selected | 20/20 | 20/20 | |
| runtime-artifacts | 26/26 | 26/26 | |
| gateway | 802/802 | 802/802 | |
| gateway-budget | 27/27 | 27/27 | |
| gateway-sources | 315/315 | 315/315 | |
| gateway-local-action | 44/44 | 44/44 | |
| gateway-selected-skills | 36/36 | 36/36 | |
| artifacts | 315/319, 3 fail, 1 skip | 312/319, 6 fail, 1 skip | `jszip` ×2; LibreOffice cleanup ×1 before, ×4 after; skip is the SOFFICE opt-in |
| control-core | 260/260 | 260/260 | |
| control-retention | 26/33, 7 fail | 26/33, 7 fail | real-PostgreSQL |
| control-action-host | stopped (hung 20+ min in `local/recovery-independent.test.mjs`) | 328/386, 58 fail | 57 need the host git fixture `/tmp/capiro-endpoint-integration-source-20261013.git`; 1 timing (`runner total deadline settles…`) |
| control-action-application | not run | 124/124 | |
| control-action-followthrough | not run | 55/55 | |
| control-admitted-runs | not run | 85/85 | |
| control-commands | not run | 76/76 | |
| control-document-application | not run | 260/261, 1 fail | `actual HTTP Word draft…` returns `ARTIFACT_BUDGET_SETTLEMENT_UNKNOWN`. It reproduces with this lane's two changed product files reverted to base, so it is independent of this lane |
| control-schedules | not run | 134/134 | |
| control-task-lookup | not run | 158/158 | |
| control-qualified-application | not run | 362/393, 31 fail | host fixture `/tmp/meri-qualified-lifecycle-deps/jsonata.cjs` absent |
| control-staging-e2e | not run | 13/13 | |
| control-qualification-sdk-fixture | not run | 65/71, 6 fail | missing synthetic ingress certificates (`.task-inputs/…`) and `EXPLICIT_ISOLATED_DATABASE_EXECUTION_REQUIRED` |
| control-qualification-temporal | not run | exit 0 | |
| proxy-qualification | not run | 29/29 | |
| window-resolution | not run | 35/35 | |
| skills | not run | 63/63 | |
| evals | not run | 204/204 | |
| scripts-local | not run | 33/33 | includes the new guard and clean-checkout tests |

After totals (runner `RESULTS.json`): 38 suites, 27 passed; 9236 tests, 9066 pass, 169 fail. Supplied `MERI_REVIEW_SOURCE_ROOT` was the export root.

The runtime prepared-candidate files that previously failed at import now load and pass: `prepared-candidate.test.mjs` plus `prepared-candidate-config.test.mjs` give **30/30**. Within native-authority, `checkpoint-capture` gives **17/17**, `runner-query` **5/5** and `sdk-continuation-bootstrap` **10/10**. Each was rerun on its own in the export with a scrubbed environment and `MERI_REVIEW_SOURCE_ROOT` set to the export. With the fixes reverted (the base run), all of them fail with `ERR_MODULE_NOT_FOUND`. The guard test also fails with the S3 fix reverted (`apps/runtime @aws-sdk/client-s3`), and on the base it fails on the Agent SDK rows.

## Remaining failures, all visible in the receipts

- **Runtime, 7 (environment):** image closure needs a Docker daemon. Three `process` runner tests and `runner-bootstrap-files` fail on the root user (`RUNNER_WORKSPACE_REFUSED`); ambient AWS variables never reach them. Two PostgreSQL tests get `ECONNREFUSED` on the canonical local socket.
- **Native authority, 35:** all real-PostgreSQL `ECONNREFUSED`.
- **Conversations, 17:** six `*-pg` files cannot find `pg` (proposal 1); the rest are real-PostgreSQL `ECONNREFUSED`. The base run's 18th failure (`parked continued RPC …`, `LIFECYCLE_EFFECT_UNKNOWN`) did not recur. It is timing-sensitive under load and was not touched here.
- **Retention, 7:** real-PostgreSQL `ECONNREFUSED`.
- **Artifacts:** two files need `jszip` (proposal 3). The rest are `ARTIFACT_CLEANUP_FAILED` from LibreOffice process-group cleanup on this host: 4 here, 1 in the base run. Artifact code is untouched.
- **Contracts package check:** `Generated drift: document-application.metadata.json` at the base already. `apps/control/document-application/current.mjs` changed in `847cd4b3` (retention read gate) without regenerating `packages/contracts/dist`. This is a pre-existing contracts-owner item.
- **Host fixtures:** action host (git fixture), qualified application (`jsonata.cjs`) and the SDK fixture (certificates, isolated database) need host inputs that a clean checkout does not create. The receipts keep each one visible.

## Proposals for dot (not implemented; lockfile changes need approval)

1. `apps/control/conversations`: declare `pg` (devDependency, exact version per dot; runtime pins 8.23.1, storage 8.23.0) and `@temporalio/common` 1.24.0, then regenerate its lock.
2. `apps/worker/conversation`: declare `zod` 4.6.7 (the SDK peer that `skills/mcp.mjs` uses directly) and `@modelcontextprotocol/sdk` 1.32.1 (dev), matching the existing locked versions. `apps/worker/qualification`: declare `zod` 4.6.5.
3. Root-owned files in `apps/artifacts/test`, `apps/gateway/test` and `scripts/local-action`: decide an owner (the root devDependencies, or move them under a package) for `jszip` and `pg`. Until then `link-dependencies.sh` remains the documented comparison-only link step.
4. Image owner: runtime code no longer resolves `@aws-sdk/client-s3` or `@anthropic-ai/claude-agent-sdk` through the recipe's root links. The links are now redundant for first-party runtime code but harmless. Dropping them means changing the hashed `Dockerfile` row and the image-closure alias assertion, so it belongs in an image-candidate change, not this lane.
5. `docs/COMPONENTS.md` lists `@aws-sdk/client-s3` 3.1148.0. The installed pins are storage 3.1141.0 (image) and the qualification SDK fixture 3.1149.0. Reconcile the registry row.
6. Source proof: record a new candidate manifest for the `prepared-candidate.mjs` row above at integration.

## Not run

Docker image build and closure, real PostgreSQL suites (`provision-postgres.sh` not started), non-root runner workspace checks, native LibreOffice cleanup qualification, and any AWS, SDK provider or Temporal server call. None is needed for this lane's source claim or possible offline. Disk-space pressure on the shared host stopped the base run early, as noted.

## Cleanup

After the run, both scratch export trees and their `node_modules` were removed. The receipts (`RESULTS.json` and per-suite output) stay in the session scratchpad and are not committed. No processes started by this lane remain. The worktree `/home/user/meri-s4-clean` is kept for review.
