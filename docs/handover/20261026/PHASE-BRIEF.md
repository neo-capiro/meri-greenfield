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

FROM: Root | TO: Remaining Items and Handoff owner | TYPE: brief | RE: Wave 2 accepted fixes, shipping checkpoint and remaining work (lane D, docs only)

# Phase brief — 26 October 2026

Repository: `neo-capiro/meri-greenfield`. Preserved checkout: `C:/dev/wave2-final-handoff-20261026`. Branch: `codex/wave2-final-handoff-20261026`. Exact fresh-main base: `87dc649e829779d5f47e1a0cc5b0e939e0c729d2`, tree `8e5083e9bed316fdd38015b92331d202dfc33020`. The initially stale remote-tracking ref was advanced in this new, clean checkout to the fetched exact main commit before editing.

## Outcome and authority

Neo supplied Fable's completed acceptance, explicitly trusted its fixes and directed Root to avoid overvalidation, merge the PRs, list the remaining items and ship. Reuse that accepted evidence. Do not repeat Fable's tests, acceptance or source review. Root is the Ultra orchestrator/merger; helpers are xhigh. Existing Release alone executes builds, AWS, migrations, deployment and rollback. Current user authorization supersedes historical Fable/dot coordination roles and obsolete holds.

## Owned paths and boundaries

- Sole writer: `docs/handover/20261026/WAVE-2-HANDOFF.md`, this phase brief, and the next numbered decision in `docs/handover/20261022/decision-log/DECISION-LOG.md` after reading the actual last entry. O257 is the last entry at this exact base, so this update records O258.
- User-facing copy: Root workspace `outputs/WAVE-2-REMAINING-ITEMS.md` and `outputs/WAVE-2-HANDOFF.md`.
- No product code, test, dependency, configuration, AWS, provider or database mutation. No browser/model acceptance, external mail or external comments. Draft PR publication is authorized; Root merges. No additional agent delegation.
- Historical `20261025/WAVE-2-HANDOFF.md` and sealed evidence stay unchanged. The new dated record explicitly supersedes old as-of state without erasing it. Integration confirmed no unpublished competing canonical work.

## Sources and dependencies

Read current standing requirements/rules, [PROCESS 6.1–6.3](../20261022/PROCESS.md#6-current-templates), [WORKFLOW](../20261022/WORKFLOW.md), the [supersession register](../20261022/source-of-truth/SUPERSEDED-BY-ITEM-0.md), [previous handoff](../20261025/WAVE-2-HANDOFF.md), master plans and current scoped owner briefs as needed. Product tickets and E-scenarios retain their accepted meaning; this documentation allocation implements no product ticket and creates no new acceptance scenario. Removed mechanisms remain superseded.

Root's supplied authoritative Fable handback covers FE167–170. Existing Acceptance/Runtime outputs preserve earlier FAIL/NOT RUN/UNKNOWN rows. Integration's memory/document composition and Release's image, retirement and rollout handoffs supply achieved stages. Do not expose customer-linked data. The locally available Fable acceptance handoff is a pre-execution packet; do not label it the final result. Final report command-level/UTC details are unavailable to this author unless supplied later.

## Sequence and definition of done

1. Publish the concise remaining list quickly: product blocker, unavailable/unexercised features, inherited harness debt, release/handoff tasks. Do not make unrelated later scope a Wave 2 shipping blocker.
2. Record FE merges and ready Meri source/image separately from deployed facts. A partially advanced Runtime is not a coherent ready tuple. Await Release's actual receipt for final live pins; do not interrupt shipping for documentation.
3. Write exactly the nine established handoff sections with the full standing prefix. Retain original unknown outcomes and the PASS/FAIL/NOT RUN distinctions; no invented test counts, timestamps, hashes, customer identifiers or readiness.
4. Check only documentation diff/whitespace, relative links, exact standing prefix and source/state consistency. No new executable tests; mutation N/A; product test count change zero. No broad qualification or new evidence framework.
5. Commit and push the docs branch, open/attach a draft PR, and hand Root the exact commit/tree/changed paths and validation. A local draft or merged checkpoint does not close Wave 2. Only actual remaining acceptance and Root's explicit closure permit the completion notice.

In-scope choices proceed and are logged. Only direct Neo chat approves scope/security changes. No issue #202 post. Preserve shared WSL, services, data, authentication, checkouts, caches, held histories and private release material. Docs creates no cloud/process resources; Release retains rollback and cleanup ownership.
