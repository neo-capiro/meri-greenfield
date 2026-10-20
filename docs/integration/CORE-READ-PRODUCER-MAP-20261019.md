# Core producer map for Meri read completion

Read-only source inspection. Exact Core pin: `neo-capiro/capiro-backend@138c04373b18bb730b1ad0f8f9338342f628b8c6`.
Meri inspection base: `98d3c96a2c944a8211856e98b5bd62e824b4b5f7`.
No Core/frontend files, credentials, infrastructure or databases were changed. No provider, API or deployment was executed.
A native git clone was unavailable through existing credential access. Current files were read with the authorized GitHub connector at the exact pin. Snapshots are intermediate analysis, not a runnable Core checkout.

## Current boundaries

All ordinary tool names below have real finite dispatch branches in `apps/api/src/meri/meri-tools.service.ts`, via `POST /api/clio/tools/:name` in `meri.controller.ts`. Route existence alone does not authorize unattended/run-bound use.

The current run-bound mechanism is `CapiroMeriRead` plus the verified internal service identity. `auth/read-delegation/read-delegation.contract.ts` owns explicit name eligibility. The middleware verifies the exact POST path and raw body hash, one-use token JTI, current run/delegation/consent/member, exact client visibility and reservation; the controller validates every client/conversation selector and rechecks current delegation/member/client at result release. If an advertised schema has a client selector, the caller MUST carry one: omitting an optional selector cannot widen to a roster-wide read.

The five requested missing operations have legacy producers but are NOT in the delegated tool allowlist or correlated retained-source set at this Core pin. Their source schemas existing in Meri does not change that authorization fact.

## First work package

| Operation | Exact producer/endpoint | Current source facts and dependency |
| --- | --- | --- |
| get_research_portfolio | Signed `POST /api/clio/retained-reads/research-portfolio`; canonical `ResearchPortfoliosService.detail` | Existing retained principal path, separate from Option B. Live native authority/issuer `POST /api/clio/application-authority/retained-research-portfolio` and `.../retained-research-portfolio-principal`; signed data verifies current identity/resource before and after owner read. Viewer grant is exact tenant/portfolio/principal-user. Requires configured `RETAINED_READS_ENABLED=true` plus complete trust pins; not claimed installed. |
| get_research_portfolio_changes | Signed `POST /api/clio/retained-reads/research-portfolio-changes`; canonical `ResearchPortfolioChangesService.listChanges` | Existing retained issuer/authority siblings use `retained-research-portfolio-changes[-principal]`. Signed normalized cursor/limit preserved. Revision drift refuses. |
| get_research_evidence | Ordinary native bearer GET `/api/research-portfolios/:id/reviews`, `/snapshots`, `/annual-review` | Current native sources exist; viewer grants checked by their owners. No corresponding signed retained evidence data path appears in the current principal receiver or trust operation set. Do not pretend Option B authorizes these GETs. |
| read_monday_client_boards | Correlated retained `POST /api/clio/tools/read_monday_client_boards`; `readRetainedMondaySourceV02` -> `readWithCurrentMondayMapping` | Current source reads `meetingPrepMondayMapping` by exact tenant/user/client before and after canonical context-plane read. It verifies board subset/version and full 0.2 output internally. BUT external result is original canonical body unchanged; no managedBoardMapping is emitted in token reply or body. Existing Meri adapter requiring a token-level mapping has a producer mismatch. No new mapping endpoint exists. |
| mail.list_messages / mail.search_messages / mail.read_thread | Correlated retained `POST /api/clio/tools/<dotted ID>`; `readRetainedMailSourceV02` -> Engagement canonical mail readers -> pinned `projectMailRetainedSourceV02` | Genuine current 0.2 pages already produced. Subject may personal or client; always needs mailbox scopes. Authorized mailbox resource IDs are passed to owners. Each row carries matching mailbox scope, separate from its linked client ID. Pagination/body offsets remain native. Conservative partial freshness/history/evidence-ready flags retained. |
| get_florida_budget_project | Signed Intel data `POST /intel-api/internal/legiwatch/retained-florida-budget` | Existing Core retained authority/issuer routes `retained-florida-budget`, `retained-florida-principal`; signed data recipient is Intel origin. Ordinary legacy Core tool also bridges to Intel but is NOT Option B eligible. Native scope fixes FL, takes selected sessionKey, resolves actual folder client and checks current client wall. Keep retained trust and native authority probes. |
| query_tasks | Option B eligible `POST /api/clio/tools/query_tasks` -> `queryTasks` -> `EngagementService.readMeriTasksExact` | Exact task owner already checks client wall/current membership and applies Research Portfolio task grants to both count and page. Existing parser/result builder retained. Current Meri selected-task composer intentionally refuses query_tasks, so startup composition is the Meri gap. |

## Second work package

