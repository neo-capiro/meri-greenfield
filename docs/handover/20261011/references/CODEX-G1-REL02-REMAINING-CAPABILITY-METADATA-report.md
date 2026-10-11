# REL02 remaining selected capability metadata

Discovery only. All **93 remaining selected IDs** are individually accounted for, preserving the accepted **139 originals / 96 selected / 43 deferred**. The three mail IDs are excluded because their contracts have a separate owner. This report does not map, freeze, implement or enable an operation. All 93 current catalog replacements remain null/pending; the existing pending thread descriptor stays unchanged.

The consolidated ignored `CAPABILITIES-93-FINAL.json` contains every advertised input field, required field, literal type/enum/range, description, observed numeric coercion, dispatch reference, registry description/readOnly/surface, selected ordering/paging metadata, source lines and explicit unknowns. **86 input schemas are recovered as literal metadata; two are partial because imported enum bindings are not retained; five federal-market input schemas are unavailable.** Those markers are discovery records, not permissive schemas or accepted opaque JSON DTOs. Strict result schemas are not recovered merely because a registry describes a result.

This dedicated branch starts at `f2d6c0b8bdb728bcccc8628538e678711b679c1c`. The only tracked additions are the proportional task brief and this report. No schema/catalog/ledger/validator/skill/handler/package/lock changes, source imports, product checks, customer reads, network acquisition, AWS/native/Docker/provider actions or operational clocks occurred.

## Frozen origin and method

Behavioral reference is exactly `neo-capiro/capirov2@fd8765ec01d292013758606204f2c9d886cd31c1`. The previously acquired recursive tree is untruncated, has 21,435 entries and names that commit. No current HEAD was substituted. Existing owner/mail metadata receipts identify the retained files. The DATA reader independently verifies raw SHA256 and Git blob SHA1 (`blob <length>\0<bytes>`) before lexical extraction; it never evaluates TypeScript or imports legacy code.

| Frozen path | Raw bytes | SHA256 | Git blob |
| --- | ---: | --- | --- |
| `apps/api/src/meri/meri-tools.service.ts` | 415704 | `53d9d5b7ed8ba55a1086062812b3aaaf3cc225db485e4542c4ffc5836ea8e194` | `753b425b3e6b8cf55a7d0863aa961a3c9a696dea` |
| `packages/shared/src/index.ts` | 273389 | `1a713331de044768f7bd8631db4762a08a3c3541a1bbc064c67bbff46fc9a75f` | `62eb32931826f77abd985bc142f6a65adad6a23a` |
| `packages/shared/src/meri-read-outcome.ts` | 35614 | `691393b5aa888bc4ab5e6b3de73fe22bf8649722eded4de5722fee6aa590992c` | `412541d5a529a0fb34248a7120cea0222a1d2987` |

The schema reader accepts only literal objects/arrays/strings/numbers/booleans/null and the three source-declared metadata helpers `obj`, `str`, `int`, plus the local literal `legiwatchScope`. It retains unresolved expressions verbatim rather than interpreting arbitrary JavaScript. Switch fallthrough is followed to its terminal dispatch, including shared portfolio and LegiWatch groups. Source excerpts remain ignored metadata, not transplanted handlers. The existing accepted R2 plan, capability ledger and current catalog own scope and availability; frozen code supplies observations only.

Important compatibility facts:

- The frozen `obj` helper at wrapper lines 517–525 emits object/properties/required but **omits additionalProperties**. Extra-argument refusal is therefore a deliberate strict external DTO choice, not preserved advertised behavior. Of 88 retained schemas, none establishes a closed outer argument object through that helper. Nested explicit additionalProperties constraints remain separately recorded.
- Most numeric defaults/ranges are descriptive strings, not JSON-schema `default`/minimum/maximum. The JSON keeps actual structural bounds separate from descriptions and observed handler fallback/clamping. `clampInt` at 10044 accepts finite numbers or `Number(string)`, truncates toward zero and clamps; invalid input falls back. `optionalString` at 9948 trims strings, returns null for nonstrings/empty, and slices to a maximum; `requiredString` rejects a missing result. These coercions are observations, not a recommendation to recreate coercion at a new external boundary.
- Advertised inputs and method observations can differ. `query_economic_data` reads `year` that is not advertised; `scrape_web_page` reads `maxChars` that is not advertised. Do not silently expose either. Exact null semantics, tie ordering and stable pagination cannot be inferred from a TypeScript cast, Prisma model, `orderBy` field or a description.
- Registry flags classify 83 of these selected IDs readOnly and ten mutating. They do not authenticate the actor, establish grants, permit a model-supplied source/tenant or prove that a computation creates no artifacts. The ten flagged writes are save_chat_attachments, save_memory, create_word, create_excel, create_powerpoint, schedule_task, cancel_scheduled_task, update_scheduled_task, create_task and update_task.

