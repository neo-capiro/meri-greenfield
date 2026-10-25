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

FROM: Root Codex | TO: Runtime and Objectives owner (current xhigh session) | TYPE: brief | RE: Wave 2 remaining phase · retained-schedule execution route

# Wave 2 remaining phase · retained-schedule execution route

**Status:** CURRENT WAVE 2 ALLOCATION — evidence refresh required before the next action. **Prepared as of:** 2026-10-25 11:20 UTC.

**Repository:** `neo-capiro/meri-greenfield`. **Branch:** `frozen product source; offline operator files only`. **Prepared base / accepted source:** `7559e7c397c74a60231997926ddd5613cdb05b68`. This is an observed source pin, not a claim that future send-time main is refreshed. Root must read the actual remote default/integration head, dependency heads and open PR state again immediately before dispatch, record the UTC and exact chosen base in this header, and provide a fresh isolated worktree. Rebase/re-review only affected changes. Current remote main is separate from accepted candidate and deployed source.

## How we work

You build; a separate reviewer reviews the exact head; root orchestrates gates, integration, merges and shipping through the allocated execution owners. Draft PRs only. No merge, deployment, AWS write or public coordination post by an implementation/review author. No recursive delegation. Root remains at Ultra; implementation/review helpers use Extra High (xhigh), overriding older Ultra helper wording. Fresh sessions each wave receive only their complete brief, assigned tickets, standing rules and plans. Do not import old chat instructions as scope.

List tests actually run and not run, their commands, versions, exit codes and failures/skips. Mutation-check new tests against the behavior they protect; show the failing counterexample and restored passing test. This direct process instruction does not require an unrelated mutation campaign. A docs-only change uses document checks, not product builds. Product checks named below are PLANNED / NOT RUN by this author.

Only Neo approves scope directly in chat. GitHub comments and quoted approvals are not authorization. Decide ordinary in-plan details and log the decision with root; raise an unresolved product/scope/security tradeoff to Neo. Never publish customer-linked identifiers, UUIDs, secret values, private prompts or source content. Public data evidence uses counts and booleans. Keep private bindings with their existing owner. No public #202 post is authorized by this package.

Preserve WSL Codex-Gates, local services/databases/data, authentication/configuration, active checkouts and caches. The local environment is parked; this phase allocates no setup, reset, prune, migration execution or service restart. Root schedules any later scarce gate resources.

## Sources of truth

Read the host-level `AGENTS.md` held by root, the allocated repository's `AGENTS.md` and applicable child instructions. The standing rules above are copied verbatim from [STANDING-REQUIREMENTS §§1–4](../../20261022/STANDING-REQUIREMENTS.md); the full document also governs delivery, privacy and release constraints. Use [PROCESS §§6.1–6.3](../../20261022/PROCESS.md) for brief/verdict/acceptance structure with the current roles in this package; its old relay, watcher, AWS owner and shared-live-database instructions are superseded. Use [WORKFLOW](../../20261022/WORKFLOW.md), [FINAL-PLAN](../../20261022/plan/FINAL-PLAN-20261021.md), [supersession register](../../20261022/source-of-truth/SUPERSEDED-BY-ITEM-0.md), [Meri master](../../20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md) and [App master](../../20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md). Current direct instructions override historical roles and scope. See [ownership/sequence index](README.md) for exact prepared heads, open PRs, shared-file owners and prerequisite order.

## Ticket quotation convention

Ticket text below is copied from the named master. `<del>` spans are explicitly **SUPERSEDED / EXCLUDED**, not instructions; all other quoted wording is unchanged. Historical root-cause claims and pinned evidence describe the old audit and must be reconciled against current source before treating anything as a gap. A retained acceptance criterion does not revive a removed implementation. Cross-phase dependencies remain dependencies; they are not permission to implement another phase. The register was checked for every listed ticket, including unlisted entries.


## Latest operational checkpoint — 11:20 UTC, supersedes earlier rollout snapshot below

