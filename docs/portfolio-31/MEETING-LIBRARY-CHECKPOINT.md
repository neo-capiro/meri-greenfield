# Calendar library and assignment checkpoint

## Outline and ownership before implementation

- Worktree `C:/dev/meri-meeting-library-261011`, branch `codex/portfolio-meeting-library-20261011`, pinned root integration `caa9b42fc1e48e68d4367c3ec1f6c751b92aead9`. Remote Meri main verified `406939008b624b42c6c3b5eb14538df91ec0eded`.
- Fresh shared policy `b32b4803933760dc0a93fffdcd8fba30a89c3aac` (remote `b2b0ce8c2bf03817b81e671d968b7892985b8d06`, clean local merge preserved). Machine map modified 2026-09-30T00:21:48.2698715Z. Read repository AGENTS, implementation standards and portfolio AGENTS. Explicit Node 24.19; read-only existing dependencies; no install/build/live writes.
- New `features/calendar/library/**` owns library metadata schemas/adapters, URL filters, paginated rendering, dedicated client assignment and transcript extraction handoff. Existing calendar/detail/notes/debrief composition belongs to root.
- Root approved extending canonical `features/files/upload.ts` and `files/public.ts` for meeting-scoped parents while preserving `uploadFile` and its assertions. No parallel storage client or second editor.
- Server owns tenant/caller/calendar authorization, artifact association, sharing revocation, scanning, extraction and persistence. Client uses existing HTTP client, Query cache, identity, clients and Radix Dialog. Filters are URL state; upload attempt metadata is transient, never local storage.
- Verify meaningful adapter/unit and actual composed browser tests on strict port5193; preserve failures and distinguish fixtures from live integration.

## Verified design and contracts

Mandatory Figma design-to-code high-fidelity context and screenshots inspected: `411:64419` approved-material library; `411:63843` assignment; `682:142734` transcript source dialog. Library content has no static image assets; existing shell assets remain root-owned.

Backend reference `C:/dev/cap-portfolio-prospect-stages-20261011` at `fd6ed6c017ae91ab774fd34f74475a746de13b68`; engagement files unchanged from current remote main `fd8765ec01d292013758606204f2c9d886cd31c1`.

| Baseline ID         | Verified contract / semantics                                                                                                                                                                                                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ENG-meeting_library | GET `/api/engagement/meetings/library`: search subject/client name, clientId, artifactType=prep/notes/debrief, visibility=private/shared, from inclusive/to exclusive, page/limit. Response data/total/page/limit with libraryQualifiedBy kind/current. Caller-owned only; historical qualification does not mean currently approved. |
| ENG-meeting_assign  | PUT `/api/engagement/meetings/:id` with clientId or null. Service checks caller/calendar ownership, moves children atomically, revokes sharing on changed association and updates KB association. DTO exposes no expectedRevision: fresh preflight cannot guarantee CAS.                                                              |
| ENG-upload_prepare  | POST attachments/upload-url accepts meetingId/clientId, fileName/contentType/contentLength. Direct signed storage POST uses existing uploader.                                                                                                                                                                                        |
| ENG-upload_confirm  | POST attachments/confirm checks parents/key/bytes, returns meeting/client/key metadata; exact-key replay is idempotent; scanning may quarantine.                                                                                                                                                                                      |
| ENG-upload_extract  | POST attachments/:id/extract-text is runtime gated, rechecks parents/readiness, returns attachmentId/text/truncated/disclosure. Extraction never approves, shares or proves indexing.                                                                                                                                                 |

No baseline IDs `ENG-upload_transcript` or `ENG-extract_transcript` exist. Figma advertises .vtt/.srt; current server MIME allowlist lacks text/vtt/application/x-subrip and the Files fallback catalog lacks these extensions. Do not pretend support. Exact debrief generation route is POST meetings/:id/debrief-draft with method=upload and sourceText, runtime gated; existing editor integration remains root-owned.

## Results

### Delivery and public interfaces

