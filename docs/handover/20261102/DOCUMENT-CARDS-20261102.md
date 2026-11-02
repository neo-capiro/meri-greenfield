# Document cards, PDF export and Files access (M26, M23, M24, M27/X02) — 2 November 2026

Acceptance run 20 (General scope, frontend 4a586773 / task definition 75, Meri cut 4) found that a generated
Word document reached Files but the chat rendered no card, that Meri said the card was "above" and that saving
"requires a client", that an Excel workbook had no card either, that "export as PDF" produced a .docx, and that
the Files page dropped to "Current file access is unavailable" every few seconds. This note records the root
causes and the two companion changes (meri-greenfield `fable/document-cards-20261102`, capiro-frontend
`fable/document-cards-fe-20261102`).

## Root causes

1. **No card (M26, M23).** `request_document` (create_word / create_excel / create_powerpoint) prepares an immutable
   draft version through the intents mount (`apps/control/intents/mount.mjs`, `document-preparer.mjs`) and settles it
   in the intent journal. Nothing appended the run's `artifact.available` event: only the selected-skill output path did
   (`apps/control/conversations/skills/execution.mjs:56`). The transcript renders files only from that event
   (`apps/web/src/features/meri/workspace/workspace-view.ts`, case `artifact.available`), plus prepared drafts from
   the approvals list, which the panel reads only when `MERI_INTENT_APPROVALS_WORKFLOW_ENABLED` is on
   (`ConversationPanels.tsx`: `files([])` otherwise). So the draft existed in the library and nowhere in the chat.
2. **"Document card above" / "requires a client" (M26).** The tool result notice told the model only "PREPARED DRAFT:
   an immutable draft version was created for the user to review … filing or sharing it is a separate request"
   (`apps/worker/conversation/intents/results.mjs:49`); the model invented the rest. Filing into a client's documents
   (`save_chat_attachments`) is composed only for a client conversation (`apps/runtime/product-ports/documents.mjs:117`,
   `selectedClientId===null` returns the document preparers alone), so "needs a client" is the real scope rule for
   *filing*; the draft itself is already under Files > My files. The notice now says exactly that.
3. **No PDF (M24).** The canonical `WordRequest` admits `format: "pdf"`, the artifact service renders DOCX → PDF through
   the qualified LibreOffice renderer (`apps/artifacts/office-transform.mjs`) and the document application admits PDF
   when `features.artifacts.pdfAdmission` is true AND the renderer port is available
   (`apps/runtime/artifacts/composition.mjs:49`). The intents path never saw that admission: the preparer called
   `admitDocumentDescriptor(descriptor)` with the default (no PDF) and the worker's tool schema advertised the default
   formats regardless of the composition (`apps/worker/conversation/intents/schema.mjs`, `admittedFormats`). The
   model was told the truth about its tool and substituted a .docx.
4. **Files flapping (M27/X02, X14).** The Files page's session owner (`SessionLifetimeController`) ends every session
   itself `RENEW_LEAD_MS` (45 s) before its cap, and the cap follows the Core identity receipt (Clerk session token,
   about 60 s), so a renewal is due roughly every 15 s. The conversation reopens on `expired`/`renewal`; the Files page
   (`DocumentLibrary.tsx`, `LibraryConnection`) treated every non-ready state as "Current file access is unavailable.
   Previously loaded details have been cleared", unmounted the loaded pages and waited for "Check access again".
   Control answers each renewal with a fresh 200 receipt; nothing on the backend flaps.

## Changes (meri-greenfield)

- `apps/control/intents/mount.mjs`: optional `publishDraft` hook, called once per first preparation of a document
  draft (never on replay); a failed publication never withdraws the journaled draft. `readAvailability` carries each
  preparer's declared `formats`.
- `apps/runtime/native-authority/draft-publication.mjs` (new): appends the run's `artifact.available` event for the
  draft version through the conversation store, bound to the run and its current scopes, with a deterministic event
  id (replay-safe). Wired in `execution-composition.mjs` from the conversation `store` (`apps/runtime/control.mjs`).
- `apps/control/intents/document-preparer.mjs`, `apps/runtime/artifacts/intent-preparers.mjs`,
  `apps/runtime/product-ports/documents.mjs`: PDF admission for `create_word` flows from the same switch and renderer
  check the document application uses; preparers declare their admitted `formats`.
- `apps/runtime/native-authority/intents-client.mjs`, `apps/worker/conversation/intents/{runtime,server,tools,schema}.mjs`:
  the offer's declared formats reach the `request_document` tool schema, so `pdf` is advertised exactly when the
  owner admits it (never wider than the canonical request).
- `apps/worker/conversation/intents/results.mjs`: the PREPARED DRAFT notice names where the file is (card under
  "Files in this conversation", Files > My files) and that filing to a client is a separate request offered only in a
  client conversation.

## Changes (capiro-frontend)

- `ConversationArtifacts.tsx`: the card reads its details on mount and shows filename, kind, size and version at once,
  Download, Details, and "Open in Workspace" for Office documents (PR 489's `OfficeWorkspaceLink`).
- `DocumentLibrary.tsx`, `document-library-state.ts`, `library-connection.ts` (new): loaded files stay mounted through
  renewal and unanswered issuance (quiet reconnect, bounded backoff 2/5/10/30 s); only 401/403 after the owner's
  retries, a port denial or a changed origin clears them.

## Live inputs for the release owner

- PDF needs the preview material to declare `features.artifacts.renderer.enabled: true` and
  `features.artifacts.pdfAdmission: true` (render-material.mjs refuses PDF admission without the renderer). The renderer
  is the LibreOffice in the runtime image (`MERI_RENDERER_IMAGE_DIGEST`); no Collabora `convert-to` route is used.
  Without these two values the tool keeps advertising docx/txt/xml only and says so honestly.
- No contract package change: `artifact.available` already exists in `@capiro/meri-contracts` 0.1.50.
