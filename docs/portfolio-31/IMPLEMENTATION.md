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
The owner selected `intelligence` for the Portfolio preview on 11 October 2026.
The service change set must pass that value explicitly and signed-in acceptance
must exercise the Intelligence board, search and watchlist contracts.
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

## Historical local expansion checkpoint — 11 October 2026

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
At that checkpoint fetched capirov2 main was fd8765ec and meri-greenfield main was
8586f627. Later source and acceptance records below supersede these historical checks.

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

## Recorded activity follow-through outline

Client-profile owns recorded timeline edits and removal. Add a focused activity
mutation adapter, row actions and activity dialogs; reuse the current HTTP client,
TanStack invalidation, Radix menu/dialog behavior and existing form primitives.
The existing PATCH accepts title/body and settled; DELETE returns ok. Only recorded
rows expose writes. Settlement requires a persisted dueAt; derived meetings, files
and mail remain owned by their source. No pinned-account-note or open-commitment
panel is restored. Keep failure input, wait for invalidation, and confirm deletion.
Verify existing current Figma row actions, durable errors and remove dialog,
keyboard/focus, permissions/session failures, pending duplicate refusal and exact
client/row paths. Live mutation checks remain separate from synthetic assertions.

## Recorded activity verification — 11 October 2026

CORE-050/051 now have working candidate interactions against the existing contract.
Four browser cases verify title validation/body clearing and failure retention,
recorded-versus-derived ownership, exact client/row paths, settlement/reopening,
permission failures, pending controls, deletion confirmation, malformed success
refusal, cache invalidation and the existing global expiry gate. A menu/dialog focus
defect was fixed with native Radix autofocus callbacks and explicit return focus.
Initial failed results are preserved in task evidence; the 401 expectation and
duplicate fixture text selector were corrected without changing session behavior.

Current local checks: 67 unit, 28 synthetic component-browser, TypeScript, formatting,
162-module architecture and 17-route production build PASS. ESLint exits zero with
one existing static SVG warning. Actual final Next build on localhost:5190 passes
development sign-in/deep-link and unauthenticated proxy refusal checks. Authenticated
product UI and live writes are NOT RUN. Desktop and phone-dark removal captures
were inspected against 411:50341; error/close geometry was corrected. Full timeline
visual/expanded-feed acceptance remains open. No new static assets were supplied
for these text controls; the existing Dialog close icon is reused.

The review of >80-line presentation functions found cohesive row-action/dialog
rendering with mutation/data access kept in activity-mutations. No page-level store,
cross-feature internals, repeated domain policy, new dependency or circular import.
Fetched capirov2 main remains fd8765ec; meri-greenfield main is now fa00d58, whose
proxy/browser qualification changes do not overlap these frontend paths. No rebase,
merge, migration, deployment or shared auth/routing setting was performed.

## Facilities projection dependency — 11 October 2026

The facilities owner needs geographic projection and polygon clipping for real
facility coordinates and current district GeoJSON. The app had no map/projection
library. Parent owns the app package manifest and lockfile; add only d3-geo 3.1.1
(ISC, Node >=12) and @types/d3-geo 3.1.1 (MIT). Registry metadata and the upstream
projection documentation/license were checked on this date. Five small packages
were added with lifecycle scripts disabled; no root/runtime lockfile is touched.
The feature owner will reuse React/SVG for accessible selection and D3 for actual
geographic calculations. No basemap provider, key, paid requests, fixture pins or
handwritten projection algorithm. Projection/domain and browser integration checks
will accompany the feature integration; adding the package alone closes no audit ID.

## Preview authentication dependency — 11 October 2026

The official Clerk environment/troubleshooting documentation confirms that a
production instance requires its configured root domain (a separate subdomain can
share its production identity). Development instances have independent users and
settings. GitHub has no allocated meri-greenfield environment/preview target; the
capirov2 production target is shared and is not an isolated Portfolio preview.
No hosting, DNS, auth, CORS or shared routing change has been made. The concrete
remaining requirement is an owner-approved isolated hostname on the production
Clerk root domain with a separate hosting target, or a matching development
backend and capiro-internal test tenant. A different test account alone does not
resolve issuer/origin compatibility. No hosts-file, TLS-trust or Origin bypass is
used. Continue local contract/interaction checks and authorized read-only API
checks while that deployment/access boundary remains unresolved.

