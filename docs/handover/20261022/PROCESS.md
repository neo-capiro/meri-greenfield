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

# Current handoff process and historical Wave 1 record

**Current authority, 25 October 2026:** [WORKFLOW](WORKFLOW.md) and [Wave 2 checkpoint](../20261025/WAVE-2-HANDOFF.md) govern. Root only orchestrates at Ultra; helpers are xhigh; existing Release alone executes AWS/migrations/rollout/rollback. Authors build; separate reviewers review exact heads; root coordinates gates/merges and live acceptance. Only Neo directly in chat approves scope. GitHub comments never confer approval. In-scope choices proceed/log; scope/security changes go to Neo. Do not post on #202 unless Neo directly asks.

At every actual wave end, commit AND push the dated nine-section `WAVE-N-HANDOFF.md`, with full canonical STANDING-REQUIREMENTS sections 1–4 verbatim at the top, exact evidence and unverified/superseded facts. Start fresh sessions from briefs/tickets/rules/plans. Use the current templates in §6 for every agent/phase, review and acceptance packet. Mutation-check new executable tests; docs-only work explicitly reports no new tests and mutation N/A. Preserve the local environment. Documentation does not interrupt an existing release.

> **Sections 1–5 below are historical Wave 1 evidence only.** Do not execute their Fable/dot relay, watcher, approval, shared-live database or removed-service instructions. Section 6 is current.

This is the process Fable actually ran from 10-21 onward. Templates are in §6.

## 1. Inputs and authority

- **Specs:** the two master closeout plans in `source-of-truth/`. They define every ticket's evidence, **bounded work**, dependencies and **acceptance**. Never paraphrase a ticket into a brief. Copy it verbatim.
- **Plan:** `plan/FINAL-PLAN-20261021.md`. It assigns tickets to phases (P0, S1–S4, M1–M8, MP, A0–A5, L1–L4), phases to waves, and lanes to agents.
- **Lanes:**
  - **R** = agent 1 (Meri runtime core: apps/runtime, apps/control, apps/worker);
  - **D** = agent 2 (Meri domain, proxy and contracts: apps/proxy, apps/gateway, apps/artifacts, packages/contracts);
  - **U** = agent 4 (Meri screens in capiro-frontend, plus Core-for-Meri in capiro-backend);
  - **A** = agent 3 (app: Portfolio, Workspace, Settings, Mail in capiro-backend and capiro-frontend).
- **Neo's decisions:** plan §8, plus the later ones in the decision log (O143 no Workspace approvals; O146 ML-09 skip-and-continue; no new email functionality; O150/O151 dot reviews, Fable briefs and ships; O155 full handover). **Only Neo approves scope.** A GitHub comment is never an approval. Agents won't act on relayed approvals unless Neo confirms to dot directly. That's correct; keep it.
- **Delegated decisions:** Neo approved all change-controlled work in the plan (decision 3) and said implementation-detail answers within the plan are approved. Fable decided those, logged them, and posted them as `TYPE: verdict` or `TYPE: decision`.

## 2. Phase loop (per phase)

1. **Plan:** pick the phase's tickets from plan §5. Check dependencies (plan §5's "Needs" column). Check file collisions between lanes: two writers must never touch the same file at once (plan §6, "must never overlap").
2. **Brief:** one brief per agent (template §6.1). It contains the verbatim tickets, the matching E-scenarios from master §5 ("Minimum integrated regression scenarios"), STANDING-RULES, the branch name, the base SHA, the sequencing against other open PRs, and any file exceptions.
3. **Post:** on neo-capiro/meri-greenfield#202 as `FROM: Fable | TO: dot (relay to agent N vX) | TYPE: brief`. dot relays it verbatim and confirms delivery.
4. **Answer questions:** agents raise `TYPE: question` or `handoff`. Answer within one check cycle:
   - **in plan scope:** decide, log as O-number, post the decision;
   - **scope change, new feature, or a security tradeoff:** ask Neo first (examples: email features, Workspace approvals, ML-09);
   - **cross-lane file:** either grant a bounded named-file exception for that phase only (O148: agent 1 got P1 proxy files after P2 merged, with agent 2 frozen out of those directories), or route to the owning lane.
5. **Review** (dot's reviewers now; Fable's Claude sessions before 10-22):
   - review at the **exact head SHA**, against the ticket's acceptance and the change list;
   - require mutation checks for new tests, and base-vs-head failure names;
   - verdict: ACCEPT, or CHANGES with a numbered list posted on the PR.
