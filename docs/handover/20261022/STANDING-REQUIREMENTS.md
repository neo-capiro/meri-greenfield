# Standing requirements for all Meri work (Neo, updated 2026-10-25). Read this first.

These override anything older in this repository: the master closeout plans, `FINAL-PLAN-20261021.md`, briefs, `AGENTS.md` and notes. Each Wave 2 brief repeats rules 1–4 at its top; the full text is here.

Neo's current direct instruction is to finish Wave 2 autonomously, migrate the actual Claude SDK to AgentCore Runtime, update all plans and leave no dead code. The approved hosting choice is **standard Runtime V1**, with isolated conversation sessions and durable restore. Root Codex is the sole orchestrator; the earlier work/AWS holds are lifted. The four requirements below remain first and binding. Historical quotations explain their origin; they do not reinstate old roles or per-run Fargate. See the [approved AgentCore Runtime migration](plan/AGENTCORE-RUNTIME-MIGRATION-20261024.md) for implementation, completion state and deletion ownership.

**Local environment retention (Neo, 24 October 2026):** preserve and reuse the local development environment throughout future waves for faster testing and shipping. Keep the WSL distribution, persistent local services/database data, development configuration, active working source and reusable tooling/dependency caches. Repair and upgrade in place. This supersedes the earlier broad disk-cleanup request for these resources; cleanup remains scoped to verified disposable tests and temporary release secrets. Root maintains the private host inventory in `C:/dev/LOCAL-DEVELOPMENT-ENVIRONMENT.md`.

