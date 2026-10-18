# Capability-level coverage ledger — Meri (meri-greenfield), 2026-10-18

Lane CL. One row per Appendix A name (96), Appendix B name (43) and Appendix C skill (14) of `CAPIRO-REMAINING-DEPLOYMENT-PLAN-20261017.md` (capiro-backend `5f719149`). Companion to `RUNTIME-INTEGRATION-LEDGER.md` §5 (family level) and `PLAN-RECONCILIATION-20261018.md` §3. **Stopped at Neo's request (18 Oct); every row below is either mapped from source read on the tip or marked "not yet mapped". Nothing is guessed.**

## 0. Tip, method, vocabulary

- **Tip analysed:** `fable/meri-integration-20261018` @ `6aa515b302c519069ccf45221b54add9962d544d` (`6aa515b3`; the lane branch was fast-forwarded from `1b8a1fb5` to that docs-only commit).
- **Enumerators actually used (read, and re-executed where the SDK import allowed):**
  - Catalog: `packages/contracts/retrieval-0.2/catalog.json` — `catalogVersion 0.2.15`, **97 operations** (96 replacements + the retained historical `query_action_items@0.2.0`). Every descriptor is `availability: unimplemented`, `qualification: pending`, `handler: null` (dumped with a scratch script). The static index therefore supplies nothing to `apps/gateway/catalog/runtime-catalog.mjs` (`entry()` requires enabled/qualified/handler); run-time availability comes only from the installation receipt (`apps/gateway/catalog/installed-catalog.mjs`, `apps/gateway/general-reads/installation-issuer.mjs`).
  - Installable reads: `apps/runtime/native-authority/general-read-installation/runtime.mjs` `installationReadOperations()` = `familyReads()` (`apps/worker/conversation/reads/availability.mjs`, over `READ_FAMILIES` in `reads/families.mjs`, 42 families) ∩ `GENERAL_READ_ADAPTER_FAMILIES` (`apps/gateway/general-reads/integration.mjs`, 44 family modules). The launch-measurement entry point (`apps/runtime/build/first-chat-launch-measurement.mjs generalReadInstallation`) could not be executed in this worktree (`availability.mjs` → `skills/mcp.mjs` imports `@anthropic-ai/claude-agent-sdk`, absent under `apps/worker`); the selection logic was re-implemented verbatim (catalog × `resolveOperationContract(op).binding.group` × `READ_FAMILIES`/`operationIds` × `GENERAL_READ_ADAPTER_FAMILIES`) and gives **76 operations / 42 families**, matching lane R3 and `first-chat-launch-measurement.test.mjs:73`.
  - Startup composition: `apps/runtime/cli.mjs` (control role) → `native-authority/reads-composer.mjs` (reads), `native-authority/execution-composition.mjs` + `product-ports/intents.mjs` (intents), `artifacts/authority-composition.mjs` + `product-ports/documents.mjs` (documents), `product-ports/memory.mjs`, `product-ports/routines.mjs`, `product-ports/capability-policy.mjs` (G2 profile, `PLUGIN_SKILL_NAMES`). Render switches: `infra/product-preview/first-chat/render-material.mjs` `features` block (lines 36–56, 202–284).
  - Skills: `packages/skills/assets.json` (15 assets), `packages/skills/originals/*/*/manifest.json`, `packages/skills/plugin.mjs describeSkillPlugin()` (executed: 14 plugin skills, `bill_watch@1.0.0` excluded `NO_SDK_FRONTMATTER`, `bill_watch@1.0.1` admitted as `meri-bill-watch`).
  - Exclusions: `apps/worker/conversation/test/legacy-tools-excluded.test.mjs` (43 names, guard), `catalog.json` `originals[].disposition:'deferred'`, `docs/coordination/ledgers/scope-ledger.json` `ownerDirection` (15 Oct), `docs/CAPABILITY-SCOPE.md` "Registry disposition ledger"; plus a fresh whole-word grep of every name over `apps/ packages/ infra/ scripts/` (.mjs .js .cjs .ts .py .sql .json; node_modules skipped).
  - `docs/coordination/ledgers/scope-ledger.json` / `MERI-FINAL-SCOPE-LEDGER-20261015.md` were used only for cross-checking family names; their totals are stale (P2) and not reproduced here.
- **States** (plan §3): inventory · source · integrated · qualified · deployed · live-verified · blocked · deferred. Here: **inventory** = catalog descriptor/contract only, no handler or owner; **source** = code exists on the tip but is not reachable from `cli.mjs` startup composition; **integrated** = reachable from the real startup composition and switchable by the render `features` block (all such rows are still held by **G1** `features.sourceEnabled` and their family keys; see note codes). **Nothing on this branch is qualified, deployed or live-verified except budgets/model grants and conversations on N17 `4172e474`** (`PLAN-RECONCILIATION-20261018.md` §1) — stated once, not repeated per row. **not yet mapped** = verification stopped before the row's startup reachability was established.