## Cohesive family findings and proposed allocations

These are proposed future contract ownership boundaries, not allocated paths or implementation decisions. Each family can own one focused input/result schema and its own tests. A single integration owner must serialize changes to the existing `retrieval-0.2/validate.mjs` and `catalog.json`; schemas reference the existing common subject/window/source accounting and unchanged EvidenceEnvelope rules. No new generic registry, query executor, authorization system or orchestration loop is proposed.

| Family / count | Concrete observed boundary and missing result proof | Proposed schema stem |
| --- | --- | --- |
| Research Portfolio / 2 | Exact conversationId required; changes cursor and structural limit1–100. Registry advertises immutable portfolio identity/revision/members/links/grants/events and recipient seen/acknowledged/dismissed feed with partial history. Wrapper 2585–2611 delegates through current-use scope transport; feature gate/service 457–462. Actual revision/feed/output and current grants require the separate domain/scope owners. This is the selected basic read slice, not deferred management/analytics/snapshot parity or all-client Meri portfolio scope. | `research-portfolio.schema.json` |
| Artifacts/files/computation / 8 | Evidence sessionId with optional 1–10 attachment UUIDs; bounded attachment/document sections and read cursors; source versus generated artifact identities remain distinct. `run_analysis` advertises Python code and dataset rows, but its description's <=5000 rows is not a schema bound; wrapper 2339–2465 separately gates/rate-limits. Filing resolves current client and conversation; document generation 7619+ binds conversation/client and format-specific canonical specs. Exact render/version/filing receipts and approval outcomes still need owners; snippets/sections never become full source by finishing a page. | `artifact-source.schema.json` |
| Client context/operational records/tasks / 10 | Monday has before/after current wall checks (470–504), adapter coverage and page/cursor distinctions. Client context section enum is unresolved. Knowledge search has bounded relevance previews and explicit unavailable fallback (2273–2318). Task/action reads use imported exact-read parsers; clientless action branch is separately bounded. Outreach exact body is truncated to2000; list total is campaign collection length before display slicing (8923–8964), not a general exhaustive source count. create/update tasks are separate governed writes; update maps legacy open→todo and rejects an empty update (8998–9019). Contact search requires some client/domain/query and does not dump the table. | `client-operations.schema.json` |
| Unified/public retrieval / 4 | search_capiro_data requires query/domains, per-domain cursor object, explicit window and queryClass, but domain/query enums are unresolved. search_research_sources takes up to25/default8 per underlying source, with differing source orders (6776–6973); concatenated candidate results are not an exact total or complete corpus. Public web search returns candidates/snippets; exact scrape is required before decisive use. scrape rejects private/local URLs and bounds HTML5MiB/PDF15MiB in legacy metadata; full transport source/hash/coverage needs its owner. | `source-discovery.schema.json` |
| Government intelligence/aggregates / 13 | Fixed public reference searches expose dated bounded records, not arbitrary tenant SQL. LDA limit1–50/default15,page1–100/default1; SEC/FARA/GAO/CRS/news generally1–50/default20, source-specific descending date orders. Hearings are exact/historical published-record and transcript-chunk reads with current access and explicit unsupported material, one evidence chunk per page (6394–6443). District Nexus retains source/date/stage/gaps. Global aggregate tool delegates to a reviewed dataset/compiler allowlist; wrapper rows are capped at256KiB and rowCount precedes byte truncation (4770–4829). Returning compiled SQL in old metadata does not authorize a SQL API. Exact field/agg/type registry and source coverage are missing. | `government-reference.schema.json` |
| Relationship graph / 1 | seed optional; depth description1–4/default2. Wrapper returns nodes and at most120 rendered connection lines, distinguishes fact/mention origin and restricts client scope (3348–3397). Graph availability/eligibility, edge lineage and complete traversal are not proven by this bounded projection. Do not expose deferred path-search as an alias. | `relationship-graph.schema.json` |
| Governed memory / 3 | search k1–15/default8 but at most3 previews; exact memory ID uses1 and content.nextRead, separately scoped cursors (3460–3570). Approved current memory recall excludes pending/rejected/withdrawn/revoked/superseded/noncontrolling conflicts; absence in recall is not absence of historical proposals. Shared save returns pending candidate requiring another authorized reviewer or actual private save; ephemeral expiry is separate (2908–2972). Proposal service/output, content hashes and lifecycle versions need their owners. Never count a pending proposal as active memory. | `governed-memory.schema.json` |
| Legislation/status/representation / 17 | Bill search and exact status/text are distinct; textQuery's stored119th corpus and bounded matching passages cannot answer procedural status. Exact bill text binds current revision/version/package and continuation; offset>0 remains truncated even on final page (3903–4035). Vote/estimate absence descriptions require explicit source coverage before evidence assertions. State/federal jurisdictions and committee namespaces are separate; state committee needs state, no guessed roster. list_members requires state or chamber despite empty schema required[] and uses state/chamber/lastName order. Representation comes from geocoded facilities; ungeocoded remains unknown. Controlled FedRAMP candidates require disambiguation. | `legislation-truth.schema.json` |
| Federal market / 8 | Three wrapper schemas retained; five separate-adapter schemas missing. Existing federal_awards limit1–50/default20 and explicit pagination bounds. Registry separates contract obligations, subawards, vehicles, forecasts, future SAM signals and district attribution. Never add prime/subaward rails, infer district from city/ZIP, infer forecast eligibility/deadline or call a source provider because an ID exists. Exact synchronized freshness/reviewed-client identity/amount basis/output requires adapter metadata. | `federal-market.schema.json` |
| LegiWatch/exact research / 4 | Scope fields clientId/folderId/jurisdiction/sessionKey are literal. News view required; Florida fiscalYear required and distinct from legislative session; exact research requires jurisdiction/sessionKey; legal reference requires jurisdiction/view. Wrapper resolves requested client through current visibility and sends server actor/tenant to the owner (2504–2565). Actual remote result schemas, cursors/version policy/folder authorization missing. Retained reads do not activate scans/subscriptions; appropriations are not client awards; quotes are untrusted evidence. | `legislative-research.schema.json` |
| Meetings/calendars / 3 | upcoming list limit1–25/default10, withinDays1–365/default30, startsAt [now,until), noncancelled owned meetings, startsAtASC; count is returned bounded rows, not full history (7463–7524). Debrief and exact meeting-source parsers bind client/time/sections; debrief performs current wall checks around await (8607–8630). Imported cursor/content DTOs and exact source inventory are missing; no connection-active policy inferred from stored records. | `meeting-source.schema.json` |
| Defense budget/acquisition / 8 | PE and program-budget identities stay separate. Searches limit1–50/default20,page1–100/default1. Finder strips spark/coalesced money and projects labeled FY/stage/basis, pointing to mark-by-mark timeline (5027–5150). Detail/timeline/provisions retain enactment/source/lineage qualification; candidate lineage is unverified (235–237). Report language retains matchScope/attribution caveat, not program-level award truth (5280–5291). Contractor/bill/acquisition owners supply missing full DTOs; do not unify family/chamber pipelines or currency/stages. | `defense-budget.schema.json` |
| Schedules / 4 | Required name/prompt/intervalMinutes; fixed local/UTC/timezone/weekday inputs and read-only tool allowlist are metadata, not source authority. list is own-user createdAtDESC/take50/count returned. create reconciles exact proposal-stable identity, including inactive historical receipt; pause/resume/run_now differ and canceled cannot resume (8153–8416). These are approved task actions under trusted control/Temporal, not copied legacy scheduler/orchestrator or autonomous email/write authority. Missing schedule validator constants/receipt types need bounded metadata followup. | `schedule-action.schema.json` |
| Funding opportunity decisions / 5 | clientId required; source strings/enum differ per operation. Requirements structural offset0–1e6/limit1–25; summary offset0–1e8/limit1–12000. Adapter owns flag/role/wall, not model args (239–245,2816–2880). SAM requirements/landscape, Grants/SAM opportunity details and client context are distinct reads; exact output/read limits/score/provenance need adapter. Do not turn recommendations into tasks, qualification or pursuit intent. | `funding-opportunity.schema.json` |
| Prospect business development / 3 | Optional conversationId is not arbitrary prospect authority. Registry requires prospect-scoped conversation; context is minimal safe identity/preferences/20recent activities, evidence up to24 with stable locators/separate dates/partial coverage, changes up to25 newest with implication explicitly inference. Wrapper delegates to prospect service; implementation and strict result schemas missing. No deferred management/contact/provider/CRM write workflow, conflict payload or bid/win inference. | `prospect-evidence.schema.json` |

