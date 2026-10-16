# Fable lane report: live documents (16 October 2026)

- Lane: PDF renderer binding, PDF admission behind a switch, preview publication, filing, native checks.
- Branch `fable/live-documents-20261016`, base `fable/live-base-20261016` @ `48a27c8d`.
- Nothing deployed. No cloud, credential, model/provider, paid build or migration action. No frozen contract, Dockerfile, lockfile or migration file edited. No candidate manifest created; no hashed row of candidate manifest g changed (checked against every changed and new path).
- Owner decision this serves: document generation, revision, preview and download are required for the first live version (FABLE-OWNER-DECISIONS-20261015).

## Outline

| Responsibility | Canonical owner | Change |
|---|---|---|
| Renderer admission and binding | `apps/artifacts/renderer.mjs` (new) | Qualified-renderer port. `available` only for a complete admission record (renderer id/version, exact executable, image digest, qualification id) that attests every sandbox requirement; otherwise a closed `unavailable` reason and a `transform` that throws `ARTIFACT_RENDERER_UNAVAILABLE` before any workspace exists. Ports are branded; raw converters and look-alikes are refused. No IO at construction. |
| Runtime executor binding | `apps/runtime/artifacts/composition.mjs` | `createFixedRuntimeArtifactExecutor({…,renderer})` binds only a renderer port; a raw `officeTransformer` is refused. |
| PDF admission | `format-admission.mjs`, `current.mjs`, runtime composer | `admitDocumentDescriptor(descriptor,{pdf})`; the document application accepts trusted `admitPdf`. The runtime composer sets it only when `pdfAdmission===true` **and** the renderer port is available, and only for `create_word`. Default off. |
| Office conversion | `apps/artifacts/office-transform.mjs` | Adds XLSX/PPTX → PDF (previews) and PDF → PDF through Draw import (native openability only). DOCX arguments unchanged. |
| Preview generation and publication | `apps/artifacts/preview/{render,record,service,local-store}.mjs` (new) | Artifact-owned preview service over the canonical ArtifactService read path. One bounded PDF preview per version, stored through the canonical object port, bound by an immutable preview record. |
| Preview HTTP and signed links | `apps/control/document-application/preview-route.mjs` (new), `http.mjs`, `index.mjs`; `apps/runtime/artifacts/{application,download-links}.mjs`; `apps/artifacts/storage/signed-download.mjs` | `POST /api/documents/preview-publish` and `/api/documents/preview`; runtime mount rechecks preview record reads/commits; signed links gain `target:'preview'`. |
| Filing | `apps/artifacts/filing.mjs` (new); `findByObject` on both version stores | The `resolveAttachments` port that the existing governed `artifact.file` command source (`apps/control/commands/source-http.mjs`) requires and that nothing supplied. |
| Native checks | `apps/artifacts/native/{checks.mjs,workbook_cells.py}` (new) | Openability, formula recalculation and reference totals through the admitted renderer port; evidence records only. |
| PDF page count | `apps/artifacts/structure/{pdf,file-structure}.mjs` | `verifyPdf` returns the verified page-tree leaf count; new `pdfPageCount`. Validation unchanged (the accepted page-tree fix is untouched). |

Preserved: DA-1/DA-4 retention code, DA-3 slide layout, PDF revision route and the `process.mjs` group drain are unchanged (none of those files is in the diff). UNKNOWN semantics, authority, CAS, replay and budget settlement are unchanged in the write path.

## What changed, by lane item

### 1. PDF renderer binding

