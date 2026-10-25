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

# M3 data source reconciliation — 2026-10-25

This is a source reconciliation and bounded change record, not full M3 acceptance. The dispatch selected Meri `51b059063629cf7b7a1370ae54ae9a82624a3bff` and Core `025ae90fc7bf85c91a5f60eaf949cc7effa1d330`. Both Wave 2 bases remain drafts. Final contract adoption, integration and live acceptance remain with Root after Wave 2 completion.

Core implementation is on `codex/wave3-m3-core-data-20261025` at `3003755f379421bce5782e9965b6ef52080fe005`. This Meri slice updates registration verification and removes superseded measurement tests; it adds no adapter, authority or provider behavior. Existing typed contracts remain unchanged.

## Assigned-ticket disposition

| Ticket | Current canonical owner and bounded result | Acceptance still open |
| --- | --- | --- |
| MT-01 | Existing general-read constructors and typed Core routes already provide 84 operations across 48 families. Exact registration is now exercised without source calls. | Authenticated full-family acceptance after final release pins. |
| MT-04 | Existing research candidates route calls Core. Core `searchResearchSources` lacked client-wall filtering despite source ownership predicates. The companion Core slice uses canonical `fetchDeniedClientIds` before each client-linked branch and again before releasing candidates. Directory retains its existing tenant-note policy. | Real authenticated multi-tenant and current-access acceptance. No parallel gateway policy added. |
| MT-05 | Existing business-development context/evidence/recent-changes handlers retain Core's real conversation/prospect custody owner. No replacement adapter created. | Exhaustive conversation/custody acceptance was not performed by this slice. |
| MT-06 / MT-07 / MT-08 | Certification, state-rule and SAM producer adapters already exist. Tests preserve client/General composition, refusal/revocation and exact producer contexts, including SAM's three clocks and off/shadow/enforce modes. | Source freshness and provider qualification on deployed exact pins; no new calculation owner. |
| MT-09 | Existing legal/legislation, news and Outreach read families remain canonical and bounded to their typed contracts. | Exhaustive ticket-specific source/consumer acceptance was not performed by this slice; no P2 expansion claimed. |
| MT-16 | Core meeting reads used returned rows to derive continuation; an entirely omitted source page had no cursor despite more source rows. Companion Core fix carries bounded omitted-prefix continuation without returning omitted identities/timestamps; existing current-access and settling remain. | Native database and deployed data/permission races; UI citation navigation and full evidence-result acceptance belong to later integration. |
| MO-14 | Canonical source-change observations and specialized knowledge jobs exist. This trace does not establish a complete source-revision-to-derived-artifact invalidation chain. | Revision dependency/refresh orchestration remains open; no second event pipeline created. |
| MO-15 | Named connector inventory below distinguishes actual owners from catalog/mock-only entries. No provider credential or external effect was used. | Each unqualified source needs its provider owner and scoped acceptance; absence is not supersession. |
| MG-06 | Reproduced `setImmediate` attachment indexing at Core025. Existing guards protect source snapshots, readiness and private exclusion, but no durable client-KB intent/runner was found. | Schema/revision seam proposed to A-domain and Root; schema allocation and focused durable executor decision pending. No new queue/framework implemented. |
| MX-03 | Existing enabled-family construction, canonical operation sets and runtime read controls retained. | Full dependency/capability activation review and deployed configuration belong to Root after Wave 2. |

## Exact installed inventory

Derived from `apps/gateway/general-reads/integration.mjs` and `familyOperations()` at the selected Meri source. This is a static review record, not a second executable registry. Registration checks 48 distinct families and 84 distinct operation/version keys, with no source/credential call during construction.

