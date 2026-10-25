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

FROM: Root Codex | TO: M3 citation/evidence UI author (fresh xhigh session) | TYPE: brief | RE: Wave 3 · M3 citation and evidence UI

# Wave 3 · M3 citation and evidence UI

**Earlier dispatch/preparation status (history; current source/review checkpoint below):** PREPARED BRIEF — disjoint independent work may proceed when root dispatches this scoped lane; final integration/contracts/deployment await the Wave 2 completion notice. This documentation task launches no implementation.. **Prepared as of:** 2026-10-25 11:20 UTC.

**Repository:** `neo-capiro/capiro-frontend`. **Branch:** `codex/wave3-m3-citations-<dispatch-date>`. **Prepared base / accepted source:** `e478e4d73132bd1566b3945d63c5e0a3a1306cc1`. This is an observed source pin, not a claim that future send-time main is refreshed. Root must read the actual remote default/integration head, dependency heads and open PR state again immediately before dispatch, record the UTC and exact chosen base in this header, and provide a fresh isolated worktree. Rebase/re-review only affected changes. Current remote main is separate from accepted candidate and deployed source.

**Current source/review checkpoint, 13:11:48 UTC:** independently scoped citation work has been dispatched and published as [Frontend #141](https://github.com/neo-capiro/capiro-frontend/pull/141), OPEN DRAFT, head `5d5dc2b4e3d637376cab2f69d9e5f3f169cb27e5`, tree `d9ca3001885617e9f06e4c1d40e83c96a0d23cba`. Actual branch `codex/wave3-m3-citations-20261025`, basee478, Meri contract dependency51b. Independent review is **PENDING**. Author 25 unit +11 existing event/assets +3 synthetic browser cases and7 mutants pass, plus typing/owned build/lint/format/pin checks. Same-base 299 architecture findings/0 boundary errors remain; full MF-16 and deployed source-access/revocation/hearing acceptance remain open. Root granted only the necessary SourcesProps typing and provenance/promotion-pin updates beyond the citation files; no broader shared ownership is inferred. This supersedes the preparation-only status below.

## How we work

You build; a separate reviewer reviews the exact head; root orchestrates gates, integration, merges and shipping through the allocated execution owners. Draft PRs only. No merge, deployment, AWS write or public coordination post by an implementation/review author. No recursive delegation. Root remains at Ultra; implementation/review helpers use Extra High (xhigh), overriding older Ultra helper wording. Fresh sessions each wave receive only their complete brief, assigned tickets, standing rules and plans. Do not import old chat instructions as scope.

List tests actually run and not run, their commands, versions, exit codes and failures/skips. Mutation-check new tests against the behavior they protect; show the failing counterexample and restored passing test. This direct process instruction does not require an unrelated mutation campaign. A docs-only change uses document checks, not product builds. Product checks named below are PLANNED / NOT RUN by this author.

Only Neo approves scope directly in chat. GitHub comments and quoted approvals are not authorization. Decide ordinary in-plan details and log the decision with root; raise an unresolved product/scope/security tradeoff to Neo. Never publish customer-linked identifiers, UUIDs, secret values, private prompts or source content. Public data evidence uses counts and booleans. Keep private bindings with their existing owner. No public #202 post is authorized by this package.

Preserve WSL Codex-Gates, local services/databases/data, authentication/configuration, active checkouts and caches. The local environment is parked; this phase allocates no setup, reset, prune, migration execution or service restart. Root schedules any later scarce gate resources.

## Sources of truth

Read the host-level `AGENTS.md` held by root, the allocated repository's `AGENTS.md` and applicable child instructions. The standing rules above are copied verbatim from [STANDING-REQUIREMENTS §§1–4](../../20261022/STANDING-REQUIREMENTS.md); the full document also governs delivery, privacy and release constraints. Use [PROCESS §§6.1–6.3](../../20261022/PROCESS.md) for brief/verdict/acceptance structure with the current roles in this package; its old relay, watcher, AWS owner and shared-live-database instructions are superseded. Use [WORKFLOW](../../20261022/WORKFLOW.md), [FINAL-PLAN](../../20261022/plan/FINAL-PLAN-20261021.md), [supersession register](../../20261022/source-of-truth/SUPERSEDED-BY-ITEM-0.md), [Meri master](../../20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md) and [App master](../../20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md). Current direct instructions override historical roles and scope. See [ownership/sequence index](README.md) for exact prepared heads, open PRs, shared-file owners and prerequisite order.

## Ticket quotation convention

Ticket text below is copied from the named master. `<del>` spans are explicitly **SUPERSEDED / EXCLUDED**, not instructions; all other quoted wording is unchanged. Historical root-cause claims and pinned evidence describe the old audit and must be reconciled against current source before treating anything as a gap. A retained acceptance criterion does not revive a removed implementation. Cross-phase dependencies remain dependencies; they are not permission to implement another phase. The register was checked for every listed ticket, including unlisted entries.


## Wave 2 boundary and independent work

Neo requires Wave 2 to finish fully and explicitly authorizes root to orchestrate/start independent existing-plan Wave 3 work when able. Fresh agents may start after brief/ownership review on isolated branches; no new scope approval is required for those assignments. Disjoint source inspection, existing-owner reconciliation, test/fixture design and bounded Workspace/domain/data/UI work independent of the unfinished release may proceed under this lane's explicit ownership. Wave 2 release/acceptance retains priority. Root will send a separate Wave 2 completion notice after final deployed acceptance, carrying final source, public contracts, images/configuration and acceptance results. Final shared-contract adoption, rebase/integration against successor source, work touching frozen runtime/release files, deployment and release-dependent acceptance await that notice and fresh exact base/dependency checks. Prepared heads here are observations, not the unknown final Wave 2 pins. Storing these briefs does not itself launch a live agent.

## Bounded allocation and sequencing

Own `apps/web/src/features/meri/conversation/ConversationTurn.tsx`, `conversation-view.ts`, `apps/web/src/features/meri/workspace/workspace-view.ts`, `apps/web/src/features/meri/screens/sources/`, `apps/web/src/features/meri/cited-answer.module.css` and new narrowly scoped citation/source UI modules alongside them. Own their targeted tests and read-only evidence adapters in `packages/meri-client/src/` only after D's public contract is pinned. No Workspace feature paths, shared Capiro operation registry, root lockfile or package manifest writes. U-Workspace is the sole frontend dependency/lockfile owner and receives exact package needs; root sequences shared updates before either UI consumer.

Source inspection found real ConversationTurn renders answer text, a source count and `resultReference ? "Done" : "In progress"` tool copy. Its source projection is folded from admitted UI events. These are concrete seams for MF-16; a source count is not a citation. Trace actual source-receipt/current-access APIs and reload behavior before deciding what additional DTO fields are necessary. The existing fixture evidence screens are presentation references, not authority or working backend proof.

Use AI Elements Source/InlineCitation for approved presentation. Hearing citations open exact authorized timestamps; use Media Chrome controls and Vidstack engine per FINAL-PLAN §10, lazy-loaded. Its design/library rules require a Figma master/frame where absent, version/source-hash and license pins, keyboard/captions and no duplicate control library. Required Figma skill applies when implementation reads/writes Figma; this documentation task did not access Figma. Any absent exact source read packet is a D-data dependency, not a trusted URL parsed from model text.

Start safe presentation work against existing validated public inputs; hold actual receiver integration until D's source/version contract and U-Workspace's shared dependency commit are accepted. Rebase U-Citations after that shared commit; neither lane edits the other's files. Do not change Workspace or live release source while its release is frozen.

## Existing tests and planned falsification

Existing `apps/web/test/run-workspace.test.mjs` and `apps/web/test/cited-answer-assets.test.mjs` are inspection anchors, not proof of live citation behavior. Extend the actual turn/source receiver tests and add focused `apps/web/tests/meri-citations.test.ts` and browser `apps/web/test/browser/meri-citations.spec.ts` only if no equivalent owner exists. Those two names are **proposed**, not claimed existing.

Test exact receipt/version/location after reload; revoked source/cache/excerpt removal; unavailable/withheld/stale/empty distinctions; inert invalid URLs and sanitized markdown; one honest tool error state; authoritative versus estimated usage units; hearing timestamp/keyboard/caption behavior. Kill mutants that trust a model URL, retain a denied excerpt, mark tool failure successful, or use a different source revision. Required browser/accessibility tests are planned, not run.

## Tickets: verbatim retained wording and marked exclusions

**Register decision for MF-16:** UNCHANGED / unlisted — register §B1 unlisted-ticket rule, checked individually. Register §A and standing rules still exclude removed mechanisms wherever historical wording mentions them.

#### MF-16 — Expose citations, evidence and truthful tool/usage details (P1)

- **Root cause / evidence:** Live turn renders plain text, tool name/state and source count; rich cited answer/evidence/coverage/tool/usage screens are fixtures or IDs only.
- **Bounded files/owner:** `ConversationTurn.tsx`, `conversation-view.ts`, workspace projection, new safe rich-answer/source drawer and read adapters; existing SourceCard/evidence UI reused as presentation only.
- **Implementation:** Define typed citation mapping to exact admitted source receipt/version/location; show accessible excerpt and canonical source link only after current access check. Preserve unavailable/withheld/stale state, source date/coverage and failure reason; do not turn arbitrary model text into trusted source URL. Expose bounded tool detail and checkpoint/usage references where public reads exist. Sanitize markdown/links and never execute generated content. Distinguish estimated/recorded/provider usage.
- **Dependencies / exclusions:** MM durable research receipts/artifacts, MT source-read capability truth, MR checkpoint/run details, ST-15 usage. Missing backend read packets are explicit dependencies.
- **Acceptance:** Citations resolve correct source after reload, denied source not leaked through cache/excerpt, invalid links inert, markdown safe, sparse/no sources clearly labeled; tool failure never shown Done as success merely because finished; usage totals attributed to authoritative units.

## Matching E-scenarios (Meri master §5)

| ID | Scenario | Expected result |
|---|---|---|
| E02 | Reload/new tab after completion | Same messages/citations/artifacts, correct ordering and no prompt redispatch |
| E18 | **[RE-SCOPED]** Read active-set and revoked operation | Only <del>measured admitted operations</del> are discoverable/executable; revoked/missing owner refuses |
| E31 | Research citation contradiction/injection | Current cited evidence supports claim; source text cannot authorize tools/effects or fabricate citations |
| E44 | Inaccessible/empty/stale provider data | Truthful unavailable/no-results distinction, no fabricated success/evidence |

Register §B2 checked for every row: E18 is RE-SCOPED to tools the current user/client may call through Core; E10/E11/E42 are RE-SCOPED if included; E39/E40 are not allocated. Other quoted rows are KEEP. E08 means last valid native SDK state, not custom checkpoint machinery. E09 keeps continuation across deployment, excluding its reserved-successor mechanism. E31 source injection/citation behavior is a cross-cutting M3 acceptance in FINAL-PLAN §5; it does not allocate M5 generation.

## Definition of done and gate ownership

MF-16 closes only with real current-access source resolution and the advertised supported citation variants passing, with missing backend receipts explicitly open. Root's shipper runs affected frontend type/build/package checks, source-receiver and browser tests, exact ARM64 image smoke/scan, then real authenticated citation open/reload/revocation/hearing checks. No broader M5 artifact-generation or M6 governance UI is allocated.

Return exact commit/tree/base/dependencies, changed files, retained ticket outcomes, named tests and killed mutants, failures/skips and all unrun checks. Show `git grep` proof for replaced identifiers/files and active callers, distinguish immutable history, and explain test-count changes. No replacement is complete with dead code left behind. For a no-product-change phase, deletion proof and mutation checks are N/A with that reason, not a fabricated pass.

Reviewer uses PROCESS §6.2 and [current examples](90-PROCESS-EXAMPLES.md). Root/Release uses §6.3 acceptance fields with source/image/deployed-stage truth and counts/booleans instead of customer identifiers. Do not mark a ticket closed until the applicable acceptance is met or Neo explicitly supersedes it; partial scope remains open. Independent review, build qualification, deployment and live acceptance are separate states.