- `RENDERER_SANDBOX_REQUIREMENTS` is explicit: `nonRootUser`, `noNetwork`, `readOnlyRootFilesystem`, `noNewPrivileges`, `dropAllCapabilities`, `privateWorkspace`, `boundedResources`, `noCredentials`. Each must be exactly `true`; a missing or false one is `RENDERER_SANDBOX_UNQUALIFIED` with `missingRequirements` naming it.
- Unavailable reasons: `RENDERER_NOT_ADMITTED`, `RENDERER_ADMISSION_INVALID`, `RENDERER_SANDBOX_UNQUALIFIED`.
- `createLibreOfficeRendererPort` requires the admitted executable to equal the configured one.
- Admitted receipts carry `qualificationId` and `imageDigest`, so every converted PDF names the admission it ran under.
- The admission record must come from the renderer qualification owner. The port checks shape only; it does not qualify a host. Nothing in product composition supplies one, so the product renderer is `unavailable` and PDF stays fail-closed.

### 2. PDF admission (switch, default off)

- The switch is `pdfAdmission` on `createRuntimeDocumentOptionsComposer`. The switch alone never admits PDF (tested with no renderer, an unadmitted renderer and an unqualified sandbox).
- With the switch on and an available renderer, the existing HTTP application serves PDF create/revise/inspect/download/replay unchanged (same canonical owners, budget, CAS and replay).
- The proposal from FABLE-S4-PDF-REVISION is implemented except the format list being unconditional: it is conditional on the switch and the renderer.

### 3. Preview generation and publication

- `publish(versionId)`: canonical `artifact.download` read (authority, retention gate, current bytes) → render (DOCX/XLSX/PPTX through the renderer port; PDF previews as its own bytes; TXT unsupported) → bounds (8 MiB, 1–500 pages, structurally valid PDF) → object write and read-back → canonical `inspect` recheck → write-once preview record commit. An existing record is returned (`existing`), with no render or write.
- A failure after the object write is `ARTIFACT_EFFECT_UNKNOWN` with `previewCommitted:false` and the written `objectId`; never a no-effect refusal.
- `read(versionId)`: canonical download read → record verified against the version (exact source digest/size/MIME, scopes, conversion provenance) → preview bytes verified → canonical download read again. A suppression or revocation between the two reads releases nothing (tested by suppressing during the preview byte read).
- Provenance in the record: source digest, preview object, page count, conversion method, input/output digests, `qualificationId`, `imageDigest`, `nativeQualified:false`.
- XLSX previews load with the fixed recalculation profile. Real LibreOffice shows the recalculated total (`Total 5`) where the generator stored a placeholder.
- HTTP: `preview` returns `inline`, `no-store`, `nosniff`, `Content-Security-Policy: sandbox; default-src 'none'`. 409 `ARTIFACT_PREVIEW_PENDING`, 422 `ARTIFACT_PREVIEW_UNSUPPORTED`, 503 `PREVIEW_UNAVAILABLE` when no preview store is composed. Pre-write refusals report `READ_UNAVAILABLE`; after the first effect, `UNKNOWN`.
- Signed links: `issue {versionId, target:'preview'}` signs the preview PDF digest with the extra claim `target:'preview'`; redemption reads through the canonical preview route. Download tokens carry no `target` and are byte-identical to the previous format (existing link tests unchanged).
- The frozen `ArtifactVersion.previewStatus` stays `pending`; publication state is in the preview record (proposal P1).
- Product: the composer composes previews only when given a preview store. Only the source-local store exists (a durable store needs a migration, proposal P2), so product preview routes stay 503 until then.

### 4. Filing

The governed `artifact.file` command source refused every filing with `COMMAND_SOURCE_VERSION_UNAVAILABLE` because no `resolveAttachments` port existed. `createArtifactFilingResolver` supplies it from the artifact owner:
- `findByObject` resolves the one version of this tenant conversation holding the selected object (PostgreSQL: unindexed JSON-path read on the existing table, decoded like `read`; local store: bounded scan).
- Canonical `artifact.download` read; the stored object must equal the selected reference exactly.
- The trusted host attachment broker (`attachments.register`, injected) registers exactly those bytes and returns `{attachmentId, sha256, bytes, expiresAtMs}`, which must match.
- Every version is re-inspected before the fact is released.
- Nothing is registered for an unknown, altered, suppressed or unauthorized object. Once a registration attempt starts, any failure is `ARTIFACT_EFFECT_UNKNOWN` with `registrationAttempts`.
- Tested end to end with the existing `createCommandHttpSource` (`prepare` + `execute` to the fixed `/clio/tools/save_chat_attachments` route, scripted fetch).
- Not done: the host broker itself and its wiring into the durable command composition (root/host owned; proposal P6).