The proposed stems all live under the existing internal `packages/contracts/retrieval-0.2/` if later allocated. Family suites belong under the current contracts tests. Input/output references must bind reviewed raw schema bytes using the existing catalog descriptor representation; **no pending operation is usable by a skill**. Common eligibility/context and EvidenceEnvelope remain canonical rather than copied into fifteen validators. Transport-only partial pages should follow the accepted mail distinction where immutable identity/completeness is unproved, with evidenceReady false and negativeAssertion none; do not declare all domain pages compatible automatically.

## Exact missing metadata and bounded next work

The retained full frozen tree supplies exact blob identities for future read-only acquisition. No requests were issued here. Priority1 is a **four-file** acquisition at the same commit, which can close all seven structural gaps:

| Frozen path | Blob SHA1 | Gap |
| --- | --- | --- |
| `apps/api/src/federal-spending/federal-market-meri-tools.service.ts` | `7c5b09c86ca519996d63cecb8c95d7b54bad5c6b` | All five federal_market input schemas/dispatch/output boundaries |
| `apps/api/src/retrieval/retrieval-v2.types.ts` | `71f80b0d94d78537ab6c5f150ab7960417d319d0` | RETRIEVAL_DOMAINS and domain source metadata |
| `apps/api/src/meri/meri-data-search.helpers.ts` | `3194549806fa74147ab61d2ba40ef4182bee42f7` | MERI_DATA_QUERY_CLASSES, per-domain cursor/query parsing |
| `apps/api/src/meri/meri-client-context.helpers.ts` | `b35e0d20396a4a2a8764ab2c8dab4db7d7df12e4` | CLIENT_PROFILE_SECTIONS, section/default/result coverage |

