# Artifact fixture reconciliation — 19 October 2026

Base: `98d3c96a2c944a8211856e98b5bd62e824b4b5f7`, detached and then branched as `codex/meri-artifact-fixture-reconcile-20261019` in a separate worktree. The receiving source had the same five failures in these groups; this commit changes tests and fixtures only. It does not change the frozen candidate, a production owner, contracts, generator admission, infrastructure or a lockfile.

## Findings and changes

| Failure | Exact cause at the evidence base | Reconciliation |
| --- | --- | --- |
| Runtime DOCX and XLSX creation; generated-workbook download link (three failures) | The runtime test fixture constructs `createRuntimeArtifactStorage` without custody. The canonical version owner intentionally returns `ARTIFACT_PUBLICATION_UNAVAILABLE` from `commit`; generation happened, so the public result is `ARTIFACT_EFFECT_UNKNOWN`/502. | `apps/runtime/artifacts/test/fixture.mjs` explicitly supplies the existing synthetic CAS `publicationFixture`, current tenant, journal and retention owner to the real `createPostgresArtifactVersions`. The fixture keeps the existing S3 object protocol and SQL projection. Production absent-custody behavior stays closed. |
| Runtime preview retry (one failure) | The test denied record commit after the durable preview claim and object write, then expected a retry of that same source version to render/publish successfully. The canonical owner deliberately retains the uncertain claim and returns UNKNOWN. | `apps/control/document-application/test/preview-http.test.mjs` now proves the retry remains UNKNOWN, does not convert again, leaves the original record absent, and cannot serve a preview. Successful publish/read is verified independently on a fresh immutable source version. |
| Link telemetry/redaction observation (one failure) | The inherited process environment uses `OTEL_TRACES_SAMPLER=parentbased_traceidratio`, `OTEL_TRACES_SAMPLER_ARG=0.01`. The memory observer inherits it, yielding non-recording spans; asserting ten observed requests cannot work reliably. | `apps/runtime/artifacts/test/download-links-redaction.test.mjs` explicitly creates its test-owned provider with `AlwaysOnSampler`. All ten span/metric counts and every token/output/redaction assertion remain. No application sampler is changed. |
| Two presentation layout failures in the integrated run | The test's legacy default PptxGenJS path is absent. The exact evidence base reproduces the same process failure, 39 stderr bytes and SHA256 `218fa18c8112df56ea98807ec5616a70b247010490152d9fa9567ce1ab255b3c`. | Environment only: set `MERI_PPTXGENJS` to the existing pinned 4.0.1 package shown below. Both layout tests pass with that input. No layout or generator source was edited. |

The baseline five-file command produced **33 tests, 28 passed, 5 failed, 0 skipped**. After the fixture reconciliation, the same command produced **33 passed, 0 failed, 0 skipped**. Node was `v24.19.0`. The commands used existing read-only dependency installations; no package installation or paid/native provider was run.

## Reproduction

Run at either exact base (for the baseline failures) or this fixture commit (for the repaired suite), with `MERI_REVIEW_SOURCE_ROOT` set to that checkout's absolute root:

```sh
MERI_REVIEW_SOURCE_ROOT="$PWD" \
TMPDIR=/dev/shm/meri-writes-test-temp \
MERI_DOCUMENT_PYTHON=/opt/codex/runtimes/codex-primary-runtime/dependencies/python/bin/python3 \
MERI_PPTXGENJS=/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/pptxgenjs \
node --test \
  apps/artifacts/test/presentation-layout.test.mjs \
  apps/control/document-application/test/preview-http.test.mjs \
  apps/runtime/artifacts/test/runtime.test.mjs \
  apps/runtime/artifacts/test/download-links.test.mjs \
  apps/runtime/artifacts/test/download-links-redaction.test.mjs
```

The legacy layout failure control omits `MERI_PPTXGENJS`; it fails 0/2 on the exact evidence base. Setting that variable passes 2/2. A separate baseline redaction control with `OTEL_TRACES_SAMPLER=always_on` passes 1/1, confirming the observer issue before the explicit fixture sampler change.

Git-backed outputs (trailing whitespace stripped; no test text removed):

- [Exact-base failures](artifact-fixture-evidence-20261019/baseline-98d3c96a.tap), SHA256 `d0c2a4569cfb6d717563e63cd96336cb04007d62190428f4fdbdaf07ccab5c55`.
- [Reconciled focused suite](artifact-fixture-evidence-20261019/reconciled.tap), SHA256 `4edd08fb246c76fc4713dcb738f7f7306bddb86b6a5c08c13d4469b04ce8f765`.

`git diff --check` passes. These are source integration results with real fixed generation and canonical control/storage interfaces over explicitly synthetic current authority, SQL, publication CAS and S3 protocol replies. Real PostgreSQL/S3 durability, admitted Office rendering, exact-image startup, real provider use and deployment remain unrun. Receive the fixture commit before the next coherent combined suite; retain the explicit pinned PptxGenJS environment in that command.
