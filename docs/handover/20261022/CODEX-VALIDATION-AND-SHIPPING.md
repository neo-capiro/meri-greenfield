# Current validation and preview shipping workflow

Apply [standing requirements](STANDING-REQUIREMENTS.md), [Wave 2 handover](WAVE-2-HANDOVER.md) and [Codex setup](CODEX-SETUP.md). Neo authorized Wave 2 implementation through shipping and lifted the earlier holds. Root Codex owns release decisions, shared local gates and AWS; lanes deliver independently reviewed exact heads. No Fable/dot acceptance or relay is required.

## Source validation

| Repository | Bounded checks | Wider evidence selected from the current brief and changed consumers |
|---|---|---|
| Meri | `npm run check:contracts`; `node --test` on touched modules with their flags | Relevant root `check`, `check:contracts:distribution`, `check:infra`, `check:sdk-evidence`; `npm run typecheck --prefix apps/runtime`; current image/DB gates |
| Core | `pnpm --filter @capiro/api run test --runInBand --runTestsByPath src/<owned>.spec.ts` | API build/lint/typecheck and affected suites; closure regeneration for manifest/lock/schema changes; image probes and isolated PostgreSQL 16 |
| Frontend | `node --test` on touched `.mjs` modules; web workspace Vitest paths | Root `npm test`, `npm run typecheck`, `npm run build`; web lint; affected browser, visual/accessibility and production-container checks |

These definitions were checked against current manifests; recheck at each integration base. Select checks for current behavior, not obsolete suites preserving mechanisms item 0 deletes. Remove replaced tests with their owner and retain equivalent behavior coverage.

Use root's WSL Codex-Gates environment: Ubuntu 24.04, native Docker 29.8.2, native PostgreSQL 16 and Node 24. Meri uses `npm ci`; Core pins pnpm 9.12.0 and `pnpm install --frozen-lockfile`; frontend pins Node 24/npm 11.9.0 and uses `npm ci --ignore-scripts` in an owned Linux checkout. Do not copy Windows `node_modules` junctions. Infra needs real Git, `MERI_REVIEW_SOURCE_ROOT`, workspace links and Python `cryptography >=42`.

Tests use isolated PostgreSQL 16, synthetic records and throwaway PKI, never clone/live data. Root schedules shared Docker/ports/heavy gates. Run targeted checks and required affected suites, preserve failures/skips, and prove inherited failures against an untouched base in the same environment. Docs-only changes need diff/link/command-definition checks rather than invented product tests.

## Release sequence

1. Root checks the exact head, independent Astra Ultra review, required passing gates and full acceptance plan. Preserve accepted A2/M2 scope and unresolved work; source completion is not live acceptance.
2. Integrate cleanly into Meri/frontend `main` or Core `backend-import`. Record commit/tree; rerun affected review/gates if integration changes the candidate. Never substitute an old reviewed head for a new push.
3. Regenerate the recipe from current source and inspect fresh live state, images, database targets, roles, routing and rollback. Do not execute archived release folders as-is or use mutating steps to discover arguments. Remove obsolete pair/issuer/authority steps as item 0 replaces them.
4. Build ARM64 images, bind exact source/archive receipts, run image/runtime/isolated-DB gates, and scan the exact digest. Require 0 HIGH/CRITICAL findings; record decisions for other findings. Older AMD64 kits cannot qualify a new image.
5. Acquire the preview deploy lock on #202 with `TYPE: status | RE: DEPLOY LOCK <component>`. Keep one shipper per resource and no deployment during live acceptance. Prepare rollback and any required quiet window.
6. Snapshot the persistent clone before every forward migration. Read its ledger, compare exact hashes and apply only intended pending changes. Never delete/re-clone it, edit applied migrations or migrate shared live data. Keep Core and Meri on the clone. Schema/data drops require a separate reviewed forward migration; this hosting change does not authorize them.
7. Apply the reviewed preview change; read back resources and verify health and source/image/config identity, including the exact AgentCore runtime version/endpoint and V1 platform after migration. Preview ALB rules remain host-scoped before their catch-all; never change or renumber live rules. Compare live rules unchanged before/after routing changes. If preview rules cannot fit, prepare and verify a separate preview endpoint.
8. Run required authenticated acceptance at deployed pins: T3-T6, H1/H2 and applicable data/tool/negative cases. Diagnose failures and never count unrun cases as passed. Publish scrubbed results, remaining acceptance and rollback state, then release `DEPLOY UNLOCK`.

Follow the [approved AgentCore Runtime migration](plan/AGENTCORE-RUNTIME-MIGRATION-20261024.md): reuse the completed SDK experiment and current direct Bedrock/native persistence; qualify standard V1 conversation hosting, gateway/read parity, simplified authority, continuity/streaming and standard Temporal authentication, then remove replaced callers/resources. Do not run the old spike or warm-pool plan again. Independent A2/M2 work may continue where it does not depend on unfinished item 0 behavior. A synthetic spike cannot qualify product authorization, durability, SSE, isolation or quality parity.

## AWS and private inputs

Root uses AWS `default`, account `967807252336`, region `us-east-1` and `PYTHONUTF8=1`. Verify the caller before shipping and inspect explicit profile arguments: `AWS_PROFILE` cannot override `--profile capiro-dev`. The AWS-write hold is lifted; a delegated writer still needs root's resource allocation. Never copy credentials between hosts or print secret values.

Fetch private inputs only for a still-required release step, into owner-only scratch with tracing off. The old pair PKI is named `meri/preview/private-pki`; the Core bearer is named `meri/preview/core/identity-bearer`. Inspect and adapt archived helpers before use. Delete pair PKI/resources and obsolete credential steps with their item 0 replacement; do not make them native SDK dependencies. Runners never receive the Core secret or DB credentials.

After success, failure, cancellation or timeout, close and verify exit of task-owned processes/containers/tasks and remove owned secret/render scratch. Verify resolved absolute cleanup targets and use one shell end-to-end. Preserve other sessions, worktrees and scrubbed evidence. Never publish customer-linked identifiers, including UUIDs or prefixes; use counts and booleans. Use [CODEX-HANDOFF-TEMPLATE.md](CODEX-HANDOFF-TEMPLATE.md).
