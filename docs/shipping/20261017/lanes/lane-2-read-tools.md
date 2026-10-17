# Lane 2 — read-tool families and skills

| Field | Value |
|---|---|
| Owner | lane-2 session (Fable) |
| Branch | `fable/meri-lane2-read-tools-20261017` |
| Receives into | `fable/meri-first-chat-receiving-20261017` (PR #133), merged at its tip `3fa0325a` |
| Source pins received | PR125 `69688364` (accepted), PR132 `bba4ef68` (was HOLD_TESTS) |
| Core pins read (read-only) | PR52 `51c15744`, PR59 `59efe08f`, PR68 `8d6733c3`; default branch `backend-import` `c76f5fc0` |
| Exact lane commit | recorded in the PR description and the latest PR #121 comment (this file cannot contain its own commit) |

Status vocabulary is BACKLOG.md's: `source` → `integrated` → `qualified` → `deployed` → `live-verified`. Nothing in this lane is past `source`. No read is integrated (PR #133 has not received this branch), qualified, deployed or live-verified.

## Overall accounting (82 selected source reads)

| Accounting | Complete | Partial | Absent | Basis |
|---|---|---|---|---|
| Accepted ledger (PR125 `scope-ledger.json`) | 69 | 3 | 10 | Published; not regenerated here (the full tooling repair is held behind the denied ledger payload) |
| This lane's source, honest | 74 | 3 | 5 | +5 mode operations whose Meri source and focused tests now pass; their Core producer (PR68) has never run Jest/TypeScript |
| Qualified / deployed / live | 0 / 0 / 0 | | | No real Core, Linux image, PG, SDK install or live user |

"Complete source" means the Meri adapter, trusted dispatch context and focused tests exist and pass. It does **not** mean the Core endpoint is merged or running: every family calls Core's retained-authority read stack (`feat/core-retained-authority` PR35 → PR52 → PR59 → PR68), and none of it is on Core's default branch `backend-import`. `read-mode-observation` and the `x-meri-read-observation` decoder are absent there. Core in capiro-dev is `0/0/0`.

## Per-family status

All rows: status `source`, integrated/qualified/deployed/live = no. "Core" names the Core dependency.

| Family | Operations | Meri source | Core dependency / blocker (owner) |
|---|---|---|---|
| acquisition-personnel, action-items-complete, bill-text, client-documents, client-knowledge-memory/-monday/-profile, client-registry, data-search, dataset-metadata, disclosures, district-nexus, entity-candidates, facility-representation, federal-legislation, federal-market, florida-budget, intelligence-summary, legislative-directory, mail, meeting-source, memory-proposals, operational-reads, pe-references, public-domain-query, public-reports, public-web, regulatory-dockets, research-portfolio, research-portfolio-evidence, state-legislation, state-status-votes, stored-intelligence, tenant-contacts, tracked-bills, public-domain-hearings | 58 source operations (plus `list_memory_proposals`, the one product-state read) | complete | Retained-authority stack unmerged; not deployed (dot) |
| funding-opportunities | 5 | complete | Core PR52 (`{asOf}` observation), unmerged (dot) |
| client-knowledge-search | `search_client_knowledge`, `query_knowledge_graph` | complete | Core PR59, unmerged (dot) |
| business-development | context, recent_changes | complete | as above |
| business-development | `get_business_development_evidence` | **absent** | Core change: live SAM lookup despite `suppressJev`; footprint client lookup ignores the client wall (dot) |
| public-data | `query_economic_data` | complete | as above |
| public-data | `search_federal_grants`, `search_federal_awards` | complete (candidate) | Core PR68 mode observation; Jest/TS **unrun** (dot) |
| program-elements | `search_program_elements`, `get_program_element`, `get_pe_budget_timeline` | complete (candidate) | Core PR68 as above (dot) |
| research-legal-legislation | `search_legislative_research` | complete | as above |
| research-legal-legislation | `get_legal_reference` | **partial**: names (check-ref) and folders now admitted; rules/versions/explicit-ID branches admitted | Parser-dependent citations need a Core citation observation (dot); SDK-withheld |
| research-legal-news | `search_legiwatch_news` | **partial**: names (check-ref) and folder-with-explicit-client now admitted for exact-source and explicit-year personnel | News window `asOf`, folder-only client observation, Clerk ID for monitors (Core, dot); implicit personnel year (design, dot/Neo); SDK-withheld |
| outreach-query | `query_outreach` | **partial**: explicit-client campaign list only | Unscoped list and exact record need Core walls (dot), plus a product decision on unscoped-list scope (Neo/dot) |
| research-legal-candidates | `search_research_sources` | **absent** | Core change: meetings branch leaks other users' meetings (below); client walls before content (dot) |
| rule-status | `get_state_rule_status` | **absent** | New observation arm `{stageAsOf,commentAsOf}` in Core decoder and Meri codec (dot) |
| sam-opportunities | `search_sam_opportunities` | **absent** | New arm `{asOf,sourceStatusAsOf,sourceHealthAsOf,evidenceAccuracyMode}` (dot) |
| certification-status | `get_certification_status` | **absent** | New arm `{comparisonLocale}` plus a Core report of its actual locale (dot) |

The five absent operations already have Meri contracts, validators and contract tests (`packages/contracts/retrieval-0.2/*`). Building their adapters now would pass only against a stubbed Core, because the validators need values that Core samples itself and does not return. The adapters follow once the arms are agreed. The Meri codec `packages/contracts/native-read-observation-0.2` is a shared contract file, so its arms are proposed on PR #121 before any edit.

## Installation / discovery producer

**Blocked on design (dot plus the native qualification owner).** The consumer side is complete in source: `apps/gateway/general-reads/installation.mjs`, `mount.mjs`, `apps/runtime/general-read-runtime.mjs` and `general-read-installation/runtime.mjs`. No production producer exists for general reads or selected skills. Discovery is hard-wired empty (`tool-dispatch.mjs:110`). No storage, migration, contract or issuer is decided.

The open decisions are:
- P2: installation receipt contract and issuer (signing, deployed build/origin/config attestation, revocation on drift).
- P1: discovery-grant contract and issuer.
- P3: base general-read allocation.

After those are decided, the startup mount patch is lane 1's. Writing a producer now would invent authority, so none was written.

## Skills (14 original assets)

| Skill set | State |
|---|---|
| `relationship_brief`, `commitments_audit` | Admitted for selected execution (source). Reads complete in source. |
| `client_changes`, `hearing_watch`, `mail_history`, `meeting_prep`, `portfolio_changes`, `representation_lookup` | All declared reads complete in source. Not admitted: admission is limited to the two above in `control/conversations/skills/*`, and each needs its own reviewed output compiler (documents lane 6 / Fable). |
| `pe_deep_dive`, `portfolio_overlap` | Reads now complete only as PR68-dependent candidates. |
| `funding_opportunity_match`, `research_company` | Blocked by `search_sam_opportunities` (and `get_certification_status` for research_company). |
| `regulatory_docket_brief` | Blocked by `get_state_rule_status` and parser-dependent `get_legal_reference`. |
| `bill_watch` | `get_pe_budget_timeline` is a PR68 candidate; `create_word` is the separate document path. |

Skill assets load and validate. No skill workflow is runtime-qualified.

## Core findings sent to dot (PR #121)

1. **Security, on `backend-import` too.** `search_research_sources` meetings query, `meri-tools.service.ts:6730` (`8d6733c3`: 6753). `...ownMeetingWhere(ctx.userId)` is followed by a second `OR:` key, which replaces the ownership `OR`. Any same-tenant meeting whose text matches is returned (subject, description, organizer) to any member who reaches this tool.
2. `ensureClientVisible` (`:9737-9775` at `8d6733c3`) checks tenant and archived status only, never the memory wall. Meri compensates with the native roster check, but direct Core callers do not.
3. `query_outreach`: `listCampaigns` is tenant-wide with no client wall. `getOutreachRecord` returns nested meeting/prep/client without wall or ownership rechecks.
4. `get_business_development_evidence`: `suppressJev` leaves `samEnabled` on (live SAM by UEI/CAGE). The footprint client lookup ignores the wall and archived status.
5. Lower severity: `list_upcoming_meetings` (`backend-import :7398-7400`) overrides `ownMeetingWhere`'s `status ≠ deleted` with `status ≠ cancelled`, so the user's own soft-deleted meetings can appear.

## Work done in this lane

- `b7f5da04`: PR132's long-source mode-lifetime cases failed DEADLINE because the shared fixtures cap the source at 1 s and the gateway at 3 s. Those cases now use the approved 10 s lifetime. With the old 3 s fact lease reinstated they fail 0/5; with the current reader they pass 5/5.
- PR132's other "17 failures" do not reproduce on the received tree. All 20 PR132 test files pass. The file-level failures seen once were host spawn/commit-memory exhaustion, not test outcomes.
- `c0d6e507`:
  - `get_legal_reference` gains check-ref names and folder delegation (verified against Intel `ResearchService.run → context` at `8d6733c3`).
  - Three stale tests corrected: registration coverage now includes the mail and program-elements constructors; tracked-bills and outreach named-selector cases now test the missing-reader refusal.
- `95fd80f2`: merged integration tip `3fa0325a`. No conflicts, and no overlap with read paths or lane-1-owned files.
- `1fc1b0cf`: `search_legiwatch_news` gains check-ref names and folder-with-explicit-client scope (verified against Intel `Phase8EvidenceService.context`).

## Tests

Focused only (host commit memory is about 2 GB): Node 24.19, serial, one file per process, `--max-old-space-size=256`. Results are in the PR description; failures are listed there by name, not hidden.

Known host-only failures, unrelated to this lane:
- `public-domain-query` "explicit supported as-of" depends on the host time zone; it passes with `TZ=UTC`.
- `apps/gateway/test/mail-history-gateway-flow.test.mjs` also fails at the pre-receiving base `0e38ef49` (`ARTIFACT_BUDGET_SETTLEMENT_UNKNOWN`).

## Remaining tasks and acceptance

| Task | Owner | Acceptance |
|---|---|---|
| Core fixes and observation arms above; merge the retained-authority stack; run PR68 Jest/TS | dot | Published Core commit with passing Jest/TS |
| Meri codec arms + 5 absent adapters + partial completions | lane 2, after dot acks the arms | Focused tests over real Meri owners against the agreed Core contract |
| P1/P2/P3 contracts + installation/discovery issuer | dot + qualification owner | Decided contract, storage and issuer |
| Startup mount of general reads | lane 1 | Reviewed mount patch |
| Receive this branch into PR #133 | integration owner | Combined focused set passes → `integrated` |
| Qualification in the real image against deployed Core | lane 1 | Evidence → `qualified` |
| Live authenticated read | dot E2E | Evidence → `live-verified` |
| Admit the six read-complete skills | lane 6 / Fable | Reviewed per-skill compiler and admission |
| Ledger regeneration to the honest counts | Fable, after Neo's exact approval of the held ledger payload | Never retry or route around the denied blob `28865e43…` |
