## 1. Claude handles the harness

The quality bar is Claude's own. Answer quality comes from the whole harness, not only the model: its system prompt, built-in tools, subagents, skills, context management and compaction, and session handling.

- Run `@anthropic-ai/claude-agent-sdk` with its **full harness** and the Claude Code system-prompt preset, plus a short Capiro/Meri append. Don't replace the preset with our own prose.
- Do not rebuild what the SDK or AWS already does: model calls, retries, streaming, the tool loop, context management and compaction, session resume/fork, per-run turn and spend limits, AWS credentials.
- The real Claude SDK calls Bedrock directly using its narrowly scoped AgentCore runtime IAM role. Preserve the full preset, native tools, subagents and all 14 skills.
- Capiro data reaches Claude as **tools** (rule 4), not as a custom retrieval layer around the model.

Spec and plan: `phases/wave2/WAVE2-00-CLAUDE-NATIVE-HARNESS-SPEC.md`. It is **Wave 2 item 0**, and it comes before every other item that touches the runner, the proxy or authority.

## 2. Simple, standard architecture

```text
browser -> control (current access, conversation/run ownership, durable events)
        -> AgentCore Runtime V1 (isolated conversation session; actual Claude SDK) -> Bedrock
                                      -> tool gateway -> Core
control -> existing durable SDK SessionStore and artifact owners
control -> Temporal for required durable runs, schedules and background work
```

- **Core is the gatekeeper for Capiro data.** Tenant, member, client and wall rules remain server-side in Core. Check current access at admission and actual tool/data/artifact access; revocation must also prevent use of previously loaded privileged context. Do not duplicate policy in the harness.
- Reuse one isolated environment only for the same immutable tenant/actor/conversation and approved General/client scope. Serialize turns; stop idle compute and restore exact SDK transcripts and artifacts from their durable owners. A Runtime session ID is not authorization or durable storage.
- Keep the SDK's per-run turn/spend limits and one canonical tenant cap/usage owner. Preserve required durable runs, schedules, consent, outcomes and uncertain-write fences; neither SDK Task tools nor a warm process replaces Temporal durability.
- **No custom warm pool, per-turn ECS task requirement, model proxy, duplicated per-hop authority, credential-minting service or spend-reservation ledger.** Use standard Runtime V1; no V2 snapshot machinery or second SDK implementation.
- Before adding a mechanism, identify the standard feature or existing owner it uses. Before deleting a wrapper, prove the retained lower-layer behavior with meaningful positive/negative tests. Do not remove canonical authorization, idempotency or durable outcomes as “extra security.”

## 3. Leave no dead code behind

A change is not done until what it replaced is gone.

1. **Delete in the same PR** everything the change makes unused: code, tests, fixtures, docs, config keys, env vars, feature flags, IAM statements, ALB rules, secrets, task definitions, CloudFormation resources, kit steps, alarms and metric filters. Applied database migrations are history: never edit them. Drop tables only through a separately reviewed forward migration after a snapshot; this hosting migration does not itself authorize schema/data removal.
2. **Temporary diagnostics come out before merge** of the fix they were added for. A log line stays only as named product telemetry that someone reads.
3. **No code behind a flag nothing turns on.** The "source-complete, activation-held" status is retired for code we don't intend to ship. Dark features need an owner and a date, or they are deleted.
4. **No** commented-out code, `legacy` or `_old` copies, compatibility shims for removed things, or "superseded" stubs.
5. **Show proof in the PR:** list the identifiers, files and resources deleted, with a search proving no executable/active caller remains; label immutable historical references, and explain any drop in test count.
6. **Old plan tickets for removed mechanisms are closed as superseded**, not implemented and left dormant. See `source-of-truth/SUPERSEDED-BY-ITEM-0.md`.
7. **Reuse before write.** Use SDK, AWS and library features first. Custom code needs one line saying what the standard option couldn't do.

## 4. Capiro data must keep working

