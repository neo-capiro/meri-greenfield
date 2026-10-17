# Lane 6: documents and artifacts

| | |
|---|---|
| Owner | Fable, lane-6 session |
| meri-greenfield branch | `fable/meri-lane6-documents-20261017`, base `ce2da186` (integration head of `fable/meri-first-chat-receiving-20261017`, PR #133; root `59856683`) |
| Commits | `271d6cab` (document-preparer test), `199b5df1` (renderer qualification owner), `5ff517eb` (this file), then the PR-number record |
| Draft PR | [#138](https://github.com/neo-capiro/meri-greenfield/pull/138) into `fable/meri-first-chat-receiving-20261017`; **held out of integration until the first shipment is live** |
| Status vocabulary | as in `../BACKLOG.md`. Everything here is **source** unless marked. Nothing in lane 6 is integrated, qualified, deployed or live-verified. |
| Files owned | `apps/artifacts/**`, `apps/control/document-application/**`, `apps/runtime/artifacts/**`, `apps/control/intents/document-preparer.mjs` and its test. Not touched: `infra/product-preview/**`, material/issuer files, `apps/runtime/conversation-runner.mjs`, contracts, migrations, lockfiles, frontend. |

## Summary

The Meri document stack is far more complete as source than the backlog's "to inventory" suggested: typed Word/Excel
generation, immutable full-replacement revision, inspect, download, preview publication and serving, preview custody,
signed revocable download/preview links, retention gates, S3/PG storage ports and a fail-closed qualified-renderer
port all exist with focused tests. dot's artifact branches (`dot/meri-artifact-{safety,publication,final-release}`)
are already contained in the base, by content.

What keeps documents dark is **composition, image and authority**, not Meri source:
1. No production startup composes the `artifactOptionsOwner` or `artifactStore` product ports, so every
   `/api/documents/*` route answers 503 (`apps/runtime/prepared-candidate.mjs:98` composes neither).
2. The product runtime image has no python-docx/XlsxWriter/openpyxl and no LibreOffice, so generation cannot run in it.
3. The per-request artifact authority (`artifactOptionsOwner.resolve`: binding, scopes, allocation, `authorize`) needs Core.
4. Artifact migrations `0001–0003` are not in the D2 plan and D2 grants nothing on `meri_artifacts` (by design for the first shipment).

This branch closes the two Meri-side source gaps that were in reach: the document preparer's failing test, and the
**renderer qualification owner** that nothing previously implemented (without it, PDF and office previews could never
become available, whatever the deployment).

## Inventory at `ce2da186` (before this branch)

"complete" = complete as source with focused synthetic tests. "partial" = source exists but a named piece is missing.
"absent" = no source. Paths are meri-greenfield.

### Generation and revision

| Capability | Status | Evidence |
|---|---|---|
| Typed Word (DOCX/TXT) and Excel (XLSX) generation, fixed Python entry | complete | `apps/artifacts/python/entry.py:11-52`, `office.py`, `apps/artifacts/local-executor.mjs:10-44` |
| PDF generation (create_word only), via qualified renderer | complete as source, **switch off** | `apps/control/document-application/format-admission.mjs:10`, `apps/runtime/artifacts/composition.mjs:36` (`pdfAdmission` and an available renderer) |
| PowerPoint generation | partial, not admitted | `apps/artifacts/presentation.mjs`, `slide-layout.mjs`; refused by `format-admission.mjs` and `apps/worker/conversation/intents/catalog.mjs:25` (DA-3 layout defect) |
| Write owner: budget reservation/settlement, immutable version commit, replay of the same delivery | complete | `apps/artifacts/postgres-service.mjs:11-150` (`namespace` `product` uses gateway budget 0001/0002, applied) |
| Immutable full-replacement revision with exact parent lineage | complete | `apps/control/document-application/index.mjs:15-21,49-53` (`/api/documents/revise`), `apps/artifacts/service.mjs:8` |
| Completed-delivery recovery from verified immutable artifacts | complete | `apps/artifacts/recovery.mjs:4-46`, `local-replay.mjs` |
| HTTP document application (create, revise, inspect, download, preview, preview-publish) | complete | `apps/control/document-application/index.mjs:36-77`, `http.mjs:11` |
| Per-request runtime mount over a trusted options owner | complete | `apps/runtime/artifacts/application.mjs:58-93` |
| Options composer (storage, executor, budget pool, renderer, previews) | complete | `apps/runtime/artifacts/composition.mjs:34-45` |
| **Production `artifactOptionsOwner.resolve`** (session → artifact context, allocation, authority) | **absent** | only test fixtures implement it (`apps/runtime/artifacts/test/fixture.mjs:22`); needs Core |
| Model-facing draft intent (`request_document` → create_word/create_excel immutable draft) | complete, lane 6 | `apps/control/intents/document-preparer.mjs:14-32`; rows `apps/worker/conversation/intents/catalog.mjs:23-24` |
| Model-facing revision intent | **absent** | catalog has no revise operation (`packages/contracts/retrieval-0.2/catalog.json`: create_word/create_excel/create_powerpoint only); preparer passes `baseVersionId:null` (`document-preparer.mjs:25`) |
| Runner → control prepare transport for intents (P-INT-9) | absent (lane 1/3) | `apps/runtime/conversation-runner.mjs:76` passes no `governedIntents` |
| Selected-output (skill) document lineage | complete | `apps/control/document-application/selected-output/bridge.mjs:30-50`, `session.mjs:8-23` |
| Attachment filing (`artifact.file`) | partial: resolver exists, no proposal owner | `apps/artifacts/filing.mjs:18`; `catalog.mjs:33` OWNER_MISSING |

### Previews

| Capability | Status | Evidence |
|---|---|---|
| Preview owner: render once per version, bounded PDF, serve, idempotent republish | complete | `apps/artifacts/preview/service.mjs:26-82`, `render.mjs:7-29` |
| Preview routes with read-path authorization and retention rechecks | complete | `apps/control/document-application/preview-route.mjs:16-45` |
| Preview custody (claim, journal, recovery), PG store, S3 evidence | complete | `apps/artifacts/preview/{claim,custody-journal,custody-recovery,postgres-custody,postgres-store,postgres-composition}.mjs`, `apps/artifacts/storage/s3-preview-evidence.mjs` |
| Preview schema | complete, **unapplied** | `apps/artifacts/migrations/0003_previews.sql` |
| DOCX/XLSX/PPTX previews need an available renderer port | gated | `preview/render.mjs:13`; TXT is `ARTIFACT_PREVIEW_UNSUPPORTED`, PDF previews as itself |

### Downloads and signed links

| Capability | Status | Evidence |
|---|---|---|
| Canonical download (exact verified bytes, attachment, no-store) | complete | `apps/control/document-application/index.mjs:63-67` |
| Signed link codec (HMAC over version, sha256, scope, actor, expiry, suppression generation) | complete | `apps/artifacts/storage/signed-download.mjs:10-35` |
| Link issue/redeem routes, linearization, preview-target links | complete | `apps/runtime/artifacts/download-links.mjs:40-114` |
| Revocation by suppression generation (no token store) | complete | `apps/runtime/artifacts/suppression-generation.mjs:6` |
| Readiness gate (enabled, retention, options owner, private-bucket proof, key file) | complete | `apps/runtime/artifacts/download-gate.mjs:14-41`; opened by `apps/runtime/control.mjs:154` |
| `downloadLinks` config block (`enabled`, `keyFile`, `ttlMs` 1–300 s) | complete | `apps/runtime/config.mjs:74`; material `apps/runtime/material-init-plan.mjs:115` (lane 1) |
| Mount in control | complete, **closed** | `apps/runtime/product-applications.mjs:61-63,70`; closed because no options owner/store is composed |
| Private bucket proof (`verifyPrivate`) | complete | `apps/artifacts/storage/s3-private-bucket.mjs:10` |

### Storage, retention, migrations

| Capability | Status | Evidence |
|---|---|---|
| S3 objects (SSE-KMS, FULL_OBJECT checksum, expected owner) | complete | `apps/artifacts/storage/s3-objects.mjs:8-54` |
| PG versions/heads, publication projection, source recovery | complete | `apps/artifacts/storage/postgres-versions.mjs:9`, `artifact-publication.mjs`, `postgres-source-recovery.mjs` |
| Runtime storage composition | complete | `apps/runtime/artifacts/composition.mjs:11-25` |
| Retention read gate and artifact recovery binding | complete | `apps/artifacts/service.mjs:11`, `apps/runtime/artifacts/recovery-binding.mjs`, `apps/runtime/control.mjs:58-64` |
| Migrations `meri_artifacts` 0001 versions, 0002 retention, 0003 previews | complete as source, **not applied** | `apps/artifacts/migrations/0001_versions.sql`, `0002_retention.sql`, `0003_previews.sql`; absent from `infra/product-preview/first-chat-migrate.mjs:32-54`; D2 grants none (`../D2-DATABASE.md:206`) |

### Qualified rendering

| Capability | Status | Evidence |
|---|---|---|
| Qualified-renderer port (fail closed unless all 8 sandbox requirements attested) | complete | `apps/artifacts/renderer.mjs:13-72` |
| LibreOffice transformer (owned workspace, fixed profile) | complete | `apps/artifacts/office-transform.mjs:20-43` |
| Native openability/recalculation checks | complete (opt-in LibreOffice) | `apps/artifacts/native/checks.mjs:34-72` |
| **Renderer qualification owner** (issues the admission record) | **absent** before this branch | `renderer.mjs:6-8` names it; nothing produced `qualificationId` outside tests |
| Office image qualification probe (worker image, Fargate) | complete as source, not run | `apps/worker/qualification/probes/office-export.mjs`, `artifacts.mjs` |
| LibreOffice / python-docx / XlsxWriter in the product image | **absent** | no reference under `infra/product-preview/` (lane 1) |

### Frontend (dot's repository)

The previous inventory found the files workflow, signed-link client and conversation artifact access on capiro-frontend
HEAD and PR heads but **not on `origin/main`**. Lane 6 did not change capiro-frontend.

## Changes on this branch

| Commit | Change |
|---|---|
| `271d6cab` | `apps/control/intents/test/fixture.mjs`: authority expiry follows the caller clock (`expiresAtMs:now()+60000`). **Byte-identical to lane 3's hunk in `701c02bf` (PR #137)**, so either merge order is clean. `document-preparer.test.mjs`: the real-generation case skips, with a stated reason, on Windows unless `MERI_DOCUMENT_PYTHON` is set; it always runs on Linux. |
| `199b5df1` | New `apps/artifacts/renderer-qualification.mjs` and `renderer-probe.mjs`: the renderer qualification owner. It runs the probe and `soffice --version` through the transformer's exact spawn path (`runArtifactProcess`) and sets each of the eight requirements only when observed (uid/gid non-zero; only `lo`; root mount `ro`; `NoNewPrivs: 1`; zero Inh/Prm/Eff/Amb capabilities; 0700 workspace under the temp root with HOME/TMPDIR bound to it; finite cgroup memory, pids and cpu; fixed env names only, trusted credential paths unopenable, and no network). Image digest and qualification id are trusted inputs. The result is `createLibreOfficeRendererPort(...)`, so a failing observation names the missing requirements. |

### The document preparer's remaining failure

With lane 3's clock fix, `document-preparer.test.mjs` was 3/4. The fourth case was environmental, not a code defect:
`apps/artifacts/python/entry.py:2,13` imports POSIX `resource` to set rlimits, Windows Python has no `resource`, so the
fixed entry exited 1 → `ARTIFACT_PROCESS_FAILED` → `ARTIFACT_BUDGET_SETTLEMENT_UNKNOWN` → preparer `UNKNOWN`. With a
Windows-local no-op `resource` shim interpreter (scratch only, not committed, not a sandbox) the file passes **4/4**.

### What the renderer owner means for deployment

Running LibreOffice as a child of today's control task cannot qualify: that child has network (`eth*`), a writable
root, `NoNewPrivs: 0`, an unlimited `pids.max`, and can open control's secrets (download-link key, DB connection file).
The test "a converter child of the control task … stays unavailable" pins exactly that outcome
(`noNetwork, readOnlyRootFilesystem, noNewPrivileges, boundedResources, noCredentials` missing). A qualifying renderer
needs its own task or sandbox: no ENI egress and no task role, read-only root, `noNewPrivileges`, all capabilities
dropped, a separate uid, and cgroup memory/pids/cpu limits. That is a lane-1 deployment decision; this branch only makes
the evidence and the gate exact.

## Tests (this host: Windows, no pagefile, one file at a time)

`MERI_REVIEW_SOURCE_ROOT=<worktree>`. `MERI_DOCUMENT_PYTHON` = scratch Python 3.11 with a no-op `resource` shim, where noted.

| File | Result |
|---|---|
| `apps/control/intents/test/document-preparer.test.mjs` | base 2/4; with the clock fix 3/4; this branch 3/3 + 1 visible skip (no Python env), **4/4** with the shim interpreter |
| `apps/artifacts/test/renderer-qualification.test.mjs` (new) | **9/9** + 1 opt-in; opt-in with real `soffice.com --version` passes (version parsed, port unavailable off Linux) |
| `apps/artifacts/test/renderer-port.test.mjs` | 6/6 |
| `apps/artifacts/storage/test/{signed-download,s3-private-bucket,s3,postgres,s3-preview-evidence}.test.mjs` | 4/4, 4/4, 7/7, 8/8, 12/12 |
| `apps/artifacts/test/{preview-claim-validation,preview-custody,preview-postgres-store,preview-migration-source,artifact-retention,artifact-final-release}.test.mjs` | 8/8, 6/6, 4/4, 3/3, 3/3, 3/3 |
| `apps/runtime/artifacts/test/recovery-composition.test.mjs` | 10/10 |
| `apps/runtime/artifacts/test/download-links.test.mjs` | 18/19: the real-workbook case needs XlsxWriter (absent on this host) |
| `apps/control/document-application/test/application.test.mjs` | 18/19: the real DOCX case needs python-docx (absent) |
| `apps/runtime/artifacts/test/runtime.test.mjs` | 4/6: the two real DOCX/XLSX cases need python-docx/XlsxWriter |
| `apps/artifacts/test/preview-service.test.mjs`, `apps/control/document-application/test/preview-http.test.mjs`, `apps/artifacts/test/document-replay.test.mjs` | not runnable here: every case generates real DOCX/XLSX (python-docx/XlsxWriter absent; no network to install) |
| `apps/runtime/artifacts/test/download-links-redaction.test.mjs` | not runnable here: `readSecret` requires POSIX owner-only key-file modes |

None of these runs is Linux, image, real PG, real S3 or LibreOffice-in-image evidence. Before receiving this branch,
the Linux image gate should run every file above, unshimmed.

## Capability status after this branch

| Capability | Source | Integrated | Qualified | Live |
|---|---|---|---|---|
| Generation (DOCX/TXT/XLSX) and immutable revision over HTTP | complete | no (PR held) | no: image lacks Python Office libs | no |
| Model draft intent (`request_document`) | complete (test green with Linux/shim) | no | no | no: P-INT-9 transport absent |
| Model revision intent | absent: contract | no | no | no |
| Previews (publish, serve, custody) | complete | no | no: renderer unqualified, 0003 unapplied | no |
| Downloads (canonical) | complete | no | no | no: routes 503 (no options owner) |
| Signed download/preview links | complete | no | no | no: gate closed (no key, store proof or options owner) |
| Qualified rendering: port + **qualification owner** | complete (owner new here) | no | no: needs a sandboxed renderer task | no |
| Production composition (options owner, store, executor, renderer, previews) | absent: Core seam, lane-1 call site | no | no | no |

## Dependencies

**dot (Core, shared frontend, contracts):**
1. **Artifact authority for `artifactOptionsOwner.resolve`**: per request, from the caller's action session, return the
   canonical `artifactOptions` that only Core can authorize: `context` (binding, ordered scopes, evidence, `deadlineMs`,
   `maxBytes`), `allocationJson` and `producerContext` for the product budget, `authority.check`, `authorize` for
   `artifact.publish` / `artifact.inspect` / `artifact.download` on the exact version, `selectedClientId`, the artifact
   capability `credential`, and `recheck(phase)` against current Core state. Meri supplies storage, executor, budget pool,
   renderer and previews through the existing `createRuntimeDocumentOptionsComposer`. Shape reference:
   `apps/runtime/artifacts/test/fixture.mjs:22-25` (synthetic, not a contract).
2. **Revision via chat**: a catalog operation, or a `request_document` argument, carrying `baseVersionId` (a
   `packages/contracts` change; coordinate on PR #121 before anyone edits it).
3. **Frontend**: land the files workflow, signed-link client (`POST /api/documents/links/{issue,redeem}`, token only in the
   body) and conversation artifact access on capiro-frontend `main`. Draft results arrive through lane 3's intent history
   as `{status:'draft',version}`.

**Lane 1 (images, startup, infra, migrations):**
1. Compose `artifactStore` (`createRuntimeArtifactStorage`) and `artifactOptionsOwner` in control startup. The composer
   needs control's own `sessions` object, which `productPortsFactory` does not receive today (`apps/runtime/control.mjs:68-78`),
   so the call site belongs inside `assembleControl`.
2. A document image or renderer task with Python 3 + python-docx, XlsxWriter, openpyxl, Pillow and LibreOffice, and a
   sandbox that passes `qualifyLibreOfficeRenderer` (see above). Pass its image digest and a qualification id from image provenance.
3. Apply `meri_artifacts` 0001–0003 (IDs already allocated in the artifact namespace; **no new migration ID needed**), plus
   grants. D2 currently grants nothing on `meri_artifacts` and requires `retention` unset; both change only under Neo's approval.
4. Private artifact bucket with SSE-KMS and the four read-only `s3:GetBucket*` permissions for `verifyPrivate`; the
   download-link signing key file (`downloadLinks.keyFile`, ≥32 random bytes, control-only).
5. P-INT-9: the runner → control prepare transport, so `request_document` reaches `createDocumentIntentPreparer` (shared with lane 3).

**Lane 3:** PR #137 carries the same fixture clock line; land either first.

## Acceptance

- **Source (this PR):** `document-preparer.test.mjs` 4/4 on Linux; `renderer-qualification.test.mjs` 9/9 on Linux, plus a
  real-probe run whose observation is retained; no other file regresses in the image gate's artifact suites.
- **Qualified:** in the real document/renderer image, `qualifyLibreOfficeRenderer` returns `available`, with a retained
  observation sha256 and receipt; the DOCX/XLSX/PDF generation and preview suites pass unshimmed against real PG and S3.
- **Live:** an authenticated user asks Meri for a Word draft (an immutable draft needs no approval; filing or sharing it is
  a separate governed request), sees it in the conversation, opens its preview, revises it into a new version whose parent is the original, downloads both through
  signed links, and a link issued before a suppression is refused after it.

## Remaining tasks

1. (lane 1, after the first shipment) Composition call site, document image, renderer task, migrations, bucket, key.
2. (dot) Artifact authority port; revision contract; frontend on `main`.
3. (lane 6, once 1–2 exist) Wire the renderer qualification result into the composition (`renderer`, `pdfAdmission`,
   `previews`); run the Linux suites; record qualification evidence; then live acceptance with dot.
