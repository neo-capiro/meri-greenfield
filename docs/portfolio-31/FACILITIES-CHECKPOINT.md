# Facilities implementation checkpoint

- Branch: `codex/portfolio-facilities-20261011`; base `fee93f34888ba5f420cd79807067612e8c82bb5d`.
- Shared policy: `b32b4803933760dc0a93fffdcd8fba30a89c3aac`, fetched 2026-10-11; machine map timestamp 2026-09-30T00:21:48Z.
- Scope: CORE-033 through CORE-044. No backend/provider writes, migration, deployment or shared auth changes.

## Implementation outline

The Overview card composes the client facility query, map and location selection. Facility form rendering stays in `FacilityDialog`; geocode, candidate and removal orchestration lives in focused facility mutation hooks. Additional map/representation response projections and their reads belong to `facility-map-*` modules. All reads and writes use the existing authenticated HTTP client, client-scoped cache keys and server authorization. A query filter is not an authorization control.

Facility selection opens verified address, district provenance and elected representation. Geocode retry is asynchronous and polls until a changed status/attempt is observed; explicit resolution is synchronous. Candidate selection sends only the original candidate index to the server; the browser does not forge geocoding results. Removal requires confirmation and checks `{ deleted: true }` before closing. Successful mutations invalidate facility, representation and nexus caches.

The current Figma visual references are 411:47066 (Overview map and plus), 411:58269 (manage facilities) and 411:47694 (location details). Real facility coordinates and current boundary geometry must drive geographic placements; example Figma locations, senators, staff counts, money and scores never populate production. The existing map artwork is retained as reference artwork while real geometry is unavailable.

Verification: focused projection/validation tests; browser client binding, geocode candidates, errors/retry, removal, representation and map keyboard/responsive behavior; TypeScript, lint, architecture and production build. Live designated backend writes remain NOT RUN.

## Contract and behavior notes

- CORE-033: `GET clients/:clientId/facilities`, validated client binding. Coordinate strings are converted only when finite and within geographic ranges. Unknown/unmapped coordinates stay in the list.
- CORE-034/035: `POST facilities` / `PATCH facilities/:id`, real existing persistence, nullable clearing, whole headcounts including zero, named state districts (64 characters). Form retains existing state/city body semantics. The plus opens the selected client's form.
- CORE-036: `DELETE facilities/:id`; confirmation, no automatic retry, requires `{ deleted: true }`, preserves rejected-operation errors.
- CORE-037: `POST facilities/:id/resolve-district` waits for the resolver's result. Source controller lines 227 onward; service resets state then awaits geocoding.
- CORE-038: `POST facilities/:id/geocode` queues work and returns the saved row. The UI says "Retry requested", never "Resolved" from the acknowledgement. Existing pending-status polling remains; recent scheduled attempts are also polled for a bounded two-minute interval.
- CORE-039: `POST facilities/:id/geocode-candidate` with `{ candidateIndex }`, using the original server array order; server chooses and persists the candidate. Response identity is checked.
- CORE-040: lazy `GET clients/:clientId/representation`, with explicit unresolved reasons and null/empty roster states. No invented representative/committee/relationship labels.
- CORE-041: lazy `GET intelligence/clients/:clientId/district-nexus-v2`; displays actual score/null, coverage, breakdown, warnings and freshness. It does not compute financial totals or probabilities. A disabled tenant feature/error is shown explicitly.
- CORE-042/043: manifest then current GeoJSON, cached by manifest hash. Source `directory/boundary-artifact.util.ts` interfaces 44 and 73. No direct bucket/provider URLs. Manifest controls the source caption; full byte/hash transport qualification remains a live check.
- CORE-044: D3 `geoAlbersUsa` and `geoPath`, actual boundary polygons, numeric facility coordinates, keyboard facility/district selection, bounded zoom, pan/reset controls. RFC winding is normalized without mutating source geometry. Alaska/Hawaii insets are handled by D3; territories outside its projection remain available in the list. No approximate coordinates are placed over the illustrative dot artwork.

Canonical sources were inspected in `C:\dev\cap-portfolio-prospect-stages-20261011` (client-facilities controller/service, representation resolver, district-nexus types/controller and boundary artifact utility). HTTP proxy already accepts the required roots and auto-decodes compressed upstream response bytes. No proxy/settings changes were needed.

## Visual and architecture decisions