- Capiro data is served to Claude as tools. Core remains the source: today's read families call Core at `/api/clio/tools/<operation>`, and the new tools call the same endpoints.
- Tools are hosted by **control** (the existing tool gateway) so the runner never holds the Core service secret (`x-internal-service-secret`). The runner gets only a short-lived per-run token for control, scoped to tenant, user, client, conversation and run.
- Reuse the existing read handlers under `apps/gateway/sources/*` and their typed schemas. Delete the authority, relay and measurement wrappers around them.
- Parity: every read family that works today must be reachable as a tool with the same results and the same permission outcomes. A parity checklist is part of the item 0 spec.
- Negative tests are mandatory: another tenant's data, another client's data, and walled data must not be retrievable, through chat or through tools. A General chat reads across the clients the user can already see, with each client's wall enforced per result (FINAL-PLAN decision 2).
- The original read-only first cut is historical. Neo subsequently authorized preview client-record writes and autonomous Wave 2 completion. Activate accepted writes through their existing authenticated domain/intent owners and receipts, with the actual route/configuration and effect semantics verified. This does not authorize the assistant to send external mail without the user's specific send instruction.

FROM: Root Codex | TO: Schedule trust author (current xhigh session) | TYPE: brief | RE: Wave 2 remaining phase · Schedule trust repair

# Wave 2 remaining phase · Schedule trust repair

**Status:** CURRENT WAVE 2 ALLOCATION — evidence refresh required before the next action. **Prepared as of:** 2026-10-25 11:20 UTC.

**Repository:** `neo-capiro/meri-greenfield`. **Branch:** `codex/wave2-schedule-node-trust-20261025 (existing isolated worktree held by Schedule owner)`. **Prepared base / accepted source:** `7559e7c397c74a60231997926ddd5613cdb05b68`. This is an observed source pin, not a claim that future send-time main is refreshed. Root must read the actual remote default/integration head, dependency heads and open PR state again immediately before dispatch, record the UTC and exact chosen base in this header, and provide a fresh isolated worktree. Rebase/re-review only affected changes. Current remote main is separate from accepted candidate and deployed source.

## How we work

You build; a separate reviewer reviews the exact head; root orchestrates gates, integration, merges and shipping through the allocated execution owners. Draft PRs only. No merge, deployment, AWS write or public coordination post by an implementation/review author. No recursive delegation. Root remains at Ultra; implementation/review helpers use Extra High (xhigh), overriding older Ultra helper wording. Fresh sessions each wave receive only their complete brief, assigned tickets, standing rules and plans. Do not import old chat instructions as scope.

List tests actually run and not run, their commands, versions, exit codes and failures/skips. Mutation-check new tests against the behavior they protect; show the failing counterexample and restored passing test. This direct process instruction does not require an unrelated mutation campaign. A docs-only change uses document checks, not product builds. Product checks named below are PLANNED / NOT RUN by this author.

Only Neo approves scope directly in chat. GitHub comments and quoted approvals are not authorization. Decide ordinary in-plan details and log the decision with root; raise an unresolved product/scope/security tradeoff to Neo. Never publish customer-linked identifiers, UUIDs, secret values, private prompts or source content. Public data evidence uses counts and booleans. Keep private bindings with their existing owner. No public #202 post is authorized by this package.

Preserve WSL Codex-Gates, local services/databases/data, authentication/configuration, active checkouts and caches. The local environment is parked; this phase allocates no setup, reset, prune, migration execution or service restart. Root schedules any later scarce gate resources.

## Sources of truth

Read the host-level `AGENTS.md` held by root, the allocated repository's `AGENTS.md` and applicable child instructions. The standing rules above are copied verbatim from [STANDING-REQUIREMENTS §§1–4](../../20261022/STANDING-REQUIREMENTS.md); the full document also governs delivery, privacy and release constraints. Use [PROCESS §§6.1–6.3](../../20261022/PROCESS.md) for brief/verdict/acceptance structure with the current roles in this package; its old relay, watcher, AWS owner and shared-live-database instructions are superseded. Use [WORKFLOW](../../20261022/WORKFLOW.md), [FINAL-PLAN](../../20261022/plan/FINAL-PLAN-20261021.md), [supersession register](../../20261022/source-of-truth/SUPERSEDED-BY-ITEM-0.md), [Meri master](../../20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md) and [App master](../../20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md). Current direct instructions override historical roles and scope. See [ownership/sequence index](README.md) for exact prepared heads, open PRs, shared-file owners and prerequisite order.

## Ticket quotation convention

