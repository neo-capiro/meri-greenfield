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

# Research Portfolio requirements for Fable

27 October 2026. Companion to the [Fable handoff](FABLE-HANDOFF.md), [Wave 4 inventory](WAVE4-ITEM-INVENTORY.md), and [current release handoff](WAVE-4-HANDOFF.md).

**Neo now assigns Fable all existing Research Portfolio requirements, including the full module beyond sharing and MO-05's 17-operation Meri integration.** This supersedes the earlier Research Portfolio deferral. Fable recovers requirements, investigates bugs, completes implementation and runs appropriate author checks. Root receives PRs, arranges independent review, merges and deploys. Hermes Agent app/CLI performs formal acceptance after deployment. This document does not transfer target-operation or acceptance ownership to Fable.

The recovered inventory below contains the **70-row register** (28 module requirements, 18 screens/actions and 24 acceptance scenarios), its 12 section 14.2 probes, MO-05's 17 operations, FR-15.22 and full section 16 (FR-16.1–FR-16.45 and 16A–16I). On 27 October Neo directly selected **“Use the recovered scope for final sign-off (Recommended).”** These recovered requirements are the authoritative closure scope. **Original sections 1–15 and F01–F42/V4-01–V4-15 remain unrecovered provenance, not a sign-off blocker.** Do not invent those definitions or describe this as recovery of the missing original specification. Actual applicable implementation, review, deployment and acceptance obligations remain open until evidenced.

Fable returned unverified static findings without fixes. Root's Core, Meri and frontend authors are now closing that return; [the current disposition table](FABLE-HANDOFF.md#current-return-dispositions) separates author repairs from independent review and deployment. This update prepares documentation only and does not mark Wave 4 complete.

## Source authority and current baseline

The latest direct user instruction sets scope. The current dated release handoff sets serving sources and operational state. The original functional specification and repository requirements define intended behavior. Historical implementation reports supply evidence at their recorded source, not fresh defect or acceptance verdicts. Where these disagree, retain the contradiction, follow the latest explicit requirement, and ask root only for genuinely missing product meaning.

