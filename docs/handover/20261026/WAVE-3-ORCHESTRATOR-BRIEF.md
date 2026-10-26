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

FROM: Root | TO: future fresh visible Wave 3 Codex orchestrator | TYPE: brief | RE: Wave 3 completion and explicitly transferred carryovers (PREPARED FOR DISPATCH; NOT STARTED)

# Wave 3 orchestration brief — ready for Root dispatch, not started

**PREPARED FOR DISPATCH; NOT STARTED by this author. Final update:26 October2026.** Neo now directs administrative Wave2 closure with residual repairs assigned to Fable and continuation in a fresh Wave3 chat, where Neo will post Fable results. This supersedes the prior wait. Both current Hermes results, sealed deployment and three Root smoke results are received. Wave2 is CLOSED WITH CARRYOVERS; acceptance CHANGES. Root dispatches after this final docs merge; no further result-wait dependency remains. Old Root remains orchestrator until the successor acknowledgement below.

## Objective, authority and transfer protocol

On old Root's explicit dispatch with this final Wave2 handoff, the fresh visible chat becomes the sole **Ultra** Wave3 orchestrator. Its first action is to establish the user-requested goal with `create_goal`, objective **“Work Wave 3 to completion, including explicitly transferred Wave 2 carryovers, through implementation, targeted independent review, integration, deployment, acceptance and a committed/pushed final handoff.”** Omit `token_budget`; the user specified none. Do not mark the goal complete merely because a checkpoint or administrative wave transfer was published.

The successor acknowledges to old Root: goal created, scope understood, exact continuing owners and one-writer freezes retained, sole existing Release retained, and final received deployment/carryover receipt identified. Old Root cedes orchestration only after this acknowledgement. Until then it retains current results and shipping coordination; do not run two orchestrators. Old Root passes any outstanding operation IDs and unknown effects by private owner location and then stops new allocations. User authorization for this transfer includes the necessary handoff coordination; the successor must not infer permission to message unrelated chats.

The continuing **Wave 2 — Release Execution Continued** chat remains the only shipper. Do not create a new deployment owner or issue a second deployment while its current operation is running. Existing Release retains AWS, protected database operations, build/image publication, deployment and rollback. Helpers and reviewers use **xhigh**; Hermes authors are independently reviewed by Codex at exact heads. Use task subagents for distinct bounded work after transfer, and multiple visible sessions only where the user's orchestration plan calls for a persistent owner. Preserve existing active authors before starting more.

Neo explicitly trusts Fable's fixed UI items and passed tests. No new acceptance/review/test cycle for those unchanged fixes. Select checks by new behavior or a concrete remaining risk; reuse accepted source, test, PostgreSQL and image evidence. Complex or stuck Wave3 issues go to Hermes through the existing launcher with exact source/path ownership and a separate Codex reviewer, excluding Fable-owned carryover paths. Fable owns residual Wave2 fixes; never launch a competing author there. Do not create extra orchestration layers, a test framework or a census of everything merely to begin work.

## Repository bases and preserved environment

Read-only remote heads refreshed during this preparation; they are source bases, **not final deployed pins**:

| Repository / default | Exact head | Preserved reference checkout |
|---|---|---|
| `neo-capiro/meri-greenfield` / `main` | `87dc649e829779d5f47e1a0cc5b0e939e0c729d2` | `C:/dev/wave2-final-handoff-20261026`; docs branch `codex/wave2-final-handoff-20261026` is owned by the handoff author |
| `neo-capiro/capiro-frontend` / `main` | `d285e659f2bfbc00bfbd464b8c6f07dfba898d5d` | `C:/dev/wave2-visible-mail-frontend` is a read-only reference for this brief; do not edit that owner's checkout |
| `neo-capiro/capiro-backend` / `backend-import` | `722f094cf60e40b2fb270bb5c1e06bf66d795c42` | `C:/dev/wave2-visible-mail-core` is a read-only reference; Core does not use `main` |