**Note codes used in Table A**

- **R-NATIVE** — read in a `NATIVE_READ_FAMILIES` family (`apps/gateway/sources/retained-reads/native-families.mjs`): composed by `reads-composer.mjs:115-117,145` (27 families on the tip), handlers via `general-reads/integration.mjs` over Core `/api/clio/tools/*`; rendered by `features.sourceEnabled` + `features.reads{enabled, installation, discovery}` (+ `capabilityPlatform` for discovery/`generalReads`).
- **R-RETAINED** — read in one of the 15 installation families that are **not** native: in the 76-operation measurement and in the profile mount (`reads/runtime.mjs` `mount:'profile'`), but `reads-composer.mjs:116-117` refuses any non-native `familyIds`, so no handler is created by the production composer. `apps/runtime/native-authority/retained-reads/runtime.mjs` (`createRetainedControlGeneralReadRuntime`) can compose 12 of them (+ research-portfolio/florida-budget by `recipients`), but **no startup caller of it was found** (searched `apps/ infra/` non-test). `mail` has no composer at all (`createMailHttpAdapter` referenced only by `general-reads/families/mail.mjs`). State **source**; startup reachability **not yet mapped**.
- **R-SUBSET** — handler/route exists in `apps/gateway/sources/<dir>/handler.mjs` but the operation is excluded from installation by `reads/families.mjs` (`operationIds` / family absent) or `NATIVE_READ_OPERATION_SUBSETS`.
- **C-ONLY** — only `packages/contracts/retrieval-0.2/<x>.schema.json` + validator; no handler under `apps/gateway/sources/**`, `apps/gateway/general-reads/families/**`, `apps/worker/conversation/reads/families.mjs` (searched by name).
- **I-OK** — governed intent row available in `apps/worker/conversation/intents/catalog.mjs` `INTENT_ROWS`; control side `cli.mjs` composes `createControlIntentExecution` / `intentMountFor`; rendered by `features.intents{enabled, core, execution}` + `capabilityPlatform.governedIntents`.
- **I-HELD** — `INTENT_ROWS` row carries `unavailable: …` so it is never mounted (`intents/runtime.mjs:51-53`).
- Path prefixes: `F/` = `apps/gateway/general-reads/families/`, `S/` = `apps/gateway/sources/`, `K/` = `packages/contracts/retrieval-0.2/`.

## 1. Table A — 96 selected legacy capabilities

