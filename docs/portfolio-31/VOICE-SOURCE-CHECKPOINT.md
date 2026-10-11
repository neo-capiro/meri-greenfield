# Voice-memo debrief source

Audit: `ENG-debrief_voice`. Source-only worktree `C:/dev/meri-portfolio-debrief-voice-20261011`, branch `codex/portfolio-debrief-voice-20261011`, base `bbf25e6ab4931886f5a382ee3362593e573c19de`. Current backend fetched `origin/main` is `fd8765ec01d292013758606204f2c9d886cd31c1`. Shared policy clean local `b32b4803933760dc0a93fffdcd8fba30a89c3aac`, fetched `b2b0ce8c2bf03817b81e671d968b7892985b8d06`; machine-map baseline2026-09-30. Repository AGENTS and implementation standards read; Node24.19.0, dependencies borrowed read-only, no installs.

## Retained design and boundaries

Figma design-to-code context and screenshots inspected for desktop `682:142766` and mobile `698:142695` on Prototype3.1. They show Record Voice Memo, an audio-file input and upload action. Root explicitly scoped this to the retained file chooser; **no microphone recording controls or microphone access** were added. Dialog geometry/tokens reuse shared Dialog, buttons, Geist and the approved primary gradient. No static image asset appears in these frames.

New voice modules own only audio selection/playback, scoped upload/extraction coordination and reviewed-source presentation. Files owns the single uploader; Calendar library owns extraction; shared Calendar access owns identity/runtime guards; root owns DebriefGeneration/chooser/API composition and saving. The public component interface is:

```ts
VoiceMemoSource({ meeting, open, onOpenChange, onGenerate });
// onGenerate: (source: ExtractedMeetingSource & { method: 'voice' }) => boolean
```

The callback runs only on explicit Generate Debrief after a verified transcript is displayed. It returns whether root accepted generation. Selecting, previewing, uploading, extracting and reopening never invoke it. Generation/save/approval/sharing remain separate canonical operations.

## Verified source contracts

- `POST /api/engagement/attachments/upload-url`: canonical parent-bound upload ticket, 25MiB server limit and audio MIME prefix allowlist; runtime external-write guard.
- Signed form transport and `POST /api/engagement/attachments/confirm`: canonical uploader, exact meeting/client/file/key receipt. Backend7512 serializes the key and returns exact same-actor/metadata replay; changed metadata conflicts. Confirmation verifies bytes and records actual quarantine/scan state.
- `GET /api/engagement/attachments?meetingId=…`: tenant/viewer/parent/governed projection with explicit usable/blockedReason/scanDisclosure. Voice verifies selected ID, meeting/client, file name and MIME, then requires usable:true before extraction; storage success alone is insufficient.
- `POST /api/engagement/attachments/:id/extract-text`: backend7743 rechecks tenant/viewer/parent/governed/readiness before bytes/provider access; audio uses existing Whisper path. Actual audio receipt includes attachmentId/text/source:'transcription'/contentHash and optional disclosure, **no truncated field**.
- `POST /api/engagement/meetings/:id/debrief-draft` already accepts method:'voice'; generation returns a proposal, not a saved debrief. Root owns wiring this existing operation.

Root prerequisite `1d0604ea45f0cded5be12de40a275b5b4e0c27ea` was cherry-picked as `ce538ea`: existing library helper is deliberately public and truncated optional without a fabricated default. Missing completeness is disclosed during review. No local edits to existing library/Files/API/shared surfaces.

Voice validation reuses Files validation and restricts this chooser to audio and MP3/MP4/M4A/MPEG/MPGA/WAV/WebM filename formats documented by the existing provider's [official speech-to-text guide](https://developers.openai.com/api/docs/guides/speech-to-text). Backend bytes/MIME checks remain authoritative. No transcoder, speech client or provider configuration was introduced. Actual codec/provider/scan acceptance is unverified without authorized live writes.

## State, consent and failure handling

Upload and transcribe is explicit. Audio preview uses a local blob URL; it pauses/releases the element and revokes that URL on close/change/unmount. Closing aborts the component lifetime; the initiating actor/tenant/meeting/client remain bound, with canonical guards before each asynchronous dispatch and after responses. Identity/runtime invalidation refuses further dispatch. Duplicate clicks use a synchronous pending fence.

The same File and upload attempt persist after bytes may have left the browser. Quarantine/readiness or pre-dispatch failures permit an explicit check of that same upload; confirmation retries reuse the original key and never resend bytes after unknown storage completion. Different audio bytes cannot reuse a confirmed attempt. Unknown extraction, including malformed/wrong-ID replies or provider-after-dispatch errors, freezes the original source across close/reopen; it never automatically retries. Current extraction provides neither an idempotent transcription operation nor durable transcript readback, so unknown completion cannot be safely recovered here. Required backend dependency: actor/tenant/attachment/content-hash-bound transcription operation key and scoped terminal text/unknown readback, with agreed retry/reconciliation semantics. No backend change is made in this slice.

## Qualification checkpoint

Initial source commit: `8e6ea866739e2e8a776379a72c8b7b638e60a0ef`. Focused13 unit cases passed. Application TypeScript, scoped canonical ESLint, architecture and formatting checks passed using Node24.19.0 and the read-only dependency resolver. The first unit setup lacked a Next navigation resolver and ran zero cases; the first lint found render-time ref access, corrected to explicit attempt-state snapshots without weakening rules. The first browser launch resolved two installed Playwright versions and ran zero cases; a process-scoped read-only resolver now binds the same canonical package for runner and tests. These setup/source failures remain distinguished from the final checks.

Dedicated synthetic Chromium component browser checks: **14 passed**, no retries. Cases cover explicit upload/review/generate consent, real audio response shape without completeness, scan quarantine and same-key readiness recovery, post-dispatch provider400/500 uncertainty, wrong-parent confirmation refusal, pre-dispatch stale identity, actor change during ticket/extraction, same-actor identity invalidation and refetch during extraction, storage interruption plus close/reopen without repeat bytes, late receipt refusal, unsupported source validation, object URL cleanup, mobile dark geometry and disabled runtime. New QueryClient component-boundary cases demonstrate that same-actor local authority failures do not reset the frozen upload/extraction state; restoration and reopening do not permit another extraction. A genuine actor/tenant change resets the visible source and refuses the old actor's late result. Existing source required no additional patch for these regressions.

Desktop light selection and transcript review, and mobile dark screenshots were inspected against the current Figma contexts. Desktop dialog660px; mobile358px at390px viewport with16px padding; Geist loads, dark surface is the shared token, no horizontal overflow. Audio playback and transcript review intentionally add height and an intermediate explicit action to preserve consent and disclose actual service completeness. Synthetic bytes are not playable audio, so the selection screenshot truthfully displays the playback warning; codec/provider playback is not qualified. Canonical shared Dialog provides keyboard/focus behavior; this focused slice does not claim a fresh full accessibility audit.

Evidence is packaged under task outputs `evidence/portfolio-voice-source-20261011/`. Exact focused commands, result JSON, source/base/policy references, setup qualifications and screenshots accompany the checkpoint. The isolated server is a synthetic component harness on5202; it is not a separate hosted preview. Root owns the production Calendar chooser/debrief integration, public export, canonical shared fixture composition and final full build. No full build, live microphone, storage upload, extraction, generation or shared-data write ran. This checkpoint does not claim end-to-end live acceptance or complete Portfolio coverage.