Sources: https://clerk.com/docs/guides/development/managing-environments and
https://clerk.com/docs/guides/development/troubleshooting/using-production-keys-in-development.

## Isolated AWS CLI preview preparation — 11 October 2026

The human authorized use of the existing `hermes-cli` AWS identity and requested
AWS CLI rather than console operation. This preparation does not deploy a service,
change shared routing, or approve live product writes.

- `apps/portfolio-web/Dockerfile` owns the immutable Node 24 Linux build and a
  non-root standalone Next.js runtime. The build context is this application only;
  no Meri backend or current Capiro source is copied.
- `src/app/healthz/route.ts` owns an unauthenticated process health response. It
  contains no tenant or backend data; the ALB health check uses this route.
- Next output tracing owns the runtime file set. Public assets and static build
  output are copied explicitly. Server-side configuration and Clerk secret keys
  enter only at runtime through a reviewed ECS task definition/secret reference.
- A separate preview VPC, ECS cluster/service, target group, ALB, certificate and
  DNS record are proposed. They require an exact built/scanned image digest, live
  backend/auth mapping, an independently reviewed infrastructure diff and an
  owner-designated signed-in test scope. Existing `web-vnext` routing stays intact.
- Verification before deployment: current-head type/lint/architecture/unit and
  full browser checks, Linux image build, anonymous health/setup/proxy checks,
  image scan, and review of network/secret boundaries. Signed-in acceptance is a
  separate bounded production test after the preview is reachable.

CLI foundation read-back at 2026-10-11 15:42 UTC: CloudFormation stack
`Capiro-Portfolio-Preview-Registry` is `CREATE_COMPLETE`; its repository is
`967807252336.dkr.ecr.us-east-1.amazonaws.com/capiro/portfolio-preview`, with
immutable tags, scan-on-push and AES256 encryption. Stack
`Capiro-Portfolio-Preview-Certificate` is `CREATE_COMPLETE`; its certificate
`arn:aws:acm:us-east-1:967807252336:certificate/179a4c08-7745-45f9-b4be-7ddae9d36729`
is `ISSUED` with successful DNS validation. Route 53 has only the ACM validation
CNAME for this name; it has no preview A/AAAA alias. The service stack template
under `apps/portfolio-web/deployment` validates with CloudFormation but is not
deployed. The exact image digest, Clerk secret references and approved browser
source CIDR remain required service parameters. The existing Capiro ALB and
`web-vnext` service are unchanged.

Read-only ECS task-definition and Secrets Manager metadata checks confirm the
existing `web-vnext` publishable-key reference and core API secret-key reference
form a matching `live` Clerk key pair under one KMS key. No key value was printed
or copied. This identifies candidate secret references for the preview; it does
not prove the preview origin allowlist, JWT behavior or tenant membership.

CodeBuild source attempt `53cd95eb-bb9a-4ea8-b9de-88efea200109` failed before
checkout because the account's GitHub source credential could not access this
private branch. The project was changed to a versioned, private S3 ZIP, with
archive SHA-256 `01491a652136199cd2d1e7fc7b1eb61d93ee2922eef6cab90533fcd8739a8884`
and S3 version `EnB.6Icr5QKmCpbDpWgQ3HuF4OF51w05` bound to source `dacd184`.
Run `fd34c028-36d3-465d-9c16-875bff7a8ac4` passed 728 unit and 459
Playwright cases, production Next compilation and Linux image build/push, but
the overall job failed on its last ECR read-back command because the role lacked
`ecr:DescribeImages`. CLI owner read-back found digest
`sha256:3e513ef137b39e4d5c2650ef853549a79108d6cc5e6818992c83051c42e7ac10`.
ECR scanning completed with one HIGH `CVE-2026-85091` zlib finding. That finding
requires disposition before ECS preview admission. No service/DNS traffic alias
or signed-in production test was created. The failed job remains visible; the
build-role permission is corrected in the versioned template for the next run.

Clerk production-dashboard read-back on 11 October found `app.capiro.ai` as the
verified primary domain and only entry in its enabled allowed-subdomain list.
There are no satellite domains. A proposed `portfolio-preview.capiro.ai`
satellite would cost $10/month; none was added. The allowed-subdomain form
accepted `portfolio-preview.app.capiro.ai` as an input, but it was cleared
without submission. The certificate template and preview runbook now target
that hostname. The certificate stack was updated on 11 October; ACM issued
and DNS validated the new hostname, replacing the unused first certificate.
No Clerk production setting was changed.

