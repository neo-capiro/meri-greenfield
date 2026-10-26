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

FROM: Root | TO: Remaining Items and Handoff owner | TYPE: brief | RE: final Wave 2 administrative closure and Wave 3 transfer (lane D, docs only)

# Phase brief — final update, 26 October 2026

Repository `neo-capiro/meri-greenfield`; checkout `C:/dev/wave2-final-handoff-20261026`; branch `codex/wave2-final-handoff-20261026`; original fresh-main base `87dc649e829779d5f47e1a0cc5b0e939e0c729d2`, tree `8e5083e9bed316fdd38015b92331d202dfc33020`.

Neo first directed trust in Fable's fixed UI/checks, merging and shipment without overvalidation. Latest direct instruction assigns residual Wave2 repairs to Fable, closes Wave2 administratively and continues with a fresh Wave3 orchestrator; Neo will post Fable results there. It supersedes the interim wait. Actual deployment and both current Hermes results are now received. Administrative status is CLOSED WITH CARRYOVERS; acceptance remains CHANGES.

This author owns only this dated documentation folder, Root output copies, and continued decision O259 after reading actual last entry O258. Historical25 October handoff and evidence remain unchanged. Root merges the draft docs PR269 and dispatches the fresh visible chat; this author creates no session or goal. New orchestrator runs Ultra, helpers xhigh. Fable exclusively owns remaining Wave2 repairs; old Hermes authors stop at current handback. Existing Release alone owns deployment/rollback. No competing product writers are allocated.

Read [PROCESS6.1–6.3](../20261022/PROCESS.md#6-current-templates), [WORKFLOW](../20261022/WORKFLOW.md), current standing requirements/rules and [supersession register](../20261022/source-of-truth/SUPERSEDED-BY-ITEM-0.md), both master plans and existing Wave3 briefs. This docs allocation implements no product ticket or new acceptance scenario. It preserves actual plan tickets/owners in the adjacent parallel plan. Removed mechanisms remain superseded.

Deliver the nine-section final handoff, concise remaining list, complete Fable brief and unchanged already-delivered launch prompt, updated fresh Wave3 brief/parallel plan, and O259. Record exact Release receipt, three Root smoke outcomes and both repair CHANGES verdicts. Preserve PASS/FAIL/NOT RUN/UNKNOWN, unknown original effects and evidence provenance. No customer identifiers, screenshot or private payload enters the repository.

No product code, test, dependency, configuration, AWS, provider or database mutation; no browser/model check, external mail or external comment. Reuse accepted Fable and Wave3 evidence without reruns. Ordinary docs prefix/link/whitespace/source consistency only; new executable tests0, mutation N/A. No new framework or qualification expansion.

Commit and push all final docs to existing PR269; report exact commit/tree and changed paths for Root's single final docs-delta review. Final docs publication is required for the handoff; it does not claim full product acceptance. Old Root cedes orchestration only after the successor acknowledges its created goal, continuing ownership, Fable/shared-path boundaries and sole Release. Preserve shared environment, private evidence and rollback materials; no #202 posts.