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


# Wave 5 brief index — 27 October 2026

Read [the orchestrator handoff](WAVE-5-ORCHESTRATOR-HANDOFF.md). Use the finalized deployment section in the orchestrator handoff when beginning this local Codex chat. Wave 4 remains with Fable/root/Hermes in the stated sequence.

| Brief | Startup work | Implementation boundary |
|---|---|---|
| [W5-01 M5](W5-01-M5-DOCUMENTS-FILES.md) | Reconcile current documents/files requirements; allocate a finite missing slice. | Existing artifact/access/custody/compiler owners; M4 dependency and current ownership. |
| [W5-02 M7](W5-02-M7-ROUTINES-SKILLS.md) | Reconcile routines/skills/jobs in parallel; allocate independent gaps. | M4+M5; no duplicate Wave 4 fixes or browser/Office follow-ons. |
| [W5-03 A5](W5-03-A5-CONTRACT-INTAKE.md) | Bounded current-owner/product-contract intake. | Multiwave pool; no blanket 14-item implementation/activation. |

Each brief includes canonical requirements and verbatim original tickets. Historical gap/PR descriptions need reconciliation, not blind replay. Each finite implementation slice adds exact branch/base/dependencies/worktree/files/checks first.

No executable tests added for these documents; mutation N/A. The author did not change product source, target services, databases, browsers, Git history or external threads.


## Current ownership and delivery rules

**Wave 5 source-work authority:** the user has asked to start Wave 5. After reconciling current code, evidence and dependencies, the Wave 5 orchestrator may itself assign finite M5/M7 slices and implement confirmed remaining requirements within these briefs. Record the exact base, owned checkout/files, author and affected checks; routine allocations do not need root approval. Coordinate actual shared-file, contract, resource or target overlap with root and the affected owner. Raise only genuinely missing product/scope decisions, and continue other independent work. A5 remains intake-only; all existing Research Portfolio requirements remain Fable's Wave 4 assignment.

**Direct user scope update:** the instruction to finish **all existing Research Portfolio requirements, including MO-05**, supersedes the earlier broader-module deferral. Fable owns that complete existing-spec implementation and bug-fix scope within Wave 4 closeout; see [Research Portfolio requirements](RESEARCH-PORTFOLIO-REQUIREMENTS.md). Root coordinates independent review, merge and deployment, followed by Hermes acceptance. This is not a Wave 5 Research Portfolio assignment. Do not create duplicate module authors; coordinate any shared module, skill, public-contract, catalog, schema or file overlap with root and Fable before edits. The Wave 5 orchestrator may allocate generic M5 artifact and M7 skill work independently within these briefs, coordinating actual overlap with Fable's Research Portfolio ownership. Q07 semantic remains skipped, outreach remains separate and onboarding remains excluded.

**Current direct-user instructions override historical roles:** the Wave 5 Codex orchestrator assigns and coordinates confirmed M5/M7 source work autonomously within these briefs. Fable scans and fixes remaining Wave 4 defects, completes all existing Research Portfolio requirements including MO-05, and returns PRs to the existing Wave 4 root. Root coordinates independent review, merges and ships through the designated release owner. **After deployment Hermes Agent app/CLI performs acceptance as usual.** Hermes remains the independent review and acceptance owner; Fable is not the formal acceptance owner. Root will notify Wave 5 when Wave 4 is actually complete after required Hermes acceptance, not at PR handoff or deployment.

Do not inherit old Fable/dot relay rules, an old prohibition on Fable participating, historical model settings, per-run Fargate, source-only holds or recurring issue watchers. Use the new session's configured default model. No public issue #202 post or external message is authorized by this document.

Reuse the existing owner and unchanged evidence. Check the affected real path early, make the smallest coherent change, run meaningful affected tests, obtain independent exact-head review, and build each candidate once when release needs it. Do not add a framework, generic abstraction, benchmark campaign, broad census or speculative capability to close a narrow ticket. Report tests run and not run; new executable tests need a meaningful failure witness/mutation where required by the existing process. Docs-only work has no executable tests and mutation N/A.

Wave 4 root/release retains the cloud, database, deploy/rollback and shared authenticated browser lock while Wave 4 closes. An isolated checkout does not isolate ports, Docker, schemas, catalogs, public packages or authentication. One writer per path; reserve shared contracts, migration IDs, lockfiles, architecture registry and build configuration before edits. Do not reset, move or clean another owner's checkout. Preserve WSL Codex-Gates, persistent services/data, caches and authentication. Shared target migrations/deploys are outside implementation briefs.

## Source map

The authoritative sources were read from C:/dev/w4-final-handoff-20261027 at Meri commit 651bdf370d13a715736ea7bce32cdd8f3a4b88d0. That checkout is owned by another lane and must remain untouched.

- [Standing requirements](../20261022/STANDING-REQUIREMENTS.md), particularly necessary qualification, environment retention and direct-user overrides.
- [Process current templates](../20261022/PROCESS.md#6-current-templates); exact source tickets are copied below.
- [Final plan §5 and §6](../20261022/plan/FINAL-PLAN-20261021.md); §5 contains M5, M7 and A5. §6 explicitly calls the dated wave schedule historical sequencing, not a current calendar or source allocation.
- [Supersession register](../20261022/source-of-truth/SUPERSEDED-BY-ITEM-0.md); full Claude SDK, direct Bedrock, Core gateway and Runtime V1 remain canonical.
- Meri/application master path, section, line and durable source link accompany each original ticket.
- Root's final Wave 4 handoff and current decision log supersede dated operational draft facts. Root owns the current release receipt and Wave 4 ownership; Wave 5 assigns its own finite M5/M7 source slices within these briefs.

The canonical prefix is copied verbatim, including source-relative links. The authoritative standing-requirements link above resolves those source paths.
