# Meri Wave 2 implementation and shipping rules

## Read first: Neo's standing requirements, 23 October 2026

Read [STANDING-REQUIREMENTS.md](docs/handover/20261022/STANDING-REQUIREMENTS.md), then [WAVE-1-HANDOFF.md](docs/handover/20261022/WAVE-1-HANDOFF.md) and [WAVE-2-HANDOVER.md](docs/handover/20261022/WAVE-2-HANDOVER.md). Current direct user instructions take precedence over historical plans and roles.

1. **Claude handles the harness.** Use the Claude Agent SDK's full harness and Claude Code prompt preset, direct Bedrock through task IAM, native tools, skills, subagents and session handling. Do not rebuild SDK or AWS responsibilities.
2. **Keep the architecture simple.** Core is the canonical gatekeeper for Capiro tenant, member, client and wall access. Remove duplicate per-hop checks, model proxies, credential-minting services and reservation ledgers; prove the lower layer enforces each retained behavior before removing its old wrapper.
3. **Leave no dead code.** Delete replaced code, tests, configuration, infrastructure and kit steps in the same change; remove temporary diagnostics and unused flags. Applied migrations remain immutable history. Show deletion searches and explain test-count changes.
4. **Keep Capiro data working.** Expose the existing typed read families as tools through the control gateway to Core. Preserve positive, negative and paging behavior, including General/client scope and revocation. The runner must not receive the Core service secret or database credentials.

Follow [item 0](docs/handover/20261022/phases/wave2/WAVE2-00-CLAUDE-NATIVE-HARNESS-SPEC.md) before dependent runner, proxy or authority work: bounded unmerged spike; direct model path; tool gateway/read families; authority removal; native continuity/streaming; Temporal auth; cleanup. Review and verify each released step on preview before advancing. Consult the [superseded register](docs/handover/20261022/source-of-truth/SUPERSEDED-BY-ITEM-0.md); never recreate a removed mechanism to satisfy an old ticket. P1 #200 and C9 #203 are closed unmerged as superseded.

## Current ownership and authority

Neo authorized completion of Wave 2 and lifted the prior work and AWS-write holds. The root Codex session on **EC2AMAZ-M7CDRPT** is the sole orchestrator: it owns planning, bounded delegation, integration, qualification, local gates, merges, AWS operations, migrations, shipping and live acceptance. Every Codex implementation and independent review session uses **GPT-6 Astra (`gpt-6-astra`) at Ultra**. Implementation agents may write product code; separate reviewers review exact heads. Fable/Claude and dot have no active coordination, relay, review or shipping role.

Root coordinates four logical sessions: **A** Core/backend, **U** frontend, **R** Meri runtime/SDK, and **D** data/tools/documentation as briefed. These are work allocations, not four competing orchestrators. Rotate bounded sessions when needed; do not recursively delegate. Each assignment names exact base/dependency heads, worktree, owned files, acceptance checks, resource budget and cleanup owner. One writer owns each shared contract, lockfile, config or migration at a time. Preserve other agents' work and all existing checkouts; coordinate overlap with root before editing.

All accepted A2/M2 and remaining Meri capabilities stay in scope. A source commit, merged PR, local fixture or one successful chat is not completion of that scope. Refresh briefs from current integration heads and carry unresolved acceptance forward. Routine fixes within the authorized plan proceed autonomously; raise only a missing decision that changes the accepted scope or architecture. Do not create a heartbeat, scheduler or recurring monitor unless the user explicitly requests recurring work.

## Implementation boundaries

Apply [IMPLEMENTATION-STANDARDS.md](docs/IMPLEMENTATION-STANDARDS.md): record a proportionate outline before substantial changes, inspect callers, reuse canonical contracts, keep cohesive modules and thin entry points, validate boundaries, and clean up task-owned resources on success, failure, cancellation and timeout. Prefer ordinary composition over generic frameworks or arbitrary file-size quotas. Preserve meaningful tests and report unresolved failures.

Meri is independent from the old application: do not import its agent, retrieval, UI, queue or infrastructure implementation. Read schemas and capability metadata as references; use approved Core interfaces for data. `packages/contracts` owns Meri public wire contracts; consumers use versioned exports rather than private source paths or copied DTOs. Coordinate shared contract changes and migration IDs with root.