- Initial source/unit commit `0a8364c16a1a61ba2591a2e262bd59068b41c27a`; identity/runtime gate follow-up `4f58541ca8eaacf06483c25396dd5b834a8eaf58`; asynchronous dispatch guard `ce30758c2fafc50dc375e1be36938c10cbc56906`.
- Root's actual Calendar/detail/editor composition `add8630985df3f969c22d58bc8fab07d4dc58ba8` was cherry-picked as `61ce7e4`. Root's Figma Library shell correction `95b0bc0574e02883978734643125c7b8c435680f` was cherry-picked as `6b82fdf`; current debrief dispatch guard `b51ad0c77a170e9ef854d581e05807ae8fbf1d3d` as `947e2cd`. No root-owned source was independently edited.
- `MeetingLibrary({ clientId?, zone, onMeeting, onClose })` renders the caller's real paginated approved-material archive. Search, artifact kind, visibility and civil date range are URL state; clearing them preserves Calendar scope/date/view/zone. Historical approval is explicitly distinguished from current approval. Invalid filters, wrong-client/page/duplicate receipts, empty/error/retry/session-expiry/permission states are handled.
- `MeetingAssignment({ meeting, open, onOpenChange, onAssigned? })` reuses accessible clients. The user explicitly reviews child artifact movement and sharing revocation. Fresh preflight detects earlier association/sharing changes, retains unsaved selection, and requires another review before retry. Receipt must match meeting/client and be private after reassignment. Calendar, meeting and both affected Files caches invalidate.
- `MeetingTranscriptUpload({ meeting, open, onOpenChange, onExtracted })` extends the canonical Files uploader. Same-ticket confirmation recovery survives an unknown storage reply; wrong-parent/key/file receipts fail closed. Extraction failure retries extraction using the confirmed attachment without uploading again. Truncation/disclosure and extracted text are shown before explicit **Use extracted source**.
- Root's reviewed source handoff generates through the existing upload-source debrief endpoint and opens the existing MeetingArtifacts editor. Only explicit **Save debrief** persists it. No second editor, auto-save, approval, email/provider/calendar write or sharing action was added.
- The library-local dispatch guard reads the current canonical identity/cache state immediately before later authenticated writes and storage dispatch. It binds the initiating actor/tenant, requires idle successful identity/runtime queries, refuses invalidated/error/role changes, and checks mounted lifetime. Assignment checks after its awaited GET; upload checks after ticket/storage/confirmation and before extraction. Late results cannot populate the departed form. This is a frontend dispatch boundary, not a substitute for server authorization.

### Check results and preserved evidence

| Check                                                                           | Result                                                            | Local evidence                                                   |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------- |
| Focused units plus original Files assertions and composed debrief adapter tests | **28/28 PASS**, four files                                        | `work/unit-guarded.log`                                          |
| Actual composed Calendar/ClientFrame browser cases                              | **12/12 PASS**                                                    | `work/browser-layout-final.log`, `work/browser-results.json`     |
| Strict app-wide TypeScript with read-only installed dependency aliases          | PASS                                                              | `work/typecheck-final.log`                                       |
| Scoped ESLint                                                                   | PASS, no errors; reference-runtime React/pages discovery warnings | `work/lint-final.log`                                            |
| Architecture direction, origin/type boundaries and cycles                       | PASS, 246 modules                                                 | `work/architecture-final.log`                                    |
| Prettier and git diff whitespace                                                | PASS before final commit                                          | `work/format-final.log`, `git diff --check`                      |
| Full production build / broad regression / live backend mutations               | **NOT RUN** in this bounded slice                                 | Root owns full gate; no installs/build cache/live writes allowed |

Browser cases cover server-side filters/pagination and DST boundaries, deep-link/detail return, failure/retry/empty/wrong-scope/401, read-only role, mobile dark layout, reviewed assignment/conflict/retry and wrong receipt, source upload → readiness failure → explicit extraction retry → reviewed generation → existing editor → explicit save, same-ticket lost-reply recovery and wrong-parent refusal. Four held-request cases leave the meeting during assignment GET or upload ticket/storage/confirmation; they assert zero later PUT/storage/confirmation/extraction as appropriate. All browser service/storage requests are intercepted synthetic fixtures; these checks do not prove live service behavior.

Preserved first failures include TypeScript alias discovery (`work/typecheck.log`), Windows ESLint import and render-ref findings (`work/lint-initial.log`, `work/lint-rerun.log`), the pending root public export (`work/typecheck-pre-composition.log`), mixed ancestor Playwright installation (`work/browser-initial.log`, `work/browser-setup-failure.json`), and the initial composed debrief fixture's rejected provider value/editor title (`work/browser-rerun.log`, `work/browser-first-composed.json`, `work/browser-first-composed-artifacts/`). No assertions were removed or baselines regenerated to pass. Intermediate successful results remain separately preserved.

### Visual review

