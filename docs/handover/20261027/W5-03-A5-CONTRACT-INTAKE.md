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


# W5-03 — A5 bounded product-contract intake

FROM: Wave 4 root | TO: Wave 5 orchestrator / application intake owner | TYPE: intake brief

**Allocation:** FINAL-PLAN §5 A5; needs A2. A multiwave pool of 14 items, not a Wave 5 build order. Each starts with a proportionate existing-owner contract. **Intake is the assignment; implementation requires a finite confirmed allocation.**

**Repository/branch/base/worktree:** inspect current Core backend-import, frontend main and only required Meri public interfaces. Record fresh bases; isolated owned worktrees for approved source follow-up. No active release checkout or shared contract edits during intake.

## Intake output

Use existing decisions/plans rather than a new framework. For an examined item give existing owner, observed gap or closure proof, smallest retained behavior, product decision, dependency/overlap and proposed next owner. Recommend a small actionable order; stop at a precise missing decision. Disabled controls and API-only actions are not automatically defects.

| Item | Requirement | Decision/boundary |
|---|---|---|
| PF-04 | Review-only enrichment start/retry and exact approved apply | Existing owner/provider-disabled behavior; no legacy start activation. |
| PF-05 | Defined summary aggregates | Actual semantics/projections, not page totals. |
| PF-06 | Governed Objective Planner/Strategy | Current serving cohort/action, coordinate M7, no duplicate workflow. |
| PF-08 | Questions/applied automation | Product lifecycle versus explicit unsupported choice. |
| PF-15 | Government target linked-work context | Read-only versus authoring, source/visibility. |
| PF-17 | Prospect proposal/file workflow | Drafts separate from separately approved share/send/import. |
| PF-19 | Exact reviewed prospect-brief acceptance | Reconcile Wave 4 brief work first; Fable owns shipped-path defects. |
| PF-20 | Calendar forecast semantics | Approximate-window/source contract or exclusion; preserve shipped calendar. |
| X-07 | Hub metrics | Authoritative counts/current product choice; navigation-only may be explicit disposition. |
| WS-25 | Prospect/copy lifecycle | Transfer denials/source provenance; only missing supported behavior. |
| ST-21 | Audited HQ impersonation | Deliberately held; historical ticket is not activation authority. |
| ST-22 | Managed-import status | Onboarding excluded; status owner/decision only, no provisioning rewrite. |
| ST-23 | Provision→PE and SAM queues | Two actual domain owners, not renamed link endpoints. |
| ST-29 | API-only/exclusions | Agreed parity decision; no invented controls for every API. |

## Exclusions and completion

Research Portfolio implementation belongs to Fable's full existing-requirements Wave 4 assignment, not A5 intake. Q07, onboarding, outreach PR release, impersonation activation, new import subsystem, tenant cutover, production release, external send and live recurring subscriptions remain outside this brief. Conditional effects in a historical ticket are not direct new instructions.

Deliver concise evidence-backed owner/decision dispositions and finite next allocation. Already-closed items reuse evidence. No exhaustive codebase audit or repeated acceptance for intake. Approved follow-up PRs follow source → Hermes review → root merge/deploy → Hermes acceptance.


## Current ownership and delivery rules

**Wave 5 source-work authority:** the user has asked to start Wave 5. After reconciling current code, evidence and dependencies, the Wave 5 orchestrator may itself assign finite M5/M7 slices and implement confirmed remaining requirements within these briefs. Record the exact base, owned checkout/files, author and affected checks; routine allocations do not need root approval. Coordinate actual shared-file, contract, resource or target overlap with root and the affected owner. Raise only genuinely missing product/scope decisions, and continue other independent work. A5 remains intake-only; all existing Research Portfolio requirements remain Fable's Wave 4 assignment.