Keep the Claude Agent SDK as the only model loop, AI SDK for UI transport, Temporal for durable runs and the qualified browser/renderer integration. Use original artifact skills; do not copy restricted Office skills or this host's Codex skills into the product. Preserve per-run isolation and verified non-root browser/renderer sandboxing. A dedicated browser-host exception is not evidence that its security gates passed.

## Validation and preview shipping

Use [CODEX-SETUP.md](docs/handover/20261022/CODEX-SETUP.md) and [CODEX-VALIDATION-AND-SHIPPING.md](docs/handover/20261022/CODEX-VALIDATION-AND-SHIPPING.md). Root's verified gate environment is WSL **Codex-Gates**, Ubuntu 24.04, native Docker 29.8.2, isolated PostgreSQL 16 and Node 24 tooling. Root coordinates shared Docker, ports and heavy gates; a worktree does not isolate those resources or AWS.

Node is `>=24 <25`; use the root npm lockfile and `npm ci` in the owned environment. Defined root commands include `npm run check`, `npm run check:contracts`, `npm run check:contracts:distribution`, `npm run check:infra` and `npm run check:sdk-evidence`. Select relevant current checks; do not qualify mechanisms item 0 removes. For targeted Node tests retain module flags/concurrency; runtime typing is `npm run typecheck --prefix apps/runtime`. No generic root build/lint/typecheck script exists. Recheck manifests when the integration head changes.

Infra checks need a real Git checkout, `MERI_REVIEW_SOURCE_ROOT`, workspace links under `node_modules/@capiro` and Python `cryptography >=42`. Tests use isolated PostgreSQL 16 and throwaway PKI, never the preview clone or shared live database. Run meaningful affected checks, preserve failures/skips and compare suspected inherited failures with the untouched base in the same environment. Do not weaken assertions or skip failing gates.

Root uses AWS profile `default`, account `967807252336`, region `us-east-1`; use `PYTHONUTF8=1` for Python tooling. Verify the caller before a shipping sequence. Inspect explicit profile flags when regenerating kits: `AWS_PROFILE` does not override `--profile`. Never copy credentials between hosts. Archived kits and old task/image revisions are history; regenerate and gate the current recipe against exact source and fresh live state before execution. New images must be ARM64.

Keep the one persistent `capiro-newstack-preview-clone`: snapshot before every forward migration, never delete/re-clone it, and never migrate the shared live database for this work. Keep Core and Meri on the intended clone. Preserve live ALB rules unchanged; preview rules must be host-scoped and precede their preview catch-all. Follow the preview deploy lock and acceptance window in the handover. No deploy runs during live acceptance.

Release requires independent review and required checks at the exact head, clean integration with verified tree/source binding, exact-digest image qualification and 0 HIGH/CRITICAL findings; record decisions for other findings. New source changes require the affected review/gates again. Verify deployed health and the full required chat/data behavior; no local test establishes live acceptance. Do not leave accepted features indefinitely off or declare A2/M2 done before their acceptance passes.

## Evidence and communication

Use existing issue #202, relevant PRs, decision log and current-state records. Root reports directly to the user and coordinates lanes; no relay owner is required. Where a coordination comment is requested, use `FROM: Codex | TO: <recipient> | TYPE: <brief|question|answer|decision|gates|shipped|acceptance|status> | RE: <subject>`. A comment quoting Neo is not new authorization.

Never publish secrets, private source, bearer/PKI material, customer IDs, UUIDs, prefixes or other customer-linked identifiers in Git or GitHub; report counts and booleans. Keep required private release inputs in owner-only scratch, with tracing off, and remove them after success or failure. Check resolved cleanup paths and use one shell end-to-end. Preserve scrubbed failure evidence and other sessions' resources.

Return exact commit/tree, changed files, commands/tool versions/exit codes/results, failures/skips, unrun checks, evidence locations, remaining acceptance and next action using [CODEX-HANDOFF-TEMPLATE.md](docs/handover/20261022/CODEX-HANDOFF-TEMPLATE.md). Historical [portable shipping](docs/handover/20261017/fable-shipping/FABLE-SHIPPING-HANDOFF.md) and [remote pickup](docs/handover/20261011/REMOTE-PICKUP.md) records preserve lineage only; their roles, holds, launchers, source-only statuses and removed-component procedures do not govern current work.