### 5. Native checks

- `openability`: the suite opens the file and exports a PDF with at least one page (DOCX/XLSX/PPTX; PDF via Draw import).
- `recalculation`: the suite recalculates and saves; every formula in the workbook is preserved and each expected cell stores the expected value.
- `referenceTotals`: after recalculation each total equals the sum of its referenced range, summed independently.
- Records never change inspection flags or claim native qualification.
- Evidence: `apps/artifacts/test/evidence/native-checks-20261016/native-checks.json`. Real LibreOffice 24.2.7.2 opened generated DOCX (1 page), XLSX (1), PPTX (2) and a PDF (1). It recalculated the generated workbook's `SUM` from the stored placeholder 0 to 5, with formulas preserved, and the reference total matched the independent sum. Every process group was absent afterwards. The record states its scope: synthetic admission record, container uid 0, sandbox not attested.

## Checks run (Node 24.11.1, Python 3 with python-docx/openpyxl/xlsxwriter/pypdf, LibreOffice 24.2.7.2)

Per-file comparison, base worktree `48a27c8` vs branch, same host and dependencies (`apps/artifacts/**` tests, `apps/control/document-application/**` tests, `apps/runtime/artifacts/test`, `apps/control/test/commands-*`, the artifact-file and document-application contract tests):
- All 63 existing files: identical pass/fail/skip at base and branch.
- Base: 764 pass, 136 fail, 2 skip. Branch: 799 pass, 136 fail, 5 skip. The 35 new passes and 3 new skips are the new files below.
- The 136 failures are unchanged host failures. Every file inspected fails on the hard-coded `/opt/codex/...` Python, soffice or PptxGenJS paths, which do not exist on this host. A symlink fix was refused by this session's permissions, so the failures stay as they are.

New files (default suite):

| File | Result |
|---|---|
| `apps/artifacts/test/renderer-port.test.mjs` | 6 pass |
| `apps/artifacts/test/preview-service.test.mjs` | 10 pass, 1 opt-in skip |
| `apps/artifacts/test/filing-resolver.test.mjs` | 4 pass |
| `apps/artifacts/test/native-checks.test.mjs` | 3 pass, 1 opt-in skip |
| `apps/artifacts/storage/test/find-by-object.test.mjs` | 2 pass |
| `apps/control/document-application/test/pdf-http.test.mjs` | 5 pass, 1 opt-in skip |
| `apps/control/document-application/test/preview-http.test.mjs` | 5 pass |

Opt-in real LibreOffice (`MERI_ARTIFACT_SOFFICE=/usr/bin/soffice`), all passing:
- `pdf-http` 6/6
- `preview-service` 11/11
- `native-checks` 4/4
- the existing `pdf-revision-dispatch` 5/5 and `pdf-lineage` 3/3

`scripts/qualification/assembled-image/source-proof.test.mjs`: 5/5. The suite globs in `scripts/qualification/local-baseline/suites.json` already discover every new test file.

Negative regressions. Each fix was temporarily reverted and the named test failed; the source was then restored:

