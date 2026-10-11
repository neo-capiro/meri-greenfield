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

Implementation/check evidence pending. No integration or coverage completion claimed yet.
