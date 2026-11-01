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

# Documentation author brief — Fable Waves1+2 acceptance handoff

FROM: Root | TO: Fable-handoff documentation author | TYPE: brief | RE: Waves1+2 acceptance documentation, lane D

Repository: neo-capiro/meri-greenfield. Fresh isolated checkout: `C:/dev/wave2-fable-acceptance-handoff-20261025`. Branch: `docs/fable-wave2-acceptance-handoff-20261025`. Base/main refreshed from remote at send: `1416f4ade3e576b93cc0a055792969b86f6c5fea`, tree `3bfa427711d0a50015a0cffa6bc83a5134bb2f17`. `git ls-remote origin refs/heads/main` confirmed the same head before the documentation seal. Product release pins are separate and recorded in the handoff.

Root only orchestrates; the author works at xhigh; a separate xhigh Codex reviewer checks the exact documentation head; Root gates/merges and existing Release alone deploys. This is an authorized docs-only assignment, draft PR only. No product code, tests/builds, live browser, model calls, database/cloud operations, main merge or issue#202 comment. No recurring watcher. Preserve other checkouts and the shared local environment.

## Sources, exact assigned work and acceptance

Read `C:/dev/AGENTS.md`, repository AGENTS and implementation standards, current STANDING-REQUIREMENTS, WORKFLOW, PROCESS6.1–6.3, FINAL-PLAN, native-harness spec, AgentCore migration, supersession register and both master plans. The deliverable copies full canonical requirements1–4 verbatim at its top, exact compatible ticket/scenario extracts and current supersession rules. The delegated author is not assigned product implementation tickets; those exact accepted contracts are included in `FABLE-WAVE-2-ACCEPTANCE-HANDOFF.md` for Fable.

Author task, as allocated by Root: produce a concrete self-contained tester handoff, user-facing `.md` and matching `.txt`, commit/push the repo `.md` plus this standalone brief, and open one draft PR. Do not overwrite canonical `WAVE-2-HANDOFF.md` or declare the wave complete. Include retained Wave1 outcomes; current Wave2 Item0/A2/M2/MP and accepted feature slices; latest actual Release/Acceptance facts; practical scenario steps, criteria, evidence boundaries and genuine blockers; finite tester-selected work without a new permission loop; no blind repeat of uncertain effects. The later user clarification adds Figma3.4/current shared-library parity and Fable-authored simple fixes with separate review, while Hermes owns its active memory/doc paths and Root/Release keep their roles. No agreed-architecture drift or complication is authorized.

Matching acceptance contracts for this documentation phase are PROCESS6.1 standalone brief, PROCESS6.2 exact-head verdict, PROCESS6.3 deployed packet and current WORKFLOW§6. Product E-scenarios are copied as retained behavior, with superseded mechanism instructions omitted; documentation does not execute or pass those scenarios.

## Proportionate outline, ownership and sequencing

1. Read fresh canonical sources and existing receipts; distinguish live, merged, built and open unknowns.
2. Assemble practical front matter and exact retained contract appendices. Reuse the parallel Wave1 source map; no recursive delegation or product ownership expansion.
3. Incorporate latest Root cutoff and direct user clarifications before sealing. Release stable receipt at2026-10-25T21:59:13.047385Z is documentary evidence; no fresh cloud query.
4. Check exact standing-prefix equality, output-copy equality, links/excerpt provenance, privacy patterns, scope/cutoff consistency and `git diff --check`. Separate Codex reviewer inspects the exact committed head once plus any required final delta.
5. Commit/push only the two named docs, create/attach a draft PR, return exact head/tree/base, output files, validation and remaining operational questions.

Owned repo paths: `docs/handover/20261025/FABLE-WAVE-2-ACCEPTANCE-HANDOFF.md` and `docs/handover/20261025/FABLE-WAVE-2-ACCEPTANCE-AUTHOR-BRIEF.md`. Owned work scripts/source fragments stay in Root workspace `work/`; user copies stay in `outputs/`. Other docs and product files are frozen to this author. One writer per path. No build/resource locks, databases, cloud fixtures or temporary credentials were acquired. Preserve documentation branch/worktree and evidence for review; no cleanup of other sessions.

## Validation and definition of done

Documentation consistency checks and exact source extraction only. Run: fresh remote-main/source read, canonical prefix equality, all selected retained ticket IDs/E rows present, copied-source provenance/reference definitions, privacy/placeholder checks, byte equality of repo/output `.md`/`.txt`, and Git diff whitespace. Product tests, native tests, Docker, image build/scan, Figma/browser acceptance, models, AWS and database checks **NOT RUN**: this author changes documentation only. New executable tests: none; mutation testing **N/A**. Local excerpt generator syntax/selector corrections are authoring-work failures corrected before publication, not product failures or base-vs-head test evidence. One PowerShell unquoted tree-ref lookup failed and was rerun successfully with the ref quoted; no repository mutation followed from that read error.

Done means the full handoff and brief are committed/pushed on the isolated docs branch, matching user files exist, exact-head independent review findings are resolved or explicitly returned, and the PR remains draft. No product acceptance or Wave2 completion is inferred. Final handback supplies commit/tree/changed files, actual checks/results, failures/unrun checks and existing owners for remaining acceptance. In-scope wording/organization/source-reconciliation decisions proceed and are recorded here; only actual scope/security changes go to Neo through Root. No new product decision is required to publish this documentation.
