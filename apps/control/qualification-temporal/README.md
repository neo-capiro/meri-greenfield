# Meri W02-03 Temporal compatibility package

Preparation for the production Temporal design decision: an **inert** TypeScript
fixture that is compiled and statically checked against the exact pinned
`@temporalio/*` 1.24.0 packages, plus a five-role deployment fixture validated
against prohibited-boundary cases.

This is PREPARATION ONLY. Nothing here is a deployed server, database, Fargate
task or namespace. No connection is opened, no Worker is created, no workflow or
activity runs (except one pure, Temporal-free helper in an isolated unit test),
and no SDK/model/browser/Office/AWS call is made. G1 stays incomplete and W03
stays blocked until Codex independently reviews this and the later live gates
execute.

## Layout

```
package.json               private ESM package; five exact @temporalio 1.24.0 deps
package-lock.json          nested lockfile (npm ci from this lock only)
.gitignore                 ignores node_modules/, .runtime/, *.tsbuildinfo
tsconfig.json              strict NodeNext, noEmit
client-options.ts          real ConnectionOptions/NativeConnectionOptions builders:
                           external client, TS application worker (TLS + bearer),
                           and a server-only internode mTLS helper (no bearer)
activities.ts              inert activity interface (heartbeat/echo), @temporalio/activity
workflow.ts                deterministic workflow + pure planContinuation helper
negative-types.ts          @ts-expect-error fixtures + positive controls
deployment.fixture.json    five-role topology + 41 prohibited boundary cases
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
disabled). Do not add native build steps or run the Temporal core.

## Repair history

The first commit `e67f17e` was **review-rejected**: its deployment validator
returned `ok:true` for several accepted bad fixtures (trusted app worker
`namespaceRole:"worker"` alone, an empty `frontend.authorizer`, `frontend`/
`internal-frontend` `mtls.requireClientAuth:false`, a `publicClient` override,
`database.multiAz:false`, and a top-level server digest that did not match
`component-pins.json`); the baseline itself set frontend `requireClientAuth:false`;
the workflow's Continue-as-New boundary was unreachable (increment once, compare
`>= 3`); and the internode `NativeConnectionOptions` builder was presented as if
it were application-worker auth. This package now fixes each: the validator
enforces explicit default mapper **and** authorizer, `requireClientAuth:true` on
all five roles, trusted-worker `namespaceRole` exactly `write`, no `publicClient`
override, independent new/encrypted/Multi-AZ database with bound plugin/schema/
stores, a top-level server pin compared byte-for-byte to `component-pins.json`,
and meaningful per-role ingress separation; `client-options.ts` adds a real TS
application-worker builder (TLS **and** bearer) and marks the internode helper
server-only; and `workflow.ts` runs a finite three-stage loop with a bounded
continuation counter (0=one Continue-as-New, 1=complete, else rejected).

## What the offline checks establish (18 tests, this session)

- The five direct packages and the compiler/type pins are exact, locked with
  sha512 integrity, and agree across package.json / package-lock.json /
  component-pins.json; the fixture's `server` block is byte-identical to the
  pinned server digests (exact equality, not a regex).
- The installed 1.24.0 declarations really contain the asserted members
  (`WorkerDeploymentOptions` requiring `defaultVersioningBehavior` when
  `useWorkerVersioning:true` and `?: never` otherwise; `TLSConfig`; `apiKey`;
  `VersioningBehavior`; `WorkerDeploymentVersion`; the workflow API).
- `negative-types.ts` compiles only because every `@ts-expect-error` is used
  (a relaxed API turns the directive into a TS2578 failure) while the positive
  controls compile — verified by a real `tsc` run plus a separate
  expected-diagnostic check.
- The five-role fixture validates cleanly, and all 41 prohibited boundary cases
  (missing/extra role; worker `namespace:worker`/admin/default-authorizer;
  missing trusted-workers; internal-frontend external ingress / duplicate
  audience / conversation ingress; empty audience; missing JWKS; zero key
  refresh; empty or missing frontend authorizer/claimMapper; frontend or
  internal-frontend `requireClientAuth:false`; missing/disabled internode mTLS;
  publicClient override; dual/external non-frontend ingress; disabled or missing
  TLS; package/schema mismatch; missing schema version; wrong plugin; missing
  visibility store; internal-worker role mapping; non-Multi-AZ/encrypted/new
  database; hostname-verification off; unseparated roles; conversation ingress;
  non-positive shards; server version/digest mismatch) are rejected with the
  expected rule.
- An isolated pure-decision test compiles `planContinuation` and asserts the
  bounded continuation policy: 0 -> Continue-as-New (next 1), 1 -> complete,
  and every negative/non-integer/unsafe value rejected.

## Design encoded (see docs/qualification/PROXY-TEMPORAL-DECISIONS.md)

- Five private server roles: frontend, history, matching, internal-worker
  (Temporal role `worker`), internal-frontend. Two replicas per role; 128
  history shards as an explicit pre-boot candidate (immutable after first boot).
- Frontend is the only external-ingress role; the other four are internode-only.
  Every role presents TLS with hostname verification and mTLS with
  `requireClientAuth:true`; the frontend uses explicit `claimMapper: default` and
  `authorizer: default` with a nonempty audience and dedicated HTTPS JWKS.
- Trusted application orchestration clients and TS application workers reach ONLY
  the external authenticated frontend, presenting a short-lived bearer (JWT)
  minted by the dedicated workload issuer with bounded expiry. Internode/server
  traffic is mTLS only (no bearer) and is not app-worker auth.
- The internal frontend is internode-only; its stock internal claim mapper
  grants system admin and must never accept application/conversation ingress.
  No `publicClient` override is present.
- Trusted application workers require `namespace:write` (RoleWriter4); RoleWorker1
  cannot perform poll/complete/heartbeat with the default authorizer, and
  namespace/task-queue permissions are not a tenant/client wall — business
  authorization stays gateway-controlled.
- New Multi-AZ encrypted RDS PostgreSQL 16.15 candidate, `postgres12` plugin,
  primary schema v1.19 / visibility schema v1.14, separate store roles, TLS
  hostname verification and a distinct migration identity.
- Provisional per-role CPU/memory/DB-connection ceilings are explicit provisional
  choices, not measured capacity.

## Not run here (live gates — none claimed)

Server/admin-tools image pull, signature verification and scan disposition; any
Temporal connection (client or native); `Worker.create`/`run`; workflow/activity
execution, signal/timer/cancel/Continue-as-New at runtime; history replay;
sequential minor upgrade drill; PostgreSQL/RDS provisioning, schema migration and
restore/PITR; namespace registration; default JWT authorizer/issuer/audience/JWKS
live behavior; internode mTLS and service discovery; replay/cancel/replacement/
approval/schedule fixtures; measured startup/memory/disk/timings/cost; Fargate
placement. Local compile results cannot pass these gates. No proxy acceptance is
implied by anything in this package.
