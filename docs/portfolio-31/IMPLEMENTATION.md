# Portfolio 3.1 implementation

## Authority and isolation

Human placement decision on 11 October 2026: continue Portfolio in meri-greenfield,
overriding D014 for this explicitly scoped frontend. Meri runtime and qualification
ownership stay with their existing owners. This does not move or rebuild Meri.

Base: `351be38b19279bbf8159b6da6ffc674239ac8ecf`; branch
`codex/portfolio-31-20261010`; checkout `C:\dev\meri-greenfield-portfolio-31`.
Shared policy: `capiro-agent-ops` at `b32b4803933760dc0a93fffdcd8fba30a89c3aac`.
Cleanup owner confirmed no overlap with `apps/portfolio-web/**` on 11 October.

## Outline and ownership

- `apps/portfolio-web`: isolated Next.js/React frontend, own lockfile and port 5188.
  Uses the same approved stack as capiro-frontend. No copied Capiro application.
- `src/app`: thin routes, layouts and bounded same-origin service proxy.
- `src/shared`: validated configuration, HTTP/session boundary, query cache,
  Figma tokens and accessible primitives. No feature imports.
- `src/features`: Portfolio, client profile, Objectives, calendars, relationships,
  work, capabilities, files and opportunities own their adapters and interactions.
- Server authenticates with the existing Clerk application and `capiro` token
  template. Backend remains authoritative for tenant, client and role permissions.
  No browser-supplied tenant header or separate authorization database.
- Transient form/navigation state is local/URL based; shared records persist in
  backend services. TanStack Query owns server cache/invalidation.
- New Objectives backend candidate is capirov2 draft PR 2362. Integration is held
  pending cleanup combined-source review; no migration has been applied.

Existing new frontend public UI exports depend on Tailwind and currently expose
only Meri primitives plus Button. The Figma implementation instruction prohibits
adding Tailwind; use upstream Radix behavior with CSS tokens for Portfolio and
keep stable presentation APIs compatible for later consolidation. Do not import
another application's private shell, DTOs or fixture data.

## Verification and external boundaries

Run focused domain/adapter/proxy tests, type/lint/architecture/build checks and
Playwright responsive flow checks. Fixture checks are labeled separately from
live integration. Review >400 nonblank-line modules and >80-line functions for
mixed responsibility; these are review signals, not acceptance shortcuts.

The human designated capiro-internal and neo@capiro.ai on 11 October. Authenticated
read checks verified the deployed core origin https://os.capiro.ai/api. Missing config produces a setup state;
missing contracts produce actionable errors rather than fabricated data.
No hosted deployment, shared routing/CORS/auth setting, shared migration,
customer send, conversion or billing action is included in these read checks.
Prepare hosted preview configuration after inspecting available infrastructure.

## Scope checkpoints

1. Shared shell, auth, configuration, tokens/primitives and Portfolio list/intake.
2. Client Overview, account team, facilities and activity; Objectives lifecycle.
3. Distinct client/Master calendar; meeting preparation/notes/debriefs.
4. Relationships, Work links, capabilities, bill tracking, opportunities, files.
5. Prospects/proposals, current audit gaps, full traceability and draft delivery.

Baseline audit evidence remains read-only outside the repo. The implementation
matrix retains all 345 original IDs and never equates API availability with a
working frontend. Record specific dependencies and checks for each workflow.

## Prospect slice outline

Business Development owns pipeline prospects (`/api/business-development`),
separately from legacy `CLIENT/PROSPECT` client profiles. `features/prospects`
will own its verified schemas, list/detail/history queries, basic create/edit,
owner/next-step/note/archive mutations and list/detail presentation. It reuses
Portfolio's public member options, the shared shell, cache, proxy and dialogs.
Routes compose the feature; no client-record impersonation or second editor.

