# Meri W02-03 Temporal compatibility package

Preparation for the production Temporal design decision: an **inert** TypeScript
fixture that is compiled and statically checked against the exact pinned
`@temporalio/*` 1.24.0 packages, plus a five-role deployment fixture validated
against prohibited-boundary cases.

This is PREPARATION ONLY. Nothing here is a deployed server, database, Fargate
task or namespace. No connection is opened, no Worker is created, no workflow or
activity runs, and no SDK/model/browser/Office/AWS call is made. G1 stays
incomplete and W03 stays blocked until Codex independently reviews this and the
later live gates execute.

## Layout

```
package.json               private ESM package; five exact @temporalio 1.24.0 deps
package-lock.json          nested lockfile (npm ci from this lock only)
.gitignore                 ignores node_modules/, .runtime/, *.tsbuildinfo
tsconfig.json              strict NodeNext, noEmit
client-options.ts          real ConnectionOptions / NativeConnectionOptions TLS + JWT builders
activities.ts              inert activity interface (heartbeat/echo), @temporalio/activity
workflow.ts                deterministic workflow: activity, signal, query, timer, cancel, continue-as-new
negative-types.ts          @ts-expect-error fixtures + positive controls
deployment.fixture.json    five-role topology + 20 prohibited boundary cases
compatibility.test.mjs     canonical OFFLINE tests (node --test)
component-pins.json        server/SDK/schema/compiler pins with integrities
```

## Commands

Offline, deterministic, hermetic (no server/DB/Docker/model/browser/Office/AWS):

```
npm --prefix apps/control/qualification-temporal run check
# = tsc --noEmit -p tsconfig.json  &&  node --test compatibility.test.mjs
npm --prefix apps/control/qualification-temporal run typecheck   # tsc only
npm --prefix apps/control/qualification-temporal test            # node --test only
```

The install that produced `package-lock.json` used `--ignore-scripts` (scripts
disabled). Do not add @swc/core native build steps or run the Temporal core.

## What the offline checks establish

- The five direct packages and the compiler/type pins are exact, locked with
  sha512 integrity, and agree across package.json / package-lock.json /
  component-pins.json.
- The installed 1.24.0 declarations really contain the asserted members
  (`WorkerDeploymentOptions` requiring `defaultVersioningBehavior` when
  `useWorkerVersioning:true` and `?: never` otherwise, `TLSConfig`
  (`serverNameOverride`/`serverRootCACertificate`/`clientCertPair`), `apiKey`,
  `VersioningBehavior`, `WorkerDeploymentVersion`, and the workflow API).
- `negative-types.ts` compiles only because every `@ts-expect-error` is used
  (a relaxed API turns the directive into a TS2578 failure) while the positive
  controls compile — verified by a real `tsc` run in the tests and a separate
  expected-diagnostic check.
- The five-role fixture validates cleanly, and all 20 prohibited boundary cases
  (missing/extra role, worker-role admin/default-authorizer, internal-frontend
  external ingress/duplicate audience/conversation ingress, empty audience,
  missing JWKS, zero key refresh, dual ingress, disabled TLS, package mismatch,
  disabled internode mTLS, schema mismatch, hostname-verification off, unseparated
  store roles, conversation ingress, non-positive shard count) are rejected with
  the expected rule.

## Design encoded (see docs/qualification/PROXY-TEMPORAL-DECISIONS.md)

- Five private server roles: frontend, history, matching, internal-worker,
  internal-frontend. Two replicas per role; 128 history shards as an explicit
  pre-boot candidate (immutable after first boot).
- Trusted application orchestration clients reach ONLY the external authenticated
  frontend over TLS with hostname verification, presenting a short-lived bearer
  (JWT) minted by the dedicated workload issuer with bounded expiry and a
  nonempty audience. Internode/server roles use mutual TLS only.
- The internal frontend is internode-only; its stock internal claim mapper
  grants system admin and must never accept application/conversation ingress.
- Trusted application workers deliberately need `namespace:write` (RoleWriter4);
  RoleWorker1 cannot perform poll/complete/heartbeat with the default authorizer.
  Namespace/task-queue permissions are not a tenant/client wall — business
  authorization stays gateway-controlled.
- New Multi-AZ encrypted RDS PostgreSQL 16.15 candidate, `postgres12` plugin,
  primary schema v1.19 / visibility schema v1.14, separate store roles, TLS
  hostname verification and a distinct migration identity.
- Provisional per-role CPU/memory/DB-connection ceilings are explicit provisional
  choices, not measured capacity.

## Not run here (live gates — none claimed)

Server/admin-tools image pull, signature verification and scan disposition; any
Temporal connection (client or native); Worker.create/run; workflow/activity
execution, signal/timer/cancel/continue-as-new at runtime; history replay;
sequential minor upgrade drill; PostgreSQL/RDS provisioning, schema migration and
restore/PITR; namespace registration; default JWT authorizer/issuer/audience/JWKS
live behavior; internode mTLS and service discovery; replay/cancel/replacement/
approval/schedule fixtures; measured startup/memory/disk/timings/cost; Fargate
placement. Local compile results cannot pass these gates. No proxy acceptance is
implied by anything in this package.