Refresh source/default and selected open PR heads once at dispatch. Existing stacked Wave3 PRs keep their accepted dependency bases; do not reset, cherry-pick twice or silently rebase onto unrelated default-branch changes. Reconcile only the actual integration delta. The lane plan contains exact open heads and preserved owners. No branch mutation, source test or build was done during preparation.

Preserve `C:/dev/LOCAL-DEVELOPMENT-ENVIRONMENT.md`, WSL `Codex-Gates`, persistent services/databases/authentication/configuration, all checkouts and reusable caches. Root serializes shared ports/Docker/heavy gates. Worktrees do not isolate AWS or shared databases. Keep the single preview clone and applied migration history; existing Release owns snapshots before forward migrations. No shared-live migration or routine environment reset.

## Required source-of-truth files

Canonical repository documentation root: `C:/dev/wave2-final-handoff-20261026/docs/handover/20261022`. A fresh source checkout may use the same repository-relative paths. These files supply detailed work and acceptance; older status/roles/holds are superseded by actual current receipts and Neo's latest direct instructions.

1. `STANDING-REQUIREMENTS.md`, `source-of-truth/STANDING-RULES.md`, `WORKFLOW.md`, and `PROCESS.md` sections6.1–6.3. Read applicable host/repository `AGENTS.md` and `docs/IMPLEMENTATION-STANDARDS.md` before source work. Preserve full canonical standing1–4 at the start of every new phase brief, verdict and handoff.
2. `source-of-truth/SUPERSEDED-BY-ITEM-0.md`; `phases/wave2/WAVE2-00-CLAUDE-NATIVE-HARNESS-SPEC.md`; `plan/AGENTCORE-RUNTIME-MIGRATION-20261024.md`. The full Claude Agent SDK harness on standard AgentCore RuntimeV1, direct Bedrock, Control tool gateway and Core authorization remain the architecture. Keep native tools/subagents/all14 skills/session handling, durable user/firm memory and required Temporal durability. Do not revive model proxies, owner/issuer authority layers, custom warm pools, per-turn ECS runners or spend-reservation ledgers.
3. `plan/FINAL-PLAN-20261021.md`, especially phase/wave table, ticket index, current-scope rules and library map; both full masters: `source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md` and `source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md`. New implementation briefs copy their applicable bounded work, acceptance and E-scenarios verbatim, applying supersession first.
4. Final `docs/handover/20261026/WAVE-2-HANDOFF.md` and Root output `WAVE-2-REMAINING-ITEMS.md` **as supplied at actual dispatch**. This is the final CLOSED WITH CARRYOVERS administrative handoff; functional acceptance remains CHANGES. Read adjacent `FABLE-WAVE2-CARRYOVER-BRIEF.md` and the preserved `FABLE-WAVE2-REMAINING-FIXES-PROMPT.txt` before coordinating residual work. The historical25 October handoff retains original evidence; don't re-run it or treat its obsolete deployment holds as current.
5. `docs/handover/20261025/briefs/W3-DISPATCH-MANIFEST.md`, `W3-M3-DATA.md`, `W3-M3-CITATIONS-UI.md`, `W3-A3-DOMAIN.md`, `W3-A3-WORKSPACE-UI.md`; continuations `W3-CONTINUE-M3-DATA.md`, `W3-CONTINUE-M3-DATA-GATEWAY.md`, `W3-CONTINUE-M3-CITATIONS-HOLD.md`, `W3-CONTINUE-A3-DOMAIN.md`, `W3-CONTINUE-A3-WORKSPACE-UI.md`; next slices `W3-NEXT-A3-DOMAIN-EXPORT-SIGNING.md`, `W3-NEXT-A3-WORKSPACE-UI-EXPORT.md`, `W3-NEXT-A3-LIBRARY-CONSUMER.md`; and `W3-INDEPENDENT-REVIEW.md`. Their prior deployment/source timestamps remain historical; use the exact current continuation heads in this lane plan.
6. `C:/Users/Administrator/Documents/Codex/2026-10-25/wave3-hermes-independent-review/outputs/W3-REVIEW-EVIDENCE-INDEX.md` and its named final reviews. They distinguish ACCEPT/CHANGES and reused versus unrun checks. Do not restart accepted slice review because an older PR description still says pending.
7. `C:/Users/Administrator/Documents/Codex/2026-10-25/wave3-ordinary-atomic-save/work/stage/docs/wave3-ordinary-save-20261025/{BRIEF.md,README.md}` and its owner checkout `C:/dev/wave3-ordinary-save-20261025`. The older `outputs/progress.txt` says22 browsers; the final README/author message says23 and supersedes that count.