The human selected the Figma stages; legacy mapping is pending. New writes are
gated on the guarded `business-development/prospect-stages` catalog candidate
(capirov2 draft PR #2365). Pipeline displays canonical stages plus a separate
previous-stage group without guessing a mapping. New creates explicitly submit
identified; legacy defaults/records stay untouched. A won stage never silently
charges or converts: conversion is explicit. Basic company edits, next steps,
history/notes and archive/restore reuse verified existing contracts.
The server list caps at 200 without a cursor; disclose truncation and retain
server counts. Legal/company registration/contact/proposal/carry-over fields
without current contracts require focused backend candidates, not local storage.
Verify feature-off 404, authorization, search/scope/count semantics, mutation
invalidation, error retention, owner membership and explicit conversion boundaries.

## Bill Tracker slice outline

`features/bill-tracker` owns verified board/search/track projections, query and
mutation adapters, table/board presentation and dialogs. Reuse shell, dialogs,
cache, HTTP and configured existing Bill 360 destination. Add explicit validated
`TRACKER_BACKEND=core|intelligence`; neither backend is a fallback for the other.
Core paths include `/api/intelligence`, intelligence paths use `/intel-api`.
Normalize their different board/card and untrack contracts at the adapter.
Keep service-owned stages and probabilities intact; no browser passage model.
Intel pagination is explicit; loaded-row filters must not imply full-dataset
counts. Owner flag 404, unavailable config, permissions and errors stay visible.
Watchlist/alert contracts differ materially and require focused follow-through;
do not send provider tests, invent hearing dates or auto-enable notifications.

## Opportunities slice outline

`features/opportunities` owns the client-matched v2 search and PE relevance
schemas, focused query hooks, source-health notices and the two-column summary.
Core service routes are `/api/intelligence/opportunities/v2/search` and
`/api/intelligence/clients/:clientId/pe-relevance`; client access remains enforced
by those services. Use server counts with their catalog-completeness context.
Page-only pursuing, bookmarks and deadlines are labeled as page-only, and absent
workflow decoration stays unavailable. Preserve source/type/record identifiers;
links open the existing Opportunities and Program Elements experiences rather
than rebuilding those Modules. Pagination and search are URL state, independently
for the two feeds. Refresh refetches reads only. Verify pagination, partial-source
health, association mismatch rejection, query encoding and exact Module links.
No financial model, currency inference, provider writes or Meri orchestration.

## Government Relationships outline

The Relationships feature owns saved target reads/add/tier/remove, directory
search/committee taxonomy adapters and focused target/search/recommendation
views. Organization and Government remain URL-selected views with separate
queries. Directory detail links reuse the existing Module routes. Committee
and personal-office staff classification comes from the target service, never
from a guessed title. Explicit directory recipient data reuses the same mail
history/compose flow as organization contacts, with no fabricated ClientPerson ID.
Preserve source-specific paging, failures and current/former position labels.
Target recommendation scores are service-provided relative priorities, not
probabilities; refresh is explicit and cannot add a target automatically.
Shared proxy gains only authenticated directory/explorer roots. Verify encoded
state IDs, source-directory writes, client associations, tier clearing, failures,
query invalidation and reviewed email/error behavior using isolated fixtures.
Live provider checks stay blocked on the promised account/tenant scope.

## Shared client header follow-through

Client-profile owns the breadcrumb, client strip, view menu and supported quick
adds. Shared shell owns one client-view route catalog reused by sidebar and menu.
Use Radix keyboard/focus handling and the exact current Figma header assets.
Render server client identity/status; do not infer a headquarters location.
Quick adds link to existing objective, meeting, activity and notes flows; meeting
creation gets an explicit URL parameter with close/back behavior. Client Meri
actions remain visibly unavailable pending the owner-approved starter contract.
No speculative Meri query parameters or automatic sends. Verify keyboard view
switching, deep links, client scope, responsive layout and actual asset geometry.

## Cleanup coordination — 11 October 2026

Cleanup owner reports D4 native gate FAILED on 9d; next source candidate 3529f5bb
and disposable migration/memory carrier repair are in progress. No Cleanup1 phase
accepted. Keep Portfolio PR 1 and capirov2 PRs 2362/2364/2365 isolated/unmerged,
with migrations unapplied. Combined gate review follows a green C1 and owner
coordination; this report is not independent verification of the cleanup gate.

## Local expansion checkpoint — 11 October 2026

Prospects, Bill Tracker/watchlists, matched Opportunities/budget programs,
Government Relationships and the client breadcrumb/quick-add header are now
implemented candidates. Production build, TypeScript, 61 unit checks, 21 browser
checks and architecture checks across 154 modules pass. Browser API responses
are synthetic contract fixtures. The actual Next server on isolated port 5189
passes setup/deep-link/proxy refusal checks; missing Clerk/backend configuration
prevents authenticated acceptance. ESLint exits zero with one static SVG warning.
The one formatting failure was confined to a test file and corrected.

Visual review against 411:50356 and 411:55991 prompted priority-target geometry,
panel/header spacing and disabled Meri gradient corrections. Final desktop/phone
dark captures were inspected. Full Figma interaction acceptance remains open.
No backend migration, provider operation, deployment or shared routing changed.

Shared operating policy: b32b4803933760dc0a93fffdcd8fba30a89c3aac; clean and three
commits ahead of fetched origin/main. Machine map revision 2026-09-30T00:21:48Z.
Current fetched capirov2 main remains fd8765ec; meri-greenfield main is 8586f627.

## Authorized live read checkpoint — 11 October 2026

The approved secret store contains the deployed Clerk application's keys. The
account already has capiro-internal membership and an active scoped session;
no test account was needed. Nine core read projections passed HTTP 200 and the
actual frontend boundary schemas: clients (15), owner catalog/options (6),
Master meetings (47 in October), and one accessible client's profile, facilities,
team, activity and client meetings. No content, tokens or session identifiers
were retained. Evidence: `portfolio-authorized-read-checks-20261011.json` in task
outputs. This does not prove cross-user privacy or mutation acceptance.

Saved meeting preparation exposed structured objects where the initial adapter
required strings. Calendar now accepts the verified text/factIds,
text/evidenceReferences and title/description/dueDate formats and renders their
text without dropping opaque references or manufacturing citations. Initial
failure evidence is retained. The regression includes a real-component browser
case. Calendar/auth checkpoint checks: 62 unit, 22 synthetic browser, TypeScript, formatting,
155-module architecture and production build PASS; ESLint retains one SVG warning.

The configured production preview runs at http://localhost:5190 with the core
origin above. Clerk rejects its localhost origin. Native ClerkFailed handling
now displays a retryable sign-in error, verified on the final Next build.
Production keys are identical to the deployed public configuration. After the
human signed into Clerk, existing Capiro development keys were retrieved and
saved in a dedicated approved local secret file, outside Git. The local preview
now initializes Clerk and displays the real development sign-in form. Shared
production keys/settings are untouched. Read-only development checks find Neo's
account, but no capiro-internal membership or capiro JWT template. Backend source
verifies its own Clerk instance's signing keys and optional issuer, so these
development credentials cannot be assumed to access the production tenant.
Authenticated product acceptance needs a matching development backend/tenant or
an approved isolated preview origin using the current production instance.
No production auth/domain/CORS setting is changed.

## SessionStore follow-through

The human explicitly requested proceeding with SessionStore and the supplied
recovery recommendation. A separate source candidate is draft meri-greenfield
PR 2, commit 7b2e77b8739eeb48d96f3c6025de7aaec0f63549. It preserves SDK/Fargate,
reuses canonical contracts/native-file capture, and adds bounded run-scoped
SessionStore mirroring/read-back checks. 121 focused/static checks and seven
deterministic evals pass. A broader worker run passed 295/297; two unchanged
native-file cases intermittently refused SOURCE_CHANGED on Windows, then passed
14/14 standalone. The broader suite is not green; its failure is retained.
No G1 pass is claimed. Native session/workspace immutable checkpoints are the
primary recommended recovery proof; authenticated durable transport, proven
quiescence, generation-fenced checkpoint publication and two fresh Fargate tasks
remain runtime-owner integration. Full W05 is separate from the bounded G1 spike.
The active G1 owner is not identifiable in current app sessions; cleanup has no
verified owner thread ID. Existing runtime/contract/lock/infra files are untouched.

## Activity history filters outline

Continue CORE-103 using the current Figma search/type/date controls (411:60532),
adapted into the required bottom Overview timeline. Client-profile owns filter
state, controls and selection over the existing latest-500 activity projection.
No extra feed, pagination claim or persistence is introduced. Search title/body,
preserve service kinds, and treat chosen civil date bounds inclusively in the
viewer's local time zone; reject inverted ranges. Reuse Radix menu/popover focus
behavior and existing CSS tokens. Extract the calendar's existing civil-date
validation/instant-to-day operations into a focused shared date module because
both features now need exactly that behavior. Verify search/type/date/clear,
midnight/DST boundaries, failure/retry retention, responsive geometry and the
exact downloaded Figma assets. No Open commitments panel is restored.

Activity search/type/date/clear and failure/retry retention now pass two browser
cases and five domain checks, including the 25-hour DST day and local/server
date differences. Default all-dates behavior is preserved; Last 30 days is an
explicit preset computed from current local civil dates, not Figma fixture dates.
The final combined frontend has 67 unit checks, 24 component-browser checks,
TypeScript, formatting, 159-module architecture and production build PASS.
Search/type/date assets were inspected at their native 16/14px geometry on desktop
and phone dark captures against 411:60532. The timeline remains scrollable at the
bottom of Overview. The authenticated live activity read was empty; positive
history/filter acceptance uses synthetic records and is not marked live-complete.
The final actual Next build also loads development Clerk across three deep links,
renders its sign-in form, and refuses unauthenticated core proxy access with 401.