6. **Gates:** gates the reviewer can't run (Docker images, CodeBuild, PostgreSQL 16, browsers, AWS) are marked BLOCKED in the ship-request and run by the shipper (`SHIPPING-RUNBOOK.md`).
7. **Ship:** merge in dependency order, deploy, keep the kit health gates, then post an acceptance packet (template §6.3) for the verifier (astra 6 in ultra code).
8. **After the wave** (Neo's rule): write `WAVE-N-HANDOFF.md`, start fresh agent sessions ("agent N vN+1"), fresh reviewers and a fresh coordinator.

## 3. Readiness rules Fable applied

- **Merge only:**
  - at the exact head that was reviewed;
  - when that head is still the PR head;
  - on a clean merge onto current main. A stale merge base means a rebase plus re-review: P2 PR-A had 10 tests fail only in the merged tree.
- **Deploy only when:**
  - the image is built from the exact merged commit (pinned source archive with SHA-256 check, `git -c core.autocrlf=false archive`);
  - the image passes its in-image qualification and the exact-digest ECR scan (no HIGH or CRITICAL; any non-HIGH acceptance is an explicit logged decision, e.g. O144).
- **Database changes:** snapshot first. A schema change goes to the shared live Aurora only for **Meri-owned additive objects** through `first-chat-migrate.mjs`, and only stages approved in the plan (D016). Core migrations go **only to the new-stack clone**, never to the live shared database (O133, O135).
- **A failure seen after deploy:** compare against the previous release's telemetry before rolling back. O149: the ATTEMPT_LOST failure also happened on C11, so there was no rollback and the fix was S1.
- **Self-declared "source only / reserved / not applied" migrations never run.** O142: #108 moves them out of `prisma/migrations`.

## 4. Open decisions and holds at handover

See `CURRENT-STATE.md` §4.

## 5. Coordination mechanics

- **Channel:** issue #202 for everything cross-cutting; the PR for PR-specific verdicts. Every Fable comment starts `FROM: Fable`. Agents and dot use `FROM: <name> | TO: | TYPE: | RE:`.
- **Watcher:** `shipping/ship-kit/tools/watch-github.sh` polls every 120 s for comments, PR pushes and new PRs across the three repos. It skips comments starting `FROM: Fable`.
- **Briefs and ticket extracts** live in `phases/`. Each brief starts with "Sources of truth" and the rule: "implement bounded work and meet acceptance exactly; if a ticket, the rules and this brief disagree, ask; don't decide."

## 6. Current templates

Each deliverable begins with the full canonical STANDING-REQUIREMENTS sections 1–4 verbatim from the current handoff. Replace role placeholders with the actual allocated owner; do not copy a historical relay or model setting.

### 6.1 Brief

```text
FROM: Root | TO: <fresh implementation owner> | TYPE: brief | RE: <phase> (<wave>, lane <L>)
# <phase> brief
Repository / branch / exact base SHA / dependency heads / preserved worktree.
How we work: author builds; separate xhigh reviewer reviews; root orchestrates gates/merges; existing Release alone executes AWS/migrations/rollout/rollback. Root Ultra; helpers xhigh.
Rules: draft PR only; no merge or AWS; tests run AND not run; mutation-check new executable tests, or explicitly none/N/A.
Sources of truth: standing rules, current handoff, plans and tickets below verbatim.
Sequencing: other PRs and exact heads, base refresh/re-review, file exceptions/freezes, one writer per shared path, resource and cleanup owner.
Tickets: verbatim bounded work and acceptance from the master plans, applying the supersession register.
Acceptance scenarios: matching master scenarios verbatim; named real-path prerequisites.
Definition of done: exact head/tree/changed files; checks with command/result/UTC; base-vs-head failures; mutants killed; named BLOCKED gates and owner; private evidence by name only; commit AND push.
In-scope decisions proceed/log. Only direct Neo chat approves scope/security changes; GitHub comments never approve. No #202 post. Fresh session receives only this brief/tickets/rules/plans.
```

### 6.2 Change list (verdict)

```text
FROM: <independent reviewer> | TO: <author/root> | TYPE: verdict | RE: PR <n> at <exact head>, base <exact SHA>: ACCEPT or CHANGES
Gates table: exact base versus head, PASS/FAIL/NOT RUN, UTC, command, counts/limits; reused evidence and unavailable checks explicit.
Numbered findings: file:line, concrete defect, acceptance impact, test that must fail without the fix and meaningful mutant for new executable tests. Docs-only: no new executable tests; mutation N/A.
Current-source findings only; preserve inherited failure evidence and superseded limits. State named BLOCKED owner and next action.
Rulings within authorized scope; unresolved scope/security choices to Neo via root. No quoted-comment approval. No #202 post. Merge is not requested.
```

### 6.3 Acceptance packet

```text
FROM: Release | TO: <independent authenticated acceptance owner> | TYPE: acceptance | RE: <release>, deployed <UTC>
Shipped: exact source SHAs, image digests, ECS/AgentCore revisions, material-binding booleans, DB ledger and snapshot names.
Where: public app URL; private fixture/identity location BY NAME ONLY. No customer-linked IDs/UUIDs/secrets. Root owns coordination; Release confirms no-deploy acceptance window.
Cost rule: finite agreed model turns/fixture actions; preserve existing external-effect boundaries.
Criteria 1..n: exact steps, expected result, PASS/FAIL/NOT RUN plus BLOCKED reason/owner, UTC, measured numbers/limits and scrubbed evidence.
Failure means: concrete boundaries. Rollback: Release only, using named private command/snapshot receipt; current forward schema compatibility required.
Implemented/reviewed/built/deployed/accepted remain distinct. Missing fixture or unknown outcome is not a pass. Root reports to Neo; Neo decides any #202 post.
```