Figma's exact plus (16px), maximize (15px), dot (8px), map marker (24px), zoom controls (14px) are local assets under `public/design/411-47066-*`. Intrinsic SVG dimensions are preserved. Actual boundary geometry replaces illustrative geography when saved coordinates exist. Fixture-only rectangles in browser screenshots explicitly represent synthetic geometry, not the national dataset. Current Figma styles are applied to the compact header/list and the 600px detail, with three real-value statistic slots. The backend has employee counts, not planned-job semantics, so that slot says Employees. Relationship strength, committee names and "why it matters" are omitted where this contract provides none.

The map renderer composes presentation; `facility-map-view` owns viewport measurement/observer cleanup and pointer/keyboard state; the projection module owns D3 geometry normalization; the query module owns authenticated source access/cache; the mutation module owns geocode/remove orchestration. Facility form and elected representation rendering remain separate. The two longer rendering/view functions were reviewed for cohesive responsibilities; fetching, form mutations, permissions and geometry algorithms are separate. No shared state provider, second HTTP client, competing editor or new map provider was added. D3 was added centrally by the parent in `5b9b0f0` (cherry-picked dependency commit `37eb1bb`), pinned 3.1.1, ISC; types 3.1.1, MIT.

The existing facility edit browser case in `bills.spec.ts` needs the intentional navigation update: select location -> Edit facility. Preserve its nullable-clear assertions. The House representative action composes `AddGovernmentTargetButton` from the Relationships public interface (parent source commit `d5998643f13d2ded6ce549beef2c8d9fdf93eaef`, local dependency `8d2b8e2`). Relationships owns identity/role checks, target reads/writes, pending-state repeat prevention and client/member/directory receipt validation. The facility feature imports no private cross-feature hook or duplicate write client.

## Evidence limitations

All row states remain partial until designated signed-in UI/live acceptance. No live facility creation, address-provider request, candidate choice or deletion was performed. Parent integration owns final full-suite regression, authenticated preview and exact source/PR coverage matrix updates. No deployments or external effects occurred.

The existing candidate write accepts only an index, without an expected candidate/address revision. An unavailable index is rejected server-side, but another edit can replace the array at the same index between read and write. This needs a coordinated backend precondition contract if stale-selection prevention is required; the frontend cannot add a field the current API does not accept.

## Check results (2026-10-11)

- PASS: 71 unit tests / 10 files, including four new facility contract/projection/form cases; exit 0.
- PASS: five focused browser scenarios / exit 0, isolated component server port 5194. Synthetic intercepted API fixtures only. Covers real coordinate projection, native asset geometry, keyboard selection and vertical/horizontal pan, zoom/reset, representation, null scoring, client-correct links, dark phone layouts, candidate index selection, synchronous error/no automatic retry, queued retry, rejected then successful confirmed removal/cache invalidation, fail-closed foreign-client response, and the resolved House target action: failed save without automatic retry, wrong-directory receipt rejected on explicit retry, successful receipt/cache invalidation, and already-saved state after reopening without another POST.
- PASS: TypeScript; ESLint (existing ProspectPipeline image warning only); architecture 176 modules; formatting; optimized Next build 17 routes; all exit 0.
- PASS: actual visual review of desktop map, geocoding/location detail and dark phone map/detail against the fetched Figma structure and tokens. Synthetic geometry is visibly synthetic; national-shape/live positive-coordinate acceptance remains NOT RUN.
- Preserved target integration locator failure: the exact accessible name contains a space before the colon; corrected the test locator to the observed name without weakening receipt/error assertions. Results and trace retained under `target-initial-browser/`.
- Preserved initial browser failure: asset inspection attempted the aria-hidden background after a modal opened; fixed the inspected scope before/inside the modal, preserving intrinsic-geometry assertions. Initial trace/results retained separately.
- Evidence: parent task `work/facility-agent-evidence/final/` (browser JSON, five screenshots, type/lint/architecture/unit/format/build logs); initial failure under `initial-browser/`.
- NOT RUN: signed-in final Next build facility flows, live provider writes, national dataset projection, backend cross-user access checks. Parent's approved preview/issuer and live-read harness own these integration checks. A component fixture browser pass does not establish those criteria.

Remaining design details: exact combined manage-facilities dialog, marker hover popover/active-marker state, saved relationship-strength/committee context. The verified controls and data are wired, but these row-specific visual/action details prevent declaring the entire audit group complete.