The full S3-source build on `4f2a082` passed 728 unit and 459 browser cases,
static checks, production compilation and the Linux image build. Its container
smoke failed before image push because the check used `/api/core/clients` rather
than the implemented `/api/backend/core/clients` proxy route. Diagnostic jobs
confirmed UID 1000, a healthy `/healthz`, and setup/sign-in fallback pages.
Source `8a41286` corrected the URL. Full CodeBuild job
`322ee417-3874-4c38-85a6-948f2c90ff45` then SUCCEEDED with 728 unit and
459 browser cases, production and Linux builds, container smoke and ECR digest
read-back `sha256:9d9dfee999cb8586cf8e5cc0b74875f1152cfd2f390256b1cb4baab55a4970c3`.
Its completed scan again reports one HIGH `CVE-2026-85091` zlib finding.
At that checkpoint, no image was admitted for ECS while that finding lacked a
disposition.

The Debian image remains ineligible. Source
`a1a1c09016f4c778b2c39dc4b0cfbb3f139a465d` switches the isolated
preview runtime to pinned Node 24.21.0 Alpine 3.23 with vendor-fixed zlib
`1.3.2-r1`. CodeBuild
`capiro-portfolio-preview-build:288c6d1d-30d3-4ff7-8378-7d76c1117b91`
SUCCEEDED on exact source/S3 version with 728 unit and 459 browser cases,
static checks, Next and Linux builds, non-root container smoke, push and ECR
digest read-back. Digest
`sha256:7c1b10100a566fb6ce179ec480ea73e833e2c71c8af64db11439b3099f55e4aa`
scanned COMPLETE with zero findings. This clears the image-scan gate; it does
not merge the draft PR or activate the preview service, Clerk subdomain or
traffic DNS.

## Client lifecycle integration outline — 11 October 2026

Client-intake owns the canonical three-step form, profile mapping/validation,
fresh-read dirty-field merge, logo staging/confirmation and soft archive adapters.
Client-profile composes its public edit/archive dialogs from a focused actions
menu in the shared header. Role-gated entries reuse the existing identity query;
API authorization remains authoritative. Radix manages keyboard/menu/dialog focus
with explicit return to the originating control. Capabilities reuses the public
certification vocabulary, avoiding a second private list. Verify the actual
ClientFrame composition, validation, preserved remote fields, scoped receipts,
partial logo success/retry, permissions, archive confirmation and cache refresh.
No second application, editor or persistent page-level UI store is introduced.

## Facility target composition outline — 11 October 2026

Relationships exposes a focused AddGovernmentTargetButton through its public
interface for representatives resolved by Facilities. It reuses the canonical
target query/mutation, validates the saved client/member/directory association,
waits for identity and current targets, prevents duplicate pending writes and
reports server failures. Facilities supplies only its client and resolved member;
it does not copy target persistence. Existing backend role and tenant guards
remain authoritative. Validate the real facility detail composition, already
saved targets, failed add/retry, permissions and cache refresh in the browser.

## Explicit prospect/client linking outline — 11 October 2026

Prospects owns a focused conversion subfeature for the verified link-existing
path: server-scoped client search, explicit selection/confirmation, scoped
conversion receipt and cache invalidation. It reuses the canonical Prospect
schema, HTTP/session boundary, identity and Radix Dialog. The endpoint owns
tenant authorization, canonical identity conflicts and locked idempotency.
An existing-client link must return created:false and matching prospect/client
identities; a lost reply triggers readback, never an automatic second POST.
Linking does not charge, create a client or claim asset carry-over. New-client
conversion stays separate until inline billing and durable carry-over are
integrated. Verify search encoding, pending refusal, failures, mismatched
receipts, permissions, expiry and lost-reply readback in the actual components.

## Reviewed facility candidate concurrency — 11 October 2026

The backend owns a semantic snapshot revision and atomic persistence guard shared
by reviewed selection and asynchronous geocode writers. The frontend consumes
the server revision associated with the displayed candidates and sends it only
to the new reviewed route. It must refuse selection when the old service lacks
that contract; it cannot reconstruct hidden snapshot fields or fall back to an
unchecked candidate index. Existing query invalidation reloads candidates after
a failed or ambiguous selection. Verify missing support, explicit conflict and
read-back, exact revision payload, and old-route refusal in component tests.