Ticket text below is copied from the named master. `<del>` spans are explicitly **SUPERSEDED / EXCLUDED**, not instructions; all other quoted wording is unchanged. Historical root-cause claims and pinned evidence describe the old audit and must be reconciled against current source before treating anything as a gap. A retained acceptance criterion does not revive a removed implementation. Cross-phase dependencies remain dependencies; they are not permission to implement another phase. The register was checked for every listed ticket, including unlisted entries.


## Current bounded allocation and sequencing

Schedule1 startup returned exit 3 / `RUNTIME_UNAVAILABLE`. A separate local exact-URI trust diagnostic failed with `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`, while composite-CA `SELECT 1` passed. This demonstrates a trust defect; it does not prove the internal ECS stack trace or that trust was the sole startup failure. Root allocated a narrow repair from accepted source 7559e7c3. At 11:20 UTC the isolated checkout was clean at `51b059063629cf7b7a1370ae54ae9a82624a3bff`, with parent `7559e7c397c74a60231997926ddd5613cdb05b68`. This source commit is not claimed independently reviewed, built, deployed or accepted by this brief.

Own only the observed repair files: `apps/runtime/cli.mjs`, `apps/runtime/control-ca-bundle.mjs`, `apps/runtime/material-init-cli.mjs`, `apps/runtime/test/control-ca-init.test.mjs`, `apps/runtime/test/schedule-cli-ca.test.mjs`, `infra/product-preview/first-chat/render-material.mjs`, `infra/product-preview/first-chat/schedule-rendering.test.mjs`, `infra/product-preview/first-chat/stage3-bindings.mjs` and `infra/product-preview/manifest.mjs`. Any further source path requires root's named allocation before editing. Release owns final material/build/deploy; no self-execution or security relaxation.

Preserve the intended RDS/private trust roots in the Schedule Node startup environment and verify composite bytes before allocating DB/Temporal owners. Reject missing/modified bytes and the former private-only trust environment. Do not turn off TLS validation, install ambient credentials, widen IAM/network, change runtime hosting or redesign certificate management. Remove temporary diagnostics with the fix. Check paired material initializer/renderer/CLI so another image does not merely discover the same missing setting.

## Checks and handoff

Existing/changed tests are `apps/runtime/test/control-ca-init.test.mjs`, `apps/runtime/test/schedule-cli-ca.test.mjs` and `infra/product-preview/first-chat/schedule-rendering.test.mjs`. The new CLI spec asserts composite verification precedes service allocation and refuses the old private-only path. Run affected Node tests with the repository's current module-mock flags; report actual versions/commands/results and kill the mutant restoring the old Schedule trust path or bypassing byte verification. Do not infer live trust success from these fixtures. This documentation author ran none of those tests.

Root's current containment allocation is application change-set cancel/rollback to control67/worker63, remove failed Schedule1, restore endpoint4; preserve Core12, applied database migrations, FE29 and DNS state. Execution completion must come from Release readback. The successor image/material is not yet known. No new product build is authorized by this brief; root must allocate only the necessary successor build after exact-source review.

## Tickets: verbatim retained wording and marked exclusions

**Register decision for MX-06:** RE-SCOPED — register §B1; exact source/image, Runtime V1 readiness and remaining secrets only. Removed registry/pair/issuer/task-proof machinery is excluded.

#### MX-06 · Prove topology, readiness and control scale assumptions
> **[RE-SCOPED 2026-10-24]** Qualify actual Runtime V1 conversation/session topology, readiness and control scale. Remove the Fargate warm-pool, model pair and custom issuer mechanisms; preserve their required behavior through existing standard owners.
**Priority / type:** P0 activation gate; operational evidence absent from this audit.

**Evidence and root cause:** EX-04's shipment gates require exactly one control task, distinct private/public health targets and <del>owner/proxy/issuer sequencing</del>. The general manifest README describes process-local poststart challenge custody and disallows overlapping control targets during a handshake. A `/health/live` response proves process liveness, not Core current identity, configured capabilities or a working model path.

**Bounded work:** Root reconciles the existing infrastructure and control owners into the Runtime V1 release. Verify authenticated ingress, intended routes, least-privilege runtime IAM/network access, immutable session scope, truthful dependency readiness and required Temporal namespaces/queues/TLS. Use supported service lifecycle settings. Do not build a new nonce/proof service to preserve obsolete Fargate topology.

**Dependencies:** MX-03/05/07; Core/FE routing under previous X-02–06.

