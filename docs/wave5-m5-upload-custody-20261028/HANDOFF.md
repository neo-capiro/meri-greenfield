# Wave 5 upload custody and public boundary — 28 October 2026

## 1. Scope and source

This is the bounded MM12/WS24 custody, retention, public receiver and CONTROL composition source checkpoint. Base is `5fb6edf38b994a13bc08bd4854121dffda3193f0` / tree `1099022cd6c34a4df5352edfe923e17948dcea2c`, branch `codex/wave5-m5-upload-custody-20261027`. It does not close MM12 or claim deployment/native qualification. Root coordinates integration; Release alone mutates targets. Exact candidate head/tree are in the external handoff because this file cannot contain its own commit hash.

## 2. Existing owners and behavior

`apps/control/uploads` borrows the existing authenticated action-session/Core current reader, artifact S3 object owner, CONTROL PostgreSQL pool and retention suppression lock. Server identity is tenant/actor/conversation/current selected client. Every release rechecks current authority, retention and the unchanged retained row. Browser input never supplies grants, storage URLs, trusted scan flags or tool configuration.

Initiation stores the immutable declaration and idempotent request identity. A durable `writing` transition precedes the single native PUT. Unknown PUT/SQL outcomes retain the attempt and use only exact read-only native observation; absence is not retry permission. Original bytes/hash/scopes/object ID and observed native VersionId cannot be replaced. Same-request replay reuses the original. A never-attempted upload can be atomically cancelled; an uncertain attempt cannot be erased or resent. Removal stops serving before exact-version deletion; holds and uncertain absence retain custody. The canonical object owner retains its prior8MiB default; uploads explicitly select10MiB. Privacy, versioning, SSE-KMS and full native checksum gates remain.

## 3. Explicit product policy and extraction

The new explicit default is10MiB for TXT/Markdown/PDF/DOCX/XLSX/PPTX/PNG/JPEG, with exact extension/MIME/magic/hash checks. ZIP bounds are4096entries,64MiB expanded and100x ratio. PDF200pages, slides200, sheets50, rows100000, columns1024, images40million pixels, extracted text2million UTF-16 units. Scan30s, native parsing30s, OCR90s/40pages, OCR confidence below0.8 is partial. These are product choices, not inferred from an old route limit.

Ordinary external Office hyperlinks are inert and supported; active/executable/external-content relationships are refused. Uploaded configuration/instructions remain literal data outside executable discovery. Missing scanner/parser/OCR stays pending/unavailable; unexamined content never becomes clean. Trusted native receipts bind source hash/bytes/time/tool/definitions. Retained nonempty segments retain exact `sourceSha256` and `external_untrusted` provenance; the raw native receipt cannot forge these fields. A regression test exposed and fixed the earlier retained-segment revalidation defect.

The private `readForInput({uploadId,sha256})` seam reuses the current authorized original read, verifies the selector and requires actual available/partial extraction. It returns retained source facts to the future input owner, not browser-authored status. Ordinary clean original download remains possible when extraction is unavailable. Public input/SDK admission is a separate pending continuation.

## 4. Public contract and runtime

New independent unpublished `uploads-application` wire1.0.0: initiate `{requestId,filename,mimeType,bytes,sha256}`; complete/status/inspect/read/remove selector `{uploadId}`. Complete is one bounded raw PUT at `/api/uploads/original/<uploadId>`; others use existing CONTROL POST ownership at `/api/uploads/<action>`. Responses retain upload/request IDs, exact original declaration/native version, storage and scan states/reason, extraction limitations and original availability. The generated receiver correlates requests and refuses contradictory states, cloned integrity brands, malformed bytes, mismatched errors and fake completion. Original-download receipt requires actual native Response headers, identity/version/hash, bounded stream, exact length/EOF/hash, deadline and cancellation. No signed URL bridge.

The production upload family constructs the existing SQL/S3 owners lazily; the existing product-port factory/capture/router mounts it only with source, artifact storage and retention configuration. CONTROL readiness requires `meri_uploads.originals`. Native inspection defaults honestly unavailable until the separately qualified native host is supplied. `uploads.custody` readiness names composition only, not scanning qualification.

No npm version, manifest/export, lock, catalog or immutable archive changed. Existing public generated families and RuntimeVersions are unchanged. The new dist is source-only and not an installed package export. Contracts0.1.25/UI0.1.12 are reserved to the independent Bill/usage cohort; this family requires a later coordinated package release.

## 5. Retention and migrations