The parallel plan is `WAVE-3-PARALLEL-LANE-PLAN.md` beside this brief. Root exports both into `C:/Users/Administrator/Documents/Codex/2026-10-24/wave2-orchestrator-handoff-20261024/outputs` for dispatch. File contents and references, not prior chat memory, are the pickup record.

## Continuing owners and immediate carryovers

Use these exact visible chat titles with `list_threads`/`read_thread`; chat identifiers remain in Root's private coordination state. `notLoaded` is not abandonment. Existing user authorization persists across the handoff.

| Existing owner | Current responsibility / private local handoff |
|---|---|
| **Wave 2 — Orchestrator continuation** | Old Root retains coordination until the acknowledgement protocol above. Root completed exactly3 smoke submissions/no retries; the allocation is exhausted. Final results are in the handoff and Acceptance addendum |
| **Wave 2 — Release Execution Continued** | Sole shipper; `wave2-visible-release/outputs` actual build/deploy/rollback receipts. No second shipper or duplicate execution |
| **Wave 2 — General Chat and Email Repair** | Current lane closed CHANGES; FE172 head71f6343 remains DO NOT MERGE. Existing author finished/stopped. `wave2-general-chat-email-repair/outputs/FABLE-CARRYOVER.txt` and `HERMES-REVIEW.txt` preserve candidate and actual successor-reservation counterexample for Fable |
| **Wave 2 — Schedule Worker** | Existing mechanical launcher; current Outlook author finished/stopped. Core139 heada2b827d has documentation CHANGES, no identified projection-code defect, independent13/13 PASS. Preserve checkout and `HERMES-OUTLOOK-{REPAIR-BRIEF,STATUS,RESULT}.txt`; later independent review supersedes author overclaims. No new Wave2 author |
| **Fable** | Exclusive residual Wave2 source owner: General mail, explicit safe recovery, Outlook read-sync/status, prepared actions and affected memory/document flows. Neo posts results here; review only new changed risk, merge accepted fixes and ask sole Release to ship |
| **Wave 3 — Ordinary Atomic Save** | Active single author; local72unit/23browser PASS, same33base TypeScript errors; publication, exact-head review and architecture/import disposition pending. Do not replace the writer or edit its frozen files |
| **Wave 3 — Workspace Library** | Accepted FE158 and FE166 slices; existing consumer/source evidence in `wave3-visible-library/outputs` |
| **Wave 3 — Hermes Independent Review** | Existing independent Codex review owner and accepted evidence index; reuse final verdicts, allocate only actual new/delta reviews |
| **Wave 2 — Core and Frontend Integration** | Existing integration/composition ownership and source-receipt history; coordinate shared manifests/contracts/registries rather than parallel writes |
| **Wave 2 — Runtime and Objectives**, **Wave 2 — Mail**, **Wave 2 — Portfolio**, **Wave 2 — Tenant Settings** | Retained read/runtime/mail/memory/document/unknown-effect evidence. Consult only the owner needed for a concrete carryover; no broad re-audit |
| **Wave 2 — Authenticated Acceptance** | Could not verify a usable normal browser for the current smoke; Root took that finite check. Existing acceptance outputs and held histories remain valid evidence |

**Outlook correction is binding:** the provider-not-configured copy and disabled action in the retained screenshot belong to the Gmail/Google Workspace card, not Microsoft365. Do not infer missing Microsoft credentials from it. Actual Microsoft symptoms are stale/degraded sync, missing complete-batch records and expired subscriptions/no renewal. Outlook provider work is separately authorized; it is not the cause of the earlier General admission failure and does not authorize external sends or consent on Neo's behalf.

