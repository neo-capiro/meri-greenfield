# Conversational artifact and analysis preparation

Base: `98d3c96a2c944a8211856e98b5bd62e824b4b5f7`. Source-only lane; no deployment,
provider, infrastructure, live database or production installation is authorized.

Implementation outline recorded before code:

- Extend canonical document-format admission and its existing preparer to PPTX.
  Reuse pinned PptxGenJS 4.0.1, existing artifact generation/storage/current authority,
  and durable accounting. Extend immutable document recovery's operation admission
  to PPTX so repeats never generate again.
- Add a focused analysis preparer, with separate trusted typed-artifact and admitted
  sandbox bindings. Typed table analysis uses the existing ZIP artifact generator;
  general immutable-program analysis uses the existing PostgreSQL analysis owner
  and sandbox boundary. No host evaluation, provider, endpoint, new source, grant,
  approval mechanism, budget ledger or orchestration loop is introduced.
- Preserve exact request/context/scopes, output provenance, pending native
  qualification, cancellation and conservative UNKNOWN after a called owner.
- Parent owns shared intent catalog/tools/mount/result-release, runtime composition,
  run options, contracts, manifests and lockfiles. Missing trusted native sandbox
  bindings remain an explicit dependency, never an injected production success.
- Verify real fixed PPTX and typed ZIP generation structurally over scripted
  persistence/accounting, plus canonical sandbox-owner composition with synthetic
  admission/native boundaries. Test foreign scope, authority injection, malformed
  outputs, cancellation, unknown effects, current revocation and delivery replay.

Both canonical catalog operations require `artifact.publish` and have
`approvalBoundary: qualified-source-review`, `sideEffect: local-artifact`. They do
not themselves authorize filing/sharing. Typed preparation returns an immutable
draft version. General analysis requires the pre-existing trusted admission image,
manifest and receipt plus fresh current authority and budget; its exact output
references remain inspection/publication pending. It must never be represented as
an approved, inspected or published ArtifactVersion.

## Source and composition receipt

- Implementation: `d750ae3791c51b15c4aa30f981c2067e4feaa633`.
- Separate approved product-accounting slice:
  `a8631f3e3b46491ba4edc8dc907e679b940816ca`.
- Branch: `codex/meri-writes-artifacts-20261019`, separate from PR189's read-tool
  successor and the frozen first-chat build. Parent owns publication/integration.

`createDocumentIntentPreparer` now supports the existing canonical PPTX operation,
retains `owner:'document'`, captures an inert own write method, and verifies the
full run binding and exact draft file/inspection correlation. It never owns
`run_analysis`. The existing format admission additionally permits `run_analysis`
only as typed ZIP through `/api/documents/create|revise|inspect|download`; sandbox
requests cannot dispatch through that application. PPTX and ZIP use the existing
stable owned-version recovery path, with sandbox refusal still preceding it.

```js
createAnalysisIntentPreparer({
  binding, descriptor, // exact canonical run_analysis descriptor projection
  artifact: { writes, context }, // optional complete binding; context may be omitted
  sandbox: { executor, context }, // optional complete binding; context is mandatory
});
```

At least one binding must exist. `writes.execute({deliveryId,request,baseVersionId:null},signal)`
is prebound to the canonical artifact owner/capability; `executor.execute({deliveryId,request},signal)`
is prebound to the canonical general-analysis owner/capability. Borrowed methods
retain their original receiver. Ports, contexts, credentials or admission are never
accepted from model arguments. The returned immutable `formats` lists the bound
modes; an unbound mode returns `UNAVAILABLE` with no owner effect. Factory import
and construction perform no generation, SQL, token, provider or network operation.

The parent approved typed ZIP over the existing runtime document application.
That application already resolves and validates its exact current context within
one request lifetime. Consequently a ZIP HTTP-bound port may omit the preparer's
static context rather than guessing a deadline or performing a competing options
resolution. The preparer still validates closed result shape, full run binding,
draft/null-parent/pending-preview states, exact MIME/filename and inspection/hash/
byte/scope correlation. If a direct trusted context is supplied, canonical full
request/context provenance is checked too. Sandbox context and exact admission
remain mandatory. The shared `artifact-draft-result.mjs` owns the small common
draft-correlation boundary for document and analysis preparers.

Typed ZIP returns `{status:'draft',version}` with `owner:'artifact'`. General
analysis returns `{status:'analysis_pending',binding,scopes,result}` with the
existing closed `GeneralAnalysisResult`, exact immutable output references,
`inspectionStatus:'pending'` and `publicationStatus:'pending'`; no version is
invented. Any owner-call failure remains conservative `UNKNOWN`, preventing a
lost acknowledgement from becoming apparent no-effect or automatic re-execution.

The analysis accounting owner now accepts only `namespace:'qualification'` (its
unchanged default) or trusted `namespace:'product'`, matching the existing artifact
owner. Both compose the same canonical budget executor; no SQL, schema, migration,
grant, allowance, balance or ledger was introduced. Model arguments cannot choose
the namespace. A product fixture asserts no qualification SQL is issued.

