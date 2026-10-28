# W5-M5-01 — retained PDF reads

MM-09 / WS-23 source slice. Base: `d4c37cb06b3d845fbf1f94dbc083cf53ecc15bb7` (Meri main). Author: Wave 5 M5 lane. Independent review: Hermes source PASS at `86b59ce9e2a6cb898381b2834d3bc92df38b8a46`; the comment-only followup below awaits bounded delta review. Integration/build/deployment: existing root/Release. Acceptance: pending Hermes after deployment. This does not close M5 or MM-09.

## Behavior and ownership

An already published PDF previously returned `502 DOCUMENT_RESULT_REFUSED` from inspect/download when PDF generation was not admitted. Both reads reused the writer's format admission. The existing application now selects all six canonical read formats for inspect/download only. Create, revise and both preview routes retain their configured admission. Existing artifact validation, current session access, retention and exact-object checks are unchanged.

The change reuses `admitDocumentFormats`, immutable artifact publication, canonical session and read owners. No new service, public wire shape, schema, catalog operation, migration, dependency or target configuration is introduced. No Research Portfolio module or skill is changed.

## Files

- `apps/control/document-application/index.mjs`: separate existing-version read admission from writer admission.
- `apps/control/document-application/test/pdf-read-admission.test.mjs`: actual application/session/publication owner checks over isolated scripted SQL/object transports and synthetic valid PDF bytes.
- `apps/control/document-application/preview-route.mjs`: correct the stale comment identified by Hermes F1 to distinguish configured preview/writer admission from the separate read contract. No executable change; no tests rerun for this followup. Original review report retained unchanged.
- This handoff.

## Author verification

Node `v24.22.1`, Windows. Reused existing dependency caches through task-owned ignored directory junctions; no installation or shared-cache mutation.

- New focused test on the original application: **9 passed, 1 failed**, exit 1. The positive inspect request received `502 DOCUMENT_RESULT_REFUSED` rather than 200, establishing the failure witness.
- Corrected source: `node --test --test-concurrency=1 apps/control/document-application/test/pdf-read-admission.test.mjs apps/control/document-application/test/preview-custody-configuration.test.mjs`: **11 passed**, exit 0. Covers exact PDF bytes/MIME/filename/inspection, truthful native/preview flags, writer and unavailable-preview refusal, revoked session, suppression, substituted bytes, foreign client/actor and changed MIME/filename/version.
- Mutation: admitting `create`/`revise` into the read-format branch killed the writer-denial test (`502` versus required pre-dispatch `400`), exit 1. Mutation reverted before final checks.
- `git diff --check`: exit 0.

The attempted existing `apps/runtime/artifacts/test/native-public-application.test.mjs` could not load in the reused Windows cache. Missing `@aws-sdk/client-ecs`, then `@aws-sdk/client-s3`, then `@js-temporal/polyfill` were reported at import. The first two were resolved through existing caches; the runtime test remains **not executed**, not a product failure or PASS. No broader dependency setup or suite was performed.

## Shared-owner integration requirement

Both existing contract generators hash the changed application source. Their generated provenance is intentionally not edited by this lane's allocation. Expected affected outputs are `packages/contracts/dist/document-application.metadata.json` and `packages/contracts/dist/document-access-application.metadata.json`; the owning integrator must run the generators and inspect every actual delta:

```text
node packages/contracts/generate-documents.mjs
node packages/contracts/generate-document-access.mjs
node packages/contracts/generate-documents.mjs --check
node packages/contracts/generate-document-access.mjs --check
```

Use the canonical contract toolchain and necessary distribution checks under the shared package owner's allocation. These generation/distribution checks were **not run** here; provenance drift is expected until that coordinated refresh. There is no request to change frozen writer wire shapes or activate PDF generation. Candidate is integration-held pending that work and exact-head Hermes review.

## Cleanup and limits

No executable owner was replaced or retired; no obsolete flag/resource was added. Search confirms inspect/download alone use the new admission branch. No compiler/renderer was changed, so no new native rendering campaign is warranted by this slice. Cloud, databases, browsers, deploys, storage and provider credentials were untouched. Task-owned dependency junctions are ignored and retained for review; their shared targets remain owned by their existing lanes.
