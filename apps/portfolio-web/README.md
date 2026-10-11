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
| INTELLIGENCE_API_BASE_URL                                   | Intelligence feeds; feature contracts still being revalidated                                                         |
| MERI_API_BASE_URL                                           | Reserved; no alternate Meri implementation                                                                            |
| CAPIRO_EXISTING_APP_URL                                     | Existing Workspace/Strategies/meeting preparation deep links                                                          |
| CAPIRO_MERI_URL / CAPIRO_MODULES_URL / CAPIRO_WORKSPACE_URL | Existing shell destinations; unavailable actions stay visibly disabled                                                |
| NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY / CLERK_SECRET_KEY        | Existing designated Clerk test application; matching test/live environments required                                  |

Origins include the deployed prefix, for example `https://test.example/api`.
Browser requests go through `/api/backend/<service>/...`; the server obtains the
existing `capiro` JWT and does not trust browser tenant or permission headers.
Configuration rejects URL credentials, query/fragment and non-loopback HTTP.

## Preview hosting dependency

No hosted preview exists. A separate target, hostname and its Clerk test origin
must be allocated by the hosting/auth owner. Do not point shared routing at this
app or reuse Meri qualification resources. The reproducible build and runtime
commands above are ready for that isolated target; its server environment must
map each service explicitly. Backend origins and the designated test identity
remain pending from the human. No shared backend change or migration is applied.

## Structure and verification

Thin App Router pages compose feature public interfaces. Features own focused
schemas, queries, mutations and UI; shared foundations own configuration, the
HTTP/session boundary, query cache, shell, CSS tokens and Radix primitives.
Schedule-X supplies calendar grids and React Flow supplies the organization
chart. Workspace items open the existing editor.

Current local evidence: 45 unit checks, 8 synthetic browser checks, TypeScript,
ESLint, architecture and production build pass. This checkpoint still requires
full Figma asset/interaction review and live acceptance. Production dependency
audit reports zero advisories. ESLint's development-only braces dependency has
an outstanding upstream advisory; no incompatible lint downgrade was applied.

See `../../docs/portfolio-31/IMPLEMENTATION.md` and the task implementation matrix
for remaining workflows and contract dependencies. Historical audit API labels
are never treated as frontend completion.