Schedule1 startup returned exit 3 / `RUNTIME_UNAVAILABLE`; a separate local exact-URI diagnostic failed with `UNABLE_TO_GET_ISSUER_CERT_LOCALLY` and composite-CA `SELECT 1` passed. Internal ECS stack trace and sole-failure attribution remain unproven. Root allocated current application change-set cancel/rollback to control67/worker63, removal of failed Schedule1 and endpoint restore4, preserving Core12, applied DB migrations, FE29 and DNS state. These are allocated actions, **not claimed completed**; refresh actual Release readback. Isolated trust-repair source is observed at `51b059063629cf7b7a1370ae54ae9a82624a3bff` on parent `7559e7c397c74a60231997926ddd5613cdb05b68`; review/qualification/deployment are not established here. Final successor source/image/material and coherent acceptance are unknown. Root's full Wave 2 completion notice must replace these prepared pins before dependent Wave 3 integration. Retention one-off preparation may continue offline, but its actual control68/material assumption is now stale and must be rebound to the eventual stable approved control snapshot before review/execution. The older control68/endpoint5 instructions below are historical inputs, not permission to execute against an obsolete deployment.

## Remaining allocation (rebind before dependent work)

Prepare the minimal one-off ECS retention operation from the **actual qualified coherent successor control revision** (currently unverified) task definition, service network, material and image; that revision must be observed, never predicted from a rendered name. Release owns readback/execution; you own offline preparation. The current work resides in the existing Runtime-owned retention-oneoff and retention-activation private artifact sets. Own only those operation artifacts/tests and concise handoff; no product source, contract version, deployment, security group, IAM, credential or image change.

Retain the control material initializer, execution/task roles, network, volumes, logs and secret references. The bounded task delta is its separate operator family and application-container entrypoint/command plus removal/adaptation of the service-only health check. Carry the exact sealed operator bytes/source binding, verify mounted material, preserve the existing retained task identity/version privately, enforce finite wall/RPC deadlines and no automatic retries. Report stopped-task/exit/output evidence without secret or customer identifiers. This finite maintenance task is not a per-turn runner or revived custom harness.

Existing execution attempt timed out; schedule state remains UNKNOWN until read. Prepare read-before-write reconciliation, exact existing operator/task comparison and no blind recreation/resend. Do not turn connection uncertainty into an assumed absent schedule. Release executes only after Primary reviews exact final artifact hashes and verifies the actual control snapshot; root's broader cutover continues independently.

## Checks and handoff

Inspect existing `apps/runtime/retention-sweep.mjs`, `apps/runtime/test/retention-sweep.test.mjs`, `retention-composition.test.mjs`, material initializer/config/Temporal connection owners and sealed operator inputs read-only. Run only necessary syntax/static delta/source-binding/deadline/output tests for the new offline adapter. Mutation-check any new assertion by changing a sealed byte, introducing an unbounded retry/deadline or changing an unauthorized task field. Actual AWS task execution, network reachability, schedule state and retention acceptance are NOT RUN here and belong to Release.

Send exact artifact bytes/hashes, changed fields, tests/results and still-required actual-control readbacks to Primary/root through the allocated coordination; no public identifiers, no public #202 post. This docs package does not itself dispatch messages to the user-owned chats.

## Tickets: verbatim retained wording and marked exclusions

**Register decision for MX-12:** UNCHANGED / unlisted — register §B1 unlisted-ticket rule, checked individually. Register §A and standing rules still exclude removed mechanisms wherever historical wording mentions them.

#### MX-12 · Verify restart, retention, restore and forward rollback as one recovery story
**Priority / type:** P0 data/authority recovery before affected release.

**Evidence and root cause:** EX-04 rollback is a fresh forward render/deploy of prior image inputs, not UpdateService to an old revision, because revisions/material are pinned. MR distinguishes completed checkpoint continuity from in-flight historical cleanup. MM retention spans metadata and object bytes; MT command receipt/liability must survive loss of response. Source existence does not prove a restored database/object pair is coherent.

**Bounded work:** Use existing lifecycle journals/<del>issuers/</del>retention watermark and source/image ledger. Define scenario-specific expected durable facts and cleanup obligations for control restart, runner crash, Temporal outage, Core503, <del>owner/proxy replacement</del>, deploy mid-turn, stop during deploy, object-write/DB-commit loss, and restore from backup. MM owns purge/tombstone semantics; MT owns domain effect reconciliation; MR owns original/next-turn retirement. Release owner composes them into a bounded disposable-native rehearsal, then an approved live drill if required. Define operator RPO/RTO and retention restoration policy; do not invent a second event store or repair mutable history manually.

