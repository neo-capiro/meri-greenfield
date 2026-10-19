# Document access application contract (inspect and download, all artifact formats)

Proposed `urn:meri:document-access-application:0.1.0` browser boundary for the two document read routes `POST /api/documents/inspect` and `POST /api/documents/download` (PR190 base `29379ab1`). It is a separate, additive sibling of the frozen `document-application` 0.1.x distribution, which stays byte-identical. It grants no authority, qualifies no renderer and is not deployment, composition or runtime-mount evidence.

## Why it exists

The frozen document receiver is a build-time projection of the canonical artifact contract that keeps only `docx`, `txt` and `xlsx` (`admitted` in `document-application/schema.mjs`). The canonical `artifacts-0.2` schema, the artifact producers and the server's format admission (`apps/control/document-application/format-admission.mjs`) also carry `pptx`, `zip` and `pdf`. A PPTX, ZIP or PDF version therefore cannot be inspected by that receiver, and because download is admitted only for a version the receiver admitted from an inspect answer, it cannot be downloaded either. This contract projects every canonical inspection variant (`docx`, `txt`, `xlsx`, `pptx`, `pdf`, `zip`) onto the two read routes. Create and revise stay in the frozen contract.

## Compatibility with the frozen receiver

The public names are the same so a consumer swaps one import path: `receiveDocumentRequest`, `receiveDocumentResponse`, `receiveDocumentDownload`, `DocumentResponseError`, and the types `AdmittedDocumentRequest`, `AdmittedDocumentVersion`, `DocumentReceipt`, `DocumentResponse`, `DocumentDownload`, `DocumentDownloadOptions`. The routes are limited to `inspect` and `download`. The checks for an inspect answer are the frozen receiver's, unchanged (scope and size, evidence scopes, hash, bytes, MIME type and file extension agree with the inspection, exact version id), over all six formats. Download reuses the frozen `receiveDocumentDownload` source: the version must have been admitted from an inspect answer (module-local provenance), headers and bytes are verified against that exact version, and the caller cannot bypass inspection. The error vocabulary is derived from the same document owners as the frozen contract and is equal to it. `DocumentResponseError` is a distinct class from the frozen bundle's.

## What a variant says (and does not)

Inspection is structural. Every variant has `nativeOpened`, `rendered` and `recalculated` fixed to `false`; `pptx` carries `visualInspection:'pending'`, `pdf` carries `renderInspection:'pending'` and the source DOCX hash, `zip` carries row/column/chart facts. No inspection describes a rendered or visually checked file, and the receiver refuses any that claims it.

`version.previewStatus` is `pending` and `generationStatus` is `draft`, because the document application releases nothing else (`index.mjs version()`); a status the producer never emits is not admitted. Preview support is therefore not learnable from the version. The metadata carries what the preview owner does (`previewFormats`: `docx`, `xlsx`, `pptx`, `pdf`; every other format answers `ARTIFACT_PREVIEW_UNSUPPORTED`; each except `pdf` also needs a qualified converter or answers `ARTIFACT_RENDERER_UNAVAILABLE`). This contract has no preview route and says nothing about whether a renderer is qualified in any deployment.

## Derived, not copied

`generate-document-access.mjs` reads the canonical artifact schema, the MIME vocabulary, the catalog, the real `admitDocumentDescriptor` for each operation (to publish `operationFormats`), the preview owner's `PREVIEW_FORMATS`, and the document HTTP owners' status table, and records the SHA-256 of every source (including the preview service text). A change to any of them without regeneration fails `--check`. Output is independent of the checkout layout (symlinks preserved; layout paths refused). Canonical esbuild/json-schema-to-typescript backend only.

## Known producer limits (documented, not papered over)

See `docs/integration/MERI-DOCUMENT-ACCESS-CONTRACT-B2-20261019.md`: one operation descriptor per document-application instance, no preview route contract, no status other than draft/pending, PDF composition gated by a renderer switch, and the unverified end-to-end composition for mixed-format conversations.
