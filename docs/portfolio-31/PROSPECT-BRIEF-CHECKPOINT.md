# Prospect federal strategy brief checkpoint

## Pinned scope and implementation outline (before coding)

- Isolated checkout `C:\dev\meri-portfolio-facilities-20261011`, branch `codex/portfolio-prospect-brief-20261011`, clean base `f0fbc06abc404af61ed6f072561cfb62e3cbb3bb`. Previous preparation branch/commit/evidence preserved.
- Policy `b32b4803933760dc0a93fffdcd8fba30a89c3aac`, fetched remote `b2b0ce8c2bf03817b81e671d968b7892985b8d06`; clean ahead history preserved. Machine map revision `2026-09-30T00:21:48.2698715Z`.
- Read repository/app AGENTS, implementation standards, installed Next use-client guide, mandatory Figma design-to-code skill. Current Figma context and screenshots: `411:65188` and `411:65258`.
- Backend reference only: `C:\dev\cap-portfolio-prospect-stages-20261011`, `fd6ed6c017ae91ab774fd34f74475a746de13b68`; current controller/DTO/service/types/util/legacy bizdev-api inspected. An initial switch command accidentally targeted that reference checkout but failed before changing its branch or files; clean original branch verified immediately. All source work belongs to this frontend checkout.
- Own `features/prospects/brief/**`, focused unit/browser tests and this checkpoint. Root owns ProspectDetail composition, canonical Prospect/shared HTTP/auth/fixtures/lockfiles. Public interface `ProspectBrief({prospectId})`.
- Cohesive modules: canonical brief schemas and receipt-bound API adapter; server-state hooks; scoped card/viewer; structured plain-section edit form; immutable version/source viewer; read-only refresh comparison. Routes compose features; no second rich document editor or Workspace implementation.
- Reuse HTTP client, session cache boundary, identity/canonical prospect query, QueryClient invalidation, Radix Dialog, TextareaField, design tokens/Geist/Newsreader. No dependencies, copied legacy implementation or new providers.
- Reads preserve exact five sections, citation indexes, attribution, dates, snapshot identity and versions. Writes preserve server-owned citations, bound tenant/prospect/version receipts, optimistic version expectations and frozen idempotent retries. 409 retains the local draft and requires an explicit latest-version review before a new attempt. No automatic re-generation after an ambiguous response.
- Server authorization: controller standard_user+ and tenant Phase1/brief feature flags; 404 is indistinguishable disabled/unavailable/missing, never treated as an empty brief. Archived brief is shown read-only; no speculative lifecycle operation.
- Verification: focused meaningful units and actual ProspectDetail composition browser harness on temporary port 5194, type/lint/format/architecture, synthetic responsive visual review. No installs/build caches/live generation/customer writes; root owns full build and live acceptance.

## Material current contract dependencies

- PROS-022: saved brief is deterministic dossier-derived content with five sections. No current contract establishes the Figma candidate objectives, PE-budget table, 30-day strategic plan or automatic conversion carry-over. These facts are not synthesized in the frontend.
- PROS-023 / Workspace: no verified Workspace artifact/document ID or filing association exists in brief responses. Viewer is labeled saved prospect brief, with a structured section edit form; no fabricated Workspace route, Share/Export success or second Plate editor.
- Refresh: GET proposal returns snapshotHash, but POST refresh-accept only accepts idempotencyKey/expectedVersionNumber/keepUserEdits and rebuilds the dossier before locking. It cannot guarantee the reviewed snapshot. Preserved edited sections carry old citation indexes while accepted citations derive freshly. Root was notified; preview/diff is unblocked, apply requires a pinned proposal and source-identity remapping contract.
- Shared HTTP preserves ApiError.status/message but discards structured conflict metadata. Feature fetches the verified latest read for explicit conflict review rather than adding a competing client or editing shared HTTP.

## Validation / final evidence

### Delivered behavior and structure

