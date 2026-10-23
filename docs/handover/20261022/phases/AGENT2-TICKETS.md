# Agent 2: PR197 reception and the read slices (verbatim from the Meri master closeout plan)

> **HISTORICAL (2026-10-23).** Wave 1 brief. Where it names the proxy, owner, budget or authority layers, those are superseded: see `../source-of-truth/SUPERSEDED-BY-ITEM-0.md`. Do not send it again.

#### MX-02 · Receive existing source once, preserving current continuity and ownership
**Priority / type:** P0 before enabling affected receiver capabilities; source integration, not merge authorization.

**Evidence and root cause:** Initial compare showed PR197 precursorcf634d4f diverged +29/-10 and conflicted. Final17:50check shows successoref3fbbd9 includes current main (+33/-0) and is mergeable; that reconciliation is no longer missing work. Main vs P2 PR196 remains +2/-10, with overlapping currentness/placement changes. PR194 head already equals main. Full PR file lists were read across pagination, not inferred from a 300-file compare truncation. Candidate11 changed 37 files after `3c56c3e9`. PR197 intersects that delta at `apps/control/action-host/session/owner.mjs`. PR196 intersects four paths: `apps/proxy/product/owner-native-currentness.mjs`, its test, `product-owner-placement.mjs`, its test.

**Bounded work:** Existing Meri receiving owner has now incorporated candidate11 into PR197. Independently review its preserved session rejection diagnostics/authority-unavailability and credential-relay semantics, then rerun both positive and negative session suites on the exact successor; do not repeat the already-completed merge. Review the successor's two per-pass handler-measurement changes and proxy/Temporal image-start hardening separately from precursor receipts. Keep broader shared files (CLI/product ports/contracts) single-owned even where Git reports no text conflict. Existing P2 owner reconciles the four currentness paths without weakening version/identity checks. FE115 is already merged into frontendmain24316f91 with exact source parity to7fda299e; qualify its held consumers, do not receive it again. Core104 remains with its owner and user final merge decision. Retain generated B1/B2 provenance and public package versions; no unrelated regeneration to hide drift. Classify #189/#190/#191/#192 as donor lineage where receiver accounts for their source, not four additional merge projects.

**Dependencies:** MR P1/P2/continuity owners, MF exact contract consumer, MT/MM source tests; source reception must precede new image pinning.

**Acceptance:** A single combined candidate lists resolved files, exact base/head/tree and tests. Both main's later continuity cases and receiver's new Memory/artifact/read cases pass or have explicit unresolved blockers. No duplicate branch receipt, no lost guard, no historical source resurrection. User still owns final merges; this plan changes none.

---

#### MT-02 · Receive the bounded selected-read composition already supplied by PR197 (P1, source integration)

**Root cause / current state.** Main selected retained composition excludes Research Portfolio/detail changes/evidence, Florida and Monday and refuses query_tasks. #197 provides those existing composition seams and five missing family-discovery rows. This is not a request to rebuild current Core readers or enable every catalog entry.

**Bounded change and owner.** Reconcile the pinned #197 changes into apps/runtime/native-authority/retained-reads/{selected-task-ports,research-florida-task-ports,operational-task-ports,mail-monday-task-ports}.mjs, apps/runtime/cli.mjs, apps/worker/conversation/reads/families.mjs and the fixed source adapters. Preserve exact family IDs/operationRefs, signed vs attended credential routes, task-budget binding and source revisions. Retain reviewed Monday response semantics rather than expecting a nonexistent mapping receipt. Receive only measured/qualified families; leave mail and MT-04–08 separate.

**Dependencies.** MT-01; authoritative current Core/Intel identity and retained-read issuers; PF-24 for Planner/Outreach cohort; MM output ownership. #197 is supplemental source, not current-main availability.

**Acceptance / tests.** Exercise actual selected startup, not direct constructors only. Exact query_tasks version/body/page, RP detail and changes, all evidence review lanes and snapshot ID, Florida authority→Intel source and Monday mapping/current-client checks. Fail malformed endpoints, missing service credentials, mismatched source recipient, unavailable authority, stale or changed mapping and partial page. Assert main-to-received discovery delta is exactly the intended five reads and that the selected subset never widens itself.