The existing inventory verifies exact upload SQL rows, original object/native version and row hashes. It adds upload raw objects and extracted SQL content to the same purge targets/shared-reference scan. `writing`/`removing` cannot yield a misleading partial purge inventory; unresolved physical attempts remain held. The existing `withRelease` lock serializes durable claims/publication against suppression without holding the lock during native work. A late successful PUT after revocation retains its exact object for cleanup but cannot release bytes.

New source migrations are `uploads/0001_upload_custody.sql` and `0002_control_grants.sql`; only the existing CONTROL role receives scoped grants. Root reserved ordinals64/65, after the exact63-entry prefix of the coherent union including routine0005/0006. **This older isolated base does not contain that entire prefix; the shared migration registry was deliberately not edited. Registration of64/65 preserving all63entries is mandatory at central composition before any deployment.** No live migration, activation or rollback operation ran.

## 6. Author validation

Windows Node24.22.1; retained exact dependencies reused through task-owned junctions, no install/cache/lock mutation. Commands run at checkout root, with Node's directory prepended to process PATH. Logs are in the parent workspace `work/`.

- `node --test apps/control/uploads/test/policy.test.mjs apps/control/uploads/test/extraction.test.mjs` plus directly affected structure tests: original policy slice25/25PASS (`wave5-upload-policy-tests.log`).
- Native S3 original/default/reconciliation and initial custody slice17/17PASS (`wave5-upload-custody-tests.log`).
- Final runtime/public/retention selection31/31PASS (`wave5-upload-source-final.log`). Includes actual CONTROL handler-to-generated JSON/binary receipt and captured runtime mount, unavailable composition, exact deletion/hold/current checks.
- After adding private input source and correcting nonempty retained extraction, custody/extraction22/22PASS (`wave5-upload-input-source-final.log`); failed witness retained in `wave5-upload-input-source-tests.log`.
- Existing retention-content79/79PASS (`wave5-upload-existing-retention-final.log`). Initial collection lacked window-resolution/UI dependencies; exact lock-equivalent read-only junctions resolved it. UI13dependency entries match the retained cache; local contracts link points at this checkout.
- Actual isolated PostgreSQL16.15 role/grant, concurrent idempotency, CAS, immutable original, reconstruction and never-attempted cancellation1/1PASS (`wave5-upload-postgres-final.log`). Dedicated marked upload DB is retained; only the verified A5-owned container was restarted and stopped, other DBs/volumes untouched. No shared/live database.
- `node packages/contracts/generate-uploads.mjs --check` PASS (`wave5-upload-generation-check.log`). TypeScript via `apps/runtime/node_modules/typescript/bin/tsc -p ../wave5-upload-public-types.tsconfig.json` PASS (`wave5-upload-public-types-final.log`); task config maps only the unpublished new export to its generated declarations. `git diff --check` PASS.

Counts overlap; they are not summed. No build, broad campaign, package publication, cloud/API/model/browser or live acceptance ran.

## 7. Failures and precise limits

The affected pre-existing product-family index test expects only two ports but actual base already supplies `actionApplicationFactory`. The exact same single assertion fails on untouched5fb6 and this candidate (`wave5-upload-index-base-witness.log`, `wave5-upload-runtime-tests.log`). The upload-family name list was updated; the unrelated stale port expectation was not repaired or called green. All new upload runtime cases passed.

Earlier fixture/clock expectation failures and the real retained extraction defect remain in logs. No failure was silently relabeled as native qualification. Unknown physical attempts can continue to hold purge until exact reconciliation; absence alone never settles a possibly late PUT.

## 8. Native ownership and remaining work

The first native host author slice is frozen separately at01d339ab45d25e3ad5435178d3ca7c00ef69f90f. Its successor owns Dockerfile/system-native lock, signed-definition provisioning, actual fixed tool CLI/image provenance and the copied Python extractor. The original parser bytes are retained in task evidence; they are not included in this custody checkpoint. That worker does not edit custody/public/retention/mount source.

Still owed: source join of the actual native host/config/CLI, pinned image/tool installation and signed-definition refresh, actual non-root ARM host/image/corpus evidence, input selector persistence/current source resolution/SDK Read, MF15 receiving UI, migration registration, later package/export binding and deployed acceptance. CONTROL's retained service has no Exec channel and no namespace syscall observation. Shared image identity is not host-capability proof. Root/Release is considering a supported non-serving prerequisite proposal; this does not authorize target work here.

## 9. Integration and next action

Independent Hermes source review is required for this exact bounded checkpoint. Preserve prior MM10/MM13/publication paging commits and immutable public archives. Next input source continuation uses the coherent96dcd18703fd3f51999c0385d4948740727f3173 union, retaining b4f revision selectors and serializing shared input family changes with M5/M7. This checkpoint is not an instruction to deploy, merge or enable native scanning.