Priority2 is family-specific metadata, not more broad source scanning: Research Portfolio scope/transport/tools; prospect service; opportunity adapter; global-dataset registry/query compiler; exact task/action/debrief/meeting/document/memory read helpers. `MISSING-METADATA.json` lists exact source paths/tree blobs/bytes for these owners. Several source output services remain outside the retained set, so no family is labeled a complete accepted result contract. Acquire only the responsible metadata per subsequent allocation; do not port implementations or pretend source-only extraction qualifies runtime authorization.

Useful future negative checks are family-specific: pending/unmapped operations cannot appear in skills; strict extra/null/nonfinite/accessor/cross-context arguments; unknown sources/enums and source authorization in args; candidate counts versus exact counts; source denial/revocation before and after page awaits; stale/partial/unsupported history and final-page preview; cursor/source/version/query substitution; explicit null/tie-order disclosure; mixed stage/FY/currency/award rails; memory pending versus approved; task/artifact/schedule proposal, unknown outcome and duplicate receipt distinctions. These are proposed contract checks, **not executed checks or blanket permission to implement all handlers**.

## Discovery verification and limits

The successful local DATA readers account for all IDs and preserve exact literal schemas/descriptions and grouped dispatch references. Canonical source files and the three frozen files are hashed; frozen blob identities are remeasured. The first reader failed before output allocation on a literal description concatenation (`+`); its bytes and factual failure are retained. A narrow literal-only parser correction then completed, and v1/v2/final DATA outputs are retained rather than overwritten. Two initial console reads failed on CP1252 encoding; they produced no source mutations. These are metadata-read failures, not product/native tests.

The parser is a restricted lexical reader, not a TypeScript compiler or proof of every runtime branch. Descriptive enums are not upgraded into structural enums. Selected wrapper metadata and registry prose do not prove delegated result types, snapshot/record immutability, actual source sync, current grant decisions, active connection eligibility or physical completeness. Exact safe schema and registry spans accompany the JSON for owner review. No imported source was evaluated. No 0.1/public export changes, R2 scope changes, gate reduction or architecture departure occurred.