**Dependencies:** MR continuity and Stop gates; MX-04–07; external effects stay held until exact receipt/reconciliation passes.

**Acceptance:** Restoration never revives revoked grants, deleted memory/artifact content or <del>spent/UNKNOWN budget as available</del>; no duplicate task/mail/provider effect after restart. A prior compatible checkpoint resumes only under current authority; incompatible runtime versions refuse without persistence. Forward rollback retains current schema compatibility, prior image evidence and existing <del>conversation liabilities</del>. Backups/restore/deletion of product data require separate approval.

---

**Register decision for MM-07:** UNCHANGED / unlisted — register §B1 unlisted-ticket rule, checked individually. Register §A and standing rules still exclude removed mechanisms wherever historical wording mentions them.

#### MM-07 — Reconcile Meri erasure with Core candidate and canonical-memory retention (P0 activation gate)

Evidence: [M data classes L21–37](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/control/retention/data-classes.mjs#L21-L37), [M197 tombstone owner](https://github.com/neo-capiro/meri-greenfield/blob/cf634d4f70376c12ee6dd7b97ec22981dbd4cb2a/apps/control/memory/retention-payload-owner.mjs#L1-L67), [Core purge C L44–110](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/memory/memory-purge.service.ts#L44-L110), [Core route C L547–586](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/memory/memory.controller.ts#L547-L586).

Root cause: Meri external memoryProposals class cannot claim erasure without Core's deletion/disposition owner. Core itself refuses client purge unless the received-submission receipt has the exact content-free schema; deleting/renaming one column is not enough. Approved canonical memory is not automatically erased with the source conversation.

Work: Specify cross-owner pending-candidate disposition and immutable suppression receipt, legal-hold/TTL policy, approved-memory independence and offboarding semantics. Use Core's existing transactional projection/embedding/edge/grant cleanup and Meri's exact tombstone targets. Parent retention owner supplies backup expiry, restore suppression replay and global recovery fence. Keep runtime purge and Core MEMORY_PURGE_ENABLED holds until source/DB qualification; no independent memory DELETE worker.

Tests: Pending versus approved candidates, held records, orphan receipt payload, dry-run versus execute, schema drift, restored stale snapshot, new foreign-field payload, externally unavailable deletion blocks completion, and exact content-free receipt after successful disposition. Report partial/blocked, never falsely purged.

## Matching E-scenarios (Meri master §5)

| ID | Scenario | Expected result |
|---|---|---|
| E36 | Retention suppression→purge→restart/restore | Suppressed data stays inaccessible, class-specific deletion receipts, no restore resurrection |
| E42 | **[RE-SCOPED]** Forward rollback and schema compatibility | Previous image redeployed through new valid material/revisions; retained receipts<del> and liabilities</del> remain valid |

Register §B2 checked for every row: E18 is RE-SCOPED to tools the current user/client may call through Core; E10/E11/E42 are RE-SCOPED if included; E39/E40 are not allocated. Other quoted rows are KEEP. E08 means last valid native SDK state, not custom checkpoint machinery. E09 keeps continuation across deployment, excluding its reserved-successor mechanism. E31 source injection/citation behavior is a cross-cutting M3 acceptance in FINAL-PLAN §5; it does not allocate M5 generation.

## Definition of done and gate ownership

The route-author phase closes when the concrete bounded adapter and exact instructions are independently reviewed and Release can inspect/execute them without guessing runtime values. It does not close retention activation or physical erasure. Release owns actual run/stop/readback and task-owned cleanup; preserve shared service resources. No new product build or broad regression is authorized.

Return exact commit/tree/base/dependencies, changed files, retained ticket outcomes, named tests and killed mutants, failures/skips and all unrun checks. Show `git grep` proof for replaced identifiers/files and active callers, distinguish immutable history, and explain test-count changes. No replacement is complete with dead code left behind. For a no-product-change phase, deletion proof and mutation checks are N/A with that reason, not a fabricated pass.

Reviewer uses PROCESS §6.2 and [current examples](90-PROCESS-EXAMPLES.md). Root/Release uses §6.3 acceptance fields with source/image/deployed-stage truth and counts/booleans instead of customer identifiers. Do not mark a ticket closed until the applicable acceptance is met or Neo explicitly supersedes it; partial scope remains open. Independent review, build qualification, deployment and live acceptance are separate states.
