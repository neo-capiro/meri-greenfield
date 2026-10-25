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

FROM: Root | TO: dispatch/reviewer | TYPE: dependency hold | RE: M3 citations

# Citation continuation: no author dispatch

**HOLD — do not launch a fourth Hermes author.** Accepted frontend PR141 remains OPEN DRAFT at `7b613a8a3f8472e24296a01f7e8c2758e97f774e`, tree `c86ce36a8d264166399f68ef74f97fb84184a7d9`, branch `codex/wave3-m3-citations-20261025`. Remote metadata was refreshed 2026-10-25 15:32 UTC. Root supplied independent ACCEPT for saved-source metadata and the corrected incomplete-history tool-result label; GitHub has no submitted review. Prior 26/26 focused units, one correction mutant, 11/11 prior event/assets, seven prior behavior mutants and bounded synthetic browser evidence retain their original scope; inherited 299 architecture review blockers/zero boundary errors and full package/build/live gaps remain explicit.

The actual public contract has no current-access source viewer or authoritative tool-outcome/usage read. Full MF-16 needs current source receipt/version/location resolution, revoked excerpt/link clearing, authoritative usage and hearing timestamp/caption/playback support. Those are named backend/public-contract and adopted media/design prerequisites, plus final Wave2 integration. Neither Data's MT-09 continuation nor Workspace's version-history consumer is allocated to invent those contracts. Accepted presentation is complete within its bounded slice; do not repeat it, parse model URLs into trusted links, build mock-only source viewers, install media packages or enable unqualified variants to keep a lane busy.

Root owns the next allocation after actual canonical producer/contract ownership and accepted pins exist; the existing Data/public-contract owner and frontend shared-dependency owner are dependencies, not implicitly assigned new product scope. A fresh later citation author must receive exact base, contracts, paths, tests and named design/media prerequisites. No branch/worktree or provider/gate resource is allocated by this hold. Preserve the existing citation worktree and `work/` evidence. Original [citation brief](W3-M3-CITATIONS-UI.md) remains historical with full obligations; this hold supersedes its next-dispatch instruction only. See [manifest](W3-DISPATCH-MANIFEST.md) and [reviewer](W3-INDEPENDENT-REVIEW.md).

Only three independent author lanes launch now. Root's explicit Wave2 completion notice is still required for final rebase/integration/deployment/live acceptance. No #202, merge, AWS, provider/model/application action, new authority/cache/profile-pin framework or environment repair is allocated. Review/source/build/deploy/acceptance are distinct. Current roles, full standing rules and privacy/preservation boundaries govern this hold. No new executable tests; mutation/deletion checks N/A because this is a documentation dependency record.

## Verbatim retained ticket

The whole ticket stays binding; only the continuation slice above is assigned now. Historical evidence is not a new defect proof. The register disposition below was checked individually.

**Register decision for MF-16:** UNCHANGED / unlisted — register §B1 unlisted-ticket rule, checked individually. Register §A and standing rules still exclude removed mechanisms wherever historical wording mentions them.

#### MF-16 — Expose citations, evidence and truthful tool/usage details (P1)

- **Root cause / evidence:** Live turn renders plain text, tool name/state and source count; rich cited answer/evidence/coverage/tool/usage screens are fixtures or IDs only.
- **Bounded files/owner:** `ConversationTurn.tsx`, `conversation-view.ts`, workspace projection, new safe rich-answer/source drawer and read adapters; existing SourceCard/evidence UI reused as presentation only.
- **Implementation:** Define typed citation mapping to exact admitted source receipt/version/location; show accessible excerpt and canonical source link only after current access check. Preserve unavailable/withheld/stale state, source date/coverage and failure reason; do not turn arbitrary model text into trusted source URL. Expose bounded tool detail and checkpoint/usage references where public reads exist. Sanitize markdown/links and never execute generated content. Distinguish estimated/recorded/provider usage.
- **Dependencies / exclusions:** MM durable research receipts/artifacts, MT source-read capability truth, MR checkpoint/run details, ST-15 usage. Missing backend read packets are explicit dependencies.
- **Acceptance:** Citations resolve correct source after reload, denied source not leaked through cache/excerpt, invalid links inert, markdown safe, sparse/no sources clearly labeled; tool failure never shown Done as success merely because finished; usage totals attributed to authoritative units.

## Matching E-scenarios, verbatim

| ID | Scenario | Expected result |
|---|---|---|
| E02 | Reload/new tab after completion | Same messages/citations/artifacts, correct ordering and no prompt redispatch |
| E18 | **[RE-SCOPED]** Read active-set and revoked operation | Only <del>measured admitted operations</del> are discoverable/executable; revoked/missing owner refuses |
| E31 | Research citation contradiction/injection | Current cited evidence supports claim; source text cannot authorize tools/effects or fabricate citations |
| E44 | Inaccessible/empty/stale provider data | Truthful unavailable/no-results distinction, no fabricated success/evidence |


MF-16 is UNCHANGED/unlisted under register B1; E18 is RE-SCOPED, E02/E31/E44 KEEP. Full acceptance is retained without an active author allocation.