REL-02/REL-03 remain open, including genuine source receipts, adapters, exact counts/history, decisive reads, revocation and replacement qualification. The 75 real requests, 200 heldout cases and live RG benchmarks are still pending and were not synthesized. G1/security/source connectivity/runtime parity remain unchanged. The finite evidence seal and exactly-two-document commit accompany the handoff; the integration owner reviews and allocates actual family contracts separately.

## Complete remaining-ID index

The following index is generated from the canonical selected ledger and retained schema metadata. `partial` means exact unresolved expressions are retained; `missing` means no schema bytes are available, not an accepted empty object. Full input structures/default descriptions and source references are in the ignored JSON.

| ID | Schema line | Fields (required marked *) | Metadata status |
| --- | ---: | --- | --- |
| get_research_portfolio | 551 | conversationId* | literal |
| get_research_portfolio_changes | 559 | conversationId*, cursor, limit | literal |
| get_research_evidence | 880 | sessionId*, attachmentIds, clientId, cursor, limit | literal |
| read_chat_attachments | 906 | conversationId, attachmentId, query, section, rowStart, characterOffset, cursor, limit | literal |
| read_monday_client_boards | 949 | clientId*, boardContext, pageSize, cursor | literal |
| search_capiro_data | 966 | query*, domains*, clientId, queryClass, windowStart, windowEnd, pageSize, cursors | partial |
| get_client_context | 1008 | clientId*, section, cursor, limit, representation | partial |
| search_research_sources | 1033 | query*, clientId, limit | literal |
| run_analysis | 1052 | code*, datasets, purpose | literal |
| search_client_knowledge | 1041 | query*, clientId, kind, limit | literal |
| query_intelligence | 1080 | clientName | literal |
| query_knowledge_graph | 1083 | seed, depth | literal |
| search_memory | 1096 | query*, clientId, cursor, memoryItemId, contentCursor, k | literal |
| list_memory_proposals | 1115 | clientId, cursor, limit | literal |
| search_congress_bills | 1140 | query, textQuery, policyArea, congress, activeSince, limit, page | literal |
| get_bill_status | 1151 | billId* | literal |
| read_bill_text | 1157 | billId*, versionCode, cursor, query | literal |
| get_certification_status | 1172 | program*, query* | literal |
| search_floor_votes | 1179 | billId, query, member, chamber, congress, limit | literal |
| search_cbo_cost_estimates | 1187 | billId, query, congress, limit | literal |
| resolve_entity | 1193 | query*, type, limit | literal |
| search_lda_filings | 1203 | clientName, registrantName, issueCode, year, limit, page | literal |
| list_global_datasets | 1211 | empty advertised properties | literal |
| query_global_data | 1212 | dataset*, select*, filters, groupBy, orderBy, limit, asOfDate | literal |
| search_sec_filings | 1265 | query, formType, cik, limit | literal |
| search_fara_registrations | 1271 | query, registrantName, foreignPrincipal, country, status, limit | literal |
| search_federal_grants | 1279 | query, agency, status, limit | literal |
| search_federal_awards | 1285 | query, agency, peCode, page, limit | literal |
| search_gao_reports | 1292 | query, reportType, limit | literal |
| search_state_bills | 1297 | query, state, session, status, limit | literal |
| get_state_bill_status | 1306 | billId*, state | literal |
| search_state_floor_votes | 1313 | billId, query, state, chamber, limit | literal |
| get_state_legislator | 1320 | query*, state, limit | literal |
| get_committee_roster | 1328 | committee*, jurisdiction*, state, chamber | literal |
| get_representation | 1337 | clientId*, state | literal |
| list_members | 1344 | state, chamber, limit | literal |
| get_state_rule_status | 1349 | query*, state | literal |
| search_intel_articles | 1358 | query, source, limit | literal |
| search_committee_hearings | 1363 | recordsView, recordId, asOf, query, hearingId, clientId, chamber, committeeName, cursor, limit | literal |
| search_legiwatch_news | 674 | clientId, folderId, jurisdiction, sessionKey, view*, kind, id, q, monitorId, days, offset, publisher | literal |
| get_florida_budget_project | 688 | clientId, folderId, jurisdiction, sessionKey, fiscalYear*, projectId, offset | literal |
| search_legislative_research | 760 | clientId, folderId, jurisdiction*, sessionKey*, query, cursor, kind, referenceId, versionPolicy | literal |
| get_legal_reference | 771 | clientId, folderId, jurisdiction*, sessionKey, view*, citation, edition, referenceId, billId, ruleNumber, noticeId | literal |
| search_crs_reports | 1389 | query, limit | literal |
| query_economic_data | 1393 | source, state, district, limit | literal |
| get_district_nexus_context | 1399 | clientId, state, district | literal |
| get_district_nexus_changes | 1404 | clientId, state, district, since | literal |
| search_public_web | 1410 | query*, limit | literal |
| scrape_web_page | 1417 | url* | literal |
| save_chat_attachments | 1470 | clientId*, conversationId*, attachmentIds* | literal |
| list_upcoming_meetings | 1536 | clientId, limit, withinDays | literal |
| save_memory | 1550 | content*, key, scope, ttlDays, clientId | literal |
| search_program_elements | 1570 | query, service, budgetActivity, hasData, limit, page | literal |
| get_program_element | 1581 | peCode* | literal |
| get_pe_budget_timeline | 1589 | peCode* | literal |
| get_pe_contractors | 1601 | peCode* | literal |
| get_pe_bills | 1602 | peCode* | literal |
| get_pe_report_language | 1603 | peCode* | literal |
| search_acquisition_personnel | 1606 | query, service, organization, role, peCode, limit, page | literal |
| get_acquisition_person | 1615 | id* | literal |
| create_word | 1622 | title*, format, text, subtitle, sections*, clientId, conversationId | literal |
| create_excel | 1663 | title*, sheets*, clientId, conversationId | literal |
| create_powerpoint | 1680 | title*, subtitle, slides*, clientId, conversationId | literal |
| schedule_task | 1701 | name*, prompt*, intervalMinutes*, dailyAtUtc, localTime, timeZone, weekday, clientId, emailBriefing, deliverEmailTo, toolAllowList | literal |
| list_scheduled_tasks | 1738 | empty advertised properties | literal |
| cancel_scheduled_task | 1739 | taskId* | literal |
| update_scheduled_task | 1740 | taskId*, action* | literal |
| query_tasks | 1751 | clientId, taskId, assignedToMe, status, dueBefore, limit, cursor | literal |
| query_action_items | 1760 | clientId, actionItemId, status, sort, limit, cursor | literal |
| search_tracked_bills | 1770 | clientId* | literal |
| query_regulatory_dockets | 1771 | agencyId, documentType, upcomingOnly, days, limit | literal |
| search_sam_opportunities | 1781 | query, naics, includeInactive, limit | literal |
| query_debriefs | 1790 | clientId*, debriefId, from, to, cursor, limit, characterOffset, characterLimit | literal |
| read_client_meetings | 1815 | clientId*, meetingId, sourceKind, sourceId, from, to, cursor, limit, characterOffset, characterLimit | literal |
| query_outreach | 1870 | outreachId, clientId, status, limit | literal |
| read_client_documents | 1846 | clientId*, documentId, query, section, characterOffset, cursor, limit | literal |
| lookup_client_registry | 1876 | name* | literal |
| create_task | 1902 | title*, clientId, dueDate, description | literal |
| update_task | 1911 | taskId*, status, dueDate, title | literal |
| find_contacts | 1616 | clientId, domain, query, limit | literal |
| search_funding_opportunities | 2038 | clientId*, source, query, page, pageSize, activeState | literal |
| get_funding_opportunity_requirements | 2049 | clientId*, source*, sourceRecordId*, offset, limit | literal |
| get_funding_opportunity | 2059 | clientId*, source*, sourceRecordId*, summaryOffset, summaryLimit | literal |
| get_opportunity_client_context | 2079 | clientId* | literal |
| get_opportunity_government_landscape | 2080 | clientId*, source*, sourceRecordId* | literal |
| search_federal_contract_awards | — | unavailable; separate frozen adapter | missing |
| search_federal_subawards | — | unavailable; separate frozen adapter | missing |
| search_contract_vehicles | — | unavailable; separate frozen adapter | missing |
| search_procurement_forecasts | — | unavailable; separate frozen adapter | missing |
| get_business_development_context | 2121 | conversationId | literal |
| get_business_development_evidence | 2124 | conversationId | literal |
| get_business_development_recent_changes | 2127 | conversationId, limit | literal |
| get_district_federal_market | — | unavailable; separate frozen adapter | missing |