Inspected `work/screens/meeting-library-desktop.png`, `meeting-library-mobile-dark.png`, `meeting-assignment-review.png`, and `meeting-transcript-review.png` against the required current Figma contexts. The Library uses the shared 64px global header, 232px client navigation, 20px heading and 24px/32px content padding. Root corrected the prior redundant ClientHeader in Library mode; owned content now has working 16px section gaps. Search submission, real pagination, date-zone qualification and explicit review/error disclosures are deliberate functional additions. Transcript review expands the initial design dialog to expose actual extracted text/truncation before use. Mobile 390×844 dark mode has no horizontal overflow. Owned content has no raster/SVG assets to reproduce; existing shell assets are reused. Browser font fixtures are not a production-font fidelity claim.

### Configuration and isolation

| Frontend request                                                                                            | Existing configuration / destination                                                                                                         |
| ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Library / assignment / attachment preparation, confirmation, extraction / capabilities / debrief generation | Existing `ApiClient` → authenticated `/api/backend/core/engagement/...` proxy → validated `CORE_API_BASE_URL`; Clerk `capiro` token template |
| Direct upload bytes                                                                                         | Only the verified service-issued HTTPS signed storage URL; credentials omitted, redirects refused, bounded 60-second timeout                 |
| Local composed browser                                                                                      | Actual existing browser fixture main on strict `http://127.0.0.1:5193`; all API/storage effects intercepted                                  |

No API origins, secrets or session values were added to source/evidence. No auth/CORS/shared routing/deployment/migration/provider changes, dependency install/copy or build were made. Browser server is stopped by its owned test runner after checks. No hosted preview was created in this slice; root owns preview/deployment coordination.

### Reproduction

Normal installed application commands remain `npm run typecheck`, `npm run lint`, `npm test -- tests/meeting-library.test.ts tests/meeting-upload.test.ts tests/files.test.ts tests/meeting-debrief.test.ts`, and `npm run test:browser -- tests/browser/meeting-library.spec.ts` from `apps/portfolio-web`, using Node24/npm11 and the existing frozen lockfile. Root owns the full build gate. For this source-only checkout, tests borrowed the read-only existing dependency tree without installing:

```powershell
$node = 'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
$deps = 'C:/dev/meri-greenfield-portfolio-31/apps/portfolio-web/node_modules'
& $node "$deps/typescript/bin/tsc" -p work/tsconfig.json
& $node "$deps/vitest/vitest.mjs" run --config work/vitest.config.mjs apps/portfolio-web/tests/meeting-library.test.ts apps/portfolio-web/tests/meeting-upload.test.ts apps/portfolio-web/tests/files.test.ts apps/portfolio-web/tests/meeting-debrief.test.ts
& $node "$deps/eslint/bin/eslint.js" --config work/eslint.config.mjs apps/portfolio-web/src/features/calendar/library apps/portfolio-web/src/features/files/upload.ts apps/portfolio-web/src/features/files/public.ts apps/portfolio-web/tests/meeting-library.test.ts apps/portfolio-web/tests/meeting-upload.test.ts apps/portfolio-web/tests/browser/meeting-library.spec.ts
$env:NODE_OPTIONS = '--require=C:/dev/meri-meeting-library-261011/work/test-resolution.cjs'
$env:NODE_PATH = $deps
& $node "$deps/@playwright/test/cli.js" test --config work/playwright.config.cjs
```

Transient configs in `work/` alias only the installed reference dependencies and existing actual browser fixture entry point; no second committed application/harness was created.

### Audit implementation state and remaining dependencies

| ID                                      | Implementation state                                                                                                    | Remaining evidenced limit / owner                                                                                                                                           |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ENG-meeting_library                     | Verified existing contract; frontend implemented and actual component fixtures verified                                 | Root owns designated live read/paging qualification. Caller-owned archive semantics retained; no teammate-private calendar access inferred.                                 |
| ENG-meeting_assign                      | Verified existing contract; frontend explicit review and receipt/cache/error behavior implemented and fixtures verified | Backend owner: DTO has no expectedRevision/CAS. Fresh preflight cannot prevent a simultaneous reassignment. No live association/artifact/sharing writes performed.          |
| ENG-upload_prepare / ENG-upload_confirm | Verified existing contract; canonical parent-scoped uploader extended and fixtures verified                             | Root/backend owners: designated storage/scan validation and parent authorization need live qualification. Unknown completion retains recovery; no approval/indexing claim.  |
| ENG-upload_extract                      | Verified runtime-gated contract; reviewed extraction/generation/editor handoff implemented and fixtures verified        | Root/backend owners: live scanner/extractor/provider checks not run. VTT/SRT need approved MIME/extension support in existing backend/Files contracts before UI acceptance. |

Original audit evidence remains read-only and unchanged. These rows are frontend implementation/fixture qualification results, not full Portfolio completion or proof of production integration. No legacy outreach, engagement-wave planning, speculative decision rules or additional backend changes were introduced.