| Source | Exact reference and use |
| --- | --- |
| Repository project scope | [PROJECT-CLOSEOUT-PLAN.md](https://github.com/neo-capiro/capiro-backend/blob/cae35473ceae6e53e0a302a174d2a8791d4465bc/docs/research-portfolios/PROJECT-CLOSEOUT-PLAN.md): phases 0–11, implementation behavior, qualification and release boundaries. Its numbered internal “Wave 0–8” sections are historical project stages, not a reallocation of the current Wave 5. |
| Requirement and design inventory | [phase11/requirements-and-screens.md](https://github.com/neo-capiro/capiro-backend/blob/cae35473ceae6e53e0a302a174d2a8791d4465bc/docs/research-portfolios/phase11/requirements-and-screens.md): all RP/DI/MX/OP and S01–S18 rows, including named routes, components and domain owners. Tables are preserved below. |
| Acceptance requirements | [phase11/acceptance-results.md](https://github.com/neo-capiro/capiro-backend/blob/cae35473ceae6e53e0a302a174d2a8791d4465bc/docs/research-portfolios/phase11/acceptance-results.md): AT-01–AT-24, section 14.2 and supporting regressions. Historical results are not the current release result. |
| Later bounded implementation evidence | [CURRENT-BRANCH-CLOSEOUT-2026-09-28.md](https://github.com/neo-capiro/capiro-backend/blob/cae35473ceae6e53e0a302a174d2a8791d4465bc/docs/research-portfolios/CURRENT-BRANCH-CLOSEOUT-2026-09-28.md) and [its JSON](https://github.com/neo-capiro/capiro-backend/blob/cae35473ceae6e53e0a302a174d2a8791d4465bc/docs/research-portfolios/CURRENT-BRANCH-CLOSEOUT-2026-09-28.json): finite prior fixes, evidence limits, and the missing-original-plan record. Follow its reference to [legacy capirov2 PR1903](https://github.com/neo-capiro/capirov2/pull/1903) when recovering source lineage. |
| Historical release criteria | [phase11/release-controls.md](https://github.com/neo-capiro/capiro-backend/blob/cae35473ceae6e53e0a302a174d2a8791d4465bc/docs/research-portfolios/phase11/release-controls.md) and [phase11/README.md](https://github.com/neo-capiro/capiro-backend/blob/cae35473ceae6e53e0a302a174d2a8791d4465bc/docs/research-portfolios/phase11/README.md): required provenance, source limits and recovery. Read historical zero-cohort/NO-GO statements at their date. |
| Current Meri obligation | [MO-05](https://github.com/neo-capiro/meri-greenfield/blob/8acb394cf10782d1a7703fa2d0b8c926f14ab508/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L1278) and [exact original operation list](https://github.com/neo-capiro/meri-greenfield/blob/8acb394cf10782d1a7703fa2d0b8c926f14ab508/docs/handover/20261022/source-of-truth/Capiro-Meri-Wiring-Closeout-Plan-20261021.md#L3138). Old catalog exclusions are the work to reconcile, not a present deferral. |
| Direct user sharing specification | `C:/Users/Administrator/Documents/Codex/2026-10-27/research-sharing-finish-20261027/outputs/SECTION-16-SOURCE.txt`, supplied directly by the user on 27 October. FR-15.22 and sections 16A–I are reproduced verbatim below so the published handoff is self-contained for these requirements. |
| Current serving state and fixed evidence | [Wave 4 handoff](WAVE-4-HANDOFF.md) and [Fable handoff](FABLE-HANDOFF.md). They own the latest merged/deployed distinction, migrations, packages, authentic branding restoration, frontend named-widget refusal fix, and existing exact DOCX PASS. Reuse unchanged accepted work; do not replay a migration or an accepted campaign to reconstruct a missing receipt. |

The repository documents above were read from `C:/Users/Administrator/Documents/Codex/2026-10-27/research-sharing-finish-20261027/work/backend/docs/research-portfolios/`. The Meri source was read from `C:/dev/w4-final-handoff-20261027/docs/handover/20261022/source-of-truth/`. File hashes are recorded at the end. These are source-document pins; they do not assert that a historical checkout is the serving image. The final operationally healthy cohort is recorded in the release handoff; it does not establish full Research Portfolio acceptance.

Use S01–S18 and their actual current components as the available screen requirements. No Figma file URL was recovered in these RP source documents. Follow a real existing design reference when available; recover a missing referenced design rather than invent a new redesign. Appropriate Playwright developer evidence supports Fable's visual fixes; Hermes owns later independent visual acceptance and must inspect actual renders.

## Recovered scope and retained source provenance

The exact available historical statement in `CURRENT-BRANCH-CLOSEOUT-2026-09-28.md`, under “What remains,” is:

> **fullPlan**: BLOCKED: original START-HERE/213155-byte portable plan/F01–F42/V4-01–V4-15 source files unavailable. Existing70 rows are fully enumerated; unknown definitions are not invented.

The matching JSON additionally records `Original START-HERE/full portable plan/F01-F42 and V4-01-V4-15 definitions/audit unavailable; unknown obligations cannot be invented from ranges/PARTIAL labels.` The earlier `BRANCH-CLOSEOUT-2026-09-28.md` has the same boundary. These sources do not give an extension or exact path for `START-HERE` or the 213155-byte plan; no more precise filename should be fabricated.

That September `fullPlan: BLOCKED` statement is preserved as provenance. Neo's later direct decision makes the recovered 70-row register, full section 16 and MO-05 authoritative for final closure; the absent historical files are no longer a blocking dependency. If an original source is later recovered, preserve its exact provenance and let root reconcile any real conflict with the current instruction. Do not invent a requirement from an identifier range or expand work from a historical `PARTIAL` label. Completion still requires the actual applicable recovered behavior and evidence, with explicit user dispositions such as Q07 kept separate.

## Implementation ownership and sequence

Use existing domain owners and narrow PRs. These are suggested disjoint author slices, not new services, a new checklist system, or additional orchestration layers.

| Slice | Requirements and concrete assignment |
| --- | --- |
| Persistence, permissions and lifecycle | RP-01–RP-08, S01–S04/S07/S08/S16: current owner/editor/viewer/team grants and last-owner protection; independent client access; typed members and unresolved IDs; versioned rules/diff/publish/manual precedence; reviews and annual continuity; durable import preview/commit/recovery/compensation. One owner for schema/migrations. |
| Financial projection, snapshots and outputs | RP-10, DI-02/03, S06/S17: one qualified contribution ledger; basis, units, precision and missing-value distinctions; deduplication; immutable snapshot/source/evidence pins; durable output state and idempotent recovery; exact artifact bytes and canonical Client Files receipt; permission checks throughout the existing output lifecycle. Reuse current artifact owners and supported formats. |
| Research module navigation and evidence | DI-01–DI-11 and S09–S15 within the documented module: exact dossier fields/evidence, dated relationships, acquisitions, coverage, comparison and selected/page/all semantics; URL authority, refresh/Back/Forward, empty/partial/error/conflict states and accessibility. Repair the current routes/components rather than rebuilding the module. Q07 remains skipped as explained below. |
| Meri parity | MX-01/MX-02/S18 and all 17 MO-05 operations: current server-bound research scope, discoverability, authorized native owner, typed result/receipt, UI readback and equivalent historical aliases. Separate read/analysis from effects and preserve exact source/revision IDs. Reuse the SDK/control/Core paths, canonical native drafts, output and filing. |
| Changes, watches, feedback and tour | RP-09, MX-03, S05: quiet baseline, current recipient state and reversals, deduplicated events, existing scheduler/worker ownership, honest configured/unsupported delivery, correction outcomes and persisted versioned tour. Prepare code for required delivery through the existing owner; do not activate providers or send mail. |
| Frozen sharing | FR-15.22 and all section 16 requirements: complete required designer, permissions, source/client isolation, PIN/link lifecycle, branding, public route, administration and Meri own-confirmation behavior. Reuse shipped round-one/follow-up work and existing Workspace sharing; complete gaps without a second token/page/table system. |
| Release/qualification dependencies | OP-01–OP-04, AT-01–AT-24, section 14.2, 16H and recovered defect rows: Fable fixes implementation and supplies author evidence/fixtures; root integrates and deploys; Hermes performs independent acceptance. Source/corpus, credentials and target changes have their current owners. Record actual limits, never replace missing evidence with a source-only PASS. |

First classify each existing row as current implementation satisfied, concrete code gap, missing source/product meaning, or later acceptance/operational dependency. This can be a concise update to the existing registers. Missing live proof alone is not a bug. Preserve old failures and original records; update current dispositions separately. Do not assume every September remaining item is still missing or that September local PASS establishes today's product behavior.

Use focused affected tests and bounded local fixtures. Reuse exact unchanged accepted results. Required release builds, smokes, scans and native checks run once at the appropriate changed boundary under root's existing process; do not launch a new broad acceptance campaign, blanket suite, benchmark, packet validator, fingerprint framework or scoring engine merely to complete an old template. Do not copy historical monorepo commands or old `origin/main` instructions blindly into split repositories; the handoff's actual repo/base and current scripts govern.

Return small PRs with the Fable handoff's exact base/head/tree, reproduction, requirement, affected files, checks and limits, independent-review state, migration/deploy impact, dependencies and current mergeability. Keep each unresolved source or operational need explicit. Root/Hermes acceptance remains pending until deployed fixes meet the actual applicable criteria.

## Scope conflicts and permissions

**Q07 semantic/index integration remains skipped.** DI-09, S09, AT-11 and the old source plan mention qualified semantic behavior. Complete existing exact/capability paths and preserve honest unsupported/partial behavior. Identify the exact remaining semantic dependency for root; do not silently reopen Q07 or mark its full qualification passed. Broad onboarding, unrelated Defense/platform expansion, the full Office/M5/M6/M7 programs, and separate Outreach shipping remain excluded. Research Portfolio's own specified outputs and institutional actions are in scope; a dependent existing artifact owner is reused, not replaced.

Section 16 expressly excludes its printable/PDF brief, client portal/login, guest comments and automatic delivery of links/PINs. “All requirements” includes the specification's exclusions; it does not turn them into features. Existing output jobs elsewhere in the module still follow their own supported-format requirements. No external send, provider activation, credential change or target deployment is authorized for Fable by this document.

**FR-16.36/16H row 11 remains required; its source-owner decision is resolved.** Hermes retains the existing qualified public source owners, not a new private-source ACL. Source-reviewed Core `96a4f2d21d38b3118dfe6a0c7e99512e45734289` includes canonical family/reference/document/revision/hash/locator checks and the later actual context-occurrence eligible/qualified correction. Hermes source PASS includes named-widget/no-link negative cases. Deployment and live row-11 acceptance remain pending; source refusal is not itself a live acceptance PASS.

The frozen sharing lifecycle is intentionally distinct from authenticated internal output access: FR-16.22 says unlink/archive/access removal alone does not revoke an existing published link, while internal output rules require current authorization. Preserve both at their specified boundaries. Meri FR-15.22 requires the signed-in user's confirmation for create/revoke, with no second approver. Reuse the existing owner-confirmation path; do not import a second approval system from older generic wording.

## Complete available section inventory

| Available source section | Content to finish or preserve |
| --- | --- |
| Project closeout: Wave 0 | Reconcile current implementation against the recovered authoritative rows; retain missing-original provenance without inventing definitions or a new blocker. Historical commands/roles are adapted to current owners. |
| Project closeout: Wave 1 / phases 0–8 | Lifecycle/grants/client walls, members, rules, reviews/continuity, imports, source/identity/evidence, research/search/comparison/coverage and navigation. |
| Project closeout: Wave 2 / phase 9 | One financial contribution ledger, basis and precision, frozen snapshots, durable output lifecycle, exact bytes and authenticated canonical filing. |
| Project closeout: Wave 3 / phase 10 | Full research context and UI/Meri parity, authoritative registry, current server-bound authority, typed result scope and stable receipts. |
| Project closeout: Wave 4 | Watches/delivery, institutional actions, feedback and persisted user/version tour through existing owners. |
| Project closeout: Waves 5–7 | Database/security/fault, browser/accessibility and real-source/model/economics requirements; relevant author prerequisites belong to Fable, independent acceptance and live qualification to root/Hermes. Preserve Q07 boundary and reuse sufficient evidence. |
| Project closeout: Wave 8 / phase 11 | Build, migrations, deployment, recovery, release criteria and honest remaining limits; root/release owns operations. |
| Module register | RP-01–10, DI-01–11, MX-01–03, OP-01–04; exact source table below. |
| Screen register | S01–18; exact source table below. |
| Acceptance and probes | AT-01–24 plus all 12 section 14.2 probes; exact source tables below. Fable uses these as behavior requirements, not an assignment to run formal acceptance. |
| MO-05 | All 17 operations and the existing-owner discovery/scope/result/readback contract below. |
| Functional section 15 | FR-15.22 is available verbatim. The rest of original sections 1–15 remains unrecovered provenance and is not a blocker under Neo's later scope decision. |
| Functional 16A / FR-16.1–5 | Frozen widgets, settings, honest data states, compatible bases and sources. |
| Functional 16B / FR-16.6–12 | Grid/keyboard designer, constraints, undo/redo, retained edits/conflicts, reusable versioned designs, responsive previews and role access. |
| Functional 16C / FR-16.13–27 | Default-off sharing/PIN, current PIN invalidation, publish choices/preview/freeze, secret links, fixed expiry/revoke, history, safe retry and no second approver/send. |
| Functional 16D / FR-16.28–29 | Frozen tenant branding option and accurate preview. |
| Functional 16E / FR-16.30–40 | Recipient PIN/session/lockout/unavailability, limited interactions, one-client/current-publisher safety, private public-route behavior and accessibility. |
| Functional 16F / FR-16.41–42 | Administrator link list/revoke and tenant sharing switch. |
| Functional 16G / FR-16.43–45 | Reuse Workspace links and repair its specified idempotency/truncation defects; no duplicate sharing system. |
| Functional 16H | Fourteen acceptance scenarios plus administration and Meri confirmation, run by Hermes after deployment. |
| Functional 16I | Decisions versus assumptions from the source; preserve actual product choices and resolve a real ambiguity instead of inventing a replacement. |
| Missing original defect registers | F01–F42 and V4-01–V4-15 remain unrecovered provenance, not a closure blocker. Their ID ranges alone are not executable requirements. |

## Current uncovered behavior and evidence

The historical tables below remain verbatim. Their old `PARTIAL` or `BLOCKED` labels do not establish present defects or completion. The original scan is now reconciled in [all 33 dispositions](FABLE-FINDING-DISPOSITIONS.md). Core `96a4f2d2` and frontend `6fdf4e5f` have Hermes source PASS, frontend architecture approvals are integrated at `a46307e7` with zero blockers, and author integration gates pass. These facts establish source behavior at those pins, not the actual corpus or deployed journey. Keep the following evidence boundaries and precise amendment open.

Core's bounded owner map, `work/fable-closeout-20261027/CORE-RECOVERED-SCOPE-MAP-39e0837ea.txt`, traces existing DI/S/OP services and routes. The context-occurrence qualification correction `39e0837ea` and Unicode draft-reader correction `f7b3c4401` now have independent source PASS. Existing native Research, Changes, comparison, Coverage, contribution/evidence, member and bulk-review controls are implemented and source-reviewed; native presence does not establish corpus denominators, historical cycles or live authorization/recovery.

**Required bounded amendment in progress:** DI-07/S15 will project exact stored locators and existing before/after/correction-impact data; S14 will project existing governed Coverage readback. Isolated authors reuse the canonical readers and current authorization. No database/schema/migration/catalog/package change, new source corpus, graph, provider command or new requalification owner is allocated. Where stored data is absent, retain a named unsupported/unavailable result. Exact amendment heads, affected Hermes review and resulting release/acceptance facts remain pending root amendment; do not silently mark these requirements complete.

| Recovered rows | Precise requirement not established by this closeout packet |
| --- | --- |
| DI-01/DI-02, S11/S12, AT-10 | Four Research segments and five dossier tabs now have reviewed native/URL owners. Real required narratives, exact evidence and planned/completed milestone precision/history remain unqualified. |
| DI-03, S06/S12, AT-07/AT-14/AT-21 | Qualified request-edition/FYDP and related-but-distinct enacted/outyear corpus; exact cells/bases; contribution-ledger equality, immutable snapshot/source-correction reproduction and unsupported-history negatives. |
| DI-04/DI-08, S11 | Dated office/person/relationship transitions, authority semantics, access-filtered counts and unresolved/negative cases. |
| DI-05/DI-06, S10/S11, AT-08/AT-09 | Qualified acquisition actions and policy/hearing/House/Senate/amendment/report families; physical/logical denominators, exact occurrences and source-correction/dependent-invalidation behavior. |
| DI-07, S15 | Required existing-data locator/before-after/correction-impact read projections are in progress. Current inspector source PASS covers actual typed fields only; full stored-locator/current-access/immutable-target and live focus/return proof remains. No missing source data is fabricated. |
| DI-09, S09, AT-11 | Exact/capability search, URL/detail and selected/page/all export controls are source-reviewed. Difficult-negative and real-result evidence remains. Semantic/index implementation and evaluation remain **SKIPPED under Q07**, not passed or reopened. |
| DI-10, S13 | Saved comparison workbench, URL state, immutable versions, per-side evidence and selected add/bookmark controls are source-reviewed. Real subjects, current-access and saved-version/evidence acceptance remain. |
| DI-11, S14, AT-24 | Customer-safe Coverage is source-reviewed and preserves unknown denominators. Existing governed readback projection is an isolated required amendment in progress; real completeness attestations/cohort keys/physical-logical denominators and governed outcomes remain unqualified. No new requalification command or internal queue exposure. |
| RP-03/04/07/08, S04/S07/S16 | Author UI controls do not establish populated-database rule outage/concurrency/manual precedence, qualified taxonomy and old-template reproduction, two-cycle continuity, all-row import receipts, crash/reconcile or compensation after a later edit. |
| RP-05/09/10, S05/S17, AT-03/AT-13/AT-16/AT-18/AT-22 | Real owner/editor/viewer/wall and pre/during/post-revocation behavior, two-user quiet baselines, exact stored output/render/hash/open, unknown-commit recovery and configured delivery. Watch delivery is currently false; no external provider activation or send is inferred. |
| MX-01/MX-02/MX-03, S02/S18, AT-15/AT-20 | Retained three-step creation, real ClioArtifact Open/edit/version recovery, tour and native MO-05 receiver are source-reviewed at frontend `6fdf4e5f`/Core `96a4f2d2`. Deployed UI/Meri parity, unsent-input preservation, exact saved IDs/bytes and tour/keyboard/breakpoint acceptance remain pending. |
| OP-01/OP-04, AT-01/AT-02/AT-04/AT-19 and section 14.2 | Final affected builds, source/image/configuration/material/route/health/rollback receipts; authenticated navigation/concurrency/performance/fault/economics and operator-response evidence. Root fills actual final release and acceptance receipts after deployment. |
| OP-02/OP-03, AT-06/AT-12/AT-17/AT-23/AT-24 | Governed source qualification/admission, physical corpus and component/account/edition perimeter, two historical cycles plus next-cycle rehearsal, selective continuity and dated geography negatives. No current author report establishes these corpus obligations. |
| FR-15.22, section 16/16H | Source/edge/package review is PASS; rollout must activate the existing RP registry and exact catalog/material, then Hermes exercises sharing/admin/Meri. All14 historical 16H rows remain without complete PASS. SH3 lock behavior remains required; controlled expiry is not a natural-week PASS. |

The exact previously accepted single-paragraph DOCX and unchanged accepted checks remain reusable at their recorded limits. Overview metric-source documentation and the four recovered concrete frame registrations are now included in the frontend source; unknown frame families and the eleven unrecovered intermediate Timeline targets remain explicitly unverified. The thirteen recorded Timeline recovery targets belong with `3132:78373`; gated receipt/replay controls were not invented. Preserve the accepted shared TextareaField hint-above-field deviation. Independent visual acceptance and any further source recovery remain separate from these documentation updates.

## Verbatim repository requirement and screen tables

The following tables are reproduced from the requirement source. Their `PARTIAL`/`BLOCKED` columns and “remaining” wording are **historical source statements**, not a new review of current code. Fable must reconcile them against the current baseline; root/Hermes will establish later release acceptance.

| ID | Status | Implemented local seam | Remaining behavior and evidence | Route / component / service | Accountable role |
|---|---|---|---|---|---|
| RP-01 | PARTIAL | Tenant-scoped portfolio CRUD, lifecycle, grants and events exist. | Database-backed owner/editor/viewer/revoked tests, target migration rehearsal, browser conflict recovery, and deployed route proof. | `/api/research-portfolios`; `ResearchPortfoliosService`; list/detail pages | Portfolio persistence/security |
| RP-02 | PARTIAL | Typed manual members, dispositions, reasons and unresolved identities exist. | Full browser bulk outcomes, canonical return-state, stable unresolved-ID database proof, and large collection pagination. | `/api/research-portfolios/:id/members`; `ResearchPortfoliosService` | Portfolio persistence/security |
| RP-03 | PARTIAL | Versioned rule AST, preview/publish, recompute and precedence foundations exist. | Populated-database outage/concurrency proof and complete dynamic/hybrid UI acceptance. | `/rules`; `ResearchPortfolioRulesService`; `ResearchPortfolioRulesPanel` | Portfolio persistence/security |
| RP-04 | PARTIAL | Rule/template/taxonomy version contracts and deterministic predicates exist. | Independently qualified vocabulary/mapping evidence, old-template reproduction across deployment, and advanced editor accessibility. | `research-portfolio-rules.ts`; rules panel | Graph/search/evaluation |
| RP-05 | PARTIAL | Explicit client links and access checks exist. | Prove shared authorized policy through fit, cache, snapshot, output and unrelated-client revocation in the target database/runtime. | `/client-links`; `research-portfolio-access.ts` | Portfolio persistence/security |
| RP-06 | PARTIAL | Reviews, immutable decisions, assignment, dispute and notes foundations exist. | End-to-end supporting/against evidence, visibility, bulk conflict and browser outcome proof. | `/reviews`; `ResearchPortfolioReviewService` | Portfolio persistence/security |
| RP-07 | PARTIAL | Continuity statuses and dependency-triggered review records exist. | Real prior/next-cycle corpus rehearsal for rename/split/merge/expiry and exactly-once reopen behavior. | review/continuity service and ledger models | Portfolio persistence/security |
| RP-08 | PARTIAL | Durable import jobs, rows, mappings, attempts, effects, compensation and CSV parser exist. | Database crash/reconciliation, all-row receipt/export, worksheet UI and later-edit compensation acceptance. | `/imports`; `ResearchPortfolioImportService`; operations panel | Portfolio persistence/security |
| RP-09 | PARTIAL | Material events, per-user state, explicit quiet-first subscriptions, deduplicated in-app delivery receipts and honest partial email outcomes exist. | Configured external channel worker, two-actor database proof, restored baseline and no historical-flood acceptance. | `/changes`; `/subscriptions`; `/subscription-deliveries`; `ResearchPortfolioChangesService` | Meri/output delivery |
| RP-10 | PARTIAL | Compatible-basis analytics, contribution ledger, immutable snapshots, durable CSV jobs and native analytics/output controls exist. | Target database/output-store proof, source-correction reproduction, revocation before/during/after delivery, and independently rendered bytes. | `/analytics`; `/snapshots`; `/outputs`; `ResearchPortfolioAnalyticsPanel`; analytics/output services | Financial projections |
| DI-01 | PARTIAL | Existing program/PE dossier readers remain available and portfolio members retain typed canonical references. | Complete required narrative fields, multiple real subjects, exact evidence and browser acceptance. | Intelligence dossier routes and Defense Research service | Frontend/navigation |
| DI-02 | PARTIAL | Existing schedule/milestone foundations are reused. | Complete planned/completed precision, history and exact source proof in target readers/UI. | Intelligence timeline readers | Financial projections |
| DI-03 | PARTIAL | Existing budget projection is consumed with explicit basis. | Qualified edition/FYDP corpus and exact cell evidence across supported families; unsupported history stays unsupported. | Defense Research funding matrix | Financial projections |
| DI-04 | PARTIAL | Existing office/person/relationship foundations are retained. | Complete temporal ownership/transition projection and unresolved-state browser acceptance. | Intelligence relationship/office readers | Graph/search/evaluation |
| DI-05 | PARTIAL | Existing acquisition/federal-market readers are retained. | Independently qualified action identity, measures, text availability and end-to-end acquisition journey. | Acquisition continuity and federal market services | Extraction/source operations |
| DI-06 | PARTIAL | Existing federal evidence/source registry foundations are retained. | Qualify each claimed policy/hearing family with physical/logical denominators and exact occurrence evidence. | Federal evidence/source registry | Extraction/source operations |
| DI-07 | PARTIAL | Revision-bound evidence foundations exist. | Complete page/table/row/cell/section/span locators and independent before/after browser behavior. | Shared evidence inspector/readers | Extraction/source operations |
| DI-08 | PARTIAL | Existing evidence and relationship graph foundations are reused. | Authority semantics, dated edge proof, access-filtered counts and negative-case qualification. | Knowledge Plane/evidence graph | Graph/search/evaluation |
| DI-09 | PARTIAL | Exact/capability search foundations exist. | Independent semantic evaluation, difficult negatives, full-result semantics and declared precision/recall denominators. | Explore/search services | Graph/search/evaluation |
| DI-10 | PARTIAL | Existing comparison/basis foundations are present. | Complete saved comparison workbench, independent evidence per side, full URL state and browser acceptance. | Compare readers/routes | Frontend/navigation |
| DI-11 | PARTIAL | Internal source health/review foundations exist. | Customer-safe coverage projection, governed diagnostics and real-family denominators without exposing internal queues. | Coverage and evidence review services | Extraction/source operations |
| MX-01 | PARTIAL | Eight Phase 9 portfolio tools are registered in the authoritative Meri registry, dispatch through thin domain-service adapters, and bind to the owned conversation's server-stored research scope. Every turn reauthorizes current portfolio access and labels revision drift; the scope remains distinct from all-clients `portfolio` scope. | Complete the remaining Phase 1–8 UI/tool parity and prove every enabled UI/tool/alias surface reauthorizes and dispatches to the same services in the target runtime. | `MERI_CAPABILITY_REGISTRY`; `MeriToolsService`; `ResearchPortfolioMeriScopeService` | Meri/output delivery |
| MX-02 | PARTIAL | Snapshot/output/client-file writer creates durable operation/artifact/receipt seams. | Evidence-based editable brief/task/meeting-prep actions with real IDs, exact saved bytes, unknown-commit reconciliation and browser open. | Research Portfolio output and client-document writer | Meri/output delivery |
| MX-03 | PARTIAL | A dismissible, restartable, versioned five-step Research Portfolio tour is implemented and existing correction/event outcomes remain linked rather than rewritten. | Test the tour and correction outcomes across supported breakpoints, keyboard paths and target browser/runtime state. | Research Portfolio pages; shared correction/support services | Frontend/navigation |
| OP-01 | PARTIAL | Main `/api` research routes and typed DTOs are source-visible. | Build every affected image context and prove actual authenticated runtime ownership, URL state, mirror parity and temporal-read honesty. | Main API/web/Meri runtimes | Release operations |
| OP-02 | BLOCKED | Existing candidate/source/publication lanes remain unchanged by this packet. | Real baseline family qualification, independent review and governed admission/publication. No activation is authorized. | Defense source pipeline | Extraction/source operations |
| OP-03 | BLOCKED | Existing annual/source lifecycle foundations remain available. | Full physical corpus and account/component/edition perimeter with two historical cycles and simulated next cycle. | Source/annual operations pipeline | Extraction/source operations |
| OP-04 | BLOCKED | Local contract/unit checks can be run. | Independent quality labels, authenticated performance, failure recovery, workload/cost economics, image/deployment/rollback evidence and human operator response. | All affected runtimes | Release operations |

## S01–S18 screen/action coverage

| ID | Status | Implemented or reachable local seam | Required completion evidence |
|---|---|---|---|
| S01 | PARTIAL | Research Portfolio list route/page and authorized API list exist. | Browser loading/retry/empty/revoked/archive, accurate accessible counts and list-context restoration. |
| S02 | PARTIAL | Create/edit controls and idempotent service foundations exist. | Three-step retained draft, preview, Back/Forward/refresh, duplicate/unknown reconciliation and accessibility proof. |
| S03 | PARTIAL | Detail overview exposes members, clients, sharing, rules and operations. | One common projection for all counts/fit/freshness; source versus activity freshness and snapshot distinction. |
| S04 | PARTIAL | Members, rules, bookmarks and deterministic rule service foundations exist. | Full typed discovery, per-item bulk outcomes, exact evidence, advanced editor and outage/manual-precedence browser proof. |
| S05 | PARTIAL | Change feed state, explicit subscription API and per-recipient delivery ledger exist. | Feed/detail badge parity, two-user state, configured external delivery, pause/restore and real restored-baseline proof. |
| S06 | PARTIAL | Compatible-basis analytics/contribution service and accessible native table/control panel exist. | Complete source/cohort drilldowns, ledger equality and target-corpus qualification. |
| S07 | PARTIAL | Review/decision/continuity persistence and service exist. | Full Mine/Team/Deferred/Resolved UI, independent evidence, bulk outcomes and real-cycle continuity acceptance. |
| S08 | PARTIAL | Grants, client links, archive/restore and revision checks exist. | Open-form access-loss/archive commit checks, complete effective-grant UI parity and revoked-client browser proof. |
| S09 | PARTIAL | Existing Explore route/search foundations remain. | Full typed facets, explanations, exact detail, explicit selected/page/all export semantics and unavailable-family honesty. |
| S10 | PARTIAL | Existing Changes destinations remain available. | Recomposition/browser proof for Budget/Congressional/Monitored/Actions and actual FY/source semantics. |
| S11 | PARTIAL | Existing program/acquisition/federal evidence/relationship readers remain. | Four-segment native Research workspace with complete routed controls and real-source details. |
| S12 | PARTIAL | Existing five-tab PE dossier foundations remain. | All required narratives, funding, legislative, structure and complete sources with exact evidence and URL authority. |
| S13 | PARTIAL | Existing comparison readers/foundations remain. | Saved comparison workbench, independent evidence, explicit empty state, typed Add and exact bookmark behavior. |
| S14 | PARTIAL | Existing lifecycle health/reconciliation foundations remain. | Customer-safe denominator-backed Coverage UI, complete cohort keys and governed recheck outcomes. |
| S15 | PARTIAL | Existing evidence drawer/correction foundations remain. | Immutable typed targets, exact occurrence/before-after, current authorization, focus trap/return and correction impact proof. |
| S16 | PARTIAL | Import CSV parser, durable jobs/rows/effects/receipts and operations panel exist. | Full upload/mapping/repair UI, all-row receipt, crash/retry/reconcile and compensation after later edit. |
| S17 | PARTIAL | Snapshot/output/client-file backend contract and native create/history/progress/cancel/retry/reconcile/download/save/open controls exist. | Exact independent artifact render/hash/open, unknown-commit recovery and pre/during/post revocation acceptance in the target environment. |
| S18 | PARTIAL | Exact Research Portfolio launch context and the eight Phase 9 read/action tools use the authoritative registry and domain services. | Complete Phase 1–8 research-context tools/actions across enabled surfaces with unsent-input preservation and full UI/Meri parity. |

## Verbatim acceptance scenarios and section 14.2 probes

These source tables define required outcomes and their historical evidence limits. They are later Hermes acceptance work after root deploys Fable's fixes; Fable uses them to identify and test concrete implementation gaps.

## AT-01–AT-24

| ID | Status | Observed result / reason | Remaining owner | Required future evidence |
|---|---|---|---|---|
| AT-01 | NOT RUN | No browser session against an empty deployed tenant. | Frontend/navigation | Browser trace for Clients, BizDev, Research Portfolios and Intelligence navigation. |
| AT-02 | NOT RUN | No target browser matrix or direct-link replay. | Frontend/navigation | Back/refresh/mobile trace covering legacy and new routes. |
| AT-03 | BLOCKED | Source checks are not target database/runtime tenant-isolation proof. | Portfolio persistence/security | Database-backed owner/editor/viewer/revoked, raw role, job, cache, export and Meri attempts. |
| AT-04 | NOT RUN | No populated concurrent database run. | Portfolio persistence/security | Create/import/add race traces and idempotency/conflict receipts. |
| AT-05 | NOT RUN | Local rule tests are narrower than the required outage and browser scenario. | Portfolio persistence/security | Rule diff, manual exclusion and incomplete-fetch database/browser trace. |
| AT-06 | BLOCKED | No independently qualified continuity corpus or next-cycle rehearsal. | Graph/search/evaluation | Rename/split/merge/unknown fixtures adjudicated against real identities and history. |
| AT-07 | NOT RUN | Phase 9 unit checks are not the full projection/corpus scenario. | Financial projections | Database-backed PE/project, portfolio, parent/order and repeated-fact reconciliation with exact basis. |
| AT-08 | BLOCKED | No governed source revision/correction/revocation was executed. | Extraction/source operations | Official-byte revision, pagination failure and dependent invalidation trace. |
| AT-09 | BLOCKED | No qualified House/Senate/amendment/report target corpus was exercised. | Extraction/source operations | Independently reviewed legislative branch examples with exact text/status evidence. |
| AT-10 | NOT RUN | No complete profile/milestone browser acceptance was run. | Frontend/navigation | Exact source/date precision/state/edition trace including negative inference cases. |
| AT-11 | BLOCKED | No independent search/taxonomy negative set was evaluated. | Graph/search/evaluation | Ambiguous acronym, wrong section, similar unrelated and none-result adjudication. |
| AT-12 | BLOCKED | No real prior/next-cycle decision corpus was available. | Portfolio persistence/security | Selective reopen/carry-forward trace preserving original decisions/evidence. |
| AT-13 | NOT RUN | Local CSV/output tests do not prove actual object storage or Client Files indexing. | Meri/output delivery | Mixed-row import, retry/reversal, byte hash and real writer receipt/open trace. |
| AT-14 | NOT RUN | No populated snapshot/source correction reproduction was executed. | Financial projections | Snapshot membership/figures/evidence replay and unsupported-history negative trace. |
| AT-15 | NOT RUN | No enabled-surface Meri/UI parity matrix was run. | Meri/output delivery | Same-context/action IDs/status across UI, registry tool and aliases. |
| AT-16 | BLOCKED | No configured delivery channel or two-user database run. | Meri/output delivery | One logical event, explicit subscription, baseline, ack/dismiss and no-flood trace. |
| AT-17 | BLOCKED | No two-cycle corpus or simulated next FY/Congress target environment. | Extraction/source operations | Historical-cycle plus rollover run with metadata-driven options and old edition retention. |
| AT-18 | NOT RUN | No object/database/provider fault injection was run. | Release operations | Lease expiry, retry, unknown commit, partial output and bounded recovery traces. |
| AT-19 | NOT RUN | No affected image context, deployment or migration sequence was executed. | Release operations | Source SHA, build logs, image digests, migration ledger, route/flag/cohort evidence. |
| AT-20 | NOT RUN | No deployed end-to-end buyer journey was exercised. | Frontend/navigation | Create through cited brief save/open with exact intermediate IDs and evidence. |
| AT-21 | BLOCKED | No qualified amended/withdrawn/replacement/FYDP corpus was available. | Financial projections | Related-but-distinct request editions and retained enacted/outyear evidence. |
| AT-22 | NOT RUN | Source access checks are not pre/during/post artifact revocation proof. | Portfolio persistence/security | Shared portfolio snapshot/snippet/count/notification/download revocation matrix. |
| AT-23 | BLOCKED | No independently dated geography corpus was evaluated. | Extraction/source operations | Separate recipient/performance/district identities and outdated-geography negatives. |
| AT-24 | BLOCKED | No complete marketed-corpus denominator exists in this task. | Extraction/source operations | Explicit component/account/FY/edition/detail denominators including unavailable families. |

## Section 14.2 probes

| Probe | Status | Reason / next evidence owner |
|---|---|---|
| Main facade and route depth | NOT RUN | Release operations must capture authenticated main `/api` routing and browser direct-link/Back/Forward behavior. |
| Main database role and grants | BLOCKED | Portfolio persistence/security must run raw-role and owner/editor/viewer/client-wall probes on the real main role. |
| Known-at and source location | BLOCKED | Financial projections and source operations need populated snapshots and immutable exact-location evidence. |
| Funding/execution projection | BLOCKED | Financial projections need qualified metrics/periods through store, API, tool, UI and export. |
| Full result versus page | NOT RUN | Frontend/navigation must prove selected/page/all semantics on a large paginated dataset. |
| Client fit and revocation | NOT RUN | Portfolio security must run multi-client revocation and partial-mask cache probes. |
| Personal watch state | NOT RUN | Meri/output delivery must run two-user, replay, restore and partial-source probes. |
| Exact saved output | NOT RUN | Meri/output delivery must prove stored bytes/hash/revisions and real attachment scan/index receipt. |
| Outstanding download URL | NOT RUN | Portfolio security must test old and fresh delivery URLs across revocation; downloaded bytes remain outside recall. |
| Meri scope and runtime parity | NOT RUN | Meri/output delivery must prove all-clients `portfolio` remains distinct from research context across enabled surfaces. |
| Source inventory and eligibility | BLOCKED | Source operations must refresh the real inventory and prove candidate/unpublished/ineligible rows stay excluded. |
| Fresh deployment evidence | NOT RUN | Release operations must build and verify each affected runtime independently. |

## Full MO-05 operation inventory

The source's complete set is:

- `manage_research_portfolio`
- `get_research_portfolio_analytics`
- `create_research_portfolio_snapshot`
- `request_research_portfolio_output`
- `save_research_portfolio_output_to_client`
- `watch_research_portfolio`
- `update_research_portfolio_change_state`
- `get_research_portfolio_bookmarks`
- `create_research_portfolio_bookmark`
- `get_research_portfolio_fit`
- `get_research_portfolio_reviews`
- `add_research_portfolio_review_note`
- `get_research_portfolio_rules`
- `get_research_portfolio_imports`
- `get_research_portfolio_operations`
- `prepare_research_portfolio_brief`
- `prepare_research_portfolio_meeting`

Complete every operation through the existing discovery → current scope → native owner → typed result/receipt → UI readback path. Equivalent aliases require the same behavior; only an explicit user-approved supersession retires an obligation. An unavailable catalog entry is not complete because a legacy method exists. An existing method is not a reason to build another domain implementation.

Verbatim MO-05 obligation:

**Original obligation:** R L158 and L164–168. **Priority:** full-completion P1 unless explicitly gated below; safety/authority prerequisite P0 before activation.

**Current source / gap:** Detail/changes/evidence reads and supplemental composition exist;17 original Research Portfolio operations remain initial-catalog exclusions. Their canonical Core methods exist in the dispatch inventory, but selected runtime contracts/qualification are not equivalent. Evidence E2/E13.

**Bounded implementation and owner:** Use current Core Research Portfolio owners and add bounded adapters/contracts per slice: management, analytics, snapshots, requested outputs/client filing, watch, change-state review, bookmark list/create, fit, review list/note, rules, imports, operation diagnostics, brief preparation and meeting preparation. Separate read/analysis from mutations. Define exact scope, source revision, independent scoring rubric and typed result before exposing each slice; use current proposal/approval/idempotency/receipt owners for writes. Imports get bounded source/format/duplicate/error handling, not arbitrary URL ingestion. Retain actual canonical output lineage and filing via MM-14.

**Dependencies / non-duplication:** MT-02retained reads; MM-15/16report output; MO-06watch semantics; canonical RP domain project/PF ownership. No parallel portfolio store, scoring engine, scheduler or upload system.

**Acceptance:** Each17operation gets discover→current scope→native owner→typed result/receipt→UI readback fixture. Test foreign portfolio/record, stale snapshot/rule/import/change version, prohibited review note, malformed/partial import, score ground truth, duplicated bookmarks/outputs and lost effect ACK. Analytics/fit explains input coverage and never invents private-source access. Every historical alias maps to one equivalent behavior or explicit user-accepted supersession.

## Verbatim functional sharing specification

This is the full available user-supplied FR-15.22/section 16 excerpt. Requirements are preserved, including explicit exclusions and labeled assumptions. It does not recover original sections 1–15 or establish current acceptance.

FR-15.22: Optional, after section 16 exists: ask Meri to prepare a client share link for a snapshot, list a portfolio's links, or revoke one. Creating or revoking shows the proposed change and waits for the signed-in user to confirm (no second approver), and Meri never sends the link or the PIN to anyone.

16. Client share link: a PIN-protected frozen dashboard at a Capiro link
Goal. A portfolio owner can share a read-only dashboard of a frozen portfolio snapshot with one client through a link on a Capiro address. The recipient needs the link and a PIN, with no account. The owner arranges the dashboard by drag and drop. The link stops working after one week or when the owner revokes it. Decisions already made by Neo (26 October 2026): PIN-protected, with the PIN set in the portfolio when sharing is turned on; no approvers for links or for portfolio changes; one-week expiry or manual revoke only; branding is an option; the address form does not matter as long as it is a Capiro address; build on the existing Workspace share links. Not in this release: a print-out, PDF or printable brief (deferred), a client login or portal, guest comments, and Capiro sending the link or PIN to anyone.

16A. What the dashboard shows (widgets)
FR-16.1 A dashboard is made of widgets. Every widget reads only from the frozen snapshot chosen for the link, never from live portfolio data.
FR-16.2 Available widgets, built from data the module already produces: Header (portfolio name, purpose, "as of" date, prepared-for client, optional firm branding); Key totals (compatible-basis funding totals with fiscal year, stage and unit); Funding table (per-subject figures on one stated basis); Fit for this client (this client's fit result and its basis, or "insufficient evidence"); Changes since baseline (the material changes captured in the snapshot); Subjects (included members with type, identifier and label); Sources and evidence (source revisions and locators); Snapshot comparison (this snapshot versus an earlier chosen one); Commentary (free text written by the owner); Image/logo.
FR-16.3 Each widget has settings the owner can change (title, which fiscal year or basis where several exist, which subjects, number of rows, show or hide the source column).
FR-16.4 A widget with no data shows an honest empty state ("no changes in this period"), not zero or a blank box. Missing, withheld and unsupported figures stay distinct, as in FR-9.2.
FR-16.5 Figures on different bases are never added together on the dashboard (as in FR-9.1), and every total can show the sources it came from.

16B. Building the layout (drag and drop)
FR-16.6 The owner builds the layout in an editor with a grid canvas and a palette of widgets. They add a widget by dragging it onto the canvas, move it by dragging, resize it by dragging its edge, and remove it.
FR-16.7 The editor works without a mouse: widgets can be added, moved, resized, reordered and removed with the keyboard, with each change announced to screen readers. Drag and drop is never the only way to arrange the layout.
FR-16.8 Widgets snap to a grid and cannot overlap or fall outside the canvas. An invalid drop is refused with a visible reason and the widget returns to where it was.
FR-16.9 Undo and redo cover add, move, resize, settings and remove. Unsaved edits survive a refresh, and a second editor opening the same layout sees a conflict message instead of overwriting.
FR-16.10 The layout is saved as a named, versioned dashboard design. The owner can reopen it, duplicate it, and reuse it for another portfolio or client, with data re-bound to that snapshot.
FR-16.11 The owner sets how the layout reflows on a tablet and a phone (single column in a chosen order). A "preview as recipient" control shows desktop, tablet and phone widths exactly as the link will render them.
FR-16.12 Only people with Owner or Editor access to the portfolio can build and publish dashboards. A Viewer cannot.

16C. Sharing, the PIN and the link
FR-16.13 Sharing is off for every portfolio by default. An Owner turns it on in the portfolio's sharing settings and must set a PIN at that moment. Sharing cannot be turned on without a PIN, and no link can exist without one.
FR-16.14 The PIN is a number of at least 6 digits (minimum is a proposal). It is stored only as a salted slow hash and is never shown again after it is set. The Owner can change it at any time. A new PIN applies at once to every link of that portfolio, and anyone unlocked with the old PIN loses access.
FR-16.15 Turning sharing off is a manual revoke of every link of that portfolio at once.
FR-16.16 Publishing needs three choices: the snapshot, the dashboard design and the client (one of the portfolio's linked clients), plus the branding option in section 16D. One link is for one client.
FR-16.17 Before publishing, the owner sees a preview of exactly what a recipient will see, and a list of everything the link will expose (widgets, subjects, figures, sources). The owner then confirms. This is the owner's own check; no other person approves.
FR-16.18 Publishing makes a frozen copy of the dashboard content and layout. Later edits to the portfolio, source corrections, the design, or a client's fit do not change a published link. To change what a client sees, the owner publishes a new link; earlier links stay valid until they expire or are revoked.
FR-16.19 The link is a Capiro address with a long, unguessable secret. Only a hash of the secret is stored, and the full address is shown to the owner once, with a copy button. A lost link cannot be recovered; the owner publishes a new one. The exact form of the address is not specified.
FR-16.20 Every link expires exactly one week (168 hours) after it is published. The period is fixed: it cannot be extended, and the only way to end a link sooner is a manual revoke. The owner sees the time remaining.
FR-16.21 The owner can revoke a link manually at any time, and revoking takes effect on the very next request.
FR-16.22 A link ends only by expiry (FR-16.20) or manual revoke (FR-16.21, FR-16.15). Unlinking the client, archiving the portfolio, deleting the snapshot, or removing someone's access does not revoke it. The product warns the owner, but does not block, when they unlink a client or archive a portfolio that still has active links. (The warning is an addition; see 16H.)
FR-16.23 The owner sees all links of a portfolio: client, snapshot, design version, branding choice, published by, published and expiry times, status (active, expired, revoked), last opened, number of opens and number of failed PIN attempts.
FR-16.24 Turning sharing on or off, PIN changes (not the PIN itself), publishing, revoking and expiry are recorded in the portfolio's event history with who and when.
FR-16.25 Publishing is safe to retry. A repeated or lost request never produces a second live link, and an unknown outcome is reconciled by reading back rather than sending again.
FR-16.26 There is no approval step. An Owner or Editor publishes directly. Publishing, revoking and editing a portfolio need no approval from anyone else.
FR-16.27 Creating a link never sends anything. The owner copies the address and tells the client the PIN themselves.

16D. Branding option
FR-16.28 Each link has a branding switch chosen at publish time. On: the page shows the firm's name and logo from the tenant profile. Off: the page shows no firm name or logo. The choice is part of the frozen copy and cannot be changed after publishing; the owner publishes a new link to change it.
FR-16.29 Branding affects only the header and footer. It never changes the data, and the preview shows the chosen setting.

16E. What the recipient does and cannot see
FR-16.30 Opening the link first shows only a PIN prompt, with no title, no client name, no firm name and no content.
FR-16.31 After the correct PIN the recipient sees the dashboard in a short viewing session limited to that one link (proposed length: 30 minutes). After it ends, the PIN is asked again.
FR-16.32 A wrong PIN gives a generic message with no hint. After 5 wrong tries the link locks for 15 minutes (both are proposals), and tries are also rate-limited by network address. The owner can see the failed-attempt count.
FR-16.33 An expired, revoked, locked-out or unknown link shows the same plain "this link is not available" page, before any PIN prompt, and reveals no content or title.
FR-16.34 The recipient can scroll, expand a widget's table and open the evidence for a figure. They cannot edit, comment, download raw data, or reach any other page.
FR-16.35 The page shows the "as of" date and "prepared for [client]", so it is clear that it is a point-in-time document and not live data.
FR-16.36 The page contains only what the publishing user was allowed to see when publishing, restricted to the one client. It never shows another client's name, fit, counts or notes, and never includes content from sources the owner cannot access. If the content cannot be shown safely, publishing is refused and says which widget is the problem.
FR-16.37 Opening a link never reveals whether other links, portfolios, clients or users exist.
FR-16.38 The page is not indexed by search engines, does not leak its address through referrer headers, is not stored by shared caches, and is rate-limited against guessing.
FR-16.39 The page is served by a read-only route that can reach only the frozen copy and no other firm data or API. It sets only a viewing token that works for that one link, and nothing that signs the visitor in to the product.
FR-16.40 The page and the PIN prompt work on desktop, tablet and phone, support keyboard use and screen readers, and keep their meaning in light and dark settings.

16F. Administration
FR-16.41 An Administrator can list every active client link in the tenant and revoke any of them.
FR-16.42 A tenant can switch client sharing off entirely. With the switch off, no link can be created and existing links stop working.

16G. Building on the existing Workspace share links
FR-16.43 Links reuse the Workspace share-link service: hashed token shown once, expiry, revoke and the frozen-revision rule. Portfolio links add the PIN, the fixed one-week expiry, the client, the branding choice and the dashboard payload.
FR-16.44 The Workspace notes list two defects in that service: its idempotency is overloaded onto the label, and it can truncate content for some document kinds. Both are fixed before portfolio links use it, so that a link either shows the full frozen content or refuses.
FR-16.45 No second share-link table, token scheme or public page system is created for portfolios.

16H. Acceptance outline for this section
1. Turn sharing on without a PIN: refused. Turn on with a PIN, publish, open: PIN prompt only, then the dashboard.
2. Wrong PIN five times: locked for 15 minutes with a generic message; the owner sees the failed-attempt count.
3. Change the PIN: an unlocked viewer loses access, and the old PIN no longer works on any link.
4. A link opened after exactly one week, a revoked link, a locked link and a made-up link all show the same plain page before any PIN prompt.
5. Publish, then edit the portfolio and change fit: the published link is unchanged.
6. Two clients linked to one portfolio: each link shows only its own client's fit and never the other client's name.
7. Branding on shows firm name and logo; off shows neither; the setting cannot be changed after publishing.
8. Unlink the client or archive the portfolio with an active link: a warning appears, the action goes ahead, and the link still works until expiry or revoke.
9. Turn sharing off: all links stop immediately.
10. Keyboard-only build of a dashboard, including add, move, resize and remove, with announcements.
11. A restricted source in a widget makes publishing refuse, naming the widget.
12. Retry after a lost publish response produces one link.
13. The link page makes no request to any other firm API (checked in the network log), and sets no sign-in cookie.
14. An Owner or Editor publishes with no second person involved.

16I. Decisions and what I assumed
Decided by Neo: (1) PIN-protected, PIN set in the portfolio when sharing is turned on; (2) no approvers for links or for portfolio changes; (3) one week, then expiry or manual revoke only; (4) branding is an option; (5) any Capiro address is fine; (6) build on the existing Workspace share links.
I assumed these; strike or change any that are wrong:
- The PIN belongs to the portfolio and applies to all its links, rather than a separate PIN per link.
- PIN of at least 6 digits, a lock after 5 wrong tries for 15 minutes, and a 30-minute viewing session.
- An Owner turns sharing on and sets the PIN; Owners and Editors publish and revoke.
- The warning when unlinking a client or archiving with active links (FR-16.22) is an addition on my part.
- The owner's own preview-and-confirm (FR-16.17) stays; it is not an approval by anyone else.
- Turning sharing off revokes all links, as a manual revoke.
- Meri's confirmation step in FR-15.22 is the signed-in user confirming, not a second approver.

## Source file integrity

These hashes identify the source text used to prepare this allocation. They are ordinary document provenance, not a new approval or release mechanism.

| Source file | SHA256 |
| --- | --- |
| `STANDING-REQUIREMENTS.md` | `9e06584d44ecd4dc37511cd17a27bda5125b9d89d7d2e9683ef8e318736700e3` |
| `PROJECT-CLOSEOUT-PLAN.md` | `7c0fe1bb941d6ca8052db560a137bda8393e85fa933748b27691d3be6d0d9e5e` |
| `requirements-and-screens.md` | `a46d61e22b1c52d991c5b0638b1bfc493bb662dddff819ae0a306dd77e44d183` |
| `acceptance-results.md` | `892e596eb077d8e83d185d80623b05ac4b0c8106ba8639649109954ab3ea26d1` |
| `CURRENT-BRANCH-CLOSEOUT-2026-09-28.md` | `4a96a1787f0a39bf2072b69b10e2b8e6749d75c7c3ec72f9b3e77212cced3122` |
| `CURRENT-BRANCH-CLOSEOUT-2026-09-28.json` | `2650ecf28800b484a607360a87faee00a41e814bc22a39d57f37d58ca474f9f9` |
| `release-controls.md` | `ece09da6051c231342065594703136e93cc5298dea4550059ac17b1b8ad3c692` |
| `README.md` | `35ae89881eb5b0066f0beec35fdcd5d0576254a42127a085cb7b3df685cfd79e` |
| `Capiro-Meri-Wiring-Closeout-Plan-20261021.md` | `1397b5a7ac25935f323c22c6bd23b0d90b3fab307e714198e9114d3ac650dab5` |
| `SECTION-16-SOURCE.txt` | `17c9a2c8d30ec817f61e172512dbd3a3306cbd214dc7ca49dd8b26fc47fd82cd` |
