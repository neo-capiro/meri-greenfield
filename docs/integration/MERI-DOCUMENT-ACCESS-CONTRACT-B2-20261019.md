# B2: document access contract, inspect and download for every artifact format (proposal for review)

Base: meri-greenfield PR190 `29379ab1f7be9a7bb98613b4b7e27e17dad9ccf5`. Branch `fable/document-access-contract-b2-20261019`. Assignment: dot, PR #121 comment 6261006811 (A9 follow-up); resumed on Neo's direction.

This branch adds one additive browser contract, `@capiro/meri-contracts/document-access-application` (`urn:meri:document-access-application:0.1.0`): `POST /api/documents/inspect` and `/download` for all six canonical formats (`docx`, `txt`, `xlsx`, `pptx`, `pdf`, `zip`). It changes no handler, no existing contract or distribution byte (the frozen `document-application` outputs are untouched), no shipping candidate, no Core or frontend file. It grants no authority, qualifies no renderer, and is not deployment, composition or runtime-mount evidence. It does not change the version of the published package.

## The gap (A9, confirmed)

The frozen `document-application` projection keeps only `docx`/`txt`/`xlsx` (`admitted` in its `schema.mjs`). The canonical `artifacts-0.2` schema, the artifact producers and the server's format admission also carry `pptx`, `zip` and `pdf`. The frozen receiver refuses a `pptx`/`zip`/`pdf` inspect answer with `INVALID_RESPONSE`, and because download is admitted only for a version admitted from an inspect answer, those versions cannot be downloaded either. This contract admits all six.

## What it is

- **Same names, narrower routes.** `receiveDocumentRequest`, `receiveDocumentResponse`, `receiveDocumentDownload`, `DocumentResponseError` and the admitted-version types keep the frozen names so a consumer swaps one import path; routes are `inspect` and `download` only (create/revise stay in the frozen contract). An inspect answer gets the frozen receiver's exact checks (scope and size, evidence scopes, hash, bytes, MIME type, file extension, exact version id) over all six formats. `receiveDocumentDownload` is the frozen source, so inspect-before-download, header and byte verification are unchanged.
- **Variants as the producers emit them.** `pptx`: `{slides, editable:true, visualInspection:'pending'}`; `pdf`: `{conversionCompleted:true, renderInspection:'pending', sourceDocxSha256}`; `zip`: `{rows, columns, chart}`. Every variant has `nativeOpened`, `rendered` and `recalculated` fixed to `false`; a receipt that claims otherwise is refused.
- **Derived, not copied.** The generator reads the canonical artifact schema, the MIME vocabulary, the catalog, the real `admitDocumentDescriptor` per operation (published as `operationFormats`), the preview owner's `PREVIEW_FORMATS` and the document HTTP owners' status table (equal to the frozen error vocabulary, 31 codes), and records the SHA-256 of every source including the preview service text, so a change to any of them without regeneration fails `--check`.
- **Truthful preview states.** Metadata carries `previewFormats` (`docx`, `xlsx`, `pptx`, `pdf`); `txt` and `zip` have no preview (`ARTIFACT_PREVIEW_UNSUPPORTED`); each previewable format except `pdf` also needs a qualified converter (`ARTIFACT_RENDERER_UNAVAILABLE` otherwise). The contract carries no renderer-qualification claim and no preview route; no preview, rendered image or "validated" state is invented.

## Producer shape gaps (documented, not papered over)

1. **One operation descriptor per document-application instance.** `admitDocumentDescriptor` binds an instance to one operation (`create_word`: docx/txt, plus pdf only when the composer sets it with a qualified renderer; `create_excel`: xlsx; `create_powerpoint`: pptx; `run_analysis`: zip). `index.mjs` refuses any inspect or download whose MIME type is outside that admission (`DOCUMENT_RESULT_REFUSED`, 502). The runtime resolves document options per request through the injected `optionsOwner`, and the descriptor comes from Meri-local composition (`core-authority.mjs` supplied `descriptor`). Source reading shows nothing that selects a descriptor by the *version's* format for an inspect request, so a conversation holding a deck and a memo may be answerable for only one of them. **Not verified end to end**; this contract cannot assert it either way.
2. **Version statuses are fixed.** The application releases only `generationStatus:'draft'` and `previewStatus:'pending'`; no producer path emits `validated`, `unsupported`, `published` or `failed`. A UI cannot learn "preview unsupported" from the version, only from the published `previewFormats` or from a preview route error, and this contract has no preview route.
3. **No contract for `/api/documents/preview` and `/preview-publish`** (JSON `{status, preview}`, and a sandboxed inline PDF) exists in either document contract. If a UI needs rendered previews, that is a separate contract after a renderer is qualified.
4. **PDF.** Only the `create_word` composition with an explicit admission switch and an admitted converter admits PDF; `sourceDocxSha256` ties a PDF to a DOCX the receiver never sees, so it is carried, not verified.
5. **No real producer output was exercised.** This host has neither PptxGenJS, pandas nor a qualified renderer, and nothing was installed. Receipts are built with the producers' own emission expressions (`presentation.mjs`, `local-executor.mjs` PDF conversion, `python/analysis.py`) and validated by the canonical artifact validator; actual generated PPTX/ZIP/PDF bytes through a real document application remain untested.
6. **Module-local provenance.** A version admitted by one receiver module cannot release bytes through another (tested). A consumer must use the access module for both inspect and download; in the frontend that likely means `shared/meri-documents/artifact-access.ts` and the `documentTransport` it calls (not read in full here, not changed).

## Evidence

Windows (Git Bash), Node v24.19.0, synthetic bytes and scopes; no PostgreSQL, Core, renderer, runtime mount or deployment.

- `node --test test/document-access-application-public.test.mjs`: **151 tests, 151 pass.** They run txt/docx/xlsx through the frozen and access receivers side by side (same acceptance, same refusal and code for 19 mutations each), the canonical validator, the three new variants (admitted by access, valid for the canonical owner, still refused by the frozen receiver; 17 variant-specific mutations across the three and the 19 general mutations for each), format/MIME/extension agreement, download for all six formats (headers, hash, provenance, frozen-vs-access isolation), the complete error table, requests, metadata against the real admission function and preview owner, and distribution self-containment and layout independence.
- `npm run typecheck` (all public type files, strict): pass. `node generate-document-access.mjs --check`: pass.
- The other eleven public suites fail the same six tests on a pristine PR190 checkout and with this branch (five Windows `C:\C:\…` path failures and the existing `generate.mjs --check` drift on `browser.mjs`); with this branch 424 tests run, 418 pass (273 + 151). No test that passed at the base fails.
- Generated with esbuild 0.28.2 and json-schema-to-typescript 16.0.0 (the package.json pins), symlinks preserved so inputs read `node_modules/<package>/…`; the generator refuses layout paths. Clean-layout reproduction is recorded in the PR.
- **Not run:** the full `check:generated` chain and any broad `apps/control` suite.

## For review

1. Distribution path as in B1: vendor under `packages/meri-client/vendor/document-access-application/0.1.0/` rather than bump the 0.1.10 package binding. Recommendation only.
2. Whether to add a preview contract after renderer qualification (gap 3), and how to serve mixed-format conversations (gap 1), are decisions for the owners of the composition, not this contract.
3. Download is limited to the frozen header and byte rules; link issue/redeem routes are a separate surface and are not covered.