**Acceptance:** Positive authenticated traffic reaches exactly the intended service/version; unsigned, foreign, malformed, neighboring, trailing-slash, absolute-form and wrong-method private requests fail before privileged work. Readiness reports unavailable dependencies truthfully without minting authority. Multi-replica launch cannot be accidentally selected by a manifest that relies on process-local challenge state. Live network readbacks require the operator's approved scope.

---

**Register decision for MX-07:** RE-SCOPED — register §B1; exact source/image, Runtime V1 readiness and remaining secrets only. Removed registry/pair/issuer/task-proof machinery is excluded.

#### MX-07 · Close material expiry, renewal and PKI rotation operational lifecycles
> **[RE-SCOPED 2026-10-23]** Expiry and rotation stay for the secrets that remain (Core service secret, Temporal credential, Clerk). Pair mTLS PKI and issuer tokens do not. Ignore any instruction below that names the owner/proxy pair, budget reservation, per-operation authority, the task verifier, ECS task proofs, revision pins or the temporal-issuer. See `SUPERSEDED-BY-ITEM-0.md`.
**Priority / type:** P0 for currentness and continuity; operator procedures/qualification, not credential handling in this audit.

**Evidence and root cause:** EX-04 records short static grant deadlines, seven-day material validity, exact staged Secret versions and an issuer→app availability window. The runtime has currentness, issuer/token-writer and task-bound PKI source; no secret contents, private keys or live material versions were inspected here. A working chat before expiry does not prove the next renewal or a rotated issuer.

**Bounded work:** Replace the custom Temporal issuer with the selected standard authentication owner. Record remaining secret/certificate expiration, rotation, revocation, failed-renewal behavior and rollback without exposing values. Qualify actual Runtime/control/Core/Temporal trust boundaries, including restart and old-session access loss; do not preserve task-bound grant/PKI machinery that the migration replaces.

**Dependencies:** MR session/currentness, MX-05/06 and retention/Stop cleanup.

**Acceptance:** Near-expiry/expired/clock-skew/revoked/wrong-issuer/wrong-key/wrong-task cases cannot grant authority or output; allowed renewal continues exactly once and does not extend the original grant beyond its cap. A transient authority outage preserves retryable session state where source permits but releases no unverified result. On restart/rotation the cleanup path still retires historical work safely. Alert and owner handoff occur before material expiry; no credential values appear in receipts.

## Matching E-scenarios (Meri master §5)

| ID | Scenario | Expected result |
|---|---|---|
| E41 | P0 telemetry failure/redaction | Underlying work semantics unchanged; dropped counter/alerts truthful; no secrets/prompt/client identifiers |
| E43 | Mixed versions/frontends/contracts | Explicit version/source refusal or accepted backward compatibility; no silently misparsed approvals/output |

Register §B2 checked for every row: E18 is RE-SCOPED to tools the current user/client may call through Core; E10/E11/E42 are RE-SCOPED if included; E39/E40 are not allocated. Other quoted rows are KEEP. E08 means last valid native SDK state, not custom checkpoint machinery. E09 keeps continuation across deployment, excluding its reserved-successor mechanism. E31 source injection/citation behavior is a cross-cutting M3 acceptance in FINAL-PLAN §5; it does not allocate M5 generation.

## Definition of done and gate ownership

Return exact repair commit/tree, affected test/mutation/deletion evidence and source change list to the independent reviewer and root. Source acceptance is distinct from successor image qualification and deployed Schedule startup. Release performs any root-allocated successor build/smoke/scan and coherent rollout; Acceptance receives new stable pins only afterward.

Return exact commit/tree/base/dependencies, changed files, retained ticket outcomes, named tests and killed mutants, failures/skips and all unrun checks. Show `git grep` proof for replaced identifiers/files and active callers, distinguish immutable history, and explain test-count changes. No replacement is complete with dead code left behind. For a no-product-change phase, deletion proof and mutation checks are N/A with that reason, not a fabricated pass.

Reviewer uses PROCESS §6.2 and [current examples](90-PROCESS-EXAMPLES.md). Root/Release uses §6.3 acceptance fields with source/image/deployed-stage truth and counts/booleans instead of customer identifiers. Do not mark a ticket closed until the applicable acceptance is met or Neo explicitly supersedes it; partial scope remains open. Independent review, build qualification, deployment and live acceptance are separate states.