**Pinned evidence.** [apps/runtime/native-authority/retained-reads/selected-task-ports.mjs:13-29](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/runtime/native-authority/retained-reads/selected-task-ports.mjs#L13-L29), [apps/runtime/native-authority/retained-reads/selected-task-ports.mjs:15-68](https://github.com/neo-capiro/meri-greenfield/blob/cf634d4f70376c12ee6dd7b97ec22981dbd4cb2a/apps/runtime/native-authority/retained-reads/selected-task-ports.mjs#L15-L68), [apps/runtime/cli.mjs:92-106](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/runtime/cli.mjs#L92-L106), [apps/gateway/sources/research-portfolio-evidence/http-adapter.mjs:23-57](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/gateway/sources/research-portfolio-evidence/http-adapter.mjs#L23-L57).

---

#### MT-04 · Admit research-source candidates without broadening source visibility (P1)

**Root cause / current state.** #197 supplies the signed-only search_research_sources adapter and discovery, but current Core read-delegation admission omits it. Its six branches have materially different ownership; a client-selected query is not automatic permission to expose tenant-wide directory notes.

**Bounded change and owner.** Reconcile apps/gateway/sources/research-legal-candidates/{handler,request-context,http-adapter}.mjs and family registration. Extend Core auth/read-delegation contract/service and current Meri native-read receiver only after documenting exact per-branch authorization and client/actor source context. Reuse MeriToolsService.searchResearchSources and canonical directory/Engagement/memory readers, adding bounded filtering where required rather than rebuilding search or returning unfiltered notes. Pin independent branch limits and output provenance.

**Dependencies.** MT-01/02; Core canonical directory permissions; ML-22 for mail candidate source meaning; MM source lineage. Existing PF-09 canonical client ID and client document authority apply.

**Acceptance / tests.** Selected client vs another client, own vs other-user meeting/mail/Meri note, authorized vs unauthorized directory note, tenant boundary, stale source access, query lengths and every branch cap. Test each branch empty/unavailable/partial independently, combined-source incompleteness, no silent tenant-wide fallback, exact source IDs and refusal on undelegated calls. Core104 cleanup must not be mistaken for delegation enablement.

**Pinned evidence.** [apps/gateway/sources/research-legal-candidates/handler.mjs:23-31](https://github.com/neo-capiro/meri-greenfield/blob/cf634d4f70376c12ee6dd7b97ec22981dbd4cb2a/apps/gateway/sources/research-legal-candidates/handler.mjs#L23-L31), [apps/api/src/auth/read-delegation/read-delegation.contract.ts:47-76](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/auth/read-delegation/read-delegation.contract.ts#L47-L76), [apps/api/src/meri/meri-tools.service.ts:6929-7065](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/meri/meri-tools.service.ts#L6929-L7065).

---

#### MT-05 · Bind BD evidence to real conversation and prospect custody (P1)

**Root cause / current state.** Main supports BD context/recent changes but not evidence discovery; #197 adds a signed-only evidence handler. Current Core delegation still excludes evidence, and a greenfield conversation ID cannot be silently treated as a Core native conversation with persisted prospect/client custody.

**Bounded change and owner.** Use the #197 apps/gateway/sources/business-development handler and existing request-context boundary. Bind the existing native conversation/prospect association owner through control selection/claims and Core read-delegation service, preserving owned/unarchived conversation, authorized prospect and linked-client equality. Add only reviewed evidence read admission. Do not create prospects, attach clients, mutate conversation associations or trigger research enrichment as a side effect of evidence lookup.

**Dependencies.** MT-01/02; PF-17 unsupported prospect mutations; native conversation identity/custody owner and MM evidence-lineage semantics.

**Acceptance / tests.** Wrong native conversation, unrelated prospect, linked client mismatch, archived/deleted conversation, changed mapping between awaits, missing source revision, unscoped claim, evidence not ready and source refusal vs valid empty. Confirm signed-only transport, zero calls under failed custody and no write/provider enrichment. Explain unavailable evidence rather than producing unsupported prospect facts.

**Pinned evidence.** [apps/gateway/sources/business-development/handler.mjs:16-26](https://github.com/neo-capiro/meri-greenfield/blob/cf634d4f70376c12ee6dd7b97ec22981dbd4cb2a/apps/gateway/sources/business-development/handler.mjs#L16-L26), [apps/api/src/auth/read-delegation/read-delegation.service.ts:383-432](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/auth/read-delegation/read-delegation.service.ts#L383-L432), [apps/api/src/auth/read-delegation/read-delegation.contract.ts:47-76](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/auth/read-delegation/read-delegation.contract.ts#L47-L76).

---

#### MT-09 · Keep legal, news and Outreach claims inside reviewed slices (P1 parity; P2 expansion decision)

**Root cause / current state.** #197 discovers three adapters that intentionally implement narrower semantics than all historical Core inputs: parser-independent/exact legal references, explicit-source or explicit-year personnel news, and explicit-client campaign lists. Core104 improves Outreach current-client validation but does not expand these Meri adapters.

**Bounded change and owner.** Receive reviewed discovery through MT-02. In existing request-context modules, tool descriptions, selected manifest requirements and result status, make unsupported branches explicit. Only if a launch promise requires citation parsing, implicit-year/window news or outreach detail, add one narrowly versioned producer/context slice and its qualification, not an arbitrary legacy passthrough. Reconcile current Core104 owner corrections without undoing conservative Meri restrictions.

**Dependencies.** PF-24 canonical Outreach runtime cohort; current Core104 adoption decision; legal/news source owner, MT-01/02. No legal advice/product promise inferred from a source-read tool.

**Acceptance / tests.** Every admitted enum and exact ID, legal edition/reference mismatch, ambiguous citation, news folder without client, missing year, partial source cutoff, Outreach explicit client plus any outreachId field including empty. Assert unsupported semantics are UNAVAILABLE before source, not empty result. Test changed client visibility before/after canonical Outreach source.

**Pinned evidence.** [apps/gateway/sources/research-legal-legislation/request-context.mjs:45-55](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/gateway/sources/research-legal-legislation/request-context.mjs#L45-L55), [apps/gateway/sources/research-legal-news/request-context.mjs:15-34](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/gateway/sources/research-legal-news/request-context.mjs#L15-L34), [apps/gateway/sources/outreach-query/request-context.mjs:6-19](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/gateway/sources/outreach-query/request-context.mjs#L6-L19), [apps/api/src/meri/meri-tools.service.ts:8636-8661](https://github.com/neo-capiro/capiro-backend/blob/5bf901173e839c0145069ec42e16dcb40c373ba6/apps/api/src/meri/meri-tools.service.ts#L8636-L8661).

---

#### MT-16 · Close parameter, page, time and result-semantic parity (P1 cross-family regression receipt)

**Root cause / current state.** Typed input/output contracts exist for all97 descriptors, but shape-valid results alone cannot prove preserved defaults, source completeness, current authority or honest evidence release. Each family must retain its own original producer semantics and the narrowed admitted slice.

**Bounded change and owner.** Generate parameter/result tests from catalog-validation bindings and extend each existing apps/gateway/families and sources family test owner. Compare omitted vs explicit/default inputs, exact body/query projection, enum/numeric/date clamps, per-source limits and result semantic validators against current Core native routes. Add only localized corrections for demonstrated mismatches; do not centralize away family-specific provenance. Keep tools-operation-ledger.json as an audit sidecar, not a runtime registry.

**Dependencies.** MT-01 and each source integration ticket; Core current default branch plus explicitly reconciled104 corrections; MM citation/retained-output semantics; ML-18 source pagination.

**Acceptance / tests.** Per operation: required/optional/null/unknown field, min/max and overlimit, nested union, wrong schema version, empty vs unavailable vs partial, limit/default/page/cursor/continuation, time zone and inclusive/exclusive cutoff, fiscal/calendar/session/Congress, source freshness, stale client scope and release rights, redirect/body/content/JSON limits and abort. For all output definitions test wrong tool marker, provenance, source IDs/count/coverage mismatches and output overflow. Test source error remains typed and never becomes a success/absence claim. Publish passed/failed/not-run per exact operation and pinned image; this audit itself runs none of those tests.

**Pinned evidence.** [packages/contracts/retrieval-0.2/catalog-validation.mjs:1](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/packages/contracts/retrieval-0.2/catalog-validation.mjs#L1), [packages/contracts/retrieval-0.2/operation-contracts.mjs:1-8](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/packages/contracts/retrieval-0.2/operation-contracts.mjs#L1-L8), [apps/gateway/dispatch/tool-dispatch.mjs:20-132](https://github.com/neo-capiro/meri-greenfield/blob/bce707763f2cbabe1a73a99aee7b7ec206fa6996/apps/gateway/dispatch/tool-dispatch.mjs#L20-L132), [apps/api/src/meri/meri.controller.ts:551-745](https://github.com/neo-capiro/capiro-backend/blob/309af848f1aa403f6c8e54aa0d22990d4230f063/apps/api/src/meri/meri.controller.ts#L551-L745).

### 7. Execution order, completeness and limits

1. Freeze exact supported cohort and measured truth (MT-01/15), preserving intentionally held capabilities.
2. Reconcile already-written #197 adapters/composition (MT-02), then ML-22 mail scope/context (MT-03), research/BD admission (MT-04/05), existing-observation adapters (MT-06/07/08), and reviewed slices (MT-09). These can proceed in bounded parallel, but each remains unavailable until its own receipt.
3. Qualify existing task creation (MT-10); build only missing task-update and conversational routine bridges (MT-11/12). MM owns artifact/memory/filing effects and MF owns UI decision recovery.
4. Admit only fully supported selected skills (MT-13), retain execution boundaries (MT-14), and complete the operation-level parameter/output/currentness matrix (MT-16). Runtime owner supplies exact-image/production activation gates separately.

**Inventory closure:**97 descriptor rows (86 reads +11 non-reads),14 named skills /15 versioned asset rows,43 deliberate exclusions,8 distinct preparation-tool names grouped across11 non-read operations, foreground Agent/workspace/Bash and14 held browser names. The machine-readable sidecar tools-operation-ledger.json preserves full inputSchema/outputSchema references and sourceRequirements for all97 rows. The compact table cannot replace full nested schemas and semantic validators.

**What is not established:** No main/supplement was merged or changed, no tests were executed, no live deployment/configuration or real user/provider path was inspected, no provider/mail/external action was called, and no live source availability is asserted. Current source is sufficient to plan bounded changes and distinguish missing code from missing composition/qualification, but not to declare production readiness.

**Important stale-evidence corrections:** current Core already produces certification/rule/SAM observations; current runtime CLI already supplies task-create owners and permits sourceEnabled outside schedule-worker; current #197 still does not compose mail. Old comments and handoffs are historical context only when they conflict with these pinned executable sources.

#### Fresh supplemental-head reconciliation

PR197 advanced during this audit to ef3fbbd964ff4ff86cc12026458fce2c88a7d787, merging current main. Earlier cf634d4f70376c12ee6dd7b97ec22981dbd4cb2a citations identify the inspected ancestor source, not the latest PR head. The targeted new tool-source change adds a per-measurement-pass label→SHA cache: general-read installation supplies a fresh Map, and measured handlers skip only files already matched to that exact digest in that same pass. It is not a permanent hash cache, a new qualification owner or proof that81 reads are enabled. Qualify the new bytes separately: fresh pass rereads files, a different expected digest cannot reuse the cached entry, mutation/missing/symlink/oversized source fails on a new pass, and expiration/abort still prevents receipt release. Do not reuse an old measured-source receipt merely because this is an optimization. Source: [measurement L21–27](https://github.com/neo-capiro/meri-greenfield/blob/ef3fbbd964ff4ff86cc12026458fce2c88a7d787/apps/gateway/catalog/measured-handlers.mjs#L21-L27), [general-read pass L34–41](https://github.com/neo-capiro/meri-greenfield/blob/ef3fbbd964ff4ff86cc12026458fce2c88a7d787/apps/gateway/general-reads/installation.mjs#L34-L41). No fresh-head runtime/test receipt is inferred.

### 8. Result-shape and bound index

Top-level result fields and limits are mechanically extracted below. Generic retained-page fields (where present) additionally include exact operation/version, request/trace/run/subject, input hash, source references (typically≤4096), coverage/continuation, evidenceReady:false and negative-assertion restrictions. This is not a normalized success wrapper: native outputs keep their own tool markers and shapes. `typed`/`object` means the referenced schema/union supplies nested rules; it does not mean arbitrary data is accepted. Full outputSchema references and complete top-level summaries are in tools-operation-ledger.json; family semantic validators remain mandatory. No maximum shown means no bound at that specific schema node, not an exemption from response-byte/budget/source limits.

| Operation | Non-envelope result fields / bounds |
|---|---|
| mail.read_thread | selection*: object{subject,threadId,messageId,messageOffset,bodyOffset,limit,maxCharacters}; order*: 'sentAt-asc_receivedAt-asc_createdAt-asc_nulls-and-ties-unspecified'; snapshotVersionId*: string≤256 or null; messages*: array[object]≤10; totalMessages*: integer[0..9007199254740991] or null; hasMoreMessages*: boolean or null; nextMessageOffset*: integer[0..10010] or null; nextBodyOffsets*: array[object]≤10 |
| mail.list_messages | selection*: object; filterSha256*: string:pattern; queryScope*: object{asOfInclusive,effectiveStartInclusive,storedCreatedAtEndInclusive,missingEffectiveDates}; order*: 'effectiveAt-desc-nullslast_messageId-desc'; snapshotVersionId*: null; messages*: array[object]≤50; totalMatches*: integer[0..9007199254740991] or null; hasMore*: boolean or null; nextOffset*: integer[0..10000] or null; threadGroups*: array[object]≤50 or null; returnedThreadGroupCount*: integer[0..50] or null |
| mail.search_messages | selection*: object; filterSha256*: string:pattern; queryScope*: object{asOfInclusive,effectiveStartInclusive,storedCreatedAtEndInclusive,missingEffectiveDates}; order*: 'effectiveAt-desc-nullslast_messageId-desc'; snapshotVersionId*: null; messages*: array[object]≤50; totalMatches*: integer[0..9007199254740991] or null; hasMore*: boolean or null; nextOffset*: integer[0..10000] or null; threadGroups*: array[object]≤50 or null; returnedThreadGroupCount*: integer[0..50] or null |
| meeting.list_upcoming_meetings | selection*: object{clientId,limit,withinDays}; order*: 'startsAt-asc_nulls-and-ties-unspecified'; snapshotVersionId*: null; calendarWindow*: object{from,to,withinDays}; meetings*: array[object]≤25; count*: integer[0..25] |
| meeting.read_client_meetings | object |
| meeting.query_debriefs | selection*: object; order*: 'createdAt-asc_id-asc_cursor-key-owner-unconfirmed'; snapshotVersionId*: null; scope*: object{debriefId,from,to,timeField,statusEligibility,characterOffset,characterLimit,listLimit,cursorApplied}; pageCoverage*: object{sourceStatus,sourceReason,pageComplete,complete,partial,paginationComplete,bodyCoverageComplete,truncated,nextCursor,totalIsReturnedPageOnly,appliesTo,note}; total*: integer[0..25]; returned*: integer[0..25]; debriefs*: array[object]≤25 |
| query_tasks | generatedAt*: string:date-time; selection*: object{clientId,taskId,ownerUserId,status,openOnly,dueBefore,limit,offset,cursorApplied}; order*: 'owner-order-unconfirmed'; snapshotVersionId*: null; clientId*: string≤80 or null; scope*: object{kind,tenantId,actorUserId,ownerUserId,taskId,status,dueBefore,offset,limit,cursorApplied}; total*: integer[0..9007199254740991]; returned*: integer[0..50]; tasks*: array[object]≤50; pageCoverage*: object{sourceStatus,sourceReason,complete,partial,paginationComplete,hasMore,nextCursor,totalIsExactForScope,absenceSupported,note} |
| search_capiro_data | tool*: 'search_capiro_data'; records*: array[object]; observability*: object{queryClass,requestedDomains,queriedDatasets,requestedEntityCount,queriedEntityCount,pagesByDomain,sourceHealth,freshnessByDomain,coverageComplete,stopReason,reranking,scoring} |
| search_federal_contract_awards | items*: array[object]; total*: number; page*: integer[1..∞]; pageSize*: integer[1..∞]; source*: string; asOf*: string or null; generatedAt*: string; hasMore*: boolean; nextPage*: integer or null; paginationLimitReached*: boolean; tool*: 'search_federal_contract_awards' |
| search_federal_subawards | items*: array[object]; total*: number; page*: integer[1..∞]; pageSize*: integer[1..∞]; source*: string; asOf*: string or null; generatedAt*: string; hasMore*: boolean; nextPage*: integer or null; paginationLimitReached*: boolean; tool*: 'search_federal_subawards' |
| search_contract_vehicles | items*: array[object]; total*: number; page*: integer[1..∞]; pageSize*: integer[1..∞]; source*: string; asOf*: string or null; generatedAt*: string; hasMore*: boolean; nextPage*: integer or null; paginationLimitReached*: boolean; tool*: 'search_contract_vehicles' |
| search_procurement_forecasts | items*: array[object]; total*: number; page*: integer[1..∞]; pageSize*: integer[1..∞]; source*: string; asOf*: string or null; generatedAt*: string; hasMore*: boolean; nextPage*: integer or null; paginationLimitReached*: boolean; tool*: 'search_procurement_forecasts' |
| get_district_federal_market | districts*: array[object]; stateSubawards: array[object]; futureSignals*: array[object]; futureSignalsAvailability: available/unavailable; awardedMoneyIncludesFutureOpportunities*: False; warnings*: array[string]; tool*: 'get_district_federal_market'; generatedAt*: string |
| memory.list_own_proposals | tool*: 'list_memory_proposals'; enabled*: boolean; authority*: 'own_pending_proposals'; claimsAreApprovedFacts*: False; scope*: object{tenantId,userId,clientId}; candidates*: array[object]≤10; nextCursor*: string≤2048 or null |
| query_action_items | generatedAt*: string:date-time; selection*: object{clientId,actionItemId,status,sort,page,limit,cursorApplied}; order*: deadline-asc_nulls-last_priority-desc_id-asc-owner-unconfirmed/priority-desc_deadline-asc_nulls-last_id-asc-owner-unconfirmed; snapshotVersionId*: null; clientId*: string≤80; scope*: object{actionItemId,status,sort,page,limit,cursorApplied}; total*: integer[0..9007199254740991]; returned*: integer[0..50]; actions*: array[object]≤50; pageCoverage*: object{sourceStatus,sourceReason,complete,partial,paginationComplete,hasMore,nextCursor,totalIsExactForScope,absenceSupported,note} |
| lookup_client_registry | existingClient*: object or null; ldaExactMatch*: object or null; ldaCandidates*: array[object]≤5; guidance*: string |
| get_research_portfolio | data*: object{id,name,purpose,mode,lifecycle,revision,ownerUserId,memberCount,clientLinkCount,myRole,archivedAt,createdAt,updatedAt,grants,clientLinks,members,recentEvents} |
| get_research_portfolio_changes | data*: object{items,nextCursor} |
| get_business_development_context | tool*: 'get_business_development_context'; generatedAt*: string:date-time; prospect*: object{id,displayName,ownerUserId,stage,serviceHypothesis,geography,nextAction,canonicalEntityId,linkedClientId}; firmPreferences*: object{practiceServiceAreas,agenciesIssues,geographies}; history*: object{entries,total,returned,truncated} |
| get_business_development_evidence | tool*: 'get_business_development_evidence'; generatedAt*: string:date-time; identityBasis*: exact_uei/exact_name/unresolved_prospect; canonicalEntityId*: string:pattern or null; canonicalName*: string/null; sectionStates*: array[object]≤6; data*: array[object]≤24; evidence*: object{total,returned,truncated} |
| get_business_development_recent_changes | tool*: 'get_business_development_recent_changes'; generatedAt*: string:date-time; prospect*: object{id,name}; alerts*: object{items,returned,unreadCount,truncated,limit,note} |
| search_funding_opportunities | tool*: 'search_funding_opportunities'; state*: available/disabled/denied/not_found/unsupported_source/invalid_request; explanation*: string; asOf*: string:date-time; data*: object or null; truncated: array[object]≤2 |
| get_funding_opportunity_requirements | tool*: 'get_funding_opportunity_requirements'; state*: available/disabled/denied/not_found/unsupported_source/invalid_request; explanation*: string; asOf*: string:date-time; data*: object or null; truncated: array[object]≤2 |
| get_funding_opportunity | tool*: 'get_funding_opportunity'; state*: available/disabled/denied/not_found/unsupported_source/invalid_request; explanation*: string; asOf*: string:date-time; data*: object or null; truncated: array[object]≤2 |
| get_opportunity_client_context | tool*: 'get_opportunity_client_context'; state*: available/disabled/denied/not_found/unsupported_source/invalid_request; explanation*: string; asOf*: string:date-time; data*: object or null; truncated: array[object]≤2 |
| get_opportunity_government_landscape | tool*: 'get_opportunity_government_landscape'; state*: available/disabled/denied/not_found/unsupported_source/invalid_request; explanation*: string; asOf*: string:date-time; data*: object or null; truncated: array[object]≤2 |
| read_client_documents | data*: object |
| query_economic_data | object |
| search_federal_grants | tool*: 'search_federal_grants'; generatedAt*: string:date-time; asOf*: string:date-time; total*: integer[0..9007199254740991]; data*: array[object]≤50 |
| search_federal_awards | tool*: 'search_federal_awards'; generatedAt*: string:date-time; total*: integer[0..9007199254740991]; page*: integer[1..10000]; pageSize*: integer[1..50]; hasMore*: boolean; nextPage*: integer/null; paginationLimitReached*: boolean; data*: array[object]≤50 |
| get_district_nexus_context | data*: object |
| get_district_nexus_changes | data*: object |
| search_state_bills | tool*: 'search_state_bills'; generatedAt*: string:date-time; total*: integer[0..9007199254740991]; data*: array[object]≤50; note: 'No state bill on record matches that. Say so explicitly — do not describe a bill from memory.' |
| get_state_legislator | tool*: 'get_state_legislator'; generatedAt*: string:date-time; matchesFound*: 0/1; matches*: array[object]≤1; ambiguousLegislator: array[object]≤8; note: string |
| search_cbo_cost_estimates | tool*: 'search_cbo_cost_estimates'; generatedAt*: string:date-time; estimatesFound*: integer[0..9007199254740991]; estimates*: array[object]≤25; note: string |
| search_gao_reports | tool*: 'search_gao_reports'; generatedAt*: string:date-time; total*: integer[0..9007199254740991]; data*: array[object]≤50 |
| search_crs_reports | tool*: 'search_crs_reports'; generatedAt*: string:date-time; total*: integer[0..9007199254740991]; data*: array[object]≤50 |
| search_sec_filings | tool*: 'search_sec_filings'; generatedAt*: string:date-time≤64; total*: integer[0..9007199254740991]; data*: array[object]≤50 |
| search_fara_registrations | tool*: 'search_fara_registrations'; generatedAt*: string:date-time≤64; total*: integer[0..9007199254740991]; data*: array[object]≤50 |
| search_lda_filings | tool*: 'search_lda_filings'; generatedAt*: string:date-time≤64; total*: integer[0..9007199254740991]; data*: array[object]≤50; page*: integer[1..100]; limit*: integer[1..50] |
| search_acquisition_personnel | tool*: 'search_acquisition_personnel'; generatedAt*: string:date-time; data*: array[object]≤50; total*: integer[0..9007199254740991]; page*: integer[1..100]; limit*: integer[1..50] |
| get_acquisition_person | tool*: 'get_acquisition_person'; generatedAt*: string:date-time; person*: object{id,fullName,service,organization,title,role,pePrimary,peSecondary,emailDomain,publicProfileUrl,confidence,status,firstSeenAt,lastSeenAt,nameKey,programOfRecord,email,phone,parentOffice,department,metadata,sources} |
| get_bill_status | object |
| search_floor_votes | tool*: 'search_floor_votes'; generatedAt*: string:date-time≤64; votesFound*: integer[0..25]; votes*: array[object]≤25; member: object{bioguideId,fullName}; ambiguousMember: array[object]≤8; note: string≤1048576 |
| search_congress_bills | object |
| read_bill_text | object |
| get_committee_roster | object |
| list_members | object |
| get_pe_contractors | object |
| get_pe_bills | tool*: 'get_pe_bills'; generatedAt*: string:date-time≤64; bills*: array[object]≤100 |
| get_pe_report_language | tool*: 'get_pe_report_language'; generatedAt*: string:date-time≤64; peCode*: string≤32; provisions*: array[object]≤50; note: string≤1048576 |
| get_state_rule_status | object |
| get_certification_status | object |
| search_intel_articles | tool*: 'search_intel_articles'; generatedAt*: string:date-time:pattern; total*: integer[0..9007199254740991]; data*: array[object]≤50 |
| list_global_datasets | tool*: 'list_global_datasets'; generatedAt*: string:date-time:pattern; datasets*: array[object] |
| get_representation | data*: object{tool,generatedAt,facilities,note} |
| get_state_bill_status | object |
| search_state_floor_votes | tool*: 'search_state_floor_votes'; generatedAt*: string:date-time; votesFound*: integer[0..25]; votes*: array[object]≤25; note: string |
| query_regulatory_dockets | tool*: 'query_regulatory_dockets'; generatedAt*: string:date-time:pattern; total*: integer[0..9007199254740991]; results*: array[object]≤50; windowDays: integer[1..365] |
| find_contacts | object |
| resolve_entity | tool*: 'resolve_entity'; generatedAt*: string:date-time; matchesFound*: integer[0..10]; matches*: array[object]≤10; note: string |
| search_tracked_bills | data*: object{tool,generatedAt,clientId,total,bills} |
| query_intelligence | tool*: 'query_intelligence'; generatedAt*: string:date-time:pattern; data*: string |
| search_public_web | object |
| scrape_web_page | object |
| search_sam_opportunities | tool*: 'search_sam_opportunities'; generatedAt*: string:date-time:pattern; total*: integer[0..9007199254740991]; sourceFreshness*: array[object]≤1; sourceStatus*: healthy/unknown/degraded; sourceReason*: None/source_freshness_unavailable/all_federal_source_never_synced/source_freshness_unknown/latest_source_sync_incomplete/source_sync_stale; notes*: ['Results cover Capiro’s synchronized SAM.gov catalog. No matching records does not establish that no current federal opportunity exists.']/['Results cover Capiro’s synchronized SAM.gov catalog. No matching records does not establish that no current federal opportunity exists.', 'Source coverage is incomplete or unknown; inspect sourceFreshness before making current-opportunity or absence claims.']; results*: array[object]≤50 |
| get_florida_budget_project | tool*: 'get_florida_budget_project'; generatedAt*: string:date-time; result*: object{scope,fiscalYear,projects,nextOffset,documents,amounts,events,notice}; authority*: 'Source quotations retain their document identity. Meri relevance is an inference for review; keyword grammar and current folder decisions control assignments.' |
| query_outreach | object |
| search_program_elements | tool*: 'search_program_elements'; generatedAt*: string:date-time:pattern; data*: array[object]≤50; total*: integer[0..∞]; page*: integer[1..100]; limit*: integer[1..50] |
| get_program_element | tool*: 'get_program_element'; generatedAt*: string:date-time:pattern; identifierKind*: pe/procurement_line_item/other; budgetExhibitType*: R-1/R-2 RDT&E Program Element/P-1/P-40 procurement line item (NOT a Program Element)/budget line (exhibit type not classified); currentCycleFy*: integer[-2147483648..2147483647] or null; currentFundingClaim*: object or null; lineage: object{accepted,candidates,note}; programElement*: object{peCode,service,serviceCode,appropriationType,budgetActivity,budgetActivityName,lineNumber,title,description,acatLevel,programOfRecord,status,rDocUrl,pDocUrl,oDocUrl,raw,source,sourceConfidence,firstSeenFy,lastSyncedAt,retiredAt,retiredReason,years,fundingSummary,billCount,projectCount,sourceCount,currentCycleFy,currentUserIsWatching} |
| get_pe_budget_timeline | tool*: 'get_pe_budget_timeline'; generatedAt*: string:date-time:pattern; identifierKind*: pe/procurement_line_item/other; budgetExhibitType*: R-1/R-2 RDT&E Program Element/P-1/P-40 procurement line item (NOT a Program Element)/budget line (exhibit type not classified); currentCycleFy*: integer[-2147483648..2147483647] or null; currentFundingClaim*: object or null; lineage: object{accepted,candidates,note}; peCode*: string; title*: string; service*: string or null; appropriationType*: string or null; budgetActivity*: string or null; lineNumber*: string or null; fundingSummary*: string; years*: array[object]; milestones*: array[object] |
| search_client_knowledge | object |
| query_knowledge_graph | object |
| read_monday_client_boards | tool*: 'read_monday_client_boards'; authoritativeOwner*: 'managed_monday_mcp'; currentStatus*: healthy/degraded/unavailable/unauthorized/unsupported/error; clientId*: string; records*: array[typed]≤3000 |
| read_chat_attachments | object |
| search_memory | object |
| get_client_context | tool*: 'get_client_context'; generatedAt*: string:date-time; readWindow*: object{startedAt,completedAt}; profileSections*: object{capabilities,people,facilities,submissionHistory,advocacyMatters,advocacyRecords}; coverageNote*: string; profile*: object{capabilities,people,facilities,submissionHistory,advocacyMatters,advocacyRecords}; profileSources*: object{capabilities,people,facilities,submissionHistory,advocacyMatters,advocacyRecords}; context*: object{client,recentActivity,keyStakeholders,openThreads,openTasks,summary} |
| search_research_sources | tool*: 'search_research_sources'; query*: string≤240; generatedAt*: string:date-time:pattern; results*: array[object]≤75 |
| query_global_data | object |
| search_legislative_research | tool*: 'search_legislative_research'; generatedAt*: string:date-time; result*: object{scope,items,interpretedQuery,versionPolicy,searchedKinds,scanned,cursor,coverage,message}; authority*: 'Source quotations retain their document identity. Meri relevance is an inference for review; keyword grammar and current folder decisions control assignments.' |
| get_legal_reference | tool*: 'get_legal_reference'; generatedAt*: string:date-time; result*: object; authority*: 'Source quotations retain their document identity. Meri relevance is an inference for review; keyword grammar and current folder decisions control assignments.' |
| actions.query | object |
| search_legiwatch_news | tool*: 'search_legiwatch_news'; generatedAt*: string:date-time; result*: object; authority*: 'Source quotations retain their document identity. Meri relevance is an inference for review; keyword grammar and current folder decisions control assignments.' |
| search_committee_hearings | tool*: 'search_committee_hearings'; note*: 'One complete evidence chunk per page. Follow the hearings nextCursor for remaining official transcript chunks, machine segments and intelligence. Coverage reports unsupported browser-session material; search results never imply a complete transcript.'; records*: array[object]≤1; observability*: object{queryClass,requestedDomains,queriedDatasets,requestedEntityCount,queriedEntityCount,pagesByDomain,sourceHealth,freshnessByDomain,coverageComplete,stopReason,reranking,scoring} |
| get_research_evidence | data*: object |
| create_word | version*: typed; inspection*: object; execution*: object{requestSha256,authorizationReceiptId,budgetTicketId,objectCommitted,versionCommitted,nativeQualified} |
| create_excel | version*: typed; inspection*: object; execution*: object{requestSha256,authorizationReceiptId,budgetTicketId,objectCommitted,versionCommitted,nativeQualified} |
| create_powerpoint | version*: typed; inspection*: object; execution*: object{requestSha256,authorizationReceiptId,budgetTicketId,objectCommitted,versionCommitted,nativeQualified} |
| run_analysis | object |
| create_task | object |
| update_task | object |
| save_memory | object |
| save_chat_attachments | object |
| schedule_task | ScheduleMutationOutput |
| list_scheduled_tasks | ListScheduledTasksOutput |
| cancel_scheduled_task | ScheduleMutationOutput |
| update_scheduled_task | ScheduleMutationOutput |

#### Additional mandatory MT-13/MM-15 acceptance from the original plan

Commitments & Deliverables keeps commitments_audit, requiresClient:true, readOnly:true and general/client scopes; even a general launch requires a selected client. Audit authorized mail/meetings/transcripts/debriefs/tasks/actions/documents/Monday with real continuation and older promises. Deduplicate promises versus decisions/questions/proposals, retain linked record IDs, evidenced owner/due date or unknown, dependencies and acceptance evidence. Exactly completed, in progress, or no record of action are audit statuses; native task status is separate. Completion needs delivery/acceptance evidence. Monday coverage is exactly checked, disconnected, unavailable, or not mapped, with partial pages explicit. No unread page proves absence. Audit performs zero task/message/memory mutations; a later requested action uses its own immutable approved operation and observed receipt. Preserve CD-01–CD-07 semantics through focused fixtures, not seven automatic paid runs. All14 launchers retain exact client/scope metadata from Remaining Plan L172–195 and every selected procedure/version is traced.


---

<a id="memory-artifacts"></a>
