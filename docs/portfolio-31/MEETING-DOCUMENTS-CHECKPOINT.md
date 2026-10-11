# Saved meeting document preview and preparation PDF attachment

## Ownership and outline

- Worktree: `C:/dev/meri-portfolio-meeting-documents-20261011`.
- Branch: `codex/portfolio-meeting-documents-20261011`.
- Starting frontend commit: `f595bb064afb287f259b5aaf01c4a506658de7a2`.
- Shared policy: clean `b32b4803933760dc0a93fffdcd8fba30a89c3aac`; fetched remote `b2b0ce8c2bf03817b81e671d968b7892985b8d06`. Machine map baseline: 2026-09-30.
- Verified backend source: freshly fetched `origin/main` `fd8765ec01d292013758606204f2c9d886cd31c1`. Initial primary-checkout inspection at `f1f672d9` was superseded by exact remote-commit inspection; no backend edits.
- Own only new `calendar/documents/**`, focused tests, and this report. Root owns existing preparation/artifact pages, public cross-feature exports, route/harness composition, and shared fixtures.

The existing saved preparation renderer owns content layout. Document preview composes it with the shared Dialog; debrief displays its canonical saved plain-text body without inventing structured recap fields. The pure browser-print adapter owns inert document serialization and the explicitly opened popup. API adapters own saved-source revalidation and preparation PDF receipt/uncertainty classification. Canonical calendar access guards own actor, role, and runtime capabilities; a focused lifetime wrapper revokes delayed actions after the document changes or unmounts. No PDF package, parallel composer, API client, uploader, or backend renderer was added.

## Audit IDs and contracts

- `ENG-prep_export`: local preview and browser Print / Save as PDF of the canonical saved preparation.
- `ENG-debrief_export`: local preview and browser Print / Save as PDF of the canonical saved debrief.
- `ENG-prep_pdf_attachment`: explicitly reviewed `POST engagement/meeting-preps/:id/pdf-attachment`, exact existing `{id,fileName}` receipt, then caller-owned MailCompose seed. This component never sends email.
- `GET engagement/meetings/:id`: canonical selected meeting and saved prep; returned meeting ID/client and prep association must match.
- `GET engagement/meetings/:id/debriefs`: canonical saved debrief selected by ID, after meeting/client revalidation.
- `GET engagement/capabilities`: existing runtime `externalActionsEnabled` gate for stored attachment creation.

New public feature surface:

```ts
SavedMeetingDocumentPreview({ meeting, document, onClose });
// document = {kind:"preparation",preparation} | {kind:"debrief",debrief}
PreparationPdfAttachmentReview({
  meeting,
  preparation,
  open = true,
  onClose,
  onPrepared,
});
// onPrepared receives {id:string,fileName:string}; readiness is NOT implied.
```

`DocumentMeeting` requires only canonical `id`, `subject`, and `client`. Root should key a document session by actor/tenant/meeting/client/document ID. Attachment receipt may seed the existing reviewed MailCompose `initialDraft.attachments`; canonical Files availability/scan checks remain mandatory there. Root owns that composition. Canonical `filesKey` is invalidated on verified attachment creation.

## Source fidelity and permission boundaries

Review follow-up: saved-document query keys include tenant and user, are enabled only for the verified allowed initiating actor, and recheck the canonical read session before/after awaited reads. Print consumes the query's exact internal key. Controlled `open?: boolean` defaults to true. Keep a selected preparation review mounted with `open=false` across Close/reopen of the same scope; this preserves uncertain/completed latches. Closing synchronously revokes its layout lifetime, so neither delayed POST nor receipt can proceed after close/reopen. Only an actual actor/tenant/meeting/client/prep session change should remount/reset it. This state is in-memory only; durable recovery across reload remains the backend idempotency prerequisite.

Figma high-fidelity design context and valid reference screenshots inspected for prep PDF `683:142867` and debrief PDF `689:142613`, on Prototype 3.1. Shared 660px modal, Geist, 20px heading, 13px content, 16px spacing and approved primary gradient are reused. An explicit print button makes the described Print / Save as PDF action functional. No static assets were supplied or needed. Saved content replaces mock values; debrief API exposes plain body, so the preview labels it truthfully rather than fabricating Recap/Action items/Intelligence sections.

Local print preserves Unicode, line breaks, lists, saved structured item text and permitted source links. It serializes only inert whitelisted text/markup, strips executable attributes/scripts/resources, adds a restrictive CSP, and severs popup opener. Popup refusal remains visible in the original dialog. Printing is explicit; no import-time browser allocation or automatic printing on page load.

Restricted/confidential debriefs and institutional `research_portfolio_institutional_v1` preparation refuse this export path. Server source authorization remains canonical `assertSavedMeetingPrepAccess` and meeting ownership. UI checks do not establish backend ACL proof.

At verified backend source, `meeting-prep-pdf.ts` `strings()` drops structured legacy list/email objects. `printable()` replaces non-WinAnsi characters, and collapses whitespace. The stored-PDF path therefore refuses structured lists/email evidence, generated metadata, or unsupported characters (including meeting title). The message names source fidelity and offers local print; it does not mislabel the limitation as a permission denial. Ordinary string-only compatible saved preparations can use the current endpoint.

