# Meeting attachment approval and saved-note debrief source

## Source and ownership

- Isolated checkout: `C:/dev/meri-meeting-review-261011`.
- Branch: `codex/portfolio-meeting-review-20261011`.
- Start: `5af2abae91faa41172c6d001020b681d9a60d117`.
- Shared policy read: `b32b4803933760dc0a93fffdcd8fba30a89c3aac` (fetched policy origin `b2b0ce8c2bf03817b81e671d968b7892985b8d06`; local policy ahead, preserved). Machine-map revision: 2026-09-30T00:21:48.2698715Z.
- Canonical backend freshly fetched/read at `fd8765ec01d292013758606204f2c9d886cd31c1`. Primary backend files were read with `git show origin/main:…`; no backend changes.
- New focused `calendar/review` modules only. Root owns existing Calendar/debrief composition, shared browser main, and canonical public exports.

## Current design and explicit qualifications

Figma `Prototype — Capiro 3.1`: design context and screenshots inspected for 411:64308 (mobile debrief sources), 411:63894 (mobile saved notes), and 411:64347 (desktop preparation). The source screen offers meeting notes, upload, voice and manual sources, then explicit Generate Debrief. The notes screen has “Draft a debrief from these notes”. Preparation component context explicitly separates saving, approval and per-artifact sharing. Source review uses existing 36px buttons, Geist, current border/foreground tokens, 10px radii, approved primary gradient through the canonical button class, and responsive existing Dialog.

No dedicated current attachment-approval frame is identified by the baseline row. The small inline list exposes the verified operation rather than inventing a scan/review workflow. Approval is a recorded reviewer/time only; security scan, extraction and sharing remain independent.

## Canonical endpoint map

| Operation                      | Current Core endpoint                                            | Actual semantics                                                                                                                                                                                                   |
| ------------------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Meeting preflight              | GET `engagement/meetings/:id`                                    | Caller-owned calendar/created meeting; exact meeting/client response required.                                                                                                                                     |
| Saved notes                    | GET `engagement/meetings/:id/notes`                              | Caller-owned meeting; decrypted body only when `canReadEncryptedEntry` permits. Returns note ID, meeting/client, author, body and timestamps; no Meri source identity.                                             |
| Debrief proposal               | POST `engagement/meetings/:id/debrief-draft`                     | DTO supports `manual`, `upload`, `voice`, not `meri`. Generates proposal and records AI usage; does not persist a debrief. Existing generation feature owns this call.                                             |
| Current accessible attachments | GET `engagement/attachments?meetingId=:id`                       | Validates parent; excludes superseded files; canonical viewer OR uploader predicate; hearing access filter; supplies readiness and signed URLs only when usable.                                                   |
| Attachment approval            | POST `engagement/meetings/:id/attachments/:attachmentId/approve` | `ensureOwnMeeting` plus tenant/meeting attachment existence, then sets `approvedAt` and `approvedByUserId`. Does not scan, extract, approve notes or share. Raw receipt does not contain a fresh `usable` verdict. |

All requests use the canonical same-origin API client, no host checks or independent storage/provider client. Reads are actor/tenant/meeting/client keyed. Canonical dispatch guard checks current idle non-invalidated identity and current role, plus external action capability for generation. Changing the open meeting remounts its bound review; revoked actor/session cannot dispatch or publish late receipts.

## Public integration

```tsx
import {
  MeetingAttachmentApprovals,
  SavedMeetingNotesSource,
} from "./review/public";

<MeetingAttachmentApprovals meeting={meeting} />

<SavedMeetingNotesSource
  meeting={meeting}
  open={savedNotesOpen}
  onOpenChange={setSavedNotesOpen}
  onGenerate={generate}
/>
```

`meeting` uses only the canonical Meeting `id` and `client`. `onGenerate` accepts `{text: string, method: 'manual'}` and returns boolean: true hands off to the existing generator and closes the source review; false retains it. It must use the existing explicit generation path and existing review/save editor. No second editor or automatic save/approve/share is introduced. Opening or selecting notes only reads; Generate re-fetches the meeting and exact selected note and refuses any changed body, updatedAt, author, confidentiality, parent or restricted status before handoff. No claim that these versionless reads provide server CAS.

