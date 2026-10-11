# Capiro 3.1 Portfolio preview

Isolated frontend in meri-greenfield. Backend services remain capirov2. This is
an implementation checkpoint; several audit workflows and live acceptance are
still open. No production cutover is configured.

## Run

Use Node 24 and npm 11. From this directory:

```powershell
npm ci
Copy-Item .env.example .env.local
# Populate designated service origins and keys for their matching Clerk application.
npm run dev
```

Open http://127.0.0.1:5188. Missing configuration displays a setup page. There is
no fixture sign-in or production authentication bypass. The root workspace's
runtime, dependencies, qualification infrastructure and lockfile are untouched.

```powershell
npm run check
npx playwright install chromium
npm run test:browser
npm run format:check
npm run build
npm run start
```

Browser tests start their own loopback component host on port 5191, import the
actual feature components and intercept synthetic API responses. They do not
prove live authentication, tenant access, provider writes or deployed behavior.

## Configuration boundary

| Server configuration                                        | Verified service responsibility                                                                                       |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| CORE_API_BASE_URL                                           | Clients, people, facilities, team, advocacy, Objectives candidate, Engagement meetings/mail/files, hearings/deadlines |
| STRATEGY_API_BASE_URL                                       | Strategies and paginated Planner tasks                                                                                |
| WORKSPACE_API_BASE_URL                                      | Existing Workspace drafts/documents/artifacts and read-only template catalog                                           |
| INTELLIGENCE_API_BASE_URL                                   | Intel Bill Tracker board, paginated search and versioned watchlist configuration                                      |
| TRACKER_BACKEND                                             | Explicit `core` or `intelligence` owner; no automatic fallback between services                                        |
| MERI_API_BASE_URL                                           | Reserved; no alternate Meri implementation                                                                            |
| CAPIRO_EXISTING_APP_URL                                     | Existing Workspace/Strategies/meeting preparation deep links                                                          |
| CAPIRO_MERI_URL / CAPIRO_MODULES_URL / CAPIRO_WORKSPACE_URL | Existing shell destinations; unavailable actions stay visibly disabled                                                |
| NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY / CLERK_SECRET_KEY        | Existing designated Clerk application; matching key pair and backend trust required                                   |

Origins include the deployed prefix, for example `https://test.example/api`.
Browser requests go through `/api/backend/<service>/...`; the server obtains the
existing `capiro` JWT and does not trust browser tenant or permission headers.
Configuration rejects URL credentials, query/fragment and non-loopback HTTP.

## Preview hosting dependency

No hosted preview exists. A separate target, hostname and its approved Clerk origin
must be allocated by the hosting/auth owner. Do not point shared routing at this
app or reuse Meri qualification resources. The reproducible build and runtime
commands above are ready for that isolated target; its server environment must
map each service explicitly. The human designated capiro-internal and neo@capiro.ai;
live core reads verify https://os.capiro.ai/api. The production Clerk application
rejects localhost. Existing development keys are configured locally, but matching
backend issuer trust, tenant membership and JWT template or an approved isolated
production-auth hostname are still required for signed-in product acceptance. No shared backend change or migration is applied.

## Structure and verification

Thin App Router pages compose feature public interfaces. Features own focused
schemas, queries, mutations and UI; shared foundations own configuration, the
HTTP/session boundary, query cache, shell, CSS tokens and Radix primitives.
Schedule-X supplies calendar grids and React Flow supplies the organization
chart. Workspace items open the existing editor.

Latest source `2b344249c10a4f8e5933762c4ee7b98c7fc26b67`:467 unit/79 affected browser checks, TypeScript/lint/format/architecture339 PASS. Overview tags/reviewed export, recorded-note pin and audio-file debrief source are integrated. Current-source production build deferred for Cleanup disk reserve; preview5190 remainsbbf25e6. No signed-in/provider acceptance. Evidence: outputs/evidence/portfolio-profile-integration-20261011/qualified-2b34424/.

Previous production-qualified source `bbf25e6ab4931886f5a382ee3362593e573c19de`:400 unit/26 affected browser checks, TypeScript/lint/format/architecture325 modules/Next17-route build and5 actual Next auth/deep-link checks PASS. Manual source and exact client Quick log Undo are integrated. Component checks intercept APIs; signed-in/provider acceptance remains open. Evidence: outputs/evidence/portfolio-manual-debrief-20261011/final/.

Previous full regression qualification at `6c1c42fad9d66a13043958235d27f8c6e1f9fe65`
on Node24.19.0: **384 unit and 233 component browser checks pass**,
zero failed/pending/skipped/flaky. TypeScript, formatting, architecture
(312 modules) and Next production build (17 routes) pass. ESLint passes with one
existing static-image warning. Actual Next production-server development-auth,
deep-link and unauthenticated proxy checks pass (five checks). Sign-in rendering
does not establish signed-in product acceptance.

Source-bound results are retained in the task's
outputs/evidence/portfolio-integration-review-flows-20261011. Earlier failed
email/font/geometry/fixture results, screenshots and traces remain preserved.
The empty personIds payload regression was fixed; uncertain delivery remains
blocked from automatic retry. These are intercepted component checks, separate
from authorized live reads and task-owned synthetic CRUD reported below.

Saved enrichment review, advocacy corrections, guarded client/meeting attendance,
recipient/attachment email review and saved meeting document preview are composed.
New enrichment start/retry remain unavailable pending a preview-only backend
contract and worker activation agreement. Native Print / Save as PDF preserves
saved rich/Unicode content; incompatible server PDF preparation is refused.
Prepared PDFs open the existing composer and can reopen the original attachment
without duplicate file creation; its scan/readiness is checked again before send.
No live bot, provider email, PDF creation, conversion or billing acceptance is claimed.

The local preview now uses existing Capiro development keys saved outside Git.
Its real sign-in form loads, and an unauthenticated core proxy call returns 401.
That development instance lacks capiro-internal membership and the capiro JWT
template; matching backend trust/tenant configuration or an approved isolated
production-auth preview origin is still needed for signed-in product acceptance.
Activity history search/type/civil-date filters and clear use the latest 500
records already fetched. They do not imply a complete historical calendar feed.
Recorded history entries support title/details editing, due-item settlement/reopening
and confirmed removal. Derived meeting/file/mail entries remain source-owned.
Failures retain input; 401 uses the shared session boundary. Keyboard focus and
pending duplicate refusal are browser checked. Canonical intake, organization
contacts and facility CRUD passed against a newly created task-owned synthetic
client; contact/facility rows were removed and the client archived with read-back.
These API checks do not establish signed-in browser, provider or meeting privacy acceptance.

## Current feature boundaries

Prospects use Business Development records, separate from legacy client-profile
types. New creates and stage writes require the guarded stage-catalog candidate
in capirov2 PR #2365. Existing legacy stages remain visible without an invented
migration mapping. Proposals, conversion and billing remain separate open flows.

Bill Tracker owns focused adapters for the materially different core and Intel
contracts. Watchlist version conflicts and partial rejection retain edits.
Opportunities and budget-program reads preserve source identity and client scope,
then hand off to the existing Modules for details. Government Relationships own
directory paging, committee hierarchy, target mutations and recommendations;
reviewed email reuses the organization-contact mail flow. Client header quick
adds reuse existing dialogs and routes. Unavailable Meri actions stay disabled.

See `../../docs/portfolio-31/IMPLEMENTATION.md` and the task implementation matrix
for remaining workflows and contract dependencies. Historical audit API labels
are never treated as frontend completion.
