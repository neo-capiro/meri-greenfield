# Native Office qualification — 29 October 2026

Thirty synthetic Office files (ten each of DOCX, XLSX and PPTX) were opened, edited with native keyboard input and saved by Collabora CODE 26.04.5.2. All thirty saved files passed the production native-byte inspector. The existing immutable publisher published their exact bytes, preserved the parent, and reconciled replay to the same version with no second effect. Twenty-five files matched every selected semantic check; five retained explicit compatibility differences. This is bounded local qualification, not universal fidelity or deployment acceptance.

The [machine-readable evidence](OFFICE-NATIVE-QUALIFICATION-20261029.json) records each feature, source/saved SHA-256 and size, semantic checks, differences, exact publication and lifecycle results. Inputs, saved files, native screenshots, failed attempts and scripts remain in the task-owned qualification directory. The user-facing `outputs/office-qualification` copy contains only synthetic inputs, outputs and scrubbed evidence; no TLS material or tokens.

## Environment and boundary

- CODE image: `collabora/code@sha256:c7415b963e32eb0986a562583f154d36d3d7a461e1ddfb660a95e87094328acb`.
- Ubuntu 26.04 WSL x64, native Docker 29.1.3, Node 24.22.1 and Chromium 149.0.7827.55. The task-owned container used 4 GiB / 2 CPUs and local TLS termination; it was not deployed.
- Production WOPI/token/Core-client/artifact owners and the actual frontend frame/controller ran against scripted Core HTTP/SQL/object ports. Native Core PostgreSQL and a deployed full application were not part of these crossings.
- Synthetic files only; no credentials, customer documents, paid/model calls or production activation. The user explicitly authorized isolated local qualification. Independent review and deployment remain held.

## Corpus

DOCX covers styles, Unicode, section orientation, headers/footers, merged/nested tables, footnotes/endnotes, comments, tracked insertions/deletions, image pixels/alt text, numbering, bookmarks/fields/internal links and 650 paragraphs. XLSX covers formulas and cached recalculation, currency/date/percent formats, merged/wrapped cells, bar/line charts, conditional formatting/validation, cross-sheet formulas, names/print settings, Unicode/comments/fonts and 10,000 rows. PPTX covers bullets/notes, tables, bar/pie/line charts and embedded workbooks, named masters, fonts/Unicode, image pixels, shapes/connectors, slide sections and 30 slides. Native before/after contact sheets were visually inspected; no pixel-identical claim is made.

| File | Recorded difference | Resulting limit |
| --- | --- | --- |
| xlsx-02 | Currency format `$#,##0.00` becomes `\$#,##0.00`; value 1234.567 is retained. | Visually equivalent currency formatting; strict format-string comparison differs. |
| xlsx-09 | Liberation Sans becomes Arial. | Unicode retained; exact font fidelity unresolved. |
| pptx-03 / pptx-04 | Embedded XLSX chart workbooks and externalData links are removed; charts retain series, labels and cached values, with internal formula references. | Chart visuals survive; embedded-workbook editability is not established. |
| pptx-06 | Liberation Sans/Serif become Arial/Times New Roman. | Unicode retained; exact font fidelity unresolved. |

## Lifecycle findings and fixes

Native CODE repeats token-expiry warnings immediately after resets for short-lived tokens. The original frontend produced 3,893 renewals in about 30 seconds. The frame channel now admits one renewal per token window. Native editing and Save continued past the original token expiry with one renewal; hard expiry still removed the frame. Revoked credentials refused storage and did not advance the draft.

CODE's `Action_Save_Resp` can report success for local Save even when WOPI storage fails. The frontend now reads authoritative draft metadata before and after Save and requires a newer revision when edits were pending or arrived during Save, with the same editor/epoch. Native cases confirmed first Save, reconciled committed bytes after a lost acknowledgement, and rejected a failed later Save despite CODE's success response. The rejected case removed the frame and required recovery; it never reported the earlier saved revision as confirmation of new edits.

After forced CODE termination/restart, automatic reconnect was not established. Reopening without releasing the earlier editor produced a correct lock conflict. Explicit release through the canonical Core client followed by acquire reopened the same saved draft at editor epoch 2; its SHA-256 and sequence were unchanged and the old editor token was refused. This does not establish automatic reconnect, retention across WOPI/Core host loss, or native PostgreSQL crash recovery.

The WOPI parser now accepts CODE's single `permission=edit|readonly` UI hint. It grants no authority: signed token, current Core/artifact access, editor epoch and lock checks remain mandatory. Read-only tokens with an `edit` hint remain read-only; malformed/duplicate hints and unknown query fields are refused.

## Source checks and remaining acceptance

Frontend [341](https://github.com/neo-capiro/capiro-frontend/pull/341): source `0b0fb98fd353be093e6365734d626baea6017f5a`, tree `6d3940290f7475e3a6a6c0fb5811a5c119b6187f`, merge `aba69e466333f3ad6d13509bb8018e7144188d69`; exact fetched tree verified. Twenty-one frame/controller/session tests, four Chrome component tests, full web TypeScript, touched lint/format and diff pass. Architecture matches main339's four existing errors and 79 blocking fingerprints, with none introduced. The session fixture now retains editor state across reads instead of incorrectly returning no editor after launch.

Runtime: 35 focused WOPI/discovery/local-HTTP tests, zero skips, runtime TypeScript and diff pass after integrating parent384. The changes are limited to the WOPI query parser, its tests and this evidence/readiness documentation. Public packages, lockfiles, distribution files, frontend pins and parent retention/migration files are untouched.

Still open: the five corpus differences; native Core PostgreSQL plus CODE/full application crossings; production ARM64, hosting/network/retention acceptance and exact-digest release gates; actual deployed user flows and independent review. Source completion and native fixture results do not close A7 activation.