- Early feature/unit commit `cabd98e12da8a0f4b912af7ac7f3607f358b6233`; root integrated it as `7800953`. Root composition/font commit `ea81a67d2afa37fad918826b02303b8e1bbcfbb5` is local `ef709ef`. The final follow-up contains only allocated feature/tests/checkpoint paths.
- `contracts.ts` validates the canonical saved brief, exact five structured sections, immutable versions, citation counts/references and root/current-version bindings. `api.ts` binds tenant/prospect receipts, requested saved version IDs/numbers, optimistic version expectations and complete citation identity. Idempotent write replays may reference an older version; they invalidate the current read and are never projected as the current version.
- `hooks.ts` owns focused server state and cache invalidation. `editing.ts` preserves unchanged provenance and citation indexes; explicit conflict rebase carries only local edits onto the latest version and remaps by the exact saved citation record. A changed title/date with the same source ID cannot silently inherit attribution.
- `ProspectBrief` fails closed on unavailable/failed identity and unmounts its scoped state when user/tenant/prospect changes. Disabled/missing 404 cannot appear as an empty enabled service. Initial creation supports both a missing root and an existing draft root without a saved version. 401/403 are rejected operations with no resend; ambiguous outcomes retain a frozen explicit retry request, without automatic regeneration.
- `BriefViewer`, `BriefDocument`, `BriefHistory`, `BriefSource`, `BriefRefresh` and `BriefEditor` separate rendering, read history, source attribution, comparison and structured text edits. Unknown save results keep the original immutable payload/key. Version conflict keeps the local draft, requires latest-version review and explicit rebase, and then requires a separate save. Saved archival content is read-only. The verified service does not block converted/dismissed prospects, so no invented prospect-status rule was added.
- Version/source dates use readable `<time dateTime>` values with original timestamp tooltips. Date-only source dates preserve their calendar day; timestamps include the viewer's time zone. Historical citation views use their immutable saved snapshot and never resolve against current citation indexes. Safe HTTP(S) links retain original source attribution; unsupported locators remain plain text.
- The editorial paper matches the inspected Figma geometry (860px paper, desktop 56/64px padding, Newsreader 40px title/20px headings/15px body) and responsive dark surface. Licensed self-hosted Newsreader is supplied by root's composition commit; the browser asserts the font is loaded and applied. No mock objectives, financial values, automatic Workspace filing, Share/Export control, or unsupported refresh apply is presented as working.

### Exact checks

Final focused qualification completed `2026-10-11 06:11:49 UTC` using bundled Node `v24.19.0`, executable `C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`. No global PATH change. Browser server children use the same `process.execPath`.

| Check | Result | Evidence |
| --- | --- | --- |
| TypeScript `tsc --noEmit` | Exit 0 | `typecheck.log` / `results.json` |
| ESLint allocated feature + unit/browser tests | Exit 0 | `lint.log` / `results.json` |
| Vitest `tests/prospect-brief.test.ts` | 14 passed, exit 0 | `unit.log` |
| Actual ProspectDetail browser composition | 11 passed, 0 skipped, exit 0 | `browser.log`, `prospect-brief-results.json` |
| Architecture | 224 modules, exit 0 | `architecture.log` |
| Prettier allocated source/tests | Exit 0 | `format.log` |
| Full Next build / real backend acceptance | Not run in this bounded agent task | Root owns integrated gates; no live writes or provider calls |

Browser scenarios cover frozen generation retry after lost response; explicit conflict review/rebase with preserved draft; first saved version for an empty draft root; ambiguous edit frozen retry; date-only source attribution and historical source isolation; read-only refresh versus preserved edits; 404/role failures; mobile dark mode and wrong-tenant receipt rejection; denied edit; archived read-only and failed identity; denied creation without ambiguous resend. Tests use a Clerk stub and synthetic intercepted API responses. They verify the real components and contracts, not deployment authorization, persisted live services, LLM output or customer data.

Evidence directory: `C:\Users\Administrator\Documents\Codex\2026-10-10\implement-capiro-3-1-portfolio-in\outputs\evidence\prospect-brief-20261011`.

Representative screenshots: `prospect-brief-desktop.png`, `prospect-brief-mobile-dark.png`, `prospect-brief-conflict.png`, `prospect-brief-source.png`, `prospect-brief-refresh.png`. Visually reviewed final desktop/mobile/source captures against Figma context; mobile Close remains at the top right, paper scrolls, and no page width overflow. `failed-checks.md` preserves the initial lint failure and its correction. No tests/assertions/baselines were weakened.

Temporary port-5194 qualification config/server files are outside the source commit; a small copy is retained in the evidence directory. Root's canonical `playwright.config.ts` and component server can run the committed new browser spec. No alternate product architecture or permanent port change is introduced.

### Remaining specific dependencies

| Audit IDs | Dependency / required action | Owner |
| --- | --- | --- |
| PROS-022 / PROS-023 | Authorize and verify current brief feature flags, designated account reads and write acceptance in the isolated environment. Production-origin browser authentication remains a root integration dependency. No agent live generation/customer mutation was attempted. | Root / auth and backend owners |
| PROS-022 | Define approved source and semantics for candidate objectives, PE-budget/30-day planning content and conversion carry-over where retained in current product intent. Existing five-section brief is shown exactly; no inference fills these fields. | Product / Objectives and conversion owners |
| PROS-023 | Provide canonical Workspace document/artifact association and supported filing/open behavior. The saved BD brief has no verified Workspace ID. | Workspace / Meri owner |
| PROS-022 / PROS-023 refresh | Register, persist, review and deploy the strict pinned refresh candidate before any UI apply action. Backend owner `/root/portfolio_intake` prepared a separate candidate with durable reviewed proposals, expected base version/identity hash, exact content hash, expiry, actor scope, idempotent apply and version-bound citation resolver. Proposed SQL is unallocated/unapplied; legacy apply remains unavailable in this UI. | Backend brief owner / root |

Baseline audit remains read-only. PROS-022/023 are **partial**, with existing saved-brief workflows implemented and synthetic qualification complete. They are not marked fully complete without real acceptance and the explicit product/Workspace/refresh decisions above.
