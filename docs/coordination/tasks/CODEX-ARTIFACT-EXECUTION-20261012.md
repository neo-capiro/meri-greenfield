# Artifact execution source outline

Base: PR37 `e5fb3963de787bbd7b7663316c368f15814897da`; root outline `7754f1d4`. This lane owns only new `apps/artifacts/`, private `packages/contracts/artifacts-0.2/`, artifact-specific tests and this named task/report/evidence. Independent review belongs to `native_supervisor_author`; root owns canonical integration. No existing worker, public contract, registry, loader, lock or migration changes.

## Responsibilities and proposed modules

- `artifacts-0.2/artifact.schema.json` and `artifact-validation.mjs`: bounded original typed content/request contracts, canonical public references, inert snapshots. No model-supplied authority, executable code, paths or import names.
- `apps/artifacts/service.mjs`: create/revise/inspect/download, fresh injected current authority, budget/deadline checks, immutable version/provenance and expected-parent CAS. The SDK owns language interpretation and model orchestration. Filing consumes the existing exact public ObjectReference tuple; it remains the command owner's operation.
- `apps/artifacts/local-store.mjs`: explicit local immutable object/version persistence for source tests and later host qualification, not S3/PostgreSQL deployment acceptance. Commit ambiguity is reported and never silently retried.
- `apps/artifacts/local-executor.mjs`: fixed-entrypoint bounded local child process adapter, bounded JSON/stdout/stderr/file output, abort/deadline and owned process/directory cleanup. This is not an OS sandbox and admits only product-defined typed work.
- `apps/artifacts/python/office.py`, `analysis.py`, `entry.py`: adopted python-docx1.2.0, XlsxWriter3.2.9, openpyxl3.1.5 and typed pandas analysis. Original implementation, no host skills or old Capiro generator imports/copies.
- `apps/artifacts/presentation.mjs`: adopted PptxGenJS4.0.1, fixed entrypoint and typed editable slides. Exact installed module path remains an input prerequisite, never substitute python-pptx or install a package.

## Coverage and qualification

All four selected obligations remain in the ledger: `create_word`, `create_excel`, `create_powerpoint`, `run_analysis`. DOCX/TXT generation, spreadsheet generation and supported edits, editable slides, immutable revisions, provenance and exact downloads are product responsibilities. Typed table analysis can implement transforms/joins/deltas/aggregates/charts without arbitrary code. It does not close unrestricted computation. PDF/render/Office opening, formula recalculation and fidelity, per-page/slide inspection and native sandbox qualification remain explicit separate requirements. Missing installed libraries block only their real local replay, not unrelated source work. No source test or injected success can mark those runtime gates qualified.

Read R2, COMPONENTS, all14 original workflow intent records, public ArtifactVersion/ObjectReference/SourceEvidence and existing exact-version filing contract. Workflow intent coverage is not reclassified by this artifact lane. ArtifactVersion.versionId and ObjectReference.versionId retain their distinct public meanings. Public0.1 is frozen/private0.2 is new.

The selected host has exact adopted Python Office libraries by metadata; PptxGenJS has not been located in inspected existing paths. Python3.12.14 and Node24.19.0 are source-test hosts, not admitted production images. pypdf6.10.0 differs from the recorded6.20.0; it is not selected as a replacement. No native Office/browser/worker/container probes are authorized. Native owner evidence must be bound to exact source/image/artifact/manifest before reuse.

## Verification and effects

Focused contract and connected source tests use tiny synthetic inputs in owned temporary directories only. Exercise real library output, immutable original/revision bytes, formula/cell distinctions, denied/revoked authority, stale versions, duplicate commits, late ports, abort/deadline, unknown effects, no shell/code/path injection, bounded output and cleanup. Preserve every failed raw run and corrected preimage. Independent source review follows immutable freeze; no broad/native/provider/SQL/runtime tests. Resource receipts report actual source-local behavior, not durable budget or sandbox proof. Disk is constrained; no installs, dependency-tree copy, package/network calls, paid calls, customer data, cloud, database or security changes.

Recorded before production implementation; API proposal sent to root and independent reviewer. Shipping context: reported frozen d5 build `18b3316a-9403-40f9-807b-3ddf24c40d7b` failed at20:06:43UTC with Docker exit1, no image/scan; SDK/runtime/image ownership remains separate.
