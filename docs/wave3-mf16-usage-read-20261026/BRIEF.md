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

# MF16 recorded usage and native tool outcomes — implementation outline

Branch `codex/wave3-mf16-usage-read-20261026`, checkout `C:/dev/wave3-mf16-usage-integration-20261026`, base PR273 `8807d8b786aabef9d656d0568785c6c0c25e0769` / tree `27737305c4150f27503177eacd49abca76fa1ef6`. PR273 and its native bill-source gate stay frozen in the existing checkout.

The one bounded search confirms only private recordUsage/readUsage and internal routine lineage consumers; product router/public contracts have no authenticated public usage receipt route. Reuse `postgres-store.readUsage`, its canonical binding/hash/transaction checks, the history ownership decoder, current product bearer/Core owner and history retention release fence. Add one narrow history run-context query that excludes usage columns, then check current authorization/retention before calling the retained accounting reader. Final membership/current conversation/retention checks bracket response serialization. No new writer, journal, reservation, pricing, schema, migration or native DB behavior.

Add `/api/conversations/usage` read-only POST and a closed versioned `@capiro/meri-contracts/conversation-usage` byte receiver/schema. Projection distinguishes absent recording, unavailable accounting and recorded zero; exposes existing run-delta estimates/counters separately from cumulative per-model estimates with their original USD/provider/cost basis. Provider billing is unavailable. Omitted audit count and unknown duration remain explicit. Tools are recorded execution outcomes only; drop native tool-use IDs and never join them to UI request IDs or source references. Model/tool identifiers are bounded inert text, never URLs or commands. Drop SDK session, tenant/actor/policy/input hashes, prompts, arguments, outputs and errors.

Focused evidence covers completed/reloaded reads, no record/null/zero, multi-model and cumulative/run-delta separation, partial tools/unknown durations, malformed records, wrong selectors/owners/client, revocation and retention before/after usage storage, actual product route mount and public browser bytes/types. Existing accounting persistence evidence is reused; no new native transaction gate unless implementation changes that owner. No broad parity tests, provider action, frontend work, pack/install/build/cloud.

Unbuilt contracts0.1.15 and ui-stream0.1.5 remain a single pending release cohort. Final package source trees and exact peer bindings will be recorded after source acceptance; PR273 package trees cannot stand in for this follow-on. Root independently reviews/merges; Release alone packages/native/builds/cloud.