## Concurrency, recovery, and exact remaining dependencies

The stored attachment adapter re-reads the canonical saved preparation, compares a semantic snapshot with the reviewed version, and rechecks the initiating actor/lifetime/current capabilities immediately before POST. Query invalidation, fetch/error/pending states, tenant/user/role change, and unmount refuse delayed dispatch. A synchronous attempt latch rejects duplicates. Errors before POST are safe refusals; POST network/400/404/409/5xx or malformed receipts are uncertain and freeze the original attempt. Explicit 401/403 guard refusals permit a fresh reviewed attempt. No automatic POST retry.

**BLOCKED exact revision consent:** the backend route accepts no expected prep revision or request key. A concurrent change after GET and before server read cannot be fenced by frontend comparison. Root/backend owner must add a versioned strict endpoint with required saved revision, validate meeting/client/source inside its transaction, snapshot the exact renderer input, and persist an idempotent attempt/attachment receipt. Until then, this candidate must not claim exact reviewed-byte consent or durable duplicate-free recovery across remount/network loss.

**BLOCKED source fidelity:** backend owner must normalize all canonical structured item and email-evidence forms, preserve displayed generated coverage/limitations and gaps, and embed a Unicode-capable font with corresponding content tests before relaxing compatibility refusals. Local print is the available faithful path for ordinary rich/Unicode prep. No backend change is allocated here.

**BLOCKED email distribution acceptance:** the separate email checkpoint documents `loadGraphAttachments` ordinary Files viewer ACL enforcement gap; this slice neither fixes nor bypasses it. Canonical MailCompose readiness is necessary, not proof of outbound server ACL.

Root owns production page composition, which is included in the focused Calendar browser checks below. No live PDF render/storage/upload/email/provider calls, shared backend writes, auth changes, deployment, or hosted preview changes were made. Synthetic interception proves frontend behavior only. Native browser print-to-PDF dialog/file saving and OS font availability require manual real-browser acceptance; automated checks inspect the actual inert popup document and explicit print invocation.

Root composition `6631892fab039ee2569c40b1e1d964e5ec5f3517` was applied locally as `44f32a17f94dbf5ef2d0a6faca9fcfe9ca49e6d8` for actual CalendarPage acceptance. A browser regression reproduced cancellation leaving a completed PDF review unable to reopen email. The review now retains its verified `{id,fileName}` receipt and offers “Review previously prepared PDF” behind the current actor/lifetime guard, without another POST. It labels the original saved file and explicitly excludes later preparation changes. The existing composer receives an unverified seed on every reopening and must re-read canonical attachment availability/scan status; receipt reuse does not establish readiness. Unknown attempts remain frozen and have no resume action.

## Verification

First focused run: 28/28 units and 12/12 browser cases passed. Added regression coverage then found two verification issues: canonical React lint rejected an original-actor ref read during render, fixed with conditional render-safe state binding; one browser assertion expected the raw 403 text, but the shared QueryState intentionally displays its canonical permission message. The assertion now checks that actual contract plus retained Retry, zero writes, disabled print, and no stale content. Original lint output, browser JSON, failure screenshot and context remain preserved. Assertions and shared error behavior were not weakened.

Visual review found the mobile Close control wrapping below a long heading. Scoped header layout now keeps it beside the title; a geometry assertion protects this. Valid Figma reference images and final light desktop/dark mobile browser captures are retained. Synthetic data intentionally changes text/height; the same shared content renderer preserves saved evidence rather than matching fixture copy. Native browser print is explicitly invoked and the inert popup document, Unicode, source links, escaping, opener removal and absence of executable resources are asserted. OS print dialog/file saving remains NOT RUN.

Final focused checks and source-bound evidence are recorded in the task output package; delivery records exact command exits and case counts. Whole Next build, live API writes, PDF storage, provider/email delivery, server race closure and hosted preview deployment are NOT RUN or BLOCKED as described above.

Actual Calendar composition checks cover preparation preview, explicit prepare-to-existing-composer with fresh readiness, saved debrief preview, and composer cancel/reopen with later prep edits and one PDF POST. The first combined run (23/25) exposed two test setup assumptions: `blockedReason:null` violated the canonical optional-string Files schema, and React Query observer timing could leave the print button enabled until its canonical event guard ran. The fixture now omits the absent field; the invalidation test accepts either immediate disabled state or explicit guarded click and still requires visible refusal, no print popup, and no dispatch. Both initial failures and the positive cancellation reproduction are preserved separately.

The cancellation regression failed on the original completed review, then passed with receipt reuse. Its first expanded suite run (25/26) retained an old assertion expecting the removed disabled Prepare button. That assertion now requires no Prepare button and explicitly invokes the receipt-review action while retaining the one-POST assertion. Final qualification: 31/31 units, 26/26 browser cases (22 focused document cases plus four actual Calendar composition cases), and typecheck/lint/architecture/format/diff exits 0 under Node 24.19.0. These are synthetic frontend checks; the server and manual acceptance dependencies above remain open.