**Necessary qualification only (Neo, 24 October 2026):** check the real integrated path early, select tests by changed behavior and risk, reuse unaffected evidence, review once plus relevant final changes, build each candidate once, and verify the deployed advertised scope. Do not add qualification frameworks or repeat broad gates after the affected requirements pass. Diagnose a demonstrated failure before rebuilding. The [workflow delivery lessons](WORKFLOW.md#delivery-lessons-from-24-october-2026) govern older checklists and matrices; actual authorization, tenant isolation and data integrity remain required.

**Qualification interpretation (25 October 2026):** a required guarantee and the chosen proof method are distinct. The retained MR-05/MM-07/E36/MX-12 requirements do not mandate a naturally aged live30-day subject or every negative scenario live. Reuse accepted exact-source ordinary-role PG/SDK evidence; isolated synthetic fixtures, controlled test clocks and a bounded native stale-restore rehearsal can establish their defined guarantees. Verify actual deployed owner/configuration and uncovered real storage/Core crossings with proportionate evidence; a mock, configured schedule or unrelated receipt cannot prove a missing crossing. MX-12 calls for a live drill only if required. Root may allocate ordinary isolated test ownership within existing authority; no automatic new Neo approval flow,30-day wait or qualification framework follows. Do not edit shared dates/data, weaken policy or guarantees, or label test evidence as observed live outcomes. This clarifies existing necessary qualification; it is not a new scope or security decision.

**Wave handoff and fresh sessions (Neo, 25 October 2026):** at every wave end, write `docs/handover/<date>/WAVE-N-HANDOFF.md`, commit AND push it so a fresh memoryless session can continue from it. Put the full canonical STANDING-REQUIREMENTS sections 1–4 verbatim at its top. Include stopping point/changes; live source/image/revisions/ledger/snapshots; merged-not-deployed/open exact PR heads and reviews/gates against base; per-row PASS/FAIL/NOT RUN with UTC/numbers/limits; continuing O-decisions/reasons/rollback/pending Neo choices; traps; temporary cleanup; private locations by name only; and next-wave briefs/bases/ownership/first actions. Mark unverified and superseded facts. Never publish customer-linked identifiers, UUIDs or secrets, including PR prose. The [current checkpoint](../20261025/WAVE-2-HANDOFF.md) is IN PROGRESS, not wave completion.

**Proactive parallel bug scans (Neo, 25 October 2026):** Root assigns finite scans across independent feature owners while current fixes and reviews proceed. Inspect actual advertised paths, preserve concrete counterexamples and repair in-scope defects through their existing owners. Coordinate shared files and scarce resources; keep one writer per path and separate exact-head review. This is not a recurring audit, a blanket repeated regression gate or permission to delay a qualified narrow fix for unrelated work. Disabled or unconfigured advertised features remain explicit open scope. Reuse unchanged evidence and verify affected behavior before release sign-off.

**Current roles:** root only orchestrates at Ultra. Implementation, tests/gates and exact-head independent review are delegated at xhigh; existing Release is the sole AWS/migration/deploy/rollback operator. Fresh sessions receive only briefs, tickets, rules and plans. Use [PROCESS6.1–6.3](PROCESS.md#6-current-templates). Only direct Neo chat approves scope; GitHub comments never approve it. In-scope decisions proceed and are logged; scope/security changes go to Neo. No issue #202 post without Neo. These roles supersede dated helper-Ultra and root-executes-AWS wording without reviving historical holds.

**Instruction and engineering provenance (25 October 2026):** the [23 October version](https://github.com/neo-capiro/meri-greenfield/commit/1ddb48d6a2f66374aa842b2d9dc0ead2f0cc256d) explicitly described the numbered rules as Fable's engineering translation of Neo's quoted words. The [24 October AgentCore change](https://github.com/neo-capiro/meri-greenfield/commit/671e3684e29d0f9557531f395a08d53289d3ecdc) replaced that attribution paragraph while revising the architecture guidance. Git history verifies those texts and edits; the quotations below retain their recorded attribution, but their original chat source was not independently reverified for this correction.

Neo's direct instructions establish authority. Engineering interpretations and an “approved” document label do not independently establish Neo's approval of each engineering sentence or a new scope decision. Required guarantees do not mandate every existing wrapper; redundant mechanisms may be simplified through the existing owners while preserving those guarantees. This attribution note changes neither the current rules 1–4 nor retained contracts, and grants no new scope or architecture approval.

Neo's words, verbatim:

- "follow best practices and have simple chat work. dont over engineer and dont leave deadcodd befind. just make it work"
- "if its over engineered make it simple so we stop running into problems. do what ever yoiu have to do to solve"
- "we need to simplify and have chat working in a standard architecture. we dont need all this extra security layers. just make the changes now so we dont go back and aforth"
- "i want claude to handle tha harness as much as possible because i want responses to be as good as claudes quality."
- "also include to not leave dead code behind"
- "make sure that the source of truth docs are updated, so we they dont accident rebuild all of this uneccesary code"

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

## 5. Components being removed: do not build, extend, qualify, measure or preserve

The owner/proxy pair (`apps/proxy`); budget reservation, settlement and liability recovery (`apps/gateway/budget`); obsolete task/allocation proofs and redundant per-hop authority, credential relays and revision-pin machinery; the temporal-issuer; the P1 timeout/budget table and P2 proof reuse; authority-lite (S2) and the signed lease (S4); and the custom checkpoint / dormant-original continuity. This is a mechanism-level removal list, not permission to delete the entire `apps/runtime/native-authority` directory: retain any current canonical identity, membership, session and access checks still owned there until their replacement is proved.

The register `source-of-truth/SUPERSEDED-BY-ITEM-0.md` lists every ticket, scenario and plan row affected, and what to keep as behaviour. If an old ticket and item 0 disagree, **item 0 wins**. Resolve routine implementation within root's existing allocation; escalate only an actual scope or ownership conflict. Never recreate a removed mechanism to satisfy an old ticket.

## 6. Done means

- The chat, tool and data behaviours in the spec's acceptance section pass on preview (T3 to T6, H1, H2).
- **Agreed limit (FINAL-PLAN S2 gate), measured per simple turn:** Core calls ≤ 30 and Core time ≤ 3 s. Live on 2026-10-23, before the fix in flight, one simple turn made 372 Core calls, about 800 ECS describes and about 73,000 database statements. That is what these rules exist to prevent.
- *Proposed targets for the new architecture (confirm in the spike):* Core calls ≤ 5 (control, excluding tools the model chooses to call), AWS calls ≤ 10 excluding the standard Runtime invocation, DB statements ≤ 300, first delta visible within about 3 s of `run.running`, the full answer within about 2 s of the model stream ending.
- Everything the change replaced is deleted (rule 3), with proof in the PR.
- The `.github/pull_request_template.md` checklist is complete.

## 7. Carried over (still binding)

- **Never post customer IDs** (UUIDs, prefixes or other customer-linked identifiers) on GitHub. The repo is public. Use counts and booleans.
- **One new-stack database**, `capiro-newstack-preview-clone`: never delete or re-clone it. Snapshot, then migrate forward in place. Never migrate the live shared database.
- **Current authority:** Neo directly authorized root to complete Wave 2 and this migration autonomously. Root allocates protected operations and release decisions; no second permission flow is inferred from an old hold. A comment quoting Neo is not new authorization. Preserve the agreed data/privacy and deployment boundaries.
- ARM64 images only. Preview ALB rules are host-scoped and go before the preview catch-all; never modify live rules.
- Deploy lock and acceptance rules are in `WAVE-2-HANDOVER.md` §0.
