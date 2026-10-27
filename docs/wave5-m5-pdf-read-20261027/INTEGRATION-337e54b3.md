# W5-M5-01 integration continuation

27 October 2026. The retained-PDF read slice is reapplied to merged Meri PR296, exact main `337e54b3ad92bd80eb65eefc72b4245c4f9ff50d`, tree `d631bdf6a3d1b22e6a0a6fa4e30018f49e65f481`. New isolated branch: `codex/wave5-m5-pdf-read-integration-20261027`; checkout: this chat's `work/m5-pdf-read-integration-20261027`. Author/cleanup owner: Wave 5 M5 lane/orchestrator. Existing root/Release owns integration and target operations; Hermes owns independent review and acceptance.

PR294's original branch, checkout and head `1fbfe49cff488f1bf73b424c2d0690fd6f5f9e54` remain unchanged. Original commits `86b59ce9e2a6cb898381b2834d3bc92df38b8a46` and `1fbfe49cff488f1bf73b424c2d0690fd6f5f9e54` applied as `8704764ef` and `957ee62a5cea029d4e0c06a4d01d4f3ee208bb85`, without source conflicts. A refused application attempt during checkout initialization was aborted only in the new task-owned checkout before the clean application; it was not an upstream compatibility conflict.

## Source and dependency comparison

The application, preview comment and focused test are byte-equivalent to PR294 (`git diff --exit-code` over those three paths: exit 0). The new base does not change the document application, current authority wrapper, format admission, preview route, artifact service or immutable storage owners. Its nearby `apps/runtime/artifacts/workspace-restore.mjs` change provides a random private retained-directory fallback after numbered names are exhausted; it does not change retained document read admission. This continuation makes no additional executable change and does not edit conversation-runner or artifact-restore source.

New base dependencies are contracts `0.1.21`, retrieval catalog `0.2.23`, and UI stream `0.1.8`. Their shared writer remains the Wave 4 Meri owner. The source reapplication edited no package, catalog, schema, generated distribution, vendor, lockfile or registry; the subsequently released metadata-only refresh is recorded below.

## Verification

On applied source head `957ee62a5cea029d4e0c06a4d01d4f3ee208bb85`, tree `2dd4f00cd855182f7e367ea5a585cb6a246886d9`, Node `v24.22.1`:

```text
node --test --test-concurrency=1 apps/control/document-application/test/pdf-read-admission.test.mjs apps/control/document-application/test/preview-custody-configuration.test.mjs
```

**11 passed, 0 failed, 0 skipped; exit 0.** Run once against the new base. Tests retain exact bytes/metadata, writer and preview gating, current-session and retention denial, substituted bytes, foreign actor/client and metadata refusal checks. The existing root dependency cache was reused through one task-owned ignored junction, with no installation or cache mutation. `git diff --check` passed. Original failure witness and mutation evidence are retained in `HANDOFF.md`; neither was repeated. No broader runtime tests, build, live/paid/provider/browser/database or deployment operation occurred.

## Metadata source binding and remaining integration hold

Both existing generators still hash `apps/control/document-application/index.mjs`:

- `packages/contracts/generate-documents.mjs` → `packages/contracts/dist/document-application.metadata.json`.
- `packages/contracts/generate-document-access.mjs` → `packages/contracts/dist/document-access-application.metadata.json`.

Wave 4 root released only these two generated metadata files to the M5 owner. The refresh continues from `8612935327045b1c57766e380c7ec6dbf2a5863a` in isolated branch `codex/wave5-m5-metadata-binding-20261027`, checkout `work/m5-metadata-binding-20261027`. Each metadata diff changes only its index source entry from SHA256 `ed5eb408ff280e528bef4d73b8c1d2fdd69d52fda595192b4cc0d7189b60259f`, 10,326 bytes, to `2b57b6eaee18c069efd6600c2155e740377fdd5a6fec297df443cc2fdb6cf37d`, 10,622 bytes. Browser bundles, declarations, schemas, public API and retained-PDF behavior are unchanged.

With Node `v24.22.1`, both canonical generators and both corresponding `--check` commands exited 0. The existing distribution checks were selected with:

```text
node --test --test-concurrency=1 --test-name-pattern='metadata is derived|distribution is self-contained|isolated package consumer exposes document export' packages/contracts/test/document-access-application-public.test.mjs packages/contracts/test/document-application-public.test.mjs
```

**3 passed, 0 failed, 0 skipped; exit 0.** Generated metadata SHA256 values: document application `771bc24c0573a24ed31dba8ac1e8fb046a5ba92253c74c6117152e5e56adce40`; document access `f182f87a204e6fc4bc145e614aab6a60540d8b305c898b0fc70fc3ba43c1382b`. The existing 11 source-check passes above are reused; source tests were not rerun. The aggregate `npm run check:contracts:distribution` was NOT RUN: it invokes every contract generator, type fixture and public suite, including other held owners, rather than a document-only check.

Dependencies were reused without installation or cache mutation through fresh task-owned package-local junctions: AJV `8.20.0`, ajv-formats `3.0.1`, canonicalize `5.1.0`, fast-deep-equal `3.1.3`, esbuild `0.28.2`, json-schema-to-typescript `16.0.0`. The initial root-hoisted layout in the earlier integration checkout produced unwanted bundle path labels. Those task-produced tracked changes were restored; automatic approval review rejected unlinking its dependency junction, so it was left untouched and the fresh checkout was used. The earlier integration checkout remains clean at `8612935`; PR294 remains unchanged at `1fbfe49`.

Before any packing or publishing, the shared owner must allocate a fresh contracts package version after immutable `0.1.21`; this lane has not chosen or reserved that version. Existing contracts `0.1.21`, catalog `0.2.23`, UI stream `0.1.8`, physical packages and lockfiles remain untouched. No packing, publishing, push, build or deployment occurred. Consumer finalization, any required shared package cohort work, and bounded Hermes review remain prerequisites. This is a locally checked source-binding candidate, not deployment/acceptance evidence or MM-09 closure.