| Family | Operations |
| --- | --- |
| meeting-source | meeting.list_upcoming_meetings, meeting.read_client_meetings, meeting.query_debriefs |
| action-items-complete | actions.query |
| operational-reads | query_tasks, query_action_items |
| tenant-contacts | find_contacts |
| entity-candidates | resolve_entity |
| client-knowledge-profile | get_client_context |
| client-documents | read_client_documents |
| client-knowledge-memory | search_memory |
| client-knowledge-monday | read_monday_client_boards |
| dataset-metadata | list_global_datasets |
| memory-proposals | memory.list_own_proposals |
| research-portfolio-evidence | get_research_evidence |
| research-portfolio | get_research_portfolio, get_research_portfolio_changes |
| florida-budget | get_florida_budget_project |
| bill-text | search_congress_bills, read_bill_text |
| public-reports | search_cbo_cost_estimates, search_gao_reports, search_crs_reports |
| acquisition-personnel | search_acquisition_personnel, get_acquisition_person |
| disclosures | search_sec_filings, search_fara_registrations, search_lda_filings |
| legislative-directory | get_committee_roster, list_members |
| pe-references | get_pe_contractors, get_pe_bills, get_pe_report_language |
| federal-legislation | get_bill_status, search_floor_votes |
| state-legislation | search_state_bills, get_state_legislator |
| stored-intelligence | search_intel_articles |
| regulatory-dockets | query_regulatory_dockets |
| intelligence-summary | query_intelligence |
| public-web | search_public_web, scrape_web_page |
| data-search | search_capiro_data |
| public-domain-query | query_global_data |
| facility-representation | get_representation |
| district-nexus | get_district_nexus_context, get_district_nexus_changes |
| client-registry | lookup_client_registry |
| federal-market | search_federal_contract_awards, search_federal_subawards, search_contract_vehicles, search_procurement_forecasts, get_district_federal_market |
| public-data | query_economic_data, search_federal_grants, search_federal_awards |
| client-knowledge-search | search_client_knowledge, query_knowledge_graph |
| state-status-votes | get_state_bill_status, search_state_floor_votes |
| tracked-bills | search_tracked_bills |
| public-domain-hearings | search_committee_hearings |
| research-legal-legislation | search_legislative_research, get_legal_reference |
| research-legal-news | search_legiwatch_news |
| outreach-query | query_outreach |
| business-development | get_business_development_context, get_business_development_evidence, get_business_development_recent_changes |
| funding-opportunities | search_funding_opportunities, get_funding_opportunity_requirements, get_funding_opportunity, get_opportunity_client_context, get_opportunity_government_landscape |
| mail | mail.read_thread, mail.list_messages, mail.search_messages |
| program-elements | search_program_elements, get_program_element, get_pe_budget_timeline |
| research-legal-candidates | search_research_sources |
| certification-status | get_certification_status |
| rule-status | get_state_rule_status |
| sam-opportunities | search_sam_opportunities |

## Connector truth at Core025

Connection/capability truth remains in `meri-managed-mcp.helpers.ts`, `meri-managed-mcp.service.ts`, `meri-mcp-oauth.service.ts`, `meri-mcp.catalog.ts`, and the existing engagement/retrieval/external owners. This table records source evidence only; it does not assert a connected tenant or successful provider qualification.

| Named source | Canonical source owner / scope | Current evidence and remaining qualification |
| --- | --- | --- |
| Outlook mail/calendar | `engagement/microsoft/` sync, token/OAuth owners; canonical mail/meeting readers | Stored metadata/content and source continuation remain separate from sender/calendar mutation owners. Authenticated paging, disconnect/reconnect and revocation not run here. |
| Google mail/calendar | `engagement/google/` sync/token and Gmail-send owners | Existing source sync and read paths; send authority is separate. Provider acceptance not run. |
| Google Drive | Managed MCP helper/service and OAuth owner | Explicit managed app; `drive.readonly`, current configuration/availability gates, canonical OAuth lifecycle. Provider content/paging/reconnect acceptance open. |
| Monday | Managed MCP owner, `retrieval/adapters/monday-managed-mcp.adapter.ts`, board scope and saved mappings; Meri Monday source | Existing read allowlist excludes upload/arbitrary API writes. Actual synthetic composition passes. Live paging/reconnect acceptance open. |
| HubSpot | Managed MCP owner and OAuth owner | Explicit managed read-only tool allowlist. CRM connector mock is not qualification. Live provider acceptance open. |
| Airtable | Managed MCP owner and OAuth owner | Explicit managed read-only allowlist. Live pagination/content/revocation acceptance open. |
| Approved connected MCP | Managed helper/service, OAuth and catalog | Current finite managed IDs: HubSpot, Airtable, Monday, Google Drive, Krisp. Current tenant/actor status and narrowed tools apply; arbitrary installed MCP is not trusted. |
| Public web | Meri `sources/public-web/` finite read operations | Search/scrape reads have their existing bounded result contract. This does not authorize authenticated browser actions. |
| Slack | Catalog entry; `meri/connectors/chat.connector.ts` interface/mock | No qualified finite managed Slack content adapter proven. OPEN; catalog presence is insufficient. |
| Teams | Chat connector interface/mock; Microsoft meeting source is separate | No qualified Teams chat-content adapter proven. OPEN; calendar support does not qualify chat. |
| Zoom | No active managed entry established in bounded inventory | OPEN provider-owner discovery/qualification. Not removed from scope. |
| Tango | `external/tango/` typed client/store/capability probes and `webhooks/tango-webhook.service.ts` | Canonical public-data/provider ingestion and event paths exist. No provider invocation or webhook write performed. Current capability/paging acceptance remains provider-owned. |

Managed connection states include connected, disconnected, pending, needs_reauth and error. OAuth credentials stay with Core's canonical owner; this inventory contains no tokens. Existing source results/citations remain the evidence carriers. No read credential implies write authority. Formats, exact paging and receipts for unqualified providers remain explicitly unverified.

## Bounded pagination contract for independent review

Three production files change in Core: `meri/meri-meeting-read.helpers.ts`, `meri/meri-tools.service.ts`, and only `EngagementService.listMeetings` in `engagement/engagement.service.ts`. Tests use the existing matching helper, firmdata and `portfolio-a1.safety.spec.ts` owners.

