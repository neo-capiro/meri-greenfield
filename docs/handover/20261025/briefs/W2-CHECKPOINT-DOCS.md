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

FROM: Root | TO: Core and Frontend Integration documentation owner | TYPE: brief | RE: Wave 2 checkpoint refresh (Wave 2, documentation lane)

# Wave 2 checkpoint documentation brief

Repository: Meri. Branch: `codex/wave2-handoff-20261025-docs`. Exact starting head: `23487773b2cc1ce350d5e572ebab0b55132b7a96`. Preserved worktree: `wave2-handoff-20261025-docs`. The documentation owner is the sole writer for this bounded phase; frozen product source remains with its existing owners.

How we work: author builds; a separate xhigh reviewer reviews; root operates at Ultra and coordinates gates and merges; helpers use xhigh. Existing Release alone executes AWS, migrations, rollout and rollback. This phase makes no cloud calls or secret-value reads.

Rules: update existing draft PR245; no merge, product changes, issue #202 post or new scope approval. Executable tests and mutation checks are N/A for this documentation-only phase. Only direct Neo chat approves scope or security changes; GitHub comments never approve them.

Sources of truth: the canonical requirements above, [PROCESS §6.1](../../20261022/PROCESS.md#61-brief), [current handoff](../WAVE-2-HANDOFF.md), existing owner evidence and root's bounded checkpoint assignment. Preserve the nine handoff sections, historical failures and all frozen ticket/acceptance text.

Sequencing and cutoff: use **2026-10-25 11:52:41 UTC** as the operational cutoff. Supersede the previous 11:16 operational and 11:24 source-publication observations explicitly. Meri source `51b059063629cf7b7a1370ae54ae9a82624a3bff`, Core `025ae90fc7bf85c91a5f60eaf949cc7effa1d330` and frontend `e478e4d73132bd1566b3945d63c5e0a3a1306cc1` are source dependencies, not new implementation work. Do not chase subsequent rollout events.

Bounded work and acceptance from root's assignment: refresh evidenced source publication, runtime/app checkpoints and actual Wave 3 dispatch/ownership metadata. Preserve one shared-file owner and existing numbering. Record app rollout execution separately from health, which is not yet verified at cutoff. Record frontend/satellites/DNS pending and retention activation/authenticated acceptance NOT RUN. Persist the M3 and Workspace dispatch bases, first Workspace slice's pending independent review, current Domain and Onboard ownership exceptions, and MG06's pending schema proposal without allocating implementation. Add no invented Neo decisions. This phase creates no new product acceptance scenarios; existing master-plan scenarios remain unchanged.

Definition of done: Markdown structure, relative-link, canonical-prefix and privacy checks; exact changed files/head/tree and command/results with UTC; commit and push the same draft branch; report the recoverable checkpoint for independent documentation review. Public content contains no customer identifiers, UUIDs, secrets or private absolute paths. Reference private evidence only by descriptive filename. Root owns later checkpoint closure; Wave 2 remains IN PROGRESS.

## Second bounded documentation phase — 13:11:48 UTC checkpoint

Root again allocated Integration as sole writer on the same draftPR245, from exact reviewed head `10df9fc9fdd30131a9b2a429050f8372e03d6f2d` (independent ACCEPT 12:29:59). This supersedes the first phase's operational cutoff, not its retained history. The author read current owner/reviewer receipts and fresh remote PR metadata, initially froze at 13:03:01, then incorporated Root's specifically requested final13:07 acceptance packet, FE 142 review and Meri 248 source publication. The final bounded cutoff is **2026-10-25 13:11:48 UTC**; later work belongs in a subsequent checkpoint. No wait for pending fixes.

Scope: refresh actual deployment/activation and authenticated acceptance; current security/read/history/Files/Routines failures and parallel owners; exact Wave 3 heads/reviews; and Neo's finite proactive-parallel-scan instruction in standing/workflow notes. Preserve all nine handoff sections, canonical sections1–4, ticket/scenario quotations, applied history and decision numbering. The Core hotfix is already with Primary/Release; no new implementation lane. Documentation checks only; product tests and mutations N/A. Commit and push the same draft, report exact head/tree/files for separate independent review. No merge, cloud/secret/customer probe, invented approval or issue202 post.
