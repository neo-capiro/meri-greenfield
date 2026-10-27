# W5-M5-01 integration continuation

27 October 2026. The retained-PDF read slice is reapplied to merged Meri PR296, exact main `337e54b3ad92bd80eb65eefc72b4245c4f9ff50d`, tree `d631bdf6a3d1b22e6a0a6fa4e30018f49e65f481`. New isolated branch: `codex/wave5-m5-pdf-read-integration-20261027`; checkout: this chat's `work/m5-pdf-read-integration-20261027`. Author/cleanup owner: Wave 5 M5 lane/orchestrator. Existing root/Release owns integration and target operations; Hermes owns independent review and acceptance.

PR294's original branch, checkout and head `1fbfe49cff488f1bf73b424c2d0690fd6f5f9e54` remain unchanged. Original commits `86b59ce9e2a6cb898381b2834d3bc92df38b8a46` and `1fbfe49cff488f1bf73b424c2d0690fd6f5f9e54` applied as `8704764ef` and `957ee62a5cea029d4e0c06a4d01d4f3ee208bb85`, without source conflicts. A refused application attempt during checkout initialization was aborted only in the new task-owned checkout before the clean application; it was not an upstream compatibility conflict.

## Source and dependency comparison

The application, preview comment and focused test are byte-equivalent to PR294 (`git diff --exit-code` over those three paths: exit 0). The new base does not change the document application, current authority wrapper, format admission, preview route, artifact service or immutable storage owners. Its nearby `apps/runtime/artifacts/workspace-restore.mjs` change provides a random private retained-directory fallback after numbered names are exhausted; it does not change retained document read admission. This continuation makes no additional executable change and does not edit conversation-runner or artifact-restore source.

New base dependencies are contracts `0.1.21`, retrieval catalog `0.2.23`, and UI stream `0.1.8`. Their shared writer remains the Wave 4 Meri owner. No package, catalog, schema, generated distribution, vendor, lockfile or registry was edited.

## Verification

On applied source head `957ee62a5cea029d4e0c06a4d01d4f3ee208bb85`, tree `2dd4f00cd855182f7e367ea5a585cb6a246886d9`, Node `v24.22.1`:

```text
node --test --test-concurrency=1 apps/control/document-application/test/pdf-read-admission.test.mjs apps/control/document-application/test/preview-custody-configuration.test.mjs
```

**11 passed, 0 failed, 0 skipped; exit 0.** Run once against the new base. Tests retain exact bytes/metadata, writer and preview gating, current-session and retention denial, substituted bytes, foreign actor/client and metadata refusal checks. The existing root dependency cache was reused through one task-owned ignored junction, with no installation or cache mutation. `git diff --check` passed. Original failure witness and mutation evidence are retained in `HANDOFF.md`; neither was repeated. No broader runtime tests, build, live/paid/provider/browser/database or deployment operation occurred.

## Exact integration hold

Both existing generators still hash `apps/control/document-application/index.mjs`:

- `packages/contracts/generate-documents.mjs` → `packages/contracts/dist/document-application.metadata.json`.
- `packages/contracts/generate-document-access.mjs` → `packages/contracts/dist/document-access-application.metadata.json`.

Both inherited metadata entries record SHA256 `ed5eb408ff280e528bef4d73b8c1d2fdd69d52fda595192b4cc0d7189b60259f`, 10,326 bytes; the unchanged PR294 application source is SHA256 `2b57b6eaee18c069efd6600c2155e740377fdd5a6fec297df443cc2fdb6cf37d`, 10,622 bytes. The shared owner must regenerate and check these distributions against the integrated cohort. No generator or distribution check ran here, and the metadata remains intentionally unmodified. Consumer finalization and bounded Hermes review of this new-base candidate remain prerequisites. This is source-ready for that integration step, not a build/deploy/acceptance claim or MM-09 closure.
