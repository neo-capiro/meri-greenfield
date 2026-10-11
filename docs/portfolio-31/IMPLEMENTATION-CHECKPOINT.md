# Capiro 3.1 Portfolio implementation checkpoint

Updated 11 October 2026. **Work continues; this is not full Portfolio completion.**

## Source and isolation

- Frontend: neo-capiro/meri-greenfield, branch codex/portfolio-31-20261010, checkout C:/dev/meri-greenfield-portfolio-31.
- Start:351be38b19279bbf8159b6da6ffc674239ac8ecf. Qualified implementation source: 6c1c42fad9d66a13043958235d27f8c6e1f9fe65. Later delivery documentation commits are identified separately from the compiled code source.
- [Draft frontend PR1](https://github.com/neo-capiro/meri-greenfield/pull/1). No merge, cutover, deployment, shared migration or authentication change.
- Current remote Meri main c8978118a53cc6fc4cc3a553cdafdba4126d2443 inspected: no new overlap in apps/portfolio-web or docs/portfolio-31. Backend contracts rechecked at origin/main fd8765ec01d292013758606204f2c9d886cd31c1.
- Shared policy:b32b4803933760dc0a93fffdcd8fba30a89c3aac; fetched remote:b2b0ce8c2bf03817b81e671d968b7892985b8d06. Machine map modified2026-09-30T00:21:48.2698715Z.

Checkpoint prepared from checkout `6c1c42fad9d66a13043958235d27f8c6e1f9fe65`. A delivery manifest records subsequent documentation commits separately. Test evidence is bound to the qualified implementation source above.

## Local implementation

Shared shell/navigation, Clerk session/error boundary, validated service configuration, tokens/primitives and deep links support list/cards/filtering, three-step intake/edit/archive, Overview/activity actions, Objectives candidate/readiness, advocacy history, Calendar/meeting information/preparation/notes/debriefs, organization/government Relationships, Work destinations, retained Capabilities, Bill Tracker/watchlist, Opportunities, Files, team and facilities/map. Individual audit details and exact visual acceptance remain partial; a rendered screen does not close every row.

Recent additions:

- Reviewed advocacy merge/reassignment/detach/exclusion/history edits, with current actor/lifetime checks and GET-only reconciliation after an uncertain reply. No atomic CAS/idempotency contract exists.
- Organization/government email includes selected-client recipients, To/Cc/Bcc deduplication, canonical Files upload/readiness and a separate send review. Unknown delivery freezes the intent. Backend reply and outbound attachment ACL candidates still require integration.
- Client/meeting Notetaker actions distinguish saved preference, requested attendance, actual session status and unconfirmed removal. Explicit consent; private approved Notes plus attempted approved Debrief are not automatically shared/emailed. No live bot/recording/removal acceptance.
- Fill with Meri opens saved review, source/task outcomes, evidence, selected apply, reject/restore, cancel and immediate matter assignment. New research/task retry remain unavailable because current discovery persists setup identities, facility changes and Matter associations before review. Preview-only aliases must also remain source-disabled until existing core/completion workers and stale recovery are upgraded/drained; a version marker alone does not fence their claims.
- Saved preparation/debrief preview reuses canonical content and native Print / Save as PDF. Separate PDF preparation seeds the existing email composer after a valid file receipt. Rich/Unicode inputs unsupported by the server renderer are refused for stored PDF; local print preserves them. No live PDF preparation/send.

- Prospect contacts/version handling, explicit existing-client no-charge link, saved brief creation/edit/history/citations and fail-closed identity checks. Unsafe legacy refresh apply remains unavailable pending the reviewed backend contract.
- Workspace template search/product filters and exact saved structure preview. Live API returned20 templates and a selected four-section detail. This is the generic catalog, not a persisted prospect proposal or send flow.
- Bill hearing evidence, canonical hearing links, tracked date/change details and the current560px Updates dialog. Missing canonical IDs stay unlinked; Core has no equivalent hearing endpoint.
- Needs attention is composed in the index. Live GET returned an empty bounded response; backend compute failures can return that same shape, so no all-clear or complete-coverage claim is made.
- Add profile opens retained LDA search, firm-wide confirmation, candidate review and partial import receipts, including actor/lifetime refusal. These interactions are included in the current combined qualification. Live GET schemas passed for 20 search hits and 69 candidates. No live link/import was attempted.
- Calendar opens the approved meeting library, preserves URL filters and scope, supports reviewed client assignment and transcript upload/extraction. An extracted source explicitly generates a proposal in the existing debrief editor; Save, approval and sharing remain separate. Shell and scope-race checks are included in the current combined qualification.
- Historical Program Elements summary CORE-010 is absent from the inspected current index design and classified obsolete. Its old “net” value is an unweighted per-PE percentage mean, not portfolio dollar net.

## Verification actually run

At 6c1c42fad9d66a13043958235d27f8c6e1f9fe65 on explicit **Node24.19.0**:

|Check|Result|
|---|---|
|Unit|384 passed;0 failed/pending|
|Actual component browser|233 passed;0 skipped/flaky/unexpected|
|TypeScript / formatting|PASS|
|ESLint|PASS; existing static-image warning|
|Architecture|PASS; module count in final-architecture.log; direction/cycles/boundaries|
|Next production build|PASS;17 routes|
|Actual Next server|5 auth/deep-link checks PASS; unauthenticated proxy401|

Evidence: outputs/evidence/portfolio-integration-review-flows-20261011/source-qualification.json. Earlier337-unit/193-browser qualification retained191pass/2fail; empty personIds payload and uncertain-send review fixes passed all8 affected cases before the current combined run. Original screenshots/traces/results remain in portfolio-integration-mail-attendance-20261011. Earlier font/geometry/fixture failures are also preserved. Component tests intercept APIs and do not establish live permissions/provider behavior.

Authorized real services, neo@capiro.ai in capiro-internal:

-13 canonical Core read projections passed;47 October Master meeting records accepted the canonical meeting/preparation projection. Meeting privacy/write acceptance remains open.
- Canonical intake/contact/facility create/edit/read-back/delete or archive passed on one task-created synthetic client. Client02d1b2fd-a684-4edc-a64a-a4248763cdd7 was archived, its child contact/facility removed and active-list absence read back. Existing fixtures were untouched.
- Workspace library/detail schema checks passed for20 templates and one four-section detail; no content/session values persisted.
- Core and Intel board schemas both passed for one accessible client with empty boards. Core remains readable during Intel ownership: availability does not establish exclusivity. Corrected interpretation is recorded separately. No tracking/hearing write.
- Portfolio alerts GET/schema passed with0 rows/0 reported clients. Positive alert-source acceptance remains unverified.
- All reported meeting-library pages passed: 62 caller records across two pages, unique IDs/count, and an empty accessible-client scope. This does not establish teammate privacy boundaries or artifact-body/provider/write acceptance.

## Run and backend map

Use Node24/npm11 in apps/portfolio-web: npm ci; copy .env.example to ignored .env.local; configure matching Clerk/backend environment; npm run dev (5188), npm run build, npm run start. On this machine use bundled Node24 explicitly: bare node is22. Keys stay in the approved machine secret store.

Task preview: **[localhost:5190](http://localhost:5190)**, isolated Next production server from6c1c42fad9d66a13043958235d27f8c6e1f9fe65. Real Clerk development sign-in renders. Signed-in product acceptance is blocked: development Clerk lacks the approved tenant/JWT template and backend trust; production Clerk rejects localhost. A matching development backend or approved isolated production-auth hostname is needed. No hosted preview exists.

|Configuration|Verified target / responsibility|
|---|---|
|CORE_API_BASE_URL|https://os.capiro.ai/api — clients, Engagement, people, facilities, ownership, advocacy|
|STRATEGY_API_BASE_URL|https://os.capiro.ai/strategy-api — existing Strategy/Planner|
|WORKSPACE_API_BASE_URL|https://os.capiro.ai/workspace-api — drafts/documents/artifacts/template reads|
|INTELLIGENCE_API_BASE_URL|https://os.capiro.ai/intel-api — explicit Intel tracker/watchlist/hearings|
|TRACKER_BACKEND|Explicit core/intelligence; task preview unset, no fallback|
|CAPIRO_EXISTING_APP_URL|https://os.capiro.ai — verified existing destination paths|
|Other shell destinations|Explicit verified Meri/Module/Workspace destination required|
|Clerk keys|Approved machine store only; values omitted|

The existing server proxy obtains the capiro JWT; browser tenant/permission headers are not authority. Differences stay in validated configuration. Separate hosting does not isolate backend data.

## Backend drafts and dependencies

|Draft|Independently checked scope|Still required|
|---|---|---|
|[Objectives2362](https://github.com/neo-capiro/capirov2/pull/2362)|29 focused API/type/build/PGlite checks; four-field readiness|Owner/migration integration, full lifecycle/link/coverage contracts, live acceptance|
|[Mail guard2364](https://github.com/neo-capiro/capirov2/pull/2364)|11 focused checks|Owner integration and provider/reply acceptance|
|[Outbound ACL2381](https://github.com/neo-capiro/capirov2/pull/2381),171ec869|Root48 scoped actual-service checks; strict helpers/format/diff PASS; original service10/19fails|Owner integration; separate batch/intent ACL; concurrent writer fence; live/native acceptance; broader typing37unchanged baseline dependency diagnostics|
|[Stages2365](https://github.com/neo-capiro/capirov2/pull/2365)|230 focused checks|Human legacy mapping, owner/migration integration|
|[Billing2370](https://github.com/neo-capiro/capirov2/pull/2370),7fcd3cb|Original37 +13 actual-DDL/store PGlite; strict scoped types|Global publication fence, dispatch recovery, invoice policy/cancellation/compensation, single-use conversion receipt, owner/grants/migration, Stripe sandbox|
|[Contacts2371](https://github.com/neo-capiro/capirov2/pull/2371)|11 PGlite/DTO/guard checks|Registration/schema, atomic conversion carry-over, native/live acceptance|
|[Geocode2373](https://github.com/neo-capiro/capirov2/pull/2373),6e5774a|96 checks; strict extracted types; cleanup shared CLI conservation review|Combined final-source/native PostgreSQL/HTTP/provider acceptance|
|[Brief refresh2378](https://github.com/neo-capiro/capirov2/pull/2378),87de0da|18 tests using actual pinned migration SQL|Module/migration/retention agreement, native/HTTP/live acceptance|

All are drafts. Billing follows the approved inline quote/charge/receipt direction; a stored paid receipt alone grants no client slot. No charges/customer messages were used for validation.

[SessionStore PR2](https://github.com/neo-capiro/meri-greenfield/pull/2) remains a separate candidate at65d9c750639e0d370985827983f24019a3f585ab:128 focused +7 Promptfoo +21 native checks passed. Broad suite303/304 preserved a temporary-ancestor inventory setup failure. This is not G1/W05 or fresh Fargate recovery acceptance. Claude SDK/Fargate responsibilities remain.

## Traceability and ongoing work

Workbook/JSON/CSV preserve 345 IDs and historical evidence. Read-only comparison verified six baseline tabs, 7,613 values, six formulas and all IDs. Current classifications: 238 partial frontend, 99 queued, 7 obsolete/legacy, 1 disabled billing candidate. These are progress categories, not completed-workflow counts.

Parallel work: Overview saved-performance removal and exact QuickLog Undo composition; preview-only research and stored-PDF fidelity/operation candidates. Outbound ACL candidate2381 is published for review. Remaining scope includes proposal persistence/generation/reviewed send/reminders, conversion carry-over, objective lifecycle/work links, saved layouts, missing analytics definitions and final live/visual acceptance.

Feature folders own contracts/adapters/query/mutation coordination/UI; routes compose public interfaces. Foundations do not import features. Existing Schedule-X/React Flow and Workspace editor are reused; no competing Meri/editor or whole Module rebuild.