## Files changed

- `apps/artifacts/postgres-service.mjs`
- `apps/artifacts/recovery.mjs`
- `apps/artifacts/postgres-analysis.mjs`
- `apps/artifacts/test/analysis-product-namespace.test.mjs`
- `apps/control/document-application/format-admission.mjs`
- `apps/control/document-application/local/fixture.mjs`
- `apps/control/document-application/test/workbook-application.test.mjs`
- `apps/control/document-application/README.md`
- `apps/control/intents/document-preparer.mjs`
- `apps/control/intents/artifact-draft-result.mjs`
- `apps/control/intents/analysis-preparer.mjs`
- `apps/control/intents/test/document-preparer.test.mjs`
- `apps/control/intents/test/document-preparer-powerpoint.test.mjs`
- `apps/control/intents/test/analysis-preparer.test.mjs`
- This handoff.

## Checks and qualification limits

Source-local verification used Node 24.19.0, the existing pinned PptxGenJS 4.0.1,
and Python/pandas 2.2.3. No dependency installation or lockfile mutation occurred.
`TMPDIR` points to disposable task-owned tmpfs because the workspace overlay is
full; fixtures verify generator directories and local immutable stores are removed.

```sh
TMPDIR=/dev/shm/meri-artifact-test-temp MERI_REVIEW_SOURCE_ROOT=/dev/shm/meri-writes-artifacts node --test apps/control/intents/test/document-preparer.test.mjs apps/control/intents/test/document-preparer-powerpoint.test.mjs apps/control/intents/test/analysis-preparer.test.mjs apps/control/document-application/test/workbook-application.test.mjs apps/artifacts/test/artifact-postgres-service.test.mjs apps/artifacts/test/document-replay.test.mjs
```

**96/96 PASS**, no skips: actual editable PPTX and typed ZIP bytes, computed
JSON/CSV, immutable creation/revision/read/download/recovery, exact repeat delivery,
foreign current scope/run/file output, denied/revoked authority, cancellation,
conservative UNKNOWN, unsupported code/authority fields, Word/Excel regressions,
and existing lost-ACK/marker/replay controls. These are source-local generators and
scripted database/authority boundaries, not production engine or native-render proof.

```sh
TMPDIR=/dev/shm/meri-artifact-test-temp MERI_REVIEW_SOURCE_ROOT=/dev/shm/meri-writes-artifacts node --test apps/artifacts/test/analysis-product-namespace.test.mjs apps/artifacts/test/artifact-postgres-analysis.test.mjs apps/artifacts/test/postgres-analysis-independent.test.mjs
```

**79/79 PASS**, no skips: product-only SQL reserve/settle/reconciliation with one
charge and no second dispatch, malformed namespace refusal before SQL, plus all
existing qualification-mode general-analysis current-authority/admission/output/
cancellation/UNKNOWN controls. Actual native program execution is a synthetic port;
the test never executes the immutable program on this host. Counts are separate
groups, not an integrated production-readiness claim. Syntax and diff checks pass;
parent runs affected shared type/build checks at the receiving integration point.

Failed development controls remain recorded: the first document-preparer run was
0/8 because its added public RunBinding check mistakenly called the private
retrieval shape registry; it now calls the canonical public validator. Initial
analysis composition was 4/7 because the fixture's 25-second immutable context
exceeded the canonical owner's shorter current execution window. The fixture now
constructs a distinct five-second intent before admission, preserving the owner
refusal and immutable hash; no production deadline or gate was rewritten. A focused
diagnostic confirmed `ANALYSIS_IMMUTABLE_DEADLINE_EXCEEDS_AUTHORITY`. Assertions
covering no retry, cancellation, pending outputs and accounting were retained.

## Receiving dependencies and order

1. Receive implementation and the separate product-namespace slice. Parent owns
   runtime run-options descriptor admission for PPTX/ZIP, canonical bridge/session
   composition, worker catalog/tool selection and shared intent result release.
2. The bridge must use the genuine current-session document application. Bind
   typed ZIP as `owner:'artifact'` with `artifact:{writes}`; do not supply a guessed
   context. Native code cannot create a standalone bypass around current authority,
   selected-client scope, allocation or artifact retention/download ownership.
3. Keep `sandbox` absent unless the actual qualified immutable-program admission
   verifier, pinned image/manifest/receipt and native execution port are supplied.
   Any eventual production sandbox owner must explicitly set `namespace:'product'`.
   Product accounting preparation now exists; actual native binding remains missing.
4. Shared worker/control result handling must preserve typed draft state and general
   pending inspection/publication. The latter cannot become an approval-required
   command, an inspected result or a fabricated published draft.
5. Run the coherent receiving integration suite, then separately qualify actual
   database persistence, S3/version retention, current Core/source authority,
   final image dependencies, physical sandbox isolation/cancellation, Office native
   opening/rendering and visual quality. No first-chat, image, deployment or live
   capability qualification occurred in this lane. Existing PDF admission stays
   renderer-gated. Filing/sharing remains the existing separate governed command.