| Reverted | Failing test |
|---|---|
| Renderer state ignored | renderer-port (4), pdf-http (1) |
| Sandbox requirement not enforced | renderer-port, pdf-http |
| Switch alone admits PDF | pdf-http |
| Raw `officeTransformer` accepted | pdf-http |
| PDF admitted by default in configuration | pdf-lineage (1), pdf-http (3) |
| Preview read without the post-read recheck | preview-service |
| Preview record not verified | preview-service |
| Post-write failure reported as its cause | preview-service |
| Preview size unbounded | preview-service |
| Office preview without a renderer | preview-service |
| Preview ports not rechecked in the runtime mount | preview-http |
| Preview link target ignored at redeem | preview-http |
| Filing without the post-registration recheck | filing-resolver (2) |
| Selected object not compared | filing-resolver |
| Broker receipt unchecked | filing-resolver |
| `findByObject` without the tenant/conversation filter | find-by-object |
| Native values not compared | native-checks |
| Formula preservation not required | native-checks |

The first attempt at the default-admission mutation targeted an unused default parameter and failed nothing. It was redone on the configuration path. A redundant post-decode binding check in `findByObject` that no test could reach was removed, because `decode()` already enforces it.

## UNRUN

- Renderer qualification, the renderer sandbox and the product image: UNRUN. This container runs as root without the sandbox. Real-LibreOffice results are local evidence behind a synthetic admission record.
- Native qualification (benchmark 100% open, formulas and reference totals, ≥95% human quality, no clipping): UNRUN. The native checks are the mechanism and one local run, not the benchmark.
- Real PostgreSQL and S3, KMS and bucket privacy: UNRUN. The scripted SQL fixture and the local store were used.
- Product composition: UNRUN. Root wiring of the renderer admission, `pdfAdmission`, a preview store and the filing resolver/broker is not done here.
- The host attachment broker and the real `save_chat_attachments` route: UNRUN.
- Page/slide images: not built. Previews are PDF, which the lane allowed. Rasterized thumbnails would need an admitted rasterizer.
- Frontend preview UI: not in this lane.

## Proposals

- **P1 Preview contract.** Freeze an `ArtifactPreview` shape from `meri.artifact-preview.proposal-1` (`apps/artifacts/preview/record.mjs`), and decide how `previewStatus` relates to it. The version stays immutable (`pending`); the recommendation is to leave the frozen field and expose preview state only through the record. The public `DocumentApplication` schema (`packages/contracts/document-application/schema.mjs`) also needs:
  - `application/pdf` in its `mimeType` enum, or clients' `receive()` will refuse admitted PDF results;
  - the two preview routes.
- **P2 Durable preview store.** A migration for `meri_artifacts.previews(version_id uuid PRIMARY KEY REFERENCES versions, tenant_id text, conversation_id uuid, record jsonb, record_sha256 text)`, with an immutability trigger and an insert-or-identical commit. It also needs a retention inventory class for preview records and preview objects: suppression already refuses serving through the canonical read gate, but purge does not yet enumerate previews (the data-class gap the audit names).
- **P3 Renderer admission record.** Adopt the admission shape and the eight sandbox requirements as the qualification owner's output. Bind `pdfAdmission` to a control-configuration key that defaults to false.
- **P4** Optional index for `findByObject` (`(tenant_id, conversation_id, (record #>> '{version,object,objectId}'))`) once filing volume warrants it.
- **P5 Preview budget.** Previews currently reserve no budget; they are bounded by deadline, bytes and pages. Decide whether to add a fixed charge.
- **P6 Host attachment broker contract.** `register({binding, destination, versionId, object, filename, mimeType, bytes, deadlineMs, signal}) → {attachmentId, sha256, bytes, expiresAtMs}`. Also wire `resolveAttachments` into the durable command source composition.
- **P7 Signed-link token.** Adds the optional `target:'preview'` claim. Download tokens are unchanged.

## Residual risks

- A Word-bound application checks the previewed version's family at release. A cross-family preview publish could commit a preview record (for a version the caller may download) before the response is refused.
- `findByObject` is an unindexed scan bounded to one tenant conversation.
- The local preview store and the local version scan are source-local only.
- Previews add one LibreOffice run per version. Each run is bounded by the request deadline and the 5 s group-drain bound.
