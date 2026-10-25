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

# Current brief, review and acceptance examples

Prepared 2026-10-25 11:20 UTC. These are templates, not live assignments, verdicts or acceptance claims. Each allocated agent/phase receives its own populated brief; do not send one generic wave message to several owners. Full standing rules above must be copied verbatim to the top of each instantiated brief. The original PROCESS roles and public customer-ID fields are superseded by current root/author/reviewer/Release/Acceptance ownership.

## PROCESS §6.1: brief example

```text
FROM: Root Codex | TO: M3 citation/evidence author | TYPE: brief | RE: M3 citation UI phase
Repository: neo-capiro/capiro-frontend
Branch/worktree: <actual isolated branch/path>
Prepared-as-of UTC: <time>
Refreshed-at-send UTC: <time actually checked, never a predicted time>
Remote default head: <actual SHA>; chosen base: <actual SHA>
Accepted Core/Meri dependencies: <exact SHAs>; deployed source: <known/unknown>
Lane/owned files: <bounded explicit paths>; shared-file owner: <name>
How we work: you build; independent reviewer reviews exact head; root orchestrates gates, merges and ships through Release.
Draft PRs only; tests run/not run; mutation-check new tests; no public customer IDs.
Sources: standing rules, plans, register and applicable AGENTS.
Sequencing: open PR exact heads, prerequisite contracts, rebase order, named exceptions.
Tickets: literal retained master wording, excluded mechanisms explicitly marked, register decision for every ticket.
E-scenarios: matching literal rows; no applicable E-row recorded honestly.
Done: ticket outcomes, named tests and mutants, deletion grep, shipper gates and remaining acceptance.
Questions: decide/log in-plan details; only Neo decides unresolved scope/security changes directly in chat.
```

## PROCESS §6.2: independent review example

```text
FROM: Independent reviewer | TO: Allocated author and Root | TYPE: verdict | RE: <draft PR / exact SHA>: CHANGES
Reviewed base/head/dependency SHAs: <actual>
Gate | base result | candidate result | command/evidence | unresolved limit
<affected test> | <PASS/FAIL/NOT RUN> | <PASS/FAIL/BLOCKED> | <actual> | <limit>
1. <file:line>: <concrete defect>. <named test> must fail without the fix. Mutant: <specific wrong behavior>.
Decisions: <in-plan ruling or direct Neo scope/security dependency>.
Unrun shipper checks: <necessary ones only>.
Merge is not requested.
```

Use ACCEPT only with exact-head evidence and no unresolved blocking defect; BLOCKED describes a check, not an invented approval. Root rechecks current PR head/integration and only changed dependencies need affected review.

## PROCESS §6.3: release/acceptance example

```text
FROM: Release Execution owner | TO: Authenticated Acceptance owner and Root | TYPE: acceptance | RE: <release>, deployed <actual UTC>
Source: <Meri/Core/FE SHAs>; images: <exact qualified digests>; runtime/services: <actual versions>
Database: <ledger states/counts, snapshot existence boolean>; no customer identifiers.
Where: <preview URL>; private account/client bindings remain with the authorized operator.
Window: <deploy-free start/end>; cost: <root-allocated finite model-turn budget>.
Criterion | steps | expected | PASS/FAIL/BLOCKED/NOT RUN | UTC/scrubbed evidence
<case> | <exact user actions> | <observable behavior> | <actual result> | <safe evidence>
Failure boundary: <actual>; excluded/unexercised: <reason/prerequisite>.
Rollback: Release only under root orchestration, using existing compatible procedure/private snapshot reference.
Implemented/reviewed/qualified/deployed/accepted remain separate states.
```

Never fill unknown values with examples that look real. No customer IDs/UUIDs/prefixes, private conversation references, secrets or private content in public artifacts. Record counts/booleans; private evidence stays with the existing owner.
