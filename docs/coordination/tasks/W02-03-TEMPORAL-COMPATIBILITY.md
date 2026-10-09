# W02-03 Temporal production design and offline compatibility

Owner/acceptance: Codex; implementation: one new bounded real Hermes session. Base is the exact integration commit containing this brief, supplied by launcher/query. Dedicated branch `hermes/w02-temporal`, worktree `C:\dev\main\meri-greenfield-worktrees\w02-temporal`.

Objective: qualify the production Temporal design decision and pinned TypeScript option compatibility needed by G1. Full HA deployment, migrations, API authentication, failover/PITR, replay and upgrade drills remain foundation/staging work. No live gate is implied by compilation.

Dependencies: frozen contracts `7a44d5750a68d4c2873d4d3b5b7c3e7f5e1a87b3`; accepted H00; owner candidate design in `docs/qualification/PROXY-TEMPORAL-DECISIONS.md`. W03 remains queued until all W02/G1 checks pass. No current Capiro/Meri implementation or infrastructure imports.

Owned exact paths:

- `apps/control/qualification-temporal/package.json`
- `apps/control/qualification-temporal/package-lock.json`
- `apps/control/qualification-temporal/.gitignore`
- `apps/control/qualification-temporal/tsconfig.json`
- `apps/control/qualification-temporal/client-options.ts`
- `apps/control/qualification-temporal/workflow.ts`
- `apps/control/qualification-temporal/activities.ts`
- `apps/control/qualification-temporal/negative-types.ts`
- `apps/control/qualification-temporal/deployment.fixture.json`
- `apps/control/qualification-temporal/compatibility.test.mjs`
- `apps/control/qualification-temporal/component-pins.json`
- `apps/control/qualification-temporal/README.md`
- `docs/qualification/PROXY-TEMPORAL-DECISIONS.md` (temporary exclusive documentation ownership for this task)
- `docs/coordination/reports/W02-03-TEMPORAL-COMPATIBILITY.md`

Protect root/shared locks, contracts, infra, launchers, task briefs, other reports and all worker/proxy files. No migration IDs allocated. Scratch/cache only in owned nested `.runtime`, ignored; default tests offline. No servers/devserver downloads, migrations, credentials, source/private-data reads, AWS mutations/queries, model/Office/browser execution, push, recursive delegation, global settings or approval bypass. Public narrow npm/GitHub/Docker-registry source/metadata reads and existing configured Hermes inference are authorized. Install nested dependencies with scripts disabled; do not execute native worker core. One attempt <=3600seconds/40turns; partial honest if bounded work incomplete, no self-resume/retry.

Verified candidate evidence to independently inspect:

- Temporal server1.32.1 stable, source commit `af08a5e5f2dd40f545f2afac7780daaa6987001e`; server image index `sha256:acecbab5b0b8ae9cf4012b508866ca97feda3709577bf157b537239f40029049`, linux/amd64 `sha256:2695f2564ec51aa84232bf3fa59b31e2cce99bec437a64f5bc487cbe21b2de0e`, config `sha256:40cc19cacb6acbac3eaec7ea623b3d0f53448f387ea05d8fac8f596e23307b10`.
- Admin-tools1.32.1, same source commit; index `sha256:9ef0dc5b063bf4ffd5c1512de72e0e73e225bd2c7006a18ce69bd592a8862a83`, amd64 `sha256:4fdaf9122f8beb448c823976232f6616a8cd94687f6984eeaf25c2b1457d5fed`, config `sha256:2ba08fb4c3ab20fc96e08230557d507ab6e8dc0abee0d524e48e25f5097db86c`; image metadata user temporal/MIT, CLI1.9.1. No signature/scan/runtime acceptance.
- TypeScript SDK1.24.0 stable source `1fd1c81a0383f5f5c7923dd735472c7d1ffdc867`; all participating @temporalio client/worker/workflow/activity/common packages exact1.24.0, source API supports Node20/22/24, min20.3.0, target x86_64-unknown-linux-gnu. Resolve/pin exact compiler and @types/node24 metadata without root lock changes.
- Server postgres12 primary schema1.19 and visibility1.14 at `schema/postgresql/v12/version.go`. New RDS PostgreSQL16.15 is an owner candidate: read-only AWS DescribeDBEngineVersions returned available/postgres16 in us-east-1 on9Oct2026. No database created; actual image/schema/migration execution still unqualified.