| Operation | Actual Core producer | Precise remaining dependency |
| --- | --- | --- |
| read_chat_attachments | `MeriChatAttachmentReadService.read` plus `meri-chat-attachment-transport.ts` | Not delegated-read eligible. Requires service-authenticated `{version:1,input,currentTurn:{tenantId,userId,conversationId,selectedClientId}}` envelope and native owned, unarchived `clioConversation`; its client must match selectedClientId and pass current memory wall. `conversationVersion` is actual native updatedAt ISO. Manifest/sections refresh conversation and source before release. Native generatedAt clock is not the prebound Meri `asOf`. No greenfield->native conversation mapping may be assumed. |
| search_research_sources | `MeriToolsService.searchResearchSources` | Not delegated-read eligible. Six capped stored branches: clients, actor-owned meetings/mail/notes, tenant directory notes. Explicit client resolves same tenant but directory notes stay tenant-wide. No branch-suppression input. Need actual pre-read current client and independent directory-note authority; model client IDs do not grant it. |
| get_certification_status | `getCertificationStatus` -> `fetchFedrampProducts` | Not delegated-read eligible. Query, exact ID and name checks all use no-argument `toLocaleLowerCase()`; frozen Meri receiver requires trusted canonical actual `comparisonLocale`. No producer locale observation exists. Preserve exact-ID precedence, 10-candidate cap, whole-dataset provenance; FedRAMP bounded fetch qualification remains separate. |
| get_state_rule_status | `getStateRuleStatus` -> `formatRuleStatus` -> shared stage/comment helpers | Not delegated-read eligible. Stage and comment openness still use separate implicit helper clocks. Frozen receiver needs `stageAsOf`/`commentAsOf` corresponding to the actual invocations. Native generatedAt is later and does not establish either. |
| search_sam_opportunities | `searchSamOpportunities` -> stored ProgramElement SAM catalog + `readSamSourceFreshness` | Not delegated-read eligible. Needs actual generation/deadline `asOf`, direct Core evidence rollout mode, stale `Date.now()` comparison observation and source-health calculation clock. New `meri-funding-read-observation.ts` covers funding/KB/evidence-mode reads but DOES NOT cover SAM. Catalog emptiness must retain unknown/degraded/never-synced distinctions. |

## Omitted operations

All below use existing fixed native tool POSTs. Current Option B eligibility is affirmative except BD evidence.

- `search_legiwatch_news`, `search_legislative_research`, `get_legal_reference`: Core existing bridge injects its actual `ctx.tenantId` and `ctx.clerkUserId` into `/intel-api/internal/legiwatch/meri/read`; `KeywordMeriController` has finite branches. Intel owner feature/member/folder/client wall checks remain authoritative. Branch-specific cutoff/default-year/citation observations remain necessary. Earlier reports' no-client restricted slices cannot automatically pass current Option B schema selector enforcement; use exact delegated client where supported.
- `query_outreach`: eligible, but only the explicit-client campaign-list slice has a straightforward current delegated-client boundary. Native `listCampaigns` filters tenant and optional client, without an independent actor/client wall. Owned detail includes linked client/meeting/prep/debrief data; ownership alone does not prove every linked grant.
- `get_business_development_context`, `get_business_development_recent_changes`: eligible. Native owned/unarchived Core conversation and persisted prospect scope must be re-resolved; model-supplied prospect IDs are forbidden. Current `BizDevMeriScopeService` still checks tenant/flags/prospect/version, not linked-client memory wall. Delegated conversation selector must equal the current delegation's conversation UUID. Explicit legacy conversation selectors cannot be silently substituted.
- `get_business_development_evidence`: actual legacy producer `getEvidence` exists, calls local `prospectDossier(...,suppressJev=true)`, but NOT Option B eligible. Retain linked-client/dossier-facility authority and watch/provider effect review as separate dependencies.

## Source location and verification

The accompanying `read-tools-evidence-20261019/core-source-manifest.json` retains hashes for the exact fetched source snapshots. Temporary local paths are not required for continuation; re-fetch the source from the pinned repository. Filename-to-original-path mapping follows the source imports; principal authority/contracts are under `apps/api/src/auth`, retained-source projectors under `apps/api/src/meri/retained-source-v02`, Intel evidence/research under `apps/intel-api/src/tracker/{editorial,research}`.
Focused source checks used `rg` and exact source excerpts. No tests were run because this lane owns no implementation and has no complete Core checkout/dependency graph. No qualification or production availability is asserted.


## Receiving correction: delegated business-development client wall

The legacy inline prospect scope service alone lacks the linked-client wall. The current delegated path in `apps/api/src/auth/read-delegation/read-delegation.service.ts` explicitly resolves an owned active native conversation, authorizes its persisted prospect, checks `prospect.linkedClientId === grant.clientId`, and includes that custody tuple in `contextRevision`. The new Meri evidence path therefore requires selected-client `CapiroMeriRead` plus the current conversation receipt; it does not admit the legacy personal/Bearer path. Evidence still needs Core allowlist admission, read-only dossier qualification and an actual greenfield/native conversation relationship. The Meri run binding cannot be silently replaced with a model-provided native conversation ID.