The cursor keeps only a previously readable keyset anchor, a count of omitted rows after it, and a digest of the omitted boundary key. A fully omitted first page has no readable anchor. Repeated empty pages accumulate the count, capped at 1000. Source keys are re-read through the current canonical membership/client/wall/ownership/association/order predicates before continuing; full rows then use a keyset boundary, never a database offset. Inaccessible source rows remain omitted and coverage remains incomplete.

Stale continuation throws 400 BadRequest 'Meeting page changed; restart the read'; caller must restart without cursor (existing source error propagation, no invented auto-retry). Max prefix read 1000 key pairs, then limit+1 <=26 full rows. Hash checks last counted boundary, not snapshot isolation: count shift normally refuses; keyset avoids extra row skipping if preceding deletion occurs after check. Reordering/new authorization before the boundary follows existing non-snapshot keyset semantics and requires restart for a fresh full inventory; no claim hash eliminates all concurrent mutation.

The helper rejects counts outside 1..1000 and malformed digests. Too many omitted rows requires narrowing the time window and restarting. It retains existing scope binding and ordinary cursor compatibility. No cursor store, encryption framework, schema, provider or runtime protocol owner was added.

## Checks and deletion proof

Native Node 24.22.1; Core Jest 29.7.0 / ts-jest 29.4.14 / TypeScript 5.9.3. Tests used isolated worktree caches and confirmed read-only Windows dependency donors. No install, migration, database access or shared environment repair was performed. Results collected 2026-10-25 UTC.

| Check | Result |
| --- | --- |
| Meri families + registration + secondary observation before edits | 39 pass / 5 fail, 44 tests. Three obsolete measurement tests, stale 45-family assertion and obsolete memory fixture configuration account for failures. |
| Same retained suite after edits (deleted measurement file excluded) | 41 pass / 0 fail, 41 tests, exit 0. Three deleted tests are accounted for, not masked. |
| Runtime secondary + General/client + retained + AgentCore read composition and config | 61 pass / 3 fail of 64; all three config failures are module-load failures for `ai` from `packages/ui-stream/dist/producer.js`, after confirmed runtime/conversation/window dependency donors. No product failure inferred from import failures. |
| Core affected three files, unchanged025 | 87 pass / 1 fail of 88, exit 1. Existing tracked-bills visible-client fixture fails `Client not found`. |
| Core affected three files, changed slice | 95 pass / same 1 fail of 96, exit 1. Existing failure preserved. |
| All eight new Core tests restored after mutations | 8 pass; 88 deliberately excluded by test-name selection; exit 0. |
| Mutations | Six Core and two Meri mutants killed; restored tests pass. |
| Diff whitespace | `git diff --check` passes in both repositories. |

Core mutations: suppress empty-page cursor; remove boundary-digest check (same-length changed prefix wrongly resolves); remove keyset continuation (later authorized row lost after deletion); remove initial selected-client wall refusal; remove final current-wall filtering (private candidate returned); remove native continuation forwarding. Meri mutations: remove SAM family registration; force source execution during constructor. Mutants were applied only to owned source and always restored; no mutation remains committed.

Removed `apps/gateway/general-reads/kb-provenance.test.mjs` (three import/source-measurement tests), registration sourceSha256/sourceFiles measurement expectations, and the stale memory fixture `getEligibilityCredentials` option. These belong to removed wrappers under the supersession register, not current Core permission behavior. Exact typed-set, negative input and no-source-call registration tests remain. Searches of the changed registration test/fixture find no removed identifiers; `git ls-files` verifies the deleted test is absent after commit. Core's returned-row-only cursor condition is replaced; `Promise.allSettled` and current permission checks remain. No production adapter was deleted or recreated.

Commands: Meri `node --test --test-concurrency=1` with `apps/gateway/general-reads/families.test.mjs`, `registration.test.mjs`, `packages/contracts/native-read-observation-0.2/test/secondary.test.mjs`; runtime suite paths are `apps/runtime/test/{reads-secondary-composition,reads-general-client-parity,reads-retained-composition,agentcore-reads-client,config-reads}.test.mjs`. Core used Jest `--runInBand --runTestsByPath` for the three changed specs with source mappings and the approved donor, preserving the repository's native Jest setup. Scratch configs/logs and mutation scripts are private local work artifacts, not product mechanisms.

NOT RUN: full API semantic typecheck/build, full repository gates, native Postgres permission/concurrency integration, deployed E18–E20/E31/E44, live connector/authenticated multi-tenant acceptance, AWS rollout and source-index freshness p95. Root allocates those gates and the independent reviewer. MG-06/MO-14 and unsupported MO-15 sources remain open. Citation UI/shared contracts remain with their allocated authors; this slice changes no shared manifest/schema. No merge or production acceptance is claimed.
