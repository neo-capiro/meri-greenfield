# Temporal issuer source checkpoint for Fable

This is a portable, source-only checkpoint. It is stacked directly on Meri draft
PR #126, commit `5a979d13dd9c3eae6a3a5fa160b5f0b4423081c4` (tree
`742d506de5e6b5cce0ba0a1d5503b870d7f8fde7`). Bind this document through
the published successor's exact commit/tree; a committed file cannot contain
its own commit hash. The initial PR
#126 is historical for its 443 listener and old static issuer material path;
these successor bytes select `0.0.0.0:8445` and strict `/run/meri/<filename>`
owner-only direct-child material paths. No live task, key, certificate, AWS
resource, PostgreSQL cluster, migration or credential was created here.

## Source included

- Issuer owned subtree `apps/runtime/temporal-issuer/`: exact 8445 URL/JWT
  issuer join, direct TLS peer IPv4 authority, startup/material/KMS/HTTP/PG
  pending-work receipts, fail-closed cleanup, and stricter primary PostgreSQL
  writer-role/ACL probe. Existing central migration is unchanged, blob
  `607929b14678283f62ef4945cf350f3427ec7917`.
- `qualification/AWS-CHANGESET-20261017.md`: proposed stopped-service two-stage
  AWS security/network/material plan. It is **not an executed change set**.
- `qualification/{README.md,run-isolated.ps1,qualify.mjs}`: fixed-path,
  task-owned PostgreSQL 16.15 native qualification plan. It requires an exact
  reviewed source HEAD, separate approval and the released heavy process
  window before use. It is **UNRUN**.

The root Meri runtime owner owns its CLI, canonical material initializer,
`/run/meri/issuer.json`, Temporal bootstrap/rotation, dynamic task-local
`/run/meri-temporal/identity` volume, Dockerfile and deployment renderer. This
checkpoint does not claim those bytes or a mounted runnable service. The
canonical static issuer material proposal is exact-version secret input to the
existing material init only; it writes 0600 owner-1000 direct-child connection,
server key/cert, client CA and bootstrap CA-key files under `/run/meri`, then
exits successfully before the issuer main's read-only mount. No static client
identity is presealed. Control and worker obtain distinct dynamic certificates
post-placement, in their own writable volume.

## Verified source and review boundary

Nine focused issuer Node 24 files passed 100/100 on 2026-10-17. The PG
qualifier passed `node --check`, the PowerShell runner passed AST parsing, and
`git diff --check` passed. Earlier independent source reviewers accepted the
bounded cleanup, port, privilege-probe and AWS plan portions; the final
combined successor and native PG harness have **no independent exact-tree
acceptance or native execution**. The static harness review completed manually
after reviewer agents hit a usage limit. The prior first combined issuer test
run had one pre-aborted-proof regression; its targeted repair passed the next
run and is included here. Neither source checks nor the historical PR #126
qualification prove this new runtime composition, SQL, TLS, AWS or Temporal
integration in an actual service.

The exact scratch design is `task-3/issuer-pg16-qualification-20261017`,
127.0.0.1:56457, database `meri_issuer_native_qual`, 8 minutes, 400 MiB
cluster, 2 GiB pre-init/1.5 GiB post-start free-space floors. The script
authenticates the newly started cluster's data directory, PID, address, port,
database and primary status before its first DB write; uses disposable SCRAM
credentials and a nonowner role; runs only central migration 0001; and
verifies cleanup against the exact owned root/port while preserving host 5432.
At checkpoint there is no scratch root or 56457 listener, and no task-owned
`apps/runtime/node_modules/pg`. The task-owned frozen npm install is likewise
UNRUN. Do not copy/link the old Meri checkout's node_modules; its lock/version
metadata was read only and does not attest installed bytes.

## Remaining executable gates

1. Root Meri owner must publish and independently review the final composed
   CLI/material/bootstrap/rotation/deployment source, including the 8445 SG
   egress and nondefault-port issuer/JWKS URL renderer. Bind its exact source
   commit/tree and full image digest before any runtime claim.
2. Request separate approval for the exact task-owned frozen dependency
   install and then, only after the frontend heavy window is released, for
   local disposable PG execution of `run-isolated.ps1` at the reviewed head.
   This source packet performed neither action. Native proof must include
   terminal cleanup and original failures.
3. AWS Stage A/B, Aurora role/migration/grants, exact material/version IDs,
   KMS signer/JWK, issuer certificate authority custody, ECS current-task
   proof, SG/NAT access, Temporal stock JWKS refresh and namespace permissions
   require their respective owner approvals and live qualification. Proposed
   issuer service starts with desired count 0. No image build, paid attempt,
   AWS mutation, application DB write, traffic enablement or deployment is
   authorized by this document.
4. Keep Core first-chat PR #48, Meri first-chat runtime and Objective lanes
   separate. The issuer authenticates service tasks for Temporal namespace
   writer tokens; it does not grant end-user tenant/client authority.

Approval request for the future local test, after exact HEAD review and a
released resource window: approve a task-owned, frozen Node 24 runtime
`npm ci --omit=dev --ignore-scripts --no-audit --no-fund` with a fresh task-3
cache, followed by one 8-minute capped PostgreSQL 16.15 scratch run only at
`127.0.0.1:56457` applying the allocated
`apps/runtime/temporal-issuer/migrations/0001_service_task_registrations.sql`
to `meri_issuer_native_qual`; approve creation and retirement of two disposable
local passwords and the source checks/cleanup stated in the README. The
approval must name this successor's exact reviewed 40-character HEAD. It does
not authorize any application/AWS database, live credentials, deployment or
paid AWS operation.