| # | legacy name | mapped implementation | proving file(s) | state | note |
|---|---|---|---|---|---|
| 1 | get_research_portfolio | `get_research_portfolio@0.2.0` / family `research-portfolio` | `F/research-portfolio.mjs`; `S/research-portfolio/handler.mjs` | source | R-RETAINED (recipient-composed only) |
| 2 | get_research_portfolio_changes | `get_research_portfolio_changes@0.2.0` / `research-portfolio` | same as #1 | source | R-RETAINED |
| 3 | get_research_evidence | `get_research_evidence@0.2.0` / `research-portfolio-evidence` | `F/research-portfolio-evidence.mjs`; `S/research-portfolio-evidence/handler.mjs` | source | R-RETAINED |
| 4 | read_chat_attachments | `read_chat_attachments@0.2.0`, group `client-knowledge-attachments` — **none found** | `K/client-knowledge-attachments.schema.json`; `apps/control/retention/data-classes.mjs:31` ("not yet implemented") | inventory | C-ONLY; no family for the group |
| 5 | read_monday_client_boards | `read_monday_client_boards@0.2.0` / `client-knowledge-monday` | `F/client-knowledge-monday.mjs`; `S/client-knowledge/handler.mjs`, `monday-mapping.mjs` | source | R-RETAINED; clientScope required |
| 6 | search_capiro_data | `search_capiro_data@0.2.0` / `data-search` | `F/data-search.mjs`; `S/data-search/handler.mjs` | integrated | R-NATIVE |
| 7 | get_client_context | `get_client_context@0.2.0` / `client-knowledge-profile` | `F/client-knowledge-profile.mjs`; `S/client-evidence/handler.mjs` | source | R-RETAINED; clientScope required |
| 8 | search_research_sources | `search_research_sources@0.2.0`, group `research-legal-candidates` — **none found** | `K/research-legal-candidates.schema.json` | inventory | C-ONLY |
| 9 | run_analysis | `run_analysis@0.2.0` → intent `request_analysis` | `apps/artifacts/postgres-analysis.mjs`, `sandbox-analysis.mjs`; `intents/catalog.mjs` | source | I-HELD `ROUTE_GAP` (no governed analysis route; ANALYSIS-SANDBOX) |
| 10 | search_client_knowledge | `search_client_knowledge@0.2.0` / `client-knowledge-search` | `F/client-knowledge-search.mjs`; `S/client-knowledge-search/handler.mjs` | integrated | R-NATIVE; `requiredClientOperations` |
| 11 | query_intelligence | `query_intelligence@0.2.0` / `intelligence-summary` | `F/intelligence-summary.mjs`; `S/intelligence-summary/handler.mjs` | integrated | R-NATIVE |
| 12 | query_knowledge_graph | `query_knowledge_graph@0.2.0` / `client-knowledge-search` | as #10 | integrated | R-NATIVE |
| 13 | search_memory | `search_memory@0.2.0` / `client-knowledge-memory` | `F/client-knowledge-memory.mjs`; `S/client-knowledge/handler.mjs`, `memory-eligibility.mjs` | source | R-RETAINED |
| 14 | list_memory_proposals | `memory.list_own_proposals@0.2.0` / `memory-proposals` | `F/memory-proposals.mjs`; `S/memory-proposals/handler.mjs` | source | R-RETAINED. HTTP surface `/api/memory/proposals/*` is composed separately (`product-ports/memory.mjs`, `features.memory`) — not the conversational read |
| 15 | search_congress_bills | `search_congress_bills@0.2.0` / `bill-text` | `F/bill-text.mjs`; `S/bill-text/handler.mjs` | integrated | R-NATIVE |
| 16 | get_bill_status | `get_bill_status@0.2.0` / `federal-legislation` | `F/federal-legislation.mjs`; `S/federal-legislation/handler.mjs` | integrated | R-NATIVE |
| 17 | read_bill_text | `read_bill_text@0.2.0` / `bill-text` | as #15 | integrated | R-NATIVE |
| 18 | get_certification_status | `get_certification_status@0.2.0`, group `certification-status` — **none found** | `K/certification-status.schema.json` | inventory | C-ONLY |
| 19 | search_floor_votes | `search_floor_votes@0.2.0` / `federal-legislation` | as #16 | integrated | R-NATIVE |
| 20 | search_cbo_cost_estimates | `search_cbo_cost_estimates@0.2.0` / `public-reports` | `F/public-reports.mjs`; `S/public-reports/handler.mjs` | integrated | R-NATIVE |
| 21 | resolve_entity | `resolve_entity@0.2.0` / `entity-candidates` | `F/entity-candidates.mjs`; `S/identity-contacts/handler.mjs` | source | R-RETAINED |
| 22 | search_lda_filings | `search_lda_filings@0.2.0` / `disclosures` | `F/disclosures.mjs`; `S/disclosures/handler.mjs` | integrated | R-NATIVE |
| 23 | list_global_datasets | `list_global_datasets@0.2.0` / `dataset-metadata` | `F/dataset-metadata.mjs`; `S/dataset-metadata/handler.mjs` | source | R-RETAINED |
| 24 | query_global_data | `query_global_data@0.2.0` / `public-domain-query` | `F/public-domain-query.mjs`; `S/public-domain-query/handler.mjs` | integrated | R-NATIVE |
| 25 | search_sec_filings | `search_sec_filings@0.2.0` / `disclosures` | as #22 | integrated | R-NATIVE |
| 26 | search_fara_registrations | `search_fara_registrations@0.2.0` / `disclosures` | as #22 | integrated | R-NATIVE |
| 27 | search_federal_grants | `search_federal_grants@0.2.0` / `public-data` | `F/public-data.mjs`; `S/public-data/handler.mjs` | integrated | R-NATIVE; ledger R2 noted an adapter failure on the integrated tree (rt-reads) |
| 28 | search_federal_awards | `search_federal_awards@0.2.0` / `public-data` | as #27 | integrated | R-NATIVE |
| 29 | search_gao_reports | `search_gao_reports@0.2.0` / `public-reports` | as #20 | integrated | R-NATIVE |
| 30 | search_state_bills | `search_state_bills@0.2.0` / `state-legislation` | `F/state-legislation.mjs`; `S/state-legislation/handler.mjs` | integrated | R-NATIVE |
| 31 | get_state_bill_status | `get_state_bill_status@0.2.0` / `state-status-votes` | `F/state-status-votes.mjs`; `S/state-status-votes/handler.mjs` | integrated | R-NATIVE |
| 32 | search_state_floor_votes | `search_state_floor_votes@0.2.0` / `state-status-votes` | as #31 | integrated | R-NATIVE |
| 33 | get_state_legislator | `get_state_legislator@0.2.0` / `state-legislation` | as #30 | integrated | R-NATIVE |
| 34 | get_committee_roster | `get_committee_roster@0.2.0` / `legislative-directory` | `F/legislative-directory.mjs`; `S/legislative-directory/handler.mjs` | integrated | R-NATIVE |
| 35 | get_representation | `get_representation@0.2.0` / `facility-representation` | `F/facility-representation.mjs`; `S/facility-representation/handler.mjs` | integrated | R-NATIVE; clientScope required |
| 36 | list_members | `list_members@0.2.0` / `legislative-directory` | as #34 | integrated | R-NATIVE |
| 37 | get_state_rule_status | `get_state_rule_status@0.2.0`, group `rule-status` — **none found** | `K/rule-status.schema.json` | inventory | C-ONLY |
| 38 | search_intel_articles | `search_intel_articles@0.2.0` / `stored-intelligence` | `F/stored-intelligence.mjs`; `S/stored-intelligence/handler.mjs` | integrated | R-NATIVE |
| 39 | search_committee_hearings | `search_committee_hearings@0.2.0` / `public-domain-hearings` | `F/public-domain-hearings.mjs`; `S/public-domain-hearings/handler.mjs` | integrated | R-NATIVE |
| 40 | search_legiwatch_news | `search_legiwatch_news@0.2.0` / `research-legal-news` | `F/research-legal-news.mjs`; `S/research-legal-news/handler.mjs` (PARTIAL_INPUT) | source | R-SUBSET: family absent from `READ_FAMILIES` → not installable |
| 41 | get_florida_budget_project | `get_florida_budget_project@0.2.0` / `florida-budget` | `F/florida-budget.mjs`; `S/florida-budget/handler.mjs` | source | R-RETAINED (recipient-composed only) |
| 42 | search_legislative_research | `search_legislative_research@0.2.0` / `research-legal-legislation` | `F/research-legal-legislation.mjs`; `S/research-legal-legislation/handler.mjs` | integrated | R-NATIVE (family `operationIds` = this op only) |
| 43 | get_legal_reference | `get_legal_reference@0.2.0` / `research-legal-legislation` | `S/research-legal-legislation/handler.mjs` (route present) | source | R-SUBSET: excluded by `reads/families.mjs` `operationIds` |
| 44 | search_crs_reports | `search_crs_reports@0.2.0` / `public-reports` | as #20 | integrated | R-NATIVE |
| 45 | query_economic_data | `query_economic_data@0.2.0` / `public-data` | as #27 | integrated | R-NATIVE |
| 46 | get_district_nexus_context | `get_district_nexus_context@0.2.0` / `district-nexus` | `F/district-nexus.mjs`; `S/district-nexus/handler.mjs` | integrated | R-NATIVE; clientScope required |
| 47 | get_district_nexus_changes | `get_district_nexus_changes@0.2.0` / `district-nexus` | as #46 | integrated | R-NATIVE; clientScope required |
| 48 | search_public_web | `search_public_web@0.2.0` / `public-web` (Core `/api/clio/tools/search_public_web`) | `F/public-web.mjs`; `S/public-web/handler.mjs`, `README.md` | integrated | R-NATIVE. Distinct from the browser (held `BROWSER_EGRESS_UNQUALIFIED`, `apps/worker/conversation/browser/activation.mjs:28`) |
| 49 | scrape_web_page | `scrape_web_page@0.2.0` / `public-web` | as #48 | integrated | R-NATIVE; same browser distinction |
| 50 | save_chat_attachments | `save_chat_attachments@0.2.0` → intent `propose_attachment_filing`; command `artifact.file` | `apps/artifacts/filing.mjs`; `packages/contracts/commands-0.2/artifact-file*.{json,mjs}`; `apps/control/commands/source-projection.mjs:4` | source | I-HELD `OWNER_MISSING` (no proposal-metadata codec) |
| 51 | list_emails | `mail.list_messages@0.2.0` / `mail` | `F/mail.mjs`; `S/mail/handler.mjs`, `http-adapter.mjs` | source | R-RETAINED (no composer for `mail` found) |
| 52 | search_emails | `mail.search_messages@0.2.0` / `mail` | as #51 | source | R-RETAINED |
| 53 | get_email_thread | `mail.read_thread@0.2.0` / `mail` | as #51 | source | R-RETAINED |
| 54 | list_upcoming_meetings | `meeting.list_upcoming_meetings@0.2.0` / `meeting-source` | `F/meeting-source.mjs`; `S/meetings/handler.mjs` | source | R-RETAINED |
| 55 | save_memory | `save_memory@0.2.0` → intent `propose_memory`; command `memory.propose` | `packages/contracts/commands-0.2/memory-propose*`; execution-side source `product-ports/memory.mjs` `commandSourceFor` | source | I-HELD `OWNER_MISSING`; proposal boundary preserved (no canonical write) |
| 56 | search_program_elements | `search_program_elements@0.2.0` / `program-elements` | `F/program-elements.mjs`; `S/program-elements/handler.mjs` | integrated | R-NATIVE |
| 57 | get_program_element | `get_program_element@0.2.0` / `program-elements` | as #56 | integrated | R-NATIVE |
| 58 | get_pe_budget_timeline | `get_pe_budget_timeline@0.2.0` / `program-elements` | as #56 | integrated | R-NATIVE |
| 59 | get_pe_contractors | `get_pe_contractors@0.2.0` / `pe-references` | `F/pe-references.mjs`; `S/pe-references/handler.mjs` | integrated | R-NATIVE |
| 60 | get_pe_bills | `get_pe_bills@0.2.0` / `pe-references` | as #59 | integrated | R-NATIVE |
| 61 | get_pe_report_language | `get_pe_report_language@0.2.0` / `pe-references` | as #59 | integrated | R-NATIVE |
| 62 | search_acquisition_personnel | `search_acquisition_personnel@0.2.0` / `acquisition-personnel` | `F/acquisition-personnel.mjs`; `S/acquisition-personnel/handler.mjs` | integrated | R-NATIVE |
| 63 | get_acquisition_person | `get_acquisition_person@0.2.0` / `acquisition-personnel` | as #62 | integrated | R-NATIVE |
| 64 | create_word | `create_word@0.2.0` → intent `request_document` → document application | `intents/catalog.mjs`; `apps/control/document-application/format-admission.mjs:12`; `apps/runtime/artifacts/run-options.mjs:37`, `authority-composition.mjs`; `cli.mjs` (`composeDocumentsFamily`) | integrated | I-OK; `features.artifacts{…, authority}` + `artifacts.executor`; control image lacks Python 3/pptxgenjs (lane I) |
| 65 | create_excel | `create_excel@0.2.0` → `request_document` | as #64 | integrated | I-OK; same holds |
| 66 | create_powerpoint | `create_powerpoint@0.2.0` → `request_document` | `apps/artifacts/presentation.mjs` (pptxgenjs 4.0.1); `format-admission.mjs:12` admits word/excel only | source | I-HELD `ROUTE_GAP` (DA-3, ARTIFACT-ADMISSION) |
| 67 | schedule_task | `schedule_task@0.2.0` → intent `propose_schedule` | `apps/control/intents/schedule-preparer.mjs`; `apps/control/schedules/tool-interface.mjs`, `application.mjs` | source | `INTENT_ROWS` lists it available, but `schedule-preparer.mjs:5-9` states no trusted `resolveContext` owner exists (P-INT-6); startup owner **not yet mapped** |
| 68 | list_scheduled_tasks | `list_scheduled_tasks@0.2.0` — read, `NOT_INTENTS` | `apps/control/schedules/application.mjs:95`, `application-http.mjs` (`/api/routines/list`); `intents/catalog.mjs` `NOT_INTENTS` | source | HTTP product route (routines family, `features.routines`); no conversational tool; not in any read family |
| 69 | cancel_scheduled_task | `cancel_scheduled_task@0.2.0` → `propose_schedule_change` | as #67 | source | as #67 |
| 70 | update_scheduled_task | `update_scheduled_task@0.2.0` → `propose_schedule_change` | as #67 | source | as #67 |
| 71 | query_tasks | `query_tasks@0.2.0` / `operational-reads` | `F/operational-reads.mjs`; `S/original-tracking/handler.mjs` | source | R-RETAINED |
| 72 | query_action_items | `actions.query@0.2.0` / `action-items-complete` (+ historical `query_action_items@0.2.0` / `operational-reads`) | `F/action-items-complete.mjs`; `S/action-items/handler.mjs`; `S/original-tracking/handler.mjs` | source | R-RETAINED (both families non-native) |
| 73 | search_tracked_bills | `search_tracked_bills@0.2.0` / `tracked-bills` | `F/tracked-bills.mjs`; `S/tracked-bills/handler.mjs` | integrated | R-NATIVE; clientScope required |
| 74 | query_regulatory_dockets | `query_regulatory_dockets@0.2.0` / `regulatory-dockets` | `F/regulatory-dockets.mjs`; `S/regulatory-dockets/handler.mjs` | integrated | R-NATIVE |
| 75 | search_sam_opportunities | `search_sam_opportunities@0.2.0`, group `sam-opportunities` — **none found** | `K/sam-opportunities.schema.json` | inventory | C-ONLY |
| 76 | query_debriefs | `meeting.query_debriefs@0.2.0` / `meeting-source` | as #54 | source | R-RETAINED |
| 77 | read_client_meetings | `meeting.read_client_meetings@0.2.0` / `meeting-source` | as #54 | source | R-RETAINED; `requiredClientOperations` |
| 78 | query_outreach | `query_outreach@0.2.0` / `outreach-query` | `F/outreach-query.mjs`; `S/outreach-query/handler.mjs` (PARTIAL_INPUT) | source | R-SUBSET: family absent from `READ_FAMILIES` |
| 79 | read_client_documents | `read_client_documents@0.2.0` / `client-documents` | `F/client-documents.mjs`; `S/client-evidence/handler.mjs` | source | R-RETAINED; clientScope required |
| 80 | lookup_client_registry | `lookup_client_registry@0.2.0` / `client-registry` | `F/client-registry.mjs`; `S/client-registry/handler.mjs` | integrated | R-NATIVE |
| 81 | create_task | `create_task@0.2.0` → intent `propose_task`; command `task.create` | `intents/catalog.mjs`; `apps/control/intents/command-preparer.mjs`; `packages/contracts/commands-0.2/task-create*` | integrated | I-OK; needs Core rev 3 + `features.intents.execution` ON (ledger §5) |
| 82 | update_task | `update_task@0.2.0` → `propose_task_update`; `task.update` | as #81; `task-update*`; `product-ports/tasks.mjs` | integrated | I-OK; task executor grant owner still absent on the Core side (`tasks.mjs` header) |
| 83 | find_contacts | `find_contacts@0.2.0` / `tenant-contacts` | `F/tenant-contacts.mjs`; `S/identity-contacts/handler.mjs` | source | R-RETAINED |
| 84 | search_funding_opportunities | `search_funding_opportunities@0.2.0` / `funding-opportunities` | `F/funding-opportunities.mjs`; `S/funding-opportunities/handler.mjs` | integrated | R-NATIVE; clientScope required |
| 85 | get_funding_opportunity_requirements | `…_requirements@0.2.0` / `funding-opportunities` | as #84 | integrated | R-NATIVE |
| 86 | get_funding_opportunity | `get_funding_opportunity@0.2.0` / `funding-opportunities` | as #84 | integrated | R-NATIVE |
| 87 | get_opportunity_client_context | `get_opportunity_client_context@0.2.0` / `funding-opportunities` | as #84 | integrated | R-NATIVE |
| 88 | get_opportunity_government_landscape | `…_government_landscape@0.2.0` / `funding-opportunities` | as #84 | integrated | R-NATIVE |
| 89 | search_federal_contract_awards | `search_federal_contract_awards@0.2.0` / `federal-market` | `F/federal-market.mjs`; `S/federal-market/handler.mjs` | integrated | R-NATIVE |
| 90 | search_federal_subawards | `search_federal_subawards@0.2.0` / `federal-market` | as #89 | integrated | R-NATIVE |
| 91 | search_contract_vehicles | `search_contract_vehicles@0.2.0` / `federal-market` | as #89 | integrated | R-NATIVE |
| 92 | search_procurement_forecasts | `search_procurement_forecasts@0.2.0` / `federal-market` | as #89 | integrated | R-NATIVE |
| 93 | get_business_development_context | `get_business_development_context@0.2.0` / `business-development` | `F/business-development.mjs`; `S/business-development/handler.mjs` | integrated | R-NATIVE (subset) |
| 94 | get_business_development_evidence | `get_business_development_evidence@0.2.0` / `business-development` | `K/business-development.schema.json`; no route in `S/business-development/handler.mjs` | source | R-SUBSET: excluded by `NATIVE_READ_OPERATION_SUBSETS` and `operationIds`; no handler route |
| 95 | get_business_development_recent_changes | `…_recent_changes@0.2.0` / `business-development` | as #93 | integrated | R-NATIVE (subset) |
| 96 | get_district_federal_market | `get_district_federal_market@0.2.0` / `federal-market` | as #89 | integrated | R-NATIVE |