**Direct user scope update:** the instruction to finish **all existing Research Portfolio requirements, including MO-05**, supersedes the earlier broader-module deferral. Fable owns that complete existing-spec implementation and bug-fix scope within Wave 4 closeout; see [Research Portfolio requirements](RESEARCH-PORTFOLIO-REQUIREMENTS.md). Root coordinates independent review, merge and deployment, followed by Hermes acceptance. This is not a Wave 5 Research Portfolio assignment. Do not create duplicate module authors; coordinate any shared module, skill, public-contract, catalog, schema or file overlap with root and Fable before edits. The Wave 5 orchestrator may allocate generic M5 artifact and M7 skill work independently within these briefs, coordinating actual overlap with Fable's Research Portfolio ownership. Q07 semantic remains skipped, outreach remains separate and onboarding remains excluded.

**Current direct-user instructions override historical roles:** the Wave 5 Codex orchestrator assigns and coordinates confirmed M5/M7 source work autonomously within these briefs. Fable scans and fixes remaining Wave 4 defects, completes all existing Research Portfolio requirements including MO-05, and returns PRs to the existing Wave 4 root. Root coordinates independent review, merges and ships through the designated release owner. **After deployment Hermes Agent app/CLI performs acceptance as usual.** Hermes remains the independent review and acceptance owner; Fable is not the formal acceptance owner. Root will notify Wave 5 when Wave 4 is actually complete after required Hermes acceptance, not at PR handoff or deployment.

Do not inherit old Fable/dot relay rules, an old prohibition on Fable participating, historical model settings, per-run Fargate, source-only holds or recurring issue watchers. Use the new session's configured default model. No public issue #202 post or external message is authorized by this document.

Reuse the existing owner and unchanged evidence. Check the affected real path early, make the smallest coherent change, run meaningful affected tests, obtain independent exact-head review, and build each candidate once when release needs it. Do not add a framework, generic abstraction, benchmark campaign, broad census or speculative capability to close a narrow ticket. Report tests run and not run; new executable tests need a meaningful failure witness/mutation where required by the existing process. Docs-only work has no executable tests and mutation N/A.

Wave 4 root/release retains the cloud, database, deploy/rollback and shared authenticated browser lock while Wave 4 closes. An isolated checkout does not isolate ports, Docker, schemas, catalogs, public packages or authentication. One writer per path; reserve shared contracts, migration IDs, lockfiles, architecture registry and build configuration before edits. Do not reset, move or clean another owner's checkout. Preserve WSL Codex-Gates, persistent services/data, caches and authentication. Shared target migrations/deploys are outside implementation briefs.

## Sources

The authoritative sources were read from C:/dev/w4-final-handoff-20261027 at Meri commit 651bdf370d13a715736ea7bce32cdd8f3a4b88d0. That checkout is owned by another lane and must remain untouched.

