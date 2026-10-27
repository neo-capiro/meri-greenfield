# Wave5 M5 immutable artifact history

## 1. Scope and owners

MM-11 / MF-14 producer prerequisite: durable known-artifact history, through the existing storage, service, document HTTP and current Core owners. M5 owns storage/service/routes and Git in this checkout. A5 owns the coordinated public contract, authority intent wire and isolated Core peer. Hermes remains independent reviewer. This incremental slice does not close the full library/discovery or frontend requirement.

The agreed implementation outline reuses the existing publication journal and verified SQL projection to reconstruct a bounded immutable chain; the service applies existing current-context and retention fences, then selects a cursor-bound page; HTTP performs closed input validation and release checks. No second file store, model loop, write allocation, migration, provider integration or secret is introduced. Public contract generation is serialized with A5 after route-source freeze.

## 2. Base and checkout

- Branch: `codex/wave5-m5-artifact-history-20261027`.
- Base: `1f1ca0e3aacefb2e001f45fa4fa4ae91e9c30cb2`, tree `9b9f536da807f8f47d916b2107be1227645a97c6`.
- Task checkout: `work/wave5-m5-artifact-history-20261027` under the Wave5 orchestrator workspace.
- Original PDF, package producer, MF19/consumer and integrated source branches remain unchanged. Physical contracts0.1.22 / UIstream0.1.9 archives remain immutable.

## 3. Behavior and boundaries

`POST /api/documents/history` receives exactly `{versionId, limit, cursor}`. Limit is an integer1–100; cursor is null or lowercase64hex. The response is `{artifactId, anchorVersionId, headVersionId, versions, nextCursor}`. Every page preserves original version/binding/scope/evidence bytes, ordered newest to oldest. The old anchor is verified in the complete chain even when it lies outside the current page.

Storage verifies complete durable publication/SQL agreement, immutable parents and current retention before returning metadata. The service checks every version against the current tenant, actor, conversation and scopes, checks current authority/retention before collection and release, and rejects malformed/duplicate/substituted chains. The runtime's existing current Core admission and release checks remain active. Completed-run reads require no accepted write run or new budget reservation.

The opaque cursor is a page selector, never authority. It binds the exact freshly verified chain, anchor, page size and current binding/scopes. Changed head, visibility/context or query invalidates continuation with409 `ARTIFACT_HISTORY_CURSOR`; callers restart discovery. History reads no object bytes, grants no inspect/download brand, and makes no preview/native-open/render/recalculation claim. All six retained formats are eligible, while writer/preview gates remain unchanged.

## 4. Author checks

Node24.22.1 on Windows, retained dependency caches through task-owned junctions; no installation or shared-cache mutation.

- `node --test apps/artifacts/storage/test/history.test.mjs apps/artifacts/test/history.test.mjs apps/control/document-application/test/history.test.mjs`:16/16 PASS. Includes12-version pagination after service reconstruction, immutable projection/corruption/retention checks, query/context/head-bound cursors, closed requests, exact PDF/text metadata, no byte/generation/delivery effects, and actual runtime admission/release behavior.
- Existing `pdf-read-admission.test.mjs` and `storage/test/find-by-object.test.mjs`:12/12 PASS alongside the first route run.
- `git diff --check`: PASS at source freeze.
- Both canonical generators and `--check` PASS. Public receiver/native/current-read checks218/218 PASS; focused authority wire3/3 PASS; public TypeScript PASS. Core peer `13fb7a401c0249bd50c90d163b6dfaf67fcafd46`, tree `aa91d4771c0a97d8bdd3bc6ba58a3cf27a606549`:28/28 plus bounded TypeScript PASS. New public-history tests failed against the unchanged old receiver with `INVALID_ROUTE`; Core witness was3failed/23passed on its unchanged base.
- Direct physical0.1.22 compatibility: six inspect pairs, six download pairs and18 matching refusal pairs PASS. Existing schema definitions/statuses are preserved except the deliberate new history error. The old receiver refuses history. Receipt: orchestrator `work/wave5-m5-history-compatibility.json`.

## 5. Evidence and limits

Author logs in the orchestrator's `work/`: `wave5-history-focused-tests.log`, `wave5-history-route-tests.log`, `wave5-history-runtime-route-tests.log`, `wave5-history-owner-tests.log`. All use synthetic identifiers, scripted SQL/publication/object transports and canonical production owners. They do not qualify PostgreSQL grants/transactions against a native database, deployed access, provider durability, real renderer output or browser acceptance.

The reused runtime authority suite initially could not collect because ECS and then S3 dependencies were absent. Retained exact caches were linked without installs. Six unrelated old authority-fixture failures then reproduced exactly on a clean1f1 baseline with the same dependencies (base2passed/6failed; candidate4passed/6failed); fixtures/product code were not broadened to fix them. A5 preserves the original failures and exact-base comparison. No aggregate runtime gate, build, browser, target or model call was run.

## 6. Contract and package dependencies

A5 adds explicit read intent mapping to `artifact.inspect` and document-access0.2.0 history request/response validation and types. Strict schema additions require a new wire version; RuntimeVersions.contracts0.1.0 is unchanged. Public history results never enter the receiver's admitted-version set. Frozen document-application0.1.0 runtime/types/schema remain byte-identical. Its generator excludes only the history-only cursor error after asserting409, and its metadata is canonically refreshed. Root explicitly approved that limited shared-generator correction.

No npm version was allocated, package packed, lock changed, archive overwritten or registry publication performed. The new contract and later library changes require a separately allocated package/consumer integration before release.

## 7. Remaining requirement

MM-11 still requires owner/client/conversation discovery with bounded pagination and fresh current authority per retained origin; denied/suppressed results must vanish without treating saved scope facts as authority. A5 is defining the private same-bearer Core origin check. Existing history/inspect/download same-conversation fences will remain intact. MF-14 still needs the matching durable library/detail/history/deep-link frontend; local10/event state is not a library. Rename/archive/delete/share/comments remain unavailable until an existing approved owner supplies their semantics. Filing reuses canonical Portfolio receipts.

## 8. Resources and cleanup

No target, browser page, database, model invocation or background service was created. Test processes exited. Reusable dependency links and the owned checkout are retained. Shared caches, original source checkpoints and all physical package archives are unchanged. Nothing was replaced that creates dead executable code; the existing read/write/preview routes remain in use.

## 9. State and next action

READY FOR REVIEW as an intermediate history producer checkpoint; exact head/tree follow in the external author receipt. Continue full library through the existing owners with fresh per-origin current authority and bounded truthful pagination. Independent review, package allocation/consumer integration, native qualification and deployed Hermes acceptance remain owed. No push, merge or shipment is claimed.