## 2. Table B — 43 excluded capabilities

All 43: catalog `originals[].disposition='deferred', replacement=null`; absent from catalog operations/aliases, every skill manifest and the SDK tool surface (`legacy-tools-excluded.test.mjs`); **0 code hits** in the fresh grep over `apps/ packages/ infra/ scripts/` (non-test, non-record). Reference: `docs/CAPABILITY-SCOPE.md` "Registry disposition ledger" (10 Oct, "proposed deferred") and `scope-ledger.json` `ownerDirection` (15 Oct, excluded by owner direction).

| # | name | present? | reference |
|---|---|---|---|
| 1–17 | manage_research_portfolio, get_research_portfolio_analytics, create_research_portfolio_snapshot, request_research_portfolio_output, save_research_portfolio_output_to_client, watch_research_portfolio, update_research_portfolio_change_state, get_research_portfolio_bookmarks, create_research_portfolio_bookmark, get_research_portfolio_fit, get_research_portfolio_reviews, add_research_portfolio_review_note, get_research_portfolio_rules, get_research_portfolio_imports, get_research_portfolio_operations, prepare_research_portfolio_brief, prepare_research_portfolio_meeting | absent | scope-ledger group "Research Portfolio"; `packages/contracts/test/retrieval-research-portfolio*.test.mjs` (negative tests); CAPABILITY-SCOPE rows 43–63 |
| 18 | find_path_to | absent | CAPABILITY-SCOPE line 72 |
| 19 | get_legiwatch_review | absent | CAPABILITY-SCOPE line 100 |
| 20 | compare_florida_budget_amounts | absent | scope-ledger group "Relationships, legislation and Florida" |
| 21 | prepare_legiwatch_briefing | absent | same group |
| 22 | compare_legislative_versions | absent | same group |
| 23 | save_legislative_research | absent | same group |
| 24 | preview_legiwatch_relevance | absent | same group |
| 25 | save_legiwatch_relevance | absent | same group |
| 26 | apply_legiwatch_suggestion | absent | same group |
| 27 | create_meeting_brief | absent | CAPABILITY-SCOPE line 118 ("new local native brief generation is required separately" — the selected skill `meeting_prep` is not this operation) |
| 28 | draft_policy_memo | absent | CAPABILITY-SCOPE line 119 |
| 29 | save_note | absent | CAPABILITY-SCOPE line 120 |
| 30 | send_email | absent | CAPABILITY-SCOPE line 122 |
| 31 | reply_email | absent | CAPABILITY-SCOPE line 127 |
| 32 | confirm_memory | absent (governed alternative: proposer approve/reject via Core review, `apps/control/memory/core-review.mjs`, D016 #6 review-only) | CAPABILITY-SCOPE line 129; `legacy-tools-excluded.test.mjs` "three direct canonical-memory writes" |
| 33 | correct_memory | absent (sourced correction = `memory.propose` candidate, `product-ports/memory.mjs` header) | as #32 |
| 34 | forget_memory | absent | as #32 |
| 35 | get_pe_buyer_workspace | absent | CAPABILITY-SCOPE line 135 |
| 36 | create_client | absent | CAPABILITY-SCOPE line 158 |
| 37 | update_client_profile | absent (name appears only in recorded evidence `provenance.json` files under `apps/control/document-application/mail-history/local/`, class "recorded-evidence" per scope-ledger) | scope-ledger `excludedReferences` |
| 38 | explain_opportunity_match | absent | CAPABILITY-SCOPE line 166 |
| 39 | compare_funding_opportunities | absent | CAPABILITY-SCOPE "Client and opportunity analysis" group |
| 40 | build_opportunity_action_plan | absent | same |
| 41 | get_business_development_brief | absent | CAPABILITY-SCOPE line 177 |
| 42 | resolve_business_development_source | absent | same group |
| 43 | save_business_development_brief | absent | same group |

## 3. Table C — 14 required original skills

All 14 manifests validate against `contractVersion 0.2.0` and list `allowedOperations` that **all exist in the catalog** (0 missing names). "not installable" = allowed read operation outside the 76-operation installation set; "non-native" = allowed reads in R-RETAINED families (handlers exist, not composed at startup). Plugin names are admitted by `PLUGIN_SKILL_NAMES` and `features.capabilityPlatform` (`skillPlugin`, `skillNames`); the runner mounts the plugin directory (`conversation-runner.mjs:79`). Skill **state = integrated (plugin)**, with operations as noted; the four "document applications" (`apps/control/document-application/{research-brief,commitments-audit,mail-history,relationship-brief}`) are separate typed compilers, not the plugin path.

| # | skill id | versions in `packages/skills` | manifest | in `PLUGIN_SKILL_NAMES` | required ops missing from catalog | allowed ops not installable / non-native | state |
|---|---|---|---|---|---|---|---|
| 1 | research_company | 1.0.0 | yes | `meri-research-company` | none | not installable: `search_sam_opportunities`, `get_certification_status`; non-native: `resolve_entity`, `get_client_context`, `find_contacts` (15/20 native) | integrated (plugin); 2 ops inventory-only |
| 2 | relationship_brief | 1.0.0 | yes | `meri-relationship-brief` | none | non-native: all 11 (mail, meetings, documents, memory, tasks, actions, monday, contacts, entity) | integrated (plugin); 0/11 composed |
| 3 | client_changes | 1.0.0 | yes | `meri-client-changes` | none | non-native: 9 of 13 (4 native: tracked bills, bill status, district nexus changes, BD recent changes) | integrated (plugin) |
| 4 | portfolio_changes | 1.0.0 | yes | `meri-portfolio-changes` | none | non-native: 9 of 14 | integrated (plugin) |
| 5 | portfolio_overlap | 1.0.0 | yes | `meri-portfolio-overlap` | none | non-native: 3 of 11 | integrated (plugin) |
| 6 | mail_history | 1.0.0 | yes | `meri-mail-history` | none | non-native: all 5 (mail ×3, resolve_entity, find_contacts) | integrated (plugin); 0/5 composed |
| 7 | meeting_prep | 1.0.0 | yes | `meri-meeting-prep` | none | non-native: 13 of 16 | integrated (plugin) |
| 8 | commitments_audit | 1.0.0 | yes | `meri-commitments-audit` | none | non-native: all 8 | integrated (plugin); 0/8 composed |
| 9 | funding_opportunity_match | 1.0.0 | yes | `meri-funding-opportunity-match` | none | not installable: `search_sam_opportunities`; non-native: `get_client_context` (7/9 native) | integrated (plugin) |
| 10 | pe_deep_dive | 1.0.0 | yes | `meri-pe-deep-dive` | none | none (11/11 native) | integrated (plugin) |
| 11 | bill_watch | 1.0.0 (document application, no SDK frontmatter) + 1.0.1 | yes (both) | `meri-bill-watch` (1.0.1) | none | `create_word` is an intent (I-OK), not a read; 3/3 reads native | integrated (plugin) |
| 12 | hearing_watch | 1.0.0 | yes | `meri-hearing-watch` | none | non-native: `get_client_context` (6/7 native) | integrated (plugin) |
| 13 | representation_lookup | 1.0.0 | yes | `meri-representation-lookup` | none | non-native: `get_client_context`, `find_contacts` (5/7 native) | integrated (plugin) |
| 14 | regulatory_docket_brief | 1.0.0 | yes | `meri-regulatory-docket-brief` | none | not installable: `get_state_rule_status` (inventory), `get_legal_reference` (R-SUBSET); non-native: `resolve_entity`, `get_client_context` (3/7 native) | integrated (plugin) |

## 4. Totals

- **Table A (96):** integrated **59** (55 native reads + create_word, create_excel, create_task, update_task) · source **32** (20 R-RETAINED reads, 4 R-SUBSET reads, 3 schedule intents, list_scheduled_tasks, 4 I-HELD) · inventory **5** · qualified/deployed/live-verified **0** · blocked/deferred 0 (holds are recorded as notes, not as states).
- **Table B (43):** absent 43 · governed/deferred-with-reference 0 (confirm/correct/forget_memory have a governed *alternative*, not an implementation).
- **Table C (14):** 14 manifests present, 14 plugin names admitted, 0 required operations missing from the catalog; 4 skills reference operations with **no implementation** (research_company ×2, funding_opportunity_match ×1, regulatory_docket_brief ×1 inventory + 1 subset); 3 skills have **no operation composed at startup** (relationship_brief, mail_history, commitments_audit).
- **Appendix A names with no implementation (contract only):** `read_chat_attachments`, `search_research_sources`, `get_certification_status`, `get_state_rule_status`, `search_sam_opportunities`.
- **Skills whose required operations are missing (not installable on the tip):** research_company (`search_sam_opportunities`, `get_certification_status`), funding_opportunity_match (`search_sam_opportunities`), regulatory_docket_brief (`get_state_rule_status`, `get_legal_reference`).
- **Rows not yet mapped to a startup owner:** the 20 R-RETAINED read names (#1, 2, 3, 5, 7, 13, 14, 21, 23, 41, 51–54, 71, 72, 76, 77, 79, 83) and the 3 schedule intents (#67, 69, 70) — their code exists; the missing link is the startup composition, which this lane did not finish tracing.

## 5. Unverified (could not be established from source in the time available)

1. **Installation receipt vs composed handlers.** The P2 measurement lists all 76 operations, but `reads-composer.mjs:115-117` composes handlers only for the 27 native families (55 operations). `apps/gateway/general-reads/installation.mjs assertReceipt` compares every receipt row against `registry.sourceSha256(op)` (`catalog/measured-handlers.mjs`), which is `undefined` for an unregistered operation → `GENERAL_READ_INSTALLATION_REFUSED` → every read `UNAVAILABLE`, unless the render revokes the 21 non-native operations (`features.reads.installation.revokedOperations`) or the retained runtime's handlers are merged in. Read from source only; **not executed** (no test found that runs the production composer against the full measurement — `read-composer.test.mjs` uses a single-family `familyIds` and its own installation port). Needs one focused check by the reads lane before the N22 re-measure.
2. **Retained families' startup caller.** `createRetainedControlGeneralReadRuntime` has no non-test importer found; the `mail` family has none at all. Whether another composition (e.g. `apps/runtime/control.mjs` or `prepared-run-registry.mjs`) threads these was not traced.
3. **Schedule intents** (#67/69/70): `INTENT_ROWS` marks them available while `schedule-preparer.mjs` says no `resolveContext` owner exists; `execution-composition.mjs` was not read to settle which is current.
4. **Documents composition** details (`authority-composition.mjs` header says the production CLI supplies no `authorityPorts`; ledger says lane X threaded `runOptions`) — taken from the ledger, not re-verified.
5. The authoritative enumerator (`first-chat-launch-measurement.mjs generalReadInstallation`) was not run (SDK import); the 76/42 figure is from a faithful re-implementation plus `first-chat-launch-measurement.test.mjs:73`.
6. No live/AWS/Core/DB evidence was consulted; `qualified` and later states are taken from `PLAN-RECONCILIATION-20261018.md` §1 only.