- [Standing requirements](../20261022/STANDING-REQUIREMENTS.md), particularly necessary qualification, environment retention and direct-user overrides.
- [Process current templates](../20261022/PROCESS.md#6-current-templates); exact source tickets are copied below.
- [Final plan §5 and §6](../20261022/plan/FINAL-PLAN-20261021.md); §5 contains M5, M7 and A5. §6 explicitly calls the dated wave schedule historical sequencing, not a current calendar or source allocation.
- [Supersession register](../20261022/source-of-truth/SUPERSEDED-BY-ITEM-0.md); full Claude SDK, direct Bedrock, Core gateway and Runtime V1 remain canonical.
- Meri/application master path, section, line and durable source link accompany each original ticket.
- Root's final Wave 4 handoff and current decision log supersede dated operational draft facts. Root owns the current release receipt and Wave 4 ownership; Wave 5 assigns its own finite M5/M7 source slices within these briefs.

The canonical prefix is copied verbatim, including source-relative links. The authoritative standing-requirements link above resolves those source paths.

## Verbatim source tickets

The bodies preserve historical evidence. They are requirements and provenance, not current-head assertions. Apply scope limits and the supersession register first; never recreate retired mechanisms or re-merge old donors.

Source: [PF-04](../20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md#pf-04), docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md:513.

#### PF-04 · P1 safety hold · Enrichment Start / Run again / Retry cannot safely use the legacy start API

**Evidence:** [ResearchSetup.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/enrichment/ResearchSetup.tsx#L78); [RunLedger.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/enrichment/RunLedger.tsx#L56); [ClientEnrichmentDialog.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/enrichment/ClientEnrichmentDialog.tsx#L127); [contracts.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/enrichment/contracts.ts#L153); [client-profile-fill-workflow.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/clients/client-profile-fill-workflow.service.ts#L87).

**Root cause:** Current start can seed website, identity mappings and facility districts before specialist results are approved. Source checkboxes currently represent a setup draft, not a reviewed mutation command. Retry would repeat this unsafe boundary. Existing run review/apply/reject/restore/assign/cancel is already wired and should be preserved.

**Bounded work:** Introduce a review-only start/retry contract. Persist provisional input selections and generated findings within the run, never canonical client fields. Add immutable source snapshot/digest, command ID, run/task retry identity, receipt/status endpoint, role/active-client checks and precise cancellation semantics. Apply should be a separate transactional, version-bound command for the exact reviewed findings. Preserve partial application and per-finding failure; surface unknown outcome across reload. Only then connect source selection, identity selection, start, rerun and failed-task retry buttons.

**Dependencies:** Core enrichment owner, Context Plane and credential/runtime capability, CLIENT_PROFILE_FILL_WORKER_ENABLED, provider limits and worker queue. Do not enable old endpoints to make the UI appear complete.

**Acceptance:** Before approval, canonical website/identities/districts are unchanged; conflicting client revision refuses apply; same task retry cannot duplicate findings or writes; partial/unknown states reconcile; native user/admin wall tests; provider-disabled mode makes zero provider calls.

Source: [PF-05](../20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md#pf-05), docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md:527.

#### PF-05 · P2 · Portfolio/profile/bill/prospect/federal summary placeholders lack compatible aggregates

**Evidence:** [PortfolioPulse.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/index/PortfolioPulse.tsx); [OverviewSignals.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/OverviewSignals.tsx); [BillTrackerPage.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/bill-tracker/BillTrackerPage.tsx#L99); [ProspectPipeline.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/prospects/ProspectPipeline.tsx#L111); [ClientDetails.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/ClientDetails.tsx#L71); [FederalActivity.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/client-profile/FederalActivity.tsx#L60).

**Missing values:** objective-linked work percentage; Need attention/Objectives/Off track/Strategies on Portfolio pulse; touches/reply status/overdue/trend/health/deadline stress/open requests on profile; material changes/watchlist coverage on Bills; weighted pipeline/win rate for prospects; FY obligated/request/associated-program total for Government card.

**Root cause:** UI deliberately refuses to derive authoritative totals from bounded lists or semantically incompatible data. Existing intelligence portfolio-summary/rollup/trend/health and tracker-summary endpoints may be reusable, but their definitions, scope and completeness have not been qualified for these labels. PE relevance is FY-agnostic, capped candidate matching, not a client funding total.

**Bounded work:** Define each metric's numerator/denominator, event kinds, period/timezone/FY, stage weights, counted statuses, archived-client policy, freshness and completeness. Version one aggregate read DTO with availability/reason rather than zeros. Reuse verified service projections where exact semantics match; add only missing calculations. Wire independent queries and error states, not estimates.

**Acceptance:** Tests with paginated >500 activity, >50 alerts, duplicate/cross-client links, no data versus unavailable, FY boundary and changed pipeline stage definitions. Relevance or public program appropriation must never be labeled an award to the client/site. A product decision to remove an unsupported metric is acceptable closure only if explicit.

Source: [PF-06](../20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md#pf-06), docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md:541.

#### PF-06 · P1 activation/contract · Governed Objective Planner and Strategy intake are hard-disabled

**Evidence:** [ObjectiveGovernedPlanner.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/objectives/ObjectiveGovernedPlanner.tsx#L20); [ObjectiveStrategyIntake.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/objectives/ObjectiveStrategyIntake.tsx#L23); [ObjectiveEditor.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/objectives/ObjectiveEditor.tsx); [objective-work.controller.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/clients/objectives/work/objective-work.controller.ts); [objective-planner-work-owner.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/clients/objectives/work/objective-planner-work-owner.ts#L159); [objective-strategy-work-owner.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/clients/objectives/work/objective-strategy-work-owner.ts#L48).

**Root cause:** Frontend receiving exists but no reviewed coherent serving cohort grants it authority. The legacy ObjectiveGeneration path through Strategy /strategies/objective-drafts still exists. Missing activation must not be confused with missing all generation code or solved by silently using the legacy path.

**Bounded work:** Owners choose and document canonical legacy-versus-governed workflow per action. Pin one compatible Core ObjectiveWork + Strategy canonical producer/application + frontend contract cohort; qualify read/status/output first; then generation/continuation/confirm-pair. Replace hardcoded false with fail-closed server-derived capability only after exact route/source/flags are reviewed. Preserve original request identity, saved Objective revision, retained approved output digest, same-request continuation and canonical Planner project/Strategy output identifiers. If legacy path is superseded, migrate its entrypoint explicitly and keep existing-job recovery read compatible.

**Dependencies:** Separate Strategy service configuration PF-24; workload authority, worker/provider/DB schema; flags above; runtime owner receipts.

**Acceptance:** Canonical saved Objective mismatch, stale revision, owner unavailable, lost ACK/reload, conflicting pair, foreign output, archived project and duplicate continuation cases all refuse or recover correctly. Real native receipt links to current Strategy/Planner receiver; no route broadening or automatic provider action during read.

Source: [PF-08](../20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md#pf-08), docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md:569.

#### PF-08 · P2 product/backend gap · Objective Questions and applied Automation lack real producers

**Evidence:** [objective-operational.projection.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/clients/objectives/operational/objective-operational.projection.ts#L491); [ObjectiveOperationalPage.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/objectives/operational/ObjectiveOperationalPage.tsx#L146); [objective-operational.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/capiro/operations/objective-operational.ts#L33).

**Root cause:** The projection explicitly returns not_implemented/unsupported_question_lifecycle and frontend intentionally rejects the unallocated automation branch. Generic automation UI or a fabricated zero would be misleading.

**Bounded work:** Either formally defer/remove the visible unsupported feature with truthful capability copy, or allocate a versioned question lifecycle and applied-composite automation read owner. Define immutable question/request/outcome IDs, lifecycle transitions, author/reviewer roles, source versions, explanation/provenance, current grants, paging and audit trail. Any start/continue action is separate from reading the page. Extend public DTOs and producer first, then receiver, then UI actions.

**Dependencies:** Objective/Meri runtime owners and product decision. Not a one-line flag fix.

**Acceptance:** Unknown versus empty shown distinctly; reading performs no generation/continuation; unsupported producers cannot masquerade as applied output; historical output survives deletion without granting current access; native receipt/authority tests before activation.

Source: [PF-15](../20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md#pf-15), docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md:661.

#### PF-15 · P2 · Government target card has no linked Strategy / ask / next-action projection

**Evidence:** [TargetDrawer.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/relationships/TargetDrawer.tsx#L147).

**Root cause:** Target persistence carries canonical person/tier/source but does not expose the promised linked-work context. No setter/handler exists for this card.

**Bounded work:** Product chooses read-only context or authored target work. Define explicit target-to-Strategy-step/Objective/Planner-task associations with current client/resource visibility and provenance; reuse allocated operational/plan associations if their resource kind genuinely matches, otherwise extend the owner contract. Never infer a link from a matching person name/email or arbitrary note. Add source version, bounded list and actual destination receiver.

**Acceptance:** A target linked to multiple strategies has deterministic disambiguation; removed/archived/foreign-client work disappears or is truthfully unavailable; next action reflects authoritative status/date; no automatic creation or email send from merely opening the card.

Source: [PF-17](../20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md#pf-17), docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md:685.

#### PF-17 · P1/P2 cross-owner · Prospect proposal execution and file transfer are deliberately unsupported

**Evidence:** [ProspectProposals.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/prospects/proposals/ProspectProposals.tsx); [persistence-contract.ts](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/prospects/proposals/persistence-contract.ts); [ProspectFiles.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/files/ProspectFiles.tsx#L57); [ProspectDetail.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/prospects/ProspectDetail.tsx#L181).

**Root cause:** Template browsing is implemented, but a prospective schema is not a mounted creation/send/history workflow. Prospect documents use a distinct security scope; sharing/sending/text import are denied by design. Workspace owner confirmed denyProspectTransfer should be preserved.

**Bounded work:** Split deliverables: (a) canonical prospect-bound proposal draft/revision persistence and returned IDs, linked template/version provenance and commercial-terms policy; (b) explicit generate/save/history; (c) only if separately approved product scope, a reviewed prospect share/send/import capability with concrete recipient, permission and data-class rules. Never relabel a prospect as a client or reuse a client ID to bypass transfer denial. If product remains browse/upload-only, remove misleading expectations while retaining disabled explanation.

**Dependencies:** Workspace canonical proposal/binding owner; mail owner for actual dispatch; prospect visibility and active status; scoped provider contract.

**Acceptance:** Template preview performs no save/send; draft remains prospect-bound after reload; converted/archived prospect refuses unsupported mutation; client/meeting/mail attachment routes reject prospect objects; recipients and immutable revision explicitly reviewed for any later send.

Source: [PF-19](../20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md#pf-19), docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md:713.

#### PF-19 · P1 safety hold · Prospect brief refresh can be previewed but not accepted as the exact reviewed text/citations

**Evidence:** [BriefRefresh.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/prospects/brief/BriefRefresh.tsx#L34); [bizdev-brief.service.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/business-development/bizdev-brief.service.ts#L892); [bizdev-brief.flag.guard.ts](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/business-development/bizdev-brief.flag.guard.ts).

**Root cause:** Accept currently accepts idempotencyKey, expectedVersionNumber and keepUserEdits, then rebuilds proposal internally before transaction. It does not accept the reviewed immutable proposal/sections/citations digest. Connecting a Save button could persist changed content that the user did not review.

**Bounded work:** Persist or cryptographically bind an immutable refresh proposal with base brief version, source snapshot/digest, proposed sections, citations, user-edit treatment and expiry. Accept references that exact proposal ID/digest and expected version; server refuses changed/stale sources according to explicit policy rather than regenerating silently. Add exact resulting version receipt, idempotency and unknown-state recovery; UI compares final saved projection and refreshes history/current brief.

**Dependencies:** businessDevelopment.brief.enabled, BD generation/source owners and Workspace copy identity. Do not enable by bypassing the hold.

**Acceptance:** Source or manual edits between preview and accept cannot silently change saved text/citations; retries return one same version; changed keepUserEdits requires new review; citation identity preserved; draft retained on refusal; actual saved version matches reviewed proposal byte/semantic contract.

Source: [PF-20](../20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md#pf-20), docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md:727.

#### PF-20 · P2 product/data gap · Calendar government forecasts have no published exact-date source contract

**Evidence:** [CalendarPageControls.tsx](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/portfolio/calendar/CalendarPageControls.tsx#L418).

**Root cause:** Existing hearings/comment/effective/funding/Planner sources provide explicit dates; forecast data is a different uncertainty model. It is intentionally unavailable.

**Bounded work:** If product wants forecasts, define a separate approximate window/confidence/source-as-of model with probability and revision, not a fake exact date in the ordinary calendar. Supply an authoritative source endpoint and UI visual distinction; preserve source links and cancellation/revision history. Otherwise document the supported calendar excludes forecasts.

**Acceptance:** An uncertain month/range is never rendered as an exact midnight event/deadline; timezone policy and uncertainty copy survive export/filtering; changed forecast does not create duplicate authoritative events; live source freshness verified.

Source: [X-07](../20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md#x-07), docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md:348.

### X-07 — Define authoritative hub metrics rather than inventing counts

**Priority:** P2 product-contract gap, adjacent to the requested surfaces. **State:** missing aggregate contracts/UI consumer, not a missing navigation handler. **PR disposition:** ordinary cards already in main; no current supplement supplies all seven aggregates.

Main ModuleHub queries available client profiles and renders navigation cards for Engagement, Planner, Workspace, Strategies, Directory, Intelligence and Research Portfolios. It has no card metric query. Existing capped/owner/grant-scoped lists and Portfolio summary are not interchangeable with firm-wide totals. Preview intentionally does not show the ordinary cards or selector.

**Bounded work.** Product and each existing module owner define the exact metric, unit, actor-versus-tenant visibility, client filter, statuses/time window and freshness. Supply bounded authorized aggregates from existing owners; compose only if needed by the seven-card screen. Return unavailable separately from measured zero; never count one page, infer missing records or silently enlarge permission scope. Wire those named values into cards only if the product still wants metrics. Otherwise retain honest navigation-only cards and record the deliberate omission, not a false "fully wired metrics" claim.

**Acceptance.** Empty versus denied versus unavailable versus stale are distinct; paginated populations produce correct totals; actor/client/tenant filters agree with list visibility; partial downstream failures do not zero out other metrics; preview holds remain unchanged.

**Evidence:** [current hub](https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/hub/ModuleHub.tsx), [authoritative receiving map](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/docs/integration/CORE-MODULES-RECEIVING-20261018.md).

Source: [WS-25](../20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md#ws-25), docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md:1772.

#### WS-25 — Preserve and complete prospect/copy guarantees (P2 residual lifecycle; intentional holds)

**Evidence/root cause:** [Prospect][ws-prospect], [save][ws-prospect-save] and [copy][ws-copy]/[recovery][ws-copy-recovery] are already substantial main implementation, not unreceived donor work. Prospect sharing/sending/generation are explicitly denied. Copied Core briefs have independent atomic editing and immutable source lineage; whole-draft restore is refused.

**Bounded work:** Keep current scope/origin/receipt guards while applying only missing safe lifecycle pieces from WS-07, such as version-detail inspection and saved-tab export where supported. Preserve original Core-version evidence separately from newly edited text. If product later wants share/send/generate on prospect-origin content, require a dedicated converted-client authority and immutable-version contract; that decision is outside simple wiring and must not be silently bundled into “enable all controls.”

**Acceptance:** Converted prospect's original identity retained; client-wall revocation after conversion; source/destination mismatch, stale stateHash, exact retained copy/save retry, history containing unknown fields, prohibited restore and generic PATCH attempts against copied tabs. No duplicate copy from recovery and no mutation of the original Core brief.

Source: [ST-21](../20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md#st-21), docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md:2442.

#### ST-21 — Complete audited HQ impersonation only as a whole boundary (P1 HELD, intentionally disabled)

**Evidence.** Core supports start/end sessions and tenant middleware requires an active session matching actor/target before impersonation override, with audit context. Frontend lacks subsequent-request binding, so Start is intentionally disabled. [Disabled UI][st-tenants], [Core sessions L506–575][st-hq-service], [context L529–557][st-tenant-context].

**Tasks.** Qualify purpose-specific start/end operations and a server-owned trusted session binding for subsequent fixed gateway calls. Render persistent “acting as” tenant/expiry indicator and explicit exit. Invalidate caches/drafts and native authority on enter/exit; never forward arbitrary browser tenant headers or silently impersonate on ordinary links. Restrict which surfaces and auth modes support impersonation; personal memory/preferences/native approval routes may deliberately refuse it.

**Tests.** Only capiro_admin; reason required; current session actor/tenant/expiry match; ended/expired session denies; exit restores original tenant; audit of start/end/actions; tabs and request races; no scope applies to another user; direct header without trusted session rejected. Keep feature disabled until these pass.

Source: [ST-22](../20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md#st-22), docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md:2452.

#### ST-22 — Supply managed-import status or remove the unsupported promise (P2, UNSUPPORTED)

**Evidence.** HQ Customers explicitly shows managed import status unavailable; no qualified queue contract in its fixed operations. [Customers][st-customers], [HQ operations][st-hq-operations].

**Tasks.** Locate the authoritative managed-import/onboarding job owner and qualify a bounded status/list/detail projection with target tenant, request, state, counts, errors and last update. Do not confuse ordinary client create, firm-onboarding candidates, or provider sync with managed import. If retry/cancel is required, qualify that owner's supported command; otherwise read-only status plus honest operator path. No broad import subsystem rewrite.

**Tests.** Queued/running/partial/failed/completed, wrong tenant, pagination, stale last update, count reconciliation, no inferred completion from client count. Product explicitly accepts unsupported disposition if no current owner exists.

Source: [ST-23](../20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md#st-23), docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md:2462.

#### ST-23 — Finish Provision→PE and SAM analyst queues with exact domain contracts (P2, UNSUPPORTED)

**Evidence.** Both panels explicitly unavailable; Provision candidate count exists but no screen queue/decision implementation. [Analyst L23–46/L76–80][st-analyst].

**Tasks.** Inspect and qualify authoritative service projections for these exact analyst queue identities. Reuse existing domain services only when evidence/decision/state semantics match; per-program/PE link endpoints are not automatically a review queue. Add fixed list/detail/decision contracts, paging/filters/evidence/reasons and true accepted/rejected/pending result handling, or formally mark unsupported with no action promise.

**Tests.** Reviewer capability, candidate stale/race, duplicate decision, foreign or nonexistent entity, immutable evidence, audit, counts update, no mutation of unrelated canonical program/provision/person. Keep two separate tickets internally if service owners differ.

Source: [ST-29](../20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md#st-29), docs/handover/20261022/source-of-truth/Capiro-Portfolio-Workspace-Settings-Mail-Wiring-Closeout-Plan-20261021.md:2526.

#### ST-29 — Resolve API-only actions and explicit product exclusions (P2 decision, not automatic new features)

**Evidence.** Tenant redacted audit log, raw usage events, memberships, and various server admin utilities exist without visible Settings controls. This alone does not mean the visible feature is broken. [Operations][st-operations], [tenant audit service][st-tenant-service], [HQ controller][st-hq-controller].

**Tasks.** Record each as intentionally API-only or add a narrowly scoped entry if part of agreed parity. Tenant audit is the clearest useful candidate: add an ordinary-admin audit read tab using the already redacted DTO, never HQ before/after payloads. Do not invent buttons for password reset, arbitrary user removal, logo deletion, invite cancellation, tenant policy editing, or new providers merely because related backend code exists.

**Tests.** If exposed, current tenant admin only, redaction invariant, paging/filters and no foreign tenant metadata. Otherwise an explicit unsupported/external disposition closes the gap without speculative architecture.

### Source reference definitions

[ws-prospect]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/prospects/ProspectWorkspace.tsx
[ws-prospect-save]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/prospects/useProspectDraftSave.ts
[ws-copy]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/brief-copy/BriefCopyFlow.tsx
[ws-copy-recovery]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/modules/workspace/brief-copy/CopyRecovery.tsx
[st-tenants]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/hq/TenantSettings.tsx
[st-hq-service]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/capiro-admin/capiro-admin.service.ts
[st-tenant-context]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/tenant/tenant-context.middleware.ts
[st-customers]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/hq/CustomerSettings.tsx
[st-hq-operations]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/capiro/operations/settings-admin/hq.ts
[st-analyst]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/features/settings/analyst/AnalystSettings.tsx
[st-operations]: https://github.com/neo-capiro/capiro-frontend/blob/4f9a7e8dcaa9ba03494dc5a49559daf70cea5100/apps/web/src/shared/capiro/operations/settings.ts
[st-tenant-service]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/tenant-admin/tenant-admin.service.ts
[st-hq-controller]: https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/capiro-admin/capiro-admin.controller.ts
