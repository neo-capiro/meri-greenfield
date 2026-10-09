# W02-03 Temporal design and offline compatibility — implementation report

Status: **READY FOR REVIEW**. Not an acceptance. Compilation and local fixtures only; every live gate below stays NOT RUN. Codex and a separate real Hermes session own acceptance.

## Authority and bounds

- Task brief: `docs/coordination/tasks/W02-03-TEMPORAL-COMPATIBILITY.md`; repository rules: `AGENTS.md`.
- Base/parent commit: `7af0a53a38cc8663441487e339cbc3c720c8ebf3` (branch `hermes/w02-temporal`, worktree `C:\dev\main\meri-greenfield-worktrees\w02-temporal`).
- Implementation session: `20261009_171204_d65a88` (one bounded attempt; continuation of the same session after a clean 40-turn stop, within the 24-turn/1800 s continuation bound). No amend, no push, no recursive delegation, no self-resume.
- Implementation commit: the HEAD this report is committed in, on `hermes/w02-temporal`. Exact SHA is recorded in the launcher handoff (a report cannot embed its own commit SHA without amend).
- Scratch/cache limited to the owned nested `apps/control/qualification-temporal/.runtime` (ignored). Dependencies installed with scripts disabled (`npm install --ignore-scripts`); no native Temporal core executed.

## Owned paths delivered (14)

```
apps/control/qualification-temporal/package.json
apps/control/qualification-temporal/package-lock.json
apps/control/qualification-temporal/.gitignore
apps/control/qualification-temporal/tsconfig.json
apps/control/qualification-temporal/client-options.ts
apps/control/qualification-temporal/workflow.ts
apps/control/qualification-temporal/activities.ts
apps/control/qualification-temporal/negative-types.ts
apps/control/qualification-temporal/deployment.fixture.json
apps/control/qualification-temporal/compatibility.test.mjs
apps/control/qualification-temporal/component-pins.json
apps/control/qualification-temporal/README.md
docs/qualification/PROXY-TEMPORAL-DECISIONS.md            (temporary exclusive documentation ownership)
docs/coordination/reports/W02-03-TEMPORAL-COMPATIBILITY.md (this report)
```

No root/shared lock, contract, infra, launcher, task-brief or other-worker path was touched. No migration ID was allocated.

## Check results (actual, this session)

| Check | Command | Result |
| --- | --- | --- |
| Root suite | `npm run check` | 15 tests, 15 pass, 0 fail (exit 0) |
| Nested typecheck | `npm --prefix apps/control/qualification-temporal run typecheck` (`tsc --noEmit`) | exit 0 |
| Nested offline tests | `npm --prefix apps/control/qualification-temporal test` (`node --test`) | 16 tests, 16 pass, 0 fail (exit 0) |
| Whitespace | `git diff --check` (intent-to-add staged) | clean (exit 0) |

The 16 nested tests cover: exact pin/lock/`component-pins.json` agreement; the installed 1.24.0 `.d.ts` really declaring `WorkerDeploymentOptions` (requiring `defaultVersioningBehavior` when `useWorkerVersioning:true`, `?: never` when false), `TLSConfig`, `apiKey`, `VersioningBehavior`, `WorkerDeploymentVersion` and the workflow API; the inert source fixtures referencing those real symbols and staying deterministic; the five-role fixture validating cleanly; all 20 prohibited boundary cases rejected with the expected rule; the fixture compiling cleanly (so every `@ts-expect-error` is used); and a real expected-diagnostic run proving a missing `defaultVersioningBehavior` fails while a correct one compiles.

## Source and pin observations (recorded, not run)

- Temporal server 1.32.1 (released 2026-10-08, branch `release/v1.32.x`), source commit `af08a5e5f2dd40f545f2afac7780daaa6987001e`; image index `sha256:acecbab5…029049`, linux/amd64 `sha256:2695f256…21b2de0e`, config `sha256:40cc19ca…3307b10`; image user `temporal`, license MIT. Admin-tools 1.32.1 same commit, CLI 1.9.1. Recorded in `component-pins.json`; not signature-verified or scan-dispositioned.
- TypeScript SDK 1.24.0, source commit `1fd1c81a0383f5f5c7923dd735472c7d1ffdc867`; `@temporalio/{client,worker,workflow,activity,common,proto,nexus,core-bridge}` all exact `1.24.0` (MIT, sha512 integrity in the nested lock); Node floor >= 20.3.0, target `x86_64-unknown-linux-gnu`.
- Compiler pinned to `typescript 5.9.3`, types to `@types/node 24.19.2` (SDK repo declares `typescript ^5.6.3`; the 7.x native port is not used). Exact integrities recorded.
- Server postgres12 primary schema v1.19 / visibility v1.14; RDS PostgreSQL 16.15 is an owner candidate (read-only `DescribeDBEngineVersions` observed available/postgres16, us-east-1, 9 Oct 2026). No database created; no migration executed.

## Design content and corrections (shared document)

`docs/qualification/PROXY-TEMPORAL-DECISIONS.md` was updated to: (1) correct the role-authorization error — RoleWorker1 cannot poll/complete/heartbeat with the default authorizer, trusted app workers require `namespace:write` (RoleWriter4), documented as broader than a tenant wall; (2) add the fifth `internal-frontend` role (five private roles total) with its stock internal system-admin boundary, internode-only/mTLS reachability and the no-`publicClient`-override rule; (3) record the issuer/audience/JWKS and TLS limitations (default mapper does not independently enforce issuer matching or `exp` presence; live ingress must be verified later); (4) record the accepted Bedrock US-only Sonnet4.6 / $10 aggregate cap (D004) and the still-unaccepted exact LiteLLM release; (5) add the exact server/SDK/schema/RDS candidate pins; (6) add provisional sizing (explicit provisional ceilings, 10-run benchmark, 128 pre-boot shards); and (7) state the G1 design-acceptance-vs-later-runtime/HA/recovery scope split. The inert fixture (`client-options.ts`, `workflow.ts`, `negative-types.ts`, `deployment.fixture.json`) encodes the same five-role/authorization/TLS/JWT/versioning decisions.

## NOT RUN live gates (none claimed)

Server/admin-tools image pull, signature verification, scan disposition; any Temporal connection (client or native); `Worker.create`/`run`; workflow/activity/signal/timer/cancel/Continue-as-New execution; history replay; sequential minor upgrade drill; PostgreSQL/RDS provisioning, schema migration, restore/PITR/failover; namespace registration; live default JWT authorizer/issuer/audience/JWKS enforcement; internode mTLS and service discovery; replay/cancel/replacement/approval/schedule fixtures; measured startup/memory/disk/timings/cost; Fargate placement; model/provider calls (Bedrock spend remains $0); proxy acceptance; non-root browser sandbox; any Capiro source access or cutover. Local compilation cannot pass these gates.

## Process / worktree state

Clean process tree (no background processes started; `tsc`/`node --test` child processes exited within their checks). Ignored `node_modules/` and `.runtime/` only under the owned package; no servers, containers or native core. G1 remains IN PROGRESS; W03 remains queued; no gate promoted; no production, durability or proxy-acceptance claim.
