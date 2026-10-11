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
- Verification: focused meaningful units and actual ProspectDetail composition browser harness on temporary5194, type/lint/format/architecture, synthetic responsive visual review. No installs/build caches/live generation/customer writes; root owns full build and live acceptance.

## Material current contract dependencies

- PROS-022: saved brief is deterministic dossier-derived content with five sections. No current contract establishes the Figma candidate objectives, PE-budget table,30-day strategic plan or automatic conversion carry-over. These facts are not synthesized in the frontend.
- PROS-023 / Workspace: no verified Workspace artifact/document ID or filing association exists in brief responses. Viewer is labeled saved prospect brief, with a structured section edit form; no fabricated Workspace route, Share/Export success or second Plate editor.
- Refresh: GET proposal returns snapshotHash, but POST refresh-accept only accepts idempotencyKey/expectedVersionNumber/keepUserEdits and rebuilds the dossier before locking. It cannot guarantee the reviewed snapshot. Preserved edited sections carry old citation indexes while accepted citations derive freshly. Root was notified; preview/diff is unblocked, apply requires a pinned proposal and source-identity remapping contract.
- Shared HTTP preserves ApiError.status/message but discards structured conflict metadata. Feature fetches the verified latest read for explicit conflict review rather than adding a competing client or editing shared HTTP.

## Validation / final evidence

Pending implementation and focused checks. Baseline audit remains read-only. PROS-022/023 remain partial pending real services and the specific product/Workspace/refresh dependencies above.