Prioritize Fable's explicit carryovers without starting duplicate work: General mail denial remains; FE172 unsafe recovery is CHANGES / DO NOT MERGE; Core139 documentation is CHANGES; prepared actions are unavailable; original M1/D1 effects remain UNKNOWN. General admission/history worked in the fresh smoke but historical5xx cause is unproved. The final coherent tuple is Core15/929acd, Control72/Worker68/Schedule5/87dc, FE33/d285, Runtime9/preview9/DEFAULT9, stable00:34:47.377383UTC. Root used exactly3 prompts: mail denial, successful client read, successful follow-up/streaming with cancellation NOT PROVEN. Read the handoff for exact sources/digests/receipts. No further old-wave prompt allocation or repair cycle.

## Initial operating sequence after acknowledged transfer

1. Read the actual final Wave2 receipt/carryover disposition and these documents; establish the goal and acknowledge sole orchestration plus continuing ownership. Confirm no in-flight deployment before scheduling a successor release.
2. Inherit Fable's exclusive carryover ownership and both current CHANGES candidates; old Hermes authors finish no further source cycle. Wait for Neo's Fable results while parallel distinct Wave3 work proceeds. Review targeted changed risk, then merge/ship accepted fixes through the existing Release. Do not repeat Fable UI acceptance.
3. Finish publication/review disposition for Ordinary Atomic Save and adopt accepted Wave3 slices in dependency order. Refresh only changed heads/bases; no blanket revalidation or wholesale cherry-pick from stale stacks.
4. Use the lane plan to allocate parallel tasks across distinct actual plan tickets/files. Record one writer for each shared contract, lockfile, schema/migration, CSS, export barrel or architecture registry. Keep ready independent work moving when one lane waits; route complex/stuck Wave3 issues outside Fable-owned work to Hermes with a separate Codex reviewer.
5. For new source, follow PROCESS6.1 author → PROCESS6.2 independent exact-head review → one integrated build/image qualification → sole Release deploy → PROCESS6.3 affected real-path acceptance. No source ACCEPT, mocked browser, image smoke or healthy task implies a later stage. Record tests run/not run, actual baseline failures and meaningful new-test counterexamples without a broad mutation campaign.
6. Maintain a concise actual ticket ledger and remaining list. At Wave3 completion commit AND push the dated nine-section handoff with standing1–4, actual pins/receipts, continued real O-number sequence, failures/unrun/unknowns, cleanup and next owners. Mark the goal complete only when its agreed objective is achieved; report any deliberately transferred scope honestly.

## Scope guard and acceptance

Actual Wave3 plan: retained M2 runtime/V1 lifecycle, **M3** reads/citations/index freshness and **A3** Workspace WS05–21 plus ML24. Preserve accepted Wave2 work and separately authorized carryovers. Full M4/A4 mail-send expansion, M5 all-format artifacts/WS22–24, M6 memory governance, M7 Cowork and M8 browser/device work are later phases unless directly pulled forward; don't invent them as Wave3 blockers. Existing user/firm memory and already enabled capabilities remain protected.

FINAL-PLAN decision11/O143 removes Workspace approval workflows. Apply that decision to older WS03/WS09 approval wording while retaining sharing, current authorization, walls and durable receipts. It does not remove Meri or release approvals. Use the already selected library ownership (Plate for A3 documents/rich newsletters; AI Elements Source/InlineCitation and Media Chrome controls + Vidstack engine for relevant MF16 hearing citations); inspect installed/accepted work before adding dependencies. A library migration is not permission for duplicated editors or a new rendering owner.

Only Neo directly approves actual scope/security changes. In-scope implementation choices proceed/log. No #202 posts, external comments, unsolicited external send, provider consent, new recurring monitor or speculative customer-data fixture. Preserve unknown outcomes, current Core access and durable exact-replay fences. A new session does not reset these constraints.

Preparation validation is documentation-only: no product tests, new executable assertions, browser/model/provider/AWS/database actions, sessions, goal or dispatch. Mutation N/A. Final deployment, smoke and both Hermes results are recorded; successor dispatch/goal remain for Root and the fresh chat. No new decision is required to start Fable; actual OAuth consent is a human action only if later proved necessary.
