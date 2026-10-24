# Meri, Core and frontend preview shipping

Root Codex on **EC2AMAZ-M7CDRPT** owns qualification, integration, AWS operations
and live acceptance. Implementation and independent review use Astra 6 Ultra.
Apply [standing requirements](STANDING-REQUIREMENTS.md), the
[Wave 2 handover](WAVE-2-HANDOVER.md) and
[current validation workflow](CODEX-VALIDATION-AND-SHIPPING.md).

## Environment and release prerequisites

- AWS profile `default`, account `967807252336`, region `us-east-1`. Verify the
  caller before shipping; an explicit old `--profile capiro-dev` overrides an
  environment setting and must be corrected in a regenerated recipe.
- Local gates use WSL `Codex-Gates`, Ubuntu 24.04 and native Docker. Meri uses
  Node 24; Core and frontend use their own current locked image recipes.
- Every candidate needs independent exact-head review, required passing gates,
  an ARM64 image bound to its source, and exact-digest security scans with
  zero HIGH/CRITICAL findings. Record decisions for other findings.
- Current source, tests or a built image are not a shipping approval. Verify
  the final candidate after integration, then acquire the preview deploy lock
  on issue202. Never deploy during live acceptance.

## Meri runtime: approved AgentCore Runtime V1 cutover

Follow the [current migration and completion plan](plan/AGENTCORE-RUNTIME-MIGRATION-20261024.md). The target is the actual Claude Agent SDK on standard AgentCore Runtime V1 with isolated conversation sessions, existing durable SDK/artifact restore, current Core permissions and retained Temporal durability. It is approved work, not a claim that AgentCore is deployed. No V2 snapshots, custom warm pool, second model loop or automatic adoption of other AgentCore products.

Root integrates the exact runtime, control/public contract, infrastructure and frontend consumers through their existing owners. Read the final checked-in renderer/build/deployment contracts after that change; no new release command is defined by this document. Existing `image-buildspec.yml`/`image-build.sh` and native image probes may be reused only where their actual input/output contracts still apply. Delete their replaced Fargate-specific consumers rather than passing obsolete inputs to a new runtime.

Before cutover, qualify the exact clean source/tree and ARM image, native SDK/tools/14 skills and Python/JS artifact generation, contract distribution and actual nonowner SQL. Read back the selected V1 runtime version/endpoint, invocation authentication, runtime IAM, networking and control target. Bind the immutable image digest and runtime configuration in the reviewed packet. Do not treat an AgentCore session ID as user authorization or runtime disk as durable storage.

Keep image source and operator provenance explicit. A change only to a reviewed operator recipe need not rebuild unchanged runtime bytes; source/archive/image bindings must remain exact. Never rewrite prior inputs, claim a reconstructed previous state is an original receipt, or relabel the old ECS packet as an AgentCore packet. The release inventory must distinguish source, native tests, deployed service state and live behavior.

Root verifies current clone ledger and standard Temporal authentication/durability, takes a snapshot before any intended forward migration, and prepares fresh rollback from the last accepted release and live state. No schema/data drop follows automatically from this hosting change. Preserve required runs, schedules, consent, outcomes and uncertain-write recovery when removing custom task/authority wrappers.

Deploy in the existing locked preview window, with reviewed source/image/config and exact changed resources. Keep the accepted Fargate source/image/configuration only as a bounded cutover rollback. Root opens Meri and verifies first/second/third turns, actual prior context, reload/reconnect, idle restore, Stop, access loss, durable usage and affected data/features. An endpoint-ready or health response is not acceptance. If replacement fails, execute only the separately reviewed compatible rollback; do not mix host topologies or silently replay an uncertain effect.

After replacement acceptance, remove obsolete task families, RunTask/PassRole/task-router permissions, readiness/bootstrap/proof chains, old hosting flags/scripts/alarms and remaining model owner/proxy resources. Retire temporal-issuer only after standard Temporal auth is accepted. Complete the migration plan's exact caller/resource deletion inventory; retain applied migrations and historical evidence. Close the temporary rollback window explicitly rather than maintaining two active hosting stacks.

Fetch private inputs only for a current required owner, into owner-only scratch with tracing disabled. The SDK environment receives neither Core's service secret nor database credentials. Clean owned private material on success, failure, cancellation and timeout. Preserve scrubbed failure evidence.

### Historical Fargate release lineage

The previous direct-SDK transition used `infra/product-preview/first-chat/{render-material,stage3-deploy,stage3-bindings,ship-packet}.mjs`, three material bundles, four task families and issuer/app deployment. Its first05 transition required21 model-field retirements and a runner-role addition; original05 inputs were reconstructed from live evidence because the archive was not handed over. Those are historical topology-specific facts, not AgentCore prerequisites. Preserve exact prior receipts/inputs and compatible rollback provenance in private release evidence. Do not rerun model-pair steps or recreate removed measurement, PKI or launch tooling.

The currently implemented Fargate recipe may remain usable during the staged transition only for a separately reviewed compatible rollback or qualification of the unchanged baseline. Its existence does not make the migration complete. Old `neomart-kits` and dated copies are historical, not current executable release instructions.

## Core and frontend

Core integrates into `backend-import`; frontend integrates into `main`.
Regenerate release inputs from the exact reviewed head. The dated folders under
`shipping/core-kit/`, `shipping/ship-fe-kit/` and `shipping/neomart-kits/` provide
historical references, not authority to reuse old images, profiles, database
targets or rollback revisions.

Core requires its current production closure, native ARM image/import probes,
source gates and isolated PostgreSQL/migration rehearsals. Manifest, lockfile or
schema changes require the corresponding closure regeneration in source. Ship
paired API/frontend changes together when either side depends on the new shape.
Frontend additionally needs affected browser/accessibility and production-build
checks before its exact image and preview service update.

## Database, deployment and acceptance

Keep **one** persistent `capiro-newstack-preview-clone`. Never delete or re-clone
it and never migrate the shared live database. Before every forward migration,
take and verify a snapshot, inspect the clone's ledger and exact applied hashes,
and rehearse the intended chain in an isolated database. Applied SQL is immutable
history. Schema/data drops require a separate reviewed forward migration.

Prepare explicit source-bound preview changes and rollback, inspect their diff,
then deploy under the lock. Preserve live ALB rules; preview rules are host-scoped
and precede their catch-all. Read back task/image/config identity, stable services
and health. Run authenticated T3-T6, H1/H2 and the affected Core data/permission,
conversation, streaming and UI acceptance at the deployed pins. Report actual
results and unresolved cases; health alone is not chat acceptance.

Publish only scrubbed counts and booleans, never customer-linked identifiers.
Release the deploy lock after verification and owned resource cleanup. Use the
[handoff template](CODEX-HANDOFF-TEMPLATE.md) for exact evidence and remaining work.

## Historical evidence

The old active Meri kit generator, execution helper, pair repair, measurement
helper and P2 image verifier/launcher were deleted with their replaced pipeline.
Git history, dated `neomart-kits/` copies and phase validation reports preserve
their original receipts. Other proxy-specific historical harness scripts remain
subject to the separate proxy deletion audit. Do not use those scripts to
qualify the native SDK architecture or reinterpret old passes as current gates.