Attachment approval re-fetches current accessible file and meeting, compares storage/content/viewer/readiness state, requires a reviewed-file acknowledgement, and validates exact tenant/meeting/client/file/content plus current approving actor/time in the receipt. Known HTTP refusal permits a new deliberate attempt; lost/invalid/failed replies or local authority loss after dispatch freeze repeat. Refresh may resolve an uncertain attempt when an approved current row is observed; an unapproved GET cannot prove an in-flight POST will never finish and does not unfreeze it. No automatic mutation retry. It invalidates canonical meeting/client-files caches after verified success.

## Remaining evidenced dependencies

| Audit ID                 | Implementation state                                                                                                                                    | Specific owner contract/dependency                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ENG-attachment_approve   | Frontend candidate composed and browser-qualified against intercepted existing contracts. Live integration and server authorization repair remain open. | Canonical server approval does not enforce viewer ACL, current/superseded version or readiness. Frontend preflight is a best-effort boundary and cannot close revocation/write race. Engagement/security owner must review a narrow server transaction: caller-owned meeting; attachment exact tenant/meeting/current ID; canonical existing viewer predicate without admin bypass; readiness at approval time; then matching approval receipt. No backend patch, registration or deployment in this slice. |
| ENG-debrief_source_notes | Qualified saved-meeting-note source candidate. Exact Meri provenance requirement remains open.                                                          | Worker `finishTranscript` discards the returned `createMeetingNote` ID; notes serializer has no origin/session field; `SESSION_SELECT` exposes debrief ID, not note ID. Engagement/notetaker owner must persist and authorize a note↔session identity or expose canonical immutable provenance. Do not infer Meri origin from ordering, author or coarse meeting status.                                                                                                                                    |

The notetaker currently saves approved confidential notes, then best-effort also creates an approved debrief from the same draft. This new manually reviewed saved-note generation route does not alter or claim to replace that pipeline. Source wording deliberately says **Use saved meeting notes**. No private data, credentials or live writes used.

## Qualification so far

- Node 24.19.0, read-only existing root dependencies; no installs/builds.
- Focused unit/API checks: **38/38 PASS** (exact identity/content receipts, wrong parent/viewer/current version, pending preflight authority loss, lost reply and post-dispatch local refusal).
- Full source/tests TypeScript: PASS.
- Focused lint: PASS; borrowed-dependency React detection/pages-directory warnings retained.
- Initial unit failure preserved under task `work/initial-unit-failure.txt`: fixture assertion incorrectly expected list-only `usable` in raw approval receipt. Corrected to assert exact approval identity/time/actor and absence of a new usable verdict; source safety assertions retained.
- Actual composition: root `90cbe1e` (canonical public `signedUrl` export) and `55ccbb0d228d9dd62aa9b6ecb015face2847677c` (existing generator/editor and Calendar preparation integration). Local cherries `a97f6f0` / `ec10757` are test setup, not new root deliveries. The browser main conflict was resolved only to add MeetingReviewHarness, preserving local main; absent BillingSummaryHarness was not imported.
- Source follow-up `fe623742cfe9d4f7be81ca62a20f6bc01b7fda72` binds the review acknowledgement to file/content/viewer identity, not only file ID, and preserves uncertainty on the caller's post-receipt authority guard.
- **22/22 actual-component browsers PASS** in 28.8s, including actual client Calendar deep link, full source → generation → existing editor → explicit save, 503/retry/401, wrong-parent notes, blocked/nonviewer files, stale source/file, lost/malformed approval receipts, explicit known-refusal retry, held actor/tenant/role/identity/unmount preflights, and post-dispatch role loss. All requests intercepted on isolated 5193; no live mutation. Canonical shared fixture authority was reused, not replaced.
- Desktop source review, mobile dark source review and actual Calendar approval screenshots opened and visually inspected. Dialog widths 660px desktop / 358px at 390px viewport, current dark surface, responsive actions and no horizontal overflow verified. No new static assets or screenshot-as-UI assets.
- Static architecture: **388 modules PASS** (typed boundaries, foundation direction, origins and cycles). Formatting PASS. Full source/tests TypeScript and focused lint PASS.
- Browser first pass 18/18 PASS. Expanded run retained 19 PASS / 1 failure / 2 not run: expiry assertion incorrectly looked for a dialog-local sign-in link. Canonical DataProvider correctly unmounted the whole tree and showed the global expired-session page. Corrected test explicitly requires that page, its `/sign-in` link, source dialog absent, and zero generation/save; original screenshot, trace, JSON and console output retained. No product behavior changed to accommodate the test.
- Listener 5193 closed by owned Playwright server teardown; parent 5191 untouched. No live integration, production visual baseline change or shared backend closure claimed.
