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

Initial focused13 unit cases passed; application TypeScript passed with the read-only resolver; scoped canonical lint passed after correcting render-time ref access to explicit attempt-state snapshots. The first unit setup lacked a Next navigation resolver and ran zero cases; this setup failure is preserved. Browser and visual qualification follow in a separate commit. No full build, live microphone, upload, extraction, generation or shared-data write ran. This checkpoint does not claim end-to-end live acceptance or complete Portfolio coverage.
