# Wave 5 runtime foundation composition — 28 October 2026

## 1. Scope
Local integration foundation only. Combine current Meri main `52dcc7a0876793e7cebcf6255d4078d3e37e650e` with accepted public/private foundation `96dcd18703fd3f51999c0385d4948740727f3173`. No push, main merge, build, deployment, native activation or product acceptance.

## 2. Source ownership
Owned branch `codex/wave5-runtime-integration-20261028`. Original checkouts and immutable package archives remain unchanged. M5 owns later package/version/generator composition; this merge preserves its exact accepted .25/.12 foundation.

## 3. Composition
The single production conflict was the public route allowlist. Preserve both current-main `/api/action-followthrough/query` and Wave 5 `/api/routines/session`. Current-main runner normalizes stored null selection to the existing optional absence; that implementation is unchanged. Its affected test now compares the execution plugin's 13 generic identities, while the accepted Bill Watch tests retain 14 launchable original identities and explicit selected Bill Watch behavior. Update the route test's expected count for the retained additional route.

## 4. Checks
Node 24.22.1, module mocks, serial test files. `apps/runtime/test/control-route-boundary.test.mjs`, `apps/runtime/test/runner-skill-plugin.test.mjs`, and `packages/skills/test/bill-watch-workflow.test.mjs`: 16 passing tests at the final source bytes. `apps/runtime/test/control-route-boundary-actions.test.mjs`: 8 passing tests, including current bearer/client/retention refusal. Logs in the orchestrator work directory: `wave5-runtime-foundation-integration-qualified-2.log` (16 pass plus one then-uncollected Actions file) and `wave5-runtime-foundation-actions-final.log` (that file subsequently 8/8). Git diff check passes. No broad suite or whole architecture gate was run.

## 5. Dependency repair
Retained S3/SDK/saxes targets were absent. Existing links were retained under local renamed paths. Exact locked `npm ci --ignore-scripts --no-audit --no-fund` ran only in this owned checkout's root, qualification, storage, window-resolution and UI-stream packages, with task-local npm 11.9/cache. Root and qualification exits 0 and hashes unchanged; storage installed 40 packages but its first PowerShell wrapper stopped on npm's stderr notice, then `npm ls --all` returned 0 and lock hash remained unchanged. Later focused tests loaded that installed tree successfully. No shared cache mutation, lock update, postinstall or browser download. Ordinary install logs are retained under `work/runtime-union-*`.

## 6. Reused evidence
Accepted exact .25 source/public package and private foundation reviews remain valid for unchanged bodies. Current-main null normalization, query-route admission and unavailable-session classification remain present. No CI-green claim follows from absent remote checks.

## 7. Limits
This is not the complete Wave 5 runtime union. Paging/MM13, active uploads, later native CONTROL integration, child/event/procedure and other ready private slices still require explicit ordered composition. Source review and native/image/deployed acceptance remain separate obligations.

## 8. Remaining work
Integrate accepted paging `dc8358690`, correction `c898f426f`, and attachment adapter `5fb6edf38` with the coordinated private revision-source and product configuration spans preserved. Do not activate publication v2 writes without its compatible rollback floor and explicit activation.

## 9. Handoff
A5 owns this local runtime integration; M5 owns final public-package lineage. No target operation or implicit serving cohort change is authorized by this checkpoint.

### Subsequent accepted paging and attachment composition
The foundation commit is `082cbdf7b7f3c7d06252c4420fc244b4237e07c1` / tree `d01449a1e3634f95d427d193ced084230d4c3e02`. Ordered unchanged source deltas `dc8358690`, `c898f426f`, `5fb6edf38` became local commits `8dd669125`, `dd5f6c43a`, `e34dd7426`. Both coordinated spans merged cleanly: `read(..., revisionSource)` keeps the private original-source return and now calls bounded `recoverVersion`; product documents forwards the closed `publicationPagedWrites` switch defaulting false. No v2 write activation, migration or native proof was rerun.

`wave5-runtime-paging-attachment-composition.log` passed29 cases covering private revision/current bytes, production publication gate, docs composition and real prior-chat context/read/final currentness. Three context inventory assertions were stale relative to current main: it already has58 keyed registered reads and the actual `watch-state` current producer, while the old census expected50 and omitted that explanatory mapping. The attachment adds one, so the current count is59. Add only the pure inventory string naming the existing `source-read-context.mjs` producer; no runtime authority behavior changes. `wave5-runtime-context-inventory-final.log` then passes5/5, including the same registered attachment case; the final affected set is32 cases, not34 unique cases. Exact original paging/attachment source reviews and local native PG evidence remain reused. A bounded integration review remains required; no whole source campaign or final package metadata binding is claimed.