Owner design selection for preparation (no infrastructure deployment): five private Fargate server roles frontend/history/matching/internal-worker/internal-frontend, separately restricted trusted application workers, no conversation executor Temporal ingress. New encrypted Multi-AZ RDS PostgreSQL16.15 primary+visibility logical databases with separate roles, TLS hostname verification, distinct trusted migration identity; new CA/JWKS/workload issuer credentials. Internode/frontend mTLS with requireClientAuth; external default JWT mapper/authorizer with nonempty audience and dedicated HTTPS JWKS/positive refresh. Internal frontend reachable only by internode services/certificates: its stock internal mapper grants system admin and must never accept application/conversation ingress. No publicClient override that forces system workers onto external authenticated frontend.

Correct two verified prior design errors using exact source: server1.32.1 RoleWorker1 cannot perform poll/complete/heartbeat AccessWrite APIs with default authorizer; trusted app workers deliberately need namespace:write (RoleWriter4), which grants broader namespace write authority. Document that limit; business authorization remains gateway-controlled, namespace/taskqueue is not tenant/client-wall policy. Source `common/authorization/{roles.go,default_authorizer.go}`, `common/api/metadata.go`. Four-role topology omitted system-worker authentication: exact `common/config/config.go`563–579 recommends internal-frontend with built-in authorization; `temporal/fx.go`/internal claim mapper document admin boundary. Default JWT mapper validates available time/audience/signature claims but does not independently require issuer matching or exp presence; dedicated issuer must always mint bounded expiry and later live fixture must verify actual ingress behavior. Do not claim stock enforcement beyond source.

Fixture sizing decision: synthetic benchmark10 concurrent runs, one namespace/task queue initially, 128history shards as an explicit candidate before first boot. Two replicas per server role and two trusted app-worker replicas across AZs are initial production design targets; conservative per-role CPU/memory/DB connection ceilings must be explicit provisional choices, not measured capacity or a promise. No deployment until exact capacity, cost and initialization configuration are independently reviewed. History shards cannot be changed after boot. Keep whole-instance PITR/retained keys plus both stores restored at one point, pinned worker versions/Continue-as-New/replay and sequential minor upgrade design; production RPO/RTO/retention/legal-hold remain owner decisions before their later gates.

Implement only inert fixtures and compilation: real Client/Connection/NativeConnection TLS/JWT option types, workerDeploymentOptions with useWorkerVersioningtrue and defaultVersioningBehavior PINNED plus exact version build/deployment identity; deterministic workflow with activity reference, signal, timer, cancellation and explicit Continue-as-New boundary. No SDK/model calls or I/O inside workflows; never call Worker.create/run or connect. Negative type fixtures must fail without required versioning behavior/wrong option shapes, enforced with @ts-expect-error or a separate expected diagnostic check that would fail if the API changed. Validate the five-role inert configuration against meaningful prohibited-boundary cases (worker-only role incorrectly accepted, public/internal ingress mixing, missing TLS/audience, mismatched packages/schema). Do not build a custom Temporal framework.

Update shared design document for accepted Bedrock US-only Sonnet4.6/$10 decision (currently stale undecided row), exact LiteLLM candidate remains unaccepted separately, corrected G1 design-vs-runtime scope and new pins/auth limits. Report checked hashes/licenses/source/version observations and every NOT RUN live gate. Run root npm run check, nested typecheck/tests, git diff --check. Commit only owned paths, no amend/push. Return exactSHA/sessionID/check counts/scope and process/worktree state, ready-for-review only; Codex + separate real Hermes review own acceptance.
