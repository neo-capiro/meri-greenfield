# Capiro 3.1 Portfolio preview

Isolated frontend in meri-greenfield. Backend services remain capirov2. This is
an implementation checkpoint; several audit workflows and live acceptance are
still open. No production cutover is configured.

## Run

Use Node 24 and npm 11. From this directory:

```powershell
npm ci
Copy-Item .env.example .env.local
# Populate only designated test service origins and existing Clerk test keys.
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
| WORKSPACE_API_BASE_URL                                      | Existing Workspace drafts/documents/artifacts                                                                         |
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
rejects localhost; development keys or an approved preview origin are required
for signed-in browser acceptance. No shared backend change or migration is applied.

## Structure and verification

Thin App Router pages compose feature public interfaces. Features own focused
schemas, queries, mutations and UI; shared foundations own configuration, the
HTTP/session boundary, query cache, shell, CSS tokens and Radix primitives.
Schedule-X supplies calendar grids and React Flow supplies the organization
chart. Workspace items open the existing editor.

Current local evidence: 67 unit checks, 24 synthetic browser checks, TypeScript,
architecture and production build pass. ESLint passes with one static SVG image
warning. Representative screens were reviewed against current Figma, including
desktop and phone dark captures; full workflow/visual acceptance remains open.
The actual Next production server also passes setup/deep-link/fail-closed proxy
checks without configured credentials. These checks do not establish live
authentication or mutation acceptance. Nine authorized core read projections
passed against capiro-internal. Structured meeting preparation was corrected
from live evidence; native Clerk initialization failure now has a retry screen.
The previous dependency audit found zero
production advisories; ESLint's development-only braces advisory remains open.

The local preview now uses existing Capiro development keys saved outside Git.
Its real sign-in form loads, and an unauthenticated core proxy call returns 401.
That development instance lacks capiro-internal membership and the capiro JWT
template; matching backend trust/tenant configuration or an approved isolated
production-auth preview origin is still needed for signed-in product acceptance.
Activity history search/type/civil-date filters and clear use the latest 500
records already fetched. They do not imply a complete historical calendar feed.

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
